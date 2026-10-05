---
sidebar_position: 15
---

# A Worked Example: Tracing an Express Request Through the Runtime

The [Runtime & Event Loop](./runtime-event-loop.md) and [HTTP Request Lifecycle](./http-request-lifecycle.md) guides explain the machinery in isolation. This guide picks one small Express app and walks every line of it through that machinery — from `node server.js` to a client getting a response — so the phases, handles, and microtask drains stop being abstract and become a trace of one concrete program.

---

## Table of Contents

1. [The Example](#1-the-example)
2. [Step 1 — Process Boot and `require('express')`](#2-step-1--process-boot-and-requireexpress)
3. [Step 2 — Building the App Is Just Building Data](#3-step-2--building-the-app-is-just-building-data)
4. [Step 3 — `app.listen()`: the First Handle](#4-step-3--applisten-the-first-handle)
5. [Step 4 — Script Finishes, the Loop Takes Over](#5-step-4--script-finishes-the-loop-takes-over)
6. [Step 5 — A Connection Arrives](#6-step-5--a-connection-arrives)
7. [Step 6 — Request Bytes Reach Express](#7-step-6--request-bytes-reach-express)
8. [Step 7 — The Synchronous Route: `GET /`](#8-step-7--the-synchronous-route-get-)
9. [Step 8 — The Async Route: `GET /user/:id`](#9-step-8--the-async-route-get-userid)
10. [Step 9 — While the Query Is in Flight](#10-step-9--while-the-query-is-in-flight)
11. [Step 10 — The DB Responds: Resuming via Microtask](#11-step-10--the-db-responds-resuming-via-microtask)
12. [Step 11 — Two Requests, Interleaved: a Timeline](#12-step-11--two-requests-interleaved-a-timeline)
13. [Step 12 — Idle Sockets, Keep-Alive, and Why the Process Won't Exit](#13-step-12--idle-sockets-keep-alive-and-why-the-process-wont-exit)
14. [What Would Break This: a Blocking Handler](#14-what-would-break-this-a-blocking-handler)
15. [Summary: Express Call → Runtime Mechanism](#15-summary-express-call--runtime-mechanism)

---

## 1. The Example

```js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('hello');
});

app.get('/user/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
});

const server = app.listen(3000, () => {
  console.log('listening on 3000');
});
```

Nothing here is Express-specific magic — every line is either plain synchronous JavaScript or a thin wrapper around the exact `net`/`http` primitives covered in the HTTP Request Lifecycle guide. That's the point of this walkthrough: once you can place each line on the runtime's timeline, "Express" stops being a black box and becomes "a particular, very common, arrangement of the same primitives."

## 2. Step 1 — Process Boot and `require('express')`

Running `node server.js` triggers the full bootstrap sequence from the Runtime guide: `uv_loop_init()` creates this process's event loop, V8's isolate is created, `Environment` is wired up, and only then does `LoadEnvironment` begin executing `server.js` as your entry module — synchronously, top to bottom, with the event loop not yet turning.

`require('express')` runs Node's CommonJS loader: resolve the specifier (`node_modules/express` walk), check `Module._cache` (a cold start, so it's a miss), read and compile `express/index.js`, wrap it in the module function `(exports, require, module, __filename, __dirname) => {...}`, and execute it. Express's own `require`s of its dependencies (`router`, `finalhandler`, etc.) repeat the same process recursively, each result cached so a second `require('express')` anywhere in the process would be a cache hit returning the same `module.exports` object. None of this touches the event loop — module loading is entirely synchronous, disk I/O included (`fs.readFileSync` under the hood in the loader), which is one reason a large `node_modules` tree measurably slows down process *startup* specifically.

`express()` itself — the default export, called as a function — synchronously builds and returns the `app` object: a function (so it can be passed directly to `http.createServer`) with properties and methods attached for routing, settings, and the middleware stack. Nothing async, nothing touching libuv yet.

## 3. Step 2 — Building the App Is Just Building Data

```js
app.get('/', (req, res) => { res.send('hello'); });
app.get('/user/:id', async (req, res) => { ... });
```

Each `app.get(path, handler)` call does exactly one synchronous thing: it compiles `path` into a matching regular expression and pushes a `Layer` object — `{ path, regexp, handler, method: 'GET' }`, roughly — onto the router's internal `stack` array. That's it. No sockets, no timers, no I/O. By the time these two lines finish, Express has a plain in-memory array describing *what should happen* when a matching request eventually arrives — it has not yet made that possible, because no socket is listening.

## 4. Step 3 — `app.listen()`: the First Handle

```js
const server = app.listen(3000, () => console.log('listening on 3000'));
```

This is the first line in the whole file that touches libuv. `app.listen` is a convenience method that does exactly: `http.createServer(app).listen(3000, callback)`. Walking that:

1. `http.createServer(app)` constructs an `http.Server`, registering `app` itself as the `'request'` event listener — this is the entire integration point between Express and Node's `http` module; Express never talks to a socket directly.
2. `.listen(3000, cb)` calls down into `net.Server.prototype.listen`, which creates a `TCP` handle (`src/tcp_wrap.cc`, wrapping a `uv_tcp_t`), calls `uv_tcp_bind()` for port 3000, then `uv_listen()` with a backlog, and registers the C++ `OnConnection` callback.
3. The `uv_tcp_t` handle created here is **active and referenced by default** — this is the handle from the Runtime guide's ref/unref section that will keep `uv_loop_alive()` returning true indefinitely, which is exactly why a server process doesn't exit on its own.

The `cb` (`() => console.log(...)`) is not called synchronously here — binding and listening at the OS level complete asynchronously even though it's usually near-instant, so this callback is registered to fire once libuv confirms the listen succeeded, which happens once the loop actually starts running.

## 5. Step 4 — Script Finishes, the Loop Takes Over

After the `app.listen()` line, `server.js` has no more top-level code. This is precisely the bootstrap boundary described in the Runtime guide: `LoadEnvironment` finishes running your module, and `SpinEventLoopInternal` calls `uv_run()` for the first time. `uv_loop_alive()` is true — the listening TCP handle counts — so the loop proceeds instead of exiting.

The first iteration's early phases (timers, pending, idle/prepare) have nothing to do yet. It reaches the **poll phase**, computes its timeout (no active timers exist, so: block indefinitely), and calls into `epoll_wait`/`kqueue`. The process is now genuinely asleep at the OS level, using ~0% CPU, until the kernel reports that the listening socket has a connection ready — or any other registered fd becomes ready. Somewhere in this first pass, the deferred `uv_listen` completion also surfaces, and your `console.log('listening on 3000')` callback fires.

## 6. Step 5 — A Connection Arrives

A client connects. The kernel completes the TCP handshake entirely on its own; libuv only finds out once `epoll_wait` returns with the listening socket's fd marked readable. The poll phase's dispatch calls `OnConnection`, which calls `uv_accept()` to dequeue the new connection, wraps it in a `net.Socket`, and the `http.Server` emits its internal `'connection'` handling — pulling an `HTTPParser` from the `FreeList` pool (rather than constructing a fresh one) and wiring its callbacks to this socket, exactly as detailed in the HTTP Request Lifecycle guide.

This new connected socket is itself a new active, referenced handle — the loop now has two reasons to stay alive instead of one.

## 7. Step 6 — Request Bytes Reach Express

The client sends `GET / HTTP/1.1\r\nHost: ...\r\n\r\n`. This is a second, separate wakeup of the poll phase — now the *connection's* socket fd is readable, not the listening socket. Its read callback feeds the bytes to `parser.execute(chunk)`, which runs llhttp synchronously, right there inside this I/O callback. As soon as llhttp reaches the blank line terminating the headers, `onHeadersComplete` fires: it builds the `IncomingMessage`, and the `http.Server` emits `'request'` — which calls `app(req, res)`, because `app` was registered as the request listener all the way back in step 4.1.

Express's `app` function now walks its `stack` array built in step 2, testing each `Layer`'s regexp against `req.url` and `req.method` in order, until it finds the `GET /` layer. All of this — parsing, matching, dispatch — happens synchronously, inside the same I/O callback that the poll phase invoked. The event loop has not advanced to another phase; it's still conceptually "inside" the poll phase's callback dispatch for this one fd event.

## 8. Step 7 — The Synchronous Route: `GET /`

```js
app.get('/', (req, res) => { res.send('hello'); });
```

This handler runs to completion synchronously. `res.send('hello')` sets a `Content-Type`, computes a `Content-Length` (Express can, since the body is a complete string it already has), and calls the underlying `ServerResponse.end()` — which, per the HTTP Request Lifecycle guide, flushes the status line, headers, and body onto the socket in one `uv_write()` call. No `await`, no promise, no yielding back to the event loop mid-handler. By the time Express's dispatch returns control back up through `onHeadersComplete` and out to the I/O callback that started this whole chain, the response has already been written. The event loop proceeds to the check and close phases of this same iteration having fully served the request within a single poll-phase callback.

## 9. Step 8 — The Async Route: `GET /user/:id`

```js
app.get('/user/:id', async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
});
```

A request to `/user/42` reaches this handler through the identical path as step 7 — parser, `onHeadersComplete`, `'request'` emit, router match. The difference starts at `async`: calling this function does **not** run it to completion. V8 begins executing it synchronously up to the `await`, calls `db.findUser('42')` (itself returning a `Promise`, since any real DB driver is non-blocking), and the moment `await` is reached, the async function **suspends** — V8 returns a pending `Promise` from the handler call immediately, having executed only the first line.

Control now unwinds all the way back out: back through Express's dispatch, back through `onHeadersComplete`, back to the I/O callback, back into `uv__io_poll`'s dispatch loop, back to `uv_run()`. **No response has been sent.** `res` is just sitting there, captured in the suspended async function's closure, waiting. Critically, the event loop is not blocked waiting for this — it is completely free to move on.

## 10. Step 9 — While the Query Is in Flight

`db.findUser('42')` presumably talks to a real database over its own TCP connection — which means this, too, is just another socket with its own fd known to the same `uv_loop_t`. Issuing the query writes the request bytes and then waits for the database's reply the same way the HTTP server itself waits for request bytes: no thread is blocked, no busy loop — the DB driver registers interest in that socket's fd and returns control.

This is the moment that makes a single-threaded server able to serve concurrent clients at all: between now and whenever the database responds, the event loop's poll phase is free to wake up for *any other* ready fd — another client's new connection, another client's request bytes, the keep-alive socket of the first request's connection going idle. One slow, in-flight database query for client A does not prevent the loop from fully serving client B's `GET /` in the meantime, because "waiting on the database" was never occupying the one JS thread — it was just a registered fd, parked, costing nothing.

## 11. Step 10 — The DB Responds: Resuming via Microtask

Eventually the database's socket fd becomes readable. The poll phase wakes for it, the DB driver's protocol parser reads the response, and resolves the `Promise` that `db.findUser()` had returned. Resolving a `Promise` doesn't synchronously run anything — it schedules a **microtask**.

Per the Runtime guide's §7: microtasks drain after *every* JS callback Node.js invokes, not just at fixed phase boundaries. So immediately after the DB driver's own I/O callback finishes, before `uv_run()` is allowed to move on to the next phase or the next fd, the microtask queue is drained — which includes resuming our suspended async function exactly where it left off. `user` is now bound to the resolved value, and `res.json(user)` runs — serializing the object and writing it to the `/user/42` request's socket, finally completing that response, potentially several event-loop iterations after the request first arrived.

## 12. Step 11 — Two Requests, Interleaved: a Timeline

Concretely, if client A requests `/user/42` and client B requests `/` microseconds later, a plausible real timeline looks like this — one thread, hopping between two unrelated pieces of work, never blocking on either:

```
t0   poll wakes: A's request bytes arrive
     → parsed, routed, async handler starts, hits await, suspends
     → db.findUser() issues query, returns control immediately
t0+  (same iteration) poll wakes: B's request bytes arrive
     → parsed, routed, sync handler runs fully, res.send('hello')
     → B's response is already on the wire
t1   poll wakes: DB socket readable — A's query result arrived
     → promise resolves → microtask drains → A's handler resumes
     → res.json(user) → A's response is now on the wire
```

Client B — whose entire request/response round-trip was synchronous — gets served *inside* the gap while client A's handler is suspended waiting on the database. Nothing here required a second thread; it required exactly one thing: A's handler never did anything that occupies the CPU while it waits.

## 13. Step 12 — Idle Sockets, Keep-Alive, and Why the Process Won't Exit

Both responses are now sent. With HTTP/1.1 keep-alive, neither socket closes — each stays open, its parser reset, waiting for a possible next request from the same client, with a `keepAliveTimeout` (default 5000ms) timer attached. That timer is a new active, referenced handle in the loop — so is the parked DB connection, if the driver keeps it pooled.

Walk this forward to "nobody sends anything else": the keep-alive timers eventually fire (timer phase), each idle socket is closed (close-callbacks phase), and those handles stop counting toward `uv_loop_alive()`. But the **listening TCP handle from step 4** never goes away on its own — `app.listen()` never called anything that closes it. So `uv_loop_alive()` stays true forever, and the process sits in the poll phase indefinitely, waiting for the next connection, using no CPU. This is exactly the intended, correct behavior for a server: it's supposed to run forever until something explicit — `server.close()`, or the process being signaled (`SIGINT`/`SIGTERM`) — removes that reference.

## 14. What Would Break This: a Blocking Handler

Replace the async handler's body with something CPU-bound and synchronous:

```js
app.get('/user/:id', (req, res) => {
  const user = expensiveSyncComputation();
  res.json(user);
});
```

Now there is no `await`, no suspension point, nothing handed back to the event loop mid-handler. If `expensiveSyncComputation()` takes 500ms, the single JS thread is occupied for that entire 500ms — and per step 12's timeline, that means client B's simple `GET /` **cannot be served**, even though its request bytes may have already arrived and be sitting readable on its socket, because the poll phase can't even be re-entered until the current synchronous callback returns control to `uv_run()`. One slow synchronous handler stalls every concurrent client on the process, which is the single most consequential practical fact this entire trace has been building toward: the event loop model gives you cheap concurrency for I/O-bound work for free, and gives you zero concurrency for CPU-bound work by default — you have to reach for worker threads or a child process deliberately to get that back.

## 15. Summary: Express Call → Runtime Mechanism

| Express/Node call | What actually happens underneath |
|---|---|
| `require('express')` | Synchronous CJS resolve + compile + cache; no event loop involvement |
| `app.get(path, fn)` | Pushes a `{regexp, fn}` layer onto an in-memory array — pure data |
| `app.listen(port, cb)` | `http.createServer(app)` + `net.Server.listen()` → `uv_tcp_bind`/`uv_listen`; creates the first active, ref'd handle |
| *(script ends)* | `LoadEnvironment` returns; `SpinEventLoopInternal` starts calling `uv_run()` |
| *(idle, no clients)* | Poll phase blocks in `epoll_wait`/`kqueue` indefinitely — ~0% CPU |
| Client connects | Poll wakes on listening fd → `OnConnection` → `uv_accept` → new socket handle |
| Request bytes arrive | Poll wakes on connection fd → `parser.execute()` → `onHeadersComplete` → `'request'` → `app(req, res)` |
| Sync handler (`res.send`) | Runs to completion in the same callback; response written before control returns to `uv_run()` |
| `await somePromise` | Suspends the async function; control returns to the event loop immediately; nothing blocks |
| Promise resolves | Resumption is a microtask, drained right after the resolving callback — not a new phase |
| Idle keep-alive socket | A timer handle; firing closes the socket, which then stops counting toward `uv_loop_alive()` |
| Listening handle | Never auto-closes — this is why a server process runs forever until explicitly stopped |

Everything "Express does" reduces, at the bottom, to combinations of these same primitives — a router is a synchronous array scan, and the entire async story is just: suspend on `await`, let the loop do other work, resume on a microtask when the thing you were waiting on becomes ready.
