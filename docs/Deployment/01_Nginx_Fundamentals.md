# Nginx Fundamentals

Nginx (pronounced "engine-x") is a high-performance web server, reverse proxy, load balancer, and HTTP cache. It's known for its stability, rich feature set, simple configuration, and low resource consumption.

This guide walks through real nginx configuration, directive by directive — not just what to paste, but what each line actually does, why it exists, and when changing it matters.

## Table of Contents
1. [Architecture](#architecture)
2. [Basic Configuration](#basic-configuration)
3. [Reverse Proxy](#reverse-proxy)
4. [Load Balancing](#load-balancing)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Caching](#caching)
7. [Security](#security)
8. [Performance Tuning](#performance-tuning)
9. [Common Patterns](#common-patterns)
10. [Monitoring and Logging](#monitoring-and-logging)

## Architecture

### Event-Driven Architecture

```
┌─────────────────────────────────────────┐
│         Nginx Master Process            │
│  (reads config, manages workers)        │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┼──────────┬────────────┐
    ▼          ▼          ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐  ┌────────┐
│Worker 1│ │Worker 2│ │Worker 3│  │Worker N│
│        │ │        │ │        │  │        │
│ Event  │ │ Event  │ │ Event  │  │ Event  │
│  Loop  │ │  Loop  │ │  Loop  │  │  Loop  │
└────────┘ └────────┘ └────────┘  └────────┘
```

**Why this shape, specifically:** 

Apache's traditional model spawns one process or thread per connection — simple to reason about, but every idle keep-alive connection still holds a thread's worth of memory and the OS still has to schedule it. 

Nginx's workers instead run a single-threaded event loop each, built on an OS-level readiness API (`epoll` on Linux, `kqueue` on BSD/macOS). 

A worker asks the kernel "wake me when any of these thousands of sockets has data ready," then services only the sockets that are actually ready, in a tight non-blocking loop. 

One worker can comfortably hold tens of thousands of idle connections at once because idle connections cost almost nothing while they're idle — there's no thread sitting around waiting for them.

#### **Master process**:

Owns the configuration. 
It reads `nginx.conf`, opens the listening sockets, and spawns/supervises worker processes.

The master itself never touches client traffic.

#### **Worker processes**: 

Each runs its own event loop and handles actual requests. 

Workers are independent; if one crashes, the master spawns a replacement and the others are unaffected.

#### **Non-blocking I/O**: 

A worker never calls a blocking read/write and then sits idle waiting; 

It registers interest in a socket and moves on to other ready work, which is what lets one OS thread serve thousands of connections.

#### **Shared-nothing workers**: 

Workers don't share connection state with each other, which avoids lock contention between them. 

This is also why session data or rate-limit counters that need to be shared across workers (covered in the Security section) have to live in an explicitly shared memory zone, not an in-process variable.

### Process Model

```bash
ps aux | grep nginx
```

```
root      1234  0.0  0.1  nginx: master process
nginx     1235  0.0  0.5  nginx: worker process
nginx     1236  0.0  0.5  nginx: worker process
```

**What this is showing?**

The master runs as `root` — it needs that privilege once, to bind to port 80/443 (ports below 1024 are privileged on Linux). 

Immediately after binding, workers are forked and drop down to an unprivileged user (`nginx` here, set by the `user` directive below). 

This split is a deliberate security boundary: the process that actually parses untrusted client bytes runs with no special privileges, so a bug in request handling doesn't hand an attacker root. If you ever see all nginx processes running as root, that's a configuration mistake worth fixing, not a quirk.

## Basic Configuration

### Configuration Structure

```nginx
# /etc/nginx/nginx.conf

user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript;

    include /etc/nginx/conf.d/*.conf;
}
```

This is nginx's three-level structure, and it matters because directives inherit downward: a setting in `http {}` applies to every `server {}` inside it unless a more specific block overrides it.

**What each directive does**, grouped by what it's actually responsible for rather than the order it appears in the file:

#### Process setup

- **`user nginx`** — the unprivileged account worker processes run as, discussed above.
- **`worker_processes auto`** — spawn one worker per detected CPU core. Since each worker is single-threaded, this is what actually lets nginx use multiple cores at all. More workers than cores just adds context-switching overhead with no upside.
- **`error_log ... warn`** — where diagnostic output goes, filtered to `warn` severity and above. The level matters: `debug` is extremely verbose and only useful with a debug build; `error` or `crit` would hide warnings you'd actually want to see (like a backend becoming unreachable).
- **`pid`** — where the master writes its own process ID, so `nginx -s reload`/`stop` know which process to signal.

#### Handling connections — the `events` block

- **`worker_connections 1024`** — the maximum number of simultaneous connections *one worker* can hold open. This is a hard ceiling: 4 workers × 1024 means 4096 total connections, full stop, regardless of how much RAM or CPU is free. As a reverse proxy, a single client request can occupy **two** connections at once (client-to-nginx and nginx-to-backend), so the real client capacity is roughly half this number — a common sizing mistake.
- **`use epoll`** — explicitly select the Linux event notification API. Nginx auto-detects the best available mechanism for the OS it's running on, so this line is rarely required anymore; it's worth keeping only as documentation of intent, or on older nginx builds that don't auto-select correctly.
- **`multi_accept on`** — when a burst of connections arrives at once, let a worker accept all of them in one pass through its accept queue instead of one per event-loop iteration. This sounds like a free win but isn't always: under very high connection churn it can let one worker grab a disproportionate share of new connections before handing control back to its event loop, starving other request processing briefly. Nginx's own documentation leaves it off by default for a reason — benchmark before enabling it under real load.

#### Serving requests correctly

- **`include mime.types` / `default_type`** — maps file extensions to `Content-Type` headers (`.css` → `text/css`, etc.); anything not in the map falls back to `default_type`, which is deliberately a generic binary type rather than guessing wrong.
- **`log_format main '...'`** — defines a named, reusable log line shape. `$remote_addr`, `$status`, and friends are nginx variables populated per-request; defining the format once and referencing it by name (`main`) is what makes it possible to use different formats for different `server` blocks.
- **`access_log ... main`** — write every request to this file using the `main` format. Turning this off entirely (`access_log off;`) at a high-traffic, low-value location (static assets, health checks) is a legitimate way to cut disk I/O — shown later in the Caching section.

#### Performance

- **`sendfile` / `tcp_nopush` / `tcp_nodelay`** — this trio controls exactly how bytes leave the socket, and they work together rather than independently:
  - `sendfile` lets the kernel copy a file straight from disk cache to the network socket without ever copying it into nginx's own userspace buffer first — a meaningful win when serving static files.
  - `tcp_nopush` (only meaningful alongside `sendfile`) holds off sending a packet until it's as full as possible, instead of dribbling out small TCP segments.
  - `tcp_nodelay` disables Nagle's algorithm so the final, often-small packet of a response goes out immediately instead of waiting for more data to batch with — without it, that last packet could sit buffered for up to ~200ms.

  Nginx actually applies `tcp_nopush` for the bulk of a transfer and `tcp_nodelay` for the tail end, which is why both are conventionally turned on together rather than treated as alternatives.
- **`keepalive_timeout 65`** — how long an idle client connection is kept open, waiting for another request on the same TCP connection, before nginx closes it. Longer values save handshake overhead for clients making repeat requests; too long and idle connections tie up a worker's connection budget for no benefit.
- **`types_hash_max_size 2048`** — a tuning knob for the internal hash table nginx builds from `mime.types`. Too small and the hash table has more collisions, which nginx warns about in its error log; 2048 is comfortably large for the default MIME type list.

#### Compression

- **`gzip on` / `gzip_vary on` / `gzip_min_length` / `gzip_types`** — compress responses before sending them.
  - `gzip_vary on` adds a `Vary: Accept-Encoding` header, which tells any cache in between (browser or CDN) that the response differs depending on whether the client accepts compression — without it, a cache could serve a gzipped response to a client that can't decompress it.
  - `gzip_min_length 1024` skips compressing tiny responses, where the CPU cost isn't worth the tiny size saving.
  - `gzip_types` is an explicit allow-list — notably, `text/html` is always compressed by default and doesn't need listing, but other types do.

#### Modularity

- **`include /etc/nginx/conf.d/*.conf`** — pull in every `server {}` block defined in separate files under `conf.d/`. This is what lets you manage one site per file instead of one giant `nginx.conf`.

### Simple Web Server

```nginx
# /etc/nginx/conf.d/myapp.conf

server {
    listen 80;
    server_name example.com www.example.com;
    root /var/www/html;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    location = /50x.html {
        root /usr/share/nginx/html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**What each directive does**, grouped by what it's responsible for:

#### Serving the files

- **`listen 80`** — bind this server block to port 80 on all interfaces. A host can run many `server` blocks on the same port, distinguished by `server_name` (virtual hosting).
- **`server_name`** — which `Host` header values route to this block. The first block in your config that matches `listen` *and* has no matching `server_name` anywhere else effectively becomes the default for unmatched hosts — worth knowing, since an unintended block can silently become your catch-all.
- **`root` / `index`** — the filesystem directory requests are resolved against, and which filename to serve for a directory request (tried in order).
- **`try_files $uri $uri/ =404`** — try the request path as a file, then as a directory, and if neither exists, return a real `404` rather than letting the request fall through to something else. This is the standard "serve static files, 404 on anything missing" pattern — contrast with the single-page-app variant later in this guide, which falls back to `index.html` instead of `404`.

#### Caching static assets

- **`location ~* \.(jpg|jpeg|...)$ { expires 30d; ... }`** — a case-insensitive regex location matching common static asset extensions.
  - `expires 30d` sets *both* the `Expires` header and `Cache-Control: max-age=...` in one directive.
  - `Cache-Control: public, immutable` goes further: `immutable` tells the browser not to even revalidate this resource on a user-triggered reload, which only makes sense if the filename changes whenever the content does (cache-busted build hashes) — using `immutable` on a URL that *can* change in place will serve stale assets to returning visitors.

#### Error pages

- **`error_page 404 /404.html`** — serve a custom page instead of nginx's bare-bones default 404, without changing the HTTP status code the client sees.
- **`error_page 500 502 503 504 /50x.html`** combined with **`location = /50x.html { root ...; }`** — one friendly page for every flavor of upstream failure. The exact-match `location =` here matters: it points this specific error page at a *local* static file path, independent of whatever `root` the failing request was using, so the error page itself can never also fail to be found.

#### Response headers

- **`add_header ... always`** — the `always` keyword is easy to miss but important: without it, `add_header` is silently skipped for non-2xx/3xx responses (like error pages), meaning your security headers would quietly disappear exactly on the responses — errors — where you'd most want them present.
- **Security headers here** — `X-Frame-Options: SAMEORIGIN` stops the page being embedded in another site's `<iframe>` (clickjacking defense); `X-Content-Type-Options: nosniff` stops the browser from guessing a different content type than what the server declared (MIME-sniffing defense). `X-XSS-Protection` is a legacy header for an old browser-built-in XSS filter that Chrome, Edge, and Safari have all removed — it's harmless to send for backward compatibility but provides no real protection in a current browser. A Content-Security-Policy (covered in the Security section) is the modern replacement for what that header used to do.

### Location Matching

```nginx
server {
    listen 80;
    server_name example.com;

    location = /exact {
        return 200 "Exact match\n";
    }

    location ^~ /images/ {
        root /var/www;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php-fpm.sock;
    }

    location ~* \.(jpg|jpeg|png|gif)$ {
        expires 30d;
    }

    location /documents/ {
        root /var/www;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

This is the part of nginx most people get subtly wrong, because the actual matching algorithm isn't "longest match wins" or "first match wins" uniformly — it's a two-phase process:

1. Nginx first checks every **prefix** location (plain `location /path`, `location = /path`, `location ^~ /path`) and remembers the *longest* one that matches the request URI. If that longest match happens to be an exact match (`=`), nginx stops immediately — nothing beats an exact match.
2. If the longest prefix match found in step 1 was declared with `^~`, nginx also stops immediately and uses it, skipping regex checking entirely.
3. Otherwise, nginx checks every **regex** location (`location ~` or `location ~*`) *in the order they appear in the config file* and uses the **first** one that matches — not the best or most specific one, the first.
4. If no regex matches, nginx falls back to the longest prefix match found in step 1.

That's the actual priority order this file demonstrates:

```
1. Exact match         (=)        — wins instantly, no further checks
2. Preferential prefix  (^~)       — wins instantly, skips regex checks
3. Regex match          (~, ~*)    — first one in file order wins
4. Prefix match         (plain)    — the longest one, used only if no regex matched
```

The practical trap this explains: two regex locations that could both match the same URI aren't resolved by specificity — the one written *earlier* in the file always wins, even if a later one would have been a "better" match. If `location ~* \.(jpg|jpeg|png|gif)$` is written after a broader `location ~ \.(php|jpg)$`, the broader one wins for `.jpg` requests purely because of ordering, not pattern precision. This is also why `^~` exists: it's the escape hatch for "I need this prefix location to definitely win over any regex location," most commonly used — as here — to make sure a static-asset directory bypasses something like a PHP regex handler entirely.

## Reverse Proxy

### Basic Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }
}
```

**What each directive does**, grouped by what it's responsible for:

#### Forwarding headers the backend needs

- **`proxy_pass`** — forward the request to this upstream address instead of serving it locally. From here on, nginx is a client to your application, not just a server to the browser — which is exactly why the next block of headers is necessary.
- **`proxy_set_header Host $host`** — by default, nginx would forward the *original* `Host` header it received, which is usually fine — but without setting it explicitly, some proxy configurations substitute the upstream's own address instead. Setting it explicitly to `$host` guarantees your application sees the hostname the client actually requested, which matters for any app logic that branches on it (multi-tenant routing, building absolute URLs, redirects).
- **`X-Real-IP` / `X-Forwarded-For`** — without these, your application's access logs and any IP-based logic (rate limiting, geo features, fraud checks) would only ever see nginx's own IP address, because as far as the TCP connection is concerned, nginx *is* the client now. `X-Real-IP` carries just the immediate client IP; `X-Forwarded-For` (built from `$proxy_add_x_forwarded_for`, which *appends* to any existing value) carries the whole chain of proxies a request passed through — useful when there's more than one hop, but also means your application must only trust it if it validates which proxies it came through, since a client can forge their own `X-Forwarded-For` header.
- **`X-Forwarded-Proto $scheme`** — tells the application whether the *original* client connection was HTTP or HTTPS, since the nginx-to-backend hop is commonly plain HTTP even when the public-facing side is TLS. Without this, an app behind an SSL-terminating proxy can't tell it's actually being accessed securely, which breaks logic like "redirect to HTTPS if not already" or "only set the secure cookie flag over HTTPS" into an infinite loop or a security gap, respectively.

#### Timeouts: three different clocks

- **`proxy_connect_timeout`** — how long to wait for the TCP handshake with the upstream to succeed.
- **`proxy_send_timeout`** — how long to wait between successful writes while nginx is sending the request body *to* the upstream.
- **`proxy_read_timeout`** — how long to wait between successful reads while nginx is receiving the response *from* the upstream. A slow database query, for instance, shows up as a `proxy_read_timeout` problem, not a connect problem — distinguishing which one is firing in your error log tells you where to actually look.

#### Buffering the response

- **`proxy_buffering on`** — let nginx read the entire upstream response into its own buffers (spilling to a temp file if it's large) before forwarding it to the client, rather than streaming bytes through immediately as they arrive. This decouples a slow client from your application: the backend can finish and move on to the next request quickly, while nginx handles the (potentially much slower) job of trickling the response out to the client.
- **`proxy_buffer_size 4k`** — the buffer specifically for the *first part* of the response — the status line and headers. This is usually small and fixed-size, since headers rarely need much more than one memory page.
- **`proxy_buffers 8 4k`** — the pool used for the response *body*: 8 buffers of 4k each, so up to 32k of a response can be held in memory per request before nginx starts using temp files on disk.
- **`proxy_busy_buffers_size 8k`** — how much of that buffer pool can be "busy" (i.e., queued up to send to the client) at once while nginx is still reading more from the upstream. It has to be smaller than the total `proxy_buffers` size and at least `proxy_buffer_size`, since it's a subset of that same pool, not an additional allocation.

### WebSocket Proxy

```nginx
server {
    listen 80;
    server_name ws.example.com;

    location /socket.io/ {
        proxy_pass http://localhost:3000;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

A WebSocket connection starts life as an ordinary HTTP request that asks to be **upgraded** to a different protocol — nginx has to be told explicitly to allow that, because proxying is not its default behavior for an HTTP request.

**What's different here, and why:**

- **`proxy_http_version 1.1`** — nginx defaults to speaking HTTP/1.0 to upstreams, which has no concept of the `Upgrade` mechanism at all. Without bumping this to 1.1, the upgrade handshake can never succeed.
- **`proxy_set_header Upgrade $http_upgrade`** — forward the client's original `Upgrade: websocket` header through to the backend unchanged.
- **`proxy_set_header Connection "upgrade"`** — this is the header that actually signals "switch protocols" rather than the ordinary `Connection: keep-alive`. It's hardcoded to the literal string `"upgrade"` here (rather than forwarding the client's value) specifically for this location, since this location exists only to serve WebSocket traffic.
- **`proxy_read_timeout 86400s` / `proxy_send_timeout 86400s`** — a WebSocket connection can sit perfectly healthy and idle for a long time between messages — a chat app with no new messages, a dashboard waiting for the next update. The default 60-second read/send timeouts from the basic reverse proxy block would silently kill a healthy, idle WebSocket as if it were a stalled HTTP request. Stretching these to 24 hours (86400 seconds) avoids that; the actual right number depends on your application's natural idle periods and whether your client reconnects gracefully.

For a production-ready version of this (the `map`-based `Connection` header, sticky vs. shared-backend routing, heartbeats, and the equivalent setup for SSE and video streaming), see [Nginx for Real-Time Chat, Video Streaming, and SSE](./03_Nginx_Realtime_And_Streaming.md).

### Microservices Routing

```nginx
server {
    listen 80;
    server_name api.example.com;

    location /api/users {
        proxy_pass http://user-service:8001;
        include /etc/nginx/proxy_params;
    }

    location /api/orders {
        proxy_pass http://order-service:8002;
        include /etc/nginx/proxy_params;
    }

    location /api/products {
        proxy_pass http://product-service:8003;
        include /etc/nginx/proxy_params;
    }

    location /api/payments {
        proxy_pass http://payment-service:8004;
        include /etc/nginx/proxy_params;
    }
}
```

```nginx
# /etc/nginx/proxy_params

proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_redirect off;
```

This is nginx acting as a single entry point (an API gateway) that routes different URL prefixes to entirely different backend services — each `location` here could point at a different team's service, written in a different language, running on a different port or host.

**What each piece does:**

- **One `location` per service, matched by path prefix** — the client never needs to know that `/api/orders` and `/api/payments` are different physical services; from the outside it's one API.
- **`include /etc/nginx/proxy_params`** — rather than repeating the same four `proxy_set_header` lines in every single `location` block, they're factored into one shared file and pulled in with `include`. This is purely a DRY mechanism — functionally identical to pasting the lines in each block, but one place to fix if a header needs to change later.
- **`proxy_redirect off`** — by default, nginx rewrites any `Location`/`Refresh` header an upstream sends back in a redirect response, trying to substitute the externally-visible address for the upstream's own. That rewriting is usually wrong for an internal service that has no idea it's sitting behind a gateway — turning it off means redirects pass through exactly as the upstream wrote them. (The alternative, if you do need nginx to rewrite redirects, is a specific `proxy_redirect from to;` mapping rather than relying on the automatic guess.)

This is the routing half of acting as a real API gateway. For the rest — authentication, per-client rate limiting, a consistent error contract, versioning, and gRPC — see [Nginx as an API Gateway](./02_Nginx_As_API_Gateway.md).

## Load Balancing

### Load Balancing Methods

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}
```

**Round robin (the default)** — with no load-balancing directive specified, nginx simply cycles through the server list in order for each new request. It's simple and fair *by request count*, but not by request cost — if one request type is far more expensive than another, round robin can still leave one backend doing more work than the others purely by bad luck of the draw.

```nginx
upstream backend {
    least_conn;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}
```

**`least_conn`** — send each new request to whichever backend currently has the fewest active connections, rather than blindly rotating. This is the better default whenever requests have uneven duration — a backend stuck processing a few slow requests naturally receives fewer new ones until it frees up, which plain round robin can't account for.

```nginx
upstream backend {
    ip_hash;
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com;
}
```

**`ip_hash`** — hash the client's IP address to consistently route the same client to the same backend, which is a simple way to get session affinity without a shared session store. Two things worth knowing before reaching for it: if a backend goes down, the hash distribution shifts and some clients who weren't previously mapped to the failed server get rebalanced onto a *different* server than before (not just the clients who were actually affected); and if clients reach nginx through another layer that masks their real IP (a corporate NAT, another proxy, a CDN), many distinct users can collapse onto the same hash and overload one backend.

```nginx
upstream backend {
    server backend1.example.com weight=3;
    server backend2.example.com weight=2;
    server backend3.example.com weight=1;
}
```

**Weighted round robin** — same rotation as plain round robin, but a server with `weight=3` receives three requests for every one that a `weight=1` server gets. This is the usual way to send proportionally more traffic to a bigger or newer instance in a mixed-capacity fleet, without needing `least_conn`'s dynamic tracking.

```nginx
upstream backend {
    server backend1.example.com;
    server backend2.example.com;
    server backend3.example.com backup;
}
```

**`backup`** — this server receives *zero* traffic under normal conditions. It only comes into play once every non-backup server has been marked unavailable (per the health-check settings below) — it exists purely as a last resort, not as a way to add general capacity.

```nginx
upstream backend {
    server backend1.example.com max_fails=3 fail_timeout=30s;
    server backend2.example.com max_fails=3 fail_timeout=30s;
    server backend3.example.com max_fails=3 fail_timeout=30s;
}
```

**Passive health checks** — `max_fails` and `fail_timeout` work together: if a server fails to respond (or returns an error, depending on `proxy_next_upstream` settings) `max_fails` times within `fail_timeout`, nginx marks it unavailable for that same `fail_timeout` duration, then cautiously tries it again. This is "passive" because nginx only learns a backend is unhealthy by actually sending it real client traffic and watching it fail — there's no independent polling. That's the free, open-source mechanism; proactive polling (hitting a dedicated `/health` endpoint on a timer, independent of real traffic) is the "active" health check covered further down, and is an Nginx Plus feature.

### Advanced Load Balancing

```nginx
upstream api_backend {
    least_conn;

    keepalive 32;
    keepalive_requests 100;
    keepalive_timeout 60s;

    server 10.0.1.10:8080 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:8080 weight=2 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:8080 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.13:8080 backup;
}

server {
    listen 80;
    server_name api.example.com;

    location /api/ {
        proxy_pass http://api_backend;

        proxy_http_version 1.1;
        proxy_set_header Connection "";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

This combines every mechanism above with one new, important piece: **upstream connection reuse**.

- **`keepalive 32`** — without this, nginx opens a brand-new TCP connection to the backend for *every single request*, even if the client itself is reusing a keep-alive connection to nginx — the keep-alive on the client side and the connection to the upstream are otherwise totally separate. `keepalive 32` tells nginx to maintain a pool of up to 32 idle, already-connected sockets *per worker* to this upstream, and reuse them for the next request instead of paying for a new TCP (and possibly TLS) handshake every time. On a busy API this is a significant latency and file-descriptor win.
- **`keepalive_requests 100`** — cap how many requests get multiplexed over one reused upstream connection before it's retired and replaced — a safety valve against a connection staying open indefinitely.
- **`keepalive_timeout 60s`** — how long an idle upstream connection stays in the pool before nginx gives up on it and closes it.
- **`proxy_http_version 1.1` + `proxy_set_header Connection ""`** — both lines are *required* for `keepalive` to actually work, and it's easy to add `keepalive 32` and see no effect without them. Nginx defaults to HTTP/1.0 to upstreams, which has no persistent-connection concept at all. And nginx otherwise forwards whatever `Connection` header the original client sent — which, if the client sent `Connection: close`, would force nginx to close the upstream connection after every request regardless of the keepalive pool. Clearing it to an empty string removes that interference, letting nginx's own upstream connection management take over.

### Active Health Checks (Nginx Plus)

```nginx
upstream backend {
    zone backend 64k;
    server backend1.example.com;
    server backend2.example.com;
}

server {
    listen 80;

    location / {
        proxy_pass http://backend;
        health_check interval=5s fails=3 passes=2 uri=/health;
    }

    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

This `health_check` directive is a commercial Nginx Plus feature, not part of the open-source build — worth knowing before copying this into a free nginx deployment and wondering why it fails to parse. The difference from the passive checks above is real: `health_check` has nginx *proactively* poll `/health` on a fixed interval, independent of actual client traffic, and only route real requests to a server once it's passed `passes` consecutive checks — meaning a cold or recovering backend never receives live traffic as its first "probe." On open-source nginx, the usual equivalents are: a third-party module (`nginx_upstream_check_module`), or simply moving proactive health checking up a layer — to a service mesh, a cloud load balancer, or your orchestrator's own readiness probes (Kubernetes, for instance, already won't route traffic to a pod that's failing its readiness probe, which covers much of the same need).

## SSL/TLS Configuration

### Basic HTTPS Setup

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/nginx/ssl/example.com.crt;
    ssl_certificate_key /etc/nginx/ssl/example.com.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/ca-certs.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        root /var/www/html;
        index index.html;
    }
}

server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}
```

**What each directive does**, grouped by what it's responsible for:

#### Listening and the certificate

- **`listen 443 ssl http2`** — accept TLS connections on 443, and negotiate HTTP/2 when the client supports it. HTTP/2's main practical win over HTTP/1.1 is multiplexing: many requests can share one TCP connection in parallel without blocking each other, which is why the old "concatenate your JS/CSS into one file" and "shard assets across hostnames" optimizations exist specifically to work around HTTP/1.1's limits — and matter much less once HTTP/2 is in play.
- **`ssl_certificate` / `ssl_certificate_key`** — the public certificate (and intermediate chain) and its matching private key. The key file's permissions matter in practice: it should be unreadable by anything other than root/nginx.

#### Protocol and cipher policy

- **`ssl_protocols TLSv1.2 TLSv1.3`** — the allow-list of protocol versions. Deliberately excluding TLS 1.0 and 1.1 here isn't just modernization for its own sake — both have known, practical vulnerabilities (BEAST, POODLE-adjacent issues) and are explicitly disallowed by current PCI-DSS requirements for anything handling payment data.
- **`ssl_ciphers HIGH:!aNULL:!MD5`** — a cipher-suite selection string: allow "high" strength ciphers, explicitly exclude anonymous (no authentication) ciphers and anything using the broken MD5 hash. This is an older, broad-strokes string; the "SSL Best Practices" snippet further down is the more precise, modern equivalent.
- **`ssl_prefer_server_ciphers on`** — when the client and server both support multiple cipher suites, let the *server's* preference order win rather than the client's. This matters for TLS 1.2 and earlier, where cipher strength varies a lot; TLS 1.3 removed the weak options entirely, which is why some modern configs turn this back `off` specifically for 1.3-only setups.

#### Session resumption

- **`ssl_session_cache shared:SSL:10m`** — a cache of previously-negotiated TLS sessions, shared across all worker processes (not per-worker, which would make resumption far less likely to hit). This lets a returning client skip the expensive full handshake (certificate exchange, key negotiation) and resume a prior session cheaply. 10m of shared memory holds roughly 40,000 sessions as a rule of thumb.
- **`ssl_session_timeout 10m`** — how long a cached session stays resumable before a full handshake is required again.

#### OCSP stapling

- **`ssl_stapling on` / `ssl_stapling_verify on` / `ssl_trusted_certificate`** — normally, a client checks certificate revocation status by contacting the Certificate Authority's OCSP responder itself during the handshake — which is slow, and also tells the CA which sites that client is visiting. Stapling has nginx fetch that signed "not revoked" proof itself, cache it, and staple it directly onto the handshake, so the client never has to make its own round trip. `ssl_trusted_certificate` points at the CA chain nginx needs to verify the OCSP response it fetched.

#### Enforcing HTTPS

- **`Strict-Transport-Security` (HSTS)** — tells the browser "never attempt a plain-HTTP connection to this host again, for the next `max-age` seconds — automatically upgrade to HTTPS, even if the user typed `http://`." This is a one-way door worth taking seriously: once a browser has cached this, it will refuse to even try plain HTTP, errors and all, until `max-age` expires — so it shouldn't be deployed with a long `max-age` until HTTPS is confirmed stable across the whole site, including subdomains if `includeSubDomains` is set.
- **The plain-port-80 `server` block** returns a `301` (permanent) redirect to the HTTPS version of the same path (`$request_uri` preserves the original path and query string). `301` rather than `302` matters for SEO and for browsers/clients that cache permanent redirects — it tells the client (and search engines) this redirect isn't going away, so they should update their own records rather than re-checking every time.

### Let's Encrypt with Certbot

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        root /var/www/html;
        index index.html;
    }
}
```

**Why the challenge location exists, and why it's carved out of the redirect:** Let's Encrypt proves you control a domain by asking your server to serve a specific, temporary file at `/.well-known/acme-challenge/<token>` over plain HTTP — both for the first certificate issuance and for every automated renewal afterward. If that path were swept up in the blanket `return 301 https://...` redirect below it, the challenge would never succeed, because Let's Encrypt's validator doesn't follow that redirect to a server that (at the time of first issuance) doesn't have a valid certificate yet. Carving out this one `location` block, placed so it's matched before the catch-all redirect, is what makes both issuance and silent, automated renewal work.

- **`fullchain.pem` / `privkey.pem`** — Certbot's standard output: the full certificate chain (leaf + intermediates) and the private key, auto-renewed in place roughly every 60 days without changing the file path, so nginx config doesn't need to change on renewal.
- **`options-ssl-nginx.conf` / `ssl-dhparams.pem`** — Certbot generates these alongside your certificate: a pre-built set of reasonable `ssl_protocols`/`ssl_ciphers` defaults, and a Diffie-Hellman parameters file (explained next).

### SSL Best Practices

```nginx
# /etc/nginx/snippets/ssl-params.conf

ssl_protocols TLSv1.3 TLSv1.2;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;

ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;

ssl_dhparam /etc/nginx/dhparam.pem;
```

This is a tighter, more deliberate version of the basic setup above, meant to be `include`d from every TLS `server` block so the policy lives in one place.

- **A short, explicit cipher list instead of a broad string** — rather than "allow anything matching this loose pattern," this names only forward-secret (`ECDHE`) AEAD ciphers. Forward secrecy means a future leak of the server's private key can't be used to retroactively decrypt previously captured traffic, because each session negotiated its own ephemeral key.
- **`ssl_prefer_server_ciphers off`** — in a config scoped to modern, already-strong ciphers, there's no longer a weak option for the client to accidentally pick, so there's no safety reason to override client preference — and TLS 1.3 removed the server-preference concept entirely, so this is really a statement that none of the remaining options here are worth fighting over.
- **`ssl_session_tickets off`** — session tickets are an alternative resumption mechanism to the session cache, but they come with a sharper downside: the ticket encryption key itself typically isn't rotated as carefully as the TLS private key, and a compromise of that key can retroactively expose every session resumed with it — undermining the forward secrecy the cipher choices above are trying to guarantee. Turning tickets off and relying solely on the shared session cache trades away a little resumption scalability (the cache doesn't resume across separate nginx hosts the way a shared ticket key could) for a meaningfully smaller blast radius if a key is ever compromised.
- **`resolver 8.8.8.8 8.8.4.4 valid=300s`** — OCSP stapling requires nginx to make its own DNS lookup (to find the CA's OCSP responder) and then an HTTP request, entirely independent of client traffic — this is the resolver that lookup uses, with results cached for 300 seconds.
- **`ssl_dhparam`** — an explicit, server-generated set of Diffie-Hellman parameters for cipher suites that use DHE key exchange. Supplying your own (`openssl dhparam -out dhparam.pem 2048`, or stronger) avoids every server on the internet relying on the same small set of default/well-known primes, which was the actual weakness behind the Logjam attack.

## Caching

### Proxy Cache Configuration

```nginx
http {
    proxy_cache_path /var/cache/nginx
                     levels=1:2
                     keys_zone=my_cache:10m
                     max_size=10g
                     inactive=60m
                     use_temp_path=off;

    server {
        listen 80;
        server_name example.com;

        location / {
            proxy_pass http://backend;

            proxy_cache my_cache;
            proxy_cache_key "$scheme$request_method$host$request_uri";
            proxy_cache_valid 200 60m;
            proxy_cache_valid 404 10m;
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
            proxy_cache_background_update on;
            proxy_cache_lock on;

            add_header X-Cache-Status $upstream_cache_status;

            proxy_cache_bypass $cookie_nocache $arg_nocache;
            proxy_no_cache $cookie_nocache $arg_nocache;

            include /etc/nginx/proxy_params;
        }

        location ~ /purge(/.*) {
            allow 127.0.0.1;
            deny all;
            proxy_cache_purge my_cache "$scheme$request_method$host$1";
        }
    }
}
```

**What each directive does**, grouped by what it's responsible for:

#### Where the cache lives

- **`proxy_cache_path`** — declares *where* and *how* cached responses are stored on disk, separately from any `server` block that actually uses it:
  - `levels=1:2` spreads cache files across a two-level directory hash (e.g. `/var/cache/nginx/a/1b/<rest-of-hash>`) instead of dumping everything into one flat directory, which would otherwise get slow once it holds hundreds of thousands of files.
  - `keys_zone=my_cache:10m` is a *shared memory* zone — separate from the disk cache itself — holding cache keys and metadata so nginx can check "is this cached, and is it still fresh?" without touching disk; 10m holds roughly 80,000 keys.
  - `max_size=10g` caps the on-disk cache size; a background process evicts the least-recently-used entries once it's exceeded.
  - `inactive=60m` evicts an entry if nothing has requested it in 60 minutes, *regardless* of whether it would still be considered fresh — this is different from `proxy_cache_valid` below, which governs freshness, not eviction-for-lack-of-use.
  - `use_temp_path=off` writes response bodies directly into the cache directory as they're received, instead of a separate temp directory followed by a rename — faster, at the cost of needing the cache and temp paths to be on the same filesystem (which `off` conveniently guarantees by removing the separate temp path).

#### Turning caching on for a location

- **`proxy_cache my_cache`** — turn caching on for this location, using the zone declared above.
- **`proxy_cache_key`** — exactly what identifies a "unique" cacheable response. Including `$scheme` and `$host` here isn't decorative — without them, a cache zone shared across multiple hostnames or across both HTTP and HTTPS versions of a site could serve one host's cached response to a request for a different host, which is a real cache-poisoning risk, not just an inefficiency.

#### Freshness and resilience

- **`proxy_cache_valid 200 60m` / `proxy_cache_valid 404 10m`** — freshness duration, set *per status code*. Caching `404`s (for a shorter time) is deliberate "negative caching" — it stops a flood of requests for a genuinely missing resource from hammering the backend repeatedly, while still re-checking periodically in case the resource shows up.
- **`proxy_cache_use_stale error timeout updating http_5xx`** — if the upstream is down, times out, or returns a server error, and there's a previously cached (even if technically expired) copy available, serve that stale copy instead of an error page. `updating` specifically covers the moment a cache entry is being refreshed — serve the old version to this request rather than making it wait. This trades perfect freshness for availability during an outage, which is almost always the right trade for anything that isn't financial or security-sensitive data.
- **`proxy_cache_background_update on`** — when a cached entry has just expired, serve the stale copy to the *current* request immediately, and kick off a background request to refresh the cache for the *next* request — rather than making this unlucky request wait through a full origin round-trip.
- **`proxy_cache_lock on`** — the thundering-herd / cache-stampede guard: when many requests arrive simultaneously for a URL that isn't yet cached, only the first one is actually sent to the upstream; the rest wait briefly for that first request to populate the cache, then get served from it — instead of all of them hitting the backend at once for the same uncached resource.

#### Visibility and overrides

- **`X-Cache-Status $upstream_cache_status`** — exposes nginx's own cache decision (`HIT`, `MISS`, `EXPIRED`, `STALE`, `UPDATING`, `BYPASS`) as a response header, purely for your own debugging — invaluable when trying to figure out why a response feels stale or why the backend load doesn't match expectations.
- **`proxy_cache_bypass` / `proxy_no_cache`** — two related but distinct controls: `proxy_cache_bypass` decides whether to *read from* the cache for this request; `proxy_no_cache` decides whether to *write to* the cache from this request's response. Both are driven by the same two signals here — a `nocache` cookie or query argument — covering the case where a logged-in or debugging user needs to see (and not pollute) the cache with a personalized or test response. Each directive accepts a *list* of variables, and is triggered if **any** of them is non-empty and not `"0"` — nginx ORs the list automatically, which matters for the fix noted in "Cache Purging and Management" below.

#### The purge endpoint

- **The `/purge` location** — deliberately restricted to `127.0.0.1` (the `ngx_cache_purge` third-party module that implements `proxy_cache_purge` isn't part of stock nginx and needs to be compiled in separately). This endpoint lets you manually invalidate one cached URL without waiting for `proxy_cache_valid` to expire it — and it must never be reachable from outside, since anyone who can hit it can force your backend to be hit for every cached URL they choose to purge.

### Static File Caching

```nginx
server {
    listen 80;
    server_name static.example.com;
    root /var/www/static;

    location ~* \.(jpg|jpeg|png|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(pdf|doc|docx)$ {
        expires 1d;
        add_header Cache-Control "public";
    }

    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

- **`expires 1y` + `immutable` for images/CSS/JS, `expires 1d` without it for documents** — the difference in duration reflects how these assets are typically versioned in practice: build-pipeline assets usually get a cache-busting filename (a content hash in the path) whenever they change, so it's safe to tell the browser "never even ask again for a year." A PDF or Word document is more often replaced in place at the same URL, so a short cache window still lets updates propagate reasonably quickly.
- **`access_log off`** on these locations — logging every single image and script request roughly doubles your log volume for comparatively little operational value; it's common to log only the HTML/API requests that actually represent meaningful application traffic and skip logging for high-volume static assets.
- **`open_file_cache max=1000 inactive=20s`** — nginx caches *file descriptors and metadata* (not file contents) for recently accessed files, avoiding a fresh `open()`/`stat()` syscall pair on every single request for the same file. `max=1000` caps how many files stay in this cache; `inactive=20s` evicts an entry that hasn't been used in 20 seconds.
- **`open_file_cache_valid 30s`** — even a cached entry is re-validated against the real filesystem every 30 seconds, so a file replaced on disk is picked up within that window rather than serving a stale cached handle indefinitely.
- **`open_file_cache_min_uses 2`** — a file has to be requested at least twice within the `inactive` window before nginx bothers caching its descriptor at all — a one-off request for an obscure file isn't worth the cache slot.
- **`open_file_cache_errors on`** — cache *negative* lookups too (file not found, permission denied), so a flood of requests for a genuinely missing file doesn't force a filesystem lookup on every single one.

### Cache Purging and Management

```nginx
location ~ /purge(/.*) {
    allow 127.0.0.1;
    deny all;
    proxy_cache_purge my_cache "$scheme$request_method$host$1";
}

map $request_method $skip_cache_by_method {
    POST 1;
    PUT 1;
    DELETE 1;
    default 0;
}

map $http_cookie $skip_cache_by_cookie {
    ~*admin 1;
    default 0;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_cache my_cache;
        proxy_cache_bypass $skip_cache_by_method $skip_cache_by_cookie;
        proxy_no_cache $skip_cache_by_method $skip_cache_by_cookie;
    }
}
```

**`map`** is nginx's lightweight lookup table: it evaluates one input variable against a set of patterns, once per request, and assigns the matching result to a new variable — closer to a `switch` statement than a loop, and cheap enough to use freely.

One correction worth calling out explicitly: declaring **two separate `map` blocks that both assign to the same variable name** (as an earlier version of this pattern did, both targeting `$skip_cache`) is invalid — nginx only allows one `map` declaration per variable, and will refuse to start with a "duplicate variable" error. The fix, shown above, is to give each condition its *own* output variable (`$skip_cache_by_method`, `$skip_cache_by_cookie`) and pass **both** to `proxy_cache_bypass`/`proxy_no_cache` — each of those directives already accepts a space-separated list and treats the request as a hit if **any** listed variable is non-empty and not `"0"`, so there's no need to combine the conditions into a single variable at all.

- **`map $request_method $skip_cache_by_method`** — never cache (or read cache for) anything other than a safe, idempotent method. Caching the *response* of a `POST`/`PUT`/`DELETE` would be actively wrong — those requests change state, and a cached copy could be served to a completely different, later request that expected a fresh result.
- **`map $http_cookie $skip_cache_by_cookie`** — if the request carries any cookie matching `admin` (case-insensitive, via the `~*` pattern prefix), skip the cache for it. This is a simple way to make sure admin/preview sessions always see live data rather than whatever the public cache currently holds.

## Security

### Rate Limiting

```nginx
http {
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/m;

    limit_conn_zone $binary_remote_addr zone=addr:10m;

    server {
        listen 80;
        server_name example.com;

        location / {
            limit_req zone=general burst=20 nodelay;
            limit_conn addr 10;
            proxy_pass http://backend;
        }

        location /api/ {
            limit_req zone=api burst=10 nodelay;
            limit_req_status 429;
            proxy_pass http://api_backend;
        }

        location /login {
            limit_req zone=login burst=2;
            proxy_pass http://auth_backend;
        }
    }
}
```

Nginx's rate limiter is a **leaky bucket**: requests fill the bucket, and it drains at a fixed rate (`rate=10r/s` means one request every 100ms, on average — not "10 at once, then wait a second"). Understanding that model explains every knob here.

- **`limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s`** — define a shared-memory zone tracking request rate per client IP (`$binary_remote_addr` is used rather than the text form specifically because it's smaller — a few bytes versus a variable-length string — which matters since this state exists once per tracked IP; 10m holds roughly 160,000 tracked IP states). `rate=10r/s` is the *sustained* rate this zone enforces.
- **`limit_req zone=general burst=20 nodelay`** — applies that zone to this location, and defines how far a client can exceed the steady rate briefly. Without `burst`, any request arriving faster than the configured rate is rejected immediately. With `burst=20`, up to 20 requests beyond the steady rate are allowed to queue — and *without* `nodelay`, nginx would hold and delay those queued requests to smooth them back out to the configured rate, adding latency rather than rejecting them outright. `nodelay` changes that: queued requests within the burst allowance are let through immediately, with no artificial delay, and only requests beyond the burst allowance are rejected (`503` by default). In practice, `burst ... nodelay` together is almost always what you actually want for user-facing traffic — delaying a request silently is a worse experience than either serving it immediately or rejecting it clearly.
- **Different zones for `general`, `api`, and `login`** — the whole point of scoping zones to specific locations is that different endpoints have very different legitimate traffic shapes. A login endpoint realistically needs a handful of attempts from a real user, not ten per second — `rate=1r/m` (one per minute) with a small `burst=2` is deliberately strict, since the main threat model here is credential-stuffing and brute-force attempts, not normal usage patterns.
- **`limit_req_status 429`** — nginx's own default rejection status is `503 Service Unavailable`, which is misleading for a rate-limit rejection — the service isn't actually unavailable, the client is just going too fast. `429 Too Many Requests` is the status code that actually means that, and well-behaved clients/libraries know to treat `429` as "back off and retry later" rather than "something's broken."
- **`limit_conn_zone` / `limit_conn addr 10`** — a separate mechanism from request *rate*: this caps *concurrent* connections per client IP, regardless of how fast or slow those connections are making requests. It guards against a different failure mode — one client opening far more simultaneous connections than any real browser would, tying up worker connection slots.

### Access Control

```nginx
server {
    listen 80;
    server_name admin.example.com;

    location /admin {
        allow 192.168.1.0/24;
        allow 10.0.0.1;
        deny all;

        proxy_pass http://admin_backend;
    }

    location /protected {
        auth_basic "Restricted Area";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://backend;
    }
}
```

```bash
htpasswd -c /etc/nginx/.htpasswd username
```

- **`allow` / `deny`** — evaluated **top to bottom, first match wins**, which is the detail that trips people up most: if `deny all;` were written *before* the `allow` lines instead of after, every request would hit the `deny all` first and the `allow` rules below it would be unreachable dead code. The order here — specific allows, then a catch-all deny — is the only order that actually works as intended.
- **`auth_basic` / `auth_basic_user_file`** — HTTP Basic Authentication: the browser prompts for a username/password, and nginx checks them against a file of hashed credentials created with `htpasswd`. It's simple and genuinely effective as a layer, but the credentials are sent on every request encoded (not encrypted) in the `Authorization` header — meaning Basic Auth over plain HTTP is close to sending a password in the clear, and should always be paired with TLS.
- **A geo-blocking example using a `$allowed_country` variable** is a common pattern you'll see in other guides, but it's worth flagging that such a variable doesn't exist by magic — it has to be populated yourself, typically via the `geo` directive (mapping IP ranges you maintain) or the GeoIP2 module (`ngx_http_geoip2_module`, loaded and configured with a MaxMind database) before any `if ($allowed_country = no)` check can mean anything.

### Security Headers

```nginx
# /etc/nginx/snippets/security-headers.conf

add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

- **`X-Frame-Options` / `X-Content-Type-Options`** — covered above: clickjacking and MIME-sniffing defenses, respectively.
- **`Referrer-Policy: strict-origin-when-cross-origin`** — controls how much of your own URL gets leaked to *other* sites when a user clicks a link away from you. This setting sends the full URL to same-origin destinations, but only the bare origin (no path or query string) cross-origin — a reasonable default that avoids leaking things like search terms or internal page paths in the `Referer` header to third parties.
- **`Content-Security-Policy`** — the modern, far more capable replacement for what `X-XSS-Protection` used to attempt, and worth treating as its own project rather than a copy-paste line: `default-src 'self'` here is a genuinely restrictive starting point (only allow resources from your own origin by default), deliberately *without* `'unsafe-inline'`/`'unsafe-eval'` — those two keywords, if added back in, reopen most of the inline-script injection vectors CSP exists to close. Getting a real site working under a strict CSP usually means moving inline `<script>` tags to external files or using per-request nonces — more effort than one header line, but that effort is the actual security benefit.
- **`Permissions-Policy`** — explicitly disables browser APIs your site doesn't use (geolocation, microphone, camera here), so that even an injected or third-party script embedded on your page can't invoke them.
- **`Strict-Transport-Security` with `preload`** — the same HSTS header as the TLS section, with one addition: `preload` is a signal that you intend to submit this domain to the browser vendors' hardcoded HSTS preload list, which ships inside the browser itself and applies *before the domain is ever visited once* — meaning there's no bootstrap request to upgrade from. This is effectively permanent once accepted into the list (removal is slow and manual), so it's worth being certain HTTPS is solid, on every subdomain, before opting in.

### DDoS Protection

```nginx
http {
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=5r/s;

    client_body_timeout 10s;
    client_header_timeout 10s;
    keepalive_timeout 5s 5s;
    send_timeout 10s;

    client_body_buffer_size 1k;
    client_header_buffer_size 1k;
    client_max_body_size 1m;
    large_client_header_buffers 2 1k;

    server {
        listen 80;
        server_name example.com;

        limit_conn conn_limit_per_ip 10;
        limit_req zone=req_limit_per_ip burst=10 nodelay;

        location ~ /(wp-admin|phpmyadmin|xmlrpc\.php) {
            deny all;
        }

        if ($http_user_agent ~* (bot|crawler|spider)) {
            return 403;
        }

        location / {
            proxy_pass http://backend;
        }
    }
}
```

It's worth being precise about what this actually defends against: nginx-level settings can shed excessively slow, excessively numerous, or obviously malformed requests cheaply — but they can't do anything about a volumetric flood that simply saturates the network link in front of the server, since by the time traffic reaches nginx, the damage to available bandwidth is already done. That kind of attack needs mitigation upstream — a CDN, a cloud provider's DDoS scrubbing service, or an ISP-level mechanism. What's below is real and useful, but it's "harden the application layer," not "stop a flood."

- **`client_body_timeout` / `client_header_timeout`** — this is specifically a **Slowloris** defense: an attacker opens many connections and sends a legitimate-looking request *extremely* slowly, one byte at a time, trying to exhaust every available worker connection slot by keeping them all technically "in progress" forever. These timeouts bound how long nginx will wait for the *next chunk* of a request's headers or body before giving up and closing the connection — not the total request duration.
- **`keepalive_timeout 5s 5s`** — the second value here sets the `Keep-Alive: timeout=5` response header sent to the client, in addition to nginx's own server-side keepalive timeout — explicitly telling well-behaved clients how long they can expect the connection to stay open, rather than leaving them to guess.
- **Small buffer sizes (`client_body_buffer_size 1k`, etc.)** — under normal circumstances these are generously sized; shrinking them here is a deliberate trade-off that makes nginx reject oversized or malformed requests (that would need to spill into a temp file or get flagged as "too large") faster and cheaper, at the cost of being more likely to reject unusually large but entirely legitimate requests too. This is a defensive posture for an endpoint under active attack, not a default you'd want on a general-purpose API that legitimately handles large payloads.
- **Blocking common vulnerability-scanner paths** (`wp-admin`, `phpmyadmin`, `xmlrpc.php`) — a cheap filter against the constant low-grade background noise of automated scanners probing for well-known, unrelated software — harmless to add even if you're not running WordPress or phpMyAdmin, since legitimate traffic never requests those paths anyway.
- **Blocking by `$http_user_agent`** — worth being honest about the limits here: a `User-Agent` string is just a header the client chooses to send, trivially spoofed by anything actually trying to cause harm. This blocks lazy, honest bots (and occasionally breaks a legitimate monitoring tool that happens to match the pattern) — it's a cheap, low-effort filter, not a real security control, and shouldn't be relied on as one.

## Performance Tuning

### Worker Process Optimization

```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}
```

- **`worker_processes auto`** — as in the basic configuration section, one worker per detected core. Because each worker is single-threaded, this is the only thing that actually lets nginx use more than one core.
- **`worker_rlimit_nofile 65535`** — raises the maximum number of open file descriptors *a worker process* is allowed, overriding the OS's default per-process limit (often 1024, which would otherwise silently cap nginx's real capacity regardless of what `worker_connections` says). This needs to comfortably exceed `worker_connections`, because every connection can consume more than one file descriptor at once — the client socket, plus (for a reverse proxy) the corresponding upstream socket, plus any open log or cache file handles.
- **`worker_connections 4096`** — raised from the earlier example's 1024. The real total connection budget is `worker_processes × worker_connections`, and — repeating the point from the basic configuration section because it's easy to forget when tuning — as a reverse proxy each client request can occupy two of those slots at once (client-facing and upstream-facing), so actual concurrent client capacity is roughly half of that raw total.
- **`use epoll` / `multi_accept on`** — covered above; included here because this is the section most guides reach for when "tuning for performance," which is also exactly why it's worth re-emphasizing that `multi_accept` is not a universal win and is worth load-testing for your actual traffic pattern before assuming it helps.

### Buffer and Timeout Tuning

```nginx
http {
    client_body_timeout 12;
    client_header_timeout 12;
    keepalive_timeout 15;
    send_timeout 10;

    client_body_buffer_size 16k;
    client_header_buffer_size 1k;
    client_max_body_size 8m;
    large_client_header_buffers 4 8k;

    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    proxy_busy_buffers_size 8k;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_disable "msie6";

    keepalive_requests 100;
}
```

Most of these directives are explained where they first appear earlier in this guide (client-facing timeouts and buffers in the DDoS section, `proxy_*` buffering in Reverse Proxy, `sendfile`/`tcp_nopush`/`tcp_nodelay` and gzip in Basic Configuration) — this block is really a general-purpose, "sane defaults for a production site under normal load" tuning profile rather than new concepts. Two things worth calling out that are new here:

- **`client_max_body_size 8m`** — the hard ceiling on request body size nginx will accept before rejecting with `413 Request Entity Too Large`. This is the single most common "why does my file upload fail" support ticket in any nginx-fronted app — the application itself can be configured to accept a larger upload, but if this value is smaller, nginx rejects the request before the application ever sees it.
- **`gzip_comp_level 6`** — compression level trades CPU time for smaller output, on a scale of 1–9, with sharply diminishing returns: going from 6 to 9 typically costs noticeably more CPU for a size reduction too small to matter, which is why 6 is the commonly recommended sweet spot rather than simply maxing it out. `gzip_disable "msie6"` is a legacy carve-out for an old Internet Explorer version with buggy gzip handling — harmless to leave in, essentially a no-op on current traffic.

### Caching and Static File Optimization

```nginx
http {
    open_file_cache max=10000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;

    server {
        listen 80;
        server_name example.com;

        sendfile on;

        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
            sendfile on;
            tcp_nopush on;
        }
    }
}
```

The same `open_file_cache` and static-asset caching directives covered in the Caching section, applied at a larger scale (`max=10000` instead of `1000`) and extended to cover web-font formats (`woff`, `woff2`, `ttf`, `eot`) alongside the earlier image/CSS/JS list — fonts are exactly the kind of rarely-changing, cache-busted build asset where `immutable` caching makes sense, and they're easy to forget when writing this regex by hand.

## Common Patterns

### Single Page Application (SPA)

```nginx
server {
    listen 80;
    server_name app.example.com;
    root /var/www/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api_backend;
        include /etc/nginx/proxy_params;
    }

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- **`try_files $uri $uri/ /index.html`** — the key difference from the plain static-site version earlier in this guide, which ended its `try_files` chain with `=404`. A client-side router (React Router, Vue Router, etc.) handles paths like `/dashboard/settings` entirely in JavaScript, in the browser — there is no actual file at that path on disk. If a user hits reload on that URL, or follows a direct link to it, nginx needs to serve the *same* `index.html` it would for `/`, and let the client-side router take over from there and render the right view. Falling through to `/index.html` instead of a `404` is exactly what makes deep-linking and page refreshes work in an SPA.
- **One consequence worth knowing:** every unmatched path now *looks* identical to nginx — a request for a non-existent route and a request for a valid client-side route both silently return the same `200 index.html` response. Nginx's own access logs and caching rules can't tell them apart; if you need real visibility into which client-side routes are actually being visited, that has to come from application-level analytics, not the nginx log.

### Docker with Nginx

```yaml
# docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./html:/usr/share/nginx/html:ro
    depends_on:
      - app
    networks:
      - app-network

  app:
    image: node:18
    networks:
      - app-network
```

```nginx
# nginx.conf for Docker
upstream app {
    server app:3000;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- **`server app:3000`** — this works because Docker runs an embedded DNS server for any user-defined network (`app-network` here); service names declared in `docker-compose.yml` become resolvable hostnames, but *only* for containers attached to that same named network. `app` is not resolvable from outside this Docker network, which is exactly the point — the application container doesn't need (or get) a publicly exposed port at all; only nginx does.
- **`ports: "80:80"`** — the `host:container` mapping. Only nginx's ports are published to the host machine; the `app` service has no `ports:` entry, so it's reachable only from inside `app-network` — nginx is the sole public entry point by construction, not just by convention.
- **`volumes: ...:ro`** — mounting configuration and static content read-only into the container is a small but real hardening step: even if something inside the nginx container were compromised, it can't modify its own configuration or served files.
- **`depends_on: - app`** — a common misconception worth correcting directly: this only controls **start order** (Docker Compose starts `app` before `nginx`), not actual **readiness**. Nginx can start, and successfully bind its ports, before the `app` container is actually accepting connections on 3000 — in which case nginx will return `502 Bad Gateway` for a brief window until the app finishes starting up. For most deployments this is a non-issue (a short-lived 502 during a rolling restart), but if you need an actual readiness guarantee before traffic flows, that needs a real health check (Docker Compose's `healthcheck:` + `condition: service_healthy`, or an orchestrator's readiness probe) — `depends_on` alone doesn't provide one.

## Monitoring and Logging

### Custom Log Format

```nginx
http {
    log_format detailed '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" '
                       'rt=$request_time uct="$upstream_connect_time" '
                       'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log detailed;
}
```

The four timing variables at the end are what turn an access log from "what happened" into "where did the time actually go" — each measures a different phase of the request:

- **`$request_time`** — total wall-clock time nginx spent on the entire request, from receiving the first byte to finishing the response. This is the number closest to what the client actually experienced.
- **`$upstream_connect_time`** — just the TCP (and TLS, if applicable) handshake time to reach the backend. Consistently high values here point at network latency or an overloaded backend struggling to accept new connections — not slow application code.
- **`$upstream_header_time`** — time from sending the request to the upstream until the first byte of its response headers comes back. This is effectively "how long the backend took to actually process the request" — the number to watch when a slow database query or expensive computation is the suspected culprit.
- **`$upstream_response_time`** — total time to receive the *entire* response body from upstream, which can be meaningfully larger than `$upstream_header_time` alone for a large or slowly-streamed response.

Logging all four side by side means a slow request can be diagnosed from the log line itself — a high `$upstream_header_time` with a low `$upstream_connect_time` points squarely at backend processing speed, while the reverse points at network or connection-acceptance issues, without needing to reproduce the problem live.

### Status Module

```nginx
server {
    listen 8080;
    server_name localhost;

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

- **`stub_status on`** — exposes nginx's own basic operating metrics as plain text: active connections, and running totals for accepted connections, handled connections, and total requests, plus a breakdown of connections currently reading a request, writing a response, or idly waiting (keep-alive). It's intentionally minimal — for real metrics aggregation and dashboards, this endpoint is typically scraped by something like Prometheus's `nginx-exporter`, rather than read directly.
- **`allow 127.0.0.1; deny all;`** — this endpoint reveals real operational data about your server's load and traffic — it's restricted to localhost for the same reason the cache-purge endpoint was: it should never be reachable from the public internet.

## Best Practices

1. **Use `upstream` blocks for backend servers** — even a single backend benefits, since it gives you a named target that's trivial to extend with load balancing or health-check settings later without touching every `proxy_pass` line.
2. **Enable HTTP/2** wherever you're already terminating TLS — the multiplexing benefit is close to free once a certificate is in place.
3. **Cache deliberately, not by default** — caching is a correctness trade-off (serving potentially-stale data) in exchange for speed and reduced backend load; know which responses are safe to cache before turning it on broadly.
4. **Log the timing variables**, not just status and size — `$request_time` and the `$upstream_*` variables are what make a slow-request investigation possible from logs alone.
5. **Use modern TLS only** — `TLSv1.2`/`TLSv1.3`, forward-secret ciphers, and let an unused protocol version be one less thing to ever worry about.
6. **Rate limit by endpoint sensitivity**, not with one blanket number — a login endpoint and a static asset endpoint have nothing in common in terms of legitimate traffic shape.
7. **Treat security headers as a starting point, not a checklist** — a `Content-Security-Policy` with `'unsafe-inline'` left in provides much less protection than the header name implies.
8. **Monitor `stub_status` (or an exporter built on it)**, not just uptime — connection and request counters catch gradual degradation long before an outage does.
9. **Keep nginx updated** — TLS and HTTP parsing code is exactly the kind of security-sensitive surface where staying current matters.
10. **Always run `nginx -t` before reloading** — a config typo caught here costs nothing; the same typo caught by a failed reload costs a production incident.

## Useful Commands

```bash
nginx -t          # Validate configuration syntax without applying it
nginx -s reload    # Re-read config into the running master; workers restart gracefully, zero dropped connections
nginx -s stop      # Immediate shutdown
nginx -s quit      # Graceful shutdown — finish in-flight requests first, then exit
nginx -V           # Show version, build flags, and compiled-in modules
nginx -T           # Dump the fully-resolved configuration (all includes expanded) — useful for confirming what's actually active
```

`nginx -s reload` is the reason configuration changes don't need downtime: the master process validates and loads the new configuration, starts a fresh set of workers using it, and lets the *old* workers finish any requests already in flight before exiting — a `restart` would instead drop every open connection immediately. This is also exactly why running `nginx -t` first matters: `reload` on a broken config fails safely (the old workers keep running on the last-known-good config), but it's still worth never finding that out by accident in production.

## Summary

Nginx is a powerful, flexible tool for:
- Serving static content
- Reverse proxying to applications
- Load balancing across servers
- SSL/TLS termination
- Caching responses
- Rate limiting and security
- High-performance web serving

The directives in this guide cover the large majority of real-world nginx configuration — the remaining skill is less about memorizing more directives and more about reading `nginx -t` output, `error_log`, and the `$upstream_*` timing variables closely enough to know which of these tools actually applies to the problem in front of you.
