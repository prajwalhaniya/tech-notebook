---
sidebar_position: 5
---

# Koko Eating Bananas

> **LeetCode 875 · Medium · Pattern: Binary Search on the Answer (parametric search)**

> Companies: Google, Meta, Amazon, Microsoft, DoorDash, Airbnb. It's the standard introduction to **binary search on the answer**: the array isn't sorted and you don't search it. You search the range of possible answers. Interviewers expect you to name the monotonic property out loud, and then they often move on to a variant (ship packages, split array, make bouquets) to see whether you recognise the same pattern.

There are `n` piles of bananas; pile `i` has `piles[i]`. The guards return in `h` hours. Koko picks an eating speed `k` (bananas per hour). Each hour she picks one pile and eats `k` bananas from it; if the pile has fewer than `k`, she eats all of it and **doesn't eat any more that hour**. Return the **minimum integer `k`** that lets her eat everything within `h` hours.

```
Input: piles = [3,6,7,11], h = 8         → Output: 4
Input: piles = [30,11,23,4,20], h = 5    → Output: 30
Input: piles = [30,11,23,4,20], h = 6    → Output: 23
```

Constraints (LeetCode): `1 <= piles.length <= 10^4`, `piles.length <= h <= 10^9`, `1 <= piles[i] <= 10^9`.

Prerequisite: [Binary Search](./02_Binary%20Search.md), especially the "first true" template.

---

## 1. Understand

A pile of `p` bananas takes `⌈p / k⌉` hours at speed `k`, because leftover time in an hour is wasted. So the total time is

```
hours(k) = Σ ⌈piles[i] / k⌉
```

We want the **smallest** `k` with `hours(k) <= h`.

For `piles = [3,6,7,11]`, `h = 8`:

| k | hours per pile | total | ≤ 8? |
| --- | --- | --- | --- |
| 3 | 1 + 2 + 3 + 4 | 10 | no |
| **4** | 1 + 2 + 2 + 3 | **8** | **yes** ← answer |
| 5 | 1 + 2 + 2 + 3 | 8 | yes |
| 11 | 1 + 1 + 1 + 1 | 4 | yes |

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Is `h >= piles.length` guaranteed? | Yes. Each pile takes at least one hour, so with `h < n` there's no answer. If not guaranteed, return `-1`. |
| Must `k` be an integer? | Yes. A real-valued speed changes the search to binary search on doubles (follow-ups). |
| Can she move to another pile within an hour? | No. That rule is what makes it `⌈p/k⌉` instead of `sum / k`. |
| Value ranges? | Piles up to 10^9 and `n` up to 10^4: the hour total can reach 10^13. That's fine in JS numbers (exact up to 2^53), but a 32-bit `int` overflows in Java/C++, so use `long`. |

**Edge cases:** `h === n` (the answer is `max(piles)`), `h` huge (the answer is `1`), one pile (the answer is `⌈p/h⌉`), all piles equal, and a pile of 10^9.

## 3. Brute force

Try speeds `1, 2, 3, …` and return the first that works. `k = max(piles)` always works (one hour per pile, `n <= h`), so the loop ends.

```js
function hoursAt(piles, k) {
  let hours = 0;
  for (const p of piles) hours += Math.ceil(p / k);
  return hours;
}

function minEatingSpeedBrute(piles, h) {
  for (let k = 1; ; k++) {
    if (hoursAt(piles, k) <= h) return k;
  }
}
```

- Time **O(n · M)** where `M = max(piles)`, space **O(1)**.
- **Why it works:** it checks speeds in increasing order, so the first feasible speed is the minimum.
- **When it's preferable:** small piles, or as a test oracle.
- **Limitations:** `M` can be 10^9 and `n` 10^4, so 10^13 operations: hopelessly slow.

## 4. Optimize: find the bottleneck

The brute force checks every speed. But feasibility is **monotonic**: eating faster never takes longer, because each `⌈p/k⌉` is non-increasing in `k`. So

```
k:          1     2     3    4    5   ...  M
feasible:  no    no    no   YES  YES  ...  YES
```

We need the first `YES`, which is a boundary in a monotonic sequence. Binary search finds it with `O(log M)` feasibility checks (about 30 for `M = 10^9`) instead of `M`.

Search range:
- **Low:** `1`. (A tighter bound is `⌈sum / h⌉`, since she can't eat more than `k` per hour.)
- **High:** `max(piles)`: one hour per pile, and `n <= h`. Faster speeds don't help, since a pile still takes at least one hour.

## 5. Pattern: binary search on the answer

> When the question is "find the minimum (or maximum) value `x` such that some condition holds," and the condition is monotonic in `x`, binary search over `x`. You need two things:
> 1. **Bounds** `[lo, hi]` that definitely contain the answer.
> 2. A **feasibility check** `canDo(x)`, usually a greedy O(n) scan.

Total cost: `O(cost(check) · log(hi − lo))`.

| Problem | Search over | `feasible(x)` | Find |
| --- | --- | --- | --- |
| **Koko Eating Bananas (875)** | speed | `Σ ⌈p/x⌉ <= h` | min |
| Capacity To Ship Packages Within D Days (1011) | ship capacity | greedy days needed `<= D` | min |
| Split Array Largest Sum (410) | max subarray sum | greedy parts needed `<= m` | min |
| Minimum Number of Days to Make m Bouquets (1482) | day | bouquets from bloomed flowers `>= m` | min |
| Find the Smallest Divisor Given a Threshold (1283) | divisor | `Σ ⌈a/x⌉ <= threshold` | min |
| Magnetic Force Between Two Balls (1552) | min gap | greedy places `>= m` balls | **max** |
| Kth Smallest Element in a Sorted Matrix (378) | value | count of elements `<= x` is `>= k` | min |

The tell: the answer is a **number in a range** (not a position in the input), and "if `x` works, so does anything bigger" (or smaller).

## 6. Implement (optimal: binary search on speed)

```js
/**
 * @param {number[]} piles
 * @param {number} h
 * @return {number}
 */
function minEatingSpeed(piles, h) {
  let lo = 1;
  let hi = 0;
  for (const p of piles) hi = Math.max(hi, p);   // avoid Math.max(...piles): spread can overflow the stack on huge arrays

  // Invariant: the answer is in [lo, hi], and hi is always feasible.
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (canFinish(piles, h, mid)) {
      hi = mid;          // mid works: the answer is mid or slower
    } else {
      lo = mid + 1;      // mid is too slow: the answer is strictly faster
    }
  }

  return lo;
}

function canFinish(piles, h, k) {
  let hours = 0;
  for (const p of piles) {
    hours += Math.ceil(p / k);   // or Math.floor((p + k - 1) / k) for integer-only arithmetic
    if (hours > h) return false; // early exit: already too slow
  }
  return true;
}
```

- **Why it works:**
  - **Monotonicity:** if `k` is feasible, so is every `k' > k`, because each pile's hours can only drop. So feasibility is `false…false true…true` over `[1, max]`.
  - **Invariant:** the answer is in `[lo, hi]`. Initially `hi = max(piles)` is feasible. On `true`, `mid` could be the answer, so keep it (`hi = mid`). On `false`, everything `<= mid` is infeasible (`lo = mid + 1`).
  - `mid` rounds down, so `mid < hi` and both branches shrink the range. It ends at `lo === hi`, the first feasible speed.
- **Why the early exit in `canFinish`:** it caps the work for slow speeds, and the running total stays small instead of reaching 10^13. In Java/C++ this also helps avoid overflow, but use a `long` anyway.
- **When it's preferable:** always. It's the expected answer.
- **Limitations:** needs a monotonic feasibility check. Each check is O(n), so the total is O(n log M), not O(n).

## 7. Complexity

Let `n = piles.length` and `M = max(piles)`.

| Approach | Time | Space |
| --- | --- | --- |
| Try every speed from 1 | O(n · M) | O(1) |
| **Binary search on speed** | **O(n log M)** ≈ 10^4 · 30 | **O(1)** |
| With tighter bounds (alt. a) | O(n log(hi − lo)), same worst case | O(1) |

## 8. Testing

```js
const tests = [
  [[3, 6, 7, 11], 8, 4],
  [[30, 11, 23, 4, 20], 5, 30],      // h === n: the answer is max(piles)
  [[30, 11, 23, 4, 20], 6, 23],
  [[1], 1, 1],
  [[5], 1, 5],
  [[5], 2, 3],                       // one pile: ceil(5 / 2)
  [[1000000000], 2, 500000000],      // huge pile
  [[1000000000], 1000000000, 1],     // huge h: speed 1 suffices
  [[312884470], 312884469, 2],       // one hour short of speed 1
  [[2, 2, 2, 2], 4, 2],              // all equal, h === n
  [[2, 2, 2, 2], 8, 1],
];

for (const [piles, h, expected] of tests) {
  console.assert(minEatingSpeed(piles, h) === expected, `minEatingSpeed(${piles}, ${h}) → ${minEatingSpeed(piles, h)}`);
}

// Adversarial: random small inputs against the brute force
for (let t = 0; t < 3000; t++) {
  const n = 1 + Math.floor(Math.random() * 8);
  const piles = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 40));
  const h = n + Math.floor(Math.random() * 60);
  console.assert(minEatingSpeed(piles, h) === minEatingSpeedBrute(piles, h), piles, h);
}

// Adversarial: max size, max values → ~30 checks of 10^4 piles, instant
const big = new Array(1e4).fill(1e9);
console.assert(minEatingSpeed(big, 1e9) === 1e4);   // h / n = 1e5 hours per pile → k = 1e9 / 1e5 = 1e4
```

**Dry run** for `piles = [3,6,7,11]`, `h = 8`:

| lo | hi | mid | hours(mid) | feasible? | action |
| --- | --- | --- | --- | --- | --- |
| 1 | 11 | 6 | 1+1+2+2 = 6 | yes | `hi = 6` |
| 1 | 6 | 3 | 1+2+3+4 = 10 | no | `lo = 4` |
| 4 | 6 | 5 | 1+2+2+3 = 8 | yes | `hi = 5` |
| 4 | 5 | 4 | 1+2+2+3 = 8 | yes | `hi = 4` |
| 4 | 4 | — | — | — | return 4 |

## 9. Alternatives

### a) Tighter bounds

```js
function minEatingSpeedTight(piles, h) {
  const n = piles.length;
  let sum = 0, max = 0;
  for (const p of piles) { sum += p; max = Math.max(max, p); }

  let lo = Math.max(1, Math.ceil(sum / h));                 // can't eat more than k per hour
  let hi = Math.min(max, Math.ceil(sum / (h - n + 1)));     // always feasible (proof below)

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (canFinish(piles, h, mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
```

- **Lower bound:** `hours(k) >= sum / k`, so a feasible `k` needs `k >= sum / h`.
- **Upper bound:** `⌈p/k⌉ < p/k + 1`, so `hours(k) < sum/k + n`. With `k = ⌈sum / (h − n + 1)⌉`, `sum / k <= h − n + 1`, so `hours(k) < h + 1`, i.e. `hours(k) <= h`.
- Time still O(n log M) worst case, but often far fewer iterations when `h` is large.
- **When it's preferable:** a good thing to mention after the main solution: it shows you understand the function, not just the template.
- **Limitations:** more to prove and more to get wrong. The plain bounds `[1, max]` are enough for the interview.

### b) Linear scan from the lower bound

Starting at `⌈sum / h⌉` and incrementing until feasible is correct and often fast in practice, because the answer tends to be close to that bound. But the worst case is still O(n · M) (e.g. many small piles plus one huge pile with tight `h`), so it's not a replacement for binary search.

### c) Generic "first true" helper

With the helper from [Binary Search](./02_Binary%20Search.md) (alternative c), the whole solution is one line:

```js
const minEatingSpeedGeneric = (piles, h) =>
  firstTrue(1, Math.max(...piles), (k) => canFinish(piles, h, k));
```

- **When it's preferable:** when you're solving a family of these problems; only the predicate changes.

---

## Follow-ups interviewers ask

### 1. Capacity To Ship Packages Within D Days (LC 1011)
Same skeleton, different predicate: weights must ship **in order**, so count days greedily. Bounds: `[max(weights), sum(weights)]`.

```js
function shipWithinDays(weights, days) {
  let lo = 0, hi = 0;
  for (const w of weights) { lo = Math.max(lo, w); hi += w; }
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    let need = 1, load = 0;
    for (const w of weights) {
      if (load + w > mid) { need++; load = 0; }
      load += w;
    }
    if (need <= days) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
```

### 2. Maximize instead of minimize (LC 1552, Aggressive Cows)
Find the **last** `true`: `lo = mid` on success, `hi = mid − 1` on failure, and round `mid` **up** (`lo + Math.ceil((hi − lo) / 2)`) or the loop never ends.

### 3. Real-valued speed
Search doubles: loop ~100 times (or until `hi − lo < 1e-9`), setting `lo = mid` or `hi = mid`. Note that with a real speed the ceiling rule still applies per pile.

### 4. What if `h < n`?
No speed works. Check up front and return `-1` (or throw), since the binary search would otherwise return `max(piles)` incorrectly.

### 5. Many queries with different `h`
`hours(k)` doesn't depend on `h`, so you could precompute it for the speeds you visit, but each query still needs its own search. For many queries, sort the piles and use prefix sums to compute `hours(k)` faster for small `k`.

## Common mistakes

- Using `sum / k` instead of `Σ ⌈p/k⌉`: she can't switch piles within an hour.
- Starting `lo` at `0`, which divides by zero.
- `hi = mid − 1` on success, which skips the answer when `mid` is it.
- `Math.max(...piles)` on very large arrays: argument spreading can throw "Maximum call stack size exceeded" past ~10^5 elements. A loop is safe.
- Integer overflow of the hours total in Java/C++ (`int` overflows at ~2.1·10^9).
- Not stating the monotonicity: "faster never takes longer" is the sentence the interviewer is waiting for.
