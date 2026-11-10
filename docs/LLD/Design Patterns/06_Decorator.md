---
sidebar_position: 6
---

# Decorator Pattern

> **Why this matters in interviews:** Decorator is the answer to "add logging, caching, retries, metrics or auth to this service **without changing it**, and in any combination." It shows up in LLD rounds as the coffee or pizza toppings question, as a notification service that needs retries and rate limiting, and in every discussion of cross-cutting concerns. Interviewers look for: **why not subclassing**, a correct **forwarding base class**, awareness that **the order of wrapping changes behaviour**, and the difference from **Proxy and Adapter**.

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md) (composition over inheritance), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (SRP, OCP), [Strategy](./04_Strategy.md). Examples are in **TypeScript**. For Node.js function-wrapping examples (auth, timing, caching on handlers) see [Decorator Pattern in JS](../../designPatterns/Decorator%20Pattern.md), and for the Express-style pipeline see [Middleware Pattern](../../designPatterns/Middleware%20Pattern.md).

---

## 1. Intent

> **Attach additional responsibilities to an object dynamically. Decorators provide a flexible alternative to subclassing for extending functionality.** (Gang of Four, *structural*)

| Role | What it is | Example |
| --- | --- | --- |
| **Component** (interface) | What clients use | `Fetcher.get(url)` |
| **Concrete component** | The real work | `HttpFetcher` |
| **Decorator** | Implements the **same interface** and holds a component to forward to | `FetcherDecorator` |
| **Concrete decorators** | Add behaviour before or after forwarding | `RetryingFetcher`, `CachingFetcher`, `LoggingFetcher` |

The defining property: **a decorator is-a component and has-a component.** Because the wrapped result has the same type, decorators stack, and the client can't tell how many layers there are.

## 2. The problem: subclass explosion

You need an HTTP client with optional logging, retries and caching. With inheritance:

```
HttpFetcher
├── LoggingHttpFetcher
├── RetryingHttpFetcher
├── CachingHttpFetcher
├── LoggingRetryingHttpFetcher
├── CachingRetryingHttpFetcher
├── LoggingCachingRetryingHttpFetcher
└── ...                                 2^n combinations for n features, fixed at compile time
```

Plus:
- Each feature's code is duplicated or tangled across the combinations.
- You can't add a feature to an object that already exists (a client handed to you by a library).
- A second implementation (`GrpcFetcher`) doubles everything again.

Decorators give you **n small classes** that combine in any order, at runtime, around any implementation of the interface.

## 3. The classic implementation

```ts
interface Fetcher {
  get(url: string): Promise<string>;
}

// The base decorator forwards everything. Concrete decorators override only what they change.
abstract class FetcherDecorator implements Fetcher {
  constructor(protected readonly inner: Fetcher) {}
  get(url: string): Promise<string> {
    return this.inner.get(url);
  }
}

class LoggingFetcher extends FetcherDecorator {
  constructor(inner: Fetcher, private readonly log: (line: string) => void) { super(inner); }

  async get(url: string): Promise<string> {
    const start = Date.now();
    try {
      const body = await this.inner.get(url);
      this.log(`GET ${url} ok ${Date.now() - start}ms`);
      return body;
    } catch (err) {
      this.log(`GET ${url} failed: ${(err as Error).message}`);
      throw err;                                    // decorators must not swallow errors silently
    }
  }
}

class RetryingFetcher extends FetcherDecorator {
  constructor(inner: Fetcher, private readonly retries: number) { super(inner); }

  async get(url: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.inner.get(url);
      } catch (err) {
        if (attempt >= this.retries) throw err;     // (add backoff in real code: see Strategy)
      }
    }
  }
}

class CachingFetcher extends FetcherDecorator {
  private readonly cache = new Map<string, { value: Promise<string>; expiresAt: number }>();

  constructor(inner: Fetcher, private readonly ttlMs: number, private readonly now: () => number = Date.now) {
    super(inner);
  }

  get(url: string): Promise<string> {
    const hit = this.cache.get(url);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    // Cache the PROMISE, not the result: concurrent callers share one in-flight request
    // (no cache stampede). Evict on failure so errors aren't cached.
    const value = this.inner.get(url);
    this.cache.set(url, { value, expiresAt: this.now() + this.ttlMs });
    value.catch(() => {
      if (this.cache.get(url)?.value === value) this.cache.delete(url);
    });
    return value;
  }
}
```

A fake component to show the stacking:

```ts
class FlakyFetcher implements Fetcher {
  calls = 0;
  constructor(private readonly failFirst: number) {}
  async get(url: string): Promise<string> {
    this.calls++;
    if (this.calls <= this.failFirst) throw new Error(`boom #${this.calls}`);
    return `body of ${url}`;
  }
}

const lines: string[] = [];
const origin = new FlakyFetcher(2);
const client: Fetcher = new CachingFetcher(
  new RetryingFetcher(
    new LoggingFetcher(origin, (l) => lines.push(l)),
    3,
  ),
  60_000,
);

await client.get('/users/1');   // fails twice, succeeds on the third attempt
await client.get('/users/1');   // cache hit: origin isn't called
// origin.calls === 3
// lines: 'GET /users/1 failed: boom #1', 'GET /users/1 failed: boom #2', 'GET /users/1 ok <n>ms'
```

- **Why it works:** every decorator is a `Fetcher`, so it can wrap the real one or another decorator. Each concern lives in exactly one class (SRP), and new concerns don't change existing classes (OCP).
- **The base class matters:** it forwards every method, so concrete decorators only override what they change. With a wide interface, forgetting one forwarding method silently breaks behaviour (section 6).
- **Wiring lives in one place** (a factory or composition root), so the rest of the code only sees `Fetcher`.

## 4. Order matters

Decorators run **outside-in on the way in, and inside-out on the way out.** The same three decorators in a different order behave differently:

| Stack (outer → inner) | Behaviour |
| --- | --- |
| Cache → Retry → Log → origin | Cache hits skip everything. Each retry attempt is logged. ✅ (the stack above) |
| Log → Retry → Cache → origin | One log line per logical call, so individual failed attempts are invisible. Fine if that's what you want; a problem when debugging flaky dependencies. |
| Retry → Cache → origin | ❌ A cached failure would be retried against the cache. (Our cache evicts failures, but a naive one wouldn't.) |
| Cache → Auth → origin | ❌ A user who isn't allowed can read a response cached for someone who was. **Auth must be outside the cache**, or the cache key must include the user. |
| Timeout → Retry → origin | A timeout bounds **all** attempts together. Retry → Timeout → origin bounds **each** attempt. Both are valid; pick deliberately. |
| Metrics → Retry → origin | Metrics count logical calls. Retry → Metrics → origin counts each attempt. |

Rule of thumb, outermost first: **auth/validation → cache → metrics → timeout → retry → circuit breaker → the real call.** Then justify any change. Saying "order matters, and here's the order I'd choose and why" is one of the strongest signals in this topic.

## 5. Function decorators (the idiomatic TS/JS form)

When the component is a **function**, a decorator is a higher-order function: it takes a function and returns one with the same signature.

```ts
type AsyncFn<A extends unknown[], R> = (...args: A) => Promise<R>;

function withTiming<A extends unknown[], R>(name: string, fn: AsyncFn<A, R>, report: (name: string, ms: number) => void): AsyncFn<A, R> {
  return async (...args) => {
    const start = performance.now();
    try {
      return await fn(...args);
    } finally {
      report(name, performance.now() - start);   // runs on success and failure
    }
  };
}

function memoizeAsync<A extends unknown[], R>(fn: AsyncFn<A, R>, key: (...args: A) => string = (...a) => JSON.stringify(a)): AsyncFn<A, R> {
  const cache = new Map<string, Promise<R>>();
  return (...args) => {
    const k = key(...args);
    let p = cache.get(k);
    if (!p) {
      p = fn(...args);
      cache.set(k, p);
      p.catch(() => cache.delete(k));              // don't cache failures
    }
    return p;
  };
}

const timings: string[] = [];
let dbCalls = 0;
const loadUser = async (id: string) => { dbCalls++; return { id, name: `user-${id}` }; };

const getUser = withTiming('getUser', memoizeAsync(loadUser), (n) => timings.push(n));
await getUser('7');
await getUser('7');   // dbCalls === 1, timings.length === 2
```

### Language-level decorators (`@decorator`)

Python's `@functools.lru_cache`, TypeScript/ECMAScript decorators and Java annotations processed by Spring AOP (`@Transactional`, `@Cacheable`) are **syntax for applying a wrapper**. TypeScript 5 supports the standard (TC39) decorators without a flag:

```ts
function logged<This, A extends unknown[], R>(
  target: (this: This, ...args: A) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: A) => R>,
) {
  return function (this: This, ...args: A): R {
    calls.push(`${String(context.name)}(${args.join(', ')})`);
    return target.call(this, ...args);
  };
}

const calls: string[] = [];

class Calculator {
  @logged
  add(a: number, b: number): number { return a + b; }
}

new Calculator().add(2, 3);   // calls = ['add(2, 3)']
```

Two caveats to know:
- **Two incompatible systems:** older projects (NestJS, Angular, TypeORM) use `experimentalDecorators`, with a different signature from the standard ones.
- **Class-level decoration applies to every instance.** The GoF pattern decorates **individual objects** at runtime. Both are the same idea, at different times.

## 6. The hard parts

**1. Wide interfaces.** A decorator must forward **every** method. Decorating a 20-method `Repository` to add caching to one method means 19 pass-through methods. Options:
- A base decorator that forwards everything (as above).
- Narrower interfaces (ISP).
- A generic **`Proxy`** wrapper, below.

```ts
// Wraps every method of any object, e.g. for logging. Trades type-level clarity for generality.
function traceAll<T extends object>(target: T, log: (line: string) => void): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        log(`call ${String(prop)}`);
        return value.apply(obj, args);
      };
    },
  });
}
```

**2. Identity and type checks.** The decorated object isn't the original:
- `decorated === original` is false, and `instanceof HttpFetcher` is false. Code that checks concrete types breaks, which is one more reason to depend on interfaces.
- Calls the inner object makes **on itself** (`this.other()`) skip the decorators. Decorating `get` doesn't affect an internal `this.get` call from `getMany`. (Spring has the same issue: "self-invocation bypasses `@Transactional`.")

**3. Stateful decorators.** Caches, rate limiters and circuit breakers hold state. Decide whether each is per instance or shared, how it's invalidated, and whether it's safe under concurrency (the cached-promise trick above).

**4. Debugging.** Five layers mean five stack frames and behaviour that depends on wiring that may be far away. Keep the composition in one visible place, and give decorators names in logs.

**5. Equality, serialization and `this`.** Wrappers can break `this` binding (`value.apply(obj, ...)` above), `JSON.stringify` and `toString`.

## 7. The textbook toppings example, and a better answer

The coffee or pizza question asks you to price a drink with any mix of add-ons:

```ts
interface Beverage { cost(): number; description(): string }

class Espresso implements Beverage {
  cost() { return 200; }
  description() { return 'Espresso'; }
}

abstract class AddOn implements Beverage {
  constructor(protected readonly base: Beverage) {}
  abstract cost(): number;
  abstract description(): string;
}

class Milk extends AddOn {
  cost() { return this.base.cost() + 50; }
  description() { return `${this.base.description()}, milk`; }
}

class Mocha extends AddOn {
  cost() { return this.base.cost() + 80; }
  description() { return `${this.base.description()}, mocha`; }
}

const drink = new Mocha(new Mocha(new Milk(new Espresso())));
drink.cost();          // 200 + 50 + 80 + 80 = 410
drink.description();   // 'Espresso, milk, mocha, mocha'
```

It demonstrates the mechanics. **What a strong candidate adds:** for pricing, a decorator per topping is often the *wrong* model in a real system.
- Toppings are **data**: a list of `{ name, price }` from a menu table.
- New toppings shouldn't need new classes or a deploy.
- Rules like "max 3 toppings," "the second shot is half price" or "remove the milk" are awkward with nested wrappers. You can't easily inspect or remove a layer.

A better design is `Beverage { base; addOns: AddOn[] }` with a pricing [Strategy](./04_Strategy.md). Decorator shines when each layer **adds behaviour** (logging, retries, encryption), not when it adds data. Saying this, after implementing what was asked, shows judgement.

## 8. Decorator in the wild

| Example | What's decorated |
| --- | --- |
| Java I/O: `new BufferedReader(new InputStreamReader(new FileInputStream(f)))` | Streams, the canonical GoF example |
| Node streams: `pipeline(file, zlib.createGzip(), cipher, out)` | Transform streams wrap data flow (decorator-like composition) |
| Python `@functools.lru_cache`, `@retry`, `@login_required` | Functions |
| Spring `@Transactional`, `@Cacheable` (via proxies) | Beans |
| Axios/fetch interceptors, gRPC interceptors | Requests and responses |
| React higher-order components (`withRouter(Component)`) | Components (largely replaced by hooks) |
| Express/Koa middleware | A **chain** around a handler; closely related (see [Middleware](../../designPatterns/Middleware%20Pattern.md)) |
| `java.util.Collections.unmodifiableList(list)`, `synchronizedList(list)` | Collections, restricting or synchronizing access |

## 9. Decorator vs related patterns

| | Decorator | Proxy | Adapter | Chain of Responsibility / middleware | Composite |
| --- | --- | --- | --- | --- | --- |
| Interface | **Same** as the wrapped object | **Same** | **Different**: converts one to another | Same handler signature | Same as the leaves |
| Purpose | **Add** behaviour | **Control access** (lazy loading, remote, auth, caching) | **Make incompatible things fit** | Pass a request along handlers, any of which may stop it | Treat a tree of objects as one |
| Stacking | Designed to stack, in any order | Usually one layer | One layer | A linear chain | A tree |
| Who creates the wrapper | The client, at runtime | Often the framework, and the client doesn't know | The integration layer | The framework or app setup | The client |

Proxy and Decorator have **identical structure**; the difference is intent.
- **Decorator** adds features, and the client composes them.
- **Proxy** controls access to the real object, typically creating or managing it itself. Examples: a lazy-loading proxy, a remote stub, a protection proxy.

Caching sits on the boundary, and either name is defensible if you explain it.

[Adapter](./07_Adapter.md) **changes** the interface, and Decorator **keeps** it.

## 10. In LLD rounds

| Problem | Decorators |
| --- | --- |
| Coffee / pizza / burger pricing | Toppings (then propose the data-driven alternative, section 7) |
| Notification service | `RetryingSender`, `RateLimitedSender`, `LoggingSender` around `EmailSender` / `SmsSender` |
| File storage / streams | Compression → encryption → buffering around a `Storage` |
| Repository / API client | Caching, metrics, timeouts around the data access layer |
| Logger | Timestamping, JSON formatting, filtering by level around a `Logger` |
| Text editor / UI | Scrollbars and borders around a `Window` (the original GoF example) |
| Rate limiter | `RateLimitedHandler` around any request handler |

**A sentence to use:** *"`EmailSender` only sends email. Retries, rate limiting and logging are decorators that implement `NotificationSender` too, wired in one factory in this order: rate limit, then retry, then log, then the real sender. I can reuse the same decorators for `SmsSender` without writing a single subclass."*

## 11. Pitfalls

- **Forgetting to forward** a method in a decorator, which silently changes behaviour.
- **Swallowing errors** in a decorator (a logging decorator that catches and doesn't rethrow).
- **Wrong order:** auth inside a cache, or retries outside a cache that stores failures.
- **Decorators that change the contract:** returning a different type, or throwing on inputs the component accepts. That's an LSP violation, and it's no longer a transparent wrapper.
- **`instanceof` checks** that fail on wrapped objects.
- **Over-wrapping:** ten single-line decorators where two were needed, so the call path becomes hard to follow.
- **Using decorators to model data** (toppings as classes) when a list would do.

## 12. How to talk about it in the room

1. **Name the trigger:** "These are cross-cutting concerns that need to combine freely, and I don't want 2^n subclasses."
2. **Draw the structure:** the interface, a base decorator that forwards, then one or two concrete decorators.
3. **Show the wiring in one place** and say the order out loud, with the reason.
4. **Mention the function form** in TS/JS (`withRetry(fn)`), and language decorators (`@Cacheable`) as syntax for the same idea.
5. **Contrast it with Proxy and Adapter** in one sentence each.
6. **For toppings questions,** implement it, then point out the data-driven alternative.

---

## Interview questions (with crisp answers)

**Q: What problem does Decorator solve?**
Adding responsibilities to individual objects at runtime, in any combination, without changing their class and without a subclass for every combination.

**Q: Why not inheritance?**
Inheritance fixes behaviour at compile time, applies to the whole class, and needs a subclass per combination (2^n). Decorators compose at runtime around any implementation of the interface.

**Q: Decorator vs Proxy?**
Same structure. A decorator **adds** behaviour and is composed by the client, often in stacks. A proxy **controls access** to an object (lazy creation, remote calls, permissions), usually as a single layer that the client doesn't know about.

**Q: Decorator vs Adapter?**
A decorator keeps the interface and adds behaviour. An adapter changes the interface so an incompatible class can be used.

**Q: Does order matter?**
Yes. Each decorator sees the effects of everything inside it. For example, an auth check must be outside a cache, and a timeout outside a retry bounds the total time while a timeout inside it bounds each attempt.

**Q: What are the downsides?**
Many small objects, harder debugging, broken identity and `instanceof` checks, self-calls that skip decorators, and lots of forwarding for wide interfaces.

**Q: How is Express middleware related?**
It's a chain of wrappers around a handler. Each middleware can act before and after `next()`, like a decorator, but each can also stop the chain, like Chain of Responsibility.

## Common mistakes

- Making the decorator extend the concrete class instead of implementing the interface.
- Not holding the wrapped component (re-implementing the behaviour instead of delegating).
- Ignoring order, or caching failures.
- Calling every wrapper a proxy (or vice versa) without being able to explain the difference.
