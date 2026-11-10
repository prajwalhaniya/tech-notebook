---
sidebar_position: 6
---

# Valid Parentheses

> **LeetCode 20 · Easy · Pattern: Stack (match the most recent unmatched opener)**

> Companies: Meta, Amazon, Google, Microsoft, Bloomberg, LinkedIn. It's often a warm-up, and a warm-up is where small slips cost the most: popping an empty stack, forgetting leftover openers, or claiming a counter works. The follow-ups carry the real signal: **Minimum Remove to Make Valid Parentheses (LC 1249)** is one of Meta's most frequently asked problems, and **Longest Valid Parentheses (LC 32)** is a Hard.

Given a string `s` containing only the characters `(`, `)`, `{`, `}`, `[` and `]`, determine whether it is valid:

- Open brackets must be closed by the **same type** of bracket.
- Open brackets must be closed in the **correct order**.
- Every close bracket has a corresponding open bracket of the same type.

```
Input: s = "()"        → true
Input: s = "()[]{}"    → true
Input: s = "(]"        → false
Input: s = "([])"      → true
Input: s = "([)]"      → false   (crossed, not nested)
```

Constraints (LeetCode): `1 <= s.length <= 10^4`, and `s` consists of bracket characters only.

---

## 1. Understand

Brackets must **nest**, like function calls or HTML tags. When a closer arrives, it must match the **most recently opened bracket that hasn't been closed yet**. Anything else, whether a different type, nothing open, or something still open at the end, is invalid.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Only bracket characters, or other text too (`"a(b)c"`)? | With other text, skip non-bracket characters instead of treating them as closers. |
| Is the empty string valid? | Usually yes (nothing is unbalanced). LeetCode's constraints exclude it, but the code should return `true`. |
| Only one bracket type? | Then a counter works in O(1) space (alternative a). With several types, it doesn't. |
| Return a boolean, or the position of the first error? | An editor or linter wants the index. Same algorithm, different return value. |
| Very long input? | Depth can reach `n/2`, so the stack is O(n). A recursive parser would overflow the call stack on `"((((…"`. |

**Edge cases:** odd length (always invalid), a closer first (`")("`), only openers (`"((("`), crossed pairs (`"([)]"`), deep nesting, and many adjacent pairs.

## 3. Brute force: remove matched pairs until nothing changes

Any valid string contains an adjacent pair `()`, `[]` or `{}`. Removing it leaves a valid string, so repeatedly delete pairs until none remain.

```js
function isValidBrute(s) {
  let prev;
  do {
    prev = s;
    s = s.replaceAll('()', '').replaceAll('[]', '').replaceAll('{}', '');
  } while (s !== prev);
  return s.length === 0;
}
```

- Time **O(n²)**: up to `n/2` rounds (e.g. `"((((…))))"` loses one pair per round), each O(n). Space O(n) for new strings.
- **Why it works:** in a valid string, the innermost pair is always adjacent, and removing it keeps the rest valid. An invalid string eventually has no adjacent pair but isn't empty.
- **When it's preferable:** a one-liner in a scripting context, or as a test oracle.
- **Limitations:** quadratic, and it creates many intermediate strings.

## 4. Optimize: find the bottleneck

The brute force rescans the whole string to find the next innermost pair. But scanning **left to right**, the innermost open bracket is always **the last unmatched opener seen so far**. Keep the unmatched openers in a stack: a closer must match the top, and then it's popped. Each character is pushed or popped once, so it's one pass.

## 5. Pattern: stack for nested structure (LIFO matching)

> When things open and close in **nested** order (the last opened is the first closed), use a stack. Push on open, pop and check on close.

The same pattern covers:
- Minimum Remove to Make Valid Parentheses (LC 1249), Minimum Add to Make Parentheses Valid (LC 921) (see follow-ups)
- Longest Valid Parentheses (LC 32), Score of Parentheses (LC 856)
- Decode String (LC 394), Basic Calculator (LC 224/227), Simplify Path (LC 71)
- HTML/XML tag matching, JSON validation, compilers matching `{}` blocks
- The monotonic stack problems ([Daily Temperatures](../100%20Medium/48_Daily%20Temperatures.md), [Largest Rectangle in Histogram](../100%20Medium/49_Largest%20Rectangle%20in%20Histogram.md)) use a stack too, but for "nearest greater or smaller," not nesting. See [Min Stack](../100%20Medium/47_Min%20Stack.md) for stack design itself.

## 6. Implement (optimal: stack of openers)

```js
/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  if (s.length % 2 === 1) return false;                  // pairs need an even length

  const openerFor = { ')': '(', ']': '[', '}': '{' };     // closer → the opener it needs
  const stack = [];

  for (const ch of s) {
    if (ch in openerFor) {
      // A closer must match the most recent unmatched opener.
      if (stack.length === 0 || stack.pop() !== openerFor[ch]) return false;
    } else {
      stack.push(ch);                                    // an opener: wait for its closer
    }
  }

  return stack.length === 0;                             // anything left was never closed
}
```

- **Why it works:**
  - **Invariant:** after processing a prefix, the stack holds exactly the unmatched openers of that prefix, in order.
  - A valid closer must close the innermost open bracket, which is the top. If the stack is empty or the top is a different type, no later input can fix it, so return `false` immediately.
  - At the end, a non-empty stack means some opener was never closed.
- **Why the empty-stack check:** `")"` would otherwise pop `undefined`. In JS, comparing `undefined` to `'('` happens to return `false` correctly, but say the check out loud. In Java, `stack.pop()` on an empty `ArrayDeque` throws.
- **Why the odd-length check:** a free early exit, not needed for correctness.
- **When it's preferable:** any number of bracket types. It's the expected answer.
- **Limitations:** O(n) space in the worst case (`"((((((…"`).

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Remove adjacent pairs repeatedly | O(n²) | O(n) |
| **Stack of openers** | **O(n)** | **O(n)** |
| Counter (one bracket type only, alt. a) | O(n) | O(1) |

## 8. Testing

```js
const tests = [
  ['()', true],
  ['()[]{}', true],
  ['(]', false],
  ['([])', true],
  ['([)]', false],          // crossed
  ['{[]}', true],
  ['', true],               // empty
  ['(', false],             // odd length
  ['((', false],            // unclosed openers
  ['))', false],            // closer with nothing open
  [')(', false],            // right counts, wrong order
  ['(((())))', true],       // deep nesting
  ['([{}])[]{()}', true],
];

for (const [s, expected] of tests) {
  console.assert(isValid(s) === expected, `isValid("${s}") → ${isValid(s)}`);
  console.assert(isValidBrute(s) === expected, `brute("${s}")`);
}

// Adversarial: random bracket strings compared with the brute force
const chars = '()[]{}';
for (let t = 0; t < 5000; t++) {
  const n = Math.floor(Math.random() * 12);
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * 6)];
  console.assert(isValid(s) === isValidBrute(s), s);
}

// Adversarial: 10^4 nested brackets
console.assert(isValid('('.repeat(5000) + ')'.repeat(5000)) === true);
console.assert(isValid('('.repeat(5000) + ')'.repeat(4999) + ']') === false);
```

Random strings are mostly invalid. The handwritten cases cover the valid shapes.

**Dry run** for `s = "([)]"`:

| ch | action | stack after |
| --- | --- | --- |
| `(` | push | `(` |
| `[` | push | `( [` |
| `)` | needs `(`, top is `[` | → return `false` |

## 9. Alternatives

### a) Counter (only valid for a single bracket type)

```js
function isValidSingleType(s) {              // s contains only '(' and ')'
  let open = 0;
  for (const ch of s) {
    open += ch === '(' ? 1 : -1;
    if (open < 0) return false;              // a ')' with nothing open
  }
  return open === 0;
}
```

- Time O(n), space **O(1)**.
- **Why it works:** with one type, the only thing that matters is how many are open, never which kind.
- **Limitations:** with several types, separate counters accept `"([)]"`: each count balances, but the order is crossed. Saying *why* counters fail is a common interview checkpoint.

### b) Push the expected closer

```js
function isValidExpectClosers(s) {
  const closerFor = { '(': ')', '[': ']', '{': '}' };
  const expected = [];
  for (const ch of s) {
    if (ch in closerFor) expected.push(closerFor[ch]);   // remember what must come next
    else if (expected.pop() !== ch) return false;        // pop of empty → undefined → false
  }
  return expected.length === 0;
}
```

- Same complexity. Slightly shorter, because the comparison is direct.
- **When it's preferable:** if you like compact code. It's the same algorithm.

### c) Recursive descent

A grammar `S → ε | (S)S | [S]S | {S}S`, parsed by a recursive function. It's elegant and it generalizes to real parsers. But depth `n/2` recursion overflows the call stack on deeply nested input, which is why the explicit stack is preferred for this problem.

---

## Follow-ups interviewers ask

### 1. Minimum Remove to Make Valid Parentheses (LC 1249, very common at Meta)

Remove the fewest `(` or `)` so the string, which can contain letters, becomes valid. Return any valid result.

```js
function minRemoveToMakeValid(s) {
  const chars = s.split('');
  const openIdx = [];                       // indices of unmatched '('
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '(') openIdx.push(i);
    else if (chars[i] === ')') {
      if (openIdx.length) openIdx.pop();    // matched
      else chars[i] = '';                   // unmatched ')': remove it
    }
  }
  for (const i of openIdx) chars[i] = '';   // unmatched '(' left over: remove them
  return chars.join('');
}
```

- O(n) time and space. Store **indices**, not characters, because you need to know what to delete.
- It's minimal because every removed bracket was unmatched, and an unmatched bracket must be removed (or another bracket added) in any valid result.

### 2. Minimum Add to Make Parentheses Valid (LC 921)

Count unmatched `)` while scanning, plus unmatched `(` left at the end:

```js
function minAddToMakeValid(s) {
  let open = 0, add = 0;
  for (const ch of s) {
    if (ch === '(') open++;
    else if (open > 0) open--;
    else add++;                 // ')' with nothing to match: must add a '('
  }
  return add + open;            // plus a ')' for each '(' never closed
}
```

### 3. Longest Valid Parentheses (LC 32, Hard)

Push **indices**, seeded with `-1` as the "last invalid position." The length of the valid substring ending at `i` is `i − stack.top`.

```js
function longestValidParentheses(s) {
  const stack = [-1];                       // index before the current valid run
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') stack.push(i);
    else {
      stack.pop();
      if (stack.length === 0) stack.push(i);           // unmatched ')': new base
      else best = Math.max(best, i - stack[stack.length - 1]);
    }
  }
  return best;
}
```

There's also an O(1)-space solution: two counter passes, left to right and right to left.

### 4. Wildcards: `*` can be `(`, `)` or empty (LC 678)

Track the **range** of possible open counts `[lo, hi]`. `(` raises both; `)` lowers both; `*` lowers `lo` and raises `hi`. If `hi < 0`, return false; clamp `lo` at 0. At the end, valid if `lo === 0`. That's O(n) time and O(1) space.

### 5. Generate all valid strings of `n` pairs (LC 22)
Backtracking: add `(` while `open < n`, and add `)` while `close < open`. The count is the Catalan number `C(n)`.

## Common mistakes

- Popping without checking for an empty stack (it throws in Java/Python, and only works in JS by accident).
- Returning `true` at the end without checking that the stack is empty (`"(("`).
- Using one counter per bracket type, which accepts `"([)]"`.
- Treating every non-opener as a closer when the input can contain other characters.
- Recursion on deeply nested input.
