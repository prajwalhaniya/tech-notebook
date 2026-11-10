---
sidebar_position: 4
---

# Strategy Pattern

> **Why this matters in interviews:** Strategy is the pattern that turns up most often in LLD rounds, usually without being named: pricing in a parking lot, split types in Splitwise, eviction in a cache, algorithms in a rate limiter, scheduling in an elevator. Interviewers look for three things: that you **spot the varying behaviour** and pull it behind an interface, that you can say **who picks the strategy** (the `switch` doesn't disappear, it moves), and that you know when a **plain function** is enough.

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md) (polymorphism, composition over inheritance), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (OCP, DIP), [Factory](./02_Factory.md). Examples are in **TypeScript**. For Node.js backend examples (payments, file storage, auth) see [Strategy Pattern in JS](../../designPatterns/Strategy%20pattern.md).

---

## 1. Intent

> **Define a family of algorithms, encapsulate each one, and make them interchangeable. Strategy lets the algorithm vary independently from the clients that use it.** (Gang of Four, *behavioural*)

Three roles:

| Role | What it is | Splitwise example |
| --- | --- | --- |
| **Strategy** (interface) | The contract every algorithm meets | `SplitStrategy.split(amount, participants)` |
| **Concrete strategies** | One class (or function) per algorithm | `EqualSplit`, `ExactSplit`, `PercentSplit` |
| **Context** | Uses a strategy through the interface and never checks which one it has | `ExpenseService.addExpense(...)` |

The one-line version: **composition over conditionals.** Instead of the context asking "which kind am I?", it holds an object that already knows.

## 2. The problem: one method that knows every algorithm

```ts
// sketch: the version interviewers want you to move away from
function splitExpense(type: 'EQUAL' | 'EXACT' | 'PERCENT', amountCents: number, users: string[], values?: Record<string, number>) {
  switch (type) {
    case 'EQUAL':   /* divide, handle leftover cents */ break;
    case 'EXACT':   /* validate the amounts add up */ break;
    case 'PERCENT': /* validate 100%, round fairly */ break;
    // SHARES next quarter, then ADJUSTMENT, then ...
  }
}
```

What's wrong with it:

- **OCP:** every new split type edits this function, and its tests, and risks breaking the others.
- **SRP:** three algorithms with different validation rules live in one place.
- **Awkward inputs:** `values` means amounts for one type, percentages for another, and nothing for the third.
- **Testing:** you can't test `PERCENT` rounding without going through the dispatcher.
- **Duplication:** the same `switch (type)` tends to reappear for display names, validation and analytics.

## 3. The classic implementation: interface + classes

A Splitwise-style splitter. Money is in **integer cents** so no cent is lost to floating point.

```ts
type UserId = string;
type Shares = Map<UserId, number>;          // cents owed by each participant

interface SplitStrategy {
  readonly name: string;
  split(amountCents: number, participants: readonly UserId[]): Shares;
}

class SplitError extends Error {}

const sum = (xs: Iterable<number>) => { let s = 0; for (const x of xs) s += x; return s; };

function assertSameUsers(participants: readonly UserId[], given: ReadonlyMap<UserId, number>): void {
  if (given.size !== participants.length || !participants.every((u) => given.has(u))) {
    throw new SplitError('values must be given for exactly the participants');
  }
}

class EqualSplit implements SplitStrategy {
  readonly name = 'EQUAL';
  split(amountCents: number, participants: readonly UserId[]): Shares {
    const n = participants.length;
    const base = Math.floor(amountCents / n);
    let leftover = amountCents - base * n;            // 0..n-1 cents nobody has paid yet
    const shares: Shares = new Map();
    for (const u of participants) {
      shares.set(u, base + (leftover > 0 ? 1 : 0));    // first `leftover` people pay one cent more
      if (leftover > 0) leftover--;
    }
    return shares;
  }
}

class ExactSplit implements SplitStrategy {
  readonly name = 'EXACT';
  constructor(private readonly amounts: ReadonlyMap<UserId, number>) {}

  split(amountCents: number, participants: readonly UserId[]): Shares {
    assertSameUsers(participants, this.amounts);
    const total = sum(this.amounts.values());
    if (total !== amountCents) throw new SplitError(`amounts add up to ${total}, expected ${amountCents}`);
    return new Map(participants.map((u) => [u, this.amounts.get(u)!]));
  }
}

class PercentSplit implements SplitStrategy {
  readonly name = 'PERCENT';
  private readonly basisPoints: ReadonlyMap<UserId, number>;   // 1% = 100 bps: integers, no float drift

  constructor(percents: ReadonlyMap<UserId, number>) {
    this.basisPoints = new Map([...percents].map(([u, p]) => [u, Math.round(p * 100)]));
  }

  split(amountCents: number, participants: readonly UserId[]): Shares {
    assertSameUsers(participants, this.basisPoints);
    if (sum(this.basisPoints.values()) !== 10_000) throw new SplitError('percentages must add up to 100');

    // Largest-remainder rounding: floor every share, then give the leftover cents
    // to the participants with the largest dropped fractions.
    const parts = participants.map((u) => {
      const scaled = amountCents * this.basisPoints.get(u)!;   // share × 10_000, an exact integer
      return { u, floor: Math.floor(scaled / 10_000), frac: scaled % 10_000 };
    });
    const shares: Shares = new Map(parts.map((p) => [p.u, p.floor]));
    let leftover = amountCents - sum(shares.values());
    for (const p of [...parts].sort((a, b) => b.frac - a.frac)) {
      if (leftover === 0) break;
      shares.set(p.u, shares.get(p.u)! + 1);
      leftover--;
    }
    return shares;
  }
}
```

The **context** only knows the interface:

```ts
class ExpenseService {
  private readonly balances = new Map<UserId, number>();   // > 0: others owe you; < 0: you owe

  addExpense(paidBy: UserId, amountCents: number, participants: readonly UserId[], strategy: SplitStrategy): Shares {
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new SplitError('amount must be positive cents');
    if (participants.length === 0) throw new SplitError('no participants');

    const shares = strategy.split(amountCents, participants);   // no `if (type === ...)` anywhere
    for (const [user, owed] of shares) this.adjust(user, -owed);
    this.adjust(paidBy, amountCents);
    return shares;
  }

  balanceOf(user: UserId): number {
    return this.balances.get(user) ?? 0;
  }

  private adjust(user: UserId, delta: number): void {
    this.balances.set(user, this.balanceOf(user) + delta);
  }
}

const svc = new ExpenseService();
svc.addExpense('alice', 1000, ['alice', 'bob', 'carol'], new EqualSplit());
// shares: alice 334, bob 333, carol 333  (the 1 leftover cent goes to the first person)
svc.addExpense('bob', 1000, ['alice', 'bob', 'carol'], new PercentSplit(new Map([['alice', 33.33], ['bob', 33.33], ['carol', 33.34]])));
// shares: alice 333, bob 333, carol 334  (exact shares 333.3, 333.3, 333.4 → floors 333 each, 1 cent to carol)
```

- **Why it works:** `ExpenseService` depends on the `SplitStrategy` abstraction (DIP). Each algorithm, with its own validation and rounding, lives in one class you can unit test alone. Adding `SharesSplit` ("2 shares for Alice, 1 for Bob") is a new class with **no edits** to the service (OCP).
- **Notice the design choice:** strategies that need extra input (`ExactSplit`'s amounts, `PercentSplit`'s percentages) take it in their **constructor**. That keeps one narrow `split(amount, participants)` signature instead of an optional `values` parameter that means something different for each type. This is the most common Strategy design question in interviews: *"different algorithms need different data. What does the interface look like?"*
- **Invariants the strategies guarantee:** shares add up to exactly `amountCents`, and every participant gets a share. Say this out loud; it's what the interviewer is testing with the rounding.

## 4. Who picks the strategy?

The `switch` doesn't vanish. It **moves to one place** that runs once, usually at the edge of the system. Pick one of these:

| Who chooses | How | When |
| --- | --- | --- |
| **The caller** | Passes the strategy in, as above | The user's choice arrives with the request |
| **A factory or registry** | Maps a key (from JSON, config, a DB row) to a constructor | Strategy chosen per request from data |
| **Configuration / DI** | Wired at startup: `new Cache(new LruEviction())` | One strategy per deployment or environment |
| **The context itself** | Picks based on input size or shape (e.g. `sort` switching to insertion sort under 16 elements) | An implementation detail the caller shouldn't care about |

A registry for requests arriving as JSON, typed so each type gets the right payload:

```ts
type SplitRequest =
  | { type: 'EQUAL' }
  | { type: 'EXACT'; values: Record<UserId, number> }
  | { type: 'PERCENT'; values: Record<UserId, number> };

const splitFactories: { [K in SplitRequest['type']]: (req: Extract<SplitRequest, { type: K }>) => SplitStrategy } = {
  EQUAL: () => new EqualSplit(),
  EXACT: (req) => new ExactSplit(new Map(Object.entries(req.values))),
  PERCENT: (req) => new PercentSplit(new Map(Object.entries(req.values))),
};

function strategyFor(req: SplitRequest): SplitStrategy {
  // TS can't correlate req.type with the matching factory on its own, hence the cast.
  const make = splitFactories[req.type] as (r: SplitRequest) => SplitStrategy;
  return make(req);
}

strategyFor({ type: 'EXACT', values: { alice: 700, bob: 300 } }).split(1000, ['alice', 'bob']);  // alice 700, bob 300
```

The mapped type makes the registry **exhaustive**: add `'SHARES'` to `SplitRequest` and the compiler refuses to build until `splitFactories` has an entry. That's the [Factory](./02_Factory.md) pattern working for Strategy, and it's the usual pairing.

## 5. Functions as strategies (the idiomatic TS/JS answer)

If a strategy is **one method with no state**, it's a function. JavaScript has used this form all along: the comparator in `Array.prototype.sort` is a strategy.

```ts
type Product = { name: string; priceCents: number; rating: number };
type Comparator<T> = (a: T, b: T) => number;

const byPrice: Comparator<Product> = (a, b) => a.priceCents - b.priceCents;
const byRatingDesc: Comparator<Product> = (a, b) => b.rating - a.rating;

// Strategies compose: the first comparator that sees a difference decides.
const thenBy = <T>(...cmps: Comparator<T>[]): Comparator<T> => (a, b) => {
  for (const c of cmps) {
    const r = c(a, b);
    if (r !== 0) return r;
  }
  return 0;
};

const products: Product[] = [
  { name: 'pen', priceCents: 200, rating: 4.1 },
  { name: 'ink', priceCents: 200, rating: 4.8 },
  { name: 'pad', priceCents: 150, rating: 3.9 },
];
products.sort(thenBy(byPrice, byRatingDesc));   // pad, ink, pen
```

Retry backoff is another classic function strategy. **Factories that return strategies** carry the configuration in a closure:

```ts
type Backoff = (attempt: number) => number;     // attempt 0, 1, 2, ... → delay in ms

const fixed = (ms: number): Backoff => () => ms;
const exponential = (baseMs: number, capMs: number): Backoff =>
  (attempt) => Math.min(capMs, baseMs * 2 ** attempt);
const fullJitter = (baseMs: number, capMs: number, rand: () => number = Math.random): Backoff =>
  (attempt) => Math.floor(rand() * Math.min(capMs, baseMs * 2 ** attempt));   // spreads retries out

async function withRetry<T>(op: () => Promise<T>, retries: number, backoff: Backoff): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await op();
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, backoff(attempt)));
    }
  }
}
```

**Classes still earn their place when** the strategy has several related methods (an eviction policy has `onGet`, `onPut`, `evict`), holds state between calls, needs a name or metadata for logs and admin screens, or is injected by a DI container. A function type is the lighter default.

## 6. Composing strategies

Strategies are values, so you can build new ones from old ones. Discounts are the usual interview example (*"what if several promotions apply?"*):

```ts
type Cart = { subtotalCents: number; items: number };
type Discount = (cart: Cart) => number;   // cents off

const percentOff = (pct: number): Discount => (c) => Math.floor((c.subtotalCents * pct) / 100);
const flatOffAbove = (minCents: number, offCents: number): Discount => (c) => (c.subtotalCents >= minCents ? offCents : 0);
const noDiscount: Discount = () => 0;

const bestOf = (...ds: Discount[]): Discount => (c) => Math.max(0, ...ds.map((d) => d(c)));
const stacked = (...ds: Discount[]): Discount => (c) =>
  Math.min(c.subtotalCents, ds.reduce((total, d) => total + d(c), 0));   // never discount below zero

const promo = bestOf(percentOff(10), flatOffAbove(5_000, 700));
promo({ subtotalCents: 6_000, items: 3 });   // max(600, 700) = 700
promo({ subtotalCents: 4_000, items: 2 });   // max(400, 0)   = 400
```

`bestOf` and `stacked` are themselves `Discount`s, so the context still sees one strategy. That's the **Composite** pattern applied to strategies. A `noDiscount` default (the **Null Object**) removes `if (discount)` checks from the context.

## 7. Design questions interviewers push on

**Where does the data come from?** Two options:

- The context **passes what the strategy needs** as arguments. Keep the parameter narrow: a `PricingInput` with the 3 fields needed, not the whole `ParkingLot`.
- The strategy is given a **reference to the context**. That's more flexible, but it couples them, so prefer arguments.

**Stateless or stateful?**

- Stateless strategies can be shared singletons (`const EQUAL = new EqualSplit()`).
- Stateful ones need a fresh instance per context. An LRU eviction policy holds its own ordering, so one instance per cache.

**Can the strategy change at runtime?** Yes. Expose `setStrategy()` or swap a field. Be careful with stateful strategies: switching an LRU policy to LFU mid-flight loses the LRU ordering, so the new policy must be primed from the current keys.

**What about different return types?** A strategy family must share one contract. If one variant needs to return extra information, widen the return type for all of them (a result object with optional fields), or it isn't the same family.

**Validation:** each strategy validates its own inputs (as `ExactSplit` does). Shared checks, like a positive amount, stay in the context.

## 8. Strategy in the wild

| Example | The strategy |
| --- | --- |
| `Array.prototype.sort(compareFn)`, Java `Comparator`, Python `sorted(key=...)` | Ordering |
| Passport.js `passport.use(new LocalStrategy(...))` | Authentication method (it's even called a strategy) |
| Cache eviction (LRU, LFU, FIFO) in Caffeine, Redis `maxmemory-policy` | What to drop |
| Load balancers: round robin, least connections, consistent hashing (NGINX, Envoy) | Which backend gets the request |
| Rate limiting algorithms: token bucket, sliding window | When to reject |
| Compression codecs (gzip, brotli, zstd), serializers (JSON, protobuf) | Encoding |
| Retry and backoff policies in AWS SDKs, gRPC | When to retry |
| Java `ThreadPoolExecutor`'s `RejectedExecutionHandler` | What to do when the queue is full |

## 9. Strategy vs related patterns

| | Strategy | State | Template Method | Command | Factory |
| --- | --- | --- | --- | --- | --- |
| Question | *How* should this be done? | *What* can I do in my current situation? | Which *steps* of a fixed algorithm vary? | *What* should be done, later or undoably? | *Which* object should be created? |
| Who chooses | The client (or config) | The states themselves, as transitions happen | The subclass, at compile time | Whoever builds the command | The factory |
| Mechanism | Composition | Composition | Inheritance | Composition | Creation |
| Swappable at runtime | ✅ | ✅ (automatically) | ❌ | — | — |
| Variants know each other | No | Usually (they name the next state) | No | No | No |

The key interview contrast is **[State](./08_State.md)**: the same class diagram, but in State the object switches its own behaviour as its internal state changes, and the states know about each other. With Strategy, the client picks, and the strategies are independent of each other.

**Template Method** is the inheritance-based alternative: a base class fixes the algorithm skeleton and subclasses override steps. Strategy is usually preferred (composition, runtime swapping, no fragile base class), but Template Method is fine when the skeleton really is fixed.

## 10. In LLD rounds

| Problem | Strategy for | Concrete strategies |
| --- | --- | --- |
| Parking lot | Pricing | Hourly, flat, weekend, EV-charging surcharge |
| Splitwise | Splitting an expense | Equal, exact, percent, shares |
| LRU / LFU cache | Eviction | LRU, LFU, FIFO, TTL |
| Rate limiter | Algorithm | Token bucket, leaky bucket, fixed window, sliding log |
| Elevator | Scheduling | Nearest car, SCAN (elevator algorithm), zone-based |
| Payment system | Payment method | Card, UPI, wallet, net banking |
| Ride sharing | Matching and pricing | Nearest driver, highest rated; surge pricing |
| Chess / tic-tac-toe | Computer player | Random, minimax, heuristic |
| Logging framework | Output and formatting | Console, file, JSON, plain text |

**A sentence to use:** *"Pricing varies by lot and will keep changing, so `ParkingLot` depends on a `PricingStrategy` interface. Each rule is one class, and the strategy is picked from the lot's config by a small factory. New pricing means a new class, not an edit to `ParkingLot`."*

## 11. Pitfalls

- **A strategy for a single algorithm.** If there's only one way and no sign of a second, a plain method is fine. Introduce the interface when the second variant arrives, or when you need a fake in tests.
- **The `switch` sneaks back.** If the context does `if (strategy instanceof PercentSplit)`, the abstraction has leaked. Move that behaviour into the strategy.
- **A bloated interface:** methods some strategies can't implement (`throw new Error('not supported')`), which violates ISP and LSP. Split the interface.
- **Passing the whole context** "in case a strategy needs it," which couples every strategy to every field.
- **Sharing a stateful strategy** between contexts, e.g. one LRU policy instance for two caches.
- **Class explosion for one-liners:** ten classes that each wrap a single expression. Use functions.
- **Strategies that disagree on invariants:** one returns shares that don't add up to the total. Write one contract test suite and run it against every strategy.

## 12. How to talk about it in the room

1. **Name what varies.** "Pricing changes per lot and over time; the rest of the parking flow doesn't." That sentence justifies the pattern.
2. **Define the interface first,** with a narrow input: `price(ticket: TicketInfo): Money`.
3. **Implement one or two strategies,** not all of them. Show the tricky one (rounding, validation).
4. **Say who chooses:** "a factory keyed on the lot's config," or "passed in with the request."
5. **Mention the lighter version:** "In TypeScript I could make these plain functions; I'm using classes because each one has validation and a name for the admin UI."
6. **Connect it to SOLID:** OCP for new variants, DIP because the context depends on the interface, SRP because each algorithm is isolated and testable.

---

## Interview questions (with crisp answers)

**Q: What problem does Strategy solve?**
It replaces conditionals that select between algorithms with polymorphism. Each algorithm is encapsulated behind one interface, so algorithms can be added, tested and swapped without changing the code that uses them.

**Q: Strategy vs State?**
Same structure, different intent. With Strategy, the **client** chooses the algorithm and the strategies don't know each other. With State, the **object's own state** determines the behaviour, and states trigger transitions to other states.

**Q: Strategy vs Template Method?**
Strategy uses composition: the whole algorithm is swappable at runtime. Template Method uses inheritance: a fixed skeleton, with steps overridden in subclasses at compile time. Prefer Strategy unless the skeleton is truly fixed.

**Q: Doesn't this just move the `switch` somewhere else?**
Yes, deliberately. The choice happens **once**, in a factory or composition root, instead of in every method that behaves differently. And with a registry, adding a variant becomes a registration rather than an edit to existing code.

**Q: Different strategies need different inputs. How do you design the interface?**
Put variant-specific parameters in the strategy's constructor (or closure) and keep the method signature to what all strategies share. If the shared input is large, pass a narrow, purpose-built input object.

**Q: Is a lambda a strategy?**
Yes. A function type is a single-method strategy interface. Use classes when a strategy has several methods, state or metadata.

**Q: How do you test this?**
Each concrete strategy gets its own unit tests, plus one shared contract test suite (e.g. "shares always add up to the amount") run against all of them. The context is tested with a fake strategy.

## Common mistakes

- Checking `instanceof` on the strategy inside the context.
- An interface with optional parameters that mean different things for different strategies.
- Floating-point money in pricing or splitting strategies. Use integer cents and a stated rounding rule.
- Not saying who selects the strategy, or hard-coding the selection in several places.
- Creating a strategy hierarchy when there is only one behaviour.
