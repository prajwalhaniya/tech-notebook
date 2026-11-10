---
sidebar_position: 7
---

## Decorator Pattern in JS

> For the interview-depth version (structure, trade-offs, LLD usage, interview questions) see [Decorator in LLD](../LLD/Design%20Patterns/06_Decorator.md).

The **Decorator Pattern** lets you **add behavior to an object or function** without modifying its original code.

Think of it like this:

> "I want to **wrap** this thing with extra behavior — logging, caching, auth — without touching its core logic."

* * *

What is Decorator Pattern?
==========================

It is a **structural design pattern** where:

*   you wrap an existing function or object with another function/object
*   the wrapper adds behavior **before, after, or around** the original
*   the original code stays unchanged

This is the JavaScript equivalent of middleware — but applied at the function or class level.

* * *

Real-world analogy
==================

Think of a **coffee order**:

*   You start with plain coffee
*   Add milk → still coffee, now with milk
*   Add sugar → still coffee, with milk and sugar

Each addition wraps the previous one. The original coffee didn't change — you decorated it.

* * *

Function Decorator (Higher-Order Function)
==========================================

In JavaScript, functions are first-class. The most natural decorator is a **higher-order function** — a function that takes a function and returns a new function.

```js
function withLogging(fn) {
  return async function (...args) {
    console.log(`[${fn.name}] called with`, args);
    const result = await fn(...args);
    console.log(`[${fn.name}] returned`, result);
    return result;
  };
}
```

### Usage

```js
async function getUser(id) {
  return db.query('SELECT * FROM users WHERE id = $1', [id]);
}

const getUSerWithLogging = withLogging(getUser);
await getUSerWithLogging(42);
// [getUser] called with [42]
// [getUser] returned { id: 42, name: 'Prajwal' }
```

The original `getUser` is untouched.

* * *

Real backend decorators
========================

1) Caching Decorator
--------------------

```js
function withCache(fn, cache, ttlSeconds = 300) {
  return async function (...args) {
    const key = `${fn.name}:${JSON.stringify(args)}`;

    const cached = await cache.get(key);
    if (cached) {
      console.log(`[cache hit] ${key}`);
      return JSON.parse(cached);
    }

    const result = await fn(...args);

    await cache.set(key, JSON.stringify(result), ttlSeconds);
    console.log(`[cache set] ${key}`);

    return result;
  };
}
```

### Usage

```js
async function getProduct(productId) {
  return db.query('SELECT * FROM products WHERE id = $1', [productId]);
}

const getCachedProduct = withCache(getProduct, redisClient, 600);

// First call — hits DB, sets cache
await getCachedProduct('PROD001');

// Second call — returns from cache
await getCachedProduct('PROD001');
```

You didn't touch `getProduct`. You layered caching on top.

* * *

2) Retry Decorator
------------------

```js
function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  return async function (...args) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        lastError = err;
        console.warn(`[retry] attempt ${attempt}/${maxRetries} failed: ${err.message}`);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }

    throw lastError;
  };
}
```

### Usage

```js
async function callExternalApi(payload) {
  const res = await fetch('https://api.partner.com/shipment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

const callWithRetry = withRetry(callExternalApi, 3, 500);
await callWithRetry({ orderId: 'ORD123' });
```

* * *

3) Timing / Performance Decorator
-----------------------------------

```js
function withTiming(fn) {
  return async function (...args) {
    const start = performance.now();
    const result = await fn(...args);
    const duration = (performance.now() - start).toFixed(2);
    console.log(`[perf] ${fn.name} took ${duration}ms`);
    return result;
  };
}
```

* * *

4) Auth Guard Decorator
-----------------------

```js
function requireAuth(fn) {
  return async function (req, res, ...rest) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return fn(req, res, ...rest);
  };
}

function requireRole(role, fn) {
  return async function (req, res, ...rest) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return fn(req, res, ...rest);
  };
}
```

### Usage

```js
async function deleteUser(req, res) {
  await userService.delete(req.params.id);
  res.json({ success: true });
}

// Wrap with auth check — no changes to deleteUser
router.delete('/users/:id', requireRole('admin', deleteUser));
```

* * *

5) Rate Limiting Decorator
--------------------------

```js
function withRateLimit(fn, maxCalls, windowMs) {
  const callLog = new Map(); // userId → [timestamps]

  return async function (userId, ...args) {
    const now = Date.now();
    const windowStart = now - windowMs;

    const calls = (callLog.get(userId) || []).filter(t => t > windowStart);

    if (calls.length >= maxCalls) {
      throw new Error(`Rate limit exceeded for user ${userId}`);
    }

    calls.push(now);
    callLog.set(userId, calls);

    return fn(userId, ...args);
  };
}
```

* * *

Composing Multiple Decorators
==============================

The real power: **stack decorators** to build complex behavior.

```js
function compose(...decorators) {
  return (fn) => decorators.reduceRight((wrapped, decorator) => decorator(wrapped), fn);
}
```

### Usage

```js
async function fetchUserData(userId) {
  return db.getUser(userId);
}

const enhance = compose(
  withLogging,
  (fn) => withCache(fn, redis, 300),
  (fn) => withRetry(fn, 3),
  withTiming,
);

const fetchUser = enhance(fetchUserData);

await fetchUser(42);
// [perf] fetchUserData took 12.34ms
// [cache set] fetchUserData:[42]
// [fetchUserData] returned { id: 42 }
```

Each decorator does one thing. The composition does everything.

* * *

Class Method Decorator (Manual)
================================

Without TypeScript decorators, apply them directly in the constructor:

```js
class UserService {
  constructor(db, cache) {
    this.db    = db;
    this.cache = cache;

    // Decorate specific methods at instantiation time
    this.getUser   = withCache(this.getUser.bind(this), cache);
    this.getUser   = withLogging(this.getUser);
    this.deleteUser = requireAuth(this.deleteUser.bind(this));
  }

  async getUser(id) {
    const { rows } = await this.db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  }

  async deleteUser(req, res) {
    await this.db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  }
}
```

* * *

Decorator as a Wrapper Object
==============================

For class instances, you can wrap the whole object:

```js
class LoggingProxy {
  constructor(service) {
    return new Proxy(service, {
      get(target, prop) {
        const original = target[prop];
        if (typeof original !== 'function') return original;

        return async function (...args) {
          console.log(`[${target.constructor.name}.${prop}] called`);
          const result = await original.apply(target, args);
          console.log(`[${target.constructor.name}.${prop}] done`);
          return result;
        };
      }
    });
  }
}

// Usage
const rawService = new PaymentService(stripeClient);
const service    = new LoggingProxy(rawService);

await service.charge(userId, amount);
// [PaymentService.charge] called
// [PaymentService.charge] done
```

This wraps **all methods** automatically without touching each one individually.

* * *

Real-world production pattern
==============================

A typical service function with layered decorators:

```js
// Base function
async function processOrder(orderId) {
  const order = await db.getOrder(orderId);
  await inventoryService.reserve(order);
  await paymentService.charge(order);
  await notificationService.confirm(order);
  return order;
}

// Add cross-cutting concerns
const processOrderSafe = withRetry(
  withTiming(
    withLogging(processOrder)
  ),
  3,       // retries
  1000     // delay
);

// Use everywhere
await processOrderSafe('ORD123');
```

Cross-cutting concerns (logging, timing, retry) are **completely separate** from business logic.

* * *

Benefits
========

1\. **Single Responsibility** — each decorator does one thing.

2\. **Open/Closed Principle** — add behavior without modifying the original.

3\. **Composable** — stack decorators to build complex behavior from simple parts.

4\. **Testable** — test the core function and each decorator separately.

```js
// Test core logic without any cross-cutting concerns
test('processOrder charges the right amount', async () => {
  await processOrder('ORD123'); // no logging, no retry
  expect(mockPayment.charge).toHaveBeenCalledWith(/* ... */);
});

// Test decorator in isolation
test('withRetry retries 3 times on failure', async () => {
  const flaky = jest.fn()
    .mockRejectedValueOnce(new Error('fail'))
    .mockResolvedValue('ok');

  const safe = withRetry(flaky, 3, 0);
  await safe();
  expect(flaky).toHaveBeenCalledTimes(2);
});
```

* * *

When to use Decorator Pattern
==============================

*   **logging** — add logging to any function without modifying it
*   **caching** — layer caching on expensive calls
*   **retry logic** — wrap flaky external API calls
*   **auth/permissions** — guard functions without polluting business logic
*   **rate limiting** — per-user throttling on specific operations
*   **performance monitoring** — timing without modifying core logic
*   **validation** — wrap with input/output validation

* * *

When NOT to use it
==================

*   when a simple `if` inside the function is cleaner
*   when wrapping causes confusion about what `this` refers to (watch for binding issues)
*   when stack traces become too hard to read due to many wrapper layers

* * *

Interview definition (short answer)
=====================================

> "Decorator Pattern adds behavior to a function or object without modifying its source code, using higher-order functions or wrapper objects. It enables composable cross-cutting concerns like logging, caching, and retries."

* * *

Formula:

```
originalFn → decorator(originalFn) → enhancedFn
compose(decorator1, decorator2, decorator3)(originalFn) → fullyEnhancedFn
```
