---
sidebar_position: 45
---

# Find Minimum in Rotated Sorted Array

> **LeetCode 153 · Medium · Pattern: Binary Search on a boundary (compare with the right end)**

> Companies: Amazon, Microsoft, Meta, Google, Bloomberg. Often asked together with [Search in Rotated Sorted Array](./44_Search%20in%20Rotated%20Sorted%20Array.md), since the minimum's index is the rotation point. The thing interviewers probe: **why compare `nums[mid]` with `nums[hi]` and not `nums[lo]`?** The follow-up is duplicates (LC 154).

An ascending array of **distinct** integers of length `n` was rotated between 1 and `n` times, so `[0,1,2,4,5,6,7]` might become `[4,5,6,7,0,1,2]` (rotated 4 times) or stay `[0,1,2,4,5,6,7]` (rotated `n` times). Return the **minimum element**. You must write an algorithm that runs in **O(log n)** time.

```
Input: nums = [3,4,5,1,2]         → Output: 1
Input: nums = [4,5,6,7,0,1,2]     → Output: 0
Input: nums = [11,13,15,17]       → Output: 11   (not rotated)
```

Constraints (LeetCode): `1 <= n <= 5000`, `-5000 <= nums[i] <= 5000`, all values are **unique**, `nums` is sorted and rotated between 1 and `n` times.

Prerequisite: [Binary Search](../100%20Easy/24_Binary%20Search.md).

---

## 1. Understand

The array is a high sorted run followed by a low sorted run. The minimum is the first element of the low run, which is the only element smaller than its left neighbour (the "drop"). If there's no drop, the array isn't rotated and the minimum is `nums[0]`.

```
[4, 5, 6, 7, 0, 1, 2]
             ↑ minimum: the only place where nums[i] < nums[i-1]
```

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Distinct values? | With duplicates (LC 154), `nums[mid] === nums[hi]` is ambiguous and the worst case is O(n). |
| Return the value or the index? | The index is the rotation count and the pivot for searching. Same algorithm, return `lo` instead of `nums[lo]`. |
| Could it be unrotated? | Yes ("rotated `n` times"). The algorithm must return `nums[0]`. |
| Ascending? | Descending flips the comparisons. |

**Edge cases:** one element, two elements (`[2,1]`, `[1,2]`), no rotation, rotation by 1 (`[7,0,1,2,4,5,6]`, minimum at index 1) or by `n − 1` (`[1,2,4,5,6,7,0]`, minimum at the end), and negative values.

## 3. Brute force

### a) Scan everything — O(n)

```js
function findMinLinear(nums) {
  let min = nums[0];
  for (const x of nums) if (x < min) min = x;
  return min;
}
```

### b) Scan for the drop — O(n), but stops early

```js
function findMinDrop(nums) {
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < nums[i - 1]) return nums[i];   // first (and only) drop
  }
  return nums[0];                                // no drop: not rotated
}
```

- Time **O(n)** worst case, space **O(1)**.
- **Why it works:** (a) checks every element; (b) uses the shape, since the minimum is right after the only drop.
- **When it's preferable:** tiny arrays, a test oracle, and (a) is the honest answer when duplicates make the worst case O(n) anyway.
- **Limitations:** doesn't meet O(log n). Version (b) uses the structure, but still only one element at a time.

## 4. Optimize: find the bottleneck

We're looking for a **boundary**: the first index of the low run. Binary search finds boundaries if we can classify any index as "high run" or "low run" in O(1).

Compare with the **last** element, `nums[hi]`:
- Every element of the low run is `<= nums[n−1]` (the low run ends the array).
- Every element of the high run is `> nums[n−1]` (all high values are larger than all low values).

So the predicate `nums[i] <= nums[n−1]` is `false, …, false, true, …, true`, and the minimum is the **first `true`**. That's exactly a lower-bound binary search.

### Why not compare with `nums[lo]`?

`nums[mid] > nums[lo]` happens both in a rotated array where `mid` is still in the high run (`[4,5,6,7,0,1,2]`, `mid = 3`: minimum is to the **right**) and in an unrotated array (`[0,1,2,4,5,6,7]`: minimum is to the **left**, at `lo`). The comparison with `lo` can't tell these apart; the comparison with `hi` always can. (Comparing with `lo` works if you first check `nums[lo] < nums[hi]` to detect a sorted range, as in alternative a.)

## 5. Pattern: binary search for the first `true` of a monotonic predicate

> Rewrite "find X" as "find the first index where some yes/no question becomes yes." If the answers are monotonic, use the lower-bound template: `hi = mid` on yes, `lo = mid + 1` on no.

Here the question is "is `i` in the low run?" (`nums[i] <= nums[hi]`). The same reframing appears in:
- [Search in Rotated Sorted Array](./44_Search%20in%20Rotated%20Sorted%20Array.md) (alternative a uses this to find the pivot)
- [Koko Eating Bananas](./46_Koko%20Eating%20Bananas.md) ("can she finish at speed k?")
- First Bad Version (LC 278), Find Peak Element (LC 162, compare `nums[mid]` with `nums[mid+1]`)

## 6. Implement (optimal: binary search against `nums[hi]`)

```js
/**
 * @param {number[]} nums  rotated ascending array of distinct values
 * @return {number}
 */
function findMin(nums) {
  let lo = 0;
  let hi = nums.length - 1;

  // Invariant: the minimum's index is in [lo, hi].
  while (lo < hi) {                       // stop when one candidate remains
    const mid = lo + Math.floor((hi - lo) / 2);   // mid < hi always (rounded down)

    if (nums[mid] > nums[hi]) {
      lo = mid + 1;   // mid is in the high run, so the minimum is strictly right of mid
    } else {
      hi = mid;       // nums[mid] < nums[hi]: mid is in the low run, the minimum is mid or left of it
    }
  }

  return nums[lo];                        // lo === hi: the minimum (return lo for the rotation count)
}
```

- **Why it works:**
  - **Invariant:** the minimum is in `[lo, hi]`, and `nums[lo..hi]` is itself a rotated sorted array.
  - If `nums[mid] > nums[hi]`, there's a drop between `mid` and `hi`, so `mid` and everything left of it are in the high run: the minimum is in `[mid+1, hi]`.
  - Otherwise (`nums[mid] < nums[hi]`, since values are distinct and `mid < hi`), `[mid..hi]` is sorted, so its smallest element is `nums[mid]`, and nothing right of `mid` can be the minimum: it's in `[lo, mid]`.
  - `mid` rounds down, so `mid < hi`, and both branches strictly shrink the range. The loop ends with one candidate, which by the invariant is the minimum.
- **Why `while (lo < hi)` and `hi = mid`:** `mid` itself can be the answer, so it can't be thrown away (`hi = mid − 1` would skip it). That's the lower-bound template; mixing it with `lo <= hi` loops forever.
- **When it's preferable:** always for distinct values. It's the expected answer, and it also returns the rotation point.
- **Limitations:** assumes distinct values. With duplicates, `nums[mid] === nums[hi]` doesn't say which side the minimum is on (see the follow-ups).

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Linear scan / scan for the drop | O(n) | O(1) |
| **Binary search vs `nums[hi]`** | **O(log n)** | **O(1)** |
| Recursive divide and conquer (alt. c) | O(log n) for distinct values | O(log n) stack |
| With duplicates (LC 154) | O(log n) typical, **O(n) worst** | O(1) |

## 8. Testing

```js
const tests = [
  [[3, 4, 5, 1, 2], 1],
  [[4, 5, 6, 7, 0, 1, 2], 0],
  [[11, 13, 15, 17], 11],         // not rotated
  [[1], 1],                       // single element
  [[2, 1], 1],                    // two elements, rotated
  [[1, 2], 1],                    // two elements, not rotated
  [[7, 0, 1, 2, 4, 5, 6], 0],     // minimum at index 1
  [[1, 2, 4, 5, 6, 7, 0], 0],     // minimum at the end
  [[-3, -2, -5, -4], -5],        // negatives
];

for (const [nums, expected] of tests) {
  console.assert(findMin(nums) === expected, `findMin(${nums}) → ${findMin(nums)}`);
}

// Adversarial: every rotation of every length up to 40
for (let n = 1; n <= 40; n++) {
  const sorted = Array.from({ length: n }, (_, i) => i * 3 - 50);
  for (let r = 0; r < n; r++) {
    const nums = [...sorted.slice(r), ...sorted.slice(0, r)];
    console.assert(findMin(nums) === sorted[0], n, r);
  }
}
```

**Dry run** for `nums = [4,5,6,7,0,1,2]`:

| lo | hi | mid | nums[mid] | nums[hi] | action |
| --- | --- | --- | --- | --- | --- |
| 0 | 6 | 3 | 7 | 2 | 7 > 2 → `lo = 4` |
| 4 | 6 | 5 | 1 | 2 | 1 < 2 → `hi = 5` |
| 4 | 5 | 4 | 0 | 1 | 0 < 1 → `hi = 4` |
| 4 | 4 | — | — | — | return `nums[4] = 0` |

## 9. Alternatives

### a) Compare with `nums[lo]`, with a "sorted range" early exit

```js
function findMinCompareLo(nums) {
  let lo = 0, hi = nums.length - 1;
  while (lo < hi) {
    if (nums[lo] < nums[hi]) return nums[lo];   // [lo..hi] is sorted: no drop inside
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] >= nums[lo]) lo = mid + 1;    // mid in the high run (>= for mid === lo)
    else hi = mid;                              // mid in the low run
  }
  return nums[lo];
}
```

- Time O(log n), space O(1).
- **Why it works:** once the early exit has ruled out a sorted range, `[lo..hi]` definitely contains the drop, so `nums[mid] >= nums[lo]` means `mid` is in the high run.
- **When it's preferable:** the early exit answers unrotated inputs in O(1), and it's the version many people derive first.
- **Limitations:** more cases to get right (`>=` when `mid === lo`). Without the early exit it's simply wrong on sorted ranges.

### b) Predicate against the last element (generic "first true")

```js
function findMinPredicate(nums) {
  const last = nums[nums.length - 1];
  let lo = 0, hi = nums.length - 1;              // the answer always exists, so [0, n-1]
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] <= last) hi = mid;             // in the low run
    else lo = mid + 1;                           // in the high run
  }
  return nums[lo];
}
```

- Time O(log n), space O(1).
- **When it's preferable:** if you always reach for the "first true" template, this is the same code you'd write for Koko or First Bad Version. Same comparisons as the main version, just against the fixed `last`.

### c) Recursive divide and conquer

```js
function findMinDivide(nums, lo = 0, hi = nums.length - 1) {
  if (nums[lo] <= nums[hi]) return nums[lo];     // sorted range (or one element)
  const mid = lo + Math.floor((hi - lo) / 2);
  return Math.min(findMinDivide(nums, lo, mid), findMinDivide(nums, mid + 1, hi));
}
```

- Time **O(log n)** for distinct values: in every call, at least one half is sorted and returns in O(1), so only one branch recurses deeper. Space O(log n) stack.
- **When it's preferable:** it explains *why* the problem is O(log n) nicely. It's also what degrades gracefully to O(n) with duplicates.
- **Limitations:** recursion and a stack; the iterative version is better in code.

---

## Follow-ups interviewers ask

### 1. Duplicates allowed (LC 154, Hard)

When `nums[mid] === nums[hi]`, the minimum could be on either side (`[3,1,3,3,3]` vs `[3,3,3,1,3]`). But `nums[hi]` has a twin at `mid`, so dropping `hi` can't lose the minimum's **value**.

```js
function findMinWithDuplicates(nums) {
  let lo = 0, hi = nums.length - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] > nums[hi]) lo = mid + 1;
    else if (nums[mid] < nums[hi]) hi = mid;
    else hi--;                     // equal: discard hi, its value survives at mid
  }
  return nums[lo];
}
```

- **Worst case O(n):** `[1,1,1,…,1,0,1,1]`. Every comparison is `1 === 1`, so it shrinks one step at a time. No algorithm can do better in the worst case, since the `0` could be anywhere.
- **Careful:** with `hi--`, `nums[lo]` is still the minimum *value*, but `lo` isn't necessarily the rotation point (on `[1,1,2,1]` it returns index 0, while the rotation point is index 3). If the index matters, check `nums[hi − 1] > nums[hi]` before decrementing.

### 2. How many times was the array rotated?
Return `lo` instead of `nums[lo]`. For an unrotated array that's `0` (equivalently `n` rotations).

### 3. Find the maximum
The maximum sits just before the minimum: `nums[(minIndex − 1 + n) % n]`.

### 4. Then search for a target
Use the minimum's index as the pivot: see [Search in Rotated Sorted Array](./44_Search%20in%20Rotated%20Sorted%20Array.md), alternative a.

## Common mistakes

- Comparing with `nums[lo]` without the sorted-range check: wrong for unrotated arrays.
- `hi = mid − 1` in the "low run" branch, which can skip the minimum when `mid` is the minimum.
- `while (lo <= hi)` together with `hi = mid`, which loops forever when `lo === hi`.
- Rounding `mid` up: then `mid` can equal `hi`, `nums[mid] > nums[hi]` is false, and `hi = mid` doesn't shrink the range.
- Claiming O(log n) for the duplicates version.
