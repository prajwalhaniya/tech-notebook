---
sidebar_position: 31
---

`Problem statement`

Given the head of a linked list, rotate the list to the right by k places.


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
 * @param {number} k
 * @return {ListNode}
 */
var rotateRight = function(head, k) {
    if (!head || !head.next || k === 0) return head;

    let length = 1;
    let tail = head;

    while (tail.next) {
        tail = tail.next;
        length++;
    }  

    k = k % length;
    
    if (k === 0) return head;

    let newTail = head;

    for (let i = 0; i < length - k - 1; i++) {
        newTail = newTail.next;
    }

    const newHead = newTail.next;
    newTail.next = null;
    tail.next = head;

    return newHead;
};
```
