---
sidebar_position: 3
---

# Design URL Shortener Service

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

This document provides the Low-Level Design (LLD) for a URL Shortener Service, focusing on detailed class structures, data models, and implementation details for core features including URL shortening, redirection, analytics tracking, caching, and security.

## System Requirements

### Functional Requirements
- Create short URLs from long URLs
- Redirect short URLs to original URLs
- Support custom aliases (vanity URLs)
- URL expiration management
- Analytics tracking (clicks, geography, referrer)
- User authentication and authorization
- Rate limiting
- URL validation and security checks

### Non-Functional Requirements
- High availability (99.99% uptime)
- Low latency (< 100ms for redirects)
- Scalability (billions of URLs, millions of requests/sec)
- High read-to-write ratio (100:1)
- Data durability and consistency

## Class Design

### Core Classes

#### URL
```javascript
class URL {
  constructor(urlId, shortCode, longUrl, userId = null) {
    this.urlId = urlId;
    this.shortCode = shortCode;
    this.longUrl = longUrl;
    this.userId = userId;
    this.createdAt = new Date();
    this.expiresAt = null;
    this.isActive = true;
    this.isCustom = false;
    this.clickCount = 0;
    this.lastAccessedAt = null;
  }

  isExpired() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  deactivate() {
    this.isActive = false;
  }

  activate() {
    this.isActive = true;
  }

  updateExpiration(expiresAt) {
    this.expiresAt = expiresAt;
  }

  incrementClickCount() {
    this.clickCount++;
    this.lastAccessedAt = new Date();
  }
}
```

#### User
```javascript
class User {
  constructor(userId, email, apiKey) {
    this.userId = userId;
    this.email = email;
    this.apiKey = apiKey;
    this.createdAt = new Date();
    this.rateLimit = 1000; // requests per hour
    this.isPremium = false;
    this.urlsCount = 0;
  }

  updateRateLimit(newLimit) {
    this.rateLimit = newLimit;
  }

  upgradeToPremium() {
    this.isPremium = true;
    this.rateLimit = 10000; // Higher limit for premium
  }

  incrementUrlsCount() {
    this.urlsCount++;
  }
}
```

#### ClickEvent
```javascript
class ClickEvent {
  constructor(clickId, shortCode, metadata) {
    this.clickId = clickId;
    this.shortCode = shortCode;
    this.clickedAt = new Date();
    this.ipAddress = metadata.ipAddress;
    this.userAgent = metadata.userAgent;
    this.referrer = metadata.referrer || null;
    this.country = metadata.country || null;
    this.city = metadata.city || null;
    this.deviceType = metadata.deviceType || null;
    this.browser = metadata.browser || null;
  }

  getDeviceType() {
    if (!this.userAgent) return 'unknown';
    if (/mobile/i.test(this.userAgent)) return 'mobile';
    if (/tablet/i.test(this.userAgent)) return 'tablet';
    return 'desktop';
  }

  getBrowser() {
    if (!this.userAgent) return 'unknown';
    if (this.userAgent.includes('Chrome')) return 'Chrome';
    if (this.userAgent.includes('Firefox')) return 'Firefox';
    if (this.userAgent.includes('Safari')) return 'Safari';
    if (this.userAgent.includes('Edge')) return 'Edge';
    return 'unknown';
  }
}
```

#### Analytics
```javascript
class Analytics {
  constructor(shortCode) {
    this.shortCode = shortCode;
    this.totalClicks = 0;
    this.clicksByDate = new Map(); // date -> count
    this.clicksByCountry = new Map(); // country -> count
    this.clicksByReferrer = new Map(); // referrer -> count
    this.clicksByDevice = new Map(); // device -> count
    this.clicksByBrowser = new Map(); // browser -> count
    this.firstClickAt = null;
    this.lastClickAt = null;
  }

  addClick(clickEvent) {
    this.totalClicks++;
    
    const date = clickEvent.clickedAt.toISOString().split('T')[0];
    this.clicksByDate.set(date, (this.clicksByDate.get(date) || 0) + 1);
    
    if (clickEvent.country) {
      this.clicksByCountry.set(
        clickEvent.country,
        (this.clicksByCountry.get(clickEvent.country) || 0) + 1
      );
    }
    
    if (clickEvent.referrer) {
      const domain = this.extractDomain(clickEvent.referrer);
      this.clicksByReferrer.set(
        domain,
        (this.clicksByReferrer.get(domain) || 0) + 1
      );
    }
    
    if (clickEvent.deviceType) {
      this.clicksByDevice.set(
        clickEvent.deviceType,
        (this.clicksByDevice.get(clickEvent.deviceType) || 0) + 1
      );
    }
    
    if (clickEvent.browser) {
      this.clicksByBrowser.set(
        clickEvent.browser,
        (this.clicksByBrowser.get(clickEvent.browser) || 0) + 1
      );
    }
    
    if (!this.firstClickAt) {
      this.firstClickAt = clickEvent.clickedAt;
    }
    this.lastClickAt = clickEvent.clickedAt;
  }

  extractDomain(referrer) {
    try {
      const url = new URL(referrer);
      return url.hostname;
    } catch {
      return referrer;
    }
  }

  getSummary() {
    return {
      totalClicks: this.totalClicks,
      clicksByDate: Object.fromEntries(this.clicksByDate),
      clicksByCountry: Object.fromEntries(this.clicksByCountry),
      clicksByReferrer: Object.fromEntries(this.clicksByReferrer),
      clicksByDevice: Object.fromEntries(this.clicksByDevice),
      clicksByBrowser: Object.fromEntries(this.clicksByBrowser),
      firstClickAt: this.firstClickAt,
      lastClickAt: this.lastClickAt
    };
  }
}
```

### Service Classes

#### URLShortenerService
```javascript
class URLShortenerService {
  constructor(
    urlRepository,
    cacheService,
    shortCodeGenerator,
    urlValidator,
    analyticsService
  ) {
    this.urlRepository = urlRepository;
    this.cacheService = cacheService;
    this.shortCodeGenerator = shortCodeGenerator;
    this.urlValidator = urlValidator;
    this.analyticsService = analyticsService;
  }

  async createShortURL(longUrl, options = {}) {
    const {
      customAlias = null,
      userId = null,
      expiresAt = null
    } = options;

    // Validate URL
    await this.urlValidator.validate(longUrl);

    let shortCode;
    
    if (customAlias) {
      // Check if custom alias already exists
      const exists = await this.urlRepository.findByShortCode(customAlias);
      if (exists) {
        throw new Error('Custom alias already exists');
      }
      shortCode = customAlias;
    } else {
      // Generate unique short code
      shortCode = await this.generateUniqueShortCode();
    }

    // Create URL record
    const url = new URL(
      this.generateId(),
      shortCode,
      longUrl,
      userId
    );

    if (expiresAt) {
      url.updateExpiration(new Date(expiresAt));
    }

    url.isCustom = !!customAlias;

    // Save to database
    await this.urlRepository.save(url);

    // Cache the mapping
    await this.cacheService.set(
      shortCode,
      longUrl,
      { ttl: 3600 } // 1 hour TTL
    );

    // Update user's URL count if applicable
    if (userId) {
      await this.userRepository.incrementUrlsCount(userId);
    }

    return {
      shortUrl: `${process.env.BASE_URL}/${shortCode}`,
      longUrl: url.longUrl,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt
    };
  }

  async generateUniqueShortCode() {
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const shortCode = await this.shortCodeGenerator.generate();
      
      // Check if code exists
      const exists = await this.urlRepository.findByShortCode(shortCode);
      
      if (!exists) {
        return shortCode;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique short code after multiple attempts');
  }

  async getLongURL(shortCode) {
    // Try cache first
    let longUrl = await this.cacheService.get(shortCode);
    
    if (longUrl) {
      return longUrl;
    }

    // Cache miss - query database
    const url = await this.urlRepository.findByShortCode(shortCode);
    
    if (!url) {
      throw new Error('URL not found');
    }

    // Check if expired
    if (url.isExpired()) {
      throw new Error('URL has expired');
    }

    // Check if active
    if (!url.isActive) {
      throw new Error('URL has been deactivated');
    }

    // Update cache
    await this.cacheService.set(shortCode, url.longUrl, { ttl: 3600 });

    return url.longUrl;
  }

  async updateURL(shortCode, updates, userId) {
    const url = await this.urlRepository.findByShortCode(shortCode);
    
    if (!url) {
      throw new Error('URL not found');
    }

    // Check authorization
    if (url.userId && url.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (updates.longUrl) {
      await this.urlValidator.validate(updates.longUrl);
      url.longUrl = updates.longUrl;
    }

    if (updates.expiresAt) {
      url.updateExpiration(new Date(updates.expiresAt));
    }

    await this.urlRepository.update(url);

    // Invalidate cache
    await this.cacheService.delete(shortCode);

    return url;
  }

  async deleteURL(shortCode, userId) {
    const url = await this.urlRepository.findByShortCode(shortCode);
    
    if (!url) {
      throw new Error('URL not found');
    }

    // Check authorization
    if (url.userId && url.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Soft delete
    url.deactivate();
    await this.urlRepository.update(url);

    // Invalidate cache
    await this.cacheService.delete(shortCode);

    return true;
  }
}
```

#### RedirectService
```javascript
class RedirectService {
  constructor(
    urlShortenerService,
    analyticsService,
    cacheService
  ) {
    this.urlShortenerService = urlShortenerService;
    this.analyticsService = analyticsService;
    this.cacheService = cacheService;
  }

  async redirect(shortCode, requestMetadata) {
    // Get long URL
    const longUrl = await this.urlShortenerService.getLongURL(shortCode);

    // Track click asynchronously (fire and forget)
    this.trackClick(shortCode, requestMetadata).catch(err => {
      console.error('Failed to track click:', err);
    });

    return longUrl;
  }

  async trackClick(shortCode, requestMetadata) {
    const clickEvent = new ClickEvent(
      this.generateId(),
      shortCode,
      {
        ipAddress: requestMetadata.ip,
        userAgent: requestMetadata.userAgent,
        referrer: requestMetadata.referrer,
        country: requestMetadata.country,
        city: requestMetadata.city,
        deviceType: this.parseDeviceType(requestMetadata.userAgent),
        browser: this.parseBrowser(requestMetadata.userAgent)
      }
    );

    // Send to analytics service (async via message queue)
    await this.analyticsService.trackClick(clickEvent);
  }

  parseDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  parseBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'unknown';
  }
}
```

#### ShortCodeGenerator
```javascript
class ShortCodeGenerator {
  constructor(database) {
    this.database = database;
    this.base62Chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  async generate() {
    // Counter-based generation
    const counter = await this.database.getNextSequence('url_counter');
    return this.toBase62(counter);
  }

  toBase62(num) {
    if (num === 0) return this.base62Chars[0];
    
    let result = '';
    while (num > 0) {
      result = this.base62Chars[num % 62] + result;
      num = Math.floor(num / 62);
    }
    
    return result;
  }

  fromBase62(str) {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 62 + this.base62Chars.indexOf(str[i]);
    }
    return num;
  }
}
```

#### URLValidator
```javascript
class URLValidator {
  constructor(blacklistService, malwareChecker) {
    this.blacklistService = blacklistService;
    this.malwareChecker = malwareChecker;
  }

  async validate(url) {
    // Check URL format
    if (!this.isValidFormat(url)) {
      throw new Error('Invalid URL format');
    }

    // Check against blacklist
    if (await this.blacklistService.isBlacklisted(url)) {
      throw new Error('URL is blacklisted');
    }

    // Check for malware/phishing
    if (await this.malwareChecker.hasMalware(url)) {
      throw new Error('URL contains malware or is a phishing site');
    }

    return true;
  }

  isValidFormat(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
}
```

#### AnalyticsService
```javascript
class AnalyticsService {
  constructor(
    clickRepository,
    analyticsRepository,
    messageQueue
  ) {
    this.clickRepository = clickRepository;
    this.analyticsRepository = analyticsRepository;
    this.messageQueue = messageQueue;
  }

  async trackClick(clickEvent) {
    // Publish to message queue for async processing
    await this.messageQueue.publish('url_clicks', {
      clickId: clickEvent.clickId,
      shortCode: clickEvent.shortCode,
      clickedAt: clickEvent.clickedAt,
      ipAddress: clickEvent.ipAddress,
      userAgent: clickEvent.userAgent,
      referrer: clickEvent.referrer,
      country: clickEvent.country,
      city: clickEvent.city,
      deviceType: clickEvent.deviceType,
      browser: clickEvent.browser
    });
  }

  async processClickEvents() {
    // Consumer for message queue
    this.messageQueue.subscribe('url_clicks', async (clickData) => {
      // Save to database
      await this.clickRepository.save(clickData);
      
      // Update aggregated analytics
      await this.updateAnalytics(clickData.shortCode, clickData);
    });
  }

  async updateAnalytics(shortCode, clickData) {
    let analytics = await this.analyticsRepository.findByShortCode(shortCode);
    
    if (!analytics) {
      analytics = new Analytics(shortCode);
    }

    const clickEvent = new ClickEvent(
      clickData.clickId,
      shortCode,
      {
        ipAddress: clickData.ipAddress,
        userAgent: clickData.userAgent,
        referrer: clickData.referrer,
        country: clickData.country,
        city: clickData.city,
        deviceType: clickData.deviceType,
        browser: clickData.browser
      }
    );
    clickEvent.clickedAt = new Date(clickData.clickedAt);

    analytics.addClick(clickEvent);
    await this.analyticsRepository.save(analytics);
  }

  async getAnalytics(shortCode, startDate = null, endDate = null) {
    const analytics = await this.analyticsRepository.findByShortCode(shortCode);
    
    if (!analytics) {
      return {
        totalClicks: 0,
        clicksByDate: {},
        clicksByCountry: {},
        clicksByReferrer: {},
        clicksByDevice: {},
        clicksByBrowser: {}
      };
    }

    return analytics.getSummary();
  }

  async getClickHistory(shortCode, page = 1, pageSize = 20) {
    return await this.clickRepository.findByShortCode(
      shortCode,
      page,
      pageSize
    );
  }
}
```

#### RateLimiter
```javascript
class RateLimiter {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async checkLimit(identifier, limit = 100, windowSeconds = 3600) {
    const key = `ratelimit:${identifier}`;
    
    // Increment counter
    const current = await this.redis.incr(key);
    
    // Set expiry on first request
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      throw new Error('Rate limit exceeded');
    }

    return {
      allowed: true,
      remaining: limit - current,
      resetAt: new Date(Date.now() + windowSeconds * 1000)
    };
  }

  async getRemaining(identifier) {
    const key = `ratelimit:${identifier}`;
    const current = await this.redis.get(key);
    return current ? parseInt(current) : 0;
  }
}
```

#### CacheService
```javascript
class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
  }

  async get(key) {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key, value, options = {}) {
    const { ttl = 3600 } = options;
    const serialized = JSON.stringify(value);
    
    if (ttl) {
      await this.redis.setex(key, ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  async delete(key) {
    await this.redis.del(key);
  }

  async deletePattern(pattern) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async exists(key) {
    return await this.redis.exists(key) === 1;
  }
}
```

## Database Schema

### URLs Table
```sql
CREATE TABLE urls (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  url_id VARCHAR(50) UNIQUE NOT NULL,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  user_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_custom BOOLEAN DEFAULT FALSE,
  click_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  
  INDEX idx_short_code (short_code),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_expires_at (expires_at),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

### Users Table
```sql
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rate_limit INT DEFAULT 1000,
  is_premium BOOLEAN DEFAULT FALSE,
  urls_count INT DEFAULT 0,
  
  INDEX idx_email (email),
  INDEX idx_api_key (api_key)
);
```

### Click Events Table
```sql
CREATE TABLE click_events (
  click_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  short_code VARCHAR(10) NOT NULL,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  device_type VARCHAR(20),
  browser VARCHAR(50),
  
  INDEX idx_short_code (short_code),
  INDEX idx_clicked_at (clicked_at),
  INDEX idx_country (country),
  FOREIGN KEY (short_code) REFERENCES urls(short_code)
);

-- Partition by date for better performance
PARTITION BY RANGE (YEAR(clicked_at), MONTH(clicked_at));
```

### Analytics Table (Aggregated)
```sql
CREATE TABLE analytics (
  analytics_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  total_clicks INT DEFAULT 0,
  clicks_by_date JSON,
  clicks_by_country JSON,
  clicks_by_referrer JSON,
  clicks_by_device JSON,
  clicks_by_browser JSON,
  first_click_at TIMESTAMP NULL,
  last_click_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_short_code (short_code),
  FOREIGN KEY (short_code) REFERENCES urls(short_code)
);
```

### Counter Table (for ID generation)
```sql
CREATE TABLE counters (
  counter_name VARCHAR(50) PRIMARY KEY,
  counter_value BIGINT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize counter
INSERT INTO counters (counter_name, counter_value) VALUES ('url_counter', 0);
```

## API Design

### RESTful Endpoints

#### URL Endpoints
```
POST   /api/v1/urls                    # Create short URL
GET    /api/v1/urls/:shortCode         # Get URL details
PUT    /api/v1/urls/:shortCode         # Update URL
DELETE /api/v1/urls/:shortCode         # Delete URL
GET    /api/v1/urls/:shortCode/analytics  # Get analytics
```

#### Redirect Endpoint
```
GET    /:shortCode                     # Redirect to long URL
```

#### User Endpoints
```
POST   /api/v1/users/register          # Register user
POST   /api/v1/users/login             # Login
GET    /api/v1/users/me                # Get current user
GET    /api/v1/users/me/urls           # Get user's URLs
```

### Request/Response Examples

#### Create Short URL
```json
POST /api/v1/urls
Content-Type: application/json
Authorization: Bearer <api_key>

{
  "long_url": "https://example.com/very/long/url",
  "custom_alias": "my-link",
  "expiration_time": "2024-12-31T23:59:59Z"
}

Response: 201 Created
{
  "short_url": "https://short.ly/my-link",
  "long_url": "https://example.com/very/long/url",
  "short_code": "my-link",
  "created_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### Redirect
```http
GET /abc123

Response: 301 Moved Permanently
Location: https://example.com/very/long/url
```

#### Get Analytics
```json
GET /api/v1/urls/abc123/analytics?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <api_key>

Response: 200 OK
{
  "short_code": "abc123",
  "total_clicks": 15420,
  "clicks_by_date": {
    "2024-01-15": 1200,
    "2024-01-16": 950
  },
  "clicks_by_country": {
    "US": 8500,
    "IN": 3200
  },
  "clicks_by_referrer": {
    "twitter.com": 5000,
    "facebook.com": 3200
  },
  "clicks_by_device": {
    "mobile": 8000,
    "desktop": 6000,
    "tablet": 1420
  },
  "clicks_by_browser": {
    "Chrome": 9000,
    "Safari": 4000,
    "Firefox": 2420
  },
  "first_click_at": "2024-01-15T10:30:00Z",
  "last_click_at": "2024-01-16T14:22:10Z"
}
```

## Key Algorithms

### Base62 Encoding Algorithm
```javascript
class Base62Encoder {
  constructor() {
    this.chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }

  encode(num) {
    if (num === 0) return this.chars[0];
    
    let result = '';
    while (num > 0) {
      result = this.chars[num % 62] + result;
      num = Math.floor(num / 62);
    }
    return result;
  }

  decode(str) {
    let num = 0;
    for (let i = 0; i < str.length; i++) {
      num = num * 62 + this.chars.indexOf(str[i]);
    }
    return num;
  }
}
```

### URL Shortening Algorithm
```javascript
class URLShorteningAlgorithm {
  constructor(database) {
    this.database = database;
    this.encoder = new Base62Encoder();
  }

  async generateShortCode() {
    // Get next counter value atomically
    const counter = await this.database.incrementCounter('url_counter');
    
    // Encode to Base62
    return this.encoder.encode(counter);
  }

  // Alternative: Hash-based approach
  generateFromHash(longUrl) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(longUrl).digest('hex');
    const shortHash = hash.substring(0, 7);
    return this.encoder.encode(parseInt(shortHash, 16));
  }
}
```

### Cache-Aside Pattern
```javascript
async function getURLWithCache(shortCode) {
  // Try cache first
  let url = await cache.get(shortCode);
  
  if (url) {
    return url; // Cache hit
  }
  
  // Cache miss - query database
  url = await database.findByShortCode(shortCode);
  
  if (url) {
    // Update cache
    await cache.set(shortCode, url, { ttl: 3600 });
  }
  
  return url;
}
```

### Rate Limiting Algorithm (Token Bucket)
```javascript
class TokenBucketRateLimiter {
  constructor(redis, capacity, refillRate) {
    this.redis = redis;
    this.capacity = capacity; // Max tokens
    this.refillRate = refillRate; // Tokens per second
  }

  async checkLimit(identifier) {
    const key = `token_bucket:${identifier}`;
    const now = Date.now();
    
    // Get current state
    const state = await this.redis.hgetall(key);
    const tokens = parseFloat(state.tokens || this.capacity);
    const lastRefill = parseFloat(state.lastRefill || now);
    
    // Calculate tokens to add
    const elapsed = (now - lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.refillRate;
    const newTokens = Math.min(this.capacity, tokens + tokensToAdd);
    
    if (newTokens < 1) {
      throw new Error('Rate limit exceeded');
    }
    
    // Consume one token
    const remainingTokens = newTokens - 1;
    
    // Update state
    await this.redis.hset(key, {
      tokens: remainingTokens,
      lastRefill: now
    });
    await this.redis.expire(key, 3600);
    
    return {
      allowed: true,
      remaining: Math.floor(remainingTokens),
      resetAt: new Date(now + ((this.capacity - remainingTokens) / this.refillRate * 1000))
    };
  }
}
```

## Design Patterns

### Repository Pattern
```javascript
class URLRepository {
  constructor(database) {
    this.db = database;
  }

  async save(url) {
    const query = `
      INSERT INTO urls (url_id, short_code, long_url, user_id, expires_at, is_custom)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.db.query(query, [
      url.urlId,
      url.shortCode,
      url.longUrl,
      url.userId,
      url.expiresAt,
      url.isCustom
    ]);
  }

  async findByShortCode(shortCode) {
    const query = 'SELECT * FROM urls WHERE short_code = ? AND is_active = TRUE';
    const rows = await this.db.query(query, [shortCode]);
    return rows[0] ? this.mapToURL(rows[0]) : null;
  }

  async update(url) {
    const query = `
      UPDATE urls 
      SET long_url = ?, expires_at = ?, is_active = ?, click_count = ?, last_accessed_at = ?
      WHERE short_code = ?
    `;
    await this.db.query(query, [
      url.longUrl,
      url.expiresAt,
      url.isActive,
      url.clickCount,
      url.lastAccessedAt,
      url.shortCode
    ]);
  }

  mapToURL(row) {
    const url = new URL(row.url_id, row.short_code, row.long_url, row.user_id);
    url.expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    url.isActive = row.is_active;
    url.isCustom = row.is_custom;
    url.clickCount = row.click_count;
    url.lastAccessedAt = row.last_accessed_at ? new Date(row.last_accessed_at) : null;
    return url;
  }
}
```

### Service Layer Pattern
Business logic separated into service classes:
- URLShortenerService
- RedirectService
- AnalyticsService
- URLValidator
- RateLimiter

### Factory Pattern
```javascript
class ShortCodeGeneratorFactory {
  static create(type, database) {
    switch (type) {
      case 'counter':
        return new CounterBasedGenerator(database);
      case 'hash':
        return new HashBasedGenerator();
      case 'random':
        return new RandomGenerator();
      default:
        throw new Error('Unknown generator type');
    }
  }
}
```

### Strategy Pattern
```javascript
class RedirectStrategy {
  redirect(url) {
    throw new Error('Must implement redirect method');
  }
}

class PermanentRedirectStrategy extends RedirectStrategy {
  redirect(url) {
    return { statusCode: 301, location: url };
  }
}

class TemporaryRedirectStrategy extends RedirectStrategy {
  redirect(url) {
    return { statusCode: 302, location: url };
  }
}
```

### Observer Pattern (for Analytics)
```javascript
class ClickEventObserver {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  notify(clickEvent) {
    this.observers.forEach(observer => observer.onClick(clickEvent));
  }
}

class AnalyticsObserver {
  onClick(clickEvent) {
    // Update analytics
    analyticsService.updateAnalytics(clickEvent);
  }
}

class LoggingObserver {
  onClick(clickEvent) {
    // Log click event
    logger.info('Click event:', clickEvent);
  }
}
```

## Error Handling

### Error Types
```javascript
class URLShortenerError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'URLShortenerError';
  }
}

class URLNotFoundError extends URLShortenerError {
  constructor(shortCode) {
    super(`URL with short code ${shortCode} not found`, 404);
    this.name = 'URLNotFoundError';
  }
}

class URLExpiredError extends URLShortenerError {
  constructor(shortCode) {
    super(`URL with short code ${shortCode} has expired`, 410);
    this.name = 'URLExpiredError';
  }
}

class InvalidURLError extends URLShortenerError {
  constructor(url) {
    super(`Invalid URL: ${url}`, 400);
    this.name = 'InvalidURLError';
  }
}

class AliasExistsError extends URLShortenerError {
  constructor(alias) {
    super(`Custom alias ${alias} already exists`, 409);
    this.name = 'AliasExistsError';
  }
}

class RateLimitExceededError extends URLShortenerError {
  constructor() {
    super('Rate limit exceeded', 429);
    this.name = 'RateLimitExceededError';
  }
}

class UnauthorizedError extends URLShortenerError {
  constructor() {
    super('Unauthorized', 401);
    this.name = 'UnauthorizedError';
  }
}
```

### Error Handling Middleware
```javascript
function errorHandler(err, req, res, next) {
  if (err instanceof URLShortenerError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        type: err.name,
        code: err.code || 'UNKNOWN_ERROR'
      }
    });
  }

  // Default error
  console.error('Unexpected error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'InternalServerError',
      code: 'INTERNAL_ERROR'
    }
  });
}
```

## Performance Optimizations

### Caching Strategy
- **Hot URLs Cache**: Cache top 20% of URLs (80/20 rule)
- **TTL Strategy**: 
  - Normal URLs: 1 hour
  - Hot URLs: 24 hours
  - Custom URLs: 6 hours
- **Cache Warming**: Preload popular URLs on startup
- **Cache Invalidation**: Invalidate on update/delete

### Database Optimizations
- Indexes on frequently queried columns (short_code, user_id, created_at)
- Partitioning for click_events table by date
- Read replicas for read-heavy operations
- Connection pooling
- Batch inserts for analytics

### Async Processing
- Click tracking via message queue (Kafka/RabbitMQ)
- Analytics aggregation in background jobs
- Cache updates asynchronously
- URL validation checks can be async for non-critical validations

### CDN and Static Assets
- Serve static assets via CDN
- Use CDN for redirect endpoints (Cloudflare, AWS CloudFront)
- Edge caching for frequently accessed short URLs

### Background Jobs
- Analytics aggregation (hourly/daily)
- Expired URL cleanup (daily)
- Cache warming (periodic)
- Click event processing

## Conclusion

This LLD provides a comprehensive design for a URL Shortener Service, focusing on:
- Clean class structure and separation of concerns
- Scalable database schema with proper indexing
- Efficient caching strategies
- Robust error handling
- Performance optimizations for high-throughput systems
- Security considerations (rate limiting, URL validation)

The design follows best practices and design patterns to ensure maintainability, scalability, and high performance for a production-ready URL shortening service.

