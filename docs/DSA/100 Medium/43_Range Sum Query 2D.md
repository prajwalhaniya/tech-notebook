---
sidebar_position: 43
---

# Range Sum Query 2D - Immutable

> **LeetCode 304 · Medium · Pattern: 2D Prefix Sums (summed-area table) + inclusion–exclusion**

> Companies: Meta (frequent), Google, Amazon, Microsoft, Bloomberg, Lyft. This is a **design** question: a constructor plus many queries. Interviewers check that you trade preprocessing for O(1) queries, get the inclusion–exclusion formula right, and avoid off-by-one errors by **padding** the table with an extra row and column. The mutable follow-up (LC 308) is very common.

Implement `NumMatrix`:
- `new NumMatrix(matrix)` stores the 2D integer matrix.
- `sumRegion(row1, col1, row2, col2)` returns the sum of the rectangle with upper-left `(row1, col1)` and lower-right `(row2, col2)`, inclusive.

`sumRegion` must run in **O(1)**.

```
matrix = [
  [3, 0, 1, 4, 2],
  [5, 6, 3, 2, 1],
  [1, 2, 0, 1, 5],
  [4, 1, 0, 1, 7],
  [1, 0, 3, 0, 5],
]
sumRegion(2, 1, 4, 3) → 8     (2+0+1 + 1+0+1 + 0+3+0)
sumRegion(1, 1, 2, 2) → 11    (6+3 + 2+0)
sumRegion(1, 2, 2, 4) → 12    (3+2+1 + 0+1+5)
```

Constraints (LeetCode): `1 <= m, n <= 200`, `-10^4 <= matrix[i][j] <= 10^4`, `0 <= row1 <= row2 < m`, `0 <= col1 <= col2 < n`, and at most `10^4` calls to `sumRegion`.

---

## 1. Understand

We get one fixed grid and then many rectangle-sum questions. Summing each rectangle cell by cell is wasteful when the grid never changes.

Rephrased: precompute something once so that **any** rectangle sum is a few array lookups. This is the 2D version of "range sum = `P[r+1] − P[l]`".

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Is the matrix immutable? | **Yes** here. If it changes, prefix sums go stale (→ Fenwick / segment tree, see follow-ups). |
| How many queries vs. matrix size? | `q` queries on an `m × n` grid. Preprocessing O(mn) only pays off when `q` is large. |
| Are the coordinates inclusive, and always valid? | Inclusive and valid per constraints. In production, validate or clamp. |
| Negative values? | Yes. Prefix sums don't care. |
| Overflow? | Max total is `200 · 200 · 10^4 = 4·10^8`, fine. Don't use `Int32Array` for bigger inputs (it wraps silently); plain arrays or `Float64Array` are exact up to 2^53. |
| Empty matrix? | Not per constraints, but guard `matrix.length === 0` / `matrix[0].length === 0`. |

**Edge cases:** a single cell, a full-matrix query, a single row or column, first row/column queries (where the off-by-one bugs live), a 1×1 matrix, and negatives.

## 3. Brute force: sum the rectangle on every query

```js
class NumMatrixBrute {
  constructor(matrix) {
    this.matrix = matrix;
  }

  sumRegion(row1, col1, row2, col2) {
    let sum = 0;
    for (let r = row1; r <= row2; r++) {
      for (let c = col1; c <= col2; c++) sum += this.matrix[r][c];
    }
    return sum;
  }
}
```

- Constructor **O(1)**, query **O(m · n)** worst case, space **O(1)** extra.
- **Why it works:** it's the definition.
- **When it's preferable:** very few queries, or a matrix that changes constantly. Also as a testing oracle.
- **Limitations:** `10^4` queries × `4·10^4` cells = 4·10^8 operations.

## 4. Optimize: find the bottleneck

Every query re-adds cells that earlier queries already added. Precompute once.

**Step 1 (halfway): row prefix sums.** For each row, keep a 1D prefix array. A query becomes one subtraction per row: **O(m)** per query. Better, but not O(1).

**Step 2: 2D prefix sums.** Let `P[r][c]` be the sum of the rectangle from `(0, 0)` to `(r − 1, c − 1)`. That's a **padded** table of size `(m + 1) × (n + 1)` with a zero first row and column, so no index ever goes to −1.

Building it (each cell from its neighbours):

```
P[r+1][c+1] = matrix[r][c] + P[r][c+1] + P[r+1][c] − P[r][c]
                   cell       above        left       counted twice
```

Querying (inclusion–exclusion):

```
          col1        col2
     ┌─────┬────────────┐
     │  A  │     B      │
row1 ├─────┼────────────┤
     │  C  │   TARGET   │
row2 └─────┴────────────┘

TARGET = (A+B+C+TARGET) − (A+B) − (A+C) + A
       = P[row2+1][col2+1] − P[row1][col2+1] − P[row2+1][col1] + P[row1][col1]
```

`A` is subtracted twice, so add it back once.

## 5. Pattern: prefix sums in 2D (summed-area table)

> Precompute cumulative sums from a corner. Any axis-aligned rectangle is then 4 lookups with inclusion–exclusion. Pad with a zero row and column to delete all the boundary special cases.

The same pattern shows up in:
- Range Sum Query - Immutable (LC 303), the 1D version
- Matrix Block Sum (LC 1314): every cell's `k`-neighbourhood is one `sumRegion` call
- Maximal Square / Largest 1-Bordered Square (LC 1139), Count Square Submatrices (LC 1277)
- Max Sum of Rectangle No Larger Than K (LC 363), Number of Submatrices That Sum to Target (LC 1074): combine with [Subarray Sum Equals K](./41_Subarray%20Sum%20Equals%20K.md)
- Image processing (box blur, Viola–Jones "integral images"), and 2D **difference arrays** for range *updates* (LC 2536)

## 6. Implement (optimal: padded 2D prefix sums)

```js
class NumMatrix {
  /**
   * @param {number[][]} matrix
   */
  constructor(matrix) {
    const m = matrix.length;
    const n = m ? matrix[0].length : 0;

    // P[r][c] = sum of matrix[0..r-1][0..c-1]. Row 0 and column 0 are all zeros (padding).
    this.P = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        this.P[r + 1][c + 1] =
          matrix[r][c] + this.P[r][c + 1] + this.P[r + 1][c] - this.P[r][c];
      }
    }
  }

  /**
   * @param {number} row1
   * @param {number} col1
   * @param {number} row2
   * @param {number} col2
   * @return {number}
   */
  sumRegion(row1, col1, row2, col2) {
    const P = this.P;
    return P[row2 + 1][col2 + 1] - P[row1][col2 + 1] - P[row2 + 1][col1] + P[row1][col1];
  }
}
```

- **Why it works:**
  - **Invariant:** `P[r][c]` is the sum of the top-left `r × c` block. The build formula adds the cell, adds the block above and the block to the left, and subtracts their overlap, which was counted twice.
  - The query formula is the same inclusion–exclusion in reverse: whole block minus the strip above minus the strip to the left plus the corner removed twice.
- **Why pad:** without the extra row/column, every query touching row 0 or column 0 needs `if (row1 > 0)` style checks, and that's where bugs hide.
- **When it's preferable:** an immutable matrix with many queries. It's the expected answer.
- **Limitations:** O(mn) extra memory. Any update to `matrix` invalidates up to O(mn) entries of `P`, so it's the wrong tool for a mutable matrix.

## 7. Complexity

Let the matrix be `m × n` with `q` queries.

| Approach | Build | Query | Extra space | Update |
| --- | --- | --- | --- | --- |
| Brute force | O(1) | O(mn) | O(1) | O(1) |
| Row prefix sums (alt. a) | O(mn) | O(m) | O(mn) | O(n) |
| **2D prefix sums** | **O(mn)** | **O(1)** | **O(mn)** | O(mn) |
| 2D Fenwick tree (follow-up) | O(mn log m log n), or O(mn) | O(log m · log n) | O(mn) | O(log m · log n) |

Total for this problem: O(mn + q), which is optimal, since you must read the matrix and answer each query.

## 8. Testing

```js
const grid = [
  [3, 0, 1, 4, 2],
  [5, 6, 3, 2, 1],
  [1, 2, 0, 1, 5],
  [4, 1, 0, 1, 7],
  [1, 0, 3, 0, 5],
];
const nm = new NumMatrix(grid);
console.assert(nm.sumRegion(2, 1, 4, 3) === 8);
console.assert(nm.sumRegion(1, 1, 2, 2) === 11);
console.assert(nm.sumRegion(1, 2, 2, 4) === 12);
console.assert(nm.sumRegion(0, 0, 0, 0) === 3);    // single cell, top-left corner (padding)
console.assert(nm.sumRegion(4, 4, 4, 4) === 5);    // single cell, bottom-right corner
console.assert(nm.sumRegion(0, 0, 4, 4) === 58);   // the whole matrix
console.assert(nm.sumRegion(0, 2, 4, 2) === 7);    // one column
console.assert(nm.sumRegion(3, 0, 3, 4) === 13);   // one row

console.assert(new NumMatrix([[-7]]).sumRegion(0, 0, 0, 0) === -7);   // 1×1, negative
console.assert(new NumMatrix([[1, -1], [-1, 1]]).sumRegion(0, 0, 1, 1) === 0);

// Adversarial: random matrices and random rectangles vs. brute force (all three implementations)
for (let t = 0; t < 300; t++) {
  const m = 1 + Math.floor(Math.random() * 6);
  const n = 1 + Math.floor(Math.random() * 6);
  const mat = Array.from({ length: m }, () => Array.from({ length: n }, () => Math.floor(Math.random() * 21) - 10));
  const impls = [new NumMatrix(mat), new NumMatrixRows(mat), new NumMatrixMutable(mat)];
  const oracle = new NumMatrixBrute(mat);
  for (let q = 0; q < 20; q++) {
    const r1 = Math.floor(Math.random() * m), r2 = r1 + Math.floor(Math.random() * (m - r1));
    const c1 = Math.floor(Math.random() * n), c2 = c1 + Math.floor(Math.random() * (n - c1));
    const expected = oracle.sumRegion(r1, c1, r2, c2);
    for (const impl of impls) console.assert(impl.sumRegion(r1, c1, r2, c2) === expected, impl.constructor.name);
  }
}

// Adversarial: max size 200×200 at max value, 10^4 full-matrix queries
const huge = Array.from({ length: 200 }, () => new Array(200).fill(1e4));
const hm = new NumMatrix(huge);
for (let q = 0; q < 1e4; q++) console.assert(hm.sumRegion(0, 0, 199, 199) === 4e8);
```

**Dry run** of `sumRegion(1, 1, 2, 2)` on the example (`P` is padded, so the query reads `P[3][3]`, `P[1][3]`, `P[3][1]`, `P[1][1]`):

| term | covers | value |
| --- | --- | --- |
| `P[3][3]` | rows 0–2, cols 0–2 | 3+0+1 + 5+6+3 + 1+2+0 = 21 |
| `P[1][3]` | row 0, cols 0–2 | 4 |
| `P[3][1]` | rows 0–2, col 0 | 9 |
| `P[1][1]` | cell (0,0) | 3 |

`21 − 4 − 9 + 3 = 11`. ✓

## 9. Alternatives

### a) Row-wise prefix sums: O(m) query, O(n) update

```js
class NumMatrixRows {
  constructor(matrix) {
    // rows[r][c] = matrix[r][0] + ... + matrix[r][c-1]
    this.rows = matrix.map((row) => {
      const pre = new Array(row.length + 1).fill(0);
      for (let c = 0; c < row.length; c++) pre[c + 1] = pre[c] + row[c];
      return pre;
    });
  }

  sumRegion(row1, col1, row2, col2) {
    let sum = 0;
    for (let r = row1; r <= row2; r++) sum += this.rows[r][col2 + 1] - this.rows[r][col1];
    return sum;
  }
}
```

- Build O(mn), query **O(m)**, update O(n) (rebuild one row's prefix).
- **Why it works:** each row's segment sum is a 1D range sum. Adding up the rows gives the rectangle.
- **When it's preferable:** a middle ground when updates are occasional and `m` is small, or as the stepping stone you say out loud before the 2D formula.
- **Limitations:** not O(1) per query, so it doesn't meet the requirement.

### b) Build `P` in place / with `Float64Array`

You can store `P` as one flat `Float64Array((m + 1) * (n + 1))` indexed `r * (n + 1) + c`. Same complexity, better cache behaviour and less GC pressure for large matrices. Avoid `Int32Array` unless you've proved the sums fit in 32 bits.

---

## Follow-ups interviewers ask

### 1. The matrix is mutable: Range Sum Query 2D - Mutable (LC 308)

Prefix sums cost O(mn) per update. Use a **2D Fenwick tree** (binary indexed tree): both update and prefix query are O(log m · log n), and `sumRegion` uses the same 4-term inclusion–exclusion.

```js
class NumMatrixMutable {
  constructor(matrix) {
    this.m = matrix.length;
    this.n = this.m ? matrix[0].length : 0;
    this.tree = Array.from({ length: this.m + 1 }, () => new Array(this.n + 1).fill(0)); // 1-indexed
    this.values = Array.from({ length: this.m }, () => new Array(this.n).fill(0));
    for (let r = 0; r < this.m; r++) {
      for (let c = 0; c < this.n; c++) this.update(r, c, matrix[r][c]);
    }
  }

  update(row, col, val) {
    const delta = val - this.values[row][col];
    this.values[row][col] = val;
    for (let i = row + 1; i <= this.m; i += i & -i) {
      for (let j = col + 1; j <= this.n; j += j & -j) this.tree[i][j] += delta;
    }
  }

  // Sum of matrix[0..row-1][0..col-1], same meaning as the padded P[row][col].
  prefix(row, col) {
    let sum = 0;
    for (let i = row; i > 0; i -= i & -i) {
      for (let j = col; j > 0; j -= j & -j) sum += this.tree[i][j];
    }
    return sum;
  }

  sumRegion(row1, col1, row2, col2) {
    return (
      this.prefix(row2 + 1, col2 + 1) - this.prefix(row1, col2 + 1) -
      this.prefix(row2 + 1, col1) + this.prefix(row1, col1)
    );
  }
}
```

- Build O(mn · log m · log n) as written (O(mn) is possible with a linear-time build), update and query O(log m · log n), space O(mn).
- Trade-off summary to say out loud: **many queries, no updates → prefix sums. Mixed updates and queries → Fenwick tree. Need range min/max instead of sum → 2D segment tree** (Fenwick needs an invertible operation like `+`).

### 2. Many rectangle *updates* ("add v to every cell in a rectangle"), then read the grid
Use a 2D **difference array**: add `v` at `(r1, c1)`, subtract at `(r1, c2+1)` and `(r2+1, c1)`, add at `(r2+1, c2+1)`, then take a 2D prefix sum once at the end. That's the inverse of this problem (LC 2536 Increment Submatrices by One).

### 3. Largest-sum rectangle, or count rectangles summing to target
Fix two rows (O(m²) pairs), compress the columns between them with the prefix table, and solve the 1D problem: Kadane's algorithm for maximum sum, or [Subarray Sum Equals K](./41_Subarray%20Sum%20Equals%20K.md) for counting (LC 1074). O(m² · n).

### 4. 3D or higher
Same idea. In d dimensions, inclusion–exclusion uses `2^d` terms (8 in 3D).

### 5. Matrix too large for memory
Build the summed-area table in tiles, or store it on disk / in a columnar store. In practice, databases and OLAP cubes precompute exactly these cumulative aggregates.

## Common mistakes

- Not padding, then writing `P[row1 - 1]` and crashing (or reading `undefined` → `NaN`) when `row1 = 0`.
- Mixing up `+1` offsets: with padding, the bottom-right term is `P[row2 + 1][col2 + 1]`, and the others use `row1` and `col1` **without** `+1`.
- Forgetting to add back the corner `P[row1][col1]`.
- Building with `Array(m + 1).fill(new Array(n + 1).fill(0))`: every row is the **same** array object. Use `Array.from`.
- Using `Int32Array` for large sums (silent wrap-around).
- Recomputing prefix sums inside `sumRegion` instead of the constructor.
