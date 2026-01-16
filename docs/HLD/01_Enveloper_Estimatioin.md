---
sidebar_position: 1
---

# Envelope Estimation

A comprehensive guide to estimating storage, speed, and time for system design and architecture planning.

---

## Table of Contents

1. [Fundamental Numbers](#fundamental-numbers)
2. [Storage Estimation](#storage-estimation)
3. [Speed & Bandwidth Estimation](#speed--bandwidth-estimation)
4. [Time & Latency Estimation](#time--latency-estimation)
5. [Power of 2 Reference](#power-of-2-reference)

---

## Fundamental Numbers

### Storage Units

| Unit | Bytes | Power of 2 | Common Usage |
|------|-------|------------|--------------|
| 1 byte | 1 B | 2^0 | Single character |
| 1 KB | 1,000 B | 2^10 = 1,024 B | Small text file |
| 1 MB | 1,000,000 B | 2^20 = 1,048,576 B | Image, song |
| 1 GB | 1,000,000,000 B | 2^30 = 1,073,741,824 B | Movie, app |
| 1 TB | 1,000,000,000,000 B | 2^40 = 1,099,511,627,776 B | Hard drive |
| 1 PB | 1,000,000,000,000,000 B | 2^50 | Data center |

**Note:** In computing, we often use binary (power of 2) units, but for estimation, decimal units are simpler and acceptable.

### Time Units

| Unit | Seconds | Milliseconds | Microseconds |
|------|---------|--------------|---------------|
| 1 second | 1 s | 1,000 ms | 1,000,000 μs |
| 1 minute | 60 s | 60,000 ms | - |
| 1 hour | 3,600 s | 3,600,000 ms | - |
| 1 day | 86,400 s | 86,400,000 ms | - |
| 1 year | 31,536,000 s | - | - |

### Speed & Bandwidth

| Connection Type | Speed | Use Case |
|----------------|-------|----------|
| Dial-up | 56 Kbps | Historical |
| 3G | 1-3 Mbps | Mobile (old) |
| 4G LTE | 10-50 Mbps | Mobile |
| 5G | 100-1000 Mbps | Mobile (fast) |
| WiFi (802.11n) | 150-600 Mbps | Home/Office |
| WiFi (802.11ac) | 433-1300 Mbps | Home/Office |
| Gigabit Ethernet | 1 Gbps | Local network |
| 10 Gigabit | 10 Gbps | Data center |
| 100 Gigabit | 100 Gbps | Data center backbone |

### Latency Reference

| Operation | Typical Latency |
|-----------|----------------|
| L1 cache reference | 0.5 ns |
| L2 cache reference | 7 ns |
| Main memory reference | 100 ns |
| SSD random read | 150 μs |
| Disk seek | 10 ms |
| Network round-trip (same datacenter) | 0.5 ms |
| Network round-trip (US coast-to-coast) | 50 ms |
| Network round-trip (US to Europe) | 150 ms |
| Disk read (1 MB sequential) | 20 ms |
| Memory read (1 MB sequential) | 250 μs |

---

## Storage Estimation

### Data Size Reference

| Data Type | Size | Notes |
|-----------|------|-------|
| ASCII character | 1 byte | English text |
| Unicode character (UTF-8) | 1-4 bytes | Most common: 1-2 bytes |
| Integer (32-bit) | 4 bytes | - |
| Integer (64-bit) | 8 bytes | - |
| Float (32-bit) | 4 bytes | - |
| Float (64-bit) | 8 bytes | - |
| Boolean | 1 byte | (often stored as 1 bit in practice) |
| UUID | 16 bytes | 128 bits |
| Timestamp | 8 bytes | Unix timestamp (64-bit) |
| Email address | ~50 bytes | Average |
| URL | ~100 bytes | Average |
| Tweet | ~280 bytes | 280 characters max |
| Facebook post | ~500 bytes | Average text |
| Image (thumbnail) | 10-50 KB | 100x100 to 200x200 |
| Image (medium) | 100-500 KB | 800x600 to 1920x1080 |
| Image (high-res) | 1-5 MB | 4K, uncompressed |
| Video (1 minute, 720p) | ~50 MB | Compressed |
| Video (1 minute, 1080p) | ~100 MB | Compressed |
| Video (1 minute, 4K) | ~400 MB | Compressed |
| Audio (1 minute, MP3) | ~1 MB | 128 kbps |
| Audio (1 minute, CD quality) | ~10 MB | Uncompressed |

### Storage Calculation Formula

```
Total Storage = (Data Size per Record) × (Number of Records) × (Replication Factor)
```

**Example:** Calculate storage for 1 billion users with profile data:
- User ID: 8 bytes
- Username: 50 bytes
- Email: 50 bytes
- Profile text: 500 bytes
- Avatar URL: 100 bytes
- Created timestamp: 8 bytes
- **Total per user:** ~716 bytes ≈ 1 KB

**Calculation:**
```
1 billion users × 1 KB = 1 TB
With 3x replication: 1 TB × 3 = 3 TB
```

### Storage Estimation Tricks

1. **Round to nearest power of 2 or 10** for easier mental math
2. **Add 20-30% overhead** for metadata, indexes, and fragmentation
3. **Consider compression ratios:**
   - Text: 2-5x compression
   - Images: Already compressed (JPEG, PNG)
   - Video: 10-100x compression
4. **Account for growth:** Multiply by 2-5x for future capacity
5. **Replication factor:** Usually 3x for distributed systems

---

## Speed & Bandwidth Estimation

### Throughput Calculation

```
Throughput = (Data Size) / (Time)
```

**Example:** How long to transfer 1 GB over 10 Mbps connection?

```
1 GB = 8 Gb (gigabits)
Time = 8 Gb / 10 Mbps = 800 seconds ≈ 13 minutes
```

### Bandwidth Estimation Formula

```
Required Bandwidth = (Data per Request) × (Requests per Second)
```

**Example:** Image sharing service
- Average image size: 200 KB
- 1 million requests per second
- **Bandwidth needed:** 200 KB × 1M = 200 GB/s = 1.6 Tbps

### Network Speed Reference

| Scenario | Bandwidth Calculation |
|----------|----------------------|
| 1 user uploading 1 MB photo | 1 MB / 10 Mbps = 0.8 seconds |
| 1M users uploading simultaneously | 1M × 1 MB = 1 TB/s (needs CDN/distribution) |
| Streaming 4K video | ~25 Mbps per stream |
| 1000 concurrent 4K streams | 25 Gbps |

### Bandwidth Estimation Tricks

1. **Peak vs Average:** Design for 2-3x average traffic
2. **Compression:** Can reduce bandwidth by 50-90%
3. **Caching:** Reduces bandwidth by serving from edge locations
4. **CDN:** Distributes load across multiple locations
5. **Consider both directions:** Upload and download

---

## Time & Latency Estimation

### Latency Components

```
Total Latency = Network Latency + Processing Time + Queue Time + Disk I/O
```

### Network Latency Reference

| Distance | Round-Trip Time (RTT) |
|----------|----------------------|
| Same server | < 1 ms |
| Same datacenter | 0.5-2 ms |
| Same city | 5-10 ms |
| Same country | 20-50 ms |
| Cross-continental | 100-200 ms |
| Satellite | 500-700 ms |

### Processing Time Estimation

| Operation | Time | Notes |
|-----------|------|-------|
| Hash calculation (MD5) | 1-10 μs | Depends on data size |
| Hash calculation (SHA-256) | 5-20 μs | Depends on data size |
| JSON parse (1 KB) | 10-50 μs | Depends on complexity |
| Database query (indexed) | 1-10 ms | Simple lookup |
| Database query (complex) | 10-100 ms | Joins, aggregations |
| Full-text search | 10-500 ms | Depends on index size |
| Image resize | 10-100 ms | Depends on size |
| Video encoding (1 min) | 1-10 minutes | Depends on quality |

### Time Estimation Formula

```
Total Time = (Operations) × (Time per Operation) + (Network Latency)
```

**Example:** API request processing
- Network latency: 50 ms (cross-country)
- Database query: 10 ms
- Business logic: 5 ms
- Response serialization: 2 ms
- **Total:** ~67 ms

### Time Estimation Tricks

1. **Amdahl's Law:** Parallelization has diminishing returns
2. **Pipelining:** Can improve throughput but not latency
3. **Batching:** Reduces overhead but increases latency
4. **Caching:** Reduces latency from seconds to milliseconds
5. **Async processing:** Improves perceived latency

---

## Power of 2 Reference

Essential for quick mental calculations:

| Power | Value | Approximation |
|-------|-------|---------------|
| 2^10 | 1,024 | ~1,000 (1K) |
| 2^20 | 1,048,576 | ~1,000,000 (1M) |
| 2^30 | 1,073,741,824 | ~1,000,000,000 (1B) |
| 2^40 | 1,099,511,627,776 | ~1 trillion |
| 2^50 | 1,125,899,906,842,624 | ~1 quadrillion |

**Quick conversions:**
- 2^10 ≈ 10^3 (thousand)
- 2^20 ≈ 10^6 (million)
- 2^30 ≈ 10^9 (billion)
- 2^40 ≈ 10^12 (trillion)

---

## Practical Tricks & Shortcuts

### 1. The "2.5 Rule" for Storage

For text data with metadata:
```
Actual Storage ≈ Raw Data × 2.5
```
Accounts for indexes, metadata, overhead, and some growth.

### 2. The "80/20 Rule" for Traffic

80% of traffic happens in 20% of time (peak hours).
```
Peak Bandwidth ≈ Average Bandwidth × 4
```

### 3. The "10x Rule" for Growth

Design systems to handle 10x current load:
```
Design Capacity = Current Load × 10
```

### 4. Quick Bandwidth Calculation

```
Mbps to MB/s: Divide by 8
GB/s to Gbps: Multiply by 8
```

### 5. Storage per User Estimation

For social media platforms:
- **Light user:** 100 MB - 1 GB
- **Average user:** 1-10 GB
- **Heavy user:** 10-100 GB

### 6. Request Rate Estimation

```
Requests per Second = (Daily Requests) / (86,400 seconds)
Peak RPS = Average RPS × 3-5
```

### 7. Database Size Estimation

```
Database Size = (Records) × (Avg Record Size) × (Index Overhead)
Index Overhead: 20-50% of data size
```

### 8. Cache Hit Rate Assumption

For well-designed caching:
- **Cache hit rate:** 80-95%
- **Cache miss rate:** 5-20%

### 9. Compression Ratios

| Data Type | Compression Ratio |
|-----------|-------------------|
| Text/JSON | 2-5x |
| Logs | 3-10x |
| Images (already compressed) | 1.1-1.5x |
| Video | 10-100x |
| Database backups | 3-5x |

### 10. Replication Overhead

```
Total Storage = Original × (1 + Replication Factor)
Typical replication: 3x (for fault tolerance)
```

---

## Real-World Examples

### Example 1: Twitter-like Service

**Requirements:**
- 500 million users
- 200 million daily active users
- 500 million tweets per day
- Average tweet: 50 characters + metadata

**Storage Estimation:**
```
Per tweet: 50 chars × 1 byte + 100 bytes metadata = 150 bytes
Daily tweets: 500M × 150 bytes = 75 GB/day
Yearly: 75 GB × 365 = 27 TB/year
With 3x replication: 81 TB/year
With 5 years retention: 405 TB
```

**Bandwidth Estimation:**
```
Average RPS: 500M tweets / 86,400s = ~5,800 tweets/sec
Peak RPS: 5,800 × 5 = 29,000 tweets/sec
Bandwidth: 29,000 × 150 bytes = 4.35 MB/s = 35 Mbps (outbound)
Read traffic (10x write): 350 Mbps
Total: ~400 Mbps average, ~2 Gbps peak
```

### Example 2: Video Streaming Service

**Requirements:**
- 100 million users
- 10 million concurrent viewers
- Average watch time: 30 minutes
- Video quality: 1080p (5 Mbps per stream)

**Storage Estimation:**
```
Per minute: 5 Mbps × 60s = 37.5 MB
Per hour: 37.5 MB × 60 = 2.25 GB
Catalog: 10,000 videos × 2.25 GB = 22.5 TB
With 3x replication: 67.5 TB
```

**Bandwidth Estimation:**
```
10M concurrent × 5 Mbps = 50 Tbps
With CDN (10x reduction): 5 Tbps
Peak (2x average): 10 Tbps
```

### Example 3: E-commerce Platform

**Requirements:**
- 50 million products
- 100 million users
- 10 million orders per day
- Average order: 5 items

**Storage Estimation:**
```
Product data: 50M × 5 KB = 250 GB
User data: 100M × 2 KB = 200 GB
Order data: 10M/day × 1 KB × 365 days = 3.65 TB
Images: 50M products × 5 images × 200 KB = 50 TB
Total: ~54 TB
With replication: 162 TB
```

**Bandwidth Estimation:**
```
Daily orders: 10M
Peak hour (20% of daily): 2M orders
Peak RPS: 2M / 3,600s = ~556 orders/sec
Bandwidth per order: 10 KB
Total: 556 × 10 KB = 5.56 MB/s = 44 Mbps
Read traffic (100x write): 4.4 Gbps
```

### Example 4: Search Engine

**Requirements:**
- Index 50 billion web pages
- Average page: 50 KB
- 1 billion queries per day
- Average query: 10 words

**Storage Estimation:**
```
Raw pages: 50B × 50 KB = 2.5 PB
Compressed (5x): 500 TB
Index (20% of data): 100 TB
Total: 600 TB
With replication: 1.8 PB
```

**Bandwidth Estimation:**
```
Average QPS: 1B / 86,400s = ~11,600 queries/sec
Peak QPS: 11,600 × 3 = 34,800 queries/sec
Query size: 10 words × 5 bytes = 50 bytes
Response size: 10 KB (average)
Bandwidth: 34,800 × 10 KB = 348 MB/s = 2.8 Gbps
```

---

## Common Estimation Mistakes to Avoid

1. **Forgetting replication factor** - Always multiply by 2-3x
2. **Ignoring peak traffic** - Design for 3-5x average
3. **Not accounting for overhead** - Add 20-30% for metadata
4. **Mixing units** - Keep consistent (bytes vs bits, MB vs GB)
5. **Ignoring growth** - Plan for 10x capacity
6. **Underestimating latency** - Network latency adds up
7. **Forgetting compression** - Can significantly reduce storage/bandwidth
8. **Not considering both directions** - Upload and download matter

---

## Quick Reference Cheat Sheet

```
Storage:
- 1 KB = 1,000 bytes (estimation)
- 1 MB = 1,000 KB
- 1 GB = 1,000 MB
- 1 TB = 1,000 GB

Speed:
- 1 Mbps = 1,000,000 bits/sec
- 1 MB/s = 8 Mbps
- 1 Gbps = 1,000 Mbps

Time:
- 1 second = 1,000 ms
- 1 ms = 1,000 μs
- 1 day = 86,400 seconds

Common Multipliers:
- Replication: 3x
- Peak traffic: 3-5x average
- Growth buffer: 10x
- Storage overhead: 1.2-1.3x
```

---

## Practice Problems

1. **Estimate storage for 1 billion user profiles** (assume 2 KB per profile)
2. **Calculate bandwidth for 10M concurrent video streams** (5 Mbps each)
3. **Estimate latency for API call** (cross-country, database query, processing)
4. **Calculate storage for 1 year of logs** (1M requests/day, 1 KB per log)
5. **Estimate bandwidth for file upload service** (100K users, 10 MB files, 1% upload daily)

---

## Additional Resources

- [Google's Numbers Everyone Should Know](https://gist.github.com/jboner/2841832)
- [Latency Numbers Every Programmer Should Know](https://colin-scott.github.io/personal_website/research/interactive_latency.html)
- System Design Interview books and courses
- Cloud provider documentation (AWS, GCP, Azure) for actual service limits

---

**Remember:** Back-of-the-envelope estimation is about getting the right order of magnitude, not exact numbers. Round liberally, use approximations, and focus on understanding the scale of the problem.
```

Save this as `Envelope Estimation.md` in `/Users/prajwalhn/Documents/workspace/openSource/tech-notebook/docs/JavaScript/HLD/`.

The guide includes:
- Fundamental numbers and conversions
- Storage estimation techniques with examples
- Speed and bandwidth calculations
- Time and latency estimation
- Power of 2 reference for quick math
- Practical shortcuts and tricks
- Real-world examples (Twitter, video streaming, e-commerce, search)
- Common mistakes to avoid
- Quick reference cheat sheet

You're in ask mode, so create the file manually or switch to agent mode to have me create it.

```markdown
---
sidebar_position: 1
---

# Back-of-the-Envelope Estimation Guide

A comprehensive guide to estimating storage, speed, and time for system design and architecture planning.

---

## Table of Contents

1. [Fundamental Numbers](#fundamental-numbers)
2. [Storage Estimation](#storage-estimation)
3. [Speed & Bandwidth Estimation](#speed--bandwidth-estimation)
4. [Time & Latency Estimation](#time--latency-estimation)
5. [Power of 2 Reference](#power-of-2-reference)
6. [Practical Tricks & Shortcuts](#practical-tricks--shortcuts)
7. [Real-World Examples](#real-world-examples)

---

## Fundamental Numbers

### Storage Units

| Unit | Bytes | Power of 2 | Common Usage |
|------|-------|------------|--------------|
| 1 byte | 1 B | 2^0 | Single character |
| 1 KB | 1,000 B | 2^10 = 1,024 B | Small text file |
| 1 MB | 1,000,000 B | 2^20 = 1,048,576 B | Image, song |
| 1 GB | 1,000,000,000 B | 2^30 = 1,073,741,824 B | Movie, app |
| 1 TB | 1,000,000,000,000 B | 2^40 = 1,099,511,627,776 B | Hard drive |
| 1 PB | 1,000,000,000,000,000 B | 2^50 | Data center |

**Note:** In computing, we often use binary (power of 2) units, but for estimation, decimal units are simpler and acceptable.

### Time Units

| Unit | Seconds | Milliseconds | Microseconds |
|------|---------|--------------|---------------|
| 1 second | 1 s | 1,000 ms | 1,000,000 μs |
| 1 minute | 60 s | 60,000 ms | - |
| 1 hour | 3,600 s | 3,600,000 ms | - |
| 1 day | 86,400 s | 86,400,000 ms | - |
| 1 year | 31,536,000 s | - | - |

### Speed & Bandwidth

| Connection Type | Speed | Use Case |
|----------------|-------|----------|
| Dial-up | 56 Kbps | Historical |
| 3G | 1-3 Mbps | Mobile (old) |
| 4G LTE | 10-50 Mbps | Mobile |
| 5G | 100-1000 Mbps | Mobile (fast) |
| WiFi (802.11n) | 150-600 Mbps | Home/Office |
| WiFi (802.11ac) | 433-1300 Mbps | Home/Office |
| Gigabit Ethernet | 1 Gbps | Local network |
| 10 Gigabit | 10 Gbps | Data center |
| 100 Gigabit | 100 Gbps | Data center backbone |

### Latency Reference

| Operation | Typical Latency |
|-----------|----------------|
| L1 cache reference | 0.5 ns |
| L2 cache reference | 7 ns |
| Main memory reference | 100 ns |
| SSD random read | 150 μs |
| Disk seek | 10 ms |
| Network round-trip (same datacenter) | 0.5 ms |
| Network round-trip (US coast-to-coast) | 50 ms |
| Network round-trip (US to Europe) | 150 ms |
| Disk read (1 MB sequential) | 20 ms |
| Memory read (1 MB sequential) | 250 μs |

---

## Storage Estimation

### Data Size Reference

| Data Type | Size | Notes |
|-----------|------|-------|
| ASCII character | 1 byte | English text |
| Unicode character (UTF-8) | 1-4 bytes | Most common: 1-2 bytes |
| Integer (32-bit) | 4 bytes | - |
| Integer (64-bit) | 8 bytes | - |
| Float (32-bit) | 4 bytes | - |
| Float (64-bit) | 8 bytes | - |
| Boolean | 1 byte | (often stored as 1 bit in practice) |
| UUID | 16 bytes | 128 bits |
| Timestamp | 8 bytes | Unix timestamp (64-bit) |
| Email address | ~50 bytes | Average |
| URL | ~100 bytes | Average |
| Tweet | ~280 bytes | 280 characters max |
| Facebook post | ~500 bytes | Average text |
| Image (thumbnail) | 10-50 KB | 100x100 to 200x200 |
| Image (medium) | 100-500 KB | 800x600 to 1920x1080 |
| Image (high-res) | 1-5 MB | 4K, uncompressed |
| Video (1 minute, 720p) | ~50 MB | Compressed |
| Video (1 minute, 1080p) | ~100 MB | Compressed |
| Video (1 minute, 4K) | ~400 MB | Compressed |
| Audio (1 minute, MP3) | ~1 MB | 128 kbps |
| Audio (1 minute, CD quality) | ~10 MB | Uncompressed |

### Storage Calculation Formula

```

```plaintext

**Example:** Calculate storage for 1 billion users with profile data:
- User ID: 8 bytes
- Username: 50 bytes
- Email: 50 bytes
- Profile text: 500 bytes
- Avatar URL: 100 bytes
- Created timestamp: 8 bytes
- **Total per user:** ~716 bytes ≈ 1 KB

**Calculation:**
```

```plaintext

### Storage Estimation Tricks

1. **Round to nearest power of 2 or 10** for easier mental math
2. **Add 20-30% overhead** for metadata, indexes, and fragmentation
3. **Consider compression ratios:**
   - Text: 2-5x compression
   - Images: Already compressed (JPEG, PNG)
   - Video: 10-100x compression
4. **Account for growth:** Multiply by 2-5x for future capacity
5. **Replication factor:** Usually 3x for distributed systems

---

## Speed & Bandwidth Estimation

### Throughput Calculation

```

```plaintext

**Example:** How long to transfer 1 GB over 10 Mbps connection?

```

```plaintext

### Bandwidth Estimation Formula

```

```plaintext

**Example:** Image sharing service
- Average image size: 200 KB
- 1 million requests per second
- **Bandwidth needed:** 200 KB × 1M = 200 GB/s = 1.6 Tbps

### Network Speed Reference

| Scenario | Bandwidth Calculation |
|----------|----------------------|
| 1 user uploading 1 MB photo | 1 MB / 10 Mbps = 0.8 seconds |
| 1M users uploading simultaneously | 1M × 1 MB = 1 TB/s (needs CDN/distribution) |
| Streaming 4K video | ~25 Mbps per stream |
| 1000 concurrent 4K streams | 25 Gbps |

### Bandwidth Estimation Tricks

1. **Peak vs Average:** Design for 2-3x average traffic
2. **Compression:** Can reduce bandwidth by 50-90%
3. **Caching:** Reduces bandwidth by serving from edge locations
4. **CDN:** Distributes load across multiple locations
5. **Consider both directions:** Upload and download

---

## Time & Latency Estimation

### Latency Components

```

```plaintext

### Network Latency Reference

| Distance | Round-Trip Time (RTT) |
|----------|----------------------|
| Same server | < 1 ms |
| Same datacenter | 0.5-2 ms |
| Same city | 5-10 ms |
| Same country | 20-50 ms |
| Cross-continental | 100-200 ms |
| Satellite | 500-700 ms |

### Processing Time Estimation

| Operation | Time | Notes |
|-----------|------|-------|
| Hash calculation (MD5) | 1-10 μs | Depends on data size |
| Hash calculation (SHA-256) | 5-20 μs | Depends on data size |
| JSON parse (1 KB) | 10-50 μs | Depends on complexity |
| Database query (indexed) | 1-10 ms | Simple lookup |
| Database query (complex) | 10-100 ms | Joins, aggregations |
| Full-text search | 10-500 ms | Depends on index size |
| Image resize | 10-100 ms | Depends on size |
| Video encoding (1 min) | 1-10 minutes | Depends on quality |

### Time Estimation Formula

```

```plaintext

**Example:** API request processing
- Network latency: 50 ms (cross-country)
- Database query: 10 ms
- Business logic: 5 ms
- Response serialization: 2 ms
- **Total:** ~67 ms

### Time Estimation Tricks

1. **Amdahl's Law:** Parallelization has diminishing returns
2. **Pipelining:** Can improve throughput but not latency
3. **Batching:** Reduces overhead but increases latency
4. **Caching:** Reduces latency from seconds to milliseconds
5. **Async processing:** Improves perceived latency

---

## Power of 2 Reference

Essential for quick mental calculations:

| Power | Value | Approximation |
|-------|-------|---------------|
| 2^10 | 1,024 | ~1,000 (1K) |
| 2^20 | 1,048,576 | ~1,000,000 (1M) |
| 2^30 | 1,073,741,824 | ~1,000,000,000 (1B) |
| 2^40 | 1,099,511,627,776 | ~1 trillion |
| 2^50 | 1,125,899,906,842,624 | ~1 quadrillion |

**Quick conversions:**
- 2^10 ≈ 10^3 (thousand)
- 2^20 ≈ 10^6 (million)
- 2^30 ≈ 10^9 (billion)
- 2^40 ≈ 10^12 (trillion)

---

## Practical Tricks & Shortcuts

### 1. The "2.5 Rule" for Storage

For text data with metadata:
```

```plaintext
Accounts for indexes, metadata, overhead, and some growth.

### 2. The "80/20 Rule" for Traffic

80% of traffic happens in 20% of time (peak hours).
```



### 3. The "10x Rule" for Growth

Design systems to handle 10x current load:




### 4. Quick Bandwidth Calculation


### 5. Storage per User Estimation

For social media platforms:
- **Light user:** 100 MB - 1 GB
- **Average user:** 1-10 GB
- **Heavy user:** 10-100 GB

### 6. Request Rate Estimation


### 7. Database Size Estimation


### 8. Cache Hit Rate Assumption

For well-designed caching:
- **Cache hit rate:** 80-95%
- **Cache miss rate:** 5-20%

### 9. Compression Ratios

| Data Type | Compression Ratio |
|-----------|-------------------|
| Text/JSON | 2-5x |
| Logs | 3-10x |
| Images (already compressed) | 1.1-1.5x |
| Video | 10-100x |
| Database backups | 3-5x |


---
## Common Estimation Mistakes to Avoid

1. **Forgetting replication factor** - Always multiply by 2-3x
2. **Ignoring peak traffic** - Design for 3-5x average
3. **Not accounting for overhead** - Add 20-30% for metadata
4. **Mixing units** - Keep consistent (bytes vs bits, MB vs GB)
5. **Ignoring growth** - Plan for 10x capacity
6. **Underestimating latency** - Network latency adds up
7. **Forgetting compression** - Can significantly reduce storage/bandwidth
8. **Not considering both directions** - Upload and download matter


## Practice Problems

1. **Estimate storage for 1 billion user profiles** (assume 2 KB per profile)
2. **Calculate bandwidth for 10M concurrent video streams** (5 Mbps each)
3. **Estimate latency for API call** (cross-country, database query, processing)
4. **Calculate storage for 1 year of logs** (1M requests/day, 1 KB per log)
5. **Estimate bandwidth for file upload service** (100K users, 10 MB files, 1% upload daily)

---

## Additional Resources

- [Google's Numbers Everyone Should Know](https://gist.github.com/jboner/2841832)
- [Latency Numbers Every Programmer Should Know](https://colin-scott.github.io/personal_website/research/interactive_latency.html)

---

**Remember:** Back-of-the-envelope estimation is about getting the right order of magnitude, not exact numbers. Round liberally, use approximations, and focus on understanding the scale of the problem.

