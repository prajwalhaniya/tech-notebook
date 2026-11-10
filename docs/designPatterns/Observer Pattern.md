---
sidebar_position: 6
---

## Observer Pattern in JS

> For the interview-depth version (structure, trade-offs, LLD usage, interview questions) see [Observer in LLD](../LLD/Design%20Patterns/05_Observer.md).

The **Observer Pattern** is one of the most widely used patterns in event-driven systems like Node.js.

Think of it like this:

> "When **something happens**, notify **everyone who cares** about it."

* * *

What is Observer Pattern?
=========================

It is a **behavioral design pattern** where:

*   one object (the **Subject/Publisher**) maintains a list of dependents (**Observers/Subscribers**)
*   when the subject's state changes, it **automatically notifies** all observers

* * *

Real-world analogy
==================

Think of a YouTube channel:

*   The **channel** is the subject
*   **Subscribers** are the observers
*   When a new video is uploaded, **all subscribers get notified**

You don't call each subscriber manually — they subscribed, and they get notified automatically.

* * *

Structure
=========

It has 3 parts:

### 1. Subject (Publisher)

Maintains a list of observers and notifies them.

### 2. Observer (Subscriber)

Defines the `update` method that gets called.

### 3. Concrete Implementations

Actual subject and observer classes.

* * *

Manual Implementation in Plain JS
===================================

Problem: Order status change notification
-----------------------------------------

When an order status changes, notify:

*   Email service
*   SMS service
*   Inventory service

* * *

### Subject class

```js
class OrderService {
  #observers = [];

  subscribe(observer) {
    this.#observers.push(observer);
  }

  unsubscribe(observer) {
    this.#observers = this.#observers.filter(o => o !== observer);
  }

  notify(event, data) {
    this.#observers.forEach(observer => observer.update(event, data));
  }

  updateOrderStatus(orderId, status) {
    console.log(`Order ${orderId} status updated to ${status}`);
    this.notify('ORDER_STATUS_CHANGED', { orderId, status });
  }
}
```

`#observers` uses a **private class field** — no one outside can tamper with the list.

* * *

### Concrete observers

```js
class EmailObserver {
  update(event, data) {
    if (event === 'ORDER_STATUS_CHANGED') {
      console.log(`Email sent: Order ${data.orderId} is now ${data.status}`);
    }
  }
}

class SmsObserver {
  update(event, data) {
    if (event === 'ORDER_STATUS_CHANGED') {
      console.log(`SMS sent: Order ${data.orderId} is now ${data.status}`);
    }
  }
}

class InventoryObserver {
  update(event, data) {
    if (event === 'ORDER_STATUS_CHANGED' && data.status === 'DELIVERED') {
      console.log(`Inventory updated for order ${data.orderId}`);
    }
  }
}
```

* * *

### Usage

```js
const orderService = new OrderService();

const emailObserver     = new EmailObserver();
const smsObserver       = new SmsObserver();
const inventoryObserver = new InventoryObserver();

orderService.subscribe(emailObserver);
orderService.subscribe(smsObserver);
orderService.subscribe(inventoryObserver);

orderService.updateOrderStatus('ORD123', 'SHIPPED');
// Email sent: Order ORD123 is now SHIPPED
// SMS sent: Order ORD123 is now SHIPPED

orderService.updateOrderStatus('ORD123', 'DELIVERED');
// Email sent: Order ORD123 is now DELIVERED
// SMS sent: Order ORD123 is now DELIVERED
// Inventory updated for order ORD123
```

* * *

Node.js Built-in Observer: EventEmitter
========================================

Node.js has Observer Pattern **built in** via `EventEmitter`. This is the idiomatic Node.js approach.

```js
import { EventEmitter } from 'events';

class OrderService extends EventEmitter {
  updateOrderStatus(orderId, status) {
    console.log(`Order ${orderId} status updated to ${status}`);
    this.emit('ORDER_STATUS_CHANGED', { orderId, status });
  }
}
```

### Usage with EventEmitter

```js
const orderService = new OrderService();

orderService.on('ORDER_STATUS_CHANGED', ({ orderId, status }) => {
  console.log(`Email sent for order ${orderId} - status: ${status}`);
});

orderService.on('ORDER_STATUS_CHANGED', ({ orderId, status }) => {
  console.log(`SMS sent for order ${orderId} - status: ${status}`);
});

orderService.on('ORDER_STATUS_CHANGED', ({ orderId, status }) => {
  if (status === 'DELIVERED') {
    console.log(`Inventory updated for ${orderId}`);
  }
});

orderService.updateOrderStatus('ORD123', 'SHIPPED');
```

This is idiomatic Node.js — you are using Observer Pattern every time you call `.on()`.

* * *

Advanced: Typed EventEmitter pattern
======================================

For large codebases, wrap EventEmitter to keep events organized:

```js
import { EventEmitter } from 'events';

class OrderEventBus extends EventEmitter {
  onOrderShipped(handler) {
    this.on('ORDER_SHIPPED', handler);
    return this; // chainable
  }

  onOrderDelivered(handler) {
    this.on('ORDER_DELIVERED', handler);
    return this;
  }

  emitOrderShipped(orderId) {
    this.emit('ORDER_SHIPPED', { orderId, timestamp: Date.now() });
  }

  emitOrderDelivered(orderId) {
    this.emit('ORDER_DELIVERED', { orderId, timestamp: Date.now() });
  }
}

const bus = new OrderEventBus();

bus
  .onOrderShipped(({ orderId }) => console.log(`Email: order ${orderId} shipped`))
  .onOrderDelivered(({ orderId }) => console.log(`SMS: order ${orderId} delivered`));

bus.emitOrderShipped('ORD123');
bus.emitOrderDelivered('ORD123');
```

This gives you **auto-complete friendly** event names and removes magic strings from consumer code.

* * *

Real backend use cases
======================

### User signup triggers

```js
import { EventEmitter } from 'events';

class UserService extends EventEmitter {
  async register(userData) {
    const user = await db.users.create(userData);
    this.emit('USER_REGISTERED', user);
    return user;
  }
}

const userService = new UserService();

// Each concern registers its own handler — completely decoupled
userService.on('USER_REGISTERED', (user) => emailService.sendWelcome(user));
userService.on('USER_REGISTERED', (user) => trialService.createFreeTrial(user));
userService.on('USER_REGISTERED', (user) => crmService.addContact(user));
userService.on('USER_REGISTERED', (user) => analyticsService.track('signup', user));
```

The `UserService` doesn't know what happens after registration. **Each service owns its reaction.**

* * *

### Inventory alert system

```js
class InventoryService extends EventEmitter {
  updateStock(productId, quantity) {
    this.stock[productId] = quantity;

    if (quantity < this.lowStockThreshold) {
      this.emit('LOW_STOCK', { productId, quantity });
    }
  }
}

const inventory = new InventoryService();

inventory.on('LOW_STOCK', ({ productId }) => {
  slackService.alert(`Low stock alert for product ${productId}`);
});

inventory.on('LOW_STOCK', ({ productId, quantity }) => {
  procurementService.raiseOrder(productId, quantity);
});
```

* * *

### WebSocket broadcast on DB change

```js
class DataService extends EventEmitter {
  async updateRecord(id, data) {
    const updated = await db.update(id, data);
    this.emit('RECORD_UPDATED', updated);
    return updated;
  }
}

const dataService = new DataService();

// Broadcast to all connected WebSocket clients
dataService.on('RECORD_UPDATED', (record) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'UPDATE', payload: record }));
    }
  });
});
```

* * *

One-time observers with `.once()`
===================================

```js
// This handler fires only once, then auto-removes itself
orderService.once('ORDER_PLACED', (order) => {
  console.log(`First order celebration email for ${order.id}`);
});
```

Useful for: onboarding flows, one-time payment confirmations, initialization hooks.

* * *

Removing observers
===================

```js
function auditHandler({ orderId, status }) {
  auditLog.write({ orderId, status, at: new Date() });
}

orderService.on('ORDER_STATUS_CHANGED', auditHandler);

// Later — remove it
orderService.off('ORDER_STATUS_CHANGED', auditHandler);
// or:
orderService.removeListener('ORDER_STATUS_CHANGED', auditHandler);
```

* * *

Benefits
========

1\. **Loose Coupling**
----------------------

The subject doesn't know anything about its observers. Add or remove observers without touching the subject.

* * *

2\. **Open/Closed Principle**
------------------------------

Add a new observer (e.g., `PushNotificationObserver`) without modifying existing code.

* * *

3\. **Event-driven architecture**
----------------------------------

Fits perfectly with Node.js's async, non-blocking event model.

* * *

When to use Observer Pattern
============================

*   one change should trigger **multiple independent reactions**
*   you want to decouple the publisher from the subscribers
*   the number of subscribers can vary at runtime
*   you're building an **event-driven or pub/sub architecture**

* * *

When NOT to use it
==================

*   when the chain of notifications is hard to trace (debugging becomes difficult)
*   when observers must be notified in a **guaranteed order** with tight coupling
*   for very simple one-to-one triggers — just call the function directly

* * *

Interview definition (short answer)
=====================================

> "Observer Pattern is a behavioral design pattern where a subject maintains a list of observers and notifies them automatically when its state changes, enabling loose coupling between the publisher and subscribers."

* * *

Best mental model
=================

If you see code like:

```js
sendEmail(order);
sendSms(order);
updateInventory(order);
updateAnalytics(order);
```

All tightly coupled inside one function — ask yourself:

> "Should this become an event that observers react to?"

Formula:

```
Subject.notify(event) → [Observer1, Observer2, Observer3].update()
```
