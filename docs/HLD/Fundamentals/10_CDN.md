---
sidebar_position: 10
---

# CDN (Content Delivery Network)

> **Why this matters in interviews:** any design that serves images, video, static files or public pages to users worldwide needs a CDN, and it's usually the **single largest cut in latency and bandwidth cost**. Saying "put it on a CDN" is expected. Interviewers then look for: how requests **reach the nearest edge** (DNS, anycast), **what is cacheable** and with which headers, how you **invalidate**, how to protect the **origin**, and what changes for **video and dynamic content**. At senior levels, add security (signed URLs, cache poisoning) and cost.

Blueprint components this feeds: **5 (high-level architecture)**, **7 (caching)**, **11 (reliability)**, **12 (security)** and **13 (performance)** in the [HLD Blueprint](./00_HLD%20Blueprint.md). Related: [Caching Strategies](./08_Caching%20Strategies.md) · [Cache Eviction](./09_Cache%20Eviction.md) · [DNS](./01_DNS.md) (CNAMEs, GeoDNS, anycast) · [HTTP](./02_HTTP.md) (`Cache-Control`, `ETag`) · [Latency Numbers](./03_Latency%20Numbers.md). For running your own caching edge with Nginx and serving HLS segments, see [Nginx at Scale](../../Deployment/04_Nginx_At_Scale.md) and [Nginx Realtime and Streaming](../../Deployment/03_Nginx_Realtime_And_Streaming.md).

---

## 1. What a CDN is, and what it buys you

A CDN is a network of **points of presence (PoPs)**: server clusters in hundreds of cities, often inside ISP networks. Each PoP caches content close to users and proxies everything else to your **origin**.

| Benefit | Why |
| --- | --- |
| **Latency** | Light in fibre covers ~200 km per ms. Sydney → Virginia is a ~200 ms round trip, and a cold HTTPS request needs several round trips. A PoP 20 ms away cuts that by an order of magnitude |
| **Origin offload** | At a 95% hit ratio, the origin serves 1 in 20 requests. It's sized for misses, not for users |
| **Bandwidth cost** | Origin egress (cloud data transfer out) is expensive. CDN delivery is usually cheaper per GB, and cache hits never touch the origin |
| **Availability** | Edges can serve stale content when the origin is down (`stale-if-error`), and absorb traffic spikes |
| **Security** | DDoS absorption across a huge network, WAF, bot management and TLS termination at the edge |
| **Faster connections** | TCP and TLS handshakes happen near the user; the edge reuses warm connections to the origin |

**Providers to name:** Cloudflare, Akamai, Fastly, Amazon CloudFront, Google Cloud CDN, Azure Front Door. Large platforms also run their own (Netflix Open Connect, Google's edge network, Meta's edge).

## 2. Request flow

```
 User ──① DNS: img.example.com ──▶ CNAME → example.cdn-provider.net ──▶ CDN DNS / anycast picks a nearby PoP
  │
  ②  TLS handshake with the edge (~10–30 ms away)
  │
  ▼
 Edge PoP ── hit ──▶ response (Age, X-Cache: HIT)
  │ miss
  ▼
 Regional / mid-tier cache ── hit ──▶ fills the edge
  │ miss
  ▼
 Origin shield (one designated PoP) ── collapses concurrent misses ──▶ ③ Origin (S3 / object storage, app servers)
```

1. **Routing to a PoP:** your DNS points the hostname at the CDN with a CNAME (see [DNS](./01_DNS.md)). The CDN then picks a PoP by GeoDNS (answering by the resolver's location, refined by EDNS Client Subnet) or by **anycast** (every PoP announces the same IP, and BGP routing delivers packets to the nearest one).
2. **At the edge:** TLS terminates, the request is normalized into a **cache key**, and the edge looks it up.
3. **On a miss**, the request goes up the hierarchy: a regional cache, then an **origin shield**, then the origin. Each tier reduces the misses reaching the next.

| Routing | How | Pros | Cons |
| --- | --- | --- | --- |
| **DNS-based (GeoDNS)** | The CDN's DNS returns the IP of a nearby, healthy PoP | Fine-grained steering by load, cost or health | Steers by the **resolver's** location (fixed partly by ECS); changes wait for DNS TTLs |
| **Anycast** | One IP announced everywhere; the network routes to the nearest PoP | Instant failover at routing speed, absorbs DDoS by spreading it | Less control over which PoP serves whom; "nearest" means fewest network hops, not lowest latency |

Most large CDNs combine both.

## 3. Cache tiers and origin shield

Without tiers, each of 300 PoPs misses independently, so a new file causes up to 300 origin fetches, and long-tail content has a poor hit ratio at every edge.

- **Tiered caching:** edges miss to a few **regional** caches, which miss to the origin. The regional tier sees aggregated traffic, so its hit ratio on long-tail content is much higher.
- **Origin shield:** one designated cache in front of the origin. All misses funnel through it, and it **collapses concurrent requests** for the same object into one origin fetch. Turn it on for any origin that can't take a burst.
- **Request collapsing (coalescing)** inside each PoP: 1,000 simultaneous misses for a just-published file become one upstream request. It's the CDN version of [single-flight](./08_Caching%20Strategies.md).

**Offload math:** with edge hit ratio 90% and shield hit ratio 80% on the remainder, the origin sees `10% × 20% = 2%` of requests.

## 4. What to put on a CDN

| Content | Cacheable? | Headers and approach |
| --- | --- | --- |
| **Versioned static assets** (`app.3f9a1c.js`, `logo.8b2e.png`) | Yes, forever | `Cache-Control: public, max-age=31536000, immutable`. A new deploy means a new filename, so **no invalidation is ever needed** |
| **HTML entry pages** | Briefly, or revalidate | `Cache-Control: no-cache` (store, but revalidate with the ETag every time), or a short `s-maxage` with `stale-while-revalidate` |
| **User-uploaded images and video** | Yes | Content-addressed or ID-based immutable URLs, long TTL. Resize and convert format at the edge or with an image service |
| **Video segments (HLS/DASH)** | Yes, forever | Segments never change: cache for a long time. **Live manifests** (`.m3u8`) change every few seconds: `no-cache` or a TTL of about 1 s |
| **Public API responses** (trending, product details, search suggestions) | Yes, briefly | `s-maxage=30, stale-while-revalidate=60`. A cache key including the relevant query parameters |
| **Personalized responses** (feed, cart, account) | **No** (in a shared cache) | `Cache-Control: private` or `no-store`. Split the page: a cacheable public shell plus a personalized API call |
| **Writes** (POST, PUT, DELETE) | No | Pass through. The CDN still helps with TLS termination and connection reuse |

**The design move:** separate **public** from **private** content so the public part can be cached. A product page = cached HTML and images + an uncached `GET /api/cart` + a short-TTL `GET /api/price/{id}`.

## 5. Cache keys and headers

**The cache key** is, by default, roughly `scheme + host + path + query string`. Anything that changes the response but isn't in the key causes **wrong content served to the wrong users**. Anything in the key that doesn't change the response **fragments the cache** and lowers the hit ratio.

- **Normalize the query string:** sort parameters, and drop tracking parameters (`utm_*`, `fbclid`) from the key.
- **Be careful with `Vary`:** `Vary: Accept-Encoding` is fine (CDNs normalize it to a few variants). `Vary: User-Agent` or `Vary: Cookie` effectively disables caching, because there's one copy per unique value.
- **Cookies:** many CDNs don't cache responses that set cookies, or requests that send them, by default. Strip cookies on static paths.
- **Device or country variants:** put a normalized value in the key (`device=mobile|desktop`, `country=IN`), never the raw header.

**Headers that control CDN behaviour** (see [HTTP](./02_HTTP.md) for the full list):

| Header | Meaning |
| --- | --- |
| `Cache-Control: public, max-age=N` | Anyone may cache it for N seconds |
| `s-maxage=N` | Overrides `max-age` for **shared** caches (CDN, proxies). Long at the CDN, short in the browser |
| `private` | Only the browser may cache it. The CDN must not |
| `no-cache` | Store it, but **revalidate** with the origin before every use (`If-None-Match` → `304`) |
| `no-store` | Don't store it anywhere |
| `immutable` | The content will never change for this URL, so browsers skip revalidation |
| `stale-while-revalidate=N` | Serve stale content for up to N seconds while refreshing in the background |
| `stale-if-error=N` | Serve stale content for up to N seconds if the origin errors. Free availability |
| `Surrogate-Control`, `CDN-Cache-Control` | CDN-only directives that browsers ignore, so the CDN TTL can differ from the browser TTL |
| `ETag` / `Last-Modified` | Validators for cheap `304 Not Modified` revalidation |
| `Age`, `X-Cache` (vendor-specific) | Debugging: how long it's been cached, hit or miss |

## 6. Invalidation

From best to worst:

1. **Versioned (fingerprinted) URLs.** `app.3f9a1c.js` changes name when its content changes, so there's nothing to invalidate. The old file ages out. This is how you get both instant updates and year-long TTLs. **Always the first answer.**
2. **Short TTLs plus `stale-while-revalidate`.** For content that must change at a stable URL (HTML, API responses), accept N seconds of staleness.
3. **Purge by tag (surrogate keys).** Tag responses (`Surrogate-Key: product-42 category-7`) and purge everything with a tag when product 42 changes. Supported by Fastly, Akamai and Cloudflare (on some plans). Good for "this entity appears on many pages."
4. **Purge by URL or prefix.** Fine for occasional fixes. Purges take time to propagate (from seconds to minutes depending on the provider), are often rate-limited, and are **eventually consistent** across PoPs.
5. **Purge everything.** An emergency tool. It sends the full load to the origin at once (an avalanche). Never part of a normal deploy.

**Soft purge** (marking content stale instead of deleting it) lets edges keep serving the stale copy while revalidating, which protects the origin.

## 7. Push vs pull CDN

| | **Pull** (origin pull) | **Push** |
| --- | --- | --- |
| How content arrives | The edge fetches from the origin on the first miss | You upload content to the CDN's storage ahead of time |
| Pros | Zero management, and only requested content is stored | No first-request miss; the origin isn't needed at request time |
| Cons | First request per PoP is slow; the origin must stay up | You manage uploads, storage and expiry; you pay to store everything |
| Use for | **The default**: websites, APIs, user content | Large, predictable releases (game patches, software downloads), video libraries pre-positioned before demand |

## 8. Dynamic content acceleration

Even uncacheable requests get faster through a CDN:
- **Handshakes near the user:** TCP + TLS 1.3 to a PoP 20 ms away costs ~40 ms, versus ~400 ms to an origin 200 ms away. The edge then forwards over a **warm, persistent connection** to the origin.
- **Optimized routes** across the CDN's backbone instead of the public internet, and **HTTP/2 and HTTP/3 (QUIC)** to clients even if the origin speaks HTTP/1.1.
- **Compression** (Brotli, gzip) and **image optimization** (resizing, WebP/AVIF) at the edge.
- **Edge compute:** small functions running at PoPs, such as Cloudflare Workers, CloudFront Functions or Lambda@Edge, and Fastly Compute. Use them for redirects, A/B bucketing, auth token checks, geo-based routing, header rewriting and personalizing a cached page. They have limits: short CPU time, limited memory, and data that isn't local unless you use an edge key-value store.

## 9. Security at the edge

| Concern | Approach |
| --- | --- |
| **DDoS** | The CDN absorbs volumetric attacks across its whole network (anycast spreads them). Add rate limiting and bot management at the edge |
| **Origin exposure** | Attackers bypass the CDN if they find the origin IP. Allow only CDN IP ranges, use **authenticated origin pulls** (mTLS) or a secret header, or a private origin (S3 with origin access control) |
| **Private or paid content** | **Signed URLs or signed cookies** with expiry, checked at the edge, so a leaked link stops working quickly |
| **Hotlinking** | Referer checks or signed URLs |
| **Cache poisoning** | An attacker sends a header the origin uses but the cache key ignores (an "unkeyed input" such as `X-Forwarded-Host`), and the poisoned response is cached for everyone. Don't let unkeyed headers change responses; include them in the key or strip them |
| **Cache deception** | Tricking the CDN into caching a private page by making it look static (`/account/settings/x.css`). Cache by explicit rules and the origin's `Cache-Control`, not by file extension alone, and mark private pages `private, no-store` |
| **TLS** | Certificates are managed at the edge, and the edge-to-origin leg is also encrypted (full TLS, not "flexible" mode) |

## 10. Video at scale

Video is most of internet traffic, and it's where CDN design matters most.

- **Adaptive bitrate (ABR):** each video is encoded at several qualities and cut into **2–10 s segments**. A manifest lists them, and the player picks a quality per segment based on bandwidth.
- **Segments are immutable,** so they're perfectly cacheable. Live manifests are not (see section 4).
- **The long tail:** a few titles get most views and are cached everywhere. The vast catalogue gets a few views each, so it's served from regional tiers or the origin. Hit ratios differ hugely between the two.
- **Pre-positioning:** Netflix's Open Connect places caching appliances **inside ISP networks** and fills them during off-peak hours with what's predicted to be popular. Most viewing is then served from inside the user's own ISP.
- **Live events:** millions of viewers requesting the same new segment at the same second is the ultimate **stampede**. Request collapsing at every tier is essential, and so is a short manifest TTL.

## 11. Worked estimate: images for a social app

**Traffic:**
- 500M image views/day at an average of 200 KB served (after resizing and compression).
- Egress: `500M × 200 KB = 100 TB/day` ≈ **9.3 Gbps on average**, perhaps ~25 Gbps at peak.

**With a CDN:**
- Edge plus tiered hit ratio of ~95% (images are immutable, and popular ones are very popular).
- Origin egress: `5% × 100 TB = 5 TB/day` ≈ **0.46 Gbps** on average. That can be served straight from object storage behind an origin shield.

**Design:**
- Immutable, ID-based URLs (`/img/{id}/{size}.webp`) with a year-long `max-age` and `immutable`.
- An on-the-fly resizing service behind the shield.
- Signed URLs for private accounts.
- `stale-if-error` so an origin outage doesn't break feeds.

**Cost conversation:** CDN egress is usually cheaper per GB than cloud egress. The origin's share is cut 20x, and the edge serves most users within ~20 ms.

## 12. Operating a CDN

- **Metrics:** cache hit ratio **and byte hit ratio** per path, origin offload, edge vs origin 5xx rates, time to first byte per region, purge latency.
- **Multi-CDN:** large sites use two or more providers behind DNS-based steering (by health, performance and cost), for resilience against a single provider's outage and for price leverage. The costs: two sets of config, cache keys and purge integrations.
- **Debugging:** check `Age`, `X-Cache` and the cache-key behaviour. Surprisingly low hit ratios usually come from cookies, `Vary`, unnormalized query strings or `private` responses.
- **Costs:** egress per GB (varies by region), requests, edge compute, and purge or log features. A higher hit ratio lowers both the CDN's origin-fetch costs and your origin's egress.

## 13. Interview questions (with crisp answers)

**Q: How does a user get routed to the nearest CDN server?**
The site's hostname is a CNAME to the CDN. The CDN's DNS returns a nearby healthy PoP based on the resolver's location (GeoDNS, refined by EDNS Client Subnet), and/or the PoPs share an anycast IP and BGP routes packets to the nearest one.

**Q: How do you update a file cached on a CDN?**
Use versioned or fingerprinted URLs so new content has a new URL, and set long TTLs on immutable assets. For content at a stable URL, use short TTLs with `stale-while-revalidate`, or purge by tag or URL, knowing purges propagate eventually.

**Q: What's an origin shield?**
A designated cache tier between the edges and the origin. All edge misses go through it, so concurrent misses collapse into one origin request and the origin sees far less traffic.

**Q: Can a CDN help with dynamic, uncacheable APIs?**
Yes: TLS and TCP terminate close to the user, the edge keeps warm connections to the origin, and traffic rides the CDN's optimized routes. You also get DDoS protection, a WAF and edge compute for simple logic.

**Q: How do you serve private content through a CDN?**
Signed URLs or signed cookies with short expiry, validated at the edge, with the origin locked down so it's reachable only through the CDN.

**Q: Push or pull CDN?**
Pull by default: the CDN fetches on demand, so there's nothing to manage. Push when content is large and predictable (software releases, pre-positioned video), so the first user doesn't pay the miss and the origin isn't involved.

**Q: Why is my CDN hit ratio low?**
Usually cache-key fragmentation (unnormalized query strings, `Vary` on high-cardinality headers, cookies), responses marked `private` or `no-store`, very short TTLs, or a long-tail workload without tiered caching.

## 14. Common mistakes

- "Put everything on the CDN" without separating public from personalized content.
- Caching personalized responses in a shared cache: a data leak.
- Purging on every deploy instead of using versioned asset URLs.
- Leaving the origin publicly reachable, so attackers bypass the CDN.
- `Vary: Cookie` or `Vary: User-Agent`, which silently destroys the hit ratio.
- Long TTLs on live video manifests, or short TTLs on immutable segments.
- Forgetting the first-request miss, and the origin's load when caches are cold (deploys, purge-all, new PoPs).
