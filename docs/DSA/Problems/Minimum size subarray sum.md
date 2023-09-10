---
sidebar_postion: 26
---
Given an array of positive integers nums and a positive integer target, return the minimal length of a 
subarray

whose sum is greater than or equal to target. If there is no such subarray, return 0 instead.

```js
function minSubarray(target, nums) {
    let minLength = Infinity;
    let sum = 0;
    let left = 0;

    for (let right = 0; right < nums.length; right++) {
        sum += nums[right];

        while (sum >= target) {
            minLength = Math.min(minLength, right - left + 1);
            sum -= nums[left];
        }
    }
    return minLength;
}

```