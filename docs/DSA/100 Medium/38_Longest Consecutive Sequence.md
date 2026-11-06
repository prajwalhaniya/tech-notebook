---
sidebar_position: 38
---

# Longest Consecutive Sequence

> **LeetCode 128 · Medium · Pattern: Hash Set (sequence-start detection)**

> Companies: Google (very frequent), Amazon, Meta, Microsoft, Bloomberg, Uber, Adobe.

Given an **unsorted** array of integers `nums`, return the length of the longest run of consecutive integers (`x, x+1, x+2, ...`). The elements don't have to be adjacent in the array.

**You must write an algorithm that runs in O(n) time.**

```
Input:  [100,4,200,1,3,2]        → 4   (1,2,3,4)
Input:  [0,3,7,2,5,8,4,6,0,1]    → 9   (0..8)
Input:  [1,0,1,2]                → 3   (0,1,2, and the duplicate 1 doesn't count twice)
Input:  []                       → 0
```

Constraints (LeetCode): `0 <= nums.length <= 10^5`, `-10^9 <= nums[i] <= 10^9`.

---

## 1. Understand

Treat the array as a **set of numbers** (position and duplicates don't matter). On the number line, those numbers form runs with gaps between them. Return the length of the longest run.

The O(n) requirement rules out sorting (O(n log n)), which is the obvious first idea. That's the whole point of the problem.

## 2. Clarify

| Question | Why it matters |
| --- | --- |
| Empty array? | Return `0`, not `1`. A very common bug. |
| Duplicates? | `[1,2,2,3]` gives `3`. Duplicates must not extend a run or be counted twice. |
| Negative numbers, huge range (`±10^9`)? | Rules out a counting array or bitmap indexed by value. Use a `Set`. |
| Return the length or the sequence itself? | Usually the length. Returning the sequence just means also tracking the start. |
| Does "consecutive" mean in array order (subarray) or by value? | **By value**, so it's not a sliding window problem. Easy to confuse with "longest increasing subarray." |
| Integers only? | Yes. With floats, "consecutive" is undefined. |

**Let `n` = array length.**

## 3. Brute force

For every number `x`, count upward `x+1, x+2, ...` by **linearly scanning** the array for each next value.

```js
/**
 * @param {number[]} nums
 * @return {number}
 */
function longestConsecutiveBrute(nums) {
  const contains = (target) => {
    for (const v of nums) if (v === target) return true;
    return false;
  };

  let best = 0;
  for (const x of nums) {
    let length = 1;
    while (contains(x + length)) length++;
    best = Math.max(best, length);
  }
  return best;
}
```

- Time **O(n³)** in the worst case: n starts × up to n extensions × an O(n) scan. Space **O(1)**.
- **Why it works:** it tries every possible start and extends as far as possible, so it can't miss the longest run.
- **When it's preferable:** never in practice. It's only a correctness baseline (and a test oracle).
- **Limitation:** with `n = 10^5` it's hopeless.

## 4. Optimize: find the bottlenecks

There are **two** separate sources of waste in the brute force, and each gets its own fix:

1. **Membership lookup is O(n).** Replacing it with a hash `Set` makes it O(1). That brings the brute force down to O(n²), which is still too slow: on `[1,2,3,...,n]`, starting from 1 walks n steps, starting from 2 walks n−1, and so on.
2. **We re-walk the same run from every element in it.** The fix is to **only start counting at the beginning of a run**. `x` is a run start if and only if `x − 1` is **not** in the set. Then each run is walked exactly once.

There's an intermediate idea as well: **sort first** (O(n log n)), then scan once. It's simple and a great thing to say before you get to the set solution.

## 5. Pattern: Hash Set + "only start from the beginning"

> When you need runs, chains or groups among values and order doesn't matter, put everything in a set and **start work only from canonical starting points** (elements with no predecessor). This turns a nested loop into amortized O(n), because every element is visited a constant number of times overall.

The same idea appears in:
- Number of Islands / connected components: start a traversal only from unvisited nodes
- Union-Find formulation of this same problem (union `x` with `x+1`)
- Binary Tree Longest Consecutive Sequence (LC 298), Longest Consecutive Sequence II (LC 549)
- Array Nesting (LC 565): walk each cycle once
- Missing Ranges / Summary Ranges: the sorted-run version, see [Summary Ranges](../Javascript%20Specific/Summary%20Ranges.md)

## 6. Implement

### Approach A: Sort, then scan (O(n log n), the stepping stone)

```js
/**
 * @param {number[]} nums
 * @return {number}
 */
function longestConsecutiveSort(nums) {
  if (nums.length === 0) return 0;

  const sorted = [...nums].sort((a, b) => a - b); // the numeric comparator is mandatory
  let best = 1, current = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) continue;          // duplicate: neither extends nor breaks the run
    if (sorted[i] === sorted[i - 1] + 1) current++;     // extends the run
    else current = 1;                                   // gap: start a new run
    best = Math.max(best, current);
  }
  return best;
}
```

- Time **O(n log n)**, Space **O(n)** for the copy (O(log n) for the sort stack if you're allowed to sort in place).
- **Why it works:** after sorting, every consecutive run is a contiguous block, so a single pass finds them.
- **When it's preferable:** when memory is tight (sort in place for O(1) extra space with no hash set), or when the input is already sorted. With realistic `n` it's often **faster in practice** than the set version, because hash sets have large constant factors and poor cache locality.
- **Limitations:** it doesn't meet the stated O(n) requirement. Watch out for the duplicate handling and the default lexicographic `.sort()`.

### Approach B: Hash Set with sequence-start detection (optimal O(n))

```js
/**
 * @param {number[]} nums
 * @return {number}
 */
function longestConsecutive(nums) {
  const set = new Set(nums); // dedupes too
  let best = 0;

  for (const x of set) {                 // iterate the SET, not nums (see the note below)
    if (set.has(x - 1)) continue;        // x is not a run start, so skip it

    let length = 1;
    while (set.has(x + length)) length++;

    best = Math.max(best, length);
  }
  return best;
}
```

- Time **O(n)**: building the set is O(n). The `while` loop runs only from run starts, and each element is stepped onto at most once by those loops across the whole execution, so the total work is O(n) amortized even though there's a nested loop.
- Space **O(n)** for the set.
- **Why it works:** every run has exactly one start (its smallest element, which has no predecessor). Counting only from starts means each run is measured exactly once, from its beginning, to its full length.
- **When it's preferable:** whenever O(n) is required, with an unbounded value range and unsorted input.
- **Limitations:** it uses O(n) extra memory, and hashing has high constant factors.

**Why iterate `set` instead of `nums`:** with input like `[1,1,1,...,1,2,3,...,m]` (lots of copies of a run start), iterating `nums` repeats the full walk for every duplicate start, which can degrade to O(n²). Iterating the set visits each distinct value once. This is a known subtle issue (it shows up as TLE on LeetCode) and a strong thing to mention.

### Approach C: Hash Map with boundary merging (single pass, online)

Store, for the **endpoints** of each known run, the length of that run. When a new value `x` arrives, look at the run ending at `x−1` and the run starting at `x+1`, merge them through `x`, and update only the two new endpoints.

```js
/**
 * @param {number[]} nums
 * @return {number}
 */
function longestConsecutiveMap(nums) {
  const runLen = new Map(); // value -> length of the run it bounds (accurate only at endpoints)
  let best = 0;

  for (const x of nums) {
    if (runLen.has(x)) continue;               // duplicate

    const left = runLen.get(x - 1) ?? 0;       // length of the run ending at x-1
    const right = runLen.get(x + 1) ?? 0;      // length of the run starting at x+1
    const total = left + 1 + right;

    runLen.set(x, total);                      // mark x as seen (its value only needs to be non-undefined)
    runLen.set(x - left, total);               // new left endpoint
    runLen.set(x + right, total);              // new right endpoint

    best = Math.max(best, total);
  }
  return best;
}
```

- Time **O(n)**, Space **O(n)**.
- **Why it works:** a new value can only touch the run immediately to its left and the one immediately to its right. Interior values never need updating, because a future value can only attach at an endpoint (interior neighbours are already present, so the duplicate check catches them).
- **When it's preferable:** with **streaming / online** input, when you need the current longest run after each insert. It does one pass and needs no second iteration.
- **Limitation:** it's trickier to explain and easy to get wrong (forgetting the duplicate check corrupts the endpoint lengths). It supports insertions only, not deletions.

### Approach D: Union-Find (good to know)

Union each `x` with `x+1` when both are present, and the answer is the largest component size. It's O(n · α(n)), effectively O(n). It's more code than Approach B with no benefit for the base problem, but it generalizes to *dynamic connectivity* follow-ups and shows breadth.

```js
function longestConsecutiveUF(nums) {
  const parent = new Map(), size = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x))); // path halving
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    let ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (size.get(ra) < size.get(rb)) [ra, rb] = [rb, ra]; // union by size
    parent.set(rb, ra);
    size.set(ra, size.get(ra) + size.get(rb));
  };

  for (const x of nums) if (!parent.has(x)) { parent.set(x, x); size.set(x, 1); }
  for (const x of parent.keys()) if (parent.has(x + 1)) union(x, x + 1);

  let best = 0;
  for (const s of size.values()) best = Math.max(best, s); // only roots matter, but non-root sizes are stale and never larger
  return best;
}
```

## 7. Complexity

| Approach | Time | Space | Notes |
| --- | --- | --- | --- |
| Brute force (linear scan) | O(n³) | O(1) | Correctness oracle only |
| Brute force + Set | O(n²) | O(n) | Re-walks runs |
| Sort + scan | O(n log n) | O(1)–O(n) | Often fastest in practice, and the best when memory is tight |
| **Set + run-start detection** | **O(n)** | **O(n)** | The expected answer. Iterate the set |
| Map boundary merging | O(n) | O(n) | Online / streaming |
| Union-Find | O(n · α(n)) | O(n) | Extends to dynamic connectivity |

## 8. Testing

```js
const tests = [
  { nums: [100, 4, 200, 1, 3, 2], expected: 4 },
  { nums: [0, 3, 7, 2, 5, 8, 4, 6, 0, 1], expected: 9 },
  { nums: [], expected: 0 },                                // empty: 0, not 1
  { nums: [5], expected: 1 },                               // single
  { nums: [1, 2, 2, 3], expected: 3 },                      // duplicates in the middle of a run
  { nums: [7, 7, 7], expected: 1 },                         // all duplicates
  { nums: [-3, -2, -1, 0, 1], expected: 5 },                // negatives crossing zero
  { nums: [10, 5, 12, 3, 55, 30, 4, 11, 2], expected: 4 },  // two competing runs (2-5 and 10-12)
  { nums: [1e9, -1e9, 1e9 - 1], expected: 2 },              // extreme values
  { nums: [9, 1, 4, 7, 3, -1, 0, 5, 8, -1, 6], expected: 7 },  // -1,0,1 vs 3..9
];

for (const fn of [longestConsecutiveBrute, longestConsecutiveSort, longestConsecutive, longestConsecutiveMap, longestConsecutiveUF]) {
  for (const { nums, expected } of tests) {
    const got = fn([...nums]);
    console.assert(got === expected, `${fn.name}([${nums}]) = ${got}, expected ${expected}`);
  }
}

// Adversarial / scale (skip the O(n³) brute force)
const n = 1e5;
const oneLongRun = Array.from({ length: n }, (_, i) => n - i);                     // a single run, reversed
const noRuns = Array.from({ length: n }, (_, i) => i * 2);                         // all gaps
const dupStarts = [...new Array(n / 2).fill(1), ...Array.from({ length: n / 2 }, (_, i) => i + 1)]; // breaks "iterate nums"
for (const fn of [longestConsecutiveSort, longestConsecutive, longestConsecutiveMap, longestConsecutiveUF]) {
  console.time(fn.name);
  console.assert(fn(oneLongRun) === n);
  console.assert(fn(noRuns) === 1);
  console.assert(fn(dupStarts) === n / 2);
  console.timeEnd(fn.name);
}
```

**Edge cases to say out loud:** an empty array, all duplicates, negatives and zero, extreme values (`x + 1` is still safe in JS: `10^9 + 1` is far below `2^53`, but in Java/C++ `INT_MAX + 1` overflows, which is worth noting if you're asked about other languages), and multiple runs of equal length.

## 9. Alternatives and variations

- **Return the sequence, not the length:** in Approach B, remember `bestStart` alongside `best`, then return `Array.from({ length: best }, (_, i) => bestStart + i)`.
- **Bounded value range** (e.g. `0 ≤ nums[i] ≤ 10^6`): a boolean array or bitset instead of a `Set` gives O(n + range) time with much better constant factors.
- **Memory-constrained:** sort in place with O(1) extra space and accept O(n log n).
- **Online version:** Approach C (boundary map) answers "longest run so far" after each insert in O(1).
- **Supporting deletions:** use Union-Find with rebuild, or an ordered set of intervals (a balanced BST / `TreeMap` of `start → end`), which gives O(log n) per insert or delete.

---

## Follow-ups interviewers ask

1. **"Your solution has a nested loop. Why is it O(n)?"** The amortized argument: the inner `while` only runs from run starts, and the runs are disjoint, so the total number of inner iterations across all starts is ≤ n.
2. **"What if the input contains many duplicates?"** Iterate the set, not the array (see the note in Approach B).
3. **"Can you do it without extra memory?"** Not in O(n). Sorting in place gives O(1) space and O(n log n) time.
4. **"Numbers arrive as a stream, report the longest run after each insert."** The boundary map (Approach C), or Union-Find.
5. **"Now support removals."** An interval tree / ordered map of runs, splitting a run on removal.
6. **"Data doesn't fit on one machine."** Range-partition by value. Each shard finds its runs, records the runs that touch its boundaries, and a merge step stitches runs across adjacent shards.

## Common mistakes

- Returning `1` for an empty array (initializing `best = 1`).
- Sorting without a comparator: `[10, 9, 1].sort()` gives `[1, 10, 9]`.
- In the sort approach, treating a duplicate as a run break (`[1,2,2,3]` returns 2 instead of 3).
- Iterating `nums` instead of the `Set` in the optimal approach (TLE on duplicate-heavy input).
- Forgetting the `x − 1` check entirely, which is just the O(n²) brute force with a set.
- Confusing this with "longest increasing **subarray**," which is about contiguous positions and isn't the same problem.
- In the boundary-map approach, skipping the duplicate check, which overwrites endpoint lengths with wrong values.
