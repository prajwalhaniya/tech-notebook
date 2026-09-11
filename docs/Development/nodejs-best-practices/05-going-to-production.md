---
sidebar_position: 5
---

# Going to Production

Runtime, process, logging, and monitoring practices for running Node.js services reliably in production.

---

## Table of Contents

1. [Runtime and Dependency Hygiene](#runtime-and-dependency-hygiene)
2. [Environment Configuration](#environment-configuration)
3. [Statelessness and Process Resilience](#statelessness-and-process-resilience)
4. [Offload Networking Work to a Reverse Proxy](#offload-networking-work-to-a-reverse-proxy)
5. [Logging in Production](#logging-in-production)
6. [Monitoring and Memory](#monitoring-and-memory)
7. [Operational Endpoints](#operational-endpoints)
8. [Production-Ready Code Checklist](#production-ready-code-checklist)
9. [Further Reading](#further-reading)

---

## Runtime and Dependency Hygiene

### Use an LTS Release of Node.js

**LTS (Long Term Support):** An even-numbered Node.js release line, supported for at least 18 months, that only receives bug fixes, security patches, and backward-compatible performance improvements.

Odd-numbered "Current" releases move fast and ship breaking changes more frequently — they're for trying out new engine features, not for running a paying customer's traffic. Pin production deployments (Dockerfiles, CI images, `.nvmrc`, `engines` in `package.json`) to the active LTS line and upgrade deliberately as new LTS versions are promoted.

```json
// package.json
{
  "engines": {
    "node": ">=20.0.0 <21"
  }
}
```

```dockerfile
# Dockerfile
FROM node:20-alpine
```

### Lock Dependencies

**Problem:** A loose semver range (`^2.1.4`) means `npm install` can silently pull a newer minor/patch version that introduces a regression — the exact version that passed QA is not guaranteed to be the version that reaches production.

**Fix:** Commit `package-lock.json` (generated automatically since npm 5) so every install — locally, in CI, and in production — resolves the identical dependency tree, down to transitive dependencies and integrity hashes.

```npmrc
// .npmrc — force exact versions instead of caret ranges when installing
save-exact=true
```

```json
// package-lock.json (excerpt) — pins version + integrity hash per package
{
  "dependencies": {
    "cacache": {
      "version": "9.2.6",
      "resolved": "https://registry.npmjs.org/cacache/-/cacache-9.2.6.tgz",
      "integrity": "sha512-YK0Z5..."
    }
  }
}
```

### Install Packages with `npm ci` in Production

`npm install` reconciles `package.json` against `package-lock.json` and may still update the lock file. `npm ci` does not — it installs strictly from the lock file and fails loudly if `package.json` and `package-lock.json` disagree.

```bash
# Local development: fine to resolve and update the lock file
npm install

# CI / deployment: fail fast on drift, wipe node_modules first, ~2x faster
npm ci --production
```

Use `npm install` on developer machines, and `npm ci` everywhere else (CI pipeline, Docker build, deploy step). This guarantees the exact versions validated in CI are what ships to production, and it surfaces an out-of-sync lock file as a build failure instead of a silent drift.

### Detect Vulnerable Dependencies

A typical app pulls in tens or hundreds of transitive dependencies — a known CVE in any of them makes your app vulnerable too. Wire vulnerability scanning into CI rather than relying on someone remembering to check:

```bash
npm audit --audit-level=high
```

`npm audit` (built in) and [Snyk](https://snyk.io/) (continuous monitoring, PRs for fixes, broader vulnerability database) are the two most common choices. Fail the build on high/critical findings and re-scan on a schedule, since new CVEs are disclosed against packages you already shipped.

---

## Environment Configuration

### Set `NODE_ENV=production`

**`NODE_ENV`:** The de facto environment variable convention Node's ecosystem uses to decide whether to run in development or production mode.

Express and many popular libraries branch on it — enabling view caching, suppressing verbose error stacks, and skipping debug-only work when it's set to `production`. Leaving it unset (defaulting to development behavior) has been measured to cut Express throughput roughly in half.

```bash
# Set before starting the process — every deploy tool (Docker, systemd, PM2, ECS task defs) supports this
NODE_ENV=production node server.js
```

```javascript
// Application code can branch on it too
if (process.env.NODE_ENV === 'production') {
  useCaching = true;
}
```

Set it at the process/container level, not inside application code — that way it's consistent across every entry point (web server, worker, migration script) that touches the same codebase.

---

## Statelessness and Process Resilience

### Be Stateless — Treat Servers as Disposable

**Stateless server:** An instance that holds no data or session state that would be lost if the process were killed and replaced right now.

Any server that keeps something a colleague can't reconstruct — an uploaded file on local disk, a session stored in memory or a local file, data stashed on the global object — becomes a single point of failure and blocks horizontal scaling. Treat every instance like a "phoenix": it should be safe to kill and replace at any moment.

```javascript
// ❌ Avoid: local disk, in-memory session store, global mutable cache
const upload = multer({ dest: 'uploads/' }); // lost if this instance dies

const FileStore = require('session-file-store')(session);
app.use(session({ store: new FileStore(options), secret: 'keyboard cat' }));

global.someCache.result = { somedata }; // not shared across instances

// ✅ Do: externalize state
const upload = multer({ storage: multerS3({ bucket: 'uploads' }) }); // S3

app.use(session({
  store: new RedisStore({ client: redisClient }), // shared session store
  secret: process.env.SESSION_SECRET
}));

const cached = await redisClient.get('someCacheKey'); // shared cache
```

The payoff: instances can be added, removed, or replaced without side effects, and nobody has to reason about "what state does *this particular* server have."

### Guard and Restart the Process on Failure

A Node process that crashes stays down until something restarts it — there is no runtime supervisor built in. Which tool to use depends on your deployment shape:

- **No containers / small apps:** [PM2](https://www.npmjs.com/package/pm2) — restarts on crash, gives you a monitoring UI, and integrates with Node-specific signals (graceful reload).
- **Bare Linux with strong ops skills:** run Node as a `systemd` service with `Restart=on-failure`.
- **Containers with an orchestrator** (Kubernetes, ECS): the orchestrator already restarts unhealthy containers. Many teams still keep [pm2-docker](https://www.npmjs.com/package/pm2-docker) as a first restart tier inside the container — it's faster than waiting for the orchestrator to notice and reschedule — while letting the orchestrator handle node-level failures and rescheduling.

There's no single right layer; know the tradeoffs and pick based on how much control you need versus how much you want the orchestrator to own.

### Utilize All CPU Cores

Plain Node.js runs on a single thread — a single process pinned to a single CPU core. Paying for an 8-core box and using one core leaves most of the capacity idle.

```javascript
// Node's built-in cluster module: fork one worker per core, round-robin requests
const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on('exit', (worker) => {
    console.error(`worker ${worker.process.pid} died, forking a replacement`);
    cluster.fork();
  });
} else {
  require('./server'); // starts the HTTP server in each worker
}
```

```bash
# Or let PM2 manage clustering for you — no code changes needed
pm2 start server.js -i max   # one worker per available core
```

For simple-to-medium apps, `cluster` or PM2's `-i max` mode is enough. For heavier throughput or a tighter DevOps flow, replicate the Node process behind a dedicated balancer (nginx) or hand cluster management to a container orchestrator (Kubernetes, ECS) that replicates and load-balances at the infrastructure level instead of inside the process.

---

## Offload Networking Work to a Reverse Proxy

### Delegate Static Content, Gzip, and SSL to nginx/HAProxy

Express's middleware ecosystem makes it tempting to handle static file serving, gzip compression, request throttling, and SSL termination directly in Node. Don't — Node's single-threaded model is tuned for short, async work, and networking-heavy tasks like these will monopolize the event loop and starve request handling.

Hand these jobs to a tool built for them — nginx or HAProxy sit in front of Node and are what the major cloud vendors use to shield Node processes from raw traffic.

```nginx
# nginx.conf — compression, SSL termination, and upstream load balancing in front of Node
gzip on;
gzip_comp_level 6;
gzip_vary on;

upstream myApplication {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/myapp.crt;
    error_page 502 /errors/502.html;

    location / {
        proxy_pass http://myApplication;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }
}
```

### Get Frontend Assets Out of Node

Serving static files (images, JS bundles, CSS) directly from Express — even via `res.sendFile()` or `serve-static` — means every asset request competes with API requests for the same single thread. nginx and CDNs use multi-threaded, kernel-level file-serving paths (`sendfile`) that Node cannot match.

Two common patterns:

1. **Reverse proxy for static files** — static assets are deployed alongside the Node app, but nginx (sitting in front) intercepts requests to the static path and serves them directly, never reaching Node. Also sidesteps CORS since everything shares an origin.
2. **Cloud storage / CDN** — static assets live in S3, Azure Blob Storage, or similar, fully decoupled from the Node deployment. The frontend and backend teams ship independently.

```nginx
# nginx serving static assets directly, bypassing Node entirely
location ~ ^/(images/|js/|css/|static/|favicon.ico) {
    root /usr/local/myapp/node/public;
    access_log off;
    expires max;
}
```

---

## Logging in Production

### Let the Execution Environment Route Logs

**Log routing:** Deciding where log lines end up — a file, a database, a log aggregator — as opposed to *what* gets logged.

Application code should only ever write to `stdout`/`stderr`. Routing is infrastructure's job, following the [12-Factor logging](https://12factor.net/logs) principle: a process should never manage where its own logs are archived.

```javascript
// ❌ Avoid: app code owns log destinations
const logger = createLogger({
  transports: [new transports.File({ filename: 'combined.log' })],
});
winston.add(winston.transports.MongoDB, options); // app now depends on Mongo for logging

// ✅ Do: log to stdout only, let the platform capture and route it
const logger = createLogger({
  level: 'info',
  transports: [new transports.Console()],
});
```

```json
// docker daemon.json — the platform decides where stdout goes (Splunk shown here)
{
  "log-driver": "splunk",
  "log-opts": { "splunk-token": "...", "splunk-url": "..." }
}
```

This matters most in containerized/cloud environments where instances scale up and down dynamically — you cannot know ahead of time which host or container a given log line came from, so hard-coding a file path is meaningless. It also keeps the decision of "where do logs go" in the hands of the ops/DevOps team, without requiring an application code change every time it needs to move.

### Write Structured, Smart Logs

Turn raw log lines into an operational tool rather than noise, in three layers:

1. **Smart logging** — use a real logging library (Winston, Bunyan/Pino), emit structured JSON with contextual fields (user id, operation, duration), and log meaningfully at the start/end of each transaction. Pair this with a resource-usage agent (e.g., Elastic Beat) for CPU/memory alongside app logs.
2. **Smart aggregation** — ship logs off-box to a system that collects and indexes them (Elastic Stack, Datadog, etc.) so they're searchable across every instance instead of scattered across ephemeral containers.
3. **Smart visualization** — build dashboards on the aggregated data (Kibana, Grafana) to surface error rate, average latency, and business metrics without writing ad-hoc scripts.

```javascript
// Structured JSON logging instead of free-text strings
logger.info({
  msg: 'order created',
  userId: user.id,
  orderId: order.id,
  amount: order.total,
  durationMs: Date.now() - start,
});
```

Structured, JSON-formatted entries are what make aggregation and visualization possible in the first place — a log aggregator can filter and chart on fields, but not on prose.

### Assign a Transaction ID to Every Log Line

**Transaction ID (correlation ID):** A unique identifier attached to every log line produced while handling a single request, so all lines belonging to that request can be found with one search — even across multiple services.

Without it, tracing "what happened for this one failed request" across a warehouse of interleaved log lines from concurrent requests (and, in microservices, across multiple processes) is close to impossible. Node's single-threaded, callback-driven model makes this harder than in thread-per-request frameworks — there's no thread-local storage to lean on — so use [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) to carry context through an async call chain.

```javascript
const express = require('express');
const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const asyncLocalStorage = new AsyncLocalStorage();

// Assign or propagate a transaction id for every incoming request
const transactionIdMiddleware = (req, res, next) => {
  asyncLocalStorage.run(new Map(), () => {
    const transactionId = req.headers['x-transaction-id'] || randomUUID();
    asyncLocalStorage.getStore().set('transactionId', transactionId);
    next();
  });
};

const app = express();
app.use(transactionIdMiddleware);

app.get('/users', async (req, res, next) => {
  const transactionId = asyncLocalStorage.getStore().get('transactionId');

  try {
    // Forward the id to downstream services to keep the trace intact
    const response = await axios.get('https://users-service/api/users', {
      headers: { 'x-transaction-id': transactionId },
    });
    logger.info('fetched users from downstream service');
    res.json(response.data);
  } catch (err) {
    next(err);
  }
});

class logger {
  static info(message) {
    console.log(`${message} transactionId=${asyncLocalStorage.getStore().get('transactionId')}`);
  }
  static error(err) {
    console.error(`${err} transactionId=${asyncLocalStorage.getStore().get('transactionId')}`);
  }
}
```

For less boilerplate, [`cls-rtracer`](https://www.npmjs.com/package/cls-rtracer) wraps this same `AsyncLocalStorage` pattern for Express/Koa/Fastify/Hapi, including automatic header propagation between services (`echoHeader` / `useHeader`). Either way, the id turns "search every line and guess which ones belong together" into "filter by `transactionId=abc123`."

---

## Monitoring and Memory

### Monitoring Fundamentals

**Monitoring:** Being able to *easily* find out when something bad is happening in production — ideally before a customer files a ticket.

Start with a small core set of metrics that must always be watched:

- CPU and server RAM
- Node process RAM (a single process growing past roughly 1.4GB old-space is worth investigating)
- Error count over the last minute
- Process restart count
- Average response time

Cloud vendor tools (AWS CloudWatch, Google Cloud Monitoring) give hardware metrics for free but little insight into in-process behavior; log-based tools (Elastic Stack) give app-level detail but no hardware view by default. In practice you combine both — e.g., ship app logs to Elastic and add a hardware agent (Beat) to fill the gap — rather than expecting one tool to cover everything out of the box. Beyond the basics, "luxury" features (DB profiling, cross-service transaction tracing, BI export, chat alerting) usually mean a commercial APM product or meaningfully more setup time.

### APM Products for End-to-End User Experience

**APM (Application Performance Monitoring):** A category of tools that measure performance from the customer's perspective end-to-end, not just from isolated technical metrics.

A system can produce zero exceptions and still deliver a terrible experience — e.g., a slow downstream middleware service. Traditional monitoring (errors, slow endpoints) won't catch that; APM products trace a single business transaction across every tier (frontend, gateway, multiple services) and report how long the *whole* thing took, then point at the specific hop responsible. This comes at a real price tag, so it's usually reserved for large-scale, multi-service products where straightforward metrics aren't enough to explain user-facing slowness.

### Measure and Guard Memory Usage

Memory leaks are a known Node gotcha, not a theoretical risk — they need active, continuous measurement rather than a one-time check. Manual tooling (Linux commands, `node-inspector`, `memwatch`) works for development and small deployments, but it requires a human actively watching. For anything serious, wire memory into your monitoring stack (CloudWatch, Datadog, or similar) so leaks trigger an alert instead of a postmortem.

A few habits reduce leak risk at the source:

- Never accumulate data on the global object.
- Use streams instead of buffering entire payloads for data of unpredictable size.
- Scope variables with `let`/`const` instead of leaking them into a wider closure.

```bash
# Cap the V8 old-space size so a leak degrades predictably instead of OOM-killing the host silently
node --max-old-space-size=1536 server.js
```

---

## Operational Endpoints

### Create a Maintenance Endpoint

A maintenance endpoint is a private HTTP route, shipped as part of the app, that exposes operational actions a generic monitoring tool can't — generating a heap dump on demand, reporting suspected leaks, or running a REPL command against the live process. Prefer commercial/external monitoring tools as the default; reach for a maintenance endpoint only for the Node- or app-specific gaps they leave (e.g., a heap snapshot taken at a precise moment).

```javascript
const heapdump = require('heapdump');

function isAuthorized(req) {
  // Verify an admin-only credential — never leave this route open
}

router.get('/ops/heapdump', (req, res, next) => {
  if (!isAuthorized(req)) {
    return res.status(403).send('You are not authorized!');
  }

  logger.info('generating heapdump');
  heapdump.writeSnapshot((err, filename) => {
    if (err) return next(err);
    fs.readFile(filename, (readErr, data) => {
      if (readErr) return next(readErr);
      res.end(data);
    });
  });
});
```

Lock this down hard — authentication, IP allow-listing, or both — since an endpoint that can dump the heap or run arbitrary commands is also a prime DDoS and exploitation target if it leaks.

---

## Production-Ready Code Checklist

A handful of development habits pay off specifically once code reaches production:

- **Follow the [12-Factor](https://12factor.net/) guide** as a baseline for config, statelessness, and log handling.
- **Cache aggressively, but degrade gracefully** — a cache miss or cache-layer outage should never take down the request path.
- **Test for memory leaks as part of the normal dev flow**, not as a separate fire drill (`memwatch` or similar).
- **Name your functions** — anonymous inline callbacks show up as `(anonymous)` in memory and CPU profiles, making them nearly impossible to attribute.
- **Lean on CI** to catch issues before they reach production: ESLint for reference/undefined-variable errors, `--trace-sync-io` to flag accidental synchronous I/O in async code paths.
- **Make local environments resemble production** (Docker Compose, matching services) instead of branching test-only code paths with `if (isTest)` checks — run the same code everywhere.
- **Treat error handling as a first-class concern.** Many Node crashes trace back to a minor, unhandled error; equally common is a process that *should* have crashed but instead limps along in a corrupted state. Decide your error-handling strategy deliberately rather than by accident.

---

## Further Reading

- [nodebestpractices — Going to Production](https://github.com/goldbergyoni/nodebestpractices) (Section 7)
