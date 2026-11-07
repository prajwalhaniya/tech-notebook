---
sidebar_position: 3
---

# Latency Numbers Every Engineer Should Know

> **Why this matters at FAANG:** every design decision ("add a cache", "make it async", "keep it in one region", "batch the writes") is justified by **orders of magnitude**. Interviewers don't want exact nanoseconds. They want you to know that memory is about 1,000x faster than an SSD random read, that an in-datacenter round trip is cheaper than a disk seek, and that a cross-ocean round trip costs about 100 ms, bounded by physics. Get those ratios wrong and the rest of the design is built on sand.

Related: [Back-of-the-Envelope Estimation](./04_Back-of-the-Envelope%20Estimation.md), [HTTP](./02_HTTP.md).

---

## 1. The classic table, with modern ballparks

The left column is the famous list (Jeff Dean, Peter Norvig, about 2010–2012). Hardware has moved on, so the right column gives **rough modern ranges**. Quote the order of magnitude, not the digits.

| Operation | Classic number | Modern ballpark | Mental anchor |
| --- | --- | --- | --- |
| L1 cache reference | 0.5 ns | ~1 ns | |
| Branch mispredict | 5 ns | ~3–5 ns | |
| L2 cache reference | 7 ns | ~4 ns | |
| Mutex lock/unlock (uncontended) | 25 ns | ~15–25 ns | Contended locks are 100x worse |
| **Main memory reference** | **100 ns** | **~80–100 ns** | **~100 ns** |
| Compress 1 KB (Snappy-class) | 3 μs | ~1–2 μs | |
| Send 1 KB over a 1 Gbps network | 10 μs | ~8 μs at 1 Gbps, ~1 μs at 10 Gbps | |
| **Read 4 KB randomly from SSD** | **150 μs** | **~20–100 μs (NVMe)** | **~100 μs** |
| Read 1 MB sequentially from memory | 250 μs | ~20–100 μs | |
| **Round trip within the same datacenter** | **500 μs** | **~100–500 μs** | **~0.5 ms** |
| Read 1 MB sequentially from SSD | 1 ms | ~0.2–0.5 ms (NVMe at 2–7 GB/s) | |
| **HDD seek** | **10 ms** | **~4–10 ms** | **~10 ms** |
| Read 1 MB sequentially from HDD | 20 ms | ~5–10 ms (100–200 MB/s) | |
| **Packet CA → Netherlands → CA** | **150 ms** | **~150 ms** (physics doesn't improve) | **~150 ms** |

### Make it human: if 1 ns were 1 second

| Operation | Real | Scaled |
| --- | --- | --- |
| L1 cache | 0.5 ns | half a second |
| Main memory | 100 ns | ~1.7 minutes |
| SSD random read | 100 μs | ~1.2 days |
| Datacenter round trip | 500 μs | ~6 days |
| HDD seek | 10 ms | ~4 months |
| California ↔ Netherlands round trip | 150 ms | ~4.75 years |

## 2. The ratios that drive design decisions

| Comparison | Ratio | Design consequence |
| --- | --- | --- |
| Memory vs SSD random read | ~1,000x | **Cache hot data in RAM.** Redis and Memcached exist for this. |
| SSD vs HDD random read | ~100x | HDDs are for sequential, bulk and cold data (logs, backups, object storage). |
| Sequential vs random on HDD | ~100x+ | **Append-only designs** win: LSM-trees (Cassandra, RocksDB), Kafka's log, WALs. |
| **Datacenter RTT (0.5 ms) vs HDD seek (10 ms)** | ~20x | Reading **remote memory** (a Redis node) beats reading the **local disk**. That's why distributed caches work. |
| Same-region RTT vs cross-region RTT | ~100x | Keep chatty, synchronous call chains **inside one region**. Replicate across regions asynchronously. |
| Compress 1 KB (~2 μs) vs send over a WAN (ms) | ~1,000x | Compressing before going over the network is almost always worth it. |

## 3. Speed of light: the latency you can't optimize away

Light in fiber travels at about **200,000 km/s** (two-thirds of c), which works out to about **5 μs per km one way**, or about **1 ms of RTT per 100 km** of fiber.

| Route (approximate distance) | Theoretical minimum RTT | Typical real RTT |
| --- | --- | --- |
| Same AZ | | ~0.1–0.5 ms |
| Cross-AZ, same region | | ~0.5–2 ms |
| US East ↔ US West (~4,000 km) | ~40 ms | ~60–80 ms |
| New York ↔ London (~5,600 km) | ~56 ms | ~70–80 ms |
| US West ↔ Tokyo (~8,000 km) | ~80 ms | ~100–130 ms |
| US East ↔ Mumbai (~12,500 km) | ~125 ms | ~180–250 ms |
| Geostationary satellite hop | ~480 ms | ~500–700 ms (LEO constellations: ~25–60 ms) |

Real routes are longer than straight lines and add router hops. **Consequences:**
- A **synchronous cross-region write** (for example a globally consistent commit) costs at least one cross-region RTT, often 2 for consensus. That's why Spanner-style systems put replicas within about 1,000 km for writes, and why most systems use **async cross-region replication**.
- **CDNs and edge TLS termination** exist because you can't make the speed of light faster, but you can move the server closer.
- **Chatty protocols hurt over distance:** 10 sequential calls across an ocean ≈ 1 second.

## 4. Latency of common system components (in-region ballparks)

| Component / operation | Typical latency | Notes |
| --- | --- | --- |
| In-process cache lookup (hash map, Caffeine) | ~0.1–1 μs | No network |
| Redis / Memcached `GET` | ~0.2–1 ms | Dominated by the network RTT |
| Indexed point query (Postgres/MySQL, warm) | ~1–5 ms | Including the network |
| Query with joins / aggregations | ~10 ms – seconds | Depends on the plan, so check `EXPLAIN` |
| DynamoDB / Cassandra single-key read | ~1–10 ms (p99 higher) | |
| Kafka produce (`acks=all`) | ~2–10 ms | Durable replication to the ISR |
| Object storage `GET` (S3/GCS), first byte | ~10–100 ms | Long tail. Put a CDN in front for user traffic. |
| Elasticsearch query | ~10–200 ms | |
| Uncached DNS lookup | ~20–120 ms | See [DNS](./01_DNS.md) |
| TLS 1.3 handshake | 1 RTT + ~1 ms CPU | See [HTTP](./02_HTTP.md) |
| Serverless cold start | ~100 ms – several s | Depends on the runtime and package size |
| JVM GC pause | sub-ms (ZGC) to 100s of ms (poorly tuned) | A classic source of p99 spikes |
| Leader election / consensus write (Raft in one region) | ~a few ms | One quorum round trip plus an fsync |

## 5. Throughput ballparks (for sizing)

Treat these as **conversation starters, not guarantees**. Always say "assuming roughly X per node".

| Resource | Ballpark |
| --- | --- |
| Typical stateless API server (JSON + a few downstream calls) | ~1k–5k RPS per instance. **Use ~1k for estimates.** |
| NGINX / Envoy proxying | Tens of thousands of RPS per core for small requests |
| Single Redis node | ~100k+ simple ops/s (more with pipelining) |
| Single relational primary (Postgres/MySQL, decent hardware) | ~10k–50k simple reads/s, ~1k–10k durable writes/s (batching helps) |
| Kafka broker | ~100s of MB/s. A cluster does millions of messages/s. |
| Long-lived connections (WebSocket) per tuned server | ~100k to 1M+, mostly memory-bound |
| HDD | ~100–200 MB/s sequential, ~100–200 IOPS |
| SATA SSD | ~500 MB/s, tens of thousands of IOPS |
| NVMe SSD | ~2–7 GB/s, hundreds of thousands to 1M IOPS |
| NIC | 1 Gbps = 125 MB/s. 10 Gbps = 1.25 GB/s. Modern DCs run 25–100 Gbps per host. |

## 6. Averages lie: percentiles and tail latency

- **p50** (median) is the typical user. **p99** means 1 in 100 requests is slower. **p99.9** matters for high fan-out systems and for your heaviest users, who make the most requests.
- **Never report or alert on the average.** A mean of 50 ms can hide a p99 of 2 s.
- **Tail amplification in fan-out:** if a request calls N backends in parallel and waits for **all** of them, it's slow if **any one** is slow.

```
P(request hits at least one backend's p99) = 1 - 0.99^N

N = 1    →  1%
N = 10   →  ~10%
N = 100  →  ~63%     ← the backend's p99 becomes your p50-ish
```

**Mitigations** (from Dean & Barroso, *The Tail at Scale*, 2013):
- **Hedged requests:** after waiting about the p95 latency, send a duplicate to another replica and use whichever answers first. That adds roughly 5% extra load for a big tail cut.
- **Tied requests:** send to two replicas, and the first to start tells the other to cancel.
- **Tight timeouts plus partial results:** return what you have (for example a search page missing one shard).
- **Reduce variance:** avoid GC spikes and noisy neighbours, keep queues short, and separate background work.

## 7. Little's Law: connecting latency, throughput and concurrency

```
L = λ × W
concurrency (in-flight requests) = arrival rate × time in system
```

- 2,000 RPS × 0.2 s average latency means **400 requests in flight**. You need about 400 threads, connections or coroutine slots across the fleet, plus headroom.
- If a downstream dependency slows from 50 ms to 500 ms at the same RPS, the in-flight requests go up **10x**. Thread pools fill, queues grow, and the slowdown **cascades**. That's why you need **timeouts, bulkheads and circuit breakers**.
- **DB connection pool sizing:** 500 queries/s × 10 ms per query → about 5 busy connections on average, so a pool of about 10–20 per app instance is plenty. Pools of hundreds hurt the database.

## 8. Latency budgets

Start with the target (for example **p99 under 200 ms** for a feed API) and allocate it across the path:

```
Client ↔ edge (CDN/TLS terminated nearby)      30 ms
Edge ↔ origin LB (warm pooled connection)      20 ms
Auth / gateway                                   5 ms
Feed service:
   parallel fan-out to 3 services (slowest)     60 ms   ← timeouts at ~80 ms, degrade if exceeded
   cache lookups                                 5 ms
   ranking                                      40 ms
Serialization + compression                     10 ms
Headroom                                        30 ms
------------------------------------------------------
Total                                          200 ms
```

**Rules of thumb:** parallelize independent calls, keep the critical path short, move everything else **off** the path (async analytics, logging, notifications), and give every hop a timeout smaller than its caller's.

## 9. Human perception (why the targets look the way they do)

| Response time | How it feels |
| --- | --- |
| Under ~100 ms | Instant |
| Under ~1 s | Noticeable, but the user stays in flow |
| Over ~10 s | Attention is lost, so show progress or go async |

Product impact is real. Large web companies have repeatedly measured revenue and engagement drops from added latency of only 100 ms or so.

---

## Interview cheat sheet (memorize this)

```
~1 ns       L1 cache
~100 ns     RAM
~1–2 μs     compress 1 KB
~10 μs      send 1 KB on 1 Gbps
~100 μs     SSD random read
~0.5 ms     round trip in a datacenter
~1 ms       read 1 MB from SSD / Redis call
~10 ms      HDD seek
~20–100 ms  uncached DNS, S3 first byte
~70–150 ms  cross-continent round trip
```

## Common mistakes

- Treating the network as free. Each sequential call is at least one RTT.
- Assuming disk means slow, without separating sequential from random or HDD from NVMe.
- Synchronous cross-region calls on the hot path.
- Designing for the average instead of p99.
- Fanning out to 100 shards without hedging or timeouts.
- Quoting 2012 numbers as exact. Say "about" and quote the orders of magnitude.
