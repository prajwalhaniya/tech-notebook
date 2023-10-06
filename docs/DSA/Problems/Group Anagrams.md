---
sidebar_position: 29
---
Given an array of strings strs, group the anagrams together. You can return the answer in any order.

An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

```js
/**
 * @param {string[]} strs
 * @return {string[][]}
 */
var groupAnagrams = function(strs) {
    const anagramGroup = new Map();

    for (let i = 0; i < strs.length; i++) {
        const sortedString = strs[i].split('').sort().join('');

        if (!anagramGroup.has(sortedString)) {
            anagramGroup.set(sortedString, [strs[i]]);
        } else {
            anagramGroup.get(sortedString).push(strs[i]);
        }
    }

    const result = Array.from(anagramGroup.values());
    return result;
};
/*
* Input: ["eat","tea","tan","ate","nat","bat"]
* Output: [["eat","tea","ate"],["tan","nat"],["bat"]]
*/
```

