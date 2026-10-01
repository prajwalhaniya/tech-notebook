---
sidebar_position: 13
---

# HTTP Request Lifecycle

A bottom-up trace of what happens between a client opening a TCP connection and a Node.js server sending back bytes — from the kernel's accept queue, through libuv, through the HTTP parser, into the `http` module's JavaScript layer, and back out.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The TCP Layer — Accepting Connections](#2-the-tcp-layer--accepting-connections)
3. [The HTTP Parser — llhttp](#3-the-http-parser--llhttp)
4. [From Socket Bytes to `IncomingMessage`](#4-from-socket-bytes-to-incomingmessage)
5. [`lib/_http_server.js` — The Connection Listener](#5-lib_http_serverjs--the-connection-listener)
6. [`IncomingMessage` — A Readable Stream Over the Socket](#6-incomingmessage--a-readable-stream-over-the-socket)
7. [Routing to User Code — the `'request'` Event](#7-routing-to-user-code--the-request-event)
8. [`ServerResponse` — Writing the Response](#8-serverresponse--writing-the-response)
9. [Keep-Alive, Parser Reuse, and the Socket Pool](#9-keep-alive-parser-reuse-and-the-socket-pool)
10. [Backpressure in the Request/Response Path](#10-backpressure-in-the-requestresponse-path)
11. [Pipelining](#11-pipelining)
12. [HTTP/2: What Changes](#12-http2-what-changes)
13. [Multi-Core: Cluster and the Shared Listen Socket](#13-multi-core-cluster-and-the-shared-listen-socket)
14. [Full Call Flow Diagram](#14-full-call-flow-diagram)
15. [Key Source Files](#15-key-source-files)

---

## 1. Architecture Overview

A single HTTP request crosses five layers before your route handler ever runs:

```
┌──────────────────────────────────────────────────────────┐
│  Kernel                                                  │
│  TCP accept queue (SYN/ACK handshake, backlog)           │
├──────────────────────────────────────────────────────────┤
│  libuv                                                   │
│  uv_tcp_t — epoll/kqueue/IOCP readiness, uv_accept       │
├──────────────────────────────────────────────────────────┤
│  Node.js C++ bindings (src/)                             │
│  TCPWrap, StreamBase — bridges libuv sockets to JS       │
├──────────────────────────────────────────────────────────┤
│  Node.js JS layer (lib/)                                 │
│  net.Server → http.Server → HTTPParser (llhttp binding)  │
│  IncomingMessage / ServerResponse (Readable / Writable)  │
├──────────────────────────────────────────────────────────┤
│  User code                                               │
│  server.on('request', (req, res) => { ... })             │
└──────────────────────────────────────────────────────────┘
```

Two separate parsing problems happen here, and conflating them is the most common source of confusion:

1. **TCP** has no concept of a "request" — it's a byte stream. `net.Server` just hands you connected sockets.
2. **HTTP** is a text protocol layered on top of that byte stream. The `http` module owns a parser (llhttp) that turns raw bytes into discrete request/response events, and wraps the raw socket in two higher-level streams: `IncomingMessage` (readable) and `ServerResponse` (writable).

Everything below follows one request through all five layers.

---

## 2. The TCP Layer — Accepting Connections

`http.createServer()` returns an instance of `http.Server`, which extends `net.Server`. Calling `.listen(port)` ultimately calls down into `net.Server.prototype.listen`, which:

1. Creates a `TCP` handle (`src/tcp_wrap.cc`, wrapping `uv_tcp_t`).
2. Calls `uv_tcp_bind()` then `uv_listen()`, passing a backlog size (default 511, tunable via the `backlog` option).
3. Registers a C++ callback (`OnConnection`) that libuv invokes whenever the kernel's accept queue has a completed connection ready.

The kernel does the actual TCP handshake (SYN, SYN-ACK, ACK) entirely outside of Node.js, in the OS network stack. By the time libuv's `OnConnection` fires, the three-way handshake is already done — the connection is sitting in the accept queue waiting to be dequeued with `accept()`.

```
Client                    Kernel accept queue              Node.js (libuv)
  │  SYN           ──────▶  queued                                │
  │  ◀────── SYN-ACK                                               │
  │  ACK           ──────▶  connection ready  ────▶ OnConnection() fires
```

`OnConnection` calls `uv_accept()` to dequeue the socket, wraps it in a new `TCPWrap`/`TCP` handle, and emits a JavaScript `'connection'` event on the `net.Server` instance with a `net.Socket` object. At this point, Node.js has a raw, protocol-agnostic duplex stream — no HTTP has been parsed yet.

---

## 3. The HTTP Parser — llhttp

Since Node.js 12, HTTP parsing is done by **llhttp**, a parser generated from a formal state-machine specification and compiled to C, replacing the older hand-written `http_parser.c`. It lives in `deps/llhttp/` and is exposed to JavaScript through the C++ binding in `src/node_http_parser.cc`.

The JavaScript side never sees raw HTTP text directly. Instead, it holds a `HTTPParser` object (from `internalBinding('http_parser')`) and:

- Sets a handful of JS callback properties on it: `onHeaders`, `onHeadersComplete`, `onBody`, `onMessageComplete`.
- Feeds it raw `Buffer` chunks via `parser.execute(buffer)` as they arrive from the socket's `'data'` event.
- llhttp parses incrementally, byte by byte, calling back into the registered C++ handlers, which translate into the JS callbacks above — synchronously, within the same `execute()` call.

This incremental design matters: llhttp does not wait for the full request to buffer in memory before producing events. Headers can be parsed and delivered before the body has even arrived (important for streaming uploads), and `execute()` returns as soon as the available bytes are consumed.

**Parser pooling.** Creating an `HTTPParser` instance has a real cost (it allocates internal llhttp state). `lib/_http_common.js` maintains a `FreeList` of parser instances — when a connection closes, its parser is reset and returned to the pool (`freeParser`) rather than discarded, and the next incoming connection reuses one (`parsers.pop()`) instead of constructing a new one. This is one of the oldest and most effective micro-optimizations in the `http` module.

---

## 4. From Socket Bytes to `IncomingMessage`

Once a socket is accepted, `lib/_http_server.js`'s connection handling wires the parser to the socket:

```
socket.on('data', chunk => {
  const ret = parser.execute(chunk);
});
```

(Simplified — the real path goes through `StreamBase`'s internal read mechanics rather than a literal `'data'` listener, but the effect is the same: every chunk of bytes read off the socket is immediately handed to `parser.execute()`.)

As llhttp recognizes structure in the byte stream, it fires, in order, for a single request:

| Callback | Fires when | What it does |
|---|---|---|
| `onHeaders` | Header lines parsed (may fire multiple times for large header blocks) | Accumulates raw header key/value pairs |
| `onHeadersComplete` | The blank line after headers (`\r\n\r\n`) is reached | Constructs the `IncomingMessage` object, sets `method`, `url`, `httpVersion`, `headers`; returns it to the parser |
| `onBody` | A chunk of the request body is available | Pushes the chunk into the `IncomingMessage`'s internal readable buffer |
| `onMessageComplete` | The full message (headers + body, respecting `Content-Length` or chunked terminator) is parsed | Marks the `IncomingMessage` stream as ended (`push(null)`) |

`onHeadersComplete` is the pivotal moment — this is where the `http.Server` emits its `'request'` event, handing your route handler a live `IncomingMessage` whose body may not have fully arrived yet. That's why reading `req` as a stream (rather than assuming the body is already buffered) is the correct model: the body can literally still be in flight on the wire while your handler is already running.

---

## 5. `lib/_http_server.js` — The Connection Listener

`http.Server` adds its own `'connection'` listener (set up once, in the constructor) on top of `net.Server`. For every accepted socket, this listener:

1. Pulls a parser from the `FreeList` pool (or creates one).
2. Attaches the four llhttp callbacks described above, closing over `socket` and `server`.
3. Sets the parser's `socket` reference and the socket's `parser` reference (bidirectional, for cleanup on either side).
4. Applies the server's header/timeout limits — `maxHeadersCount`, `headersTimeout`, `requestTimeout` — as parser/socket-level guards. Exceeding `maxHeaderSize` (default 16KB, flag `--max-http-header-size`) aborts the parse and destroys the socket before user code ever runs, as a defense against header-based memory exhaustion attacks.
5. Starts the socket's read stream — data begins flowing through `parser.execute()`.

This is also where the server distinguishes between a fresh connection and a reused keep-alive connection: the same socket and the same parser object keep processing requests in a loop as long as both sides keep the connection open.

---

## 6. `IncomingMessage` — A Readable Stream Over the Socket

`IncomingMessage` (`lib/_http_incoming.js`) extends `stream.Readable`. Critically, it does **not** read from the socket itself on a pull — it is *pushed into* by the parser's `onBody` callback as bytes arrive. This is the "push stream wrapped as a Readable" pattern: `_read()` is effectively a no-op (there's nothing to actively pull; data arrives whenever the parser produces it), and the stream's internal buffer absorbs chunks via `push(chunk)` until the consumer catches up.

Properties populated by `onHeadersComplete` before your handler sees `req`:

- `req.method`, `req.url`, `req.httpVersion`
- `req.headers` — a plain object with lower-cased keys (HTTP header names are case-insensitive; Node.js normalizes them); duplicate headers are joined with `, ` except a known set — `set-cookie` becomes an array, and a few others follow special-casing per RFC 7230.
- `req.rawHeaders` — the flat array of headers exactly as received, preserving original casing and order, for cases where you need the wire-exact representation.
- `req.socket` — the underlying `net.Socket`, for things like `req.socket.remoteAddress`.

The body is *not* available as a property. You consume it the same way you'd consume any readable stream:

```js
let body = [];
req.on('data', chunk => body.push(chunk));
req.on('end', () => {
  const full = Buffer.concat(body);
});
```

Or, more commonly today, by piping it directly into something else (a file, a parser, a hashing stream) without ever buffering it fully in memory — the entire reason `IncomingMessage` is a stream and not a pre-buffered object.

---

## 7. Routing to User Code — the `'request'` Event

`onHeadersComplete` calls into `server.emit('request', req, res)`. This is the single integration point every framework (Express, Koa, Fastify, Nest) hooks into — `app.listen()` in Express is, at the bottom, still `http.createServer(app).listen(...)`, where `app` itself is just a function passed as (or wired up to) the `'request'` listener.

Node.js constructs `res` (a `ServerResponse`) at the same moment, *before* calling your handler, and passes both to every `'request'` listener. If there are zero listeners, Node.js has no default behavior for unhandled requests — the connection will simply hang until a timeout fires, which is why every raw `http.createServer()` example you've seen always registers a handler immediately.

---

## 8. `ServerResponse` — Writing the Response

`ServerResponse` (`lib/_http_outgoing.js` provides the shared base `OutgoingMessage`, specialized by `lib/_http_server.js`) extends `stream.Writable`. Three things happen when you call its methods:

**`res.writeHead(statusCode, headers)`** — Serializes the status line and headers into a buffer, but does *not* send anything yet. Headers are held back so you can still set/overwrite them (via `res.setHeader()`) until the first byte of the body is actually flushed.

**`res.write(chunk)`** — On the *first* call, this is the trigger that actually flushes the status line and headers onto the socket, immediately followed by the chunk. Node.js decides between two body-framing strategies at this point:

- If `Content-Length` was explicitly set, it writes exactly that many bytes and expects you to match it.
- Otherwise, it switches to **chunked transfer encoding** (`Transfer-Encoding: chunked`), writing each `write()` call as a length-prefixed chunk (`<hex-length>\r\n<data>\r\n`), because the total size isn't known up front.

**`res.end()`** — Writes the final chunk (an empty `0\r\n\r\n` terminator if chunked), then either closes the socket or, for keep-alive, returns the socket to be reused for the next request on the same connection.

```js
res.writeHead(200, { 'Content-Type': 'application/json' });
res.write(JSON.stringify({ ok: true }));
res.end();
```

Each `write()` call travels: `ServerResponse` (Writable) → underlying `net.Socket` (also a Writable/Duplex) → `StreamBase::DoWrite` in C++ → `uv_write()` → a non-blocking `write(2)`/`WriteFile()` syscall. If the kernel's socket send buffer is full, `uv_write()` queues the write and the socket stream applies backpressure (see §10) rather than blocking the event loop.

---

## 9. Keep-Alive, Parser Reuse, and the Socket Pool

HTTP/1.1 defaults to persistent connections (`Connection: keep-alive`). After `onMessageComplete` fires for one request and the response finishes, the server does **not** close the socket. Instead:

1. The same `net.Socket` stays open.
2. The same `HTTPParser` instance (still attached to that socket) is reset (`parser.reinitialize()` equivalent) and waits for the next request's bytes.
3. A keep-alive timer (`server.keepAliveTimeout`, default 5000ms) starts — if no new request arrives before it fires, the server sends `FIN` and tears down the socket (and *then* the parser is returned to the free-list pool).

This is why `server.keepAliveTimeout` exists as a tunable: too short, and you pay a full TCP+TLS handshake for every request from a client that would have reused the connection; too long, and idle sockets pin memory and file descriptors. (Famous gotcha: when Node.js sits behind a load balancer like ALB, the load balancer's idle timeout must be *shorter* than Node's `keepAliveTimeout`, or the LB can send a request down a connection Node has already started closing — a classic source of sporadic `502`s.)

On the client side, `http.Agent` maintains its own pool of sockets per host, reusing keep-alive connections for outbound requests the same way — `maxSockets` and `maxFreeSockets` bound that pool.

---

## 10. Backpressure in the Request/Response Path

Both halves of the exchange are real streams, so both halves respect backpressure:

- **Reading the request body**: if your handler pipes `req` into a slow destination (e.g. writing to disk), `IncomingMessage` will stop emitting `'data'` once the destination signals it can't keep up — but note the *parser* has already pulled those bytes off the socket into the stream's internal buffer. Extremely large, slow-to-consume request bodies without a `Content-Length`/size guard can still grow that buffer; this is why reverse proxies and app servers alike enforce a max body size.
- **Writing the response**: `res.write(chunk)` returns `false` when the underlying socket's write buffer has exceeded `highWaterMark`. A correct producer pauses until `'drain'` fires:

```js
function sendChunks(res, chunks, i = 0) {
  if (i === chunks.length) return res.end();
  const ok = res.write(chunks[i]);
  if (ok) return sendChunks(res, chunks, i + 1);
  res.once('drain', () => sendChunks(res, chunks, i + 1));
}
```

Ignoring the `false` return value and calling `write()` in a tight loop regardless (a very common bug) defeats backpressure entirely — Node.js will keep buffering in process memory, since it has no way to stop you from calling `write()` again. For most cases, `stream.pipeline(source, res, callback)` is the correct tool, since it wires up pause/resume and error propagation automatically instead of hand-rolling the check above.

---

## 11. Pipelining

HTTP/1.1 technically allows a client to send multiple requests back-to-back on the same connection *without* waiting for each response (pipelining) — but responses must still come back in the same order they were requested. Node.js's parser will happily parse pipelined requests (each triggers its own `onHeadersComplete` → `'request'` event on the same socket), but because almost no modern client pipelines by default (the ordering constraint makes it fragile with intermediaries), this path is rarely exercised in practice. It's effectively superseded by HTTP/2 multiplexing, which solves the same problem — more than one request in flight per connection — without head-of-line ordering constraints.

---

## 12. HTTP/2: What Changes

`http2.createServer()` (`lib/internal/http2/core.js`) replaces the TCP-stream-of-bytes-plus-text-parser model with a binary framing layer:

- **Multiplexing**: many logical requests ("streams" in HTTP/2 terms, unrelated to Node.js `stream.Readable`) share a single TCP connection concurrently, each identified by a stream ID in every frame — no head-of-line blocking at the HTTP layer.
- **HPACK header compression**: headers are compressed against a dynamic table shared for the connection's lifetime, instead of being sent as plain text on every request.
- **Binary framing** replaces llhttp's text parsing — a `Http2Session` demultiplexes incoming frames and dispatches each to its corresponding `Http2Stream`, which Node.js then exposes to user code as a `request`/`response` pair with an API intentionally shaped to resemble HTTP/1's `IncomingMessage`/`ServerResponse` (or, in compatibility mode, literally reuses those classes).
- Flow control happens per-stream *and* per-connection, each with its own window — a second, finer-grained layer of backpressure beyond what TCP alone provides.

The request lifecycle conceptually mirrors HTTP/1 (headers event → body chunks → end), but the wire format and connection-sharing model are entirely different.

---

## 13. Multi-Core: Cluster and the Shared Listen Socket

A single Node.js process uses one thread for JavaScript execution, so one process handles requests on one CPU core. `cluster.fork()` (covered in depth in the [Concurrency guide](./concurrency.md)) works by having the primary process create the listening TCP handle and share it with worker processes; the OS/libuv then distributes incoming connections across workers (round-robin by default on most platforms via `SCHEDULING_POLICY`). Each worker runs its own independent `http.Server`, its own parser pool, its own event loop — the request lifecycle described above happens identically and independently inside whichever worker the kernel/libuv handed the connection to.

---

## 14. Full Call Flow Diagram

```
  Client                  Kernel           libuv                 Node.js JS layer
  │                       │                │                     │
  │── TCP handshake ──▶   │                │                     │
  │                       │── ready ──▶    │OnConnection() fires │
  │                       │                │── uv_accept() ──▶   │net.Socket created
  │                       │                │                     │http.Server emits 'connection'
  │                       │                │                     │parser ← FreeList pool
  │                       │                │                     │
  │── GET / HTTP/1.1 ──▶  │── readable ──▶ │uv_read_cb fires     │
  │   Host: ...           │                │── chunk ──▶         │parser.execute(chunk)
  │   \r\n\r\n            │                │                     │  → onHeadersComplete
  │                       │                │                     │  → new IncomingMessage
  │                       │                │                     │  → server.emit('request', req, res)
  │                       │                │                     │
  │                       │                │                     │user handler runs
  │                       │                │                     │res.writeHead(200, {...})
  │                       │                │                     │res.end('hello')
  │                       │                │◀── uv_write() ──    │OutgoingMessage flush
  │                       │◀── send(2) ──  │◀── write(2) ──      │
  │◀── HTTP/1.1 200 OK ── │                │                     │
  │   hello               │                │                     │
  │                       │                │                     │keep-alive: socket stays open
  │                       │                │                     │parser reset, awaits next request
```

---

## 15. Key Source Files

| Path | Role |
|---|---|
| `lib/net.js` | `net.Server`, `net.Socket` — raw TCP layer |
| `src/tcp_wrap.cc` | C++ binding wrapping libuv's `uv_tcp_t` |
| `src/stream_base.cc` | Shared read/write plumbing for all stream-backed handles |
| `deps/llhttp/` | The HTTP/1.x parser state machine (generated, compiled to C) |
| `src/node_http_parser.cc` | C++ binding exposing llhttp to JavaScript |
| `lib/_http_common.js` | Shared parser `FreeList` pool, header-casing helpers |
| `lib/_http_server.js` | `http.Server`, connection listener, request/response wiring |
| `lib/_http_incoming.js` | `IncomingMessage` — the Readable stream over request data |
| `lib/_http_outgoing.js` | `OutgoingMessage` — shared base for writing HTTP responses |
| `lib/_http_client.js` | `http.Agent`, client-side keep-alive socket pooling |
| `lib/internal/http2/core.js` | `Http2Session`, `Http2Stream` — the HTTP/2 implementation |
| `lib/internal/cluster/` | Shared-handle distribution across `cluster.fork()` workers |

---

The throughline across every layer: Node.js never buffers more than it has to. The parser emits events incrementally as bytes arrive; the request body is a stream, not a pre-parsed object; the response is written incrementally and respects backpressure; and connections are reused rather than torn down per request. Understanding where each of those decisions lives — kernel, libuv, C++ binding, or JS — is what turns "the http module just works" into the ability to actually reason about a production incident when it doesn't.
