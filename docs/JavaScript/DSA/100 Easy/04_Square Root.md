---
sidebar_position: 4
---
Given a non-negative integer x, return the square root of x rounded down to the nearest integer. The returned integer should be non-negative as well.

You must not use any built-in exponent function or operator.

```js
const mySqrt = function(x) {
    let left = 1;
    let right = x;

    while (left <= right) {
        const mid = left + Math.floor((right - left) / 2);
        if (mid * mid > x) {
            right = mid - 1;
        } else if (mid * mid < x) {
            left = mid + 1;
        } else {
            return mid;
        }
    }
    return left - 1;
};
```