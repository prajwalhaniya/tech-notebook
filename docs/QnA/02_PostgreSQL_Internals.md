---
sidebar_position: 2
---

# PostgreSQL & Database Internals: Q&A

Nineteen questions on what actually happens under a `SELECT`, a `COMMIT`, or a crash — MVCC, WAL, B-tree indexes, replication, and what it takes to scale a database past what one machine can hold. This notebook already has deep, code-level coverage of most of these in [Transactions & ACID](../Database/Transactions%20&%20ACID.md), [Connection Pools & PostgreSQL Internals](../Database/Connection%20Pools.md), [Query Optimization](../Database/Query%20Optimization.md), [Indexing](../Database/Indexing.md), and [Replication & Scaling](../Database/Replication%20&%20Scaling.md) — this page is the shorter, interview-answer version, with pointers into those for the full depth.

---

## How does PostgreSQL internally execute a SELECT query?

A query passes through four stages before a single row comes back:

1. **Parse.** The parser checks the SQL's syntax and builds a parse tree — at this point it knows the query is grammatically valid, nothing more.
2. **Rewrite.** The rule system expands anything that isn't a plain table reference — a view referenced in the query is substituted with its defining query, for instance — so the planner only ever has to deal with base tables.
3. **Plan/Optimize.** The planner enumerates candidate execution strategies — sequential scan vs. index scan vs. index-only scan vs. bitmap scan, and for joins, which order and which algorithm (nested loop, hash join, merge join) — and estimates a cost for each, using statistics gathered by `ANALYZE` (row counts, distinct-value counts, most-common-value histograms). It picks the cheapest plan it can find, not necessarily the actual cheapest one — this is an estimate, which is exactly why stale statistics can lead it astray (see the index-selection question below).
4. **Execute.** The executor walks the chosen plan tree and pulls rows through it — each node (a scan, a join, a sort) calls down into its child node for the next row, rather than materializing every intermediate result in full first, so a `SELECT ... LIMIT 10` can often stop pulling rows the instant it has 10, without finishing the whole scan underneath it.

Underneath step 4, every row touched is checked against MVCC visibility rules (the next question) as it's read, and pages are fetched through the buffer manager — a cache hit means reading from `shared_buffers`, a miss means a real disk read. See [Query Optimization: How the Query Optimizer Works](../Database/Query%20Optimization.md#how-the-query-optimizer-works---deep-dive) for the full cost-estimation walkthrough.

## What happens internally when you execute COMMIT?

1. PostgreSQL writes a **commit WAL record** — a note in the write-ahead log saying "transaction N is committed."
2. Unless `synchronous_commit` is turned off, it **flushes the WAL up to and including that record to disk** (fsync) before telling the client the commit succeeded. This flush — not writing the actual changed data pages — is the expensive, durability-critical step.
3. The transaction's status is marked committed in the commit log (`pg_xact`/CLOG), which is what other transactions' visibility checks consult.
4. Locks the transaction was holding are released.
5. The actual heap and index pages the transaction modified are **not necessarily on disk yet** — they can still sit as dirty pages in `shared_buffers`, to be written out later by the background writer or the next checkpoint. The client's guarantee doesn't depend on the data file being durable yet; it depends on the WAL record being durable, because that WAL record is enough to reconstruct the change during crash recovery if the data page is lost (see the crash-recovery question below).

## How does MVCC work?

Instead of overwriting a row in place, PostgreSQL keeps **multiple versions of a row** side by side, each tagged with the transaction IDs that created and (if applicable) deleted it — two hidden columns, `xmin` and `xmax`. An `UPDATE` doesn't modify the row; it marks the old version's `xmax` as the updating transaction, and inserts a brand-new row version with that transaction as its `xmin`.

Concretely: transaction 100 inserts a row (`xmin=100, xmax=0`). Transaction 200 later updates it — the original row becomes `xmin=100, xmax=200`, and a new version appears as `xmin=200, xmax=0`. A third transaction that started *before* 200 committed still sees the old version (its `xmax=200` isn't committed yet, from that reader's point of view) — a transaction that starts *after* 200 commits sees the new one instead, and the old version becomes dead, destined for cleanup by `VACUUM`.

The payoff: **readers never block writers, and writers never block readers** — each is simply looking at the row version appropriate to its own snapshot, so there's no need for a reader to wait on a writer's lock the way there would be in a single-version, lock-everything model. The cost: old row versions accumulate as dead tuples until `VACUUM` reclaims them, which is why an un-vacuumed, high-churn table bloats. Full walkthrough with worked transaction IDs: [Connection Pools: MVCC Under the Hood](../Database/Connection%20Pools.md#under-the-hood-how-mvcc-works-with-transaction-ids).

## What are the different transaction isolation levels?

- **Read Uncommitted** — allows dirty reads in the SQL standard; PostgreSQL doesn't actually implement a distinct version of this and treats it identically to Read Committed.
- **Read Committed** (PostgreSQL's default) — each individual *statement* takes a fresh snapshot of the database as of when that statement starts. Two statements inside the same transaction can see different data if another transaction committed in between — no dirty reads, but non-repeatable reads and phantoms are both possible.
- **Repeatable Read** (MySQL InnoDB's default) — the whole *transaction* takes one snapshot at its start, and every statement in it sees that same snapshot throughout. This prevents non-repeatable reads, and PostgreSQL's MVCC implementation happens to prevent the classic phantom-read case too — but concurrent transactions can still produce a **write skew** anomaly (two transactions each read overlapping data, each make a decision based on what they read, and both commit changes that are individually valid but jointly violate an invariant neither transaction could see the other breaking).
- **Serializable** — PostgreSQL implements this as **Serializable Snapshot Isolation (SSI)**: transactions run as Repeatable Read under the hood, but the system actively tracks dependencies between concurrent transactions and aborts one of them at commit time if it detects a pattern that could only happen because they weren't truly serialized — catching exactly the write-skew case Repeatable Read misses.

See [Transactions & ACID: Isolation Levels](../Database/Transactions%20&%20ACID.md#isolation-levels-and-what-they-prevent) for the anomaly-by-anomaly breakdown.

## What is a phantom read?

A phantom read is when a transaction re-runs the **same range query** twice and gets a different *set* of rows the second time — not because an existing row's value changed, but because a new row that matches the query's condition was inserted (or an existing matching row was deleted) by another transaction that committed in between.

Concretely: transaction A runs `SELECT COUNT(*) FROM orders WHERE status = 'pending'` and gets 42. Before A runs the same query again, transaction B inserts a new pending order and commits. A re-runs the identical query and gets 43 — a row appeared out of nowhere from A's point of view, even though A never touched the `orders` table itself. This is distinct from a **non-repeatable read**, which is about a row A already saw changing value on a second look, not a new row showing up. Repeatable Read (in the standard's definition) is specifically the isolation level named for *not* preventing this; Serializable does prevent it.

## What causes a deadlock?

A deadlock is a **cycle of transactions each waiting on a lock the next one in the cycle holds**, with no way for any of them to make progress. The simplest case, with two transactions: A holds a lock on row 1 and wants row 2; B holds a lock on row 2 and wants row 1. Neither will release what it holds until it gets what it's waiting for, and neither ever will.

This happens in practice almost always from **inconsistent lock ordering**: two code paths that update the same two rows, but in opposite order. If every transaction always locks, say, the lower ID first, the cycle above can never form — one of them would always be waiting on a row the other hasn't touched yet, instead of both already holding half of what the other needs.

## How does PostgreSQL detect deadlocks?

PostgreSQL doesn't try to prevent deadlocks up front — it **detects them reactively**. When a backend blocks waiting to acquire a lock, it waits up to `deadlock_timeout` (1 second by default) before doing anything expensive about it. If the lock still hasn't been granted after that timeout, PostgreSQL builds a **wait-for graph** — which backend is waiting on which other backend's lock — and checks it for a cycle.

If a cycle exists, PostgreSQL picks one of the transactions in it (typically the one whose wait triggered the check) and **aborts it**, returning error code `40P01` ("deadlock detected") and releasing its locks. The other transaction(s) in the cycle can then proceed normally. The reason this check only runs after a timeout, rather than on every single lock wait, is that building and walking that graph isn't free — in the overwhelmingly common case a lock clears within milliseconds and the expensive check never has to run at all.

## How does a B-tree index work?

A B-tree is a balanced, sorted tree: a root page points to internal pages, which point down to **leaf pages**, and the leaf pages hold the actual indexed values plus a pointer back to the matching row(s) in the table (a `ctid` — the row's physical location). Leaf pages are also linked to each other in sorted order, so once a scan reaches the right leaf, it can walk sideways across a range of values without climbing back up the tree.

A lookup — exact match or range — starts at the root and descends: at each level, the page's sorted keys tell it exactly which child pointer to follow, narrowing the search space at every step. Because each page holds many keys (high fan-out), the tree stays only a few levels deep even over billions of rows, giving `O(log n)` lookups. This shape is naturally suited to equality, ranges (`<`, `>`, `BETWEEN`), sorting, and prefix matches (`LIKE 'abc%'`) — not to full-text search or unordered exact matching on complex types, which is what GIN, GiST, and hash indexes exist for instead.

## Why can adding an index sometimes make performance worse?

Every index on a table has to be **updated on every `INSERT`, `UPDATE`, or `DELETE`** that touches its indexed column(s) — there's no such thing as a read-only index. A table with five indexes turns one logical insert into potentially six physical structure updates (the heap, plus each of the five B-trees), each its own disk I/O and WAL record. More indexes directly means more write amplification, more WAL volume (which also means slower replication and a bigger WAL archive to retain), and more disk space — indexes can rival or exceed the size of the table itself.

There's also a subtler cost: more indexes give the query planner more candidate plans to evaluate, and with imperfect cost estimates, more candidates occasionally means the planner picks a worse plan than it would have with fewer, more obviously-correct choices. An index that's rarely or never used by any query is pure overhead with zero offsetting benefit — the planner will never choose it over a cheaper option, or the table is small enough a sequential scan beats it anyway, so it just sits there taxing every write.

## How does a database decide whether to use an index?

The cost-based optimizer estimates a cost for each candidate plan using statistics `ANALYZE` has gathered — row counts, how many distinct values a column has, a histogram of common values, and how well the physical row order correlates with the index's logical order — combined with tunable cost constants (`seq_page_cost`, `random_page_cost`, per-row CPU costs).

For a query matching a small slice of a large table, an index scan wins easily: a handful of targeted page reads beats scanning everything. But for a query matching a large fraction of the table — rule of thumb, somewhere past 5-10%, though the exact crossover depends on the real cost constants — a **sequential scan can actually be cheaper**, because an index scan means one scattered, random-access read per matching row (unless it's an index-only scan), while a sequential scan reads the whole table, but entirely sequentially, which is far cheaper per byte than scattered random access. This is also exactly why **stale statistics** cause bad plans: if the table's shape has changed a lot since the last `ANALYZE`, the planner is estimating costs from numbers that no longer describe the table, and a perfectly good index can get passed over (or a bad plan chosen) purely because the row-count or selectivity estimate feeding the cost model is wrong.

## What is Write-Ahead Logging?

The rule WAL is built on: **never write a change to the actual data file until the WAL record describing that change has been durably written first.** Every change gets appended as a compact record to a sequential log file — cheap, because sequential writes are fast even on spinning disks — while the actual data pages, which are scattered across table and index files, are only flushed later, batched, by the background writer and at checkpoints.

This gives durability without paying for it on every single write: a crash after a transaction committed can always replay the WAL forward to reconstruct that change, even if the data page it touched never physically made it to disk before the crash. It's also what makes replication possible at all — see the replication question below, where a replica is really just continuously replaying the same WAL stream. `synchronous_commit` controls how strict this is: `on` fsyncs the WAL before acknowledging the client (safe, slightly slower); `off` acknowledges immediately and accepts losing the last fraction of a second of commits if the machine crashes before that WAL flush happens, trading a small, bounded durability window for throughput.

## What happens if a database crashes during a write operation?

On restart, PostgreSQL runs **crash recovery**: it reads the WAL starting from the last completed checkpoint and **replays every change whose commit record made it durably into the log**, bringing the data pages back to a state consistent with everything that was actually committed before the crash.

Anything that **never got a commit record written and flushed** — a transaction that was still in progress, or had started `COMMIT` but the crash happened before the flush completed — is simply absent after recovery, exactly as if it had never been attempted. This is the correct outcome: the client was never told that transaction succeeded, so there's no promise being broken by its disappearance. The result is strictly binary — every acknowledged write survives, every unacknowledged one doesn't, with nothing partially applied in between — which is precisely what gives Atomicity and Durability their teeth through a hard crash rather than just in the easy case.

## How does database replication work?

A primary accepts all writes and generates WAL for each one, exactly as it would for crash recovery. One or more **replicas** continuously receive that same WAL stream and **replay** it — applying the identical sequence of changes the primary made, in the identical order. A replica is, in effect, running the same replay machinery crash recovery uses, just continuously and in near-real-time instead of only once after a restart.

PostgreSQL's native **streaming replication** ships the raw WAL bytes — the replica ends up a byte-for-byte copy of the primary, which is simple and low-overhead but all-or-nothing: no filtering, no schema differences, no selective replication. **Logical replication** instead decodes the WAL into structured row-level changes (an INSERT of these exact column values into table X) and ships those, which costs more per change but allows filtering to specific tables, replicating across different schemas or major versions, and even replicating into a non-PostgreSQL system — the next question covers this split in more depth.

## What is the difference between logical and physical replication?

| | Physical replication | Logical replication |
| --- | --- | --- |
| What's shipped | Raw WAL bytes | Decoded, structured row changes (insert/update/delete + values) |
| Granularity | The entire data directory — all or nothing | Selectable — specific tables, specific publications |
| Schema requirement | Byte-identical, same major version | Can differ between publisher and subscriber |
| Overhead | Lower — just shipping a log | Higher — each change is individually decoded and applied |
| Typical use | High-availability failover, read replicas | Selective sync, cross-version/cross-database migration, zero-downtime major-version upgrades |
| Gaps | None — it's an exact copy | DDL isn't replicated automatically; sequences aren't replicated by default |

The short version: physical replication gives you an identical second copy of everything, cheaply; logical replication gives you a selective, structured feed of changes you can reshape or redirect, at a higher cost per change. Pick physical for "I need a hot standby of this exact database"; pick logical for "I need to move or mirror a slice of this data somewhere that isn't an identical copy."

## How would you identify and resolve a slow query?

**Identify**: `pg_stat_statements` for which queries, aggregated across every execution, cost the most total time (not just the one slow run someone noticed); the slow-query log for anything over a chosen threshold; and `EXPLAIN (ANALYZE, BUFFERS)` on the specific query to see the actual plan PostgreSQL chose, the actual vs. estimated row counts at each step, and how many pages came from cache versus disk.

**What that output points at**:
- A big gap between the planner's row-count estimate and the actual count usually means stale statistics — run `ANALYZE`.
- A sequential scan on a large table in the plan, where you expected an index scan, usually means a missing index, or a function/implicit type cast wrapped around the filtered column silently disabling the index that does exist.
- A query doing many small round trips instead of one — the N+1 pattern — fixed by a single JOIN or a batched fetch.
- `SELECT *` pulling columns nothing downstream reads, or a query with no `LIMIT` at all on a result set that could grow unbounded.

Full walkthrough, including reading each line of `EXPLAIN` output and the specific anti-patterns, in [Query Optimization](../Database/Query%20Optimization.md).

## How do connection pools work internally?

A pool keeps a set of already-established, already-authenticated connections open and reuses them across many "borrow, use, return" cycles, instead of opening a fresh TCP connection and re-authenticating for every request. Internally, it keeps idle connections in a ready queue; when the application asks for one, the pool hands back an idle connection if one's available, opens a new one if it's under its configured maximum and none are idle, or makes the caller wait if it's already at that maximum. The application runs its query on the borrowed connection and releases it back to the pool rather than closing it — the physical connection to PostgreSQL stays open the whole time.

This matters because opening a new PostgreSQL connection is genuinely expensive: a TCP handshake, authentication, and — because PostgreSQL uses a **process-per-connection model** — forking an entire new backend process just to serve that one connection. A pool amortizes that cost across thousands of logical requests instead of paying it per request, and it also caps how many concurrent connections the database ever has to field, protecting it from being handed more than `max_connections` (or more than its actual CPU/memory can usefully serve) at once. When even application-level pooling isn't enough — many app instances, each with its own pool — an external pooler like **PgBouncer** adds a second layer, multiplexing many client-facing connections onto a much smaller number of real PostgreSQL backend connections. Full internals, including the pool's own state machine and PostgreSQL's connection lifecycle from TCP to query, in [Connection Pools & PostgreSQL Internals](../Database/Connection%20Pools.md).

## What is database sharding?

Sharding splits one logical dataset across multiple independent database instances (shards), each holding a disjoint slice of the data, so no single instance has to store or serve the whole thing — the point past which a single primary, no matter how large the hardware, simply can't hold or serve enough of the dataset.

A **shard key** decides which shard a given row lives on:
- **Hash-based** — evenly distributes rows, but a range query (`WHERE created_at BETWEEN ...`) has to scatter across every shard.
- **Range-based** — keeps range queries efficient on one or a few shards, but a monotonically increasing key (an auto-increment ID, a timestamp) concentrates all *new* writes onto whichever shard currently owns the top of the range — a hot shard.
- **Directory-based** (a lookup table mapping key → shard) — the most flexible, rebalances easily, but the lookup service itself now has to be fast and highly available, since every request depends on it.

Sharding's three recurring hard problems — cross-shard queries, cross-shard transactions, and resharding when adding or removing shards — are covered in depth in [Replication & Scaling: Sharding](../Database/Replication%20&%20Scaling.md#sharding-horizontal-partitioning).

## How do you maintain consistency across sharded databases?

The biggest lever is choosing the shard key so that **data accessed and written together usually lives on the same shard** — sharding by `user_id`, for instance, so nearly all of one user's own transactions stay entirely within one shard and get ordinary ACID guarantees for free. That turns "cross-shard consistency" from a problem you solve into a problem you mostly avoid.

For the cases that genuinely do span shards:
- Prefer a **saga** — a sequence of local, single-shard transactions, each with an explicit compensating action — over a true distributed two-phase commit, which is blocking, fragile, and couples the availability of every participating shard together for the duration of the transaction.
- For cross-shard **reads** that need a consistent combined view (a dashboard aggregating across shards), accept eventual consistency and reconcile asynchronously — via CDC or an event stream from each shard into a read-optimized store — rather than querying every shard synchronously and hoping they all answer from the same instant.
- Accept that a cross-shard operation that partially fails needs to be **undone by its compensating action**, not rolled back the way a single-database transaction would be — the shards were never in one transaction to begin with.

## How do you perform zero-downtime database migrations?

The core technique is the **expand/contract pattern**: never take a single step that is simultaneously destructive and instant, because that's exactly the step a still-running, not-yet-redeployed instance of your application can't survive.

For something like renaming a column:
1. **Expand** — add the new column alongside the old one; deploy application code that writes to both but still reads from the old one.
2. **Backfill** — copy and transform existing rows into the new column in batches, not one giant `UPDATE` that locks and bloats the whole table.
3. **Migrate reads** — deploy application code that reads from the new column, while still writing to both as a safety net.
4. **Contract** — once confident, deploy code that only touches the new column, then drop the old one.

Each step is backward- *and* forward-compatible with the application versions immediately before and after it, which is what makes the whole sequence safe to roll out gradually — and to roll back — without the schema change and the code deploy ever needing to land in the same instant. Separately: any change that would otherwise lock the table for a long time should use its non-blocking form — `CREATE INDEX CONCURRENTLY` instead of a plain `CREATE INDEX`, for instance — even though the concurrent version is slower and can leave behind an invalid index to clean up if it fails partway, because the alternative is holding a lock that blocks every read and write on that table for the full duration. See [Scalable Schema Design: Migration Strategies](../Database/Scalable-Schema-Design.md#migration-strategies) for worked examples of harder cases (splitting a table, changing a sharding key).

## How would you handle a database receiving 100,000 writes per second?

First, recognize the scale of the problem: a single PostgreSQL primary typically sustains somewhere in the thousands to low tens-of-thousands of writes/sec for ordinary row sizes, so 100K/sec is very likely past what one machine can take no matter how it's tuned — this needs to be distributed, not just optimized.

**Reduce the cost per write before adding infrastructure**: batch writes (one multi-row `INSERT` instead of thousands of single-row ones cuts round trips and WAL overhead sharply), keep indexes to the minimum actually needed (every index is extra write cost, as covered above), and reconsider whether every write needs the strictest durability — relaxing `synchronous_commit`, or using unlogged tables, for data where losing the last fraction of a second on an actual crash is an acceptable, explicitly-chosen cost rather than a silent one.

**Then distribute the load**: shard the writes across many primaries by a key chosen so each shard only has to sustain its own slice — twenty shards each taking 5,000 writes/sec is comfortably within a single primary's range, where one primary taking all 100K/sec isn't. Separately, **decouple ingestion from the database** wherever the write doesn't need to be durable-and-queryable the instant it arrives: write to a log or queue first (Kafka), acknowledge the producer immediately, and let a pool of consumers apply those writes to the database in batches at a pace it can actually sustain — turning a bursty 100K/sec producer rate into a smoothed consumer rate on the database side. Finally, keep read traffic on replicas so it never competes with the write path for the same resources, and ask whether this data even belongs in a transactional database at all — high-volume, append-only, rarely-updated event or metric data is often a better fit for a store built around exactly that write shape (a wide-column or time-series database) than for a relational primary tuned for transactional correctness it doesn't need here.
