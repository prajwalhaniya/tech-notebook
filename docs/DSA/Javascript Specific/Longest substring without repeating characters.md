---
sidebar_position: 27
---
Given a string s, find the length of the longest substring without repeating characters.

```js
var lengthOfLongestSubstring = function(s) {
    let maxLength = 0;
    let left = 0;
    const charIndexMap = {};

    for (let right = 0; right < s.length; right++) {
        const currentChar = s[right];

        if (charIndexMap[currentChar] !== undefined && charIndexMap[currentChar] >= left) {
            left = charIndexMap[currentChar] + 1;
        }

        charIndexMap[currentChar] = right;
        const currentLength = right - left + 1;
        maxLength = Math.max(maxLength, currentLength);
    }
    return maxLength;
};
```