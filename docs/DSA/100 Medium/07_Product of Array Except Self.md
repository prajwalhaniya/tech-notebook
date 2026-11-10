---
sidebar_position: 7
---

# Product of Array Except Self

> **LeetCode 238 · Medium · Pattern: Prefix / Suffix aggregates (two-pass)**

> Companies: Meta (very frequent), Amazon, Apple, Microsoft, Google, Bloomberg, Uber. The "no division" rule is the whole point: interviewers want to see you split "everything except `i`" into **"everything left of `i`" × "everything right of `i`"**, then squeeze the extra arrays away for O(1) extra space.

Given an integer array `nums`, return an array `answer` where `answer[i]` is the product of every element of `nums` **except** `nums[i]`.

```
Input: nums = [1, 2, 3, 4]        → Output: [24, 12, 8, 6]
Input: nums = [-1, 1, 0, -3, 3]   → Output: [0, 0, 9, 0, 0]
```

Constraints (LeetCode): `2 <= nums.length <= 10^5`, `-30 <= nums[i] <= 30`, and every prefix or suffix product fits in a 32-bit integer. You **must** run in O(n) and **must not** use division. **Follow-up:** O(1) extra space (the output array doesn't count).

---

## 1. Understand

For each index, multiply together all the other numbers. Doing that directly repeats almost the same multiplication n times.

Rephrased: `answer[i] = (product of nums[0..i-1]) × (product of nums[i+1..n-1])`. If we know every "left product" and every "right product", each answer is one multiplication.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Can I use division? | **No.** And even if allowed, division breaks on zeros (see alternative c). |
| Can there be zeros? How many? | One zero → only that index is non-zero. Two or more zeros → everything is 0. A good solution handles this with no special case. |
| Negative numbers? | Yes. They don't change the algorithm, but they can produce `-0` in JavaScript (see Common mistakes). |
| Can the product overflow? | LeetCode guarantees 32-bit. In general, ask: use `BigInt` or return values modulo M. |
| Does the output array count as extra space? | Conventionally **no**. That's what makes the O(1)-space follow-up possible. |
| Minimum length? | `n >= 2`. For `n = 1`, the empty product is `1`; confirm with the interviewer. |

**Edge cases:** one zero, two or more zeros, all ones, negatives, `n = 2`, and large arrays (timing).

## 3. Brute force: multiply everything except `i`, for every `i`

```js
function productExceptSelfBrute(nums) {
  const n = nums.length;
  const answer = new Array(n);
  for (let i = 0; i < n; i++) {
    let product = 1;
    for (let j = 0; j < n; j++) {
      if (j !== i) product *= nums[j];
    }
    answer[i] = product;
  }
  return answer;
}
```

- Time **O(n²)**, space **O(1)** extra.
- **Why it works:** it is the definition, computed literally.
- **When it's preferable:** tiny inputs, or as a testing oracle.
- **Limitations:** 10^10 multiplications at n = 10^5. Too slow.

## 4. Optimize: find the bottleneck

The inner loop recomputes overlapping products. `answer[2]` and `answer[3]` both multiply `nums[0] × nums[1]`.

Split the product at `i`:

```
nums:     a   b   c   d
answer[2] = (a × b)  ×  (d)
             left        right
```

- `left[i]` = product of everything before `i`. It grows by one factor per step: `left[i] = left[i-1] × nums[i-1]`.
- `right[i]` = product of everything after `i`: `right[i] = right[i+1] × nums[i+1]`.

Each is one O(n) pass. Then `answer[i] = left[i] × right[i]`. Total O(n), no division.

Then remove the extra arrays: write `left` directly into `answer`, and replace the `right` array with a single running variable during a backward pass.

## 5. Pattern: prefix / suffix aggregates

> When the answer at `i` depends on "everything to the left" and "everything to the right", precompute running aggregates from both ends. Each index then answers in O(1).

The aggregate can be product, sum, max, min, or any associative operation. The same pattern shows up in:
- [Trapping Rain Water](./39_Trapping%20Rain%20Water.md) (prefix max and suffix max)
- [Find Pivot Index](../100%20Easy/16_Find%20Pivot%20Index.md) (prefix sum vs suffix sum)
- [Subarray Sum Equals K](./41_Subarray%20Sum%20Equals%20K.md) and [Range Sum Query 2D](./43_Range%20Sum%20Query%202D.md) (prefix sums)
- Candy (LC 135), Maximum Product Subarray (LC 152), Construct Product Matrix (LC 2906)

## 6. Implement

### a) Prefix and suffix arrays (the clear version to say out loud first)

```js
/**
 * @param {number[]} nums
 * @return {number[]}
 */
function productExceptSelfArrays(nums) {
  const n = nums.length;
  const left = new Array(n).fill(1);   // left[i]  = nums[0] * ... * nums[i-1]
  const right = new Array(n).fill(1);  // right[i] = nums[i+1] * ... * nums[n-1]

  for (let i = 1; i < n; i++) left[i] = left[i - 1] * nums[i - 1];
  for (let i = n - 2; i >= 0; i--) right[i] = right[i + 1] * nums[i + 1];

  const answer = new Array(n);
  for (let i = 0; i < n; i++) answer[i] = left[i] * right[i];
  return answer;
}
```

- Time **O(n)**, space **O(n)** extra (two helper arrays).
- **Why it works:** `left[0]` and `right[n-1]` are the empty product `1`. Each entry extends its neighbour by exactly one factor, so `left[i] × right[i]` multiplies every element except `nums[i]`, exactly once.
- **When it's preferable:** explaining the idea, or when you need the prefix/suffix arrays for something else too.
- **Limitations:** two extra arrays. The follow-up asks you to remove them.

### b) Optimal: O(1) extra space (output array reused)

```js
/**
 * @param {number[]} nums
 * @return {number[]}
 */
function productExceptSelf(nums) {
  const n = nums.length;
  const answer = new Array(n);

  // Pass 1: answer[i] = product of everything left of i.
  answer[0] = 1;
  for (let i = 1; i < n; i++) {
    answer[i] = answer[i - 1] * nums[i - 1];
  }

  // Pass 2: multiply in the product of everything right of i, kept in one variable.
  let rightProduct = 1;
  for (let i = n - 1; i >= 0; i--) {
    answer[i] *= rightProduct;
    rightProduct *= nums[i];
  }

  return answer;
}
```

- Time **O(n)** (two passes), space **O(1)** extra (the output array doesn't count).
- **Why it works:**
  - **Invariant (pass 2):** when we reach index `i`, `rightProduct` equals `nums[i+1] × ... × nums[n-1]`. We use it **before** multiplying in `nums[i]`, so `nums[i]` is never included in its own answer.
  - After pass 1, `answer[i]` already holds the left product, so the single multiplication completes it.
- **Zeros handle themselves:** with one zero at `z`, every left/right product that spans `z` is 0, and only `answer[z]` avoids it. With two zeros, every index sees at least one.
- **When it's preferable:** always. This is the expected final answer.
- **Limitations:** it relies on the "output doesn't count" convention. Products can overflow outside LeetCode's guarantee (see follow-ups).

## 7. Complexity

| Approach | Time | Extra space |
| --- | --- | --- |
| Brute force | O(n²) | O(1) |
| Prefix + suffix arrays | O(n) | O(n) |
| **Prefix in output + running suffix** | **O(n)** | **O(1)** |
| Division with zero counting (alt. c) | O(n) | O(1) |

## 8. Testing

```js
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]); // -0 === 0 is true

const tests = [
  [[1, 2, 3, 4], [24, 12, 8, 6]],         // classic
  [[-1, 1, 0, -3, 3], [0, 0, 9, 0, 0]],   // one zero
  [[0, 0], [0, 0]],                       // two zeros: everything is 0
  [[0, 4, 0], [0, 0, 0]],                 // two zeros, non-adjacent
  [[2, 3], [3, 2]],                       // minimum length
  [[1, 1, 1, 1], [1, 1, 1, 1]],           // all ones
  [[-1, -2, -3], [6, 3, 2]],              // all negative
  [[5, 0], [0, 5]],                       // zero at the end
];

for (const [nums, expected] of tests) {
  for (const fn of [productExceptSelf, productExceptSelfArrays, productExceptSelfDivision]) {
    console.assert(same(fn(nums), expected), `${fn.name}(${nums}) → ${fn(nums)}, expected ${expected}`);
  }
}

// Adversarial: random arrays with zeros and negatives, compared with brute force
for (let t = 0; t < 1000; t++) {
  const n = 2 + Math.floor(Math.random() * 8);
  const nums = Array.from({ length: n }, () => Math.floor(Math.random() * 7) - 3);
  const expected = productExceptSelfBrute(nums);
  console.assert(same(productExceptSelf(nums), expected), nums);
  console.assert(same(productExceptSelfDivision(nums), expected), nums);
}

// Adversarial: 10^5 elements (timing). Use ±1 so products stay small.
const big = Array.from({ length: 1e5 }, (_, i) => (i % 2 ? 1 : -1));
console.assert(productExceptSelf(big).length === 1e5);
```

**Dry run** for `[1, 2, 3, 4]`:

| i | after pass 1 (`answer[i]` = left product) | `rightProduct` used | final `answer[i]` |
| --- | --- | --- | --- |
| 3 | 6 | 1 | 6 |
| 2 | 2 | 4 | 8 |
| 1 | 1 | 12 | 12 |
| 0 | 1 | 24 | 24 |

Result: `[24, 12, 8, 6]`.

## 9. Alternatives

### c) Division with zero counting (only if division is allowed)

Mention this to show you understand **why** division is banned: the naive `total / nums[i]` divides by zero.

```js
function productExceptSelfDivision(nums) {
  let zeros = 0;
  let productNonZero = 1;
  for (const x of nums) {
    if (x === 0) zeros++;
    else productNonZero *= x;
  }

  return nums.map((x) => {
    if (zeros > 1) return 0;
    if (zeros === 1) return x === 0 ? productNonZero : 0;
    return productNonZero / x;
  });
}
```

- Time **O(n)**, space **O(1)** extra.
- **Why it works:** with no zeros, `total / x` removes exactly `x`. With one zero, only the zero's position has a non-zero answer (the product of the rest). With two or more, everything is 0.
- **When it's preferable:** when division is allowed and cheap, e.g. computing in a field modulo a prime (division = multiply by the modular inverse).
- **Limitations:** forbidden by the problem. Floating point division can lose precision for large products. Under a **non-prime** modulus there's no inverse, so the prefix/suffix approach is the only safe one.

### d) Logarithms (mention, don't use)

`answer[i] = exp(Σ log|nums| − log|nums[i]|)` with sign tracking. It technically avoids `/`, but floating-point error makes the results inexact, and zeros still need special handling. Bring it up only to say why you rejected it.

---

## Follow-ups interviewers ask

### 1. Products can overflow
Ask what the output should be. Options:
- Return values **modulo M** (common). The prefix/suffix approach works unchanged, just take `% M` after each multiplication. This is exactly Construct Product Matrix (LC 2906) with `M = 12345`, which is not prime, so division-by-inverse is impossible.
- Return exact values with `BigInt`:

```js
function productExceptSelfBig(nums) {
  const n = nums.length;
  const answer = new Array(n);
  answer[0] = 1n;
  for (let i = 1; i < n; i++) answer[i] = answer[i - 1] * BigInt(nums[i - 1]);
  let right = 1n;
  for (let i = n - 1; i >= 0; i--) {
    answer[i] *= right;
    right *= BigInt(nums[i]);
  }
  return answer;
}
```

### 2. Do it in a single pass
Fill from both ends in the same loop: index `i` gets its left product and index `n-1-i` gets its right product. Still O(n), and it's mainly a style question. Pre-fill `answer` with `1`.

```js
function productExceptSelfOnePass(nums) {
  const n = nums.length;
  const answer = new Array(n).fill(1);
  let left = 1, right = 1;
  for (let i = 0; i < n; i++) {
    answer[i] *= left;
    left *= nums[i];
    answer[n - 1 - i] *= right;
    right *= nums[n - 1 - i];
  }
  return answer;
}
```

### 3. 2D: product of everything in the matrix except cell `(i, j)`
Flatten the matrix in row-major order and run the same algorithm (LC 2906).

### 4. The array is updated between queries
Prefix arrays become stale after every update. Use a **segment tree** over products: point update O(log n), and "product except i" = product(0, i-1) × product(i+1, n-1), each O(log n).

## Common mistakes

- Using division and forgetting zeros (`0 / 0 = NaN`, `x / 0 = Infinity`).
- Including `nums[i]` in its own answer: in pass 2, multiply `answer[i]` by `rightProduct` **before** updating `rightProduct`.
- Off-by-one: `left[i]` uses `nums[i-1]`, not `nums[i]`.
- Expecting `-0` to print as `0`: e.g. `[-1, 0, 1]` gives `answer[2] = -0`. It's `=== 0`, and LeetCode accepts it, but `Object.is(-0, 0)` is `false`, so some deep-equality test helpers will flag it.
- Claiming O(1) space while still allocating `left` and `right` arrays.
