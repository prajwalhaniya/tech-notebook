---
sidebar_position: 32
---

`Problem Statement`

Given the head of a linked list, return the list after sorting it in ascending order.

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
var sortList = function(head) {
    if (!head || !head.next) {
        return head;
    }

    const [left, right] = splitList(head);

    const sortedLeft = sortList(left);
    const sortedRight = sortList(right);

    return merge(sortedLeft, sortedRight);
};


function splitList(head) {
    let slow = head;
    let fast = head;
    let prev = null;

    while (fast && fast.next) {
        prev = slow;
        slow = slow.next;
        fast = fast.next.next;
    }

    if (prev) {
        prev.next = null;
    }

    return [head, slow];
}

function merge(l1, l2) {
    const dummy = new ListNode();
    let current = dummy;

    while (l1 && l2) {
        if (l1.val < l2.val) {
            current.next = l1;
            l1 = l1.next;
        } else {
            current.next = l2;
            l2 = l2.next;
        }

        current = current.next;
    }

    current.next = l1 || l2;

    return dummy.next;
}

```


