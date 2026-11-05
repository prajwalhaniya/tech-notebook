---
sidebar_position: 14
---

# The Node.js Runtime & Event Loop, Bottom-Up

Most explanations of "the event loop" start mid-story: a diagram of six phases, a few `setTimeout` vs `setImmediate` puzzles, done. That diagram is correct, but it skips the part that actually explains *why* it looks that way — how a `node` process boots, what `uv_run()` is actually iterating over, and what determines whether your process exits or hangs forever. This traces the whole thing from `main()` to process exit, at the level of the actual C/C++ structures involved.

---

## Table of Contents

1. [The Runtime Is Three Things, Not One](#1-the-runtime-is-three-things-not-one)
2. [Process Bootstrap: From `main()` to First Tick](#2-process-bootstrap-from-main-to-first-tick)
3. [The `uv_loop_t` — What the Loop Actually Tracks](#3-the-uv_loop_t--what-the-loop-actually-tracks)
4. [Phase by Phase: What `uv_run()` Really Does](#4-phase-by-phase-what-uv_run-really-does)
5. [The Poll Phase — Where Most of the Loop's Life Happens](#5-the-poll-phase--where-most-of-the-loops-life-happens)
6. [Ref / Unref — Why Node.js Exits When It Does](#6-ref--unref--why-nodejs-exits-when-it-does)
7. [Where Microtasks and `nextTick` Actually Drain](#7-where-microtasks-and-nexttick-actually-drain)
8. [One Process, Multiple Loops: Worker Threads](#8-one-process-multiple-loops-worker-threads)
9. [Full Lifecycle Diagram](#9-full-lifecycle-diagram)
10. [Key Source Files](#10-key-source-files)

---

## 1. The Runtime Is Three Things, Not One

"The Node.js runtime" is shorthand for three cooperating systems, each with a separate job, bolted together by Node's own C++ layer:

```
┌──────────────────────────────────────────────────────────┐
│  V8                                                       │
│  Parses and JIT-compiles JavaScript, owns the heap,        │
│  owns the Promise microtask queue                          │
├──────────────────────────────────────────────────────────┤
│  libuv                                                     │
│  Owns the event loop (uv_loop_t), timers, the thread pool,  │
│  and every OS-level I/O primitive (sockets, files, signals) │
├──────────────────────────────────────────────────────────┤
│  Node.js C++ bindings (src/)                                │
│  Environment, IsolateData — the glue that gives V8 a         │
│  handle to libuv's loop and vice versa                        │
└──────────────────────────────────────────────────────────┘
```

V8 does not know libuv exists. libuv does not know V8 exists. Neither has any built-in concept of "callback" that crosses between them. Every single async operation in Node.js — a `setTimeout`, a file read, a socket event — is Node's `Environment` class reaching into libuv to register a C callback, and that C callback reaching back into V8 to invoke a JavaScript function when it fires. "The event loop," properly speaking, is libuv's `uv_run()` function; "the runtime" is the whole three-layer sandwich that makes `uv_run()` able to produce JavaScript callbacks at all.

## 2. Process Bootstrap: From `main()` to First Tick

Nothing is running yet when `node script.js` starts. Here is the actual sequence, in order:

**1. `src/node_main.cc` — `main()`.** The OS entry point. On POSIX systems this immediately calls `node::Start(argc, argv)`.

**2. `InitializeOncePerProcess` (`src/node.cc`).** Parses CLI flags, initializes V8's platform (the thing that schedules V8's background compiler and GC threads), and — critically — calls `uv_loop_init()` to construct the **default `uv_loop_t`** that this process's main thread will run.

**3. `NewIsolate` (`src/api/environment.cc`).** Creates the V8 `Isolate` — V8's unit of an independent JS heap and execution context. Node supplies V8 with a custom `ArrayBuffer::Allocator` here, which is also what backs every `Buffer` allocation later.

**4. `CreateIsolateData` / `CreateEnvironment`.** This is the actual seam between the two worlds: `IsolateData` wraps the V8 isolate together with a *pointer to the `uv_loop_t`* created in step 2. `Environment` (one per isolate) is the object every C++ binding holds onto to reach both "the JS heap I should create values in" and "the event loop I should register this handle with" — it's why an `fs.readFile` callback in C++ can both talk to libuv *and* produce a value V8 can see.

**5. `LoadEnvironment`.** Runs Node's own internal bootstrap JavaScript (`lib/internal/bootstrap/*.js`) — this is where `require`, `process`, `Buffer`, and every global get wired up — and then loads and executes your actual entry file as a CommonJS or ES module.

**6. `SpinEventLoopInternal` (`src/api/embed_helpers.cc`).** Only now does the event loop actually start turning. Your top-level module code has already run synchronously as part of step 5 — by the time `uv_run()` is called for the first time, every `setTimeout`, every `fs.readFile`, every server's `.listen()` call from your top-level code has already registered its handle with the loop. The first thing `uv_run()` does is start processing work that was queued before the loop itself ever started.

```cpp
// src/api/embed_helpers.cc — simplified
do {
  uv_run(env->event_loop(), UV_RUN_DEFAULT);
  platform->DrainTasks(isolate);
  more = uv_loop_alive(env->event_loop());
} while (more && !env->is_stopping());
```

This is the detail that resolves a common point of confusion: **your module's top-level code is not "inside the event loop."** It runs once, synchronously, during bootstrap, before `uv_run()` is ever invoked for the first time. The event loop's job starts the moment that synchronous run finishes and there's registered work (timers, open sockets, pending I/O) left to process.

## 3. The `uv_loop_t` — What the Loop Actually Tracks

A `uv_loop_t` isn't a queue — it's a struct holding several independent data structures, one per phase, plus bookkeeping for whether the loop should keep running at all:

| Field (conceptually) | Purpose |
|---|---|
| Timer heap | A min-heap of active timers, ordered by absolute due-time |
| Pending queue | Callbacks deferred from the previous iteration (certain error completions) |
| Idle / prepare handle lists | Internal handles Node.js itself uses, run every iteration |
| I/O watcher list (`loop->watchers`) | One entry per file descriptor with a pending read/write interest, backing the poll phase |
| Check handle list | `setImmediate` callbacks |
| Closing handle list | Handles mid-teardown (`.close()` called, destructor not yet run) |
| Active handle / request counts | Incremented/decremented as handles are created, `ref()`/`unref()`'d, and closed — this is what `uv_loop_alive()` checks |

Every one of `setTimeout`, `fs.readFile`, `net.createServer().listen()`, and `setImmediate` ultimately boils down to inserting an entry into one of these structures. There is no single unified "task queue" in libuv the way there's a conceptual unified task queue in browser event loop explanations — there are several independent structures, each drained by a different, fixed phase of `uv_run()`.

## 4. Phase by Phase: What `uv_run()` Really Does

One call to `uv_run(loop, UV_RUN_DEFAULT)` is not "the event loop" — it's **one iteration**. Node.js calls it in a `do...while` loop (shown above), and `uv_run` itself internally loops through these phases once per invocation:

```
uv_run() — one iteration
┌─────────────────────────────────────────────────────────┐
│ 1. uv__update_time()         — refresh the loop's cached clock │
│ 2. uv__run_timers()          — fire due timers from the heap    │
│ 3. uv__run_pending()         — fire deferred I/O error callbacks │
│ 4. uv__run_idle()            — internal idle handles             │
│ 5. uv__run_prepare()         — internal prepare handles          │
│ 6. uv__io_poll(timeout)      — BLOCK here waiting for I/O         │
│ 7. uv__run_check()           — setImmediate callbacks             │
│ 8. uv__run_closing_handles() — handles that had .close() called   │
└─────────────────────────────────────────────────────────┘
```

**`uv__run_timers()`.** Walks the timer min-heap from the smallest due-time upward, firing every timer whose due-time is `<= now`, then re-inserts repeating timers (`setInterval`) back into the heap at their next due-time. A `setTimeout(fn, 0)` doesn't mean "run immediately" — it means "insert into the heap with due-time equal to now," which still has to wait for this phase to be reached in the current or a future iteration.

**`uv__run_pending()`.** Handles a specific, narrow case: certain I/O operations complete with an error synchronously (e.g., a TCP connect that's refused immediately) but libuv still defers their callback to the *next* iteration's pending phase rather than firing immediately, to guarantee callbacks are always asynchronous relative to the calling code — one of libuv's core design guarantees ("never call back before you return").

**`uv__run_idle()` / `uv__run_prepare()`.** Internal-use handles. Node.js itself uses an idle handle for a small number of internal mechanisms. These run on *every single iteration* that has at least one active idle/prepare handle — which is also, incidentally, a classic way to accidentally keep a process alive forever if you ever register one of these from a native addon and forget to unref it.

**`uv__run_check()`.** Fires every pending `setImmediate` callback. Because `setImmediate` is designed specifically to run "right after the current poll phase completes," placing it after poll and before the next iteration's timer phase gives it a very specific, predictable ordering relative to I/O callbacks — this is exactly why `setImmediate` registered inside an I/O callback reliably fires before any `setTimeout(fn, 0)` registered in that same callback: poll just finished, check runs next, timers won't run again until the following iteration.

**`uv__run_closing_handles()`.** Runs the close callback (`socket.on('close', ...)`, a file descriptor's final cleanup) for every handle that had `.close()` called on it since the last time this phase ran. This is deliberately the *last* phase — it lets every other phase in the same iteration still reference a handle that's being torn down, before its memory is actually freed.

## 5. The Poll Phase — Where Most of the Loop's Life Happens

The poll phase (`uv__io_poll`) is where a Node.js process spends almost all of its idle time, and it's the one phase whose behavior is a deliberate calculation, not a fixed step. Before blocking, libuv computes a **timeout** for how long the OS-level poll syscall (`epoll_wait` on Linux, `kqueue` on macOS/BSD, IOCP on Windows) is allowed to block:

- **0** — don't block at all — if there are already `setImmediate` callbacks queued (check phase has work waiting) or the loop is in `UV_RUN_NOWAIT` mode.
- **Time until the next timer is due** — if there's at least one active timer in the heap, block for at most that long, so the loop wakes up in time to run `uv__run_timers()` on the next iteration even if no I/O ever arrives.
- **Infinite (block forever)** — if there are no timers and no immediates, the loop simply sleeps until the OS reports that *some* registered file descriptor has become readable/writable/errored, or until a signal interrupts it.

This is the mechanical reason a Node.js process with an open server and nothing else to do uses roughly 0% CPU at idle: it isn't spinning in a loop checking anything — it's genuinely blocked inside a kernel syscall, and the kernel itself wakes the process only when there's real work (a new connection, inbound data) or a timer is actually due. "Non-blocking I/O" describes your JavaScript's perspective; underneath, the poll phase blocks very deliberately — that's what makes it efficient rather than a busy-wait.

When `epoll_wait`/`kqueue` returns, it hands back the list of file descriptors that are ready, and libuv invokes each one's registered I/O watcher callback — this is the point where, for example, a readable TCP socket's data actually gets copied into a buffer and the chain that eventually fires your `socket.on('data', ...)` handler begins.

## 6. Ref / Unref — Why Node.js Exits When It Does

After every `uv_run()` iteration, Node checks `uv_loop_alive(loop)` — true if the loop has any **active and referenced** handles or pending requests. If it's false, the `do...while` in `SpinEventLoopInternal` exits, `EmitProcessBeforeExit` fires `process.on('beforeExit')`, and (if still nothing is pending) the process actually exits. This single counter is the entire answer to "why does my script exit here" or "why does it hang forever."

Every handle — a timer, an open socket, a file watcher — is **referenced** by default, meaning it counts toward keeping the loop alive. Calling `.unref()` on it flips that bit without canceling the handle itself:

```js
const timer = setInterval(() => console.log('tick'), 1000);
timer.unref();
```

This timer still fires every second if the process happens to be alive for other reasons, but its existence alone will never prevent the process from exiting — exactly the pattern used internally for things like a keep-alive socket's idle timer, which shouldn't by itself keep an otherwise-finished CLI tool running. `process.exit()` bypasses all of this by force-terminating regardless of what's still referenced and active — which is also why it can truncate in-flight writes (like a `console.log` to a non-TTY stdout, which is sometimes asynchronous) if called carelessly.

## 7. Where Microtasks and `nextTick` Actually Drain

The phase diagram in §4 is accurate for libuv's phases, but it understates how often V8's microtask queue and Node's `process.nextTick` queue actually get a chance to run. They don't just drain *between phases* — they drain **after every single JavaScript callback Node.js invokes**, via the C++ `InternalCallbackScope` / `MakeCallback` machinery every binding uses to re-enter JS. Concretely: a timer fires, its JS callback runs, and before libuv moves on to the *next* timer in the same `uv__run_timers()` pass, the entire `nextTick` queue and then the entire microtask queue are drained — not just once at the phase boundary.

This is why a `process.nextTick` call inside one timer callback runs before a second, already-due timer callback in the same phase — the granularity of "flush nextTick and microtasks" is per-callback, not per-phase. It's also the mechanism behind a real production failure mode: a function that recursively re-schedules itself via `process.nextTick` runs to completion (starving the event loop, since libuv's phases never get a chance to proceed) precisely because this drain happens before control is ever handed back to `uv_run()`.

## 8. One Process, Multiple Loops: Worker Threads

Everything above describes the **main thread's** `uv_loop_t`. A `Worker` (`worker_threads`) is not a callback scheduled onto the main loop — it's an entirely separate OS thread running its *own* `Environment`, its own V8 isolate, and its own independent `uv_loop_t`, going through the exact same bootstrap-to-`uv_run`-to-exit lifecycle described in §2, just without a `main()` of its own (`src/node_worker.cc` drives it instead). This is why a worker thread genuinely doesn't block the main thread's event loop even during heavy synchronous JS execution — it isn't sharing the loop at all, it has a complete, independent one. Communication between them (`postMessage`) crosses via a thread-safe queue that wakes the receiving loop's poll phase, not by touching the other thread's data structures directly.

`cluster` works differently again — it's multiple **separate processes**, each with its own fully independent runtime (its own `main()`, its own everything), coordinated only by the primary process sharing the listening socket's file descriptor across them at the OS level.

## 9. Full Lifecycle Diagram

```
main() → InitializeOncePerProcess → uv_loop_init()
                                          │
                              NewIsolate (V8)
                                          │
                         CreateEnvironment (binds isolate ↔ uv_loop_t)
                                          │
                     LoadEnvironment — runs your top-level module code
                              (every setTimeout/listen/readFile here
                               just registers a handle — nothing fires yet)
                                          │
                                          ▼
                 ┌──────────────────────────────────────────┐
                 │   SpinEventLoopInternal: repeat           │
                 │                                           │
                 │   uv_run(loop, UV_RUN_DEFAULT) one pass:  │
                 │     timers → pending → idle/prepare       │
                 │     → POLL (blocks here) → check → close  │
                 │                                           │
                 │   after every JS callback inside any      │
                 │   phase: drain nextTick, drain microtasks │
                 │                                           │
                 │   uv_loop_alive(loop)?                    │
                 └──────────────────┬────────────────────────┘
                          yes ──────┘           │ no
                                                 ▼
                                   EmitProcessBeforeExit
                                                 │
                                   still nothing active/ref'd?
                                                 │
                                                 ▼
                                         process exits
```

## 10. Key Source Files

| Path | Role |
|---|---|
| `src/node_main.cc` | OS process entry point, calls `node::Start` |
| `src/node.cc` | `InitializeOncePerProcess`, `uv_loop_init()` |
| `src/api/environment.cc` | `NewIsolate`, `CreateIsolateData`, `CreateEnvironment` |
| `src/env.h` / `src/env.cc` | The `Environment` class — the JS↔libuv glue every binding uses |
| `src/api/embed_helpers.cc` | `SpinEventLoopInternal` — the outer `do...while` around `uv_run()` |
| `deps/uv/src/unix/core.c` | `uv_run()` and the phase sequencing itself |
| `deps/uv/src/timer.c` | The timer min-heap, `uv__run_timers` |
| `deps/uv/src/unix/linux.c` | `uv__io_poll` on Linux — the `epoll_wait` integration |
| `deps/uv/src/unix/kqueue.c` | `uv__io_poll` on macOS/BSD |
| `src/node_worker.cc` | Worker thread bootstrap — a second, independent runtime per thread |
| `lib/internal/process/task_queues.js` | `process.nextTick` queue and its drain scheduling |

---

Every piece of conventional event-loop advice — "don't block the loop," "unref timers you don't need," "setImmediate runs after I/O" — is a direct, mechanical consequence of the structures described above: a single-threaded poll syscall that blocks real OS time, a timer min-heap checked once per iteration, a reference count that decides whether the process is allowed to die, and a drain step that runs after every callback rather than at fixed checkpoints. The six-phase diagram is the right mental model to keep day to day — but it's a summary of this machinery, not a replacement for understanding it.
