---
sidebar_position: 7
---

# Adapter Pattern

> **Why this matters in interviews:** Adapter appears whenever an LLD design has to talk to **something it doesn't control**: payment gateways, SMS and email providers, map services, a legacy system, a vendor SDK. The pattern is simple. What interviewers look for is depth: that **your domain defines the interface** (not the vendor), that the adapter handles **semantic** differences (units, statuses, errors, sync vs async), not just renamed methods, and that you can contrast it with **Facade, Decorator and Proxy**.

Prerequisites: [SOLID Principles](../Fundamentals/02_SOLID%20Principles.md) (DIP, ISP), [Factory](./02_Factory.md), [Decorator](./06_Decorator.md). Examples are in **TypeScript**. The vendor SDKs below are **made up**, so the example focuses on the shape of the problem rather than any real API.

---

## 1. Intent

> **Convert the interface of a class into another interface clients expect. Adapter lets classes work together that couldn't otherwise because of incompatible interfaces.** (Gang of Four, *structural*)

| Role | What it is | Example |
| --- | --- | --- |
| **Target** | The interface **your code** wants to use | `PaymentGateway.charge(...)` |
| **Adaptee** | The existing class with an incompatible interface | A vendor SDK, a legacy module |
| **Adapter** | Implements the target by translating calls to the adaptee | `AcmePayAdapter`, `LegacyBankAdapter` |
| **Client** | Uses only the target | `CheckoutService` |

The real-world analogy is a travel plug adapter: the socket (target) and the plug (adaptee) both stay unchanged, and the adapter converts between them.

## 2. The problem: vendor shapes leaking into your domain

Two payment providers with nothing in common:

```ts
// ---- Vendor 1: a modern, promise-based SDK (made up) ----
type AcmeChargeResult = { id: string; state: 'succeeded' | 'requires_action' | 'failed'; failure_code?: string };
class AcmePaySdk {
  calls: Array<{ amount: number; currency: string; source: string; idempotency_key: string }> = [];
  async createCharge(params: { amount: number; currency: string; source: string; idempotency_key: string }): Promise<AcmeChargeResult> {
    this.calls.push(params);
    if (params.source === 'tok_declined') return { id: 'ch_2', state: 'failed', failure_code: 'card_declined' };
    return { id: 'ch_1', state: 'succeeded' };
  }
}

// ---- Vendor 2: a legacy, callback-based client (made up) ----
// Amounts are decimal strings in major units ("12.50"), and status is a numeric code.
class LegacyBankClient {
  submitPayment(
    req: { amt: string; ccy: string; cardRef: string; ref: string },
    cb: (err: Error | null, res?: { txnNo: number; code: number }) => void,
  ): void {
    setTimeout(() => {
      if (req.cardRef === 'expired') cb(null, { txnNo: 77, code: 51 });     // 51 = insufficient funds / declined
      else if (req.cardRef === 'timeout') cb(new Error('ETIMEDOUT'));
      else cb(null, { txnNo: 42, code: 0 });                                // 0 = approved
    }, 0);
  }
}
```

Without an adapter, `CheckoutService` would call both directly:
- `if (provider === 'acme') ... else ...` branches everywhere.
- Cents in one place, decimal strings in another.
- Callbacks mixed with promises, and vendor error codes in your business logic.

Switching or adding a provider would mean editing checkout code, and tests would need the real SDKs.

## 3. Define the target from your domain's point of view

The target interface is **designed by you**, in your own vocabulary. It isn't a copy of whichever vendor came first. This is the **Dependency Inversion** half of the pattern.

```ts
type Money = { amountMinor: number; currency: 'USD' | 'EUR' | 'INR' };   // minor units: cents, paise

type ChargeResult =
  | { status: 'SUCCEEDED'; providerRef: string }
  | { status: 'DECLINED'; providerRef: string; reason: 'INSUFFICIENT_FUNDS' | 'CARD_DECLINED' | 'OTHER' }
  | { status: 'PENDING_ACTION'; providerRef: string };                     // e.g. 3-D Secure

class PaymentProviderError extends Error {
  constructor(message: string, readonly retryable: boolean, options?: { cause?: unknown }) {
    super(message, options);
  }
}

interface PaymentGateway {
  charge(input: { money: Money; paymentToken: string; idempotencyKey: string }): Promise<ChargeResult>;
}
```

Notice what the target fixes:
- **Units:** always integer minor units.
- **Outcomes:** a small closed set of statuses.
- **Errors:** "declined" is a **result**, not an exception. Exceptions mean "we don't know what happened," and they carry a `retryable` flag.
- **Idempotency** is part of the contract.

## 4. The object adapter (composition): the default

```ts
class AcmePayAdapter implements PaymentGateway {
  constructor(private readonly sdk: AcmePaySdk) {}

  async charge({ money, paymentToken, idempotencyKey }: Parameters<PaymentGateway['charge']>[0]): Promise<ChargeResult> {
    const r = await this.sdk.createCharge({
      amount: money.amountMinor,                      // Acme also uses minor units: no conversion
      currency: money.currency.toLowerCase(),         // but wants lowercase codes
      source: paymentToken,
      idempotency_key: idempotencyKey,
    });
    switch (r.state) {
      case 'succeeded': return { status: 'SUCCEEDED', providerRef: r.id };
      case 'requires_action': return { status: 'PENDING_ACTION', providerRef: r.id };
      case 'failed': return {
        status: 'DECLINED',
        providerRef: r.id,
        reason: r.failure_code === 'insufficient_funds' ? 'INSUFFICIENT_FUNDS'
              : r.failure_code === 'card_declined' ? 'CARD_DECLINED' : 'OTHER',
      };
    }
  }
}

const MINOR_UNITS: Record<Money['currency'], number> = { USD: 2, EUR: 2, INR: 2 };

class LegacyBankAdapter implements PaymentGateway {
  constructor(private readonly client: LegacyBankClient) {}

  charge({ money, paymentToken, idempotencyKey }: Parameters<PaymentGateway['charge']>[0]): Promise<ChargeResult> {
    const req = {
      amt: toDecimalString(money.amountMinor, MINOR_UNITS[money.currency]),   // 1250 → "12.50"
      ccy: money.currency,
      cardRef: paymentToken,
      ref: idempotencyKey,                            // the legacy "reference" doubles as the idempotency key
    };
    // Callback → Promise: adapting the calling convention is part of the job.
    return new Promise((resolve, reject) => {
      this.client.submitPayment(req, (err, res) => {
        if (err) return reject(new PaymentProviderError('legacy bank unreachable', true, { cause: err }));
        const ref = String(res!.txnNo);
        if (res!.code === 0) return resolve({ status: 'SUCCEEDED', providerRef: ref });
        resolve({ status: 'DECLINED', providerRef: ref, reason: res!.code === 51 ? 'INSUFFICIENT_FUNDS' : 'OTHER' });
      });
    });
  }
}

// Integer → decimal string without floating point: 1250, 2 → "12.50"; 5, 2 → "0.05"
function toDecimalString(minor: number, digits: number): string {
  const s = String(Math.abs(minor)).padStart(digits + 1, '0');
  return `${minor < 0 ? '-' : ''}${s.slice(0, -digits)}.${s.slice(-digits)}`;
}
```

The client only knows the target:

```ts
class CheckoutService {
  constructor(private readonly gateway: PaymentGateway) {}

  async pay(orderId: string, money: Money, token: string): Promise<string> {
    const result = await this.gateway.charge({ money, paymentToken: token, idempotencyKey: `order-${orderId}` });
    switch (result.status) {
      case 'SUCCEEDED': return `paid (${result.providerRef})`;
      case 'PENDING_ACTION': return 'needs customer action';
      case 'DECLINED': return `declined: ${result.reason}`;
    }
  }
}

const usd = (amountMinor: number): Money => ({ amountMinor, currency: 'USD' });

await new CheckoutService(new AcmePayAdapter(new AcmePaySdk())).pay('1', usd(1250), 'tok_visa');     // 'paid (ch_1)'
await new CheckoutService(new LegacyBankAdapter(new LegacyBankClient())).pay('2', usd(1250), 'ok');  // 'paid (42)'
await new CheckoutService(new LegacyBankAdapter(new LegacyBankClient())).pay('3', usd(5), 'expired'); // 'declined: INSUFFICIENT_FUNDS'
```

- **Why it works:** `CheckoutService` depends only on `PaymentGateway`. Each vendor's quirks (units, casing, status codes, callbacks, error semantics) are contained in one class. Adding a third provider is a new adapter plus one line in a [factory](./02_Factory.md). Checkout tests use a fake `PaymentGateway`.
- **What the adapters translate:** not just names, but **units** (minor units ↔ decimal strings), **conventions** (callbacks → promises), **outcomes** (vendor states → a closed domain set) and **errors** (transport failure → `PaymentProviderError` with `retryable`).
- **Composition, not inheritance:** the adapter **holds** the SDK, so it works with any instance (including one configured by the vendor's own factory), and the SDK's methods don't leak into your interface.

## 5. The class adapter (inheritance)

The GoF also describe a **class adapter**, which inherits from the adaptee and implements the target:

```ts
class AcmePayClassAdapter extends AcmePaySdk implements PaymentGateway {
  async charge({ money, paymentToken, idempotencyKey }: Parameters<PaymentGateway['charge']>[0]): Promise<ChargeResult> {
    const r = await this.createCharge({ amount: money.amountMinor, currency: money.currency.toLowerCase(), source: paymentToken, idempotency_key: idempotencyKey });
    return r.state === 'succeeded' ? { status: 'SUCCEEDED', providerRef: r.id } : { status: 'DECLINED', providerRef: r.id, reason: 'OTHER' };
  }
}
```

| | Object adapter (composition) | Class adapter (inheritance) |
| --- | --- | --- |
| Works with | Any instance of the adaptee, and its subclasses | Only the class it extends, created by you |
| Exposes | Only the target interface | Target **plus** all adaptee methods (leaky) |
| Can override adaptee behaviour | No (only wrap it) | Yes |
| Needs | Nothing special | Inheritable adaptee; in Java/C#, the target must be an interface (no multiple class inheritance); C++ can use multiple inheritance |

Prefer the **object adapter**. The class adapter is worth knowing for the comparison question.

## 6. Other forms of adapter

**Function adapters.** `util.promisify(fs.readFile)` is an adapter from Node's callback convention to promises. So are `Array.from(arrayLike)` and `Object.fromEntries(map)`.

```ts
// A generic callback → promise adapter, the core of util.promisify
function promisify<A extends unknown[], R>(fn: (...args: [...A, (err: Error | null, res?: R) => void]) => void) {
  return (...args: A) => new Promise<R>((resolve, reject) => {
    fn(...args, (err, res) => (err ? reject(err) : resolve(res as R)));
  });
}
```

**Data adapters (mappers).** A function `toDomainOrder(apiDto): Order` that converts shapes. It's often all you need when there's no behaviour to adapt.

**Two-way adapters.** These implement both interfaces, during a migration where old and new code must call each other.

**Anti-corruption layer (DDD).** This is the adapter idea at the scale of a whole bounded context. A set of adapters, translators and facades keeps a legacy or external model from leaking its concepts into your domain, both in naming and in meaning.

**Ports and Adapters (Hexagonal architecture).** The domain declares **ports** (interfaces like `PaymentGateway`, `OrderRepository`). Infrastructure provides **adapters**: Postgres repositories, HTTP controllers, vendor clients. It's the same pattern applied as an architecture, and it's what makes the domain testable without infrastructure.

## 7. The hard parts

**1. Semantic mismatch, not just syntax.** Renaming methods is easy. The real work is where the two sides **mean** different things:
- **Units and precision:** cents vs decimal strings, milliseconds vs seconds, UTC vs local time.
- **Status vocabularies:** the vendor's 14 states mapped to your 3. Write down where each one goes, and fail loudly on unknown values instead of mapping them to `SUCCEEDED`.
- **Sync vs async:** some providers confirm later via webhook. The adapter returns `PENDING`, and a separate webhook handler, also an adapter, completes it.
- **Idempotency:** if the vendor has no idempotency key, the adapter may need to store keys itself to avoid double charges on retry.

**2. Capability gaps.** What if the adaptee can't do something the target requires (refunds, partial captures)? Options:
- **Emulate** it (if possible, and honestly).
- Throw a clear `UnsupportedOperation` error, which is an LSP smell if callers can't anticipate it.
- **Split the interface** (ISP): `Chargeable`, `Refundable`. Clients check or are given only what's supported.
- Expose **capabilities** (`gateway.supports('refund')`). This is common in multi-provider systems.

**3. Error translation.** Map vendor errors to your error types, and keep the original as `cause` for debugging. Decide what's **retryable**: timeouts and 5xx yes, "card declined" never.

**4. Don't leak the adaptee.** Return types, exceptions and enums from the vendor SDK must not appear in the target interface. Otherwise every client depends on the vendor again.

**5. Testing.** Unit-test each adapter against the SDK, faked or recorded, for each mapping and error path. Also run **contract tests** against the vendor's sandbox, so a vendor change is caught by a test rather than by customers. Test clients against a fake target.

**6. Keep adapters thin.** Translation only. Business rules ("retry declined cards with another provider") belong in the domain or in a decorator or strategy above the adapter, so they apply to every provider.

## 8. Adapter in the wild

| Example | Adapts |
| --- | --- |
| `util.promisify`, `stream.Readable.from`, `Readable.toWeb` | Calling conventions and stream types |
| JDBC / ODBC drivers, Knex and Prisma dialects | One query API → many databases |
| SLF4J bindings, `winston` transports | One logging API → many backends |
| `java.io.InputStreamReader` (bytes → chars), `Arrays.asList` (array → `List`) | Classic GoF-style adapters in the JDK |
| React Native native modules, Capacitor plugins | JS interface → platform APIs |
| Cloud-agnostic SDKs (Terraform providers, multi-cloud storage libraries) | One interface → many clouds |
| Payment orchestration platforms | One payment API → dozens of acquirers |

## 9. Adapter vs related patterns

| | Adapter | Facade | Decorator | Proxy | Bridge |
| --- | --- | --- | --- | --- | --- |
| Interface | **Converts** to an existing target | **New, simpler** interface over a subsystem | **Same** as wrapped | **Same** as wrapped | Abstraction and implementation as two hierarchies |
| Wraps | Usually one adaptee | Many classes | One component | One subject | — |
| Purpose | Make incompatible things work together | Make a complex subsystem easy to use | Add behaviour | Control access | Let both sides vary independently |
| Designed | **After the fact**, to fit existing code | Up front or after | Up front | Up front | **Up front**, by design |

The one-line contrasts:
- **Adapter vs Facade:** an adapter makes something fit an interface that **already exists**; a facade **defines a new, simpler** one.
- **Adapter vs Decorator:** an adapter changes the interface; a decorator keeps it and adds behaviour.
- **Adapter vs Bridge:** an adapter is applied after the fact to make things fit, while a bridge is a deliberate up-front design that separates abstraction from implementation.

## 10. In LLD rounds

| Problem | Target (yours) | Adapters |
| --- | --- | --- |
| Payment system / e-commerce checkout | `PaymentGateway` | One per provider |
| Notification service | `NotificationChannel.send(message)` | Email, SMS, push providers |
| Ride sharing / food delivery | `MapsService.eta(from, to)` | One per map provider |
| Hotel / flight booking aggregator | `InventoryProvider.search(query)` | One per partner API |
| Logging / metrics library | `Logger`, `MetricsSink` | Console, file, vendor agents |
| Legacy migration | The new domain interface | Wrapping the old system until it's replaced (strangler fig) |
| Media player (the textbook example) | `MediaPlayer.play(file)` | `Mp4Adapter`, `VlcAdapter` |

**A sentence to use:** *"Checkout depends on our own `PaymentGateway` interface, defined in our terms: minor units, three outcomes and a retryable error. Each provider gets an adapter that does the translation, including callbacks to promises and vendor codes to our statuses. A factory picks the adapter from config, so adding a provider never touches checkout."*

## 11. Pitfalls

- **Designing the target as a copy of the first vendor's API,** so the second vendor needs awkward contortions and your domain speaks the vendor's language.
- **Leaking adaptee types** (vendor enums, exceptions, response objects) through the target.
- **Lossy or silent mappings:** unknown statuses mapped to a default, and errors swallowed.
- **Fat adapters** containing business logic, retries or routing between providers.
- **Floating-point money conversion** (`amount / 100` → `12.499999`). Convert with integers or a decimal library.
- **Adapting what you own.** If you control both sides, change one of them instead of adding a translation layer.

## 12. How to talk about it in the room

1. **Start from your domain:** "Checkout needs to charge money and get one of three outcomes." Define that interface first.
2. **Introduce the vendor mismatch** concretely: units, statuses, callbacks, errors.
3. **Write one adapter fully,** mapping every outcome and error. Mention the others by name.
4. **Say how one is chosen:** a factory keyed by config or the merchant's region.
5. **Cover failure semantics:** retryable vs not, idempotency keys, and pending or webhook flows.
6. **Name the bigger picture if there's time:** ports and adapters, the anti-corruption layer, and contract tests against sandboxes.

---

## Interview questions (with crisp answers)

**Q: What problem does Adapter solve?**
It lets code written against one interface use a class with a different, incompatible interface, without changing either. The adapter translates calls, data and errors.

**Q: Object adapter or class adapter?**
Object adapter (composition) by default: it works with any instance, doesn't expose the adaptee's methods, and doesn't need multiple inheritance. A class adapter can override adaptee behaviour but couples you to one concrete class.

**Q: Adapter vs Facade?**
An adapter converts an interface to one the client **already expects**. A facade **creates a new, simpler** interface over a complex subsystem. An adapter usually wraps one object; a facade usually wraps many.

**Q: Adapter vs Decorator vs Proxy?**
An adapter changes the interface. A decorator and a proxy keep it: the decorator adds behaviour, and the proxy controls access.

**Q: Who should own the target interface?**
The client side, your domain. That's dependency inversion: high-level code defines the abstraction, and the low-level vendor integration conforms to it.

**Q: What if the adaptee can't support an operation?**
Emulate it if that's honest, split the interface so clients only depend on what's supported, or expose capabilities. Avoid a method that silently does nothing.

**Q: How do you test adapters?**
Unit tests with a faked or recorded adaptee for every mapping and error path, plus contract tests against the vendor's sandbox. Clients are tested with a fake target.

## Common mistakes

- Calling any wrapper an adapter. If the interface doesn't change, it's a decorator or a proxy.
- Translating names but not meanings (units, statuses, error semantics).
- Treating "declined" as an exception in one adapter and as a result in another. The target contract must define it.
- Letting checkout code `catch` vendor-specific exceptions.
