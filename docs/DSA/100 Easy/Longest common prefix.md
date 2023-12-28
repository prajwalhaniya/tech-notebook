---
sidebar_position: 5
---
Write a function to find the longest common prefix string amongst an array of strings.

If there is no common prefix, return an empty string "".

Example 1:

Input: strs = ["flower","flow","flight"]
Output: "fl"

```js
const longestCommonPrefix = function(strs) {
    if (!strs.length) {
        return "";
    }

    let prefix = strs[0];

    for (let i = 1; i < strs.length; i++) {
        let j = 0;
        while (j < prefix.length && j < strs[i].length && prefix[j] === strs[i][j]) {
            j++;
        }
        prefix = prefix.slice(0, j);
        if (prefix === "") {
            break;
        }
    }
    return prefix;
};
```

