---
sidebar_position: 6
---

Given an integer array nums, a reducer function fn, and an initial value init, return a reduced array.

A reduced array is created by applying the following operation: val = fn(init, nums[0]), val = fn(val, nums[1]), val = fn(val, nums[2]), ... until every element in the array has been processed. The final value of val is returned.

If the length of the array is 0, it should return init.

Solve it without using the built-in `Array.reduce` method.

```js
function customReduce(nums, reducerFn, init) {
    let result = init;

    for (let i = 0; i < nums.length; i++) {
        result = reducerFn(result, nums[i]);
    }
    return result;
}

const nums = [1, 2, 3, 4, 5];
const reducer = (accumulator, currentValue) => accumulator + currentValue;
const initialValue = 0;

const reducedValue = customReduce(nums, reducer, initialValue);
console.log(reducedValue); 
```