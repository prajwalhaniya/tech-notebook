---
sidebar_position: 2
---

# Factory Pattern (Simple Factory, Factory Method, Abstract Factory)

> **Why this matters in interviews:** almost every LLD problem has a "which concrete class do I create?" moment: the vehicle type in a parking lot, the payment provider at checkout, the notification channel, the chess piece, the vending machine state. Interviewers watch whether creation logic is **centralized and closed for modification** or scattered as `switch` statements across the codebase. They also ask the classic clarification: **"What's the difference between Factory Method and Abstract Factory?"**

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md) (polymorphism), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (OCP, DIP). Examples are in **TypeScript**. For Node.js backend examples (DB client, report generator, queue jobs) see [Factory Pattern in JS](../../designPatterns/Factory%20Pattern.md).

---

## 1. The problem factories solve

```ts
// OrderService.ts: business logic that knows every concrete class
class OrderService {
  notify(order: Order, channel: string) {
    let n;
    if (channel === 'email') n = new EmailNotification(/* SMTP config */);
    else if (channel === 'sms') n = new SmsNotification(/* Twilio keys */);
    else if (channel === 'push') n = new PushNotification(/* FCM creds */);
    n.send(order.userId, 'Order placed');
  }
}
```

What's wrong with this:
- **OCP violation:** adding WhatsApp means editing `OrderService`, and every other place that has the same `if` chain.
- **DIP violation:** high-level business logic depends on low-level concrete classes and their configuration.
- **Duplication:** the same construction knowledge (credentials, defaults) is copied around.
- **Hard to test:** you can't substitute a fake channel without editing the code.

**The core idea of every factory variant:** move the decision *"which concrete class, and how to build it"* into one place, and let clients depend on an **interface**.

## 2. The family at a glance

| Variant | GoF? | Mechanism | Creates | Use when |
| --- | --- | --- | --- | --- |
| **Simple Factory** | No (an idiom) | One function or class with a `switch` or map | One product, chosen by a parameter | The type is decided at runtime from input or config. **The most common in practice.** |
| **Factory Method** | Yes | **Inheritance**: a subclass overrides `createX()` | One product per subclass | A base class owns a workflow, and subclasses decide which product it uses |
| **Abstract Factory** | Yes | **Composition**: an object with several `createX()` methods | A **family** of related products | Products must be **used together and stay consistent** (AWS storage + AWS queue) |
| **Static factory method** | No (Effective Java, Item 1) | A named static method instead of a constructor | An instance of the class (or a subtype) | You want descriptive names, caching or validation, or to return subtypes |

All of them share one interface for the products:

```ts
interface Notification {
  send(to: string, message: string): string;
}

class EmailNotification implements Notification {
  send(to: string, message: string) { return `email:${to}:${message}`; }
}
class SmsNotification implements Notification {
  send(to: string, message: string) { return `sms:${to}:${message}`; }
}
class PushNotification implements Notification {
  send(to: string, message: string) { return `push:${to}:${message}`; }
}
```

## 3. Simple Factory

### a) The `switch` version, made type-safe

```ts
type Channel = 'email' | 'sms' | 'push';

function createNotification(channel: Channel): Notification {
  switch (channel) {
    case 'email': return new EmailNotification();
    case 'sms':   return new SmsNotification();
    case 'push':  return new PushNotification();
    default: {
      const unreachable: never = channel; // compile error if a new Channel isn't handled
      throw new Error(`Unknown channel: ${unreachable}`);
    }
  }
}

createNotification('sms').send('a', 'hi'); // "sms:a:hi"
```

The `never` check is a nice touch to show: add `'whatsapp'` to `Channel` and the compiler points straight at the factory.

- **Pros:** creation lives in one place, and clients depend only on `Notification`.
- **Cons:** the factory itself still has to be **edited** for every new type, so it isn't strictly open/closed.

### b) The registry version: open for extension

```ts
type NotificationCtor = new () => Notification;

class NotificationFactory {
  private readonly registry = new Map<string, NotificationCtor>();

  register(channel: string, ctor: NotificationCtor): this {
    if (this.registry.has(channel)) throw new Error(`Channel already registered: ${channel}`);
    this.registry.set(channel, ctor);
    return this;
  }

  create(channel: string): Notification {
    const Ctor = this.registry.get(channel);
    if (!Ctor) throw new Error(`Unknown channel: ${channel}`);
    return new Ctor();
  }
}

const factory = new NotificationFactory()
  .register('email', EmailNotification)
  .register('sms', SmsNotification);

// A new module adds a channel without touching the factory's code:
factory.register('whatsapp', WhatsAppNotification);
factory.create('whatsapp').send('b', 'yo');
```

- **Pros:** truly **OCP**: plugins register themselves. It's how many frameworks resolve handlers, serializers and drivers.
- **Cons:** you lose the compile-time exhaustiveness check (the keys are strings), and a missing registration only shows up at runtime. Fail fast on startup, and reject duplicates.

If products need different constructor arguments, register **creator functions** instead of classes: `Map<string, (cfg: Config) => Notification>`.

## 4. Factory Method (GoF)

> **Define an interface for creating an object, but let subclasses decide which class to instantiate.**

The base class contains a **workflow** that needs a product. It calls an abstract `createX()` (the *factory method*), and each subclass supplies the concrete product.

```ts
interface Document {
  render(): string;
}
class PdfDocument implements Document { render() { return 'PDF'; } }
class HtmlDocument implements Document { render() { return 'HTML'; } }

abstract class ReportExporter {
  // the factory method
  protected abstract createDocument(): Document;

  // the shared workflow that uses it (often a Template Method)
  export(title: string): string {
    const doc = this.createDocument();
    return `[${title}] ${doc.render()}`;
  }
}

class PdfExporter extends ReportExporter {
  protected override createDocument(): Document { return new PdfDocument(); }
}
class HtmlExporter extends ReportExporter {
  protected override createDocument(): Document { return new HtmlDocument(); }
}

new PdfExporter().export('Q3');  // "[Q3] PDF"
new HtmlExporter().export('Q3'); // "[Q3] HTML"
```

```text
 ReportExporter (abstract)            Document (interface)
 + export()  ──calls──▶ createDocument()      ▲
        ▲                                     │
  ┌─────┴──────┐                    ┌─────────┴────────┐
 PdfExporter  HtmlExporter        PdfDocument    HtmlDocument
 createDocument() → new PdfDocument / new HtmlDocument
```

- **Why it works:** `export()` is written once against the `Document` interface. Adding Excel means adding `ExcelExporter` and `ExcelDocument`, with no edits to existing code.
- **When it's preferable:** you have a **framework or base class with a fixed algorithm** and want subclasses to plug in one varying object.
- **Limitations:** a parallel class hierarchy (one creator subclass per product), and it's inheritance-based, so you can't switch the product at runtime. When the workflow isn't shared, a simple factory or plain dependency injection is lighter.

**Real-world examples:** `Iterable.iterator()` in Java (each collection decides which iterator to create), JS `[Symbol.iterator]()`, and `Thread`/`Executor` thread factories.

## 5. Abstract Factory (GoF)

> **Provide an interface for creating families of related or dependent objects without specifying their concrete classes.**

The key word is **families**: products that must be used **together**. Mixing them would be a bug (AWS S3 storage with GCP Pub/Sub notifications, a dark-theme button with a light-theme dialog).

```ts
interface BlobStorage  { put(key: string, data: string): string }
interface MessageQueue { publish(topic: string, msg: string): string }

interface CloudFactory {           // the abstract factory: one method per product
  createStorage(): BlobStorage;
  createQueue(): MessageQueue;
}

class S3Storage   implements BlobStorage  { put(k: string) { return `s3://${k}`; } }
class SqsQueue    implements MessageQueue { publish(t: string) { return `sqs:${t}`; } }
class GcsStorage  implements BlobStorage  { put(k: string) { return `gs://${k}`; } }
class PubSubQueue implements MessageQueue { publish(t: string) { return `pubsub:${t}`; } }

class AwsFactory implements CloudFactory {   // concrete factory = one consistent family
  createStorage() { return new S3Storage(); }
  createQueue()   { return new SqsQueue(); }
}
class GcpFactory implements CloudFactory {
  createStorage() { return new GcsStorage(); }
  createQueue()   { return new PubSubQueue(); }
}

class UploadService {
  private readonly storage: BlobStorage;
  private readonly queue: MessageQueue;

  constructor(cloud: CloudFactory) {         // the client only knows the abstract factory
    this.storage = cloud.createStorage();
    this.queue = cloud.createQueue();
  }

  upload(key: string, data: string): string[] {
    return [this.storage.put(key, data), this.queue.publish('uploaded', key)];
  }
}

new UploadService(new AwsFactory()).upload('a.png', 'x'); // ["s3://a.png", "sqs:uploaded"]
new UploadService(new GcpFactory()).upload('a.png', 'x'); // ["gs://a.png", "pubsub:uploaded"]
```

- **Why it works:** choosing the factory **once** (at the composition root, from config) guarantees every product comes from the same family. Inconsistent combinations become impossible.
- **When it's preferable:** multi-cloud or multi-vendor adapters, UI themes and toolkits (light/dark, iOS/Android widgets), database drivers (a connection creates matching statements and transactions), and test vs production families (fake storage + fake queue).
- **Limitations:** **adding a new product type** (say a `createCache()`) means changing the interface **and every concrete factory**. It's easy to add a new *family*, hard to add a new *product*. It's also heavyweight when there's only one product. That's just a factory method or simple factory.

### Factory Method vs Abstract Factory (the most-asked question)

| | Factory Method | Abstract Factory |
| --- | --- | --- |
| Mechanism | **Inheritance**: subclasses override one method | **Composition**: you're handed a factory object |
| Creates | **One** product | A **family** of related products |
| The variation lives in | The creator subclass | The concrete factory object |
| Typical shape | `abstract createDocument()` inside a class with other logic | An interface made only of `createA()`, `createB()`, ... |
| Relationship | The methods of an Abstract Factory are often implemented as factory methods | |

One-liner: *"Factory Method lets a subclass pick **one** product. Abstract Factory is an object that produces a **matching set** of products."*

## 6. Static factory methods (named constructors)

```ts
class Money {
  private static readonly ZERO_CACHE = new Map<string, Money>();
  private constructor(readonly cents: number, readonly currency: string) {}

  static ofCents(cents: number, currency: string): Money {
    if (!Number.isInteger(cents)) throw new Error('cents must be an integer');
    if (cents === 0) return Money.zero(currency);   // can return a cached instance
    return new Money(cents, currency);
  }

  static of(amount: number, currency: string): Money {
    return Money.ofCents(Math.round(amount * 100), currency); // intent-revealing name
  }

  static zero(currency: string): Money {
    let z = Money.ZERO_CACHE.get(currency);
    if (!z) { z = new Money(0, currency); Money.ZERO_CACHE.set(currency, z); }
    return z;
  }
}

Money.of(12.34, 'USD').cents;        // 1234
Money.of(0.1 + 0.2, 'USD').cents;    // 30, because rounding hides float error
Money.zero('USD') === Money.ofCents(0, 'USD'); // true (cached)
```

**Advantages over constructors** (Effective Java, Item 1):
- **Names:** `Money.of(...)`, `Money.zero()`, `Duration.ofMinutes(5)`.
- **Can return cached or shared instances** (`Integer.valueOf` caches -128..127, `Boolean.valueOf`).
- **Can return a subtype** or a hidden implementation class (Java's `EnumSet.of` returns a `RegularEnumSet` or a `JumboEnumSet` depending on how many constants the enum type has, and callers never know).
- **Can validate or normalize** before construction, and keep the constructor private.

**Real-world examples:** `Array.from`, `Array.of`, `Promise.resolve`, `Object.create`, `document.createElement('div')` (a simple factory keyed by tag name), Node's `crypto.createHash('sha256')`, `React.createElement`, Java's `List.of` / `Optional.of`.

## 7. Factories in LLD problems

### Parking lot: create the vehicle from its type

```ts
enum VehicleType { Bike = 'BIKE', Car = 'CAR', Truck = 'TRUCK' }
enum SpotSize { Small = 1, Medium = 2, Large = 3 }

abstract class Vehicle {
  constructor(readonly plate: string) {}
  abstract readonly type: VehicleType;
  abstract readonly requiredSpot: SpotSize;
}
class Bike  extends Vehicle { readonly type = VehicleType.Bike;  readonly requiredSpot = SpotSize.Small; }
class Car   extends Vehicle { readonly type = VehicleType.Car;   readonly requiredSpot = SpotSize.Medium; }
class Truck extends Vehicle { readonly type = VehicleType.Truck; readonly requiredSpot = SpotSize.Large; }

// Record<VehicleType, ...> makes the compiler insist every enum value has a constructor
const vehicleCtors: Record<VehicleType, new (plate: string) => Vehicle> = {
  [VehicleType.Bike]: Bike,
  [VehicleType.Car]: Car,
  [VehicleType.Truck]: Truck,
};

function createVehicle(type: VehicleType, plate: string): Vehicle {
  return new vehicleCtors[type](plate);
}

createVehicle(VehicleType.Truck, 'KA01').requiredSpot; // SpotSize.Large
```

`Record<VehicleType, ...>` gives you the registry's openness **and** compile-time exhaustiveness.

### Other common LLD spots

| Problem | Factory creates | Variant |
| --- | --- | --- |
| Payment / checkout | `PaymentGateway` (Stripe, PayPal, Razorpay) per provider | Simple factory / registry |
| Notification service | `Notification` channel per user preference | Registry |
| Chess / board games | `Piece` from a symbol (`'K'`, `'Q'`) | Simple factory |
| Vending machine / ATM | `State` objects | Simple factory (often with cached instances) |
| Cross-platform UI | Button + Menu + Dialog per OS or theme | Abstract factory |
| File parser / importer | `Parser` per file extension | Registry |
| Logger / exporter frameworks | Log sink or document per subclass | Factory method |

### Inject the factory so business logic stays testable

```ts
interface PaymentGateway { charge(cents: number): string }
type GatewayFactory = (provider: string) => PaymentGateway;

class CheckoutService {
  constructor(private readonly gatewayFor: GatewayFactory) {}

  pay(provider: string, cents: number): string {
    return this.gatewayFor(provider).charge(cents);
  }
}

// in a test: a fake factory that records calls
const calls: string[] = [];
const fakeFactory: GatewayFactory = (p) => ({ charge: (c) => { calls.push(`${p}:${c}`); return 'ok'; } });
new CheckoutService(fakeFactory).pay('stripe', 500); // "ok", and calls = ["stripe:500"]
```

In TS, a factory is often just a **function type**. You don't need a `FactoryFactory` class.

## 8. Factory vs related patterns

| Pattern | Question it answers | Relationship to Factory |
| --- | --- | --- |
| **Strategy** | *How* should this be done? (swap the behaviour) | A factory often **picks** the strategy: `const s = factory.create(type); s.execute()` |
| **Builder** | How do I assemble **one complex object** step by step? | Factory picks *which* class in one call. Builder configures *how* one object is assembled. See [Builder](./03_Builder.md). |
| **Singleton** | How many instances? | Factories (and their registries) are often single instances. Factories can also return cached singletons. See [Singleton](./01_Singleton.md). |
| **Prototype** | Create by cloning an existing object | An alternative to factories when configuring from scratch is expensive |
| **Dependency injection** | Who wires objects together? | A DI container is essentially a big, configurable factory. Use factories for objects created **at runtime per request**, and DI for the long-lived graph. |

## 9. Pitfalls

- **God factory:** one `createAnything(type)` with 40 branches. Split it per product family.
- **Returning concrete types** (`createNotification(): EmailNotification`), which defeats the point. Return the interface.
- **Factories for one class:** if there's only ever `new UserService()`, a factory adds indirection without benefit.
- **Hidden configuration:** a factory that reads `process.env` deep inside makes behaviour hard to trace. Pass config in.
- **Silent fallbacks:** `default: return new EmailNotification()` hides typos. Throw on unknown types.
- **Confusing Factory with Builder:** if the caller is passing 10 options into `create(...)`, you probably want a builder (or an options object).

---

## Interview questions (with crisp answers)

**Q: Factory Method vs Abstract Factory?**
Factory Method uses inheritance so a subclass decides **one** product. Abstract Factory is an object that creates a **family** of related products, keeping them consistent.

**Q: Is Simple Factory a GoF pattern?**
No. It's an idiom. GoF defines Factory Method and Abstract Factory. Simple Factory is still the most used.

**Q: How does a factory support SOLID?**
DIP: clients depend on interfaces, not concrete classes. OCP: new types are added by registering, not by editing clients (fully OCP with a registry). SRP: construction knowledge lives in one place.

**Q: A `switch` in a factory still violates OCP. Is that bad?**
It's contained in one place, which is a big improvement over scattered `switch` statements. If types are added often or by third parties, use a registry. In TS, the `never` exhaustiveness check makes the `switch` safe to extend.

**Q: Factory vs Strategy?**
Factory is about **creating** the right object, and Strategy is about **behaviour** that's swappable at runtime. They're usually combined: the factory returns a strategy.

**Q: Factory vs Builder?**
Factory: "which implementation?", usually one call. Builder: "how do I assemble this complex object?", step by step with validation.

**Q: When is Abstract Factory overkill?**
When there's a single product type, or families never need to be swapped. Adding a new product type to an abstract factory forces changes to every concrete factory.

## Common mistakes

- Answering "Factory Method" when you mean a simple factory function. Know the difference.
- Exposing concrete classes from the factory's return type.
- Unknown type gives a silent default instead of an error.
- Building an Abstract Factory for a single product.
- Using a factory to set many optional fields, which is a job for a Builder.
