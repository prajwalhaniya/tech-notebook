---
sidebar_position: 1
---

# Two Sum

> **LeetCode 1 · Easy · Pattern: Hash Map (complement lookup)**

> Companies: Google, Amazon, Meta, Apple, Microsoft (and nearly everyone else). Asked mostly as a warm-up, so interviewers judge you on clarity, speed and follow-ups.

Given an array of integers `nums` and an integer `target`, return the **indices** of the two numbers that add up to `target`.

You may assume that each input has **exactly one solution**, and you may not use the same element twice. You can return the answer in any order.

```
Input: nums = [2,7,11,15], target = 9   → Output: [0,1]
Input: nums = [3,2,4],     target = 6   → Output: [1,2]
Input: nums = [3,3],       target = 6   → Output: [0,1]
```

Constraints (LeetCode): `2 <= nums.length <= 10^4`, `-10^9 <= nums[i], target <= 10^9`, exactly one valid answer.

---

## 1. Understand

Find two **different positions** `i` and `j` such that `nums[i] + nums[j] === target`, and return the positions, not the values.

Rephrased: for each number `x`, I need to know whether its **complement** `target - x` showed up somewhere else in the array.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Return indices or values? | Indices rule out sorting the array in place unless you keep the original indices. |
| Is the array sorted? | If it is, two pointers solve it in O(1) space (that's **Two Sum II**). |
| Can there be duplicates? | `[3,3]`, target `6` must return `[0,1]`. |
| Can values be negative or zero? | Yes. That rules out "early break when value > target" tricks. |
| Is there always exactly one answer? | If not, ask what to return when there's no answer (`[]`? `null`? throw?) and what to do when there are several. |
| Can I use the same element twice? | No. `[3,2,4]`, target `6` must **not** return `[0,0]`. |
| Integer overflow? | Not in JS for these bounds: the sum fits easily within `Number.MAX_SAFE_INTEGER`. In Java/C++ you'd mention it. |

**Edge cases:** minimum length of 2, duplicate values, negatives, zeros (`[0,4,3,0]`, target `0`), the answer at the very end of the array.

## 3. Brute force

Check every pair.

```js
function twoSumBrute(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}
```

- Time **O(n²)**, Space **O(1)**.
- Starting `j` at `i + 1` handles "don't reuse the same element" and avoids checking each pair twice.

## 4. Optimize: find the bottleneck

The inner loop only asks one question: **"does `target - nums[i]` exist, and where?"** That's a lookup. A linear scan answers it in O(n), and a hash map answers it in O(1) on average.

Trading O(n) extra space for O(1) lookups brings the total down to O(n).

**Key insight (one pass):** we don't need to build the whole map first. As we walk left to right, we check whether the complement of the current number has **already been seen**. If the pair is `(i, j)` with `i < j`, we'll find it when we reach `j`, because `i` is already in the map. Checking **before** inserting also means we never pair an element with itself.

## 5. Pattern: Hash Map / "seen so far" complement lookup

> When you need a pair `(a, b)` with `f(a, b) = target`, and you can solve for `b` given `a`, store what you've seen in a hash map and look up the needed partner in O(1).

The same pattern shows up in:
- Subarray Sum Equals K (prefix sum + map of `prefix - k`)
- Contains Duplicate II (value → last index)
- Pairs with difference K, Count pairs divisible by K (store `x % k`)
- 4Sum II (map of pair sums)

## 6. Implement (optimal: one-pass hash map)

```js
/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const seen = new Map(); // value -> index

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];

    if (seen.has(complement)) {
      return [seen.get(complement), i];
    }

    seen.set(nums[i], i); // insert AFTER the check so we never use the same element twice
  }

  return []; // unreachable when exactly one solution is guaranteed
}
```

**Why `Map` and not `{}`?**
- A plain object coerces keys to strings and inherits from `Object.prototype`. `"constructor" in {}` is `true`, and `-0`/`0` both become `"0"`.
- `if (obj[complement])` is a classic bug: index `0` is falsy. Use `has()` or `!== undefined`.
- `Map` is purpose-built for dynamic keys and is generally faster for frequent inserts and lookups.

**Duplicates:** for `[3,3]` the first `3` is stored, then the second `3` finds complement `3` at index 0, giving `[0,1]`. If a later duplicate overwrote an earlier index it wouldn't matter, because we return at the first match.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Brute force | O(n²) | O(1) |
| Sort + two pointers (keeping indices) | O(n log n) | O(n) |
| **One-pass hash map** | **O(n)** average | **O(n)** |

The hash map's worst case is technically O(n²) if every key collides, but V8's `Map` uses hashing that makes that irrelevant in practice. Mention it only if asked.

## 8. Testing

```js
const eqUnordered = (a, b) =>
  JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

const tests = [
  { nums: [2, 7, 11, 15], target: 9, expected: [0, 1] },   // basic
  { nums: [3, 2, 4], target: 6, expected: [1, 2] },        // must not reuse index 0
  { nums: [3, 3], target: 6, expected: [0, 1] },           // duplicates
  { nums: [-3, 4, 3, 90], target: 0, expected: [0, 2] },   // negatives
  { nums: [0, 4, 3, 0], target: 0, expected: [0, 3] },     // zeros, index 0 is falsy
  { nums: [1, 5, 9, 2], target: 11, expected: [2, 3] },    // answer at the end
  { nums: [1e9, -1e9, 5], target: 0, expected: [0, 1] },   // extreme values
];

for (const { nums, target, expected } of tests) {
  const got = twoSum(nums, target);
  console.assert(eqUnordered(got, expected), `twoSum(${nums}, ${target}) = ${got}, expected ${expected}`);
}

// Adversarial: large input, answer is the very last pair. Brute force is slow here, the map stays linear.
const big = Array.from({ length: 1e5 }, (_, i) => i);
console.assert(eqUnordered(twoSum(big, 2 * 1e5 - 3), [1e5 - 2, 1e5 - 1]));
```

**Dry run** for `[3,2,4]`, target `6`:

| i | nums[i] | complement | seen before check | action |
| --- | --- | --- | --- | --- |
| 0 | 3 | 3 | `{}` | store `3→0` |
| 1 | 2 | 4 | `{3:0}` | store `2→1` |
| 2 | 4 | 2 | `{3:0, 2:1}` | found, return `[1,2]` |

## 9. Alternatives

### a) Two-pass hash map
Build the full `value → index` map first, then look up each complement and make sure `map.get(complement) !== i`. Same complexity, but more code and the self-use check is easier to get wrong. The one-pass version is strictly better to present.

### b) Sort with indices + two pointers. O(n log n) time, O(n) space

Useful when the interviewer says "no hash maps" or when the data is already sorted.

```js
function twoSumSorted(nums, target) {
  const idx = nums.map((_, i) => i).sort((a, b) => nums[a] - nums[b]);
  let l = 0, r = idx.length - 1;

  while (l < r) {
    const sum = nums[idx[l]] + nums[idx[r]];
    if (sum === target) return [idx[l], idx[r]];
    if (sum < target) l++;
    else r--;
  }
  return [];
}
```

Why it works: in sorted order, if `sum < target` then the smallest element can't pair with anything (everything else is at most `nums[r]`), so we drop it. The symmetric argument applies when `sum > target`.

---

## Follow-ups interviewers ask

1. **Input is sorted:** two pointers, O(1) space (LeetCode 167, Two Sum II).
2. **Return all unique value pairs:** sort + two pointers and skip duplicates, or use a map with counts. Ask whether `[x, x]` needs two copies.
3. **Count pairs:** a map of `value → count`, adding `count[complement]` to the answer at each step.
4. **Data stream / design a class** (Two Sum III): `add(x)` and `find(target)`. Trade-off: an O(1) add with a count map and an O(n) find, vs. storing all pair sums for an O(1) find with an O(n) add and O(n²) memory. Pick based on read/write ratio.
5. **Huge array that doesn't fit in memory:** external sort + two pointers, or hash-partition by `value mod P` so complements land in predictable partitions.
6. **3Sum / 4Sum / kSum:** fix elements and reduce to Two Sum. Sorting + two pointers makes deduplication easy. See [Three Sum](../Two%20Pointers/04_Three%20Sum.md).
7. **Closest sum to target:** you can't use a hash map here, so use sort + two pointers and track the best difference.

## Common mistakes

- Inserting before checking, which returns `[i, i]` when `nums[i] * 2 === target`.
- `if (map[complement])`, which fails when the stored index is `0`.
- Sorting `nums` in place and returning the indices of the sorted array.
- Returning values instead of indices.
