---
sidebar_position: 7
---

# Performance

Practices for keeping the Node.js event loop responsive under load — recognizing what blocks it, what to offload, and how to profile before optimizing.

---

## Table of Contents

1. [Don't Block the Event Loop](#dont-block-the-event-loop)
2. [Prefer Native Methods Over Utility Libraries](#prefer-native-methods-over-utility-libraries)
3. [Offload CPU-Bound Work](#offload-cpu-bound-work)
4. [Avoid Quadratic Algorithms in Hot Paths](#avoid-quadratic-algorithms-in-hot-paths)
5. [Stream Large Payloads Instead of Buffering](#stream-large-payloads-instead-of-buffering)
6. [Profile Before Optimizing](#profile-before-optimizing)
7. [Further Reading](#further-reading)

---

## Don't Block the Event Loop

Node.js runs application JavaScript on a single thread. Any synchronous operation that takes a while to finish — a tight loop, a large JSON parse, a synchronous crypto call — occupies that thread and delays every other request being served concurrently. This page assumes familiarity with the event loop's phases; see [Event Loop](../../nodejs/event-loop) for the mechanics of *why* this happens. Here the focus is what to actually do about it.

### The Symptom

A single slow synchronous handler degrades latency for every concurrent client, not just the one that triggered it:

```javascript
// ❌ Avoid — busy-waits the thread, stalling every other in-flight request
function sleepSync(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until);
}

app.get("/", (req, res) => {
  sleepSync(30); // blocks the event loop for 30ms on every request
  res.json({});
});
```

Under load, this doesn't just add 30ms to this endpoint — it adds latency to *every* request being processed by the same process, because nothing else can run while the loop is stuck in that `while`.

### Synchronous fs and crypto Calls

Node's `fs` and `crypto` modules offer both sync and async variants. The sync variants run entirely on the main thread; the async variants hand the work to libuv's thread pool and free the event loop in the meantime.

```javascript
// ❌ Avoid — reads the whole file synchronously, blocking the loop
const fs = require("fs");
app.get("/report", (req, res) => {
  const data = fs.readFileSync("./large-report.json", "utf8");
  res.send(data);
});

// ✅ Do — async variant yields to the event loop while I/O happens
const fs = require("fs/promises");
app.get("/report", async (req, res) => {
  const data = await fs.readFile("./large-report.json", "utf8");
  res.send(data);
});
```

The same trade-off applies to `crypto.pbkdf2Sync` / `crypto.scryptSync` versus their async counterparts — password hashing is intentionally slow, which is exactly why it must never run synchronously in a request handler.

```javascript
// ❌ Avoid — synchronous scrypt blocks the loop for the hash duration
const { scryptSync } = require("crypto");
const hash = scryptSync(password, salt, 64);

// ✅ Do — async scrypt frees the loop while the CPU work happens off-thread
const { scrypt } = require("crypto");
const { promisify } = require("util");
const scryptAsync = promisify(scrypt);
const hash = await scryptAsync(password, salt, 64);
```

### Heavy JSON Parsing and Stringifying

`JSON.parse` and `JSON.stringify` are synchronous and have no async variant. For small payloads this is irrelevant; for multi-megabyte payloads, parsing or serializing them can block the loop for tens of milliseconds.

```javascript
// ❌ Avoid — stringifying a huge in-memory object on every request
app.get("/export", (req, res) => {
  const payload = buildHugeReport(); // several MB
  res.send(JSON.stringify(payload)); // blocks while serializing
});

// ✅ Do — stream the response so serialization happens incrementally,
// or move construction + serialization to a worker thread (see below)
app.get("/export", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  streamHugeReportAsJson(res); // writes chunks as they're built
});
```

### Unsafe Regular Expressions

A regex with catastrophic backtracking can turn what looks like a cheap string check into an operation that runs for seconds on a crafted input, blocking the loop the whole time. Avoid nested quantifiers over user-controlled input (`(a+)+`, `(a|a)*`) and validate regex complexity with a tool such as [safe-regex](https://www.npmjs.com/package/safe-regex) before accepting it on untrusted input.

### Mitigation Summary

**✅ Do:**
- Prefer the async/Promise-based variant of any Node.js API that offers one.
- Break large synchronous loops into chunks, yielding with `setImmediate` between chunks so I/O callbacks get a chance to run.
- Move genuinely CPU-bound work off the main thread entirely (see [Offload CPU-Bound Work](#offload-cpu-bound-work)).

**❌ Avoid:**
- Any `*Sync` fs or crypto call in a request-handling path.
- Parsing/stringifying large JSON payloads inline in a hot handler.
- Regexes with nested quantifiers applied to untrusted, unbounded input.

---

## Prefer Native Methods Over Utility Libraries

Modern JavaScript (ES2015+) natively covers most of what utility libraries like Lodash or Underscore were historically needed for — mapping, filtering, finding, cloning, deep-comparing. Native `Array`/`Object` methods are implemented and optimized inside V8 itself, while a userland utility function adds a call-stack layer and, for many common operations, measurably more time per call. Independent benchmarks comparing native `Array.prototype` methods against equivalent Lodash/Underscore calls have found native methods complete the same work in a fraction of the time on average — see the [benchmark comparison](https://github.com/Berkmann18/NativeVsUtils) referenced by the upstream nodebestpractices project.

```javascript
// ❌ Avoid — pulling in Lodash for something native JS already does well
const _ = require("lodash");

const ids = _.map(users, (u) => u.id);
const found = _.find(users, (u) => u.id === targetId);
const unique = _.uniq(ids);
const total = _.sumBy(orders, "amount");

// ✅ Do — native equivalents, no extra dependency or call overhead
const ids = users.map((u) => u.id);
const found = users.find((u) => u.id === targetId);
const unique = [...new Set(ids)];
const total = orders.reduce((sum, o) => sum + o.amount, 0);
```

Native language features also now cover several Lodash niceties directly:

```javascript
// ❌ Avoid
const name = _.get(user, "profile.name", "Unknown");
const merged = _.merge({}, defaults, overrides);
const cloned = _.cloneDeep(original);

// ✅ Do
const name = user.profile?.name ?? "Unknown";
const merged = { ...defaults, ...overrides };
const cloned = structuredClone(original);
```

This isn't a blanket "never use utility libraries" rule — Lodash still offers functions with no clean native equivalent (`debounce`, `throttle`, `groupBy` pre-ES2024, deep-path immutable updates). The point is to default to native methods first and reach for a dependency only when the native platform genuinely lacks the capability. An ESLint rule such as [`eslint-plugin-you-dont-need-lodash-underscore`](https://www.npmjs.com/package/eslint-plugin-you-dont-need-lodash-underscore) can flag imports that duplicate native functionality automatically.

---

## Offload CPU-Bound Work

> The following goes beyond what the upstream nodebestpractices source covers and reflects general Node.js community practice for handling CPU-bound work.

Some work is unavoidably CPU-intensive — image resizing, PDF generation, complex data transformation, cryptographic key derivation. No amount of chunking eliminates the total CPU time; it only spreads the *blocking* across more event loop turns. For real CPU-bound work, move it off the main thread.

### worker_threads for In-Process Parallelism

`worker_threads` runs JavaScript on a separate thread with its own V8 instance and event loop, communicating with the main thread via message passing (or shared memory via `SharedArrayBuffer`). This keeps the main thread free to keep handling I/O and requests.

```javascript
// worker.js
const { parentPort, workerData } = require("worker_threads");

function computeExpensiveHash(input) {
  // CPU-bound work — runs entirely on the worker's own thread
  let result = input;
  for (let i = 0; i < 1_000_000; i++) {
    result = require("crypto").createHash("sha256").update(result).digest("hex");
  }
  return result;
}

parentPort.postMessage(computeExpensiveHash(workerData));
```

```javascript
// main.js
const { Worker } = require("worker_threads");

function runInWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./worker.js", { workerData: data });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// ✅ Do — the event loop stays free while the hash computation runs
app.post("/hash", async (req, res) => {
  const result = await runInWorker(req.body.input);
  res.json({ result });
});
```

```javascript
// ❌ Avoid — same computation inline blocks every concurrent request
app.post("/hash", (req, res) => {
  const result = computeExpensiveHash(req.body.input); // blocks the loop
  res.json({ result });
});
```

For repeated CPU-bound work, maintain a worker pool (via [`piscina`](https://www.npmjs.com/package/piscina) or a hand-rolled pool) rather than spawning a new `Worker` per request — thread creation has real overhead.

### Child Processes for Isolation or External Tools

`child_process` (via `fork`, `spawn`, or `exec`) runs work in a fully separate OS process. Use it over `worker_threads` when the work needs process-level isolation (a crash shouldn't affect the parent), needs to invoke an external binary (`ffmpeg`, `imagemagick`), or when memory needs to be reclaimed completely when the task finishes (worker threads share the parent's memory space more subtly than a fresh process).

```javascript
// ✅ Do — fork a dedicated process for a heavy, isolated batch job
const { fork } = require("child_process");

function runReportJob(params) {
  return new Promise((resolve, reject) => {
    const child = fork("./jobs/generate-report.js");
    child.send(params);
    child.once("message", resolve);
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error("Report job failed"));
    });
  });
}
```

### Dedicated Job Queues

For work that doesn't need a synchronous response — sending emails, generating reports, processing uploads — push it onto a job queue (e.g. [BullMQ](https://docs.bullmq.io/) backed by Redis) and process it in a separate worker service entirely. This keeps the web-facing process dedicated to fast request/response cycles and lets the job-processing tier scale independently.

**✅ Do:** offload CPU-bound work to `worker_threads`, a child process, or an external job queue depending on isolation and scaling needs.

**❌ Avoid:** running multi-millisecond synchronous computation directly inside a request handler "because it's simpler."

---

## Avoid Quadratic Algorithms in Hot Paths

> This section is supplementary — general algorithmic guidance, not sourced from the upstream repo.

An O(n²) (or worse) algorithm in a rarely-hit script is harmless. The same algorithm inside a request handler or a loop over user-controlled input becomes a scaling cliff: latency stays flat in testing with small datasets, then degrades sharply in production as input size grows — and because it runs on the single event loop thread, it blocks everyone else while it runs.

```javascript
// ❌ Avoid — O(n²): includes() re-scans dedup on every iteration
function dedupe(items) {
  const result = [];
  for (const item of items) {
    if (!result.includes(item)) {
      result.push(item);
    }
  }
  return result;
}

// ✅ Do — O(n): Set lookups are O(1) on average
function dedupe(items) {
  return [...new Set(items)];
}
```

```javascript
// ❌ Avoid — O(n*m): nested find() over a second array per row
function attachUserNames(orders, users) {
  return orders.map((order) => ({
    ...order,
    userName: users.find((u) => u.id === order.userId)?.name,
  }));
}

// ✅ Do — O(n+m): build a lookup map once, then O(1) lookups
function attachUserNames(orders, users) {
  const usersById = new Map(users.map((u) => [u.id, u]));
  return orders.map((order) => ({
    ...order,
    userName: usersById.get(order.userId)?.name,
  }));
}
```

**Watch for:** `.includes()`/`.indexOf()`/`.find()` called inside a loop over another collection, string concatenation in a loop building a large string (prefer an array + `.join()`), and repeated array `.splice()` or `.unshift()` calls in a loop (both are O(n) per call, making the loop O(n²) overall).

---

## Stream Large Payloads Instead of Buffering

Buffering an entire file or response body into memory before processing or sending it means peak memory usage scales with payload size, and nothing downstream can start until the whole buffer is ready. Node's `stream` module processes data incrementally in fixed-size chunks, keeping memory usage flat and letting consumers start work before the full payload has arrived.

```javascript
// ❌ Avoid — loads the entire file into memory, then blocks on JSON.parse too
app.get("/download", async (req, res) => {
  const data = await fs.readFile("./large-export.csv"); // whole file in RAM
  res.send(data);
});

// ✅ Do — stream directly from disk to the response, constant memory usage
const fs = require("fs");
app.get("/download", (req, res) => {
  const stream = fs.createReadStream("./large-export.csv");
  stream.on("error", (err) => res.status(500).end());
  stream.pipe(res);
});
```

The same applies to proxying an upstream response or transforming data in transit — use `pipeline` (not raw `.pipe()`) so errors and backpressure are handled correctly across the whole chain:

```javascript
// ✅ Do — pipeline propagates errors and cleans up all streams on failure
const { pipeline } = require("stream/promises");
const zlib = require("zlib");

async function compressToFile(sourcePath, destPath) {
  await pipeline(
    fs.createReadStream(sourcePath),
    zlib.createGzip(),
    fs.createWriteStream(destPath)
  );
}
```

```javascript
// ❌ Avoid — unpiped .pipe() chains silently leak on error;
// the write stream is never closed if the read stream errors
fs.createReadStream(sourcePath)
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream(destPath));
```

**Rule of thumb:** if a payload's size isn't bounded and known to be small (roughly: safely fits well under available heap with room for concurrent requests), stream it rather than buffering it with `fs.readFile`, `response.json()`, or accumulating request body chunks into a single string before parsing.

---

## Profile Before Optimizing

> This section is supplementary — general profiling guidance, not sourced from the upstream repo.

Intuition about what's "slow" in a Node.js service is frequently wrong — the actual bottleneck is often a single unexpected function, not the code that looks expensive at a glance. Profile before rewriting anything.

### Built-in CPU Profiling

Node ships a V8 profiler accessible via the `--prof` flag, producing a raw isolate log that `--prof-process` converts into a readable summary:

```bash
node --prof server.js
# ... generate load against the server ...
node --prof-process isolate-0x*-v8.log > profile.txt
```

The output ranks functions (including V8/C++ internals) by ticks, surfacing exactly where time is spent — application code, garbage collection, or V8 optimization/deoptimization overhead.

### clinic.js

[clinic.js](https://clinicjs.org/) wraps several diagnostic tools behind one CLI and produces interactive HTML flame graphs and event-loop-delay charts:

```bash
npm install -g clinic
clinic doctor -- node server.js       # overall health check: CPU, event loop delay, GC
clinic flame -- node server.js        # flame graph of CPU time by call stack
clinic bubbleprof -- node server.js   # visualizes async operation flow and delays
```

`clinic doctor` is a good starting point — it recommends which of the other tools to run next based on the symptoms it detects (e.g. "I/O is slow" points you toward `bubbleprof`; "CPU is a bottleneck" points you toward `flame`).

### 0x

[0x](https://github.com/davidmarkclements/0x) generates a single flame graph from a single command, with less overhead than `clinic flame` for a quick look:

```bash
npm install -g 0x
0x -- node server.js
```

### Event Loop Lag as a Signal

Beyond one-off profiling, track event loop lag continuously in production — it's the earliest indicator that something is blocking the loop, before it shows up as elevated p99 latency:

```javascript
const { monitorEventLoopDelay } = require("perf_hooks");

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

setInterval(() => {
  metrics.gauge("event_loop.lag.p99_ms", histogram.percentile(99) / 1e6);
  histogram.reset();
}, 10_000);
```

**✅ Do:** measure with `--prof`, clinic.js, or 0x before changing code for performance reasons — the actual hot path is often not the code that looks expensive.

**❌ Avoid:** "optimizing" code based on guesswork, or micro-optimizing a function that profiling shows accounts for a negligible fraction of total time.

---

## Further Reading

- [nodebestpractices — Performance Practices](https://github.com/goldbergyoni/nodebestpractices) (source for the event-loop-blocking and native-vs-utility-library practices above; licensed CC BY-SA 4.0)
- [Event Loop](../../nodejs/event-loop) — internal mechanics of the event loop, phases, and starvation patterns
- [Node.js Documentation — Don't Block the Event Loop](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/)
- [clinic.js documentation](https://clinicjs.org/documentation/)
