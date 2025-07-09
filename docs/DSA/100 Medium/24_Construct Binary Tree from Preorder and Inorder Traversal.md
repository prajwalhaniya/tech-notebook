---
sidebar_position: 24
---

Given two integer arrays preorder and inorder where preorder is the preorder traversal of a binary tree and inorder is the inorder traversal of the same tree, construct and return the binary tree.


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
 * @param {number[]} preorder
 * @param {number[]} inorder
 * @return {TreeNode}
 */
var buildTree = function(preorder, inorder) {
    const inorderMap = {};
    inorder.forEach((value, index) => {
        inorderMap[value] = index;
    });

    let preorderIndex = 0;

    const arrayToTree = (left, right) => {
        if (left > right) return null;

        const rootValue = preorder[preorderIndex++];
        const root = new TreeNode(rootValue);

        root.left = arrayToTree(left, inorderMap[rootValue] - 1);
        root.right = arrayToTree(inorderMap[rootValue] + 1, right);

        return root;
    }

    return arrayToTree(0, inorder.length - 1);
};
```