---
sidebar_position: 14
---
For two strings s and t, we say "t divides s" if and only if s = t + ... + t (i.e., t is concatenated with itself one or more times).

Given two strings str1 and str2, return the largest string x such that x divides both str1 and str2.

Input: str1 = "ABCABC", str2 = "ABC"

Output: "ABC"

```js
/**
 * @param {string} str1
 * @param {string} str2
 * @return {string}
 */
var gcdOfStrings = function(str1, str2) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

    const len1 = str1.length;
    const len2 = str2.length;

    const gcdLength = gcd(len1, len2);

    const candidate = str1.substring(0, gcdLength);

    if (candidate.repeat(len1 / gcdLength) === str1 && candidate.repeat(len2 / gcdLength) === str2) {
        return candidate;
    } else {
        return "";
    }
};
```
