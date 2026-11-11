---
sidebar_position: 2
---

# HTTP (and HTTPS, HTTP/2, HTTP/3)

> **Why this matters in interviews:** every API you sketch in a design round speaks HTTP. Interviewers test whether you know the **semantics** (which methods are safe to retry, which status code means what), the **performance model** (handshakes cost round trips, and why HTTP/2 and HTTP/3 exist), **caching** (`Cache-Control`, `ETag`, CDNs) and **when not to use plain request/response** (WebSockets, SSE, gRPC).

Prerequisite: [DNS](./01_DNS.md). Related: [Latency Numbers](./03_Latency%20Numbers.md).

---

## 1. The model

HTTP is a **stateless, request/response, application-layer** protocol. A client sends a request (method, target, headers, optional body) and the server returns a response (status, headers, optional body).

```http
GET /v1/users/42 HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer eyJhbGciOi...
If-None-Match: "a1b2c3"

HTTP/1.1 304 Not Modified
ETag: "a1b2c3"
Cache-Control: private, max-age=60
```

**Stateless** means each request carries everything the server needs: auth token, IDs, cursor. State lives in cookies/tokens on the client and in databases or caches on the server. That's what lets you put any number of identical app servers behind a load balancer. It's the basis of **horizontal scaling**.

## 2. Methods: safe, idempotent, cacheable

| Method | Use | Safe (no side effects) | Idempotent (N calls = 1 call) | Cacheable |
| --- | --- | --- | --- | --- |
| `GET` | Read a resource | ✅ | ✅ | ✅ |
| `HEAD` | Headers only (check existence or size) | ✅ | ✅ | ✅ |
| `OPTIONS` | Capabilities, CORS preflight | ✅ | ✅ | ❌ |
| `POST` | Create, or trigger an action | ❌ | ❌ (**make it idempotent with an `Idempotency-Key`**) | Rarely |
| `PUT` | **Replace** the resource at a known URI | ❌ | ✅ | ❌ |
| `PATCH` | **Partial** update | ❌ | Not guaranteed (`{"op":"increment"}` isn't) | ❌ |
| `DELETE` | Remove | ❌ | ✅ (the second call may return 404, but the server state is the same) | ❌ |

**Why idempotency matters in distributed systems:** networks time out *after* the server has done the work. Clients, SDKs, load balancers and service meshes **retry automatically**. A retried non-idempotent `POST /payments` charges the customer twice.

**The fix (Stripe-style idempotency keys):**
1. The client generates a UUID per logical operation and sends it as `Idempotency-Key: 8e0f...`.
2. The server atomically stores `key → (status: in_progress)`, does the work, then stores `key → final response`, with a TTL of something like 24 hours.
3. On a retry with the same key, it returns the stored response and doesn't redo the work. A concurrent duplicate gets `409 Conflict`.

## 3. Status codes that come up in designs

| Code | Meaning | Design note |
| --- | --- | --- |
| **200** OK | Success with a body | |
| **201** Created | A resource was created | Return a `Location` header |
| **202** Accepted | Queued for async processing | Return a status URL to poll, e.g. video transcoding or report generation |
| **204** No Content | Success, no body | Typical for `DELETE` |
| **301 / 308** | Permanent redirect (308 keeps the method and body) | Browsers cache it, so the server stops seeing repeat hits (the URL-shortener analytics trade-off) |
| **302 / 307** | Temporary redirect (307 keeps the method and body) | Every hit reaches the server, so you can track it |
| **304** Not Modified | The cached copy is still valid | It saves bandwidth, not round trips |
| **400** Bad Request | Malformed input | |
| **401** Unauthorized | **Not authenticated** (missing or invalid credentials) | |
| **403** Forbidden | **Authenticated but not allowed** | |
| **404** Not Found | | Also used to hide the existence of resources you can't see |
| **409** Conflict | A state conflict: duplicate, version mismatch, idempotency key in flight | |
| **412** Precondition Failed | `If-Match` ETag mismatch | **Optimistic concurrency control** for updates |
| **422** Unprocessable Content | Valid syntax, but semantically invalid | |
| **429** Too Many Requests | Rate limited | Send `Retry-After` |
| **500** Internal Server Error | A bug or unhandled failure | |
| **502** Bad Gateway | A proxy got an **invalid response** from upstream (it crashed or reset the connection) | |
| **503** Service Unavailable | Overloaded or in maintenance | Use it for **load shedding**, with `Retry-After` |
| **504** Gateway Timeout | A proxy **timed out** waiting for upstream | |

**Rule for retries:** retry 408, 429, 502, 503 and 504 (with backoff and jitter), and retry 5xx only for idempotent requests. **Never blindly retry other 4xx errors.** The request itself is wrong.

## 4. Headers worth knowing

| Area | Headers |
| --- | --- |
| Content | `Content-Type`, `Content-Length`, `Content-Encoding: gzip, br`, `Accept`, `Accept-Encoding` |
| Caching | `Cache-Control`, `ETag`, `If-None-Match`, `Last-Modified`, `If-Modified-Since`, `Vary`, `Age` |
| Concurrency | `If-Match` (with `ETag`) for optimistic locking |
| Auth | `Authorization: Bearer <token>`, `Cookie` / `Set-Cookie` (`HttpOnly; Secure; SameSite`) |
| Routing | `Host` (required in 1.1, and how virtual hosting works), `X-Forwarded-For` / `Forwarded` (the client IP behind a proxy) |
| Reliability | `Idempotency-Key`, `Retry-After`, `RateLimit-*` (IETF draft) / `X-RateLimit-*` |
| Tracing | `traceparent` (W3C Trace Context), `X-Request-ID` |
| Security | `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, CORS `Access-Control-Allow-*` |

## 5. HTTP versions: why each one exists

| | HTTP/1.1 (1997) | HTTP/2 (2015) | HTTP/3 (2022) |
| --- | --- | --- | --- |
| Transport | TCP | TCP | **QUIC over UDP** |
| Format | Text | Binary frames | Binary frames |
| Concurrency | **One request at a time per connection** (pipelining exists but is effectively unused) | **Multiplexed streams** on one connection | Multiplexed streams that are **independent** |
| Head-of-line blocking | At the HTTP layer (a slow response blocks the ones behind it) | Fixed at the HTTP layer, but **one lost TCP packet stalls all streams** | **Gone**: loss on one stream doesn't block the others |
| Header compression | None | HPACK | QPACK |
| Handshake (new connection) | TCP 1 RTT + TLS | TCP 1 RTT + TLS | **Combined: 1 RTT, or 0-RTT on resumption** |
| Connection migration | No | No | **Yes** (connection IDs survive a Wi-Fi → cellular switch) |
| Workarounds it made obsolete | — | Domain sharding, sprite sheets, concatenating files (browsers open about 6 connections per host on HTTP/1.1) | — |

HTTP/2 server push existed but is effectively dead. Chrome removed it, and `103 Early Hints` plus preload replaced it.

**Why HTTP/3 uses UDP:** TCP is implemented in OS kernels and middleboxes, so it's nearly impossible to evolve. Building QUIC on UDP in user space let it ship stream-level loss recovery, a faster handshake (TLS 1.3 built in) and connection migration, all deployable through app updates.

### Round-trip cost of a fresh HTTPS request

```
TCP + TLS 1.2 : SYN/SYN-ACK (1 RTT) + TLS (2 RTT) + request (1 RTT) = 4 RTT
TCP + TLS 1.3 : 1 RTT + 1 RTT + 1 RTT                                = 3 RTT
QUIC (HTTP/3) : combined transport+TLS (1 RTT) + request (1 RTT)     = 2 RTT
QUIC 0-RTT    : request sent with the first flight                    = 1 RTT
```

At a 100 ms cross-continent RTT, that's **400 ms vs 100 ms** before the first byte. Hence **keep-alive, connection pooling, CDNs that terminate TLS near users** and HTTP/3. 0-RTT data can be **replayed** by an attacker, so allow it only for idempotent requests.

## 6. HTTPS / TLS in designs

- **TLS provides:** confidentiality (encryption), integrity (tamper detection) and server authentication (certificates chained to a trusted CA).
- **TLS termination** usually happens at the load balancer, CDN or API gateway. Traffic inside the VPC is then plain HTTP or **re-encrypted** (zero-trust networks re-encrypt).
- **mTLS (mutual TLS):** both sides present certificates. It's the standard way to authenticate **service to service** (Istio/Linkerd service meshes issue certs automatically).
- **SNI** (Server Name Indication) lets one IP serve certificates for many hostnames. CDNs depend on it.
- **HSTS** tells browsers "only ever use HTTPS for this domain", which prevents downgrade attacks.
- **Certificate management:** automate it (ACME / Let's Encrypt, AWS ACM). Expired certificates cause real outages.

## 7. HTTP caching

```
Client cache ── CDN / reverse proxy (shared) ── Origin
```

| Directive | Meaning |
| --- | --- |
| `max-age=N` | Fresh for N seconds |
| `s-maxage=N` | Freshness for **shared** caches (the CDN) only |
| `public` / `private` | May be stored by shared caches / the browser only (anything per-user) |
| `no-cache` | **May** store it, but must **revalidate** before each use (people often confuse this one) |
| `no-store` | Never store it (sensitive data) |
| `immutable` | Never changes. Use it with **content-hashed URLs** like `app.3f9a1c.js` and a 1-year max-age |
| `stale-while-revalidate=N` | Serve stale content while refreshing in the background, which hides origin latency |
| `stale-if-error=N` | Serve stale content if the origin is down, a nice resilience win |

**Validation:** when content goes stale, the client sends `If-None-Match: <etag>`, and the server replies `304` with no body if nothing changed. **`Vary: Accept-Encoding`** tells caches to store a separate copy per encoding. Varying on too many headers destroys the hit rate.

**Cache invalidation at the CDN:** prefer **versioned URLs** (a new deploy means a new filename, and the old copy just ages out) over purge APIs, which are slow, rate-limited and eventually consistent. More in [CDN](./10_CDN.md) and [Caching Strategies](./08_Caching%20Strategies.md).

## 8. Choosing the communication style

| Style | Shape | Best for | Watch out for |
| --- | --- | --- | --- |
| **REST/JSON over HTTP** | Request/response, resources | Public APIs, CRUD, cacheable reads | Over- and under-fetching, chatty clients |
| **gRPC** (HTTP/2 + Protobuf) | RPC, unary + streaming, typed contracts | **Internal service-to-service**, low latency, polyglot | Browser support needs gRPC-Web, and it's harder to debug and cache |
| **GraphQL** | One endpoint, the client picks fields | Many client types (web/iOS/Android) aggregating many backends | Caching is harder, there's a risk of expensive queries (depth/complexity limits), and N+1 resolvers (use DataLoader) |
| **Short polling** | The client asks every N seconds | Simple, rare updates | Wasted requests, latency up to N |
| **Long polling** | The server holds the request until there's data or a timeout | Near-real-time where WebSockets aren't possible | It ties up connections, and each message pays the reconnect cost |
| **Server-Sent Events (SSE)** | One long HTTP response, **server → client** stream | Feeds, notifications, live scores, **LLM token streaming** | One-way only. Built-in auto-reconnect with `Last-Event-ID`. Works through most proxies. |
| **WebSocket** | Upgrades the HTTP connection to a **full-duplex** socket | Chat, multiplayer, collaborative editing, trading | Stateful connections (sticky routing, connection servers, a pub/sub backplane to fan out), plus heartbeats and reconnect logic |
| **Webhooks** | The server POSTs to the client's URL | Server-to-server event notification (payments, Git) | Need signing (HMAC), retries and idempotent receivers |

## 9. Performance checklist

- **Reuse connections:** HTTP keep-alive plus **connection pools** on clients (to databases and downstream services too). New TCP+TLS connections cost 2–3 RTT and CPU.
- **Compress:** Brotli or gzip for text (JSON shrinks about 5–10x). Don't re-compress images or video.
- **Shrink payloads:** pagination (prefer **cursor-based**), field selection, Protobuf internally.
- **Batch and parallelize:** avoid N sequential calls (each costs an RTT). Use batch endpoints or parallel fan-out with timeouts.
- **Put a CDN in front of static and cacheable content,** and terminate TLS at the edge.
- **Set timeouts on every outbound call** and propagate deadlines (gRPC deadlines, or a header holding the remaining budget).

## 10. Load balancers and HTTP

| | L4 (transport) | L7 (application) |
| --- | --- | --- |
| Sees | IPs and ports (TCP/UDP) | Full HTTP: path, headers, cookies |
| Can do | Very fast forwarding, millions of connections | Path/host routing, TLS termination, auth, rate limiting, retries, header rewrites, canary by header |
| Examples | AWS NLB, Maglev, IPVS | AWS ALB, Envoy, NGINX, HAProxy (both modes) |
| Cost | Cheap, and it doesn't touch the payload | More CPU (it parses HTTP and decrypts TLS) |

**Sticky sessions** (cookie or IP-hash affinity) are a smell for stateless HTTP APIs. They're acceptable for WebSockets or when a local cache warms up per user.

## 11. CORS in 30 seconds

Browsers block JS on `app.com` from reading responses from `api.com` unless `api.com` explicitly allows it with `Access-Control-Allow-Origin`. "Non-simple" requests (custom headers, `PUT`/`DELETE`, JSON content-type) trigger an `OPTIONS` **preflight**. Cache it with `Access-Control-Max-Age` to avoid an extra RTT per call. CORS protects **users' browsers**. It doesn't protect your API from curl, so it isn't an auth mechanism.

---

## Interview questions

### "What happens when you type a URL and press Enter?" (end to end)
1. **URL parsing and HSTS check.** The scheme, host and path are parsed, and HSTS forces HTTPS if set.
2. **DNS resolution.** See [DNS](./01_DNS.md). This often resolves to a CDN edge.
3. **TCP handshake** (or QUIC), then the **TLS handshake**: SNI, certificate validation, key exchange, ALPN negotiating `h2`/`h3`.
4. **HTTP request**, with cookies and auth.
5. **Edge/CDN:** a cache hit is served immediately. On a miss the CDN goes to the origin over a warm, pooled connection.
6. **The origin load balancer** routes to an app server, which calls caches, databases and services, then responds.
7. **The browser** parses the HTML, discovers CSS/JS/images (more requests, multiplexed over HTTP/2 or HTTP/3), builds the DOM and CSSOM, lays out and paints.

### "PUT vs PATCH vs POST?"
`PUT` replaces the resource at a known URI and is idempotent. `PATCH` partially updates it and isn't necessarily idempotent. `POST` creates something under a collection (the server assigns the ID) or triggers an action, isn't idempotent, and can be made safe to retry with an idempotency key.

### "502 vs 503 vs 504?"
A **502** means the upstream answered with garbage or reset the connection. A **503** means the service is deliberately refusing (overloaded, in maintenance, load shedding). A **504** means the upstream didn't answer in time. They point to different fixes: crashes vs capacity vs slowness or timeouts.

### "How would you push real-time updates to clients?"
Ask about the direction and the scale. Server → client only means **SSE**. Bidirectional at low latency means **WebSockets**, with connection servers that hold the sockets, a pub/sub layer (Redis or Kafka) to route messages to whichever server holds the user, and heartbeats and reconnects with resume tokens. Mobile apps that are in the background need **push notifications** (APNs/FCM).

### "Why did HTTP/3 move to UDP?"
To escape TCP's head-of-line blocking and the fact that TCP is ossified in kernels and middleboxes. QUIC gives independent streams, a 1-RTT (or 0-RTT) handshake with TLS 1.3 built in, and connection migration across networks.

## Common mistakes

- Using `GET` for actions with side effects (crawlers and prefetchers will trigger them).
- Returning `200` with `{"error": ...}`, which breaks caching, monitoring and retries.
- Confusing `401` with `403`, or `no-cache` with `no-store`.
- Retrying non-idempotent requests without idempotency keys.
- Forgetting that every extra sequential call costs a full round trip.
