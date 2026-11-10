---
sidebar_position: 41
---

# Subarray Sum Equals K

> **LeetCode 560 · Medium · Pattern: Prefix Sum + Hash Map (count of earlier prefixes)**

> Companies: Meta (one of its most asked), Amazon, Google, Microsoft, Bloomberg, Apple, Uber. The trap is **sliding window**: candidates reach for it, and it's wrong because `nums` can contain negatives. Interviewers want you to say *why* it fails, then move to "prefix sum + map".

Given an integer array `nums` and an integer `k`, return the **number of contiguous, non-empty subarrays** whose sum equals `k`.

```
Input: nums = [1, 1, 1], k = 2       → Output: 2     ([1,1] at 0..1 and 1..2)
Input: nums = [1, 2, 3], k = 3       → Output: 2     ([1,2] and [3])
Input: nums = [1, -1, 0], k = 0      → Output: 3     ([1,-1], [0], [1,-1,0])
```

Constraints (LeetCode): `1 <= nums.length <= 2 * 10^4`, `-1000 <= nums[i] <= 1000`, `-10^7 <= k <= 10^7`.

---

## 1. Understand

Count every pair `(i, j)` with `i <= j` such that `nums[i] + ... + nums[j] === k`. We're counting subarrays, not finding one, and overlapping subarrays all count separately.

Rephrased with prefix sums, where `P[t]` is the sum of the first `t` elements (`P[0] = 0`):

```
sum(i..j) = P[j+1] − P[i]
sum(i..j) = k   ⇔   P[i] = P[j+1] − k
```

So for each ending position, the question becomes: **how many earlier prefix sums equal `current − k`?**

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Can `nums` contain negatives or zeros? | **Yes.** This kills sliding window (the window sum isn't monotonic) and makes zeros create many matches. |
| Can `k` be 0 or negative? | Yes. The prefix-sum approach doesn't care. |
| Count, or return the subarrays, or the longest one? | Different bookkeeping: count → map of counts; longest → map of **first index** (see follow-ups). |
| Contiguous? | Yes, "subarray" means contiguous. (Subsequences would be a DP / subset-sum problem.) |
| Overflow? | `n · max|nums[i]|` = 2·10^7, safe in JS numbers. For huge inputs, mention `BigInt` or 64-bit. |

**Edge cases:** a single element equal to `k`, `k = 0` with zeros (e.g. `[0,0,0]` → 6), negatives that cancel out, the whole array summing to `k`, and no matches.

## 3. Brute force

### a) Every pair of endpoints, summed from scratch — O(n³)

Mention it, then immediately improve it.

### b) Extend each start with a running sum — O(n²)

```js
function subarraySumBrute(nums, k) {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    let sum = 0;
    for (let j = i; j < nums.length; j++) {
      sum += nums[j];              // sum(i..j), reusing sum(i..j-1)
      if (sum === k) count++;      // no break: later j can match again (zeros, negatives)
    }
  }
  return count;
}
```

- Time **O(n²)**, space **O(1)**.
- **Why it works:** it checks every subarray exactly once, building each sum from the previous one.
- **When it's preferable:** small `n`, a testing oracle, or memory-constrained settings.
- **Limitations:** 4·10^8 steps at n = 2·10^4, too slow for the expected solution.

## 4. Optimize: find the bottleneck

### Why not sliding window?

Sliding window needs **monotonicity**: growing the window must only increase the sum, and shrinking must only decrease it. With negatives, `[1, -1, 1]`, `k = 1` has a window whose sum goes `1, 0, 1`. You can't decide whether to grow or shrink. (Sliding window **does** work when all numbers are positive; see alternative c.)

### The real bottleneck

For a fixed end `j`, the brute force scans every start `i` looking for `P[i] = P[j+1] − k`. That's a **lookup**, and lookups belong in a hash map.

Keep a map `prefixCount` of how many times each prefix sum has appeared so far. At each index, add `prefixCount[current − k]` to the answer, then record `current`. One pass, O(1) per step.

## 5. Pattern: prefix sum + hash map ("Two Sum on prefix sums")

> When a question asks about subarrays with a **target sum** (or target remainder / target balance), rewrite it as a relation between two prefix sums, then look up the partner in a map while scanning.

This is literally [Two Sum](../100%20Easy/01_Two%20Sum.md), where the pair is `(P[i], P[j+1])` and the target difference is `k`. The map stores different things depending on the question:

| Question | Map key | Map value |
| --- | --- | --- |
| Count subarrays with sum `k` | prefix sum | how many times seen |
| Longest subarray with sum `k` | prefix sum | **first** index seen |
| Any subarray with sum ≡ 0 (mod k) | prefix sum mod k | first index seen |

The same pattern shows up in:
- [Continuous Subarray Sum](./42_Continuous%20Subarray%20Sum.md) (prefix mod k)
- Subarray Sums Divisible by K (LC 974), Binary Subarrays With Sum (LC 930)
- Contiguous Array (LC 525): map 0 → −1, then find longest sum 0
- Count Number of Nice Subarrays (LC 1248), Path Sum III (LC 437, prefix sums on a tree path)
- Number of Submatrices That Sum to Target (LC 1074), the 2D version

## 6. Implement (optimal: prefix sum + count map)

```js
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number}
 */
function subarraySum(nums, k) {
  // prefixCount.get(s) = how many prefixes seen so far have sum s.
  // Seed with the empty prefix (sum 0) so subarrays starting at index 0 are counted.
  const prefixCount = new Map([[0, 1]]);
  let current = 0;
  let count = 0;

  for (const x of nums) {
    current += x;                                   // current = P[j+1]
    count += prefixCount.get(current - k) || 0;     // every earlier P[i] = current - k is a match
    prefixCount.set(current, (prefixCount.get(current) || 0) + 1);
  }

  return count;
}
```

- **Why it works:**
  - **Invariant:** before processing index `j`, `prefixCount` holds every prefix sum `P[0..j]`, i.e. every possible start `i <= j`.
  - Each match `P[i] = current − k` corresponds to exactly one subarray `i..j` with sum `k`, so adding the count counts each subarray once.
- **Why look up before inserting:** inserting `current` first would let a prefix match itself when `k = 0`, counting an **empty** subarray.
- **Why seed `{0: 1}`:** it represents the empty prefix `P[0]`. Without it, subarrays that start at index 0 are missed (e.g. `[3]`, `k = 3`).
- **When it's preferable:** always for arbitrary integers. It's the expected answer.
- **Limitations:** O(n) extra memory for the map. It counts, but doesn't enumerate, subarrays (enumerating can be O(n²) outputs anyway).

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| All pairs, sum from scratch | O(n³) | O(1) |
| Running sum from each start | O(n²) | O(1) |
| Prefix array + all pairs | O(n²) | O(n) |
| **Prefix sum + hash map** | **O(n)** average | **O(n)** |
| Sliding window (positives only, alt. c) | O(n) | O(1) |

Hash map operations are O(1) on average, so the bound is average-case. Adversarial hash collisions aren't a practical concern for JS `Map` with number keys, but you can mention a sorted structure (O(n log n)) as the worst-case-safe version.

## 8. Testing

```js
const tests = [
  [[1, 1, 1], 2, 2],            // classic, overlapping
  [[1, 2, 3], 3, 2],            // single element and pair
  [[1], 1, 1],                  // single element equals k
  [[1], 0, 0],                  // no empty subarray counted
  [[0, 0, 0], 0, 6],            // zeros: every subarray (3 + 2 + 1)
  [[1, -1, 0], 0, 3],           // negatives cancel out
  [[-1, -1, 1], 0, 1],          // negative values
  [[3, 4, 7, 2, -3, 1, 4, 2], 7, 4],
  [[1, 2, 3], 7, 0],            // no match
  [[-1, -1, -1], -2, 2],        // negative k
];

for (const [nums, k, expected] of tests) {
  console.assert(subarraySum(nums, k) === expected, `subarraySum(${nums}, ${k}) → ${subarraySum(nums, k)}, expected ${expected}`);
  console.assert(subarraySumBrute(nums, k) === expected, `brute(${nums}, ${k})`);
}

// Adversarial: random arrays with negatives and zeros, compared with brute force
for (let t = 0; t < 2000; t++) {
  const n = 1 + Math.floor(Math.random() * 12);
  const nums = Array.from({ length: n }, () => Math.floor(Math.random() * 7) - 3);
  const k = Math.floor(Math.random() * 9) - 4;
  console.assert(subarraySum(nums, k) === subarraySumBrute(nums, k), nums, k);
}

// Adversarial: 2·10^4 zeros with k = 0 → n(n+1)/2 subarrays, all counted in O(n)
const zeros = new Array(2e4).fill(0);
console.assert(subarraySum(zeros, 0) === (2e4 * (2e4 + 1)) / 2);
```

**Dry run** for `nums = [1, 2, 3]`, `k = 3`:

| x | current | look up `current − k` | found | count | map after |
| --- | --- | --- | --- | --- | --- |
| — | 0 | | | 0 | {0:1} |
| 1 | 1 | −2 | 0 | 0 | {0:1, 1:1} |
| 2 | 3 | 0 | 1 → `[1,2]` | 1 | {0:1, 1:1, 3:1} |
| 3 | 6 | 3 | 1 → `[3]` | 2 | {0:1, 1:1, 3:1, 6:1} |

Result: `2`.

## 9. Alternatives

### a) Explicit prefix array + map (two-step version)

Same idea, written in the `P[j] − P[i] = k` form. Some people find this easier to derive on a whiteboard before compressing it into one variable.

```js
function subarraySumPrefixArray(nums, k) {
  const P = new Array(nums.length + 1);
  P[0] = 0;
  for (let i = 0; i < nums.length; i++) P[i + 1] = P[i] + nums[i];

  const seen = new Map();
  let count = 0;
  for (const p of P) {
    count += seen.get(p - k) || 0;
    seen.set(p, (seen.get(p) || 0) + 1);
  }
  return count;
}
```

- Time O(n), space O(n) for both `P` and the map.
- **When it's preferable:** when you need `P` again (e.g. to recover the actual subarrays).

### b) Divide and conquer / merge sort on prefix sums

Counting pairs `P[i] < P[j]` with `P[j] − P[i]` in a **range** is Count of Range Sum (LC 327), solved in O(n log n) with merge sort or a Fenwick tree. For an exact target the hash map is simpler, but this is the approach to name if the interviewer changes "equals k" to "between lower and upper".

### c) Sliding window (only when every number is positive)

If `nums[i] > 0`, the window sum is monotonic, so two pointers work in O(1) extra space.

```js
// Requires every nums[i] > 0 and k > 0.
function subarraySumPositive(nums, k) {
  let left = 0, sum = 0, count = 0;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum > k) sum -= nums[left++];   // shrink until sum <= k
    if (sum === k) count++;                // with all positives, at most one window ends at `right`
  }
  return count;
}
```

- Time O(n), space **O(1)**.
- **Why it works:** with positives, for each `right` there is at most one `left` giving sum `k`, and that `left` only ever moves forward.
- **When it's preferable:** positive-only data where memory matters.
- **Limitations:** wrong with zeros or negatives. With zeros, several windows can share a `right` (use `atMost(k) − atMost(k − 1)` for non-negative integers, as in LC 930).

---

## Follow-ups interviewers ask

### 1. Longest subarray with sum `k` (LC 325)
Store the **first** index of each prefix sum (never overwrite) and maximize `j − firstIndex[current − k]`.

```js
function maxSubArrayLen(nums, k) {
  const first = new Map([[0, -1]]);       // empty prefix ends "before index 0"
  let current = 0, best = 0;
  for (let j = 0; j < nums.length; j++) {
    current += nums[j];
    if (first.has(current - k)) best = Math.max(best, j - first.get(current - k));
    if (!first.has(current)) first.set(current, j);   // keep the earliest index
  }
  return best;
}
```

### 2. Return the subarrays themselves
Store a **list of indices** per prefix sum. The output can be O(n²) (e.g. all zeros, `k = 0`), so say that the time is O(n + output).

### 3. Count subarrays whose sum is divisible by `k` (LC 974)
Key the map by `((current % k) + k) % k` instead of `current`, and look up the same remainder. See [Continuous Subarray Sum](./42_Continuous%20Subarray%20Sum.md).

### 4. 2D: number of submatrices that sum to target (LC 1074)
Fix a pair of rows `(top, bottom)`, collapse each column between them into one number, and run this exact 1D algorithm on the collapsed array. O(rows² · cols).

### 5. Streaming input
The algorithm is already one pass. Memory is the map, which can grow to O(n) distinct sums. If values are bounded, an array indexed by `sum + offset` is faster than a `Map`.

## Common mistakes

- Using sliding window with negatives or zeros.
- Forgetting the `{0: 1}` seed, which misses subarrays starting at index 0.
- Inserting the current prefix **before** the lookup, which counts empty subarrays when `k = 0`.
- Looking up `k − current` instead of `current − k`.
- Using a `Set` instead of counts: the same prefix sum can appear many times, and each occurrence is a different start.
- Breaking out of the inner brute-force loop after the first match (zeros and negatives allow more matches).
