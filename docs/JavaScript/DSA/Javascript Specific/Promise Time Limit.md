---
sidebar_position: 10
---

Given an asynchronous function fn and a time t in milliseconds, return a new time limited version of the input function. fn takes arguments provided to the time limited function.

The time limited function should follow these rules:

If the fn completes within the time limit of t milliseconds, the time limited function should resolve with the result.
If the execution of the fn exceeds the time limit, the time limited function should reject with the string "Time Limit Exceeded".

**Scenario**

> For Example, We want to time how long it takes for a computer to do something. We have a special function (like a set of instructions for the computer) that does the task, and we want to make sure it doesn't take too long. 

Similarly we have a function (let's call it fn) that does the task, and we want to give it a time limit t (like 1 second) to finish the task. If it finishes within 1 second, great! We get the result. But if it takes longer than 1 second, we don't want to wait forever. Instead, we want our code to say, "Time Limit Exceeded"

```js
function timeLimitedFunction(fn, t) {
  return (...args) => {
    return new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject("Time Limit Exceeded");
      }, t);

      fn(...args)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };
}


async function myAsyncFunction(arg1, arg2) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return arg1 + arg2;
}

const timeLimitedFn = timeLimitedFunction(myAsyncFunction, 1000);
timeLimitedFn(3, 4)
  .then((result) => {
    console.log("Result:", result);
  })
  .catch((error) => {
    console.error("Error:", error);
  });


```