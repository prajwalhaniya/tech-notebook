---
sidebar_position: 1
---

## JavaScript Fundamentals

The concepts here are not beginner material — they're the parts of JavaScript that trip up experienced developers, cause subtle bugs, and come up in senior engineering discussions.

* * *

var vs let vs const
====================

### Scope

```js
function scopeDemo() {
  var x = 1;   // function-scoped — visible anywhere in this function
  let y = 2;   // block-scoped — only within the nearest { }
  const z = 3; // block-scoped + cannot be reassigned
}

// var leaks out of blocks
if (true) {
  var leaked = 'I am visible outside';
  let contained = 'I am not';
}
console.log(leaked);    // 'I am visible outside'
console.log(contained); // ReferenceError
```

### Hoisting and the Temporal Dead Zone

`var` is hoisted and initialized to `undefined`.

`let` and `const` are hoisted but **not initialized** — accessing them before the declaration throws a `ReferenceError`. This inaccessible window is the **Temporal Dead Zone (TDZ)**.

```js
console.log(a); // undefined — var is hoisted and initialized
console.log(b); // ReferenceError — b is in the TDZ
console.log(c); // ReferenceError — c is in the TDZ

var a = 1;
let b = 2;
const c = 3;
```

### const is not immutable

`const` prevents **reassignment**, not **mutation**.

```js
const user = { name: 'Prajwal' };
user.name = 'Updated';  // ✅ mutation is allowed
user = {};              // ❌ TypeError: reassignment is not allowed

const nums = [1, 2, 3];
nums.push(4);           // ✅ mutation allowed
nums = [];              // ❌ TypeError
```

To make an object truly immutable:

```js
const user = Object.freeze({ name: 'Prajwal', role: 'admin' });
user.name = 'Other'; // silently fails in non-strict mode, throws in strict
console.log(user.name); // 'Prajwal'
```

Note: `Object.freeze` is **shallow** — nested objects are still mutable.

* * *

Type Coercion
==============

JavaScript silently converts types in many operations — a frequent source of bugs.

### == vs ===

`===` (strict equality) — compares value AND type, no coercion.
`==` (loose equality) — coerces types before comparing.

```js
0 == false        // true  — false coerces to 0
0 === false       // false — different types

'' == false       // true  — both coerce to 0
'' === false      // false

null == undefined // true  — special case in spec
null === undefined // false

NaN == NaN        // false — NaN is not equal to itself
```

**Rule:** Always use `===`. The only common exception is `x == null` which checks for both `null` and `undefined`.

```js
// Checks both null and undefined
if (user == null) { ... }    // same as: user === null || user === undefined
```

### Truthy and Falsy

Every value is either truthy or falsy when evaluated in a boolean context.

**Falsy values** (only 8):

```js
false, 0, -0, 0n, '', "", ``, null, undefined, NaN
```

Everything else is truthy — including `[]`, `{}`, `'0'`, `'false'`.

```js
if ([]) console.log('truthy');   // prints — empty array is truthy
if ({}) console.log('truthy');   // prints — empty object is truthy
if ('0') console.log('truthy');  // prints — non-empty string is truthy
```

### Type coercion in operations

```js
// + with a string → string concatenation
1 + '2'    // '12'  — 1 coerced to string
'3' - 1    //  2    — '3' coerced to number (- only works on numbers)
'5' * '2'  // 10    — both coerced to number

// Unary + coerces to number
+'42'      // 42
+''        // 0
+null      // 0
+undefined // NaN
+true      // 1
+false     // 0
+[]        // 0
+{}        // NaN
```

### Type checking

```js
// typeof — reliable for primitives, unreliable for objects
typeof 42          // 'number'
typeof 'hello'     // 'string'
typeof true        // 'boolean'
typeof undefined   // 'undefined'
typeof null        // 'object' ← infamous bug in JS spec, null is NOT an object
typeof []          // 'object'
typeof {}          // 'object'
typeof function(){} // 'function'

// instanceof — checks prototype chain
[] instanceof Array      // true
[] instanceof Object     // true (Array inherits from Object)
null instanceof Object   // false

// Most reliable: Object.prototype.toString
Object.prototype.toString.call([])        // '[object Array]'
Object.prototype.toString.call({})        // '[object Object]'
Object.prototype.toString.call(null)      // '[object Null]'
Object.prototype.toString.call(undefined) // '[object Undefined]'
Object.prototype.toString.call(/regex/)   // '[object RegExp]'
Object.prototype.toString.call(new Map()) // '[object Map]'

// Practical utility
function typeOf(value) {
  return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
}
typeOf([])        // 'array'
typeOf(null)      // 'null'
typeOf(new Map()) // 'map'
```

* * *

Primitive Types In Depth
=========================

JavaScript has 7 primitive types: `string`, `number`, `bigint`, `boolean`, `undefined`, `null`, `symbol`.

### Numbers and floating point

```js
// JavaScript uses IEEE 754 double-precision floating point
0.1 + 0.2 === 0.3  // false — 0.30000000000000004

// Fix: use toFixed or a tolerance
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON // true

// Special number values
Infinity        // 1 / 0
-Infinity       // -1 / 0
NaN             // Not a Number — result of invalid math

// NaN is the only value not equal to itself
NaN === NaN     // false
Number.isNaN(NaN)   // true — safe check
Number.isNaN('abc') // false — unlike global isNaN() which coerces
isNaN('abc')        // true ← coerces 'abc' to NaN first, misleading

// Safe integer range
Number.MAX_SAFE_INTEGER // 9007199254740991 (2^53 - 1)
9007199254740991 + 1 === 9007199254740992 // true
9007199254740992 + 1 === 9007199254740992 // true ← precision lost!
```

### BigInt — for large integers

```js
const bigNum = 9007199254740991n; // trailing n
bigNum + 1n // 9007199254740992n — exact

// Cannot mix BigInt and Number without explicit conversion
1n + 1   // TypeError
1n + BigInt(1) // 2n
```

### Symbol — unique identifiers

```js
const id1 = Symbol('id');
const id2 = Symbol('id');
id1 === id2 // false — every Symbol is unique

// Use case: non-colliding object property keys
const INTERNAL_ID = Symbol('internalId');
const user = {
  name: 'Prajwal',
  [INTERNAL_ID]: 'usr_abc123',
};

user[INTERNAL_ID]  // 'usr_abc123'
Object.keys(user)  // ['name'] — Symbol keys are hidden from enumeration
```

### Primitive boxing

Primitives are not objects but they behave like objects because JS auto-boxes them when you access a property.

```js
'hello'.toUpperCase() // JS temporarily wraps 'hello' in a String object
(42).toString(2)      // '101010' — converts 42 to binary string

// This is why you can call methods on primitives
// The wrapper object is created, the method is called, the wrapper is discarded
```

* * *

Scope Chain and Lexical Scope
===============================

JavaScript uses **lexical (static) scope** — a function's scope is determined by where it is **written**, not where it is called.

```js
const x = 'global';

function outer() {
  const x = 'outer';

  function inner() {
    const x = 'inner';
    console.log(x); // 'inner' — finds x in its own scope first
  }

  function noLocal() {
    console.log(x); // 'outer' — looks up scope chain to outer
  }

  inner();
  noLocal();
}

outer();
```

The **scope chain** is the linked list of variable environments from the current scope up to the global scope.

```js
// Variable lookup order:
// 1. Current function scope
// 2. Outer function scope(s)
// 3. Global scope
// 4. ReferenceError if not found
```

* * *

Function Types and Declarations
================================

### Function Declaration vs Expression

```js
// Declaration — hoisted completely (name AND body)
greet(); // works — hoisted
function greet() { return 'hello'; }

// Expression — variable hoisted, but the function is NOT
sayHi(); // TypeError: sayHi is not a function
var sayHi = function() { return 'hi'; };

// Arrow function expression — also not hoisted
sayBye(); // ReferenceError
const sayBye = () => 'bye';
```

### Arrow functions vs regular functions

Key differences — not just syntax:

```js
// 1. Arrow functions have no own `this`
const obj = {
  name: 'Prajwal',
  greet: function() {
    console.log(this.name);         // 'Prajwal' — `this` is obj
  },
  greetArrow: () => {
    console.log(this.name);         // undefined — arrow captures `this` from definition context (global)
  },
};

// 2. Arrow functions have no `arguments` object
function regular() {
  console.log(arguments); // Arguments [1, 2, 3]
}
const arrow = () => {
  console.log(arguments); // ReferenceError
};

// 3. Arrow functions cannot be used as constructors
const Fn = () => {};
new Fn(); // TypeError: Fn is not a constructor

// 4. Arrow functions have no `prototype` property
const arrow2 = () => {};
console.log(arrow2.prototype); // undefined
```

* * *

Error Handling
===============

```js
// Creating custom error types
class AppError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor); // cleaner stack trace
  }
}

class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends AppError {
  constructor(message, fields) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

// Usage
try {
  throw new NotFoundError('Order', 'ORD-123');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log(err.statusCode); // 404
  }
}
```

### Error handling in async code

```js
// Always handle promise rejections
async function fetchUser(id) {
  try {
    const user = await userService.getById(id);
    return user;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;     // rethrow known errors
    throw new AppError('Failed to fetch user', 'FETCH_ERROR'); // wrap unknown
  }
}

// Global unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1); // fail loudly in production
});
```

* * *

Short-circuit Evaluation and Nullish Coalescing
=================================================

```js
// || returns first truthy value
const name = user.name || 'Anonymous'; // problem: '' or 0 are treated as missing

// && returns first falsy value (or last truthy)
const result = isValid && processData(); // only calls processData if isValid is truthy

// ?? (nullish coalescing) — only checks for null/undefined, not all falsy
const name = user.name ?? 'Anonymous'; // '' or 0 are treated as valid values

// ?. (optional chaining) — short-circuits on null/undefined
const city = user?.address?.city;        // undefined instead of TypeError
const first = arr?.[0];                  // undefined if arr is null/undefined
const result2 = obj?.method?.();        // calls method only if it exists

// Logical assignment
user.name ||= 'Anonymous';  // assign only if user.name is falsy
user.count ??= 0;           // assign only if user.count is null/undefined
config.debug &&= process.env.NODE_ENV !== 'production'; // assign only if truthy
```

* * *

Destructuring
==============

```js
// Object destructuring
const { name, age, role = 'user' } = user;        // with default
const { name: userName } = user;                   // rename
const { address: { city } } = user;               // nested
const { id, ...rest } = user;                     // rest

// Array destructuring
const [first, second, , fourth] = arr;             // skip elements
const [head, ...tail] = arr;                       // rest

// Function parameter destructuring
function createOrder({ userId, items, status = 'PENDING' }) {
  // ...
}

// Swap without temp variable
let a = 1, b = 2;
[a, b] = [b, a];

// Return multiple values
function getMinMax(arr) {
  return { min: Math.min(...arr), max: Math.max(...arr) };
}
const { min, max } = getMinMax([3, 1, 4, 1, 5]);
```

* * *

Iterators and Generators
=========================

### Iterators

Any object with a `[Symbol.iterator]` method that returns an iterator (an object with a `next()` method).

```js
// Custom iterator
function range(start, end) {
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          if (current <= end) {
            return { value: current++, done: false };
          }
          return { value: undefined, done: true };
        }
      };
    }
  };
}

for (const n of range(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}

const nums = [...range(1, 5)]; // [1, 2, 3, 4, 5]
```

### Generators

```js
function* range(start, end) {
  for (let i = start; i <= end; i++) {
    yield i; // pauses here, resumes on next()
  }
}

const gen = range(1, 3);
gen.next(); // { value: 1, done: false }
gen.next(); // { value: 2, done: false }
gen.next(); // { value: 3, done: false }
gen.next(); // { value: undefined, done: true }

for (const n of range(1, 5)) console.log(n);

// Infinite sequence
function* idGenerator() {
  let id = 1;
  while (true) {
    yield id++;
  }
}

const ids = idGenerator();
ids.next().value; // 1
ids.next().value; // 2
```

* * *

Map, Set, WeakMap, WeakSet
============================

```js
// Map — key-value pairs where keys can be any type
const map = new Map();
map.set('key', 'value');
map.set(42, 'number key');
map.set({ id: 1 }, 'object key');

map.get('key');         // 'value'
map.has('key');         // true
map.size;               // 3
map.delete('key');

for (const [key, value] of map) { ... }

// Convert to/from object
const obj = Object.fromEntries(map);
const map2 = new Map(Object.entries(obj));

// Set — unique values
const set = new Set([1, 2, 2, 3, 3]);
console.log([...set]); // [1, 2, 3]

set.add(4);
set.has(2);  // true
set.delete(2);

// Deduplicate array
const unique = [...new Set(arr)];

// WeakMap — keys must be objects, not enumerable, GC-friendly
const wm = new WeakMap();
const key = {};
wm.set(key, 'private data');
// When `key` is garbage collected, the entry is automatically removed

// Use case: attaching private data to DOM nodes or objects without memory leaks
const cache = new WeakMap();
function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = expensiveOperation(obj);
  cache.set(obj, result);
  return result;
}
```

* * *

Interview definition (short answer)
=====================================

> "JavaScript fundamentals that matter in production: `let`/`const` have block scope and TDZ; `==` coerces types (`===` does not); `const` prevents reassignment not mutation; `typeof null` is `'object'` (spec bug); arrow functions have no own `this` or `arguments`; `??` differs from `||` by only checking null/undefined; WeakMap/WeakSet allow GC of keys."
