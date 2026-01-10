---
sidebar_position: 23
---
A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string s, return true if it is a palindrome, or false otherwise.

```js
function isPalindrome(s) {
    const convertedStr = s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const left = 0;
    const right = convertedStr.length - 1;

    while (left < right) {
        if (convertedStr[left] !== converted[right]) {
            return false;
        }
        left++;
        right--;
    }
    return false;
}
```