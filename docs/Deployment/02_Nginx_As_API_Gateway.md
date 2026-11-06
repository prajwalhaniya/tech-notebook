# Nginx as an API Gateway

A reverse proxy forwards requests. An **API gateway** does that too, but it also takes on the things every API endpoint behind it would otherwise need to implement separately: authentication, per-client rate limiting, a consistent error format, request tracing, CORS, and routing by version — once, at the edge, instead of duplicated (or forgotten) in every backend service. Nginx Fundamentals already covers path-based routing to multiple backends; this guide covers everything else that turns that routing into an actual gateway.

Stock, open-source nginx handles a genuinely large share of this well. A few pieces are commercial-only (flagged clearly below) or realistically need a small amount of application logic alongside nginx rather than nginx alone — also flagged, rather than glossed over.

## Table of Contents
1. [Routing: Beyond a Single Backend](#routing-beyond-a-single-backend)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Rate Limiting Per API Consumer](#rate-limiting-per-api-consumer)
4. [Request and Response Transformation](#request-and-response-transformation)
5. [A Consistent Error Contract](#a-consistent-error-contract)
6. [API Versioning](#api-versioning)
7. [gRPC Gateways](#grpc-gateways)
8. [Observability at the Gateway](#observability-at-the-gateway)
9. [What Nginx Doesn't Do for You](#what-nginx-doesnt-do-for-you)
10. [Complete Reference Configuration](#complete-reference-configuration)

## Routing: Beyond a Single Backend

The core mechanism is exactly the microservices routing pattern from Nginx Fundamentals — one public hostname, many `location` blocks, each pointed at a different `upstream`. A gateway's routing table is the same idea at a larger scale, with a few additions worth calling out:

```nginx
location /api/v1/users/ {
    rewrite ^/api/v1/users/(.*)$ /$1 break;
    proxy_pass http://user_service;
}
```

**`rewrite ... break`** — strips the `/api/v1/users/` prefix before the request reaches the backend, so `user_service` only ever sees `/123`, not `/api/v1/users/123`. This matters because backend services are rarely written to know (or care) what public path they're mounted under — the gateway owns the public URL shape, the backend owns its own internal one, and `rewrite` is the seam between them. (A trailing slash on both the `location` and the `proxy_pass` target — `proxy_pass http://user_service/;` — achieves the same prefix-stripping without an explicit `rewrite`, and is the simpler choice when there's no other transformation needed; `rewrite` is worth reaching for once the path needs more than a prefix removed.)

Everything from Nginx Fundamentals' Location Matching section — the exact-match / `^~` / regex / prefix priority order — applies at gateway scale exactly as written, just with far more locations competing for the same request. A gateway with fifty routes is the single most common place that priority order actually bites someone, because the rules were added by fifty different people over time rather than designed as one table.

## Authentication and Authorization

This is the part a plain reverse proxy doesn't do and a gateway has to: deciding whether a request is allowed through *before* it reaches a backend, once, instead of trusting every backend to check correctly.

### Delegated auth with `auth_request`

The realistic, open-source pattern is to not implement auth logic in nginx config at all, but to delegate the decision to a small internal service and let nginx act on the answer:

```nginx
location /api/ {
    auth_request /_validate;
    auth_request_set $user_id $upstream_http_x_user_id;
    auth_request_set $user_tier $upstream_http_x_user_tier;

    proxy_set_header X-User-Id $user_id;
    proxy_set_header X-User-Tier $user_tier;
    proxy_pass http://backend;
}

location = /_validate {
    internal;
    proxy_pass http://auth_service/validate;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header Authorization $http_authorization;
}
```

**How this actually works:** before nginx proxies the real request, it fires an internal *subrequest* to `/_validate` and waits for its response. A `2xx` from that subrequest lets the real request through; a `401` or `403` is returned to the client immediately, and the real backend never sees the request at all.

- **`internal;`** on the validation location is what stops a client from hitting `/_validate` directly from outside — it only answers subrequests nginx generates itself.
- **`proxy_pass_request_body off;` / `Content-Length ""`** — the auth check almost never needs the original request body (a large file upload, say), so this avoids forwarding it a second time just to ask "is this allowed."
- **`X-Original-URI $request_uri`** — the one piece of context the auth service usually *does* need: which path and query string is actually being requested, so it can make a path-specific authorization decision (not just "is this token valid," but "is this token valid *for this resource*").
- **`auth_request_set`** — this is how data flows back out of the subrequest into variables nginx can use: `$upstream_http_x_user_id` reads the `X-User-Id` response header the auth service set, and the line below hands it to the real backend as its own header. This is the mechanism that turns "nginx checked a token" into "the backend receives an already-resolved user ID," so the backend doesn't have to re-parse or re-validate anything itself.

### JWT verification specifically

Stock nginx has no built-in JWT parser — verifying a signature and reading claims is logic, not configuration, and nginx's core deliberately doesn't embed a JSON/JWT library. Three realistic options, in order of how much custom code they require:

1. **Delegate to the `auth_request` backend above**, and have that small service do the actual JWT verification in whatever language it's written in. This is the lowest-effort, most common real-world answer, and it's also where claim-based authorization logic (scopes, roles, expiry) naturally belongs rather than in nginx config.
2. **`njs`**, nginx's official embedded JavaScript module, can decode and verify a JWT directly inside nginx if avoiding a separate service is worth the added complexity — it ships with official nginx packages but needs an explicit `load_module` line and a small script:

```nginx
load_module modules/ngx_http_js_module.so;

http {
    js_import auth from auth.js;

    server {
        location /api/ {
            js_content auth.verifyToken;
        }
    }
}
```

The exact directive names (`js_import`, `js_content`, vs. older `js_include`/`js_set` forms) have changed across njs/nginx releases, so check the version actually being deployed against the current njs module docs rather than assuming the snippet above matches it exactly.

3. **`auth_jwt`** is native, built-in JWT validation — but it's an **Nginx Plus** feature, not available in open-source nginx. Worth knowing it exists so a team evaluating Plus doesn't have to independently discover this is one of the things it buys.

### mTLS for service-to-service gateway traffic

For an internal, zero-trust-style gateway where the "clients" are other services rather than end users, client certificate authentication is a legitimate alternative to tokens entirely:

```nginx
server {
    listen 443 ssl;
    ssl_client_certificate /etc/nginx/ssl/internal-ca.pem;
    ssl_verify_client on;

    location /internal-api/ {
        proxy_pass http://backend;
        proxy_set_header X-Client-DN $ssl_client_s_dn;
    }
}
```

**`ssl_client_certificate`** names the CA that's allowed to have issued a calling service's certificate; **`ssl_verify_client on`** rejects any connection that doesn't present a certificate signed by it (`optional` instead of `on` allows anonymous connections through too, leaving the decision to the application via `$ssl_client_verify`). **`$ssl_client_s_dn`** — the verified certificate's subject — is a strong, un-forgeable identity to forward to the backend, since it's cryptographically tied to the TLS handshake itself rather than to a header a client could simply set.

## Rate Limiting Per API Consumer

Nginx Fundamentals' rate limiting is keyed by `$binary_remote_addr` — fair for protecting a public website from any one IP, but wrong for an API gateway: many legitimate users of a B2B API can share one corporate NAT IP, and conversely one API client might call from many IPs (a fleet of its own servers) that should still share **one** fair-use quota. The fix is keying the limit by the thing that actually identifies the caller:

```nginx
http {
    limit_req_zone $http_x_api_key zone=per_client:10m rate=20r/s;

    map $http_x_api_key $client_tier {
        default        "free";
        "key-abc123"   "paid";
        "key-def456"   "paid";
    }

    map $client_tier $tier_rate {
        free 5r/s;
        paid 50r/s;
    }
}
```

**`limit_req_zone $http_x_api_key ...`** — the zone now tracks one bucket per API key instead of per IP, which is the actual unit of "one customer" for a B2B API. **The `map` pair** is a simple, static way to implement tiered limits: look up which tier a key belongs to, then look up the rate that tier gets. This doesn't scale past a config file's worth of keys gracefully — a gateway with thousands of dynamically-issued keys would generate this mapping from a database via a templating/reload pipeline (the same class of problem as dynamic upstream membership, covered in the At Scale essay) rather than hand-maintaining a `map` block — but the mechanism itself, and the principle of keying by client identity rather than IP, is exactly the same either way.

One detail worth being deliberate about: if `$http_x_api_key` is empty (an unauthenticated or malformed request), every such request collapses into a single shared bucket keyed on the empty string — usually fine, since unauthenticated requests should be getting rejected by the auth layer before reaching the rate limiter anyway, but worth confirming that ordering is actually true in your config rather than assumed.

## Request and Response Transformation

### Correlating a request across every hop

```nginx
location /api/ {
    proxy_set_header X-Request-Id $request_id;
    add_header X-Request-Id $request_id always;
    proxy_pass http://backend;
}
```

**`$request_id`** is a built-in nginx variable (core since 1.11.0, no module required) — a random, unique identifier generated fresh for every request. Forwarding it to the backend as a header means every log line, from the gateway's own access log through every backend service's logs, can be joined on the same ID; returning it to the client as a response header means a user reporting "it broke" can hand you the exact ID to search for, instead of "it broke around 2pm."

### Hiding internals, enforcing limits, before the backend sees anything

```nginx
location /api/ {
    client_max_body_size 2m;
    proxy_hide_header X-Internal-Service-Version;
    proxy_pass http://backend;
}
```

**`client_max_body_size`** rejects an oversized request with `413` before it's ever sent to a backend — a gateway is the natural place to enforce this once, rather than trusting every service to configure its own framework-level body limit correctly. **`proxy_hide_header`** strips a header the backend sent before it reaches the client — useful for exactly the kind of internal diagnostic header (a service version, an internal hostname) that's useful between your own services but shouldn't leak to an external API consumer.

### CORS, centrally

```nginx
location /api/ {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        return 204;
    }

    add_header Access-Control-Allow-Origin $http_origin always;
    proxy_pass http://backend;
}
```

A browser sends a CORS **preflight** — an `OPTIONS` request — before the real one whenever a cross-origin request isn't "simple," and expects a fast, bodyless answer describing what's allowed. Handling it at the gateway means none of the backend services behind it need their own CORS logic, or need to agree with each other about what it should be. (Nginx's `if` directive is famously easy to misuse in a `location` block — this is one of the handful of patterns, matching an exact `$request_method`, that's considered safe and idiomatic rather than something to generally reach for.)

## A Consistent Error Contract

Different backends written by different teams tend to return wildly inconsistent error bodies — one returns HTML, another a bare string, a third a JSON shape no one else agreed to. A gateway can normalize this for every failure mode it can see, including failures the backend never got a chance to respond to at all:

```nginx
location /api/ {
    proxy_intercept_errors on;
    error_page 500 502 503 504 /50x_json;
    proxy_pass http://backend;
}

location = /50x_json {
    internal;
    default_type application/json;
    return 502 '{"error": "upstream_unavailable", "request_id": "$request_id"}';
}
```

**`proxy_intercept_errors on`** tells nginx to intercept an error response *from the backend itself* (not just connection failures) and run it through `error_page`, rather than passing the backend's own error body straight through. Listing the status codes on `error_page` without a leading `=` preserves whichever of those codes actually occurred — a `503` stays a `503` — while still substituting in the custom JSON body; adding `= 502` there instead would force every listed code to `502` regardless of which one actually happened, which is sometimes desirable (collapsing every upstream failure mode into one client-facing code) and sometimes actively unhelpful (hiding a real `503`-retryable vs. `502`-broken distinction from the client).

## API Versioning

Three common strategies, each with the same underlying mechanism:

```nginx
# Path-based
location /v1/ { proxy_pass http://service_v1; }
location /v2/ { proxy_pass http://service_v2; }
```

```nginx
# Header-based (content negotiation)
map $http_accept $api_version {
    default                              v1;
    ~*application/vnd\.api\.v2\+json     v2;
}

location /api/ {
    proxy_pass http://$api_version_backend;
}
```

Path-based versioning is the simplest to reason about, cache, and debug — the version is visible in every log line and every URL a developer copies into a bug report. Header-based versioning keeps URLs stable across versions (useful if clients bookmark or hardcode them) at the cost of the version becoming invisible in access logs unless it's explicitly logged — worth adding `$http_accept` to the log format if this strategy is in use, or the single most useful piece of context for debugging a version-specific bug is silently missing from every log line.

## gRPC Gateways

Nginx proxies gRPC natively — it isn't limited to REST/HTTP APIs:

```nginx
server {
    listen 443 ssl http2;

    location /payments.PaymentService/ {
        grpc_pass grpc://payment_backend;
    }
}
```

**`grpc_pass`** speaks gRPC's HTTP/2-based wire protocol directly to the backend — `http2` has to be enabled on the `listen` directive for this to work at all, since gRPC has no meaningful HTTP/1.1 form. One gotcha worth knowing in advance: when nginx itself generates an error (the upstream is unreachable, say), it naturally wants to return a plain HTTP `502`, but a gRPC client is expecting a response framed with a `grpc-status` trailer, not an HTTP status line — handling this gracefully for gRPC clients typically means a dedicated `error_page` location that returns a response shaped the way a gRPC client expects, rather than relying on nginx's default HTTP error page unmodified.

## Observability at the Gateway

A gateway sees every API call, across every backend — which makes it the single best place to log consistently, and the worst place to lose that advantage to an unreadable log format:

```nginx
log_format gateway_json escape=json
    '{"time":"$time_iso8601","request_id":"$request_id",'
    '"method":"$request_method","uri":"$uri","status":$status,'
    '"upstream":"$upstream_addr","upstream_time":"$upstream_response_time",'
    '"user_id":"$sent_http_x_user_id"}';

access_log /var/log/nginx/gateway.log gateway_json;
```

A structured (JSON) log format, rather than nginx's classic space-delimited default, is what makes a gateway's logs actually queryable in whatever log aggregation system ingests them (anything from `jq` on a single file to Elasticsearch at scale) without a fragile parsing regex. `$upstream_addr` and `$upstream_response_time`, logged per request, are what let you break down "is the gateway slow, or is one particular backend slow" after the fact instead of only being able to ask that question live.

What open-source nginx does **not** provide natively is distributed tracing — propagating a trace context (W3C Trace Context, B3, etc.) and emitting spans to a collector like Jaeger or an OpenTelemetry backend. There is an official `ngx_http_opentelemetry_module`, but it's a separate dynamic module that has to be built and loaded explicitly, not a capability of core nginx — worth confirming it's actually present and correctly configured before assuming gateway-level tracing is "just working."

## What Nginx Doesn't Do for You

In keeping with the honest-limits approach from the At Scale essay: a few things dedicated API gateway products (Kong, Apigee, AWS API Gateway, and others) genuinely provide that nginx config alone does not —

- **A developer portal / API catalog** — a self-service place for API consumers to discover endpoints, read docs, and provision their own keys. Nginx has no concept of this; it's a separate application that would sit in front of or alongside nginx.
- **Request/response schema validation against an OpenAPI spec** — rejecting a malformed request body before it reaches a backend, based on a declared schema, isn't something nginx config does natively; it's either enforced in the backend itself or via a validation step bolted on through `njs` or an `auth_request`-style delegate.
- **A plugin ecosystem** — dedicated gateways often ship a marketplace of drop-in plugins (transformations, auth providers, analytics) configured declaratively. Nginx's equivalent is "write it yourself in `njs` or delegate to a service," which is more flexible but has no community plugin marketplace behind it.
- **API analytics dashboards** — nginx produces the raw logs and metrics; turning them into a product-style analytics view is, again, something built on top, not included.

The closing irony worth knowing: **Kong**, one of the most widely used dedicated API gateway products, is itself built on OpenResty — which is nginx core plus the Lua scripting and module ecosystem referenced throughout this guide. Reaching for a product like Kong isn't an alternative to nginx so much as it's nginx with the gaps above already filled in and packaged. The real decision isn't "nginx or an API gateway" — it's "do we assemble these pieces ourselves, or pay for someone else's assembly of the same underlying engine."

## Complete Reference Configuration

```nginx
http {
    limit_req_zone $http_x_api_key zone=per_client:10m rate=20r/s;

    log_format gateway_json escape=json
        '{"time":"$time_iso8601","request_id":"$request_id",'
        '"method":"$request_method","uri":"$uri","status":$status,'
        '"upstream_time":"$upstream_response_time"}';

    upstream user_service   { server user1.internal:8001; }
    upstream order_service  { server order1.internal:8002; }
    upstream auth_service   { server auth1.internal:9000; }

    server {
        listen 443 ssl http2;
        server_name api.example.com;
        access_log /var/log/nginx/gateway.log gateway_json;

        client_max_body_size 2m;

        location /v1/users/ {
            limit_req zone=per_client burst=10 nodelay;

            auth_request /_validate;
            auth_request_set $user_id $upstream_http_x_user_id;

            rewrite ^/v1/users/(.*)$ /$1 break;
            proxy_set_header X-Request-Id $request_id;
            proxy_set_header X-User-Id $user_id;
            proxy_pass http://user_service;

            proxy_intercept_errors on;
            error_page 500 502 503 504 /50x_json;
        }

        location /v1/orders/ {
            limit_req zone=per_client burst=10 nodelay;

            auth_request /_validate;
            auth_request_set $user_id $upstream_http_x_user_id;

            rewrite ^/v1/orders/(.*)$ /$1 break;
            proxy_set_header X-Request-Id $request_id;
            proxy_set_header X-User-Id $user_id;
            proxy_pass http://order_service;

            proxy_intercept_errors on;
            error_page 500 502 503 504 /50x_json;
        }

        location = /_validate {
            internal;
            proxy_pass http://auth_service/validate;
            proxy_pass_request_body off;
            proxy_set_header Content-Length "";
            proxy_set_header X-Original-URI $request_uri;
            proxy_set_header Authorization $http_authorization;
        }

        location = /50x_json {
            internal;
            default_type application/json;
            return 502 '{"error": "upstream_unavailable", "request_id": "$request_id"}';
        }
    }
}
```

Every `/v1/...` location repeats the same four-part shape — rate limit, delegate auth, forward a request ID, normalize errors — which is exactly the point of a gateway: that shape is written once per route here, instead of once per *backend service*, and every service behind it inherits the same guarantees without having implemented any of them itself.
