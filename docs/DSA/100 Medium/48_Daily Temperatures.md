---
sidebar_position: 48
---

# Daily Temperatures

> **LeetCode 739 · Medium · Pattern: Monotonic Stack (next greater element)**

> Companies: Amazon, Meta, Google, Microsoft, Bloomberg, Uber. It's the cleanest introduction to the **monotonic stack**, which is behind many Medium and Hard problems ([Largest Rectangle in Histogram](./49_Largest%20Rectangle%20in%20Histogram.md), [Trapping Rain Water](./39_Trapping%20Rain%20Water.md), Sum of Subarray Minimums, Stock Spanner). Interviewers want two things: the O(n²) → O(n) jump, and a correct explanation of why a loop inside a loop is still **O(n) amortized**.

Given an array `temperatures`, return an array `answer` where `answer[i]` is the number of days you have to wait after day `i` to get a **warmer** temperature. If there's no future day that's warmer, `answer[i] = 0`.

```
Input: temperatures = [73,74,75,71,69,72,76,73]  → Output: [1,1,4,2,1,1,0,0]
Input: temperatures = [30,40,50,60]              → Output: [1,1,1,0]
Input: temperatures = [30,60,90]                 → Output: [1,1,0]
```

Constraints (LeetCode): `1 <= temperatures.length <= 10^5`, `30 <= temperatures[i] <= 100`.

---

## 1. Understand

For each day, find the **nearest later day with a strictly higher value**, and report the distance. This is the **Next Greater Element** problem, returning distances instead of values.

```
index:  0   1   2   3   4   5   6   7
temp:  73  74  75  71  69  72  76  73
                ↑ day 2 (75) waits until day 6 (76): answer 4
```

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Strictly warmer, or warmer-or-equal? | Strictly. It decides `<` vs `<=` when popping: equal temperatures must **not** resolve each other. |
| Distance or the temperature itself? | Distance (`j − i`). Next Greater Element I (LC 496) asks for the value. |
| What if no warmer day comes? | `0`. Our array is pre-filled with zeros. |
| Value range? | `30..100`: only 71 distinct values. That enables a different O(n·71) solution (alternative b). |
| Is the input a stream? | The stack version works online: each new day resolves earlier ones as it arrives. |

**Edge cases:** one day (`[0]`), strictly increasing (`[1,1,…,1,0]`), strictly decreasing (all `0`), all equal (all `0`), and a final spike that resolves everything.

## 3. Brute force

```js
function dailyTemperaturesBrute(temperatures) {
  const n = temperatures.length;
  const answer = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (temperatures[j] > temperatures[i]) {
        answer[i] = j - i;
        break;                         // the nearest one: stop at the first
      }
    }
  }
  return answer;
}
```

- Time **O(n²)** worst case (a decreasing array scans to the end for every day), space O(1) beyond the output.
- **Why it works:** it checks every later day in order, so the first warmer one is the nearest.
- **When it's preferable:** small `n`, or as a test oracle.
- **Limitations:** 5·10^9 steps for a decreasing array of 10^5. Too slow.

## 4. Optimize: find the bottleneck

The brute force scans forward from every day separately, re-reading the same days again and again. Turn it around: scan **once**, and keep a list of days that are **still waiting** for a warmer day.

When a new day arrives, it's the answer for every waiting day that's colder. Which waiting days are colder? Notice that the waiting days always have **non-increasing temperatures** from oldest to newest. If a newer day were warmer than an older waiting day, it would already have resolved it. So the coldest waiting days are at the **end** of the list. Pop from the end while they're colder, and stop at the first one that isn't.

That list is a stack whose values are monotonic: a **monotonic stack**.

## 5. Pattern: monotonic stack

> To find, for every element, the **nearest** element to one side that is greater (or smaller), keep a stack of unresolved indices with monotonic values. Each new element pops (resolves) everything it beats, then waits itself.

Four variants, one template:

| Find for each `i` | Scan direction | Stack holds values that are | Pop while |
| --- | --- | --- | --- |
| **Next greater** (this problem) | left → right | non-increasing | `a[top] < a[i]` (resolve top with `i`) |
| Next smaller | left → right | non-decreasing | `a[top] > a[i]` |
| Previous greater | left → right | strictly decreasing | `a[top] <= a[i]`; then top is the answer for `i` |
| Previous smaller | left → right | strictly increasing | `a[top] >= a[i]`; then top is the answer for `i` |

Whether ties are popped (`<` vs `<=`) decides whether "greater" means strictly greater or greater-or-equal. Get it right for each problem.

Problems using it:
- Next Greater Element I and II (LC 496, 503, the circular version: loop twice over the indices)
- Online Stock Span (LC 901): previous greater
- [Largest Rectangle in Histogram](./49_Largest%20Rectangle%20in%20Histogram.md) (LC 84): previous and next smaller
- [Trapping Rain Water](./39_Trapping%20Rain%20Water.md) (LC 42), Sum of Subarray Minimums (LC 907), Remove K Digits (LC 402), 132 Pattern (LC 456), Car Fleet (LC 853)

## 6. Implement (optimal: monotonic stack of indices)

```js
/**
 * @param {number[]} temperatures
 * @return {number[]}
 */
function dailyTemperatures(temperatures) {
  const n = temperatures.length;
  const answer = new Array(n).fill(0);     // default: no warmer day
  const waiting = [];                      // indices still waiting; temperatures non-increasing bottom → top

  for (let i = 0; i < n; i++) {
    // Today resolves every waiting day that is strictly colder.
    while (waiting.length > 0 && temperatures[waiting[waiting.length - 1]] < temperatures[i]) {
      const j = waiting.pop();
      answer[j] = i - j;
    }
    waiting.push(i);                       // today waits for its own warmer day
  }

  return answer;                           // anything still waiting keeps 0
}
```

- **Why it works:**
  - **Invariant:** `waiting` holds exactly the days before `i` that have no warmer day yet, with temperatures non-increasing from bottom to top.
  - When day `i` arrives, the colder waiting days are all on top (by the invariant), so popping while colder resolves exactly those, each with its **nearest** warmer day (`i` is the first day that beats them, or they'd have been popped earlier).
  - Pushing `i` keeps the stack non-increasing, since everything colder than it was just popped.
- **Why store indices, not temperatures:** we need distances (`i − j`), and the temperature is one lookup away.
- **Why `<` and not `<=`:** equal temperatures aren't warmer. With `<=`, `[70, 70]` would give `[1, 0]` instead of `[0, 0]`.
- **Amortized O(n):** the inner `while` can pop many elements at once, but every index is **pushed once and popped at most once** over the whole run. So the total work is at most `2n` stack operations.
- **When it's preferable:** always. It's the expected answer, works online, and doesn't depend on the value range.
- **Limitations:** O(n) stack in the worst case (a decreasing array keeps every index waiting).

## 7. Complexity

| Approach | Time | Space (beyond output) |
| --- | --- | --- |
| Check every later day | O(n²) | O(1) |
| **Monotonic stack** | **O(n)** amortized | **O(n)** |
| Right-to-left with next-occurrence table (alt. b) | O(n · W), W = 71 distinct values | O(W) |
| Right-to-left jumping through `answer` (alt. a) | O(n) amortized | **O(1)** |

## 8. Testing

```js
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const tests = [
  [[73, 74, 75, 71, 69, 72, 76, 73], [1, 1, 4, 2, 1, 1, 0, 0]],
  [[30, 40, 50, 60], [1, 1, 1, 0]],
  [[30, 60, 90], [1, 1, 0]],
  [[50], [0]],                         // one day
  [[90, 80, 70], [0, 0, 0]],           // decreasing: nobody resolves
  [[70, 70, 70], [0, 0, 0]],           // equal is not warmer
  [[70, 70, 71], [2, 1, 0]],           // ties resolved by the same later day
  [[80, 30, 30, 30, 90], [4, 3, 2, 1, 0]],  // final spike resolves everything
];

for (const [t, expected] of tests) {
  console.assert(eq(dailyTemperatures(t), expected), `${t} → ${dailyTemperatures(t)}`);
}

// Adversarial: random arrays (small value range → many ties) against the brute force
for (let k = 0; k < 2000; k++) {
  const n = 1 + Math.floor(Math.random() * 30);
  const t = Array.from({ length: n }, () => 30 + Math.floor(Math.random() * 8));
  console.assert(eq(dailyTemperatures(t), dailyTemperaturesBrute(t)), t);
}

// Adversarial: worst case for the brute force, 10^5 decreasing values → instant here
const dec = Array.from({ length: 1e5 }, (_, i) => 100 - (i % 71));
console.assert(dailyTemperatures(dec).length === 1e5);
```

**Dry run** for `[73, 74, 75, 71, 69, 72, 76, 73]` (stack shows indices with temperatures):

| i | temp | popped (answer set) | stack after |
| --- | --- | --- | --- |
| 0 | 73 | — | 0(73) |
| 1 | 74 | 0 → 1 | 1(74) |
| 2 | 75 | 1 → 1 | 2(75) |
| 3 | 71 | — | 2(75) 3(71) |
| 4 | 69 | — | 2(75) 3(71) 4(69) |
| 5 | 72 | 4 → 1, 3 → 2 | 2(75) 5(72) |
| 6 | 76 | 5 → 1, 2 → 4 | 6(76) |
| 7 | 73 | — | 6(76) 7(73) |

Days 6 and 7 are still waiting at the end, so they keep `0`. Result: `[1,1,4,2,1,1,0,0]`.

## 9. Alternatives

### a) Right to left, jumping through already computed answers — O(1) extra space

Process days from the end. For day `i`, start at `j = i + 1`. If `temperatures[j]` isn't warmer, jump straight to **its** next warmer day (`j + answer[j]`), skipping everything in between, which can't be warmer than `temperatures[j]` anyway.

```js
function dailyTemperaturesJump(temperatures) {
  const n = temperatures.length;
  const answer = new Array(n).fill(0);
  let hottest = -Infinity;                        // hottest temperature seen to the right

  for (let i = n - 1; i >= 0; i--) {
    const t = temperatures[i];
    if (t >= hottest) {                           // nothing to the right is warmer
      hottest = t;
      continue;                                   // answer[i] stays 0
    }
    let j = i + 1;
    while (temperatures[j] <= t) j += answer[j];  // answer[j] > 0 here, because something warmer exists
    answer[i] = j - i;
  }
  return answer;
}
```

- Time O(n) amortized, space **O(1)** beyond the output.
- **Why it works:** days between `j` and `j + answer[j]` are all `<= temperatures[j] <= t`, so none of them can be warmer than day `i`. The `hottest` check guarantees the jumps reach a warmer day instead of running off the end.
- **When it's preferable:** when asked for O(1) extra space.
- **Limitations:** needs the whole array (not streaming). The amortized argument is subtler to explain than the stack's.

### b) Right to left with a "next occurrence" table — uses the small value range

Keep `next[t]`, the nearest index to the right with temperature exactly `t`. For day `i`, the answer is the minimum of `next[t'] − i` over all warmer `t'`.

```js
function dailyTemperaturesTable(temperatures) {
  const n = temperatures.length;
  const answer = new Array(n).fill(0);
  const next = new Array(101).fill(Infinity);     // next[t] = nearest index to the right with temp t
  for (let i = n - 1; i >= 0; i--) {
    let nearest = Infinity;
    for (let w = temperatures[i] + 1; w <= 100; w++) nearest = Math.min(nearest, next[w]);
    if (nearest !== Infinity) answer[i] = nearest - i;
    next[temperatures[i]] = i;
  }
  return answer;
}
```

- Time **O(n · W)** with `W = 71`, space O(W).
- **When it's preferable:** it shows you used the constraints. Fine when the value range is tiny.
- **Limitations:** useless for arbitrary values (W could be 10^9). The stack doesn't care about the range.

---

## Follow-ups interviewers ask

### 1. Next Greater Element II, circular (LC 503)
Loop `i` from `0` to `2n − 1`, use `i % n`, and push only during the first pass. Elements near the end can then be resolved by elements at the start.

### 2. Online Stock Span (LC 901)
For each new price, how many consecutive previous days had a price `<=` today? Keep a stack of `[price, span]` and merge popped spans into today's. That's a previous-greater query, answered online.

### 3. Return the warmer temperature instead of the distance
`answer[j] = temperatures[i]` when popping. This is Next Greater Element I (LC 496), plus a hash map from value to index for the query array.

### 4. Streaming temperatures
The stack version already works online: each arriving day resolves earlier days immediately. Unresolved days stay on the stack. Mention memory: a long cold spell keeps them all.

### 5. Why is it O(n) if there's a nested loop?
Count operations per element, not per iteration: each index is pushed once and popped at most once. Total pops ≤ total pushes = n.

## Common mistakes

- Popping on `<=`, which treats equal temperatures as warmer.
- Storing temperatures instead of indices, which loses the distance.
- Saying the stack version is O(n²) because of the nested loop (or claiming O(n) without the push/pop argument).
- Forgetting that unresolved days must be `0` (pre-fill the answer).
- Using the value-range trick without saying it depends on the constraints.
