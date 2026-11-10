---
sidebar_position: 5
---

# Observer Pattern

> **Why this matters in interviews:** Observer comes up whenever "when X happens, several other things should react": order status notifications, stock price alerts, auction bids, a YouTube channel's subscribers, an elevator display. Writing `subscribe` and `notify` is easy. Interviewers look for the hard parts: **what happens when a listener throws**, **sync vs async delivery**, **unsubscribing and memory leaks**, **push vs pull**, and when an in-process observer should become a **message queue**.

Prerequisites: [OOP Pillars](../Fundamentals/01_OOP%20Pillars.md), [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (OCP, DIP), [Strategy](./04_Strategy.md). Examples are in **TypeScript**. For Node.js examples with `EventEmitter` (signup flows, inventory alerts, WebSocket broadcasts) see [Observer Pattern in JS](../../designPatterns/Observer%20Pattern.md).

---

## 1. Intent

> **Define a one-to-many dependency between objects so that when one object changes state, all its dependents are notified and updated automatically.** (Gang of Four, *behavioural*)

| Role | What it is | Example |
| --- | --- | --- |
| **Subject** (publisher, observable) | Keeps a list of observers and notifies them | `Stock`, `Order`, `Auction` |
| **Observer** (subscriber, listener) | Gets called when something happens | `PriceAlert`, `EmailNotifier`, `BidderDashboard` |
| **Subscription** | The handle that undoes `subscribe` | The function returned by `subscribe` |

The key property: the **subject doesn't know what its observers are.** It knows only the observer interface. New reactions are added without editing the subject (OCP), and the subject depends on an abstraction (DIP).

## 2. The problem: a subject that calls everyone directly

```ts
// sketch: the coupled version
class OrderServiceCoupled {
  constructor(private email: unknown, private inventory: unknown, private analytics: unknown, private loyalty: unknown) {}
  placeOrder(/* ... */) {
    // save the order, then:
    // this.email.sendConfirmation(order);
    // this.inventory.reserve(order);
    // this.analytics.track('order_placed', order);
    // this.loyalty.addPoints(order);      ← every new reaction edits this method
  }
}
```

What's wrong with it:

- `OrderService` depends on four unrelated modules, and its constructor keeps growing.
- Every new reaction (fraud check, push notification) is an edit to the order code.
- One slow or failing reaction (email down) slows or breaks order placement.
- Testing `placeOrder` needs four mocks.

With Observer, `OrderService` publishes an `OrderPlaced` event, and each module subscribes on its own.

## 3. The classic implementation: Subject and Observer

A stock ticker in the GoF style. The subject holds observers and notifies them when its price changes.

```ts
interface Observer<T> {
  update(event: T): void;
}

class Subject<T> {
  private readonly observers = new Set<Observer<T>>();

  subscribe(o: Observer<T>): () => void {
    this.observers.add(o);
    return () => this.observers.delete(o);           // the unsubscribe handle
  }

  protected notify(event: T): void {
    for (const o of [...this.observers]) {           // iterate a snapshot (section 6)
      o.update(event);
    }
  }
}

type PriceChange = { symbol: string; oldPrice: number; newPrice: number };

class Stock extends Subject<PriceChange> {
  constructor(readonly symbol: string, private price: number) { super(); }

  getPrice(): number { return this.price; }

  setPrice(newPrice: number): void {
    if (newPrice === this.price) return;             // no change, no notification
    const oldPrice = this.price;
    this.price = newPrice;                           // update state FIRST, then notify
    this.notify({ symbol: this.symbol, oldPrice, newPrice });
  }
}

class PriceAlert implements Observer<PriceChange> {
  readonly triggered: string[] = [];
  constructor(private readonly threshold: number) {}
  update(e: PriceChange): void {
    if (e.oldPrice < this.threshold && e.newPrice >= this.threshold) {
      this.triggered.push(`${e.symbol} crossed ${this.threshold}`);
    }
  }
}

const acme = new Stock('ACME', 95);
const alert = new PriceAlert(100);
const unsubscribe = acme.subscribe(alert);
acme.setPrice(99);    // nothing
acme.setPrice(101);   // alert.triggered = ['ACME crossed 100']
unsubscribe();
acme.setPrice(90);
acme.setPrice(105);   // alert no longer notified
```

- **Why it works:** `Stock` only knows `Observer<PriceChange>`. Any number of alert, chart or logger objects can subscribe without changing `Stock`.
- **Update state before notifying:** observers may read the subject (`acme.getPrice()`) in their callback. If you notify first, they read the old value.
- **Return an unsubscribe function:** it's simpler than `unsubscribe(observer)` and can't remove the wrong one.
- **`Set` instead of an array:** subscribing the same observer twice is a no-op. If you want duplicates (rarely), use an array and say so.

## 4. A typed event bus (what you'd write in TypeScript)

In TS, observers are usually **functions**, and one bus carries several event types. A mapped type ties each event name to its payload, so `emit('order.placed', wrongPayload)` doesn't compile.

```ts
type Listener<T> = (payload: T) => void;

class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<any>>>();

  constructor(private readonly onError: (err: unknown, event: keyof Events) => void = () => {}) {}

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>, opts: { signal?: AbortSignal } = {}): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    const off = () => { set!.delete(listener); };
    opts.signal?.addEventListener('abort', off, { once: true });   // unsubscribe many listeners at once
    return off;
  }

  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const off = this.on(event, (payload) => { off(); listener(payload); });
    return off;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {      // snapshot: listeners may (un)subscribe while we notify
      try {
        listener(payload);
      } catch (err) {
        this.onError(err, event);           // one failing listener doesn't stop the others
      }
    }
  }

  listenerCount(event: keyof Events): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// The event catalogue is the contract between publishers and subscribers.
type ShopEvents = {
  'order.placed': { orderId: string; userId: string; totalCents: number };
  'order.cancelled': { orderId: string; reason: string };
};

const errors: unknown[] = [];
const bus = new EventBus<ShopEvents>((err) => errors.push(err));

const sent: string[] = [];
bus.on('order.placed', (e) => sent.push(`email ${e.userId} about ${e.orderId}`));
bus.on('order.placed', () => { throw new Error('analytics is down'); });
bus.on('order.placed', (e) => sent.push(`points for ${e.totalCents}`));

bus.emit('order.placed', { orderId: 'o1', userId: 'u1', totalCents: 2500 });
// sent   = ['email u1 about o1', 'points for 2500']   ← the third listener still ran
// errors = [Error('analytics is down')]
// bus.emit('order.placed', { orderId: 'o1' });      ← compile error: missing fields
```

**`AbortSignal` for cleanup** is the modern way to unsubscribe a group (a component unmounting, a request finishing): pass one signal to every `on` and call `controller.abort()` once. The DOM's `addEventListener` supports the same `signal` option.

## 5. Push vs pull

| | **Push** | **Pull** |
| --- | --- | --- |
| What's sent | The data: `{ oldPrice, newPrice }` | Just "I changed" (and maybe the subject) |
| Observer then | Uses the payload | Calls `subject.getPrice()` for what it needs |
| Pros | Observers don't depend on the subject's API, and it works across processes | Observers fetch only what they need, and payloads stay small |
| Cons | You may send data nobody needs, and the payload becomes a contract | Observers are coupled to the subject. The state may change again before they read it |
| Use when | Events are facts (`OrderPlaced`), or observers are remote | Observers need different slices of a large state (UI rendering) |

Push is the default for **events** (things that happened), and especially for anything that may later go over a network. Many systems mix them: push the event's identity and key fields, and let observers pull more if they need it.

## 6. The hard parts (what makes this a FAANG answer)

**1. A listener throws.** In a naive loop, one exception stops every later listener *and* bubbles into the publisher, so a broken analytics hook fails order placement. Wrap each call, report errors to a handler, and keep going (as `EventBus.emit` does). Node's `EventEmitter` does **not** isolate listeners this way: a throwing listener propagates out of `emit`.

**2. Sync vs async delivery.**
- **Synchronous** (the default for GoF, `EventEmitter`, the DOM) is simple and ordered, and listeners see a consistent state. But slow listeners block the publisher, and a listener runs inside the publisher's call stack and transaction.
- **Asynchronous** (queueing with `queueMicrotask`, or an actual queue) keeps the publisher fast. But ordering and error handling get harder, and listeners may see a newer state than the event describes, which is why push payloads matter.

```ts
async function emitAsync<T>(listeners: Iterable<(p: T) => Promise<void> | void>, payload: T) {
  const results = await Promise.allSettled([...listeners].map(async (l) => l(payload)));
  return results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason);
}
```

`Promise.allSettled` runs listeners concurrently and collects every failure instead of stopping at the first.

**3. Modifying subscribers during notification.** A `once` listener removes itself, and a listener may subscribe another. Iterating the live collection can skip a listener or call a new one in the same round. **Iterate a snapshot** (`[...set]`).

**4. Memory leaks: the lapsed listener problem.** The subject holds strong references to its observers. An observer that never unsubscribes (a closed screen, a finished request) stays in memory forever, and keeps getting called. Fixes:
- Always return and **call** the unsubscribe handle, or tie subscriptions to a lifecycle with `AbortSignal`.
- Node warns (`MaxListenersExceededWarning`) when an emitter gets more than 10 listeners for one event, which is usually a leak.
- Weak references (`WeakRef`, Java `WeakReference`) exist, but cleanup timing is unpredictable. Use explicit unsubscribing.

**5. Ordering.** Listeners usually run in subscription order, but **don't let correctness depend on it**. If "reserve inventory" must happen before "send confirmation," that's a workflow, not two independent observers. Call the steps in order, or chain events (`inventory.reserved` triggers the email).

**6. Cascades and loops.** Observer A updates subject B, whose observer updates A... Guard with "only notify on an actual change" (as `setPrice` does), and keep an eye on event chains that grow over time.

**7. Notifying inside a transaction.** If `OrderService` emits `order.placed` and then the DB transaction rolls back, listeners have already sent an email for an order that doesn't exist. Emit **after commit**. Across services, use the **transactional outbox**: write the event to an `outbox` table in the same transaction, and have a relay publish it. See [ACID vs BASE](../../HLD/Fundamentals/07_ACID%20vs%20BASE.md).

## 7. From Observer to pub/sub and message queues

| | Observer (in process) | Pub/Sub via a broker (Kafka, SNS/SQS, Redis Pub/Sub) |
| --- | --- | --- |
| Who knows whom | The subject holds references to its observers | Neither side knows the other, only a **topic** |
| Coupling in time | Both must be alive at the same moment | A queue holds messages while consumers are down (not Redis Pub/Sub, which is fire-and-forget) |
| Delivery | A function call: exactly once, unless it throws | At least once (usually): consumers must be **idempotent** |
| Scaling | One process | Many consumers, consumer groups, partitions |
| Failure handling | try/catch | Retries, dead-letter queues |
| Ordering | Subscription order | Per partition or key at most |

**The interview answer:** "Inside one service, an in-memory event bus is fine. Once reactions belong to other services, need retries, or must survive a crash, I'd publish to a durable broker through an outbox, and make consumers idempotent." That's the same pattern, scaled up.

**Related terms:**
- **Event sourcing** stores the events themselves as the source of truth. That's a different idea from Observer, which is about notification.
- **Reactive streams** (RxJS observables) are Observer plus operators (`map`, `filter`, `debounce`), completion and error signals, and sometimes backpressure.

## 8. Observer in the wild

| Example | Notes |
| --- | --- |
| DOM `addEventListener`, `MutationObserver`, `IntersectionObserver` | Observer for browser events |
| Node `EventEmitter` (streams, `http.Server`, `process`) | Synchronous, ordered, no error isolation |
| RxJS `Observable`, `Subject` | Observer plus stream operators |
| Redux `store.subscribe`, Vue/MobX reactivity, signals (Solid, Angular) | UI state change notification. Reactivity tracks dependencies automatically |
| Java `PropertyChangeListener`, Android `LiveData` | Classic GUI/data binding |
| Webhooks | Observer across the internet: you register a URL, the provider calls it |
| Kafka, SNS, Google Pub/Sub | Distributed publish/subscribe |
| Database triggers, Postgres `LISTEN/NOTIFY`, CDC (Debezium) | The database as the subject |

## 9. Observer vs related patterns

| | Observer | Pub/Sub | Mediator | Chain of Responsibility |
| --- | --- | --- | --- | --- |
| Shape | One subject → many observers | Many publishers → topic → many subscribers | Many colleagues ↔ one coordinator | Request passed along a chain |
| Who handles | **All** observers | All subscribers to the topic | The mediator decides | **The first** handler that can, or each in turn |
| Knowledge | Subject knows the observer interface | Only the topic | Colleagues know the mediator | Each handler knows the next |
| Use for | Reacting to state changes | Cross-service events | Complex interactions between many objects (a chat room, air traffic control) | Middleware, approval chains |

## 10. In LLD rounds

| Problem | Subject | Observers |
| --- | --- | --- |
| Stock exchange / price alerts | `Stock` | Alerts, charts, portfolio value |
| Online auction | `Auction` | Bidders (outbid notices), dashboard, auto-close timer |
| Order / delivery tracking | `Order` status | Customer notifications, warehouse, analytics |
| YouTube / newsletter | `Channel` | Subscribers (with notification preferences) |
| Elevator system | `Elevator` position | Floor displays, the scheduler |
| Parking lot | `ParkingFloor` availability | Entrance display boards |
| Weather station (the textbook case) | `WeatherData` | Current conditions, statistics, forecast displays |
| Chat / Slack | `Channel` messages | Connected clients (via WebSockets) |

**A sentence to use:** *"Price changes are published by `Stock`; alerts, charts and portfolio valuation subscribe. The subject only knows the `Observer` interface, so adding a new alert type doesn't touch `Stock`. Delivery is synchronous in this design. If alerts had to send SMS, I'd hand them off to a queue so a slow provider can't slow down price updates."*

## 11. Pitfalls

- **No unsubscribe**, or one that's never called: memory leaks and callbacks on dead objects.
- **No error isolation:** one listener's exception breaks the publisher.
- **Mutating the listener collection while iterating it.**
- **Relying on listener order** for correctness.
- **Heavy work in synchronous listeners,** which blocks the publisher.
- **Emitting before commit,** so listeners act on data that's rolled back.
- **Event payloads that expose internals** (the whole mutable entity), so a listener can change the subject's state. Send immutable facts.
- **Event spaghetti:** a chain of events triggering events until nobody can follow the flow. If steps must happen in order with error handling, call them explicitly or use a workflow (saga).

## 12. How to talk about it in the room

1. **Name the one-to-many relation:** "When the price changes, an open-ended set of things must react."
2. **Define the event first:** a name and an immutable payload (`PriceChange { symbol, oldPrice, newPrice }`).
3. **Show subscribe returning an unsubscribe handle,** and notify iterating over a snapshot.
4. **Address failure:** "One listener throwing won't stop the others. Errors go to an error handler."
5. **State the delivery model:** sync in-process for now, with the trigger for moving to a queue (slow, remote, or must-not-lose reactions).
6. **Mention ordering and idempotency** if the interviewer pushes toward distributed systems.

---

## Interview questions (with crisp answers)

**Q: What problem does Observer solve?**
It lets an object notify an open-ended set of dependents about changes without knowing their concrete types. Publishers and reactions are decoupled, and new reactions don't change the publisher.

**Q: Observer vs Pub/Sub?**
In Observer, the subject keeps direct references to its observers, in the same process. In Pub/Sub, publishers and subscribers only share a topic, a broker sits in between, and with a durable broker they don't need to be online at the same time.

**Q: Push or pull?**
Push sends the data with the notification; pull sends a signal and the observer queries the subject. Push suits events and remote observers; pull suits observers needing different parts of a large state.

**Q: What if an observer throws?**
Catch per observer, report it, and continue notifying the rest. Never let one subscriber break the publisher or the others.

**Q: How do you prevent memory leaks?**
Always provide and call unsubscribe, bind subscriptions to a lifecycle (an `AbortSignal`, component unmount), and watch listener counts. Weak references are a last resort.

**Q: Sync or async notification?**
Sync is simpler and ordered, but slow observers block the publisher. Async decouples timing but loses ordering guarantees and needs explicit error handling. For must-not-lose work, use a durable queue.

**Q: How do you make sure the email isn't sent for an order that failed to save?**
Emit after the transaction commits. Across services, write the event in the same transaction (outbox) and publish from there.

## Common mistakes

- Forgetting unsubscribe entirely.
- Notifying before updating the subject's state.
- Assuming `EventEmitter` isolates errors or runs listeners asynchronously (it does neither).
- Using Observer where a direct call with a clear order is needed.
- Treating a distributed event as delivered exactly once.
