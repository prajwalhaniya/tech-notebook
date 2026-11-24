---
sidebar_position: 11
---

# Design a Rate Limiter

A rate limiter decides, for every incoming request, whether to let it through or reject it, based on how many requests that same caller has already made in a recent window. Its hardest problem isn't the counting algorithm — that part is a well-understood, almost mechanical choice. It's that the limiter has to enforce **one logical count correctly across many request-handling nodes operating concurrently, at network speed**, without the check itself becoming a meaningful tax on every request's latency, and without becoming a single point of failure that takes down the whole platform if it's slow or unreachable. This design is built around solving exactly that.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Capacity Estimation](#capacity-estimation)
4. [System APIs](#system-apis)
5. [Database Design](#database-design)
6. [High-Level Design](#high-level-design)
7. [Component Design](#component-design)
8. [Enforcing One Limit Across Many Nodes: The Boundary Race Condition](#enforcing-one-limit-across-many-nodes-the-boundary-race-condition)
9. [Data Partitioning](#data-partitioning)
10. [Caching Strategy](#caching-strategy)
11. [Consistency Model](#consistency-model)
12. [Security](#security)
13. [Monitoring & Analytics](#monitoring--analytics)
14. [Trade-offs](#trade-offs)
15. [Additional Considerations](#additional-considerations)
16. [Summary](#summary)

---

## Problem Statement

Design a rate-limiting service that sits in front of a large API platform where:

- Every incoming request must be checked against one or more configured limits before it's allowed to reach the backend — e.g., "100 requests/minute per API key," "5 requests/second per IP," "10,000 requests/day per free-tier account."
- Different callers get different limits: a paid tier gets a higher ceiling than a free tier; some endpoints (password reset, OTP send) need tighter limits than ordinary reads.
- A caller should be able to **burst** briefly above its steady-state rate (a user who was idle for a minute shouldn't be capped at exactly "N per second" the instant they start clicking) without that burst allowance turning into an unlimited loophole.
- A rejected request gets a clear, standard signal (HTTP 429, a `Retry-After` hint) rather than a silent timeout or an ambiguous error.
- Limits are enforced by **many physical nodes** — dozens to thousands of API gateway instances across multiple regions — all deciding, independently and at the same instant, whether the *same* caller's *next* request is allowed.
- The limiter itself must never become the platform's bottleneck or its outage: it sits on the critical path of every single request, so it must add negligible latency, and its own failure must degrade gracefully rather than take every other service down with it.
- The distinguishing constraint, and the one the rest of this design is organized around: **two requests from the same caller, arriving in the same instant at two different nodes, must never both be allowed past a limit that only had room for one** — the classic distributed check-then-act race condition, at a scale where it happens constantly, not as a rare edge case.

---

## Requirements

### Functional Requirements

1. **Configurable limits** per identity dimension — user, API key, IP address, and resource/endpoint — with different values per tier (free, paid, internal).
2. **Burst tolerance**: allow a caller to exceed its steady-state rate briefly, up to a configured ceiling, rather than enforcing a perfectly flat cap every instant.
3. **Clear rejection signal**: HTTP 429 with `Retry-After`, plus `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers on every response (allowed or not) so well-behaved clients can self-throttle.
4. **Stacked limits**: a single request can be subject to more than one policy at once (e.g., 10 req/sec burst **and** 1,000 req/day sustained) — it's allowed only if it passes every applicable policy.
5. **Live policy updates**: operators change a limit's value without redeploying the services that enforce it.
6. **Node-independent enforcement**: a caller can't dodge its limit by having consecutive requests happen to land on different gateway nodes.

Out of scope: usage-based billing, fraud/bot detection beyond simple threshold-based abuse limits, and per-request cost functions based on payload size or compute cost (every request counts as 1 unit unless a policy says otherwise).

### Non-Functional Requirements

1. **Scale**: ~50 billion requests/day across the platform, peak ~2.3 million rate-limit checks/sec, ~20 million distinct actively rate-limited identities.
2. **Latency**: the check itself adds **p99 < 1 ms** to the request path — it runs on literally every request, so it has almost no latency budget to spend.
3. **Availability**: 99.99%+ for the overall request path. If the limiter's own backing store is unreachable, the system must follow an explicit, named fail-open or fail-closed policy rather than stall or crash the request pipeline.
4. **Accuracy**: approximate is acceptable. A caller may occasionally be let through slightly over its configured limit (bounded, on the order of a few percent) in exchange for speed and availability — it must never allow an order-of-magnitude overshoot.
5. **Consistency**: a limit is enforced as **one logical quota**, regardless of how many physical nodes are concurrently handling that identity's traffic.
6. **Durability**: counter state is explicitly **not** durable data. Losing a counter on a node restart (resetting someone's count a little early) is an acceptable, bounded cost — not a correctness bug worth paying replication or persistence overhead to prevent.

---

## Capacity Estimation

### Traffic Estimates

- **Platform traffic**: ~50 billion requests/day → average ≈ 580K QPS, peak (≈4x) ≈ **2.3 million checks/sec**.
- Every one of those requests must pass through the limiter — its throughput ceiling **is** the platform's throughput ceiling, by definition.

**So what:** this is the central design pressure, and it isn't storage or algorithmic complexity — it's that, 2.3 million times a second, somewhere, a counter has to be read, evaluated, and incremented inside a latency budget measured in microseconds to low single-digit milliseconds, because this check sits on literally every request's critical path.

### Storage Estimates

- **Distinct active rate-limited identities**: ~20 million (users, API keys, IPs with recent traffic).
- Average ~3 policies apply per identity (a burst limit, a per-minute limit, a per-day limit) → ~60 million live counters at any time.
- Each counter is tiny — a token count plus a last-refill timestamp, well under 100 bytes → 60M × 100 B ≈ **6 GB**.

**So what:** this is not a storage-capacity problem at all. The entire working set of counters for the busiest tier of the platform fits comfortably in memory on a handful of nodes. The actual challenge is sustaining 2.3 million reads-and-writes per second against that small dataset with sub-millisecond latency — a throughput and concurrency problem, not a capacity one.

### Latency Budget

- A synchronous round trip to a remote, same-AZ in-memory store typically costs 0.3–1 ms on its own — which already consumes most of the 1 ms p99 budget from requirement #2, before any other work the gateway has to do.

**So what:** doing a network round trip to a shared store for every single request, for every policy that applies to it, doesn't fit the budget at this QPS. This is the number that pushes the design toward a **hybrid local-plus-central** enforcement model (see [Component Design](#component-design)) instead of a synchronous call to a central store on every request.

### Bandwidth Estimates

- 2.3M ops/sec × ~100 bytes round trip to the counter store ≈ a couple hundred MB/s of internal east-west traffic at peak.

**So what:** trivial in raw bytes, same as the fan-out traffic in other designs in this notebook — the number that matters here is **2.3 million discrete network round trips per second**, not the byte count, which is exactly why minimizing *how often* a request needs to touch the shared store matters far more than minimizing the size of each call.

---

## System APIs

The limiter exposes an internal check API that every gateway/service calls on the hot path, and a separate, low-traffic admin API for policy configuration.

```http
# Hot path — called on (effectively) every request
POST /v1/ratelimit/check
Body: { "key": "apikey:9f2e", "policies": ["burst_10s", "daily_1000"], "cost": 1 }

Response 200 (allowed):
{ "allowed": true,
  "remaining": { "burst_10s": 7, "daily_1000": 812 },
  "resetAt":   { "burst_10s": "2026-11-23T10:00:11Z", "daily_1000": "2026-11-24T00:00:00Z" } }

Response 200 (over limit — the gateway translates this into the public 429):
{ "allowed": false, "violated": "burst_10s", "retryAfterMs": 420 }

# Policy management (admin, low traffic)
POST  /v1/policies   { "resourcePattern": "POST /v1/orders", "tier": "free",
                        "algorithm": "token_bucket", "limit": 100, "windowSeconds": 60, "burst": 20 }
GET   /v1/policies/{resourcePattern}
PATCH /v1/policies/{policyId}
```

**Public contract, at the API gateway:** a rejected request returns `429 Too Many Requests` with a `Retry-After` header and `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers on **every** response — allowed or not — so a well-behaved client can see it's approaching a limit before it ever gets rejected, consistent with the error-body and header conventions covered in [API design](./Fundamentals/00_HLD%20Blueprint.md#3-api-design).

---

## Database Design

Policy configuration is small, read far more than it's written, and tolerates a few seconds of staleness — a normal relational table, cached aggressively, fits it well.

```sql
CREATE TABLE rate_limit_policies (
    policy_id BIGINT PRIMARY KEY,
    resource_pattern VARCHAR(255) NOT NULL,   -- e.g. "POST /v1/orders", or "*" for a platform default
    tier VARCHAR(50) NOT NULL DEFAULT 'default',
    algorithm ENUM('TOKEN_BUCKET','SLIDING_WINDOW_COUNTER','FIXED_WINDOW') NOT NULL DEFAULT 'TOKEN_BUCKET',
    limit_count INT NOT NULL,          -- e.g. 1000
    window_seconds INT NOT NULL,       -- e.g. 60
    burst_capacity INT,                -- token bucket only
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resource_tier (resource_pattern, tier)
);

CREATE TABLE clients (
    client_id BIGINT PRIMARY KEY,
    api_key_hash VARCHAR(128) UNIQUE NOT NULL,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The system's actual hot-path state lives nowhere near this table — it's a key-value structure in an in-memory store, not SQL at all:

```
# Counter store (Redis) — this is the real hot path, not the tables above
HASH rl:{policyId}:{subjectId}
    tokens        <float>      -- remaining tokens
    last_refill   <epoch ms>
TTL = window_seconds * 2        -- idle subjects' counters expire on their own;
                                 -- nothing has to actively clean them up
```

This split is deliberate, not incidental: policy rows change rarely and need joins/indexes for admin tooling, which a relational table is built for; counters change on every request, need an atomic read-modify-write under extreme concurrency, and need automatic expiry — none of which a relational row is built for, and all of which a key-value store with native atomic operations and TTLs is. See [Key-value stores](./Fundamentals/00_HLD%20Blueprint.md#6-database-selection) in the Fundamentals blueprint for why this is the default choice for exactly this access pattern.

---

## High-Level Design

```
 Client
    │
    ▼
 ┌────────────┐
 │ API Gateway │  ← every request's single, pre-existing choke point:
 └─────┬──────┘     adding the check here costs no extra network hop
       │
       ▼
 ┌──────────────────────────┐        ┌────────────────────────┐
 │ Rate Limiter Library /    │◀──────▶│ Local Policy Cache      │  ← refreshed periodically,
 │ Sidecar (in-process)      │        │ (per gateway instance)  │     policies change rarely
 └───────────┬───────────────┘        └────────────────────────┘
             │  local token-bucket check first;
             │  periodic lease sync, not per-request
             ▼
 ┌────────────────────────┐        ┌─────────────────────────┐
 │ Counter Store           │        │ Policy Config Service    │
 │ (Redis Cluster,         │        │  ← backed by             │
 │ sharded by subject key) │        │    Policy DB (SQL)       │
 └─────────────────────────┘        └─────────────────────────┘
             │
             ▼ (async, fire-and-forget)
 ┌─────────────────────────┐
 │ Metrics / Analytics      │
 │ pipeline                 │
 └─────────────────────────┘
```

### Key Components

| Component | Role | Why it's separate |
| --- | --- | --- |
| **API Gateway** | The enforcement point for every external request | It's already on every request's path for auth and routing, so the check costs no additional hop — folding rate limiting elsewhere would add one |
| **Rate Limiter Library/Sidecar** | Runs in-process or as a local sidecar next to each gateway instance | Kept physically close specifically to avoid a network round trip to a remote service on every single request — the latency budget from [Capacity Estimation](#capacity-estimation) doesn't allow one |
| **Local Policy Cache** | Holds the currently active policies on each gateway instance | Policies change on the order of minutes; counters change on every request. Caching the rarely-changing half locally removes an entire lookup from the hot path without risking the freshness that actually matters (the count) |
| **Counter Store (Redis Cluster)** | The one place a subject's count means the same thing no matter which gateway node is asking | Without a shared source of truth, N gateway nodes handling one subject's traffic would each independently allow up to the full limit — an N-times overshoot, not a bounded one |
| **Policy Config Service + DB** | Owns the rarely-changing configuration of who gets what limit | Its read/write pattern — occasional admin writes, periodic cache-refresh reads — looks nothing like the counters' extreme per-request churn, so sharing a store with the counters would mean over-provisioning this simple, low-traffic table for throughput it will never need |

---

## Component Design

### 1. Rate Limiting Algorithms

| Algorithm | How it works | Strength | Weakness |
| --- | --- | --- | --- |
| **Fixed window counter** | Increment a counter per fixed clock window (e.g., each calendar minute), reset to 0 at the boundary | Trivial, O(1) memory per key | Boundary burst: a client can send the full limit at `23:59:59.9` and again at `00:00:00.1` — effectively double the limit in a blink |
| **Sliding window log** | Store a timestamp per request, count entries newer than `now - window` | Exact | Memory grows with request rate — storing one entry per request is expensive at this QPS |
| **Sliding window counter** | A weighted blend of the current and previous fixed window's counts, weighted by how far into the current window "now" is | Approximates sliding behavior at fixed-window's O(1) cost | Approximate by construction — assumes a roughly uniform request distribution within the previous window |
| **Token bucket** | A bucket holds up to `burst_capacity` tokens, refilling at a steady rate; each request consumes one token, and is rejected if the bucket is empty | Naturally supports bursts up to capacity, smooth sustained rate otherwise, O(1) memory | Needs slightly more state (a last-refill timestamp) than a flat counter; burst size is a deliberate tuning choice, not automatic |
| **Leaky bucket** | Requests queue into a bucket drained at a constant rate; overflow is dropped | Strictly smooths the output rate — good for protecting a fixed-throughput downstream dependency | Adds queueing latency to accepted requests, and doesn't naturally fit "reject immediately when over" semantics |

**Decision: token bucket is the default.** Requirement #2 explicitly asks for burst tolerance, which token bucket gives for free; sliding window counter is reserved for the small number of strict anti-abuse policies (password-reset, OTP-send) where even an approximated burst allowance is undesirable. See [Token Bucket Algorithm](../DSA/Algorithms/Token%20Bucket%20Algorithm.md) for the underlying data structure.

### 2. Distributed Counter Store & Atomicity

The check-decrement-write sequence for one subject's bucket has to run as **one atomic operation**, not three separate round trips, or two concurrent requests can both read the same pre-decrement value and both be allowed — the exact race condition walked through in detail in the [dedicated section below](#enforcing-one-limit-across-many-nodes-the-boundary-race-condition). In Redis this is a Lua script executed atomically by the single-threaded command processor, or an optimistic `WATCH`/`MULTI`/`EXEC` transaction — either way, the store itself, not the application layer, is what serializes two colliding requests.

### 3. Local Caching & Hybrid Enforcement

Instead of every request round-tripping to the Redis cluster, each gateway node holds a **local sub-allowance (lease)** of a subject's global limit — if a key's global limit is 1,000/min and ten gateway nodes are currently seeing that key's traffic, each node is granted roughly 100/min, refreshed and rebalanced against the central store every few seconds rather than on every request. Most requests are then decided entirely in-process, with zero network round trip, and only the periodic lease renewal touches Redis. This is the mechanism that actually closes the gap between the 1 ms latency budget and a system that would otherwise need a remote call on every one of 2.3 million requests/sec.

### 4. Multi-Region Synchronization & Fail-Open Policy

Each region runs its own Redis cluster; a client's global limit across regions is reconciled **asynchronously** between regions rather than through a synchronous cross-region call on every request, which would both blow the latency budget and turn a cross-region network hiccup into a request-blocking dependency. If a region's counter store becomes unreachable, the system follows an explicit, named policy rather than an accidental one: **fail-open** (allow the request, log a warning) for ordinary traffic, protecting availability; **fail-closed** (reject) for a short, deliberately chosen list of especially abuse-sensitive endpoints — password reset, OTP send — where unlimited exposure during an outage is worse than a false rejection.

---

## Enforcing One Limit Across Many Nodes: The Boundary Race Condition

This is the section that matters most for this design specifically — the problem isn't "count requests," it's "count requests correctly when the counting happens from more than one place at once."

**The race, made concrete.** A caller's limit is 5 requests per 10 seconds (token bucket, burst capacity 5). The bucket currently holds exactly 1 token. Two of the caller's requests arrive at effectively the same instant, handled by two different gateway nodes, A and B:

1. Node A reads the bucket: `tokens = 1`.
2. Node B reads the bucket: `tokens = 1` — this happens before A's write has landed.
3. Node A computes `1 - 1 = 0`, allows its request, writes `tokens = 0`.
4. Node B, still holding its own earlier read of `tokens = 1`, independently computes `1 - 1 = 0`, **also allows its request**, and writes `tokens = 0`.
5. Result: two requests were let through when only one token existed. This is a textbook check-then-act (TOCTOU) race, and at 2.3 million checks/sec it isn't a rare edge case — it's a constant, given how many subjects have more than one in-flight request at any moment.

**The fix: make read-refill-decrement-write one atomic step, not three separate round trips.** With an atomic Lua script executed by Redis:

- At `t=0`, the bucket holds `{tokens: 1, last_refill: t0}`.
- Node A's and Node B's requests each invoke the same script with `(now, rate=0.5/sec, capacity=5)`. The script computes the refill (negligible over a few milliseconds), checks if at least 1 token is available, and if so decrements and writes the new state — all inside Redis's single-threaded command execution, which processes the two scripts one at a time, never interleaved.
- Whichever script runs first sees `tokens = 1` → allowed, writes `tokens = 0`. The second script then runs against the **already-updated** state, sees `tokens = 0` → correctly rejected.
- The single-threaded, atomic execution of the counter store isn't an implementation detail to optimize later — it's the actual mechanism that makes "one logical limit, many physical callers" correct at all. That property, not raw speed, is why a purpose-built atomic store like Redis is the standard choice here over a general-purpose, multi-threaded database.

**The same race reappears, deliberately loosened, in the local-lease model.** When a subject's allowance is sub-leased across ten gateway nodes (Component Design §3), two nodes can each legitimately allow a request against their own local sub-allowance with zero coordination between them — which is correct *for that node's slice*, but means the aggregate global limit can be overshot slightly during the window before the next lease rebalance, bounded roughly by `(node count) × (per-node slack)`. That bounded overshoot is exactly the "approximate, never an order-of-magnitude overshoot" trade-off named in NFR #4 — the hybrid model trades a little precision for the latency budget, on purpose, rather than by accident.

---

## Data Partitioning

- **Shard key**: the rate-limited subject (`user_id` / `api_key` / IP), hashed across the Redis cluster via consistent hashing, so a given subject's counter always lives on — and is served by — the same shard. That's what makes the atomic single-key operation above sufficient: every request contending for one subject's bucket always serializes through the one node that owns that key.
- **Hot key**: a single very high-traffic subject — a shared corporate NAT IP, or one unusually large enterprise tenant — can itself drive more ops/sec against its one key than a single shard comfortably serializes, independent of total system load. Mitigation: sub-shard that one subject's allowance across N sub-keys (`rl:{subject}:{n}`, chosen by hashing the request), each holding `limit / N` capacity, spreading the load across multiple shards at the cost of slightly looser precision — the same "hot partition, salt the key" pattern used for celebrity accounts and viral content elsewhere in this notebook.
- **Policy/metadata store**: deliberately **not** sharded. Policy writes are rare and the dataset is small — sharding it would be solving a problem this part of the system doesn't have, the inverse of the blueprint's own warning against reaching for distributed infrastructure before the load justifies it.

---

## Caching Strategy

| Data | Store | TTL / Invalidation |
| --- | --- | --- |
| Policies (limits per resource/tier) | Local in-process cache, every gateway/limiter instance | Refreshed by periodic pull (e.g., every 10s) or pushed via pub/sub on change; a few seconds of staleness on a rarely-changed value is free |
| Per-subject counter (authoritative) | Redis cluster, sharded by subject key | TTL = 2x the policy's window, so an idle subject's counter expires on its own instead of growing forever |
| Per-node local lease (sub-allowance) | In-process | Renewed and rebalanced against the Redis-held global count every few seconds |
| Decision audit events (allowed/rejected) | Async queue → analytics store | Never on the hot path — written fire-and-forget |

---

## Consistency Model

- **Per-subject counter**: deliberately AP-leaning. Under a partition between a gateway node and the counter store, the system keeps answering — using the local lease or a cached last-known state, or following the fail-open policy — rather than blocking every request on the store's recovery.
- **The limiter's correctness goal is "eventually bounded," not "linearizable per request."** A brief, bounded overshoot during lease rebalancing, or during a counter-store outage, is accepted by design (NFR #4) in exchange for never adding synchronous cross-node coordination to the request path.
- **Policy configuration**: standard read-after-write consistency is fine here — it's an admin workflow, not a per-request hot path, so there's no reason to weaken it for latency the way the counters are.

---

## Security

- **Stack limiting dimensions.** Applying per-IP *and* per-API-key *and* per-account limits means an attacker who rotates one dimension (a botnet cycling source IPs) is still caught by another (the account or API key all that traffic is ultimately authenticated against).
- **Protect the counter store itself.** If an attacker can flood the Redis cluster directly rather than going through the gateway, the rate limiter becomes the outage. The store should have its own capacity headroom and shouldn't be reachable from anything except the internal gateway/limiter nodes.
- **Fail-open needs a second line of defense.** A simple connection-count cap at the load balancer, independent of the rate limiter, keeps a counter-store outage during an active attack from turning "fail-open for availability" into "unlimited exposure."
- **Trust boundary on IP extraction.** IP-based limiting must use the real client IP, not a client-supplied `X-Forwarded-For` header taken at face value — otherwise an attacker resets their own IP-based counter just by lying about their address.

---

## Monitoring & Analytics

**Key metrics:**
- Checks/sec and allow/reject rate, broken down per policy
- Limiter-added latency, p50/p99 — the number the entire design is built to keep under 1 ms
- Counter-store error rate and fail-open activation count
- Lease rebalance lag (how stale a node's local sub-allowance is relative to the global count)
- Per-shard load, to catch a hot key before it degrades latency for every other subject sharing that shard
- Estimated overshoot rate during lease rebalancing and store outages — a sampled/estimated number, since the whole point of the hybrid model is that no single node has the exact global count at every instant

**Tooling**: Prometheus/Grafana for real-time dashboards (these are exactly the kind of numeric, high-cardinality time series that fit a metrics system, not a general-purpose log search tool); alert on the limiter's own added latency crossing its budget and on fail-open activation, both of which are symptoms a user actually feels.

---

## Trade-offs

| Decision | Alternative | Why | What we give up |
| --- | --- | --- | --- |
| Token bucket as the default algorithm | Sliding window counter everywhere | Requirement #2 explicitly needs burst tolerance, which token bucket gives natively at O(1) memory | A perfectly flat per-second cap some burst-sensitive downstream dependencies might actually want — they need their own protection too, not just the public-facing limiter |
| Centralized atomic counter store as the source of truth | Fully local, per-node counting with no shared store | Without a shared truth, N nodes handling one subject each independently allow up to the full limit — an N-times overshoot, not a bounded one | A network dependency that must itself be highly available, or explicitly planned around with the fail-open policy below |
| Local lease-based hybrid enforcement (sub-allowance per node, periodic rebalance) | Every request synchronously round-trips to the central store | The 1 ms p99 latency budget can't absorb a network round trip on every one of 2.3M requests/sec | A bounded, deliberate overshoot of the global limit proportional to node count × rebalance interval, instead of an exact count at every instant |
| Fail-open on store unavailability for most endpoints, fail-closed for a short explicit list of sensitive ones | Fail-closed uniformly everywhere | A store outage shouldn't become a full platform outage for ordinary read traffic | A window of elevated exposure on fail-open endpoints during a store outage — mitigated, not eliminated, by the load-balancer-level connection cap |

---

## Additional Considerations

### Scalability Challenges Recap

1. **2.3M checks/sec on every request's hot path** → hybrid local-lease plus central-store enforcement, keeping most requests off the network entirely.
2. **Race condition at the bucket/window boundary** → one atomic Lua script per check, serialized by the store's own single-threaded execution.
3. **A single very popular key exceeding one shard's throughput** → key sub-sharding, same pattern as a hot partition anywhere else.
4. **Store unavailability threatening to become a platform outage** → an explicit fail-open/fail-closed policy plus the local-lease fallback, instead of an unplanned default.

### Future Enhancements

1. Per-request cost weighting (a bulk-export endpoint consumes more than 1 token) instead of a flat cost per request.
2. Adaptive limits that tighten automatically under a detected abuse pattern rather than only a statically configured number.
3. A client-facing quota dashboard built from the same counters, instead of exposing them only through response headers.
4. A lighter-weight gossip-based cross-region reconciliation to shrink the bound on global-limit overshoot.

---

## Summary

The hard part of designing a rate limiter isn't choosing an algorithm — token bucket versus sliding window is a well-trodden decision. It's that the same logical limit has to be enforced correctly by many physical nodes checking it concurrently, on the critical path of every request, without the check itself adding meaningful latency or becoming a single point of failure. This design handles that by making the read-refill-decrement-write sequence one atomic operation at the counter store rather than three separate round trips (closing the race condition), by pushing most of that work into a local, per-node lease so the 1 ms latency budget doesn't require a network call on every request, and by naming an explicit fail-open/fail-closed policy so a store outage degrades predictably instead of becoming either an unbounded security hole or a platform-wide outage. Everything else — the algorithm choice, the sharding, the monitoring — exists to keep that one mechanism fast, correct, and recoverable.
