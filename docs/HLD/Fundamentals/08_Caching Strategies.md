---
sidebar_position: 8
---

# Caching Strategies

> **Why this topic is important in interviews:** Almost every design has a read path. A cache can make this path 10 to 100 times less expensive. Because of this, interviewers ask about caches in almost every round. To say "add a cache" is not enough. Interviewers look for these items:
>
> - **Where** the cache is, and why.
> - **Which read strategy and write strategy** you use.
> - **How old the cached data can become,** and how the data becomes correct again.
> - **What occurs when the cache fails.** Examples are stampedes, hot keys, and a cold restart that stops the database.
>
> Strong candidates also tell when **not** to use a cache.

Blueprint components that this page supports: **7 (caching strategy)**, **13 (performance)**, **8 (scalability)** and **11 (reliability)** in the [HLD Blueprint](./00_HLD%20Blueprint.md).

Related pages: [Cache Eviction](./09_Cache%20Eviction.md) · [CDN](./10_CDN.md) · [HTTP caching headers](./02_HTTP.md) · [Latency Numbers](./03_Latency%20Numbers.md) · [ACID vs BASE](./07_ACID%20vs%20BASE.md).

This page obeys the rules of ASD-STE100 (Simplified Technical English).

---

## 1. Why use a cache

A cache keeps a copy of data in a location that is **faster or nearer** than the source of the data. A cache gives three advantages:

| Advantage | Example |
| --- | --- |
| **Less latency** | A Redis GET in the same region takes approximately 0.2–1 ms. A database query with joins takes approximately 5–50 ms. Refer to [Latency Numbers](./03_Latency%20Numbers.md). |
| **Less load on the source** | The database gets only the cache misses. |
| **Less cost** | A read from memory costs less than database CPU time. A CDN hit does not use origin egress. |

### 1.1. The hit ratio controls the result

Use these formulas. In them, `h` is the hit ratio, `Tc` is the cache latency, and `Ts` is the source latency.

```
average latency ≈ h · Tc + (1 − h) · (Tc + Ts)
load on source  = (1 − h) · QPS
```

The second formula is the more important one. This table shows the database load at 100,000 reads per second:

| Hit ratio | Database reads per second |
| --- | --- |
| 90% | 10,000 |
| 99% | 1,000 |
| 99.9% | 100 |

A change from 90% to 99% looks small. But this change decreases the database load by 10 times. Because of this, teams work hard to get the last few percent.

### 1.2. Why a cache gets a high hit ratio

User requests do not go equally to all keys. Usually, a small set of keys gets most of the requests. For example, 20% of the URLs can get 80% of the clicks. This distribution is approximately a Zipf distribution. A cache that holds only this "hot set" can get a high hit ratio.

### 1.3. When not to use a cache

Do not use a cache in these conditions:

- **Most operations are writes, or the system reads data only one time.** Examples are logs and one-time reports. The cache writes cost work, and you get no hits.
- **The data must be strongly consistent.** Examples are account balances, inventory decrements, and checks for unique usernames. Read this data from the source of truth. You can cache the *display* of a balance. Do not cache the value that you check before a debit.
- **The source is already fast enough.** An example is a primary-key lookup on a table with a correct index, at low QPS. A cache adds a failure mode and a consistency problem, but it gives little improvement.
- **The data is personal and the system reads each key only one time.**

In an interview, a sentence such as "I do not add a cache here, because…" is a strong signal.

## 2. Where to put the cache

```
Client ──▶ CDN edge ──▶ API gateway / reverse proxy ──▶ App server ──▶ Distributed cache ──▶ Database
(browser,   (shared,       (shared, one per region)       (in-process   (Redis, Memcached)    (buffer pool,
 app cache)  one per PoP)                                  L1 cache)                           materialized views)
```

| Layer | Latency | Size | Shared by | Control of invalidation | Good for |
| --- | --- | --- | --- | --- | --- |
| **Browser or mobile app** | 0 (no network) | Small | One user | Weak. Only headers and versioned URLs. | Static assets. The recent data of the user. |
| **CDN** | Approximately 10–30 ms (a near PoP) | Very large | All users in a region | Purge APIs, TTLs, versioned URLs | Static files, media, public API responses. Refer to [CDN](./10_CDN.md). |
| **Reverse proxy** (Nginx, Varnish) | Less than 1 ms in the data center | Medium | All users of that proxy | TTL, purge | Public pages, API responses |
| **In-process cache (L1)** | Approximately 100 ns | Small (heap) | One server instance | Difficult. There are N copies on N servers. | Configuration, feature flags, very hot keys |
| **Distributed cache (L2)** | Approximately 0.2–1 ms | Large (sharded) | All app servers | Direct. Delete the key. | Objects, query results, sessions, counters |
| **Database internals** | — | Buffer pool | The database | Automatic | Hot pages. Materialized views for expensive queries. |

### 2.1. Two-tier cache (L1 and L2)

A two-tier cache gives the speed of an in-process cache and the capacity of a shared cache. The problem is coherence. When a key changes, the L1 copy on each server becomes stale. Use one of these solutions:

- **Set a very short L1 TTL** (1–10 seconds). This is the simplest solution, and usually it is sufficient.
- **Send invalidation messages** through pub/sub (Redis Pub/Sub, Kafka). Each server then deletes its copy of the key. Delivery is not guaranteed. If a server does not get a message, its copy stays stale until the TTL ends.
- **Keep only data that does not change, or data that can be some seconds old,** in L1.

## 3. Read strategies

### 3.1. Cache-aside (lazy loading): the default strategy

In cache-aside, the application does all the work:

1. Read the key from the cache.
2. If the key is not in the cache, read the value from the database.
3. Write the value into the cache.

```ts
async function getUser(id: string): Promise<User | null> {
  const key = `user:v3:${id}`;                          // namespace + schema version + id
  const cached = await redis.get(key);
  if (cached !== null) return cached === NULL_MARKER ? null : JSON.parse(cached);

  const user = await db.findUser(id);                   // cache miss: read the source of truth
  await redis.set(key, user ? JSON.stringify(user) : NULL_MARKER,
                  'EX', user ? ttlWithJitter(3600) : 60);   // short TTL for "not found" (section 7)
  return user;
}

async function updateUser(id: string, patch: Partial<User>): Promise<void> {
  await db.updateUser(id, patch);                       // 1) write the source of truth
  await redis.del(`user:v3:${id}`);                     // 2) DELETE the cache key (do not update it)
}
```

Advantages:

- The cache holds only data that the system reads.
- If the cache stops, the system becomes slow, but it continues to operate. This is true only if the database can accept the full load.
- Cache-aside operates with all cache products.

Disadvantages:

- The first read after a cache miss is slow.
- Each cache miss costs three round trips.
- Hot keys can cause a stampede.
- Race conditions can leave stale data in the cache (section 5).

### 3.2. Read-through

In read-through, the cache library or the cache service reads from the database when a key is not in the cache. You give the cache a "loader" function. The result is the same as cache-aside, but the logic is in one location. Examples are Caffeine `LoadingCache`, DAX in front of DynamoDB, NCache, and the second-level caches of many ORMs.

### 3.3. Refresh-ahead

In refresh-ahead, the system refreshes entries **before** they expire. It refreshes keys that the system still reads, or it refreshes known hot keys on a schedule. This removes the cache-miss latency for hot data. The disadvantage is that the system can refresh data that no user reads. Usually, refresh-ahead operates together with "stale-while-revalidate". The system sends the stale value immediately and gets the new value in the background.

## 4. Write strategies

| Strategy | Action on a write | Read after the write | Durability | Write latency | Use for |
| --- | --- | --- | --- | --- | --- |
| **Write-around with delete** (with cache-aside) | Write the database. Then delete the cache key. | The next read is a cache miss. Then the data is fresh. | Same as the database | Database only | **The default.** Most entities. |
| **Write-through** | Write the cache **and** the database at the same time (synchronously). The cache layer or the app does this. | Fresh, if both writes are successful | Same as the database | Database plus cache | Data that users read immediately after a write (profiles, settings) |
| **Write-behind (write-back)** | Write the cache. The cache writes to the database **later** (asynchronously), often in batches. | Fresh, from the cache | **Not safe.** If the cache stops before it writes to the database, the data is lost. | Cache only (fast) | Counters, likes, view counts, rate-limit buckets, metrics. Data with many writes, where a small loss is acceptable. |

### 4.1. Why to delete the key, and not to update it

Two writers can update the cache in the **opposite order** from their database writes:

```
Writer A: DB ← v1 ................................ cache ← v1
Writer B:          DB ← v2 ── cache ← v2
Result:   DB = v2, cache = v1   (stale until the TTL ends; stale always if there is no TTL)
```

A delete is idempotent, and the order of deletes is not important. After the last delete, the next read gets the current value from the database. Update the cache on a write only when the writes to one key occur in sequence. This is true when there is only one writer, or when you use versioned writes (section 5).

### 4.2. How to use write-behind safely

Systems often use write-behind for counters. For example, the app sends `INCR post:42:likes` to Redis. Then a worker writes the changes to the database in batches at regular intervals. To make the possible data loss smaller, do these steps:

1. Turn on Redis persistence (AOF), or replicate the counter.
2. Write to the database frequently.
3. Make each database write **idempotent**. Write absolute values, or record the last offset that you wrote.

Tell the interviewer that a "likes" count can be incorrect by a small number after a crash.

> **CAUTION:** Do not use write-behind for money. If the cache stops before it writes to the database, the data is lost.

## 5. Consistency: race conditions and solutions

A cache is a second copy of the data. No transaction includes both copies. Thus, a cache is **eventually consistent** at best. Your task is to put a limit on the time that data can be stale. Also, you must close the usual race conditions.

### 5.1. Race 1: the stale fill

This is the usual problem with cache-aside:

```
Reader:  cache miss ── read DB (old value v1) ──────────────────────── cache ← v1   ← stale!
Writer:                                      DB ← v2 ── cache.del
```

The reader read `v1` before the write. But the reader put `v1` into the cache after the writer deleted the key. Now the cache keeps `v1` until the TTL ends. This problem does not occur frequently, because the reader must be slower than the full write. But at large scale, it occurs.

Use one of these solutions. The list starts with the simplest solution and ends with the strongest:

| Solution | How it operates | Cost |
| --- | --- | --- |
| **TTL** | The stale data becomes correct when the TTL ends. | The time of the problem has a limit, but the problem continues to occur. |
| **Delayed double delete** | Delete the key. Then delete the key again after approximately 1 second. | The time window becomes smaller. It is not a full solution. |
| **Leases** (the Facebook memcache paper, 2013) | On a cache miss, the cache gives a lease token. A `set` operation is successful only with a valid token. A `delete` operation cancels all tokens for that key. | The cache must support leases, or you must write a Lua script in Redis. Leases also prevent stampedes, because only the token holder reads the database. |
| **Versioned writes (CAS)** | Store `{version, value}`. Write the value only if the new version is larger. Use a Lua script, or Memcached `cas`. | You need a version from the database (a row version, `updated_at`, or an LSN). |
| **CDC-driven invalidation** | A change-data-capture stream (Debezium, DynamoDB Streams) deletes keys **after** each commit. | You need more infrastructure. This also solves the dual-write problem (section 5.2). |

### 5.2. Race 2: the dual-write problem

The `db.update()` operation is successful. Then the `redis.del()` operation fails because of a timeout, a network problem, or a process crash. The cache now keeps stale data until the TTL ends. A retry of the delete can help. But if the process crashes between the two steps, the delete is lost. Use these solutions:

- **Always set a TTL.** The TTL is your safety net.
- **Send invalidations from the change stream of the database** (CDC), or from a **transactional outbox**. Then each commit always causes an invalidation. Refer to [ACID vs BASE](./07_ACID%20vs%20BASE.md).

### 5.3. Which consistency level you can promise

| Requirement | Solution |
| --- | --- |
| "The data is stale for a maximum of N seconds" | Set a TTL of N seconds. Also delete the key on each write. |
| **Read-your-own-writes** (a user sees their edit immediately) | Use write-through for the keys of that user. Or, for some seconds after a write, do not use the cache for that user (set a flag in the session). Or, after a write, read from the primary database. |
| The data is never stale | Do not cache that read. Read from the source of truth (or the primary database). |

Tell the interviewer which row applies to each feature. This is the skill "sort features by their consistency requirements" from [ACID vs BASE](./07_ACID%20vs%20BASE.md).

## 6. TTLs: how to select and adjust them

The TTL is your **staleness budget**. It is also your **safety net** against all the problems in section 5. Select the TTL from the maximum age that the data can have. Do not select it from the frequency of changes.

| Data | Typical TTL | Reason |
| --- | --- | --- |
| Static assets with hashed file names | 1 year, `immutable` | The content of a URL never changes. |
| Product catalog, user profiles | Minutes to hours, plus a delete on each write | The data changes rarely. Invalidation keeps it fresh. |
| Feeds, timelines, search results | Seconds to minutes | Fresh data is important, but exact data is not necessary. |
| Counters (likes, views) | Seconds, or write-behind | An approximate value is sufficient. |
| Prices and stock levels that users see | Seconds. Check the value again at checkout. | The display can be some seconds old. The purchase must use the current value. |
| "Not found" results (negative caching) | 30–60 seconds | This time is long enough to stop abuse. It is short enough to show new data quickly. |
| Sessions, auth tokens | The same as the session lifetime | Here the cache **is** the data store. The cache must not evict sessions, because eviction logs users out. |

### 6.1. Add jitter

**Always add jitter to TTLs.** Use this formula: `ttl = base × (0.9 + 0.2 × random())`. Jitter spreads the expiry times of keys. Without jitter, keys that you write at the same time also expire at the same time. This occurs after a deploy or a cache warm-up (refer to "avalanche" in section 7).

### 6.2. Use a soft TTL and a hard TTL

Put a "refresh after" time in the value. Make this soft TTL shorter than the real (hard) TTL. After the soft TTL, one request refreshes the value in the background. All other requests continue to get the stale value. This is the HTTP `stale-while-revalidate` method, applied to your application cache.

## 7. Failure modes

Interviewers ask about this section more than about other sections.

| Problem | What occurs | Solutions |
| --- | --- | --- |
| **Stampede** (thundering herd, dog-piling) | A hot key expires. Thousands of requests miss the cache at the same time. All of them query the database for the same value. | **Single-flight (request coalescing)**: one loader for each key in each process. A distributed lock or a lease. A soft TTL with a refresh in the background. **Probabilistic early expiration.** |
| **Penetration** | Requests for keys that **do not exist** always miss the cache. Bugs or enumeration attacks cause this (for example, `GET /user/random-id`). | **Negative caching**: cache "not found" for a short time. A **Bloom filter** of valid IDs, which the system checks before the database. Input validation. Rate limits. |
| **Avalanche** | Many keys expire at the same time. Or the cache cluster restarts with no data. The database then gets the full read load. | **TTL jitter.** Warm the cache before it gets traffic. Restart cache nodes one at a time. A **circuit breaker and load shedding** on the database path. |
| **Hot key** | One key (the profile of a celebrity, a viral post) gets more traffic than one cache shard can serve. | An **L1 in-process cache** with a short TTL. **Key replication** (`post:42#1..N`, and read a random copy). Send the content to the CDN. |
| **Big key** | A value of many MB (a very large list or hash) stops the single-threaded Redis while Redis reads, serializes, or deletes it. | Divide the value into smaller keys, or use pages. Delete large keys with `UNLINK` (asynchronous delete). |
| **Cache outage** | The cache is not available. All reads go to the database. | Before an outage occurs, find out if the database can accept the full load. If it cannot, the cache is **critical infrastructure**. Replicate the cache. Add a circuit breaker. Shed load, so that the database does not also stop. |

### 7.1. Single-flight (request coalescing)

```ts
const inFlight = new Map<string, Promise<unknown>>();

function singleFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = inFlight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().finally(() => inFlight.delete(key));   // success or failure: the next miss loads again
    inFlight.set(key, p);
  }
  return p;                                           // all callers at the same time share one database query
}
```

This code removes duplicate loads **in one process**. With 200 app servers, a stampede of 50,000 requests becomes a maximum of 200 queries. To get only one loader in the full system, use a lock or a lease in the cache (`SET lock:key NX PX 5000`). The other callers wait for a short time, or they get the stale value.

### 7.2. Probabilistic early expiration (XFetch)

Each reader refreshes the value early, with a probability that increases near the expiry time. Thus, one request refreshes the value before it expires. Not all requests refresh it at the same time.

```
recompute if   now − delta · beta · ln(random())  ≥  expiry
```

In this formula, `delta` is the duration of the last refresh. `beta` (approximately 1) controls how early the refresh occurs. The source is the paper "Optimal Probabilistic Cache Stampede Prevention" (Vattani and others, 2015).

## 8. The distributed cache

| | **Redis** | **Memcached** |
| --- | --- | --- |
| Data types | Strings, hashes, lists, sets, sorted sets, streams, HyperLogLog, bitmaps | Strings (blobs) only |
| Threads | One thread runs the commands (I/O threads are optional) | Many threads |
| Persistence | Optional: RDB snapshots, AOF log | None |
| Replication and failover | Included (replicas, Sentinel, Redis Cluster) | None (sharding by the client only) |
| Atomic operations | `INCR`, Lua scripts, transactions | `incr`, `cas` |
| Select it when | You need data structures (leaderboards, rate limiters, counters, queues), persistence, or failover. | You need only simple object caching at very high throughput. |

### 8.1. Sharding

There are two usual methods:

- **Consistent hashing in the client** (Memcached). When you add a node, only approximately 1/N of the keys move to a different node.
- **Redis Cluster.** Redis Cluster divides the keyspace into 16,384 hash slots. It puts these slots on a set of primary nodes. A multi-key operation is possible only when all keys are in the same slot. Use `{hash tags}` in the key names to put keys in the same slot.

### 8.2. Replication

> **CAUTION:** Redis replication is **asynchronous**. A primary node can accept a write and then fail before it sends the write to a replica. Thus, a failover can lose recent writes.

This is acceptable for a cache. Remember it before you use Redis as a primary data store (for sessions, locks, or counters).

### 8.3. Example: calculate the cache size

1. Find the hot set: 50 million users, a 2 KB serialized profile, and approximately 20% of users active each day. The hot set is approximately 10 million × 2 KB = **20 GB**.
2. Add the overhead: approximately 50–100 bytes for each key, plus space for fragmentation and growth. The plan is **approximately 35–40 GB**.
3. Select the nodes: with 16 GB nodes, use 3 shards. Add one replica to each shard for failover. The total is **6 nodes**.

Usually, throughput is not the first limit. One Redis node can do approximately 100,000 simple operations per second.

## 9. What to cache, and how to name the keys

| Granularity | Example | Advantages | Disadvantages |
| --- | --- | --- | --- |
| **Object or row** | `user:42` | You can use it again in many places. Invalidation is easy (one key for each entity). | A page can need many lookups. Use `MGET` or pipelines. |
| **Query result** | `search:shoes:page2` | One lookup for each request | Invalidation is difficult. It is not easy to find which queries contain user 42. Use a TTL. |
| **Computed value or aggregate** | `post:42:like_count`, a precomputed feed | The system does not do the expensive work again. | The system must calculate or update the value again on writes. |
| **Fragment or full page** | Rendered HTML, a full API response | The fastest option | Personal content decreases reuse. Invalidation is difficult. |

### 9.1. Rules for key design

- **Put a namespace and a version in the key:** `user:v3:42`. When the schema changes, change `v3` to `v4`. This invalidates all old keys immediately, with no flush. The old keys expire later.
- **Put in the key each input that changes the value.** Examples are tenant, locale, user (for personal data), and feature-flag variant.
- **Keep the keys short, but easy to read.** At billions of keys, the bytes of the keys become a large quantity.
- **Serialize the values in a compact format.** For large objects, use MessagePack or protobuf, not long JSON. Compress values that are larger than some KB.

> **WARNING:** If the key does not include each input that changes the value, the cache can send the data of one user to a different user. This is a security problem, not only a correctness problem.

## 10. Example: the cache for a URL shortener

### 10.1. The numbers

- 100 million new URLs each month. The read-to-write ratio is 100:1.
- Writes: approximately 40 per second.
- Redirects: approximately 4,000 per second on average, and approximately 12,000 per second at peak.
- The access pattern is not equal. Recent links and viral links get most of the traffic.

### 10.2. The design

1. **Use cache-aside on `short:{code}` → long URL** in Redis.
   - The link record (short code → long URL) never changes after the system creates it. Thus, there are no invalidation race conditions, and a long TTL (days) with jitter is safe.
   - Also write the link record to the cache when the system creates it (write-through). Users click new links immediately.
2. **Cache unknown codes** for 60 seconds (negative caching). Add a **Bloom filter** of known codes. This stops enumeration attacks before they get to the database.
3. **Protect against hot links.** Put an in-process L1 LRU cache with some thousand entries in front of Redis. This cache stops viral links before they overload one Redis shard.
4. **Set the eviction policy** to `allkeys-lru` or `allkeys-lfu`, and set a memory limit. The system can load each key again from the database. Refer to [Cache Eviction](./09_Cache%20Eviction.md).
5. **Select the redirect type.** Browsers and CDNs cache a `301` (permanent) redirect. Then you cannot count the clicks. To count clicks, use a `302` with a short `Cache-Control`, or with no caching. Refer to [CDN](./10_CDN.md).
6. **Make a plan for a cache failure.** At a 99% hit ratio, the database gets approximately 120 reads per second at peak. If the cache stops, the database gets 12,000 reads per second. Make the database large enough for this load. Or, make the redirect service shed load until the cache is available again. The service can continue to serve the hottest links from L1.

**A sentence to use in the interview:** *"The link record does not change, so I can cache it for a long time with no invalidation problems. The dangers are hot keys and a cache failure. I use an L1 cache and load shedding for these dangers."*

## 11. Interview questions (with short answers)

**Q: What is the difference between cache-aside and write-through?**
Cache-aside loads data into the cache on a read miss. On a write, it deletes the key. It is simple, it caches only data that the system reads, and it continues to operate when the cache stops. Write-through updates the cache on each write. Reads immediately after writes are fresh. But writes become slower, and the cache can hold data that no user reads. Many systems use cache-aside, plus write-through for some keys that need fresh reads after writes.

**Q: Why do you delete the key on an update, and not set the new value?**
Writers that operate at the same time can set the cache in a different order from their database commits. Then an old value can stay in the cache for a long time. A delete is idempotent. After the delete, the next read loads the last committed value.

**Q: How do you keep the cache consistent with the database?**
Full consistency is not possible without one transaction for both copies. Put a limit on the stale time:

- Delete the key on each write.
- Set a TTL on all keys.
- Use CDC or an outbox to send invalidations, so that a failed delete is never lost.
- Use leases or versioned writes to close the stale-fill race.
- Read critical data from the source of truth.

**Q: What is a cache stampede? How do you prevent it?**
A stampede occurs when many requests miss the cache for one hot key at the same time. All of them then go to the database. To prevent it, use request coalescing (single-flight), or a lock or lease so that only one caller loads the value. You can also refresh the value in the background before it expires, or use probabilistic early expiration.

**Q: How do you handle a hot key?**
Put an in-process cache in front of the shared cache. Or, replicate the key on many shards and read a random copy. Or, send the content to the CDN. Also, monitor the system to find hot keys.

**Q: When is write-behind acceptable?**
Write-behind is acceptable when the loss of the last few seconds of writes is acceptable, and when write throughput is important. Examples are counters, likes, metrics, and rate-limit state. Do not use it for orders, payments, or data that you cannot calculate again.

**Q: What occurs when the cache cluster stops?**
All reads go to the database. If the database cannot accept this load, you need cache replication and failover, a circuit breaker, load shedding, and a slow warm-up after recovery. Thus, the availability of the cache is a part of the availability of the system.

## 12. Usual mistakes

- To add a cache, but not to give the hit ratio, the TTL, or the invalidation strategy.
- To update the cache on writes (not to delete the key), or to forget the TTL safety net.
- To cache personal responses with a key that does not include the user.
- To think that the cache is always available. The database load during a cache outage is a part of the design.
- To use the same TTL for all keys, with no jitter.
- To cache money or inventory checks. For example, to read a cached balance before a debit.
- To use write-behind for data that you cannot lose.
- To use Redis as a durable database, and not to tell about asynchronous replication and persistence settings.
