---
sidebar_position: 29
---

# Group Anagrams

> **LeetCode 49 · Medium · Pattern: Hashing by canonical key (signature)**

> Companies: Amazon (very frequent), Meta, Google, Microsoft, Bloomberg, Uber.

Given an array of strings `strs`, group the anagrams together. You can return the answer in any order.

An **anagram** is a word formed by rearranging the letters of another word, using every original letter exactly once.

```
Input:  ["eat","tea","tan","ate","nat","bat"]
Output: [["bat"],["nat","tan"],["ate","eat","tea"]]   (any order)

Input:  [""]   → [[""]]
Input:  ["a"]  → [["a"]]
```

Constraints (LeetCode): `1 <= strs.length <= 10^4`, `0 <= strs[i].length <= 100`, lowercase English letters only.

---

## 1. Understand

Put strings into buckets so that two strings share a bucket **if and only if** they contain the same characters with the same counts. Return the buckets.

Rephrased: find a **key** that's identical for all anagrams and different for non-anagrams, then group by that key.

## 2. Clarify

| Question | Why it matters |
| --- | --- |
| Only lowercase `a-z`? | Lets you use a 26-slot count array as the key. With Unicode or mixed case you'd need a general key (a sorted string or a char-count map). |
| Case-sensitive? Spaces and punctuation? | `"Dormitory"` vs `"dirty room"`. Decide whether to normalize first. |
| Can strings be empty? | `""` is a valid word and forms its own group. Don't skip it. |
| Duplicates in input? | `["a","a"]` gives `[["a","a"]]`. Keep both. |
| Output order? | Usually any order, both for groups and within groups. |
| Sizes: many short strings or a few long ones? | Determines whether the sort key (`k log k`) or the count key (`k + 26`) is better. |

**Let `n` = number of strings and `k` = maximum string length.**

## 3. Brute force

For each ungrouped string, compare it with every other ungrouped string using an anagram check.

```js
function isAnagram(a, b) {
  if (a.length !== b.length) return false;

  const count = new Array(26).fill(0);
  
  for (let i = 0; i < a.length; i++) {
    count[a.charCodeAt(i) - 97]++;
    count[b.charCodeAt(i) - 97]--;
  }

  return count.every((c) => c === 0);
}

function groupAnagramsBrute(strs) {
  const used = new Array(strs.length).fill(false);
  const result = [];
  
  for (let i = 0; i < strs.length; i++) {
    if (used[i]) continue;
    
    const group = [strs[i]];
    
    used[i] = true;
    
    for (let j = i + 1; j < strs.length; j++) {
      if (!used[j] && isAnagram(strs[i], strs[j])) {
        group.push(strs[j]);
        used[j] = true;
      }
    }

    result.push(group);
  }

  return result;
}
```

- Time **O(n² · k)**, Space **O(n)** for the `used` flags.
- With `n = 10^4` that's about 10^8 character operations, which is too slow.

## 4. Optimize: find the bottleneck

The bottleneck is **pairwise comparison**. Anagram equality is an equivalence relation, so instead of comparing strings with each other, map every string to a **canonical form** (a signature) and let a hash map do the grouping in one pass.

Two good signatures:
1. **Sorted characters:** `"eat"` becomes `"aet"`. Costs O(k log k) per string.
2. **Character counts:** `"eat"` becomes `"1#0#0#0#1#...#1#..."`. Costs O(k + 26) per string.

## 5. Pattern: Group by canonical key

> When items belong together under an equivalence relation, compute a **canonical representative** for each item and use it as a hash map key. Grouping becomes O(n × cost of key).

The same pattern shows up in:
- Group Shifted Strings (key = differences between consecutive chars mod 26)
- Find Duplicate File in System (key = file content)
- Isomorphic strings / Word Pattern (key = first-occurrence index pattern)
- Valid Anagram (the single-pair version)
- Find All Anagrams in a String (a sliding window with a count signature, see [Find All Anagrams](../Sliding%20Window/04_Find%20All%20Anagrams%20in%20a%20String.md))

## 6. Implement

### Approach A: Sorted string key (simplest, works for any charset)

```js
/**
 * @param {string[]} strs
 * @return {string[][]}
 */
function groupAnagrams(strs) {
  const groups = new Map(); // sortedKey -> string[]

  for (const s of strs) {
    const key = [...s].sort().join(''); // [...s] is Unicode-safe, unlike s.split('')
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  return [...groups.values()];
}
```

### Approach B: Character count key (optimal for `a-z`)

```js
/**
 * @param {string[]} strs
 * @return {string[][]}
 */
function groupAnagramsCount(strs) {
  const groups = new Map();

  for (const s of strs) {
    const count = new Array(26).fill(0);

    for (let i = 0; i < s.length; i++) {
      count[s.charCodeAt(i) - 97]++;
    }

    const key = count.join('#'); // the delimiter is REQUIRED, see below

    if (!groups.has(key)) groups.set(key, []);
    
    groups.get(key).push(s);
  }

  return [...groups.values()];
}
```

**Why the `#` delimiter matters:** without it, counts become ambiguous. A string with 11 `a`s and 1 `b` gives `"111000..."`, and a string with 1 `a` and 11 `b`s gives `"111000..."` too. That's a collision and a wrong grouping. `count.join('#')` produces `"11#1#0..."` vs `"1#11#0..."`. Note that `count.join('')` is the bug, and `count.toString()` is fine because it uses commas.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Brute force pairwise | O(n² · k) | O(n) |
| Sorted key | O(n · k log k) | O(n · k) |
| **Count key** | **O(n · (k + 26)) = O(n · k)** | **O(n · k)** |

- Space covers the keys and the output, and the output alone is O(n · k), so you can't do better.
- **In practice:** for `k ≤ 100` the sorted key is often just as fast in JS, because `Array.prototype.sort` is native while building a 26-length array and joining it has overhead. Mention this trade-off. It shows maturity.
- Hashing a key of length `L` costs O(L), which is already included above.

## 8. Testing

```js
// Normalize: sort inside each group, then sort the groups, so comparison ignores order
const normalize = (groups) =>
  JSON.stringify(groups.map((g) => [...g].sort()).sort((a, b) => (a.join() < b.join() ? -1 : 1)));

const tests = [
  { input: ['eat', 'tea', 'tan', 'ate', 'nat', 'bat'], expected: [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']] },
  { input: [''], expected: [['']] },                          // empty string
  { input: ['a'], expected: [['a']] },                        // single
  { input: ['', ''], expected: [['', '']] },                  // multiple empty strings
  { input: ['abc', 'abc'], expected: [['abc', 'abc']] },      // exact duplicates
  { input: ['ab', 'a', 'b'], expected: [['ab'], ['a'], ['b']] }, // different lengths
  { input: ['aab', 'abb'], expected: [['aab'], ['abb']] },    // same letters, different counts
  // Delimiter collision: 11 a's + 1 b vs 1 a + 11 b's
  { input: ['a'.repeat(11) + 'b', 'a' + 'b'.repeat(11)], expected: [['a'.repeat(11) + 'b'], ['a' + 'b'.repeat(11)]] },
];

for (const fn of [groupAnagrams, groupAnagramsCount]) {
  for (const { input, expected } of tests) {
    console.assert(normalize(fn(input)) === normalize(expected), `${fn.name} failed on ${JSON.stringify(input)}`);
  }
}

// Adversarial / scale: 10^4 strings of length 100
const big = Array.from({ length: 1e4 }, () =>
  Array.from({ length: 100 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')
);
console.time('sort-key');  groupAnagrams(big);      console.timeEnd('sort-key');
console.time('count-key'); groupAnagramsCount(big); console.timeEnd('count-key');
```

## 9. Alternatives

### a) Prime product key (know it, but don't recommend it)
Map each letter to a distinct prime (`a=2, b=3, c=5, ...`) and use the product as the key. Unique factorization guarantees correctness, **but** the product overflows quickly (`z=101`, so `101^100` is far beyond 2^53). You'd need `BigInt`, which is slow. Bring it up only to show you considered it and rejected it.

### b) Fixed-size encoding for long strings
If `k` is huge and the alphabet is small, the count key is still O(26) in length regardless of `k`, so hashing stays cheap. The sorted key's length grows with `k`. That's the strongest argument for the count key.

### c) Unicode / case-insensitive version
```js
const key = [...s.toLowerCase().normalize('NFC')].filter((c) => /\p{L}/u.test(c)).sort().join('');
```

---

## Follow-ups interviewers ask

1. **Strings contain Unicode or emoji:** `split('')` breaks surrogate pairs, so use `[...s]` and the sorted key or a `Map` count. A 26-slot array no longer works.
2. **Streaming input / distributed (billions of words):** use the canonical key as a shard key (MapReduce: map emits `(key, word)`, reduce collects the groups).
3. **Return only groups of size ≥ 2:** filter at the end.
4. **Find the largest anagram group:** track the max while inserting.
5. **Memory constrained:** store indices instead of strings in the groups, or hash the key (e.g. 64-bit) and accept a tiny collision risk with verification.
6. **Related:** Valid Anagram (LC 242), Find All Anagrams in a String (LC 438), Group Shifted Strings (LC 249).

## Common mistakes

- `count.join('')` without a delimiter, which causes collisions.
- Using a plain object with keys like `"constructor"` (with the sorted key, the word `"constructor"` doesn't sort to that, but the habit is risky). Prefer `Map`.
- `s.split('').sort()` on non-ASCII input.
- `sort()` on numbers without a comparator. That isn't the issue here (we're sorting characters), but interviewers like to probe whether you know the default sort is lexicographic.
