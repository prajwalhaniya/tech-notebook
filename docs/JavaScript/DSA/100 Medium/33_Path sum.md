---
sidebar_position: 33
---
Given the root of a binary tree and an integer targetSum, return all root-to-leaf paths where the sum of the node values in the path equals targetSum. Each path should be returned as a list of the node values, not node references.

A root-to-leaf path is a path starting from the root and ending at any leaf node. A leaf is a node with no children.

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
 * @param {number} targetSum
 * @return {number[][]}
 */
var pathSum = function(root, targetSum) {
    const result = [];

    function dfs(node, currentPath, currentSum) {
        if (!node) {
            return;
        }

        currentPath.push(node.val);
        currentSum += node.val;

        if (!node.left && !node.right) {
            if (currentSum == targetSum) {
                result.push([...currentPath]);
            }
        } else {
            dfs(node.left, currentPath, currentSum);
            dfs(node.right, currentPath, currentSum);
        }

        currentPath.pop();
    }

    dfs(root, [], 0);
    return result;
};
```