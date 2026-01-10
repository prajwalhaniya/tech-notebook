---
sidebar_position: 7
---
Given an array of functions [f1, f2, f3, ..., fn], return a new function fn that is the function composition of the array of functions.

The function composition of [f(x), g(x), h(x)] is fn(x) = f(g(h(x))).

The function composition of an empty list of functions is the identity function f(x) = x.

You may assume each function in the array accepts one integer as input and returns one integer as output.

```js
function composeFunctions(functions) {
  return function(x) {
    let result = x;
    for (let i = functions.length - 1; i >= 0; i--) {
      result = functions[i](result);
    }
    return result;
  };
}

const add1 = x => x + 1;
const double = x => x * 2;
const square = x => x * x;

const functions = [add1, double, square];
const composedFunction = composeFunctions(functions);

console.log(composedFunction(3)); // Result: 64 (square(double(add1(3))))

```