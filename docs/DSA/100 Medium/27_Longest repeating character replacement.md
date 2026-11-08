---
sidebar_position: 27
---

# Longest Repeating Character Replacement

> **LeetCode 424 · Medium · Pattern: Sliding Window (variable size) with a frequency count**

> Companies: Google, Amazon, Meta, Microsoft, Uber. Interviewers like it because the obvious window works, but the elegant O(n) version relies on a subtle trick: **`maxFreq` never needs to decrease**. Being able to explain *why* that's correct is what separates strong answers.

You're given a string `s` of uppercase English letters and an integer `k`. You may change **at most `k`** characters to any other uppercase letter.

Return the length of the longest substring containing only **one repeated letter** that you can get after these changes.

```
Input: s = "ABAB",    k = 2  → Output: 4   (replace both A's, or both B's)
Input: s = "AABABBA", k = 1  → Output: 4   ("AABA" → "AAAA", or "ABBB" → "BBBB")
```

Constraints (LeetCode): `1 <= s.length <= 10^5`, `s` is uppercase English letters only, `0 <= k <= s.length`.

---

## 1. Understand

Pick a window. Inside it, keep the **most frequent** letter and replace everything else. That costs `windowLength - maxFreq` replacements. The window is achievable if that cost is `≤ k`.

So: **find the longest window where `length - (count of its most frequent letter) ≤ k`.**

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| What's the alphabet? | Uppercase A–Z, so a 26-slot array works. With a larger alphabet, use a Map. |
| Do I have to use all k replacements? | No, at most k. |
| Must the result be contiguous? | Yes, it's a substring. |
| Can k be 0? | Yes. Then it's "the longest run of one letter". |
| Can k be ≥ the length? | Yes. Then the answer is `s.length`. |
| Return the length, or the letter and position? | The length. |

**Edge cases:** `k = 0`, `k ≥ n`, all the same letter, all different letters (`"ABCD"` with `k = 0` gives 1), and the best window needing replacements in the middle (`"BAAAB"` with `k = 2` gives 5).

## 3. Brute force: every start, extend while tracking counts

```js
function characterReplacementBrute(s, k) {
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const count = new Array(26).fill(0);
    let maxFreq = 0;
    for (let j = i; j < s.length; j++) {
      const idx = s.charCodeAt(j) - 65;   // 'A' = 65
      count[idx]++;
      maxFreq = Math.max(maxFreq, count[idx]);
      if (j - i + 1 - maxFreq <= k) best = Math.max(best, j - i + 1);
    }
  }
  return best;
}
```

- Time **O(n²)**, Space **O(26) = O(1)**.
- **Why it works:** it checks every substring's replacement cost, and maintaining the counts incrementally avoids an extra factor of n.
- **When it's preferable:** as a testing oracle.
- **Limitations:** about 5 × 10^9 steps at n = 10^5.

## 4. Optimize: find the bottleneck

The brute force restarts the counts for every `i`. But validity is **monotonic**: if a window is valid, every smaller window inside it is valid too (shrinking can't increase `length - maxFreq`). That's exactly the condition for a sliding window.

- Grow `right`. If the window becomes invalid (`len - maxFreq > k`), move `left` forward.
- Each index enters and leaves at most once, so it's O(n) apart from computing `maxFreq`.

**Computing `maxFreq`:** recomputing `max(count)` over 26 slots per step gives O(26n), which is fine. The famous trick goes further, making it O(1) per step (section 6b).

## 5. Pattern: a variable-size sliding window over a "cost" invariant

> The window is valid while `cost(window) ≤ budget`. Expand right. When the cost goes over budget, shrink from the left. Here `cost = length - maxFreq` and `budget = k`.

The same pattern shows up in:
- Max Consecutive Ones III (LC 1004): flip at most k zeros, which is this problem with the target fixed to `1`
- [Longest Substring Without Repeating Characters](./02_Longest%20substring%20without%20repeating%20characters.md)
- Longest Substring with At Most K Distinct Characters (LC 340)
- [Minimum Window Substring](./40_Minimum%20Window%20Substring.md) (the shortest valid window)
- Minimum Size Subarray Sum (LC 209)

## 6. Implement

### a) Sliding window with an exact max. O(26·n) time, O(1) space

Present this first, because it's obviously correct.

```js
function characterReplacementExact(s, k) {
  const count = new Array(26).fill(0);
  let left = 0, best = 0;

  for (let right = 0; right < s.length; right++) {
    count[s.charCodeAt(right) - 65]++;

    // shrink while the replacements needed exceed k
    while (right - left + 1 - Math.max(...count) > k) {
      count[s.charCodeAt(left) - 65]--;
      left++;
    }

    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

- **Why it works:** after the loop, `[left, right]` is the longest valid window ending at `right`.
- **When it's preferable:** clarity, or when you aren't comfortable defending the stale-max trick.
- **Limitations:** a constant factor of 26 per step. It's still linear and fine in practice.

### b) The `maxFreq`-never-decreases trick. O(n) time, O(1) space: the interview answer

```js
/**
 * @param {string} s
 * @param {number} k
 * @return {number}
 */
function characterReplacement(s, k) {
  const count = new Array(26).fill(0);
  let left = 0;
  let maxFreq = 0; // the highest count of a single letter seen in ANY window so far

  for (let right = 0; right < s.length; right++) {
    const idx = s.charCodeAt(right) - 65;
    count[idx]++;
    maxFreq = Math.max(maxFreq, count[idx]);

    // If the window is invalid, slide it (shift by one) instead of shrinking it.
    if (right - left + 1 - maxFreq > k) {
      count[s.charCodeAt(left) - 65]--;
      left++;
    }
  }

  // The window size never shrinks, so its final size is the best size ever reached.
  return s.length - left;
}
```

**Why a stale `maxFreq` is still correct** (the part interviewers want to hear):
1. The answer can only improve when we find a window **longer** than the best so far.
2. A window of length `L` is valid only if `L - f ≤ k`, where `f` is its true max frequency. For a window to beat the current best `L* = maxFreq + k`, it needs a letter with a frequency **greater than the historical `maxFreq`**.
3. So we only care about **increases** in `maxFreq`. When it's stale (too high), the window may be technically invalid, but we just **slide** it at the same length (`left++` and `right++`). We never *record* a better answer from a stale value. The window keeps the best length found so far and only grows when a real new maximum shows up.
4. That's why an `if` (shift by one) replaces the `while`, and why the answer is `s.length - left`, the final window size, which equals the largest size reached.

- **When it's preferable:** when you want the cleanest O(n) and you can explain the argument above.
- **Limitations:** the window at the end isn't necessarily a valid window. It only has the right **length**. If you need the actual substring or its position, use (a), or record the window whenever it grows with a verified count.

The original version of this note used `while` with a non-decreasing `maxFreq`. That's also correct (the `while` only ever runs once), but explaining it as "the window never shrinks" shows the deeper understanding. It also had `sidebar_position: 26`, which clashed with another page. That's fixed now.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Check every substring, recounting | O(n³) | O(1) |
| Brute force with incremental counts | O(n²) | O(26) |
| Window + exact max | O(26·n) | O(26) |
| **Window + non-decreasing `maxFreq`** | **O(n)** | **O(26)** |
| One window per target letter (alt. a) | O(26·n) | O(1) |
| Binary search on the length (alt. b) | O(26·n·log n) or O(n log n) | O(26) |

For a general alphabet of size m, replace 26 with m.

## 8. Testing

```js
const tests = [
  ['ABAB', 2, 4],      // classic
  ['AABABBA', 1, 4],   // classic 2
  ['A', 0, 1],         // single char
  ['AAAA', 0, 4],      // no replacements needed
  ['ABCD', 0, 1],      // k = 0, all different
  ['ABCD', 10, 4],     // k ≥ n
  ['ABBB', 2, 4],      // the whole string
  ['BAAAB', 2, 5],     // replacements at both ends
  ['ABAA', 0, 2],      // k = 0 means the longest run
  ['AAAB', 0, 3],      // the longest run at the start
];

for (const [s, k, expected] of tests) {
  console.assert(characterReplacement(s, k) === expected, `characterReplacement("${s}", ${k}) should be ${expected}`);
}

// Adversarial: random strings over a small alphabet, checked against brute force (this catches stale-max bugs)
for (let t = 0; t < 2000; t++) {
  const s = Array.from({ length: Math.floor(Math.random() * 14) }, () => 'ABC'[Math.floor(Math.random() * 3)]).join('');
  const k = Math.floor(Math.random() * 4);
  console.assert(characterReplacement(s, k) === characterReplacementBrute(s, k), s, k);
}

// Adversarial: 1e5 random letters, comparing two O(n)-ish approaches
const big = Array.from({ length: 1e5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
console.assert(characterReplacement(big, 50) === characterReplacementPerLetter(big, 50));
```

**Dry run** for `"AABABBA"`, `k = 1` (trick version):

| right | char | counts (A,B) before slide | maxFreq | window len | len − maxFreq | action | left |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | A | 1,0 | 1 | 1 | 0 | keep | 0 |
| 1 | A | 2,0 | 2 | 2 | 0 | keep | 0 |
| 2 | B | 2,1 | 2 | 3 | 1 | keep | 0 |
| 3 | A | 3,1 | 3 | 4 | 1 | keep | 0 |
| 4 | B | 3,2 | 3 | 5 | 2 > 1 | slide (drop `A`) | 1 |
| 5 | B | 2,3 | 3 | 5 | 2 > 1 | slide (drop `A`) | 2 |
| 6 | A | 2,3 | 3 | 5 | 2 > 1 | slide (drop `B`) | 3 |

The answer is `7 - 3 = 4`.

## 9. Alternatives

### a) One window per target letter. O(26·n) time, O(1) space

For each letter `c` that appears in `s`, find the longest window with at most `k` characters that aren't `c`. That's Max Consecutive Ones III, once per letter.

```js
function characterReplacementPerLetter(s, k) {
  let best = 0;
  for (const target of new Set(s)) {
    let left = 0, others = 0;
    for (let right = 0; right < s.length; right++) {
      if (s[right] !== target) others++;
      while (others > k) {
        if (s[left] !== target) others--;
        left++;
      }
      best = Math.max(best, right - left + 1);
    }
  }
  return best;
}
```

- **When it's preferable:** the reasoning is simpler (no max frequency at all), and it's easy to return the actual substring and letter.
- **Limitations:** a factor of m. It's bad for large alphabets, such as Unicode.

### b) Binary search on the answer. O(n log n · 26)

"Is there a valid window of length L?" is monotonic in L: if L works, so does L − 1. So binary search on L, and check each L with a fixed-size sliding window. It's worth mentioning as a general technique, but it's strictly worse here.

---

## Follow-ups interviewers ask

### 1. Max Consecutive Ones III (LC 1004): flip at most k zeros to ones

```js
function longestOnes(nums, k) {
  let left = 0, zeros = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    if (nums[right] === 0) zeros++;
    while (zeros > k) {
      if (nums[left] === 0) zeros--;
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

### 2. Return the substring and the letter
Use alternative (a), or approach (a) with a recorded `bestStart`. Don't use the trick version's final window.

### 3. Lowercase letters, or any characters
Swap the 26-slot array for a `Map`. The trick version still works, because `maxFreq` is still a single number.

### 4. Each replacement has a different cost
The cost is no longer `len - maxFreq`. Use a per-target-letter window with a running cost sum (`cost > budget` means shrink).

## Common mistakes

- Believing `maxFreq` must be recomputed when shrinking. It's a valid alternative, but you should be able to explain why it isn't necessary.
- Returning `best` while tracking it only inside the `if`, or mixing the "trick" version with code that needs a truly valid window.
- Using `charCodeAt - 97` for uppercase input (`'A'` is 65).
- Forgetting that `k = 0` reduces to the longest run of equal letters.
