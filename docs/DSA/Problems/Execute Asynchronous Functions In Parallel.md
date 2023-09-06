---
sidebar_position: 16
---
Given an array of asynchronous functions functions, return a new promise promise. Each function in the array accepts no arguments and returns a promise.

promise resolves:

When all the promises returned from functions were resolved successfully. The resolved value of promise should be an array of all the resolved values of promises in the same order as they were in the functions.
promise rejects:

When any of the promises returned from functions were rejected. promise should also reject with the reason of the first rejection.

Solve it without using the built-in `Promise.all` function.

```js
function customPromiseAll(functions) {
  return new Promise((resolve, reject) => {
    const results = [];
    let completedCount = 0;
    let hasRejected = false;

    if (functions.length === 0) {
      resolve(results);
      return;
    }

    for (let i = 0; i < functions.length; i++) {
      functions[i]()
        .then((result) => {
          if (!hasRejected) {
            results[i] = result;
            completedCount++;

            if (completedCount === functions.length) {
              resolve(results);
            }
          }
        })
        .catch((reason) => {
          if (!hasRejected) {
            hasRejected = true;
            reject(reason);
          }
        });
    }
  });
}

const asyncFunction1 = () => Promise.resolve(1);
const asyncFunction2 = () => Promise.resolve(2);
const asyncFunction3 = () => Promise.reject('Error');

const functions = [asyncFunction1, asyncFunction2, asyncFunction3];

customPromiseAll(functions)
  .then((results) => {
    console.log('Resolved:', results);
  })
  .catch((reason) => {
    console.error('Rejected:', reason);
  });
```