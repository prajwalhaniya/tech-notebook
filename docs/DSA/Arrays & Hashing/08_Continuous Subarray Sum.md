---
sidebar_position: 8
---

# Continuous Subarray Sum

> **LeetCode 523 · Medium · Pattern: Prefix Sum mod k + Hash Map (first index of each remainder)**

> Companies: Meta (very frequent), Amazon, Google, Microsoft, Bloomberg. It looks like [Subarray Sum Equals K](./07_Subarray%20Sum%20Equals%20K.md), but has two twists that catch people: you compare **remainders**, not sums, and the subarray must have **length ≥ 2**, which decides what you store in the map (the **first index**, not a count).

Given an integer array `nums` and an integer `k`, return `true` if `nums` has a **good subarray**: a contiguous subarray of **length at least 2** whose sum is a **multiple of `k`**. Zero counts as a multiple of `k`.

```
Input: nums = [23, 2, 4, 6, 7],  k = 6   → true    ([2, 4] sums to 6)
Input: nums = [23, 2, 6, 4, 7],  k = 6   → true    (the whole array sums to 42)
Input: nums = [23, 2, 6, 4, 7],  k = 13  → false
Input: nums = [0, 0],            k = 1   → true    (0 is a multiple of every k)
Input: nums = [5, 0],            k = 3   → false   (only [0] works, but its length is 1)
```

Constraints (LeetCode): `1 <= nums.length <= 10^5`, `0 <= nums[i] <= 10^9`, `0 <= sum(nums) <= 2^31 − 1`, `1 <= k <= 2^31 − 1`.

---

## 1. Understand

Is there a stretch of at least two adjacent numbers whose total divides evenly by `k`?

Rephrased with prefix sums `P` (`P[0] = 0`):

```
sum(i..j) = P[j+1] − P[i]
sum(i..j) is a multiple of k   ⇔   P[j+1] ≡ P[i]  (mod k)
length ≥ 2                      ⇔   (j+1) − i ≥ 2
```

So: **do two prefix sums with the same remainder appear at least 2 positions apart?**

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Minimum length? | **2.** This is why we store the *first* index of each remainder and check the distance. |
| Is 0 a multiple of `k`? | Yes. `[0, 0]` is always good. |
| Can `k` be 0? | Not in current constraints (`k >= 1`). An older version allowed it, meaning "sum equals 0"; handle it by not taking `% 0` (which is `NaN` in JS). |
| Can `nums` or `k` be negative? | Not in current constraints. If they can, normalize with `((x % k) + k) % k`, because JS `%` keeps the sign of the dividend (`-1 % 6 === -1`). |
| Return a boolean or the subarray? | Boolean. Returning indices is easy: the map gives the start. |
| Overflow? | The total fits in 32 bits, and taking `% k` at each step keeps the running value below `k` anyway. |

**Edge cases:** `n = 1` (always false), `[0, 0]`, a single zero next to a non-multiple (`[5, 0]`, `k = 3`), `k = 1` (any length-2 subarray works), `k` larger than the total, and the whole array as the answer.

## 3. Brute force: every subarray of length ≥ 2

```js
function checkSubarraySumBrute(nums, k) {
  for (let i = 0; i < nums.length; i++) {
    let sum = nums[i];
    for (let j = i + 1; j < nums.length; j++) {   // j starts at i+1, so length >= 2
      sum += nums[j];
      if (sum % k === 0) return true;
    }
  }
  return false;
}
```

- Time **O(n²)**, space **O(1)**.
- **Why it works:** it checks every subarray of length ≥ 2, reusing the running sum.
- **When it's preferable:** small `n`, or as a testing oracle.
- **Limitations:** 5·10^9 checks at n = 10^5. Too slow.

## 4. Optimize: find the bottleneck

For each end `j`, the brute force scans every start looking for one whose prefix has the **same remainder**. That's a lookup → hash map.

Two decisions remain:

1. **Key:** `P mod k`, not `P`. Two different sums like 23 and 29 both have remainder 5 with `k = 6`, and their difference (6) is a multiple.
2. **Value:** the **earliest** index where that remainder appeared. To satisfy length ≥ 2 we want the start as far left as possible, so we never overwrite. (A count, as in LC 560, would lose the position information.)

Seed the map with `{0: -1}`: the empty prefix has remainder 0 and sits just before index 0. That makes subarrays starting at index 0 checkable.

## 5. Pattern: prefix sum modulo k + hash map

> "Subarray sum is a multiple of k" ⇔ "two prefix sums share a remainder". Store remainders in a map while scanning.

Which value you store depends on the question:

| Question | Map value |
| --- | --- |
| Exists, length ≥ 2 (this problem) | first index of each remainder |
| Count subarrays divisible by k (LC 974) | count of each remainder |
| Shortest subarray to remove so the rest is divisible by p (LC 1590) | **last** index of each remainder |

Related: [Subarray Sum Equals K](./07_Subarray%20Sum%20Equals%20K.md), Contiguous Array (LC 525), Make Sum Divisible by P (LC 1590). The underlying fact is `a ≡ b (mod k)` ⇔ `k` divides `a − b`.

## 6. Implement (optimal: first index of each remainder)

```js
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {boolean}
 */
function checkSubarraySum(nums, k) {
  // firstSeen.get(r) = the smallest index j such that (nums[0] + ... + nums[j]) % k === r.
  // The empty prefix has remainder 0 at "index -1".
  const firstSeen = new Map([[0, -1]]);
  let remainder = 0;

  for (let j = 0; j < nums.length; j++) {
    remainder = (remainder + nums[j]) % k;   // stays in [0, k), so it never overflows

    if (firstSeen.has(remainder)) {
      // Subarray (firstSeen + 1 .. j) has a sum that's a multiple of k.
      if (j - firstSeen.get(remainder) >= 2) return true;
    } else {
      firstSeen.set(remainder, j);           // only record the first time
    }
  }

  return false;
}
```

- **Why it works:**
  - If prefixes ending at `i` and `j` share a remainder, `nums[i+1..j]` has length `j − i` and a sum divisible by `k`.
  - Keeping only the **earliest** `i` for each remainder gives the longest candidate ending at `j`. If even that is shorter than 2, no other start with the same remainder can work.
- **Why not overwrite:** consider `[5, 0, 0]` with `k = 3` (remainders `2, 2, 2`). If index 1 overwrote index 0, then at `j = 2` the distance would be 1, and the valid answer `[0, 0]` (indices 1..2, distance from 0 is 2) would be missed.
- **Why `{0: -1}`:** without it, `[2, 4]` with `k = 6` fails, because the subarray starts at index 0.
- **When it's preferable:** always. It's the expected answer.
- **Limitations:** O(min(n, k)) extra memory for the map. For negative inputs you must normalize the remainder.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| All subarrays, sum from scratch | O(n³) | O(1) |
| Running sum from each start | O(n²) | O(1) |
| **Remainder → first index map** | **O(n)** average | **O(min(n, k))** |
| Delayed-insert set (alt. a) | O(n) average | O(min(n, k)) |

The map holds at most one entry per distinct remainder, so it can't exceed `k` entries, and it can't exceed `n + 1` either.

## 8. Testing

```js
const tests = [
  [[23, 2, 4, 6, 7], 6, true],     // [2, 4]
  [[23, 2, 6, 4, 7], 6, true],     // the whole array
  [[23, 2, 6, 4, 7], 13, false],
  [[0, 0], 1, true],               // 0 is a multiple of k
  [[0], 1, false],                 // length 1 is never enough
  [[5, 0], 3, false],              // [0] alone is too short
  [[5, 0, 0], 3, true],            // [0, 0], needs first-index (no overwrite)
  [[1, 2, 3], 5, true],            // [2, 3]
  [[1, 0], 2, false],
  [[1, 1], 2, true],               // starts at index 0, needs the {0: -1} seed
  [[2, 4, 3], 6, true],            // starts at index 0
  [[1, 2, 12], 6, false],          // sums 3, 14, 15: none divisible by 6
];

for (const [nums, k, expected] of tests) {
  for (const fn of [checkSubarraySum, checkSubarraySumDelayed, checkSubarraySumBrute]) {
    console.assert(fn(nums, k) === expected, `${fn.name}(${nums}, ${k}) → ${fn(nums, k)}, expected ${expected}`);
  }
}

// Adversarial: random arrays (with lots of zeros and multiples), compared with brute force
for (let t = 0; t < 3000; t++) {
  const n = 1 + Math.floor(Math.random() * 10);
  const nums = Array.from({ length: n }, () => Math.floor(Math.random() * 8));
  const k = 1 + Math.floor(Math.random() * 9);
  const expected = checkSubarraySumBrute(nums, k);
  console.assert(checkSubarraySum(nums, k) === expected, nums, k);
  console.assert(checkSubarraySumDelayed(nums, k) === expected, nums, k);
}

// Adversarial: 10^5 ones with a huge k → false, must finish in O(n)
console.assert(checkSubarraySum(new Array(1e5).fill(1), 2 ** 31 - 1) === false);
```

**Dry run** for `nums = [23, 2, 4, 6, 7]`, `k = 6`:

| j | nums[j] | remainder | in map? | action |
| --- | --- | --- | --- | --- |
| — | | 0 | | map = {0: −1} |
| 0 | 23 | 5 | no | map[5] = 0 |
| 1 | 2 | 1 | no | map[1] = 1 |
| 2 | 4 | 5 | yes, at 0 | distance 2 − 0 = 2 ≥ 2 → **true** (`[2, 4]`) |

## 9. Alternatives

### a) Set with delayed insertion

Instead of storing indices, keep a `Set` of remainders that are **at least two positions back**. Insert the *previous* prefix's remainder one step late, so a match is automatically at distance ≥ 2.

```js
function checkSubarraySumDelayed(nums, k) {
  const seen = new Set();   // remainders of prefixes ending at index <= j - 2 (including the empty prefix)
  let prev = 0;             // remainder of the prefix ending at j - 1
  let curr = 0;

  for (let j = 0; j < nums.length; j++) {
    curr = (prev + nums[j]) % k;
    if (seen.has(curr)) return true;
    seen.add(prev);         // prefix ending at j-1 becomes eligible for j+1 onwards
    prev = curr;
  }
  return false;
}
```

- Time O(n), space O(min(n, k)).
- **Why it works:** at step `j`, the set contains only prefixes ending at `j − 2` or earlier, so any match gives a subarray of length ≥ 2.
- **When it's preferable:** when you want to avoid the distance check entirely, and as a neat way to show you understand *why* the length constraint matters.
- **Limitations:** the one-step lag is easy to get wrong under pressure. It can't easily return the subarray's indices.

### b) Why there's no O(1) pigeonhole shortcut

There are `n + 1` prefixes and only `k` remainders, so for `n >= k` two prefixes must share a remainder. But they can be **adjacent** (a single element divisible by `k`, e.g. `[6, 1]` with `k = 6`), which is length 1. So the pigeonhole argument guarantees a divisible subarray, not a *good* one. It's a nice point to raise to show you've thought about the length constraint, but the O(n) scan is still required.

---

## Follow-ups interviewers ask

### 1. Count the subarrays whose sum is divisible by `k` (LC 974, any length ≥ 1, negatives allowed)

Count map instead of first-index map, and normalize negatives.

```js
function subarraysDivByK(nums, k) {
  const count = new Array(k).fill(0);
  count[0] = 1;                                  // the empty prefix
  let rem = 0, total = 0;
  for (const x of nums) {
    rem = (((rem + x) % k) + k) % k;             // JS % can be negative
    total += count[rem];
    count[rem]++;
  }
  return total;
}
```

### 2. Return the longest such subarray
The first-index map already gives, for each `j`, the longest candidate ending at `j`. Track the maximum `j − firstSeen[rem]` instead of returning early.

### 3. `k = 0` (older version of the problem)
"Multiple of 0" means "sum equals 0". Skip the `% k` and key by the raw prefix sum. The rest is identical.

### 4. Negative numbers or negative `k`
Use `Math.abs(k)` and normalize each remainder into `[0, |k|)`.

## Common mistakes

- Overwriting the stored index (store the **first** occurrence only).
- Forgetting the `{0: -1}` seed, which misses subarrays starting at index 0.
- Checking `j - i >= 1` instead of `>= 2`, which accepts a single element like `[6]`.
- Using JS `%` on negatives without normalizing (`-1 % 6 === -1`, not `5`).
- Accumulating the raw sum and only taking `% k` at the lookup. It works here, but it overflows in languages with fixed-size integers. Reduce at every step.
- Treating it like LC 560 with a count map: a count can't tell you whether the matching prefix is far enough back.
