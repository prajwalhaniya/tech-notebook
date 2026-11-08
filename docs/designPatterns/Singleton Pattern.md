---
sidebar_position: 1
---

## Singleton Pattern in JS

> For interview depth (thread safety, the async-init race, why Singleton is called an anti-pattern, and DI as the alternative), see [LLD → Design Patterns → Singleton](../LLD/Design%20Patterns/01_Singleton.md).

The **Singleton Pattern** ensures a class has **only one instance** throughout the application's lifetime and provides a global access point to it.

Think of it like this:

> "There should be **exactly one** of this — and everyone shares that same one."

* * *

What is Singleton Pattern?
==========================

It is a **creational design pattern** where:

*   a class creates its instance only once
*   all subsequent calls return the same instance
*   the instance is globally accessible

* * *

Real-world analogy
==================

Think of a **database connection pool**:

*   You don't open a new connection every time you run a query
*   You create the pool once and reuse it throughout the app
*   All routes, services, repositories share the same pool

Opening a new connection on every request would be catastrophic for performance.

* * *

The simplest singleton in Node.js: ES Modules
=============================================

Node.js module system **caches modules** — so an exported object is a singleton by default.

```js
// db.js
import pg from 'pg';

const pool = new pg.Pool({
  host:     process.env.DB_HOST,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      20, // max connections in pool
});

export default pool;
```

```js
// userService.js
import pool from './db.js';

export async function getUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}
```

```js
// orderService.js
import pool from './db.js';

export async function getOrdersByUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE user_id = $1', [userId]
  );
  return rows;
}
```

Both `userService` and `orderService` import the **same pool instance** — Node.js caches the module. This is a singleton, zero boilerplate.

* * *

Class-based Singleton
======================

When you need more control — lazy initialization, instance methods, etc.

```js
class DatabasePool {
  static #instance = null;

  #pool;

  constructor() {
    if (DatabasePool.#instance) {
      return DatabasePool.#instance;
    }

    this.#pool = this.#createPool();
    DatabasePool.#instance = this;
  }

  #createPool() {
    // expensive initialization
    console.log('Creating DB pool...');
    return { query: async (sql) => console.log(`Running: ${sql}`) };
  }

  static getInstance() {
    if (!DatabasePool.#instance) {
      new DatabasePool();
    }
    return DatabasePool.#instance;
  }

  async query(sql, params) {
    return this.#pool.query(sql, params);
  }
}

// Usage
const db1 = DatabasePool.getInstance();
const db2 = DatabasePool.getInstance();

console.log(db1 === db2); // true — same instance
```

`#instance` and `#pool` use **private class fields** — nothing external can bypass the singleton.

* * *

Real backend use cases
=======================

1) Config Manager Singleton
----------------------------

```js
// config.js
class Config {
  static #instance = null;
  #settings;

  constructor() {
    if (Config.#instance) return Config.#instance;

    this.#settings = {
      port:        parseInt(process.env.PORT) || 3000,
      env:         process.env.NODE_ENV || 'development',
      dbUrl:       process.env.DATABASE_URL,
      jwtSecret:   process.env.JWT_SECRET,
      redisUrl:    process.env.REDIS_URL,
    };

    Object.freeze(this.#settings); // immutable after creation
    Config.#instance = this;
  }

  static getInstance() {
    if (!Config.#instance) new Config();
    return Config.#instance;
  }

  get(key) {
    return this.#settings[key];
  }

  getAll() {
    return { ...this.#settings }; // return a copy
  }
}

export default Config.getInstance();
```

```js
// Anywhere in the app
import config from './config.js';

console.log(config.get('port'));   // 3000
console.log(config.get('env'));    // 'production'
```

* * *

2) Redis Client Singleton
--------------------------

```js
// redis.js
import { createClient } from 'redis';

class RedisClient {
  static #instance = null;
  #client;

  constructor() {
    if (RedisClient.#instance) return RedisClient.#instance;

    this.#client = createClient({ url: process.env.REDIS_URL });

    this.#client.on('error', (err) => console.error('Redis error:', err));
    this.#client.on('connect', () => console.log('Redis connected'));

    RedisClient.#instance = this;
  }

  static getInstance() {
    if (!RedisClient.#instance) new RedisClient();
    return RedisClient.#instance;
  }

  async connect() {
    if (!this.#client.isOpen) {
      await this.#client.connect();
    }
  }

  async get(key) {
    return this.#client.get(key);
  }

  async set(key, value, ttlSeconds) {
    return this.#client.set(key, value, { EX: ttlSeconds });
  }

  async del(key) {
    return this.#client.del(key);
  }
}

const redis = RedisClient.getInstance();
await redis.connect();

export default redis;
```

```js
// cacheService.js
import redis from './redis.js';

export async function getCachedUser(userId) {
  const cached = await redis.get(`user:${userId}`);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheUser(user, ttl = 300) {
  await redis.set(`user:${user.id}`, JSON.stringify(user), ttl);
}
```

* * *

3) Logger Singleton
-------------------

```js
// logger.js
import winston from 'winston';

class Logger {
  static #instance = null;
  #logger;

  constructor() {
    if (Logger.#instance) return Logger.#instance;

    this.#logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'app.log' }),
      ],
    });

    Logger.#instance = this;
  }

  static getInstance() {
    if (!Logger.#instance) new Logger();
    return Logger.#instance;
  }

  info(message, meta = {})  { this.#logger.info(message, meta); }
  warn(message, meta = {})  { this.#logger.warn(message, meta); }
  error(message, meta = {}) { this.#logger.error(message, meta); }
  debug(message, meta = {}) { this.#logger.debug(message, meta); }
}

export default Logger.getInstance();
```

```js
// orderService.js
import logger from './logger.js';

export async function createOrder(orderData) {
  logger.info('Creating order', { userId: orderData.userId });

  try {
    const order = await db.orders.create(orderData);
    logger.info('Order created', { orderId: order.id });
    return order;
  } catch (err) {
    logger.error('Order creation failed', { error: err.message });
    throw err;
  }
}
```

* * *

4) Event Bus Singleton
-----------------------

A global pub/sub channel — any module can publish or subscribe.

```js
// eventBus.js
import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  static #instance = null;

  constructor() {
    if (EventBus.#instance) return EventBus.#instance;
    super();
    this.setMaxListeners(100); // allow many subscribers
    EventBus.#instance = this;
  }

  static getInstance() {
    if (!EventBus.#instance) new EventBus();
    return EventBus.#instance;
  }
}

export default EventBus.getInstance();
```

```js
// orderService.js — publisher
import eventBus from './eventBus.js';

export async function placeOrder(orderData) {
  const order = await db.orders.create(orderData);
  eventBus.emit('ORDER_PLACED', order);
  return order;
}
```

```js
// emailService.js — subscriber
import eventBus from './eventBus.js';

eventBus.on('ORDER_PLACED', async (order) => {
  await sendConfirmationEmail(order.userId, order.id);
});
```

```js
// analyticsService.js — subscriber
import eventBus from './eventBus.js';

eventBus.on('ORDER_PLACED', (order) => {
  analytics.track('purchase', { orderId: order.id, amount: order.total });
});
```

Different files, same `eventBus` instance — completely decoupled pub/sub.

* * *

Singleton vs Global Variable
=============================

| | Singleton | Global Variable |
|---|---|---|
| Lazy init | Yes (created on first use) | No (always allocated) |
| Controlled access | Yes (via `getInstance()`) | No |
| Encapsulation | Yes (private state) | No |
| Testable | Yes (can be mocked/reset) | Hard |

* * *

Testing with Singletons
========================

Singletons can make testing tricky. Best practice: allow resetting the instance in test environments.

```js
class Config {
  static #instance = null;

  static getInstance() {
    if (!Config.#instance) new Config();
    return Config.#instance;
  }

  // Only for tests
  static _reset() {
    if (process.env.NODE_ENV === 'test') {
      Config.#instance = null;
    }
  }
}
```

Or better — inject the singleton as a dependency:

```js
// Instead of importing directly inside functions:
class UserService {
  constructor(db, cache) { // inject dependencies
    this.db    = db;
    this.cache = cache;
  }

  async getUser(id) {
    return this.cache.get(`user:${id}`) || this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// In tests, pass mocks:
const userService = new UserService(mockDb, mockCache);
```

* * *

Benefits
========

1\. **Controls shared resources** — DB pools, caches, connections.

2\. **Avoids redundant initialization** — expensive setup runs only once.

3\. **Global state with discipline** — controlled access through a single point.

* * *

When to use Singleton Pattern
==============================

*   **DB connection pools** — never create a new pool per request
*   **Config** — read once, reuse everywhere
*   **Logger** — single logger instance across the app
*   **Cache client** — Redis, in-memory cache
*   **Event bus** — global pub/sub
*   **Rate limiters** — shared state across requests

* * *

When NOT to use it
==================

*   when the "single instance" requirement is artificial
*   when it makes testing hard and you can't inject it
*   when it introduces hidden global state that causes subtle bugs

> In Node.js, prefer the **ES module cache** (just export the instance) over custom `getInstance()` boilerplate when you don't need lazy init.

* * *

Interview definition (short answer)
=====================================

> "Singleton Pattern ensures a class has only one instance and provides a global point of access to it. In Node.js this is often achieved naturally through the module system, which caches imports."

* * *

Formula:

```
First call → Create → Cache → All future calls → Return cached
```
