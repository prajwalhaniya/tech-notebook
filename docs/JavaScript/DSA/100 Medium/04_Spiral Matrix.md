---
sidebar_position: 4
---
Given an m x n matrix, return all elements of the matrix in spiral order.

```js
/**
 * @param {number[][]} matrix
 * @return {number[]}
 */
var spiralOrder = function(matrix) {
    const result = [];

    while (matrix.length > 0) {
        result.push(...matrix.shift());

        for (let row of matrix) {
            if (row.length > 0) {
                result.push(row.pop());
            }
        }

        if (matrix.length > 0) {
            result.push(...matrix.pop().reverse());
        }

        for (let i = matrix.length - 1; i >= 0; i--) {
            if (matrix[i].length > 0) {
                result.push(matrix[i].shift())
            }
        }
    }
    return result;
};
```