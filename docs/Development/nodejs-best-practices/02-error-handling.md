---
sidebar_position: 2
---

# Error Handling

Patterns for raising, propagating, centralizing, and recovering from errors in Node.js services without leaking bugs into production.

---

## Table of Contents

1. [Use the Built-in Error Object](#use-the-built-in-error-object)
2. [Operational vs Programmer Errors](#operational-vs-programmer-errors)
3. [Async/Await Error Handling](#asyncawait-error-handling)
4. [Catching Unhandled Promise Rejections](#catching-unhandled-promise-rejections)
5. [Preserving Stack Traces When Returning Promises](#preserving-stack-traces-when-returning-promises)
6. [Centralized Error Handling](#centralized-error-handling)
7. [Fail Fast: Validate Arguments](#fail-fast-validate-arguments)
8. [Graceful Process Shutdown](#graceful-process-shutdown)
9. [Documenting API Errors](#documenting-api-errors)
10. [Logging and Monitoring](#logging-and-monitoring)
11. [Testing Error Flows](#testing-error-flows)
12. [Further Reading](#further-reading)

---

## Use the Built-in Error Object

**Why it matters:** JavaScript's permissiveness lets developers raise errors as strings, plain objects, or custom shapes. This destroys interoperability — `instanceof Error` checks fail, stack traces disappear, and every module ends up guessing what an "error" looks like.

**Rule:** Always throw objects that derive from the built-in `Error` class. It captures a stack trace automatically and is universally recognized by frameworks, loggers, and test tools.

**Don't create a new `Error` subclass per error case.** A `DbError`, `HttpError`, and `ValidationError` hierarchy adds ceremony without adding value in a language with no compile-time type dispatch on exceptions. Extend `Error` **once** — typically as `AppError` — and differentiate error cases with a `name`/`code` property instead of a class.

```js
// AppError.js
class AppError extends Error {
  constructor(name, httpCode, description, isOperational) {
    super(description);
    Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this);
  }
}

module.exports = { AppError };
```

**❌ Avoid — throwing non-Error values:**

```js
// No stack trace, no `instanceof` support, no consistent shape
if (!productToAdd) {
  throw "How can I add a new product when no value is provided?";
}
```

**✅ Do — throw (or emit) real Error instances everywhere:**

```js
if (!productToAdd) {
  throw new Error("How can I add a new product when no value is provided?");
}

// EventEmitter errors follow the same rule
myEmitter.emit("error", new Error("whoops!"));

// Errors surfaced through async flows
try {
  const existing = await DAL.getProduct(productToAdd.id);
  if (existing !== null) {
    throw new Error("Product already exists!");
  }
} catch (err) {
  // handle or rethrow
}
```

---

## Operational vs Programmer Errors

**Operational errors:** Expected failure modes in a working system — a downstream API timing out, invalid user input, a database connection drop. You know what happened and its blast radius. Logging (and sometimes retrying) is usually the correct response.

**Programmer errors:** Bugs — reading a property off `undefined`, a broken promise chain, a resource leak. The process may now be in an inconsistent state that's unsafe to keep serving traffic from. There is rarely a clean way to "handle" these beyond restarting.

**Why the distinction matters:** It's the single input that decides whether an error handler should log-and-continue or crash-and-restart. Baking `isOperational` into every thrown error turns that decision from a guess into a lookup.

```js
class AppError extends Error {
  constructor(name, httpCode, description, isOperational) {
    super(description);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational; // true = trusted, safe to keep running
    Error.captureStackTrace(this);
  }
}
```

**✅ Do — mark the error at the point of creation:**

```js
throw new AppError(
  "InvalidInputError",
  400,
  "Email field is required",
  true // operational: reject the request, no need to crash
);
```

**❌ Avoid — treating every error the same way:**

```js
// A malformed request and a corrupted in-memory cache get identical treatment.
// One should return 400 and move on; the other should trigger a restart.
catch (err) {
  logger.error(err);
  res.status(500).send("Something went wrong");
}
```

An error handler should branch on `error.isOperational` (or `error instanceof AppError`) to decide whether to respond and continue, or respond and then terminate the process (see [Graceful Process Shutdown](#graceful-process-shutdown)).

---

## Async/Await Error Handling

**Why it matters:** Callback-style error handling (`if (err) { ... }` nested inside every callback) doesn't scale — it forces error checks at every level and destroys the call stack, making errors thrown on one tick impossible to catch from another. Promises restored `return`/`throw`/`try`/`catch` semantics for async code, and `async`/`await` makes that style read like synchronous code.

**❌ Avoid — nested callback error handling:**

```js
getData(someParameter, function (err, result) {
  if (err !== null) {
    getMoreData(result, function (err, result2) {
      if (err !== null) {
        getMoreData(result2, function (err, result3) {
          // error checked at every level, stack trace long gone
        });
      }
    });
  }
});
```

**✅ Do — async/await with try/catch/finally:**

```ts
async function executeAsyncTask(): Promise<Result> {
  try {
    const valueA = await functionA();
    const valueB = await functionB(valueA);
    const valueC = await functionC(valueB);
    return await functionD(valueC);
  } catch (err) {
    logger.error(err);
    throw err; // let the caller (or centralized handler) decide what happens next
  } finally {
    await cleanup();
  }
}
```

A single `catch` block replaces error checks at every step of the chain, and `finally` guarantees cleanup regardless of outcome. Promise chains (`.then().catch()`) work too, but `async`/`await` is the more readable default for new code.

---

## Catching Unhandled Promise Rejections

**The trap:** Most Node.js/Express code today runs inside promises — a `.then` handler, an async route, a background job. If a developer forgets a `.catch` (or a `try`/`catch` around an `await`), the rejection **silently disappears**; it is *not* caught by `process.on('uncaughtException', ...)`.

```js
DAL.getUserById(1).then((user) => {
  // no .catch anywhere in this chain — this error vanishes
  if (!user.isAlive) throw new Error("ahhhh");
});
```

Relying purely on developer discipline to always add `.catch` is fragile. Node surfaces a runtime warning for unhandled rejections, but a warning is not error handling — subscribe to the event and route it through the same centralized handler used for everything else.

**✅ Do — register a global rejection handler as a safety net:**

```js
process.on("unhandledRejection", (reason) => {
  // Promote it to the same path as an uncaught exception so there is
  // exactly one place that decides whether to log-and-continue or crash.
  throw reason;
});

process.on("uncaughtException", (error) => {
  errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) {
    process.exit(1);
  }
});
```

**❌ Avoid — trusting every promise chain to remember `.catch`:**

```js
// This works right up until someone forgets the .catch, and then
// the failure is invisible — no log, no alert, no crash.
fetchAndProcessOrder(orderId);
```

A global `unhandledRejection` listener doesn't replace local error handling — it's the backstop for the mistakes that inevitably slip through.

---

## Preserving Stack Traces When Returning Promises

**The problem:** When an async function returns another function's promise **without awaiting it**, and that promise later rejects, the returning function is missing from the stack trace. V8's "zero-cost async stack traces" extend the trace only across `await` points — a bare `return somePromise()` opts out of that mechanism.

**❌ Avoid — returning a promise without awaiting:**

```js
async function returnWithoutAwait() {
  return throwAsync("missing from the stacktrace"); // no await
}

returnWithoutAwait().catch(console.log);
// Error: missing from the stacktrace
//     at throwAsync (...)
//   <-- returnWithoutAwait is gone
```

**✅ Do — always `return await` inside a `try` (or just always `await` before returning):**

```js
async function returnWithAwait() {
  return await throwAsync("with all frames present");
}

returnWithAwait().catch(console.log);
// Error: with all frames present
//     at throwAsync (...)
//     at async returnWithAwait (...)
```

The same rule applies to synchronous wrapper functions that happen to return a promise — tag them `async` and `await` the inner call, or that frame is silently dropped too. The extra `await` costs a microtask; the cost of a stack trace with a hole in it during an incident is far higher, so don't strip `return await` as a "performance optimization" without measuring first.

---

## Centralized Error Handling

**The anti-pattern:** Handling errors directly inside the Express error middleware. It seems convenient, but that code path only fires for errors caught during an HTTP request — cron jobs, message queue consumers, and startup code never go through it, so the same failure gets handled inconsistently (or not at all) depending on where it originated.

**The fix:** One dedicated `ErrorHandler` object that every entry point (HTTP middleware, `uncaughtException`, `unhandledRejection`, job runners) funnels into. It owns logging, firing monitoring metrics, and deciding whether the process should exit. Middleware, listeners, and job wrappers only *catch and forward* — they never decide what an error means.

**✅ Do — one handler, multiple call sites:**

```ts
class ErrorHandler {
  public async handleError(error: Error, res?: Response): Promise<void> {
    await logger.logError(error);
    await metrics.fireErrorMetric(error);
    if (res && !res.headersSent) {
      res.status(getHttpCode(error)).json({ message: error.message });
    }
  }

  public isTrustedError(error: Error): boolean {
    return error instanceof AppError && error.isOperational;
  }
}

export const errorHandler = new ErrorHandler();
```

```ts
// Express middleware: catch and delegate, nothing more
app.use(async (err: Error, req: Request, res: Response, next: NextFunction) => {
  await errorHandler.handleError(err, res);
});

// Same handler reused for errors outside the request lifecycle
process.on("uncaughtException", (error) => {
  errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  errorHandler.handleError(reason as Error);
});
```

**❌ Avoid — business logic baked into the middleware itself:**

```js
// Cron jobs and queue consumers can never reuse this logic
app.use((err, req, res, next) => {
  logger.logError(err);
  if (err.severity === "high") {
    mailer.sendMail(admin, "Critical error occurred", err);
  }
  if (!err.isOperational) next(err);
});
```

A typical flow: a module throws → the route handler catches it and calls `next(error)` → the error middleware forwards it, unmodified, to `errorHandler.handleError()`. Lower layers (DB access, service calls) shouldn't decide HTTP status codes or send responses — only the top of the stack has enough context to do that correctly.

---

## Fail Fast: Validate Arguments

**Why it matters:** Skipping argument validation doesn't remove bugs — it just delays and disguises them. A missing or malformed argument silently propagates until it causes a confusing failure several calls later, far from its actual source.

**❌ Avoid — no validation, bug surfaces downstream:**

```js
function redirectToPrintDiscount(res, member, discount) {
  if (discount !== 0) {
    res.redirect(`/discountPrintView/${member.id}`);
  }
}

redirectToPrintDiscount(res, someMember);
// discount is undefined, not 0 — condition is true, user gets redirected.
// Why? Nothing here tells you.
```

**✅ Do — validate at the boundary with a schema library** (e.g. [Joi](https://joi.dev/) or [Zod](https://zod.dev/)) instead of hand-rolled `if` checks:

```js
const memberSchema = Joi.object({
  password: Joi.string().pattern(/^[a-zA-Z0-9]{3,30}$/),
  birthyear: Joi.number().integer().min(1900).max(2013),
  email: Joi.string().email(),
});

function addNewMember(newMember) {
  Joi.assert(newMember, memberSchema); // throws AppError-compatible ValidationError
  // rest of the logic can now trust `newMember` is well-formed
}
```

Validating hierarchical JSON by hand (nested objects, date ranges, conditional required fields) is tedious enough that teams skip it under deadline pressure. A schema library makes the safe path the easy path — assert first, then write business logic assuming the input is already correct.

---

## Graceful Process Shutdown

**The scenario:** An `uncaughtException` fires. Some component — say, a singleton token issuer — may have lost internal state mid-operation. Every subsequent request risks touching that corrupted state. There is no reliable way to "resume" from an arbitrary point after a thrown error in JavaScript without risking that leaked, inconsistent state.

**The fix:** Let a process **restarter** (PM2, systemd, a Kubernetes liveness probe, Forever) own recovery. The application's only job on an untrusted error is to log it, finish in-flight operationally-safe work, and exit — not to keep running in an unknown state.

**✅ Do — branch on `isOperational`, exit only when untrusted:**

```js
process.on("uncaughtException", (error) => {
  errorHandler.handleError(error);
  if (!errorHandler.isTrustedError(error)) {
    // Give the restarter a clean, non-zero exit to act on
    process.exit(1);
  }
  // else: operational error, already logged, process can keep serving
});
```

**❌ Avoid — swallowing uncaught exceptions and carrying on regardless:**

```js
// This "prevents crashes" by hiding the fact that the process
// is now in an unknown, possibly corrupted state.
process.on("uncaughtException", (error) => {
  console.log("Ignoring error:", error.message);
});
```

For HTTP servers, the better middle ground is to stop accepting *new* connections, let in-flight requests finish within a timeout, then exit — rather than pulling the plug on everyone mid-request. Frameworks like Express support this via `server.close()` inside the shutdown handler.

---

## Documenting API Errors

**Why it matters:** An API contract isn't just its success schema — callers need to know which errors can occur and what they mean, or they can't build correct error handling on their side. "The function may fail" is not documentation; the specific failure modes are.

**REST + OpenAPI:** Document HTTP status codes alongside the success response so a `409 Conflict` on "customer already exists" isn't a surprise the caller discovers in production. OpenAPI (formerly Swagger) generates browsable, interactive docs from this schema.

**GraphQL:** The spec itself [defines the shape of errors](https://facebook.github.io/graphql/June2018/#sec-Errors) — a top-level `errors` array alongside `data`, each entry carrying a `message`, `locations`, and `path`. Clients can rely on this structure without extra documentation, though schema comments are still worth adding for domain-specific error codes.

```json
{
  "errors": [
    {
      "message": "No entry in local cache for /films/1",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["film"]
    }
  ],
  "data": { "film": null }
}
```

Whichever approach you use, treat the error surface as part of the API's public interface — version it and review changes the same way you would a response schema change.

---

## Logging and Monitoring

### Use a Mature Structured Logger

`console.log` doesn't scale past local development — it can't set log levels, can't attach structured context, and writes nowhere durable. Use a real logger (e.g. [Pino](https://www.npmjs.com/package/pino)) and:

- Log at appropriate levels (`debug`, `info`, `warn`, `error`) so noise can be filtered in production.
- Attach contextual metadata as structured fields, not string concatenation — it's what makes logs queryable later.
- Ship logs somewhere searchable (ELK, Splunk, Datadog Logs) instead of relying on local files or stdout scrollback.

```js
const pino = require("pino");
const logger = pino();

logger.info({ orderId: 42, userId: 7 }, "Order processed successfully");
logger.error({ err, orderId: 42 }, "Failed to save order");
```

A timestamp on every line, a machine-parseable format (JSON), and support for multiple output destinations (file, stderr, remote sink) are the non-negotiable requirements for a production logger.

### Application Performance Monitoring (APM)

Not every failure is an exception. A slow query, a saturated connection pool, or a downstream API silently degrading are all "errors" from a user's perspective, but none of them throw. APM tooling closes this gap by watching for these buried issues without extra code:

- **Uptime/API monitoring** (Pingdom, UptimeRobot) — external HTTP checks, minutes to set up.
- **Code instrumentation** (New Relic, AppDynamics, Datadog APM) — an in-process agent surfacing slow code paths, exception rates, and per-transaction traces.
- **Operational dashboards** (Datadog, Splunk, Grafana) — aggregate logs, metrics, and traces into a single ops-facing view.

### Core Metrics to Watch

At minimum, monitor: CPU, server RAM, Node process RAM, error rate over the last minute, process restart count, and average response time. Everything past that (DB profiling, cross-service transaction tracing, custom BI exports) is a valuable upgrade, not a baseline requirement. Cloud provider monitoring (CloudWatch, Cloud Monitoring) covers hardware metrics but knows nothing about in-process errors; log-based tooling is the reverse — combine both for full coverage.

---

## Testing Error Flows

Testing only the happy path leaves failure handling completely unverified — there is no evidence exceptions are caught correctly, mapped to the right status code, or logged with the fields an on-call engineer will need.

**Unit test: the right exception type is thrown**

```js
describe("ChatService", () => {
  it("throws ConnectionError when participants are disconnected", () => {
    const chatService = new ChatService();
    chatService.participants = getDisconnectedParticipants();

    expect(() => chatService.sendMessage("Hi")).toThrow(ConnectionError);
  });
});
```

**Integration test: API returns the right status code and logs correctly**

```js
test("When saving an order fails, the API returns 500 and logs the error", async () => {
  sinon
    .stub(OrderRepository.prototype, "addOrder")
    .rejects(new AppError("saving-failed", 500, "Order could not be saved", true));
  const loggerSpy = sinon.stub(logger, "error");

  const response = await axiosAPIClient.post("/order", { userId: 1, productId: 2 });

  expect(response.status).toBe(500);
  expect(loggerSpy.lastCall.firstArg).toMatchObject({
    name: "saving-failed",
    status: 500,
    stack: expect.any(String),
  });
});
```

**Integration test: uncaught exceptions are handled too**

```js
test("An uncaught exception is logged by the global handler", async () => {
  await api.startWebServer();
  const loggerSpy = sinon.stub(logger, "error");
  const error = new Error("An error that was never caught");

  process.emit("uncaughtException", error);

  expect(loggerSpy.calledWith(error)).toBe(true);
});
```

If testing every inner function's exception path is impractical, focus coverage on the API boundary — every documented HTTP error code should have at least one test asserting it's actually returned.

---

## Further Reading

- [nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) — the source project this guide adapts, licensed CC BY-SA 4.0.
