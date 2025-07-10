---
sidebar_position: 21
---
Given the head of a singly linked list, reverse the list, and return the reversed list.

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
var reverseList = function(head) {
    let prev = null;
    let current = head;

    while (current !== null) {
        const nextTemp = current.next;
        current.next = prev;
        prev = current;
        current = nextTemp;
    }

    return prev;
};
```

`Recursive solution`

```js
function reverseList(head) {
    if (head === null || head.next === null) {
        return head;
    }
    
    const reversedListHead = reverseList(head.next);
    
    head.next.next = head;
    head.next = null;
    
    return reversedListHead;
}
```