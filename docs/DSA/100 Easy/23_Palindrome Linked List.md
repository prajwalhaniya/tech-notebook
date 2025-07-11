---
sidebar_position: 21
---
Given the head of a singly linked list, return true if it is a palindrome or false otherwise.

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
 * @return {boolean}
 */
var isPalindrome = function(head) {
    if (!head || !head.next) return true;

    let stack = [];
    let current = head;

    while (current) {
        stack.push(current.val);
        current = current.next;
    }

    current = head;

    while (current) {
        if (current.val !== stack.pop()) {
            return false;
        }

        current = current.next;
    }

    return true;
};
```