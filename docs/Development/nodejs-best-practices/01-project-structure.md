---
sidebar_position: 1
---

# Project Structure

How to lay out folders, components, and layers so a Node.js codebase stays navigable as it grows past a handful of files.

---

## Table of Contents

1. [Structure by Components, Not by Technical Role](#structure-by-components-not-by-technical-role)
2. [Layer Each Component](#layer-each-component)
3. [Choosing a Web Framework](#choosing-a-web-framework)
4. [Hierarchical, Environment-Aware Configuration](#hierarchical-environment-aware-configuration)
5. [Wrap Common Utilities as Packages](#wrap-common-utilities-as-packages)
6. [Use TypeScript Sparingly and Thoughtfully](#use-typescript-sparingly-and-thoughtfully)

---

## Structure by Components, Not by Technical Role

### The Problem with One Big Monolith

Past a certain size, a single undivided codebase turns into a dependency tangle — everything can reach everything else, so no one can change one thing without checking the blast radius across the whole app. The fix isn't necessarily "go microservices" on day one; it's to draw internal borders now so the app *could* split later without a rewrite.

**Component:** A self-contained slice of the business domain — orders, users, payments — with its own API, business logic, and data access, that other components only touch through its public interface.

Think of "microservices" as a set of principles you can partially adopt, not a checklist you must complete. The minimum viable step: give each business capability its own folder (or repo) and forbid other components from reaching into its internals.

### Structure by Component (Do)

Group files by what they *do for the business*, not by what technical role they play. A glance at the top-level folders should tell a reader what the system is — an orders platform, a billing system — not what framework it uses.

```text
my-system
├─ apps                     # components
│  ├─ orders
│  │  ├─ package.json
│  │  ├─ entry-points       # api, message-queue, ...
│  │  ├─ domain
│  │  └─ data-access
│  ├─ users
│  │  ├─ package.json
│  │  ├─ entry-points
│  │  ├─ domain
│  │  └─ data-access
│  └─ payments
│     ├─ package.json
│     ├─ entry-points
│     ├─ domain
│     └─ data-access
└─ libraries                # generic, cross-component code
   ├─ logger
   └─ authenticator
```

Each component is a standalone logical app: it can be reasoned about, tested, and onboarded onto without loading the rest of the system into your head. Components talk to each other only through their exported API — never by importing each other's internal files.

### Group by Technical Role (Avoid)

```text
my-system
├─ controllers
│  ├─ user-controller.js
│  ├─ order-controller.js
│  └─ payment-controller.js
├─ services
│  ├─ user-service.js
│  ├─ order-service.js
│  └─ payment-service.js
└─ models
   ├─ user-model.js
   ├─ order-model.js
   └─ payment-model.js
```

This looks tidy at 20 files. At 200, changing "how orders work" means editing three unrelated top-level folders, and nothing stops `payment-service.js` from silently importing `user-model.js` directly. The structure describes the framework's MVC vocabulary, not the product — it doesn't "scream" what the application actually does.

### Why This Pays Off

- **Change isolation** — a change to the `orders` component can't accidentally break `payments`, because there's no file-level coupling between them.
- **Faster onboarding** — a new engineer assigned to `users` only needs to open one folder, not the whole repository.
- **A path to microservices** — because each component is already self-contained with its own `package.json` and public interface, extracting it into its own deployable service later is a copy-paste, not a redesign.

---

## Layer Each Component

Once a component exists, give its internals a consistent shape. Every component's root should hold three folders representing the stages a request passes through:

```text
apps
└─ orders
   ├─ entry-points
   │  ├─ api               # HTTP controllers
   │  └─ message-queue      # queue consumers
   ├─ domain                 # services, DTOs, business logic
   └─ data-access            # DB queries, repositories
```

### Entry-Points

**Entry-points:** The doors into the application — REST controllers, GraphQL resolvers, message queue consumers, scheduled jobs. Anything that can trigger a flow.

Keep this layer thin. Its only job is to adapt an external payload (JSON, a queue message) into the shape the domain layer expects, run basic input validation, call into the domain, and translate the result back into a response. A few lines per handler is the target — the term "controller" is really just a synonym for "adapter" here.

```javascript
// entry-points/api/orders-controller.js
import { Router } from "express";
import { placeOrder } from "../../domain/order-service.js";

export const ordersRouter = Router();

ordersRouter.post("/orders", async (req, res, next) => {
  try {
    const { customerId, items } = req.body; // minimal shape validation
    const order = await placeOrder({ customerId, items });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});
```

### Domain

**Domain:** Where the app's actual behavior lives — services, entities/DTOs, and clients for external services, all expressed in plain, protocol-agnostic objects.

This layer accepts and returns plain JavaScript objects — never an `Express` `Request`/`Response`, never a raw queue message. That's what lets the same business logic be called from an HTTP controller today and a queue consumer or CLI script tomorrow without modification.

```javascript
// domain/order-service.js
import { saveOrder } from "../data-access/orders-repository.js";
import { chargeCustomer } from "../../payments/domain/payment-client.js";

export async function placeOrder({ customerId, items }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  await chargeCustomer(customerId, total);
  return saveOrder({ customerId, items, total, status: "confirmed" });
}
```

### Data-Access

**Data-access:** The only layer allowed to talk to the database, ideally through an interface that returns plain, DB-agnostic objects (the repository pattern).

```javascript
// data-access/orders-repository.js
import { db } from "../../../libraries/db-client/index.js";

export async function saveOrder(order) {
  const { rows } = await db.query(
    "INSERT INTO orders (customer_id, items, total, status) VALUES ($1, $2, $3, $4) RETURNING *",
    [order.customerId, JSON.stringify(order.items), order.total, order.status],
  );
  return rows[0];
}
```

### Why Three Layers, Not MVC or Clean Architecture

The payoff is that most of a feature's work happens in `domain/` — once the entry-point and data-access scaffolding exist, adding a feature is mostly business logic, not plumbing. This separation is the same idea behind DDD, hexagonal architecture, and clean architecture, just with a shallower learning curve:

- **MVC** technically only prescribes a couple of thin layers (view, controller); "model" becomes a dumping ground for everything else, which doesn't give you the domain/data-access split you actually want.
- **Clean architecture** achieves stronger separation through more abstraction (use-cases, interface adapters, gateways) — powerful, but the complexity cost is usually disproportionate for a typical service.
- **Three physical layers** map directly onto real request flow — every request visits entry-point → domain → data-access — with no extra indirection to explain to a new hire.

---

## Choosing a Web Framework

The framework you pick shapes team velocity and how often you'll fight the tool instead of the problem. Popularity is a legitimate signal here — it buys you documentation, Stack Overflow answers, and hiring pool — so weigh it alongside technical fit.

### Express

**Pros:** the largest ecosystem and community by far; simple mental model; nearly every Node.js developer already knows it.

**Cons:** covers only the HTTP-routing slice of what an app needs — no built-in structure for validation, DI, queues, or scheduling; no native async/await ergonomics (still relies on `next(err)` for error propagation); development has slowed.

```javascript
// Express: minimal, unopinionated
import express from "express";
const app = express();
app.use(express.json());
app.post("/orders", async (req, res, next) => {
  try {
    res.status(201).json(await placeOrder(req.body));
  } catch (err) {
    next(err);
  }
});
```

### Nest.js

**Pros:** the most "batteries included" option — DI, modules, guards, interceptors, microservice transports, scheduling all ship built in; excellent documentation; strong fit for teams with an OOP/Angular/Spring background.

**Cons:** heavy abstraction layered on top of plain Node.js conventions; steep learning curve (decorators, modules, providers, guards); TypeScript-first, which raises the entry bar; opinionated enough that fighting the framework is possible.

### Fastify

**Pros:** lean and close to Node.js/JavaScript standards; async/await native; a shallower learning curve than Nest.js while still covering common concerns (validation, serialization, plugins) via its official plugin ecosystem.

**Cons:** smaller ecosystem than Express or Nest.js; younger, less battle-tested at extreme scale.

### Koa

**Pros:** a simpler, more modern successor to Express from the same core team — native async/await middleware, better performance, smaller surface area.

**Cons:** deliberately minimal, so — like Express — many concerns are left to third-party middleware; smaller community than Express or Nest.js.

### Picking One

| Situation | Recommendation |
|---|---|
| Experienced architect who wants fine-grained control | Express or Koa |
| Reasonably sized services/microservices, strong JS/Node fundamentals on the team | Fastify |
| Large monolith that won't be decomposed, OOP-leaning team, Java/Spring/Angular background | Nest.js |
| Need to minimize framework decision-making overhead and ship fast | Nest.js (opinionated defaults) or Express (familiarity) |

---

## Hierarchical, Environment-Aware Configuration

### The Problems Naive Config Creates

- **All env vars, no files** — tolerable for 5 keys, unmanageable for 100; DevOps can't tweak behavior without a code change either way if the two aren't combined.
- **Flat JSON** — a single un-nested config blob becomes a scavenger hunt as it grows.
- **Secrets in config files** — committing DB passwords to source control is the default failure mode without an explicit alternative.
- **No startup validation** — a missing required variable should fail the process immediately at boot, not three hours later mid-request.

A config solution needs to combine a checked-in hierarchical file with process-environment overrides, keep secrets out of the file, and validate presence at startup.

### Do: Hierarchical Config, Grouped by Component

```json5
// config/default.json5
{
  // Orders module config
  "orders": {
    "dbConfig": {
      "host": "localhost",
      "port": 5432,
      "dbName": "orders"
    },
    "shipping": {
      "defaultCarrier": "ups",
      // Kept short for local dev
      "estimatedDays": 1
    }
  }
}
```

Libraries like [`convict`](https://www.npmjs.com/package/convict), [`config`](https://www.npmjs.com/package/config), and [`nconf`](https://www.npmjs.com/package/nconf) merge a file like this with environment-variable overrides and, in `convict`'s case, validate a schema at startup:

```javascript
// config/index.js
import convict from "convict";

const config = convict({
  env: { doc: "Environment", format: ["production", "development", "test"], default: "development", env: "NODE_ENV" },
  orders: {
    dbConfig: {
      host: { doc: "DB host", format: String, default: "localhost", env: "ORDERS_DB_HOST" },
      password: { doc: "DB password", format: String, default: "", sensitive: true, env: "ORDERS_DB_PASSWORD" },
    },
  },
});

config.validate({ allowed: "strict" }); // throws immediately if a required value is missing
export default config;
```

### Don't: Flat, Unvalidated, Secret-Bearing Config

```javascript
// Avoid: flat keys, no hierarchy, password committed to source control
export const config = {
  ordersDbHost: "localhost",
  ordersDbPassword: "hunter2",
  paymentsDbHost: "localhost",
  paymentsDbPassword: "hunter2",
  shippingCarrier: "ups",
};
```

There's no schema to catch a missing value at boot, no separation between "safe to commit" and "must be injected," and the list only gets worse as more components add keys.

### Checklist

- Group config by component/module, not as one flat namespace.
- Read secrets from environment variables or a secrets manager (Vault, AWS Secrets Manager) — never commit them.
- Validate required keys at process startup and crash fast if any are missing.
- For multi-instance deployments needing shared runtime config, sync via a centralized store (e.g., Redis) instead of redeploying every instance.

---

## Wrap Common Utilities as Packages

### The Problem

As components multiply — potentially across separate repos or deployable services — they tend to duplicate the same helper code: a logger wrapper, an HTTP retry client, a date formatter. Copy-pasted utilities drift out of sync; a bug fix in one copy doesn't propagate to the others.

### The Fix: Publish Internal Utilities as npm Packages

Wrap third-party libraries (and your own cross-cutting helpers) behind your own thin package, then publish that package for internal consumption — via a [private npm registry](https://docs.npmjs.com/private-modules/intro), an internal Verdaccio/Nexus instance, or npm/yarn/pnpm workspaces for a monorepo. Every component then depends on one versioned source of truth instead of a copy-pasted file.

```text
libraries
├─ logger              # wraps pino/winston with house conventions
│  ├─ package.json
│  └─ index.js
└─ http-client          # wraps fetch/axios with retry + tracing defaults
   ├─ package.json
   └─ index.js
```

```javascript
// libraries/logger/index.js — internal package: "@my-system/logger"
import pino from "pino";

export function createLogger(component) {
  return pino({ base: { component }, level: process.env.LOG_LEVEL ?? "info" });
}
```

```javascript
// apps/orders/domain/order-service.js
import { createLogger } from "@my-system/logger";

const log = createLogger("orders");
log.info("order placed");
```

Wrapping the third-party dependency (`pino` here) behind your own package also means you can swap the underlying library later without touching every component that logs — only the wrapper changes.

### Payoff

- One place to fix a bug or add a feature (e.g., add trace-id propagation to the HTTP client) instead of N copies.
- Semantic versioning gives consumers control over when they pick up a breaking change.
- Works whether components live in one monorepo (via workspaces) or separate repos (via a private registry).

---

## Use TypeScript Sparingly and Thoughtfully

### Two Separate Offerings, Often Conflated

TypeScript bundles two things that are easy to treat as one: **type safety** (catching a category of bugs at compile time, better editor autocomplete) and **advanced OOP design constructs** (abstract classes, interfaces, decorators, namespaces). Teams frequently adopt TypeScript purely for type safety, then unintentionally start reaching for the OOP machinery simply because it's sitting in the toolbox — a version of the [law of the instrument](https://en.wikipedia.org/wiki/Law_of_the_instrument): if an `abstract class` is available, someone will eventually use one, whether or not it's the right shape for the problem.

Research backs a measured view of the payoff: one study found TypeScript's type system catches roughly [15% of public bugs](https://earlbarr.com/publications/typestudy.pdf) — a real, worthwhile number, but not a substitute for tests, linting, and code review, which remain necessary regardless.

### Do: Types as Documentation, Plain Functions as Structure

```typescript
type Order = {
  id: string;
  customerId: string;
  items: { sku: string; qty: number; price: number }[];
  status: "pending" | "confirmed" | "shipped";
};

export async function placeOrder(input: Omit<Order, "id" | "status">): Promise<Order> {
  const total = input.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  // ...
  return { ...input, id: crypto.randomUUID(), status: "confirmed" };
}
```

Plain functions, plain object types, no class hierarchy — type safety and autocomplete without an extra design paradigm layered on top.

### Avoid: Reaching for OOP Machinery by Default

```typescript
// Avoid unless the domain genuinely calls for polymorphism
abstract class BaseOrderProcessor {
  protected abstract validate(order: Order): void;
  public process(order: Order): void {
    this.validate(order);
    this.persist(order);
  }
  protected abstract persist(order: Order): void;
}

class StandardOrderProcessor extends BaseOrderProcessor {
  protected validate(order: Order) { /* ... */ }
  protected persist(order: Order) { /* ... */ }
}
```

If the team deliberately chose this style — for genuine polymorphism, a plugin architecture, or because the team is strongest in OOP — that's a legitimate call. The failure mode is reaching for `abstract class` and `interface` hierarchies by reflex, on every feature, without that discussion happening first. Default to plain functions and objects decorated with primitive types; add classes and interfaces only when the design actually needs the extra structure they provide.

### Guidelines

- Decide *why* you're adopting TypeScript (type safety, OOP design, both) before writing code — don't let it happen by accident.
- Prefer `type`/plain objects and functions over `class` hierarchies unless polymorphism is a real requirement.
- Still run ESLint and write tests — TypeScript's static checks complement these, they don't replace them.
- Turn on `strict` mode; partial type safety catches far fewer bugs than full strict mode does.

---

## Further Reading

This page adapts material from the [nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) project by Yoni Goldberg and contributors.
