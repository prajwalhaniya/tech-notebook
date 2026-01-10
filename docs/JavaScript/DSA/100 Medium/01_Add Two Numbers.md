---
sidebar_position: 1
---
You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

You may assume the two numbers do not contain any leading zero, except the number 0 itself.

```js
function ListNode(val) {
  this.val = val;
  this.next = null;
}

function addTwoNumbers(l1, l2) {
  let dummyHead = new ListNode(0);
  let current = dummyHead;
  let carry = 0;

  while (l1 !== null || l2 !== null) {
    let x = (l1 !== null) ? l1.val : 0;
    let y = (l2 !== null) ? l2.val : 0;

    let sum = x + y + carry;
    carry = Math.floor(sum / 10);

    current.next = new ListNode(sum % 10);
    current = current.next;

    if (l1 !== null) l1 = l1.next;
    if (l2 !== null) l2 = l2.next;
  }

  if (carry > 0) {
    current.next = new ListNode(carry);
  }

  return dummyHead.next;
}

```

`Dry Run Example`

```js
let l1 = new ListNode(2);
l1.next = new ListNode(4);
l1.next.next = new ListNode(3);

let l2 = new ListNode(5);
l2.next = new ListNode(6);
l2.next.next = new ListNode(4);
```

- Initial state:

    dummyHead points to a node with value 0 and current is also pointing to the same node. carry is 0.

- First iteration:

    x is 2 (from l1), y is 5 (from l2).
    sum is 2 + 5 + 0 = 7.
    carry becomes 0.
    A new node with value 7 % 10 = 7 is added to the result.

- Second iteration:

    x is 4 (from l1), y is 6 (from l2).
    sum is 4 + 6 + 0 = 10.
    carry becomes 1.
    A new node with value 10 % 10 = 0 is added to the result.

- Third iteration:

    x is 3 (from l1), y is 4 (from l2).
    sum is 3 + 4 + 1 = 8.
    carry becomes 0.
    A new node with value 8 % 10 = 8 is added to the result.
    Result:

The result linked list is [7, 0, 8], which is the reverse of the sum of 342 and 465.

