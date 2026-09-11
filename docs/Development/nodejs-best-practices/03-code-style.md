---
sidebar_position: 3
---

# Code Style

Conventions for consistent, readable, and maintainable JavaScript/TypeScript in Node.js codebases, from automated formatting to naming, structure, and module boundaries.

---

## Table of Contents

1. [ESLint and Prettier](#eslint-and-prettier)
2. [Naming Conventions](#naming-conventions)
3. [Variable Declarations](#variable-declarations)
4. [Avoiding Deep Nesting](#avoiding-deep-nesting)
5. [Async/Await Consistency](#asyncawait-consistency)
6. [Module Boundaries and Exports](#module-boundaries-and-exports)
7. [File and Folder Naming](#file-and-folder-naming)
8. [EditorConfig](#editorconfig)
9. [Further Reading](#further-reading)

---

## ESLint and Prettier

### Why Both Tools

**ESLint** catches code-quality and correctness issues — unused variables, unreachable code, suspicious equality checks, misuse of promises. **Prettier** is an opinionated formatter that rewrites whitespace, line breaks, and quote style so nobody argues about it in code review.

They overlap only in formatting rules. ESLint alone will *flag* a problem like an overly long line but leave it to you to fix; Prettier will *rewrite* it automatically.

```javascript
// ESLint (formatting rule) only warns:
foo(reallyLongArg(), omgSoManyParameters(), IShouldRefactorThis(), isThereSeriouslyAnotherOne(), noWayYouGottaBeKiddingMe());
```

```javascript
// Prettier reformats it automatically:
foo(
  reallyLongArg(),
  omgSoManyParameters(),
  IShouldRefactorThis(),
  isThereSeriouslyAnotherOne(),
  noWayYouGottaBeKiddingMe()
);
```

Source: [prettier-eslint#101](https://github.com/prettier/prettier-eslint/issues/101)

### Integrating ESLint and Prettier

Running both tools independently causes conflicting fixes — ESLint's formatting rules fight Prettier's rewrites. Turn off ESLint's own formatting rules and let Prettier own formatting exclusively, using [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier). Avoid running Prettier *through* ESLint (via `eslint-plugin-prettier`) for large codebases — it's slower, since every format pass runs through the linter.

**✅ Do:** run ESLint for code-quality rules, Prettier for formatting, as two separate, fast tools.

**❌ Avoid:** enabling both ESLint's stylistic rules (`indent`, `quotes`, `max-len`) and Prettier at once — they will conflict.

### Minimal ESLint Flat Config

```javascript
// eslint.config.js (ESLint 9+ flat config)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
      eqeqeq: "error",
      "prefer-const": "error",
    },
  },
  eslintConfigPrettier, // must be last: disables formatting rules
];
```

### Minimal Prettier Config

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

```
// .prettierignore
dist
coverage
node_modules
```

### Wiring Into package.json

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

**✅ Do:** run `lint` and `format:check` in CI so unformatted or lint-broken code never merges.

**❌ Avoid:** relying on developers to remember to run these manually — wire them into a pre-commit hook (e.g. `husky` + `lint-staged`) as well.

---

## Naming Conventions

Consistent casing lets readers predict what kind of thing an identifier refers to without looking it up.

### Convention Summary

**Variables and functions:** `camelCase` — `userCount`, `fetchOrderById()`.

**Classes and constructors:** `PascalCase` — `OrderService`, `HttpError`.

**Constants (true, immutable, module-level values):** `UPPER_SNAKE_CASE` — `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS`. A `const` that merely prevents reassignment (e.g. a locally scoped config object) does not need this treatment — reserve it for values that are conceptually constants.

**Private/internal fields (TypeScript or class-based code):** prefix with `#` (native private fields) or `_` by convention — `#connectionPool`, `_internalCache`.

**Booleans:** prefix with `is`, `has`, `should`, `can` — `isActive`, `hasPermission`, `shouldRetry`.

```javascript
// ✅ Do
const MAX_CONNECTIONS = 10;
let isConnected = false;
function getUserProfile(userId) { /* ... */ }
class PaymentGateway { /* ... */ }

// ❌ Avoid
const max_connections = 10;
let connected_flag = false;
function GetUserProfile(user_id) { /* ... */ }
class paymentgateway { /* ... */ }
```

### Descriptive Over Terse

Favor names that describe intent over abbreviations that save keystrokes — the cost of typing a longer name is paid once; the cost of decoding a cryptic one is paid by every future reader.

```javascript
// ✅ Do
const activeUserCount = users.filter((u) => u.isActive).length;

// ❌ Avoid
const auc = users.filter((u) => u.a).length;
```

---

## Variable Declarations

### const by Default, let When Reassigned, Never var

`var` is function-scoped and hoisted, which allows a variable to be referenced before its declaration and to leak outside the block it appears to belong to — a frequent source of bugs. `let` and `const` are block-scoped and behave the way most developers already expect.

```javascript
// ✅ Do
const taxRate = 0.08;
let remaining = items.length;
while (remaining > 0) {
  remaining--;
}

// ❌ Avoid
var taxRate = 0.08;
for (var i = 0; i < items.length; i++) {
  setTimeout(() => console.log(i), 0); // logs items.length, N times
}
```

Default to `const`. Reach for `let` only when a binding genuinely needs reassignment (loop counters, accumulators). This makes intent explicit: a reader who sees `const` knows the binding never changes, without needing to scan the rest of the function.

---

## Avoiding Deep Nesting

Deeply nested callbacks and conditionals ("callback hell" / "arrow code") are hard to read because the reader must hold every enclosing condition in mind to understand the innermost line.

```javascript
// ❌ Avoid
function processOrder(order, cb) {
  if (order) {
    if (order.items.length > 0) {
      validateInventory(order, (err, ok) => {
        if (!err) {
          if (ok) {
            chargeCustomer(order, (err2, receipt) => {
              if (!err2) {
                cb(null, receipt);
              } else {
                cb(err2);
              }
            });
          } else {
            cb(new Error("Insufficient inventory"));
          }
        } else {
          cb(err);
        }
      });
    }
  }
}
```

```javascript
// ✅ Do — guard clauses + async/await flatten the structure
async function processOrder(order) {
  if (!order) throw new Error("Order is required");
  if (order.items.length === 0) throw new Error("Order has no items");

  const inStock = await validateInventory(order);
  if (!inStock) throw new Error("Insufficient inventory");

  return chargeCustomer(order);
}
```

**Guidelines:**
- Return or throw early instead of wrapping the remaining logic in an `else`.
- Extract nested logic into a well-named helper function once nesting exceeds two or three levels.
- Prefer array methods (`map`, `filter`, `find`, `reduce`) over nested `for` loops with embedded `if`s when transforming collections.

---

## Async/Await Consistency

### One Async Style Per Codebase

Mixing raw callbacks, `.then()` chains, and `async/await` in the same codebase forces every reader to context-switch between three different control-flow models. Standardize on `async/await` for new code — it reads top-to-bottom like synchronous code and composes cleanly with `try/catch`.

```javascript
// ❌ Avoid — mixed styles, swallowed errors
function getUser(id, cb) {
  db.findUser(id, (err, user) => {
    if (err) return cb(err);
    fetchPermissions(user.id).then((perms) => {
      cb(null, { ...user, perms });
    });
  });
}
```

```javascript
// ✅ Do — one consistent style, errors propagate naturally
async function getUser(id) {
  const user = await db.findUser(id);
  const perms = await fetchPermissions(user.id);
  return { ...user, perms };
}
```

### Always Handle Rejections

An `async` function that throws produces a rejected promise; an unhandled rejection can crash a Node process (as of Node 15+, unhandled rejections terminate the process by default).

```javascript
// ✅ Do
async function main() {
  try {
    await processOrder(order);
  } catch (err) {
    logger.error("Order processing failed", err);
  }
}

// ❌ Avoid
async function main() {
  await processOrder(order); // unhandled rejection if this throws
}
```

### Run Independent Work Concurrently

Sequentially `await`ing operations that don't depend on each other wastes wall-clock time.

```javascript
// ❌ Avoid — serial, ~600ms
const user = await fetchUser(id);
const orders = await fetchOrders(id);
const reviews = await fetchReviews(id);

// ✅ Do — concurrent, ~200ms
const [user, orders, reviews] = await Promise.all([
  fetchUser(id),
  fetchOrders(id),
  fetchReviews(id),
]);
```

---

## Module Boundaries and Exports

### Named Exports as the Default Choice

Named exports are explicit at the import site, support better auto-import tooling, and make refactors (renames, find-all-references) far more reliable than default exports, whose local name is chosen independently at every import site.

```javascript
// ✅ Do — named export
// orderService.js
export function createOrder(payload) { /* ... */ }
export function cancelOrder(orderId) { /* ... */ }

// consumer.js
import { createOrder, cancelOrder } from "./orderService.js";
```

```javascript
// ❌ Avoid — default export invites inconsistent naming
// orderService.js
export default function (payload) { /* ... */ }

// consumer.js
import doThing from "./orderService.js";   // file A
import createOrder from "./orderService.js"; // file B — same function, different name
```

Reserve `export default` for cases where a module's entire purpose is a single, unambiguous thing — a React component file, or a framework convention that specifically expects a default export (some CLI entrypoints, some plugin systems).

### Keep Module Surface Intentional

Export only what other modules actually need. Anything not exported is free to be refactored internally without breaking consumers.

```javascript
// ✅ Do — internal helper stays private to the module
function calculateDiscount(order) { /* implementation detail */ }

export function getOrderTotal(order) {
  return order.subtotal - calculateDiscount(order);
}
```

### Avoid Circular Dependencies

Circular `import`s between modules produce partially-initialized exports and order-dependent bugs. If module `a.js` and `b.js` need each other's functionality, extract the shared piece into a third module both can depend on.

---

## File and Folder Naming

Pick one casing convention for filenames and apply it uniformly — a mix of `camelCase.js`, `kebab-case.js`, and `PascalCase.js` in the same repo makes imports error-prone on case-sensitive filesystems (notably Linux CI runners, even when local development is on macOS/Windows).

**Common conventions:**

**kebab-case** for general modules — `order-service.js`, `payment-gateway.ts`. Widely used in Node.js backend projects; avoids case-sensitivity surprises entirely.

**PascalCase** for files whose default export is a class or a component — `OrderService.ts`, `UserCard.tsx`. Common in frontend/React codebases.

**Match the export name to the filename** regardless of which casing convention is chosen, so `import { OrderService } from "./order-service"` and `class OrderService` stay easy to correlate.

```
// ✅ Do — consistent kebab-case across the module
src/
  services/
    order-service.js
    payment-gateway.js
  routes/
    order-routes.js

// ❌ Avoid — mixed casing
src/
  services/
    OrderService.js
    payment_gateway.js
  routes/
    orderRoutes.js
```

Keep test files adjacent to (or mirrored under a `__tests__`/`test` directory from) the module they test, using a consistent suffix such as `.test.js` or `.spec.js`.

---

## EditorConfig

ESLint and Prettier govern JavaScript/TypeScript syntax, but a repository usually also contains JSON, YAML, Markdown, and shell scripts — files those tools don't touch. [EditorConfig](https://editorconfig.org/) is a simple, editor-agnostic file that keeps indentation, line endings, and trailing whitespace consistent across every file type and every contributor's editor, independent of each person's local editor settings.

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

Most editors (VS Code, WebStorm, Vim with a plugin) read `.editorconfig` automatically with no per-project configuration needed beyond the file itself.

---

## Further Reading

- [nodebestpractices — Code Style Practices](https://github.com/goldbergyoni/nodebestpractices) (source for the ESLint/Prettier comparison above; licensed CC BY-SA 4.0)
- [ESLint documentation](https://eslint.org/docs/latest/)
- [Prettier documentation](https://prettier.io/docs/en/)
- [EditorConfig](https://editorconfig.org/)
