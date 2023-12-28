---
sidebar_position: 2
---
Given an integer x, return true if x is a palindrome, and false otherwise.

```js
const isPalindrome = function(x) {
    let str = x.toString();
    let left = 0;
    let right = str.length -  1;

    while (left < right) {
        if (str[left] !== str[right]) {
            return false;
        }
        left++;
        right--;
    }
    return true;
};
```