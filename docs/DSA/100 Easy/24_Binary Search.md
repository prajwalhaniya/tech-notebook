---
sidebar_position: 24
---

# Binary Search

> **LeetCode 704 · Easy · Pattern: Binary Search (halve the search space using order)**

> Companies: everywhere. It's rarely asked alone at FAANG, but it underpins many Medium and Hard problems: [Search in Rotated Sorted Array](../100%20Medium/44_Search%20in%20Rotated%20Sorted%20Array.md), [Find Minimum in Rotated Sorted Array](../100%20Medium/45_Find%20Minimum%20in%20Rotated%20Sorted%20Array.md), [Koko Eating Bananas](../100%20Medium/46_Koko%20Eating%20Bananas.md), Median of Two Sorted Arrays. Interviewers aren't checking whether you know it. They're checking whether you write it **without off-by-one bugs** and can state the **loop invariant**.

Given an array of integers `nums` sorted in ascending order and an integer `target`, return the index of `target`, or `-1` if it's not present. You must write an algorithm with **O(log n)** runtime.

```
Input: nums = [-1, 0, 3, 5, 9, 12], target = 9   → Output: 4
Input: nums = [-1, 0, 3, 5, 9, 12], target = 2   → Output: -1
```

Constraints (LeetCode): `1 <= nums.length <= 10^4`, `-10^4 < nums[i], target < 10^4`, all values are **unique**, and `nums` is sorted ascending.

---

## 1. Understand

The array is sorted, so comparing `target` with any element tells us which side of that element the target must be on. Compare with the **middle** element and one comparison throws away half of the remaining candidates. Repeat until the target is found or no candidates remain.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Duplicates? | With duplicates, "an index" is ambiguous. If they want the **first** or **last** occurrence, use the lower/upper-bound version (alternative a). |
| Ascending or descending? | Flips the comparisons. |
| Can the array be empty? | Then `hi = -1` and the loop must not run. The closed-interval template handles it. |
| Return what when absent? `-1`, or the insertion point? | Insertion point is Search Insert Position (LC 35), which is exactly the lower bound. |
| Very large indices? | `(lo + hi) / 2` overflows 32-bit ints in Java/C++. Use `lo + (hi - lo) / 2`. Not a JS problem below 2^53, but say it. |

**Edge cases:** one element (match or not), target smaller than `nums[0]`, target larger than the last element, target at index 0 or `n − 1`, even and odd lengths.

## 3. Brute force

```js
function searchLinear(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === target) return i;
    if (nums[i] > target) return -1;   // sorted: we've passed where it would be
  }
  return -1;
}
```

- Time **O(n)**, space **O(1)**.
- **Why it works:** it checks every element. The early exit uses sortedness, but only one element at a time.
- **When it's preferable:** tiny arrays (fewer than ~16 elements, where a linear scan is cache-friendly and branch-predictable), unsorted data, or a testing oracle.
- **Limitations:** ignores the ordering. It doesn't meet the O(log n) requirement.

## 4. Optimize: find the bottleneck

The linear scan learns one bit per comparison ("not here") and throws the rest away. A comparison with `nums[mid]` tells us much more: everything on one side of `mid` is now ruled out. Choosing `mid` in the middle guarantees the worst case removes half, so after `k` steps at most `n / 2^k` candidates are left, which reaches 1 after `log₂ n` steps. For n = 10^4, that's 14 comparisons instead of 10,000.

## 5. Pattern: binary search over a sorted space

> If you can ask a yes/no question about position `i` and the answers look like `no, no, …, no, yes, yes, …, yes` (**monotonic**), binary search finds the boundary in O(log n).

The array doesn't have to be sorted. What matters is that the predicate is monotonic:

| Problem | Search space | Predicate (first `true`) |
| --- | --- | --- |
| Binary Search (this) | indices | `nums[i] >= target` |
| [Find Minimum in Rotated Sorted Array](../100%20Medium/45_Find%20Minimum%20in%20Rotated%20Sorted%20Array.md) | indices | `nums[i] <= nums[n−1]` |
| [Koko Eating Bananas](../100%20Medium/46_Koko%20Eating%20Bananas.md) | speeds `1..max` | "can finish in `h` hours at speed `k`" |
| [Square Root](./04_Square%20Root.md) | integers `0..x` | `mid * mid > x` (answer is one before) |
| First Bad Version (LC 278) | versions | `isBadVersion(v)` |

**Three templates.** Pick one and use it everywhere so your boundaries are muscle memory:

| Template | Interval | Loop | Moves | Ends with |
| --- | --- | --- | --- | --- |
| Exact match | closed `[lo, hi]` | `lo <= hi` | `lo = mid + 1` / `hi = mid − 1` | `lo = hi + 1`, empty interval |
| Lower bound (first `true`) | half-open `[lo, hi)` | `lo < hi` | `lo = mid + 1` / `hi = mid` | `lo === hi`, the boundary |
| Last `true` | `[lo, hi]` | `lo < hi` | `lo = mid` / `hi = mid − 1`, **mid rounded up** | `lo === hi` |

The rule behind them: **every branch must shrink the interval.** If `lo = mid` is possible, `mid` must round up, or `[lo, lo + 1]` loops forever.

## 6. Implement (optimal: closed-interval binary search)

```js
/**
 * @param {number[]} nums  sorted ascending, unique values
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;              // closed interval [lo, hi]: both ends are candidates

  while (lo <= hi) {                     // non-empty while lo <= hi
    const mid = lo + Math.floor((hi - lo) / 2);   // no overflow in fixed-width languages

    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;         // target is strictly right of mid
    else hi = mid - 1;                            // target is strictly left of mid
  }

  return -1;                             // interval became empty
}
```

- **Why it works:**
  - **Invariant:** if `target` is in `nums`, its index is in `[lo, hi]`.
  - It holds initially (the whole array). Each branch removes only indices that can't hold `target`, because the array is sorted, so it stays true.
  - Each iteration removes at least `mid` itself, so the interval strictly shrinks and the loop ends. When it's empty, the invariant says `target` isn't present.
- **When it's preferable:** exact lookup in a sorted array with unique values. It's the clearest version to write under pressure.
- **Limitations:** with duplicates it returns *some* matching index, not necessarily the first. It needs random access (O(1) indexing), so it doesn't work on linked lists.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Linear scan | O(n) | O(1) |
| **Iterative binary search** | **O(log n)** | **O(1)** |
| Recursive binary search (alt. b) | O(log n) | O(log n) stack |
| Exponential search (alt. d) | O(log i), `i` = target's index | O(1) |

Exactly `⌊log₂ n⌋ + 1` iterations in the worst case.

## 8. Testing

```js
const tests = [
  [[-1, 0, 3, 5, 9, 12], 9, 4],
  [[-1, 0, 3, 5, 9, 12], 2, -1],
  [[5], 5, 0],              // single element, found
  [[5], -5, -1],            // single element, absent
  [[], 1, -1],              // empty array
  [[1, 3], 1, 0],           // first of two
  [[1, 3], 3, 1],           // last of two
  [[1, 3], 2, -1],          // gap between two
  [[1, 3, 5], 0, -1],       // smaller than everything
  [[1, 3, 5], 6, -1],       // larger than everything
];

for (const [nums, target, expected] of tests) {
  console.assert(search(nums, target) === expected, `search(${nums}, ${target}) → ${search(nums, target)}`);
}

// Adversarial: every position and every gap, for many lengths (catches off-by-one bugs)
for (let n = 0; n <= 50; n++) {
  const nums = Array.from({ length: n }, (_, i) => 2 * i);        // 0, 2, 4, ...
  for (let t = -1; t <= 2 * n; t++) {
    const expected = t % 2 === 0 && t < 2 * n && t >= 0 ? t / 2 : -1;
    console.assert(search(nums, t) === expected, n, t);
  }
}
```

The odd targets test every gap and the even targets test every index. Covering both for every length `0..50` exercises each boundary case.

**Dry run** for `nums = [-1, 0, 3, 5, 9, 12]`, `target = 9`:

| lo | hi | mid | nums[mid] | action |
| --- | --- | --- | --- | --- |
| 0 | 5 | 2 | 3 | 3 < 9 → `lo = 3` |
| 3 | 5 | 4 | 9 | found → return 4 |

## 9. Alternatives

### a) Lower bound (half-open, first index with `nums[i] >= target`)

The most reusable template. It's also how C++ `std::lower_bound` and Python `bisect_left` work.

```js
function lowerBound(nums, target) {
  let lo = 0, hi = nums.length;          // half-open [lo, hi): hi = n means "past the end"
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (nums[mid] < target) lo = mid + 1;   // mid is too small: the answer is right of it
    else hi = mid;                          // mid might be the answer: keep it
  }
  return lo;                             // in [0, n]
}

function searchViaLowerBound(nums, target) {
  const i = lowerBound(nums, target);
  return i < nums.length && nums[i] === target ? i : -1;
}
```

- Time O(log n), space O(1).
- **Why it works:** invariant: everything before `lo` is `< target`, and everything from `hi` onward is `>= target`. When `lo === hi`, that's the boundary.
- **When it's preferable:** duplicates (it gives the **first** occurrence), insertion points (LC 35), counting occurrences (`upperBound − lowerBound`), and range queries.
- **Limitations:** you need the extra check `nums[i] === target` for an exact match.

### b) Recursive

```js
function searchRecursive(nums, target, lo = 0, hi = nums.length - 1) {
  if (lo > hi) return -1;
  const mid = lo + Math.floor((hi - lo) / 2);
  if (nums[mid] === target) return mid;
  return nums[mid] < target
    ? searchRecursive(nums, target, mid + 1, hi)
    : searchRecursive(nums, target, lo, mid - 1);
}
```

- Time O(log n), space **O(log n)** for the call stack (JS doesn't do tail-call optimization in practice).
- **When it's preferable:** when the interviewer asks for it, or to explain divide and conquer. The iterative version is better otherwise.

### c) Generic "first true" (binary search on a predicate)

```js
// Smallest x in [lo, hi] with pred(x) true, assuming pred is false...false true...true.
// Returns hi + 1 if pred is never true.
function firstTrue(lo, hi, pred) {
  hi += 1;                               // half-open [lo, hi)
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (pred(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

// Binary Search, expressed with it:
const searchViaPredicate = (nums, target) => {
  const i = firstTrue(0, nums.length - 1, (i) => nums[i] >= target);
  return nums[i] === target ? i : -1;
};
```

- **When it's preferable:** once the problem is "find the boundary of a monotonic predicate" (answer-space searches like Koko, First Bad Version, capacity problems). One template, no new off-by-one bugs.

### d) Exponential (galloping) search, for unbounded or unknown size

When you can't read `n` (LC 702, "Search in a Sorted Array of Unknown Size"), double `hi` until `nums[hi] >= target`, then binary search inside `[hi/2, hi]`.

```js
// reader.get(i) returns 2**31 - 1 when i is out of bounds (LC 702's interface)
function searchUnknownSize(reader, target) {
  let hi = 1;
  while (reader.get(hi) < target) hi *= 2;
  let lo = Math.floor(hi / 2);
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const v = reader.get(mid);
    if (v === target) return mid;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

- Time **O(log i)** where `i` is the target's position, so it's faster than plain binary search when the target is near the front.
- **When it's preferable:** streams, infinite or unknown-length arrays, and merging sorted runs (Timsort's galloping mode).

---

## Follow-ups interviewers ask

### 1. First and last position of `target` (LC 34)
`first = lowerBound(nums, target)`, `last = lowerBound(nums, target + 1) − 1` (for integers), or write `upperBound` with `nums[mid] <= target`. Check `first < n && nums[first] === target` before returning it.

### 2. Search Insert Position (LC 35)
Exactly `lowerBound(nums, target)`.

### 3. Why not ternary search?
Two comparisons per step to remove 2/3 of the range: `2·log₃ n ≈ 1.26·log₂ n` comparisons, which is **more** than binary search. Ternary search is for **unimodal functions** (finding a peak), not sorted arrays.

### 4. Binary search on doubles
Loop a fixed number of times (e.g. 100) or until `hi − lo < ε`, setting `lo = mid` or `hi = mid` without `± 1`.

### 5. Sorted 2D matrix (LC 74)
Treat the `m × n` matrix as one sorted array of length `m·n`: index `i` maps to `matrix[Math.floor(i / n)][i % n]`.

## Common mistakes

- Mixing templates: `hi = n` with `while (lo <= hi)` reads `nums[n]`; `hi = n − 1` with `while (lo < hi)` never checks the last remaining element.
- `lo = mid` with `mid` rounded down, which loops forever on a two-element range.
- `mid = (lo + hi) / 2` without flooring in JS, which gives a fractional index and `undefined`.
- `(lo + hi) / 2` overflow in Java/C++ (a famous bug in the JDK's `Arrays.binarySearch` for years).
- Returning `lo` from the exact-match template as if it were the insertion point without checking which template you wrote.
- Forgetting that binary search needs **sorted** input with random access. Sorting first costs O(n log n), which only pays off across many queries.
