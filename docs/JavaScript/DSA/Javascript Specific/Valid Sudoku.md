---
sidebar_position: 28
---
Determine if a 9 x 9 Sudoku board is valid. Only the filled cells need to be validated according to the following rules:

Each row must contain the digits 1-9 without repetition.
Each column must contain the digits 1-9 without repetition.
Each of the nine 3 x 3 sub-boxes of the grid must contain the digits 1-9 without repetition.

Note:
- A Sudoku board (partially filled) could be valid but is not necessarily solvable.
- Only the filled cells need to be validated according to the mentioned rules.

```js
var isValidSudoku = function(board) {
    const rows = new Array(9).fill(null).map(() => new Set());
    const columns = new Array(9).fill(null).map(() => new Set());
    const boxes = new Array(9).fill(null).map(() => new Set());

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[0].length; col++) {
            const cell = board[row][col];
            if (cell === '.') {
                continue;
            }
            const boxIndex = Math.floor(col / 3) * 3 + Math.floor(row / 3);
            if (rows[row].has(cell) || columns[col].has(cell) || boxes[boxIndex].has(cell)) return false;
            rows[row].add(cell);
            columns[col].add(cell);
            boxes[boxIndex].add(cell);
        }
    }
    return true;
};
```

