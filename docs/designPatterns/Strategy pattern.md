---
sidebar_position: 4
---

## Strategy Pattern in JS

> For the interview-depth version (structure, trade-offs, LLD usage, interview questions) see [Strategy in LLD](../LLD/Design%20Patterns/04_Strategy.md).

The **Strategy Pattern** is one of the cleanest ways to remove `if/else` or `switch` hell in Node.js.

Think of it like this:

> "I have **multiple ways to do the same task**, and I want to **swap them dynamically**."

* * *

What is Strategy Pattern?
=========================

It is a **behavioral design pattern** where:

*   you define a **common contract** (a shape all strategies must follow)
*   create **multiple implementations (strategies)**
*   choose one strategy at runtime

* * *

Real-world analogy
==================

Imagine a payment system:

*   Credit Card payment
*   UPI payment
*   PayPal payment

All of them do the same thing:

```
pay(amount)
```

But the **implementation differs**.

Instead of doing this:

```js
if (paymentType === 'upi') {
  // UPI logic
} else if (paymentType === 'card') {
  // Card logic
} else if (paymentType === 'paypal') {
  // PayPal logic
}
```

You use **Strategy Pattern**.

* * *

Structure
=========

It has 3 parts:

### 1. Strategy Contract

Defines the method every strategy must implement (enforced by convention or JSDoc).

### 2. Concrete Strategies

Actual implementations.

### 3. Context

The class that uses the strategy.

* * *

Class-based Example
===================

Problem: Different discount calculation strategies
--------------------------------------------------

### Strategy contract (via JSDoc)

```js
/**
 * @typedef {Object} DiscountStrategy
 * @property {function(number): number} calculate
 */
```

### Concrete strategies

```js
class NoDiscountStrategy {
  calculate(price) {
    return price;
  }
}

class FlatDiscountStrategy {
  constructor(discountAmount) {
    this.discountAmount = discountAmount;
  }

  calculate(price) {
    return price - this.discountAmount;
  }
}

class PercentageDiscountStrategy {
  constructor(percentage) {
    this.percentage = percentage;
  }

  calculate(price) {
    return price - (price * this.percentage) / 100;
  }
}
```

### Context class

```js
class PriceCalculator {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  getFinalPrice(price) {
    return this.strategy.calculate(price);
  }
}
```

### Usage

```js
const calculator = new PriceCalculator(new NoDiscountStrategy());

console.log(calculator.getFinalPrice(1000)); // 1000

calculator.setStrategy(new FlatDiscountStrategy(200));
console.log(calculator.getFinalPrice(1000)); // 800

calculator.setStrategy(new PercentageDiscountStrategy(10));
console.log(calculator.getFinalPrice(1000)); // 900
```

* * *

Functional Approach (idiomatic JS)
===================================

In JavaScript you can also express strategies as **plain functions** — no classes needed.

```js
const noDiscount      = (price) => price;
const flatDiscount    = (amount) => (price) => price - amount;
const percentDiscount = (pct)    => (price) => price - (price * pct) / 100;

function getPrice(price, strategy) {
  return strategy(price);
}

getPrice(1000, noDiscount);           // 1000
getPrice(1000, flatDiscount(200));    // 800
getPrice(1000, percentDiscount(10));  // 900
```

This is the **shortest, most idiomatic JS version**.

Use **classes** when strategies carry state or methods.
Use **functions** when strategies are stateless transforms.

* * *

Real backend use cases in Node.js
==================================

1) Payment Gateway Selection
----------------------------

```js
class RazorpayStrategy {
  async pay(amount) {
    console.log(`Processing ₹${amount} via Razorpay`);
  }
}

class StripeStrategy {
  async pay(amount) {
    console.log(`Processing $${amount} via Stripe`);
  }
}

class PaymentService {
  constructor(strategy) {
    this.strategy = strategy;
  }

  async checkout(amount) {
    await this.strategy.pay(amount);
  }
}

const service = new PaymentService(new RazorpayStrategy());
await service.checkout(500);
```

* * *

2) Delivery Partner Selection
-----------------------------

```js
class DunzoStrategy {
  async createShipment(orderId) {
    console.log(`Dunzo shipment created for ${orderId}`);
  }
}

class ShadowfaxStrategy {
  async createShipment(orderId) {
    console.log(`Shadowfax shipment created for ${orderId}`);
  }
}

class ShipmentService {
  constructor(strategy) {
    this.strategy = strategy;
  }

  async ship(orderId) {
    await this.strategy.createShipment(orderId);
  }
}
```

* * *

3) Carrier Integration with Strategy + Factory
-----------------------------------------------

A very common production pattern — the Factory picks the right strategy.

```js
class CompanyStrategy {
  async createShipment(order) {
    return {
      provider: 'Company',
      payload: { orderId: order.id, customerName: order.customerName },
    };
  }
}

class PorterStrategy {
  async createShipment(order) {
    return {
      provider: 'Porter',
      payload: { shipment_id: order.id, name: order.customerName },
    };
  }
}

class ShadowfaxStrategy {
  async createShipment(order) {
    return {
      provider: 'Shadowfax',
      payload: { order_ref: order.id, recipient_name: order.customerName },
    };
  }
}

// Factory picks the strategy
const carrierStrategies = {
  company:   new CompanyStrategy(),
  porter:    new PorterStrategy(),
  shadowfax: new ShadowfaxStrategy(),
};

function getCarrierStrategy(carrier) {
  const strategy = carrierStrategies[carrier.toLowerCase()];
  if (!strategy) throw new Error(`Unsupported carrier: ${carrier}`);
  return strategy;
}

// Context
class CarrierService {
  constructor(strategy) {
    this.strategy = strategy;
  }

  async createShipment(order) {
    return this.strategy.createShipment(order);
  }
}

// Usage
const order = { id: 'ORD123', customerName: 'Prajwal' };

const strategy = getCarrierStrategy('porter');
const carrierService = new CarrierService(strategy);

const result = await carrierService.createShipment(order);
console.log(result);
// { provider: 'Porter', payload: { shipment_id: 'ORD123', name: 'Prajwal' } }
```

* * *

4) Notification Channel Strategy
---------------------------------

```js
class EmailStrategy {
  async send(message) {
    console.log('Email:', message);
  }
}

class SmsStrategy {
  async send(message) {
    console.log('SMS:', message);
  }
}

class WhatsAppStrategy {
  async send(message) {
    console.log('WhatsApp:', message);
  }
}

class NotificationService {
  constructor(strategy) {
    this.strategy = strategy;
  }

  async notify(message) {
    await this.strategy.send(message);
  }
}
```

* * *

Benefits
========

1\. **Open/Closed Principle**
-----------------------------

Add new strategies **without modifying existing code**.

```js
class FestivalDiscountStrategy {
  calculate(price) {
    return price * 0.7; // 30% off
  }
}
```

No need to touch old logic.

* * *

2\. **Removes giant conditionals**
----------------------------------

No huge `switch` blocks in business logic.

* * *

3\. **Easy to test**
--------------------

```js
// Jest
test('FlatDiscountStrategy subtracts flat amount', () => {
  const strategy = new FlatDiscountStrategy(100);
  expect(strategy.calculate(1000)).toBe(900);
});
```

Each strategy is a tiny, isolated unit.

* * *

4\. **Runtime flexibility**
---------------------------

Swap behavior dynamically — from DB config, tenant settings, request params.

* * *

When to use Strategy Pattern
============================

*   you have **multiple interchangeable algorithms**
*   behavior changes based on: provider, country, tenant, payment method, carrier, pricing logic
*   you want to add new variants **without touching existing code**

* * *

When NOT to use it
==================

Do **not** use it if:

*   you only have **1 or 2 small conditions**
*   abstraction makes code harder to read

Bad use:

```js
if (isAdmin) {
  // ...
} else {
  // ...
}
```

Don't create 12 classes for that. That's design-pattern cosplay.

* * *

Strategy Pattern vs Factory Pattern
=====================================

**Strategy Pattern** — focuses on **behavior**

> "How should this task be performed?"

**Factory Pattern** — focuses on **object creation**

> "Which object should I create?"

In real apps they are used **together**:

```js
const strategy = getCarrierStrategy(carrier); // Factory
await strategy.createShipment(order);          // Strategy
```

* * *

Interview definition (short answer)
=====================================

> "Strategy Pattern is a behavioral design pattern that allows selecting an algorithm or behavior at runtime by encapsulating each implementation into separate classes or functions behind a common interface."

* * *

Best mental model
=================

If you see code like:

```js
switch (provider) {
  case 'x': ...
  case 'y': ...
  case 'z': ...
}
```

Ask yourself:

> "Can this become a strategy?"

A lot of backend integration code **should** become one.

* * *

Formula:

```
Contract → Multiple Strategies → Context → Optional Factory
```
