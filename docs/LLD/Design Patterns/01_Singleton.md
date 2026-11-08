---
sidebar_position: 1
---

# Singleton Pattern

> **Why this matters in interviews:** Singleton is the pattern candidates reach for first and interviewers question most. In an LLD round (Parking Lot, Elevator, Logger, Rate Limiter) you'll be asked "should this be a singleton?", "how do you make it thread-safe?" and "how would you test code that uses it?". A strong answer knows how to build one, **and when not to**: it can explain why many teams treat Singleton as an anti-pattern and replace it with dependency injection.

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md). Examples are in **TypeScript**, with Java and C++ notes where interviews commonly go. For Node.js production examples (DB pool, Redis client, logger, event bus) see [Singleton Pattern in JS](../../designPatterns/Singleton%20Pattern.md).

---

## 1. Intent

> **Ensure a class has only one instance, and provide a global point of access to it.** (Gang of Four, *creational* pattern)

The definition makes two separate promises, and that matters later:

1. **Uniqueness:** at most one instance exists.
2. **Global access:** anyone can reach it without being handed it.

Most of Singleton's problems come from promise 2. Most of its legitimate uses only need promise 1.

### When a single instance is genuinely right

| Good fit | Why one instance |
| --- | --- |
| Connection pool (DB, HTTP agent) | Multiple pools would fight over the same connection limit |
| In-process cache, rate-limiter state | The state must be shared to be correct |
| Configuration loaded at startup | Read once, immutable, consistent everywhere |
| Logger / metrics registry | One sink, one buffer, consistent formatting |
| Hardware or OS resource owner (a printer spooler, a GPIO pin) | Two owners would corrupt the resource |
| ID generator within a process | Two generators could hand out duplicate IDs |

**A smell:** "I only need one right now" is not the same as "there must never be two". A `ParkingLot`, `ShoppingCart` or `Game` is usually **one per context**, not one per universe. A chain of parking lots, two carts in a test, or a second game on the server breaks the assumption.

## 2. Structure

```text
┌──────────────────────────────┐
│           Singleton          │
├──────────────────────────────┤
│ - static instance: Singleton │  ← the only instance, held by the class
│ - constructor()  (private)   │  ← nobody else can call `new`
├──────────────────────────────┤
│ + static getInstance()       │  ← creates it on first call, returns it after
│ + businessMethod()           │
└──────────────────────────────┘
```

There are three ingredients: a **private constructor**, a **static field** holding the instance, and a **static accessor**.

## 3. Implementations in TypeScript

### a) Lazy initialization (the classic)

```ts
class Logger {
  private static instance: Logger | null = null;
  private readonly lines: string[] = [];

  private constructor() {}            // blocks `new Logger()` at compile time

  static getInstance(): Logger {
    if (Logger.instance === null) {
      Logger.instance = new Logger(); // created on first use
    }
    return Logger.instance;
  }

  log(msg: string): void {
    this.lines.push(`${new Date().toISOString()} ${msg}`);
  }

  count(): number {
    return this.lines.length;
  }
}

const a = Logger.getInstance();
const b = Logger.getInstance();
console.log(a === b); // true

new Logger(); // ❌ TS error: Constructor of class 'Logger' is private
```

- **Pros:** it doesn't pay the construction cost until the instance is needed.
- **Cons:** TypeScript's `private` exists **only at compile time**. Plain JS callers, `as any` casts and tests can still call `new`. See (c) for runtime enforcement.

### b) Eager initialization

```ts
class IdGenerator {
  static readonly instance = new IdGenerator(); // created when the class is defined
  private next = 1;
  private constructor() {}

  nextId(): number {
    return this.next++;
  }
}

IdGenerator.instance.nextId(); // 1
IdGenerator.instance.nextId(); // 2
```

- **Pros:** simplest. No null checks. In Java, it's thread-safe for free (class initialization is guarded by the JVM).
- **Cons:** it's constructed even if never used. Construction errors happen at load time, and the class can't take runtime parameters.

### c) Runtime-enforced (true privacy with `#private` fields)

```ts
class Config {
  static #instance: Config | undefined;
  static #constructing = false;
  readonly #settings: Readonly<Record<string, string>>;

  constructor() {
    if (!Config.#constructing) {
      throw new Error('Use Config.getInstance()');  // blocks `new` even from plain JS
    }
    this.#settings = Object.freeze({ env: process.env.NODE_ENV ?? 'development' });
  }

  static getInstance(): Config {
    if (!Config.#instance) {
      Config.#constructing = true;
      try {
        Config.#instance = new Config();
      } finally {
        Config.#constructing = false;
      }
    }
    return Config.#instance;
  }

  get(key: string): string | undefined {
    return this.#settings[key];
  }
}

new Config(); // throws at runtime: "Use Config.getInstance()"
```

`#instance` and `#settings` are **real** private fields (ECMAScript, not just TypeScript), so nothing outside the class can read or replace them.

### d) The idiomatic JS/TS singleton: the module itself

```ts
// logger.ts
class Logger { /* ... */ }
export const logger = new Logger(); // module code runs once, and every importer gets this object
```

Node.js (CommonJS and ESM) and bundlers **evaluate a module once and cache it**, so an exported instance is a process-wide singleton with zero boilerplate. **This is the answer most JS interviewers expect** for "how would you do a singleton in Node?" Follow it with: *"...but I'd rather inject it than import it everywhere"* (section 7).

## 4. The concurrency question

### Java: the interview classic

A lazy singleton with a plain `if (instance == null)` is **not thread-safe**: two threads can both see `null` and create two instances.

```java
// 1. Synchronized accessor: correct but slow (it locks on every call)
public static synchronized Logger getInstance() { ... }

// 2. Double-checked locking: `volatile` is REQUIRED (Java 5+ memory model).
//    Without it, another thread can see a partially constructed object.
private static volatile Logger instance;
public static Logger getInstance() {
    if (instance == null) {                    // 1st check, no lock (the fast path)
        synchronized (Logger.class) {
            if (instance == null) {            // 2nd check, under the lock
                instance = new Logger();
            }
        }
    }
    return instance;
}

// 3. Initialization-on-demand holder (Bill Pugh): lazy AND thread-safe, with no locking code.
//    The JVM initializes Holder only when getInstance() first touches it.
public class Logger {
    private Logger() {}
    private static class Holder { static final Logger INSTANCE = new Logger(); }
    public static Logger getInstance() { return Holder.INSTANCE; }
}

// 4. Enum singleton: Effective Java's recommendation (Item 3).
//    Safe against reflection and serialization attacks for free.
public enum Logger { INSTANCE; public void log(String m) { ... } }
```

**C++11 and later:** a function-local static (`static Logger& instance() { static Logger inst; return inst; }`, the "Meyers singleton") is guaranteed thread-safe to initialize.

### JavaScript: "it's single-threaded, so it's safe"... not quite

The JS event loop runs your code on one thread, so the synchronous check-then-create is atomic. But **asynchronous initialization reintroduces the race**:

```ts
class BrokenDb {
  private static instance: { id: number } | null = null;

  static async getInstance() {
    if (!BrokenDb.instance) {
      BrokenDb.instance = await connect();   // ❌ the await yields, so a 2nd caller also sees null
    }
    return BrokenDb.instance;
  }
}

await Promise.all([BrokenDb.getInstance(), BrokenDb.getInstance()]); // connect() runs TWICE
```

**Fix: cache the Promise, not the result.** Assign it synchronously, before anything awaits.

```ts
class Db {
  private static instancePromise: Promise<{ id: number }> | null = null;

  static getInstance(): Promise<{ id: number }> {
    if (!Db.instancePromise) {
      Db.instancePromise = connect().catch((err) => {
        Db.instancePromise = null;   // don't cache a failure forever: allow a retry
        throw err;
      });
    }
    return Db.instancePromise;       // every concurrent caller awaits the same promise
  }
}

await Promise.all([Db.getInstance(), Db.getInstance(), Db.getInstance()]); // connect() runs ONCE
```

This is the same idea as request coalescing ("single-flight"), and it's worth naming in system design too.

## 5. "Single" is relative: what actually counts as one instance

| Boundary | How many instances you really get |
| --- | --- |
| One Node.js process | One per module instance |
| `worker_threads` | **One per worker.** Each worker has its own isolate and module graph. |
| `cluster`, PM2, multiple containers or pods | **One per process.** 8 pods means 8 "singletons". |
| Serverless (Lambda) | One per warm container, reused across invocations, so it's a good place for SDK clients |
| Two copies of a package in `node_modules` (version mismatch) | **Two instances.** This is the classic "duplicate React" / `instanceof` failure. |
| The same package loaded through both `require` and `import` | Possibly two: Node's **dual package hazard** |
| Jest test files | One per test file (Jest isolates the module registry per file) |

**Interview line:** *"A singleton is unique per runtime, not per system. If I need exactly one across machines (one scheduler, one leader), that's **leader election or a distributed lock**, not the Singleton pattern."* That links LLD to HLD.

## 6. Ways a singleton gets broken (and defenses)

| Attack | Language | Defense |
| --- | --- | --- |
| Calling the constructor directly | TS (`private` is compile-time only) | `#private` + a construction guard (3c), or the module singleton (3d) |
| Reflection (`setAccessible(true)` on the constructor) | Java | Throw from the constructor if the instance already exists, or use an **enum** singleton |
| Deserialization creating a new instance | Java | Implement `readResolve()` to return the instance, or use an enum |
| `clone()` | Java | Don't implement `Cloneable`, or throw from `clone()` |
| Subclassing | All | `final` class (Java), private constructor (TS) |
| Multiple class loaders or module copies | Java / Node | Load it from a single parent class loader, dedupe dependencies (`npm ls <pkg>`) |

## 7. Why Singleton is often called an anti-pattern

| Problem | What goes wrong |
| --- | --- |
| **Hidden dependencies** | `OrderService` calls `Db.getInstance()` internally, so its constructor no longer tells you what it needs. That breaks the explicit-dependency idea behind DIP. |
| **Hard to test** | You can't substitute a fake without monkey-patching, and state **leaks between tests** because the instance outlives each test |
| **Global mutable state** | Any code can change it, so action at a distance makes for order-dependent bugs |
| **Violates SRP** | The class does its job **and** controls its own lifecycle and cardinality |
| **Tight coupling** | Callers depend on the concrete class (`Logger.getInstance()`), not on an interface |
| **Concurrency contention** | One shared object becomes a lock hotspot in multi-threaded runtimes |
| **Inflexible** | "Exactly one" requirements change (multi-tenant, per-request, per-region), and then every call site must change |

### The fix: keep the "one instance", drop the "global access"

Write a **normal class**, depend on an **interface**, and create **one instance at the composition root** (`main`, the app bootstrap, or a DI container) that's passed to whoever needs it.

```ts
interface Clock { now(): number }

class SystemClock implements Clock { now() { return Date.now(); } }
class FakeClock implements Clock {
  constructor(private t: number) {}
  now() { return this.t; }
}

class SessionService {
  constructor(private readonly clock: Clock) {}   // the dependency is explicit
  isExpired(expiresAt: number): boolean {
    return this.clock.now() >= expiresAt;
  }
}

// composition root: exactly one SystemClock in production
const clock = new SystemClock();
const sessions = new SessionService(clock);

// tests: no global state, no reset hacks
new SessionService(new FakeClock(100)).isExpired(50); // true
```

DI frameworks make this the default. **NestJS** providers and **Spring** beans are singleton-scoped by default (one per container), and **InversifyJS** has `.inSingletonScope()`. You get one instance without the class knowing it's a singleton. That's the modern answer.

### If you must keep a classic singleton: make it resettable for tests

```ts
class FeatureFlags {
  private static instance: FeatureFlags | null = null;
  private flags = new Map<string, boolean>();
  private constructor() {}

  static getInstance(): FeatureFlags {
    return (FeatureFlags.instance ??= new FeatureFlags());
  }

  /** @internal test-only */
  static resetForTests(): void {
    FeatureFlags.instance = null;
  }

  enable(flag: string) { this.flags.set(flag, true); }
  isOn(flag: string) { return this.flags.get(flag) ?? false; }
}

// in a test's afterEach: FeatureFlags.resetForTests();
```

## 8. Variants worth knowing

### Multiton: one instance per key

```ts
class TenantCache {
  private static readonly instances = new Map<string, TenantCache>();
  private readonly data = new Map<string, unknown>();
  private constructor(readonly tenantId: string) {}

  static for(tenantId: string): TenantCache {
    let cache = TenantCache.instances.get(tenantId);
    if (!cache) {
      cache = new TenantCache(tenantId);
      TenantCache.instances.set(tenantId, cache);
    }
    return cache;
  }
}

TenantCache.for('acme') === TenantCache.for('acme');   // true
TenantCache.for('acme') === TenantCache.for('globex'); // false
```

It's useful for per-tenant or per-region resources. Watch for **unbounded growth**: evict entries, or use a `WeakMap` when the keys are objects.

### Scoped lifetimes (from DI containers)

| Scope | Instances | Example |
| --- | --- | --- |
| Singleton | One per container or app | Connection pool, config |
| Request (scoped) | One per HTTP request | Request context, unit of work, per-request DB transaction |
| Transient | A new one on every resolution | Lightweight stateless helpers |

## 9. Singleton vs the alternatives

| | Singleton | Static class / module of functions | Global variable | DI-managed single instance |
| --- | --- | --- | --- | --- |
| Can implement an interface | ✅ | ❌ | ✅ | ✅ |
| Lazy initialization | ✅ | n/a | ❌ | ✅ |
| Polymorphism (swap the implementation) | Hard | ❌ | ✅ (but unsafe) | ✅ |
| State | ✅ | Module-level only | ✅ | ✅ |
| Testability | Poor (needs a reset or monkey-patching) | Poor if stateful | Poor | **Good** |
| Explicit dependencies | ❌ | ❌ | ❌ | ✅ |

**Static class vs Singleton (a common question):** use a static/utility class for **stateless** helpers (`Math`, string utilities). Use a single instance when there's **state**, a need to implement an **interface**, lazy initialization, or a wish to substitute the implementation later.

## 10. In LLD rounds

- **Parking Lot:** the classic solution makes `ParkingLot` a singleton (see [Design a Parking Lot](../01_Design%20a%20parking%20lot.md)). Say the trade-off out loud: *"I'll treat it as a single instance for this exercise, but I'd create it at the composition root and inject it, so a multi-lot chain or tests can create several."*
- **Logger, IdGenerator, Configuration:** reasonable singletons. Say "single instance, injected".
- **Elevator system:** one `ElevatorController` per building, not per process, so it's a scoped instance, not a global.
- **Rate limiter:** one in-memory limiter per process, which means limits are per instance. For a global limit, move the state to Redis (it becomes an HLD conversation).

---

## Interview questions (with crisp answers)

**Q: Implement a thread-safe singleton.**
In Java, use the holder idiom or an enum. Double-checked locking needs `volatile`. In JS, the sync version is already safe. For async init, cache the Promise.

**Q: Why is Singleton considered an anti-pattern?**
It's global mutable state with hidden dependencies, it's hard to test, it violates SRP and DIP, and "exactly one" rarely survives requirement changes. Keep the single instance but inject it.

**Q: How do you unit test code that uses a singleton?**
Ideally, refactor so the dependency is injected through an interface. Otherwise add a test-only reset, or mock the module (`jest.mock`). Reset state in `afterEach`.

**Q: Singleton vs static class?**
A singleton is an object: it can implement interfaces, be passed around, be lazily created and be swapped. A static class can't. Use static for stateless utilities.

**Q: Is a Node.js module export a singleton?**
Yes, per process and per resolved module path. It isn't across workers, cluster processes, duplicate package copies or Jest test files.

**Q: How would you guarantee one instance across a cluster of servers?**
That's not this pattern. Use leader election (etcd, ZooKeeper, a Kubernetes lease) or a distributed lock with fencing tokens.

**Q: How can a Java singleton be broken?**
Reflection, serialization, cloning and multiple class loaders. An enum singleton defends against the first two.

## Common mistakes

- Making something a singleton because there's "only one right now" (cart, game, parking lot).
- Relying on TS `private` as a runtime guarantee.
- Async lazy init that caches the *result* instead of the *Promise*.
- Caching a rejected init Promise forever, so the app can never recover.
- Calling `getInstance()` deep inside business logic instead of injecting it.
- Forgetting that "one" means one per process, not one per system.
