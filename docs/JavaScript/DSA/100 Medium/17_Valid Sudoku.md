---
sidebar_position: 17
---

```js
/**
 * @param {character[][]} board
 * @return {boolean}
 */
var isValidSudoku = function(board) {
    const rows = new Array(9).fill().map(() => new Set());
    const columns = new Array(9).fill().map(() => new Set());
    const boxes = new Array(9).fill().map(() => new Set());

    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            const num = board[i][j];
            if (num === ".") continue;

            if (rows[i].has(num)) return false;
            rows[i].add(num);

            if (columns[j].has(num)) return false;
            columns[j].add(num);

            const boxIndex = Math.floor(i / 3) * 3 + Math.floor(j / 3);
            if (boxes[boxIndex].has(num)) return false;
            boxes[boxIndex].add(num);
        }
    }

    return true;
};
```

### Explanation:

- Initialization: We create three arrays of Sets to track the numbers we've seen in each row, column, and 3x3 sub-box.
- Nested Loop: We iterate through each cell in the 9x9 grid.
- Empty Cells: If the cell is empty (contains '.'), we skip it.
- Row Check: For each number, we check if it already exists in the current row's Set. If it does, the board is invalid.
- Column Check: Similarly, we check if the number exists in the current column's Set.
- Sub-box Check: We calculate which 3x3 sub-box the cell belongs to (boxIndex) and check if the number exists in that sub-box's Set.
- Validation: If all checks pass for all cells, the board is valid.
- The boxIndex calculation Math.floor(i / 3) * 3 + Math.floor(j / 3) maps the (i,j) cell position to a sub-box index from 0 to 8, left to right and top to bottom.

This solution efficiently checks all three Sudoku validity conditions in O(1) space per cell (since the board size is fixed) and O(n²) time where n is the board size (9x9).