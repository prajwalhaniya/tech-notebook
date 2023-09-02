---
sidebar_position: 1
---
### Time complexities

Big O is the metric that we use to describe the efficiency of algorithms.

Big O determines the upper bound of the time. Ω (Big Omega) describes the lower bound. Θ (Big theta) means both O and Ω. Θ Gives a tight bound on runtime. What do you mean by the upper bound of the time complexity of an algorithm? That means we are referring to the maximum amount of time that the algorithm will take to execute, given a specific input size. In other words, it represents the worst-case scenario for the algorithm’s runtime.

For example, if an algorithm has a time complexity of O(n^2), it means that the runtime of the algorithm grows quadratically with the input size (n). Big O just describes the rate of increase.

```
// O(m + n)
for (let i...) {
    console.log(i);
}

for (let j...) {
    console.log(j);
}

// O (m * n) || O(n^2) when both have same  
for ( let i...) {
    for (let j...) {
        console.log(i, j)
    }
}
```

`O(m * n)`: Represents an algorithm that has nested loops, where the outer loop iterates ’m' times and the inner loop iterates ‘n’ times.

O (n ^ 2): Represents an algorithm that has a single loop iterating ‘n’ times nested within another loop iterating ‘n’ times.

`O(m * n)`: indicates that the runtime of the algorithm depends on both ’m' and ‘n’, so the rate of growth can vary depending on the relative sizes of ’m' and ‘n’. O(n^2), on the other hand, indicates a quadratic growth rate, meaning the runtime increases significantly as ‘n’ increases

You typically encounter logarithmic O(log n) run times when dealing with algorithms that have a `divide-and-conquer` or `binary search` nature. Logarithmic time complexities often arise when the input size is halved or divided by a constant factor at each step of the algorithm.

O(√n): indicates that the algorithm’s runtime increases proportionally to the square root of the input size. As ‘n’ increases, the runtime grows slower than linear time complexity (O(n)), but faster than logarithmic time complexity (O(log n)).

| **Algorithm** | **Best** | **Average** | **Worst** |
| --- | --- | --- | --- |
| Linear Search | O(1) | O(n) | O(n) |
| Binary Search | O(log n) | O(log n) | O(log n) |
| Jump Search | O(√n) | O(√n) | O(n) |
| Interpolation Search | O(log n) | O(log n) | O(n) |


| Algorithm | Time Complexity: Best | Time Complexity: Average | Time Complexity: Worst |
| --- | --- | --- | --- |
| Bubble sort | O(n) | O(n^2) | O(n^2) |
| Selection sort | O(n^2) | O(n^2) | O(n^2) |
| Insertion sort | O(n) | O(n^2) | O(n^2) |
| Merge sort | O(n log(n)) | O(n log(n)) | O(n log(n)) |
| Quick sort | O(n log(n)) | O(n log(n)) | O(n^2) |
| Heap sort | O(n log(n)) | O(n log(n)) | O(n log(n)) |

---

> Some of the fundamental data structures are as follows

### Array

JavaScript arrays are resizeable and can contain a mix of different data types. You can create an array using the array literal notation `[]` or the `Array constructor`:

```js
// Using array literal notation
let fruits = ['apple', 'banana', 'cherry'];

// Using the Array constructor
let colors = new Array('red', 'green', 'blue');
```

### Linked List

A linked list is a data strucuture that represents a sequence of nodes. In a singly linked list, each node points to the next node in the linked list. A doubly linked list gives each node pointers to both the next node and the previous node.

You can implement a linked list using the below code

```js
class Node {
    constructor(data) {
        // The data stored in the node
        this.data = data;
        // Reference to the next node in the linked list
        this.next = null;
    }
}

class LinkedList {
    constructor() {
    // initially head has null
        this.head = null;
    }

    isEmpty() {
        // returns boolean true or false
        return this.head === null;
    }

    insertAtHead(data) {
        const newNode = new Node(data);
        newNode.next = this.head;
        // initialise head with the new node that is created
        this.head = newNode;
    }

    insertAtTail(data) {
        const newNode = new Node(data);
        // Check list is empty
        if (this.isEmpty()) {
            this.head = newNode;
        }
        
        let current = this.head;
        // loop through the list
        while(current.next !== null) {
            current = current.next;
        }
        // if you encounter the node with .next == null add newNode

        current.next = newNode;
    }

    deleteAtHead() {
        // similar to inserting at head
        if (this.isEmpty()) {
            return "No nodes to delete";
        }
        const removedNode = this.head;
        this.head = this.head.next;
        return removedNode.data;
    }

    deleteAtTail() {
        // similar to insert at tail
        if (this.isEmpty()) {
            return "No nodes to delete"
        }
        let currentNode = this.head;
        while(currentNode.next.next !== null) {
            currentNode = currentNode.next;
        }
        currentNode.next = currentNode.next.next; 
        return "Node deleted at tail"
    }
}
```

### Stack

A stack is an application of an array. It is just a stack of data. It uses `LIFO` (Last In First Out) principle. Eg: Stack of plates. The most recent item that will be added to the stack is the first to be removed.

```js
class Stack {
  constructor() {
    this.items = [];
  }

  // Push an element onto the stack
  push(element) {
    this.items.push(element);
  }

  // Pop the top element from the stack and return it
  pop() {
    if (this.items.length === 0) {
      return 'stack is empty';
    }
    return this.items.pop();
  }
}
const myStack = new Stack();

myStack.push(10);
myStack.push(20);
myStack.push(30);

console.log(myStack.pop());

```

### Queue
Similar to stack, Queue is also an application of array. But, it follows `FIFO` (First In First Out) Principle. 

A queue is super important for many software applications. Because, that is how we keep track of failed payments, bookings etc and retry them based on the data in the queue, else will have a serious impact in our day to day life because who orders first must recieve the product first. 

Eg: If you are first to request for a ticket then you must be given first priority than other person who requested the ticket after you. 

```js
class Queue {
  constructor() {
    this.items = [];
  }

  // Add an element to the rear of the queue
  enqueue(element) {
    this.items.push(element);
  }

  // Remove and return the front element from the queue
  dequeue() {
    if (this.items.lenght === 0) {
      return undefined; // Queue is empty
    }
    return this.items.shift();
  }
}

const myQueue = new Queue();

myQueue.enqueue(10);
myQueue.enqueue(20);
myQueue.enqueue(30);

console.log(myQueue.dequeue());
```

### Trees & Graphs

The `Trees & Graphs` belong to the non-linear data structures. 

A `tree` is data structure composed of nodes. 
- Each tree has a root node
- The root node has 0 or more child nodes
- Each child node has zero or more child nodes & so on
- The trees cannot contain cycle

A tree is a `graph`, but not all graphs are trees. A tree is a connected graph without cycles.
- Graphs can be either directed or undirected
- A graph can have cycles

> There are many concepts that is related to trees & graphs. So will be explaining them in their respective sections.



