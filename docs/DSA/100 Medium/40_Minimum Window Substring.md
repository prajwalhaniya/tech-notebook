---
sidebar_position: 40
---

# Minimum Window Substring

> **LeetCode 76 · Hard · Pattern: Sliding Window (variable size, shortest valid) + frequency map with a "missing" counter**

> Companies: Meta (very frequent), Amazon, Google, Microsoft, LinkedIn, Airbnb, Uber. This is the capstone sliding-window problem. Interviewers watch whether you can check "does the window cover `t`?" in **O(1)** using a counter instead of comparing whole maps, and whether you handle **duplicates in `t`**.

Given strings `s` and `t`, return the **shortest substring of `s`** that contains every character of `t` **including duplicates**. If there's no such substring, return `""`.

```
Input: s = "ADOBECODEBANC", t = "ABC"  → Output: "BANC"
Input: s = "a",             t = "a"    → Output: "a"
Input: s = "a",             t = "aa"   → Output: ""      (s has only one 'a')
```

Constraints (LeetCode): `1 <= s.length, t.length <= 10^5`, upper- and lowercase English letters, and the answer is unique. **Follow-up:** can you do it in O(m + n)?

---

## 1. Understand

Find the smallest contiguous piece of `s` whose letter counts are **at least** the counts in `t`. The order inside the window doesn't matter, and extra characters are allowed.

Rephrased: for each ending position, find the **largest left** such that the window still covers `t`. The answer is the shortest of those windows.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Do duplicates in `t` count? | **Yes.** `t = "AAB"` needs two A's. A Set-based check is wrong. |
| Is it case-sensitive? | Yes. `'a' ≠ 'A'`, so the character space is 52 letters (use 128 ASCII slots to be safe). |
| Order within the window? | Doesn't matter. (If it did, it would be Minimum Window **Subsequence**, LC 727.) |
| What if there are several answers of the same length? | LeetCode guarantees a unique answer. Otherwise, ask: probably return the first. |
| What if `t` is longer than `s`, or there's no answer? | Return `""`. |
| Empty `t`? | Return `""` by convention (an empty window covers it). Confirm with the interviewer. |
| Return the substring or the indices? | The substring. Keep `bestStart` and `bestLen`, and slice once at the end. |

**Edge cases:** `t` longer than `s`, a character of `t` missing from `s`, duplicates in `t`, the answer being the whole of `s`, the answer at the very end, mixed case, and `s === t`.

## 3. Brute force: shortest covering window from each start

```js
function covers(windowCount, need) {
  for (const [ch, n] of need) {
    if ((windowCount.get(ch) || 0) < n) return false;
  }
  return true;
}

function minWindowBrute(s, t) {
  if (!t.length) return '';
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  let best = '';
  for (let i = 0; i < s.length; i++) {
    const count = new Map();
    for (let j = i; j < s.length; j++) {
      count.set(s[j], (count.get(s[j]) || 0) + 1);
      if (covers(count, need)) {                 // the first j that covers is the shortest from i
        if (!best || j - i + 1 < best.length) best = s.slice(i, j + 1);
        break;
      }
    }
  }
  return best;
}
```

- Time **O(n² · k)**, where k is the number of distinct characters in `t` (the coverage check). Space **O(k)**.
- **Why it works:** for each start, the first end that covers `t` is that start's shortest window, and we take the minimum over all starts.
- **When it's preferable:** as a testing oracle.
- **Limitations:** about 10^10 steps at n = 10^5.

## 4. Optimize: find the bottleneck

There are two sources of waste:

1. **Restarting at every `i`.** Coverage is **monotonic**: if `s[i..j]` covers `t`, so does `s[i..j+1]`, and so does `s[i-1..j]`. So as `left` moves right, the matching `right` never moves left. That gives two pointers moving forward only, O(n) moves in total.
2. **The O(k) `covers()` check.** Keep a single counter, **`missing`**, holding how many characters of `t` (with multiplicity) the window still lacks. It's updated in O(1) whenever a character enters or leaves:
   - When `ch` enters and the window still needed it (`need[ch] > 0`), do `missing--`.
   - When `ch` leaves and the window now needs it again (`need[ch]` goes above 0), do `missing++`.
   - The window is valid exactly when `missing === 0`.

The trick is to store **`need[ch]` as a balance**: start it at the count in `t`, decrement it when `ch` enters the window, and increment it when `ch` leaves. A negative value means the window has spare copies.

## 5. Pattern: variable sliding window, "shrink while valid" (the shortest-window form)

> **Longest valid window:** expand right, and shrink while the window is **invalid**. Record the length after shrinking.
> **Shortest valid window:** expand right until the window is **valid**, then shrink while it's **still valid**, recording at every step.

```js
for (let right = 0; right < n; right++) {
  add(s[right]);
  while (isValid()) {
    best = Math.min(best, right - left + 1);
    remove(s[left++]);
  }
}
```

The same pattern shows up in:
- Minimum Size Subarray Sum (LC 209)
- Permutation in String (LC 567) and [Find All Anagrams in a String](./25_Find%20All%20Anagrams%20in%20a%20String.md) (a fixed-size window with the same count bookkeeping)
- Substring with Concatenation of All Words (LC 30)
- Smallest Range Covering Elements from K Lists (LC 632), the same idea over merged lists
- The "longest" versions: [Longest Substring Without Repeating Characters](./02_Longest%20substring%20without%20repeating%20characters.md), [Longest Repeating Character Replacement](./27_Longest%20repeating%20character%20replacement.md)

## 6. Implement (optimal: sliding window + `missing` counter)

```js
/**
 * @param {string} s
 * @param {string} t
 * @return {string}
 */
function minWindow(s, t) {
  if (t.length === 0 || t.length > s.length) return '';

  // need[ch] > 0 means the window still needs that many copies of ch.
  // need[ch] < 0 means the window holds that many spare copies.
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  let missing = t.length;           // total characters still lacking (with multiplicity)
  let left = 0;
  let bestStart = 0;
  let bestLen = Infinity;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (need.has(ch)) {
      if (need.get(ch) > 0) missing--;          // this copy was actually needed
      need.set(ch, need.get(ch) - 1);
    }

    // The window covers t. Shrink from the left as long as it still does.
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }

      const out = s[left];
      if (need.has(out)) {
        need.set(out, need.get(out) + 1);
        if (need.get(out) > 0) missing++;       // we just dropped a required copy
      }
      left++;
    }
  }

  return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
}
```

- **Why it works:**
  - **Invariant:** `missing` is the number of required characters the window `[left, right]` is still short of. So `missing === 0` means the window covers `t`.
  - For each `right`, the inner loop moves `left` to the **last** position where the window still covers `t`, which gives the shortest valid window ending at `right`, recorded before the step that breaks it.
  - Because of monotonicity, we never need to move `left` back. Every candidate "shortest window ending at `right`" is examined, so the global minimum is found.
- **Why the balance trick handles duplicates:** with `t = "AAB"` and a window holding three A's, `need['A']` is `-1`. Dropping one A brings it to `0`: still covered, so `missing` doesn't change. Only dropping the next A (to `+1`) makes the window short, and that's when `missing++` happens.
- **Why we slice only once:** building substrings inside the loop costs O(n) each time, which turns the solution into O(n²). Store `bestStart` and `bestLen` instead.
- **When it's preferable:** always. It's the standard O(m + n) answer.
- **Limitations:** `Map` overhead. Alternative (a) uses a fixed array for a faster constant. It returns one minimum window. For all of them, collect every window of length `bestLen`.

## 7. Complexity

Let `n = s.length` and `m = t.length`.

| Approach | Time | Space |
| --- | --- | --- |
| Check every substring | O(n² · (n + m)) | O(m) |
| Brute force (extend from each start) | O(n² · k) | O(k) |
| Sliding window + full-map compare per step | O(n · k) | O(k) |
| **Sliding window + `missing` counter** | **O(n + m)** | **O(k)**, or O(1) with a 128-slot array |
| Filtered `s` (alt. b) | O(n + m), faster when few characters of `s` are in `t` | O(n) |

Each index of `s` is added once (`right`) and removed at most once (`left`), so the loop does at most 2n pointer moves.

## 8. Testing

```js
const tests = [
  ['ADOBECODEBANC', 'ABC', 'BANC'],        // classic
  ['a', 'a', 'a'],                         // minimal
  ['a', 'aa', ''],                         // duplicates in t that s can't satisfy
  ['', 'a', ''],                           // empty s
  ['abc', '', ''],                         // empty t (by convention)
  ['xyz', 'a', ''],                        // a char of t missing from s
  ['ab', 'b', 'b'],                        // the answer at the end
  ['bba', 'ab', 'ba'],                     // the shortest window is at the end
  ['aa', 'aa', 'aa'],                      // the whole string, with duplicates
  ['abc', 'cba', 'abc'],                   // order doesn't matter
  ['aAbB', 'AB', 'AbB'],                   // case-sensitive
  ['cabwefgewcwaefgcf', 'cae', 'cwae'],    // the answer is in the middle, after a long scan
];

for (const [s, t, expected] of tests) {
  console.assert(minWindow(s, t) === expected, `minWindow("${s}", "${t}") should be "${expected}", got "${minWindow(s, t)}"`);
}

// Adversarial: random strings checked against brute force (compare lengths, since ties may differ)
for (let k = 0; k < 2000; k++) {
  const rand = (len) => Array.from({ length: len }, () => 'abcA'[Math.floor(Math.random() * 4)]).join('');
  const s = rand(Math.floor(Math.random() * 14));
  const t = rand(Math.floor(Math.random() * 5));
  console.assert(minWindow(s, t).length === minWindowBrute(s, t).length, s, t);
}

// Adversarial: 100k 'b's then one 'a'. The window can only close at the very end.
console.assert(minWindow('b'.repeat(1e5) + 'a', 'ab') === 'ba');
```

**Dry run** for `s = "ADOBECODEBANC"`, `t = "ABC"` (only the key steps):

| right | char | missing after | window valid? | shrink → recorded window |
| --- | --- | --- | --- | --- |
| 0 | A | 2 | no | |
| 3 | B | 1 | no | |
| 5 | C | **0** | yes | record `ADOBEC` (6). Dropping `A` makes it invalid, so left = 1. |
| 10 | A | **0** | yes | `DOBECODEBA` (10, no better). Shrink past `D,O`. Dropping `B` at 3 still leaves the `B` at 9, so it stays covered. Shrink to `CODEBA` (6, a tie, not better). Dropping `C` makes it invalid, so left = 6. |
| 12 | C | **0** | yes | `ODEBANC` (7). Shrink to `BANC` (**4**, the best). Dropping `B` makes it invalid. |

The result is `"BANC"`.

## 9. Alternatives

### a) Fixed-size array instead of a Map (ASCII). Same complexity, faster in practice

```js
function minWindowArray(s, t) {
  if (t.length === 0 || t.length > s.length) return '';

  const need = new Int32Array(128);
  for (let i = 0; i < t.length; i++) need[t.charCodeAt(i)]++;

  let missing = t.length, left = 0, bestStart = 0, bestLen = Infinity;

  for (let right = 0; right < s.length; right++) {
    // Characters not in t go negative and never affect `missing`.
    if (need[s.charCodeAt(right)]-- > 0) missing--;

    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      if (++need[s.charCodeAt(left)] > 0) missing++;
      left++;
    }
  }

  return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
}
```

- **Why it works:** characters that aren't in `t` start at `0`, go negative when they enter, and come back to at most `0` when they leave. They never reach `> 0`, so they never touch `missing`. That removes the `need.has()` branches.
- **When it's preferable:** a known ASCII alphabet. It's the most compact and fastest version.
- **Limitations:** it only works for char codes under 128. The terse `--`/`++` expressions are easy to get wrong, so explain them.

### b) Filter `s` to the relevant characters first

Pre-collect the indices of `s` whose character appears in `t`, then run the same window over that list (using the original indices for the lengths). When `s` is huge and only a few of its characters are in `t`, this skips most of the work.

```js
function minWindowFiltered(s, t) {
  if (t.length === 0 || t.length > s.length) return '';
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) || 0) + 1);

  const filtered = [];
  for (let i = 0; i < s.length; i++) if (need.has(s[i])) filtered.push(i);

  let missing = t.length, l = 0, bestStart = 0, bestLen = Infinity;
  for (let r = 0; r < filtered.length; r++) {
    const ch = s[filtered[r]];
    if (need.get(ch) > 0) missing--;
    need.set(ch, need.get(ch) - 1);

    while (missing === 0) {
      const start = filtered[l], end = filtered[r];
      if (end - start + 1 < bestLen) {
        bestLen = end - start + 1;
        bestStart = start;
      }
      const out = s[start];
      need.set(out, need.get(out) + 1);
      if (need.get(out) > 0) missing++;
      l++;
    }
  }
  return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
}
```

- **When it's preferable:** `|filtered| ≪ |s|`, for example searching a large log for a few rare characters.
- **Limitations:** O(n) extra memory for the index list, and no gain when most characters are relevant.

---

## Follow-ups interviewers ask

### 1. Permutation in String (LC 567): does `s2` contain an anagram of `s1`?
It's the same count bookkeeping with a **fixed-size** window of length `|s1|`, tracking how many letters have a non-zero balance:

```js
function checkInclusion(s1, s2) {
  if (s1.length > s2.length) return false;
  const count = new Int32Array(26);
  for (let i = 0; i < s1.length; i++) {
    count[s1.charCodeAt(i) - 97]++;
    count[s2.charCodeAt(i) - 97]--;
  }
  let diff = 0;
  for (const c of count) if (c !== 0) diff++;
  if (diff === 0) return true;

  for (let i = s1.length; i < s2.length; i++) {
    const inC = s2.charCodeAt(i) - 97;
    const outC = s2.charCodeAt(i - s1.length) - 97;

    if (count[inC] === 0) diff++;
    count[inC]--;
    if (count[inC] === 0) diff--;

    if (count[outC] === 0) diff++;
    count[outC]++;
    if (count[outC] === 0) diff--;

    if (diff === 0) return true;
  }
  return false;
}
```

### 2. Return every minimum window, or all windows that cover `t`
For every minimum window: record each window whose length equals `bestLen` (reset the list when a shorter one appears). For counting all covering windows: when the window `[left, right]` is the shortest valid window ending at `right`, every start `≤ left` also works, so add `left + 1` per `right` (standard "count subarrays" bookkeeping).

### 3. Minimum Window Subsequence (LC 727): `t` must appear **in order**
The sliding window no longer works, because order breaks the monotonic count argument. Instead, scan forward to match `t` as a subsequence, then scan **backward** from the end of the match to tighten the start. That's O(n·m). A DP solution is also possible.

### 4. Streaming `s`, or `t` given as a set of required words
The same window logic works over a stream as long as you keep the window's characters (or their positions) in memory. For words (LC 30), slide in word-sized steps from each offset `0..wordLen-1`.

### 5. Very large Unicode alphabet
Use a `Map` (it's the only sensible choice) and iterate by code point with `for...of`.

## Common mistakes

- Using a `Set` for `t`, which ignores duplicates.
- Comparing two maps on every step (O(k) per step), when `missing` is O(1).
- Decrementing `missing` for every matching character, even surplus copies. Check `need[ch] > 0` **before** decrementing.
- Recording the answer **after** shrinking past validity, instead of inside the `while`.
- Building substrings inside the loop (`s.slice` per step), which makes it O(n²).
- Returning `s.slice(bestStart, bestLen)` instead of `s.slice(bestStart, bestStart + bestLen)`.
