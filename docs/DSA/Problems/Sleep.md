---
sidebar_position: 2
---
Given a positive integer millis, write an asynchronous function that sleeps for millis milliseconds. It can resolve any value.

```js
function sleep(millis) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(millis);
        }, millis);
    });
}

sleep(100).then((data) => {
    console.log(data);
}).catch(error => {
    console.log(error);
});
```