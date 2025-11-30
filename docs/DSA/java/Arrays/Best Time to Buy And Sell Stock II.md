---
sidebar_position: 1
---

# Best Time to Buy and Sell Stock II

You are given an integer array `prices` where `prices[i]` is the price of a stock on the ith day.

On each day, you may choose to **buy and/or sell** the stock.  
You can hold **at most one share** at a time, but you are allowed to buy and sell on the **same day**.

Return the **maximum total profit** you can achieve.

### Example

**Input:**  
`prices = [7,1,5,3,6,4]`

**Output:**  
`7`

**Explanation:**  
Buy at `1` and sell at `5` → profit `4`  
Buy at `3` and sell at `6` → profit `3`  
Total profit = `4 + 3 = 7`

```java
package Array;

public class BestTimeBuyAndSellStockII {

    public int maxProfit(int[] prices) {
        int max = 0;
        int start = prices[0];
        for (int i = 1; i < prices.length; i++) {
            if (start < prices[i]) {
                max += prices[i] - start;
            }
            start = prices[i];
        }
        return max;
    }

    public int maxProfit2(int[] prices) {
        int max = 0;
        int currentMin = prices[0];
        for (int i = 1; i < prices.length; i++) {
            currentMin = Math.min(currentMin, prices[i]);
            max = Math.max(max, prices[i] - currentMin);
        }
        return max;
    }

    public static void main(String[] args) {
        int prices[] = {7,1,5,3,6,4};
        int prices2[] = {7,1,3,5,6,4};
        BestTimeBuyAndSellStockII obj = new BestTimeBuyAndSellStockII();
        System.out.println("Max profit is " + obj.maxProfit2(prices2));
        System.out.println("Max profit is " + obj.maxProfit(prices2));
    }
}
```

