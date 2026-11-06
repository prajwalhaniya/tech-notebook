# Nginx for Real-Time

## Nginx for Real-Time Chat, Video Streaming, and SSE

[Nginx Fundamentals](./01_Nginx_Fundamentals.md) covers the ordinary case: a request comes in, nginx (optionally) proxies it, a response goes out, done. Chat, live video, and server-sent events all break that shape on purpose — a chat connection stays open for hours, a video response needs to be seekable and partially delivered, an SSE stream needs to push bytes the instant they exist rather than waiting to assemble a full response. Nginx can do all three well, but only once it's told explicitly not to behave like it would for an ordinary request.

This guide assumes the basic reverse proxy and performance material from Nginx Fundamentals and focuses on what's different for these three use cases, with full configuration for each.

## Table of Contents
1. [The Shared Problem: Long-Lived Connections](#the-shared-problem-long-lived-connections)
2. [WebSockets for Real-Time Chat](#websockets-for-real-time-chat)
3. [Server-Sent Events (SSE)](#server-sent-events-sse)
4. [Video Streaming](#video-streaming)
5. [Capacity Planning for Many Concurrent Connections](#capacity-planning-for-many-concurrent-connections)
6. [Complete Reference Configuration](#complete-reference-configuration)

## The Shared Problem: Long-Lived Connections

Nginx's default behavior for a proxied request is to **buffer**: read the entire upstream response (or enough of it) into memory, then hand it to the client. That's the right default for a typical API response — it frees the backend quickly and lets nginx handle a slow client on its own. It's exactly the wrong default for all three use cases here:

- A **chat** connection over WebSockets isn't a request/response at all — it's a long-lived, bidirectional pipe that has to stay open and unbuffered in both directions for as long as the conversation lasts.
- An **SSE** stream is a single, never-ending HTTP response — if nginx buffers it waiting for "enough" data or for the response to finish, the client gets nothing until the stream ends, which defeats the entire point of pushing events in real time.
- **Video** streaming needs the opposite problem solved: not "deliver this instantly," but "let the client jump to any byte offset or quality level without re-downloading everything before it."

Everything in the rest of this guide is really one of two things: turning buffering off where it would silently break real-time delivery, or turning on nginx's byte-range and file-serving machinery where it enables seeking and adaptive playback.

## WebSockets for Real-Time Chat

A WebSocket connection begins as a normal HTTP request that asks to be **upgraded** to a different protocol, then stays open indefinitely as a raw bidirectional socket. Nginx Fundamentals showed a minimal WebSocket proxy; this is the production-grade version.

### The canonical Upgrade/Connection map

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

Hardcoding `proxy_set_header Connection "upgrade";` (as a quick example often does) works only as long as *every* request to that location is actually a WebSocket upgrade. If the same path ever needs to serve an ordinary HTTP request too, forwarding a hardcoded `Connection: upgrade` header to a backend that wasn't asking to upgrade is a protocol violation waiting to happen. This `map` is nginx's standard answer: if the client's `Upgrade` header is present (meaning it's actually requesting an upgrade), forward `Connection: upgrade`; if the client didn't send an `Upgrade` header at all (`$http_upgrade` is empty), forward `Connection: close` instead, matching ordinary HTTP semantics. Declare it once at the `http {}` level and reuse `$connection_upgrade` in every location that might see either kind of request.

### Full chat proxy configuration

```nginx
http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    upstream chat_backend {
        ip_hash;
        server chat1.internal:4000;
        server chat2.internal:4000;
    }

    server {
        listen 443 ssl http2;
        server_name chat.example.com;

        location /ws/ {
            proxy_pass http://chat_backend;

            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;

            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
    }
}
```

**What's new here, beyond the basic WebSocket proxy in Nginx Fundamentals:**

- **`proxy_set_header Connection $connection_upgrade`** — uses the `map` above instead of a hardcoded string, for the reason just explained.
- **`ip_hash` on the upstream** — a WebSocket connection is pinned to whichever backend process accepted it for its entire lifetime; there's no per-request re-routing once it's open. `ip_hash` makes sure a given client consistently reaches the same backend across reconnects, which matters if that backend is holding any in-memory state about the client (their presence, their room membership, a pending message queue). The trade-off, covered in the Load Balancing guide, is real: if a backend goes down, clients hashed to it don't fail over gracefully to a server holding their state — they simply reconnect to a different, "cold" backend.
- **`proxy_read_timeout 3600s` / `proxy_send_timeout 3600s`** — stretched to an hour, because an idle but perfectly healthy chat connection (no one's typing) would otherwise be killed by the default 60-second timeouts as if it had stalled.

### Sticky sessions vs. a shared message backend

`ip_hash` is the simplest way to get session affinity, but it's a workaround for a deeper architectural question: **does a message to user B have to be delivered by the exact backend process that holds B's open socket?** If each chat server process only knows about the sockets connected directly to it, then yes — and you need sticky routing (`ip_hash`, or a cookie-based alternative) so a message can actually reach the right process.

The alternative, used by most real chat systems at scale, is to decouple "who holds the socket" from "who knows about the message": every backend instance subscribes to a shared pub/sub layer (Redis, NATS, a message queue), and a message for user B is published to that layer regardless of which instance published it — whichever instance currently holds B's socket picks it up and delivers it. With that architecture in place, nginx can load balance chat connections with an ordinary `least_conn`, exactly like any other backend, because no single process needs to "own" a particular user. This is worth knowing before reaching for `ip_hash` by default: it's the easy fix, not necessarily the right long-term one.

### Heartbeats: nginx's timeout isn't your app's timeout

Nginx has no idea what a WebSocket ping/pong frame is — to nginx, a WebSocket connection is just an opaque TCP byte stream once the upgrade handshake completes. `proxy_read_timeout` only fires if *nothing at all* crosses the wire for that long; it can't tell a genuinely dead connection from one where the application simply hasn't sent a chat message in the last 10 minutes.

That means heartbeats are the application's job, not nginx's: have the client or server send a small ping frame on a fixed interval (commonly 20–30 seconds) and treat a missed pong as a dead connection at the application layer. Nginx's `proxy_read_timeout` should be set comfortably *longer* than that application heartbeat interval (not shorter) — it exists purely as a last-resort cleanup for connections where even the TCP-level traffic has gone silent, not as the primary liveness check.

## Server-Sent Events (SSE)

SSE is a much simpler protocol than WebSockets — it's just a single long-lived HTTP response with `Content-Type: text/event-stream`, where the server writes `data: ...\n\n` lines as events happen and the connection never formally "completes" until the server (or client) closes it. The browser's `EventSource` API handles reconnection and replays missed events automatically (via a `Last-Event-ID` header), which is most of why it's simpler to operate than WebSockets for one-directional, server-to-client updates — notifications, live dashboards, progress updates, AI response streaming.

Because it's "just HTTP," it's easy to assume SSE needs no special nginx configuration at all — and that assumption is exactly what breaks it, because nginx's default buffering holds the entire response until it thinks there's enough to send.

### Required configuration

```nginx
server {
    listen 443 ssl http2;
    server_name events.example.com;

    location /events/ {
        proxy_pass http://sse_backend;

        proxy_http_version 1.1;
        proxy_set_header Connection '';

        proxy_buffering off;
        proxy_cache off;
        gzip off;

        proxy_read_timeout 3600s;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**What each setting is actually preventing:**

- **`proxy_buffering off`** — this is the one setting that matters most for SSE. With buffering on, nginx accumulates the proxied response in its own buffers and only forwards it to the client in chunks once those buffers fill or the backend finishes — for a stream that's intentionally never-ending, that means the client could wait indefinitely for data that's already sitting on the server. Turning it off makes nginx forward each write from the backend to the client immediately.
- **`proxy_cache off`** — belt-and-suspenders: if a `proxy_cache` zone happens to be active at a broader scope (the `http {}` or `server {}` level) for reasons unrelated to this location, explicitly disabling it here guarantees a streaming response is never accidentally treated as a cacheable, finite body.
- **`gzip off`** — compression has the same fundamental conflict with streaming as buffering does: gzip wants to accumulate enough output to compress efficiently before writing anything, which reintroduces exactly the delay `proxy_buffering off` was meant to remove.
- **`proxy_set_header Connection ''`** — clears the `Connection` header nginx would otherwise forward, for the same keepalive-to-upstream reason covered in the Load Balancing guide — relevant here if this backend is also behind a `keepalive` upstream pool.
- **`proxy_read_timeout 3600s`** — same reasoning as the WebSocket case: an SSE connection can be legitimately silent for long stretches between events, and the default 60-second timeout would mistake that silence for a stalled backend.

### Letting the application control buffering per-response

Blanket-disabling buffering for an entire `location` isn't always convenient — sometimes the same path serves both a streaming and a non-streaming response depending on a query parameter or route. Nginx has a response header specifically for this: if the proxied application sets

```
X-Accel-Buffering: no
```

on its response, nginx disables buffering for *that response specifically*, without needing a dedicated `location` block or touching the nginx config at all. This is the better option when the decision of "should this response stream" genuinely belongs to the application rather than to routing.

### Heartbeats, again — but at the protocol level this time

Unlike WebSockets, SSE heartbeats are visible to the protocol itself: a comment line (any line starting with `:`) is valid SSE syntax that the `EventSource` API silently ignores, and sending one periodically —

```
: keep-alive

```

— is the standard way to keep an otherwise-idle SSE connection producing *some* bytes. This matters for a layer nginx's own `proxy_read_timeout` doesn't cover: corporate proxies, some cloud load balancers, and NAT gateways between the client and your edge often have their own idle-connection timeout, shorter than anything you control, that silently drops a connection with zero bytes flowing for too long. A heartbeat comment every 15–30 seconds keeps the connection looking "active" to every hop in between, not just to nginx.

## Video Streaming

"Video streaming" covers three genuinely different problems, and nginx's role is different in each.

### Progressive download (seekable MP4)

The simplest case: a single `.mp4` file, served so a `<video>` tag can seek to an arbitrary point without downloading everything before it. This relies on two things working together — one on the encoding side, one on nginx's:

- **The file must be "faststart" encoded** — an MP4's `moov` atom (the index of where every frame lives in the file) has to be at the *front* of the file, not the end, which is where most encoders put it by default. Re-encoding or remuxing with `ffmpeg -i input.mp4 -movflags +faststart output.mp4` moves it. Without this, a player has to download the entire file before it can even calculate where frame N lives, which makes seeking before a full download effectively impossible.
- **Nginx needs the `mp4` module enabled** for the location serving the file:

```nginx
location ~ \.mp4$ {
    mp4;
    mp4_buffer_size 1m;
    mp4_max_buffer_size 5m;
}
```

`mp4` turns on pseudo-streaming: when a player requests `?start=120` (seconds), nginx — using the `moov` atom it can now find quickly because of faststart — recalculates the byte ranges for exactly the frames from that point forward and serves only those, instead of the whole file. `mp4_buffer_size`/`mp4_max_buffer_size` bound how much of that index nginx is willing to buffer in memory while doing the recalculation; the defaults are conservative, and a video with an unusually large `moov` atom (many short segments, lots of metadata) may need `mp4_max_buffer_size` raised to avoid nginx rejecting the seek.

This module is a standard but optional compile-time feature — confirm it's actually present with `nginx -V 2>&1 | grep -o http_mp4_module` before relying on it; most distro packages and the official Docker images include it, but a custom-compiled nginx might not.

Ordinary **range requests** (a player asking for `Range: bytes=1000000-2000000` of a static file) need no special configuration at all — nginx's core file-serving support honors `Range` headers automatically for any static file served via `sendfile`, which is already the sane default from Nginx Fundamentals.

### Adaptive bitrate streaming (HLS / DASH)

Live and adaptive streaming don't send one file — they send a constantly updated **manifest** (`.m3u8` for HLS, `.mpd` for DASH) listing many small **segments** (`.ts` or fragmented `.m4s` files, typically 2–10 seconds each), encoded at several quality levels. Something else (ffmpeg, OBS, a dedicated media server) is almost always what's actually *producing* these files; nginx's job is usually just to be a correct, fast, well-cached edge for serving them.

```nginx
http {
    types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t                    ts;
        application/dash+xml          mpd;
    }

    server {
        listen 443 ssl http2;
        server_name stream.example.com;
        root /var/www/hls;

        location ~* \.m3u8$ {
            add_header Cache-Control "no-cache";
            add_header Access-Control-Allow-Origin *;
        }

        location ~* \.(ts|m4s)$ {
            add_header Cache-Control "public, max-age=31536000, immutable";
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

**Why each piece matters:**

- **Correct MIME types for the manifest** — some HLS/DASH players sniff the `Content-Type` of the manifest to decide how to parse it; nginx's default `mime.types` file doesn't necessarily include `.m3u8` or `.mpd`, so it's worth declaring explicitly rather than falling back to `application/octet-stream`. Segment files (`.ts`/`.m4s`) matter less in practice here — browsers consume them through the Media Source Extensions API, which the player's own JavaScript feeds directly, bypassing the browser's normal content-type-based handling — but declaring them correctly is still good hygiene and matters for any tooling (CDNs, proxies) that does inspect it.
- **Opposite caching rules for manifest vs. segments, and why** — a live `.m3u8` manifest is rewritten every few seconds as new segments become available; caching it even briefly means players keep fetching a stale segment list and falling behind or stalling. A segment file, once written, **never changes** — its filename already encodes its position in the stream, so it's safe to cache for a year and mark `immutable`. Getting this backwards (caching the manifest, not caching segments) is the single most common HLS misconfiguration, and it manifests as "the stream works but keeps freezing a few seconds behind live."
- **`Access-Control-Allow-Origin`** — HLS.js and dash.js (the JavaScript libraries most browsers need to play these formats, since native HLS support is Safari-only) fetch the manifest and segments via ordinary `fetch`/XHR from the page's own origin — which is frequently a different origin than the media host or CDN. Without CORS headers, the browser silently blocks the player from reading the response at all, even though the network request itself succeeds — a frustrating failure mode to debug without already suspecting CORS.
- **Large-file serving (`aio`, `directio`)** — for segment or progressive-file sizes large enough to matter, `aio on;` combined with `directio 512;` (inside the relevant `location` or `http` block) tells nginx to read large files via asynchronous I/O that bypasses the OS page cache, instead of `sendfile`'s default synchronous path. The trade-off: this avoids one very large file evicting everything else useful from the page cache, at the cost of not benefiting from the page cache for that file's own repeated reads — generally worth it once individual files are comfortably larger than available RAM, and not worth the added complexity below that.

### Live ingest via RTMP (optional, third-party)

Everything above assumes segments already exist on disk. Getting a live broadcast (from OBS, ffmpeg, or a hardware encoder) *into* that state — ingesting a live RTMP push and transmuxing it into HLS segments in real time — is not something stock nginx does. It requires the third-party **`nginx-rtmp-module`**, compiled into nginx from source (`--add-module=/path/to/nginx-rtmp-module`), or a prebuilt image that already includes it.

```nginx
rtmp {
    server {
        listen 1935;

        application live {
            live on;
            hls on;
            hls_path /var/www/hls;
            hls_fragment 4s;
            hls_playlist_length 30s;
        }
    }
}
```

This opens an RTMP listener on port 1935 (what OBS and most encoders push to by default), and for every stream published under the `live` application, continuously writes 4-second HLS segments and a rolling 30-second playlist to `/var/www/hls` — exactly the directory the `http {}` block above serves as static files. The `rtmp {}` block lives alongside, not inside, the `http {}` block, since it's an entirely separate protocol listener. As with the Nginx Plus features noted in Nginx Fundamentals, it's worth being upfront that this isn't a core nginx capability before planning a deployment around it.

## Capacity Planning for Many Concurrent Connections

Chat, SSE, and video streaming stress a server in two genuinely different ways, and conflating them leads to tuning the wrong knob.

- **Chat and SSE are "wide and shallow"** — potentially tens of thousands of simultaneous connections, each one mostly idle, sending only small messages infrequently. The bottleneck here is almost never bandwidth or CPU — it's the number of connections nginx (and the OS) can simply *hold open* at once.
- **Video streaming is "narrow and deep"** — far fewer concurrent connections than a chat server might hold, but each one continuously pulling megabits of data. The bottleneck here is bandwidth and disk/CPU throughput, not connection count.

For the "wide and shallow" case, the connection math from Nginx Fundamentals' performance tuning section is the whole story, worth restating in this specific context: `worker_connections` is a hard per-worker ceiling, a proxied connection can cost **two** file descriptors (client-facing and backend-facing) rather than one, and `worker_rlimit_nofile` has to be raised well above `worker_processes × worker_connections` or the OS-level limit becomes the real ceiling regardless of what nginx itself is configured to allow. A server aiming to hold 50,000 concurrent chat connections needs headroom closer to 100,000+ file descriptors once the backend-facing half of each proxy is counted, split across however many workers are actually running.

For the "narrow and deep" video case, the connection-count math matters far less than it does for chat — a video server rarely needs tens of thousands of simultaneous connections before bandwidth is already the limiting factor. `sendfile`, `tcp_nopush`, and (for very large files) `aio`/`directio` from the sections above are the actual levers; raising `worker_connections` further doesn't help once the network link itself is saturated.

Keepalive to the upstream (`keepalive N;` in the `upstream {}` block, covered in the Load Balancing guide) matters most for chat and SSE backends that handle many short-lived HTTP requests *in addition to* their long-lived connections — a REST API alongside a WebSocket endpoint, for instance — since it avoids a fresh TCP handshake to the backend on every ordinary request. It does nothing for the WebSocket/SSE connections themselves, which are already long-lived and don't repeatedly reconnect by design.

## Complete Reference Configuration

Combining chat, SSE, and HLS video behind one nginx instance, with each concern isolated to its own location:

```nginx
http {
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t                    ts;
    }

    upstream chat_backend {
        ip_hash;
        server chat1.internal:4000;
        server chat2.internal:4000;
    }

    upstream events_backend {
        least_conn;
        server events1.internal:5000;
        server events2.internal:5000;
    }

    server {
        listen 443 ssl http2;
        server_name app.example.com;

        ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

        location /ws/ {
            proxy_pass http://chat_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }

        location /events/ {
            proxy_pass http://events_backend;
            proxy_http_version 1.1;
            proxy_set_header Connection '';
            proxy_buffering off;
            proxy_cache off;
            gzip off;
            proxy_read_timeout 3600s;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        location /hls/ {
            alias /var/www/hls/;

            location ~* \.m3u8$ {
                add_header Cache-Control "no-cache";
                add_header Access-Control-Allow-Origin *;
            }

            location ~* \.ts$ {
                add_header Cache-Control "public, max-age=31536000, immutable";
                add_header Access-Control-Allow-Origin *;
            }
        }
    }
}
```

Each `location` here maps directly to one section above: `/ws/` is the chat guidance, `/events/` is the SSE guidance, `/hls/` is the adaptive-streaming guidance — none of them share settings with each other on purpose, since buffering off for SSE, for instance, would be actively harmful applied to the video location by accident. Nesting the `.m3u8`/`.ts` rules inside `location /hls/` (rather than the bare `~* \.m3u8$` form shown earlier) keeps the caching rules scoped to this one served directory, in case other `.m3u8` files exist elsewhere on the same server with different requirements.
