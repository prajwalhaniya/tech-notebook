---
sidebar_position: 3
---
What is an interface?

An interface provides a way of specifying what methods an object should have. It does not specify how those methods should be implemented, though it may indicate (or at least hint at) the semantics of the methods.

*Benifits of using interfaces*

- Established interfaces are selfdocumenting and promote reusability.
- An interface tells programmers what methods a given class implements, which makes it easier to use.
- Interfaces also stabilize the ways in which different classes can communicate.

*Drawbacks of using interfaces*

- JavaScript does not come with built-in support for interfaces, and there is always a danger in trying to emulate some other language’s native functionality.
- Using interface can create a small performance hit.

**Creating interfaces in JavaScript**

It doesn’t always make sense to use strict type checking. Most JavaScript programmers have worked for years without ever needing an interface or the kind of checks that it provides. It becomes most beneficial when you start implementing complex systems using design patterns.

### Describe interface with comments

```js
/*
    interface Composite {
        function Add(item);
        function remove(item);
        function getItem(id);
    }

    interface FormItem {
        function save();
    }
*/

const CompositeForm = function (id, method, action) {
    // implement Composite & FormItem
}

CompositeForm.prototype.add = function() {
    // functionality
}

// similarly implement other methods

```

This doesn’t emulate the interface functionality very well. There is no checking to ensure that CompositeForm actually does implement the correct set of methods. No errors are thrown to inform the programmer that there is a problem. It is really more documentation than anything else.

### Implementing interface with attributes checking

```js
class InterfaceChecker {
    static implements(object, ...interfaces) {
        for (const interfaceName of interfaces) {
            if (!object.implementsInterface.includes(interfaceName)) {
                return false;
            }
        }
        return true;
    }
}

class FormItem {
    save() {
        // Implements save method
    }
}

class Composite {
    add(item) {
        // implements add method
    }
}

class CompositeForm extends FormItem {
    constructor(id, method, action) {
        super();
        this.id = id;
        this.method = method;
        this.action = action;
        this.implementsInterface = ['Composite', 'FormItem'];
    }

    add() {
        // implements add method for CompositeForm class
    }
}

function addForm(formInstance) {
    if (!InterfaceChecker.implements(formInstance, 'Composite', 'FormItem')) {
        throw new Error('Object does not implement the required interfaces');
    }
    console.log('Object implements the required interfaces');
}

const myCompositeForm = new CompositeForm('formId', 'POST', '/submit');
addForm(myCompositeForm);

```
The main drawback to this approach is that you are not ensuring that the class really does implement this interface. You only know if it says it implements it. It is very easy to create a class that declares it implements an interface and then forget to add a required method. All checks will pass, but the method will not be there, potentially causing problems in your code. It is also added work to explicitly declare the interfaces a class supports.

### Interfaces with duck typing

```js
class CompositeForm {
  constructor(id, method, action) {
    this.id = id;
    this.method = method;
    this.action = action;
    // Other properties for CompositeForm class
  }

  add(child) {
    // Implementation of the add method for CompositeForm class
  }

  remove(child) {
    // Implementation of the remove method for CompositeForm class
  }

  getChild(index) {
    // Implementation of the getChild method for CompositeForm class
  }

  save() {
    // Implementation of the save method for CompositeForm class
  }
}

// Example usage
function addForm(formInstance) {
  const requiredMethods = ['add', 'remove', 'getChild', 'save'];

  for (const method of requiredMethods) {
    if (!(method in formInstance && typeof formInstance[method] === 'function')) {
      throw new Error(`Object does not implement the required method: ${method}.`);
    }
  }
  
  console.log('Implements all the required interfaces');

  // Additional logic for adding the form
}

// Create an instance of CompositeForm
const myCompositeForm = new CompositeForm('formId', 'POST', '/submit');
addForm(myCompositeForm);
```

### Patterns that rely on `Interfaces`

- The Factory Pattern
- The Composite Pattern
- The Decorator Pattern
- The Command Pattern
