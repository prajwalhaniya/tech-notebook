---
sidebar_position: 1
---
### Variables

- **Variable Declarations**

    In JavaScript, you can declare variables using three different keywords: `var`, `let`, and `const`. The choice of which keyword to use depends on the variable's intended `scope` and whether you want the variable's value to be mutable or immutable.

    _When you declare a variable with_:
        
    `var`: global scoped / function scoped.

    `let`: block scoped & can be reassigned within the block.

    `const`: block scoped, but cannot be reassigned once decalared & assigned a value. 

- **Variable Scopes**

    - Global Scope
        Variables declared outside of any function or block have global scope. Global variables are accessible from anywhere in your JavaScript code, both inside and outside functions and blocks. Global variables can be accessed and modified from any part of your code, which can lead to unintended consequences and make it challenging to track changes.

        ```js
            var globalVar = 10;

            function globalScope() {
                console.log(globalVar); // Accessible inside the function
            }

            console.log(globalVar); // Accessible outside the function

        ```
    - Local (Function / block ) Scope
        Variables that are declared inside a function or block have local scope. They are only accessible within the function or block in which they are defined. They take precedence over global variables with the same name within their scope.

        ```js
            function localScope() {
                var localVar = 20; // localVar is local to myFunction
                console.log(localVar); // Accessible inside the function
            }

            myFunction();
            console.log(localVar); // Generates an error, localVar is not defined here

        ```

- **Hoisting**

    Hoisting is a behavior in which variable and function declarations are **_moved to the top_** of their containing scope during the compilation phase, before the code is executed. This means that regardless of where you declare variables or functions within a scope, they are effectively "hoisted" to the top of that scope.

    > Only the declarations are hoisted, not the initializations or assignments.

    ```js
    function hoisting() {
        console.log(x); // undefined
        var x = 10;
        console.log(x); // 10
    }
    hoisting();
    ```



### Data Types

- `Primitive Types`: string, undefined, number, bigint, boolean, null, symbol

- `Objects`: Prototypal inheritance, object prototype, Built-in objects

    **Prototypal Inheritance**

    Prototypal inheritance describes how objects can `inherit` properties and methods from other objects.

    - `Prototype Chain`: Every object in JavaScript has a special property called __proto__ (or `[[Prototype]]`) that points to another object. This object is known as its prototype. When you access a property or method on an object, JavaScript first looks for that property or method on the object itself. If it doesn't find it, it follows the prototype chain by checking the prototype object. This process continues until the property or method is found or the end of the chain is reached.

    - `Constructor Functions`: you can create constructor functions that are used to create objects with shared properties and methods. These functions are typically capitalized by convention. You can add properties and methods to the constructor function's prototype property, and all objects created from that constructor will inherit those properties and methods.

    ```js
    // constructor function
    function Person(name, subject) {
        this.name = name;
        this.subject = subject;
    }

    Person.prototype.subjectChoice = function() {
        console.log(`${this.name} has made a choice of ${this.subject}`);
    }

    const person = new Person('Prajwal', 'Computer Science');
    person.subjectChoice();
    ```

    - `Object Prototype`

    Object Prototype is at the top of the prototype chain. It contains common properties and methods that are available on all objects. For example, every object inherits methods like `toString()`, `hasOwnProperty()`, and `constructor` from Object.prototype.

    ```js
    const person = {
        name: "Prajwal",
        subject: "Computer Science"
    }

    person.__proto__.skill = "Software Development";
    
    console.log(person.name); // Prajwal
    console.log(person.skill); // Software Development
    ```

> Why `__proto__` word is used instead of `prototype` for object prototype? 

>__proto__ is a property that exists on individual objects and points to their prototype. It is used to look up properties and methods on the prototype chain. `prototype` is a property that is typically used with constructor functions to define the prototype of objects created by that constructor. It is not a property of individual objects but rather of constructor functions.
        
<!-- ### Type Casting

- Explicit Type Casting
- Implicit Type Casting -->

<!-- ### Data Structures

- Keyed Collections
    - Map
    - Weak Map
    - Set
    - Weak Set

- Structured Data
    - JSON

- Indexed Collections
    - Typed Arrays
    - Arrays -->

### Loops & Iterations

- `for`
```js
for (let i = 0; i < LENGTH; i++) {
    // perform operation
}
```

- `do while`

```js
/*
    do {

    } while (condition)
*/


// Example:
let count = 1;

do {
    console.log(count);
    count++;
} while (count <= 5);
```
- `while`

```js
/*
    while (condition) {

    }
*/

// Example 

let count = 0;
while (count < 5) {
    console.log(count);
    count++;
}
```


- `for in`

This is typically used with the objects(with keys)

```js
/*
    for (variable in object) {
        // Code to be executed for each property in the object
    }
*/

// Example

let person = {
    name: 'Prajwal',
    subject: 'Computer Science'
}

for (let key in person) {
    if (person.hasOwnProperty(key)) {
        console.log(key + ' : ' + person[key]);
    }
}
```
- `for of`

```js
/*
    for (let item of iterableObject) {
        // perform operation
    }
*/

// Example

const numbers = [1, 2, 3, 4];

for (let num of numbers) {
    console.log(num);
}
```

### Control flow

- if else
- switch
- throw statement
- try / catch / finally
- Utilizing Error Objects

---

- Closures
- Promises
- Async & Await
- this
- Prototype
- Recursion
- Memoization
- Debounce
- Function Composition
- Reduce Right
- Generator function
- Promis.Race()
- How to implement .concat() method using pure javascript? -> Its used to flatten the array.
- How do callbacks work?
- How do promises work?
- What is the use of Promise.all()?
- How JSON.stringify() works?
- What is the difference between setInterval And setTimeout? How they are implemented under the hood?