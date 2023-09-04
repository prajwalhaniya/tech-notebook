---
sidebar_position: 1
---
Given an integer n, return a counter function. This counter function initially returns n and then returns 1 more than the previous value every subsequent time it is called (n, n + 1, n + 2, etc).

This problem involves the concept of `closure`.

```js
function createCounter(n) {
    return () => {
        return n++;
    }
}

const counter = createCounter(10);
counter(); // 10
counter(); // 11
counter(); // 12
```
