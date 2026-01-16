---
sidebar_position: 2
---

# Design Instagram

A comprehensive system design for Instagram, covering architecture, scalability, and key features.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Capacity Estimation](#capacity-estimation)
4. [System APIs](#system-apis)
5. [Database Design](#database-design)
6. [High-Level Design](#high-level-design)
7. [Component Design](#component-design)
8. [Data Partitioning](#data-partitioning)
9. [Caching Strategy](#caching-strategy)
10. [Load Balancing](#load-balancing)
11. [Security & Privacy](#security--privacy)
12. [Monitoring & Analytics](#monitoring--analytics)

---

## Problem Statement

Design a photo and video sharing social networking service similar to Instagram where users can:
- Upload photos and videos
- Follow other users
- View a personalized feed of photos/videos from followed users
- Like and comment on posts
- Search for users, photos, and hashtags
- Receive notifications

---

## Requirements

### Functional Requirements

1. **User Management**
   - User registration and authentication
   - User profiles (bio, profile picture, follower/following counts)
   - Follow/unfollow users

2. **Content Management**
   - Upload photos and videos
   - Apply filters to photos
   - Add captions, hashtags, and location tags
   - Delete posts

3. **Feed Generation**
   - Personalized feed showing posts from followed users
   - Chronological and algorithm-based feeds
   - Infinite scroll

4. **Social Features**
   - Like posts
   - Comment on posts
   - Share posts
   - Save posts

5. **Search**
   - Search users by username
   - Search posts by hashtags
   - Search posts by location

6. **Notifications**
   - Real-time notifications for likes, comments, follows
   - Push notifications

### Non-Functional Requirements

1. **Scalability**: Support 1 billion users, 500 million daily active users
2. **Availability**: 99.9% uptime
3. **Performance**: 
   - Feed generation: < 200ms
   - Image upload: < 3 seconds
   - Image retrieval: < 100ms
4. **Reliability**: No data loss, handle failures gracefully
5. **Consistency**: Eventual consistency is acceptable for social features

---

## Capacity Estimation

### Traffic Estimates

- **Total users**: 1 billion
- **Daily active users (DAU)**: 500 million
- **Posts per day**: 100 million (20% of DAU post daily)
- **Average posts per user per day**: 2
- **Read-to-write ratio**: 100:1 (users view more than they post)
- **Feed views per day**: 5 billion (10 feeds per DAU)
- **Likes per day**: 5 billion (10 likes per DAU)
- **Comments per day**: 500 million (1 comment per DAU)

### Storage Estimates

**Photo Storage:**
- Average photo size: 200 KB
- Photos per day: 100 million
- Daily storage: 100M × 200 KB = 20 TB/day
- Yearly storage: 20 TB × 365 = 7.3 PB/year
- With 3x replication: 21.9 PB/year
- 5 years retention: ~110 PB

**Video Storage:**
- Average video size: 3 MB (15 seconds)
- Videos per day: 20 million (20% of posts)
- Daily storage: 20M × 3 MB = 60 TB/day
- Yearly storage: 60 TB × 365 = 21.9 PB/year
- With 3x replication: 65.7 PB/year
- 5 years retention: ~330 PB

**Metadata Storage:**
- Post metadata: ~1 KB per post
- 100M posts/day × 1 KB = 100 GB/day
- Yearly: 100 GB × 365 = 36.5 TB/year
- With 3x replication: 110 TB/year
- 5 years: ~550 TB

**Total Storage: ~440 PB (with replication and 5 years retention)**

### Bandwidth Estimates

**Upload:**
- 100M posts/day × 200 KB = 20 TB/day
- Average: 20 TB / 86,400s = 231 MB/s = 1.85 Gbps
- Peak (5x average): ~9 Gbps

**Download:**
- 5B feed views/day × 200 KB = 1 PB/day
- Average: 1 PB / 86,400s = 11.6 TB/s = 92.8 Tbps
- Peak (5x average): ~464 Tbps

**CDN will handle most download traffic, reducing origin server load.**

---

## System APIs

### RESTful API Design

```javascript
// User APIs
POST   /api/v1/users/register
POST   /api/v1/users/login
GET    /api/v1/users/{userId}
PUT    /api/v1/users/{userId}
DELETE /api/v1/users/{userId}

// Follow APIs
POST   /api/v1/users/{userId}/follow
DELETE /api/v1/users/{userId}/follow
GET    /api/v1/users/{userId}/followers
GET    /api/v1/users/{userId}/following

// Post APIs
POST   /api/v1/posts
GET    /api/v1/posts/{postId}
DELETE /api/v1/posts/{postId}
GET    /api/v1/users/{userId}/posts

// Feed APIs
GET    /api/v1/feed?page={page}&limit={limit}

// Like APIs
POST   /api/v1/posts/{postId}/like
DELETE /api/v1/posts/{postId}/like
GET    /api/v1/posts/{postId}/likes

// Comment APIs
POST   /api/v1/posts/{postId}/comments
GET    /api/v1/posts/{postId}/comments
DELETE /api/v1/comments/{commentId}

// Search APIs
GET    /api/v1/search/users?q={query}
GET    /api/v1/search/posts?q={query}&type={hashtag|location}

// Notification APIs
GET    /api/v1/notifications
PUT    /api/v1/notifications/{notificationId}/read
```

### Example API Request/Response

**Upload Post:**
```json
POST /api/v1/posts
Request:
{
  "userId": "123",
  "imageUrl": "https://cdn.instagram.com/images/abc123.jpg",
  "caption": "Beautiful sunset #sunset #nature",
  "location": {"lat": 40.7128, "lng": -74.0060},
  "filters": ["vintage"]
}

Response:
{
  "postId": "post_456",
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Get Feed:**
```json
GET /api/v1/feed?page=1&limit=20

Response:
{
  "posts": [
    {
      "postId": "post_123",
      "userId": "user_456",
      "username": "johndoe",
      "imageUrl": "https://cdn.instagram.com/images/abc123.jpg",
      "caption": "Beautiful sunset",
      "likes": 1250,
      "comments": 45,
      "timestamp": "2024-01-15T09:00:00Z",
      "isLiked": false
    }
  ],
  "nextPage": 2,
  "hasMore": true
}
```

---

## Database Design

### Data Models

#### User Table
```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    bio TEXT,
    profile_picture_url VARCHAR(512),
    follower_count INT DEFAULT 0,
    following_count INT DEFAULT 0,
    post_count INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email)
);
```

#### Post Table
```sql
CREATE TABLE posts (
    post_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    video_url VARCHAR(512),
    caption TEXT,
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    INDEX idx_location (location_lat, location_lng)
);
```

#### Follow Table
```sql
CREATE TABLE follows (
    follower_id BIGINT NOT NULL,
    followee_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id),
    FOREIGN KEY (follower_id) REFERENCES users(user_id),
    FOREIGN KEY (followee_id) REFERENCES users(user_id),
    INDEX idx_follower (follower_id),
    INDEX idx_followee (followee_id)
);
```

#### Like Table
```sql
CREATE TABLE likes (
    like_id BIGINT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
);
```

#### Comment Table
```sql
CREATE TABLE comments (
    comment_id BIGINT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_comment_id BIGINT,
    content TEXT NOT NULL,
    like_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
);
```

#### Hashtag Table
```sql
CREATE TABLE hashtags (
    hashtag_id BIGINT PRIMARY KEY,
    tag VARCHAR(255) UNIQUE NOT NULL,
    post_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tag (tag)
);

CREATE TABLE post_hashtags (
    post_id BIGINT NOT NULL,
    hashtag_id BIGINT NOT NULL,
    PRIMARY KEY (post_id, hashtag_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id),
    FOREIGN KEY (hashtag_id) REFERENCES hashtags(hashtag_id),
    INDEX idx_hashtag_id (hashtag_id)
);
```

#### Notification Table
```sql
CREATE TABLE notifications (
    notification_id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type ENUM('like', 'comment', 'follow', 'mention') NOT NULL,
    actor_id BIGINT,
    post_id BIGINT,
    comment_id BIGINT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_user_unread (user_id, is_read, created_at)
);
```

### Database Sharding Strategy

**Shard by User ID:**
- Use consistent hashing to distribute users across shards
- User data, posts, and relationships stored on same shard when possible
- Cross-shard queries for feed generation (handled by feed service)

**Shard by Post ID:**
- Posts sharded separately for better distribution
- Enables parallel processing of popular posts

---

## High-Level Design

```
┌─────────────┐
│   Client    │
│  (Mobile/   │
│    Web)     │
└──────┬──────┘
       │
       │ HTTPS
       │
┌──────▼─────────────────────────────────────────────┐
│              Load Balancer                         │
│         (Application Load Balancer)               │
└──────┬─────────────────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
│   API       │   │   API       │   │   API       │
│  Server 1   │   │  Server 2   │   │  Server N   │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │  Cache  │     │  Cache  │    │  Cache  │
    │ (Redis) │     │ (Redis) │    │ (Redis) │
    └────┬────┘     └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │Database │     │Database │    │Database │
    │ Shard 1 │     │ Shard 2 │    │ Shard N │
    └─────────┘     └─────────┘    └─────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
              ┌──────────▼──────────┐
              │   Object Storage    │
              │   (S3/CDN)          │
              │   - Photos          │
              │   - Videos          │
              └─────────────────────┘
```

### Core Services

1. **User Service**: Handles user registration, authentication, profiles
2. **Post Service**: Manages post creation, retrieval, deletion
3. **Feed Service**: Generates personalized feeds
4. **Social Graph Service**: Manages follow relationships
5. **Like/Comment Service**: Handles likes and comments
6. **Search Service**: Handles search functionality
7. **Notification Service**: Manages notifications
8. **Media Service**: Handles image/video upload and processing

---

## Component Design

### Feed Generation Service

**Challenge**: Generate personalized feed for 500M DAU efficiently.

**Approach 1: Pre-computed Feed (Fan-out on Write)**
```
When user posts:
1. Get all followers (fan-out)
2. Insert post into each follower's feed cache
3. Feed retrieval is O(1) - just read from cache

Pros:
- Fast feed retrieval
- Real-time updates

Cons:
- Slow for users with millions of followers
- High write amplification
```

**Approach 2: On-demand Feed (Fan-out on Read)**
```
When user requests feed:
1. Get list of followed users
2. Fetch recent posts from each
3. Merge and rank posts
4. Return top N posts

Pros:
- No write amplification
- Works for celebrity accounts

Cons:
- Slower feed generation
- Higher read load
```

**Hybrid Approach (Recommended):**
```
- Pre-compute feeds for users with < 1000 followers
- On-demand for users with > 1000 followers
- Use background workers to pre-compute feeds asynchronously
```

**Feed Generation Algorithm:**
```python
def generate_feed(user_id, page=1, limit=20):
    # Get followed users
    followed_users = get_followed_users(user_id)
    
    # Get recent posts from followed users
    posts = []
    for followee_id in followed_users:
        recent_posts = get_recent_posts(followee_id, limit=100)
        posts.extend(recent_posts)
    
    # Rank posts by:
    # - Recency (70% weight)
    # - Engagement (likes + comments) (20% weight)
    # - User relationship strength (10% weight)
    ranked_posts = rank_posts(posts)
    
    # Paginate
    start = (page - 1) * limit
    end = start + limit
    return ranked_posts[start:end]
```

### Media Upload Service

**Flow:**
1. Client uploads image/video to API server
2. API server validates file (size, type)
3. API server uploads to object storage (S3)
4. Trigger image processing service:
   - Generate thumbnails (multiple sizes)
   - Apply filters if requested
   - Extract metadata
5. Store metadata in database
6. Return post ID to client

**Image Processing Pipeline:**
```
Original Image (2MB)
    ↓
[Resize] → Thumbnail (50KB)
[Resize] → Medium (200KB)
[Resize] → Large (500KB)
[Filter] → Apply user-selected filter
    ↓
Store in CDN
```

### Search Service

**Requirements:**
- Search users by username
- Search posts by hashtags
- Search posts by location

**Implementation:**
- Use Elasticsearch for full-text search
- Index users, posts, hashtags
- Support fuzzy matching for usernames
- Geospatial search for location-based queries

**Index Structure:**
```json
// User Index
{
  "user_id": "123",
  "username": "johndoe",
  "full_name": "John Doe",
  "bio": "Photographer"
}

// Post Index
{
  "post_id": "456",
  "caption": "Beautiful sunset #sunset",
  "hashtags": ["sunset", "nature"],
  "location": {"lat": 40.7128, "lng": -74.0060}
}
```

---

## Data Partitioning

### Partitioning Strategy

**1. User Data Sharding**
- Shard by `user_id` using consistent hashing
- Each shard contains user profile and metadata
- Enables efficient user lookups

**2. Post Data Sharding**
- Shard by `post_id` using consistent hashing
- Distributes load evenly
- Enables parallel processing

**3. Social Graph Sharding**
- Shard by `follower_id`
- All follow relationships for a user on same shard
- Efficient for getting followers/following lists

**4. Feed Data Sharding**
- Shard by `user_id` (feed owner)
- Pre-computed feeds stored per user
- Fast feed retrieval

### Handling Hot Partitions

**Problem**: Celebrity accounts with millions of followers create hot partitions.

**Solutions:**
1. **Separate celebrity feeds**: Use on-demand generation instead of pre-computation
2. **Rate limiting**: Limit writes to celebrity feed caches
3. **Caching**: Aggressively cache celebrity posts
4. **Separate infrastructure**: Dedicated servers for high-traffic accounts

---

## Caching Strategy

### Cache Layers

**1. Application Cache (Redis)**
- User profiles: 24-hour TTL
- Post metadata: 1-hour TTL
- Feed data: 5-minute TTL
- Like/comment counts: 15-minute TTL

**2. CDN Cache**
- Images and videos: Long TTL (1 year)
- Static assets: Long TTL
- Reduces origin server load

**3. Database Query Cache**
- Frequently accessed queries cached
- Invalidate on updates

### Cache Invalidation

```python
# When post is updated
def update_post(post_id, data):
    # Update database
    db.update_post(post_id, data)
    
    # Invalidate caches
    cache.delete(f"post:{post_id}")
    cache.delete(f"user:{user_id}:posts")
    # Invalidate feed caches for all followers
    followers = get_followers(user_id)
    for follower_id in followers:
        cache.delete(f"feed:{follower_id}")
```

### Cache Patterns

**Write-through**: Write to cache and database simultaneously
**Write-behind**: Write to cache, async write to database
**Cache-aside**: Application manages cache, writes to DB, then cache

**For Instagram:**
- **Read-heavy**: Use cache-aside for reads
- **Write-heavy**: Use write-behind for posts (async processing)

---

## Load Balancing

### Load Balancing Strategy

**1. DNS Load Balancing**
- Distribute requests across multiple data centers
- Geographic routing for lower latency

**2. Application Load Balancer**
- Round-robin or least connections
- Health checks for server instances
- SSL termination

**3. Database Load Balancing**
- Read replicas for read queries
- Primary database for writes
- Connection pooling

### Load Balancer Algorithms

- **Round Robin**: Distribute requests evenly
- **Least Connections**: Route to server with fewest connections
- **IP Hash**: Route based on client IP (session affinity)
- **Weighted**: Assign weights based on server capacity

**For Instagram:**
- Use least connections for API servers
- Use IP hash for stateful sessions
- Use weighted for heterogeneous servers

---

## Security & Privacy

### Authentication & Authorization

**Authentication:**
- JWT tokens for stateless authentication
- Token refresh mechanism
- OAuth for third-party login

**Authorization:**
- Role-based access control (RBAC)
- Resource-level permissions
- Rate limiting per user

### Data Security

**Encryption:**
- TLS/SSL for data in transit
- Encryption at rest for sensitive data
- Encrypted database connections

**Privacy:**
- Private accounts (approve followers)
- Block/unblock users
- Report inappropriate content
- GDPR compliance (data deletion)

### Security Measures

1. **Input Validation**: Sanitize all user inputs
2. **SQL Injection Prevention**: Use parameterized queries
3. **XSS Prevention**: Sanitize output
4. **CSRF Protection**: Token-based validation
5. **Rate Limiting**: Prevent abuse
6. **DDoS Protection**: Cloud-based protection services

---

## Monitoring & Analytics

### Key Metrics

**System Metrics:**
- Request rate (QPS)
- Response time (p50, p95, p99)
- Error rate
- Server CPU, memory, disk usage
- Database connection pool usage

**Business Metrics:**
- Daily active users (DAU)
- Monthly active users (MAU)
- Posts per day
- Engagement rate (likes, comments)
- User retention

### Logging

**Structured Logging:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "feed-service",
  "user_id": "123",
  "action": "feed_request",
  "duration_ms": 150,
  "post_count": 20
}
```

**Log Aggregation:**
- Centralized logging (ELK stack, Splunk)
- Real-time monitoring and alerting
- Log retention policies

### Alerting

**Critical Alerts:**
- High error rate (> 1%)
- High latency (p99 > 1s)
- Database connection pool exhaustion
- Disk space low (< 20%)
- Service downtime

---

## Scalability Considerations

### Horizontal Scaling

- **Stateless Services**: All API servers are stateless, easy to scale
- **Database Sharding**: Distribute data across multiple shards
- **Read Replicas**: Scale reads independently
- **Caching**: Reduce database load

### Vertical Scaling

- **Database**: Increase instance size for hot shards
- **Compute**: More CPU/memory for processing services

### Optimization Strategies

1. **Database Indexing**: Proper indexes on frequently queried columns
2. **Query Optimization**: Avoid N+1 queries, use joins
3. **Async Processing**: Background jobs for non-critical tasks
4. **CDN**: Serve static content from edge locations
5. **Compression**: Compress API responses (gzip)
6. **Pagination**: Limit result sets

---

## Failure Handling

### Single Point of Failure

**Eliminate SPOFs:**
- Multiple API server instances
- Database replication (master-slave)
- Multiple cache instances
- Redundant load balancers
- Multiple data centers

### Failure Scenarios

**1. Database Failure**
- Automatic failover to replica
- Data replication for recovery
- Regular backups

**2. Cache Failure**
- Graceful degradation (serve from database)
- Multiple cache instances
- Cache warming strategies

**3. Service Failure**
- Health checks and auto-restart
- Circuit breakers
- Fallback mechanisms

**4. Data Center Failure**
- Multi-region deployment
- Automatic traffic routing
- Data replication across regions

---

## Advanced Features

### Stories (24-hour content)
- Separate storage for temporary content
- Auto-deletion after 24 hours
- Higher write rate, lower retention

### Reels (Short videos)
- Video processing pipeline
- Video transcoding (multiple qualities)
- Higher storage and bandwidth requirements

### Live Streaming
- Real-time video streaming
- WebRTC or HLS streaming
- Separate infrastructure for live content

### Direct Messaging
- Real-time messaging (WebSocket)
- Message queue for delivery
- End-to-end encryption option

---

## Technology Stack

### Backend
- **Languages**: Python (Django/Flask), Java (Spring), Go
- **Databases**: PostgreSQL, MySQL (sharded)
- **Cache**: Redis, Memcached
- **Message Queue**: Kafka, RabbitMQ
- **Search**: Elasticsearch
- **Object Storage**: AWS S3, Google Cloud Storage

### Frontend
- **Mobile**: React Native, Swift (iOS), Kotlin (Android)
- **Web**: React, Next.js

### Infrastructure
- **Cloud**: AWS, GCP, Azure
- **CDN**: CloudFront, Cloudflare
- **Load Balancer**: AWS ALB, Nginx
- **Monitoring**: Prometheus, Grafana, Datadog

---

## Summary

Designing Instagram requires:

1. **Scalable Architecture**: Handle billions of users and posts
2. **Efficient Feed Generation**: Hybrid approach for optimal performance
3. **Media Storage**: CDN + object storage for images/videos
4. **Caching Strategy**: Multi-layer caching for performance
5. **Database Sharding**: Distribute data across shards
6. **Real-time Features**: WebSocket for notifications, live features
7. **Search**: Elasticsearch for fast search
8. **Security**: Authentication, authorization, encryption
9. **Monitoring**: Comprehensive logging and alerting
10. **Failure Handling**: Redundancy and graceful degradation

**Key Trade-offs:**
- **Consistency vs Availability**: Eventual consistency for social features
- **Latency vs Freshness**: Cached feeds vs real-time updates
- **Storage vs Cost**: Compression, retention policies
- **Complexity vs Performance**: Pre-computed vs on-demand feeds

