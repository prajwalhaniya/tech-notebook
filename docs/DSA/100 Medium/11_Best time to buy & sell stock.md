---
sidebar_position: 11
---

# Best Time to Buy and Sell Stock II

> **LeetCode 122 · Medium · Pattern: Greedy (sum every upward move)**. For the single-transaction version, the state-machine DP that solves every variant, and the fee, cooldown and k-transaction follow-ups, see [Best Time to Buy and Sell Stock](../100%20Easy/15_Best%20time%20to%20buy%20%26%20sell%20stock.md).

You are given an integer array prices where prices[i] is the price of a given stock on the ith day.

On each day, you may decide to buy and/or sell the stock. You can only hold at most one share of the stock at any time. However, you can buy it then immediately sell it on the same day. Find and return the maximum profit you can achieve.

Input: prices = [7,1,5,3,6,4]

Output: 7

Explanation: Buy on day 2 (price = 1) and sell on day 3 (price = 5), profit = 5-1 = 4. Then buy on day 4 (price = 3) and sell on day 5 (price = 6), profit = 6-3 = 3. Total profit is 4 + 3 = 7.

```js
function maxProfit(prices) {
    if (!prices || prices.length < 2) {
        return 0; // No profit can be made with less than two prices
    }

    let maxProfit = 0;

    for (let i = 1; i < prices.length; i++) {
        // If the price on the current day is higher than the previous day, add the difference to the profit
        if (prices[i] > prices[i - 1]) {
            maxProfit += prices[i] - prices[i - 1];
        }
    }

    return maxProfit;
}

// Example usage:
const prices = [7, 1, 5, 3, 6, 4];
const result = maxProfit(prices);
console.log(result); // Output: 7 (buy at day 1 and sell at day 2, buy at day 3 and sell at day 4, buy at day 5 and sell at day 6)

```
