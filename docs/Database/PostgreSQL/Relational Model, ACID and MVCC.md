---
sidebar_position: 1
---

## PostgreSQL Internals: Understanding Relational Models, ACID, MVCC and Query Processing

Before any of PostgreSQL's features make sense — indexes, replication, query tuning — the foundation underneath them needs to be solid: what a relational database actually is, what guarantees it promises, and how it keeps those promises while many clients read and write at once. This guide covers that foundation the way PostgreSQL itself implements it, not just the textbook theory.

* * *

Relational Database Fundamentals
=================================

A relational database stores data as **relations** — what SQL calls tables. The model comes from Edgar Codd's 1970 relational algebra, and three ideas from it still shape every query you write:

- **A relation is a set of tuples.** Order isn't guaranteed unless you explicitly `ORDER BY` something. A table is conceptually unordered, even though PostgreSQL happens to store rows in a particular physical sequence on disk.
- **Every tuple in a relation has the same attributes.** A row can't have extra or missing columns — a table's shape is fixed by its schema, not by the data.
- **SQL is declarative, not procedural.** You describe *what* result you want (a relation satisfying some conditions), not *how* to compute it. The step-by-step "how" is the planner's job, covered later in this guide.

The relational operations you already use map directly onto relational algebra:

| SQL | Relational algebra | What it does |
|---|---|---|
| `SELECT` (columns) | Projection | Keeps only certain attributes |
| `WHERE` | Selection | Keeps only certain tuples |
| `JOIN` | Join / Cartesian product + selection | Combines tuples from two relations |
| `UNION`, `INTERSECT`, `EXCEPT` | Set operations | Combine or compare whole relations |

Every query you write, however complex, is built from these few operations. PostgreSQL's planner spends most of its effort deciding the *order* and *method* of applying them — not inventing new ones.

* * *

Tables, Schemas, Tuples and Constraints
========================================

**Tables** are the physical home of a relation. Internally, PostgreSQL treats a table as just one kind of **relation** — indexes, views, and sequences are relations too, which is why they all show up together in the `pg_class` catalog (more on that in the storage guide).

**Schemas** are namespaces that group tables, views, and functions. A database can hold many schemas; the default is `public`. Schemas exist to avoid name collisions (two teams can each have an `orders` table in their own schema) and to scope permissions.

**Tuples** are rows. Each tuple is a single physical record — in PostgreSQL, a tuple is literally one version of a row, which matters a great deal once MVCC enters the picture below.

**Constraints** are rules the database enforces on every write, so that invalid data can never be committed:

| Constraint | Guarantees |
|---|---|
| `NOT NULL` | A column must always have a value |
| `UNIQUE` | No two rows share the same value (or combination of values) |
| `PRIMARY KEY` | `UNIQUE` + `NOT NULL`, and identifies the row |
| `FOREIGN KEY` | A value must exist as a key in another table |
| `CHECK` | A row-level boolean expression must hold |

```sql
CREATE TABLE orders (
    id         bigint PRIMARY KEY,
    customer   bigint NOT NULL REFERENCES customers(id),
    status     text NOT NULL CHECK (status IN ('pending', 'paid', 'shipped')),
    total_cents integer NOT NULL CHECK (total_cents >= 0)
);
```

Constraints aren't just validation — they're information the query planner uses. A `NOT NULL` constraint lets the planner skip null-checking logic; a foreign key tells the planner two tables are related even without an explicit join hint.

* * *

ACID Properties
================

ACID is a promise a transaction makes about how it will behave. PostgreSQL keeps each promise with a specific mechanism — not with "effort":

**Atomicity** — a transaction either fully happens or fully doesn't. PostgreSQL implements this by tracking every change against a transaction ID, and consulting that transaction's commit status before any change is treated as real. If the transaction aborts, every row version it wrote is simply treated as if it never existed — nothing needs to be "undone" row by row.

**Consistency** — the database moves from one valid state to another. This is actually the weakest guarantee from the database's side: PostgreSQL enforces consistency only insofar as your constraints, foreign keys, and triggers define what "valid" means. The database guarantees a transaction won't violate the rules you declared; it can't guarantee your rules model the real world correctly.

**Isolation** — concurrent transactions don't see each other's half-finished work. This is where MVCC does almost all of the work, and it's substantial enough to deserve its own section below.

**Durability** — once committed, a transaction survives a crash. PostgreSQL guarantees this with the **Write-Ahead Log (WAL)**: every change is written to an append-only log *before* it's applied to the actual data files. After a crash, PostgreSQL replays the WAL to reconstruct any committed work that hadn't yet made it to the data files on disk. The storage guide in this series covers WAL's on-disk format in detail.

* * *

MVCC
====

**Multi-Version Concurrency Control** is the single mechanism PostgreSQL leans on hardest, and it changes how almost everything else behaves.

The problem MVCC solves: if a reader and a writer touch the same row at the same time, what should the reader see? Two blunt answers are to make the reader wait for the writer (readers block on writers) or make the writer wait for the reader (writers block on readers). PostgreSQL avoids both. Instead:

> **An `UPDATE` never changes a row in place. It inserts a brand-new tuple and marks the old one as superseded.**

Every tuple carries two hidden fields:

- **`xmin`** — the ID of the transaction that created this tuple version.
- **`xmax`** — the ID of the transaction that deleted or superseded this tuple version (empty if it's still the current version).

When transaction 101 updates a row, PostgreSQL doesn't erase the old tuple — it writes a new tuple with `xmin = 101`, and sets `xmax = 101` on the old one. Both versions exist on disk at the same time.

```
Before UPDATE                       After UPDATE (txn 101)

┌─────────────────────────┐         ┌─────────────────────────┐
│ xmin: 55   xmax: —       │         │ xmin: 55   xmax: 101     │  (old version, superseded)
│ status: 'pending'        │         │ status: 'pending'        │
└─────────────────────────┘         └─────────────────────────┘
                                     ┌─────────────────────────┐
                                     │ xmin: 101  xmax: —       │  (new version, current)
                                     │ status: 'paid'           │
                                     └─────────────────────────┘
```

Every transaction reads from a **snapshot** — a record of which transactions had already committed when the snapshot was taken. A row version is visible to that snapshot only if its creating transaction had committed beforehand, and its deleting transaction either hasn't run yet or hasn't committed. This is why a long-running read never blocks a concurrent write, and vice versa: they're simply looking at different tuple versions of the same logical row, and no one has to wait.

The cost of this design is that superseded tuples don't disappear on their own — they become **dead tuples**, taking up space until a background process called **`VACUUM`** reclaims them. A table that's updated heavily without being vacuumed accumulates dead tuples, a condition known as **table bloat**. This trade-off — no read/write blocking, in exchange for cleanup work — is the defining characteristic of how PostgreSQL handles concurrency.

* * *

Transactions
============

A transaction is the unit of atomicity: `BEGIN` starts one, `COMMIT` makes its changes permanent, `ROLLBACK` discards them. Every statement you run outside an explicit `BEGIN` is still a transaction — PostgreSQL just wraps it in an implicit one and commits automatically if it succeeds.

Every transaction gets a **transaction ID (XID)**, a 32-bit number assigned the first time it writes. This XID is exactly the value stamped into `xmin`/`xmax` on the tuples it touches, which is why MVCC and transaction management are really the same subsystem viewed from two angles.

What a transaction actually sees depends on its **isolation level**, because the isolation level decides *when* its snapshot is taken:

| Isolation level | Snapshot taken | What changes |
|---|---|---|
| Read Committed (PostgreSQL's default) | Fresh snapshot per **statement** | Each statement in the transaction can see new commits made by others since the last statement |
| Repeatable Read | One snapshot for the **whole transaction** | The same query run twice returns the same rows, no matter what others commit meanwhile |
| Serializable | Repeatable Read, plus conflict detection | PostgreSQL actively detects and aborts transactions whose concurrent execution couldn't be reproduced by *any* serial ordering |

This table is really just MVCC with a different snapshot policy at each level — nothing about the underlying tuple-versioning mechanism changes. Isolation level only changes *how often* a transaction is allowed to take a new look around.

Savepoints (`SAVEPOINT name` / `ROLLBACK TO name`) let you roll back part of a transaction without abandoning the whole thing — useful for retrying one failed statement inside a larger unit of work.

* * *

Query Processing Lifecycle
===========================

Every query, from `SELECT 1` to a ten-table join, passes through the same four stages:

```
┌──────────┐    ┌───────────┐    ┌────────────────┐    ┌──────────┐
│  Parser  │ -> │  Rewriter │ -> │ Planner /       │ -> │ Executor │ -> results
│          │    │           │    │ Optimizer       │    │          │
└──────────┘    └───────────┘    └────────────────┘    └──────────┘
 SQL text →       expands          chooses a plan        runs the
 parse tree       views, rules,    using table            chosen plan
                  RLS policies     statistics
```

- **Parser** — turns SQL text into a parse tree and checks it's grammatically valid. It doesn't yet know whether the tables or columns actually exist.
- **Rewriter** — resolves names against real tables and columns, and applies the rule system: a query against a view is rewritten to a query against the view's underlying tables, and row-level security policies are folded in here too.
- **Planner / Optimizer** — the step most people mean by "query optimization." It enumerates possible ways to execute the query (which index to use, which join algorithm, which join order) and picks the one with the lowest estimated cost, using statistics gathered about each table (row counts, value distributions) from `ANALYZE`.
- **Executor** — runs the chosen plan. PostgreSQL's executor is a tree of nodes where each node pulls rows from the nodes beneath it on demand, one at a time, rather than materializing every intermediate result — this is why a `LIMIT 10` query can return fast even over a huge table, if the plan allows it.

`EXPLAIN` shows you the plan the optimizer chose, and `EXPLAIN ANALYZE` runs it for real and shows you how its estimates compared to reality. Reading that output is the subject of query tuning — covered in the advanced SQL guide next in this series — but the four stages above are the pipeline every single query goes through, whether it takes a microsecond or an hour.
