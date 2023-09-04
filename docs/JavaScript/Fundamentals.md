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

- Hoisting
- Varibale Naming Rules

### Data Types

- `Primitive Types`: string, undefined, number, bigint, boolean, null, symbol
- `Objects`: Prototypal inheritance, object prototype, Built-in objects

### Type Casting

- Explicit Type Casting
- Implicit Type Casting

### Data Structures

- Keyed Collections
    - Map
    - Weak Map
    - Set
    - Weak Set

- Structured Data
    - JSON

- Indexed Collections
    - Typed Arrays
    - Arrays

### Loops & Iterations

- for
- do while
- while
- for in
- for of
- break / continue

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
- How to implement .concat() method using pure javascript?