---
sidebar_position: 6
---
Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:

- Open brackets must be closed by the same type of brackets.
- Open brackets must be closed in the correct order.
- Every close bracket has a corresponding open bracket of the same type.

Input: s = "()"
Output: true

Input: s = "()[]{}"
Output: true

```js
const isValid =  function(s) {
    const stack = [];
    const parenthesisMap = {
        '(' : ')',
        '{' : '}',
        '[' : ']'
    }

    for (let char of s) {
        if (char in parenthesisMap) {
            stack.push(char);
        } else {
            const top = stack.pop();
            if (parenthesisMap[top] !== char) {
                return false;
            }
        }
    }
    return stack.length === 0;
};
```