---
sidebar_position: 1
---

```js
class Animation {
    constructor(name) {
        this.animal_name = name;
    }
}

Animation.prototype.start = function() {
    console.log('START THE ANIMATION', this.animal_name);
}

Animation.prototype.end = function() {
    console.log('END THE ANIMATION', this.animal_name);
}

const first_animation = new Animation('Lion');

first_animation.start();
first_animation.end();
```

This defines a new class called Animation and assigns two methods to the class’s prototype
property. `Function.prototype.method` allows you to add new methods to classes.

You can created dynamic methods:

```js

class Animation {
    constructor(name) {
        this.animal_name = name;
    }
}

Animation.prototype.method = function(name, fn) {
    this[name] = fn;
}

const second_animation = new Animation('Lion');

second_animation.method('start', function() {
    console.log('START THE ANIMATION');
});

second_animation.start();

```
In JavaScript, functions are first-class objects. They can be stored in variables, passed into other
functions as arguments, passed out of functions as return values, and constructed at run-time.
These features provide a great deal of flexibility and expressiveness when dealing with functions.

