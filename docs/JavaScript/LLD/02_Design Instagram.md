---
sidebar_position: 1
---

# Design Instagram

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

This document provides the Low-Level Design (LLD) for Instagram, focusing on detailed class structures, data models, and implementation details for core features including posts, stories, feed generation, comments, likes, and user interactions.

## System Requirements

### Functional Requirements
- User registration and authentication
- Create, view, edit, and delete posts
- Upload and manage photos/videos
- Create and view stories (24-hour expiration)
- Like and comment on posts
- Follow/unfollow users
- View personalized feed
- Search users and posts
- Direct messaging
- Notifications

### Non-Functional Requirements
- High availability (99.9% uptime)
- Low latency (< 200ms for feed generation)
- Scalability (billions of users)
- Consistency for critical operations
- Eventual consistency acceptable for some features

## Class Design

### Core Classes

#### User
```javascript
class User {
  constructor(userId, username, email, passwordHash) {
    this.userId = userId;
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;
    this.profilePicture = null;
    this.bio = '';
    this.isPrivate = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  updateProfile(profileData) {
    // Update user profile information
  }

  changePassword(newPasswordHash) {
    // Update password
  }

  togglePrivacy() {
    // Toggle account privacy
  }
}
```

#### Post
```javascript
class Post {
  constructor(postId, userId, mediaUrl, caption) {
    this.postId = postId;
    this.userId = userId;
    this.mediaUrl = mediaUrl;
    this.caption = caption;
    this.likesCount = 0;
    this.commentsCount = 0;
    this.createdAt = new Date();
    this.location = null;
    this.tags = [];
  }

  addLike(userId) {
    // Increment likes count
  }

  removeLike(userId) {
    // Decrement likes count
  }

  addComment(comment) {
    // Add comment and increment count
  }

  deleteComment(commentId) {
    // Remove comment and decrement count
  }
}
```

#### Story
```javascript
class Story {
  constructor(storyId, userId, mediaUrl, type) {
    this.storyId = storyId;
    this.userId = userId;
    this.mediaUrl = mediaUrl;
    this.type = type; // 'photo' or 'video'
    this.createdAt = new Date();
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.viewers = new Set();
  }

  addViewer(userId) {
    // Add user to viewers list
  }

  isExpired() {
    return new Date() > this.expiresAt;
  }

  getViewersCount() {
    return this.viewers.size;
  }
}
```

#### Comment
```javascript
class Comment {
  constructor(commentId, postId, userId, content) {
    this.commentId = commentId;
    this.postId = postId;
    this.userId = userId;
    this.content = content;
    this.likesCount = 0;
    this.createdAt = new Date();
    this.parentCommentId = null; // For nested comments
  }

  addLike(userId) {
    // Increment likes count
  }

  removeLike(userId) {
    // Decrement likes count
  }

  isReply() {
    return this.parentCommentId !== null;
  }
}
```

#### Like
```javascript
class Like {
  constructor(likeId, userId, targetId, targetType) {
    this.likeId = likeId;
    this.userId = userId;
    this.targetId = targetId; // postId or commentId
    this.targetType = targetType; // 'post' or 'comment'
    this.createdAt = new Date();
  }
}
```

#### Follow
```javascript
class Follow {
  constructor(followId, followerId, followingId) {
    this.followId = followId;
    this.followerId = followerId;
    this.followingId = followingId;
    this.createdAt = new Date();
    this.status = 'active'; // 'active' or 'blocked'
  }

  block() {
    this.status = 'blocked';
  }

  unblock() {
    this.status = 'active';
  }
}
```

### Service Classes

#### PostService
```javascript
class PostService {
  constructor(postRepository, mediaService, notificationService) {
    this.postRepository = postRepository;
    this.mediaService = mediaService;
    this.notificationService = notificationService;
  }

  async createPost(userId, mediaFile, caption, location) {
    // 1. Upload media to storage
    const mediaUrl = await this.mediaService.upload(mediaFile);
    
    // 2. Create post record
    const post = new Post(generateId(), userId, mediaUrl, caption);
    if (location) post.location = location;
    
    // 3. Extract and save hashtags
    const hashtags = this.extractHashtags(caption);
    await this.saveHashtags(post.postId, hashtags);
    
    // 4. Save post
    await this.postRepository.save(post);
    
    // 5. Notify followers
    await this.notificationService.notifyNewPost(userId, post.postId);
    
    return post;
  }

  async getPost(postId, userId) {
    const post = await this.postRepository.findById(postId);
    if (!post) throw new Error('Post not found');
    
    // Check if user has permission to view
    const canView = await this.canUserViewPost(userId, post);
    if (!canView) throw new Error('Access denied');
    
    return post;
  }

  async deletePost(postId, userId) {
    const post = await this.postRepository.findById(postId);
    if (post.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Delete media from storage
    await this.mediaService.delete(post.mediaUrl);
    
    // Delete post and related data
    await this.postRepository.delete(postId);
  }

  extractHashtags(caption) {
    const hashtagRegex = /#(\w+)/g;
    return caption.match(hashtagRegex) || [];
  }

  async canUserViewPost(userId, post) {
    const postOwner = await this.userRepository.findById(post.userId);
    
    // Public account or own post
    if (!postOwner.isPrivate || post.userId === userId) {
      return true;
    }
    
    // Check if user follows the post owner
    return await this.followRepository.isFollowing(userId, post.userId);
  }
}
```

#### FeedService
```javascript
class FeedService {
  constructor(
    postRepository,
    followRepository,
    cacheService,
    feedGenerator
  ) {
    this.postRepository = postRepository;
    this.followRepository = followRepository;
    this.cacheService = cacheService;
    this.feedGenerator = feedGenerator;
  }

  async getFeed(userId, page = 1, pageSize = 10) {
    // Check cache first
    const cacheKey = `feed:${userId}:${page}`;
    const cachedFeed = await this.cacheService.get(cacheKey);
    if (cachedFeed) {
      return cachedFeed;
    }

    // Get following list
    const following = await this.followRepository.getFollowing(userId);
    const followingIds = following.map(f => f.followingId);
    
    // Generate feed using ranking algorithm
    const feed = await this.feedGenerator.generateFeed(
      userId,
      followingIds,
      page,
      pageSize
    );

    // Cache the result
    await this.cacheService.set(cacheKey, feed, 300); // 5 minutes TTL

    return feed;
  }

  async refreshFeed(userId) {
    // Invalidate cache
    await this.cacheService.deletePattern(`feed:${userId}:*`);
    
    // Trigger background job to regenerate feed
    await this.feedGenerator.precomputeFeed(userId);
  }
}
```

#### FeedGenerator
```javascript
class FeedGenerator {
  constructor(postRepository, likeRepository, commentRepository) {
    this.postRepository = postRepository;
    this.likeRepository = likeRepository;
    this.commentRepository = commentRepository;
  }

  async generateFeed(userId, followingIds, page, pageSize) {
    if (followingIds.length === 0) {
      return this.getSuggestedPosts(userId, pageSize);
    }

    // Get recent posts from following
    const posts = await this.postRepository.findByUserIds(
      followingIds,
      page,
      pageSize
    );

    // Rank posts using scoring algorithm
    const rankedPosts = await this.rankPosts(posts, userId);

    return rankedPosts;
  }

  async rankPosts(posts, userId) {
    // Score each post based on multiple factors
    const scoredPosts = await Promise.all(
      posts.map(async (post) => {
        const score = await this.calculatePostScore(post, userId);
        return { post, score };
      })
    );

    // Sort by score (descending)
    scoredPosts.sort((a, b) => b.score - a.score);

    return scoredPosts.map(item => item.post);
  }

  async calculatePostScore(post, userId) {
    const weights = {
      recency: 0.3,
      likes: 0.25,
      comments: 0.2,
      userEngagement: 0.15,
      relationship: 0.1
    };

    // Recency score (exponential decay)
    const hoursSincePost = (Date.now() - post.createdAt) / (1000 * 60 * 60);
    const recencyScore = Math.exp(-hoursSincePost / 24);

    // Engagement score
    const likesScore = Math.log(1 + post.likesCount) / 10;
    const commentsScore = Math.log(1 + post.commentsCount) / 10;

    // User engagement with post owner
    const userEngagement = await this.getUserEngagementScore(
      userId,
      post.userId
    );

    // Relationship score (close friends, frequent interactions)
    const relationshipScore = await this.getRelationshipScore(
      userId,
      post.userId
    );

    return (
      weights.recency * recencyScore +
      weights.likes * likesScore +
      weights.comments * commentsScore +
      weights.userEngagement * userEngagement +
      weights.relationship * relationshipScore
    );
  }

  async getUserEngagementScore(userId, postOwnerId) {
    // Calculate based on user's past interactions with post owner
    const interactions = await this.getInteractionHistory(
      userId,
      postOwnerId
    );
    return Math.min(interactions / 10, 1); // Normalize to 0-1
  }

  async getRelationshipScore(userId, postOwnerId) {
    // Check if user is in post owner's close friends list
    // Check interaction frequency
    // Return normalized score
    return 0.5; // Placeholder
  }
}
```

#### StoryService
```javascript
class StoryService {
  constructor(
    storyRepository,
    mediaService,
    notificationService,
    scheduler
  ) {
    this.storyRepository = storyRepository;
    this.mediaService = mediaService;
    this.notificationService = notificationService;
    this.scheduler = scheduler;
  }

  async createStory(userId, mediaFile, type) {
    // Upload media
    const mediaUrl = await this.mediaService.upload(mediaFile);

    // Create story
    const story = new Story(generateId(), userId, mediaUrl, type);
    await this.storyRepository.save(story);

    // Schedule deletion after 24 hours
    this.scheduler.schedule(
      story.expiresAt,
      () => this.deleteStory(story.storyId)
    );

    // Notify followers
    await this.notificationService.notifyNewStory(userId, story.storyId);

    return story;
  }

  async viewStory(storyId, userId) {
    const story = await this.storyRepository.findById(storyId);
    
    if (!story || story.isExpired()) {
      throw new Error('Story not found or expired');
    }

    // Check if user can view story
    const canView = await this.canUserViewStory(userId, story);
    if (!canView) {
      throw new Error('Access denied');
    }

    // Record view
    story.addViewer(userId);
    await this.storyRepository.update(story);

    return story;
  }

  async getStories(userId) {
    // Get stories from users that userId follows
    const following = await this.followRepository.getFollowing(userId);
    const followingIds = following.map(f => f.followingId);

    const stories = await this.storyRepository.findByUserIds(followingIds);
    
    // Group by user
    return this.groupStoriesByUser(stories);
  }

  async deleteStory(storyId) {
    const story = await this.storyRepository.findById(storyId);
    if (story) {
      await this.mediaService.delete(story.mediaUrl);
      await this.storyRepository.delete(storyId);
    }
  }

  async cleanupExpiredStories() {
    // Background job to clean up expired stories
    const expiredStories = await this.storyRepository.findExpired();
    for (const story of expiredStories) {
      await this.deleteStory(story.storyId);
    }
  }
}
```

#### LikeService
```javascript
class LikeService {
  constructor(likeRepository, postRepository, notificationService) {
    this.likeRepository = likeRepository;
    this.postRepository = postRepository;
    this.notificationService = notificationService;
  }

  async likePost(userId, postId) {
    // Check if already liked
    const existingLike = await this.likeRepository.findByUserAndTarget(
      userId,
      postId,
      'post'
    );

    if (existingLike) {
      throw new Error('Already liked');
    }

    // Create like
    const like = new Like(generateId(), userId, postId, 'post');
    await this.likeRepository.save(like);

    // Update post likes count
    const post = await this.postRepository.findById(postId);
    post.addLike(userId);
    await this.postRepository.update(post);

    // Notify post owner
    if (post.userId !== userId) {
      await this.notificationService.notifyLike(post.userId, userId, postId);
    }

    return like;
  }

  async unlikePost(userId, postId) {
    const like = await this.likeRepository.findByUserAndTarget(
      userId,
      postId,
      'post'
    );

    if (!like) {
      throw new Error('Like not found');
    }

    // Delete like
    await this.likeRepository.delete(like.likeId);

    // Update post likes count
    const post = await this.postRepository.findById(postId);
    post.removeLike(userId);
    await this.postRepository.update(post);
  }

  async getLikes(postId, page = 1, pageSize = 20) {
    return await this.likeRepository.findByTarget(postId, 'post', page, pageSize);
  }
}
```

#### CommentService
```javascript
class CommentService {
  constructor(
    commentRepository,
    postRepository,
    notificationService
  ) {
    this.commentRepository = commentRepository;
    this.postRepository = postRepository;
    this.notificationService = notificationService;
  }

  async addComment(userId, postId, content, parentCommentId = null) {
    const comment = new Comment(
      generateId(),
      postId,
      userId,
      content
    );

    if (parentCommentId) {
      comment.parentCommentId = parentCommentId;
    }

    await this.commentRepository.save(comment);

    // Update post comments count
    const post = await this.postRepository.findById(postId);
    post.addComment(comment);
    await this.postRepository.update(post);

    // Notify post owner and parent comment owner
    if (post.userId !== userId) {
      await this.notificationService.notifyComment(
        post.userId,
        userId,
        postId,
        comment.commentId
      );
    }

    if (parentCommentId) {
      const parentComment = await this.commentRepository.findById(parentCommentId);
      if (parentComment && parentComment.userId !== userId) {
        await this.notificationService.notifyReply(
          parentComment.userId,
          userId,
          postId,
          comment.commentId
        );
      }
    }

    return comment;
  }

  async deleteComment(commentId, userId) {
    const comment = await this.commentRepository.findById(commentId);
    
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Check authorization
    const post = await this.postRepository.findById(comment.postId);
    if (comment.userId !== userId && post.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await this.commentRepository.delete(commentId);

    // Update post comments count
    post.deleteComment(commentId);
    await this.postRepository.update(post);
  }

  async getComments(postId, page = 1, pageSize = 20) {
    return await this.commentRepository.findByPostId(postId, page, pageSize);
  }
}
```

#### FollowService
```javascript
class FollowService {
  constructor(
    followRepository,
    userRepository,
    notificationService
  ) {
    this.followRepository = followRepository;
    this.userRepository = userRepository;
    this.notificationService = notificationService;
  }

  async followUser(followerId, followingId) {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    // Check if already following
    const existingFollow = await this.followRepository.findByFollowerAndFollowing(
      followerId,
      followingId
    );

    if (existingFollow && existingFollow.status === 'active') {
      throw new Error('Already following');
    }

    const followingUser = await this.userRepository.findById(followingId);
    
    // Check if account is private
    if (followingUser.isPrivate) {
      // Create follow request instead
      return await this.createFollowRequest(followerId, followingId);
    }

    // Create follow relationship
    const follow = new Follow(generateId(), followerId, followingId);
    await this.followRepository.save(follow);

    // Notify user
    await this.notificationService.notifyFollow(followingId, followerId);

    return follow;
  }

  async unfollowUser(followerId, followingId) {
    const follow = await this.followRepository.findByFollowerAndFollowing(
      followerId,
      followingId
    );

    if (!follow) {
      throw new Error('Not following');
    }

    await this.followRepository.delete(follow.followId);
  }

  async getFollowers(userId, page = 1, pageSize = 20) {
    return await this.followRepository.findByFollowing(userId, page, pageSize);
  }

  async getFollowing(userId, page = 1, pageSize = 20) {
    return await this.followRepository.findByFollower(userId, page, pageSize);
  }
}
```

#### SearchService
```javascript
class SearchService {
  constructor(
    userRepository,
    postRepository,
    searchIndex
  ) {
    this.userRepository = userRepository;
    this.postRepository = postRepository;
    this.searchIndex = searchIndex;
  }

  async searchUsers(query, page = 1, pageSize = 20) {
    // Use search index for fast lookup
    const userIds = await this.searchIndex.searchUsers(query, page, pageSize);
    
    // Fetch user details
    const users = await Promise.all(
      userIds.map(id => this.userRepository.findById(id))
    );

    // Rank results (verified accounts, followers count, etc.)
    return this.rankUsers(users);
  }

  async searchPosts(query, page = 1, pageSize = 20) {
    // Search by hashtags, captions, locations
    const postIds = await this.searchIndex.searchPosts(query, page, pageSize);
    
    const posts = await Promise.all(
      postIds.map(id => this.postRepository.findById(id))
    );

    return this.rankPosts(posts);
  }

  rankUsers(users) {
    // Sort by verification status, followers count, relevance
    return users.sort((a, b) => {
      if (a.isVerified !== b.isVerified) {
        return b.isVerified - a.isVerified;
      }
      return b.followersCount - a.followersCount;
    });
  }

  rankPosts(posts) {
    // Sort by engagement, recency
    return posts.sort((a, b) => {
      const scoreA = a.likesCount + a.commentsCount;
      const scoreB = b.likesCount + b.commentsCount;
      return scoreB - scoreA;
    });
  }
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  user_id BIGINT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_picture_url VARCHAR(500),
  bio TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_email (email)
);
```

### Posts Table
```sql
CREATE TABLE posts (
  post_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type VARCHAR(20) NOT NULL, -- 'photo' or 'video'
  caption TEXT,
  location VARCHAR(200),
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_location (location)
);
```

### Stories Table
```sql
CREATE TABLE stories (
  story_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  media_url VARCHAR(500) NOT NULL,
  media_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  viewers_count INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

### Story Views Table
```sql
CREATE TABLE story_views (
  view_id BIGINT PRIMARY KEY,
  story_id BIGINT NOT NULL,
  viewer_id BIGINT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (story_id) REFERENCES stories(story_id),
  FOREIGN KEY (viewer_id) REFERENCES users(user_id),
  UNIQUE KEY unique_story_viewer (story_id, viewer_id),
  INDEX idx_story_id (story_id)
);
```

### Comments Table
```sql
CREATE TABLE comments (
  comment_id BIGINT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id BIGINT,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(post_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (parent_comment_id) REFERENCES comments(comment_id),
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id),
  INDEX idx_parent_comment_id (parent_comment_id)
);
```

### Likes Table
```sql
CREATE TABLE likes (
  like_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  target_id BIGINT NOT NULL,
  target_type VARCHAR(20) NOT NULL, -- 'post' or 'comment'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE KEY unique_user_target (user_id, target_id, target_type),
  INDEX idx_target (target_id, target_type),
  INDEX idx_user_id (user_id)
);
```

### Follows Table
```sql
CREATE TABLE follows (
  follow_id BIGINT PRIMARY KEY,
  follower_id BIGINT NOT NULL,
  following_id BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active' or 'blocked'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES users(user_id),
  FOREIGN KEY (following_id) REFERENCES users(user_id),
  UNIQUE KEY unique_follow (follower_id, following_id),
  INDEX idx_follower_id (follower_id),
  INDEX idx_following_id (following_id)
);
```

### Hashtags Table
```sql
CREATE TABLE hashtags (
  hashtag_id BIGINT PRIMARY KEY,
  tag VARCHAR(100) UNIQUE NOT NULL,
  posts_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tag (tag)
);
```

### Post Hashtags Table
```sql
CREATE TABLE post_hashtags (
  post_id BIGINT NOT NULL,
  hashtag_id BIGINT NOT NULL,
  PRIMARY KEY (post_id, hashtag_id),
  FOREIGN KEY (post_id) REFERENCES posts(post_id),
  FOREIGN KEY (hashtag_id) REFERENCES hashtags(hashtag_id),
  INDEX idx_hashtag_id (hashtag_id)
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
  notification_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'like', 'comment', 'follow', etc.
  actor_id BIGINT NOT NULL,
  target_id BIGINT, -- post_id, comment_id, etc.
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (actor_id) REFERENCES users(user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);
```

## API Design

### RESTful Endpoints

#### User Endpoints
```
POST   /api/v1/users/register
POST   /api/v1/users/login
GET    /api/v1/users/:userId
PUT    /api/v1/users/:userId
DELETE /api/v1/users/:userId
GET    /api/v1/users/:userId/posts
GET    /api/v1/users/:userId/followers
GET    /api/v1/users/:userId/following
```

#### Post Endpoints
```
POST   /api/v1/posts
GET    /api/v1/posts/:postId
PUT    /api/v1/posts/:postId
DELETE /api/v1/posts/:postId
GET    /api/v1/posts/:postId/likes
GET    /api/v1/posts/:postId/comments
```

#### Story Endpoints
```
POST   /api/v1/stories
GET    /api/v1/stories
GET    /api/v1/stories/:storyId
POST   /api/v1/stories/:storyId/view
DELETE /api/v1/stories/:storyId
```

#### Feed Endpoints
```
GET    /api/v1/feed
POST   /api/v1/feed/refresh
```

#### Like Endpoints
```
POST   /api/v1/posts/:postId/like
DELETE /api/v1/posts/:postId/like
POST   /api/v1/comments/:commentId/like
DELETE /api/v1/comments/:commentId/like
```

#### Comment Endpoints
```
POST   /api/v1/posts/:postId/comments
DELETE /api/v1/comments/:commentId
PUT    /api/v1/comments/:commentId
```

#### Follow Endpoints
```
POST   /api/v1/users/:userId/follow
DELETE /api/v1/users/:userId/follow
```

#### Search Endpoints
```
GET    /api/v1/search/users?q=query
GET    /api/v1/search/posts?q=query
GET    /api/v1/search/hashtags?q=query
```

### Request/Response Examples

#### Create Post
```json
POST /api/v1/posts
Content-Type: multipart/form-data

{
  "media": <file>,
  "caption": "Beautiful sunset! #sunset #nature",
  "location": "San Francisco, CA"
}

Response: 201 Created
{
  "postId": "123456789",
  "userId": "987654321",
  "mediaUrl": "https://cdn.instagram.com/media/...",
  "caption": "Beautiful sunset! #sunset #nature",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

#### Get Feed
```json
GET /api/v1/feed?page=1&pageSize=10

Response: 200 OK
{
  "posts": [
    {
      "postId": "123456789",
      "userId": "987654321",
      "username": "johndoe",
      "profilePicture": "https://...",
      "mediaUrl": "https://...",
      "caption": "Beautiful sunset!",
      "likesCount": 150,
      "commentsCount": 25,
      "isLiked": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "hasMore": true,
  "nextPage": 2
}
```

## Key Algorithms

### Feed Ranking Algorithm

The feed ranking algorithm uses a scoring system based on multiple factors:

```javascript
function calculatePostScore(post, user) {
  const scores = {
    recency: calculateRecencyScore(post.createdAt),
    engagement: calculateEngagementScore(post),
    relationship: calculateRelationshipScore(user, post.userId),
    contentQuality: calculateContentQualityScore(post)
  };

  const weights = {
    recency: 0.3,
    engagement: 0.35,
    relationship: 0.2,
    contentQuality: 0.15
  };

  return (
    scores.recency * weights.recency +
    scores.engagement * weights.engagement +
    scores.relationship * weights.relationship +
    scores.contentQuality * weights.contentQuality
  );
}

function calculateRecencyScore(createdAt) {
  const hoursSincePost = (Date.now() - createdAt) / (1000 * 60 * 60);
  // Exponential decay: newer posts score higher
  return Math.exp(-hoursSincePost / 24);
}

function calculateEngagementScore(post) {
  const likesScore = Math.log(1 + post.likesCount) / 10;
  const commentsScore = Math.log(1 + post.commentsCount) / 10;
  return (likesScore + commentsScore) / 2;
}
```

### Story Expiration Algorithm

Stories automatically expire after 24 hours:

```javascript
class StoryExpirationScheduler {
  constructor(storyRepository) {
    this.storyRepository = storyRepository;
    this.startScheduler();
  }

  startScheduler() {
    // Run every hour
    setInterval(() => {
      this.cleanupExpiredStories();
    }, 60 * 60 * 1000);
  }

  async cleanupExpiredStories() {
    const expiredStories = await this.storyRepository.findExpired();
    for (const story of expiredStories) {
      await this.deleteStory(story.storyId);
    }
  }
}
```

## Design Patterns

### Repository Pattern
Used for data access abstraction:
```javascript
class PostRepository {
  async save(post) { /* ... */ }
  async findById(postId) { /* ... */ }
  async findByUserId(userId) { /* ... */ }
  async delete(postId) { /* ... */ }
}
```

### Service Layer Pattern
Business logic separated into service classes:
- PostService
- FeedService
- StoryService
- LikeService
- CommentService

### Observer Pattern
For notifications:
```javascript
class NotificationService {
  constructor() {
    this.observers = [];
  }

  subscribe(observer) {
    this.observers.push(observer);
  }

  notify(event) {
    this.observers.forEach(observer => observer.update(event));
  }
}
```

### Factory Pattern
For creating different types of media:
```javascript
class MediaFactory {
  createMedia(type, file) {
    switch(type) {
      case 'photo':
        return new Photo(file);
      case 'video':
        return new Video(file);
      default:
        throw new Error('Unsupported media type');
    }
  }
}
```

### Strategy Pattern
For different feed ranking strategies:
```javascript
class FeedRankingStrategy {
  rank(posts) {
    throw new Error('Must implement rank method');
  }
}

class EngagementBasedRanking extends FeedRankingStrategy {
  rank(posts) {
    return posts.sort((a, b) => 
      (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount)
    );
  }
}
```

## Error Handling

### Error Types
```javascript
class InstagramError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'InstagramError';
  }
}

class NotFoundError extends InstagramError {
  constructor(resource) {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends InstagramError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class ValidationError extends InstagramError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}
```

### Error Handling Middleware
```javascript
function errorHandler(err, req, res, next) {
  if (err instanceof InstagramError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        type: err.name
      }
    });
  }

  // Default error
  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'InternalServerError'
    }
  });
}
```

## Performance Optimizations

### Caching Strategy
- **Feed Cache**: Cache user feeds for 5 minutes
- **User Profile Cache**: Cache user profiles for 15 minutes
- **Post Cache**: Cache popular posts for 1 hour
- **Story Cache**: Cache active stories for 10 minutes

### Database Optimizations
- Indexes on frequently queried columns
- Partitioning for large tables (posts, likes)
- Read replicas for read-heavy operations
- Connection pooling

### Lazy Loading
- Load comments on demand (pagination)
- Load likes list on demand
- Load followers/following lists with pagination

### CDN for Media
- All media files served through CDN
- Image compression and multiple resolutions
- Video transcoding for different qualities

### Background Jobs
- Feed precomputation
- Story expiration cleanup
- Notification delivery
- Analytics processing

## Conclusion

This LLD provides a comprehensive design for Instagram's core features, focusing on:
- Clean class structure and separation of concerns
- Scalable database schema
- Efficient feed ranking algorithm
- Proper error handling
- Performance optimizations

The design follows best practices and design patterns to ensure maintainability and scalability.

