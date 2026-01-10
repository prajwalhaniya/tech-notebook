---
sidebar_position: 11
---
Given an integer array nums, move all 0's to the end of it while maintaining the relative order of the non-zero elements.

Note that you must do this in-place without making a copy of the array.

Input: nums = [0,1,0,3,12]

Output: [1,3,12,0,0]

```js
/**
 * @param {number[]} nums
 * @return {void} Do not return anything, modify nums in-place instead.
 */
var moveZeroes = function(nums) {
    const n = nums.length;
    let nonZeroIndex = 0;

    for (let i = 0; i < n; i++) {
        if (nums[i] !== 0) {
            nums[nonZeroIndex] = nums[i];
            nonZeroIndex++;
        }
    }

    for (let i = nonZeroIndex; i < n; i++) {
        nums[i] = 0
    }

    return nums;
};
```
