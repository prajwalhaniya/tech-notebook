---
sidebar_position: 20
---

`Problem statement`

Given the root of a binary search tree, and an integer k, return the kth smallest value (1-indexed) of all the values of the nodes in the tree.

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
 * @param {number} k
 * @return {number}
 */
var kthSmallest = function(root, k) {
    const stack = [];
    let current = root;
    let count = 0;

    while (current !== null || stack.length > 0) {
        while (current !== null) {
            stack.push(current);
            current = current.left;
        }

        current = stack.pop();
        count++;

        if (count == k) {
            return current.val;
        }

        current = current.right;
    }

    return -1;
};

```

`Explanation`

- Initialization: We start with an empty stack and set current to the root of the BST.

- Left Traversal: We traverse as far left as possible from the current node, pushing each node onto the stack. This ensures that we process nodes in ascending order.

- Node Processing: After reaching the leftmost node, we pop it from the stack (which is the next smallest element), increment our count, and check if it's the kth element. If it is, we return its value immediately.

- Right Subtree: After processing the left and the current node, we move to the right subtree to continue the in-order traversal.

- Early Termination: The loop terminates as soon as we find the kth smallest element, making this approach efficient with a time complexity of O(H + k), where H is the height of the tree. In the worst case (skewed tree), this is O(n), but on average, it's O(log n + k).

This method efficiently finds the kth smallest element by leveraging the BST property and iterative in-order traversal with early termination.

