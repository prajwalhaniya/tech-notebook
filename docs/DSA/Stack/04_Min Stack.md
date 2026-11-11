---
sidebar_position: 4
---

# Min Stack

> **LeetCode 155 · Medium · Pattern: Augmented Data Structure (store the aggregate per level)**

> Companies: Amazon (very frequent), Bloomberg, Microsoft, Google, Meta, Apple. It's a **design** question, so interviewers grade the API as much as the algorithm: what happens on an empty stack, how duplicates of the minimum are handled, and whether you can trade space for simplicity. Common follow-ups: **Max Stack (LC 716)**, **a queue with O(1) min**, and **O(1) extra space**.

Design a stack that supports `push`, `pop`, `top` and retrieving the minimum element, **each in O(1) time**.

```
MinStack()      initializes the stack
push(val)       pushes val
pop()           removes the top element
top()           returns the top element
getMin()        returns the minimum element in the stack

Input:  push(-2), push(0), push(-3), getMin(), pop(), top(), getMin()
Output:                              -3                0      -2
```

Constraints (LeetCode): `-2^31 <= val <= 2^31 - 1`; `pop`, `top` and `getMin` are only called on a non-empty stack; at most `3 * 10^4` calls.

---

## 1. Understand

A normal stack gives O(1) `push`, `pop` and `top`. The hard part is `getMin` after a `pop`: if the minimum is popped, we need the **previous** minimum immediately, without rescanning.

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| What should `pop`, `top` and `getMin` do on an empty stack? | LeetCode guarantees it never happens. In a real API, throw (or return `undefined`) and **say which**. |
| Can values repeat, including the minimum? | **Critical** for the two-stack version: push to the min stack on `<=`, not `<` (alternative a). |
| Value range? | The O(1)-extra-space trick (alternative c) stores `2·val − min`, which overflows 32-bit ints. Fine in JS below 2^53. |
| O(1) amortized or worst case? | All the versions here are O(1) worst case per operation (apart from occasional array growth). |
| Do we also need `getMax`, or `popMin`? | `getMax` is the same trick. `popMin` changes the problem completely: Max Stack (LC 716), see the follow-ups. |
| Thread-safe? | Not normally. Mention a lock around each operation if it's shared. |

**Edge cases:** pushing the current minimum again (duplicates), popping the minimum, strictly increasing pushes (minimum never changes), strictly decreasing pushes (it changes every time), negative values and extremes (`-2^31`, `2^31 − 1`).

## 3. Brute force

### a) Stack + scan on `getMin` — O(n) per `getMin`

```js
class MinStackScan {
  constructor() { this.items = []; }
  push(val) { this.items.push(val); }
  pop() { this.items.pop(); }
  top() { return this.items[this.items.length - 1]; }
  getMin() {
    let min = Infinity;
    for (const x of this.items) if (x < min) min = x;
    return min;
  }
}
```

### b) Cache the min, rescan only when the min is popped

Better on average, but popping the minimum still costs O(n), and an adversary can do it every time (push decreasing values, then pop them all).

### c) Stack + a sorted multiset (balanced BST or heap with lazy deletion)

O(log n) per operation. It's correct, but overkill, and it's not O(1).

- **Why they work:** (a) checks everything; (c) keeps the values ordered.
- **When they're preferable:** (a) as a test oracle; (c) when you also need `popMin` (see Max Stack below).
- **Limitations:** not O(1) for `getMin`.

## 4. Optimize: find the bottleneck

The key observation: a stack only changes **at the top**. When an element is pushed, the minimum of everything **below** it is fixed until that element is popped. So the minimum at each depth never changes while that depth exists.

```
push -2   → depth 1, min so far -2
push  0   → depth 2, min so far -2
push -3   → depth 3, min so far -3
pop       → back to depth 2, whose min was recorded as -2
```

Store the "minimum so far" **with each element**, and `getMin` is just a read of the top's record. It's a **prefix minimum** that grows and shrinks with the stack.

## 5. Pattern: augment each element with an aggregate of everything below it

> If a structure only changes at one end (stack top, or end of an array), you can store an **aggregate of the prefix** (min, max, sum, gcd, count) at each position, and undo it for free by popping.

Related:
- **Max Stack (LC 716):** getMax is the same, `popMax` needs more (follow-ups)
- **Min queue / sliding-window min:** two min stacks make a queue with O(1) amortized min; the monotonic deque does it more directly (Sliding Window Maximum, LC 239)
- **Stock Spanner (LC 901),** [Daily Temperatures](./05_Daily%20Temperatures.md): monotonic stacks, which keep only the useful candidates instead of every element
- "Undo" in editors, and persistent or functional data structures: each version shares the past and stores its own summary

## 6. Implement (optimal: one stack of `[value, minSoFar]` pairs)

```js
class MinStack {
  constructor() {
    this.stack = [];               // each entry: [value, min of this entry and everything below it]
  }

  /** @param {number} val */
  push(val) {
    const min = this.stack.length === 0 ? val : Math.min(val, this.getMin());
    this.stack.push([val, min]);
  }

  pop() {
    if (this.stack.length === 0) throw new Error('pop from empty stack');
    this.stack.pop();              // the min below is restored automatically
  }

  /** @return {number} */
  top() {
    if (this.stack.length === 0) throw new Error('top of empty stack');
    return this.stack[this.stack.length - 1][0];
  }

  /** @return {number} */
  getMin() {
    if (this.stack.length === 0) throw new Error('getMin of empty stack');
    return this.stack[this.stack.length - 1][1];
  }
}
```

- **Why it works:**
  - **Invariant:** `stack[i][1] = min(stack[0][0], …, stack[i][0])`.
  - `push` maintains it from the previous top's min. `pop` removes the last entry, and every remaining entry's min is still correct because it only depends on the entries below it.
  - So the top's min is the minimum of the whole stack.
- **Duplicates are free:** each copy of the minimum carries its own record, so popping one copy leaves the others' records in place.
- **When it's preferable:** the default answer. One structure, no edge cases with duplicates, easy to explain.
- **Limitations:** stores two numbers per element even when the minimum rarely changes (alternative a), and a small array per entry costs more memory in JS than two parallel number arrays.

## 7. Complexity

| Approach | push | pop | top | getMin | Extra space |
| --- | --- | --- | --- | --- | --- |
| Scan on `getMin` | O(1) | O(1) | O(1) | O(n) | O(1) |
| Sorted multiset alongside | O(log n) | O(log n) | O(1) | O(1)–O(log n) | O(n) |
| **Pairs `[value, minSoFar]`** | **O(1)** | **O(1)** | **O(1)** | **O(1)** | **O(n)** |
| Two stacks, min stack on `<=` (alt. a) | O(1) | O(1) | O(1) | O(1) | O(n) worst, often much less |
| Encoded values (alt. c) | O(1) | O(1) | O(1) | O(1) | **O(1)** |

## 8. Testing

```js
function check(Impl) {
  const s = new Impl();
  s.push(-2); s.push(0); s.push(-3);
  console.assert(s.getMin() === -3);
  s.pop();
  console.assert(s.top() === 0);
  console.assert(s.getMin() === -2);

  // Duplicates of the minimum: popping one copy must keep the other
  const d = new Impl();
  d.push(1); d.push(1); d.push(2); d.pop(); d.pop();
  console.assert(d.getMin() === 1);

  // Extremes
  const e = new Impl();
  e.push(2 ** 31 - 1); e.push(-(2 ** 31)); e.push(2 ** 31 - 1);
  console.assert(e.getMin() === -(2 ** 31) && e.top() === 2 ** 31 - 1);
  e.pop(); e.pop();
  console.assert(e.getMin() === 2 ** 31 - 1);
}

// Adversarial: random operation sequences compared with the scanning version
function fuzz(Impl) {
  for (let t = 0; t < 300; t++) {
    const a = new Impl(), b = new MinStackScan();
    let size = 0;
    for (let op = 0; op < 200; op++) {
      if (size === 0 || Math.random() < 0.55) {
        const v = Math.floor(Math.random() * 11) - 5;   // small range → many duplicates
        a.push(v); b.push(v); size++;
      } else {
        a.pop(); b.pop(); size--;
      }
      if (size > 0) console.assert(a.getMin() === b.getMin() && a.top() === b.top(), Impl.name);
    }
  }
}

check(MinStack); fuzz(MinStack);
```

The same `check` and `fuzz` run against every alternative below. The small value range makes duplicates of the minimum common, which is the case that breaks the `<` version of alternative a.

**Dry run** for `push(-2), push(0), push(-3), getMin(), pop(), top(), getMin()`:

| operation | stack (bottom → top) as `[value, min]` | returns |
| --- | --- | --- |
| push(-2) | `[-2,-2]` | |
| push(0) | `[-2,-2] [0,-2]` | |
| push(-3) | `[-2,-2] [0,-2] [-3,-3]` | |
| getMin() | | -3 |
| pop() | `[-2,-2] [0,-2]` | |
| top() | | 0 |
| getMin() | | -2 |

## 9. Alternatives

### a) Two stacks: push to the min stack only when `val <= current min`

```js
class MinStackTwoStacks {
  constructor() {
    this.items = [];
    this.mins = [];                 // non-increasing: the history of minimums
  }
  push(val) {
    this.items.push(val);
    if (this.mins.length === 0 || val <= this.mins[this.mins.length - 1]) this.mins.push(val);   // <=, not <
  }
  pop() {
    const val = this.items.pop();
    if (val === this.mins[this.mins.length - 1]) this.mins.pop();
  }
  top() { return this.items[this.items.length - 1]; }
  getMin() { return this.mins[this.mins.length - 1]; }
}
```

- O(1) per operation, O(n) worst-case extra space (strictly decreasing pushes), but much less when the minimum rarely changes.
- **Why `<=`:** with `<`, pushing `1, 1` records the minimum once. Popping the first `1` then pops the min stack, and `getMin` is wrong (empty) while a `1` is still in the stack.
- **When it's preferable:** memory matters, and pushes are mostly above the minimum (the common case).
- **Limitations:** the `<=` subtlety. A variant stores `[minValue, count]` on the min stack to handle long runs of the same minimum more compactly.

### b) Linked list nodes carrying the min

```js
class MinStackLinked {
  constructor() { this.head = null; }        // node: { val, min, next }
  push(val) {
    const min = this.head === null ? val : Math.min(val, this.head.min);
    this.head = { val, min, next: this.head };
  }
  pop() { this.head = this.head.next; }
  top() { return this.head.val; }
  getMin() { return this.head.min; }
}
```

- Same idea as the pairs version, with no array resizing, so every operation is O(1) worst case (not amortized).
- **When it's preferable:** if the interviewer asks to implement the stack without built-in arrays, or for a persistent stack (old heads stay valid and share their tails).

### c) O(1) extra space: encode the old minimum in the pushed value

Store only one number per element. When a new minimum arrives, push an **encoded** value `2·val − min` (which is less than `val`) and set `min = val`. When popping a value below the current `min`, it must be encoded, so recover the previous minimum as `2·min − encoded`.

```js
class MinStackEncoded {
  constructor() { this.items = []; this.min = Infinity; }
  push(val) {
    if (this.items.length === 0) { this.items.push(val); this.min = val; }
    else if (val < this.min) { this.items.push(2 * val - this.min); this.min = val; }  // encoded: < val
    else this.items.push(val);
  }
  pop() {
    const x = this.items.pop();
    if (x < this.min) this.min = 2 * this.min - x;    // x was encoded: restore the previous min
    if (this.items.length === 0) this.min = Infinity;
  }
  top() {
    const x = this.items[this.items.length - 1];
    return x < this.min ? this.min : x;               // an encoded top means the real value is min
  }
  getMin() { return this.min; }
}
```

- O(1) time, **O(1) extra space** beyond the stored values.
- **Why it works:** if `val < min`, then `2·val − min = val − (min − val) < val = newMin`. So encoded entries are exactly those smaller than the current minimum, and normal entries are always `>= min`. Inverting the formula restores the old minimum.
- **When it's preferable:** when asked for O(1) extra space. It's a good signal of depth, but say the risks.
- **Limitations:** `2·val − min` can overflow 32/64-bit integers (use `long` in Java, or store differences). It doesn't work for non-numeric comparables, and it's hard to read. Don't lead with it.

---

## Follow-ups interviewers ask

### 1. Max Stack with `popMax` (LC 716, Hard)
`getMax` is the same as this problem, but **removing** the max from the middle can't be done by popping. Use a doubly linked list (the stack) plus a sorted map from value to list nodes (or a heap with lazy deletion). That gives O(log n) for `push`, `pop` and `popMax`, and O(1) for `top`.

### 2. A queue with O(1) `getMin`
Use two min stacks (an "in" stack and an "out" stack, as in Implement Queue using Stacks, LC 232). `getMin = min(in.getMin(), out.getMin())`. Every operation is O(1) amortized. This is the basis of the sliding-window minimum.

### 3. Sum, gcd or max instead of min
The same augmentation works for any aggregate where you only ever add at the top: prefix sum, prefix gcd, prefix max.

### 4. Generic comparator
Accept `compare(a, b)` in the constructor and use it instead of `Math.min`. Alternative c no longer works (it needs arithmetic).

### 5. Concurrency
Each operation reads and writes the top. With threads, guard each method with one lock. Lock-free stacks (Treiber stack) exist, but carrying the min atomically complicates them.

## Common mistakes

- `<` instead of `<=` in the two-stack version, which loses duplicates of the minimum.
- Recomputing the minimum after popping it by scanning (O(n)).
- Forgetting the empty case in `push` (`Math.min(val, undefined)` is `NaN`).
- Leading with the encoded version and then having overflow bugs.
- Not deciding what `pop`, `top` and `getMin` do on an empty stack.
