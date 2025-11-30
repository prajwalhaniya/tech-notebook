---
sidebar_position: 1
---

# Best Time to Buy and Sell Stock

You are given an array `prices` where `prices[i]` is the price of a given stock on the ith day.

You want to maximize your profit by choosing a single day to **buy** one stock and choosing a **different future day** to **sell** that stock.

Return the **maximum profit** you can achieve.  
If no profit is possible, return **0**.

### Example

**Input:**  
`prices = [7,1,5,3,6,4]`

**Output:**  
`5`

**Explanation:**  
Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5.  
Buying after selling is not allowed.

```java
package Array;

public class BestTimeBuyAndSellStock {

    public int maxProfit(int[] prices) {
        int minPrice = prices[0];
        int maxProfit = 0;

        for (int i = 1; i < prices.length; i++) {
            minPrice = Math.min(prices[i], minPrice);
            maxProfit = Math.max(maxProfit, prices[i] - minPrice);
        }
        return maxProfit;
    }

    public static void main(String []args){
        int prices[] = {7,1,5,3,6,4};
        BestTimeBuyAndSellStock obj = new BestTimeBuyAndSellStock();
        System.out.println("Max profit is " + obj.maxProfit(prices));
    }
}
```