---
sidebar_position: 1
---

# DNS (Domain Name System)

> **Why this matters in interviews:** nobody asks you to "design DNS" in most loops, but DNS shows up in nearly every design. It's the first hop of "what happens when you type a URL", it's the cheapest global load balancer you have, and it's how you do region failover, CDN routing and blue/green cutovers. Interviewers probe whether you understand **caching and TTLs**, because they decide how fast any DNS-based change actually takes effect.

**In one line:** DNS is a globally distributed, hierarchical, heavily cached **key-value store** that maps names (`api.example.com`) to records (IP addresses, aliases, mail servers, text). It's read-mostly and eventually consistent.

---

## 1. The hierarchy

```
                        . (root)                 ← 13 named root identities (a–m.root-servers.net),
                          │                        anycast to well over 1,000 physical instances
          ┌───────────────┼────────────────┐
         com             org               in     ← TLD servers (run by registries, e.g. Verisign for .com)
          │
       example.com                                ← authoritative name servers for the zone
          │                                         (Route 53, Cloudflare, NS1, your own BIND...)
   ┌──────┼────────┐
  www    api     mail                             ← records inside the zone
```

| Layer | Who runs it | What it answers |
| --- | --- | --- |
| **Root servers** | 12 operators (Verisign, ICANN, NASA...) | "Who handles `.com`?" They return NS records for the TLD. |
| **TLD servers** | Registries | "Who is authoritative for `example.com`?" They return the domain's NS records (plus glue IPs). |
| **Authoritative servers** | You or your DNS provider | The actual answer: `api.example.com → 203.0.113.10` |
| **Recursive resolver** | ISP, Google `8.8.8.8`, Cloudflare `1.1.1.1`, corporate DNS | Does the walking and caching on behalf of clients. |
| **Stub resolver** | Your OS (or browser) | Asks the recursive resolver and caches the result locally. |

**Delegation** is what makes this scale. No server knows everything; each level knows only who to ask next. Registrars write your NS records into the TLD zone. That's what "pointing a domain at Cloudflare" means.

## 2. How a lookup works

```
 Browser            OS stub           Recursive resolver          Root     .com TLD    example.com NS
    │ cache?           │                     │                      │          │              │
    │──── miss ───────▶│ cache? miss         │                      │          │              │
    │                  │── recursive query ─▶│ cache? miss          │          │              │
    │                  │                     │── iterative query ──▶│          │              │
    │                  │                     │◀── "ask .com NS" ────│          │              │
    │                  │                     │───────────────────────────────▶ │              │
    │                  │                     │◀── "ask ns1.example.com" ───────│              │
    │                  │                     │──────────────────────────────────────────────▶ │
    │                  │                     │◀──────────── A 203.0.113.10, TTL 300 ──────────│
    │                  │◀── answer (cached) ─│                                                │
    │◀──── answer ─────│                                                                      │
```

- **Recursive query** (client → resolver): "give me the final answer."
- **Iterative queries** (resolver → root → TLD → authoritative): each server replies with a **referral** to the next level.
- In practice, root and TLD answers are cached for days, so a typical cache miss costs **one round trip to the authoritative server**.

**Caching layers, in order:** the browser cache (Chrome keeps its own) → the OS cache → the recursive resolver's cache → (on a miss) the authoritative server.

**Typical cost:** cached answers take about 0–1 ms. A resolver cache hit takes a few ms up to around 30 ms (one RTT to the resolver). A full miss commonly takes **20–120 ms**, and can take hundreds of ms over slow or distant links. That's why browsers support `<link rel="dns-prefetch">` and `<link rel="preconnect">`.

## 3. Record types you must know

| Record | Purpose | Example / interview note |
| --- | --- | --- |
| **A** | Name → IPv4 | `api.example.com A 203.0.113.10` |
| **AAAA** | Name → IPv6 | `api.example.com AAAA 2001:db8::10` |
| **CNAME** | Alias to another name | `www → example.cdn-provider.net`. **Not allowed at the zone apex** (`example.com`) and can't coexist with other records on the same name. |
| **ALIAS / ANAME / "alias record"** | Provider-specific CNAME-like record at the apex | Route 53 Alias, Cloudflare CNAME flattening. Lets `example.com` point to a load balancer hostname. |
| **NS** | Delegates a zone to name servers | Lives at the parent (TLD) and in the zone itself |
| **SOA** | Zone metadata: primary NS, serial, refresh, **negative-caching TTL** | One per zone |
| **MX** | Mail servers, with priority | `10 mx1.example.com` |
| **TXT** | Arbitrary text | SPF, DKIM, DMARC, domain-ownership verification |
| **SRV** | Service location (host + port + priority + weight) | `_sip._tcp`. Used by some service-discovery systems. |
| **PTR** | Reverse lookup, IP → name | Email deliverability, logging |
| **CAA** | Which certificate authorities may issue certs for the domain | Defense against mis-issued TLS certs |
| **HTTPS / SVCB** | Advertises protocol support (e.g. HTTP/3) and endpoints up front | Lets a client skip a round trip of protocol discovery |

## 4. TTL and caching: the part interviewers actually test

Every record has a **TTL** (time-to-live, in seconds). Resolvers may cache the answer for that long.

| Short TTL (30–60 s) | Long TTL (1 h to 1 day) |
| --- | --- |
| ✅ Fast failover and migrations | ✅ Fewer queries, lower latency, cheaper |
| ✅ Weighted shifts take effect quickly | ✅ Survives an outage of your DNS provider for a while |
| ❌ More lookups, so more latency on cache misses | ❌ Changes take hours to propagate |
| ❌ Higher DNS provider bill and load | ❌ A bad record sticks around |

**Key facts:**
- **"DNS propagation" isn't a push.** Nothing propagates. Old answers simply **expire from caches** at their TTL.
- **Not every client respects TTLs.** Some resolvers clamp the minimum, and long-lived processes (old JVMs with `networkaddress.cache.ttl`, connection pools) may hold a resolved IP for far longer. **Never rely on DNS alone for instant failover.** Pair it with health-checked load balancers.
- **Negative caching:** an `NXDOMAIN` (doesn't exist) answer is cached too, for the SOA's negative TTL (RFC 2308). If you query a name before creating it, you can "cache the absence".
- **Zero-downtime IP migration recipe:** lower the TTL (for example from 86400 to 60) **at least one old-TTL period ahead** → wait → change the record → keep the old servers running until traffic drains → raise the TTL again.

## 5. Transport and protocol details

- **UDP port 53** by default, because one small request and one small response fits UDP perfectly, with no handshake.
- Classic DNS over UDP was limited to **512-byte** responses. **EDNS(0)** allows larger UDP payloads. If a response still doesn't fit, the server sets the **TC (truncated)** bit and the client retries over **TCP 53**.
- **Zone transfers** (AXFR full, IXFR incremental) between primary and secondary authoritative servers use TCP.
- **Encrypted DNS:** **DoT** (DNS over TLS, port 853) and **DoH** (DNS over HTTPS, port 443). Both give privacy from on-path observers. DoH is hard to block because it looks like ordinary HTTPS.
- **DNSSEC** signs records (RRSIG, with DNSKEY and DS records forming a chain of trust from the root). It provides **integrity/authenticity, not confidentiality**.

## 6. DNS as a system design tool

### a) DNS-based load balancing (round robin)
Return several A records, and the client picks one, often the first. It's cheap but **coarse**:
- There's no health awareness (unless the provider adds health checks), so clients may keep hitting a dead IP until the TTL expires.
- The load is uneven because resolvers cache and share answers: a big ISP resolver sends all its users to the same IP.
- **Use it in front of** load balancers (one VIP per region), not instead of them.

### b) GeoDNS / latency-based routing
The authoritative server answers differently based on the **resolver's location**, or the client's location when the resolver sends **EDNS Client Subnet**. It sends users to the nearest region. Examples: Route 53 latency, geolocation and geoproximity policies, NS1 and Cloudflare traffic steering.

### c) Weighted routing
Answer `region-a` 95% of the time and `region-b` 5% of the time. Use it for **canary releases, blue/green cutover and gradual migrations**. The split is approximate because of caching.

### d) Health-checked failover
Use active-passive: if health checks on the primary fail, start answering with the secondary. The time to recover ≈ **detection time + TTL + client misbehaviour**. That's typically 1–5 minutes, not seconds.

### e) Anycast
Many servers in many locations announce **the same IP** via BGP, and routing delivers each packet to the "closest" one. It's used by the root servers, `1.1.1.1`, `8.8.8.8`, CDNs and DDoS scrubbing. Compared with GeoDNS, failover is at **network speed** with no TTL problem. It works best for short, stateless exchanges (DNS, the edges of TCP+TLS sessions at a CDN).

### f) CDN onboarding
`www.example.com CNAME example.cdn.net`. The CDN's own DNS then returns the nearest edge node. That's why almost every CDN integration starts with a CNAME.

### g) Service discovery inside your infrastructure
Kubernetes CoreDNS resolves `my-svc.my-namespace.svc.cluster.local` to a ClusterIP, and headless services return pod IPs. Consul also exposes DNS. It's simple and universal, but TTL and caching limit how fast it reacts. Systems needing sub-second updates use client-side discovery via a registry (Consul, etcd, Eureka) or a service mesh.

## 7. Failure modes and security

| Threat / failure | What happens | Mitigation |
| --- | --- | --- |
| **DNS provider outage / DDoS** | Your domain stops resolving everywhere once caches expire (the 2016 attack on the DNS provider Dyn took down many major sites). | **Multiple DNS providers** (secondary DNS), sensible TTLs, anycast providers |
| **Cache poisoning** (e.g. the Kaminsky attack, 2008) | Forged responses get cached by the resolver, sending users to an attacker's IP | Source-port + query-ID randomization, DNSSEC validation, 0x20 case randomization |
| **Amplification DDoS** | Small spoofed queries trigger big responses that flood a victim | Disable open resolvers, response rate limiting, BCP 38 ingress filtering |
| **Domain/registrar hijack** | An attacker changes your NS records at the registrar | Registrar lock, MFA, registry lock for critical domains |
| **Subdomain takeover** | A dangling `CNAME` points to a deprovisioned cloud resource that an attacker re-claims | Audit DNS when deleting resources, automation |
| **DNS rebinding** | A malicious name first resolves to the attacker, then to `127.0.0.1` / internal IPs, bypassing the same-origin policy | Validate the `Host` header, block private IPs in resolvers, require auth on local services |
| **Routing failure** | A BGP change withdraws the routes to your authoritative servers, so the domain is unreachable (part of Facebook's October 2021 outage) | Authoritative DNS hosted in independent networks, out-of-band access |
| **Misconfiguration** | A typo or bad deploy pushes a wrong record that's cached for its full TTL | Change review, staged rollouts, short TTLs before risky changes |

## 8. Hands-on (worth doing once before interviews)

```bash
dig example.com A +short            # just the answer
dig example.com +trace              # walk root → TLD → authoritative yourself
dig example.com NS                  # who's authoritative
dig @1.1.1.1 www.example.com        # query a specific resolver
dig example.com TXT                 # SPF / verification records
dig -x 8.8.8.8                      # reverse (PTR) lookup
```

Look at the `ANSWER SECTION` TTL counting down on repeated queries to the same resolver. That's caching you can see.

---

## Interview questions

### "What happens when you type `https://www.example.com` and press Enter?" (DNS part)
1. The browser checks its HSTS list (to force HTTPS) and its own DNS cache.
2. The OS stub resolver checks its cache and the `hosts` file.
3. The query goes to the recursive resolver, which on a miss walks root → `.com` → `example.com` authoritative. Often `www` is a CNAME to a CDN, which triggers a second resolution that returns the nearest edge IP.
4. The answer is cached at each layer for its TTL, and the browser opens TCP+TLS (or QUIC) to that IP. See [HTTP](./02_HTTP.md) for the rest.

### "Why not use DNS round robin instead of a load balancer?"
Clients and resolvers cache answers, so you can't drain or remove a dead server faster than the TTL. There's no health checking, no per-request balancing, no session awareness, and the distribution is skewed by big shared resolvers. Use DNS to choose a **region** or **VIP**, and L4/L7 load balancers to choose the **server**.

### "How do you fail over a whole region?"
Health-checked DNS failover (or latency routing that drops the unhealthy region) with a low TTL on that record. Better still, use **anycast** or a global load balancer (for example Google Cloud's global LB or AWS Global Accelerator), which fail over without depending on DNS caches. Mention that data replication (RPO) is the hard part, not the routing.

### "How would you design DNS itself?" (rare, but it happens)
It's a read-heavy, hierarchical, partitioned KV store. Partitioning is by zone (delegation). Replication is via primary/secondary authoritative servers plus anycast. Reads are served almost entirely from **caches with TTLs**. Consistency is eventual, and TTL bounds the staleness. UDP keeps responses fast, and DNSSEC provides integrity.

## Common mistakes

- Saying DNS changes "propagate" and are "instant". They expire from caches.
- Putting a CNAME at the apex.
- Relying on a 30-second TTL for failover without knowing that some clients ignore it.
- Using DNS round robin as the only load balancing.
- Forgetting a second DNS provider when "every component must be redundant".
