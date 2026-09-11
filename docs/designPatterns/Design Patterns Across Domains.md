---
sidebar_position: 8
---

## Design Patterns Across Domains

You've seen each pattern in isolation. The natural next question:

> "Where does this actually show up outside of a tutorial?"

Patterns aren't evenly distributed. A payments team leans on **Strategy** and **Factory** constantly and barely touches **Decorator**. A game studio lives inside **Singleton** and **Observer**. This page maps the seven patterns covered in this section to the industries and application types where they earn their keep — with real frameworks and products as evidence, not hypotheticals.

* * *

Quick Reference Matrix
=======================

Eight columns don't fit most screens at once — scroll the table horizontally to see every pattern.

<div class="table-scroll">

| Domain | Singleton | Factory | Strategy | Observer | Middleware | Decorator | Repository |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Web backends & APIs | ✓ | ✓ | | | ✓ | | ✓ |
| Frontend & UI frameworks | ✓ | | ✓ | ✓ | | ✓ | |
| Databases & data access | ✓ | ✓ | | | | ✓ | ✓ |
| Distributed systems & microservices | | ✓ | ✓ | ✓ | ✓ | | |
| Event-driven & messaging systems | | ✓ | ✓ | ✓ | | | |
| Cloud infrastructure & DevOps | ✓ | ✓ | ✓ | | ✓ | | |
| E-commerce & payments | | ✓ | ✓ | ✓ | | ✓ | |
| Fintech & banking | ✓ | | ✓ | | | ✓ | ✓ |
| Gaming & game engines | ✓ | ✓ | ✓ | ✓ | | | |
| Mobile app development | ✓ | ✓ | | ✓ | | ✓ | |
| Machine learning & data pipelines | | ✓ | ✓ | ✓ | | ✓ | |
| IoT & embedded systems | ✓ | ✓ | ✓ | ✓ | | | |
| Real-time & collaborative systems | | | ✓ | ✓ | ✓ | | |
| Testing & QA tooling | | ✓ | ✓ | | | ✓ | ✓ |

</div>

Use this as a map, not a rulebook — plenty of real systems break the grid in both directions.

* * *

Web Backends & APIs
====================

The core problem: many requests, shared resources, and cross-cutting concerns (auth, logging, rate limiting) that shouldn't live inside every handler.

*   **[Middleware](./Middleware%20Pattern.md)** — the defining pattern of this domain. Express, Koa, NestJS, Django, and ASP.NET Core all structure request handling as a chain of middleware.
*   **[Repository](./Repository%20Pattern.md)** — Spring Data, TypeORM, and most layered backends isolate SQL/NoSQL specifics behind a repository so the service layer stays database-agnostic.
*   **[Singleton](./Singleton%20Pattern.md)** — the DB connection pool, the logger (`pino`, `winston`), and loaded config are singletons in nearly every backend codebase.
*   **[Factory](./Factory%20Pattern.md)** — picking a handler, serializer, or DB client based on a request parameter or `NODE_ENV`.

* * *

Frontend & UI Frameworks
=========================

The core problem: keeping the UI in sync with state that changes over time, without manually wiring every update.

*   **[Observer](./Observer%20Pattern.md)** — the foundation of reactivity. React's state/hooks, Vue's reactivity system, Angular's `EventEmitter`, and RxJS observables are all Observer under different names.
*   **[Decorator](./Decorator%20Pattern.md)** — Angular's `@Component`/`@Directive` decorators, and React's Higher-Order Components (`connect()`, `withRouter`) wrap a base component with extra behavior without touching its source.
*   **[Singleton](./Singleton%20Pattern.md)** — global stores: a single Redux store, a single Pinia instance, a single Zustand store per app.
*   **[Strategy](./Strategy%20pattern.md)** — swappable validation rules, swappable rendering logic (e.g., different chart renderers behind one chart component), theme strategies.

* * *

Databases & Data Access Layers
================================

The core problem: business logic shouldn't know or care whether data lives in Postgres, Mongo, or a mock.

*   **[Repository](./Repository%20Pattern.md)** — the pattern this domain was named for. ORMs like TypeORM, Prisma (via its client abstraction), Entity Framework, and Spring Data all exist to give you a repository-shaped API over a database.
*   **[Factory](./Factory%20Pattern.md)** — connection factories, and test-data factories (Fishery, Rosie, `factory_bot`) that produce fixture objects on demand.
*   **[Decorator](./Decorator%20Pattern.md)** — Mongoose plugins and Prisma middleware wrap a base query with extra behavior (soft deletes, auditing, timestamps) without changing the query's call site.
*   **[Singleton](./Singleton%20Pattern.md)** — the connection pool itself; you never want two independent pools fighting over the same database.

* * *

Distributed Systems & Microservices
=====================================

The core problem: independent services need to discover, call, and route around each other without hard-coding assumptions.

*   **[Strategy](./Strategy%20pattern.md)** — load-balancing algorithms (round-robin, least-connections, weighted) are Strategy implementations swapped inside a load balancer or service mesh.
*   **[Factory](./Factory%20Pattern.md)** — an HTTP/gRPC client factory that produces a configured client per downstream service.
*   **[Observer](./Observer%20Pattern.md)** — event sourcing and service-to-service notifications (a service publishes `OrderPlaced`, others subscribe) are Observer at system scale.
*   **[Middleware](./Middleware%20Pattern.md)** — service mesh sidecars (Istio, Linkerd) and Envoy filter chains apply auth, retries, and observability as middleware around every call.

* * *

Event-Driven & Messaging Systems
==================================

The core problem: producers and consumers must stay decoupled — a producer shouldn't need to know who, or how many, are listening.

*   **[Observer](./Observer%20Pattern.md)** — pub/sub *is* Observer, just running across machines instead of within one process. Kafka topics, RabbitMQ exchanges, and SNS/SQS fan-out are textbook implementations.
*   **[Strategy](./Strategy%20pattern.md)** — partitioning and routing strategies (which partition a message lands on, which queue a message is routed to based on its headers).
*   **[Factory](./Factory%20Pattern.md)** — producer/consumer client construction, often chosen per topic or per message schema.

* * *

Cloud Infrastructure & DevOps
===============================

The core problem: the same automation code needs to target different providers, environments, and services without branching everywhere.

*   **[Factory](./Factory%20Pattern.md)** — cloud SDKs are built on this. `new AWS.S3()` vs `new AWS.DynamoDB()`, or a Terraform provider resolving which resource implementation to instantiate.
*   **[Singleton](./Singleton%20Pattern.md)** — reusing one SDK client across a Lambda's warm invocations instead of re-initializing per request; a shared Terraform provider client.
*   **[Strategy](./Strategy%20pattern.md)** — deployment strategies (blue-green, canary, rolling) and autoscaling policies are interchangeable strategies behind one deployment interface.
*   **[Middleware](./Middleware%20Pattern.md)** — Lambda middleware (Middy), and API Gateway request/response transformation chains.

* * *

E-commerce & Payments
=======================

The core problem: the same checkout flow must support many payment methods, shipping carriers, and pricing rules that change independently of the core order logic.

*   **[Strategy](./Strategy%20pattern.md)** — selecting a payment method, shipping carrier, or discount rule at checkout time based on the customer's choice or region.
*   **[Factory](./Factory%20Pattern.md)** — constructing the right payment gateway client (Stripe, PayPal, Razorpay) from a single `createPaymentGateway(type)` entry point.
*   **[Observer](./Observer%20Pattern.md)** — order-status webhooks fan out to email, SMS, inventory, and analytics systems whenever an order changes state.
*   **[Decorator](./Decorator%20Pattern.md)** — taxes, coupons, and bundle discounts are commonly layered on top of a base price calculation, each decorator adjusting the running total.

* * *

Fintech & Banking
===================

The core problem: every transaction must pass through layered checks (validation, fraud, compliance, ledger) that vary by product and jurisdiction, and every step must be auditable.

*   **[Decorator](./Decorator%20Pattern.md)** — a transaction pipeline (validate → fraud-check → currency-convert → post to ledger) is a natural stack of decorators around a core "process transaction" function.
*   **[Strategy](./Strategy%20pattern.md)** — interest calculation, fraud-risk scoring, and interchange-fee rules differ by product and are swapped in as strategies.
*   **[Repository](./Repository%20Pattern.md)** — ledger and account access is almost always repository-abstracted, since audit and compliance requirements often mean the underlying store changes (or is dual-written) over a system's lifetime.
*   **[Singleton](./Singleton%20Pattern.md)** — a single currency-conversion-rate cache or a single audit logger shared across every transaction path.

* * *

Gaming & Game Engines
=======================

The core problem: hundreds of entities need to be spawned, react to events, and behave differently — all while hitting a frame budget.

*   **[Singleton](./Singleton%20Pattern.md)** — `GameManager`, `AudioManager`, and `InputManager` singletons are so common in Unity that they're practically a convention (and, just as commonly, a source of tech debt when overused for everything).
*   **[Observer](./Observer%20Pattern.md)** — "on player death," "on achievement unlocked," and UI-reacts-to-health-change are all Observer: game systems subscribe to events instead of being polled every frame.
*   **[Factory](./Factory%20Pattern.md)** — spawning enemies, items, or projectiles from prefabs via a factory, so the spawner doesn't need to know every concrete type.
*   **[Strategy](./Strategy%20pattern.md)** — swappable AI behaviors (patrol, chase, flee) and difficulty settings that change an entity's decision-making without changing its class.

* * *

Mobile App Development
========================

The core problem: one codebase (or two native ones) must manage shared session state, react to data changes, and sometimes branch per platform.

*   **[Singleton](./Singleton%20Pattern.md)** — a shared session/auth manager and an analytics client are almost always singletons across an app's lifecycle.
*   **[Observer](./Observer%20Pattern.md)** — Android's `LiveData`/`Flow`, iOS's Combine publishers, and React Native's state updates all follow Observer to keep views in sync with data.
*   **[Factory](./Factory%20Pattern.md)** — producing the right platform-specific module or component (iOS vs Android implementations behind one JS-facing API in React Native).
*   **[Decorator](./Decorator%20Pattern.md)** — SwiftUI view modifiers and Jetpack Compose modifiers wrap a base view with additional styling or behavior, one layer at a time.

* * *

Machine Learning & Data Pipelines
====================================

The core problem: the same pipeline shape (load → transform → train/predict) needs to plug in different algorithms and preprocessing steps without rewriting the pipeline.

*   **[Strategy](./Strategy%20pattern.md)** — scikit-learn's interchangeable estimators (swap `LogisticRegression` for `RandomForestClassifier` behind the same `.fit()`/`.predict()` interface) is Strategy by design.
*   **[Decorator](./Decorator%20Pattern.md)** — chained preprocessing transforms (`torchvision.transforms.Compose`, sklearn `Pipeline` steps) wrap data one transformation at a time.
*   **[Factory](./Factory%20Pattern.md)** — building a model or pipeline from a config file (`model_type: "xgboost"`) without an if/else ladder scattered through training code.
*   **[Observer](./Observer%20Pattern.md)** — training callbacks (Keras `Callback`, PyTorch Lightning hooks) react to events like `on_epoch_end` without the training loop knowing what they do.

* * *

IoT & Embedded Systems
========================

The core problem: many sensors produce readings continuously, hardware resources are exclusive, and the same logic must run in different power/performance modes.

*   **[Observer](./Observer%20Pattern.md)** — MQTT's publish/subscribe model is the IoT industry's standard implementation of Observer: sensors publish, dashboards and alerting systems subscribe.
*   **[Singleton](./Singleton%20Pattern.md)** — a GPIO pin or a specific sensor should only ever be owned by one driver instance at a time.
*   **[Strategy](./Strategy%20pattern.md)** — switching between power-saving and performance modes swaps the algorithm a device uses without changing its outer control loop.
*   **[Factory](./Factory%20Pattern.md)** — selecting the correct hardware driver at runtime based on a detected device revision.

* * *

Real-Time & Collaborative Systems
====================================

The core problem: many connected clients need near-instant updates, and concurrent edits from different clients must resolve consistently.

*   **[Observer](./Observer%20Pattern.md)** — WebSocket broadcast to subscribed clients (Socket.IO rooms, Firebase Realtime Database listeners) is Observer over a persistent connection.
*   **[Middleware](./Middleware%20Pattern.md)** — Socket.IO middleware authenticates and inspects each connection before it's allowed to join a room.
*   **[Strategy](./Strategy%20pattern.md)** — conflict-resolution in collaborative editors (Operational Transform vs CRDT) is a swappable strategy behind the same "merge concurrent edits" interface.

* * *

Testing & QA Tooling
======================

The core problem: tests need realistic-but-controllable data and dependencies, without hitting real databases or third-party services.

*   **[Factory](./Factory%20Pattern.md)** — test-data factories (Fishery, `factory_bot`, Faker-backed builders) produce fixture objects on demand instead of hand-writing them everywhere.
*   **[Repository](./Repository%20Pattern.md)** — an in-memory repository implementation swapped in for the real one, so unit tests don't touch a real database.
*   **[Decorator](./Decorator%20Pattern.md)** — retry and timing wrappers around flaky test steps, and instrumentation wrappers used by test runners to measure each test's duration.
*   **[Strategy](./Strategy%20pattern.md)** — swapping a real service for a mock/stub implementation that satisfies the same interface.

* * *

The Same Pattern, Different Vocabulary
=========================================

One reason patterns feel domain-specific is that each industry names them differently:

*   **Strategy** → called a "policy" in insurance/fintech systems, an "algorithm" in ML, a "rule" in pricing engines, and a "behavior" in game AI.
*   **Observer** → called "pub/sub" in messaging systems, "reactivity" in frontend frameworks, "listeners" in Android, and "callbacks" in ML training loops.
*   **Decorator** → called a "middleware" in some HTTP frameworks (the two patterns overlap heavily), a "modifier" in SwiftUI/Compose, and a "wrapper" almost everywhere else.
*   **Factory** → called a "builder" when it's more about assembling complex config than choosing a type, and a "provider" in dependency-injection frameworks (Angular, NestJS).

Recognizing the underlying pattern behind the domain's vocabulary is often more useful than memorizing the GoF names.

* * *

Other Patterns You'll Meet in the Wild
=========================================

This section only covers the seven patterns documented elsewhere in this notebook. Two more show up constantly enough to be worth naming even without a dedicated page yet:

*   **Adapter** — wrapping a third-party SDK or legacy API behind the interface your app actually wants (extremely common when swapping cloud providers or payment processors).
*   **Builder** — constructing complex objects step-by-step (SQL query builders, HTTP request builders, UI component trees) when a constructor with ten optional parameters would be unreadable.

* * *

How to Answer "Where Have You Used This?" in an Interview
=============================================================

When asked to name a real use case for a pattern, the strongest answers name a **specific product or framework**, not a made-up scenario:

> "Strategy — like scikit-learn swapping estimators behind `.fit()`/`.predict()`, or a checkout flow picking a payment gateway based on the customer's country."

> "Observer — like MQTT in IoT, or React's state updates re-rendering subscribed components."

Naming the domain and the real system signals you've seen the pattern outside of a textbook, not just implemented the tutorial version once.
