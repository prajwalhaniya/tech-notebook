---
sidebar_position: 25
---

`Problem statement`
Given two strings s and p, return an array of all the start indices of p's anagrams in s. You may return the answer in any order.

`Example`
Input: s = "abab", p = "ab"
Output: [0,1,2]

Explanation:

The substring with start index = 0 is "ab", which is an anagram of "ab".
The substring with start index = 1 is "ba", which is an anagram of "ab".
The substring with start index = 2 is "ab", which is an anagram of "ab".


```js
/**
 * @param {string} s
 * @param {string} p
 * @return {number[]}
 */
var findAnagrams = function(s, p) {
    const result = [];

    if (s.length < p.length) {
        return result;
    }

    const pCount = new Array(26).fill(0);
    const sCount = new Array(26).fill(0);

    for (let i = 0; i < p.length; i++) {
        pCount[p.charCodeAt(i) - 'a'.charCodeAt(0)]++;
        sCount[s.charCodeAt(i) - 'a'.charCodeAt(0)]++;
    }

    if (arraysEqual(pCount, sCount)) {
        result.push(0);
    }

    for (let i = p.length; i < s.length; i++) {
        sCount[s.charCodeAt(i - p.length) - 'a'.charCodeAt(0)]--;
        sCount[s.charCodeAt(i) - 'a'.charCodeAt(0)]++;

        if (arraysEqual(pCount, sCount)) {
            result.push(i - p.length + 1);
        }
    }

    return result;
};

function arraysEqual(arr1, arr2) {
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
}
```