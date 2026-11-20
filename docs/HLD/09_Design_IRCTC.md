---
sidebar_position: 9
---

# Design IRCTC (Indian Railway Ticket Booking System)

IRCTC is India's railway ticket booking platform. Its hardest problem isn't steady-state traffic — it's the **Tatkal booking rush**: millions of users hammering the same small set of train/date/class rows in the same few seconds. This design is built around absorbing exactly that spike.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Capacity Estimation](#capacity-estimation)
4. [System APIs](#system-apis)
5. [Database Design](#database-design)
6. [High-Level Design](#high-level-design)
7. [Component Design](#component-design)
8. [The Tatkal Rush: How Scale Is Actually Handled](#the-tatkal-rush-how-scale-is-actually-handled)
9. [Data Partitioning](#data-partitioning)
10. [Caching Strategy](#caching-strategy)
11. [Consistency Model](#consistency-model)
12. [Waitlist & RAC Management](#waitlist--rac-management)
13. [Security](#security)
14. [Monitoring & Analytics](#monitoring--analytics)
15. [Additional Considerations](#additional-considerations)
16. [Summary](#summary)

---

## Problem Statement

Design a railway ticket booking platform similar to IRCTC where:

- Users search trains between stations and check live seat availability across classes (SL, 3A, 2A, 1A, CC, EC) and quotas (General, Tatkal, Premium Tatkal, Ladies, Senior Citizen, Divyaang).
- Users book tickets with passenger details and pay online; the system issues a PNR.
- If the class is full, users are placed on a **waitlist (WL)** or **RAC**, which can later auto-upgrade to CONFIRMED as berths free up.
- Users check PNR status, cancel tickets, and get refunds.
- Live train running status and schedules are available.
- A fixed slice of inventory per train/date opens for **Tatkal booking** at a fixed clock time (10:00 / 11:00 AM), at which point demand exceeds supply by 50–100x in the first few minutes.
- The single-row, double-booking-is-unacceptable nature of seat inventory (unlike Uber's "any nearby driver will do") is what makes this system design distinct: every booking on a given train/date/class ultimately contends for the *same* small set of rows.

---

## Requirements

### Functional Requirements

1. **Search & Availability**
   - Search trains between source/destination for a given date
   - Live seat availability per class and quota
   - Fare enquiry per class/quota

2. **Booking**
   - Book a ticket for 1–6 passengers in one PNR
   - Select quota (General / Tatkal / Premium Tatkal / Ladies / Senior Citizen)
   - Auto-allocate berths, or allow preferences (lower/upper/window) best-effort
   - Generate PNR and e-ticket on successful payment

3. **Waitlist / RAC**
   - Place booking on WL/RAC when class is full, in strict FIFO order per quota
   - Auto-upgrade WL → RAC → CONFIRMED as cancellations free up berths, up to chart preparation
   - Notify passengers of status changes

4. **Cancellation & Refund**
   - Cancel a confirmed/WL/RAC ticket
   - Calculate refund per cancellation-fee slab and railway rules
   - Release the freed berth back into inventory immediately

5. **PNR & Train Status**
   - PNR status lookup
   - Live running status / expected arrival per station

6. **Tatkal Window**
   - A fixed quota of seats per train/date/class is held back and released only at Tatkal opening time
   - Only one booking attempt should be allowed to win a given berth even though hundreds of thousands of requests arrive in the same second

### Non-Functional Requirements

1. **Correctness over availability for seat allocation**: it is unacceptable to ever sell the same berth twice. It is acceptable, under extreme load, to tell a user "try again" or hold them in a queue.
2. **Scale**: ~13,000 trains/day, ~2.5 crore (25M) passengers/day across the network, ~15–20 lakh (1.5–2M) e-tickets booked per day, with a Tatkal opening spike of ~1.2 lakh (120K) tickets confirmed in the first 5 minutes against ~50–100x that many *attempts*.
3. **Availability**: 99.9% for search/browse (degrade gracefully, don't go fully down); booking path can shed load (queue/wait) rather than fail hard.
4. **Performance**: search P99 < 1s under normal load; booking confirmation (post-payment) < 5s; Tatkal-window booking attempt should get a definitive accept/reject/queued response within a few seconds even at peak.
5. **Consistency**: strong consistency (no double allocation) for seat inventory writes; eventual consistency acceptable for search/availability displays, re-verified at the moment of booking.
6. **Durability**: zero data loss for confirmed bookings and payments.

---

## Capacity Estimation

### Traffic Estimates (Normal Day)

- **Trains/day**: ~13,000
- **Average seats/train**: ~1,200 (across all classes)
- **Total daily seat inventory**: ~1.5 crore seats/day (across ~120-day advance booking horizon, this is the *live* window, not total rows)
- **Tickets booked/day**: ~15–20 lakh (1.5–2M) e-tickets
- **Searches/day**: ~15–20 crore (150–200M) — search:book ratio is roughly 100:1
- **Average search QPS**: 200M / 86,400s ≈ **2,300 QPS** sustained, ~4x at peak hours ≈ **9,000 QPS**

### Traffic Estimates (Tatkal Window — the number that actually drives the architecture)

- Tatkal opens at a fixed second (10:00:00 AM for AC classes, 11:00:00 AM for non-AC).
- Tickets actually confirmed in first 5 minutes: ~1.2 lakh (120,000) → **400 successful bookings/sec**
- HTTP requests/attempts hitting the booking path in the same window (retries, refreshes, multiple browser tabs, bots): historically **10–50 lakh (1M–5M) requests/sec** at the very first second, decaying over the next 1–2 minutes.
- **This 1,000–5,000x gap between "successful writes needed" (400/s) and "requests arriving" (1M–5M/s) is the entire design problem.** No database can run 5M conflicting writes/sec against the same few hundred rows — the system must shed/queue/pace load *before* it reaches the database, not try to scale the database to absorb it.

### Storage Estimates

**PNR / Booking records:**
- Record size: ~3 KB (passengers, berths, payment ref, quota)
- 2M bookings/day × 3 KB = 6 GB/day → ~2.2 TB/year, with 3x replication ≈ 6.6 TB/year
- Regulatory retention (several years) → tens of TB, mostly cold storage after journey date passes

**Seat inventory (hot, live window):**
- ~13,000 trains × 120-day booking horizon × ~1,200 seats = ~1.9 billion seat-rows live at any time
- Row size ~100 bytes → ~190 GB hot working set — small enough to live almost entirely in a distributed cache/in-memory store, which is exactly how this is kept fast

**Search index:** train/route/schedule metadata is tiny (thousands of trains, fixed routes) and fits comfortably in memory on every search node.

### Bandwidth Estimates

- Peak Tatkal ingress: millions of small (1–2 KB) requests/sec → tens of Gbps at the edge, almost all of which must be absorbed/rejected at the CDN/edge/waiting-room layer, never reaching application servers at full volume.

---

## System APIs

```javascript
// Search & Availability
GET  /api/v1/trains/search?from={src}&to={dst}&date={date}
GET  /api/v1/trains/{trainId}/availability?date={date}&class={class}&quota={quota}
GET  /api/v1/trains/{trainId}/fare?date={date}&class={class}&quota={quota}

// Booking (idempotent — client supplies a request id)
POST /api/v1/bookings
     Headers: { "Idempotency-Key": "<client-generated-uuid>" }
     Body: { trainId, date, class, quota, passengers: [...], paymentMethodId }

GET  /api/v1/bookings/{pnr}
POST /api/v1/bookings/{pnr}/cancel

// PNR & running status
GET  /api/v1/pnr/{pnr}/status
GET  /api/v1/trains/{trainId}/running-status?date={date}

// Tatkal queue / virtual waiting room
POST /api/v1/queue/token?trainId={trainId}&date={date}&class={class}
GET  /api/v1/queue/token/{tokenId}/status
```

### Example: Booking Request/Response

```json
POST /api/v1/bookings
Headers: { "Idempotency-Key": "a1b2c3d4-..." }
Body:
{
  "trainId": "12952",
  "date": "2026-12-20",
  "class": "3A",
  "quota": "TATKAL",
  "passengers": [
    { "name": "A Kumar", "age": 34, "gender": "M", "berthPref": "LOWER" }
  ],
  "paymentMethodId": "upi_123"
}

Response (201 — held pending payment):
{
  "bookingId": "bk_789",
  "status": "PAYMENT_PENDING",
  "holdExpiresAt": "2026-12-20T10:02:30Z",
  "amount": 1850.00
}

Response (202 — queued, Tatkal rush):
{
  "queueToken": "tkn_456",
  "estimatedWaitSeconds": 12,
  "position": 48213
}

Response (409 — lost the race for this berth):
{
  "error": "SEAT_NO_LONGER_AVAILABLE",
  "waitlisted": true,
  "waitlistPosition": 37
}
```

---

## Database Design

### Core Tables

```sql
CREATE TABLE trains (
    train_id BIGINT PRIMARY KEY,
    train_number VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100),
    source_station_id BIGINT NOT NULL,
    dest_station_id BIGINT NOT NULL,
    INDEX idx_source_dest (source_station_id, dest_station_id)
);

CREATE TABLE train_schedule (
    train_id BIGINT NOT NULL,
    station_id BIGINT NOT NULL,
    stop_sequence INT NOT NULL,
    arrival_time TIME,
    departure_time TIME,
    distance_km INT,
    PRIMARY KEY (train_id, stop_sequence)
);

CREATE TABLE coaches (
    coach_id BIGINT PRIMARY KEY,
    train_id BIGINT NOT NULL,
    coach_class VARCHAR(5) NOT NULL, -- SL, 3A, 2A, 1A, CC, EC
    coach_position INT,
    total_berths INT,
    INDEX idx_train_class (train_id, coach_class)
);

-- The single most important table in the whole system.
-- One row per (train, journey_date, class, quota) — this is the row
-- every Tatkal request contends on, so its design IS the scale design.
CREATE TABLE seat_inventory (
    train_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    coach_class VARCHAR(5) NOT NULL,
    quota VARCHAR(20) NOT NULL,       -- GENERAL, TATKAL, PREMIUM_TATKAL, LADIES, ...
    total_berths INT NOT NULL,
    available_berths INT NOT NULL,
    rac_available INT DEFAULT 0,
    waitlist_count INT DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0, -- optimistic-lock / CAS token
    tatkal_opens_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (train_id, journey_date, coach_class, quota)
);

-- Individual berth state, only materialized at confirm time
-- (not touched on every search — search reads the aggregate counters above)
CREATE TABLE berth_allocation (
    train_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    coach_id BIGINT NOT NULL,
    berth_number INT NOT NULL,
    booking_id BIGINT,
    status ENUM('FREE', 'HELD', 'CONFIRMED') DEFAULT 'FREE',
    held_until TIMESTAMP NULL,
    PRIMARY KEY (train_id, journey_date, coach_id, berth_number)
);

CREATE TABLE bookings (
    booking_id BIGINT PRIMARY KEY,
    pnr VARCHAR(10) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    train_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    coach_class VARCHAR(5) NOT NULL,
    quota VARCHAR(20) NOT NULL,
    status ENUM('PAYMENT_PENDING','CONFIRMED','RAC','WAITLISTED','CANCELLED') NOT NULL,
    waitlist_number INT,
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    total_fare DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pnr (pnr),
    INDEX idx_user (user_id),
    INDEX idx_train_date_class_quota (train_id, journey_date, coach_class, quota, status)
);

CREATE TABLE passengers (
    passenger_id BIGINT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    name VARCHAR(100),
    age INT,
    gender CHAR(1),
    berth_number INT,
    berth_status ENUM('CONFIRMED','RAC','WAITLISTED'),
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

CREATE TABLE waitlist_queue (
    train_id BIGINT NOT NULL,
    journey_date DATE NOT NULL,
    coach_class VARCHAR(5) NOT NULL,
    quota VARCHAR(20) NOT NULL,
    waitlist_number INT NOT NULL,
    booking_id BIGINT NOT NULL,
    PRIMARY KEY (train_id, journey_date, coach_class, quota, waitlist_number)
);

CREATE TABLE payments (
    payment_id BIGINT PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    amount DECIMAL(10,2),
    status ENUM('INITIATED','SUCCESS','FAILED','REFUNDED'),
    gateway_ref VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);
```

---

## High-Level Design

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│  Web      │   │  Mobile  │   │  Agent   │
│  Client   │   │  App     │   │  (B2B)   │
└─────┬─────┘   └────┬─────┘   └────┬─────┘
      └──────────────┼──────────────┘
                      │
            ┌─────────▼──────────┐
            │   CDN / Edge       │   ← absorbs static assets, schedules
            └─────────┬──────────┘
                      │
            ┌─────────▼──────────┐
            │ API Gateway + WAF  │   ← rate limiting, bot/captcha, DDoS
            └─────────┬──────────┘
                      │
          ┌───────────▼────────────┐
          │ Virtual Waiting Room / │   ← paces Tatkal rush into the system
          │ Queue-Token Service    │     at a rate the backend can absorb
          └───────────┬────────────┘
                      │
      ┌───────────────┼────────────────────┐
      │               │                    │
┌─────▼──────┐ ┌──────▼───────┐   ┌────────▼────────┐
│  Search &   │ │  Booking /   │   │  Payment        │
│  Availability│ │  Seat Lock   │   │  Service        │
│  Service    │ │  Service     │   │                 │
└─────┬───────┘ └──────┬───────┘   └────────┬────────┘
      │                │                    │
┌─────▼───────┐  ┌──────▼───────┐   ┌────────▼────────┐
│ Read Replicas│  │ In-Memory    │   │ Message Queue   │
│ + Search     │  │ Store (Redis)│   │ (Kafka)         │
│ Cache        │  │ seat counters│   │ bookings/events │
└──────────────┘  │ + locks      │   └────────┬────────┘
                   └──────┬───────┘            │
                          │          ┌─────────▼──────────┐
                   ┌──────▼───────┐  │ Waitlist Promotion  │
                   │  Primary DB   │  │ & Notification      │
                   │  (sharded by  │  │ Workers              │
                   │  train+date)  │  └──────────────────────┘
                   └───────────────┘
```

### Key Components

1. **CDN / Edge** — serves static assets and train schedules, absorbs the bulk of read traffic before it reaches any server.
2. **API Gateway + WAF** — TLS termination, per-user/IP rate limiting, bot/captcha challenge, DDoS mitigation.
3. **Virtual Waiting Room / Queue-Token Service** — the component that makes Tatkal survivable (see dedicated section below).
4. **Search & Availability Service** — read-mostly, cache-backed, served off replicas; never touches the write-critical path.
5. **Booking / Seat Lock Service** — the write-critical path; owns short-lived holds and the atomic decrement of available seats.
6. **Payment Service** — integrates external payment gateway; drives the hold → confirm/release state machine.
7. **Waitlist Promotion & Notification Workers** — async, consume cancellation events off a queue.
8. **Redis cluster** — seat-count counters, distributed locks/holds, search cache.
9. **Primary database** — sharded by `(train_id, journey_date)`; source of truth for confirmed state.
10. **Kafka** — decouples booking confirmation from downstream effects (notifications, waitlist re-evaluation, analytics).

---

## Component Design

### 1. Search & Availability Service

Reads are cheap and tolerant of a little staleness — the expensive, consistency-sensitive work is reserved for the booking path. Availability counters live in Redis, refreshed on every confirmed booking/cancellation, backed by read replicas for anything the cache misses. A search response is explicitly a *snapshot*, re-verified at booking time — this separation (cheap approximate read path vs. expensive exact write path) is what keeps search fast regardless of how contested the underlying inventory is.

### 2. Booking / Seat Lock Service

This is the service the whole design revolves around. Its job: allow many passengers to book different berths on the same train/date/class concurrently, while guaranteeing no two bookings ever claim the same berth.

**Flow:**
1. Client calls `POST /bookings` with an idempotency key.
2. Service atomically decrements the Redis counter for `(train, date, class, quota)` — if it goes negative, immediately reject/waitlist, no DB hit needed.
3. On success, place a **short-lived hold** (TTL ~3–5 minutes) on a specific berth row, keyed by the idempotency key.
4. Return `PAYMENT_PENDING` to the client and hand off to the Payment Service.
5. On payment success → confirm the hold in the primary DB (durable write), publish a `BookingConfirmed` event.
6. On payment failure/timeout → release the hold, increment the Redis counter back, berth returns to the pool.

This hold → confirm/release flow is a **saga**: booking and payment are two systems that must agree, and the hold is the compensating-action anchor if either side fails.

### 3. Payment Service

Calls the external payment gateway, handles webhooks idempotently (gateway can retry callbacks), and is the sole trigger for confirming or releasing a hold. Payment callbacks carry the same idempotency key so a duplicate webhook never double-confirms a booking.

### 4. Waitlist Promotion & Notification Workers

Cancellations publish an event to Kafka; a worker pool consumes it, promotes the next FIFO entry in `waitlist_queue` for that `(train, date, class, quota)`, and triggers notification. This is deliberately asynchronous — a cancellation doesn't need to re-run synchronously in the request that caused it.

---

## The Tatkal Rush: How Scale Is Actually Handled

This is the section that matters most for IRCTC specifically — the design problem is not "handle N requests/sec" in the abstract, it's "handle a 1,000x–5,000x spike aimed at a few hundred rows, in the same second, nationwide."

**1. Shed load before it reaches a database — the virtual waiting room.**
At the exact Tatkal opening second, every client is issued a queue token (not a database transaction). Tokens are admitted to the actual booking service at a rate matched to downstream capacity (e.g., a few thousand/sec), using a token-bucket or leaky-bucket admission policy. This converts an uncontrolled stampede into a controlled, predictable stream — the single biggest lever in this whole design.

**2. Never let the "is there a seat" check be a row-level database transaction.**
Seat availability is an in-memory atomic counter (Redis `DECR`/Lua script), not a `SELECT ... FOR UPDATE` on a SQL row. An atomic decrement in memory can absorb orders of magnitude more contention than a row lock in a relational database, and a negative-count check is enough to reject/waitlist instantly without ever reaching durable storage.

**3. Decompose the hot row.**
`(train, date, class, quota)` is one logical counter, but a train has hundreds of individual berths. Where possible, the counter is sharded further (e.g., per-coach counters summed lazily) so that concurrent requests for the *same train* don't all serialize on one physical cache key — spreading the hot key across multiple Redis slots/shards avoids a single-node bottleneck.

**4. Scale out, not up, and pre-provision for the clock, not for load.**
Because the spike time is known exactly (10:00:00 / 11:00:00 AM), capacity is pre-scaled on a schedule rather than reactively — autoscaling that waits to observe a load spike is already too slow for a spike this instantaneous.

**5. Fail fast and cheap.**
A request that can't get a seat should fail in milliseconds with a clear "waitlisted" or "try again" response, not time out after retrying a lock. Fast, cheap failure is what keeps the system responsive for the requests that *can* succeed.

**6. Idempotency absorbs client-side retries.**
Anxious users double-click, refresh, and resubmit. The idempotency key on every booking request means a retried request returns the original result rather than contending for a second berth or double-charging a card.

**7. Isolate Tatkal traffic from General-quota traffic.**
Tatkal and General bookings hit logically separate inventory rows and quotas; routing/rate-limiting can prioritize or isolate capacity so a Tatkal storm degrades Tatkal booking latency, not General-quota search/booking for unrelated trains.

**8. Read and write paths never share a bottleneck.**
Search/availability-display traffic (which spikes just as hard, as users refresh to watch counts change) is served entirely from cache/replicas and never competes with the booking service for the same database connections or locks.

---

## Data Partitioning

### Seat Inventory & Bookings

- **Shard key**: `(train_id, journey_date)` — this naturally distributes load because it's the same key every request for a given train/date contends on, so sharding by it isolates one hot train from affecting others.
- A handful of very popular trains/routes (festival season, long weekends) become "hot shards" — these get dedicated, over-provisioned shards rather than sharing a pool sized for the average train.
- Once `journey_date` passes, that shard's data is cold — rolled into archival/cold storage, keeping the "live" working set small and fast.

### Historical / Archival Data

- Completed journeys move to a separate analytical store (data warehouse) after a short retention window on the hot path, keeping `bookings`/`seat_inventory` lean for the trains that still matter operationally.

---

## Caching Strategy

| Data | Store | TTL / Invalidation |
|---|---|---|
| Seat availability counters | Redis | Updated atomically on every hold/confirm/release/cancel |
| Train/station/schedule metadata | In-memory on every search node + CDN | Invalidated on schedule change (rare) |
| Search results | Redis (cache-aside) | 5–10s TTL — short, because availability changes fast |
| Seat holds | Redis with TTL | Expires automatically (3–5 min) if payment doesn't complete |
| User session/auth | Redis | TTL per session policy |

Cache pattern for the booking-critical path is **write-through on the counter** (every state change updates Redis synchronously, since it's the source of truth for "can this be booked right now") while the relational DB record is the durable, eventually-written source of truth for "what was booked."

---

## Consistency Model

- **Seat allocation**: strong consistency, enforced via atomic counter operations + a saga (hold → confirm/release). Never serve two confirmations for the same berth.
- **Search/availability display**: eventual consistency is fine — a few seconds of staleness is an acceptable trade for keeping search cheap, as long as the booking attempt itself re-checks the authoritative counter.
- **Payment ↔ booking**: handled as a saga with compensating action (release hold) rather than a distributed transaction across the payment gateway and the booking DB — those are different systems and can't share a transaction.

---

## Waitlist & RAC Management

- Each `(train, date, class, quota)` has its own ordered `waitlist_queue`.
- A cancellation publishes an event; a worker promotes the lowest-numbered waitlisted booking to RAC/CONFIRMED and re-numbers the rest.
- Final chart preparation (a few hours before departure) is the cutoff — after that, no more auto-promotion, and remaining waitlisted passengers are informed their ticket didn't confirm.
- This is processed as a queue of discrete promotion events, not a full re-scan of all waitlisted bookings per cancellation, so it stays cheap even for long waitlists on popular trains.

---

## Security

- **Rate limiting** per user/IP/device at the gateway, tighter during Tatkal windows.
- **CAPTCHA / bot detection** to blunt scripted "Tatkal agent" tools — this is as much a fairness concern as a security one.
- **Idempotency keys** prevent duplicate charges from retried requests.
- **PCI-DSS compliance** — payment details tokenized, never stored raw.
- **Auth**: standard session/JWT-based auth, OTP for sensitive actions (cancellation, refund to a different account).

---

## Monitoring & Analytics

**Key metrics, especially around Tatkal:**
- Queue admission rate vs. queue depth (is the waiting room keeping up?)
- Seat-counter contention rate (decrements rejected due to zero/negative)
- Booking success rate and P99 latency, split General vs. Tatkal
- Payment success/failure/timeout rate
- Hold expiry rate (holds that were never paid for — signals checkout friction)
- Per-shard load, to detect a hot train before it degrades others

**Tooling**: Prometheus/Grafana for real-time dashboards during the booking window, Kafka-based event pipeline feeding an analytics warehouse for demand forecasting ahead of the next festival/holiday rush.

---

## Additional Considerations

### Scalability Challenges Recap

1. **Tatkal thundering herd** → virtual waiting room + in-memory atomic counters + pre-scheduled capacity.
2. **Hot train/date shard** → dedicated shard capacity for known high-demand trains/seasons.
3. **Search-vs-booking contention** → fully separated read and write paths.
4. **Duplicate bookings from retries** → idempotency keys end-to-end.

### Future Enhancements

1. ML-based demand forecasting to pre-scale infrastructure ahead of known rush events (festivals, long weekends).
2. Dynamic/surge-aware Tatkal pricing tiers.
3. Predictive waitlist-confirmation probability shown to users at booking time.
4. Smarter berth allocation (family/group seating preference optimization).

---

## Summary

IRCTC's hard problem isn't steady-state throughput — 2,000–9,000 QPS of search traffic is unremarkable. It's that Tatkal opening concentrates a 1,000x+ demand spike onto a tiny number of rows, nationwide, in the same second. The architecture handles this by shedding and pacing load (virtual waiting room) before it reaches the database, replacing row-level locks with atomic in-memory counters on the hot path, separating the cheap/approximate read path from the expensive/exact write path, sharding inventory by `(train, date)` so one hot train can't degrade the rest, and using idempotency plus a hold/confirm/release saga to keep retries and payment failures from ever causing a double booking.
