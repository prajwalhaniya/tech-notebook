---
sidebar_position: 31
---
Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

```js
/**
 * @param {number[][]} intervals
 * @return {number[][]}
 * Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
 * Output: [[1,6],[8,10],[15,18]]
 * Explanation: Since intervals [1,3] and [2,6] overlap, merge them into [1,6]
 * 
 */
var merge = function(intervals) {
    if (intervals.length <= 1) {
        return intervals;
    }

    intervals.sort((a,b) => a[0] - b[0]);

    const mergedIntervals = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
        const currentInterval = mergedIntervals[i];
        const lastInterval = mergedIntervals[mergedIntervals.length - 1];

        if (currentInterval[0] <= lastInterval[1]) {
            lastInterval[1] = Math.max(lastInterval[1], currentInterval[1]);
        } else {
            mergedIntervals.push(currentInterval);
        }
    }
    return mergedIntervals;
};
```