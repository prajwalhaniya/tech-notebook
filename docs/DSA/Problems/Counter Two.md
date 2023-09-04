---
sidebar_position: 13
---
Write a function createCounter. It should accept an initial integer init. It should return an object with three functions.

The three functions are:

increment() increases the current value by 1 and then returns it.
decrement() reduces the current value by 1 and then returns it.
reset() sets the current value to init and then returns it.


```js
var createCounter = function(init) {
    let currentCount = init;

    return {
        increment() {
            currentCount += 1;
            return currentCount;
        },
        decrement() {
            currentCount -= 1;
            return currentCount;
        },
        reset() {
            currentCount = init;
            return currentCount; 
        }
    }
};

const counter = createCounter(4)
counter.increment(); // 5
counter.reset(); // 4
counter.decrement(); //3
```
