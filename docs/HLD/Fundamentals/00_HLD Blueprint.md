---
sidebar_position: 0
---

## The HLD Blueprint: 15 Components of a System Design

> **How to use this page:** it's the checklist behind every design on this site. In a real 45–60 minute round you **won't** cover all 15 in depth. You'll cover 1–5 for every problem, then **pick the 2–4 deep-dive components the problem is actually about** (a chat app is about async processing and distributed ordering, a URL shortener about caching and ID generation, a payment system about distributed transactions and idempotency). Knowing all 15 is what lets you choose well and answer any follow-up.

Fundamentals this builds on: [DNS](./01_DNS.md) · [HTTP](./02_HTTP.md) · [Latency Numbers](./03_Latency%20Numbers.md) · [Back-of-the-Envelope Estimation](./04_Back-of-the-Envelope%20Estimation.md)

---

## What interviewers are grading

Most FAANG system design rubrics come down to four signals:

| Signal | What it looks like |
| --- | --- |
| **Problem navigation** | You clarify scope, find what's actually hard, and prioritize instead of boiling the ocean |
| **Solution design** | A working end-to-end design first, then sensible components that fit the requirements |
| **Technical depth** | You can go deep where it matters: the failure modes, data structures and numbers |
| **Trade-offs and communication** | You state the alternatives and why you chose one, drive the conversation, and adapt to hints |

Seniority changes the bar. Mid-level candidates need a sound, working design. Senior and staff candidates are expected to **drive** the interview, spot bottlenecks unprompted, and reason about operations, evolution and cost.

## Time budget (45-minute round)

| Phase | Minutes | Components |
| --- | --- | --- |
| Requirements and scope | 4–6 | 1 |
| Estimation (if wanted) | 3–5 | 2 |
| API + data model | 5–8 | 3, 4 |
| High-level architecture (working end to end) | 8–10 | 5, 6 |
| **Deep dives** (interviewer-led or your pick) | 12–18 | 2–4 of 7–13 |
| Operations, trade-offs, evolution | 3–5 | 14, 15 |

**Golden rule: get a simple design working end to end before optimizing anything.** An elegant cache in front of a design with no write path is a fail.

---

## 1. Problem definition and requirements

**Goal:** turn a vague prompt ("design Instagram") into a bounded problem you can solve in 40 minutes.

**Functional requirements:** what the system does. List them, then **prioritize the top 3–4** and say which ones are out of scope.
> "Users can upload photos, follow users, and view a home feed. Out of scope: DMs, stories, ads, search."

**Non-functional requirements:** how well it does it. Put a **number** on each one:

| NFR | Questions to ask | Example |
| --- | --- | --- |
| Scale | DAU? Read:write ratio? Data volume? Global? | 500M DAU, 100:1 reads |
| Latency | Which operations are latency-critical? What p99? | Feed p99 under 200 ms. Upload can be async. |
| Availability | What's the cost of downtime? | 99.99% for reads |
| Consistency | Can users see stale data? For how long? | Feed: eventual (seconds). Payments: strong. |
| Durability | Can we ever lose data? | Never lose an uploaded photo |
| Other | Privacy, compliance (GDPR, data residency), cost, mobile/offline | |

**Availability, translated:**

| Availability | Downtime per year | Per month |
| --- | --- | --- |
| 99% | 3.65 days | ~7.3 hours |
| 99.9% | ~8.8 hours | ~43.8 min |
| 99.99% | ~52.6 min | ~4.4 min |
| 99.999% | ~5.3 min | ~26 s |

Serial dependencies multiply: three 99.9% services in series give about 99.7%. Redundant parallel copies add nines: two independent 99% replicas give 1 − 0.01² = 99.99%.

**Assumptions:** say them out loud. "Assume an average photo is 200 KB after compression." "Assume authentication already exists."

**Red flags:** starting to draw boxes in minute 1. Asking 15 questions without converging. Never stating the NFRs, which are what decide the architecture.

## 2. Capacity estimation

**Goal:** turn the NFRs into numbers that justify decisions. The full method is in [Back-of-the-Envelope Estimation](./04_Back-of-the-Envelope%20Estimation.md).

Cover: **DAU/MAU → QPS (average and peak) → storage (with retention and replication) → bandwidth (ingress and egress) → cache size → server count**, and say what growth over 1–5 years does to each.

**Always end with a design implication:** "Peak is 70k reads/s, which is 100x the writes, so we optimize the read path with precomputed feeds and caching."

## 3. API design

**Goal:** define the contract between clients and the system. It reveals the core entities and operations.

```http
POST   /v1/photos                      → 201 { photoId, uploadUrl }      (Idempotency-Key header)
GET    /v1/users/{userId}/feed?cursor=abc&limit=20
                                       → 200 { items: [...], nextCursor }
POST   /v1/users/{userId}/follow       → 204
GET    /v1/photos/{photoId}            → 200 { ... }  (ETag for caching)
```

| Topic | What to say |
| --- | --- |
| **Style** | REST for public and mobile clients. gRPC between services. WebSocket/SSE for push. GraphQL for many heterogeneous clients. See [HTTP §8](./02_HTTP.md#8-choosing-the-communication-style). |
| **Pagination** | **Cursor-based** (an opaque token encoding the last seen key) over offset. Offset gets slower with depth (`OFFSET 100000` scans and discards rows) and skips or duplicates items when data shifts. |
| **Idempotency** | `Idempotency-Key` on every non-idempotent write that clients might retry (payments, orders, posts). The server stores key → response with a TTL. |
| **Errors** | Consistent error bodies (e.g. RFC 9457 *problem details*), correct status codes, `Retry-After` on 429/503 |
| **Large uploads** | The client gets a **pre-signed URL** and uploads directly to object storage, so the bytes never pass through your app servers. Use multipart/resumable uploads for big files. |
| **Long-running work** | `202 Accepted` plus a status resource or a webhook |
| **Versioning** | `/v1/` in the path, or a header. Additive changes only within a version. |
| **Auth and limits** | Bearer tokens. Rate limits per user, API key and IP. |
| **Concurrency** | `ETag` + `If-Match` for optimistic concurrency on updates (412 on conflict) |

**Red flags:** verbs in URLs (`/getUserFeed`). No pagination on list endpoints. Exposing internal IDs or DB structure. Ignoring retries.

## 4. Data modeling

**Goal:** the entities, their relationships, and, most importantly, the **access patterns** that decide the keys and the storage engine.

**Process:**
1. List the **entities** (User, Photo, Follow, FeedItem) and their key attributes.
2. List the **access patterns** with their frequency: "get the feed for a user, newest first" (very hot), "get the followers of a user" (fan-out), "get a photo by ID".
3. Choose the **primary keys and partition keys** to serve the hot patterns **without scatter-gather**.
4. Decide **normalize vs denormalize**: normalize for write integrity, denormalize (or precompute) for hot reads.
5. Choose the **indexes**. Every index speeds up reads and slows down writes.

```
users      (user_id PK, username UNIQUE, created_at, ...)
photos     (photo_id PK, owner_id, s3_key, caption, created_at)     index (owner_id, created_at DESC)
follows    (follower_id, followee_id, created_at)   PK (follower_id, followee_id)
                                                     + reverse table/index keyed by followee_id
feed_items (user_id, created_at, photo_id)           partition key user_id, sorted by created_at DESC
```

**Data ownership:** in a microservice design **each service owns its data** and others access it only through its API or events. No shared databases. That's what lets teams change schemas and scale independently. Cross-service views are built from events (CQRS / read models).

**Watch for:** **hot keys** (a celebrity's follower list), unbounded rows or partitions (one huge partition per popular entity), IDs (sortable Snowflake/ULID vs random UUIDv4, which fragments B-tree indexes), soft deletes, and multi-tenancy (a tenant ID in every key).

## 5. High-level architecture

**Goal:** a box-and-arrow diagram that serves **every functional requirement end to end**. Walk the **write path** and the **read path** separately.

```
                         ┌──────────┐
 Clients ── DNS ──▶ CDN ─┤  static  │
   │                     │  media   │◀──────────────── Object storage (S3/GCS)
   │                     └──────────┘                        ▲
   ▼                                                         │ pre-signed upload
 Load balancer (L7) ──▶ API gateway (auth, rate limit, routing)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  Photo service          Feed service          User/Graph service
   │      │                │      │                 │
   │      └── publish ──▶ Message queue / log ──▶ Fan-out workers ──▶ Feed cache (Redis)
   ▼                                                                        ▲
 Photo DB (sharded)                                                         │
                                         Feed reads ────────────────────────┘
 Cross-cutting: service discovery, config, secrets, metrics/logs/traces, CI/CD
```

| Component | Role | Notes |
| --- | --- | --- |
| **Clients** | Web and mobile | Client-side caching, retries with backoff, offline queues |
| **DNS / GeoDNS** | Route to the nearest healthy region | See [DNS](./01_DNS.md) |
| **CDN** | Serve static content and media from the edge, terminate TLS near users | The largest bandwidth saver |
| **Load balancer** | Spread traffic, run health checks, terminate TLS | L4 vs L7, see [HTTP §10](./02_HTTP.md#10-load-balancers-and-http) |
| **API gateway** | Authentication, rate limiting, request routing, aggregation | Keep business logic out of it |
| **Application services** | **Stateless** business logic | Scale horizontally with autoscaling |
| **Databases** | The source of truth | Choose per access pattern (component 6) |
| **Caches** | Hot reads | Component 7 |
| **Queues / logs** | Decouple, buffer, fan out | Component 9 |
| **Workers** | Async jobs: transcoding, fan-out, notifications, emails | Idempotent, retryable |
| **Object storage** | Blobs: images, video, backups, logs | Cheap, highly durable, high first-byte latency |
| **External systems** | Payments, email/SMS, push (APNs/FCM), third-party APIs | Wrap them with timeouts, retries, circuit breakers and webhooks |

**Red flags:** a single DB box serving everything at 1M QPS. Arrows with no explanation of what flows over them. Media bytes flowing through app servers. Synchronous chains of five services for one user action.

## 6. Database selection

**Goal:** pick storage by **access pattern, consistency needs and scale**, not by fashion. Multiple stores in one design (polyglot persistence) are normal.

| Type | Examples | Strengths | Choose when | Avoid when |
| --- | --- | --- | --- | --- |
| **Relational (SQL)** | PostgreSQL, MySQL, Aurora; distributed: Spanner, CockroachDB, Vitess | ACID transactions, joins, constraints, flexible queries | Money, inventory, users and permissions, anything relational or transactional. **The default until proven otherwise.** | Massive write throughput beyond one primary, with no natural shard key |
| **Key-value** | DynamoDB, Redis, Riak | O(1) lookups by key, predictable latency, scales horizontally | Sessions, carts, URL mappings, feature flags, caches | Ad-hoc queries, multi-key transactions (limited support) |
| **Wide-column** | Cassandra, ScyllaDB, Bigtable, HBase | Huge **write** throughput (LSM), partition + clustering keys, multi-DC | Time-ordered data per entity: messages, feeds, IoT, activity logs | Joins, ad-hoc queries, strong multi-row transactions |
| **Document** | MongoDB, Couchbase, Firestore | Flexible schema, nested objects read in one go | Product catalogs, CMS, user-generated content with varied shape | Highly relational data with many cross-document joins |
| **Graph** | Neo4j, Neptune, JanusGraph | Multi-hop traversals | Social graphs ("friends of friends"), fraud rings, recommendations, knowledge graphs | Simple 1-hop lookups (an adjacency table in SQL/KV does those fine) |
| **Time-series** | Prometheus, InfluxDB, TimescaleDB, Druid | Compression, downsampling, time-window aggregations, retention | Metrics, monitoring, sensor data, financial ticks | General entity data |
| **Search** | Elasticsearch / OpenSearch, Solr | Inverted index, full text, fuzzy matching, facets, geo | Search boxes, log exploration, autocomplete | Being the source of truth (feed it from the primary DB via CDC) |
| **Analytical (OLAP, columnar)** | BigQuery, Snowflake, Redshift, ClickHouse | Scans and aggregations over billions of rows | Dashboards, BI, reporting, ML features | Low-latency transactional point reads and writes |
| **Object / blob** | S3, GCS, Azure Blob | Cheap, effectively unlimited, very durable | Images, video, backups, data lake files | Small, frequently updated records |

**Decision questions:** Do I need multi-row **transactions**? What are the **query patterns** (key lookups vs ad-hoc vs range scans vs full text vs aggregations)? Is it **read- or write-heavy**? How much data, and how fast does it grow? What consistency is required? Is the schema stable or evolving?

**ACID vs BASE:** ACID (atomic, consistent, isolated, durable) is the relational guarantee. BASE (basically available, soft state, eventually consistent) is the trade many NoSQL systems make for availability and scale. Know the **isolation levels** (read committed, repeatable read, serializable) and the anomalies each one prevents (dirty reads, non-repeatable reads, phantoms, write skew).

**How storage engines differ:** a **B-tree** (most SQL databases) is good for reads and updates in place, and does random writes. An **LSM-tree** (Cassandra, RocksDB) is good for writes because it turns them into sequential appends, at the cost of compaction and read amplification, which Bloom filters mitigate.

## 7. Caching strategy

**Goal:** serve hot reads from memory, cut latency and protect the database, **without serving wrong data for too long**.

**Where to cache:** client/browser → CDN → reverse proxy → in-process (app memory) → distributed cache (Redis/Memcached) → the database's own buffer pool.

| Pattern | Read | Write | Consistency | Risk | Use for |
| --- | --- | --- | --- | --- | --- |
| **Cache-aside (lazy loading)** | The app checks the cache. On a miss it reads the DB and populates the cache. | The app writes the DB, then **deletes** the cache key | Eventual. A race can leave stale data until the TTL. | The first request after a miss is slow, and there's stampede risk | **The default** for read-heavy workloads |
| **Read-through** | The cache loads from the DB itself on a miss | | Same as cache-aside | Needs cache-provider support | Simplifies app code |
| **Write-through** | | Write to the cache **and** the DB synchronously | Strong for cached keys | Higher write latency, and caches data that may never be read | Data that's read right after it's written |
| **Write-behind (write-back)** | | Write to the cache, which **flushes to the DB asynchronously** | Weak | **Data loss** if the cache dies before flushing | Counters, likes, metrics, very write-heavy and loss-tolerant data |
| **Write-around** | | Write to the DB only, so the cache fills on read | Eventual | Read-after-write misses | Write-once, rarely re-read data |

**Eviction:** LRU (the default), LFU (stable popularity), TTL-based. Set memory limits and watch the eviction rate.

**Invalidation:** "there are only two hard things in computer science..."
- Prefer **delete on write** over update on write. That avoids two concurrent writers leaving the older value in the cache.
- Always set a **TTL** as a safety net, so stale data heals on its own.
- **Versioned keys** (`user:42:v17`) or content-hashed URLs avoid invalidation entirely.
- For cross-service invalidation, consume DB change events (**CDC**, e.g. Debezium) to purge keys.

**Failure modes to name:**

| Problem | What happens | Fix |
| --- | --- | --- |
| **Stampede / thundering herd** | A hot key expires and 10k requests hit the DB at once | **Request coalescing / single-flight** (one rebuilds while the others wait), a lock or lease, early probabilistic refresh, `stale-while-revalidate` |
| **Penetration** | Requests for keys that **don't exist** always miss and hit the DB (often an attack) | Cache negative results with a short TTL, or a **Bloom filter** of valid keys |
| **Avalanche** | Many keys expire together, or the cache cluster restarts | **Jitter the TTLs**, warm the cache, put a circuit breaker on DB fallback |
| **Hot key** | One key overloads one cache shard | A local in-process cache in front, replicate the key across shards (`key#1..N`), CDN |
| **Stale read race** | Reader A misses and reads the old value from the DB. Writer B updates the DB and deletes the key. A then writes the old value into the cache. | Short TTLs, **leases** (Facebook's memcache paper), delayed double-delete, or versioned writes |

Related deep dives in this notebook: [Caching Introduction](../../DSA/caching/Introduction.md), [LRU](../../DSA/caching/Least%20Recently%20Used.md), [LFU](../../DSA/caching/Least%20Frequently%20Used.md).

## 8. Scalability

**Vertical scaling** (a bigger machine) is simple, has no distribution problems, and is often the right first step. But it has a ceiling, gets expensive and leaves a single point of failure. **Horizontal scaling** (more machines) is near-unlimited, but needs **stateless services** and partitioned data.

**Stateless services:** move session state into tokens or a shared store so any instance can serve any request. Autoscale on CPU, RPS or queue depth.

### Replication: copies for availability and read scale

| Model | How it works | Pros | Cons |
| --- | --- | --- | --- |
| **Single leader** | All writes go to the leader, and followers replicate | Simple, no write conflicts | Write throughput limited to one node. Failover complexity. |
| **Multi-leader** | Several nodes (often one per region) accept writes | Local writes in every region | **Conflict resolution** (last-write-wins loses data. CRDTs, app-level merges.) |
| **Leaderless (Dynamo-style)** | Clients write to and read from N replicas with quorums | High availability, no failover | Tunable consistency, read repair, more complex semantics |

**Sync vs async replication:** synchronous means no data loss on failover but higher latency, and writes stop if a replica is down. Asynchronous is fast but loses the most recent writes on failover and causes **replication lag**. Lag breaks **read-your-writes**: fix it by reading from the leader for N seconds after a write, or routing a user's reads to a replica that has caught up to the user's last write (track an LSN).

### Partitioning (sharding): splitting the data for write and storage scale

| Strategy | How | Pros | Cons |
| --- | --- | --- | --- |
| **Range** | `user_id 0–1M → shard 1` | Efficient range scans | Hot spots (sequential IDs, time-based keys) |
| **Hash** | `hash(key) mod N` | Even spread | Range queries scatter. **Changing N moves almost every key.** |
| **Consistent hashing** | A hash ring with **virtual nodes** | Adding or removing a node moves only about 1/N of the keys | More complex. Used by Dynamo, Cassandra and CDNs. |
| **Directory / lookup** | A lookup service maps key → shard | Maximum flexibility, easy rebalancing | The directory itself must be highly available and fast |
| **Geo / tenant** | Shard by region or customer | Data residency, isolation | Uneven tenant sizes, so big tenants need splitting |

**Choosing a shard key:** it should have **high cardinality**, **even access**, and **co-locate data that's queried together** (shard by `user_id` so one user's posts sit on one shard). Avoid monotonically increasing keys for hash-less range sharding.

**The pains of sharding** (be ready to discuss them): cross-shard queries and joins (scatter-gather, or denormalize), cross-shard transactions (avoid them, or use sagas), **rebalancing** (move partitions, not keys, and pre-split into many logical shards), globally unique IDs (Snowflake), and **hot partitions** (celebrities, so salt keys like `celebId#0..9` and merge on read).

**Load balancing algorithms:** round robin, weighted, **least connections** (uneven request costs), consistent hashing (cache affinity), and power of two random choices (pick 2 at random and use the less loaded one, which is great at scale).

## 9. Asynchronous processing

**When to go async:** the work is slow (video transcoding, ML), the user doesn't need to wait for it (emails, notifications, analytics), you need to **smooth spikes** (a queue absorbs bursts), you're **fanning out** one event to many consumers, or you're decoupling teams and services.

| | Message queue | Log / stream |
| --- | --- | --- |
| Examples | SQS, RabbitMQ, ActiveMQ | Kafka, Kinesis, Pulsar, Redpanda |
| Model | A message is consumed, then **deleted** | An **append-only log** retained for days. Consumers track offsets. |
| Replay | No | **Yes**: reprocess from any offset, and new consumers can read history |
| Ordering | Best-effort (FIFO queues are limited) | **Per partition** |
| Fan-out | Per queue (use SNS + SQS for fan-out) | Many consumer groups read independently |
| Best for | Task/job queues, work distribution | Event streams, CDC, event sourcing, analytics pipelines |

**Delivery semantics:**
- **At-most-once:** may lose messages. Acceptable for metrics sampling.
- **At-least-once:** may **duplicate**. The default almost everywhere.
- **Exactly-once:** in practice this means **at-least-once delivery + idempotent processing** (dedupe on the message ID, or idempotent upserts). Kafka transactions give exactly-once within Kafka-to-Kafka pipelines only.

**Patterns you should name:**
- **Retries with exponential backoff + jitter**, with a maximum number of attempts.
- **Dead-letter queue (DLQ):** after N failures, park the message for inspection or replay, so one **poison message** can't block the queue.
- **Transactional outbox:** write the business row **and** an `outbox` row in the same DB transaction, and a relay publishes outbox rows to the broker. That solves the "DB committed but the publish failed" dual-write problem. CDC (Debezium) is a common relay.
- **Ordering:** key messages by entity (`orderId`) so all events for one entity land in one partition and stay in order. Global ordering doesn't scale.
- **Backpressure and consumer lag:** monitor the lag. Autoscale consumers up to the partition count. Shed or degrade load when you can't keep up.
- **Event-driven architecture:** choreography (services react to events, loosely coupled but hard to trace) vs **orchestration** (a workflow engine like Temporal or Step Functions coordinates steps, which is easier to reason about and to retry).

## 10. Distributed systems concepts

**CAP:** during a **network partition** a system must choose between **consistency** (refuse or stall some requests) and **availability** (answer, possibly with stale data). Without a partition you can have both. **PACELC** adds: **Else** (no partition), the trade-off is **latency vs consistency**. That's the trade-off you make every day.

| | Prioritize consistency (CP) | Prioritize availability (AP) |
| --- | --- | --- |
| Examples | Bank balances, inventory reservation, leader election, unique usernames | Feeds, likes counts, shopping cart (merge later), DNS |
| Systems | Spanner, etcd/ZooKeeper, HBase, single-leader SQL | Cassandra and DynamoDB (default settings), Dynamo-style stores, CDNs |

**Consistency models (strongest to weakest):** **linearizable** (it behaves like a single copy, real-time order) → **sequential** → **causal** (cause before effect, e.g. a reply after its comment) → **session guarantees** (read-your-writes, monotonic reads) → **eventual**. Pick per feature, not per system.

**Quorums:** with N replicas, write to W and read from R. **R + W > N** means every read overlaps the latest write (e.g. N=3, W=2, R=2). Lower W or R trades consistency for latency and availability.

**Consensus:** **Raft and Paxos** let a group agree on values and a single leader despite failures, as long as a **majority** is up (2f+1 nodes tolerate f failures). They power etcd, ZooKeeper, Consul, and the metadata layers of Kafka (KRaft) and Spanner. Use them for **coordination** (leader election, config, locks), not for bulk data.

**Time and ordering:** there's no global clock, and wall clocks drift and jump. Use **Lamport clocks** (a total order consistent with causality), **vector clocks** (detect concurrent updates), **hybrid logical clocks** (CockroachDB) or **TrueTime** (Spanner's bounded-uncertainty clocks). Never use timestamps from different machines to decide "who wrote last" without understanding the risk.

**Distributed transactions:**

| Approach | How | Pros | Cons |
| --- | --- | --- | --- |
| **Two-phase commit (2PC)** | The coordinator asks everyone to prepare, then tells them to commit | Atomic across participants | **Blocking** if the coordinator fails, latency, locks held across the network |
| **Saga** | A sequence of local transactions, with **compensating actions** on failure (orchestrated or choreographed) | No distributed locks, scales | Only eventual consistency. Compensations must be designed (refund instead of rollback). Intermediate states are visible. |
| **Outbox + idempotent consumers** | Reliable event publication between services | Simple, robust | Eventually consistent |
| **Avoid it** | Redraw the service boundaries so one transaction stays in one service and one DB | Simplest | Not always possible |

**Other must-knows:** **split brain** (two leaders, prevented with quorums and **fencing tokens**, i.e. monotonically increasing lease IDs that storage checks), **distributed locks** (Redis Redlock is controversial, so prefer consensus-backed locks with fencing), **idempotency everywhere**, and the eight **fallacies of distributed computing** (the network is reliable, latency is zero...).

## 11. Reliability and fault tolerance

**Assume everything fails:** disks, nodes, racks, AZs, regions, dependencies, deploys and people.

| Technique | What it does | Notes |
| --- | --- | --- |
| **Redundancy** | N+1 or N+2 capacity, across **multiple AZs** | Remove every single point of failure (also check the DNS provider, the LB and the config store) |
| **Failover** | Health checks → promote a standby / re-route | Active-passive (simple, idle cost) vs **active-active** (more capacity, harder data consistency) |
| **Timeouts** | Bound how long you wait | **Every** network call. Shorter than the caller's timeout. Propagate deadlines. |
| **Retries** | Recover from transient failures | Exponential backoff + **jitter**, max attempts, **retry budgets** (for example at most 10% extra load), idempotent operations only, retry at one layer only (otherwise retries multiply: 3 layers × 3 retries = 27x) |
| **Circuit breaker** | Stop calling a failing dependency | Closed → **open** (fail fast, serve a fallback) → half-open (probe) → closed |
| **Bulkheads** | Isolate resources per dependency or tenant | Separate thread pools and connection pools, so one slow dependency can't drain them all |
| **Rate limiting / load shedding** | Protect yourself under overload | Reject early with 429/503. Prioritize critical traffic (checkout over recommendations). |
| **Backpressure** | Slow producers down when consumers fall behind | Bounded queues, flow control, reactive streams |
| **Graceful degradation** | Serve a reduced experience | Cached or stale feeds, hide non-critical widgets, read-only mode |
| **Safe deploys** | Most outages come from changes | Canary, blue/green, feature flags, automatic rollback on SLO burn |
| **Chaos engineering** | Verify resilience on purpose | Kill instances or AZs in game days (Netflix's Chaos Monkey) |

**Disaster recovery:** define the **RPO** (how much data you can lose, which sets the replication and backup frequency) and the **RTO** (how long you can be down, which sets the automation and standby level).

| DR strategy | RTO / RPO | Cost |
| --- | --- | --- |
| Backup & restore | Hours / hours | $ |
| Pilot light (core data replicated, compute off) | Tens of minutes | $$ |
| Warm standby (scaled-down copy running) | Minutes | $$$ |
| Multi-site active-active | ~0 / ~0 (with sync replication) | $$$$ |

**Test the restore, not just the backup.** Backups need to be immutable or kept offsite to survive ransomware or a bad `DELETE`.

## 12. Security

| Area | What to cover |
| --- | --- |
| **Authentication (who are you?)** | OAuth 2.0 / **OIDC** for login and SSO, MFA, passkeys. **Sessions** (server-side store, easy to revoke) vs **JWTs** (stateless, fast to verify, **hard to revoke**, so use short expiry plus refresh tokens and a denylist). Service-to-service: **mTLS** or signed workload identities. See [Enterprise Authentication System](../08_Design_Enterprise_Authentication_System.md). |
| **Authorization (what can you do?)** | **RBAC** (roles), **ABAC** (attributes/policies, e.g. OPA), **ReBAC** (relationships, as in Google's Zanzibar: "can user X view doc Y?"). Enforce it **server-side** on every request. Least privilege. Check object-level access to avoid IDOR (insecure direct object reference). |
| **Encryption in transit** | TLS everywhere, mTLS inside, HSTS |
| **Encryption at rest** | Disk and DB encryption with keys in a **KMS**. **Envelope encryption** (data keys encrypted by master keys). Field-level encryption or tokenization for PII and cards. |
| **Secrets** | Never in code or images. Use a secrets manager (Vault, AWS Secrets Manager), rotation, short-lived credentials. |
| **Rate limiting** | Token bucket (allows bursts), leaky bucket (smooth output), fixed window (simple, spiky at boundaries), sliding window log or counter (accurate). Distributed counters in Redis. Limit per user, IP and API key. See [Token Bucket](../../DSA/Algorithms/Token%20Bucket%20Algorithm.md). |
| **Abuse prevention** | WAF, bot detection, CAPTCHA, DDoS protection at the edge (anycast scrubbing), account-takeover detection, spam and fraud scoring pipelines |
| **Input handling** | Validate and sanitize. Parameterized queries (SQL injection). Output encoding (XSS). CSRF tokens or `SameSite` cookies. SSRF protection for URL-fetching features. |
| **Data protection and compliance** | PII minimization, retention and deletion (GDPR right to erasure, which must reach backups and derived data), data residency (per-region storage), **audit logs** |

## 13. Performance optimization

**Method:** measure → find **the** bottleneck (CPU, memory, disk I/O, network, lock contention, a downstream dependency) → fix it → measure again. Optimizing anything except the bottleneck is wasted effort. Use the [Latency Numbers](./03_Latency%20Numbers.md) and **Little's Law** (concurrency = throughput × latency) to reason about it.

**Latency vs throughput:** latency is the time per request, throughput is requests per unit of time. Batching raises throughput but adds latency. Parallelism lowers latency until you hit a shared resource. Optimize for the NFR you actually have.

| Layer | Techniques |
| --- | --- |
| **Database** | Right **indexes** (composite in query order, covering indexes), read `EXPLAIN` plans, fix **N+1 queries** (batch or join), **connection pooling** (PgBouncer), read replicas, denormalization or **materialized views** for hot reads, **batch writes**, partitioning big tables, archiving cold data |
| **Application** | Async/non-blocking I/O, parallelize independent calls, avoid lock contention, object pooling, efficient serialization (Protobuf), avoid GC pressure, **precompute** (feeds, aggregates) |
| **Network** | Connection reuse (keep-alive, HTTP/2 and HTTP/3), compression (Brotli/gzip), smaller payloads (field selection, pagination), a CDN and edge compute, fewer round trips (batch APIs), co-locate chatty services in the same AZ |
| **Caching** | Component 7: the biggest single lever for read-heavy systems |
| **Client** | Lazy loading, prefetching, optimistic UI, image resizing (responsive images, WebP/AVIF) |

**Tail latency:** p99 is what users remember. Use hedged requests, timeouts and fewer fan-out dependencies. See [Latency Numbers §6](./03_Latency%20Numbers.md#6-averages-lie-percentiles-and-tail-latency).

## 14. Observability

**Goal:** know the system is broken **before users tell you**, and find out *why* quickly.

| Pillar | What | Tools | Tips |
| --- | --- | --- | --- |
| **Logs** | Discrete events with context | ELK/OpenSearch, Loki, Splunk, Cloud Logging | **Structured** (JSON), a **correlation/trace ID** on every line, no PII or secrets, sampling for noisy debug logs |
| **Metrics** | Numeric time series | Prometheus + Grafana, Datadog, CloudWatch | Use histograms for latency (percentiles). Watch **cardinality**: never use `user_id` as a label. |
| **Traces** | One request's path across services (spans) | **OpenTelemetry**, Jaeger, Zipkin, Tempo | Propagate `traceparent`. Head or tail sampling. This finds which hop is slow. |

**What to measure:**
- **Four golden signals** (Google SRE): **latency, traffic, errors, saturation**.
- **RED** for services: Rate, Errors, Duration.
- **USE** for resources: Utilization, Saturation, Errors.
- **Business metrics:** sign-ups, orders/min, messages delivered. These are often the fastest outage detector.

**SLI → SLO → SLA:**
- **SLI** (indicator): what you measure, e.g. "the fraction of feed requests served successfully in under 200 ms".
- **SLO** (objective): the internal target, e.g. "99.9% over 28 days". The remainder (0.1%) is the **error budget**: while you have budget, you ship faster. When it's burnt, you freeze risky changes.
- **SLA** (agreement): the external contract with penalties. It's always looser than the SLO.

**Alerting:** alert on **symptoms users feel** (an SLO burn rate, for example "burning a month's budget in 1 hour"), not on every cause (CPU 80%). Every page should be **actionable** and link to a runbook. Use dashboards per service (golden signals) and per user journey.

## 15. Trade-offs and future evolution

**Goal:** show judgment. Every decision has a cost, so say what it is.

**State decisions in this shape:**

| Decision | Chosen | Alternatives | Why | What we give up |
| --- | --- | --- | --- | --- |
| Feed generation | Fan-out on write, with a celebrity exception | Fan-out on read | Read-heavy (400:1), p99 under 200 ms | Write amplification, storage for the precomputed feeds |
| Primary store | Sharded Postgres | Cassandra | Transactions for follows and counts, team familiarity | Manual sharding work as we grow |
| Feed consistency | Eventual (seconds) | Strong | Availability and latency matter more | A new post may take a few seconds to appear for followers |

**Review the design out loud:**
- **Bottlenecks:** "What breaks first at 10x?" (often the primary DB's writes, a hot key, or fan-out for celebrities)
- **Single points of failure:** is anything left that's not redundant?
- **Operational cost:** can a team of 6 actually run 9 different datastores?

**Cost optimization:** storage tiering (hot SSD → warm → cold archive such as S3 Glacier, with lifecycle policies), CDN offload, autoscaling and spot or preemptible instances for batch work, right-sizing, compression, retention limits on logs and metrics, reserved capacity for the steady baseline, and watching **egress fees** (cross-region and internet egress are often the hidden big bill).

**Future evolution:** how the design grows. Single region → multi-region (and what that does to consistency). Monolith → services when team or scaling boundaries demand it. A new feature (search, recommendations, ML ranking) bolted on via CDC/event streams without touching the core write path. Say what you'd **monitor** to know when to take each step.

---

## Reusable answer template

Copy this skeleton into every practice design:

```
1. Requirements      FR (top 3–4, out of scope) · NFR (scale, latency p99, availability, consistency, durability)
2. Estimation        DAU → QPS (avg/peak, R:W) → storage (×retention ×replication) → bandwidth → cache → servers
3. API               endpoints, pagination (cursor), idempotency keys, errors, auth, async (202)
4. Data model        entities, access patterns → keys, partition key, indexes, ownership
5. Architecture      boxes + arrows; walk the write path and the read path
6. Databases         store per access pattern + why
7. Caching           what/where, pattern, TTL, invalidation, stampede/hot-key handling
8. Scale             stateless tier, replication, sharding key, hot spots
9. Async             queues/streams, delivery semantics, retries, DLQ, outbox
10. Distributed      consistency per feature, consensus/locks, transactions (saga/2PC)
11. Reliability      redundancy, failover, timeouts/retries/circuit breakers, degradation, DR (RPO/RTO)
12. Security         authN/authZ, encryption, secrets, rate limiting, abuse
13. Performance      bottleneck, latency budget, DB and network optimizations, tail latency
14. Observability    golden signals, logs/metrics/traces, SLOs, alerting
15. Trade-offs       decision table, what breaks at 10x, cost, evolution
```

## Worked designs on this site

Each one applies this blueprint to a different kind of problem:

| Design | Main deep-dive components |
| --- | --- |
| [Design Instagram](../02_Design%20Instagram.md) | 5, 7, 8 (feed fan-out, media storage, CDN) |
| [Design URL Shortener](../03_Design_URL_Shortener.md) | 2, 4, 7 (ID generation, caching, redirects) |
| [Design AWS EC2](../04_Design_AWS_EC2.md) | 5, 10, 11 (control plane vs data plane, placement, isolation) |
| [Design Uber](../05_Design_Uber.md) | 4, 8, 9 (geo-indexing, real-time location, matching) |
| [Design Email Campaign System](../06_Design_Email_Campaign_System.md) | 9, 11, 12 (bulk async sending, retries, abuse) |
| [Design Invoice Follow-up System](../07_Design_Invoice_Followup_System.md) | 9, 10 (scheduling, workflows, idempotency) |
| [Design Enterprise Authentication System](../08_Design_Enterprise_Authentication_System.md) | 3, 12 (SSO, tokens, multi-tenancy) |

## Final red flags checklist

- No numbers on the NFRs, and no estimation-driven decisions
- Jumping to microservices, Kafka and Kubernetes for 40 QPS
- A single database for everything at massive scale, with no sharding story
- No idempotency on retried writes (payments, orders, messages)
- Caching with no invalidation or TTL plan
- Ignoring failure: no timeouts, retries, redundancy or degradation
- "Strong consistency everywhere" or "eventual consistency everywhere" without tying it to features
- Never stating a trade-off
