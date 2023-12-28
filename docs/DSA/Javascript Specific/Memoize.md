---
sidebar_position: 4
---

Given a function fn, return a memoized version of that function.

A memoized function is a function that will never be called twice with the same inputs. Instead it will return a cached value.

You can assume there are 3 possible input functions: sum, fib, and factorial.

sum accepts two integers a and b and returns a + b.
fib accepts a single integer n and returns 1 if n <= 1 or fib(n - 1) + fib(n - 2) otherwise.
factorial accepts a single integer n and returns 1 if n <= 1 or factorial(n - 1) * n otherwise.

```js
function memoize(fn) {
  const cache = new Map(); // Create a cache to store computed results
  
  return function(...args) {
    const key = JSON.stringify(args); // Create a unique key for the arguments
    if (cache.has(key)) {
      // If the result is cached, return it
      return cache.get(key);
    } else {
      // Otherwise, compute the result and cache it
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }
  };
}

// Define the functions you want to memoize
function sum(a, b) {
  return a + b;
}

function fib(n) {
  if (n <= 1) {
    return 1;
  }
  return fib(n - 1) + fib(n - 2);
}

function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return factorial(n - 1) * n;
}

// Create memoized versions of the functions
const memoizedSum = memoize(sum);
const memoizedFib = memoize(fib);
const memoizedFactorial = memoize(factorial);

// Test the memoized functions
console.log(memoizedSum(2, 3)); // 5 (computed)
console.log(memoizedSum(2, 3)); // 5 (cached)
console.log(memoizedFib(5)); // 8 (computed)
console.log(memoizedFib(5)); // 8 (cached)
console.log(memoizedFactorial(4)); // 24 (computed)
console.log(memoizedFactorial(4)); // 24 (cached)


```