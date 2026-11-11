---
sidebar_position: 3
---

# Longest Substring Without Repeating Characters

> **LeetCode 3 · Medium · Pattern: Sliding Window (variable size) + Hash Map of last positions**

> Companies: Amazon, Meta, Google, Microsoft, Bloomberg, Apple, Adobe. One of the most-asked mediums. It's the canonical introduction to the **variable-size sliding window**, and interviewers expect you to go from "shrink one step at a time" to "jump left directly".

Given a string `s`, return the length of the longest **substring** (contiguous) that has no repeated characters.

```
Input: s = "abcabcbb"  → Output: 3   ("abc")
Input: s = "bbbbb"     → Output: 1   ("b")
Input: s = "pwwkew"    → Output: 3   ("wke". Note that "pwke" is a subsequence, not a substring.)
Input: s = ""          → Output: 0
```

Constraints (LeetCode): `0 <= s.length <= 5 * 10^4`. `s` consists of English letters, digits, symbols and spaces (ASCII).

---

## 1. Understand

Among all contiguous pieces of `s`, find the longest one in which every character appears at most once.

Rephrased: for each ending position `right`, what's the **furthest-left start** such that `s[start..right]` has no duplicates? The answer is the largest such window.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Substring or subsequence? | **Substring** (contiguous). `"pwke"` isn't valid for `"pwwkew"`. |
| What's the character set? ASCII, lowercase only, Unicode? | It decides whether a fixed array of size 26 or 128 works, or whether you need a `Map` and must think about code points. |
| Is it case-sensitive? Do spaces and symbols count? | Yes and yes on LeetCode: `'a' ≠ 'A'`, and `' '` is a character. |
| Return the length or the substring? | The length. Returning the substring needs the start index too. |
| Empty string? | Return 0. |

**Edge cases:** `""`, `" "`, all the same character, all unique, a duplicate **outside** the current window (`"abba"`, the trap that breaks naive "jump left" code), and `"dvdf"` (the answer starts after the first duplicate).

## 3. Brute force: extend from every start

```js
function lengthOfLongestSubstringBrute(s) {
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    const seen = new Set();
    for (let j = i; j < s.length; j++) {
      if (seen.has(s[j])) break;   // a duplicate ends every window starting at i
      seen.add(s[j]);
      best = Math.max(best, j - i + 1);
    }
  }
  return best;
}
```

- Time **O(n · m)**, where m is the alphabet size (each inner run is at most m long before it must repeat), so O(n²) in general. Space **O(m)**.
- **Why it works:** it tries every start and extends until the first duplicate.
- **When it's preferable:** as a correctness oracle. It's also fine for tiny inputs.
- **Limitations:** it rescans the same characters from every start. A fully naive version that checks every substring is O(n³).

## 4. Optimize: find the bottleneck

When the brute force finds a duplicate at `j` for start `i`, it moves to start `i+1` and **rebuilds the set from scratch**, even though `s[i+1..j-1]` is already known to be duplicate-free.

**Key insight:** keep a window `[left, right]` that's always duplicate-free.
- Move `right` forward one character at a time.
- If `s[right]` is already in the window, move `left` forward until it isn't.

Each character enters the window once and leaves at most once, so the total work is O(n).

**Further insight:** instead of moving `left` one step at a time, remember the **last index** of each character and **jump** `left` to `lastIndex + 1` in one step. That's still O(n), but with a single pass.

## 5. Pattern: variable-size sliding window

> Maintain a window that satisfies an invariant (here: no duplicates). Grow it on the right. When the invariant breaks, shrink it from the left until it holds again. Record the best valid window.

Template:

```js
let left = 0;
for (let right = 0; right < n; right++) {
  add(s[right]);
  while (windowIsInvalid()) remove(s[left++]);
  best = Math.max(best, right - left + 1);
}
```

The same pattern shows up in:
- [Longest Repeating Character Replacement](./05_Longest%20repeating%20character%20replacement.md) (the invariant is `len - maxFreq ≤ k`)
- [Minimum Window Substring](./06_Minimum%20Window%20Substring.md) (here we look for the *shortest* valid window, so we shrink while it's valid)
- Longest Substring with At Most K Distinct Characters (LC 340), Fruit Into Baskets (LC 904)
- Max Consecutive Ones III (LC 1004), Minimum Size Subarray Sum (LC 209)

## 6. Implement

### a) Sliding window with a Set (shrink step by step). O(n) time, O(m) space

The most natural version to explain first.

```js
function lengthOfLongestSubstringSet(s) {
  const window = new Set();
  let left = 0;
  let best = 0;

  for (let right = 0; right < s.length; right++) {
    while (window.has(s[right])) {  // invariant broken: shrink until s[right] can come in
      window.delete(s[left]);
      left++;
    }
    window.add(s[right]);
    best = Math.max(best, right - left + 1);
  }

  return best;
}
```

- **Why it works:** after the `while` loop, the window `[left, right]` contains no duplicates. It's also the **largest** such window ending at `right`, because we removed only as many characters as needed.
- **When it's preferable:** it's the clearest version, and it carries over directly to "at most k distinct" variants.
- **Limitations:** each character is touched up to twice (once added, once removed), so it's about 2n operations.

### b) Sliding window with last-seen indices (jump). O(n) time, O(m) space: the interview answer

```js
/**
 * @param {string} s
 * @return {number}
 */
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map(); // char -> last index where it appeared
  let left = 0;
  let best = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];

    // Only jump if the previous occurrence is INSIDE the current window.
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;
    }

    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }

  return best;
}
```

- **Why it works:** if `ch` last appeared at index `p` inside the window, then any window ending at `right` that contains both copies is invalid. So the earliest valid start is `p + 1`. `left` never moves backward.
- **Why `>= left` matters:** in `"abba"`, at the final `'a'`, `lastSeen['a'] = 0`, but `left` is already 2 (because of the `'b'`s). Without the check, `left` would jump **back** to 1 and give the wrong answer, 3. Writing `left = Math.max(left, lastSeen.get(ch) + 1)` is an equivalent fix.
- **When it's preferable:** single pass, fewest operations. It's the standard answer.
- **Limitations:** it doesn't generalize to "at most k repeats" or "k distinct" as cleanly as the Set/count version. Map lookups are slower than array indexing (see alternative (a)).

### Bugs in the original version of this note (spot the bug)

```js
for (let char = 0; char < s.length; right++) {   // ❌ increments `right` (undefined), not `char`
```

`right` is never declared, so this throws a `ReferenceError` (or, with a declared `right`, it's an infinite loop because `char` never changes). The fixed version uses one index variable, `right`. The dry run in the old note also said "index 0 (less than left)" where `left` was 0. The real rule is: jump only when `lastSeen >= left`.

## 7. Complexity

| Approach | Time | Space | Notes |
| --- | --- | --- | --- |
| Check every substring | O(n³) | O(m) | |
| Extend from each start (brute force) | O(n·m) ≤ O(n²) | O(m) | |
| Window + Set | O(n), about 2n steps | O(min(n, m)) | |
| **Window + last index** | **O(n)**, n steps | **O(min(n, m))** | |
| Window + fixed array | O(n) | O(m) = O(128) for ASCII | The fastest in practice |

m is the alphabet size (128 for ASCII, 26 for lowercase letters only).

## 8. Testing

```js
const tests = [
  ['abcabcbb', 3],   // classic
  ['bbbbb', 1],      // all the same
  ['pwwkew', 3],     // substring vs subsequence
  ['', 0],           // empty
  [' ', 1],          // a space is a character
  ['au', 2],         // whole string
  ['dvdf', 3],       // the answer starts after the first duplicate: "vdf"
  ['abba', 2],       // the trap: a stale lastSeen outside the window
  ['tmmzuxt', 5],    // a duplicate 't' that's outside the window by then
  ['a b!a', 4],      // symbols and spaces
  ['abcdef', 6],     // all unique
];

for (const [s, expected] of tests) {
  console.assert(lengthOfLongestSubstring(s) === expected, `lengthOfLongestSubstring("${s}") should be ${expected}`);
}

// Adversarial: random strings over a small alphabet, checked against brute force
for (let t = 0; t < 1000; t++) {
  const s = Array.from({ length: Math.floor(Math.random() * 12) }, () => 'abcd '[Math.floor(Math.random() * 5)]).join('');
  console.assert(lengthOfLongestSubstring(s) === lengthOfLongestSubstringBrute(s), s);
}

// Adversarial: all 95 printable ASCII characters repeated, so the answer is capped by the alphabet
let printable = '';
for (let c = 32; c < 127; c++) printable += String.fromCharCode(c);
console.assert(lengthOfLongestSubstring(printable.repeat(500)) === 95);

// Adversarial: 50k copies of the same character (left jumps on every step)
console.assert(lengthOfLongestSubstring('a'.repeat(5e4)) === 1);
```

**Dry run** for `"abba"` (the case that catches most bugs):

| right | ch | lastSeen[ch] before | left before → after | window | best |
| --- | --- | --- | --- | --- | --- |
| 0 | a | — | 0 → 0 | `a` | 1 |
| 1 | b | — | 0 → 0 | `ab` | 2 |
| 2 | b | 1 (≥ left) | 0 → **2** | `b` | 2 |
| 3 | a | 0 (**< left**, ignore it) | 2 → 2 | `ba` | 2 |

## 9. Alternatives

### a) A fixed-size array instead of a Map (ASCII)

```js
function lengthOfLongestSubstringArray(s) {
  const lastSeen = new Int32Array(128).fill(-1); // index = char code
  let left = 0, best = 0;

  for (let right = 0; right < s.length; right++) {
    const code = s.charCodeAt(right);
    if (lastSeen[code] >= left) left = lastSeen[code] + 1;
    lastSeen[code] = right;
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

- **When it's preferable:** a known small alphabet (ASCII or lowercase letters). There's no hashing, and it's cache friendly, often several times faster.
- **Limitations:** it breaks on characters outside the array's range (Unicode). Initializing with `-1` matters, because `0` is a valid index.

### b) Unicode-aware version
`s[i]` and `charCodeAt` work on UTF-16 code units, so an emoji counts as two "characters". For true code points, iterate `Array.from(s)` (or `for...of`) and use a `Map`. Mention this if the interviewer says "any string".

---

## Follow-ups interviewers ask

### 1. Return the substring itself
Track the start of the best window:

```js
function longestUniqueSubstring(s) {
  const lastSeen = new Map();
  let left = 0, bestStart = 0, bestLen = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) left = lastSeen.get(ch) + 1;
    lastSeen.set(ch, right);
    if (right - left + 1 > bestLen) {
      bestLen = right - left + 1;
      bestStart = left;
    }
  }
  return s.slice(bestStart, bestStart + bestLen);
}
// longestUniqueSubstring("pwwkew") → "wke"
```

### 2. At most k distinct characters (LC 340; k = 2 is LC 159, also Fruit Into Baskets)
Use a count map, and shrink while `count.size > k`:

```js
function lengthOfLongestSubstringKDistinct(s, k) {
  const count = new Map();
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    count.set(s[right], (count.get(s[right]) || 0) + 1);
    while (count.size > k) {
      const c = s[left++];
      count.set(c, count.get(c) - 1);
      if (count.get(c) === 0) count.delete(c);
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

### 3. Each character may appear at most twice / at most k times
Use the same count-based window, and shrink while `count[s[right]] > k`.

### 4. Streaming input
The last-index solution is already single-pass with O(m) memory, so it works on a character stream as long as you only need the length.

### 5. Count of substrings with all-unique characters
Every valid window `[left, right]` adds `right - left + 1` substrings that end at `right`. Sum them in the same loop.

## Common mistakes

- Treating it as a subsequence problem.
- Jumping `left` backward when the previous occurrence is outside the window (`"abba"`).
- Using `if (map[ch])` with a plain object, which fails when the stored index is `0`.
- Computing the length as `right - left` instead of `right - left + 1`.
- Resetting the whole window on a duplicate (`left = right`), which is wrong for `"dvdf"`.
