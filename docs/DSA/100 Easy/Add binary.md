---
sidebar_position: 8
---
Given two binary strings a and b, return their sum as a binary string.
Input: a = "11", b = "1"
Output: "100"

```js
var addBinary = function(a, b) {
    let carry = 0;
    let result = "";

    while (a.length < b.length) {
        a = "0" + a;
    }

    while (b.length < a.length) {
        b = "0" + b;
    }

    for (let i = a.length - 1; i >= 0; i--) {
        const bitA = parseInt(a[i]);
        const bitB = parseInt(b[i]);

        const sum = bitA + bitB + carry;
        result = (sum % 2) + result;
        carry = Math.floor(sum / 2);
    }

    if (carry > 0) {
        result = carry + result;
    }

    return result;
};

```