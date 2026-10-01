---
sidebar_position: 1
---

# Introduction

A deep-dive reference into how Node.js works under the hood — from source code in the [nodejs/node](https://github.com/nodejs/node) repository. Each guide traces a specific subsystem from user-facing JavaScript APIs down through C++ bindings, libuv, and V8.

---

## Architecture Overview

Node.js is built on three collaborating layers:

```
┌─────────────────────────────────────────────────────────────┐
│  JavaScript Layer                                           │
│  Your code · Node.js stdlib · async/await · Promises        │
├─────────────────────────────────────────────────────────────┤
│  Node.js C++ Bindings  (src/)                               │
│  AsyncWrap · node_file.cc · node_task_queue.cc · env.cc     │
├─────────────────────────────────────────────────────────────┤
│  V8 Engine                          libuv                   │
│  JIT compilation · microtasks       Event loop · I/O        │
└─────────────────────────────────────────────────────────────┘
```

- **libuv** owns the event loop and all OS-level I/O, timers, and the thread pool.
- **V8** compiles and executes JavaScript, and manages the Promise microtask queue.
- **Node.js C++ bindings** (`src/`) bridge V8 and libuv — adding async resource tracking, context propagation, and the binding APIs exposed to `lib/`.
- **Node.js standard library** (`lib/`) implements the user-facing modules (`fs`, `http`, `crypto`, `stream`, etc.) in JavaScript on top of those bindings.

The source code for everything discussed in these guides lives at [github.com/nodejs/node](https://github.com/nodejs/node).

---

## How the Event Loop Runs

The entry point is `src/api/embed_helpers.cc`. `SpinEventLoopInternal()` calls `uv_run()` in a loop until there is nothing left to do:

```
┌─────────────────────────────────┐
│           timers                │  setTimeout / setInterval
├─────────────────────────────────┤
│       pending callbacks         │  deferred I/O from prior iteration
├─────────────────────────────────┤
│      idle / prepare             │  internal
├─────────────────────────────────┤
│            poll                 │  block and wait for I/O events
├─────────────────────────────────┤
│            check                │  setImmediate callbacks
├─────────────────────────────────┤
│        close callbacks          │  socket.on('close'), etc.
└─────────────────────────────────┘
```

Between every phase, Node.js flushes:
1. `process.nextTick` queue (all of it, in order)
2. Promise microtask queue (all pending `.then()` continuations)

This ordering — nextTick → microtasks → libuv phase — is fundamental to understanding all async behavior in Node.js.

---

## Source Layout

The key directories in [nodejs/node](https://github.com/nodejs/node):

| Path | Contents |
|---|---|
| `lib/` | JavaScript standard library (`fs.js`, `http.js`, `stream.js`, `timers.js`, ...) |
| `lib/internal/` | Internal JS modules not exposed directly to user code |
| `lib/internal/modules/cjs/` | CommonJS loader (`loader.js`, `resolve.js`) |
| `lib/internal/modules/esm/` | ESM loader (`loader.js`, `translators.js`, `resolve.js`) |
| `lib/internal/streams/` | Streams internals (`readable.js`, `writable.js`, `pipeline.js`) |
| `src/` | C++ source — bindings, env, async hooks, node_file, task queue |
| `src/api/` | Embedding API — `embed_helpers.cc` (SpinEventLoop) |
| `deps/uv/` | libuv — the cross-platform async I/O library |
| `deps/v8/` | V8 JavaScript engine |

---

## Guides in This Section

### Async Internals

How async code actually runs — tracing the full path from `setTimeout` to `async/await` through the C++ async context stack.

**Covers:**
- The event loop entry point (`src/api/embed_helpers.cc`)
- The async ID system — `async_id_fields`, `async_hook_fields` typed arrays shared between JS and C++
- `AsyncHook` class, hook emission, and the `callbackTrampoline` hot path (`lib/async_hooks.js`, `lib/internal/async_hooks.js`)
- `push_async_context` / `pop_async_context` in `src/env.cc`
- How `async/await` compiles to a Promise state machine in V8
- Promise hooks and rejection tracking (`src/node_task_queue.cc`)
- `process.nextTick` vs microtasks vs `setImmediate`
- Timers data structure: `timerListMap` + `PriorityQueue` + linked list (`lib/internal/timers.js`)
- `AsyncContextFrame` and `AsyncLocalStorage` — context preservation across `await` (`lib/internal/async_context_frame.js`)

---

### Module Loading

How `require()` and `import` work — from filename resolution to V8 compilation to the module cache.

**Covers:**
- CommonJS vs ESM: two separate loaders, two separate graphs
- The module wrapper function that gives every CJS file its own `require`, `module`, `exports`, `__dirname`, `__filename`
- `Module._load()` and the two-level cache (`relativeResolveCache` + `Module._cache`)
- The `node_modules` walk — how Node resolves relative and bare specifiers
- CJS circular dependency handling (partial exports)
- ESM's four phases: Parse → Instantiate → Link → Evaluate
- ESM `package.json` `exports` field — subpath patterns, conditional exports, `imports` maps
- `ModuleJob` and `ModuleWrap` — the bridge between Node's loader and V8's native module graph
- ESM translators — how `.js`, `.cjs`, `.mjs`, `.json`, and `.node` files are each translated into ESM
- CJS ↔ ESM interop and the `require(esm)` path
- Custom loader hooks (`--import`, `--loader`)

---

### Performance

The Node.js internals that directly determine throughput, latency, and memory — with source references and actionable engineering rules.

**Covers:**
- Event loop phases and what blocks them (`src/api/embed_helpers.cc`)
- Task queue ordering — nextTick, microtasks, setImmediate (`lib/internal/process/task_queues.js`)
- V8 compilation pipeline: Ignition → Maglev → TurboFan
- Hidden classes and shape stability — why object shape matters for JIT optimization
- Buffer pool — the 8KB pre-allocated pool, `allocUnsafe` vs `alloc` (`lib/buffer.js`)
- Streams backpressure — `highWaterMark`, `write()` returning `false`, `pipeline()` (`lib/internal/streams/`)
- The libuv thread pool — what uses it, the default size of 4, and `UV_THREADPOOL_SIZE`
- Cluster vs Worker Threads — when to use each, and how to transfer `ArrayBuffer` at zero cost
- HTTP/1.1 keep-alive, `Agent` configuration, null-prototype header objects
- HTTP/2 multiplexing, HPACK compression, flow control
- `dns.lookup()` vs `dns.resolve()` — thread pool implications
- V8 heap spaces (young/old/large object), GC pauses, `external_memory` for Buffers
- `perf_hooks` — event loop delay histogram, event loop utilization, custom marks/measures

---

### File System (fs)

A bottom-up walkthrough of the `fs` module — from `fs.readFile()` in JavaScript down to libuv and back.

**Covers:**
- The four-layer architecture: user code → `lib/fs.js` → `src/node_file.cc` → libuv
- `FSReqCallback` — the C++ async bridge that carries the JS callback across the thread pool (`src/node_file.h`)
- `ReadFileContext` — the internal state machine that reads a file in chunks with successive `read()` calls (`lib/internal/fs/read/context.js`)
- `AsyncCall` vs `SyncCall` — how the same C++ operation switches between async and sync paths (`src/node_file-inl.h`)
- The Promise API — `FileHandle`, `fs.promises`, and how it wraps `FSReqCallback` without doubling allocations (`lib/internal/fs/promises.js`)
- `stat()` — how `StatWatcher` reuses a single `uv_stat_t` across repeated calls
- How libuv executes `fs` operations: `uv__fs_work()` on a thread pool thread, `uv__fs_done()` back on the event loop
- `fs.createReadStream` / `fs.createWriteStream` — how they use `ReadableStream` and manage `fd` lifecycle
- `fs.watch()` — `FSWatcher`, `inotify` on Linux, `kqueue` on macOS, `ReadDirectoryChangesW` on Windows
- Key constants: `O_RDONLY`, `O_WRONLY`, `O_CREAT`, `COPYFILE_FICLONE`, and the `UV_FS_*` request types

---

### HTTP Request Lifecycle

A bottom-up trace of a single HTTP request — from the kernel's TCP accept queue through libuv, the llhttp parser, and the `http` module's JavaScript layer, to the response hitting the wire.

**Covers:**
- The TCP accept path — `uv_listen()`, `OnConnection`, `TCPWrap` (`src/tcp_wrap.cc`)
- llhttp — the generated HTTP/1.x parser state machine (`deps/llhttp/`, `src/node_http_parser.cc`)
- The parser `FreeList` pool that reuses `HTTPParser` instances across connections (`lib/_http_common.js`)
- How `onHeadersComplete` constructs `IncomingMessage` and fires the server's `'request'` event before the body has fully arrived
- `IncomingMessage` as a push-based Readable stream (`lib/_http_incoming.js`)
- `ServerResponse` / `OutgoingMessage` — header flushing on first `write()`, chunked vs `Content-Length` framing (`lib/_http_outgoing.js`)
- Keep-alive: parser and socket reuse across requests, `server.keepAliveTimeout`, and the load-balancer idle-timeout mismatch that causes sporadic 502s
- Backpressure on both the request body and the response write path
- What changes under HTTP/2 — multiplexed streams, HPACK, per-stream flow control (`lib/internal/http2/core.js`)
- How `cluster` distributes connections from one shared listen socket across worker processes

---

## Reading the Source

All code references in these guides use the format `path/to/file.js:line_number`. To follow along:

1. Clone the repo: `git clone https://github.com/nodejs/node`
2. Check out a release tag (e.g. `git checkout v22.0.0`) to pin to a known version
3. Use `grep -n` or your editor's symbol search to navigate to the referenced lines

The guides reference line numbers from the main branch at time of writing. Line numbers shift between releases but function names and file paths remain stable.

---

## Key Concepts Across All Guides

| Concept | Where it lives | Why it matters |
|---|---|---|
| `uv_run()` / event loop | `src/api/embed_helpers.cc` | The outermost loop that keeps Node running |
| `async_id_fields` TypedArray | `lib/internal/async_hooks.js` | Zero-cost JS/C++ shared state for async tracking |
| `push/pop_async_context` | `src/env.cc` | Maintains correct `executionAsyncId` across callbacks |
| `callbackTrampoline` | `lib/internal/async_hooks.js` | Hot path for every I/O callback — fires before/after hooks |
| `AsyncContextFrame` | `lib/internal/async_context_frame.js` | Preserves `AsyncLocalStorage` values across `await` |
| `FSReqCallback` | `src/node_file.h` | Bridges JS fs callbacks through the C++ layer to libuv |
| `Module._cache` | `lib/internal/modules/cjs/loader.js` | Ensures each module is compiled and executed only once |
| `highWaterMark` | `lib/internal/streams/state.js` | The backpressure threshold for all streams |
| `UV_THREADPOOL_SIZE` | libuv / env var | Controls how many blocking operations can run concurrently |
| `HTTPParser` (llhttp) | `src/node_http_parser.cc`, `deps/llhttp/` | Turns raw socket bytes into request/response events |
| Parser `FreeList` | `lib/_http_common.js` | Reuses `HTTPParser` instances across keep-alive connections |
