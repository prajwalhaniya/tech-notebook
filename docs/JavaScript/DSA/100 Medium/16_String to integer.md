---
sidebar_position: 16
---

`Problem statement`

Implement the myAtoi(string s) function, which converts a string to a 32-bit signed integer.

The algorithm for myAtoi(string s) is as follows:

- Whitespace: Ignore any leading whitespace (" ").
- Signedness: Determine the sign by checking if the next character is '-' or '+', assuming positivity if neither present.
- Conversion: Read the integer by skipping leading zeros until a non-digit character is encountered or the end of the string is reached. If no digits were read, then the result is 0.
- Rounding: If the integer is out of the 32-bit signed integer range [-2^31, 2^31 - 1], then round the integer to remain in the range. Specifically, integers less than -2^31 should be rounded to -2^31, and integers greater than 2^31 - 1 should be rounded to 2^31 - 1.

Return the integer as the final result.

```js
/**
 * @param {string} s
 * @return {number}
 */
var myAtoi = function(s) {
    let index = 0;
    const n = s.length;
    let sign = 1;
    let result = 0;

    while (index < n && s[index] === " ") {
        index++;
    }

    if (index < n && (s[index] === "+" || s[index] === "-")) {
        sign = s[index] === "-" ? -1 : 1;
        index++;
    }

    while (index < n && s[index] >= "0" && s[index] <= "9") {
        const digit = s.charCodeAt(index) - "0".charCodeAt(0);

        if (result > Math.floor((2**31 - 1 - digit) / 10)) {
            return sign === 1 ? 2**31 - 1 : -(2**31);
        }

        result = result * 10 + digit;
        index++;
    }

    return sign * result;

    
};
```

### Explanation


1. Initial Step

```js
let index = 0;
const n = s.length;
let sign = 1;
let result = 0;
```

- index → Tracks the current position in the string.
- n → Stores the length of the input string s.
- sign → Determines if the number is positive (1) or negative (-1). Defaults to 1.
- result → Stores the final integer being constructed.

2. Skip leading white spaces

```js
while (index < n && s[index] === ' ') {
    index++;
}
```

- Moves index forward while the current character is a space (' ').
- Example: " 42" → Skips 3 spaces, starts at '4'.

3. Handle option sign

```js
if (index < n && (s[index] === '+' || s[index] === '-')) {
    sign = s[index] === '-' ? -1 : 1;
    index++;
}
```

- Checks for + or - at the current position.
    - If '-', sets sign = -1.
    - If '+', keeps sign = 1.
- Moves index forward to skip the sign.
- Example: "-42" → sign = -1, index moves to '4'.

4. Skip leading zeros

```js
while (index < n && s[index] === '0') {
    index++;
}
```

- Moves index past leading zeros (e.g., "0042" → starts at '4').

5. Read digits and handle overflow


```js
while (index < n && s[index] >= '0' && s[index] <= '9') {
    const digit = s.charCodeAt(index) - '0'.charCodeAt(0);
    if (result > Math.floor((2**31 - 1 - digit) / 10)) {
        return sign === 1 ? 2**31 - 1 : -(2**31);
    }
    result = result * 10 + digit;
    index++;
}
```

- Digit Conversion:
    s.charCodeAt(index) - '0'.charCodeAt(0) converts ASCII to integer (e.g., '5' → 5).

- Overflow Check:
    - Before updating result, checks if the next digit would exceed 32-bit limits:
    - Positive Overflow (> 2³¹ - 1) → Returns 2147483647.
    - Negative Overflow (< -2³¹) → Returns -2147483648.

- Update Result:
    result = result * 10 + digit appends the digit (e.g., 4 → 42).
    Example: "2147483648" → Returns 2147483647 (overflow).
