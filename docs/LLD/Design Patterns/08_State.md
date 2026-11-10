---
sidebar_position: 8
---

# State Pattern

> **Why this matters in interviews:** State is at the core of the most common LLD problems: **vending machine, ATM, elevator, traffic light, order lifecycle, document approval, parking ticket, BookMyShow seat booking**. Interviewers look for: a clear list of **states, events and transitions** before any code, **illegal transitions rejected** in one place, a reasoned choice between **State classes and a transition table**, and, for senior candidates, how state survives **persistence and concurrency** (two requests changing the same order at once).

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md) (polymorphism), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (OCP, SRP), [Strategy](./04_Strategy.md) (same structure, different intent). Examples are in **TypeScript**.

---

## 1. Intent

> **Allow an object to alter its behaviour when its internal state changes. The object will appear to change its class.** (Gang of Four, *behavioural*)

| Role | What it is | Vending machine example |
| --- | --- | --- |
| **Context** | The object clients use. It holds the current state and delegates to it | `VendingMachine` |
| **State** (interface) | One method per event the context accepts | `insertCoin`, `select`, `cancel`, `restock` |
| **Concrete states** | The behaviour for each event **in that state**, including which state comes next | `IdleState`, `HasMoneyState`, `SoldOutState` |

Before writing code, every state-machine answer starts with the **model**:

```
              insertCoin                    select: sold, stock left
      IDLE ───────────────▶ HAS_MONEY ───────────────────────────▶ IDLE
       ▲ ▲                   │  │  ⟲ insertCoin (adds to balance)
       │ └───── cancel ──────┘  │
       │                        │ select: sold the last item
       │                        ▼
       └──────── restock ──── SOLD_OUT
```

| State \ Event | `insertCoin` | `select` | `cancel` | `restock` |
| --- | --- | --- | --- | --- |
| **IDLE** | → HAS_MONEY | ✖ "insert money first" | no-op (refund 0) | stay IDLE |
| **HAS_MONEY** | stay (add) | → IDLE or SOLD_OUT, or stay on error | → IDLE (refund) | ✖ "busy" |
| **SOLD_OUT** | ✖ reject coin | ✖ | no-op | → IDLE |

Drawing this table first is the single most valuable thing you can do in a state-machine interview. It exposes the questions ("what happens if they press cancel with no money?") before the code does.

## 2. The problem: the same `switch` in every method

```ts
// sketch: the version that doesn't scale
class VendingMachineSwitch {
  state: 'IDLE' | 'HAS_MONEY' | 'SOLD_OUT' = 'IDLE';
  insertCoin(c: number) {
    switch (this.state) { case 'IDLE': /* ... */ break; case 'HAS_MONEY': /* ... */ break; case 'SOLD_OUT': /* ... */ break; }
  }
  select(code: string) {
    switch (this.state) { /* same three cases again */ }
  }
  cancel() {
    switch (this.state) { /* and again */ }
  }
}
```

- Each state's behaviour is **scattered** across every method.
- Adding a state (`MAINTENANCE`) means editing every method, and it's easy to miss one.
- Transitions are assignments buried in branches, so there's no single place to see or enforce the machine.

With a handful of states and events, a `switch` (or a table, section 5) is perfectly fine. The pattern pays off as states, events and per-state logic grow.

## 3. The GoF implementation: one class per state

```ts
type Product = { code: string; name: string; priceCents: number; count: number };
type Sale = { product: string; changeCents: number };

class VendingError extends Error {}

interface VendingState {
  readonly name: 'IDLE' | 'HAS_MONEY' | 'SOLD_OUT';
  insertCoin(m: VendingMachine, cents: number): void;
  select(m: VendingMachine, code: string): Sale;
  cancel(m: VendingMachine): number;                       // returns the refund
  restock(m: VendingMachine, code: string, count: number): void;
}

// Default: every event is illegal. Each state overrides only what it allows,
// so a forgotten case fails loudly instead of doing something random.
abstract class BaseState implements VendingState {
  abstract readonly name: VendingState['name'];
  insertCoin(_m: VendingMachine, _cents: number): void { throw this.illegal('insert a coin'); }
  select(_m: VendingMachine, _code: string): Sale { throw this.illegal('select a product'); }
  cancel(_m: VendingMachine): number { return 0; }          // cancelling with nothing to refund is harmless
  restock(_m: VendingMachine, _code: string, _count: number): void { throw this.illegal('restock'); }
  protected illegal(action: string) { return new VendingError(`cannot ${action} while ${this.name}`); }
}

class IdleState extends BaseState {
  readonly name = 'IDLE' as const;
  insertCoin(m: VendingMachine, cents: number) {
    m.addToBalance(cents);
    m.transitionTo(STATES.HAS_MONEY);
  }
  select(): Sale { throw new VendingError('insert money first'); }
  restock(m: VendingMachine, code: string, count: number) { m.addStock(code, count); }
}

class HasMoneyState extends BaseState {
  readonly name = 'HAS_MONEY' as const;
  insertCoin(m: VendingMachine, cents: number) { m.addToBalance(cents); }      // stay

  select(m: VendingMachine, code: string): Sale {
    const p = m.product(code);
    if (!p) throw new VendingError(`unknown product ${code}`);                   // stay: user can pick again
    if (p.count === 0) throw new VendingError(`${p.name} is sold out`);          // stay
    if (m.balance < p.priceCents) throw new VendingError(`insert ${p.priceCents - m.balance} more`);

    m.takeOne(code);
    const changeCents = m.balance - p.priceCents;
    m.resetBalance();
    m.transitionTo(m.totalStock() === 0 ? STATES.SOLD_OUT : STATES.IDLE);
    return { product: p.name, changeCents };
  }

  cancel(m: VendingMachine): number {
    const refund = m.balance;
    m.resetBalance();
    m.transitionTo(STATES.IDLE);
    return refund;
  }
}

class SoldOutState extends BaseState {
  readonly name = 'SOLD_OUT' as const;
  insertCoin(): void { throw new VendingError('sold out: coin returned'); }
  restock(m: VendingMachine, code: string, count: number) {
    m.addStock(code, count);
    if (m.totalStock() > 0) m.transitionTo(STATES.IDLE);
  }
}

// States hold no data, so one shared instance of each is enough (Flyweight).
const STATES = { IDLE: new IdleState(), HAS_MONEY: new HasMoneyState(), SOLD_OUT: new SoldOutState() };
```

The **context** delegates every event to the current state and owns the data:

```ts
const ACCEPTED_COINS = new Set([5, 10, 25, 100]);

class VendingMachine {
  private state: VendingState;
  private _balance = 0;
  private readonly inventory = new Map<string, Product>();
  readonly history: string[] = [];                              // audit trail of transitions

  constructor(products: Product[]) {
    for (const p of products) this.inventory.set(p.code, { ...p });
    this.state = this.totalStock() > 0 ? STATES.IDLE : STATES.SOLD_OUT;
  }

  // ---- Public API: events. No `switch (state)` anywhere. ----
  insertCoin(cents: number): void {
    if (!ACCEPTED_COINS.has(cents)) throw new VendingError(`coin ${cents} not accepted`);  // state-independent check
    this.state.insertCoin(this, cents);
  }
  select(code: string): Sale { return this.state.select(this, code); }
  cancel(): number { return this.state.cancel(this); }
  restock(code: string, count: number): void { this.state.restock(this, code, count); }

  get stateName() { return this.state.name; }
  get balance() { return this._balance; }

  // ---- Used by states only (TS has no "friend"; in Java these would be package-private). ----
  transitionTo(next: VendingState): void {
    if (next !== this.state) this.history.push(`${this.state.name} → ${next.name}`);
    this.state = next;
  }
  addToBalance(cents: number) { this._balance += cents; }
  resetBalance() { this._balance = 0; }
  product(code: string) { return this.inventory.get(code); }
  takeOne(code: string) { this.inventory.get(code)!.count--; }
  addStock(code: string, count: number) {
    const p = this.inventory.get(code);
    if (!p) throw new VendingError(`unknown product ${code}`);
    p.count += count;
  }
  totalStock() { let n = 0; for (const p of this.inventory.values()) n += p.count; return n; }
}

const vm = new VendingMachine([{ code: 'A1', name: 'Chips', priceCents: 125, count: 1 }]);
vm.insertCoin(100);
vm.insertCoin(25);
vm.insertCoin(25);
vm.select('A1');        // { product: 'Chips', changeCents: 25 }
vm.stateName;           // 'SOLD_OUT' (that was the last item)
// vm.insertCoin(25)    → VendingError: sold out: coin returned
vm.restock('A1', 5);    // → IDLE
// vm.history = ['IDLE → HAS_MONEY', 'HAS_MONEY → SOLD_OUT', 'SOLD_OUT → IDLE']
```

- **Why it works:**
  - Each state class contains all of the behaviour for that state, so `HasMoneyState` reads like a spec of what's allowed with money inserted.
  - The context never branches on state; it just delegates.
  - A new state (`MAINTENANCE`) is a new class plus the transitions into it, with no edits to the other states' methods.
- **The base class that throws** makes illegal events explicit and safe by default. This is the main design decision to call out: the machine **rejects** what it doesn't expect.
- **Stateless state objects** (all data lives in the context) can be shared singletons. If a state needs its own data (a `DispensingState` with a timer), create a new instance per transition.
- **Who decides transitions:** here the **states** do (decentralized). That's the GoF style, and it keeps each state's logic local. The cost: states know about each other, and there's no single place to see the whole machine. The alternative is next.

## 4. Who owns the transitions?

| | States decide (GoF) | Context or table decides |
| --- | --- | --- |
| Where transitions live | Spread across state classes | One table or method |
| Seeing the whole machine | Read every class | Read one table |
| Adding a state | New class; edit the states that lead into it | Add rows |
| Per-state behaviour | Rich, encapsulated per class | Lives in actions or handlers keyed by state |
| Best for | Behaviour differs a lot per state (vending machine, TCP connection, game AI) | Mostly **which transitions are legal** plus side effects (order and payment lifecycles, workflows) |

Most business entities (orders, payments, tickets, documents) are the second kind. That's why a **transition table** is often the better interview answer for them.

## 5. The table-driven state machine (often the right answer)

```ts
type OrderStatus = 'CREATED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
type OrderEvent = 'pay' | 'ship' | 'deliver' | 'cancel' | 'refund';

// The whole machine in one place. Anything not listed is illegal.
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  CREATED:   { pay: 'PAID', cancel: 'CANCELLED' },
  PAID:      { ship: 'SHIPPED', cancel: 'REFUNDED' },     // cancelling after payment means a refund
  SHIPPED:   { deliver: 'DELIVERED' },
  DELIVERED: { refund: 'REFUNDED' },                      // a return
  CANCELLED: {},                                          // terminal
  REFUNDED:  {},                                          // terminal
};

class IllegalTransition extends Error {
  constructor(readonly from: OrderStatus, readonly event: OrderEvent) {
    super(`cannot ${event} an order that is ${from}`);
  }
}

type Order = { id: string; status: OrderStatus; version: number; deliveredAt?: number };

// Guards: extra conditions beyond "is this edge in the table?"
const GUARDS: Partial<Record<OrderEvent, (o: Order, now: number) => string | null>> = {
  refund: (o, now) => (o.deliveredAt !== undefined && now - o.deliveredAt > 30 * 86_400_000 ? 'return window closed' : null),
};

function apply(order: Order, event: OrderEvent, now = Date.now()): Order {
  const next = TRANSITIONS[order.status][event];
  if (!next) throw new IllegalTransition(order.status, event);
  const blocked = GUARDS[event]?.(order, now);
  if (blocked) throw new Error(blocked);
  return {
    ...order,
    status: next,
    version: order.version + 1,
    ...(next === 'DELIVERED' ? { deliveredAt: now } : {}),   // an entry action
  };
}

let order: Order = { id: 'o1', status: 'CREATED', version: 0 };
order = apply(order, 'pay');       // PAID
order = apply(order, 'ship');      // SHIPPED
// apply(order, 'cancel')          → IllegalTransition: cannot cancel an order that is SHIPPED
```

- **Why it's often better:** the whole lifecycle is **data**, so you can read it, review it with product managers, render it as a diagram, and test it exhaustively (every state × every event). `apply` is pure (old order in, new order out), which is easy to test and to persist.
- **Guards** handle conditional transitions ("refund only within 30 days"). **Entry and exit actions** handle side effects (set `deliveredAt`, send an email after commit).
- **When State classes win instead:** when each state has substantial, different **behaviour** (not just "is this allowed?"), as in the vending machine.
- **Libraries:** XState (JS statecharts), Spring Statemachine, AWS Step Functions (state machines as a service). Mention them, but write your own in the interview.

## 6. The hard parts (senior-level)

**1. Persistence.** State classes aren't stored in a database; the **state name** is. On load, map the name back to the state object (`STATES[row.status]`) or the table. Keep names stable, since renaming a state is a data migration.

**2. Concurrency: two events at once.** A customer cancels while the warehouse ships. Both read `PAID`, and both transitions look legal. Without protection, the last write wins and the order is both shipped and refunded. Make the transition a **compare-and-set**:

```sql
UPDATE orders
SET status = 'SHIPPED', version = version + 1
WHERE id = :id AND status = 'PAID' AND version = :expectedVersion;
-- 0 rows updated → someone else changed it first: reload and re-evaluate (or report a conflict)
```

That's optimistic locking on the state column. The alternatives are a row lock (`SELECT ... FOR UPDATE`) or routing all events for one order through a single queue partition, which serializes them. In memory, the same applies to async code: two `await`s can interleave between the check and the write.

**3. Side effects and transitions.** "Charge the card, then move to PAID." If the charge succeeds and the state update fails, you've charged without recording it. Use intermediate states (`PAYMENT_PENDING`), idempotency keys on the external call, and the outbox pattern for events. See [ACID vs BASE](../../HLD/Fundamentals/07_ACID%20vs%20BASE.md).

**4. Idempotent events.** Webhooks and queues deliver the same event twice. Decide whether a repeat `pay` on a `PAID` order is an error or a no-op. Usually it's a no-op if it carries the same payment id.

**5. Timeouts as events.** Real machines have time-based transitions: a seat hold expires after 10 minutes, or the vending machine refunds after 60 seconds of inactivity. Model "timeout" as an **event**, fired by a scheduler, and apply it through the same `apply` and guards. Never mutate the state directly from a timer.

**6. Audit trail.** Store each transition (`from`, `to`, `event`, `actor`, `at`). It's what support and compliance ask for, and it's free once every transition goes through one function.

**7. Hierarchical and parallel states (statecharts).** "Any state except DELIVERED can be cancelled" leads to duplicated rows. Statecharts add nested states (`ACTIVE { CREATED, PAID, SHIPPED }` with one `cancel` edge from `ACTIVE`) and parallel regions (payment status and shipping status as independent machines). Mentioning this signals depth.

## 7. State vs Strategy (the classic question)

| | State | Strategy |
| --- | --- | --- |
| Class diagram | Context → interface ← concrete classes | **Identical** |
| Who chooses the implementation | **The states themselves**, as events happen | **The client**, from outside |
| Do implementations know each other? | Yes, they name the next state | No, they're independent |
| How often it changes | Constantly, as part of normal operation | Rarely: usually set once |
| What it models | Lifecycle and modes (*what can I do now?*) | Interchangeable algorithms (*how should I do this?*) |
| Example | Vending machine: IDLE → HAS_MONEY → IDLE | Parking lot: hourly vs flat pricing |

**One sentence:** *"Strategy is chosen from outside and stays put; State changes itself from inside as events arrive."* An object can use both: an order has a State (its lifecycle) and a Strategy (its pricing).

## 8. State in the wild

| Example | States |
| --- | --- |
| TCP connection (the GoF example) | LISTEN, SYN_SENT, ESTABLISHED, FIN_WAIT, CLOSED, ... |
| JS `Promise` | pending → fulfilled or rejected (terminal, transition exactly once) |
| `XMLHttpRequest.readyState`, `WebSocket.readyState`, media elements | Connection and loading lifecycles |
| Order, payment, refund lifecycles (any e-commerce or payments company) | Usually table-driven with guards and audit logs |
| CI/CD pipelines, Kubernetes pod phases | Pending, Running, Succeeded, Failed |
| Circuit breaker | CLOSED → OPEN → HALF_OPEN → CLOSED |
| Game AI and UI flows (XState) | Idle, chasing, attacking; wizard steps |
| Lexers and regex engines | Finite automata: the theory behind all of this |

## 9. In LLD rounds

| Problem | States | Notes |
| --- | --- | --- |
| Vending machine | Idle, HasMoney, Dispensing, SoldOut, Maintenance | State classes; coin validation; change-making |
| ATM | Idle, CardInserted, PinVerified, Transaction, OutOfCash | PIN retries as a guard; card retained after 3 failures |
| Elevator | Idle, MovingUp, MovingDown, DoorsOpen, Maintenance | Combine with a scheduling **Strategy** |
| Traffic light | Red, Green, Yellow (+ pedestrian, flashing) | Timeouts as events |
| Order / food delivery | Created, Paid, Preparing, PickedUp, Delivered, Cancelled | Table-driven; concurrency; refunds |
| BookMyShow seat | Available, Held (expires), Booked | Hold timeout, compare-and-set on the seat row |
| Document workflow | Draft, InReview, Approved, Rejected, Published | Role-based guards (only reviewers approve) |
| Parking ticket | Active, Paid, Exited, Lost | Payment and exit gates |

**A sentence to use:** *"Here's the state table first: each row a state, each column an event, and empty cells are illegal. Behaviour differs a lot per state, so I'll use State classes with a base class that rejects everything by default. States are stateless singletons, the machine holds the data, and every transition goes through `transitionTo`, which also writes the audit log. In the database I'd store the state name and update it with a compare-and-set so concurrent events can't both win."*

## 10. Pitfalls

- **Skipping the model:** coding before listing the states, events and transitions.
- **Allowing illegal transitions silently,** for example a default branch that does nothing.
- **Setting the state from outside** (`order.status = 'SHIPPED'`) instead of through events. Make the state private; the only way to change it is an event.
- **State classes holding data that belongs to the context,** which is then lost on transition.
- **Overusing the pattern:** four classes for a two-state boolean. Use an enum.
- **Ignoring concurrency and persistence** in a question about orders or bookings.
- **Side effects before the state is safely recorded,** or emitted from inside the transaction that might roll back.
- **Timers that mutate state directly,** bypassing guards.

## 11. How to talk about it in the room

1. **Draw the table** (states × events) or a diagram. Ask about the empty cells.
2. **Choose a representation and say why:** State classes when behaviour differs per state; a transition table when it's mainly legality plus side effects.
3. **Make illegal transitions explicit:** a base state that throws, or "not in the table" means rejected.
4. **Route every change through one method** (`transitionTo` or `apply`): that's where you add validation, auditing and events.
5. **Address persistence and concurrency:** store the name, and use compare-and-set or a version column.
6. **Contrast with Strategy** in one sentence if asked.

---

## Interview questions (with crisp answers)

**Q: What problem does State solve?**
Behaviour that depends on an object's mode, written as the same `switch (state)` in every method. State moves each mode's behaviour into its own class, and the object delegates to the current one, so it "changes class" as its state changes.

**Q: State vs Strategy?**
Same structure. Strategy is chosen by the client and rarely changes; strategies are independent. State changes itself as events arrive; states know their successors.

**Q: Who should trigger transitions, the states or the context?**
States, when the logic for leaving a state belongs with that state's behaviour (GoF). The context or a table, when you want the whole machine in one place to read, validate and audit. Many production systems use a table.

**Q: Should state objects be singletons?**
If they hold no data (everything lives in the context), yes: share one instance per state. If a state has its own data (timers, retry counts), create a new instance on each transition.

**Q: How do you persist an object with State classes?**
Store the state's name (an enum), and rebuild the state object from it on load. Don't serialize the state classes.

**Q: Two requests change the same order at the same time. What happens?**
Without protection, both read the same state and both transitions succeed. Use compare-and-set (`UPDATE ... WHERE status = :expected` or a version column), a row lock, or a single-writer queue per entity.

**Q: How do you handle time-based transitions?**
Model the timeout as an event fired by a scheduler, processed through the same transition logic and guards, and make it idempotent in case it fires after the state has already moved on.

## Common mistakes

- Using booleans (`isPaid`, `isShipped`, `isCancelled`) instead of one state field, which allows impossible combinations.
- No terminal states, or terminal states that still accept events.
- Mutating shared singleton states (putting per-machine data on them).
- Forgetting that a failed action (insufficient money) should usually **leave the state unchanged**.
