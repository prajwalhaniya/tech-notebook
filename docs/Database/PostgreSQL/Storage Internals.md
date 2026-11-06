---
sidebar_position: 3
---

## PostgreSQL Storage Internals: Pages, Tuples, Buffers, WAL and Physical File Layout

Everything in the previous two guides — tuples, MVCC, transactions, query execution — ultimately has to live somewhere on disk. This guide follows a row all the way down: from a table, to a file, to a page, to the exact bytes that record it.

* * *

Page Structure
===============

Every table and index is divided into fixed-size **pages**, 8KB by default. A page is PostgreSQL's unit of I/O — it always reads and writes whole pages, never partial ones, which is what makes page-level consistency possible.

A page is organized as two arrays growing toward each other, with free space in between:

```
┌─────────────────────────────────────────────────────────┐
│ PageHeaderData (24 bytes)                                │
├─────────────────────────────────────────────────────────┤
│ Item ID 1 │ Item ID 2 │ Item ID 3 │ ...   →               │  (line pointers, grow downward)
├─────────────────────────────────────────────────────────┤
│                                                           │
│                      free space                          │
│                                                           │
├─────────────────────────────────────────────────────────┤
│ ...   ← Tuple 3 │ Tuple 2 │ Tuple 1                       │  (tuple data, grows upward)
└─────────────────────────────────────────────────────────┘
```

- The **page header** stores bookkeeping: the WAL position of the last change to this page (`pd_lsn` — the link between a page and the WAL guarantees covered later), and two pointers, `pd_lower` and `pd_upper`, marking where free space begins and ends.
- The **line pointer array** (`ItemIdData`) holds one small entry per tuple on the page: its byte offset, its length, and a status flag. This indirection is what lets PostgreSQL move a tuple around within a page, or mark it dead, without changing anything that points *to* that tuple from outside the page — other structures reference a tuple by page number + line pointer slot, not by raw byte offset.
- **Tuple data** is packed in from the opposite end. A new tuple takes the next free slot from the top of the free space downward; a new line pointer takes the next slot from the bottom upward. The page is full when the two arrays meet.

This layout is identical for heap pages and most index pages — only index page headers have one entry, `pd_special`, actually pointing to extra index-specific metadata that heap pages leave empty.

* * *

Heap Files
==========

The **heap** is PostgreSQL's name for a table's raw storage — an unordered collection of pages, as opposed to an index, which is ordered by design. Each table is backed by one or more operating-system files, split into 1GB segments so no single file grows unbounded.

Two small side-files travel with every heap table:

- The **Free Space Map (FSM)** tracks roughly how much free space is left on each page, so an `INSERT` can find a page with room without scanning the whole table.
- The **Visibility Map (VM)** tracks which pages contain *only* tuples visible to every transaction — no dead or in-progress versions. This lets both `VACUUM` and index-only scans skip those pages entirely, since there's nothing left to clean up or double-check.

Because a heap has no inherent order, "the row you inserted first" isn't guaranteed to be "the first row scanned" — a sequential scan just walks pages in whatever physical order they happen to be in.

* * *

Tuple Storage
=============

Every tuple on a heap page starts with a fixed header, `HeapTupleHeaderData`, before the actual column values:

| Field | Size | Purpose |
|---|---|---|
| `t_xmin` | 4 bytes | Transaction ID that created this version |
| `t_xmax` | 4 bytes | Transaction ID that deleted/superseded this version (0 if current) |
| `t_cid` | 4 bytes | Command ID within the creating transaction (distinguishes statements in the same transaction) |
| `t_ctid` | 6 bytes | Pointer to the newest version of this row, if it's been updated |
| `t_infomask` | 2 bytes | Status flag bits — including the "hint bits" below |
| `t_infomask2` | 2 bytes | Column count plus a few more flag bits |
| `t_hoff` | 1 byte | Offset to where the actual column data starts |

`t_xmin` and `t_xmax` are exactly the fields the MVCC guide described — this is where they physically live. `t_ctid` is what lets PostgreSQL chase an update chain: if you're holding an old version of a row, its `t_ctid` points you straight to the version that replaced it.

**Hint bits**, packed into `t_infomask`, are a performance detail worth knowing about because of a surprising side effect: the first time a transaction's commit/abort status is checked against the commit log, PostgreSQL caches the answer directly on the tuple (`HEAP_XMIN_COMMITTED`, `HEAP_XMIN_INVALID`, and the `xmax` equivalents), so future readers don't need to consult the commit log again. Setting a hint bit modifies the page — which is why the *first* `SELECT` after a large bulk load can trigger unexpected write I/O, even though a `SELECT` looks read-only.

A **null bitmap** follows the header whenever a tuple has any `NULL` columns — one bit per column, avoiding the need to store anything at all for a `NULL` value. Column data is also subject to **alignment padding**: a type like `bigint` is padded so it starts on an 8-byte boundary, which is why column order can slightly affect a table's on-disk size.

* * *

TOAST
=====

A page is 8KB, which means a single row — let alone a single column — can't be allowed to grow without bound. **TOAST** (The Oversized-Attribute Storage Technique) is what makes large values possible anyway.

Once a row's size would push past roughly 2KB (chosen so at least four tuples can fit on a page), PostgreSQL moves large variable-length columns out of line, following one of four strategies set per column:

| Strategy | Behavior |
|---|---|
| `PLAIN` | Never compressed, never moved out of line — used for fixed-size types that are never large |
| `MAIN` | Compressed in place if possible; only moved out of line as a last resort |
| `EXTENDED` | Compressed first, then moved out of line if still too large — the default for most variable-length types |
| `EXTERNAL` | Moved out of line without compression, trading space for the ability to extract a substring without decompressing the whole value |

A TOASTed value is split into chunks and stored as rows in a separate TOAST table associated with the original one, invisible in normal queries but visible in `pg_class` as `pg_toast.pg_toast_<oid>`. This is also why a `SELECT *` that touches a wide `text` or `jsonb` column can be far more expensive than it looks: it may mean extra page reads to a completely different table just to reassemble one value.

* * *

Buffer Management
===================

Disk I/O is slow enough that PostgreSQL keeps as much of the working set as possible in memory, in a region called **`shared_buffers`** — a pool of buffer slots, each exactly one page in size.

When a page is requested, PostgreSQL first checks a buffer mapping table keyed by (relation, fork, block number). On a hit, no disk access is needed at all. On a miss, a page is read from disk into a free — or freed — buffer slot.

Choosing which buffer to evict uses a **clock-sweep** algorithm, an approximation of least-recently-used that's cheap to maintain under concurrency:

- Every buffer has a small **usage count**, incremented (up to a cap) each time it's accessed.
- A "clock hand" sweeps over buffers looking for a victim. Each buffer it passes with a usage count above zero gets its count decremented and is skipped; the first buffer found with a usage count of zero is evicted.
- A buffer currently in use by a backend is **pinned**, and can't be evicted no matter its usage count, until that backend releases it.

A buffer that's been modified is marked **dirty** and must be written back to disk before it can be reused — but not immediately. Two background processes handle that: the **background writer** trickles dirty buffers out gradually during normal operation, and the **checkpointer** periodically flushes *all* dirty buffers at once, recording a checkpoint. That checkpoint is what lets crash recovery stop replaying WAL at a known-good point instead of from the beginning of time.

* * *

System Catalogs
================

PostgreSQL tracks every table, column, index, constraint, and type as rows in its own regular tables — the **system catalogs**, living in the `pg_catalog` schema. There's no separate, special-cased metadata format: a catalog table is a heap table with the exact page and tuple layout described above.

The catalogs you'll run into most often:

| Catalog | Holds |
|---|---|
| `pg_class` | One row per relation — tables, indexes, views, sequences — distinguished by `relkind` |
| `pg_attribute` | One row per column of every relation, including dropped-but-not-yet-cleaned-up columns |
| `pg_constraint` | Primary keys, foreign keys, checks, and unique constraints |
| `pg_index` | Index-specific metadata, joined to `pg_class` on `indexrelid` |
| `pg_statistic` (exposed as `pg_stats`) | The row-count and value-distribution statistics `ANALYZE` collects, which the planner reads when costing a query |

Because the catalogs are ordinary tables, you can query them with plain SQL — `SELECT * FROM pg_stats WHERE tablename = 'orders'` works exactly like querying any other table. PostgreSQL's self-hosted metadata is a direct consequence of the storage model being uniform: if everything is a heap table under the hood, the catalog might as well be too.

* * *

Physical Storage Layout
=========================

On disk, a PostgreSQL installation's data directory (`PGDATA`) is organized as:

```
PGDATA/
├── base/            one subdirectory per database, named by its OID
│   └── 16393/
│       ├── 16400           a table's heap file (named by relfilenode)
│       ├── 16400_fsm       its Free Space Map
│       ├── 16400_vm        its Visibility Map
│       └── 16401           an index file
├── global/          catalogs shared across every database (e.g. pg_database)
├── pg_wal/          Write-Ahead Log segment files, 16MB each by default
├── pg_xact/         2 bits per transaction: committed, aborted, in-progress, sub-committed
└── pg_tblspc/       symlinks to any additional tablespaces
```

A table's file is named after its **relfilenode**, not its name or OID — and the two can diverge. Operations like `TRUNCATE`, `CLUSTER`, `VACUUM FULL`, and `REINDEX` all create a fresh file and assign it a new relfilenode, while the table's identity (its OID, its name, its permissions) stays exactly the same. That's the mechanism behind why those operations can rewrite a table's physical storage entirely without anyone needing to update foreign keys or reconnect views pointing at it.

`pg_wal/` is where the durability guarantee from the ACID discussion actually lives: every change is appended to the current WAL segment *before* the corresponding data page is modified in `shared_buffers` — the "write-ahead" in Write-Ahead Log. If PostgreSQL crashes before a dirty page reaches disk, replaying the WAL from the last checkpoint reconstructs exactly the changes that were lost, and nothing more. `pg_xact/` is the on-disk record of which transactions actually committed — the ground truth that hint bits exist to cache, so that normal reads don't have to consult it over and over.
