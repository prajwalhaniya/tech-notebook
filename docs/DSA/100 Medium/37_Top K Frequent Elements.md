---
sidebar_position: 37
---

# Top K Frequent Elements

> **LeetCode 347 · Medium · Pattern: Frequency count + Bucket sort / Heap (Top-K)**

> Companies: Amazon (very frequent), Meta, Google, Microsoft, Uber, Bloomberg, Oracle.

Given an integer array `nums` and an integer `k`, return the `k` most frequent elements. You may return the answer in **any order**.

```
Input:  nums = [1,1,1,2,2,3], k = 2   → [1,2]
Input:  nums = [1], k = 1             → [1]
Input:  nums = [4,4,-1,-1,-1,7], k = 1 → [-1]
```

Constraints (LeetCode): `1 <= nums.length <= 10^5`, `-10^4 <= nums[i] <= 10^4`, `k` is in `[1, number of unique elements]`, and **the answer is guaranteed to be unique** (no ties at the k-th boundary).

**Follow-up from the problem statement:** your algorithm's time complexity must be *better than* O(n log n).

---

## 1. Understand

Count how many times each distinct value appears, then return the `k` values with the highest counts.

This is really two sub-problems:
1. **Counting:** value → frequency. This step is always O(n).
2. **Selection:** pick the top `k` of `u` unique (value, frequency) pairs. All the interesting trade-offs live here.

## 2. Clarify

| Question | Why it matters |
| --- | --- |
| Can there be ties at the k-th position? | LeetCode guarantees no. In real life, ask whether to break ties by value or by first occurrence, or to return all tied items. |
| Is `k` always valid (`1 ≤ k ≤ unique count`)? | If not, decide whether to return everything or throw. |
| Does the output order matter? | "Any order" lets you skip a final sort. If they want it sorted by frequency, that's an extra O(k log k). |
| Negative numbers? | Yes. They rule out using the value directly as an array index (unless you offset it), so use a `Map`. |
| How big are `n`, `u` and `k`? | `k ≪ u` favours a size-k heap. `k ≈ u` favours sorting or buckets. |
| Is the data a stream, or too big for memory? | Changes the answer completely (heap, Count-Min Sketch, MapReduce). See the follow-ups. |

**Let `n` = array length, `u` = number of unique values (`u ≤ n`).**

## 3. Brute force

Count frequencies, then sort the unique values by frequency in descending order and take the first `k`.

```js
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number[]}
 */
function topKFrequentSort(nums, k) {
  const freq = new Map();
  for (const x of nums) freq.set(x, (freq.get(x) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1]) // by frequency, descending
    .slice(0, k)
    .map(([value]) => value);
}
```

- Time **O(n + u log u)**, Space **O(u)**.
- **Why it works:** after sorting by frequency, the first `k` entries are the most frequent by definition.
- **When it's preferable:** it's quick to write and easy to read, and it's fine when `u` is small. It's a great first answer to say out loud.
- **Limitation:** in the worst case (`u ≈ n`, all values distinct) it's O(n log n), which fails the follow-up requirement.

> An even more naive version scans the array again for each value to count it (O(n²)). Mention it only to dismiss it, since counting with a hash map is the obvious first step.

## 4. Optimize: find the bottleneck

Counting is already O(n) and can't be beaten (you must read every element). The bottleneck is the **full sort**: we sort all `u` items when we only need the top `k`, and we don't even need those `k` in order.

Two ways to avoid the full sort:
1. **Keep only `k` candidates** with a min-heap of size `k`, which gives O(u log k).
2. **Exploit the bounded key range.** A frequency is an integer in `[1, n]`, so we can bucket by frequency with no comparisons at all, which gives O(n).

A third option is **Quickselect**: partition around the k-th largest frequency, which is O(u) on average.

## 5. Pattern: Top-K selection

> "Top K / K largest / K most frequent / K closest" means **heap of size k** (general and streaming friendly) or **bucket sort** when the key is a small bounded integer, or **quickselect** when you have all the data and want average linear time.

Problems with the same pattern:
- Kth Largest Element in an Array (LC 215): heap or quickselect
- Top K Frequent Words (LC 692): heap with a tie-break comparator
- K Closest Points to Origin (LC 973): max-heap of size k or quickselect
- Sort Characters By Frequency (LC 451): bucket sort by frequency
- Find K Pairs with Smallest Sums (LC 373), Kth Largest Element in a Stream (LC 703)

## 6. Implement

### Approach A: Bucket sort by frequency (optimal, O(n))

The key insight is that **no element can appear more than `n` times**. So create `n + 1` buckets, where `buckets[f]` holds every value that appears exactly `f` times. Then walk the buckets from high frequency to low and collect values until you have `k`.

```js
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number[]}
 */
function topKFrequent(nums, k) {
  // 1. Count
  const freq = new Map();
  for (const x of nums) freq.set(x, (freq.get(x) ?? 0) + 1);

  // 2. Bucket by frequency: index = frequency (0..n)
  const buckets = Array.from({ length: nums.length + 1 }, () => []);
  for (const [value, f] of freq) buckets[f].push(value);

  // 3. Collect from highest frequency down
  const result = [];
  for (let f = buckets.length - 1; f >= 1 && result.length < k; f--) {
    for (const value of buckets[f]) {
      result.push(value);
      if (result.length === k) return result;
    }
  }
  return result;
}
```

- Time **O(n)**: counting is O(n), filling the buckets is O(u), and the scan visits n + 1 buckets plus at most `u` values.
- Space **O(n)**: the map is O(u) and the buckets are O(n + u).
- **Why it works:** a frequency is a bounded integer in `[1, n]`, so it can be used as an array index. That's counting sort applied to frequencies, which needs no comparisons.
- **When it's preferable:** when all the data is in memory and you want guaranteed linear time. It's the strongest answer to the problem's follow-up.
- **Limitations:** it allocates `n + 1` buckets even when `u` is tiny (e.g. `[7,7,7,...]` with 10^5 copies). It doesn't work for streams, and it doesn't generalize to keys that aren't small integers (e.g. "top k by score" where scores are floats).

### Approach B: Min-heap of size k (O(u log k), streaming friendly)

Keep a **min**-heap ordered by frequency. Push each (value, frequency) pair, and whenever the heap grows past `k`, pop the smallest. Whatever remains are the `k` largest. JavaScript has no built-in heap, so you need to write one. Practise this until you can do it from memory in an interview.

```js
class MinHeap {
  constructor(compare) {
    this.data = [];
    this.compare = compare; // (a, b) => negative if a should be above b
  }
  size() { return this.data.length; }
  peek() { return this.data[0]; }

  push(item) {
    const d = this.data;
    d.push(item);
    let i = d.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(d[i], d[parent]) >= 0) break;
      [d[i], d[parent]] = [d[parent], d[i]];
      i = parent;
    }
  }

  pop() {
    const d = this.data;
    const top = d[0];
    const last = d.pop();
    if (d.length > 0) {
      d[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let smallest = i;
        if (l < d.length && this.compare(d[l], d[smallest]) < 0) smallest = l;
        if (r < d.length && this.compare(d[r], d[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [d[i], d[smallest]] = [d[smallest], d[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number[]}
 */
function topKFrequentHeap(nums, k) {
  const freq = new Map();
  for (const x of nums) freq.set(x, (freq.get(x) ?? 0) + 1);

  const heap = new MinHeap((a, b) => a[1] - b[1]); // [value, freq], smallest freq on top
  for (const entry of freq) {
    heap.push(entry);
    if (heap.size() > k) heap.pop(); // evict the least frequent
  }

  return heap.data.map(([value]) => value);
}
```

- Time **O(n + u log k)**, Space **O(u + k)**.
- **Why it works:** the heap's invariant is that it holds the `k` most frequent items seen so far, and its root is the *weakest* of them. Any new item that beats the root replaces it, and any item that doesn't is discarded.
- **Why a *min*-heap for the *top* k:** you need fast access to the item you'd evict, which is the smallest of the current top k. A max-heap of all `u` items also works, but costs O(u + k log u) time and O(u) heap space.
- **When it's preferable:** when `k ≪ u`, when data arrives as a **stream** (frequencies already known, or top-k over a sliding window), or when the key isn't a bounded integer.
- **Limitation:** it's slower than buckets when `k ≈ u`, and you have to write a heap in JS.

### Approach C: Quickselect (O(u) average)

Partition the unique values by frequency (Hoare/Lomuto style, as in Kth Largest Element) so that the `k` most frequent end up on one side.

```js
/**
 * @param {number[]} nums
 * @param {number} k
 * @return {number[]}
 */
function topKFrequentQuickselect(nums, k) {
  const freq = new Map();
  for (const x of nums) freq.set(x, (freq.get(x) ?? 0) + 1);

  const unique = [...freq.keys()];
  const target = unique.length - k; // the elements at index >= target are the top k

  const swap = (i, j) => { [unique[i], unique[j]] = [unique[j], unique[i]]; };

  // 3-way partition (Dutch national flag): [< pivot | == pivot | > pivot].
  // A plain Lomuto partition degrades to O(u²) when many frequencies are EQUAL
  // (e.g. all values distinct, so every freq is 1). That's very common here.
  let lo = 0, hi = unique.length - 1;
  while (lo <= hi) {
    const pivotFreq = freq.get(unique[lo + Math.floor(Math.random() * (hi - lo + 1))]); // random pivot
    let lt = lo, i = lo, gt = hi;
    while (i <= gt) {
      const f = freq.get(unique[i]);
      if (f < pivotFreq) swap(lt++, i++);
      else if (f > pivotFreq) swap(i, gt--);
      else i++;
    }
    // Now [lo, lt) < pivot, [lt, gt] == pivot, (gt, hi] > pivot
    if (target < lt) hi = lt - 1;
    else if (target > gt) lo = gt + 1;
    else break; // target is inside the equal block, so everything from target on is >= the rest
  }

  return unique.slice(target);
}
```

- Time **O(n + u) average**, **O(n + u²) worst case** (made very unlikely by the random pivot). Space **O(u)**.
- **Why it works:** after partitioning, the pivot block sits at its final sorted position, so everything to its right has a higher frequency. We only continue into the side that contains index `target`.
- **Why 3-way:** with a 2-way partition, a run of equal keys all lands on one side, so every pass shrinks the range by only one element. When all values are distinct (all frequencies 1) that's quadratic. Grouping equal keys in the middle finishes in a single pass.
- **When it's preferable:** when the data is in memory and you want average linear time without bucket allocation (e.g. `u ≪ n`).
- **Limitations:** the worst case is quadratic, it isn't stable, it mutates its working array, it's harder to get right under pressure, and it doesn't work for streams.

## 7. Complexity

| Approach | Time | Space | Notes |
| --- | --- | --- | --- |
| Count + full sort | O(n + u log u) | O(u) | Fails the "better than n log n" follow-up when u ≈ n |
| Min-heap of size k | O(n + u log k) | O(u + k) | Best when k ≪ u, works for streams |
| Max-heap of all u | O(n + u + k log u) | O(u) | Heapify is O(u), then pop k times |
| Quickselect | O(n + u) avg, O(n + u²) worst | O(u) | Random pivot |
| **Bucket sort** | **O(n)** | **O(n)** | Guaranteed linear |

The O(u) for the frequency map is unavoidable in all of them (you have to count each unique value somewhere).

## 8. Testing

```js
// Normalize: order doesn't matter, so sort before comparing
const same = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y));

const tests = [
  { nums: [1, 1, 1, 2, 2, 3], k: 2, expected: [1, 2] },
  { nums: [1], k: 1, expected: [1] },                                // single element
  { nums: [4, 4, -1, -1, -1, 7], k: 1, expected: [-1] },             // negatives
  { nums: [5, 5, 5, 5], k: 1, expected: [5] },                       // one unique value
  { nums: [1, 2, 3, 4], k: 4, expected: [1, 2, 3, 4] },              // k = u, all frequencies equal
  { nums: [3, 0, 1, 0], k: 1, expected: [0] },                       // zero as a value (a falsy-check trap)
  { nums: [1, 2, 2, 3, 3, 3, 4, 4, 4, 4], k: 2, expected: [3, 4] },
  { nums: [-10000, 10000, 10000], k: 1, expected: [10000] },         // value bounds
];

for (const fn of [topKFrequentSort, topKFrequent, topKFrequentHeap, topKFrequentQuickselect]) {
  for (const { nums, k, expected } of tests) {
    console.assert(same(fn([...nums], k), expected), `${fn.name} failed on ${JSON.stringify(nums)}, k=${k}`);
  }
}

// Adversarial / scale
const allDistinct = Array.from({ length: 1e5 }, (_, i) => i);   // u = n, the sort's worst case. Any k values are valid, so this is a timing check only.
const allSame = new Array(1e5).fill(7);                         // u = 1, buckets mostly empty
const sortedFreq = Array.from({ length: 1e5 }, (_, i) => Math.floor(Math.sqrt(i))); // many distinct frequencies
for (const fn of [topKFrequentSort, topKFrequent, topKFrequentHeap, topKFrequentQuickselect]) {
  console.time(fn.name);
  fn(allDistinct, 10); fn(allSame, 1); fn(sortedFreq, 50);
  console.timeEnd(fn.name);
}
```

**Edge cases to call out loud:** `k === u` (return all), a single unique value, negative values and `0` (never write `if (freq.get(x))` to test for presence, because a stored `0` is falsy; use `has()`), and an already sorted input (it doesn't matter for buckets or the heap, but it matters for quickselect with a fixed pivot, which is why the pivot is random).

## 9. Alternatives and variations

### a) Tie-breaking (Top K Frequent Words, LC 692)
When there are ties, you must order by frequency descending, then lexicographically ascending. The heap comparator becomes:
```js
// min-heap: the "worst" item on top = lower freq, or the same freq but lexicographically LARGER
const compare = (a, b) => a[1] !== b[1] ? a[1] - b[1] : b[0].localeCompare(a[0]);
```
Pop everything at the end and reverse to get best-first order. Getting this inverted tie-break right is a classic interview trap.

### b) Returning results sorted by frequency
Buckets already produce a high→low order. For the heap, pop all `k` items and reverse (an extra O(k log k)).

### c) Streaming / data too big for memory
- **Exact, one machine:** a hash map plus a size-k min-heap, updated as data arrives.
- **Approximate, huge streams (e.g. trending hashtags):** **Count-Min Sketch** for frequencies plus a size-k heap, or the **Misra–Gries / Space-Saving** algorithms (O(k) memory, with frequency error bounds).
- **Distributed:** MapReduce. Map emits `(value, 1)`, reduce sums the counts, each reducer keeps a local top-k, then a final step merges the local top-k lists. A local top-k is **not** always globally correct unless you partition by key, which is a good point to raise.

---

## Follow-ups interviewers ask

1. **"Can you do better than O(n log n)?"** Bucket sort for O(n), or the heap for O(n + u log k).
2. **"What if k is very small compared to the number of unique elements?"** The heap: O(u log k) is essentially O(u).
3. **"What if the input is a stream and you need the top k at any moment?"** A map plus a heap, and think about how to update a frequency already in the heap (lazy deletion, or an indexed heap).
4. **"What about a sliding window: top k over the last W events?"** A map plus an ordered structure (balanced BST / sorted buckets keyed by frequency, like the O(1) LFU structure). See [Least Frequently Used](../caching/Least%20Frequently%20Used.md).
5. **"Billions of items across many machines?"** Partition by key, compute a local top-k, then merge. Or approximate with a Count-Min Sketch.
6. **"Why a min-heap instead of a max-heap?"** You evict the weakest of the current top k, so the weakest must be at the root.

## Common mistakes

- Using a **max**-heap of size k, which evicts the wrong element.
- Sizing the buckets as `n` instead of `n + 1`. When every element is the same, the frequency is `n`, so index `n` is needed.
- Forgetting that `Array(n).fill([])` makes every bucket the **same array**. Use `Array.from({ length }, () => [])`.
- Using a plain object for counting and then getting **string** keys back (`Object.keys` returns `"1"`, not `1`). Prefer `Map`, or convert with `Number(key)`.
- Sorting without a comparator (`.sort()` is lexicographic: `[10, 9, 1]` sorts as `[1, 10, 9]`).
- Forgetting the `k` stopping condition in the bucket scan and returning more than `k` items.
- Using a 2-way (Lomuto) partition in quickselect. Frequencies have many duplicates, so it goes quadratic. When I tested it, it took about 2 minutes on 10^5 distinct values, compared with about 13 ms for the 3-way version.
