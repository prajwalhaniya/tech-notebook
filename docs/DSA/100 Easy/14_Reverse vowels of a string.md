---
sidebar_position: 14
---
Given a string s, reverse only all the vowels in the string and return it.

The vowels are 'a', 'e', 'i', 'o', and 'u', and they can appear in both lower and upper cases, more than once.

 

Example 1:

Input: s = "hello"

Output: "holle"

```js
/**
 * @param {string} s
 * @return {string}
 */
var reverseVowels = function(s) {
    const vowels = ['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U'];
    let chars = s.split('');
    let left = 0;
    let right = chars.length - 1;

    while (left < right) {
        while (left < right && !vowels.includes(chars[left])) {
            left++;
        }

        while (left < right && !vowels.includes(chars[right])) {
            right--;
        }

        [chars[left], chars[right]] = [chars[right], chars[left]];
        left++;
        right--;
    }
    return chars.join('');
};
```
