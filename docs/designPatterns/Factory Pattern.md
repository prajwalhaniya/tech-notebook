---
sidebar_position: 3
---

## Factory Pattern in JS

> For interview depth (Factory Method vs Abstract Factory, static factory methods, LLD usage, and Factory vs Builder vs Strategy), see [LLD → Design Patterns → Factory](../LLD/Design%20Patterns/02_Factory.md). For step-by-step construction, see [Builder](../LLD/Design%20Patterns/03_Builder.md).

The **Factory Pattern** is one of the most common **creational design patterns** in Node.js.

Think of it like this:

> "I don't want to worry about **how** an object is created. I just want the right one."

* * *

What is Factory Pattern?
=========================

It is a **creational design pattern** where:

*   you delegate object creation to a **factory function or class**
*   the caller doesn't need to know the concrete class being instantiated
*   the factory decides which object to create based on input

* * *

Real-world analogy
==================

Think of a logistics company:

*   You call and say: "I need to ship this parcel"
*   The company decides internally: "Use Dunzo for same-day, Shadowfax for next-day"

You don't care about the implementation — the factory picks the right one.

* * *

Types of Factory Pattern
=========================

### 1. Simple Factory

A plain function or object map that returns the right implementation.

### 2. Factory Method Pattern

Subclasses decide which object to create.

### 3. Abstract Factory Pattern

Creates families of related objects.

We'll focus on **Simple Factory** and **Factory Method** as they're most common in Node.js.

* * *

Simple Factory — Function Style
================================

The most idiomatic JS approach: a **function** that returns the right object.

Problem: Create different types of notifications
-------------------------------------------------

```js
class EmailNotification {
  send(message) {
    console.log(`Email: ${message}`);
  }
}

class SmsNotification {
  send(message) {
    console.log(`SMS: ${message}`);
  }
}

class PushNotification {
  send(message) {
    console.log(`Push: ${message}`);
  }
}
```

### Simple Factory Function

```js
function createNotification(type) {
  switch (type) {
    case 'email': return new EmailNotification();
    case 'sms':   return new SmsNotification();
    case 'push':  return new PushNotification();
    default: throw new Error(`Unknown notification type: ${type}`);
  }
}
```

### Usage

```js
const notification = createNotification('email');
notification.send('Your order has been shipped!');
// Email: Your order has been shipped!
```

* * *

Simple Factory — Map Style (preferred)
========================================

Using a **Map or object** instead of `switch` is more scalable — adding a new type requires no changes to the factory logic.

```js
const notificationClasses = {
  email: EmailNotification,
  sms:   SmsNotification,
  push:  PushNotification,
};

function createNotification(type) {
  const NotificationClass = notificationClasses[type];
  if (!NotificationClass) throw new Error(`Unknown notification type: ${type}`);
  return new NotificationClass();
}
```

Adding a new type:

```js
notificationClasses.whatsapp = WhatsAppNotification;
// That's it. No touching the factory function.
```

* * *

Factory Method Pattern
======================

Problem: Different loggers for different environments
------------------------------------------------------

The Factory Method Pattern uses **inheritance** — subclasses override a factory method.

### Base class with factory method

```js
class LoggerFactory {
  // Subclasses override this
  createLogger() {
    throw new Error('createLogger() must be implemented by subclass');
  }

  log(message) {
    const logger = this.createLogger();
    logger.write(message);
  }
}
```

### Concrete loggers

```js
class ConsoleLogger {
  write(message) {
    console.log(`[CONSOLE] ${message}`);
  }
}

class FileLogger {
  write(message) {
    console.log(`[FILE] Writing to file: ${message}`);
  }
}

class CloudLogger {
  write(message) {
    console.log(`[CLOUD] Sending to CloudWatch: ${message}`);
  }
}
```

### Concrete factories

```js
class DevelopmentLoggerFactory extends LoggerFactory {
  createLogger() {
    return new ConsoleLogger();
  }
}

class ProductionLoggerFactory extends LoggerFactory {
  createLogger() {
    return new CloudLogger();
  }
}
```

### Usage based on environment

```js
const factory = process.env.NODE_ENV === 'production'
  ? new ProductionLoggerFactory()
  : new DevelopmentLoggerFactory();

factory.log('Server started on port 3000');
// Dev:  [CONSOLE] Server started on port 3000
// Prod: [CLOUD] Sending to CloudWatch: Server started on port 3000
```

* * *

Real backend use cases in Node.js
==================================

1) Database connection factory
-------------------------------

```js
class PostgresClient {
  async query(sql) {
    console.log(`Postgres: ${sql}`);
  }
}

class MongoClient {
  async query(query) {
    console.log(`Mongo: ${JSON.stringify(query)}`);
  }
}

const dbClients = {
  postgres: PostgresClient,
  mongo:    MongoClient,
};

function createDbClient(type) {
  const Client = dbClients[type];
  if (!Client) throw new Error(`Unknown DB: ${type}`);
  return new Client();
}

// Usage
const db = createDbClient(process.env.DB_TYPE || 'postgres');
await db.query('SELECT * FROM orders');
```

* * *

2) Report generator factory
----------------------------

```js
class CsvReportGenerator {
  generate(data) {
    return data.map(row => Object.values(row).join(',')).join('\n');
  }
}

class JsonReportGenerator {
  generate(data) {
    return JSON.stringify(data, null, 2);
  }
}

class PdfReportGenerator {
  generate(data) {
    // pdf generation logic
    return `PDF with ${data.length} rows`;
  }
}

const reportGenerators = {
  csv:  CsvReportGenerator,
  json: JsonReportGenerator,
  pdf:  PdfReportGenerator,
};

function createReportGenerator(format) {
  const Generator = reportGenerators[format];
  if (!Generator) throw new Error(`Unsupported format: ${format}`);
  return new Generator();
}

// Usage in Express route
app.get('/report', (req, res) => {
  const generator = createReportGenerator(req.query.format);
  const output = generator.generate(data);
  res.send(output);
});
```

* * *

3) Queue job factory
---------------------

```js
class EmailJob {
  async process(payload) {
    await emailService.send(payload.to, payload.subject, payload.body);
  }
}

class SmsJob {
  async process(payload) {
    await smsService.send(payload.phone, payload.text);
  }
}

class ExportJob {
  async process(payload) {
    await exportService.generate(payload.reportId);
  }
}

const jobHandlers = {
  send_email:    EmailJob,
  send_sms:      SmsJob,
  export_report: ExportJob,
};

function createJobHandler(jobType) {
  const Handler = jobHandlers[jobType];
  if (!Handler) throw new Error(`Unknown job type: ${jobType}`);
  return new Handler();
}

// Queue consumer
async function processJob(job) {
  const handler = createJobHandler(job.type);
  await handler.process(job.payload);
}
```

* * *

Registering factories dynamically
===================================

For plugin-based systems, let external code register new types:

```js
class NotificationFactory {
  #registry = new Map();

  register(type, NotificationClass) {
    this.#registry.set(type, NotificationClass);
  }

  create(type) {
    const Cls = this.#registry.get(type);
    if (!Cls) throw new Error(`Unknown notification type: ${type}`);
    return new Cls();
  }
}

const factory = new NotificationFactory();
factory.register('email', EmailNotification);
factory.register('sms',   SmsNotification);

// Any module can register its own type
factory.register('slack', SlackNotification);

const n = factory.create('slack');
n.send('Deployment done!');
```

This is the **open registration** pattern — the factory doesn't need to know about every type upfront.

* * *

Benefits
========

1\. **Centralizes object creation**
-------------------------------------

All creation logic in one place. Easy to change.

* * *

2\. **Hides implementation details**
--------------------------------------

Caller doesn't need to import concrete classes.

* * *

3\. **Easy to extend**
-----------------------

Add a new type without touching the factory function (with the Map pattern).

* * *

4\. **Improves testability**
-----------------------------

Inject a mock factory in tests.

```js
// In test
const mockFactory = { create: () => ({ send: jest.fn() }) };
```

* * *

Factory vs Strategy Pattern
============================

**Factory Pattern** — focuses on **object creation**

> "Which object should I create?"

**Strategy Pattern** — focuses on **behavior at runtime**

> "How should this task be performed?"

In real apps they are used **together**:

```js
const strategy = carrierFactory.create(carrier); // Factory
await strategy.createShipment(order);              // Strategy
```

* * *

When to use Factory Pattern
============================

*   when object creation logic is complex or conditional
*   when you want to decouple object creation from usage
*   when the type of object isn't known until runtime (from DB, config, query param)
*   when you want a **plugin/registry** system

* * *

When NOT to use it
==================

*   when you only ever create one type of object — just use `new` directly
*   when adding a factory adds complexity without benefit

* * *

Interview definition (short answer)
=====================================

> "Factory Pattern is a creational design pattern that provides an interface for creating objects without specifying their exact class. The factory decides which concrete implementation to instantiate based on input."

* * *

Formula:

```
Input/Config → Factory → Correct Object
```
