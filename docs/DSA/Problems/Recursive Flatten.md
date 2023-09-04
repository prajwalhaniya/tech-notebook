---
sidebar_position: 5
---
Given a multi-dimensional array arr and a depth n, return a flattened version of that array.

A flattened array is a version of that array with some or all of the sub-arrays removed and replaced with the actual elements in that sub-array. This flattening operation should only be done if the current depth of nesting is less than n. The depth of the elements in the first array are considered to be 0.

Solve it without the built-in `Array.flat` method.

```js
function flattenArray(arr, n) {
  function recursiveFlatten(inputArray, depth) {
    const result = [];

    for (const item of inputArray) {
      if (Array.isArray(item) && depth < n) {
        // If the item is an array and depth is less than n, recursively flatten it.
        result.push(...recursiveFlatten(item, depth + 1));
      } else {
        // If not an array or depth has reached n, add the item as is.
        result.push(item);
      }
    }

    return result;
  }

  return recursiveFlatten(arr, 0);
}

// Example usage:
const multiDimArray = [1, [2, [3, 4], 5], 6];
const depth = 2;

const flattenedArray = flattenArray(multiDimArray, depth);
console.log(flattenedArray); // [1, 2, [3, 4], 5, 6]

```

