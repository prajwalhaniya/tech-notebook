---
sidebar_position: 8
---

# Container With Most Water

> **LeetCode 11 · Medium · Pattern: Two Pointers (greedy elimination)**

> Companies: Amazon, Google, Meta, Microsoft, Bloomberg, Adobe, Goldman Sachs. The code is short, so interviewers grade you on the **proof**: why moving the shorter pointer never misses the answer.

You are given an integer array `height` of length `n`. There are `n` vertical lines drawn so that the two endpoints of the `i`th line are `(i, 0)` and `(i, height[i])`.

Find two lines that, together with the x-axis, form a container that holds the most water. Return that maximum amount. You may not slant the container.

```
Input: height = [1,8,6,2,5,4,8,3,7]  → Output: 49   (lines at index 1 (h=8) and 8 (h=7): width 7 × min(8,7) = 49)
Input: height = [1,1]                → Output: 1
```

Constraints (LeetCode): `2 <= n <= 10^5`, `0 <= height[i] <= 10^4`.

---

## 1. Understand

Choose two indices `i < j`. The water they hold is

```
area(i, j) = (j - i) × min(height[i], height[j])
```

The shorter wall limits the water level, and the lines **between** them don't matter: they don't block or displace any water. Maximize this over all pairs.

> Don't confuse this with **[Trapping Rain Water](./39_Trapping%20Rain%20Water.md)**. There, every bar matters and you sum the water over all positions. Here, you pick just **two** walls.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Do the lines between the two walls count? | No, they're treated as having zero thickness. (If they did, it would be a different problem.) |
| Can heights be 0? | Yes. A zero-height wall gives area 0. |
| Is n ≥ 2 guaranteed? | If not, return 0 for n < 2. |
| Return the area or the indices? | The area. Returning the indices is a simple extension: track them when `best` updates. |
| Overflow? | The maximum is 10^4 × 10^5 = 10^9, which fits in JS numbers and a 32-bit signed int (barely). |

**Edge cases:** `[1,1]`, all equal heights (the widest pair wins), strictly increasing or decreasing heights, zeros at the edges `[0,5]`, a tall pair in the middle `[1,100,100,1]`.

## 3. Brute force: every pair

```js
function maxAreaBrute(height) {
  let best = 0;

  for (let i = 0; i < height.length; i++) {
    for (let j = i + 1; j < height.length; j++) {
      best = Math.max(best, (j - i) * Math.min(height[i], height[j]));
    }
  }

  return best;
}
```

- Time **O(n²)**, Space **O(1)**.
- **Why it works:** it checks every candidate pair.
- **When it's preferable:** as a testing oracle, or for tiny n.
- **Limitations:** about 5 × 10^9 operations at n = 10^5, so it times out.

## 4. Optimize: find the bottleneck

We evaluate n²/2 pairs, but most of them can be **proven useless without computing them**.

Start with the widest container, `(0, n-1)`. Say `height[left] < height[right]`.

- Every other container using `left` as one wall has a partner `k` with `left < k < right`, so it's **narrower**.
- Its height is `min(height[left], height[k]) ≤ height[left]`, so it's **no taller**.
- So **every** container that uses `left` with something inside is ≤ the one we just measured. We can permanently discard `left` with `left++`.

Each step eliminates one line (with a proof), so we finish in n − 1 steps: **O(n)**.

If the heights are equal, discarding either one is safe. Any better container would need both walls taller than this height, so neither of the current lines can be part of it.

## 5. Pattern: Two Pointers, greedy elimination

> Start with the configuration that maximizes one factor (width). Move the pointer that **limits** the objective, because moving the other pointer can only make things worse. Each move rules out a whole row of candidate pairs.

Think of it as searching the n × n pair matrix: each comparison removes a full row or column. This is the same argument as **Two Sum II** and **Search a 2D Matrix II** (start from a corner).

The same pattern shows up in:
- Two Sum II, 3Sum
- [Trapping Rain Water](./39_Trapping%20Rain%20Water.md) (two-pointer version: move the side with the smaller max)
- Boats to Save People, and Bag of Tokens (sort first)

## 6. Implement (optimal: two pointers)

```js
/**
 * @param {number[]} height
 * @return {number}
 */
function maxArea(height) {
  let left = 0;
  let right = height.length - 1;
  let best = 0;

  while (left < right) {
    const area = (right - left) * Math.min(height[left], height[right]);
    best = Math.max(best, area);

    // Move the SHORTER wall: it's the bottleneck, and it can't do better with any narrower partner.
    if (height[left] < height[right]) {
      left++;
    } else {
      right--;
    }
  }

  return best;
}
```

- **Why it works:** see the elimination proof in section 4. The invariant is that the best container not yet ruled out lies inside `[left, right]`.
- **When it's preferable:** always. It's optimal in time and space.
- **Limitations:** it relies on the area being "width × min(heights)". For other cost functions (counting the bars in between, weights per index, and so on) the elimination argument may not hold.

**Why moving the taller wall is wrong:** the height stays capped by the shorter wall, and the width shrinks, so the area can only decrease. You'd risk discarding the taller wall, which might be part of the optimum.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Brute force | O(n²) | O(1) |
| **Two pointers** | **O(n)** | **O(1)** |
| Two pointers + skip (alt. a) | O(n), fewer area computations | O(1) |

It can't beat O(n): any algorithm must read every height, because a single unread tall line could change the answer.

## 8. Testing

```js
const tests = [
  [[1, 8, 6, 2, 5, 4, 8, 3, 7], 49], // classic
  [[1, 1], 1],                       // minimal
  [[4, 3, 2, 1, 4], 16],             // the edges win
  [[1, 2, 1], 2],                    // the edges win over the tall middle
  [[0, 0], 0],                       // zero heights
  [[0, 5], 0],                       // one zero wall
  [[2, 3, 4, 5, 18, 17, 6], 17],     // tall adjacent pair in the middle
  [[1, 2, 3, 4, 5], 6],              // strictly increasing
  [[5, 5, 5, 5], 15],                // all equal, the widest wins
];

for (const [h, expected] of tests) {
  console.assert(maxArea(h) === expected, `maxArea(${h}) should be ${expected}, got ${maxArea(h)}`);
}

// Adversarial: random arrays checked against brute force (this catches the "move the taller" bug)
for (let t = 0; t < 1000; t++) {
  const h = Array.from({ length: 2 + Math.floor(Math.random() * 12) }, () => Math.floor(Math.random() * 10));
  console.assert(maxArea(h) === maxAreaBrute(h), h);
}

// Adversarial: n = 1e5 with all max heights. The answer is 1e4 * (1e5 - 1), close to 1e9.
console.assert(maxArea(new Array(1e5).fill(1e4)) === 1e4 * (1e5 - 1));
```

**Dry run** for `[1,8,6,2,5,4,8,3,7]`:

| left (h) | right (h) | width | area | best | move |
| --- | --- | --- | --- | --- | --- |
| 0 (1) | 8 (7) | 8 | 8 | 8 | left (1 < 7) |
| 1 (8) | 8 (7) | 7 | **49** | 49 | right (8 ≥ 7) |
| 1 (8) | 7 (3) | 6 | 18 | 49 | right |
| 1 (8) | 6 (8) | 5 | 40 | 49 | right (equal) |
| 1 (8) | 5 (4) | 4 | 16 | 49 | right |
| ... | ... | | | 49 | |

## 9. Alternatives

### a) Two pointers that skip walls no taller than the current one

After measuring with water level `h = min(height[l], height[r])`, any inner wall ≤ `h` can't produce a better container (it would be narrower and no taller). Skip those walls without computing their areas.

```js
function maxAreaSkip(height) {
  let left = 0;
  let right = height.length - 1;
  let best = 0;

  while (left < right) {
    const h = Math.min(height[left], height[right]);
    best = Math.max(best, h * (right - left));

    while (left < right && height[left] <= h) left++;
    
    while (left < right && height[right] <= h) right--;
  }
  
  return best;
}
```

- **When it's preferable:** lots of short walls. It does fewer multiplications, but the asymptotic complexity is the same.
- **Limitations:** it's slightly trickier, and it's easy to write `<` where `<=` is needed. With `<`, equal walls never get skipped and the loop never ends.

### b) Sort by height, then sweep (O(n log n), conceptual)

Process lines from tallest to shortest, keeping the min and max index seen so far. For each line as the **shorter** wall, the best partner is the farthest already-seen (taller) line: `area = h × max(i - minIdx, maxIdx - i)`. It's correct but slower. It's useful to mention as a different way of thinking: fix the limiting height, then maximize the width.

---

## Follow-ups interviewers ask

1. **Return the indices:** store `[left, right]` whenever `best` improves.
2. **Prove it** (they almost always ask): give the elimination argument from section 4 in two sentences: "Every container using the shorter wall with a narrower partner is at most as tall and strictly narrower, so it can't beat the current one. Discard that wall."
3. **What if the walls have thickness, or the inner bars block water?** That becomes [Trapping Rain Water](./39_Trapping%20Rain%20Water.md) or a different formula. Re-derive whether the greedy still holds.
4. **The largest rectangle formed by bars** (not water): that's Largest Rectangle in Histogram, solved with a **monotonic stack**. A different pattern, often confused with this one.
5. **3D version / pick k walls:** discuss. There's no clean greedy, so it usually needs DP or a heap.

## Common mistakes

- Moving the taller pointer, or always moving `left`.
- Using `max` instead of `min` for the height.
- Width written as `right - left + 1`. The distance between the lines is `right - left`.
- Thinking the inner bars reduce capacity.
