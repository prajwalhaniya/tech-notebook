---
sidebar_position: 34
---
Given the root of a binary tree, return the maximum width of the given tree.

The maximum width of a tree is the maximum width among all levels.

The width of one level is defined as the length between the end-nodes (the leftmost and rightmost non-null nodes), where the null nodes between the end-nodes that would be present in a complete binary tree extending down to that level are also counted into the length calculation.

It is guaranteed that the answer will in the range of a 32-bit signed integer.

```js
/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} root
 * @return {number}
 */
var widthOfBinaryTree = function(root) {
    if (!root) return 0;
    
    let maxWidth = 0;
    const queue = [{ node: root, pos: 0 }];
    
    while (queue.length > 0) {
        const levelSize = queue.length;
        const levelMinPos = queue[0].pos;
        let leftmostPos = 0;
        let rightmostPos = 0;
        
        for (let i = 0; i < levelSize; i++) {
            const { node, pos } = queue.shift();
            const adjustedPos = pos - levelMinPos;
            
            if (i === 0) leftmostPos = adjustedPos;
            if (i === levelSize - 1) rightmostPos = adjustedPos;
            
            if (node.left) {
                queue.push({ node: node.left, pos: 2 * adjustedPos + 1 });
            }
            if (node.right) {
                queue.push({ node: node.right, pos: 2 * adjustedPos + 2 });
            }
        }
        
        const currentWidth = rightmostPos - leftmostPos + 1;
        maxWidth = Math.max(maxWidth, currentWidth);
    }
    
    return maxWidth;
};
```