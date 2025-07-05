---
sidebar_position: 7
---
You are given the heads of two sorted linked lists list1 and list2.

Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists.

Return the head of the merged linked list.

```js
class newListNode {
    constructor(val, next) {
        this.val = val;
        this.next = next;
    }
}

var mergeTwoLists = function(list1, list2) {
    let newMergedList = new newListNode();
    let current = newMergedList;

    while (list1 !== null && list2 !== null) {
        if (list1.val < list2.val) {
            current.next = list1;
            list1 = list1.next;
        } else {
            current.next = list2;
            list2 = list2.next;
        }
        current = current.next;
    }

    if (list1 !== null) {
        current.next = list1;
    } else {
        current.next = list2;
    }

    return newMergedList.next;
};
```