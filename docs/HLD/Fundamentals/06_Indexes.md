---
sidebar_position: 6
---

# Indexes

> **Why this matters in interviews:** indexes are how a data model turns into fast queries, so they come up in data modeling ("what indexes does this table need?"), deep dives ("the feed query is slow at 1B rows, why?"), and storage-engine questions ("why is Cassandra good at writes?"). Interviewers check that you can derive indexes **from access patterns**, explain the **read vs write cost**, pick the right **index type** (B-tree, LSM, hash, inverted, geospatial), and reason about **secondary indexes in a sharded database**, which is where most candidates go quiet.

Blueprint components this feeds: **4 (data modeling)**, **6 (database selection)**, **8 (scalability)** and **13 (performance)** in the [HLD Blueprint](./00_HLD%20Blueprint.md). Related: [SQL vs NoSQL](./05_SQL%20vs%20NoSQL.md) · [ACID vs BASE](./07_ACID%20vs%20BASE.md). For SQL syntax, `EXPLAIN` output and Postgres-specific index types, see [Database → Indexing](../../Database/Indexing.md) and [Query Optimization](../../Database/Query%20Optimization.md).

---

## 1. What an index is

An index is a **separate, sorted (or hashed) data structure** that maps values of some column(s) to the location of the matching rows. It trades **extra storage and slower writes** for **much faster reads**.

| Without an index | With an index |
| --- | --- |
| Full scan: read every row, O(n) | Tree lookup: O(log n) to find the first match, then read only matches |
| 1B rows × ~200 B = ~200 GB scanned | 3–4 page reads to find the row |
| Seconds to minutes | Sub-millisecond if the pages are cached, a few ms from SSD |

**Why only 3–4 levels:** a B-tree page is typically 8–16 KB, so one internal page holds hundreds of keys (fan-out ~100–500). With fan-out 500, three levels address 125 million rows and four levels address over 60 billion. The top levels are almost always in memory, so a lookup costs ~1 disk read.

**The cost side:**
- **Every write updates every index** on the table. Five indexes means roughly six writes per insert (more with page splits).
- **Storage:** each index is a partial copy of the table; indexes can rival the table in size.
- **Memory pressure:** indexes compete with data for the buffer cache. An index that doesn't fit in RAM is much slower.

So the rule: **index for the queries you actually run, and no more.**

## 2. Index structures (know when each one wins)

### a) B-tree / B+tree: the default in relational databases

Sorted, balanced tree. Leaves hold keys in order (linked to their neighbours in a B+tree), so it supports:
- equality (`=`), **range** (`<`, `>`, `BETWEEN`), **prefix** (`LIKE 'abc%'`), **ORDER BY** and **MIN/MAX** without sorting.

It updates **in place**, which means random writes, page splits and fragmentation. Used by Postgres, MySQL InnoDB, Oracle, SQL Server, MongoDB (WiredTiger), and most others.

### b) LSM-tree: write-optimized storage

```text
write → WAL (durability) + memtable (sorted, in memory)
        memtable full → flushed as an immutable sorted file (SSTable) on disk
        background compaction merges SSTables, discarding overwritten and deleted (tombstoned) values
read  → memtable → newest SSTable → ... → oldest  (Bloom filters skip files that can't contain the key)
```

- **Writes are sequential appends**, so write throughput is very high. That's why Cassandra, ScyllaDB, HBase, Bigtable, RocksDB and LevelDB use it.
- **Reads may check several files** (read amplification), mitigated by Bloom filters, block caches and compaction.
- **Compaction** costs background I/O (write amplification) and can cause latency spikes. *Size-tiered* compaction favours writes; *leveled* compaction favours reads and space.
- **Deletes are writes** (tombstones). Workloads with many deletes (queues stored in Cassandra) suffer until compaction catches up: a classic anti-pattern.

| | B-tree | LSM-tree |
| --- | --- | --- |
| Write throughput | Good (random I/O) | **Excellent** (sequential I/O) |
| Point read | **Excellent** (one tree walk) | Good (Bloom filters, multiple levels) |
| Range scan | **Excellent** | Good (merge across files) |
| Space | Fragmentation (pages partly empty) | Better compression, temporary duplicates until compaction |
| Predictability | Steady | Compaction can cause latency spikes |
| Typical systems | Postgres, MySQL, Oracle, MongoDB | Cassandra, ScyllaDB, HBase, RocksDB, Bigtable |

**Interview line:** *"This workload is append-heavy at 500K writes/s with reads of the latest N items per key, which suits an LSM-based wide-column store. A B-tree store would be limited by random write I/O."*

### c) Hash index

`hash(key) → bucket`. O(1) **equality only**: no ranges, no ordering, no prefix. Used in in-memory stores (Redis's main dictionary, Memcached), Bitcask-style stores (an in-memory hash map pointing into an append-only log), and Postgres `HASH` indexes (rarely chosen over B-tree in practice).

### d) Inverted index: full-text search

`term → list of document IDs (postings)`, plus positions and frequencies for phrase matching and ranking (BM25). That's Elasticsearch/OpenSearch/Lucene and Postgres `GIN` with `tsvector`. A B-tree can't serve `LIKE '%word%'`; an inverted index can.

Tokenization, stemming, stop words and n-grams (for autocomplete or fuzzy search) are decided **at index time**, so changing them means reindexing.

### e) Geospatial indexes: "find drivers within 2 km"

A B-tree on `(lat, lng)` can only narrow by one dimension at a time. Spatial indexes map 2D to something indexable:

| Technique | Idea | Used by |
| --- | --- | --- |
| **Geohash** | Interleave lat/lng bits into a string. A shared prefix means nearby, so a B-tree prefix scan works. Query the cell plus its 8 neighbours to handle edges. | Redis `GEO*` commands, many custom designs |
| **Quadtree** | Recursively split a region into 4 until each cell has ≤ N points. Adapts to density (more cells downtown). | In-memory location services |
| **S2 / H3** | Hierarchical cells on a sphere (S2: squares from a cube projection, Google; H3: hexagons, Uber). Cell IDs are integers, so they index and shard well. | Google, Uber, many ride-hailing and delivery systems |
| **R-tree** | Tree of bounding rectangles; handles shapes, not just points | PostGIS (`GiST`), spatial databases |

See [Design Uber](../05_Design_Uber.md) for a full application.

### f) Others worth naming

| Index | What it's for |
| --- | --- |
| **Bitmap index** | Low-cardinality columns in analytics (`country`, `status`): one bitmap per value, combined with AND/OR very fast. Common in OLAP engines and Druid. |
| **Columnar min/max (zone maps)** | Columnar stores keep min/max per block and skip blocks that can't match. That's how BigQuery, ClickHouse and Parquet prune scans. |
| **Bloom filter** | Probabilistic "definitely not present / maybe present". Not an index by itself, but it saves disk reads in LSM stores and network calls in distributed caches. |
| **Vector index (ANN)** | Approximate nearest neighbour for embeddings (HNSW, IVF): semantic search, recommendations, RAG. pgvector, FAISS, dedicated vector databases. |
| **Trie / FST** | Prefix lookup for autocomplete (Lucene uses finite state transducers for its term dictionary). |

## 3. Designing indexes from access patterns

The process interviewers want to see:

1. **List the queries** and their frequency and latency targets (from [Blueprint §4](./00_HLD%20Blueprint.md#4-data-modeling)).
2. For each hot query, design the index that serves it **without a sort or a scan**.
3. Merge overlapping indexes (one composite index can serve several queries via its prefix).
4. Check the **write cost**: how many indexes does each insert or update touch, at the estimated write QPS?
5. Drop indexes nobody uses.

### Composite indexes: column order is everything

An index on `(a, b, c)` is sorted by `a`, then `b` within each `a`, then `c`. It can serve:

| Query | Uses the index? |
| --- | --- |
| `WHERE a = ?` | ✅ (leftmost prefix) |
| `WHERE a = ? AND b = ?` | ✅ |
| `WHERE a = ? AND b > ? ORDER BY b` | ✅ (range on the last used column) |
| `WHERE a = ? ORDER BY b DESC LIMIT 20` | ✅ No sort: walk the index backwards and stop after 20 |
| `WHERE b = ?` | ❌ (no leftmost column; at best a full index scan) |
| `WHERE a > ? AND b = ?` | Partly: the range on `a` stops `b` being used for seeking |

**Rule of thumb (MongoDB calls it ESR): Equality columns first, then Sort columns, then Range columns.**

Example: "a user's orders with a given status, newest first":

```sql
-- query
SELECT order_id, total_cents FROM orders
WHERE user_id = ? AND status = 'SHIPPED'
ORDER BY created_at DESC LIMIT 20;

-- index: equality (user_id, status), then sort (created_at)
CREATE INDEX ON orders (user_id, status, created_at DESC);
-- add INCLUDE (total_cents) in Postgres to make it covering (index-only scan, no table lookup)
```

### Selectivity and cardinality

- An index helps when it narrows results to a **small fraction** of rows. On a boolean column where 50% of rows match, the optimizer will (correctly) prefer a full scan.
- **Low-cardinality columns** belong *after* high-cardinality ones in a composite index, or in a **partial index** (`WHERE status = 'PENDING'` when pending orders are 0.1% of the table).
- Skew matters: an index on `country` is great for `'IS'` and useless for `'US'`.

### Covering indexes and clustered tables

- **Covering index:** contains every column the query needs, so the database never touches the table (an "index-only scan"). It's one of the biggest wins for hot read paths.
- **Clustered index:** the table itself is stored in index order. MySQL InnoDB clusters by primary key, and secondary indexes store the **primary key** (not a row pointer), so a secondary lookup is two tree walks. Postgres stores tables as unordered heaps.
- **Primary key choice matters in clustered tables:** random UUIDv4 keys insert all over the tree, causing page splits, fragmentation and poor cache locality. Time-ordered IDs (Snowflake, ULID, UUIDv7) insert at the right edge. This is a common follow-up when you propose UUIDs.

### Pagination needs the right index

`OFFSET 100000 LIMIT 20` still walks 100,020 index entries. **Keyset (cursor) pagination** uses the index to seek directly:

```sql
SELECT ... FROM posts
WHERE user_id = ? AND (created_at, post_id) < (?, ?)      -- the cursor from the last page
ORDER BY created_at DESC, post_id DESC
LIMIT 20;
-- index: (user_id, created_at DESC, post_id DESC)
```

The tie-breaker (`post_id`) makes the order unique, so no row is skipped or repeated. That's why API designs return an opaque `next_cursor` instead of a page number.

## 4. Indexes in distributed (sharded) databases

This is the FAANG-level part. Once data is partitioned by a key, an index on any **other** column has to be partitioned somehow too, and there are two choices:

| | **Local** (document-partitioned) secondary index | **Global** (term-partitioned) secondary index |
| --- | --- | --- |
| Where index entries live | On the same shard as the rows they point to | Partitioned by the **indexed value**, independent of where the rows are |
| Write | Cheap: one shard, same transaction | Expensive: the row and its index entry may be on **different shards** → a distributed write, usually **asynchronous** |
| Read by indexed value | **Scatter-gather**: ask every shard, merge results (tail latency = the slowest shard) | One shard (or a few) |
| Consistency | Consistent with the row | Often **eventually consistent** (lags the base table) |
| Examples | Cassandra secondary indexes and SAI, MongoDB indexes on sharded collections, DynamoDB **LSI** (same partition key) | DynamoDB **GSI**, Elasticsearch-as-an-index, a hand-built lookup table |

**Example:** users are sharded by `user_id`, and login needs "find user by email".
- A local index means every login queries every shard. Fine for 4 shards, terrible for 400.
- A global index (a separate `email → user_id` table, sharded by email) makes login a single-shard lookup, but signup writes to two shards. Uniqueness of email needs a conditional write on the email shard **first** (claim the email), then the user row, with cleanup if the second step fails.

**Interview line:** *"I'll shard by `user_id` because every hot query includes it. For the one query by email I'll keep a separate `email → user_id` lookup table sharded by email, rather than scatter-gather across all shards."*

### Hand-built indexes and derived stores

At scale, many "indexes" are separate systems kept in sync with the source of truth by events or CDC:
- a **search index** (Elasticsearch) for text and facets,
- a **reverse mapping table** (`followee_id → follower_ids`) next to the forward one,
- a **precomputed view** (the user's feed timeline) that is effectively an index materialized per user.

They're eventually consistent, so the design must say what happens when they lag (show slightly stale results, or read through to the primary for the user's own writes).

## 5. Operating indexes

- **Adding an index to a big, live table** can lock writes or take hours. Use online builds: Postgres `CREATE INDEX CONCURRENTLY`, MySQL online DDL or tools like gh-ost; on NoSQL, adding a GSI backfills in the background (and consumes capacity).
- **Unused and duplicate indexes** cost writes for nothing. Postgres `pg_stat_user_indexes` shows usage; drop what isn't used.
- **Bloat:** updated or deleted entries leave dead space (B-tree) or tombstones (LSM). Vacuum, reindex or compaction reclaims it.
- **Hot spots:** an index on a monotonically increasing value (timestamp, auto-increment) concentrates all inserts on the last page in a single-node B-tree (usually fine), but on **one shard** in a range-partitioned distributed store (a real problem). Hash-prefix the key or use hash partitioning.
- **Watch query plans after data grows.** An index that was chosen at 10K rows may be ignored at 100M because statistics or selectivity changed.

## 6. Worked example: indexing a photo-sharing app

| Access pattern | Frequency | Index |
| --- | --- | --- |
| Get photo by ID | Very hot | Primary key `photo_id` (time-ordered ID) |
| A user's photos, newest first, paginated | Hot | `(owner_id, created_at DESC, photo_id DESC)`, keyset pagination |
| Who follows user X (fan-out on write) | Hot | `follows` reverse index `(followee_id, follower_id)` |
| Does A follow B? | Hot | Primary key `(follower_id, followee_id)` |
| Search captions and hashtags | Medium | Elasticsearch inverted index, fed via CDC |
| Photos near a location | Low | Geohash or S2 cell ID column with a B-tree index |
| Admin: photos reported in the last day | Rare | Partial index `WHERE reported = true`, or just a scan on a replica |

Then check the write side: each photo insert touches the PK, the owner index and (async) the search index. At an estimated 1,000 uploads/s peak, that's comfortable for one sharded relational cluster.

## 7. Interview questions (with crisp answers)

**Q: Why not index every column?**
Each index slows every write, takes storage, and competes for cache memory. The optimizer can usually use only one or two per query anyway. Index for the hot queries.

**Q: B-tree vs LSM-tree?**
B-tree updates in place, which is great for reads and range scans with steady latency. LSM appends and compacts later, which is great for write throughput at the cost of read amplification and compaction spikes.

**Q: Why is my composite index not being used?**
The query doesn't constrain the leftmost column, a range on an earlier column stops later columns being used, a function or type cast is applied to the indexed column, or the predicate isn't selective enough, so a scan is cheaper.

**Q: How do secondary indexes work in a sharded database?**
Either local (each shard indexes its own rows; reads scatter to all shards) or global (the index is partitioned by the indexed value; reads hit one shard but writes are cross-shard and usually async).

**Q: How would you index for "nearby drivers"?**
Convert locations to geospatial cell IDs (geohash, S2 or H3), index or shard by the cell, and query the target cell plus its neighbours, then filter by exact distance.

**Q: How do you add an index to a 2 TB production table?**
An online/concurrent build, during low traffic, monitoring replication lag and I/O. Verify it's used with `EXPLAIN` before relying on it, and keep a rollback plan (drop it).

**Q: Why are random UUIDs bad primary keys?**
In B-tree (especially clustered) indexes they scatter inserts across the tree: page splits, fragmentation, poor cache hit rates. Time-ordered IDs (UUIDv7, ULID, Snowflake) keep inserts at the end.

## 8. Common mistakes

- Designing indexes before listing the access patterns.
- Wrong composite column order (range or sort column before an equality column).
- `OFFSET` pagination on large tables.
- Indexing low-cardinality columns on their own.
- Forgetting that a query by a non-shard-key column becomes scatter-gather.
- Assuming a global secondary index is consistent with the base table.
- Using the database for full-text `LIKE '%term%'` search at scale instead of an inverted index.
- Adding indexes on a big table without an online build.
