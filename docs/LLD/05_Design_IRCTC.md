---
sidebar_position: 5
---

# Design IRCTC

### Design IRCTC (Indian Railway Ticket Booking System)

## Table of Contents
1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Class Design](#class-design)
4. [Database Schema](#database-schema)
5. [API Design](#api-design)
6. [Key Algorithms](#key-algorithms)
7. [Design Patterns](#design-patterns)
8. [Error Handling](#error-handling)
9. [Performance Optimizations](#performance-optimizations)

## Overview

This document provides the Low-Level Design (LLD) for an IRCTC-like railway ticket booking system, focusing on the class structures, data models, and algorithms behind the one problem that actually drives this system's design: allocating a finite number of berths correctly under extreme, bursty concurrent demand (the Tatkal rush) without ever double-booking a seat. See the companion [HLD](../HLD/09_Design_IRCTC.md) for the surrounding architecture.

## System Requirements

### Functional Requirements
- Search trains and live seat availability by class/quota
- Book a ticket for multiple passengers under a single PNR, with payment
- Waitlist/RAC placement and FIFO auto-promotion on cancellation
- Cancel a ticket and release its berth back to the pool
- PNR status and live running status lookup

### Non-Functional Requirements
- No two confirmed bookings may ever hold the same berth (correctness is non-negotiable)
- Survive a 1,000x+ request spike at Tatkal opening without corrupting inventory state
- Idempotent booking requests (safe to retry)
- Sub-5-second decision (confirm / waitlist / queued) even at peak Tatkal load

## Class Design

### Core Domain Classes

#### SeatInventory

The single most contested object in the system — one instance per `(train, date, coachClass, quota)`. All scale-handling logic concentrates here.

```javascript
class SeatInventory {
  constructor(trainId, journeyDate, coachClass, quota, totalBerths) {
    this.trainId = trainId;
    this.journeyDate = journeyDate;
    this.coachClass = coachClass;
    this.quota = quota;
    this.totalBerths = totalBerths;
    this.availableBerths = totalBerths;
    this.racAvailable = 0;
    this.waitlistCount = 0;
    this.version = 0; // optimistic-lock / CAS token for the DB row
  }

  key() {
    return `${this.trainId}:${this.journeyDate}:${this.coachClass}:${this.quota}`;
  }

  // Pure in-memory decision — no I/O. The cache-layer atomic version
  // of this (see KeyAlgorithms) is what actually runs under load;
  // this method documents the invariant it must preserve.
  canAllocate() {
    return this.availableBerths > 0;
  }
}
```

#### Berth

```javascript
class Berth {
  constructor(coachId, berthNumber, berthType) {
    this.coachId = coachId;
    this.berthNumber = berthNumber;
    this.berthType = berthType; // LOWER, MIDDLE, UPPER, SIDE_LOWER, SIDE_UPPER
    this.status = BerthStatus.FREE; // FREE, HELD, CONFIRMED
    this.bookingId = null;
    this.heldUntil = null;
  }

  isHeldExpired() {
    return this.status === BerthStatus.HELD && Date.now() > this.heldUntil;
  }
}

const BerthStatus = Object.freeze({ FREE: 'FREE', HELD: 'HELD', CONFIRMED: 'CONFIRMED' });
```

#### Booking (state machine)

```javascript
const BookingState = Object.freeze({
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  CONFIRMED: 'CONFIRMED',
  RAC: 'RAC',
  WAITLISTED: 'WAITLISTED',
  CANCELLED: 'CANCELLED',
});

const VALID_TRANSITIONS = {
  PAYMENT_PENDING: ['CONFIRMED', 'RAC', 'WAITLISTED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
  RAC: ['CONFIRMED', 'CANCELLED'],
  WAITLISTED: ['RAC', 'CONFIRMED', 'CANCELLED'],
  CANCELLED: [],
};

class Booking {
  constructor(bookingId, idempotencyKey, trainId, journeyDate, coachClass, quota, passengers) {
    this.bookingId = bookingId;
    this.idempotencyKey = idempotencyKey;
    this.trainId = trainId;
    this.journeyDate = journeyDate;
    this.coachClass = coachClass;
    this.quota = quota;
    this.passengers = passengers;
    this.state = BookingState.PAYMENT_PENDING;
    this.waitlistNumber = null;
    this.createdAt = new Date();
  }

  transitionTo(newState) {
    if (!VALID_TRANSITIONS[this.state].includes(newState)) {
      throw new Error(`Invalid booking transition: ${this.state} -> ${newState}`);
    }
    this.state = newState;
  }
}
```

#### WaitlistQueue

```javascript
class WaitlistQueue {
  constructor(trainId, journeyDate, coachClass, quota) {
    this.key = `${trainId}:${journeyDate}:${coachClass}:${quota}`;
    this.entries = []; // ordered array of bookingIds, FIFO
  }

  enqueue(bookingId) {
    this.entries.push(bookingId);
    return this.entries.length; // 1-based waitlist number
  }

  // Called when a berth frees up (cancellation). Returns the booking
  // to promote, or null if the queue is empty.
  dequeueNext() {
    return this.entries.length ? this.entries.shift() : null;
  }
}
```

#### SeatLockManager

Wraps the distributed-lock/atomic-counter operations against the cache layer — this is the boundary between pure domain objects above and the infrastructure that makes them safe under concurrency (detailed in [Key Algorithms](#key-algorithms)).

```javascript
class SeatLockManager {
  constructor(cacheClient) {
    this.cache = cacheClient; // Redis client
  }

  async tryReserve(inventoryKey) {
    // Atomic DECR via Lua script — see Key Algorithms section 1
    const remaining = await this.cache.evalDecrIfPositive(inventoryKey);
    return remaining >= 0; // true => this caller won a berth slot
  }

  async release(inventoryKey) {
    await this.cache.incr(inventoryKey);
  }

  async holdBerth(trainId, journeyDate, coachId, berthNumber, bookingId, ttlSeconds) {
    const holdKey = `hold:${trainId}:${journeyDate}:${coachId}:${berthNumber}`;
    // SET key bookingId NX PX ttlSeconds*1000 — fails if already held
    return this.cache.setIfNotExists(holdKey, bookingId, ttlSeconds * 1000);
  }
}
```

## Database Schema

See the [HLD document](../HLD/09_Design_IRCTC.md#database-design) for the full schema (`trains`, `coaches`, `seat_inventory`, `berth_allocation`, `bookings`, `passengers`, `waitlist_queue`, `payments`). The two fields that matter most at the LLD level:

```sql
-- seat_inventory.version: optimistic-lock token, incremented on every
-- successful allocate/release. A write only succeeds if the version
-- it read still matches at commit time (see Algorithm 2 below).
ALTER TABLE seat_inventory ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- bookings.idempotency_key: UNIQUE, so a retried request with the same
-- key can never create a second row — the DB itself enforces this,
-- the application just needs to catch the constraint violation and
-- return the original result.
ALTER TABLE bookings ADD CONSTRAINT uq_idempotency UNIQUE (idempotency_key);
```

## API Design

```javascript
// POST /api/v1/bookings
// Headers: Idempotency-Key: <uuid>
async function createBooking(req, res) {
  const { idempotencyKey } = req.headers;
  const existing = await bookingRepo.findByIdempotencyKey(idempotencyKey);
  if (existing) return res.status(200).json(existing); // safe retry

  const token = await waitingRoom.admit(req.body.trainId, req.body.date, req.body.coachClass);
  if (!token.admitted) {
    return res.status(202).json({ queueToken: token.id, position: token.position });
  }

  const result = await bookingService.attemptBooking(req.body, idempotencyKey);
  return res.status(result.status).json(result.body);
}
```

## Key Algorithms

### 1. Atomic seat reservation (Lua script on Redis)

The core invariant — "never let availableBerths go below zero" — must hold under massive concurrency without a database row lock. A single atomic script on the cache layer gives this for free:

```lua
-- KEYS[1] = inventory counter key
-- Returns remaining count AFTER decrement; -1 means "already exhausted, no decrement applied"
local current = tonumber(redis.call('GET', KEYS[1]))
if current == nil or current <= 0 then
  return -1
end
redis.call('DECR', KEYS[1])
return current - 1
```

Because Redis executes Lua scripts atomically (single-threaded), thousands of concurrent callers against the same key are serialized cheaply in memory — orders of magnitude cheaper than serializing them as row-locked SQL transactions.

### 2. Optimistic-lock confirm (durable write, after payment succeeds)

The cache counter decides *who gets a slot*; the database write that makes it durable still needs to avoid lost updates if two confirms somehow race (e.g., a retried webhook):

```javascript
async function confirmBerth(trainId, date, coachClass, quota, bookingId) {
  const row = await db.query(
    `SELECT available_berths, version FROM seat_inventory
     WHERE train_id=? AND journey_date=? AND coach_class=? AND quota=?`,
    [trainId, date, coachClass, quota]
  );

  const result = await db.query(
    `UPDATE seat_inventory
     SET available_berths = available_berths - 1, version = version + 1
     WHERE train_id=? AND journey_date=? AND coach_class=? AND quota=?
       AND version = ? AND available_berths > 0`,
    [trainId, date, coachClass, quota, row.version]
  );

  if (result.affectedRows === 0) {
    // Lost the race against another confirm — retry with backoff,
    // or fall back to waitlist if truly exhausted.
    return { confirmed: false, retry: true };
  }
  return { confirmed: true };
}
```

### 3. Hold → Confirm/Release saga

```javascript
async function attemptBooking(request, idempotencyKey) {
  const invKey = inventoryKey(request);

  const won = await seatLock.tryReserve(invKey);
  if (!won) {
    return waitlistService.enqueue(request, idempotencyKey);
  }

  const booking = await bookingRepo.create({
    ...request,
    idempotencyKey,
    state: 'PAYMENT_PENDING',
  });

  // Hold expires on its own TTL if payment never completes —
  // no separate cleanup job needed for the common case.
  await seatLock.holdBerth(request.trainId, request.date, request.coachId, request.berthNumber, booking.id, 300);

  const payment = await paymentService.initiate(booking);
  if (!payment.started) {
    await seatLock.release(invKey); // compensating action
    await bookingRepo.cancel(booking.id);
    return { status: 409, body: { error: 'PAYMENT_INIT_FAILED' } };
  }

  return { status: 201, body: { bookingId: booking.id, status: 'PAYMENT_PENDING' } };
}

// Called from the payment gateway webhook — must be idempotent,
// gateways retry callbacks.
async function onPaymentResult(paymentEvent) {
  const booking = await bookingRepo.findById(paymentEvent.bookingId);
  if (booking.state !== 'PAYMENT_PENDING') return; // already handled

  if (paymentEvent.success) {
    const result = await confirmBerth(booking.trainId, booking.journeyDate, booking.coachClass, booking.quota, booking.id);
    booking.transitionTo(result.confirmed ? 'CONFIRMED' : 'WAITLISTED');
  } else {
    await seatLock.release(inventoryKey(booking));
    booking.transitionTo('CANCELLED');
  }
  await bookingRepo.save(booking);
}
```

### 4. Virtual waiting room (token-bucket admission)

Converts an unbounded request burst into a bounded stream the booking service can actually process:

```javascript
class WaitingRoom {
  constructor(ratePerSecond, burstCapacity) {
    this.rate = ratePerSecond;
    this.capacity = burstCapacity;
    this.tokens = burstCapacity;
    this.lastRefill = Date.now();
    this.queue = [];
  }

  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.rate);
    this.lastRefill = now;
  }

  async admit(trainId, date, coachClass) {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { admitted: true };
    }
    const position = this.queue.length + 1;
    const ticket = { id: generateTokenId(), admitted: false, position };
    this.queue.push(ticket);
    return ticket;
  }
}
```

Running one `WaitingRoom` instance per hot `(train, date, class)` key — rather than one global instance — means a Tatkal surge on one popular train doesn't starve admission for every other train in the system.

### 5. Waitlist promotion on cancellation

```javascript
async function onCancellation(booking) {
  await db.transaction(async (tx) => {
    await berthRepo.release(tx, booking.coachId, booking.berthNumber);
    await seatLock.release(inventoryKey(booking));

    const nextBookingId = await waitlistQueue.dequeueNext(tx, inventoryKey(booking));
    if (nextBookingId) {
      const nextBooking = await bookingRepo.findById(tx, nextBookingId);
      nextBooking.transitionTo('CONFIRMED');
      await bookingRepo.save(tx, nextBooking);
      await notificationQueue.publish({ type: 'WAITLIST_PROMOTED', bookingId: nextBookingId });
    }
  });
}
```

Published as an async event off the cancellation request (via Kafka) rather than processed inline — the passenger cancelling doesn't need to wait for the promotion chain to run.

## Design Patterns

- **State** — `Booking` enforces valid transitions explicitly (`PAYMENT_PENDING → CONFIRMED/RAC/WAITLISTED → CANCELLED`), preventing an invalid jump like `CANCELLED → CONFIRMED`.
- **Saga** — booking + payment span two independent systems; the hold/confirm/release flow is the compensating-transaction pattern that keeps them consistent without a distributed transaction.
- **Strategy** — quota-specific allocation rules (General vs. Tatkal vs. Ladies/Senior-Citizen) are pluggable strategies sharing the same `SeatInventory` interface, so adding a new quota doesn't touch the core allocation path.
- **Observer** — waitlist promotion publishes an event consumed by independent notification/analytics workers, decoupling "a berth freed up" from "who needs to know."
- **Token Bucket** — the waiting room's admission control, isolating backend load from frontend request volume.

## Error Handling

| Failure | Handling |
|---|---|
| Two confirms race on the same inventory row | Optimistic-lock `UPDATE ... WHERE version = ?` fails for the loser; loser retries against the fresh row or falls back to waitlist. |
| Payment succeeds but the confirm write fails (crash, timeout) | Payment webhook is itself retried/idempotent; `onPaymentResult` re-runs safely since it's guarded by `booking.state !== 'PAYMENT_PENDING'`. |
| Payment never completes | Hold TTL expires; berth count is reconciled by a periodic sweep that treats `HELD` berths past `heldUntil` as `FREE` — no permanent leak even if the release call itself is lost. |
| Client retries a booking request | Unique `idempotency_key` constraint returns the original booking instead of creating a duplicate. |
| Waiting room queue grows unbounded | Queue depth is capped; beyond the cap, new arrivals get an immediate "try again later" rather than an ever-growing wait estimate. |

## Performance Optimizations

- **Cache-first seat counter** — the hot-path decision ("is there a berth") never touches the relational database; only the durable confirm does.
- **Per-(train,date,class) waiting rooms** — isolates one popular train's surge from degrading admission for the rest of the system.
- **Connection pooling + read replicas** — search/availability-display load is routed to replicas, never competing with booking-path writes for primary connections.
- **Pre-scheduled autoscaling** — because Tatkal opening time is exact and known in advance, capacity is scaled on a schedule ahead of the spike rather than reactively in response to observed load, which would already be too late.
- **Batched waitlist promotion** — cancellations are processed off a queue by a worker pool, not synchronously inside the cancellation request.
