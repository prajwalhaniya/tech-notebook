---
sidebar_postion: 13
---

You are given the head of a linked list. Delete the middle node, and return the head of the modified linked list.

The middle node of a linked list of size n is the ⌊n / 2⌋th node from the start using 0-based indexing, where ⌊x⌋ denotes the largest integer less than or equal to x.

For n = 1, 2, 3, 4, and 5, the middle nodes are 0, 1, 1, 2, and 2, respectively.

Input: head = [1,3,4,7,1,2,6]
Output: [1,3,4,1,2,6]

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
 * @return {ListNode}
 */
var deleteMiddle = function(head) {
    let slowPointer = head;
    let fastPointer = head;
    let previousPointer = null;

    while (fastPointer && fastPointer.next) {
        previousPointer = slowPointer;
        slowPointer = slowPointer.next;
        fastPointer = fastPointer.next.next;
    }

    if (previousPointer) {
        previousPointer.next = slowPointer.next;
    } else {
        head = slowPointer.next;
    }

    return head;
};
```