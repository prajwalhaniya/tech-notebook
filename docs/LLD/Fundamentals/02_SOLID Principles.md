---
sidebar_position: 2
---

# SOLID Principles

> **Why this matters at FAANG:** nobody asks you to recite the acronym. In an LLD round the interviewer adds a requirement halfway through ("now support UPI payments", "now notify by WhatsApp too", "a premium member pays a different rate") and watches **how much existing code you have to change**. SOLID is the toolkit that keeps that answer at "one new class." In code-review style rounds you'll get a messy class and be asked what's wrong with it, and the answer is usually phrased in SOLID terms.

Prerequisite: [OOP Pillars](./01_OOP%20Pillars.md). Examples are in TypeScript.

| | Principle | One-liner | Smell it fixes |
| --- | --- | --- | --- |
| **S** | Single Responsibility | A class should have one reason to change | God classes, "and" in the class description |
| **O** | Open/Closed | Extend behaviour without editing existing code | `if/else` / `switch` on type that grows with every feature |
| **L** | Liskov Substitution | Subtypes must be usable wherever the parent is expected | `instanceof` checks, overrides that throw "not supported" |
| **I** | Interface Segregation | Don't force clients to depend on methods they don't use | Fat interfaces, empty or throwing implementations |
| **D** | Dependency Inversion | Depend on abstractions; high-level policy shouldn't know low-level details | `new MySqlDb()` inside business logic, untestable code |

All five serve two goals from the OOP page: **high cohesion** and **low coupling**.

---

## S — Single Responsibility Principle (SRP)

> "A module should be responsible to one, and only one, **actor**." (Robert C. Martin's refined form of "one reason to change")

The common misreading is "a class should do one thing" or "have one method." The real test: **who would ask for this code to change?** If the finance team and the ops team would both send you change requests for the same class, it has two responsibilities.

### Violation

```ts
class Employee {
  constructor(public name: string, public hourlyRate: number, public hours: number) {}

  calculatePay(): number {          // Actor: Finance (CFO)
    return this.hourlyRate * this.regularHours();
  }

  reportHours(): string {           // Actor: Operations (COO)
    return `${this.name}: ${this.regularHours()} hrs`;
  }

  save(): void {                    // Actor: DBAs / infrastructure
    // INSERT INTO employees ...
  }

  private regularHours(): number {  // shared helper: the trap
    return Math.min(this.hours, 40);
  }
}
```

The bug this causes: Finance asks for overtime to be counted differently, so someone edits `regularHours()`. Now Ops' report is silently wrong too. Two actors, one shared piece of code, one accidental break.

### Refactor: separate by actor

```ts
class Employee {                               // pure data + identity
  constructor(public readonly id: string, public name: string, public hourlyRate: number, public hours: number) {}
}

class PayCalculator {                          // Finance owns this
  calculatePay(e: Employee): number {
    const regular = Math.min(e.hours, 40);
    const overtime = Math.max(e.hours - 40, 0);
    return e.hourlyRate * (regular + overtime * 1.5);
  }
}

class HoursReporter {                          // Ops owns this
  report(e: Employee): string { return `${e.name}: ${e.hours} hrs`; }
}

interface EmployeeRepository {                 // infrastructure behind an interface (see DIP)
  save(e: Employee): Promise<void>;
}
```

Each class now changes for exactly one actor. If you want a single entry point, add a thin **Facade** (`EmployeeService`) that delegates to all three. The facade has no logic of its own, so it rarely changes.

### How to spot SRP violations quickly
- Describing the class needs "**and**": "it validates the order *and* charges the card *and* sends the email."
- Imports from unrelated layers in one file: an HTTP client, a SQL driver and an email SDK together.
- The class is hard to name, or ends up named `Manager`, `Helper`, `Utils` or `Processor`.
- Unit tests need lots of unrelated mocks just to test one method.

### Don't overdo it
SRP isn't "one method per class." Splitting cohesive logic into ten tiny classes *lowers* cohesion and spreads one concept across many files. Split along **actors / reasons to change**, not lines of code.

---

## O — Open/Closed Principle (OCP)

> "Software entities should be **open for extension, but closed for modification**." (Bertrand Meyer)

When a new variant shows up, you should be able to **add new code** (a new class) instead of **editing tested code** (another `case` in a switch). The tool for this is polymorphism behind an abstraction.

### Violation

```ts
class DiscountCalculator {
  calculate(customerType: string, amount: number): number {
    if (customerType === 'REGULAR') return amount;
    if (customerType === 'PREMIUM') return amount * 0.9;
    if (customerType === 'VIP')     return amount * 0.8;
    // A "STUDENT" discount next week means editing (and re-testing) this method.
    // Copies of this if-chain usually exist in invoicing, emails, analytics...
    throw new Error(`Unknown type ${customerType}`);
  }
}
```

### Refactor: Strategy + registry

```ts
interface DiscountPolicy {
  appliesTo(customerType: string): boolean;
  apply(amount: number): number;
}

class NoDiscount implements DiscountPolicy {
  appliesTo() { return true; }                       // fallback
  apply(amount: number) { return amount; }
}

class PercentageDiscount implements DiscountPolicy {
  constructor(private readonly type: string, private readonly pct: number) {}
  appliesTo(t: string) { return t === this.type; }
  apply(amount: number) { return amount * (1 - this.pct / 100); }
}

class DiscountCalculator {                           // CLOSED: never edited again
  constructor(private readonly policies: DiscountPolicy[], private readonly fallback: DiscountPolicy = new NoDiscount()) {}

  calculate(customerType: string, amount: number): number {
    const policy = this.policies.find((p) => p.appliesTo(customerType)) ?? this.fallback;
    return policy.apply(amount);
  }
}

// OPEN: a new discount is configuration or a new class, wired at the composition root
const calc = new DiscountCalculator([
  new PercentageDiscount('PREMIUM', 10),
  new PercentageDiscount('VIP', 20),
  new PercentageDiscount('STUDENT', 15),             // added without touching DiscountCalculator
]);
```

### Mechanisms that achieve OCP
| Mechanism | Example |
| --- | --- |
| Strategy (interface + implementations) | Pricing, discounts, payment methods |
| Template Method (abstract hook in a base class) | `abstract class ReportExporter { export() { header(); body(); footer(); } }` |
| Decorator | Add logging, caching or retries around a service without editing it. See [Decorator](../../designPatterns/Decorator%20Pattern.md) |
| Observer / events | New reactions to `OrderPlaced` without touching the order code. See [Observer](../../designPatterns/Observer%20Pattern.md) |
| Plugin registry / Factory | Map from `type → class`. New types register themselves. See [Factory](../../designPatterns/Factory%20Pattern.md) |
| Middleware pipeline | Express/Koa. See [Middleware](../../designPatterns/Middleware%20Pattern.md) |

### Don't overdo it
You can't be closed against *every* change. Pick the axes that are **actually likely to vary** (the requirements usually say so: "multiple payment methods", "different vehicle types"). A good interview line: *"I'm adding an extension point here because the requirements list several payment methods. I'm not abstracting the ticket ID format because nothing suggests it will change."* Making something extensible before there's a second case is speculative generality (YAGNI). A common rule of thumb is to abstract on the second or third variant.

---

## L — Liskov Substitution Principle (LSP)

> "If S is a subtype of T, then objects of type T may be replaced with objects of type S **without altering the correctness of the program**." (Barbara Liskov, 1987)

Inheritance has to model **behavioural** is-a, not just "is-a in English." A subtype must honour the parent's **contract**:

| Rule | Meaning | Violation example |
| --- | --- | --- |
| Preconditions can't be **strengthened** | The subtype must accept everything the parent accepts | Parent accepts any amount, child throws for amounts > 1000 |
| Postconditions can't be **weakened** | The subtype must guarantee everything the parent guarantees | Parent's `sort()` returns sorted output, child's sometimes doesn't |
| Invariants must be **preserved** | Rules about the parent's state still hold | `Square` breaks Rectangle's "width and height are independent" |
| No new exceptions | Don't throw types callers of the parent aren't prepared for | `ReadOnlyList.add()` throws `UnsupportedOperationException` |
| History constraint | Don't allow state changes the parent forbids | An immutable parent with a mutable child |

### Classic violation: Square extends Rectangle

```ts
class Rectangle {
  constructor(protected w: number, protected h: number) {}
  setWidth(w: number)  { this.w = w; }
  setHeight(h: number) { this.h = h; }
  area() { return this.w * this.h; }
}

class Square extends Rectangle {
  constructor(side: number) { super(side, side); }
  setWidth(w: number)  { this.w = w; this.h = w; }   // keeps the square invariant...
  setHeight(h: number) { this.w = h; this.h = h; }   // ...but breaks Rectangle's contract
}

function resize(r: Rectangle) {
  r.setWidth(5);
  r.setHeight(4);
  console.assert(r.area() === 20, `expected 20, got ${r.area()}`);   // Square gives 16
}

resize(new Rectangle(1, 1)); // ok
resize(new Square(1));       // assertion fails: Square is not substitutable
```

Mathematically a square *is a* rectangle, but behaviourally a **mutable** square isn't a mutable rectangle. Fixes:
- Make both **immutable** (`withWidth()` returns a new shape). Then the contract that broke never existed.
- Or don't relate them by inheritance: both implement `interface Shape { area(): number }`.

### Practical violation: a subclass that refuses part of its parent

```ts
abstract class Bird {
  abstract fly(): void;
}
class Sparrow extends Bird { fly() { /* flap */ } }
class Penguin extends Bird {
  fly() { throw new Error("Penguins can't fly"); }   // LSP violation: callers of Bird.fly() now crash
}
```

Fix it by modelling capabilities instead of forcing a false hierarchy (this is also ISP):

```ts
interface Bird { eat(): void }
interface Flyer { fly(): void }
interface Swimmer { swim(): void }

class Sparrow implements Bird, Flyer { eat() {} fly() {} }
class Penguin implements Bird, Swimmer { eat() {} swim() {} }

function migrate(flyers: Flyer[]) { flyers.forEach((f) => f.fly()); } // can't receive a Penguin
```

### Smells that signal an LSP violation
- `if (x instanceof Penguin)` in code that takes a `Bird`.
- Overrides that throw `NotImplemented` / `UnsupportedOperation`, or do nothing when the parent does something.
- A subclass that needs a comment like "don't call X on this one."
- Tests written for the base class fail when you run them against the subclass. **That's the practical LSP test:** every subtype should pass the parent's contract test suite.

Real-world example: Java's `Collections.unmodifiableList` returns a `List` whose `add()` throws. It's a well-known, deliberate LSP compromise, so it's worth mentioning as one.

---

## I — Interface Segregation Principle (ISP)

> "Clients should not be forced to depend on methods they do not use."

Prefer several small, **role-based** interfaces to one fat one. Fat interfaces make implementers write stubs (often LSP violations) and make clients depend on, and get recompiled or redeployed for, changes they don't care about.

### Violation

```ts
interface Machine {
  print(doc: string): void;
  scan(doc: string): string;
  fax(doc: string, to: string): void;
  staple(doc: string): void;
}

class BasicPrinter implements Machine {
  print(doc: string) { /* ok */ }
  scan(): string { throw new Error('not supported'); }   // forced stubs
  fax(): void   { throw new Error('not supported'); }
  staple(): void { throw new Error('not supported'); }
}
```

### Refactor: role interfaces

```ts
interface Printer { print(doc: string): void }
interface Scanner { scan(doc: string): string }
interface Fax     { fax(doc: string, to: string): void }

class BasicPrinter implements Printer {
  print(doc: string) { /* ... */ }
}

class OfficeMultiFunction implements Printer, Scanner, Fax {
  print(doc: string) { /* ... */ }
  scan(doc: string) { return `scanned:${doc}`; }
  fax(doc: string, to: string) { /* ... */ }
}

// Clients ask only for the role they need
class PrintQueue {
  constructor(private readonly printer: Printer) {}  // works with BasicPrinter AND OfficeMultiFunction
}
```

### ISP in practice
- **Repository interfaces:** split `ReadRepository<T>` (`findById`, `findAll`) from `WriteRepository<T>` (`save`, `delete`). A reporting service only needs the read side, which is also the shape of CQRS. See [Repository pattern](../../designPatterns/Repository%20Pattern.md).
- **TypeScript makes ISP cheap:** structural typing means a client can declare exactly the shape it needs (`(logger: { info(msg: string): void })`), and any object with that method fits.
- **Microservice APIs:** the same idea at the API level. Don't make a mobile client fetch a giant DTO it uses 3 fields of (it's the motivation for BFF and GraphQL).

### Don't overdo it
One interface per method everywhere is noise. Group by **client role**: methods that are always used together belong together.

---

## D — Dependency Inversion Principle (DIP)

> 1. "High-level modules should not depend on low-level modules. **Both should depend on abstractions.**"
> 2. "Abstractions should not depend on details. Details should depend on abstractions."

**High-level** = business policy (place an order, compute a fare). **Low-level** = mechanisms (MySQL, Kafka, SendGrid, the file system). Without DIP, the source-code dependency follows the call direction: business logic imports the DB driver. DIP **inverts** it: the business layer defines the interface it needs, and the infrastructure layer implements it.

```text
Without DIP:                       With DIP:

OrderService ──imports──▶ MySql    OrderService ──▶ «interface» OrderRepository  (owned by the domain)
                                                              ▲
                                                              │ implements
                                                         MySqlOrderRepository     (infrastructure)
```

Key detail people miss: **the interface belongs to the high-level module** and is shaped by what *it* needs (`save(order)`), not by what the database offers (`executeQuery(sql)`).

### Violation

```ts
class OrderService {
  private db = new MySqlClient('mysql://prod');          // hard-wired detail
  private mailer = new SendGridClient(process.env.KEY!);  // hard-wired detail

  async placeOrder(order: Order) {
    await this.db.query('INSERT INTO orders ...', [order.id]);
    await this.mailer.send(order.email, 'Order placed');
  }
}
// Can't unit test without a real DB and email account. Switching to Postgres or SES means editing business logic.
```

### Refactor: abstractions + constructor injection

```ts
// Abstractions, owned by the domain layer, named in domain terms
interface OrderRepository { save(order: Order): Promise<void> }
interface Notifier        { orderPlaced(order: Order): Promise<void> }

type Order = { id: string; email: string; totalCents: number };

// High-level policy: no imports from infrastructure
class OrderService {
  constructor(private readonly orders: OrderRepository, private readonly notifier: Notifier) {}

  async placeOrder(order: Order) {
    if (order.totalCents <= 0) throw new RangeError('Empty order');
    await this.orders.save(order);
    await this.notifier.orderPlaced(order);
  }
}

// Low-level details depend on (implement) the abstractions
class PostgresOrderRepository implements OrderRepository {
  async save(order: Order) { /* INSERT ... */ }
}
class EmailNotifier implements Notifier {
  async orderPlaced(order: Order) { /* SES/SendGrid call */ }
}

// Composition root (main.ts / DI container): the ONLY place that knows the concrete classes
const service = new OrderService(new PostgresOrderRepository(), new EmailNotifier());
```

And testing becomes trivial:

```ts
class InMemoryOrderRepository implements OrderRepository {
  saved: Order[] = [];
  async save(o: Order) { this.saved.push(o); }
}
class SpyNotifier implements Notifier {
  calls: string[] = [];
  async orderPlaced(o: Order) { this.calls.push(o.id); }
}

const repo = new InMemoryOrderRepository();
const spy = new SpyNotifier();
await new OrderService(repo, spy).placeOrder({ id: 'o1', email: 'a@b.c', totalCents: 500 });
console.assert(repo.saved.length === 1 && spy.calls[0] === 'o1');
```

### DIP vs DI vs IoC (a common clarification question)

| Term | What it is |
| --- | --- |
| **Dependency Inversion Principle** | A *design principle*: depend on abstractions, and high-level code owns the interfaces |
| **Dependency Injection** | A *technique*: pass dependencies in (constructor, setter, or parameter) instead of creating them inside |
| **Inversion of Control** | The broader *idea*: a framework or container calls your code and wires your objects (Spring, NestJS, Angular, Guice) |
| **DI Container** | A *tool* that automates injection (`@Injectable()`, `@Autowired`) |

You can do DI without DIP (injecting a concrete `MySqlClient`: testable, but still coupled to MySQL) and DIP without a container (manual wiring in `main`, as above, which is what you should do in an interview).

**Constructor injection is the default:** dependencies are explicit, required and immutable, and the object is never half-built. Setter injection is for optional dependencies. Avoid the **Service Locator** (`Container.get('db')` inside methods), because it hides dependencies.

---

## SOLID together: one worked example

**Prompt:** *"Design a notification system. Today: email for order confirmations. Soon: SMS, push, WhatsApp; user channel preferences; retries; rate limits."*

```ts
// ---- Domain abstractions (DIP: owned by the high-level policy) ----
type Message = { userId: string; title: string; body: string };

interface Channel {                                         // ISP: a small, role-focused contract
  readonly name: 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  send(to: Recipient, msg: Message): Promise<void>;
}

type Recipient = { email?: string; phone?: string; deviceToken?: string };

interface PreferenceStore { channelsFor(userId: string): Promise<Channel['name'][]> }
interface RecipientDirectory { lookup(userId: string): Promise<Recipient> }

// ---- Channels (OCP: adding WhatsApp = a new class, nothing else edited) ----
class EmailChannel implements Channel {
  readonly name = 'EMAIL' as const;
  async send(to: Recipient, msg: Message) {
    if (!to.email) return;                                  // LSP: a missing address is a no-op, never a surprise throw
    /* provider call */
  }
}
class SmsChannel implements Channel {
  readonly name = 'SMS' as const;
  async send(to: Recipient, msg: Message) { if (!to.phone) return; /* provider call */ }
}

// ---- Cross-cutting concern as a decorator (SRP + OCP: retry logic lives in one place) ----
class RetryingChannel implements Channel {
  constructor(private readonly inner: Channel, private readonly attempts = 3) {}
  get name() { return this.inner.name; }
  async send(to: Recipient, msg: Message) {
    for (let i = 1; ; i++) {
      try { return await this.inner.send(to, msg); }
      catch (e) { if (i >= this.attempts) throw e; await new Promise((r) => setTimeout(r, 2 ** i * 100)); }
    }
  }
}

// ---- High-level policy (SRP: decides WHO gets WHAT on WHICH channels, and nothing else) ----
class NotificationService {
  private readonly channels: Map<Channel['name'], Channel>;

  constructor(
    channels: Channel[],
    private readonly prefs: PreferenceStore,
    private readonly directory: RecipientDirectory,
  ) {
    this.channels = new Map(channels.map((c) => [c.name, c]));
  }

  async notify(msg: Message): Promise<void> {
    const [names, recipient] = await Promise.all([this.prefs.channelsFor(msg.userId), this.directory.lookup(msg.userId)]);
    const targets = names.map((n) => this.channels.get(n)).filter((c): c is Channel => c !== undefined);
    await Promise.allSettled(targets.map((c) => c.send(recipient, msg)));   // one channel failing doesn't block the others
  }
}

// ---- Composition root ----
// const service = new NotificationService(
//   [new RetryingChannel(new EmailChannel()), new RetryingChannel(new SmsChannel())],
//   new DbPreferenceStore(), new UserServiceDirectory());
```

How each principle shows up, which is what you'd *say* in the interview:
- **S:** channels only deliver, the service only routes, retries live in a decorator, and preferences and directory lookups sit behind their own interfaces.
- **O:** WhatsApp is a new `Channel` class registered at the composition root. `NotificationService` doesn't change.
- **L:** every `Channel` honours the same contract (best-effort, no-op when the address is missing), so the service never type-checks a channel.
- **I:** `Channel` has one method. Preference and directory concerns are separate interfaces rather than one fat `UserService`.
- **D:** the service depends on `Channel`, `PreferenceStore` and `RecipientDirectory`. Concrete providers are chosen in one place.

Natural next steps the interviewer may push on: rate limiting (another decorator), templates (a `TemplateRenderer` interface), and async delivery with a queue (the service publishes, and workers call channels).

---

## SOLID ↔ design patterns cheat sheet

| Principle | Patterns that embody it |
| --- | --- |
| SRP | Facade (thin coordinator), Repository (persistence pulled out), Command (one action per object) |
| OCP | Strategy, Decorator, Observer, Template Method, Chain of Responsibility, Factory registry |
| LSP | Not a pattern, it's a *constraint* on every pattern that uses subtyping. Contract tests enforce it |
| ISP | Role interfaces, Adapter (expose only what the client needs), CQRS read/write split |
| DIP | Dependency Injection, Abstract Factory, Ports & Adapters (Hexagonal), Plugin architecture |

See also: [Design Patterns Across Domains](../../designPatterns/Design%20Patterns%20Across%20Domains.md), [Singleton](../../designPatterns/Singleton%20Pattern.md) (and why a global singleton usually works against DIP).

---

## Interview questions (with crisp answers)

1. **Explain SRP without saying "one thing."** A class should have one reason to change, meaning it should serve one actor or stakeholder. If two different groups would request changes to it, split it.
2. **How do you apply OCP without over-engineering?** Add extension points only on axes the requirements say will vary, or once a second variant actually appears. Elsewhere, keep it simple and refactor when needed.
3. **Why is Square/Rectangle an LSP violation if a square *is* a rectangle?** LSP is about behaviour, not taxonomy. A mutable Rectangle promises that width and height change independently, and Square can't keep that promise. Immutable shapes don't have the problem.
4. **How do you detect LSP violations in a codebase?** `instanceof` checks on subtypes, overrides that throw or do nothing, and subclasses that fail the base class's test suite.
5. **ISP vs SRP?** SRP is about why an *implementation* changes (actors). ISP is about what a *client* is forced to depend on (the interface surface). A class can implement several segregated interfaces and still have a single responsibility.
6. **DIP vs dependency injection?** DIP is the principle (depend on abstractions, and high-level code owns them). DI is one technique for supplying dependencies. You can inject concretions (DI without DIP).
7. **Who owns the interface in DIP?** The high-level/client module. It's defined in the domain's terms (`OrderRepository.save`), and the infrastructure implements it.
8. **Is SOLID always good?** No. Applied mechanically it produces interface-per-class, indirection-heavy code that's harder to read. It's a set of heuristics for managing *change*. Apply it where change is expected. KISS and YAGNI pull in the other direction, and senior engineers balance them.
9. **Does SOLID apply to functional code?** Yes, in spirit. SRP means small, focused functions. OCP means higher-order functions (pass behaviour in). DIP means passing functions or modules as parameters. ISP means narrow parameter types. LSP still applies to anything substitutable.
10. **Give a real-world SOLID violation you've seen.** Have one story ready, e.g. a `PaymentService` with a `switch(provider)` copied across charge, refund and webhooks. You refactored it into a `PaymentProvider` interface, and adding the next provider took one class instead of touching six files.

## Common mistakes

- **Reciting definitions without code.** Always show the before/after, or say how the principle shaped a specific class in your design.
- **Interfaces with one implementation and no test seam** "for DIP." An abstraction should exist for a reason: something varies, or you need to test it.
- **Splitting by technical layer instead of by actor** (`EmployeeGetter`, `EmployeeSetter`) and calling it SRP.
- **Fixing OCP with a giant factory `switch`** and then editing that switch for every new type. Use a registry where implementations register themselves, or accept the single switch at the composition root and say so explicitly.
- **Inheriting to reuse code**, then throwing "not supported" in the override (LSP + ISP violation).
- **Service Locator / global singletons** inside business logic. They hide dependencies and defeat DIP.
