---
sidebar_position: 6
---

# Largest Rectangle in Histogram

> **LeetCode 84 · Hard · Pattern: Monotonic Stack (previous and next smaller element)**

> Companies: Google, Amazon, Meta, Microsoft, Bloomberg, Uber. It's the classic Hard monotonic-stack problem, and it unlocks **Maximal Rectangle (LC 85)**, which reduces to it. Interviewers look for the key insight (**the best rectangle is as tall as some bar and stretches to that bar's nearest shorter neighbours**), the stack mechanics (sentinels, width calculation, equal heights), and the O(n) amortized argument. Learn [Daily Temperatures](./05_Daily%20Temperatures.md) first; it's the same tool.

Given an array `heights` of bar heights in a histogram where each bar has width `1`, return the **area of the largest rectangle** in the histogram.

```
Input: heights = [2,1,5,6,2,3]   → Output: 10   (bars 5 and 6: height 5 × width 2)
Input: heights = [2,4]           → Output: 4
```

```
        ▇
      ▇ ▇
      ▇ ▇
      ▇ ▇   ▇
  ▇   ▇ ▇ ▇ ▇
  ▇ ▇ ▇ ▇ ▇ ▇      heights = [2,1,5,6,2,3]
      └─┘            best: height 5 over indices 2..3 → area 10
```

Constraints (LeetCode): `1 <= heights.length <= 10^5`, `0 <= heights[i] <= 10^4`.

---

## 1. Understand

A rectangle covers a contiguous range of bars `[l, r]`, and its height can be at most the **shortest** bar in that range. So the area of range `[l, r]` is `min(heights[l..r]) × (r − l + 1)`. We want the maximum over all ranges.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Can heights be 0? | Yes. A zero bar splits the histogram: no rectangle with positive area crosses it. |
| Bar widths all 1? | Yes. With different widths you'd use prefix sums of widths for the width calculation. |
| Return the area, or the rectangle itself? | Same algorithm. Record `l`, `r` and the height when you update the best. |
| Overflow? | Max area `10^4 × 10^5 = 10^9` fits in 32-bit signed int, barely. Use `long` in Java/C++ to be safe. |

**Edge cases:** one bar, all equal (`[3,3,3]` → 9), strictly increasing (`[1,2,3,4,5]` → 9), strictly decreasing, zeros (`[2,0,2]` → 2), and the widest rectangle using the shortest bar (`[2,1,2]` → 3).

## 3. Brute force

### a) Every range, minimum recomputed — O(n³)
Mention it, then improve it immediately.

### b) Every range, with a running minimum — O(n²)

```js
function largestRectangleBrute(heights) {
  let best = 0;
  for (let l = 0; l < heights.length; l++) {
    let minH = Infinity;
    for (let r = l; r < heights.length; r++) {
      minH = Math.min(minH, heights[r]);            // min of heights[l..r], extended by one bar
      best = Math.max(best, minH * (r - l + 1));
    }
  }
  return best;
}
```

### c) Expand around each bar — O(n²)

For each bar, take its height and expand left and right while the neighbours are at least as tall. This version leads directly to the optimization.

```js
function largestRectangleExpand(heights) {
  let best = 0;
  for (let i = 0; i < heights.length; i++) {
    let l = i, r = i;
    while (l > 0 && heights[l - 1] >= heights[i]) l--;
    while (r < heights.length - 1 && heights[r + 1] >= heights[i]) r++;
    best = Math.max(best, heights[i] * (r - l + 1));
  }
  return best;
}
```

- Time **O(n²)**, space O(1).
- **Why (c) works:** the optimal rectangle's height equals its shortest bar, say bar `i`. Expanding from `i` while bars are `>= heights[i]` finds the widest rectangle at that height. So trying every bar covers the optimum.
- **When it's preferable:** tiny inputs, or as a test oracle.
- **Limitations:** 10^10 steps for 10^5 equal bars. Too slow.

## 4. Optimize: find the bottleneck

Brute force (c) is the right idea. For each bar `i`, the widest rectangle of height `heights[i]` stretches from just after the **previous smaller** bar to just before the **next smaller** bar:

```
width(i) = nextSmaller(i) − prevSmaller(i) − 1
area(i)  = heights[i] × width(i)
```

The bottleneck is finding those boundaries by walking, which is O(n) per bar. But "nearest smaller element to the left or right" is exactly what a **monotonic stack** computes for all elements in O(n) total (see the template in [Daily Temperatures](./05_Daily%20Temperatures.md)).

There's an even neater single-pass trick. Keep a stack of bars with **increasing** heights. When bar `i` is shorter than the top, `i` is the top's **next smaller**, and the element below the top is its **previous smaller**. So both boundaries are known at the moment the top is popped, and its area can be computed right then.

## 5. Pattern: monotonic stack for previous and next smaller

> When each element "owns" a range bounded by the nearest smaller (or larger) elements on both sides, compute those boundaries with a monotonic stack. The answer is an aggregate over the elements' ranges.

| Problem | Each element's range | Aggregate |
| --- | --- | --- |
| **Largest Rectangle in Histogram (84)** | Between previous and next smaller | max of `height × width` |
| Maximal Rectangle (85) | Same, on each row's histogram | max over rows |
| Sum of Subarray Minimums (907) | Subarrays where `a[i]` is the minimum: `(i − prev) × (next − i)` | sum of `a[i] × count` |
| Sum of Subarray Ranges (2104) | Same idea for both min and max | sum of max − min |
| Maximum Subarray Min-Product (1856) | Between previous and next smaller | max of `a[i] × rangeSum` (with prefix sums) |
| [Trapping Rain Water](../Two%20Pointers/05_Trapping%20Rain%20Water.md) (42) | Basins between taller walls | sum |

## 6. Implement (optimal: one pass with an increasing stack)

```js
/**
 * @param {number[]} heights
 * @return {number}
 */
function largestRectangleArea(heights) {
  const n = heights.length;
  const stack = [];          // indices; heights increasing from bottom to top
  let best = 0;

  // i === n acts as a sentinel bar of height 0, which forces every remaining bar to pop.
  for (let i = 0; i <= n; i++) {
    const h = i === n ? 0 : heights[i];

    while (stack.length > 0 && heights[stack[stack.length - 1]] >= h) {
      const top = stack.pop();
      // Bar `top` extends right up to i - 1 (i is its next smaller-or-equal bar),
      // and left down to just after the new stack top (its previous smaller bar).
      const left = stack.length > 0 ? stack[stack.length - 1] : -1;
      const width = i - left - 1;
      best = Math.max(best, heights[top] * width);
    }
    stack.push(i);
  }

  return best;
}
```

- **Why it works:**
  - **Invariant:** the stack holds indices with **strictly increasing** heights. For each index on it, the index just below is its previous smaller bar (anything between them was taller and already popped).
  - When bar `i` is not taller than the top, the top's rectangle can't extend past `i - 1`. Its left boundary is the new stack top. So its maximal width is known exactly, and its area is computed once.
  - Every bar is pushed once and popped once (the sentinel pops everything at the end), so every bar's maximal rectangle is considered.
- **Equal heights (`>=` vs `>`):** popping on `>=` means an equal bar ends the earlier one's rectangle too early. That's fine: the **last** bar of a run of equal heights is popped later with the full width, so the maximum is still found. Popping on `>` also works. Either way, the area is computed correctly for at least one bar in each run of equal heights. Say this, because interviewers ask.
- **Why the sentinel:** without the final height-0 bar, increasing bars left on the stack would never be popped (`[1,2,3]` would return 0). The alternative is a cleanup loop after the main loop.
- **When it's preferable:** the standard answer: one pass, O(n), short.
- **Limitations:** dense and easy to get off by one. The two-pass version below is easier to derive and explain.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| All ranges, min recomputed | O(n³) | O(1) |
| All ranges with running min / expand around each bar | O(n²) | O(1) |
| Divide and conquer around the minimum (alt. c) | O(n log n) average, **O(n²) worst** (sorted input) | O(n) recursion worst |
| Divide and conquer + segment tree for range min | O(n log n) | O(n) |
| **Monotonic stack, one pass** | **O(n)** amortized | **O(n)** |
| Two passes for boundaries (alt. a) | O(n) | O(n) |

## 8. Testing

```js
const tests = [
  [[2, 1, 5, 6, 2, 3], 10],
  [[2, 4], 4],
  [[5], 5],                 // one bar
  [[0], 0],                 // zero height
  [[3, 3, 3], 9],           // all equal (the >= case)
  [[1, 2, 3, 4, 5], 9],     // increasing: 3 × 3
  [[5, 4, 3, 2, 1], 9],     // decreasing
  [[2, 1, 2], 3],           // the shortest bar spans everything
  [[2, 0, 2], 2],           // zero splits the histogram
  [[6, 2, 5, 4, 5, 1, 6], 12],
  [[4, 2, 0, 3, 2, 5], 6],
];

for (const [h, expected] of tests) {
  console.assert(largestRectangleArea(h) === expected, `${h} → ${largestRectangleArea(h)}`);
  console.assert(largestRectangleBrute(h) === expected && largestRectangleExpand(h) === expected, `brute ${h}`);
}

// Adversarial: random histograms with many ties and zeros, against the brute force
for (let k = 0; k < 3000; k++) {
  const n = 1 + Math.floor(Math.random() * 15);
  const h = Array.from({ length: n }, () => Math.floor(Math.random() * 5));
  console.assert(largestRectangleArea(h) === largestRectangleBrute(h), h);
}

// Adversarial: 10^5 equal bars (quadratic for expand-around-each-bar), max values
console.assert(largestRectangleArea(new Array(1e5).fill(1e4)) === 1e9);
```

**Dry run** for `[2, 1, 5, 6, 2, 3]` (stack as `index(height)`):

| i | h | popped → area | stack after |
| --- | --- | --- | --- |
| 0 | 2 | — | 0(2) |
| 1 | 1 | 0(2): width `1 − (−1) − 1 = 1` → 2 | 1(1) |
| 2 | 5 | — | 1(1) 2(5) |
| 3 | 6 | — | 1(1) 2(5) 3(6) |
| 4 | 2 | 3(6): width `4 − 2 − 1 = 1` → 6; 2(5): width `4 − 1 − 1 = 2` → **10** | 1(1) 4(2) |
| 5 | 3 | — | 1(1) 4(2) 5(3) |
| 6 (sentinel 0) | 0 | 5(3): width 1 → 3; 4(2): width `6 − 1 − 1 = 4` → 8; 1(1): width `6 − (−1) − 1 = 6` → 6 | 6 |

Best: `10`.

## 9. Alternatives

### a) Two passes: compute both boundaries explicitly

```js
function largestRectangleTwoPass(heights) {
  const n = heights.length;
  const prevSmaller = new Array(n);     // index of the nearest bar to the left that is shorter, or -1
  const nextSmaller = new Array(n);     // index of the nearest bar to the right that is shorter, or n
  const stack = [];

  for (let i = 0; i < n; i++) {
    while (stack.length && heights[stack[stack.length - 1]] >= heights[i]) stack.pop();
    prevSmaller[i] = stack.length ? stack[stack.length - 1] : -1;
    stack.push(i);
  }
  stack.length = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (stack.length && heights[stack[stack.length - 1]] >= heights[i]) stack.pop();
    nextSmaller[i] = stack.length ? stack[stack.length - 1] : n;
    stack.push(i);
  }

  let best = 0;
  for (let i = 0; i < n; i++) {
    best = Math.max(best, heights[i] * (nextSmaller[i] - prevSmaller[i] - 1));
  }
  return best;
}
```

- Time O(n), space O(n) for two extra arrays.
- **Why it works:** it computes exactly the boundaries from the insight in section 4, one monotonic-stack pass each.
- **When it's preferable:** easiest to derive and explain under pressure: "for each bar, find the previous and next smaller, then area = height × width." The boundary arrays are reusable (e.g. Sum of Subarray Minimums needs the same arrays with careful tie-breaking).
- **Limitations:** three passes and two extra arrays. It's still O(n).

### b) Boundaries by jumping (no stack)

Compute `prevSmaller[i]` by starting at `p = i − 1` and jumping `p = prevSmaller[p]` while `heights[p] >= heights[i]`. Do the same from the right. The jumps skip runs of taller bars, the same trick as the O(1)-space [Daily Temperatures](./05_Daily%20Temperatures.md) solution. It's O(n) amortized, and some find it more intuitive than a stack.

### c) Divide and conquer around the minimum

The best rectangle either uses the **shortest bar** across the whole range (area `min × width`), or lies entirely to its left or right. Recurse on both sides.

```js
function largestRectangleDivide(heights, lo = 0, hi = heights.length - 1) {
  if (lo > hi) return 0;
  let m = lo;
  for (let i = lo + 1; i <= hi; i++) if (heights[i] < heights[m]) m = i;   // O(n) min scan
  return Math.max(
    heights[m] * (hi - lo + 1),
    largestRectangleDivide(heights, lo, m - 1),
    largestRectangleDivide(heights, m + 1, hi),
  );
}
```

- Time O(n log n) on average, but **O(n²)** on sorted input (the minimum is always at an end, like quicksort's bad pivot). A segment tree for range-minimum queries makes it O(n log n) worst case. Recursion depth can reach n.
- **When it's preferable:** it's a natural first idea and a good thing to mention. The stack is strictly better.

---

## Follow-ups interviewers ask

### 1. Maximal Rectangle (LC 85, Hard): largest rectangle of 1s in a binary matrix

Treat each row as the base of a histogram: `height[c]` is the number of consecutive 1s ending at this row in column `c`. Run this algorithm on every row.

```js
function maximalRectangle(matrix) {
  if (matrix.length === 0) return 0;
  const cols = matrix[0].length;
  const height = new Array(cols).fill(0);
  let best = 0;
  for (const row of matrix) {
    for (let c = 0; c < cols; c++) height[c] = row[c] === '1' ? height[c] + 1 : 0;
    best = Math.max(best, largestRectangleArea(height));
  }
  return best;
}
```

That's O(rows × cols) time and O(cols) space. **Maximal Square (LC 221)** is different: it's a simpler DP, `dp[r][c] = 1 + min(up, left, upLeft)`.

### 2. Sum of Subarray Minimums (LC 907)
Each `a[i]` is the minimum of `(i − prev) × (next − i)` subarrays. To avoid counting a subarray twice when values tie, use **strict** `<` on one side and **non-strict** `<=` on the other. The two-pass code above, with that tie-break, gives the boundaries.

### 3. Return the rectangle itself
When updating `best`, record `left + 1`, `i − 1` and `heights[top]`.

### 4. Bars with different widths
Replace indices with positions: keep prefix sums of widths, and compute the width of `(left, i)` as `prefix[i] − prefix[left + 1]`.

### 5. Why O(n) with a nested loop?
Each index is pushed once and popped once (the sentinel guarantees every push is matched by a pop). Total stack operations ≤ 2(n + 1).

## Common mistakes

- Forgetting the final sentinel or cleanup loop, which misses increasing runs.
- Computing the width as `i − top` instead of `i − newTop − 1`. After popping, the left boundary is the **new** top, not the popped index.
- Using `0` instead of `-1` as the left boundary when the stack is empty.
- Thinking equal heights break the `>=` version (they don't; the last equal bar gets the full width).
- Using the divide-and-conquer version and claiming O(n log n) worst case without a segment tree.
