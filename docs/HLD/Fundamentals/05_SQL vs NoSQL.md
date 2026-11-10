---
sidebar_position: 5
---

# SQL vs NoSQL

> **Why this matters in interviews:** "Which database would you use?" comes up in almost every system design round, usually right after the high-level diagram. A weak answer picks by fashion ("NoSQL because it scales"). A strong answer picks by **access patterns, consistency needs and scale**, names the specific product and its data model, states what you give up, and is comfortable using **more than one store** in the same design.

Blueprint components this feeds: **4 (data modeling)**, **6 (database selection)**, **8 (scalability)** and **10 (distributed systems)** in the [HLD Blueprint](./00_HLD%20Blueprint.md). Related: [Indexes](./06_Indexes.md) · [ACID vs BASE](./07_ACID%20vs%20BASE.md) · deep dives in [Schema Design](../../Database/Schema%20Design.md) and [Replication & Scaling](../../Database/Replication%20&%20Scaling.md).

---

## 1. What the words actually mean

"SQL vs NoSQL" is a convenient shorthand for a set of **design trade-offs**, not two technologies.

| | Relational ("SQL") | Non-relational ("NoSQL") |
| --- | --- | --- |
| Data model | Tables of rows, with relations between them via foreign keys | Several different models: key-value, document, wide-column, graph |
| Schema | **Schema-on-write**: enforced by the database | Usually **schema-on-read**: the application interprets the shape |
| Query | Declarative SQL, joins, ad-hoc queries, aggregations | Mostly by key or a designed access path. Query power varies a lot by product. |
| Transactions | Multi-row, multi-table ACID by default | Historically single-item or single-partition. Many now offer multi-item transactions with limits. |
| Scaling (traditional) | Scale **up**, add read replicas, shard manually | Scale **out** by design: partitioning and replication are built in |
| Consistency (default) | Strong on a single primary | Often eventual or tunable |
| Design approach | Model the **entities**, then write any query you need | Model the **queries**, then shape the data to serve them |

The last row is the most important one for interviews. With SQL, you can be vague about future queries. With most NoSQL stores, **you must know your access patterns up front**, because the key design *is* the query plan.

### The NoSQL families

| Family | Model | Examples | Natural fit |
| --- | --- | --- | --- |
| **Key-value** | `key → opaque value` | Redis, DynamoDB, Memcached, etcd | Sessions, caches, URL mappings, carts, feature flags |
| **Document** | `key → JSON-like document` with nested fields, queryable by field | MongoDB, Couchbase, Firestore | Catalogs, profiles, CMS, data with varied or nested shape |
| **Wide-column** | `partition key → sorted rows (clustering key) → columns` | Cassandra, ScyllaDB, HBase, Bigtable | High-volume, time-ordered data per entity: messages, feeds, IoT, event logs |
| **Graph** | Nodes and edges with properties | Neo4j, Amazon Neptune, JanusGraph | Multi-hop relationships: social graphs, fraud rings, recommendations |

Plus specialized stores that sit alongside both: **search** (Elasticsearch), **time-series** (Prometheus, InfluxDB, TimescaleDB), **analytical/columnar** (BigQuery, Snowflake, ClickHouse) and **object storage** (S3). The full table is in [Blueprint §6](./00_HLD%20Blueprint.md#6-database-selection).

### And "NewSQL" / distributed SQL

Spanner, CockroachDB, YugabyteDB and TiDB offer **SQL + ACID + horizontal scaling**, using consensus (Raft or Paxos) per data range. Vitess (MySQL) and Citus (Postgres) shard a traditional engine behind a routing layer. The price: higher write latency (a consensus round-trip, often across zones), and cross-shard transactions that are correct but slower. They erase the old rule "SQL can't scale out".

## 2. The trade-offs, in depth

### a) Data model and relationships

- **Relational shines when data is highly connected** and you'll query it from many directions: users ↔ orders ↔ products ↔ payments. Joins let you store each fact once (**normalization**) and combine it at read time.
- **Document stores shine when data is read as a self-contained aggregate:** a product with its variants and attributes, a blog post with its embedded tags. One read returns everything, with no joins.
- The question to ask: **"Is this a tree (one owner, read together) or a graph (many-to-many, read from many angles)?"** Trees fit documents. Graphs with simple hops fit SQL. Deep traversals (friends-of-friends-of-friends) fit a graph database.

**Embedding vs referencing (document stores):** embed when the child is read with the parent, bounded in size, and owned by it (order line items). Reference when it's unbounded (a user's comments, which grow forever), shared (an author referenced by many posts), or updated independently. MongoDB's 16 MB document limit makes "unbounded arrays" an outright bug.

### b) Schema: on-write vs on-read

| | Schema-on-write (SQL) | Schema-on-read (most NoSQL) |
| --- | --- | --- |
| Bad data | Rejected at insert time (types, `NOT NULL`, foreign keys, `CHECK`) | Accepted. Every reader has to cope with old and malformed shapes. |
| Changing the schema | Migrations (`ALTER TABLE`). Mostly online in modern engines, but large backfills need care. | Write the new shape immediately. Old documents stay old until rewritten (lazy migration). |
| Best for | Stable, core business data where integrity matters | Fast-evolving or heterogeneous data (product attributes that differ per category) |

"Schemaless" really means **the schema lives in your application code**. You still have one. You've just moved enforcement from the database to every reader. Many teams add validation (MongoDB JSON Schema validation, Postgres `JSONB` with `CHECK` constraints) to get some of it back.

Postgres `JSONB` blurs the line: relational core columns with a flexible, indexable JSON column for the varying parts. It's often the best of both for moderate scale.

### c) Query flexibility

- SQL: any filter, join, group-by or window function, planned by an optimizer. **New questions don't need new data layouts**, just maybe an index.
- Key-value and wide-column: fast and predictable for the queries you designed for, and **unable to answer** (or forced to scan everything for) the ones you didn't. In Cassandra, a new query pattern usually means **a new table**, with the same data written twice (denormalized per query).
- This is why analytics and ad-hoc reporting are almost always offloaded: stream changes (CDC) from the operational store into a warehouse or search engine.

### d) Scaling

| Lever | SQL (single primary) | Partitioned NoSQL |
| --- | --- | --- |
| More reads | Read replicas + caching | Add nodes. Replicas serve reads. |
| More writes | Vertical scaling, then **application-level sharding** (or Vitess/Citus/distributed SQL) | Add nodes. Writes spread across partitions by key. |
| More storage | Bigger disks, partitioning, archiving | Add nodes |
| Operational cost of scaling | Resharding is a project | Rebalancing is built in (consistent hashing or range splits) |

**How far does one SQL box go?** Further than most candidates assume. A well-tuned Postgres or MySQL primary on modern hardware handles **thousands to tens of thousands of writes per second** and tens of terabytes, and replicas multiply read capacity. Many large companies ran (and run) on sharded MySQL or Postgres: Facebook's social graph sits on sharded MySQL behind TAO, YouTube built Vitess to shard MySQL, and Instagram sharded Postgres. Use your capacity estimate: if peak writes are 2,000/s, one primary is fine, and saying so is a **strength**.

Where NoSQL's scaling model clearly wins: **sustained very high write throughput** (hundreds of thousands to millions of writes per second), **multi-region active-active writes**, and data with a **natural partition key** and no cross-partition queries.

### e) Consistency and transactions

- **Single-primary SQL** gives strong consistency and multi-row ACID transactions for free. That's why it's the default for money, inventory and anything with invariants ("balance never negative", "a seat sold once").
- **NoSQL defaults are usually weaker, but rarely "no consistency":**
  - DynamoDB: eventually consistent reads by default, **strongly consistent reads** on request (not on global secondary indexes), and `TransactWriteItems` for multi-item ACID (up to 100 items).
  - Cassandra: **tunable per query** (`ONE`, `QUORUM`, `ALL`), and lightweight transactions (Paxos-based compare-and-set) for things like unique usernames, at a latency cost.
  - MongoDB: single-document atomicity always, multi-document ACID transactions since 4.0 (4.2 for sharded clusters), with a performance cost.
- See [ACID vs BASE](./07_ACID%20vs%20BASE.md) for the full picture.

### f) Operations and cost

Often the deciding factor in real life, and worth one sentence in an interview: team familiarity, managed-service availability (RDS/Aurora, DynamoDB, Atlas), backup and point-in-time recovery, and cost model (DynamoDB on-demand pricing per request can be expensive at high steady throughput; provisioned capacity or self-hosted Cassandra may be cheaper; a big relational instance has a fixed cost regardless of traffic).

## 3. Myths to avoid saying

| Myth | Reality |
| --- | --- |
| "SQL doesn't scale." | It scales very far vertically and with replicas, and horizontally with sharding or distributed SQL. The cost is operational complexity, not impossibility. |
| "NoSQL is faster." | Key lookups are fast in **both**. NoSQL is faster at *scale-out writes* and *predictable latency on designed access paths*, and slower (or incapable) at ad-hoc queries. |
| "NoSQL has no transactions." | DynamoDB, MongoDB, FoundationDB, Cassandra LWTs and others offer transactions, with limits. |
| "NoSQL means no schema." | The schema moved to application code. You still have to migrate it. |
| "We might need to scale, so NoSQL." | Premature. Choose by the estimated numbers and access patterns. Most systems never outgrow a sharded relational database. |
| "Use MongoDB because the data is JSON." | Every database can store JSON. Choose by access pattern and relationships, not by wire format. |

## 4. A decision framework

Ask these in order. The first strong "yes" usually decides it.

1. **Are there cross-entity invariants or multi-row transactions?** (money, inventory, bookings, permissions) → **Relational**, or distributed SQL if it must scale out.
2. **Is the dominant access pattern "get/put by key" with huge volume and simple values?** → **Key-value** (DynamoDB, Redis as a cache in front).
3. **Is it a high-write, append-mostly stream per entity, read as "the latest N for X"?** (messages, timelines, sensor readings, activity logs) → **Wide-column** (Cassandra, ScyllaDB, Bigtable).
4. **Is it a self-contained aggregate with a variable shape, read whole?** → **Document**, or a relational table with a `JSONB` column.
5. **Do queries traverse several hops of relationships?** → **Graph**, or precomputed adjacency lists if the hops are fixed and shallow.
6. **Full-text, fuzzy or faceted search?** → **Search engine**, fed from the source of truth.
7. **Aggregations over billions of rows?** → **Columnar/OLAP warehouse**, fed by CDC or batch.
8. **Large binary files?** → **Object storage**, with metadata in a database.
9. **None of the above clearly applies?** → **Relational.** It's the default until proven otherwise.

**Polyglot persistence is normal.** A typical e-commerce design: Postgres for orders and payments, DynamoDB or Redis for carts and sessions, Elasticsearch for product search, S3 for images, a warehouse for analytics, and CDC (Debezium → Kafka) keeping the derived stores in sync. Each store has **one owner** and one source of truth per fact.

## 5. Worked examples (how to say it in the room)

| System | Choice | The sentence to say |
| --- | --- | --- |
| **Payments / wallet** | Postgres or MySQL (sharded by `account_id` at scale), or Spanner/CockroachDB | "Balances have invariants and need multi-row atomic transfers, so I want ACID and serializable or `SELECT ... FOR UPDATE` on the hot rows. Writes are thousands per second, which one primary can handle; I'd shard by account ID later." |
| **Chat messages** | Cassandra / ScyllaDB / HBase | "Access pattern is 'latest 50 messages in a channel, paginate backwards'. Partition key `channel_id` (plus a time bucket so partitions stay bounded), clustering key `message_id` descending. It's write-heavy and append-only, which suits LSM storage." (Discord ran exactly this on Cassandra and later moved to ScyllaDB.) |
| **URL shortener** | DynamoDB / Cassandra, or sharded SQL | "It's a pure key lookup: `short_code → long_url`, around 100:1 reads to writes. A key-value store with a cache in front is the simplest fit. Uniqueness comes from the ID generator, not from a cross-row constraint." |
| **Product catalog** | MongoDB or Postgres + `JSONB`, plus Elasticsearch for search | "Attributes differ per category (shoe size vs screen resolution), and a product page reads one aggregate. Search and facets go to Elasticsearch, fed by CDC." |
| **Social graph** | Sharded MySQL with an adjacency-list cache (TAO-style), or a graph DB for deep traversals | "Most queries are one hop (followers, following), which an adjacency table keyed by `user_id` handles. Only 'people you may know' needs multi-hop, and that's an offline job." |
| **Metrics / monitoring** | Prometheus, InfluxDB, TimescaleDB | "Time-ordered, append-only, queried by time window with downsampling and retention, which is exactly what time-series databases optimize." |
| **Leaderboard** | Redis sorted sets (cache) + a durable store | "`ZADD`/`ZREVRANGE` give O(log n) rank updates and top-K reads. Redis is the serving layer; scores are also persisted in a database for recovery." |

### Modeling the same feature both ways: "a user's orders, newest first"

**Relational:**

```sql
CREATE TABLE orders (
  order_id    BIGINT PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(user_id),
  status      TEXT   NOT NULL,
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_recent ON orders (user_id, created_at DESC);

SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;
-- tomorrow's question ("revenue by status last week") is just another query
```

**DynamoDB (access-pattern-first, "single-table design"):**

```text
PK = USER#42        SK = ORDER#2026-11-10T09:30:00Z#981   → { status, total_cents, ... }
PK = USER#42        SK = PROFILE                           → { name, email, ... }

Query: PK = "USER#42" AND begins_with(SK, "ORDER#"), ScanIndexForward = false, Limit = 20
-- one partition, already sorted: a single fast request.
-- "orders by status across all users" needs a GSI designed for it, decided up front.
```

Same feature, opposite philosophies. Saying this contrast out loud is a strong signal.

## 6. Interview questions (with crisp answers)

**Q: When would you choose NoSQL over SQL?**
When the access patterns are known and key-based, the write volume or data size exceeds what a primary (or a manually sharded fleet) handles comfortably, the data has a natural partition key, and the features tolerate weaker consistency, or when the data model (graph, time series, documents with variable shape) fits a specialized store far better.

**Q: Can't you just shard Postgres?**
Yes, and many large companies do. The cost is in the application: routing by shard key, cross-shard queries and transactions, and resharding. Tools like Vitess and Citus take much of that work off you. Distributed SQL does it inside the database.

**Q: How do you handle joins in NoSQL?**
Denormalize: store data in the shape it's read, write the same fact to several places (one table per query), precompute views, or join in the application for small result sets. Accept that updates now touch several copies, usually asynchronously.

**Q: What's the downside of denormalization?**
Write amplification and update anomalies: the same fact lives in many places, so updates are more expensive and can leave copies inconsistent for a while. You need a mechanism (events, CDC, background repair) to converge them.

**Q: Which would you pick for a system that needs both strong consistency and huge scale?**
Distributed SQL (Spanner, CockroachDB), or a sharded relational design where each transaction stays within one shard by choosing the shard key carefully (e.g. by `account_id`). Mention the latency cost of consensus.

**Q: Why not just use one database for everything?**
One store simplifies operations and consistency, and is right at small scale. At large scale, search, analytics, caching and blob storage have such different needs that forcing them into one store makes all of them worse. Keep one source of truth per fact and derive the rest.

## 7. Common mistakes

- Choosing a database before stating the access patterns and the numbers.
- "NoSQL for scale" with no estimate showing that scale.
- Picking Cassandra and then needing ad-hoc queries, joins or multi-partition transactions.
- Picking SQL for a multi-million-writes-per-second append-only stream with no sharding plan.
- Unbounded partitions or documents (all messages of a popular channel in one partition, a user's comments embedded in one document).
- Using the search engine or the cache as the source of truth.
- Forgetting how derived stores stay in sync (no CDC, no events, no reconciliation).
