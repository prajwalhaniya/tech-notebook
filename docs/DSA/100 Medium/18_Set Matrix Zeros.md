---
sidebar_position: 17
---

```js
/**
 * @param {number[][]} matrix
 * @return {void} Do not return anything, modify matrix in-place instead.
 */
var setZeroes = function(matrix) {    
    if (!matrix || matrix.length == 0 || matrix[0].length == 0) {
        return;
    }

    const rows = matrix.length;
    const cols = matrix[0].length;

    const zeroRows = new Set();
    const zeroCols = new Set();

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (matrix[i][j] === 0) {
                zeroRows.add(i);
                zeroCols.add(j);
            }
        }
    }


    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (zeroRows.has(i) || zeroCols.has(j)) {
                matrix[i][j] = 0;
            }
        }
    }


};
```