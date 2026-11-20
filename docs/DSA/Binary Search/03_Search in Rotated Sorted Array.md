---
sidebar_position: 3
---

# Search in Rotated Sorted Array

> **LeetCode 33 · Medium · Pattern: Modified Binary Search (one half is always sorted)**

> Companies: one of the most frequently asked binary-search problems at Meta, Amazon, Microsoft, Google, LinkedIn and Bloomberg. Interviewers watch for two things: whether you can explain **why one half is always sorted**, and whether your boundary comparisons (`<` vs `<=`) are correct. The follow-up is almost always "what if there are duplicates?" (LC 81).

An ascending array of **distinct** integers was possibly rotated at an unknown pivot `k`, so `[0,1,2,4,5,6,7]` might become `[4,5,6,7,0,1,2]`. Given the rotated array `nums` and `target`, return the index of `target`, or `-1`. You must write an algorithm with **O(log n)** runtime.

```
Input: nums = [4,5,6,7,0,1,2], target = 0   → Output: 4
Input: nums = [4,5,6,7,0,1,2], target = 3   → Output: -1
Input: nums = [1], target = 0               → Output: -1
```

Constraints (LeetCode): `1 <= nums.length <= 5000`, `-10^4 <= nums[i], target <= 10^4`, all values are **unique**, and `nums` is an ascending array that is possibly rotated.

Prerequisite: [Binary Search](./02_Binary%20Search.md).

---

## 1. Understand

The array is two sorted runs glued together: a "high" run followed by a "low" run, with every value in the high run larger than every value in the low run.

```
index:  0  1  2  3  4  5  6
value:  4  5  6  7  0  1  2
        └─ high ─┘  └ low ┘     the "drop" (7 → 0) is the rotation point
```

The whole array isn't sorted, so plain binary search can go the wrong way. But it's still *almost* sorted, and we need to exploit that structure to find `target` in O(log n).

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Are values distinct? | **Critical.** With duplicates (`[1,1,1,0,1]`), you sometimes can't tell which half is sorted, and the worst case becomes O(n). That's LC 81, see the follow-ups. |
| Can it be not rotated at all (or rotated by `n`)? | Yes. The algorithm must handle a plain sorted array. |
| Return an index or a boolean? | LC 33 returns the index, LC 81 a boolean. |
| Empty array? | Not in LeetCode's constraints, but the code should return `-1`. |

**Edge cases:** no rotation, rotation by 1 (`[7,0,1,2,4,5,6]`) or by `n − 1` (`[1,2,4,5,6,7,0]`), one or two elements, `target` at the pivot, at either end, or absent but within the value range (`3` above).

## 3. Brute force

```js
function searchLinear(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === target) return i;
  }
  return -1;
}
```

- Time **O(n)**, space **O(1)**.
- **Why it works:** checks every element, so rotation doesn't matter.
- **When it's preferable:** tiny arrays, or as a test oracle. Also the honest worst-case answer when duplicates are allowed (LC 81).
- **Limitations:** ignores the sorted structure, so it doesn't meet O(log n).

## 4. Optimize: find the bottleneck

The brute force ignores order. Plain binary search uses order but assumes one sorted run: in `[4,5,6,7,0,1,2]` looking for `0`, `nums[mid] = 7 > 0` would send it left, the wrong way.

The key observation: **split a rotated array at any `mid`, and at least one of the two halves `[lo..mid]` and `[mid..hi]` is sorted.** The single "drop" can only be in one of them.

```
[4 5 6 7 0 1 2]      mid = 3 (value 7)
 [4 5 6 7]           left half: nums[lo]=4 <= nums[mid]=7 → sorted
         [0 1 2]     the drop is on the right
```

For the sorted half, a range check (`lo_val <= target < mid_val`) tells us for certain whether the target is inside. If it is, go there; if not, it can only be in the other half. Either way, half the range is discarded per step, so the search is O(log n) again.

Two ways to use this:
1. **Two passes:** find the rotation point with binary search, then binary search the correct sorted run (alternative a).
2. **One pass:** at every step, decide which half is sorted and whether the target is in it (the main implementation).

## 5. Pattern: modified binary search on a partially sorted array

> Binary search doesn't need a fully sorted array. It needs a way to **discard half of the range with certainty** at each step. Look for a property that one half always has.

Here, the property is "at least one half is sorted, and a sorted half answers range questions in O(1)." The same idea solves:
- [Find Minimum in Rotated Sorted Array](./04_Find%20Minimum%20in%20Rotated%20Sorted%20Array.md) (LC 153), which also finds the rotation point
- Search in Rotated Sorted Array II (LC 81, duplicates)
- Find Peak Element (LC 162): the half on the side of a rising neighbour always contains a peak
- Single Element in a Sorted Array (LC 540): pair parity tells you which half is broken

## 6. Implement (optimal: one-pass modified binary search)

```js
/**
 * @param {number[]} nums  rotated ascending array of distinct values
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;

  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return mid;

    if (nums[lo] <= nums[mid]) {
      // Left half [lo..mid] is sorted. (<= because lo === mid is a 1-element sorted half.)
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;  // target is in it
      else lo = mid + 1;                                           // it's on the right
    } else {
      // Otherwise the right half [mid..hi] is sorted.
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;  // target is in it
      else hi = mid - 1;                                           // it's on the left
    }
  }

  return -1;
}
```

- **Why it works:**
  - **Invariant:** if `target` exists, its index is in `[lo, hi]`, and `nums[lo..hi]` is a rotated sorted array (a contiguous slice of one keeps that shape).
  - If `nums[lo] <= nums[mid]`, the drop isn't in `[lo..mid]`, so that half is sorted. Otherwise the drop is in `(lo..mid]`, so `[mid..hi]` contains no drop and is sorted.
  - Within a sorted half, `target` is present only if it lies between that half's endpoints. That check is exact, so the half we discard never contains `target`.
  - We discard `mid` and one half each time, so the loop ends in O(log n).
- **Why `nums[lo] <= nums[mid]` and not `<`:** when `lo === mid` (two elements left), the left "half" is one element and is sorted. With `<`, the code would wrongly treat the right half as sorted. Example: `[3,1]`, `target = 1`: with `<`, it checks `3 < 1 <= 1`, fails, and goes left, missing the answer.
- **Why the strict `<` against `nums[mid]`:** `nums[mid] === target` was already handled, so `mid` is excluded from both ranges.
- **When it's preferable:** the standard answer: one pass, O(1) space, and short.
- **Limitations:** requires **distinct** values. With duplicates, `nums[lo] === nums[mid]` doesn't prove the left half is sorted (`[1,1,1,0,1]`, see the follow-ups).

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Linear scan | O(n) | O(1) |
| **One-pass modified binary search** | **O(log n)** | **O(1)** |
| Find pivot, then binary search (alt. a) | O(log n), ~2 log n comparisons | O(1) |
| With duplicates (LC 81) | O(log n) typical, **O(n) worst** | O(1) |

## 8. Testing

```js
const tests = [
  [[4, 5, 6, 7, 0, 1, 2], 0, 4],
  [[4, 5, 6, 7, 0, 1, 2], 3, -1],     // absent, inside the value range
  [[1], 0, -1],
  [[1], 1, 0],
  [[1, 3], 3, 1],                     // not rotated, two elements
  [[3, 1], 1, 1],                     // rotated, two elements (the lo === mid case)
  [[3, 1], 3, 0],
  [[5, 1, 3], 5, 0],
  [[5, 1, 3], 3, 2],
  [[1, 2, 3, 4, 5], 4, 3],            // not rotated
  [[2, 3, 4, 5, 1], 1, 4],            // rotated by n - 1: target at the end
  [[7, 0, 1, 2, 4, 5, 6], 7, 0],      // rotated by 1: target at the start
  [[], 5, -1],
];

for (const [nums, target, expected] of tests) {
  console.assert(search(nums, target) === expected, `search(${nums}, ${target}) → ${search(nums, target)}`);
}

// Adversarial: every rotation of every length, every present and absent target
for (let n = 1; n <= 30; n++) {
  const sorted = Array.from({ length: n }, (_, i) => 2 * i);
  for (let r = 0; r < n; r++) {
    const nums = [...sorted.slice(r), ...sorted.slice(0, r)];
    for (let t = -1; t <= 2 * n; t++) {
      console.assert(search(nums, t) === nums.indexOf(t), n, r, t);
    }
  }
}
```

**Dry run** for `nums = [4,5,6,7,0,1,2]`, `target = 0`:

| lo | hi | mid | nums[mid] | sorted half | target in it? | action |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 6 | 3 | 7 | left `[4..7]` | `4 <= 0`? no | `lo = 4` |
| 4 | 6 | 5 | 1 | left `[0..1]` | `0 <= 0 < 1`? yes | `hi = 4` |
| 4 | 4 | 4 | 0 | — | found | return 4 |

## 9. Alternatives

### a) Find the pivot, then binary search with an offset

Find the index of the minimum (the rotation count) as in [Find Minimum in Rotated Sorted Array](./04_Find%20Minimum%20in%20Rotated%20Sorted%20Array.md). Then binary search the **logical** sorted array, mapping logical index `m` to real index `(m + pivot) % n`.

```js
function searchWithPivot(nums, target) {
  const n = nums.length;
  if (n === 0) return -1;

  // 1) pivot = index of the minimum
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] > nums[hi]) lo = mid + 1;
    else hi = mid;
  }
  const pivot = lo;

  // 2) ordinary binary search over logical indices 0..n-1
  lo = 0; hi = n - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const real = (mid + pivot) % n;
    if (nums[real] === target) return real;
    if (nums[real] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

- Time O(log n) (two searches), space O(1).
- **Why it works:** rotating by `pivot` is a bijection between logical and real indices, and the logical view is fully sorted.
- **When it's preferable:** easier to get right under pressure, because each step is a textbook binary search. It's also better when you'll run **many** searches on the same array: find the pivot once, then each query is a plain binary search.
- **Limitations:** roughly twice the comparisons of the one-pass version. Interviewers sometimes ask for a single pass.

### b) Pick the run first, then search it

Using the pivot, decide which sorted run can contain `target` (`target >= nums[0]` → the high run `[0, pivot − 1]`, else the low run `[pivot, n − 1]`, with the no-rotation case `pivot === 0` meaning the whole array), then run plain binary search on that slice. Same complexity as (a). Some find it easier to explain.

### c) "Infinity trick" (single pass, plain binary search)

Compare as if the side `target` isn't on were replaced by `±Infinity`. If `nums[mid]` and `target` are on the same side of `nums[0]`, compare normally. If not, pretend `nums[mid]` is `+Infinity` when `target` is in the high run and `mid` in the low one (so the search moves left), or `-Infinity` in the reverse case (so it moves right).

```js
function searchInfinityTrick(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const sameSide = (nums[mid] >= nums[0]) === (target >= nums[0]);
    const val = sameSide ? nums[mid] : target >= nums[0] ? Infinity : -Infinity;
    if (val === target) return mid;
    if (val < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

- Time O(log n), space O(1).
- **When it's preferable:** a neat single loop with a single comparison. Good to mention as an alternative.
- **Limitations:** harder to explain than "one half is sorted," and it relies on distinct values.

---

## Follow-ups interviewers ask

### 1. Duplicates allowed (LC 81, return a boolean)

When `nums[lo] === nums[mid] === nums[hi]`, you can't tell which half is sorted (`[1,1,1,0,1]` vs `[1,0,1,1,1]`). Shrink both ends by one and continue.

```js
function searchWithDuplicates(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] === target) return true;

    if (nums[lo] === nums[mid] && nums[mid] === nums[hi]) {
      lo++; hi--;                                   // ambiguous: drop the duplicate ends
    } else if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return false;
}
```

- **Worst case O(n):** `[1,1,1,…,1,0,1,…,1]` hides the `0` anywhere, and no comparison with a `1` can tell you where. Say this explicitly. It's what the interviewer is checking.
- **Why dropping the ends is safe:** `nums[lo]` and `nums[hi]` equal `nums[mid]`, which isn't the target, so neither end is the target.

### 2. How many times was the array rotated?
That's the index of the minimum: the pivot from alternative (a).

### 3. Search a rotated array many times
Precompute the pivot once (O(log n)), then each query is a plain binary search with the offset mapping.

### 4. Rotated in descending order
Mirror the comparisons, or search for `−target` in the array of negated values (don't actually build it; negate on access).

## Common mistakes

- Using `nums[lo] < nums[mid]` instead of `<=`, which breaks on two-element ranges like `[3,1]`.
- Checking the range of the *unsorted* half: the range test is only valid for the sorted one.
- Inclusive/exclusive slips in the range checks: `nums[lo] <= target < nums[mid]` and `nums[mid] < target <= nums[hi]`.
- Comparing `target` with `nums[0]` / `nums[n−1]` instead of the current `nums[lo]` / `nums[hi]` (fine in the infinity trick, wrong in the main version).
- Claiming O(log n) for the duplicates version.
