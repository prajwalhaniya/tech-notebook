---
sidebar_position: 1
---

# OOP Pillars

> **Why this matters in interviews:** LLD / machine-coding rounds (Amazon, Uber, Flipkart, Microsoft, Google's "object-oriented design" interviews) don't ask "define encapsulation." They hand you *Design a Parking Lot / Elevator / Splitwise* and watch whether your classes **protect their state**, **hide the right details**, **use inheritance only where it's honest**, and **extend through polymorphism instead of `if/else` chains**. These notes cover each pillar the way it's actually tested.

Examples are in **TypeScript**: it's close to JavaScript but has interfaces, access modifiers and abstract classes. Notes call out where Java/C++ behave differently.

---

## 0. The mental model: objects = state + behaviour + identity

| Term | Meaning | Example |
| --- | --- | --- |
| **Class** | Blueprint: which fields and methods exist | `class BankAccount` |
| **Object / instance** | A concrete thing built from the blueprint | `const acc = new BankAccount(...)` |
| **State** | The current values of its fields | `balance = 500` |
| **Behaviour** | Methods that read or change state | `deposit()`, `withdraw()` |
| **Identity** | Two objects with equal state are still different objects | `a !== b` even if both have `balance = 500` |
| **Invariant** | A rule about state that must *always* hold | `balance >= 0` |

The single most useful sentence for an interview: **an object's job is to keep its invariants true no matter what callers do.** All four pillars serve that goal.

```text
  Encapsulation ──▶ Abstraction ──▶ Polymorphism ◀── Inheritance
  (protect state)   (expose what,   (one interface,   (reuse + is-a)
                     hide how)       many forms)
```

Encapsulation and abstraction are about **boundaries**. Inheritance and polymorphism are about **variation**. Polymorphism is the pillar that pays off most, and inheritance is only one of two ways to get it (interfaces are the other).

---

## 1. Encapsulation

**Definition:** bundle data with the methods that operate on it, and **restrict direct access** to that data so it can only change through methods that enforce the invariants.

Encapsulation is not "make every field private and add getters/setters." A public setter on every field is encapsulation in name only.

### Bad: anaemic object, invariants enforced nowhere

```ts
class BankAccount {
  balance: number = 0;          // anyone can write anything
}

const acc = new BankAccount();
acc.balance = -1_000_000;       // invariant broken, and nothing stops it
```

### Still bad: getters/setters that don't protect anything

```ts
class BankAccount {
  private balance = 0;
  getBalance() { return this.balance; }
  setBalance(b: number) { this.balance = b; }   // same hole, more typing
}
```

### Good: behaviour-rich object that owns its rules

```ts
class InsufficientFundsError extends Error {}

class BankAccount {
  private balance = 0;

  constructor(public readonly id: string, private readonly overdraftLimit = 0) {}

  deposit(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Deposit must be positive');
    this.balance += amount;
  }

  withdraw(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Withdrawal must be positive');
    if (this.balance - amount < -this.overdraftLimit) throw new InsufficientFundsError(this.id);
    this.balance -= amount;
  }

  getBalance(): number { return this.balance; }   // read-only view, no setter
}
```

Callers can only express **intent** (`deposit`, `withdraw`). They can't express "set balance to X," so the invariant `balance >= -overdraftLimit` can't be broken from outside.

### Tell, don't ask

```ts
// Asking: the caller pulls state out and makes the decision. Logic leaks out of the class.
if (account.getBalance() >= price) account.setBalance(account.getBalance() - price);

// Telling: the object makes the decision with its own data.
account.withdraw(price);
```

If you see a caller doing `get → compute → set`, the computation probably belongs inside the class.

### Leaking internals through references

```ts
class Team {
  private members: string[] = [];
  getMembers(): string[] { return this.members; }          // the caller can push/splice your private array
  getMembersSafe(): readonly string[] { return [...this.members]; } // defensive copy (or ReadonlyArray)
}
```

Returning a mutable internal collection breaks encapsulation even when the field is `private`. Return a copy, a read-only view, or an iterator. (Java: `Collections.unmodifiableList`. C++: return a `const&`.)

### Language notes (a common follow-up)

| | TypeScript | Plain JS | Java | C++ |
| --- | --- | --- | --- | --- |
| Private field | `private x` (**compile-time only**, still visible at runtime) | `#x` (true runtime privacy) | `private` | `private` |
| Protected | `protected` | none (convention: `_x`) | `protected` (+ package) | `protected` |
| Immutable field | `readonly` | `Object.freeze` / `#x` without a setter | `final` | `const` |

Interview point: TypeScript's `private` is erased at compile time, so `(obj as any).balance` still works. Use `#balance` when you need real runtime privacy.

### Why it matters

- **Invariants live in one place.** Bugs where something sets an illegal state can only come from one class.
- **You can change the internals freely.** Store `balance` in cents, as a `BigInt`, or in a ledger, and no caller changes.
- **Thread safety becomes possible.** You can only lock state you control access to.

---

## 2. Abstraction

**Definition:** expose **what** an object does and hide **how** it does it. Callers depend on a small, stable contract, not on the implementation details.

Encapsulation vs abstraction (asked constantly):

| | Encapsulation | Abstraction |
| --- | --- | --- |
| Question it answers | *Who* can touch this data? | *What* does the caller need to know? |
| Mechanism | Access modifiers, hiding state | Interfaces, abstract classes, small public APIs |
| Level | Implementation level (inside a class) | Design level (between modules) |
| Example | `private balance` | `interface PaymentGateway { charge(...) }` |

They work together: abstraction decides the contract, encapsulation enforces that nobody goes around it.

### Example: hide the payment provider behind a contract

```ts
interface PaymentGateway {
  charge(customerId: string, amountCents: number): Promise<PaymentResult>;
  refund(paymentId: string): Promise<void>;
}

type PaymentResult = { paymentId: string; status: 'SUCCEEDED' | 'DECLINED' };

class StripeGateway implements PaymentGateway {
  async charge(customerId: string, amountCents: number): Promise<PaymentResult> {
    // HTTP calls, retries, idempotency keys, Stripe-specific error codes... all hidden here
    return { paymentId: 'pi_123', status: 'SUCCEEDED' };
  }
  async refund(paymentId: string): Promise<void> { /* ... */ }
}

class CheckoutService {
  constructor(private readonly gateway: PaymentGateway) {}   // depends on the abstraction only

  async checkout(customerId: string, totalCents: number) {
    const result = await this.gateway.charge(customerId, totalCents);
    if (result.status === 'DECLINED') throw new Error('Payment declined');
    return result.paymentId;
  }
}
```

`CheckoutService` has no idea Stripe exists. You can swap in `RazorpayGateway`, or a `FakeGateway` for tests, without touching it.

### Interface vs abstract class

| | `interface` | `abstract class` |
| --- | --- | --- |
| Holds state? | No | Yes (fields, constructor) |
| Shared implementation? | No (Java 8+ allows `default` methods) | Yes |
| Multiple? | A class can implement many | A class can extend only **one** (TS/Java) |
| Expresses | A **capability**: "can do X" (`Comparable`, `Payable`) | A **partial base type**: "is a kind of X, and here's the common part" |
| Use when | You only need a contract, or unrelated classes share a capability | Subclasses share real code/state *and* a true is-a relationship |

Default rule: **start with an interface.** Add an abstract class only when there's real shared code, and even then consider composition first (section 3).

### Leaky abstractions

An abstraction leaks when callers must know implementation details to use it correctly:

```ts
interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByIdSql(sql: string): Promise<User>;   // leak: the contract now assumes a SQL database
}
```

Signs of a leak: method names or parameters that mention a vendor or technology (`sql`, `redisKey`, `s3Bucket`), errors that expose provider codes, or callers that have to call methods in an undocumented order. Fix it by translating to domain terms at the boundary (e.g. map `StripeCardError` to `PaymentDeclinedError`).

---

## 3. Inheritance

**Definition:** a class (subclass) acquires the fields and methods of another (superclass) and can extend or override them. It models an **is-a** relationship and enables code reuse plus subtype polymorphism.

```ts
abstract class Vehicle {
  constructor(public readonly plate: string) {}
  abstract get size(): 'SMALL' | 'MEDIUM' | 'LARGE';
  describe(): string { return `${this.constructor.name}(${this.plate})`; }   // shared behaviour
}

class Motorcycle extends Vehicle { get size() { return 'SMALL' as const; } }
class Car        extends Vehicle { get size() { return 'MEDIUM' as const; } }
class Truck      extends Vehicle { get size() { return 'LARGE' as const; } }
```

This is a **good** use of inheritance: every subclass genuinely *is a* vehicle, the base is small, and subclasses only fill in what varies.

### Types of inheritance

| Type | Shape | Notes |
| --- | --- | --- |
| Single | `B extends A` | The default everywhere |
| Multilevel | `C extends B extends A` | Keep it shallow. More than 2–3 levels is a smell |
| Hierarchical | `B, C, D extend A` | The `Vehicle` example above |
| Multiple | `C extends A, B` | C++ only. Causes the **diamond problem** |
| Interface / mixin | `C implements A, B` | How Java/TS get "multiple" inheritance safely |

**Diamond problem:** `B` and `C` both extend `A` and override `foo()`, and `D extends B, C`. Which `foo()` does `D` get? C++ solves it with `virtual` inheritance. Java and TS avoid it by allowing only single class inheritance (Java 8 `default` methods bring a mini-version back, and the compiler forces you to resolve the conflict explicitly).

### The fragile base class problem

Changes to a base class can silently break subclasses that rely on its internal behaviour:

```ts
class CountingSet<T> extends Set<T> {
  addCount = 0;
  add(v: T) { this.addCount++; return super.add(v); }
}

const s = new CountingSet<number>([1, 2, 3]);
console.log(s.size, s.addCount); // 3 0, even though 3 items were added
```

What happened: the `Set` constructor calls the **overridden** `this.add()` once per item (so `addCount` briefly reaches 3), and *then* the subclass's field initializer `addCount = 0` runs after `super()` returns and wipes it. The subclass's correctness depends on two things it never controlled: whether the parent calls its own overridable methods internally, and in what order construction happens. That's the fragile base class problem. (Java's version is the classic *Effective Java* example: `HashSet.addAll` calls `add`, so a counting subclass that overrides both counts everything twice.)

The fix is to wrap the `Set` instead of extending it:

```ts
class CountingSet2<T> {
  private readonly set = new Set<T>();
  addCount = 0;
  constructor(items: Iterable<T> = []) { for (const i of items) this.add(i); }
  add(v: T) { this.addCount++; this.set.add(v); return this; }
  has(v: T) { return this.set.has(v); }
  get size() { return this.set.size; }
}
// new CountingSet2([1, 2, 3]).addCount === 3, and Set's internals can't affect it
```

This is why **composition over inheritance** is the default advice. Inheritance is the tightest coupling there is: a subclass sees (and depends on) the parent's implementation, not only its interface.

### Composition over inheritance

**Composition = has-a.** Build behaviour by holding references to other objects and delegating to them.

Classic trap: modelling variation with subclasses leads to a class explosion.

```ts
// Inheritance: every combination is its own class
class Duck {}
class FlyingQuackingDuck extends Duck {}
class FlyingSilentDuck extends Duck {}
class NonFlyingQuackingDuck extends Duck {}   // RubberDuck? DecoyDuck? 2 behaviours × N options = N² classes
```

```ts
// Composition: each behaviour is a pluggable object
interface FlyBehaviour   { fly(): string }
interface QuackBehaviour { quack(): string }

const flyWithWings: FlyBehaviour = { fly: () => 'flap flap' };
const cannotFly: FlyBehaviour    = { fly: () => '...' };
const loudQuack: QuackBehaviour  = { quack: () => 'QUACK' };
const squeak: QuackBehaviour     = { quack: () => 'squeak' };

class Duck {
  constructor(
    private readonly name: string,
    private flyer: FlyBehaviour,
    private quacker: QuackBehaviour,
  ) {}
  performFly()   { return `${this.name}: ${this.flyer.fly()}`; }
  performQuack() { return `${this.name}: ${this.quacker.quack()}`; }
  setFlyBehaviour(f: FlyBehaviour) { this.flyer = f; }   // behaviour can even change at runtime
}

const mallard = new Duck('Mallard', flyWithWings, loudQuack);
const rubber  = new Duck('Rubber',  cannotFly,    squeak);
```

N + M small classes instead of N × M subclasses, behaviour swappable at runtime, and each behaviour testable on its own. This is the [Strategy pattern](../../designPatterns/Strategy%20pattern.md).

### When inheritance *is* the right call

Use it when **all** of these are true:
1. There's a genuine, stable **is-a** relationship (`Car is a Vehicle`), not "has-a" or "uses-a."
2. The subclass can be used anywhere the parent is expected without surprises ([Liskov](./02_SOLID%20Principles.md#l--liskov-substitution-principle-lsp)).
3. The base class is designed for extension (template methods, documented hooks) or is abstract.
4. The hierarchy is shallow and unlikely to need combinations of features.

Common good uses: framework hooks (`extends HttpServlet`, `React.Component`), custom error types (`class NotFoundError extends Error`), and domain hierarchies with a closed, stable set of kinds.

---

## 4. Polymorphism

**Definition:** "many forms." One interface, multiple implementations. Code written against a supertype works with any subtype, and the correct behaviour is chosen automatically.

### Kinds of polymorphism

| Kind | When resolved | How | Example |
| --- | --- | --- | --- |
| **Subtype / runtime** (the one interviews mean) | Runtime (dynamic dispatch) | Overriding methods through inheritance or interfaces | `shape.area()` calls `Circle.area` or `Rect.area` |
| **Ad hoc / compile-time** | Compile time | Method **overloading**, operator overloading | Java `print(int)` vs `print(String)` |
| **Parametric** | Compile time | Generics | `Stack<T>`, `Array<T>` |
| **Duck typing / structural** | Runtime (JS) / compile time (TS) | "If it has `quack()`, it's a duck" | TS accepts any object matching the interface shape |

### Overloading vs overriding

| | Overloading | Overriding |
| --- | --- | --- |
| Where | Same class | Subclass vs superclass |
| Signature | Same name, **different parameters** | Same name, **same signature** |
| Resolved | Compile time (static) | Runtime (dynamic dispatch) |
| Purpose | Convenience | Specialise behaviour |
| TS/JS | TS has overload *signatures* but only one implementation. JS has none | Natural: redefine the method in the subclass |

In C++, overriding needs a `virtual` base method. Otherwise the call is bound statically to the declared type, which is a classic C++ interview question. In Java, all non-`static`, non-`final`, non-`private` methods are virtual by default.

### The payoff: replacing conditionals with polymorphism

```ts
// Before: every new shape means editing this function (and every function like it)
function area(shape: { kind: string; r?: number; w?: number; h?: number }) {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.r! ** 2;
    case 'rect':   return shape.w! * shape.h!;
    // case 'triangle': ... you'll forget one of the N switches somewhere
    default: throw new Error('unknown shape');
  }
}
```

```ts
// After: each type carries its own behaviour, and callers never branch on type
interface Shape { area(): number; perimeter(): number }

class Circle implements Shape {
  constructor(private readonly r: number) {}
  area() { return Math.PI * this.r ** 2; }
  perimeter() { return 2 * Math.PI * this.r; }
}

class Rect implements Shape {
  constructor(private readonly w: number, private readonly h: number) {}
  area() { return this.w * this.h; }
  perimeter() { return 2 * (this.w + this.h); }
}

const totalArea = (shapes: Shape[]) => shapes.reduce((sum, s) => sum + s.area(), 0);
// Adding Triangle = one new class. totalArea never changes (Open/Closed Principle).
```

### Expression problem: the honest trade-off

Polymorphism makes **adding types** cheap (one new class) but **adding operations** expensive (a new method in every class). A `switch` / discriminated union is the opposite: adding operations is cheap, adding types is expensive.

```ts
// TS discriminated union + exhaustive check: a perfectly good choice when the set of types is closed
type Shape2 = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number };

function area2(s: Shape2): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'rect':   return s.w * s.h;
    default: { const _exhaustive: never = s; return _exhaustive; } // compile error if a case is missing
  }
}
```

A strong interview answer: *"If new types get added often (payment methods, vehicle types), I use polymorphism. If the types are fixed but operations keep growing (an AST with many passes), I use a union/switch or the Visitor pattern."*

### How dynamic dispatch works (asked at deeper levels)

- **C++ / Java:** each class with virtual methods has a **vtable** (an array of function pointers). Each object stores a pointer to its class's vtable. `obj.foo()` means: follow the vptr, index into the table, call. It costs one extra indirection per call, and inlining is harder (JITs speculate it back).
- **JavaScript:** method lookup walks the **prototype chain** (`obj → Class.prototype → Parent.prototype → Object.prototype`). V8 makes it fast with hidden classes and inline caches. A call site that always sees the same "shape" (monomorphic) is fast. Many shapes (megamorphic) is slower.

---

## 5. Object relationships (what your class diagram shows)

| Relationship | Meaning | Lifetime | UML | Example |
| --- | --- | --- | --- | --- |
| **Dependency** | *Uses* temporarily (parameter, local variable) | Unrelated | `- - ->` | `OrderService.place(order, clock)` |
| **Association** | *Knows about* through a field | Independent | `——>` | `Student —> Course` |
| **Aggregation** | *Has-a*, whole/part, parts can exist alone | Part outlives whole | `◇——` | `Team ◇— Player` |
| **Composition** | *Owns-a*, parts die with the whole | Part's lifetime = whole's | `◆——` | `House ◆— Room`, `Order ◆— OrderLine` |
| **Inheritance** | *Is-a* | n/a | `——▷` | `Car ——▷ Vehicle` |
| **Realization** | *Implements* | n/a | `- - ▷` | `StripeGateway - - ▷ PaymentGateway` |

```text
                       association
  ParkingLot ─────────────────────────────▶ «interface» PricingStrategy
      ◆ 1                                          ▲
      │ composition                                ┊ realization
      ▼ *                                    HourlyPricing
    Floor
      ◆ 1
      │ composition
      ▼ *            aggregation (0..1)
    Spot ◇──────────────────────────────▶ Vehicle ◀──────── Car
                                             ▲    inheritance
                                             ┊ dependency
                                           Ticket
```

Interview tip: when you draw the diagram, **say the relationship out loud** ("a floor is composed of spots: delete the floor and the spots go with it; a vehicle is only aggregated by a spot because it leaves"). Being precise about lifetime signals seniority.

---

## 6. Cohesion and coupling: the yardstick for every design

- **Cohesion (want HIGH):** how strongly the members of one class belong together. A `ReportGenerator` that also sends email and writes to S3 has low cohesion.
- **Coupling (want LOW):** how much one class depends on another's internals. `new MySqlConnection()` inside business logic is tight coupling. Taking a `Repository` interface in the constructor is loose.

Each pillar, used well, raises cohesion or lowers coupling:
- Encapsulation: state and the rules about it live together (cohesion).
- Abstraction: callers depend on contracts, not implementations (low coupling).
- Polymorphism: no type-switching scattered across callers (low coupling).
- Inheritance: **raises** coupling. Use it sparingly.

SOLID (next page) is a set of concrete rules for getting high cohesion and low coupling. Read it right after this: [SOLID Principles](./02_SOLID%20Principles.md).

---

## 7. Applying the pillars in an LLD round: a checklist

1. **Find the nouns** (entities) and **verbs** (behaviours) in the requirements. Nouns become candidate classes, verbs become methods on the class that owns the data they need.
2. **Write down each entity's invariants** (`spot holds ≤ 1 vehicle`, `ticket can't be paid twice`). Then make sure only methods on that class can change the relevant state (encapsulation).
3. **Find the axes of variation** (pricing rules, payment methods, vehicle types, notification channels). Put an **interface** at each axis (abstraction + polymorphism).
4. **Prefer has-a.** Reach for `extends` only for a true, stable is-a with shared behaviour.
5. **Push behaviour into the objects** (tell, don't ask). A design where every class is fields plus getters and one `Manager` class does all the logic is the most common failure.
6. **Say the trade-offs:** "I made `PricingStrategy` an interface because pricing rules change per lot. Vehicle types are a small fixed set, so a simple hierarchy is fine there."

---

## 8. Interview questions (with crisp answers)

1. **Encapsulation vs abstraction?** Encapsulation hides *state* and controls access to it (who can touch it). Abstraction hides *complexity* behind a contract (what the caller needs to know). One is enforced with access modifiers, the other designed with interfaces.
2. **Are getters/setters encapsulation?** Only if they enforce something. Blind setters for every field give the same access as public fields. Prefer intent-revealing methods (`withdraw`, not `setBalance`).
3. **Interface or abstract class?** Interface for a capability or contract (many per class, no state). Abstract class when subclasses share state or code *and* are true subtypes. The default is an interface.
4. **Why composition over inheritance?** Inheritance couples the subclass to the parent's implementation (fragile base class), is fixed at compile time, and explodes combinatorially. Composition couples only to interfaces, can change at runtime, and combines freely.
5. **Overloading vs overriding?** Overloading: same name, different parameters, same class, resolved at compile time. Overriding: same signature in a subclass, resolved at runtime through dynamic dispatch.
6. **Can you override a static or private method?** No. Static methods are *hidden*, not overridden (they're bound to the class, not the instance). Private methods aren't visible to subclasses. (Java specifics, a common trick question.)
7. **What's the diamond problem and how do languages handle it?** Ambiguity when two parents override the same grandparent method. C++ uses virtual inheritance. Java and TS allow single class inheritance with multiple interfaces, and Java forces you to resolve `default` method conflicts explicitly.
8. **Is JavaScript object-oriented?** Yes, but it's prototype-based. `class` is syntax over constructor functions and the prototype chain. Objects inherit directly from other objects, and methods are looked up along `__proto__`.
9. **When is a `switch` on type acceptable?** When the set of types is closed and stable while operations grow (the expression problem), especially with an exhaustive check (`never` in TS, sealed classes in Java 17+ or Kotlin).
10. **How does polymorphism work under the hood?** vtables in C++/Java (one indirection per virtual call). The prototype chain plus inline caches in V8.

## Common mistakes in LLD rounds

- **Anaemic domain model:** entities are bags of getters/setters and a god-class `XManager` holds all the logic.
- **Inheritance for code reuse only:** `class Stack extends ArrayList` exposes `add(index, x)` and breaks stack semantics. Use composition.
- **Deep hierarchies** (`Vehicle → MotorVehicle → Car → Sedan → ElectricSedan`). Flatten them and push variation into strategies.
- **`instanceof` / type-switch chains** in business logic. That's a missing polymorphic method.
- **Returning mutable internals** (`getSpots()` returns the live array).
- **Over-abstracting:** an interface for every class "just in case," including ones with exactly one implementation and no test seam. Abstraction should match a real axis of change.
