---
sidebar_position: 6
---
You are given a string s, which contains stars *.

In one operation, you can:

Choose a star in s.
Remove the closest non-star character to its left, as well as remove the star itself. Return the string after all stars have been removed.

Note:

The input will be generated such that the operation is always possible. It can be shown that the resulting string will always be unique.

Input: s = `leet**cod*e`

Output: "lecoe"

```js
var removeStars = function(s) {
    const result = [];
    for (const char of s) {
        if (char === '*') {
            if (result.length > 0) {
                result.pop();
            }
        } else {
            result.push(char);
        }
    }
    return result.join('')
};

```