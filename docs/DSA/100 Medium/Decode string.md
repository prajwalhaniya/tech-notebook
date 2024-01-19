---
sidebar_position: 10
---
Given an encoded string, return its decoded string.

Examples:

Input: s = "3[a]2[bc]"

Output: "aaabcbc"

Input: s = "3[a2[c]]"

Output: "accaccacc"

Input: s = "2[abc]3[cd]ef"

Output: "abcabccdcdcdef"

```js
/**
 * @param {string} s
 * @return {string}
 */
var decodeString = function(s) {
    let stack = [];
    let currentNum = 0;
    let currentStr = '';

    for (let char of s) {
        if (char >= '0' && char <= '9') {
            currentNum = currentNum * 10 + parseInt(char);
        } else if (char === '[') {
            stack.push(currentNum);
            stack.push(currentStr);

            currentNum = 0;
            currentStr = '';
        } else if (char === ']') {
            let prevStr = stack.pop();
            let prevNum = stack.pop();
            currentStr = prevStr + currentStr.repeat(prevNum);
        } else {
            currentStr += char;
        }
    }
    return currentStr;
};
```
