---
sidebar_position: 15
---

# Best Time to Buy and Sell Stock

> **LeetCode 121 · Easy · Pattern: One pass with a running minimum (prefix min / Kadane)**

> Companies: Amazon (one of its most-asked), Meta, Microsoft, Google, Bloomberg, Goldman Sachs. The easy version is the warm-up. The real test is the **follow-up family** (unlimited trades, k trades, cooldown, fees), which all fall out of one state-machine DP.

You're given an array `prices`, where `prices[i]` is the price of a stock on day `i`. You want to maximize your profit by choosing **one day to buy** and a **different day in the future to sell**.

Return the maximum profit. If you can't make any profit, return `0`.

```
Input: prices = [7,1,5,3,6,4]  → Output: 5   (buy at 1 on day 1, sell at 6 on day 4)
Input: prices = [7,6,4,3,1]    → Output: 0   (prices only fall, so don't trade)
```

Constraints (LeetCode): `1 <= prices.length <= 10^5`, `0 <= prices[i] <= 10^4`.

---

## 1. Understand

Find `i < j` that maximize `prices[j] - prices[i]`, or return 0 if every such difference is negative.

Rephrased: **for each selling day, what's the cheapest price on any earlier day?** The best answer is the largest "today's price minus the cheapest price so far".

The order matters. The answer isn't `max - min`, because the minimum might come **after** the maximum (`[5, 6, 1]` gives 1, not 5).

## 2. Clarify (ask these out loud)

| Question | Why it matters |
| --- | --- |
| Exactly one transaction, or several? | One here. Several is Stock II (see the follow-ups). |
| Must I buy before I sell? | Yes. That's why `max - min` is wrong. |
| Can I buy and sell on the same day? | It gives a profit of 0, which the "return 0" rule already covers. |
| What do I return if prices only fall? | `0`, not a negative number. You can choose not to trade. |
| Should I return the profit, or the days? | The profit. Returning the days is a small extension. |
| Fewer than 2 days? | Return 0. |
| Can prices be negative or fractional? | Not here. With floats, watch the precision, or work in cents. |

**Edge cases:** a single day, strictly decreasing prices, all equal prices, a minimum that comes after the maximum (`[2,4,1]` gives 2), and the best buy that isn't the global minimum (`[3,8,1,2]` gives 5).

## 3. Brute force: try every pair

```js
function maxProfitBrute(prices) {
  let best = 0;
  for (let i = 0; i < prices.length; i++) {
    for (let j = i + 1; j < prices.length; j++) {
      best = Math.max(best, prices[j] - prices[i]);
    }
  }
  return best;
}
```

- Time **O(n²)**, Space **O(1)**.
- **Why it works:** it checks every valid (buy, sell) pair.
- **When it's preferable:** only as a testing oracle.
- **Limitations:** about 5 × 10^9 pairs at n = 10^5, so it times out.

## 4. Optimize: find the bottleneck

For a fixed selling day `j`, the inner loop recomputes `min(prices[0..j-1])` from scratch. That minimum can only **shrink or stay the same** as `j` moves right, so keep it in a variable (a **running prefix minimum**). Each day then costs O(1), and the whole scan is O(n).

**Key insight:** at day `j` you only need two facts about the past: the cheapest price so far and the best profit so far. Everything else can be thrown away.

## 5. Pattern: a single pass carrying a running aggregate (prefix min)

> When the answer for position `j` depends on the min, max or sum of everything before `j`, carry that aggregate forward in a variable instead of recomputing it.

Seen another way, this is **Kadane's algorithm** (maximum subarray) on the daily price **differences**. Buying on day `i` and selling on day `j` earns the sum of the differences between `i` and `j`. See alternative (a).

Related problems:
- Maximum Subarray (Kadane)
- Maximum Difference Between Increasing Elements (LC 2016), which is the same problem
- Trapping Rain Water (prefix max from both sides). See [Trapping Rain Water](../100%20Medium/39_Trapping%20Rain%20Water.md).
- The whole Stock family (II, III, IV, cooldown, fee), via a state-machine DP

## 6. Implement (optimal: one pass with a running minimum)

```js
/**
 * @param {number[]} prices
 * @return {number}
 */
function maxProfit(prices) {
  let minPrice = Infinity; // cheapest buy price seen so far
  let best = 0;            // best profit so far (0 = don't trade)

  for (const price of prices) {
    if (price < minPrice) {
      minPrice = price;                         // a better day to buy
    } else {
      best = Math.max(best, price - minPrice);  // sell today, buying at the cheapest earlier price
    }
  }

  return best;
}
```

- **Why it works:** when we're at `price`, `minPrice` is the minimum over all **earlier or equal** days, so `price - minPrice` is the best profit from selling today. Taking the maximum over all days covers every valid pair. The order is enforced because `minPrice` only comes from days already visited.
- **When it's preferable:** always for a single transaction. It's optimal in time and space, and it works on a **stream** of prices.
- **Limitations:** it gives the profit only. To return the days, track `minIdx` along with `buy` and `sell` (see the follow-ups). It doesn't generalize directly to multiple transactions. Use the DP in alternative (b) for those.

**Notes on the original version:** it was correct. Two small points: starting `minPrice` at `Infinity` (or `prices[0]`) and looping once is enough, and the `prices.length < 2` guard isn't needed, since the loop naturally returns 0.

## 7. Complexity

| Approach | Time | Space |
| --- | --- | --- |
| Brute force | O(n²) | O(1) |
| **Running minimum** | **O(n)** | **O(1)** |
| Kadane on differences | O(n) | O(1) |
| State-machine DP | O(n) | O(1) |

You can't do better than O(n): any unread price could be the best selling day.

## 8. Testing

```js
const tests = [
  [[7, 1, 5, 3, 6, 4], 5],       // classic
  [[7, 6, 4, 3, 1], 0],          // strictly decreasing, so no trade
  [[1], 0],                      // single day
  [[], 0],                       // empty (defensive)
  [[3, 3, 3], 0],                // flat
  [[1, 2], 1],                   // minimal profit
  [[2, 4, 1], 2],                // global min comes AFTER the max
  [[3, 2, 6, 5, 0, 3], 4],       // best buy isn't the global min
  [[2, 1, 2, 1, 0, 1, 2], 2],    // the minimum moves several times
];

for (const [prices, expected] of tests) {
  console.assert(maxProfit(prices) === expected, `maxProfit(${prices}) should be ${expected}`);
}

// Adversarial: random arrays checked against brute force
for (let t = 0; t < 1000; t++) {
  const p = Array.from({ length: Math.floor(Math.random() * 10) }, () => Math.floor(Math.random() * 10));
  console.assert(maxProfit(p) === maxProfitBrute(p), p);
}

// Adversarial: 1e5 strictly decreasing prices. The answer is 0, and it must not go negative.
console.assert(maxProfit(Array.from({ length: 1e5 }, (_, i) => 1e5 - i)) === 0);
```

**Dry run** for `[7,1,5,3,6,4]`:

| day | price | minPrice after | profit if we sell today | best |
| --- | --- | --- | --- | --- |
| 0 | 7 | 7 | — | 0 |
| 1 | 1 | 1 | — | 0 |
| 2 | 5 | 1 | 4 | 4 |
| 3 | 3 | 1 | 2 | 4 |
| 4 | 6 | 1 | **5** | **5** |
| 5 | 4 | 1 | 3 | 5 |

## 9. Alternatives

### a) Kadane's algorithm on the daily differences. O(n) time, O(1) space

`prices[j] - prices[i]` equals the sum of the differences `d[k] = prices[k] - prices[k-1]` for `k = i+1..j`. So the problem becomes **maximum subarray sum** of `d`, floored at 0.

```js
function maxProfitKadane(prices) {
  let cur = 0;  // best sum of a run of differences ending today
  let best = 0;
  for (let i = 1; i < prices.length; i++) {
    cur = Math.max(0, cur + prices[i] - prices[i - 1]); // extend the run, or restart (buy today)
    best = Math.max(best, cur);
  }
  return best;
}
```

- **When it's preferable:** when the interviewer asks "have you seen this before?" Connecting it to Kadane shows pattern recognition.
- **Limitations:** it's less intuitive to explain than the running minimum.

### b) State-machine DP. O(n) time, O(1) space

Each day you're in one of two states: **holding** a share, or **free** (not holding).

```
hold = max(hold, -price)          // keep holding, or buy today (only one buy allowed, so start from 0)
free = max(free, hold + price)    // stay free, or sell what we hold today
```

```js
function maxProfitDP(prices) {
  let hold = -Infinity; // best balance while holding one share
  let free = 0;         // best balance while holding nothing
  for (const p of prices) {
    free = Math.max(free, hold + p);
    hold = Math.max(hold, -p);
  }
  return free;
}
```

- **When it's preferable:** whenever a variation is likely. Every Stock follow-up is this DP with a small change.
- **Limitations:** it's overkill for the base problem, and the order of updates matters in some variants.

---

## Follow-ups interviewers ask (the Stock family)

All of these change only the transitions of the state machine.

### 1. Return the buy and sell days

```js
function maxProfitWithIndices(prices) {
  let minIdx = 0, best = 0, buy = -1, sell = -1;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < prices[minIdx]) minIdx = i;
    else if (prices[i] - prices[minIdx] > best) {
      best = prices[i] - prices[minIdx];
      buy = minIdx;
      sell = i;
    }
  }
  return { profit: best, buy, sell }; // buy = sell = -1 when there's no profitable trade
}
```

### 2. Stock II: unlimited transactions (LC 122)
Collect every upward move: `profit += max(0, prices[i] - prices[i-1])`. Any rising run from `a` to `b` equals the sum of its daily gains, so taking every positive difference is optimal. See [Best Time to Buy and Sell Stock II](../100%20Medium/11_Best%20time%20to%20buy%20%26%20sell%20stock.md).

```js
function maxProfitII(prices) {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
  }
  return profit;
}
```

### 3. With a transaction fee (LC 714)
Unlimited trades, and each sale pays `fee`. The DP is the same, except a buy starts from the previous `free` balance (not 0), and a sale pays the fee.

```js
function maxProfitFee(prices, fee) {
  let hold = -Infinity, free = 0;
  for (const p of prices) {
    const prevFree = free;
    free = Math.max(free, hold + p - fee);
    hold = Math.max(hold, prevFree - p);
  }
  return free;
}
```

### 4. With a cooldown (LC 309)
After you sell, you can't buy the next day. That adds a third state, `sold` (just sold today).

```js
function maxProfitCooldown(prices) {
  let hold = -Infinity, sold = 0, rest = 0;
  for (const p of prices) {
    const prevSold = sold;
    sold = hold + p;                 // sell today
    hold = Math.max(hold, rest - p); // can only buy from rest (not right after selling)
    rest = Math.max(rest, prevSold); // cooldown day, or keep resting
  }
  return Math.max(sold, rest);
}
```

### 5. At most k transactions (LC 188; k = 2 is LC 123)
Keep `buy[j]` and `sell[j]` for the j-th transaction. When `k >= n/2`, the limit never binds, so fall back to Stock II.

```js
function maxProfitK(k, prices) {
  if (k === 0 || prices.length < 2) return 0;
  if (k >= prices.length / 2) return maxProfitII(prices);

  const buy = new Array(k + 1).fill(-Infinity);
  const sell = new Array(k + 1).fill(0);
  for (const p of prices) {
    for (let j = 1; j <= k; j++) {
      buy[j] = Math.max(buy[j], sell[j - 1] - p); // the j-th buy uses the profit from j-1 sales
      sell[j] = Math.max(sell[j], buy[j] + p);
    }
  }
  return sell[k];
}
```

Time O(n·k), space O(k).

| Variant | Change | Time / Space |
| --- | --- | --- |
| I (one trade) | `hold = max(hold, -p)` | O(n) / O(1) |
| II (unlimited) | `hold = max(hold, free - p)`, or the greedy version | O(n) / O(1) |
| Fee | Subtract `fee` when selling | O(n) / O(1) |
| Cooldown | Add a `sold` state, and buy only from `rest` | O(n) / O(1) |
| III / IV (k trades) | One `buy`/`sell` pair per transaction | O(nk) / O(k) |

### 6. Streaming prices
The running-minimum solution already works one tick at a time with O(1) memory. For "the best trade within the last W days", use a **monotonic deque** for the sliding-window minimum.

## Common mistakes

- Returning `max(prices) - min(prices)`, which ignores the order.
- Returning a negative profit when prices only fall.
- Updating `best` with a minimum from a *later* day (for example, updating the min after computing the profit, using the wrong index).
- In the DP variants, updating `hold` with the **new** `free` from the same day, which buys and sells on the same day in the fee and cooldown variants. Save the previous value first.
