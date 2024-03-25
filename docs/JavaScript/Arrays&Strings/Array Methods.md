---
sidebar_position: 1
---

### at()

The `at()` method returns an indexed element from an array.

```js
const fruits = ["Banana", "Orange", "Apple", "Mango"];
let index = 2;
let fruit = fruits.at(index);
console.log(fruit);
```

### concat()

The `concat()` helps in joining two arrays. You can also join three arrays eg: `arr1.concat(arr2, arr3);`

```js
const arr1 = ["a", "b"];
const arr2 = ["c", "d", "e"];
const children = arr1.concat(arr2);
console.log(children);
```

### copyWithin()

The copyWithin() method does the following:
- copies array elements to another position in an array.
- overwrites the existing values

```js
const fruits = ["Banana", "Orange", "Apple", "Mango"];
fruits.copyWithin(2, 0);

console.log(fruits); // [ 'Banana', 'Orange', 'Banana', 'Orange' ]
```

### entries()

The `entries()` method returns an array iterator object with key/value pairs. This method does not change the original array.

```js
const fruits = ["Banana", "Orange", "Apple", "Mango"];
const f = fruits.entries();

for (const entry of f) {
    console.log(entry);
}

/* Output
[ 0, 'Banana' ]
[ 1, 'Orange' ]
[ 2, 'Apple' ]
[ 3, 'Mango' ]
*/
```

