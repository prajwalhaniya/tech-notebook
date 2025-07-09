---
sidebar_position: 21
---

Level order traversal is a method of visiting all nodes in a binary tree level by level, from top to bottom and left to right within each level. It's also known as Breadth-First Search (BFS) for trees.


### How it works?

- Start at the root node (level 0)
- Visit all nodes at the current level before moving to the next level
- Within each level, nodes are visited from left to right


```
        A
       / \
      B   C
     / \   \
    D   E   F
```

The level order traversal would be: A, B, C, D, E, F


`Problem Statement`
Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).

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
 * @return {number[][]}
 */
var levelOrder = function(root) {
    if (!root) return [];

    const result = [];
    const queue = [root];

    while (queue.length > 0) {
        const levelSize = queue.length;
        const currentLevel = [];

        for (let i = 0; i < levelSize; i++) {
            const node = queue.shift();
            currentLevel.push(node.val);

            if (node.left) queue.push(node.left);
            if (node.right) queue.push(node.right);
        }

        result.push(currentLevel);
    }

    return result;
};

```

`Explanation`

1. Initialization:
    - If the tree is empty (root === null), return an empty array.
    - Initialize a result array to store the levels and a queue with the root node.

2. BFS Traversal
    - While the queue is not empty:
        - Get the current level's size (number of nodes at this level).
        - Initialize a currentLevel array to store node values for this level.
        - Process each node in the current level:
            - Remove the node from the queue (shift).
            - Add its value to currentLevel.
            - Enqueue its left and right children (if they exist).
        - Push currentLevel into result.

3. Return result
    - After processing all levels, return result.


