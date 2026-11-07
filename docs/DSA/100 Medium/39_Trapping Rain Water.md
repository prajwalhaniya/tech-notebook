---
sidebar_position: 39
---

# Trapping Rain Water

> **LeetCode 42 · Hard · Patterns: Prefix/Suffix Max → Two Pointers → Monotonic Stack**

> Companies: Google, Amazon, Meta, Microsoft, Apple, Goldman Sachs, Bloomberg, Uber. One of the most-asked hards. It's ideal for showing a **progression**: brute force, then precomputation, then O(1) space, then a different paradigm (the stack).

Given `n` non-negative integers representing an elevation map where each bar has width `1`, compute how much water it can trap after raining.

```
Input: height = [0,1,0,2,1,0,1,3,2,1,2,1]  → Output: 6
Input: height = [4,2,0,3,2,5]              → Output: 9
```

```
                            █
                █  ≈  ≈  ≈  █  █  ≈  █
          █  ≈  █  █  ≈  █  █  █  █  █  █
  idx: 0  1  2  3  4  5  6  7  8  9  10 11      (≈ = trapped water, total 6)
```

Constraints (LeetCode): `1 <= n <= 2 * 10^4`, `0 <= height[i] <= 10^5`.

---

## 1. Understand

Think **per column**, not per pool. The water above bar `i` rises to the level of the **shorter of the tallest wall on its left and the tallest wall on its right**:

```
water[i] = min(maxLeft[i], maxRight[i]) - height[i]
```

`maxLeft[i]` includes `height[i]` itself, so the result is never negative. The total is the sum over all `i`.

That single formula is the whole problem. Every solution below is just a cheaper way to get `maxLeft` and `maxRight`.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Width of each bar? | 1, so the water per column is just a height. |
| Do the edges hold water? | No. Water spills off both ends, so the first and last bars always hold 0. |
| Can heights be 0? Negative? | 0 yes, negative no. Negative heights would need a redefinition. |
| Empty array or n < 3? | Return 0. Holding any water needs at least 3 bars. |
| Overflow? | The maximum is 10^5 × 2·10^4 = 2·10^9. That's fine in JS, but it overflows a 32-bit int in Java/C++, so mention `long`. |
| 1D or 2D? | 2D is Trapping Rain Water II, a different algorithm (a heap). See the follow-ups. |

**Edge cases:** `[]`, `[5]`, `[2,0]`, strictly increasing or decreasing (0 water), flat `[3,3,3]` (0), a deep valley `[5,1,1,1,5]` (12), uneven walls `[4,2,3]` (1, limited by the shorter wall).

## 3. Brute force: for each bar, scan both directions

```js
function trapBrute(height) {
  const n = height.length;
  let water = 0;

  for (let i = 0; i < n; i++) {
    let leftMax = 0;
    let rightMax = 0;
    for (let j = 0; j <= i; j++) leftMax = Math.max(leftMax, height[j]);
    for (let j = i; j < n; j++) rightMax = Math.max(rightMax, height[j]);
    water += Math.min(leftMax, rightMax) - height[i];
  }

  return water;
}
```

- Time **O(n²)**, Space **O(1)**.
- **Why it works:** it applies the per-column formula directly.
- **When it's preferable:** as a testing oracle, and to show you understand the formula before optimizing.
- **Limitations:** it recomputes the same maxima again and again. At n = 2·10^4 that's about 4·10^8 operations, which is borderline or a TLE.

## 4. Optimize: find the bottleneck

**Bottleneck 1 is repeated work.** `maxLeft[i]` is just `max(maxLeft[i-1], height[i])`, a running prefix max. Precompute both directions once, which gives **O(n) time and O(n) space**.

**Bottleneck 2 is the extra arrays.** Do we really need **both** maxima for every index? No. We only need `min(maxLeft, maxRight)`. If we know that one side's max is the smaller one, we don't need the exact value of the other side.

With two pointers, if `height[left] < height[right]`, then there's a wall on the right at least as tall as `height[left]`, and `leftMax` (built from bars we've already passed) is the true left max. Whatever the real right max is, it's ≥ `height[right]`. As long as we always advance the side with the smaller bar, the side we process is guaranteed to be the limiting one, so `water[left] = leftMax - height[left]` is exact. That gives **O(n) time and O(1) space**.

## 5. Patterns

1. **Prefix/suffix aggregates:** precompute running max/min/sum from both ends so each index can answer "what's on my left/right" in O(1). It's also used in Product of Array Except Self, and Best Time to Buy and Sell Stock.
2. **Two pointers with running maxima:** keep only the running max on each side and process the side whose bound is already known to be the minimum. It's the same "move the limiting side" idea as [Container With Most Water](./08_Container%20with%20most%20water.md).
3. **Monotonic decreasing stack:** fill water **horizontally, layer by layer**. When a taller bar arrives, it closes a basin with the previous taller bar. It's also used in Largest Rectangle in Histogram, Daily Temperatures, and Next Greater Element.

## 6. Implement

### a) Prefix and suffix max arrays. O(n) time, O(n) space

The easiest optimal-time solution to explain. Present it first, then improve the space.

```js
function trapPrefix(height) {
  const n = height.length;
  if (n === 0) return 0;

  const leftMax = new Array(n);
  const rightMax = new Array(n);

  leftMax[0] = height[0];
  for (let i = 1; i < n; i++) leftMax[i] = Math.max(leftMax[i - 1], height[i]);

  rightMax[n - 1] = height[n - 1];
  for (let i = n - 2; i >= 0; i--) rightMax[i] = Math.max(rightMax[i + 1], height[i]);

  let water = 0;
  for (let i = 0; i < n; i++) water += Math.min(leftMax[i], rightMax[i]) - height[i];
  return water;
}
```

- **Why it works:** it's the exact per-column formula, with each max computed once.
- **When it's preferable:** clarity matters, the data is read many times (the arrays can be reused for range queries), or you're explaining it to a junior engineer.
- **Limitations:** 2n extra memory and three passes.

### b) Two pointers (the interview answer). O(n) time, O(1) space

```js
/**
 * @param {number[]} height
 * @return {number}
 */
function trap(height) {
  let left = 0;
  let right = height.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let water = 0;

  while (left < right) {
    if (height[left] < height[right]) {
      // The right side has a wall ≥ height[left], so the left side is the bottleneck.
      leftMax = Math.max(leftMax, height[left]);
      water += leftMax - height[left];
      left++;
    } else {
      // The left side has a wall ≥ height[right], so the right side is the bottleneck.
      rightMax = Math.max(rightMax, height[right]);
      water += rightMax - height[right];
      right--;
    }
  }

  return water;
}
```

**Why it works (the invariant):** when we process `left`, `leftMax` is the true left max, and it's ≤ the true right max:
- `leftMax` is the max of `height[0..left]`, so it's exactly the true left max.
- Every bar that contributed to `leftMax` was processed while it was **smaller** than the bar at the right pointer at that moment. Pointers only move inward, so that right bar is still in `height[right..n-1]`.
- So `leftMax ≤ max(height[right..n-1]) ≤ trueRightMax`. That means `min(trueLeftMax, trueRightMax) = leftMax`, and `leftMax - height[left]` is exact. The case for `right` is symmetric.

- **When it's preferable:** memory-constrained settings, or when the interviewer asks for O(1) space.
- **Limitations:** the correctness argument is subtle, so practise saying it. It's also a one-shot computation, with nothing reusable for queries.

## 7. Complexity

| Approach | Time | Space | Passes |
| --- | --- | --- | --- |
| Brute force | O(n²) | O(1) | n |
| Prefix + suffix max | O(n) | O(n) | 3 |
| **Two pointers** | **O(n)** | **O(1)** | **1** |
| Monotonic stack | O(n) amortized | O(n) | 1 |

Each index is pushed onto and popped from the stack at most once, so the stack solution is O(n) amortized even with the inner `while`.

## 8. Testing

```js
const tests = [
  [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], 6], // classic
  [[4, 2, 0, 3, 2, 5], 9],                   // classic 2
  [[], 0],                                   // empty
  [[5], 0],                                  // single bar
  [[2, 0], 0],                               // two bars, water spills off the edge
  [[2, 0, 2], 2],                            // smallest basin
  [[1, 2, 3, 4, 5], 0],                      // increasing
  [[5, 4, 3, 2, 1], 0],                      // decreasing
  [[3, 3, 3], 0],                            // flat
  [[5, 1, 1, 1, 5], 12],                     // wide valley
  [[5, 2, 1, 2, 1, 5], 14],                  // bumpy valley under one level
  [[4, 2, 3], 1],                            // limited by the SHORTER wall
];

for (const [h, expected] of tests) {
  console.assert(trap(h) === expected, `trap(${h}) should be ${expected}, got ${trap(h)}`);
}

// Adversarial: random arrays, every approach checked against brute force
for (let t = 0; t < 1000; t++) {
  const h = Array.from({ length: Math.floor(Math.random() * 15) }, () => Math.floor(Math.random() * 8));
  const expected = trapBrute(h);
  console.assert(trap(h) === expected && trapPrefix(h) === expected && trapStack(h) === expected, h);
}

// Adversarial: max-size deep valley. Water ≈ 2e9 (overflows int32 in Java/C++).
const valley = [1e5, ...new Array(2e4 - 2).fill(0), 1e5];
console.assert(trap(valley) === 1e5 * (2e4 - 2));
```

**Dry run (two pointers)** for `[4,2,0,3,2,5]`:

| left (h) | right (h) | branch | leftMax / rightMax | water added | total |
| --- | --- | --- | --- | --- | --- |
| 0 (4) | 5 (5) | left | 4 / 0 | 0 | 0 |
| 1 (2) | 5 (5) | left | 4 / 0 | 2 | 2 |
| 2 (0) | 5 (5) | left | 4 / 0 | 4 | 6 |
| 3 (3) | 5 (5) | left | 4 / 0 | 1 | 7 |
| 4 (2) | 5 (5) | left | 4 / 0 | 2 | 9 |
| 5 | 5 | stop | | | **9** |

## 9. Alternatives

### Monotonic stack: fill water layer by layer. O(n) time, O(n) space

Keep a stack of indices with **decreasing** heights. When `height[i]` is taller than the top, the top is the **bottom** of a basin. The new top (if any) is the left wall and `i` is the right wall. Add the horizontal strip `width × (min(leftWall, rightWall) - bottom)`.

```js
function trapStack(height) {
  const stack = []; // indices; heights strictly decreasing from bottom to top
  let water = 0;

  for (let i = 0; i < height.length; i++) {
    while (stack.length && height[i] > height[stack[stack.length - 1]]) {
      const bottom = stack.pop();
      if (!stack.length) break;                 // no left wall, so water spills off

      const leftIdx = stack[stack.length - 1];
      const width = i - leftIdx - 1;
      const boundedHeight = Math.min(height[leftIdx], height[i]) - height[bottom];
      water += width * boundedHeight;
    }
    stack.push(i);
  }

  return water;
}
```

- **Why it works:** each pop closes off one horizontal layer of a basin, bounded by the nearest taller bar on each side. Every unit of water belongs to exactly one layer, so it's counted once.
- **When it's preferable:** a **single forward pass / streaming** setting, where you can't see the right end of the data in advance (the two-pointer method needs random access to both ends). It also builds the monotonic-stack muscle you need for Largest Rectangle in Histogram.
- **Limitations:** O(n) stack space, and the horizontal reasoning is harder to explain than the per-column formula.

### Two-pass "global max" variant. O(n) time, O(1) space

Find the index of the tallest bar. Sweep from the left up to it, keeping a running `leftMax` (the right bound is guaranteed by the peak), and do the same from the right. It's an easier proof than the two-pointer version, at the cost of two passes. It's a nice alternative to mention.

---

## Follow-ups interviewers ask

1. **Trapping Rain Water II (2D grid, LeetCode 407):** use a **min-heap BFS from the boundary**. Push all border cells and repeatedly pop the lowest one (the current "water level" wall). For each unvisited neighbour, add `max(0, level - h)` and push it with `max(level, h)`. Time O(mn log(mn)). The 1D "min of left max and right max" idea fails in 2D because water can leak diagonally around obstacles.
2. **Streaming input:** use the monotonic stack. It finalizes water as soon as a basin closes.
3. **Which bars hold the most water / return the per-index water:** use the prefix/suffix version and return the `water[i]` array.
4. **Container With Most Water vs Trapping Rain Water:** be ready to explain the difference. In [Container With Most Water](./08_Container%20with%20most%20water.md) you pick 2 lines and the bars in between are ignored. Here, all bars count and the water is summed.
5. **Pour Water (LeetCode 755) / simulate V units of water dropped at index K:** a simulation problem that tests the same "where does water settle" reasoning.
6. **Bars with different widths:** multiply each column's water by its width. The two-pointer logic is unchanged.

## Common mistakes

- Using `max(leftMax, rightMax)` instead of `min`.
- Updating `leftMax` **after** adding water, which can add a negative amount. Update it first, so `leftMax - height[left] ≥ 0`.
- Forgetting the `if (!stack.length) break` in the stack version. Without it, water "trapped" against nothing gets counted.
- Using `<=` vs `<` inconsistently in the two-pointer branch. Either works, as long as the side you process is never taller than the other.
- Using 32-bit ints in Java/C++ for the max-constraint case.
