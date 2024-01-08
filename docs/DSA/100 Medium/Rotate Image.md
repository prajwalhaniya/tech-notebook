---
sidebar_position: 3
---
You are given an n x n 2D matrix representing an image, rotate the image by 90 degrees (clockwise).

You have to rotate the image in-place, which means you have to modify the input 2D matrix directly. DO NOT allocate another 2D matrix and do the rotation.

Input: matrix = [[1,2,3],[4,5,6],[7,8,9]]
Output: [[7,4,1],[8,5,2],[9,6,3]]

```js
const rotate = function(arr) {
    // as n x n matrix is given
    let numberOfRows = arr.length;
    let numberOfColumns = numberOfRows;

    // Transpose of the matrix
    for (let i = 0; i < numberOfRows; i++) {
        for (let j = i; j < numberOfColumns; j++) {
            let temp = arr[i][j];
            arr[i][j] = arr[j][i];
            arr[j][i] = temp;
        }
    }

    // swap the first & last element
    for (let i = 0; i < numberOfRows; i++) {
        for (let j = 0; j < parseInt(numberOfColumns/2); j++) {
            let temp =  arr[i][j];
            arr[i][j] = arr[i][arr[0].length - j - 1];
            arr[i][arr[0].length - j - 1] = temp;
        }
    }

    return arr;
};
```