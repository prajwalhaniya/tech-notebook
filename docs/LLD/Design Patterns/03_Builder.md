---
sidebar_position: 3
---

# Builder Pattern

> **Why this matters in interviews:** Builder shows up whenever an LLD object has **many optional parts and rules about how they combine**: a pizza or burger order, an HTTP request, a search query, a car configuration, a notification message, a test fixture. Interviewers look for three things: that you can explain the **telescoping-constructor problem** it solves, that your built objects are **valid and immutable**, and, for a JS/TS candidate, that you know **when an options object is enough** and a builder is ceremony.

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md) (encapsulation, invariants), [Factory](./02_Factory.md). Examples are in **TypeScript**.

---

## 1. Intent

> **Separate the construction of a complex object from its representation, so that the same construction process can create different representations.** (Gang of Four, *creational*)

In practice, "Builder" means two related things:

| Flavour | Origin | What it's for |
| --- | --- | --- |
| **Fluent builder** | *Effective Java*, Item 2 ("consider a builder when faced with many constructor parameters") | Constructing **one** object with many optional fields, readably and validly. This is what interviewers usually mean. |
| **GoF builder + director** | *Design Patterns* (1994) | Running the **same construction steps** to produce **different representations** (a Markdown vs an HTML report) |

## 2. The problem: telescoping constructors

```ts
class HttpRequestTelescoping {
  constructor(
    readonly url: string,
    readonly method: string = 'GET',
    readonly headers: Record<string, string> = {},
    readonly body?: string,
    readonly timeoutMs: number = 30_000,
    readonly retries: number = 0,
  ) {}
}

new HttpRequestTelescoping('https://x', 'POST', {}, undefined, 5000, 3);
//                                               ^^  ^^^^^^^^^  ^^^^  ^ which is which?
```

The problems:
- **Unreadable call sites:** positional arguments with the same types are easy to swap (`5000, 3` vs `3, 5000` compiles fine).
- **You pass placeholders** (`{}`, `undefined`) to reach a later parameter.
- **No place for cross-field validation:** "a GET has no body", "retries on a POST need an idempotency key".
- The JavaBeans alternative (`new X()` then setters) creates **objects that are invalid and mutable** between calls.

## 3. First, the idiomatic TS answer: an options object

```ts
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

function makeRequest(url: string, opts: RequestOptions = {}) {
  const { method = 'GET', headers = {}, body, timeoutMs = 30_000, retries = 0 } = opts;
  return Object.freeze({ url, method, headers: { ...headers }, body, timeoutMs, retries });
}

makeRequest('https://x', { method: 'POST', retries: 3 }); // named, order-free, with defaults
```

JS/TS have object literals and destructuring with defaults, which give **named, optional parameters for free**. That alone solves most of what a Java builder exists for. **Say this in an interview:** it shows judgment, not just pattern recall.

### When a builder still earns its place

| Need | Options object | Builder |
| --- | --- | --- |
| Named, optional parameters | ✅ | ✅ |
| Cross-field validation before the object exists | Possible in the function | ✅ Natural in `build()` |
| Construct **incrementally** (the parts arrive over time, in loops or conditionals) | Awkward (a mutable draft) | ✅ |
| Repeated or accumulating parts (`header()` × n, `topping()` × n) | You assemble the arrays yourself | ✅ Fluent |
| **Compile-time** guarantee that required steps happened | Only via required properties | ✅ Staged builder (section 6) |
| A readable domain DSL (queries, pipelines) | ❌ | ✅ |
| Same steps, different output formats | ❌ | ✅ GoF builder (section 5) |

## 4. A classic fluent builder: validation + an immutable product

```ts
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

class HttpRequest {
  private constructor(                       // only the builder can create one
    readonly url: string,
    readonly method: Method,
    readonly headers: Readonly<Record<string, string>>,
    readonly body: string | undefined,
    readonly timeoutMs: number,
    readonly retries: number,
  ) {
    Object.freeze(this);                     // immutable at runtime too
  }

  static builder(url: string): HttpRequestBuilder {
    return new HttpRequestBuilder(url);
  }

  /** copy-with-changes: start a builder pre-filled from this request */
  toBuilder(): HttpRequestBuilder {
    const b = new HttpRequestBuilder(this.url).method(this.method).timeout(this.timeoutMs).retries(this.retries);
    for (const [k, v] of Object.entries(this.headers)) b.header(k, v);
    if (this.body !== undefined) b.body(this.body);
    return b;
  }

  /** @internal called only by HttpRequestBuilder */
  static _create(s: HttpRequestBuilder['state']): HttpRequest {
    // defensive copy: later builder changes must not leak into this request
    return new HttpRequest(s.url, s.method, Object.freeze({ ...s.headers }), s.body, s.timeoutMs, s.retries);
  }
}

class HttpRequestBuilder {
  readonly state: {
    url: string;
    method: Method;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
    retries: number;
  };

  constructor(url: string) {
    this.state = { url, method: 'GET', headers: {}, timeoutMs: 30_000, retries: 0 }; // defaults
  }

  method(m: Method): this { this.state.method = m; return this; }   // returning `this` makes it fluent
  header(name: string, value: string): this { this.state.headers[name.toLowerCase()] = value; return this; }
  body(json: string): this { this.state.body = json; return this; }
  timeout(ms: number): this { this.state.timeoutMs = ms; return this; }
  retries(n: number): this { this.state.retries = n; return this; }

  build(): HttpRequest {
    const s = this.state;
    // all invariants checked ONCE, before the object exists
    if (!/^https?:\/\//.test(s.url)) throw new Error('url must be http(s)');
    if (s.body !== undefined && (s.method === 'GET' || s.method === 'DELETE')) {
      throw new Error(`${s.method} requests must not have a body`);
    }
    if (s.timeoutMs <= 0) throw new Error('timeout must be positive');
    if (s.retries < 0 || s.retries > 5) throw new Error('retries must be 0..5');
    if (s.retries > 0 && s.method === 'POST' && !s.headers['idempotency-key']) {
      throw new Error('retrying a POST requires an Idempotency-Key header');
    }
    return HttpRequest._create(s);
  }
}

const req = HttpRequest.builder('https://api.example.com/orders')
  .method('POST')
  .header('Content-Type', 'application/json')
  .header('Idempotency-Key', 'abc-123')
  .body('{"sku":"A1"}')
  .timeout(5_000)
  .retries(3)
  .build();

req.retries;                 // 3
Object.isFrozen(req);        // true, so `req.retries = 9` throws in strict mode

HttpRequest.builder('https://x').body('{}').build();               // ❌ GET requests must not have a body
HttpRequest.builder('https://x').method('POST').retries(2).build(); // ❌ needs an Idempotency-Key

const faster = req.toBuilder().timeout(1_000).build();             // a new object, and req is unchanged
```

**What makes this a good builder:**
1. **The product is always valid.** You can't observe a half-built `HttpRequest`, and `build()` is the only gate.
2. **The product is immutable** (`readonly` + `Object.freeze`), so it's safe to share, cache and pass across async boundaries.
3. **A private constructor**, so the builder is the only way in.
4. **Defensive copies** in `build()`. Reusing the builder afterwards can't mutate already-built objects.
5. **Defaults live in one place** (the builder's constructor).
6. **`toBuilder()`** gives "copy with changes" for immutable objects, like Lombok's `toBuilder = true`.

In TS, the builder could also be a nested static class, or a separate class in the same module with `_create` kept internal. That's TS's stand-in for Java's private nested `Builder` with access to a private constructor.

## 5. The GoF builder + director: same steps, different representations

The **director** knows the *order* of construction steps. The **builders** know how to produce one particular *representation*.

```ts
interface ReportBuilder {
  reset(): void;
  title(text: string): void;
  paragraph(text: string): void;
  bulletList(items: string[]): void;
}

class MarkdownReportBuilder implements ReportBuilder {
  private parts: string[] = [];
  reset() { this.parts = []; }
  title(t: string) { this.parts.push(`# ${t}`); }
  paragraph(t: string) { this.parts.push(t); }
  bulletList(items: string[]) { this.parts.push(items.map((i) => `- ${i}`).join('\n')); }
  getResult(): string { return this.parts.join('\n\n'); }
}

class HtmlReportBuilder implements ReportBuilder {
  private parts: string[] = [];
  reset() { this.parts = []; }
  title(t: string) { this.parts.push(`<h1>${t}</h1>`); }
  paragraph(t: string) { this.parts.push(`<p>${t}</p>`); }
  bulletList(items: string[]) { this.parts.push(`<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`); }
  getResult(): string { return this.parts.join(''); }
}

class ReportDirector {
  buildIncidentReport(b: ReportBuilder, incident: { id: string; summary: string; actions: string[] }): void {
    b.reset();
    b.title(`Incident ${incident.id}`);
    b.paragraph(incident.summary);
    b.bulletList(incident.actions);
  }
}

const incident = { id: 'INC-42', summary: 'Checkout errors for 12 minutes.', actions: ['Rolled back', 'Added alert'] };
const md = new MarkdownReportBuilder();
new ReportDirector().buildIncidentReport(md, incident);
md.getResult();
// # Incident INC-42
//
// Checkout errors for 12 minutes.
//
// - Rolled back
// - Added alert
```

Running the same director with `HtmlReportBuilder` produces `<h1>Incident INC-42</h1><p>...</p><ul>...</ul>`.

- **Why `getResult()` isn't on the interface:** different builders return **different product types** (a string, a DOM tree, a PDF buffer), so the client asks the concrete builder for its result.
- **When it's preferable:** one assembly algorithm, several output formats. Examples: exporters, document converters, compilers emitting different targets, building the same meal as a "kids" or "adult" variant.
- **Limitations:** more classes. When there's only one representation, drop the director and the interface and use a fluent builder.

## 6. A type-safe (staged) builder: required fields enforced at compile time

A runtime `build()` check catches a missing field **when the code runs**. With TypeScript's type system you can make "forgot to set the crust" a **compile error**.

```ts
interface Pizza {
  readonly size: 'S' | 'M' | 'L';
  readonly crust: 'thin' | 'regular' | 'stuffed';
  readonly toppings: readonly string[];
  readonly extraCheese: boolean;
}
type Required_ = 'size' | 'crust';

// `Set` tracks, in the TYPE, which required fields have been provided so far.
class PizzaBuilder<Set extends Required_ = never> {
  private constructor(private readonly draft: Partial<Pizza> & { toppings: string[] }) {}

  static create(): PizzaBuilder {
    return new PizzaBuilder({ toppings: [] });
  }

  size(size: Pizza['size']): PizzaBuilder<Set | 'size'> {
    return new PizzaBuilder<Set | 'size'>({ ...this.draft, size });
  }
  crust(crust: Pizza['crust']): PizzaBuilder<Set | 'crust'> {
    return new PizzaBuilder<Set | 'crust'>({ ...this.draft, crust });
  }
  topping(t: string): PizzaBuilder<Set> {
    return new PizzaBuilder<Set>({ ...this.draft, toppings: [...this.draft.toppings, t] });
  }
  extraCheese(): PizzaBuilder<Set> {
    return new PizzaBuilder<Set>({ ...this.draft, extraCheese: true });
  }

  // build() takes zero arguments only once every required field is set. Otherwise it demands
  // an impossible argument whose type spells out what's missing, e.g. "Missing: crust".
  build(...missing: [Exclude<Required_, Set>] extends [never] ? [] : [`Missing: ${Exclude<Required_, Set>}`]): Pizza {
    const { size, crust, toppings, extraCheese = false } = this.draft;
    if (toppings.length > 5) throw new Error('max 5 toppings');           // runtime rules still apply
    return Object.freeze({ size: size!, crust: crust!, toppings: Object.freeze([...toppings]), extraCheese });
  }
}

PizzaBuilder.create().topping('olive').size('L').crust('thin').extraCheese().build(); // ✅ any order
PizzaBuilder.create().size('M').build();
//                              ~~~~~ ❌ compile error: Expected 1 arguments, but got 0
//                                       (the hover shows the parameter `missing: "Missing: crust"`)
```

**Why it works:** each setter returns a builder whose type parameter `Set` includes the field it just set. `Exclude<Required_, Set>` is the set of fields still missing. While that's not `never`, `build()`'s parameter list requires an argument nobody can sensibly pass, so the call doesn't type-check.

**Why the obvious version fails:** writing `build(this: PizzaBuilder<'size' | 'crust'>)` does **not** work. `Set` isn't used in any property, so TypeScript treats all `PizzaBuilder<...>` types as structurally identical and accepts the call. Phantom type parameters need to influence a signature, as above.

**A bonus of immutable steps:** each step returns a **new** builder, so branching from a shared base is safe:

```ts
const base = PizzaBuilder.create().size('M').crust('regular');
const veg = base.topping('pepper').build();   // toppings: ['pepper']
const plain = base.build();                   // toppings: [], so base wasn't mutated
```

- **When it's preferable:** public APIs and SDKs where misuse should fail in the editor, not in production. Libraries with step-ordered DSLs (`from().where().select()`).
- **Limitations:** clever types are harder to read, and compiler errors can be cryptic. In an interview, show the runtime-validated builder first and mention this as an upgrade.

Java and Kotlin get the same guarantee with **step interfaces**: `builder()` returns a `NeedsSize`, whose `size()` returns a `NeedsCrust`, whose `crust()` returns an `OptionalSteps` that has `build()`.

## 7. Builders for tests: the test data builder

```ts
interface User { id: string; email: string; role: 'admin' | 'member'; active: boolean }

class UserBuilder {
  private user: User = { id: 'u1', email: 'test@example.com', role: 'member', active: true }; // sane defaults

  static aUser() { return new UserBuilder(); }
  admin(): this { this.user = { ...this.user, role: 'admin' }; return this; }
  inactive(): this { this.user = { ...this.user, active: false }; return this; }
  withEmail(email: string): this { this.user = { ...this.user, email }; return this; }
  build(): User { return { ...this.user }; }
}

const u = UserBuilder.aUser().admin().inactive().build();
// each test states only what it cares about ("an inactive admin"), and the defaults cover the rest
```

This is the **test data builder** (from *Growing Object-Oriented Software, Guided by Tests*). It keeps tests readable and resilient when `User` gains new required fields: you update the default in one place, not in 200 tests. Libraries like Fishery and `factory_bot` generalize it.

## 8. Builder in the wild

| Example | Kind |
| --- | --- |
| Knex / TypeORM / Kysely query builders: `db('users').where(...).orderBy(...)` | Fluent DSL builder (often with immutable steps) |
| Java `HttpRequest.newBuilder()`, OkHttp `Request.Builder`, gRPC `ManagedChannelBuilder` | Fluent builder with an immutable product |
| Protobuf message builders (Java), Lombok `@Builder` | Generated fluent builders |
| `StringBuilder` / array `push` + `join` | Accumulating builder (efficient incremental construction) |
| Elasticsearch / Mongo aggregation pipeline builders | DSL builder |
| Docker multi-stage builds, CI pipeline DSLs | Step-by-step construction (conceptually a director) |

## 9. Builder vs related patterns

| | Builder | Factory | Options object | Constructor |
| --- | --- | --- | --- | --- |
| Question | *How* do I assemble this complex object? | *Which* implementation do I create? | How do I pass many named parameters? | How do I create a simple object? |
| Steps | Many, step by step | One call | One call | One call |
| Validation across fields | ✅ In `build()` | Possible | Possible | Possible |
| Returns | One product type (with its config) | One of several types behind an interface | A value | An instance |
| Best for | Many optional parts, invariants, DSLs, multiple representations | Polymorphic creation | Most TS cases with optional parameters | 1–3 required parameters |

They combine naturally: a **factory can return a pre-configured builder** (`RequestBuilders.forService('payments')`), and a **director is the client of builders**. A **Prototype** (clone, then modify) is the alternative when a configured object is expensive to rebuild.

## 10. In LLD rounds

| Problem | Builder for | Why |
| --- | --- | --- |
| Pizza / burger / meal ordering | `Order`, `Pizza`, `Meal` | Many optional add-ons with rules (max toppings, combo pricing) |
| Car rental / car configurator | `CarConfiguration` | Interdependent options (a sunroof isn't available on the base trim) |
| Notification service | `Message` (to, cc, template, attachments, priority) | Optional fields plus validation |
| Search / filter APIs | `SearchQuery` (filters, sort, pagination) | A fluent DSL that builds a query object |
| Document / report export | Director + `MarkdownBuilder` / `PdfBuilder` | Same structure, multiple formats |
| HTTP client SDK | `Request` | Defaults, headers, retries, timeouts, immutability |

**A sentence to use:** *"`Pizza` has two required fields and several optional ones with business rules, so I'll use a builder that validates in `build()` and returns an immutable `Pizza`. If it only had optional flags, I'd just accept an options object."*

## 11. Pitfalls

- **A builder for a two-field class.** Use a constructor or an options object.
- **Mutable product:** a builder that returns an object with public setters loses the main benefit.
- **Aliasing:** `build()` handing out the builder's internal array or map, so later builder calls change already-built objects. Copy in `build()`. The verified example above copies `headers`.
- **No validation in `build()`,** which turns the builder into a fancier way to make invalid objects.
- **Required fields as optional setters** with no check, which fails at use time instead of build time.
- **Reusing one mutable builder across async tasks.** Builders are usually single-use and not thread-safe. Create one per build, or use immutable steps (section 6).
- **Mixing up "Builder" and "Factory":** if you're choosing a subclass, that's a factory.

---

## Interview questions (with crisp answers)

**Q: What problem does Builder solve?**
Constructing objects with many (mostly optional) parameters readably, with all validation done once, producing a valid and usually immutable object. It replaces telescoping constructors and setter-based half-built objects.

**Q: Builder vs Factory?**
Factory decides **which** class to instantiate, in one call. Builder controls **how** one complex object is assembled, step by step.

**Q: Do you need Builder in JavaScript/TypeScript?**
Often not. Options objects with defaults give named optional parameters. Builders still help for cross-field validation, incremental or accumulating construction, fluent DSLs, compile-time required steps, and multiple representations.

**Q: What's the director for?**
It encapsulates the **order** of construction steps so the same recipe can drive different builders, producing different representations. It's optional in the fluent-builder style.

**Q: How do you make sure required fields are set?**
At minimum, take them in the builder's constructor (`HttpRequest.builder(url)`) or check them in `build()`. For a compile-time guarantee, use a staged or typed builder.

**Q: How do you modify an immutable object built with a builder?**
`toBuilder()` (pre-fill a builder from the object, change it, build a new one), or `with...()` methods that return copies.

**Q: Is StringBuilder a Builder pattern?**
Loosely. It builds a product incrementally and returns it at the end, but it isn't about separating construction from representation. It's fine to mention, with that nuance.

## Common mistakes

- Calling any method chain a "builder" (that's a fluent interface, not necessarily a builder).
- Forgetting the private or internal constructor on the product, so callers can bypass validation.
- Validating in the setters only. Cross-field rules belong in `build()`.
- Returning the same mutable object on each `build()`.
- Over-engineering: Director + interface + concrete builder for a single representation.
