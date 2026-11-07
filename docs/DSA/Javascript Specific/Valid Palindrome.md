---
sidebar_position: 23
---

# Valid Palindrome

> **LeetCode 125 · Easy · Pattern: Two Pointers (opposite ends, converging)**

> Companies: Meta (very frequent), Microsoft, Amazon, Apple, Bloomberg. Often a warm-up, followed by **Valid Palindrome II** (allow one deletion) as the real question.

A phrase is a **palindrome** if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters are letters and digits.

Given a string `s`, return `true` if it is a palindrome, or `false` otherwise.

```
Input: s = "A man, a plan, a canal: Panama"  → Output: true   ("amanaplanacanalpanama")
Input: s = "race a car"                      → Output: false  ("raceacar")
Input: s = " "                               → Output: true   ("" is a palindrome)
```

Constraints (LeetCode): `1 <= s.length <= 2 * 10^5`, `s` consists only of printable ASCII characters.

---

## 1. Understand

Ignore everything that isn't a letter or digit, ignore case, and check whether what's left is the same read from both ends.

Rephrased: character `i` from the left (counting only valid characters) must equal character `i` from the right, for every `i` up to the middle.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| What counts as alphanumeric? `_`? Unicode letters like `é`? | LeetCode means ASCII `[a-zA-Z0-9]` only. `\w` in regex includes `_`, which is a bug here. |
| Is case ignored? | Yes, `'A' === 'a'`. Digits have no case. |
| Empty string, or a string with no alphanumerics? | Both are palindromes and should return `true`. |
| Can I use extra memory? | If not, the in-place two-pointer approach is required. |
| Can I modify the input? | Strings are immutable in JS anyway, so "cleaning" always allocates a new string. |

**Edge cases:** `" "`, `".,"`, a single character, `"0P"` (a digit vs a letter, `false`), `"ab_a"` (`_` must be skipped, `true`), mixed case `"Aa"`, all symbols except one character.

## 3. Brute force: clean, reverse, compare

```js
function isPalindromeBrute(s) {
  const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}
```

- Time **O(n)**, Space **O(n)**. It builds a cleaned copy, an array and a reversed copy.
- **Why it works:** it follows the definition literally.
- **When it's preferable:** production code where readability matters more than memory, and as a quick first answer in an interview.
- **Limitations:** three extra allocations of size n. It doesn't stop early, so it does full work even when the first and last characters differ. `split('')` also breaks on surrogate pairs (emoji) if Unicode is ever in scope.

## 4. Optimize: find the bottleneck

Time is already linear, so the bottleneck is **memory**. We build a whole new string just to compare characters pairwise.

**Key insight:** we never need the cleaned string. Two indices can walk in from both ends of the *original* string, skip invalid characters on the fly and compare as they go. That gives O(1) extra space and an **early exit** on the first mismatch.

## 5. Pattern: Two Pointers, converging from opposite ends

> When the answer depends on a relationship between the i-th element from the start and the i-th from the end (symmetry), or when the input is sorted and you're searching for a pair, put one pointer at each end and move them toward each other.

The same pattern shows up in:
- Reverse String / Reverse Vowels of a String
- Valid Palindrome II (one deletion allowed)
- Two Sum II (sorted array), 3Sum, [Container With Most Water](../100%20Medium/08_Container%20with%20most%20water.md), [Trapping Rain Water](../100%20Medium/39_Trapping%20Rain%20Water.md)
- Palindrome Linked List (find the middle, reverse, then compare from both ends)

## 6. Implement (optimal: in-place two pointers)

```js
/**
 * @param {string} s
 * @return {boolean}
 */
function isPalindrome(s) {
  let left = 0;
  let right = s.length - 1;

  while (left < right) {
    // skip characters that don't count
    while (left < right && !isAlphaNumeric(s.charCodeAt(left))) left++;
    while (left < right && !isAlphaNumeric(s.charCodeAt(right))) right--;

    if (toLower(s.charCodeAt(left)) !== toLower(s.charCodeAt(right))) {
      return false;
    }

    left++;
    right--;
  }

  return true;
}

function isAlphaNumeric(code) {
  return (
    (code >= 48 && code <= 57) ||  // 0-9
    (code >= 65 && code <= 90) ||  // A-Z
    (code >= 97 && code <= 122)    // a-z
  );
}

function toLower(code) {
  return code >= 65 && code <= 90 ? code + 32 : code; // 'A' (65) + 32 = 'a' (97)
}
```

- **Why it works:** after skipping, `left` and `right` always point at the next valid character from each end. Comparing them is exactly the comparison the brute force does on the cleaned string, minus the copy. Each pointer only moves inward, so every character is visited at most once.
- **Why `left < right` inside the skip loops:** without it, a string like `".,"` lets `left` run past `right` (or off the end of the string), and you end up comparing the wrong characters.
- **Why char codes instead of regex:** no regex engine call and no one-character string allocation per step. It's a micro-optimization, but interviewers like seeing you know `charCodeAt`.

### Bugs in the original version of this note (worth knowing as "spot the bug")

```js
const left = 0;               // ❌ const, so left++ throws a TypeError
if (convertedStr[left] !== converted[right])  // ❌ typo: `converted` is undefined
return false;                 // ❌ the end of the loop should return true
```

## 7. Complexity

| Approach | Time | Space | Early exit? |
| --- | --- | --- | --- |
| Clean + reverse + compare | O(n) | O(n) | No |
| Clean + two pointers | O(n) | O(n) | Yes |
| **In-place two pointers** | **O(n)** | **O(1)** | **Yes** |
| Recursion on substrings | O(n²) with slicing | O(n) stack | Yes |

## 8. Testing

```js
const tests = [
  ['A man, a plan, a canal: Panama', true], // classic
  ['race a car', false],                   // classic false
  [' ', true],                             // becomes empty
  ['.,', true],                            // only symbols, pointers must not cross badly
  ['a', true],                             // single char
  ['0P', false],                           // digit vs letter: '0'(48) vs 'p'(112)
  ['ab_a', true],                          // '_' is NOT alphanumeric (\w bug)
  ['Aa', true],                            // case-insensitive
  ['123 21', true],                        // digits count
  ['ab@', false],                          // symbol at the end
];

for (const [s, expected] of tests) {
  console.assert(isPalindrome(s) === expected, `isPalindrome(${JSON.stringify(s)}) should be ${expected}`);
}

// Adversarial: 200k chars, a palindrome with junk in the middle (forces a full scan)
console.assert(isPalindrome('a'.repeat(1e5) + '!' + 'a'.repeat(1e5)) === true);
// Adversarial: 200k non-alphanumeric chars (the skip loops do all the work)
console.assert(isPalindrome('!'.repeat(2e5)) === true);
```

**Dry run** for `"ab_a"`:

| step | left → char | right → char | action |
| --- | --- | --- | --- |
| 1 | 0 → `a` | 3 → `a` | equal, move both |
| 2 | 1 → `b` | 2 → `_` | skip `_`, right becomes 1 |
| 3 | 1 → `b` | 1 → `b` | `left < right` is false, return `true` |

## 9. Alternatives

### a) Two pointers with a regex helper. O(n) time, O(1) space

More readable and still in-place. A good choice if you're nervous about char-code math.

```js
function isPalindromeRegex(s) {
  const isAlnum = (ch) => /[a-z0-9]/i.test(ch);
  let l = 0, r = s.length - 1;

  while (l < r) {
    if (!isAlnum(s[l])) { l++; continue; }
    if (!isAlnum(s[r])) { r--; continue; }
    if (s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++; r--;
  }
  return true;
}
```

- **When it's preferable:** readability, or a team codebase.
- **Limitations:** it allocates a one-character string per comparison and calls the regex engine per character, which makes it slower by a constant factor.

### b) Unicode-aware version (if the interviewer says "support any language")

Use `/[\p{L}\p{N}]/u` for "letter or number", iterate with `Array.from(s)` (which splits by code point, so emoji stay intact) and compare with `toLocaleLowerCase()`. Mention that full Unicode correctness also involves normalization (`s.normalize('NFC')`) so that `é` written as one code point equals `e` + a combining accent. That costs O(n) space, which is the price of correctness.

---

## Follow-ups interviewers ask

### Valid Palindrome II (LeetCode 680): you may delete at most one character

On the first mismatch you have exactly two choices: skip the left character or skip the right one. Check whether either remaining range is a palindrome. You never need to branch again, because only one deletion is allowed.

```js
function validPalindrome(s) {
  const isRange = (l, r) => {
    while (l < r) {
      if (s[l] !== s[r]) return false;
      l++; r--;
    }
    return true;
  };

  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) return isRange(l + 1, r) || isRange(l, r - 1);
    l++; r--;
  }
  return true;
}
// validPalindrome("abca") → true (delete 'b' or 'c')
```

Time O(n), space O(1). A common mistake is greedily choosing one side. `"cbbcc"` shows why both must be tried.

### Other follow-ups

1. **At most k deletions** (Valid Palindrome III): this becomes DP. `n - LPS(s) <= k`, where LPS is the longest palindromic subsequence, at O(n²).
2. **Streaming input / a string too big for memory:** two pointers need random access. Use a file with seek, or compare rolling hashes of the forward and reverse streams (with a probabilistic false-positive caveat).
3. **Palindrome Number** (no string conversion): reverse half of the number mathematically. See [Palindrome](../100%20Easy/02_Palindrome.md).
4. **Longest Palindromic Substring:** expand around centers. See [Longest Palindromic Substring](../100%20Medium/26_Longest%20Palidromic%20Substring.md).

## Common mistakes

- Using `\w` (it includes `_`) or `/[^a-z]/` (it drops digits).
- Forgetting `left < right` inside the skip loops.
- Declaring the pointers with `const`.
- Lowercasing only one side.
- Returning `false` for an empty or all-symbol string.
