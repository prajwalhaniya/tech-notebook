---
sidebar_position: 14
---
Design an `EventEmitter` class. This interface is similar (but with some differences) to the one found in Node.js or the Event Target interface of the DOM. The EventEmitter should allow for subscribing to events and emitting them.

Your EventEmitter class should have the following two methods:

`subscribe` - This method takes in two arguments: the name of an event as a string and a callback function. This callback function will later be called when the event is emitted.

An event should be able to have multiple listeners for the same event. When emitting an event with multiple callbacks, each should be called in the order in which they were subscribed. An array of results should be returned. You can assume no callbacks passed to subscribe are referentially identical.
The subscribe method should also return an object with an `unsubscribe` method that enables the user to unsubscribe. When it is called, the callback should be removed from the list of subscriptions and undefined should be returned.

emit - This method takes in two arguments: the name of an event as a string and an optional array of arguments that will be passed to the callback(s). If there are no callbacks subscribed to the given event, return an empty array. Otherwise, return an array of the results of all callback calls in the order they were subscribed.

```js
class EventEmitter {
  constructor() {
    this.events = {};
  }

  subscribe(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    const subscription = { eventName, callback };

    this.events[eventName].push(subscription);

    return {
      unsubscribe: () => {
        const index = this.events[eventName].indexOf(subscription);
        if (index !== -1) {
          this.events[eventName].splice(index, 1);
        }
      },
    };
  }

  emit(eventName, args = []) {
    if (!this.events[eventName]) {
      return [];
    }

    const results = [];

    for (const subscription of this.events[eventName]) {
      const result = subscription.callback(...args);
      results.push(result);
    }

    return results;
  }
}

// Example usage:
const emitter = new EventEmitter();

const subscription1 = emitter.subscribe('event1', (arg) => {
  console.log(`Callback 1: ${arg}`);
});

const subscription2 = emitter.subscribe('event1', (arg) => {
  console.log(`Callback 2: ${arg}`);
});

emitter.emit('event1', ['Hello']); // Output:
// Callback 1: Hello
// Callback 2: Hello

subscription1.unsubscribe();

emitter.emit('event1', ['World']); // Output:
// Callback 2: World


```
