---
sidebar_position: 2
---
Given a string s, find the length of the longest substring without repeating characters.

```js
var lengthOfLongestSubstring = function(s) {
    let maxLength = 0;
    let left = 0;
    const charIndexMap = {};

    for (let char = 0; char < s.length; right++) {
        const currentChar = s[char];

        if (charIndexMap[currentChar] !== undefined && charIndexMap[currentChar] >= left) {
            left = charIndexMap[currentChar] + 1;
        }

        charIndexMap[currentChar] = char;
        const currentLength = char - left + 1;
        maxLength = Math.max(maxLength, currentLength);
    }
    return maxLength;
};
```

`Dry run example`

- Initialize maxLength to 0, left to 0, and characterIndexMap to an empty object.

- Loop through each character in the input string.

- char = 0: currentChar = 'a'

    Update characterIndexMap: {'a': 0}
    Update currentLength to 1
    maxLength = 1
    
- char = 1: currentChar = 'b'

    Update characterIndexMap: {'a': 0, 'b': 1}
    Update currentLength to 2
    maxLength = 2

- char = 2: currentChar = 'c'

    Update characterIndexMap: {'a': 0, 'b': 1, 'c': 2}
    Update currentLength to 3
    maxLength = 3

- char = 3: currentChar = 'a'
    'a' is already in characterIndexMap, and its index is 0 (less than left)
    Update left to 1 (the next index after the previous 'a')
    Update characterIndexMap: {'a': 3, 'b': 1, 'c': 2}
    Update currentLength to 3
    maxLength remains 3

- char = 4: currentChar = 'b'

    'b' is already in characterIndexMap, and its index is 1 (equal to left)
    Update left to 2 (the next index after the previous 'b')
    Update characterIndexMap: {'a': 3, 'b': 4, 'c': 2}
    Update currentLength to 3
    maxLength remains 3

- char = 5: currentChar = 'c'

    'c' is already in characterIndexMap, and its index is 2 (equal to left)
    Update left to 3 (the next index after the previous 'c')
    Update characterIndexMap: {'a': 3, 'b': 4, 'c': 5}
    Update currentLength to 3
    maxLength remains 3

- char = 6: currentChar = 'b'

    'b' is already in characterIndexMap, and its index is 4 (greater than left)
    Update left to 5 (the next index after the previous 'b')
    Update characterIndexMap: {'a': 3, 'b': 6, 'c': 5}
    Update currentLength to 2
    maxLength remains 3

The loop finishes, and the function returns the final maxLength, which is 3.