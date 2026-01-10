---
sidebar_position: 21
---
The string "PAYPALISHIRING" is written in a zigzag pattern on a given number of rows like this: (you may want to display this pattern in a fixed font for better legibility)

P   A   H   N
A P L S I I G
Y   I   R

And then read line by line: "PAHNAPLSIIGYIR"

Write the code that will take a string and make this conversion given a number of rows:

string convert(string s, int numRows);

```js
function convert(s, numRows) {
    if (numRows === 1) {
        return s;
    }

    const rows = new Array(numRows).fill('');
    let currentRow = 0;
    let direction = 1;

    for (let i = 0; i < s.length; i++) {
        rows[currentRow] += s[i];
        if (currentRow === 0) direction = 1;
        if (currentRow === numRows - 1) direction = -1;
        currentRow += direction;
    }

    return rows.join('');
}

```