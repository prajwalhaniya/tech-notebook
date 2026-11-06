---
sidebar_position: 2
---

## Advanced PostgreSQL SQL: CTEs, Window Functions, LATERAL Joins and Query Optimization

Basic `SELECT`, `WHERE`, and `JOIN` get you through most queries. This guide covers the tools for the queries that don't fit that shape — ranking rows within groups, running a subquery once per outer row, building hierarchies, and recognizing the patterns that quietly turn a fast query into a slow one.

* * *

Advanced Joins
===============

A `JOIN` in SQL is a request, not an instruction — you describe which rows should be combined, and the planner (from the query processing lifecycle in the previous guide) decides *how* to actually do it. There are three join algorithms, and knowing them makes `EXPLAIN` output readable instead of mysterious:

| Algorithm | How it works | Best when |
|---|---|---|
| **Nested Loop** | For each row in the outer table, scan the inner table for matches | One side is small, or the inner side has a usable index |
| **Hash Join** | Build an in-memory hash table from the smaller side, probe it with the larger side | No useful index, both sides are too big for a nested loop to be cheap |
| **Merge Join** | Sort both sides on the join key, then walk them together like a zipper | Both inputs are already sorted (e.g. from an index) |

None of these are chosen by you directly — they're what the planner picks based on table size, available indexes, and the statistics gathered by `ANALYZE`. A slow join is almost always a missing index or stale statistics causing the planner to pick the wrong one of these three, not a flaw in the algorithms themselves.

Two join forms are worth knowing by name because they don't look like joins in your source table list:

- **`EXISTS` / `NOT EXISTS`** compile down to what the planner calls a **semi-join** / **anti-join** — "does at least one match exist," without actually producing duplicate rows for multiple matches the way a regular join would.
- **Self joins** (a table joined to itself) are how you compare rows within the same table — finding employees who earn more than their manager, for instance — and are just an ordinary join where both sides happen to be the same relation under different aliases.

* * *

CTEs and Recursive CTEs
=========================

A **Common Table Expression** (`WITH`) names a subquery so it can be referenced like a table, which mostly exists to make a complex query readable:

```sql
WITH recent_orders AS (
    SELECT customer_id, total_cents
    FROM orders
    WHERE created_at > now() - interval '30 days'
)
SELECT customer_id, sum(total_cents)
FROM recent_orders
GROUP BY customer_id;
```

One detail changed the way CTEs behave: since PostgreSQL 12, a plain CTE is **inlined** into the surrounding query by default, just like a subquery would be — the planner is free to optimize across the boundary. Before version 12 (and still today if you write `WITH x AS MATERIALIZED (...)`), a CTE is an **optimization fence**: it's computed once, in full, and the rest of the query can't push filters into it. Use `MATERIALIZED` deliberately when you want that boundary — for example, to force a CTE with a side-effecting `INSERT ... RETURNING` to run exactly once.

**Recursive CTEs** build a result by repeatedly feeding a query's own output back into itself — the standard way to walk a hierarchy:

```sql
WITH RECURSIVE org_chart AS (
    SELECT id, manager_id, name, 1 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    SELECT e.id, e.manager_id, e.name, oc.depth + 1
    FROM employees e
    JOIN org_chart oc ON e.manager_id = oc.id
)
SELECT * FROM org_chart;
```

The first `SELECT` (the **anchor**) seeds a working table. The second `SELECT` (the **recursive term**) runs again and again, each time joining against only the rows produced in the *previous* iteration, until a round produces no new rows. This is exactly how you traverse trees and graphs in SQL — an org chart, a category tree, a bill-of-materials — without knowing the depth ahead of time.

* * *

Subqueries
==========

A subquery is a query nested inside another. The important distinction is whether it's **correlated**:

- An **uncorrelated** subquery is self-contained — it doesn't reference anything from the outer query, so it can run once, independent of the rest of the statement.
- A **correlated** subquery references a column from the outer query, which means — conceptually — it has to run once *per outer row*, the same way the inner side of a nested loop join does. The planner will often rewrite a correlated subquery into an actual join internally when it can, but not always, so a correlated subquery is worth a look in `EXPLAIN` if a query is slower than it looks like it should be.

```sql
SELECT name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

That query is correlated — the inner query's `o.customer_id = c.id` depends on the outer row — but because it's wrapped in `EXISTS`, the planner can turn it into a semi-join rather than literally looping.

* * *

LATERAL Joins
=============

`LATERAL` lets a subquery in the `FROM` clause reference columns from the tables listed *before* it — something an ordinary subquery in `FROM` can't do. It's the explicit, reusable version of "run this subquery once per outer row":

```sql
SELECT c.name, recent.total_cents
FROM customers c,
     LATERAL (
         SELECT total_cents
         FROM orders o
         WHERE o.customer_id = c.id
         ORDER BY created_at DESC
         LIMIT 1
     ) recent;
```

This is the standard shape for "top N per group" — the most recent order per customer, the highest score per player, the latest reading per sensor. Without `LATERAL`, you'd need a window function and an extra filtering layer to express the same thing; with it, the "per group, limit N" logic is just an ordinary `LIMIT` inside the subquery.

* * *

Window Functions
=================

A window function computes a value across a set of rows **related to the current row**, without collapsing them into one row the way `GROUP BY` does. Every window function uses `OVER`:

```sql
SELECT
    employee_id,
    department,
    salary,
    rank() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM employees;
```

- **`PARTITION BY`** splits rows into groups, like `GROUP BY`, but each row keeps its own identity — you still get one output row per input row.
- **`ORDER BY`** (inside `OVER`) defines the order the function sees rows in — essential for ranking and for offset functions.
- The **frame clause** (`ROWS BETWEEN ...`, `RANGE BETWEEN ...`) narrows the window further, to things like "this row and the two before it" — the basis for running totals and moving averages.

The functions that only make sense as window functions:

| Function | Purpose |
|---|---|
| `row_number()` | A unique, sequential number per row in the partition — ties broken arbitrarily |
| `rank()` | Same rank for ties, next rank skips accordingly (1, 2, 2, 4) |
| `dense_rank()` | Same rank for ties, no gap afterward (1, 2, 2, 3) |
| `lag(col, n)` / `lead(col, n)` | The value of `col` from `n` rows before / after the current row |
| `first_value()` / `last_value()` | The value of an expression at the start / end of the frame |

Any regular aggregate (`sum`, `avg`, `count`) can also be used as a window function by adding `OVER (...)` — that's what turns `sum(amount)` into a running total instead of a single grand total.

* * *

Aggregate Functions
====================

Beyond the familiar `count`, `sum`, `avg`, `min`, `max`, two features make aggregates considerably more expressive:

- **`FILTER`** applies a condition to one aggregate without affecting the others in the same query — `count(*) FILTER (WHERE status = 'paid')` counts only paid orders, in a query that might also be counting all orders in the same row.
- **`GROUPING SETS`, `ROLLUP`, and `CUBE`** compute several levels of grouping in a single pass, instead of running a separate query per level — `ROLLUP (year, month)` produces totals per month, per year, and a grand total, all in one result set, which is exactly the shape a reporting dashboard usually needs.

* * *

SQL Anti-Patterns
==================

Patterns that work on a small table and quietly become the slowest query in the system once data grows:

- **`SELECT *`** — forces PostgreSQL to fetch every column, including large `TOAST`-ed ones you don't need, and breaks the moment someone adds a column you didn't expect.
- **Functions on an indexed column in `WHERE`** — `WHERE lower(email) = 'a@b.com'` can't use a plain index on `email`, because the index stores the raw value, not the function's result. (An expression index on `lower(email)` fixes this — covered in the indexing guide.)
- **Implicit type casts** — comparing a `text` column to an integer literal, or an untyped parameter, can silently disable an index the same way a function call does.
- **`OFFSET` for pagination at scale** — `OFFSET 100000 LIMIT 20` still has to compute and discard the first 100,000 rows every time. Keyset pagination (`WHERE id > :last_seen_id ORDER BY id LIMIT 20`) scales independently of how deep into the results you are.
- **`IN` with a subquery that can return `NULL`** — `NOT IN (SELECT ...)` silently returns zero rows if the subquery produces even one `NULL`, because `x <> NULL` is unknown, not true. `NOT EXISTS` doesn't have this trap and is almost always the safer choice.
- **Correlated subqueries where a join or window function would do** — not wrong, but often the slower option once the planner can't flatten it into a join; worth checking `EXPLAIN` before assuming the subquery form is fine at scale.
- **Unindexed foreign keys** — PostgreSQL does not automatically index the referencing side of a foreign key. Without one, every delete on the referenced table triggers a full scan of the referencing table to check for orphaned rows.
