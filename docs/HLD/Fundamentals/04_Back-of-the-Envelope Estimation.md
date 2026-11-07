---
sidebar_position: 4
slug: /HLD/Enveloper_Estimatioin
---

# Back-of-the-Envelope Estimation

> **Why this matters in interviews:** estimation isn't a math test. It's how you **justify architecture**. "100 writes/s fits on one Postgres primary" and "1M writes/s needs a sharded, log-structured store" lead to completely different designs. Interviewers grade whether you pick sensible assumptions, say them out loud, do the arithmetic quickly with round numbers and, most importantly, **draw a design conclusion from each number**.

Prerequisite: [Latency Numbers](./03_Latency%20Numbers.md).

**Timebox it:** about 3–5 minutes in a 45-minute round. Ask first: *"Would you like me to do capacity estimates, or should I assume a scale and move on?"* Some interviewers skip it, others care a lot.

---

## 1. The numbers to have in your head

### Powers of two and ten

| Power of 2 | Exact | ≈ Power of 10 | Name | Bytes |
| --- | --- | --- | --- | --- |
| 2^10 | 1,024 | 10^3 | Thousand | 1 KB |
| 2^20 | 1,048,576 | 10^6 | Million | 1 MB |
| 2^30 | ~1.07 × 10^9 | 10^9 | Billion | 1 GB |
| 2^40 | ~1.1 × 10^12 | 10^12 | Trillion | 1 TB |
| 2^50 | ~1.13 × 10^15 | 10^15 | Quadrillion | 1 PB |
| 2^60 | | 10^18 | Quintillion | 1 EB |

Use decimal units (1 KB = 1,000 B) for estimation. The roughly 2–12% difference from binary units never changes a design decision. Also remember 2^32 ≈ 4.3 billion (the IPv4 space, and the unsigned 32-bit int limit) and 2^64 ≈ 1.8 × 10^19.

### Time

| Period | Seconds | Shortcut |
| --- | --- | --- |
| 1 day | 86,400 | **≈ 10^5** (it slightly overstates the seconds, so rates come out about 14% low. Fine.) |
| 1 month | ~2.6 million | ≈ 2.5 × 10^6 |
| 1 year | ~31.5 million | ≈ 3 × 10^7 (or π × 10^7) |

### Converting "per day" to "per second" (memorize this)

| Per day | Per second (average) |
| --- | --- |
| 1 million | ~12 |
| 10 million | ~120 |
| 100 million | ~1,200 |
| 1 billion | ~12,000 |
| 10 billion | ~120,000 |

Shortcut: **X per day ÷ 10^5 ≈ X per second.**

### Typical data sizes

| Item | Size | Notes |
| --- | --- | --- |
| ASCII char | 1 B | UTF-8 is 1–4 B, and non-Latin scripts are often 2–3 B |
| int32 / int64 / double | 4 / 8 / 8 B | |
| Timestamp | 8 B | |
| UUID | 16 B binary, 36 B as text | A common hidden cost when stored as a string |
| Snowflake-style ID | 8 B | |
| Short text (tweet, comment) | ~100–300 B of text, about 1 KB with metadata | A 280-char limit can mean over 280 bytes in UTF-8 |
| Typical DB row with metadata | ~100 B – 1 KB | |
| User profile | ~1 KB | |
| Web page (HTML) | ~50–100 KB | |
| Thumbnail image | ~10–30 KB | |
| Compressed photo (web size, JPEG/WebP) | ~100–500 KB | |
| Phone camera photo (original) | ~2–5 MB | |
| Audio, 128 kbps | ~1 MB per minute | |
| Video, 1080p at ~5 Mbps | ~40 MB per minute, ~2.25 GB per hour | |
| Video, 4K at ~15–25 Mbps | ~110–190 MB per minute | |

### Traffic shape and overheads

| Rule of thumb | Value | Why |
| --- | --- | --- |
| **Peak vs average** | **2–5x** (use **3x** if unsure) | Traffic follows the daily cycle, so design for the peak, not the mean |
| The 80/20 rule | 80% of traffic in 20% of the time, so peak ≈ **4x** average | 0.8 / 0.2 = 4 |
| Read:write ratio | Social and content apps: **10:1 to 1000:1**. Chat, logging, IoT: write-heavy. | It decides whether you optimize the read path (caches, replicas) or the write path (log-structured storage, sharding) |
| Replication factor | **3x** for durable DB storage | It's the most commonly forgotten multiplier. Object stores like S3 handle durability internally, so you're billed for 1x the logical data. |
| Index and metadata overhead | +20–50% | B-tree indexes, LSM write amplification, fragmentation |
| Compression | Text/JSON 2–5x, logs 3–10x, already-compressed media about 1x | Don't "compress" JPEG or MP4 again in your math |
| Cache hit rate | 80–95% for a well-designed cache | Origin load = total × (1 − hit rate) |
| Headroom | Run servers at **~50–70%** utilization. **Architect** for ~10x growth but **provision** for 2–3x. | Spikes, failover (losing an AZ moves its load elsewhere), and deploys |

---

## 2. The method: six steps, always in this order

```
1. Users        DAU (and MAU, concurrent users if real-time)
2. Traffic      writes/s, reads/s, average and peak
3. Storage      per item × items per day × retention × replication (+ overhead)
4. Bandwidth    ingress and egress = QPS × payload size (bytes → bits: × 8)
5. Memory       the cache working set (hot 20% of the daily read volume, or the last N days)
6. Servers      peak QPS ÷ per-server capacity, with headroom and redundancy
```

**Then draw conclusions**, which is the part most candidates skip:
- "1,200 writes/s fits on one primary, so there's no sharding on day one."
- "55 TB/year of text means we'll shard by `user_id` after year 1."
- "75 Gbps of image egress has to come from a CDN."
- "300 GB of timeline cache means about 10 Redis nodes at 32 GB each, with replicas."

### Core formulas

```
Average QPS   = daily requests / 86,400 (≈ / 10^5)
Peak QPS      = average QPS × peak factor (2–5)
Storage/year  = items per day × size per item × 365 × replication × (1 + index overhead)
Bandwidth     = QPS × payload size            (bytes/s × 8 = bits/s)
Origin egress = total egress × (1 − CDN hit ratio)
Cache memory  = 0.2 × daily read volume × item size   (80/20: 20% of items get 80% of reads)
Servers       = peak QPS / (per-server QPS × target utilization)
Concurrency   = QPS × latency                 (Little's Law)
```

### How many requests can one server handle?

```
RPS per server ≈ cores × (1000 ms / CPU-ms per request) × target utilization
               ≈ 16 × (1000 / 10) × 0.6 ≈ 1,000 RPS
```

I/O-bound requests (waiting on a DB) need **concurrency** (async I/O or threads), not CPU. Use Little's Law: 1,000 RPS × 100 ms = 100 concurrent requests per server.

---

## 3. Worked examples

### Example 1: Twitter-like social feed

**Assumptions:** 200M DAU. Each user posts 0.5 tweets a day and opens their feed 10 times a day, seeing 20 tweets per open. A tweet with its metadata is about 500 B. 10% of tweets carry an image of about 200 KB.

| Quantity | Math | Result |
| --- | --- | --- |
| Tweet writes | 200M × 0.5 = 100M/day → ÷ 10^5 | **~1,200/s avg, ~3,500/s peak** |
| Feed reads | 200M × 10 = 2B/day | **~23k/s avg, ~70k/s peak** |
| Tweets read | 2B × 20 = 40B tweet views/day | Read:write ≈ **400:1** |
| Text storage | 100M × 500 B = 50 GB/day × 365 ≈ 18 TB/yr × 3 replicas | **~55 TB/yr, ~275 TB over 5 yrs** |
| Media storage | 10M images × 200 KB = 2 TB/day | **~730 TB/yr** (object storage) |
| Text egress | 40B × 500 B = 20 TB/day | **~230 MB/s ≈ 1.9 Gbps** |
| Image egress | 4B image views × 200 KB = 800 TB/day | **~9 GB/s ≈ 75 Gbps**, so it **must be a CDN** |
| Timeline cache | 200M users × 200 tweet IDs × 8 B | **~320 GB** (about 2x with Redis overhead) |
| API servers | 70k peak ÷ ~1k per server | **~70, so ~100** with headroom across 3 AZs |

**Conclusions:** the system is very read-heavy, so precompute timelines (fan-out on write) for normal users, with a hybrid approach for celebrities. Tweet writes are modest. The text store is tens of TB a year, so shard it. Media is the dominant cost, so put it in object storage behind a CDN.

### Example 2: URL shortener

**Assumptions:** 100M new URLs/month, a 100:1 read:write ratio, 500 B per record, 5-year retention.

| Quantity | Math | Result |
| --- | --- | --- |
| Writes | 100M ÷ 2.6M s | **~40/s** |
| Redirects | 40 × 100 | **~4,000/s avg, ~15k/s peak** |
| Records | 100M × 12 × 5 | **6B** |
| Storage | 6B × 500 B = 3 TB × 3 replicas | **~9 TB** |
| Key space | Base62: 62^6 ≈ 56.8B, 62^7 ≈ 3.5T | **7 chars** is comfortable (6 works too, but leaves less margin) |
| Cache | 4,000 × 86,400 ≈ 350M reads/day × 20% × 500 B | **~35 GB**, which fits on one Redis node (add a replica) |

**Conclusions:** the write load is trivial. Reads are cache-friendly. 9 TB is a handful of shards in a KV store (DynamoDB, Cassandra) or a sharded SQL database. The real design questions are ID generation and the 301-vs-302 analytics trade-off. See [Design URL Shortener](../03_Design_URL_Shortener.md).

### Example 3: Video platform (YouTube-like)

**Assumptions:** 500 hours of video uploaded per minute. Storing the original plus a rendition ladder (240p–4K) takes about 5 GB per hour of video. Viewers watch 1B hours/day at an average of about 3 Mbps (1.35 GB/hour).

| Quantity | Math | Result |
| --- | --- | --- |
| Hours uploaded/day | 500 × 1,440 | **720k hours/day** |
| New storage | 720k × 5 GB | **~3.6 PB/day, ~1.3 EB/yr** (before erasure-coding overhead) |
| Upload ingress | 720k × 2.25 GB (1080p originals) ÷ 86,400 | **~19 GB/s ≈ 150 Gbps** |
| Viewing egress | 1B h × 1.35 GB ÷ 86,400 | **~16 TB/s ≈ 125 Tbps** |
| Origin egress with a 95% CDN hit rate | 125 Tbps × 0.05 | **~6 Tbps** |

**Conclusions:** egress dwarfs everything else. The design centres on a **CDN plus caches embedded in ISPs**, adaptive bitrate (HLS/DASH), and tiered storage (hot renditions on fast storage, the long tail on cheap cold storage, with rarely watched renditions transcoded on demand). Transcoding is a massive async job pipeline.

### Example 4: Chat app (WhatsApp-like)

**Assumptions:** 100B messages/day, about 200 B per text message with metadata, and 500M concurrently connected devices at peak.

| Quantity | Math | Result |
| --- | --- | --- |
| Messages | 100B ÷ 86,400 | **~1.2M/s avg, ~3M/s peak** |
| Text bandwidth | 1.2M × 200 B | **~230 MB/s ≈ 2 Gbps**, which is small |
| Storage if kept until delivered only | Mostly transient | **Small** (an inbox queue per device) |
| Storage if retained forever | 20 TB/day × 3 replicas | **~22 PB/yr** |
| Connection servers | 500M ÷ ~500k connections per server | **~1,000 servers** |

**Conclusions:** the bottleneck is **long-lived connections and routing** (which server holds user X's socket?), not bandwidth. You need a presence/session store, per-conversation ordering, and an offline inbox. Media goes through object storage and a CDN, and only links travel in messages.

---

## 4. Sanity checks (do one before moving on)

- **Does one machine handle it?** Under about 1k writes/s and under about 1 TB means one well-provisioned DB (plus replicas) is the honest answer. Saying so is a strength, not a weakness.
- **Is the storage plausible?** Compare it with known scales. One commodity server holds about 10–100 TB of disk, and a rack holds about 1 PB.
- **Bits vs bytes:** network links are quoted in **bits**. 1 Gbps = 125 MB/s.
- **Did you include replication, indexes, peak and growth?**
- **Round aggressively:** 86,400 → 10^5, 2.6M → 2.5M, 365 → 400 when you're only after the order of magnitude.

## 5. Common mistakes

| Mistake | Fix |
| --- | --- |
| Precise arithmetic (`86,400 × 3.7 = ...`) | Round to one significant figure and say "about" |
| Numbers with no conclusion | After every number, say what it means for the design |
| Forgetting the peak | Multiply by 2–5x |
| **Forgetting replication** | Multiply DB storage by 3 (not object storage, which handles durability internally) |
| Mixing bits and bytes | Bandwidth in bits = bytes × 8 |
| Estimating storage but not egress | For media apps, egress is usually the dominant cost |
| Over-engineering at low scale | 40 writes/s doesn't need Kafka plus 64 shards |
| Spending 15 minutes here | Timebox it to about 5 minutes and confirm with the interviewer |

---

## Practice problems

1. **Instagram:** 500M DAU, each uploads 0.2 photos a day (2 MB original, 3 renditions totalling 500 KB) and views 50 photos a day. Estimate upload QPS, new storage per day, and image egress.
   *Answer sketch:* 100M uploads/day ≈ 1,200/s. Storage ≈ 100M × 2.5 MB = 250 TB/day. Views = 25B/day × ~200 KB ≈ 5 PB/day ≈ 60 GB/s ≈ 460 Gbps, so you need a CDN.
2. **Rate limiter for 1B requests/day:** how much memory does a per-user counter need for 100M users at 50 B each? *(About 5 GB, which fits in one Redis cluster.)*
3. **Uber location updates:** 2M active drivers each send their location every 4 s. *(500k writes/s, so you need an in-memory geo index rather than a relational DB per update.)*
4. **Logging pipeline:** 10k servers × 100 log lines/s × 300 B. *(300 MB/s ≈ 26 TB/day raw, or about 3–5 TB compressed. That calls for Kafka, object storage and tiered retention.)*
