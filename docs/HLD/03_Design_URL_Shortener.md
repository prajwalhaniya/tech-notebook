---
sidebar_position: 3
---

# Design URL Shortener Service

A comprehensive high-level design for building a scalable URL shortening service similar to bit.ly, TinyURL, or goo.gl.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Functional Requirements](#functional-requirements)
3. [Non-Functional Requirements](#non-functional-requirements)
4. [Capacity Estimation](#capacity-estimation)
5. [System APIs](#system-apis)
6. [Database Design](#database-design)
7. [High-Level Architecture](#high-level-architecture)
8. [Core Components](#core-components)
9. [URL Shortening Algorithm](#url-shortening-algorithm)
10. [URL Redirection Flow](#url-redirection-flow)
11. [Caching Strategy](#caching-strategy)
12. [Analytics & Monitoring](#analytics--monitoring)
13. [Security Considerations](#security-considerations)
14. [Scalability & Performance](#scalability--performance)
15. [Trade-offs & Design Decisions](#trade-offs--design-decisions)

---

## Problem Statement

Design a URL shortening service that allows users to convert long URLs into short, memorable links. When users access these short links, they should be seamlessly redirected to the original long URL.

**Example:**
- Long URL: `https://www.example.com/articles/2024/best-practices-for-system-design?utm_source=newsletter`
- Short URL: `https://short.ly/abc123`

### Key Challenges

1. Generate unique, short URLs for billions of long URLs
2. Handle high read-to-write ratio (100:1 or more)
3. Ensure low-latency redirects (< 100ms)
4. Provide analytics and tracking capabilities
5. Scale horizontally to handle millions of requests per second

---

## Functional Requirements

### Core Features

**FR1:** Users should be able to create a short URL from a long URL
- System generates a unique short URL
- Optional custom alias support (e.g., `short.ly/my-custom-link`)

**FR2:** Users should be redirected to the original URL when accessing the short URL
- HTTP 301 (permanent) or 302 (temporary) redirect
- Redirect should happen within 100ms

**FR3:** Short URLs should have a configurable expiration time
- Default expiration: Never (permanent)
- Optional: 1 day, 7 days, 30 days, custom

**FR4:** Users should be able to view basic analytics
- Total clicks
- Click timestamps
- Geographic distribution
- Referrer information
- Device/browser information

**FR5:** Users should be able to delete or update their short URLs
- Soft delete (mark as inactive)
- Update destination URL

### Optional Features

**FR6:** Custom URL aliases (vanity URLs)
**FR7:** QR code generation for short URLs
**FR8:** API rate limiting per user
**FR9:** Link preview generation
**FR10:** Bulk URL shortening

---

## Non-Functional Requirements

### Performance

**NFR1:** High Availability - 99.99% uptime

**NFR2:** Low Latency - < 100ms for redirects

**NFR3:** High Throughput - Support millions of requests per second

**NFR4:** Read-heavy system - 100:1 read-to-write ratio

### Scalability

**NFR5:** Handle billions of URLs

**NFR6:** Scale horizontally without downtime

**NFR7:** Support global distribution (multi-region)

### Reliability

**NFR8:** Data durability - No data loss

**NFR9:** Fault tolerance - Handle server failures gracefully

**NFR10:** Consistent URL generation - No duplicate short URLs

### Security

**NFR11:** Prevent malicious URLs (phishing, malware)

**NFR12:** Rate limiting to prevent abuse

**NFR13:** DDoS protection

**NFR14:** HTTPS for all connections

### Maintainability

**NFR15:** Monitoring and alerting

**NFR16:** Easy to debug and trace requests

**NFR17:** Versioned APIs

---

## Capacity Estimation

### Traffic Estimation

**Assumptions:**
- 500 million new URLs created per month
- Read-to-write ratio: 100:1
- Average URL stored for 10 years

**Write Requests:**
```
URLs per month: 500M
URLs per second: 500M / (30 days × 24 hrs × 3600 sec) = ~200 URLs/sec
Peak traffic (3x average): 600 URLs/sec
```

**Read Requests:**
```
Redirects per second: 200 × 100 = 20,000 redirects/sec
Peak redirects: 60,000 redirects/sec
```

### Storage Estimation

**URL Storage:**
```
Average long URL size: 200 bytes
Short URL (hash): 7 bytes
Metadata (timestamps, user_id, etc.): 100 bytes
Total per URL: ~307 bytes ≈ 500 bytes (with overhead)

Monthly storage: 500M URLs × 500 bytes = 250 GB/month
10-year storage: 250 GB × 12 × 10 = 30 TB

With 3x replication: 90 TB
With 30% overhead: 117 TB
```

**Analytics Storage:**
```
Click event: ~100 bytes (timestamp, IP, user-agent, referrer)
Clicks per month: 500M × 100 (read ratio) = 50B clicks
Monthly analytics: 50B × 100 bytes = 5 TB/month
Annual analytics: 60 TB/year
```

### Bandwidth Estimation

**Incoming (Write):**
```
200 URLs/sec × 500 bytes = 100 KB/sec = 0.8 Mbps
Peak: 2.4 Mbps
```

**Outgoing (Read):**
```
20,000 redirects/sec × 500 bytes = 10 MB/sec = 80 Mbps
Peak: 240 Mbps
```

### Memory Estimation (Cache)

**Cache Strategy:** Cache 20% of hot URLs (80/20 rule)

```
Daily requests: 20,000 redirects/sec × 86,400 sec = 1.7B requests/day
Unique URLs (assume 80% overlap): ~340M unique URLs/day
Cache 20% of hot URLs: 68M URLs

Memory needed: 68M × 500 bytes = 34 GB
With metadata: ~50 GB per cache server
```

### Summary

| Metric | Value |
|--------|-------|
| Write QPS | 200 (600 peak) |
| Read QPS | 20,000 (60,000 peak) |
| Storage (10 years) | 117 TB |
| Bandwidth | 80 Mbps (240 peak) |
| Cache Memory | 50 GB/server |

---

## System APIs

### REST API Design

#### 1. Create Short URL

```http
POST /api/v1/urls
Content-Type: application/json
Authorization: Bearer <token>

Request:
{
  "long_url": "https://example.com/very/long/url",
  "custom_alias": "my-link",  // optional
  "expiration_time": "2024-12-31T23:59:59Z"  // optional
}

Response (201 Created):
{
  "short_url": "https://short.ly/abc123",
  "long_url": "https://example.com/very/long/url",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-12-31T23:59:59Z",
  "url_id": "abc123"
}

Error Response (409 Conflict):
{
  "error": "Custom alias already exists",
  "code": "ALIAS_EXISTS"
}
```

#### 2. Redirect to Original URL

```http
GET /{short_code}

Response (301 Moved Permanently):
Location: https://example.com/very/long/url

Or (302 Found) for temporary redirects

Error Response (404 Not Found):
{
  "error": "URL not found or expired",
  "code": "URL_NOT_FOUND"
}
```

#### 3. Get URL Analytics

```http
GET /api/v1/urls/{short_code}/analytics
Authorization: Bearer <token>

Response (200 OK):
{
  "short_code": "abc123",
  "total_clicks": 15420,
  "created_at": "2024-01-15T10:30:00Z",
  "last_accessed": "2024-01-16T14:22:10Z",
  "clicks_by_date": [
    {"date": "2024-01-15", "count": 1200},
    {"date": "2024-01-16", "count": 950}
  ],
  "clicks_by_country": [
    {"country": "US", "count": 8500},
    {"country": "IN", "count": 3200}
  ],
  "clicks_by_referrer": [
    {"referrer": "twitter.com", "count": 5000},
    {"referrer": "facebook.com", "count": 3200}
  ]
}
```

#### 4. Delete URL

```http
DELETE /api/v1/urls/{short_code}
Authorization: Bearer <token>

Response (204 No Content)

Error Response (404 Not Found):
{
  "error": "URL not found",
  "code": "URL_NOT_FOUND"
}
```

#### 5. Update URL

```http
PUT /api/v1/urls/{short_code}
Authorization: Bearer <token>

Request:
{
  "long_url": "https://example.com/updated/url",
  "expiration_time": "2025-12-31T23:59:59Z"
}

Response (200 OK):
{
  "short_url": "https://short.ly/abc123",
  "long_url": "https://example.com/updated/url",
  "updated_at": "2024-01-16T15:30:00Z"
}
```

---

## Database Design

### Schema Design

#### URLs Table (Primary Storage)

```sql
CREATE TABLE urls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_custom BOOLEAN DEFAULT FALSE,

    INDEX idx_short_code (short_code),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_expires_at (expires_at)
);
```

**Design Decisions:**
- `short_code` is the unique identifier (indexed)
- `long_url` stored as TEXT to support very long URLs
- `expires_at` allows NULL for permanent URLs
- `is_active` for soft deletes
- Indexes on frequently queried fields

#### Analytics Table (Click Tracking)

```sql
CREATE TABLE url_clicks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(10) NOT NULL,
    clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer TEXT,
    country VARCHAR(2),
    city VARCHAR(100),
    device_type VARCHAR(20),

    INDEX idx_short_code (short_code),
    INDEX idx_clicked_at (clicked_at),
    FOREIGN KEY (short_code) REFERENCES urls(short_code)
);
```

**Design Decisions:**
- Separate table for analytics to avoid bloating URLs table
- Partitioned by date for efficient queries and archival
- Time-series data, can use time-series databases (InfluxDB, TimescaleDB)

#### Users Table (Optional)

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    api_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rate_limit INT DEFAULT 1000,
    is_premium BOOLEAN DEFAULT FALSE,

    INDEX idx_email (email),
    INDEX idx_api_key (api_key)
);
```

### NoSQL Alternative (Key-Value Store)

For extremely high-scale systems, consider NoSQL:

**DynamoDB / Cassandra Schema:**

```javascript
// URLs Table
{
  partition_key: "short_code",  // e.g., "abc123"
  attributes: {
    long_url: "https://example.com/...",
    user_id: "user_12345",
    created_at: 1705315800,
    expires_at: 1735689599,
    is_active: true
  }
}

// Analytics Table (Time-series)
{
  partition_key: "short_code#YYYYMMDD",  // e.g., "abc123#20240115"
  sort_key: "timestamp",
  attributes: {
    ip: "192.168.1.1",
    country: "US",
    referrer: "twitter.com"
  }
}
```

**Benefits:**
- Horizontal scalability
- Low-latency reads/writes
- No schema migrations
- Global distribution

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  (Web Browser, Mobile App, API Clients)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       LOAD BALANCER                             │
│  (AWS ALB / NGINX / HAProxy)                                    │
│  - SSL Termination                                              │
│  - Health Checks                                                │
│  - Geographic Routing                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  API Server │  │  API Server │  │  API Server │
│   Node 1    │  │   Node 2    │  │   Node 3    │
│             │  │             │  │             │
│ - URL Gen   │  │ - URL Gen   │  │ - URL Gen   │
│ - Redirect  │  │ - Redirect  │  │ - Redirect  │
│ - Analytics │  │ - Analytics │  │ - Analytics │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CACHE LAYER (Redis Cluster)                 │
│  - Hot URLs (20% = 80% traffic)                                │
│  - TTL-based eviction                                           │
│  - Distributed caching with replication                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ Cache Miss
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE LAYER (Primary/Replica)               │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐                       │
│  │   Primary    │─────▶│   Replica 1  │                       │
│  │   (Write)    │      │   (Read)     │                       │
│  └──────────────┘      └──────────────┘                       │
│         │                                                       │
│         │              ┌──────────────┐                       │
│         └─────────────▶│   Replica 2  │                       │
│                        │   (Read)     │                       │
│                        └──────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ANALYTICS & MONITORING                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Message    │  │  Analytics   │  │  Monitoring  │        │
│  │   Queue      │─▶│  Service     │  │  (Prometheus)│        │
│  │   (Kafka)    │  │  (Spark)     │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Components

1. **Load Balancer:** Distributes traffic across API servers
2. **API Servers:** Stateless application servers (Node.js, Go, Java)
3. **Cache Layer:** Redis cluster for fast lookups
4. **Database:** PostgreSQL/MySQL with read replicas
5. **Message Queue:** Kafka/RabbitMQ for async analytics
6. **Analytics Service:** Process click events and generate reports
7. **Monitoring:** Prometheus + Grafana for metrics

---

## Core Components

### 1. URL Shortening Service

**Responsibilities:**
- Generate unique short codes
- Validate long URLs
- Store URL mappings
- Handle custom aliases
- Check for duplicates

**Implementation (Node.js):**

```javascript
class URLShortenerService {
  constructor(database, cache, generator) {
    this.db = database;
    this.cache = cache;
    this.generator = generator;
  }

  async createShortURL(longURL, customAlias = null, userId = null, expiresAt = null) {
    // Validate URL
    if (!this.isValidURL(longURL)) {
      throw new Error('Invalid URL');
    }

    // Check if custom alias exists
    if (customAlias) {
      const exists = await this.db.checkAliasExists(customAlias);
      if (exists) {
        throw new Error('Custom alias already exists');
      }
      shortCode = customAlias;
    } else {
      // Generate unique short code
      shortCode = await this.generateUniqueShortCode();
    }

    // Store in database
    const urlData = {
      short_code: shortCode,
      long_url: longURL,
      user_id: userId,
      expires_at: expiresAt,
      created_at: new Date(),
      is_custom: !!customAlias
    };

    await this.db.insertURL(urlData);

    // Cache the mapping
    await this.cache.set(shortCode, longURL, { ttl: 3600 });

    return {
      short_url: `https://short.ly/${shortCode}`,
      long_url: longURL,
      short_code: shortCode
    };
  }

  async generateUniqueShortCode() {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const shortCode = this.generator.generate();
      const exists = await this.db.checkShortCodeExists(shortCode);

      if (!exists) {
        return shortCode;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique short code');
  }

  isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. Redirect Service

**Responsibilities:**
- Lookup short code
- Return original URL
- Handle 301/302 redirects
- Track click events
- Handle expired URLs

**Implementation:**

```javascript
class RedirectService {
  constructor(database, cache, analytics) {
    this.db = database;
    this.cache = cache;
    this.analytics = analytics;
  }

  async redirect(shortCode, request) {
    // Try cache first
    let longURL = await this.cache.get(shortCode);

    if (!longURL) {
      // Cache miss - query database
      const urlData = await this.db.getURLByShortCode(shortCode);

      if (!urlData) {
        throw new Error('URL not found');
      }

      // Check expiration
      if (urlData.expires_at && new Date() > urlData.expires_at) {
        throw new Error('URL expired');
      }

      // Check if active
      if (!urlData.is_active) {
        throw new Error('URL has been deleted');
      }

      longURL = urlData.long_url;

      // Update cache
      await this.cache.set(shortCode, longURL, { ttl: 3600 });
    }

    // Track click asynchronously
    this.trackClick(shortCode, request);

    return longURL;
  }

  async trackClick(shortCode, request) {
    const clickData = {
      short_code: shortCode,
      clicked_at: new Date(),
      ip_address: request.ip,
      user_agent: request.headers['user-agent'],
      referrer: request.headers['referer'],
      country: this.getCountryFromIP(request.ip)
    };

    // Send to message queue for async processing
    await this.analytics.track(clickData);
  }

  getCountryFromIP(ip) {
    // Use GeoIP service
    // Implementation details omitted
    return 'US';
  }
}
```

### 3. Analytics Service

**Responsibilities:**
- Process click events
- Aggregate statistics
- Generate reports
- Store time-series data

**Implementation:**

```javascript
class AnalyticsService {
  constructor(database, messageQueue) {
    this.db = database;
    this.queue = messageQueue;
  }

  async track(clickData) {
    // Publish to message queue for async processing
    await this.queue.publish('url_clicks', clickData);
  }

  async processClickEvents() {
    // Consume from message queue
    this.queue.subscribe('url_clicks', async (clickData) => {
      // Batch insert to database
      await this.db.insertClick(clickData);
    });
  }

  async getAnalytics(shortCode, startDate, endDate) {
    const analytics = await this.db.getClickAnalytics(shortCode, startDate, endDate);

    return {
      total_clicks: analytics.total,
      clicks_by_date: analytics.byDate,
      clicks_by_country: analytics.byCountry,
      clicks_by_referrer: analytics.byReferrer,
      clicks_by_device: analytics.byDevice
    };
  }
}
```

---

## URL Shortening Algorithm

### Approach 1: Hash-Based Generation

**MD5/SHA256 Hash + Base62 Encoding**

```javascript
class HashBasedGenerator {
  generate(longURL) {
    // Generate hash
    const hash = crypto.createHash('md5').update(longURL).digest('hex');

    // Take first 6-8 characters
    const shortHash = hash.substring(0, 7);

    // Convert to Base62
    const base62 = this.hexToBase62(shortHash);

    return base62;
  }

  hexToBase62(hex) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let num = parseInt(hex, 16);
    let result = '';

    while (num > 0) {
      result = chars[num % 62] + result;
      num = Math.floor(num / 62);
    }

    return result || '0';
  }
}
```

**Pros:**
- Deterministic (same URL = same hash)
- No database lookup needed during generation

**Cons:**
- Collision possible (requires handling)
- Cannot guarantee uniqueness
- Same long URL gets same short URL (may not be desired)

### Approach 2: Counter-Based Generation (Recommended)

**Auto-increment ID + Base62 Encoding**

```javascript
class CounterBasedGenerator {
  constructor(database) {
    this.db = database;
  }

  async generate() {
    // Get next ID from database counter
    const id = await this.db.getNextSequence('url_counter');

    // Convert to Base62
    const base62 = this.toBase62(id);

    return base62;
  }

  toBase62(num) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    if (num === 0) return chars[0];

    while (num > 0) {
      result = chars[num % 62] + result;
      num = Math.floor(num / 62);
    }

    return result;
  }

  fromBase62(str) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let num = 0;

    for (let i = 0; i < str.length; i++) {
      num = num * 62 + chars.indexOf(str[i]);
    }

    return num;
  }
}
```

**Pros:**
- Guaranteed uniqueness
- No collisions
- Predictable length growth

**Cons:**
- Requires database lookup for counter
- Sequential IDs (security concern - can be mitigated with randomization)

**Optimization:** Use distributed ID generators (Snowflake, Twitter ID)

### Approach 3: Random String Generation

```javascript
class RandomGenerator {
  generate(length = 7) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars[randomIndex];
    }

    return result;
  }
}
```

**Pros:**
- Simple implementation
- Non-sequential (more secure)

**Cons:**
- Requires uniqueness check
- Collision probability increases over time

### Base62 Encoding Explained

**Why Base62?**
- Uses: `0-9` (10) + `a-z` (26) + `A-Z` (26) = 62 characters
- URL-safe (no special characters)
- Compact representation

**Length Calculation:**

```
62^6 = 56.8 billion combinations
62^7 = 3.5 trillion combinations
62^8 = 218 trillion combinations
```

For 500M URLs, 6 characters sufficient initially, scale to 7 for long-term.

---

## URL Redirection Flow

### Flow Diagram

```
User clicks short URL
        │
        ▼
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   API Server    │
└────────┬────────┘
         │
         ▼
  Check Redis Cache
         │
    ┌────┴────┐
    │         │
  Hit ✓     Miss ✗
    │         │
    │         ▼
    │   Query Database
    │         │
    │         ▼
    │   Update Cache
    │         │
    └────┬────┘
         │
         ▼
    Validate URL
    (active, not expired)
         │
         ▼
   Track Click Event
   (async via queue)
         │
         ▼
  Return 301/302 Redirect
```

### Implementation

```javascript
// Express.js Route Handler
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Redirect service
    const longURL = await redirectService.redirect(shortCode, req);

    // Return 301 (permanent) or 302 (temporary) redirect
    res.redirect(301, longURL);
  } catch (error) {
    if (error.message === 'URL not found') {
      res.status(404).json({ error: 'Short URL not found' });
    } else if (error.message === 'URL expired') {
      res.status(410).json({ error: 'Short URL has expired' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

### HTTP Redirect Status Codes

**301 (Moved Permanently):**
- Browsers cache the redirect
- Subsequent requests go directly to long URL
- Analytics lost after first click (browser doesn't hit server)
- Use for: Permanent redirects where analytics not critical

**302 (Found / Temporary Redirect):**
- Browsers don't cache
- Every click hits the server
- Full analytics tracking
- Use for: Temporary redirects, analytics-heavy use cases

**Trade-off:** 301 = Better performance, 302 = Better analytics

---

## Caching Strategy

### Cache Layer Design

**Technology:** Redis Cluster with replication

**Cache Architecture:**

```
┌──────────────────────────────────────────────┐
│          Redis Cluster (3 Masters)           │
│                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  │  Master 1  │  │  Master 2  │  │  Master 3  │
│  │  (Shards   │  │  (Shards   │  │  (Shards   │
│  │   0-5461)  │  │  5462-10922│  │ 10923-16383│
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
│        │               │               │
│        ▼               ▼               ▼
│  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  │  Replica 1 │  │  Replica 2 │  │  Replica 3 │
│  └────────────┘  └────────────┘  └────────────┘
└──────────────────────────────────────────────┘
```

### Caching Policies

**1. Cache-Aside (Lazy Loading):**

```javascript
async function getURL(shortCode) {
  // Try cache
  let url = await cache.get(shortCode);

  if (url) {
    return url; // Cache hit
  }

  // Cache miss - query DB
  url = await db.query('SELECT long_url FROM urls WHERE short_code = ?', [shortCode]);

  // Update cache
  if (url) {
    await cache.set(shortCode, url, { ttl: 3600 }); // 1 hour TTL
  }

  return url;
}
```

**2. Write-Through:**

```javascript
async function createURL(shortCode, longURL) {
  // Write to DB
  await db.insert({ short_code: shortCode, long_url: longURL });

  // Write to cache
  await cache.set(shortCode, longURL, { ttl: 3600 });

  return shortCode;
}
```

### Cache Eviction Policy

**Strategy:** LRU (Least Recently Used) with TTL

**Configuration:**
- TTL: 1 hour for normal URLs
- TTL: 24 hours for hot URLs (high traffic)
- Max memory: 50 GB per Redis instance
- Eviction: `allkeys-lru` when memory limit reached

### Cache Warming

**Preload hot URLs on startup:**

```javascript
async function warmCache() {
  // Get top 1000 most accessed URLs
  const hotURLs = await db.query(`
    SELECT short_code, long_url
    FROM urls
    ORDER BY access_count DESC
    LIMIT 1000
  `);

  // Load into cache
  for (const url of hotURLs) {
    await cache.set(url.short_code, url.long_url, { ttl: 86400 }); // 24h
  }
}
```

---

## Analytics & Monitoring

### Analytics Architecture

```
Click Event → API Server → Kafka Topic → Analytics Service → Time-Series DB
                                              │
                                              ▼
                                        Aggregation Jobs
                                              │
                                              ▼
                                        Analytics DB
```

### Click Tracking Implementation

**Async Event Publishing:**

```javascript
class ClickTracker {
  constructor(kafkaProducer) {
    this.kafka = kafkaProducer;
  }

  async track(shortCode, metadata) {
    const event = {
      short_code: shortCode,
      timestamp: Date.now(),
      ip: metadata.ip,
      user_agent: metadata.userAgent,
      referrer: metadata.referrer,
      country: metadata.country,
      city: metadata.city,
      device: this.parseDevice(metadata.userAgent)
    };

    // Publish to Kafka (fire and forget)
    await this.kafka.send({
      topic: 'url_clicks',
      messages: [{ value: JSON.stringify(event) }]
    });
  }

  parseDevice(userAgent) {
    // Parse user agent to determine device type
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }
}
```

### Analytics Aggregation

**Batch Processing (Spark/Flink):**

```javascript
// Pseudo-code for aggregation job
function aggregateClicks() {
  // Run every hour
  const clicks = kafka.consume('url_clicks', { from: lastHour });

  // Aggregate by short_code
  const aggregated = clicks.groupBy('short_code').aggregate({
    total_clicks: count(),
    by_country: groupBy('country').count(),
    by_referrer: groupBy('referrer').count(),
    by_device: groupBy('device').count()
  });

  // Store in analytics DB
  analyticsDB.insert(aggregated);
}
```

### Metrics & Monitoring

**Key Metrics:**

1. **Performance Metrics:**
   - Redirect latency (p50, p95, p99)
   - API response time
   - Cache hit ratio
   - Database query time

2. **Business Metrics:**
   - URLs created per second
   - Redirects per second
   - Active URLs count
   - Top URLs by traffic

3. **System Metrics:**
   - CPU utilization
   - Memory usage
   - Network I/O
   - Disk I/O

**Implementation (Prometheus):**

```javascript
const prometheus = require('prom-client');

// Counter for total redirects
const redirectCounter = new prometheus.Counter({
  name: 'url_redirects_total',
  help: 'Total number of URL redirects',
  labelNames: ['status']
});

// Histogram for redirect latency
const redirectLatency = new prometheus.Histogram({
  name: 'url_redirect_duration_seconds',
  help: 'URL redirect duration in seconds',
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
});

// Gauge for cache hit ratio
const cacheHitRatio = new prometheus.Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio percentage'
});

// Track metrics
app.get('/:shortCode', async (req, res) => {
  const timer = redirectLatency.startTimer();

  try {
    const url = await redirectService.redirect(req.params.shortCode, req);
    redirectCounter.inc({ status: 'success' });
    res.redirect(301, url);
  } catch (error) {
    redirectCounter.inc({ status: 'error' });
    res.status(404).send('Not found');
  } finally {
    timer();
  }
});
```

---

## Security Considerations

### 1. Malicious URL Prevention

**URL Validation:**

```javascript
class URLValidator {
  async validate(url) {
    // Check URL format
    if (!this.isValidFormat(url)) {
      throw new Error('Invalid URL format');
    }

    // Check against blacklist
    if (await this.isBlacklisted(url)) {
      throw new Error('URL is blacklisted');
    }

    // Check for phishing
    if (await this.isPhishing(url)) {
      throw new Error('Potential phishing URL');
    }

    // Check for malware
    if (await this.hasMalware(url)) {
      throw new Error('URL contains malware');
    }

    return true;
  }

  async isBlacklisted(url) {
    // Check against Google Safe Browsing API
    const response = await fetch('https://safebrowsing.googleapis.com/v4/threatMatches:find', {
      method: 'POST',
      body: JSON.stringify({
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }]
        }
      })
    });

    const data = await response.json();
    return data.matches && data.matches.length > 0;
  }
}
```

### 2. Rate Limiting

**Token Bucket Algorithm:**

```javascript
class RateLimiter {
  constructor(redis) {
    this.redis = redis;
  }

  async checkLimit(userId, limit = 100, window = 3600) {
    const key = `ratelimit:${userId}`;
    const current = await this.redis.incr(key);

    if (current === 1) {
      // Set expiry on first request
      await this.redis.expire(key, window);
    }

    if (current > limit) {
      throw new Error('Rate limit exceeded');
    }

    return {
      allowed: true,
      remaining: limit - current
    };
  }
}

// Middleware
app.use(async (req, res, next) => {
  try {
    const userId = req.user?.id || req.ip;
    await rateLimiter.checkLimit(userId, 100, 3600); // 100 req/hour
    next();
  } catch (error) {
    res.status(429).json({ error: 'Too many requests' });
  }
});
```

### 3. API Authentication

**API Key Authentication:**

```javascript
async function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Validate API key
  const user = await db.query('SELECT * FROM users WHERE api_key = ?', [apiKey]);

  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.user = user;
  next();
}

app.post('/api/v1/urls', authenticate, createURLHandler);
```

### 4. DDoS Protection

**Strategies:**
- Use CDN (Cloudflare, Akamai) for DDoS mitigation
- Implement rate limiting at multiple layers
- Use Web Application Firewall (WAF)
- Geo-blocking for suspicious regions
- Challenge-response (CAPTCHA) for high-risk requests

### 5. HTTPS Enforcement

```javascript
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

---

## Scalability & Performance

### Horizontal Scaling

**Stateless API Servers:**
- No session state stored in servers
- Any server can handle any request
- Easy to add/remove servers

**Database Scaling:**

1. **Read Replicas:**
   - Master for writes
   - Multiple replicas for reads
   - Route read queries to replicas

2. **Sharding (Partitioning):**
   - Partition by short_code range
   - Consistent hashing for distribution
   - Example: `short_code[0]` determines shard

```javascript
class DatabaseRouter {
  getShardForShortCode(shortCode) {
    // Hash-based sharding
    const hash = this.hash(shortCode);
    const shardId = hash % this.totalShards;
    return this.shards[shardId];
  }

  async query(shortCode) {
    const shard = this.getShardForShortCode(shortCode);
    return await shard.query('SELECT * FROM urls WHERE short_code = ?', [shortCode]);
  }
}
```

### Geographic Distribution

**Multi-Region Deployment:**

```
┌──────────────────────────────────────────────────────────┐
│                    DNS / Route53                         │
│              (GeoDNS-based routing)                      │
└───────────────┬──────────────────┬───────────────────────┘
                │                  │
      ┌─────────▼────────┐  ┌──────▼─────────┐
      │   US Region      │  │  EU Region     │
      │                  │  │                │
      │  - API Servers   │  │  - API Servers │
      │  - Redis Cache   │  │  - Redis Cache │
      │  - DB Replica    │  │  - DB Replica  │
      └──────────────────┘  └────────────────┘
```

**Benefits:**
- Lower latency for users
- Higher availability
- Regulatory compliance (GDPR)

### Performance Optimizations

**1. Connection Pooling:**

```javascript
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'url_shortener',
  connectionLimit: 100,
  queueLimit: 0
});
```

**2. Async Processing:**

```javascript
// Don't wait for analytics tracking
app.get('/:shortCode', async (req, res) => {
  const url = await getURL(req.params.shortCode);

  // Track click asynchronously (fire-and-forget)
  trackClick(req.params.shortCode, req).catch(err => logger.error(err));

  res.redirect(301, url);
});
```

**3. Database Indexing:**

```sql
CREATE INDEX idx_short_code ON urls(short_code);
CREATE INDEX idx_user_id ON urls(user_id);
CREATE INDEX idx_created_at ON urls(created_at);
```

**4. Response Compression:**

```javascript
const compression = require('compression');
app.use(compression());
```

**5. CDN for Static Assets:**
- Serve static files (landing page, docs) via CDN
- Reduce load on API servers

---

## Trade-offs & Design Decisions

### 1. Short Code Length

**Decision:** 7 characters (Base62)

| Length | Combinations | Use Case |
|--------|--------------|----------|
| 5 | 916M | Small scale |
| 6 | 56.8B | Medium scale |
| 7 | 3.5T | Large scale ✓ |
| 8 | 218T | Overkill |

**Rationale:**
- 7 characters support 3.5 trillion URLs
- Balance between length and capacity
- Short enough for easy sharing

### 2. 301 vs 302 Redirect

**Decision:** Use 302 (Temporary Redirect)

**Rationale:**
- Need full analytics tracking
- Can't track if browser caches (301)
- Slight performance hit acceptable for analytics value

**Alternative:** Offer both options, let users choose

### 3. SQL vs NoSQL

**Decision:** Start with SQL (PostgreSQL), migrate to NoSQL if needed

| Database | Pros | Cons |
|----------|------|------|
| PostgreSQL | ACID, relations, mature | Vertical scaling limits |
| Cassandra | Horizontal scaling, high write | Eventual consistency |
| DynamoDB | Managed, scalable | Vendor lock-in, cost |

**Rationale:**
- PostgreSQL handles billions of rows
- Easier to query and maintain
- Can shard if needed
- Migrate to NoSQL only if necessary

### 4. Hash vs Counter for Short Code

**Decision:** Counter-based with Base62 encoding

**Rationale:**
- Guaranteed uniqueness
- No collision handling
- Predictable behavior
- Can add randomization for security

### 5. Cache Expiration

**Decision:** 1-hour TTL for normal URLs, 24-hour for hot URLs

**Rationale:**
- Balance between freshness and performance
- Hot URLs rarely change
- Reduces database load

### 6. Analytics Granularity

**Decision:** Store raw events, aggregate hourly

**Rationale:**
- Raw events for flexibility
- Aggregations for performance
- Can run custom queries on raw data

### 7. Expiration Handling

**Decision:** Soft delete + periodic cleanup job

**Rationale:**
- Immediate marking as expired (soft delete)
- Batch cleanup to save resources
- Can restore accidentally expired URLs

---

## Summary

This URL shortener design supports:

- **Scale:** Billions of URLs, millions of requests/sec
- **Performance:** < 100ms redirect latency
- **Availability:** 99.99% uptime with multi-region deployment
- **Analytics:** Comprehensive click tracking and reporting
- **Security:** Rate limiting, malware detection, DDoS protection

**Key Technologies:**
- **API Servers:** Node.js/Go
- **Cache:** Redis Cluster
- **Database:** PostgreSQL with read replicas
- **Message Queue:** Kafka
- **Analytics:** Apache Spark
- **Monitoring:** Prometheus + Grafana
- **CDN:** Cloudflare
