---
sidebar_position: 4
---

# 3Sum

> **LeetCode 15 · Medium · Pattern: Sort + Two Pointers (reduce kSum to 2Sum)**

> Companies: Meta, Amazon, Google, Microsoft, Apple, Bloomberg, Adobe. One of the most-asked mediums. Interviewers focus on **duplicate handling** and on whether you can generalize to **kSum**.

Given an integer array `nums`, return all the triplets `[nums[i], nums[j], nums[k]]` such that `i != j`, `i != k`, `j != k`, and `nums[i] + nums[j] + nums[k] == 0`.

The solution set must **not contain duplicate triplets**. The order of the output and of the values inside each triplet doesn't matter.

```
Input: nums = [-1,0,1,2,-1,-4]  → Output: [[-1,-1,2],[-1,0,1]]
Input: nums = [0,1,1]           → Output: []
Input: nums = [0,0,0]           → Output: [[0,0,0]]
```

Constraints (LeetCode): `3 <= nums.length <= 3000`, `-10^5 <= nums[i] <= 10^5`.

---

## 1. Understand

Pick three **different positions** whose values sum to 0. Return the **distinct value-triplets**: `[-1,0,1]` should appear once even if several index combinations produce it.

Rephrased: for every value `a`, find all distinct pairs `(b, c)` later in the array with `b + c = -a`. That's **Two Sum** with target `-a`, run n times.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Return values or indices? | Values, so sorting is allowed. (If indices were needed, you'd have to keep the original positions.) |
| What does "no duplicates" mean exactly? | Distinct **value** triplets, regardless of order. `[-1,0,1]` and `[0,1,-1]` are the same. |
| Can the same value be used twice if it appears twice? | Yes. `[-1,-1,2]` is valid when `-1` appears at two indices. |
| Can I modify the input (sort in place)? | If not, copy first, which costs O(n) extra. |
| Size of n? | n ≤ 3000 means O(n²) ≈ 9M operations, which is fine. O(n³) ≈ 27 billion is not. |
| Is the target always 0? | Generalize to `target` if asked (3Sum Closest, 3Sum with a target). |

**Edge cases:** all zeros `[0,0,0,0]` (must return one triplet), all positives or all negatives (no answer), many duplicates `[-2,0,0,2,2]`, exactly 3 elements.

## 3. Brute force: try all triples, dedupe with a Set

```js
function threeSumBrute(nums) {
  const seen = new Set();
  const res = [];
  const n = nums.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (nums[i] + nums[j] + nums[k] === 0) {
          const triplet = [nums[i], nums[j], nums[k]].sort((a, b) => a - b);
          const key = triplet.join(',');          // canonical form, so order doesn't matter
          if (!seen.has(key)) {
            seen.add(key);
            res.push(triplet);
          }
        }
      }
    }
  }
  return res;
}
```

- Time **O(n³)**, Space **O(t)** for the dedupe set (t = number of triplets).
- **Why it works:** it checks every combination, and sorting each triplet gives one canonical key per value set.
- **When it's preferable:** never in production. Use it as a correctness oracle for testing the optimal version.
- **Limitations:** about 4.5 billion iterations at n = 3000, so it times out. String keys are also slow.

## 4. Optimize: find the bottleneck

The innermost loop asks: "given `a = nums[i]` and `b = nums[j]`, does `c = -a - b` exist?" That's a **lookup**, and it can be done in O(1) with a hash set or in amortized O(1) with two pointers on a sorted array, which drops one loop and gives O(n²).

**Why sort?** Sorting (O(n log n), which O(n²) dominates) gives us two things at once:
1. **Two Sum II** becomes possible for the inner pair: two pointers, O(1) space.
2. **Duplicates become adjacent**, so we can skip them with `nums[i] === nums[i-1]` instead of using a Set of string keys.

A bonus is **pruning**: once `nums[i] > 0`, every remaining number is positive, so no triplet can sum to 0 and we can `break`.

> Lower bound note: 3Sum is conjectured to need roughly n² time in general (the "3SUM-hard" problems in complexity theory), so O(n²) is the expected optimum. Saying this impresses interviewers.

## 5. Pattern: Sort + Two Pointers (kSum reduction)

> Fix one element and solve the remaining (k-1)-sum on the suffix. At k = 2, use converging two pointers on the sorted array. Skip equal neighbours at every level to avoid duplicates.

The same pattern shows up in:
- Two Sum II (sorted input), 3Sum Closest, 3Sum Smaller, 4Sum / kSum
- Valid Triangle Number (sort, fix the largest side, two pointers)
- Count pairs with sum less than a target

## 6. Implement (optimal: sort + two pointers)

```js
/**
 * @param {number[]} nums
 * @return {number[][]}
 */
function threeSum(nums) {
  nums.sort((a, b) => a - b);          // numeric sort! default sort is lexicographic
  const res = [];
  const n = nums.length;

  for (let i = 0; i < n - 2; i++) {
    if (nums[i] > 0) break;                            // prune: the rest are all positive
    if (i > 0 && nums[i] === nums[i - 1]) continue;    // dedupe the first element

    let left = i + 1;
    let right = n - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];

      if (sum < 0) {
        left++;                        // need a bigger sum
      } else if (sum > 0) {
        right--;                       // need a smaller sum
      } else {
        res.push([nums[i], nums[left], nums[right]]);
        left++;
        right--;
        // dedupe the second and third elements: skip values we just used
        while (left < right && nums[left] === nums[left - 1]) left++;
        while (left < right && nums[right] === nums[right + 1]) right--;
      }
    }
  }
  return res;
}
```

**Why this works (the two-pointer proof):** with `nums[i]` fixed and the suffix sorted:
- If `sum < 0`, then `nums[left]` paired with **any** index ≤ `right` gives a sum ≤ the current one, which is still < 0. So `nums[left]` can't be in any answer and we can discard it (`left++`).
- If `sum > 0`, the symmetric argument lets us discard `nums[right]`.
- Each step discards one candidate, so the inner loop is O(n) and no valid pair is ever skipped.

**Why the dedupe is correct:**
- **First element:** if `nums[i] === nums[i-1]`, every triplet starting with this value was already found in the previous iteration, which searched a superset suffix.
- **Second and third elements:** after a match, moving `left` past copies of the same value prevents pushing `[a, b, c]` again. We compare with `nums[left - 1]` (the value just used), and only after a match. Skipping before a match would lose `[-1,-1,2]`.

**Why `nums.sort((a, b) => a - b)`:** `[-1, -4, 10, 2].sort()` gives `[-1, -4, 10, 2]` as strings, because sorting is lexicographic. This is one of the most common JS bugs in interviews.

## 7. Complexity

| Approach | Time | Extra space | Notes |
| --- | --- | --- | --- |
| Brute force + Set | O(n³) | O(t) | Too slow for n = 3000 |
| Sort + hash set per `i` | O(n²) | O(n) | See Alternative (a) |
| No-sort hash approach | O(n²) | O(n + t) | See Alternative (b), keeps the input order |
| **Sort + two pointers** | **O(n²)** | **O(1)** besides the output\* | Interview favourite |

\* The sort itself uses O(log n) to O(n) space depending on the engine. V8 uses TimSort, which is O(n) in the worst case. Say "O(1) besides the sort and the output".

The output can hold up to O(n²) triplets in theory, but each triplet is pushed in O(1), so the time bound still holds.

## 8. Testing

```js
// normalize so order doesn't matter
const norm = (arr) =>
  JSON.stringify(arr.map((t) => [...t].sort((a, b) => a - b)).sort((a, b) => (a.join() < b.join() ? -1 : 1)));

const tests = [
  { nums: [-1, 0, 1, 2, -1, -4], expected: [[-1, -1, 2], [-1, 0, 1]] }, // classic
  { nums: [0, 1, 1], expected: [] },                                    // no answer
  { nums: [0, 0, 0], expected: [[0, 0, 0]] },                           // minimal
  { nums: [0, 0, 0, 0], expected: [[0, 0, 0]] },                        // dedupe zeros
  { nums: [-2, 0, 1, 1, 2], expected: [[-2, 0, 2], [-2, 1, 1]] },       // repeated middle value
  { nums: [1, 2, 3], expected: [] },                                    // all positive (prune)
  { nums: [-1, -2, -3], expected: [] },                                 // all negative
  { nums: [3, 0, -2, -1, 1, 2], expected: [[-2, -1, 3], [-2, 0, 2], [-1, 0, 1]] },
];

for (const { nums, expected } of tests) {
  console.assert(norm(threeSum([...nums])) === norm(expected), `threeSum(${nums})`);
}

// Adversarial 1: 3000 zeros. Without dedupe the output would hold ~4.5 billion triplets.
console.assert(threeSum(new Array(3000).fill(0)).length === 1);

// Adversarial 2: random arrays checked against the brute-force oracle
for (let t = 0; t < 500; t++) {
  const nums = Array.from({ length: 10 }, () => Math.floor(Math.random() * 11) - 5);
  console.assert(norm(threeSum([...nums])) === norm(threeSumBrute([...nums])), nums);
}
```

**Dry run** on the sorted `[-4,-1,-1,0,1,2]`:

| i (val) | left, right | sum | action |
| --- | --- | --- | --- |
| 0 (-4) | 1, 5 | -4-1+2 = -3 | left++ (and so on until left meets right: none found) |
| 1 (-1) | 2, 5 | -1-1+2 = 0 | push `[-1,-1,2]`, move both, now 3, 4 |
| 1 (-1) | 3, 4 | -1+0+1 = 0 | push `[-1,0,1]`, pointers cross |
| 2 (-1) | | | same as `nums[1]`, so **skip** |
| 3 (0) | 4, 5 | 0+1+2 = 3 | right--, pointers cross |
| 4 (1) | | | `1 > 0`, so **break** |

## 9. Alternatives

### a) Sort + hash set for the inner Two Sum. O(n²) time, O(n) space

```js
function threeSumHashSet(nums) {
  nums.sort((a, b) => a - b);
  const res = [];
  const n = nums.length;

  for (let i = 0; i < n - 2; i++) {
    if (nums[i] > 0) break;
    if (i > 0 && nums[i] === nums[i - 1]) continue;

    const seen = new Set();
    for (let j = i + 1; j < n; j++) {
      const complement = -nums[i] - nums[j];
      if (seen.has(complement)) {
        res.push([nums[i], complement, nums[j]]);
        while (j + 1 < n && nums[j] === nums[j + 1]) j++; // dedupe the third element
      }
      seen.add(nums[j]);
    }
  }
  return res;
}
```

- **When it's preferable:** when you want to reuse the "Two Sum with a hash map" mental model.
- **Limitations:** it uses O(n) extra space per `i`, and hashing makes it slower in practice than two pointers.

### b) No-sort version (the follow-up "what if you can't sort / modify the input?")

```js
function threeSumNoSort(nums) {
  const res = [];
  const found = new Set();      // canonical keys of triplets already added
  const usedFirst = new Set();  // values already tried as the first element
  const seenAt = new Map();     // value -> the i during which it was last seen

  for (let i = 0; i < nums.length; i++) {
    if (usedFirst.has(nums[i])) continue;
    usedFirst.add(nums[i]);

    for (let j = i + 1; j < nums.length; j++) {
      const complement = -nums[i] - nums[j];
      if (seenAt.get(complement) === i) {   // seen in THIS i's pass, so a different index
        const triplet = [nums[i], nums[j], complement].sort((a, b) => a - b);
        const key = triplet.join(',');
        if (!found.has(key)) {
          found.add(key);
          res.push(triplet);
        }
      }
      seenAt.set(nums[j], i);  // stamping with i avoids allocating a new Set per i
    }
  }
  return res;
}
```

- O(n²) time, O(n + t) space.
- **When it's preferable:** the input is read-only, or the original order matters.
- **Limitations:** the string keys and hashing make it noticeably slower, and there's more code to get wrong.

### c) Generalized kSum (answers "now do 4Sum")

```js
// nums must be sorted. Returns unique k-tuples summing to target.
function kSum(nums, target, k, start = 0) {
  const res = [];
  if (start === nums.length) return res;

  // prune: the average of the remaining picks must lie in [min, max]
  const avg = target / k;
  if (nums[start] > avg || avg > nums[nums.length - 1]) return res;

  if (k === 2) {
    let l = start, r = nums.length - 1;
    while (l < r) {
      const sum = nums[l] + nums[r];
      if (sum < target || (l > start && nums[l] === nums[l - 1])) l++;
      else if (sum > target || (r < nums.length - 1 && nums[r] === nums[r + 1])) r--;
      else res.push([nums[l++], nums[r--]]);
    }
    return res;
  }

  for (let i = start; i < nums.length; i++) {
    if (i > start && nums[i] === nums[i - 1]) continue;
    for (const rest of kSum(nums, target - nums[i], k - 1, i + 1)) {
      res.push([nums[i], ...rest]);
    }
  }
  return res;
}
// 3Sum: kSum(sorted, 0, 3)    4Sum: kSum(sorted, target, 4)
```

Time is O(n^(k-1)), and the recursion depth is k. In languages with fixed-width integers, 4Sum sums can overflow a 32-bit int. JS numbers are safe up to 2^53.

---

## Follow-ups interviewers ask

1. **3Sum Closest (LeetCode 16):** the same loop, tracking `best` by `|sum - target|`. Return immediately on an exact match, and no dedupe is needed.

   ```js
   function threeSumClosest(nums, target) {
     nums.sort((a, b) => a - b);
     let best = nums[0] + nums[1] + nums[2];
     for (let i = 0; i < nums.length - 2; i++) {
       let l = i + 1, r = nums.length - 1;
       while (l < r) {
         const sum = nums[i] + nums[l] + nums[r];
         if (Math.abs(sum - target) < Math.abs(best - target)) best = sum;
         if (sum < target) l++;
         else if (sum > target) r--;
         else return sum;
       }
     }
     return best;
   }
   ```
2. **3Sum Smaller (count triplets with a sum below target):** when `sum < target`, every index from `left+1` to `right` also works with `left`, so do `count += right - left` and then `left++`.
3. **Count triplets instead of listing them, with duplicates counted by index** (3Sum With Multiplicity): use a frequency map and combinatorics (`C(cnt, 2)`, `C(cnt, 3)`), taken modulo 1e9+7.
4. **Very large n, small value range:** counting sort or a frequency array over the value range is O(n + R²).
5. **Distributed / huge data:** partition by value ranges and broadcast the small partitions. Mostly a discussion point.

## Common mistakes

- `nums.sort()` without a comparator.
- Deduping `left` **before** checking for a match, which loses `[-1,-1,2]`.
- Using `nums[i] === nums[i+1]` for the outer dedupe, which skips valid triplets that use two copies.
- Forgetting `left < right` in the inner skip loops.
- Writing `break` on `nums[i] > 0` when the target isn't 0. The prune only holds for target 0 (or must be adjusted).
