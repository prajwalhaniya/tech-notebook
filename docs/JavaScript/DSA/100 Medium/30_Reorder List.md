---
sidebar_position: 30
---

`Problem statement`

You are given the head of a singly linked-list. The list can be represented as:

L0 → L1 → … → Ln - 1 → Ln
Reorder the list to be on the following form:

L0 → Ln → L1 → Ln - 1 → L2 → Ln - 2 → …
You may not modify the values in the list's nodes. Only nodes themselves may be changed.


```js
/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
/**
 * @param {ListNode} head
 * @return {void} Do not return anything, modify head in-place instead.
 */
var reorderList = function(head) {
    if (!head || !head.next) {
        return;
    }

    const nodes = [];
    let current = head;

    while (current) {
        nodes.push(current);
        current = current.next;
    }

    let i = 0;
    let j = nodes.length - 1;

    while (i < j) {
        nodes[i].next = nodes[j];
        i++;

        if (i == j) break;

        nodes[j].next = nodes[i];
        j--;
    }

    nodes[i].next = null;
};
```