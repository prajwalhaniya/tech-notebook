---
sidebar_position: 9
---

# Cache Eviction

> **Why this matters in interviews:** every cache is smaller than its data, so something must be thrown out. Interviewers ask "which eviction policy, and why?" in caching deep dives, and "implement an LRU cache" in coding rounds. A FAANG-level answer separates **eviction, expiration and invalidation**, picks a policy from the **access pattern** (recency, frequency, scans, sizes), knows the **approximations real systems use** (sampled LRU in Redis, CLOCK, segmented LRU) and knows that modern caches add an **admission policy** (W-TinyLFU) rather than just a better eviction rule.

Blueprint components this feeds: **7 (caching strategy)** and **13 (performance)** in the [HLD Blueprint](./00_HLD%20Blueprint.md). Related: [Caching Strategies](./08_Caching%20Strategies.md) · [CDN](./10_CDN.md). Implementations in this notebook: [LRU cache](../../DSA/caching/Least%20Recently%20Used.md) · [LFU cache](../../DSA/caching/Least%20Frequently%20Used.md).

---

## 1. Three ways an entry leaves a cache

| | **Eviction** | **Expiration** | **Invalidation** |
| --- | --- | --- | --- |
| Trigger | The cache is **full** | The entry's **TTL** passed | The **data changed** at the source |
| Decided by | The eviction policy (LRU, LFU, ...) | Time | Your application (delete on write, CDC, purge) |
| Purpose | Make room for more valuable entries | Bound staleness | Remove wrong data |
| Entry was | Still correct | Possibly stale | Definitely stale |

Mixing these up is a common interview slip. "We'll use LRU to keep data fresh" is wrong: LRU decides what to drop when memory is full, and it says nothing about freshness. Freshness comes from TTLs and invalidation (see [Caching Strategies](./08_Caching%20Strategies.md)).

## 2. How to judge a policy

- **Hit ratio** (requests served from the cache), and **byte hit ratio** when object sizes vary (CDNs care about bytes, because bytes are what costs money).
- **Overhead:** memory per entry (pointers, counters) and CPU per access. Some policies need a lock on every **read** to update their bookkeeping, which hurts at high concurrency.
- **Robustness:** does one **scan** (a batch job reading every key once) flush the hot set? Does a formerly popular item **stay forever**?
- **The upper bound:** Belady's **MIN/OPT** (1966) evicts the item whose next use is furthest in the future. It needs the future, so it's not implementable, but simulators compare real policies against it.

## 3. The policies

| Policy | Evicts | Strengths | Weaknesses | Seen in |
| --- | --- | --- | --- | --- |
| **FIFO** | The oldest inserted | Trivial, no work on reads, very concurrent | Ignores popularity: evicts hot items just for being old | Simple caches, and as a building block (S3-FIFO) |
| **Random** | A random entry | No bookkeeping at all | Ignores popularity | Redis `allkeys-random`, some CPU caches |
| **LRU** (least recently used) | The entry not used for the longest time | Great for **recency** (recently used is likely to be used again); O(1) | **Scans flush it**; every read updates the list (contention) | The default almost everywhere |
| **LFU** (least frequently used) | The entry with the fewest hits | Keeps **stably popular** items | New items get evicted before they can build counts; **old popularity never fades** without decay | Redis `allkeys-lfu` (with decay) |
| **MRU** | The **most** recently used | Correct for cyclic scans larger than the cache | Wrong for most workloads | Some database buffer strategies for sequential scans |
| **TTL-based** | The entry closest to expiry | Respects freshness hints | Ignores popularity | Redis `volatile-ttl` |
| **Size-aware** (GDSF, ...) | Lowest value per byte (frequency × cost ÷ size) | Higher **object** hit ratio when sizes vary widely | More complex | CDN and proxy caches |
| **SLRU** (segmented LRU) | From a probationary segment first; items move to a protected segment on the second hit | **Scan-resistant**: one-hit items never reach the protected segment | Segment sizes need tuning | Memcached (hot/warm/cold), MySQL InnoDB (midpoint insertion) |
| **CLOCK** | Sweeps a circular buffer, giving each entry with a "referenced" bit a second chance | Approximates LRU with **no list updates on reads** | Approximate | OS page replacement, PostgreSQL buffer manager (clock-sweep) |
| **LRU-K / 2Q** | Based on the K-th most recent access, or a FIFO probation queue then an LRU | Scan-resistant, captures frequency | More bookkeeping | Databases (LRU-K: O'Neil 1993; 2Q: Johnson & Shasha 1994) |
| **ARC** | Balances a recency list and a frequency list, adapting their sizes using "ghost" lists of recently evicted keys | **Self-tuning** between recency and frequency, scan-resistant | More memory; patented by IBM (Megiddo & Modha, 2003) | ZFS |
| **W-TinyLFU** | A small LRU window plus a main SLRU, with **admission** by approximate frequency | Near-optimal hit ratios across many workloads, compact | More complex to implement | Java's Caffeine, Ristretto (Go) |
| **S3-FIFO** | Small FIFO for new items, main FIFO for items hit again, ghost queue of recent evictions | Simple, very concurrent (no work on hits), competitive hit ratios | Recent (Yang et al., SOSP 2023) | Increasingly adopted |

## 4. LRU in depth

**The structure:** a hash map from key to node, plus a **doubly linked list** ordered by recency. `get` moves the node to the front, `put` inserts at the front, and eviction removes from the tail. Everything is O(1). The full implementation with a hand-written list is in [LRU cache](../../DSA/caching/Least%20Recently%20Used.md). In JavaScript, a `Map` keeps insertion order, which gives a compact version:

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();              // iteration order = least recently used first
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    this.map.delete(key);              // move to the most-recent end
    this.map.set(key, value);
    return value;
  }
  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value);   // evict the least recently used
    }
    this.map.set(key, value);
  }
}
```

**Weakness 1: scans.** A nightly job reading 10M keys once each pushes the entire hot set out of an LRU cache, and the next morning's traffic hits the DB cold. The fixes are all forms of "one access shouldn't be enough to displace proven items":
- **Segmented LRU / midpoint insertion:** new entries enter a probationary segment and are promoted only on a second hit. InnoDB inserts new pages at the head of its "old" sublist (the last ~3/8 of the LRU list, set by `innodb_old_blocks_pct`), and promotes them to the "young" sublist only if they're accessed again after `innodb_old_blocks_time` (1 s by default).
- **Admission filters:** don't cache an item until it's been seen twice (W-TinyLFU, below).
- **Bypass:** batch jobs read with a "don't cache" flag, or use a separate cache.

**Weakness 2: write contention on reads.** Every hit moves a node, which needs a lock in a concurrent cache. Real systems approximate LRU to avoid that:
- **Redis approximated LRU:** no list at all. Each key stores a last-access timestamp. When memory is full, Redis samples `maxmemory-samples` keys (default 5) and evicts the oldest of the sample (keeping a small pool of good candidates across rounds). More samples get closer to true LRU at more CPU cost.
- **CLOCK:** a reference bit set on access (a cheap write, no list movement). The "hand" sweeps the buffer, clearing bits and evicting the first entry whose bit is already clear. PostgreSQL's clock-sweep uses a small usage count (up to 5) instead of one bit.
- **Buffered updates:** Caffeine records reads in lock-free ring buffers and applies them to the policy in batches.

## 5. LFU in depth

**The structure (O(1) LFU):**
- A map from key to node.
- A map from frequency to a doubly linked list of the keys with that count.
- A `minFreq` pointer.

On a hit, move the key from the `f` list to the `f + 1` list. To evict, remove the least recent key from the `minFreq` list, which also breaks ties by recency. See [LFU cache](../../DSA/caching/Least%20Frequently%20Used.md).

**Weakness 1: popularity never fades.** Yesterday's viral video has a count of 10M and will never be evicted, even with zero hits today. Fix this with **decay (aging)**: periodically halve all counts, or decay a key's count based on time since its last access.

**Weakness 2: new items die young.** A new item starts at count 1 and is the first to go, even if it's about to become hot. Fix this with a **window** for new items (W-TinyLFU) or an initial count above the minimum.

**Redis LFU** handles both with very little memory:
- A **logarithmic 8-bit counter** per key, a Morris counter that increments probabilistically, so 255 can represent millions of hits (tuned by `lfu-log-factor`).
- The counter **decays** with time since the last access (`lfu-decay-time`, in minutes).
- New keys start at 5, not 0, so they survive long enough to prove themselves.

## 6. Admission vs eviction: the modern idea

Eviction answers "**who leaves** when something new arrives?" **Admission** answers "**should this new thing come in at all?**" Most items in real traces are **one-hit wonders**. Admitting them evicts something useful for nothing.

**W-TinyLFU** (Einziger, Friedman and Manes; used by Caffeine):

```
new item ──▶ [ window LRU ~1% ] ──evicted candidate──▶ admission: freq(candidate) > freq(victim)? 
                                                          │ yes                    │ no
                                                          ▼                        ▼
                                              [ main SLRU ~99%: probation → protected ]   dropped
```

- **TinyLFU:** a **Count-Min Sketch** (a few 4-bit counters per key, hashed, so a few bytes per entry) estimates how often each key was requested recently, **including keys that aren't in the cache**. Counts are halved periodically, so old popularity fades.
- The **window** gives new items a short chance to build frequency, so bursts of recency aren't punished.
- The result is near-optimal hit ratios across recency-heavy, frequency-heavy and scan-heavy traces, with tiny overhead.

Even if you don't name W-TinyLFU, saying *"I'd add an admission filter so one-hit items don't push out the hot set"* signals real depth.

## 7. What real systems do

| System | Eviction | Notes |
| --- | --- | --- |
| **Redis** | `maxmemory-policy`: `noeviction` (the default: writes fail when full), `allkeys-lru`, `allkeys-lfu`, `allkeys-random`, `volatile-lru`, `volatile-lfu`, `volatile-random`, `volatile-ttl` | `volatile-*` evicts only keys **with a TTL**, so keys without one are protected. LRU and LFU are both sampled approximations |
| **Memcached** | Segmented LRU per slab class (HOT, WARM, COLD), with a background maintainer thread | Memory is split into **slab classes** by item size. Items compete for memory only within their class; a slab rebalancer moves pages between classes |
| **Caffeine** (Java), **Ristretto** (Go) | W-TinyLFU / TinyLFU admission | The state of the art for in-process caches |
| **PostgreSQL** shared buffers | Clock-sweep with usage counts (max 5) | Large sequential scans use a small **ring buffer** so they don't flush the cache |
| **MySQL InnoDB** buffer pool | LRU with midpoint insertion (old/young sublists) | Scan resistance via `innodb_old_blocks_time` |
| **Linux page cache** | Active and inactive lists (a two-list LRU approximation) | A page must be referenced again to be promoted to the active list |
| **ZFS** | ARC | Adaptive between recency and frequency |
| **CDNs** | Usually LRU-like per tier, often size-aware, across RAM and disk tiers | Long-tail content is evicted from edges and served from regional tiers. See [CDN](./10_CDN.md) |

### Redis configuration in practice

| Use | Policy | Why |
| --- | --- | --- |
| Pure cache (every key can be reloaded) | `allkeys-lru`, or `allkeys-lfu` for stable popularity | Any key may go; keep the valuable ones |
| Cache **and** important data in one instance | `volatile-lru` / `volatile-lfu`, with TTLs only on cache keys | Protects keys without a TTL. Better still: **separate instances** |
| Sessions, rate limits, locks, queues (Redis as a store) | `noeviction`, with alerts on memory | Silently evicting a session logs a user out; evicting a lock breaks mutual exclusion |

A classic production incident: a cache instance is left on the default `noeviction`, fills up, and starts **rejecting writes** with OOM errors. Set `maxmemory` and a policy deliberately.

## 8. Choosing a policy from the workload

| Access pattern | Policy | Example |
| --- | --- | --- |
| **Recency** dominates: what was used recently is used again soon | LRU (or approximated LRU) | Sessions, feeds, recently viewed items, most web objects |
| **Stable popularity:** the same items stay hot for a long time | LFU with decay | Product catalogues, reference data, top songs |
| **Scans or batch jobs** mixed with interactive traffic | Scan-resistant: SLRU, 2Q, ARC, W-TinyLFU, or bypass the cache for the batch | Analytics jobs, backups, crawlers |
| **Unknown or shifting mix** | W-TinyLFU (Caffeine) or ARC | General-purpose application caches |
| **Object sizes vary by orders of magnitude** | Size-aware (GDSF), or separate caches per size class | CDN, media caches, Memcached slab classes |
| Data must not be evicted | Not a cache problem: use `noeviction` or a database | Sessions without another store, locks |

## 9. Sizing: the hit ratio curve

Hit ratio grows with cache size, but with **diminishing returns** under skewed (Zipf) access: the first few percent of keys capture most requests, and each extra gigabyte captures less.

```
hit ratio
100% ┤                          ...........
     │                ......''''
     │          ..''''
     │       .''          ← steep part: the hot set
     │     .'
     │    :
     │   :
  0% ┼──┴───────────────────────────────── cache size
         small                      whole dataset
```

How to size it in an interview:
1. **Estimate the working set:** "The 20% of profiles touched daily × 2 KB = 20 GB."
2. **Pick a target hit ratio** from what the database can absorb (`DB load = (1 − h) × QPS`).
3. **Validate in production:** watch the **eviction rate** and the hit ratio. Evictions of keys that are soon requested again (cheap to measure with a ghost list or sampling) mean the cache is too small. Production systems can plot **miss-ratio curves** (hit ratio vs size) from sampled traces to size caches precisely.

## 10. Expiration mechanics (how TTLs are enforced)

Caches don't scan for expired keys continuously, which would be too expensive. Redis, for example, combines two methods:
- **Lazy expiration:** a key is checked when it's accessed, and deleted if expired.
- **Active expiration:** a background cycle samples keys with TTLs and deletes the expired ones, repeating while a large share of the sample is expired.

So expired keys can occupy memory for a while, and memory usage isn't just "live keys." Eviction policies then act on whatever is left. That's why `volatile-ttl` exists: when memory is short, evict what's about to expire anyway.

## 11. Interview questions (with crisp answers)

**Q: LRU or LFU?**
LRU when recent use predicts future use (most web traffic, sessions, feeds). LFU, with decay, when popularity is stable over time (catalogues). If unsure or mixed, use an adaptive policy like W-TinyLFU or ARC.

**Q: What's wrong with plain LRU?**
A single scan evicts the whole hot set, and every read mutates shared state (lock contention). Fix with segmented LRU or midpoint insertion, admission filters, or CLOCK-style approximations.

**Q: What's wrong with plain LFU?**
Formerly popular items never leave (counts don't decay), and new items are evicted before they build counts. Fix with aging and a window for new items.

**Q: How does Redis implement LRU?**
Approximately. It stores an access timestamp per key and, when memory is full, evicts the oldest from a small random sample (5 keys by default), with a pool of candidates kept between evictions. There's no linked list.

**Q: What's the difference between eviction and expiration?**
Eviction removes entries because memory is full (policy-driven). Expiration removes entries whose TTL passed (time-driven, to bound staleness). Invalidation removes entries because the source changed.

**Q: What's an admission policy?**
A filter that decides whether a new item enters the cache at all, usually by estimated frequency, so one-hit wonders don't evict popular items. TinyLFU estimates frequencies with a Count-Min Sketch.

**Q: Implement an LRU cache.**
Hash map plus doubly linked list, with O(1) `get` (move to front) and `put` (insert at front, evict from the tail when full). In JS, `Map` insertion order gives a compact version (section 4).

## 12. Common mistakes

- Saying an eviction policy keeps data fresh. That's TTLs and invalidation.
- Leaving Redis on `noeviction` for a pure cache, or on an `allkeys-*` policy when it also holds sessions or locks.
- Using `volatile-*` policies when no keys have TTLs: nothing can be evicted, so writes fail.
- LFU without decay.
- Ignoring scans and batch jobs that share the cache with interactive traffic.
- Sizing the cache to the whole dataset instead of the working set and a target hit ratio.
