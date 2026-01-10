---
sidebar_position: 19
---

Before moving ahead let us understand what is binary search tree?

A binary search tree (BST) is a specialized type of binary tree data structure that enables efficient searching, insertion, and deletion of elements. In a BST:

Each node has up to two children. For every node:

- All values in its left subtree are less than the node's value.
- All values in its right subtree are greater than the node's value.
- Both left and right subtrees must themselves be binary search trees

`Problem Statement`

Given the root of a binary tree, determine if it is a valid binary search tree (BST).

A valid BST is defined as follows:

- The left subtree of a node contains only nodes with keys less than the node's key.
- The right subtree of a node contains only nodes with keys greater than the node's key.
- Both the left and right subtrees must also be binary search trees.

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
 * @return {boolean}
 */

var isValidBST = function(root) {
    function validate(node, min, max) {
        if (!node) return true;

        if ((min !== null && node.val <= min) || (max !== null && node.val >= max)) {
            return false;
        }

        return validate(node.left, min, node.val) && validate(node.right, node.val, max);
    }

    return validate(root, null, null);
};

```
