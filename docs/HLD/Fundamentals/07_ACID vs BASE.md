---
sidebar_position: 7
---

# ACID vs BASE

> **Why this matters in interviews:** every design has data that **must never be wrong** (money, inventory, unique usernames) and data that can be **briefly stale** (like counts, feeds, view counts). Interviewers want you to sort features into those two buckets, pick the right guarantee for each, and explain the mechanisms: isolation levels and their anomalies on the ACID side, and quorums, conflict resolution and idempotency on the BASE side. Saying "strong consistency everywhere" or "eventual consistency everywhere" is a red flag.

Blueprint components this feeds: **6 (database selection)**, **9 (asynchronous processing)**, **10 (distributed systems)** and **11 (reliability)** in the [HLD Blueprint](./00_HLD%20Blueprint.md). Related: [SQL vs NoSQL](./05_SQL%20vs%20NoSQL.md) · [Indexes](./06_Indexes.md). For SQL-level examples (locking, isolation in Postgres, deadlocks), see [Database → Transactions & ACID](../../Database/Transactions%20&%20ACID.md).

---

## 1. Two philosophies

| | **ACID** | **BASE** |
| --- | --- | --- |
| Stands for | **A**tomicity, **C**onsistency, **I**solation, **D**urability | **B**asically **A**vailable, **S**oft state, **E**ventual consistency |
| Priority | Correctness of every transaction | Availability and scale, with correctness reached over time |
| Typical home | Single-node or consensus-replicated relational databases | Partitioned, replicated stores (Dynamo-style, Cassandra), caches, event-driven systems |
| On failure or partition | Refuse or block rather than be wrong | Keep answering, possibly with stale or conflicting data, then reconcile |
| Developer experience | The database protects invariants for you | The application must handle staleness, conflicts and retries |

BASE was named in the late 1990s (Brewer and colleagues, as a deliberate contrast to ACID) and popularized by eBay's Dan Pritchett in *BASE: An ACID Alternative* (2008).

**It's a spectrum, not a switch.** Modern systems mix them: DynamoDB offers strongly consistent reads and transactions; Cassandra lets you choose consistency per query; Spanner gives ACID across regions. You choose per **feature**, often per **query**.

## 2. ACID, letter by letter (what each really guarantees)

### Atomicity: all or nothing

A transaction's writes either all take effect or none do. If the process crashes halfway through a transfer, the debit without the credit is rolled back. Implemented with a **write-ahead log (WAL)** or undo log.

Atomicity is about **aborts**, not concurrency. It's what makes "retry the whole thing" safe.

### Consistency: invariants hold

Every transaction takes the database from one valid state to another: constraints (`NOT NULL`, `UNIQUE`, foreign keys, `CHECK balance >= 0`) are never violated.

Two important nuances:
- Much of "C" is really the **application's** job. The database enforces declared constraints, but "debits equal credits" holds only if your transactions are written correctly. A, I and D are the database's tools that let you achieve C.
- **ACID's C is not CAP's C.** ACID consistency means "invariants hold". CAP consistency means **linearizability** ("every read sees the latest write, as if there were one copy"). Mixing them up is a common interview slip.

### Isolation: concurrent transactions don't step on each other

Ideally (**serializable**) the result is as if transactions ran one at a time. In practice, databases default to **weaker levels** for performance, and each level allows certain anomalies. This is where interviews go deep.

### Durability: committed means saved

Once committed, data survives crashes: the WAL is flushed (`fsync`) before acknowledging. In a replicated system, durability also depends on **how many replicas** confirmed the write: an async replica that hadn't received the last commits loses them on failover. "Durable" should always be stated as "durable against what" (process crash, disk loss, zone loss, region loss).

## 3. Isolation levels and anomalies (the most-asked part)

### The anomalies

| Anomaly | What happens | Example |
| --- | --- | --- |
| **Dirty read** | You read data another transaction hasn't committed (and may roll back) | You see a balance from a transfer that's later aborted |
| **Dirty write** | You overwrite another transaction's uncommitted write | Two updates interleave, leaving a mix of both |
| **Non-repeatable read** (read skew) | You read the same row twice and get different values | A report sums accounts while a transfer moves money between them, so the total is off |
| **Lost update** | Two read-modify-write cycles race, and one overwrites the other | Two clients do `likes = likes + 1` via read-then-write; one increment is lost |
| **Phantom read** | A repeated range query returns new rows inserted by another transaction | "Count bookings for room 7 tonight" changes mid-transaction |
| **Write skew** | Two transactions read the same data, make **disjoint** writes based on it, and together break an invariant | Two on-call doctors each see "2 on call", each takes themselves off, and nobody is on call |

### The levels

| Level | Prevents | Still allows | Default in |
| --- | --- | --- | --- |
| Read uncommitted | Dirty writes | Everything else | Rarely used |
| **Read committed** | Dirty reads, dirty writes | Non-repeatable reads, lost updates, phantoms, write skew | **PostgreSQL**, Oracle, SQL Server |
| **Repeatable read / snapshot isolation** | The above + non-repeatable reads (and phantoms in snapshot-based engines) | **Write skew**; lost updates in some engines | **MySQL InnoDB** (repeatable read); Postgres's `REPEATABLE READ` is snapshot isolation |
| **Serializable** | Everything above | Nothing (at the cost of locking or aborts) | CockroachDB, FoundationDB, Spanner (stronger still: externally consistent) |

Engine nuances worth knowing: Postgres `SERIALIZABLE` uses **SSI** (serializable snapshot isolation: optimistic, aborts conflicting transactions, so **the client must retry**). MySQL `SERIALIZABLE` uses locking. Oracle's `SERIALIZABLE` is actually snapshot isolation, so it allows write skew. Names are not portable, so say what anomalies you need to prevent.

### Fixing the common anomalies without going fully serializable

| Problem | Fix |
| --- | --- |
| Lost update on a counter | An **atomic update**: `UPDATE posts SET likes = likes + 1 WHERE id = ?` |
| Lost update on a read-modify-write | **Optimistic locking** with a version column: `UPDATE ... SET ..., version = version + 1 WHERE id = ? AND version = ?` and retry if 0 rows changed. Or **pessimistic**: `SELECT ... FOR UPDATE`. |
| Write skew (doctors, double booking) | Lock the rows the decision depends on (`FOR UPDATE`), **materialize the conflict** (a row per room-night with a unique constraint), or use serializable isolation |
| Unique username / one seat sold once | A **unique constraint** or a conditional insert. The database enforces it atomically. |
| Inventory never negative | `UPDATE stock SET qty = qty - 1 WHERE sku = ? AND qty > 0` and check the affected-row count |

**Interview line:** *"Booking a seat is a write-skew risk. I'll make each seat a row and do a conditional update `WHERE status = 'AVAILABLE'`, so the database serializes the conflict on that row. I don't need serializable isolation for the whole system."*

## 4. BASE, in depth

### Basically available

The system keeps answering during failures and partitions, possibly with a degraded response (stale data, partial results, a queued write), instead of returning errors.

### Soft state

The state may change **without new input** as replicas exchange updates in the background. What a replica holds right now isn't necessarily final.

### Eventual consistency

If writes stop, all replicas **converge** to the same value eventually. It says nothing about *when* (usually milliseconds to seconds, but unbounded during partitions) or *which* value wins (that's the conflict-resolution policy).

### How BASE systems actually converge

| Mechanism | What it does |
| --- | --- |
| **Quorum reads and writes** | N replicas, write to W, read from R. **R + W > N** means reads overlap the latest write (N=3, W=2, R=2). Lower R or W for speed and availability. |
| **Read repair** | A read that sees replicas disagree writes the newest value back to the stale ones |
| **Hinted handoff** | If a replica is down, another node keeps the write as a "hint" and delivers it when the replica returns |
| **Anti-entropy with Merkle trees** | Replicas compare hash trees of their data and sync only the differing ranges |
| **Conflict resolution** | **Last-write-wins** (simple, but silently drops concurrent writes, and relies on clocks), **vector clocks / version vectors** (detect concurrency, let the app merge, like Dynamo's shopping cart), **CRDTs** (data types that merge automatically: counters, sets, collaborative text) |

**Note on quorums:** R + W > N isn't the same as linearizability. Sloppy quorums (writing to substitute nodes during failures), concurrent writes and clock-based LWW can still produce stale or lost writes. That's why systems needing true compare-and-set add a consensus step (Cassandra lightweight transactions use Paxos).

### Consistency between strong and eventual

"Eventual" is the floor, not the only option. Ask which of these the feature actually needs:

| Guarantee | Meaning | Typical need |
| --- | --- | --- |
| **Linearizable** | Behaves like a single copy, in real-time order | Locks, leader election, unique IDs, balances |
| **Causal** | Effects never appear before their causes | A reply never shows before the comment it answers |
| **Read-your-writes** | You always see your own updates | After editing your profile, you see the edit |
| **Monotonic reads** | You never see data go backwards in time | A refreshed feed never loses posts you already saw |
| **Eventual** | Converges sometime | Like counts, view counts, recommendations |

Session guarantees (read-your-writes, monotonic reads) are cheap to add: route a user's reads to the primary for a few seconds after they write, pin a session to one replica, or carry a "minimum version" token with each request.

## 5. How this connects to CAP and PACELC

- **CAP:** during a network **partition**, a replicated system must choose between **consistency** (linearizability; refuse some requests) and **availability** (answer everything, possibly stale). ACID-style systems lean CP; BASE systems lean AP.
- **PACELC:** **else**, when there's no partition, you still trade **latency vs consistency**. Synchronous replication across zones costs milliseconds on every write; async replication is fast but can lose the last writes on failover. This is the trade-off you make every day, not just during partitions.
- Details and examples: [Blueprint §10](./00_HLD%20Blueprint.md#10-distributed-systems-concepts) and [Replication & Scaling](../../Database/Replication%20&%20Scaling.md).

## 6. ACID across services: what to do when one database isn't enough

In a microservice design, an "order" touches the order, payment and inventory services, each with its own database. A single ACID transaction no longer spans the whole operation. The options:

| Approach | How | Trade-off |
| --- | --- | --- |
| **Keep it in one service** | Redraw boundaries so the invariant lives in one database | Simplest and strongest. Prefer it when possible. |
| **Two-phase commit (2PC)** | A coordinator gets every participant to *prepare*, then *commit* | Atomic, but blocking if the coordinator fails, and slow (locks held across network round-trips). Rare across microservices. |
| **Saga** | A chain of local ACID transactions; on failure, run **compensating** transactions (refund, release stock) | No distributed locks, but intermediate states are visible, and compensations must be designed |
| **Transactional outbox** | Write the business change **and** an event row in the same local transaction; a relay publishes the event | Guarantees "DB updated ⇔ event published" without 2PC. At-least-once delivery, so consumers must be idempotent. |
| **Idempotency keys** | Clients send a unique key per logical operation; the server stores results by key | Makes retries safe, which every BASE pipeline relies on |

A saga for "place order":

```text
1. Order service:     create order (PENDING)                      ← local ACID transaction
2. Payment service:   charge card              ── fails? → cancel order
3. Inventory service: reserve items            ── fails? → refund payment → cancel order
4. Order service:     mark order CONFIRMED
```

Each step is ACID locally; the whole flow is BASE (eventually consistent, with compensations).

## 7. Choosing per feature: one system, both models

E-commerce example:

| Feature | Model | Why |
| --- | --- | --- |
| Payment capture, ledger | **ACID** | Money must balance; double charges are unacceptable |
| Inventory reservation at checkout | **ACID** (conditional update on the SKU row) | Overselling the last item is a real loss |
| Order placement across services | **Saga + outbox** | Spans services; compensations are acceptable |
| Shopping cart | **BASE** | Must always accept "add to cart"; merging two concurrent versions is fine |
| Product reviews and ratings average | **BASE** | A few seconds of staleness is invisible |
| Search index, recommendations | **BASE** | Derived data rebuilt from the source of truth |
| "Your order was placed" page | **Read-your-writes** | The user must see their own order immediately, even if other views lag |

## 8. Interview questions (with crisp answers)

**Q: What's the difference between ACID and BASE?**
ACID guarantees each transaction is atomic, isolated and durable, keeping invariants intact even if that costs availability or latency. BASE keeps the system available and scalable, accepting temporary inconsistency that converges later. Most real systems use both, per feature.

**Q: Is the C in ACID the same as the C in CAP?**
No. ACID's C means invariants and constraints hold. CAP's C means linearizability: every read sees the latest write across replicas.

**Q: What isolation level does Postgres use by default, and what can go wrong?**
Read committed. It allows non-repeatable reads, lost updates on read-modify-write code and write skew. Use atomic updates, `FOR UPDATE`, optimistic version checks, or serializable (with retries) where those matter.

**Q: Explain write skew with an example.**
Two doctors on call, the rule "at least one on call". Both read "2 on call" concurrently, both remove themselves, and both commit because they wrote different rows. Snapshot isolation allows it. Serializable isolation or locking the rows read (`FOR UPDATE`) prevents it.

**Q: How do eventually consistent systems resolve conflicts?**
Last-write-wins (simple but lossy), version vectors with application-level merges, or CRDTs that merge automatically. Plus read repair, hinted handoff and anti-entropy to spread the winning value.

**Q: How do you keep data consistent across microservices without distributed transactions?**
Keep invariants inside one service where possible. Otherwise use sagas with compensations, the transactional outbox for reliable events, and idempotent consumers keyed by an idempotency key or event ID.

**Q: Would you use eventual consistency for a bank balance?**
Not for the balance itself, which needs ACID. But many surrounding features can be eventual: transaction history views, notifications, analytics, fraud-score updates.

## 9. Common mistakes

- "NoSQL is BASE, SQL is ACID" as an absolute. Both families now offer both, with limits.
- Assuming the default isolation level is serializable.
- Read-modify-write in application code without a lock, version check or atomic update.
- Using eventual consistency for invariants (inventory, unique usernames, balances).
- Using strong consistency everywhere, paying latency and availability for data nobody needs fresh.
- Last-write-wins with wall clocks from different machines, then being surprised by lost writes.
- Retries without idempotency, producing duplicate charges or messages.
- Calling async replication "durable" without saying it can lose the last writes on failover.
