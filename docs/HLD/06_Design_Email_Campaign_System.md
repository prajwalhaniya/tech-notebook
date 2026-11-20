---
sidebar_position: 6
---

# Design Email Campaign System

A comprehensive system design for an Email Campaign System, covering architecture, scalability, and key features for managing and delivering email marketing campaigns at scale.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements](#requirements)
3. [Capacity Estimation](#capacity-estimation)
4. [System APIs](#system-apis)
5. [Database Design](#database-design)
6. [High-Level Design](#high-level-design)
7. [Component Design](#component-design)
8. [Email Delivery Pipeline](#email-delivery-pipeline)
9. [Template Engine](#template-engine)
10. [A/B Testing](#ab-testing)
11. [Analytics & Tracking](#analytics--tracking)
12. [Data Partitioning](#data-partitioning)
13. [Caching Strategy](#caching-strategy)
14. [Load Balancing](#load-balancing)
15. [Security & Compliance](#security--compliance)
16. [Monitoring & Alerting](#monitoring--alerting)

---

## Problem Statement

Design an Email Campaign System that enables businesses to:
- Create and manage email marketing campaigns
- Design and customize email templates
- Manage contact lists and audience segmentation
- Schedule and automate email campaigns
- Deliver millions of emails reliably
- Track campaign performance (opens, clicks, bounces, unsubscribes)
- Conduct A/B testing for campaign optimization
- Ensure compliance with email regulations (CAN-SPAM, GDPR)
- Handle high-volume email delivery with high deliverability rates

### Key Challenges

1. **High Volume Delivery**: Send millions of emails per day reliably
2. **Deliverability**: Maintain high inbox placement rates and avoid spam filters
3. **Personalization**: Support dynamic content and personalization at scale
4. **Real-time Tracking**: Track opens, clicks, and bounces in real-time
5. **Compliance**: Handle unsubscribes, bounces, and regulatory requirements
6. **Rate Limiting**: Respect email service provider limits and avoid throttling
7. **Template Rendering**: Efficiently render personalized templates for millions of recipients

---

## Requirements

### Functional Requirements

1. **Campaign Management**
   - Create, edit, and delete email campaigns
   - Schedule campaigns for future delivery
   - Pause, resume, and cancel active campaigns
   - Duplicate existing campaigns
   - Support recurring campaigns (daily, weekly, monthly)

2. **Template Management**
   - Create and edit email templates
   - Support HTML and plain text formats
   - Template versioning and history
   - Responsive design templates
   - Dynamic content and personalization variables
   - Template preview and testing

3. **Contact Management**
   - Import contacts (CSV, API)
   - Create and manage contact lists/segments
   - Contact deduplication
   - Contact tags and custom fields
   - Unsubscribe management
   - Bounce and complaint handling

4. **Audience Segmentation**
   - Segment contacts based on attributes (demographics, behavior, tags)
   - Dynamic segmentation (real-time updates)
   - Segment preview and size estimation
   - Exclude segments from campaigns

5. **Email Delivery**
   - Send emails via multiple email service providers (SMTP, AWS SES, SendGrid, Mailgun)
   - Support transactional and marketing emails
   - Handle email attachments
   - Support email priority levels
   - Retry failed deliveries with exponential backoff

6. **Tracking & Analytics**
   - Track email opens (pixel tracking)
   - Track link clicks (link wrapping)
   - Track bounces (hard and soft bounces)
   - Track unsubscribes
   - Track spam complaints
   - Real-time campaign statistics dashboard
   - Historical analytics and reporting

7. **A/B Testing**
   - Test subject lines, content, send times
   - Automatic winner selection
   - Statistical significance calculation
   - Support multiple variants (A/B/C testing)

8. **Automation**
   - Triggered emails (welcome, abandoned cart, etc.)
   - Drip campaigns (multi-email sequences)
   - Event-based automation
   - Conditional logic in automation flows

9. **Compliance**
   - Unsubscribe links in every email
   - Preference center for subscribers
   - Handle bounce management (suppress hard bounces)
   - GDPR compliance (right to be forgotten, consent management)
   - CAN-SPAM compliance

### Non-Functional Requirements

1. **Scalability**: Support 100 million contacts, 10 million emails per day
2. **Availability**: 99.9% uptime
3. **Performance**:
   - Campaign creation: < 2 seconds
   - Template rendering: < 100ms per email
   - Email delivery: < 5 seconds from send request to queued
   - Analytics queries: < 1 second
4. **Reliability**: No email loss, handle failures gracefully
5. **Deliverability**: Maintain > 95% inbox delivery rate
6. **Consistency**: Strong consistency for critical operations (unsubscribes, bounces)
7. **Throughput**: Process 100,000 emails per minute

---

## Capacity Estimation

### Traffic Estimates

- **Total contacts**: 100 million
- **Active campaigns**: 10,000 concurrent campaigns
- **Emails per day**: 10 million
- **Peak sending rate**: 100,000 emails per minute (1,667 emails/second)
- **Read-to-write ratio**: 10:1 (analytics reads vs. email sends)
- **Template renders per day**: 10 million
- **Tracking events per day**: 
  - Opens: 2 million (20% open rate)
  - Clicks: 500,000 (5% click rate)
  - Bounces: 100,000 (1% bounce rate)
  - Unsubscribes: 10,000 (0.1% unsubscribe rate)
  - Total tracking events: ~2.6 million per day

### Storage Estimates

**Campaign Data:**
- Campaign metadata: ~5 KB per campaign
- 10,000 active campaigns × 5 KB = 50 MB
- Historical campaigns (1 year): 100,000 campaigns × 5 KB = 500 MB

**Email Templates:**
- Average template size: ~50 KB (HTML + assets)
- 10,000 templates × 50 KB = 500 MB
- Template versions: 50,000 versions × 50 KB = 2.5 GB
- Total: ~3 GB

**Contact Data:**
- Contact record: ~1 KB (name, email, custom fields, tags)
- 100M contacts × 1 KB = 100 GB
- With 3x replication: 300 GB

**Email Delivery Logs:**
- Delivery log entry: ~500 bytes (campaign_id, contact_id, status, timestamp)
- 10M emails/day × 500 bytes = 5 GB/day
- 1 year retention: 5 GB × 365 = 1.8 TB
- With 3x replication: 5.4 TB

**Tracking Events:**
- Tracking event: ~200 bytes (event_type, email_id, timestamp, metadata)
- 2.6M events/day × 200 bytes = 520 MB/day
- 1 year retention: 520 MB × 365 = 190 GB
- With 3x replication: 570 GB

**Total Storage: ~6.3 TB (with replication and 1 year retention)**

### Bandwidth Estimates

**Outbound (Email Delivery):**
- Average email size: 50 KB (including HTML and images)
- 10M emails/day × 50 KB = 500 GB/day
- Peak: 100K emails/min × 50 KB = 5 GB/min = 300 GB/hour

**Inbound (Tracking Events):**
- Tracking pixel requests: 2M opens/day × 1 KB = 2 GB/day
- Click tracking redirects: 500K clicks/day × 2 KB = 1 GB/day
- Total inbound: ~3 GB/day

### Conclusions

- **1,667 emails/second at peak is more than one provider can absorb reliably.** No single SMTP account or SES rate limit is built to take that alone, which is why the design spreads sends across AWS SES, SendGrid, and Mailgun instead of depending on one provider (see Provider Load Balancing).
- **Delivery logs and tracking events account for 5.4 TB and 570 GB of the 6.3 TB total storage, while campaign and template data stays under 4 GB combined.** That lopsided ratio is why `email_events` gets monthly partitioning and archival treatment (Data Partitioning) while campaigns and templates need none.
- **The 10:1 read-to-write ratio on analytics means the system fields far more "how is this campaign doing" queries than "send this email" commands.** That's the justification for caching campaign stats aggressively (Caching Strategy) rather than spending more effort optimizing the already-light write path.
- **500 GB/day of outbound traffic, peaking at 300 GB/hour, is driven almost entirely by images embedded in a 50 KB average email.** Serving those images from a CDN instead of inlining them keeps the actual SMTP/API payload small, which is what keeps per-email send latency low even at peak volume.

---

## System APIs

### Campaign Management APIs

```python
# Create a new campaign
POST /api/v1/campaigns
Request Body:
{
  "name": "Summer Sale 2024",
  "subject": "50% Off Summer Collection",
  "template_id": "template_123",
  "sender_email": "marketing@example.com",
  "sender_name": "Example Store",
  "contact_list_ids": ["list_1", "list_2"],
  "schedule_time": "2024-07-01T10:00:00Z",
  "ab_test_config": {
    "enabled": true,
    "variants": [
      {"subject": "50% Off Summer", "weight": 50},
      {"subject": "Summer Sale - Save 50%", "weight": 50}
    ],
    "test_duration_hours": 2
  }
}
Response: { "campaign_id": "campaign_456", "status": "scheduled" }

# Get campaign details
GET /api/v1/campaigns/{campaign_id}
Response: {
  "campaign_id": "campaign_456",
  "name": "Summer Sale 2024",
  "status": "scheduled",
  "total_recipients": 100000,
  "sent_count": 0,
  "delivered_count": 0,
  "opened_count": 0,
  "clicked_count": 0,
  "bounced_count": 0,
  "unsubscribed_count": 0
}

# Update campaign
PUT /api/v1/campaigns/{campaign_id}
Request Body: { "name": "Updated Campaign Name" }

# Delete campaign
DELETE /api/v1/campaigns/{campaign_id}

# Send campaign immediately
POST /api/v1/campaigns/{campaign_id}/send

# Pause campaign
POST /api/v1/campaigns/{campaign_id}/pause

# Resume campaign
POST /api/v1/campaigns/{campaign_id}/resume
```

### Template Management APIs

```python
# Create template
POST /api/v1/templates
Request Body: {
  "name": "Welcome Email",
  "subject": "Welcome to {{company_name}}!",
  "html_content": "<html>...</html>",
  "text_content": "Plain text version",
  "variables": ["company_name", "user_name"]
}
Response: { "template_id": "template_123" }

# Get template
GET /api/v1/templates/{template_id}

# Update template
PUT /api/v1/templates/{template_id}

# Delete template
DELETE /api/v1/templates/{template_id}

# Preview template with sample data
POST /api/v1/templates/{template_id}/preview
Request Body: {
  "variables": {
    "company_name": "Example Corp",
    "user_name": "John Doe"
  }
}
Response: { "html": "...", "text": "..." }
```

### Contact Management APIs

```python
# Create contact
POST /api/v1/contacts
Request Body: {
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "tags": ["vip", "newsletter"],
  "custom_fields": {"age": 30, "city": "NYC"}
}
Response: { "contact_id": "contact_789" }

# Bulk import contacts
POST /api/v1/contacts/import
Request Body: {
  "list_id": "list_1",
  "contacts": [
    {"email": "user1@example.com", "first_name": "John"},
    {"email": "user2@example.com", "first_name": "Jane"}
  ]
}
Response: { "import_id": "import_123", "status": "processing" }

# Get contact
GET /api/v1/contacts/{contact_id}

# Update contact
PUT /api/v1/contacts/{contact_id}

# Delete contact
DELETE /api/v1/contacts/{contact_id}

# Unsubscribe contact
POST /api/v1/contacts/{contact_id}/unsubscribe
Request Body: { "reason": "no_longer_interested" }
```

### List/Segment Management APIs

```python
# Create list
POST /api/v1/lists
Request Body: {
  "name": "VIP Customers",
  "description": "Customers with purchase > $1000"
}
Response: { "list_id": "list_1" }

# Create dynamic segment
POST /api/v1/segments
Request Body: {
  "name": "Active Users",
  "conditions": {
    "and": [
      {"field": "last_purchase_date", "operator": ">", "value": "2024-01-01"},
      {"field": "tags", "operator": "contains", "value": "active"}
    ]
  }
}
Response: { "segment_id": "segment_1" }

# Get list/segment contacts
GET /api/v1/lists/{list_id}/contacts?page=1&page_size=100

# Add contacts to list
POST /api/v1/lists/{list_id}/contacts
Request Body: { "contact_ids": ["contact_1", "contact_2"] }

# Remove contacts from list
DELETE /api/v1/lists/{list_id}/contacts
Request Body: { "contact_ids": ["contact_1"] }
```

### Analytics APIs

```python
# Get campaign analytics
GET /api/v1/campaigns/{campaign_id}/analytics
Response: {
  "campaign_id": "campaign_456",
  "sent": 100000,
  "delivered": 98000,
  "opened": 19600,
  "clicked": 4900,
  "bounced": 2000,
  "unsubscribed": 100,
  "open_rate": 20.0,
  "click_rate": 5.0,
  "bounce_rate": 2.0,
  "unsubscribe_rate": 0.1,
  "deliverability_rate": 98.0
}

# Get real-time campaign stats
GET /api/v1/campaigns/{campaign_id}/stats/realtime

# Get contact engagement history
GET /api/v1/contacts/{contact_id}/engagement
Response: {
  "contact_id": "contact_789",
  "total_emails_sent": 50,
  "total_opens": 30,
  "total_clicks": 10,
  "last_opened": "2024-06-15T10:30:00Z",
  "last_clicked": "2024-06-15T11:00:00Z"
}
```

### Webhook APIs

```python
# Register webhook
POST /api/v1/webhooks
Request Body: {
  "url": "https://example.com/webhook",
  "events": ["email.opened", "email.clicked", "email.bounced"]
}
Response: { "webhook_id": "webhook_123" }

# Unsubscribe endpoint (public)
POST /api/v1/public/unsubscribe
Request Body: {
  "email": "user@example.com",
  "campaign_id": "campaign_456",
  "token": "unsubscribe_token"
}
```

---

## Database Design

### Core Tables

#### campaigns
```sql
CREATE TABLE campaigns (
  campaign_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  template_id VARCHAR(50) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(255),
  status ENUM('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled') NOT NULL,
  schedule_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  total_recipients INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  unsubscribed_count INT DEFAULT 0,
  ab_test_config JSON,
  INDEX idx_status (status),
  INDEX idx_schedule_time (schedule_time),
  INDEX idx_created_at (created_at)
);
```

#### templates
```sql
CREATE TABLE templates (
  template_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  html_content TEXT NOT NULL,
  text_content TEXT,
  variables JSON, -- List of available variables
  version INT DEFAULT 1,
  parent_template_id VARCHAR(50), -- For versioning
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_created_by (created_by),
  INDEX idx_is_active (is_active)
);
```

#### contacts
```sql
CREATE TABLE contacts (
  contact_id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  status ENUM('active', 'unsubscribed', 'bounced', 'complained') DEFAULT 'active',
  unsubscribe_reason VARCHAR(255),
  subscribed_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  custom_fields JSON, -- Flexible custom fields
  INDEX idx_email (email),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### contact_lists
```sql
CREATE TABLE contact_lists (
  list_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('static', 'dynamic') DEFAULT 'static',
  segment_conditions JSON, -- For dynamic lists
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  contact_count INT DEFAULT 0,
  INDEX idx_type (type)
);
```

#### list_contacts (Many-to-Many)
```sql
CREATE TABLE list_contacts (
  list_id VARCHAR(50) NOT NULL,
  contact_id VARCHAR(50) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, contact_id),
  INDEX idx_contact_id (contact_id),
  FOREIGN KEY (list_id) REFERENCES contact_lists(list_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE
);
```

#### campaign_contacts (Email Delivery Queue)
```sql
CREATE TABLE campaign_contacts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id VARCHAR(50) NOT NULL,
  contact_id VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced') DEFAULT 'pending',
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_status (campaign_id, status),
  INDEX idx_scheduled_at (scheduled_at),
  INDEX idx_contact_id (contact_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE
);
```

#### email_events (Tracking Events)
```sql
CREATE TABLE email_events (
  event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id VARCHAR(50) NOT NULL,
  contact_id VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  event_type ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained') NOT NULL,
  event_data JSON, -- Additional event metadata (link URL for clicks, bounce reason, etc.)
  ip_address VARCHAR(45),
  user_agent TEXT,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_event (campaign_id, event_type),
  INDEX idx_contact_id (contact_id),
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_email (email)
) PARTITION BY RANGE (UNIX_TIMESTAMP(occurred_at)) (
  PARTITION p2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p2024_02 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  -- ... monthly partitions
);
```

#### tags
```sql
CREATE TABLE tags (
  tag_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7), -- Hex color code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### contact_tags (Many-to-Many)
```sql
CREATE TABLE contact_tags (
  contact_id VARCHAR(50) NOT NULL,
  tag_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contact_id, tag_id),
  INDEX idx_tag_id (tag_id),
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(tag_id) ON DELETE CASCADE
);
```

#### email_providers
```sql
CREATE TABLE email_providers (
  provider_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL, -- 'aws_ses', 'sendgrid', 'mailgun', 'smtp'
  type ENUM('smtp', 'api') NOT NULL,
  config JSON NOT NULL, -- Provider-specific configuration
  rate_limit_per_second INT,
  daily_limit INT,
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0, -- For load balancing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### ab_test_results
```sql
CREATE TABLE ab_test_results (
  test_id VARCHAR(50) PRIMARY KEY,
  campaign_id VARCHAR(50) NOT NULL,
  variant_name VARCHAR(50) NOT NULL,
  recipients INT DEFAULT 0,
  sent INT DEFAULT 0,
  delivered INT DEFAULT 0,
  opened INT DEFAULT 0,
  clicked INT DEFAULT 0,
  open_rate DECIMAL(5,2),
  click_rate DECIMAL(5,2),
  is_winner BOOLEAN DEFAULT FALSE,
  statistical_significance DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_campaign_id (campaign_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
);
```

---

## High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
│              (Web Dashboard, Mobile App, API Clients)            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Load Balancer                 │
│                    (Rate Limiting, Authentication)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Campaign   │    │   Template   │    │   Contact    │
│   Service    │    │   Service    │    │   Service    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                    │
       └───────────────────┼────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Campaign Orchestrator │
              │   (Scheduler, Queue)    │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Email Renderer       │
              │   (Template Engine)    │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Email Delivery       │
              │   Service              │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   AWS SES    │  │  SendGrid    │  │   Mailgun    │
│   Provider   │  │  Provider    │  │   Provider   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Internet   │
                    │   (SMTP)     │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Recipients │
                    │   (Opens,    │
                    │    Clicks)   │
                    └──────┬───────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Tracking Service     │
              │   (Pixel, Link Wrap)   │
              └────────────┬────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Analytics Service    │
              │   (Aggregation, Stats) │
              └────────────┬────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MySQL      │  │   Redis      │  │   ClickHouse │
│   (Primary)  │  │   (Cache)    │  │   (Analytics)│
└──────────────┘  └──────────────┘  └──────────────┘
```

### Key Components

1. **API Gateway**: Handles authentication, rate limiting, request routing. Putting these concerns in front of every other service means auth and throttling logic is written once, instead of being duplicated inside the Campaign, Template, and Contact services.
2. **Campaign Service**: Manages campaign CRUD operations. It owns the campaign's status lifecycle (draft → scheduled → sending → paused/cancelled → sent), which is a separate concern from how templates render or how contacts are stored.
3. **Template Service**: Handles template management and versioning. Keeping it separate lets one template be edited and reused across many campaigns without campaign logic having to know anything about HTML or variable syntax.
4. **Contact Service**: Manages contacts, lists, and segmentation. Isolating it behind its own service lets the 100-million-row contact table be sharded and scaled on its own, without campaign or template code needing to change.
5. **Campaign Orchestrator**: Schedules campaigns and manages delivery queue. This is the component that turns one campaign into millions of individual send jobs, so retry, throttling, and ordering logic lives in one place rather than scattered across the Campaign Service.
6. **Email Renderer**: Renders templates with personalization. Rendering is CPU-bound while delivery is I/O-bound (waiting on provider APIs), so running them as separate services lets each scale on the resource it actually needs.
7. **Email Delivery Service**: Handles actual email sending via providers. If a provider throttles or goes down, this is the only component that has to react — the Orchestrator and Renderer keep running unaffected.
8. **Tracking Service**: Tracks opens, clicks, bounces. It has to answer pixel and redirect requests in milliseconds, so it's kept lightweight and separate from the heavier aggregation work the Analytics Service does.
9. **Analytics Service**: Aggregates and provides analytics data. Separating it from Tracking Service means a slow aggregation query never blocks a tracking pixel from being logged — the two have very different latency requirements on the same underlying events.

---

## Component Design

### 1. Campaign Service

Pausing a campaign mid-send has to take effect before more emails go out, and a scheduled campaign has to transition to "sending" exactly once. Keeping that status lifecycle in one service means every other component treats campaign status as a single source of truth to read, instead of implementing its own pause/cancel logic.

**Responsibilities:**
- Create, update, delete campaigns
- Validate campaign data
- Manage campaign status lifecycle
- Coordinate with other services

**Key Operations:**
```python
class CampaignService:
    def create_campaign(self, campaign_data):
        # Validate template exists
        # Validate contact lists exist
        # Create campaign record
        # Schedule if scheduled_time is set
        pass
    
    def send_campaign(self, campaign_id):
        # Get campaign details
        # Get recipient list
        # Create campaign_contacts entries
        # Trigger email delivery
        pass
    
    def get_campaign_analytics(self, campaign_id):
        # Aggregate stats from email_events
        # Return comprehensive analytics
        pass
```

### 2. Template Service

Templates outlive any single campaign — the same "Welcome Email" template gets reused and edited across dozens of sends. Versioning lives here rather than inside campaign records so a template can be updated for next month's send without touching the historical record of which version last month's campaign actually used.

**Responsibilities:**
- Template CRUD operations
- Template versioning
- Variable extraction and validation
- Template preview

**Key Operations:**
```python
class TemplateService:
    def create_template(self, template_data):
        # Validate HTML content
        # Extract variables from template
        # Store template
        pass
    
    def render_template(self, template_id, variables):
        # Load template
        # Replace variables
        # Return rendered HTML/text
        pass
    
    def validate_variables(self, template_id, variables):
        # Check all required variables are provided
        pass
```

### 3. Contact Service

Contact data is both the largest dataset in the system (100 million rows) and the one most exposed to messy user input (CSV imports, API writes from many sources). Centralizing deduplication and validation here means every import path enforces the same rules, instead of each caller re-implementing its own duplicate-checking logic.

**Responsibilities:**
- Contact CRUD operations
- List/segment management
- Contact deduplication
- Unsubscribe handling

**Key Operations:**
```python
class ContactService:
    def create_contact(self, contact_data):
        # Validate email format
        # Check for duplicates
        # Create contact record
        pass
    
    def import_contacts(self, list_id, contacts):
        # Batch insert contacts
        # Handle duplicates
        # Add to list
        pass
    
    def get_segment_contacts(self, segment_id):
        # Evaluate segment conditions
        # Return matching contacts
        pass
    
    def unsubscribe_contact(self, contact_id, reason):
        # Update contact status
        # Log unsubscribe event
        # Remove from active lists
        pass
```

### 4. Campaign Orchestrator

This is the component that turns one campaign record into millions of individual send jobs. Separating it from the Campaign Service means retrying a failed batch, re-ordering the queue, or throttling send rate is handled in one place as a queue-management problem, rather than logic bolted onto campaign CRUD code.

**Responsibilities:**
- Schedule campaign execution
- Manage delivery queue
- Coordinate email rendering and delivery
- Handle campaign status updates

**Architecture:**
```
Scheduler → Queue Manager → Email Renderer → Delivery Service
```

**Key Operations:**
```python
class CampaignOrchestrator:
    def schedule_campaign(self, campaign_id, schedule_time):
        # Add to scheduler
        pass
    
    def execute_campaign(self, campaign_id):
        # Get campaign and recipients
        # For each recipient:
        #   - Render email
        #   - Queue for delivery
        pass
    
    def process_delivery_queue(self):
        # Poll queue for pending emails
        # Batch process
        # Send via delivery service
        pass
```

### 5. Email Renderer

Rendering is CPU-bound work (parsing templates, substituting variables, injecting tracking pixels), while delivery is I/O-bound work (waiting on a provider's API). Splitting them into separate services means more renderer instances can be added when templates are complex, and more delivery workers can be added when a provider is slow, without over-provisioning the one that isn't the bottleneck.

**Responsibilities:**
- Render templates with personalization
- Handle variable substitution
- Generate both HTML and text versions
- Cache rendered templates

**Key Operations:**
```python
class EmailRenderer:
    def render_email(self, template_id, contact_id, campaign_id):
        # Load template
        # Load contact data
        # Load campaign data
        # Replace variables
        # Add tracking pixels and links
        # Return rendered email
        pass
    
    def add_tracking(self, html_content, campaign_id, contact_id):
        # Add open tracking pixel
        # Wrap links with click tracking
        pass
```

### 6. Email Delivery Service

AWS SES, SendGrid, and Mailgun each have different rate limits and uptime characteristics, so provider selection, rate-limit checks, and retries are isolated in this one service. If SES throttles or goes down, this is the only component that needs to react — it can fail over to SendGrid without the Orchestrator or Renderer having to know anything changed.

**Responsibilities:**
- Send emails via multiple providers
- Handle provider rate limits
- Retry failed deliveries
- Load balance across providers

**Key Operations:**
```python
class EmailDeliveryService:
    def send_email(self, email_data):
        # Select provider (round-robin or based on load)
        # Check provider rate limits
        # Send via provider
        # Handle errors and retries
        pass
    
    def handle_bounce(self, email, bounce_type, reason):
        # Update contact status
        # Log bounce event
        # Suppress hard bounces
        pass
```

### 7. Tracking Service

A single campaign can generate tens of thousands of pixel loads and link clicks within minutes of sending, and each one needs a fast response (a 1x1 GIF or a redirect) so it doesn't slow down the recipient's experience. Keeping this service lightweight and separate from Analytics means that write-heavy, low-latency traffic never has to wait behind slower aggregation queries running against the same underlying events.

**Responsibilities:**
- Track email opens (pixel tracking)
- Track link clicks (link wrapping)
- Handle unsubscribe requests
- Log tracking events

**Key Operations:**
```python
class TrackingService:
    def track_open(self, campaign_id, contact_id, request_data):
        # Verify tracking token
        # Log open event
        # Update campaign stats
        pass
    
    def track_click(self, campaign_id, contact_id, link_url, request_data):
        # Verify tracking token
        # Log click event
        # Redirect to original URL
        pass
    
    def handle_unsubscribe(self, token):
        # Verify token
        # Unsubscribe contact
        # Return confirmation page
        pass
```

### 8. Analytics Service

Aggregation queries — open rate, click rate over a date range — are read-heavy and can tolerate being a few minutes stale, the opposite profile of the Tracking Service's write-heavy, millisecond-latency needs. Separating the two means a slow analytics report never blocks a tracking pixel from being logged.

**Responsibilities:**
- Aggregate tracking events
- Calculate campaign metrics
- Generate reports
- Real-time dashboard updates

**Key Operations:**
```python
class AnalyticsService:
    def get_campaign_stats(self, campaign_id):
        # Aggregate events from email_events table
        # Calculate rates
        # Return comprehensive stats
        pass
    
    def get_realtime_stats(self, campaign_id):
        # Query recent events
        # Return current stats
        pass
    
    def generate_report(self, campaign_id, date_range):
        # Aggregate events by time period
        # Generate detailed report
        pass
```

---

## Email Delivery Pipeline

### Delivery Flow

```
1. Campaign Scheduled/Triggered
   ↓
2. Campaign Orchestrator fetches recipients
   ↓
3. For each recipient:
   a. Email Renderer renders personalized email
   b. Add tracking pixels and wrap links
   c. Queue email for delivery
   ↓
4. Delivery Service processes queue
   ↓
5. Select email provider (load balancing)
   ↓
6. Check provider rate limits
   ↓
7. Send email via provider API/SMTP
   ↓
8. Update delivery status
   ↓
9. Handle bounces/failures (retry logic)
```

### Queue Management

Rendering and delivery don't run at the same speed — a campaign can render a million personalized emails in seconds, but a provider might only accept a few thousand sends per second before rate-limiting kicks in. A message queue absorbs that mismatch: the renderer and tracking producers write as fast as they can, while delivery workers and aggregation jobs drain the queue only as fast as providers and the database can actually sustain, instead of one slow stage blocking the other.

**Use Message Queue (RabbitMQ/Kafka) for:**
- Email delivery queue
- Tracking event processing
- Analytics aggregation jobs

**Queue Structure:**
```
email_delivery_queue:
  - campaign_id
  - contact_id
  - rendered_email (HTML + text)
  - priority
  - retry_count

tracking_events_queue:
  - event_type
  - campaign_id
  - contact_id
  - event_data
  - timestamp
```

### Retry Logic

Not every failure deserves the same response. A `RateLimitError` means the provider is otherwise healthy but needs the sender to slow down, so retrying immediately would only make things worse — exponential backoff (1s, 2s, 4s between attempts) gives the provider's limit window time to reset. A `TransientError` (a timeout or a brief network blip) is usually gone by the next attempt, so the same backoff applies. A `PermanentError` (an invalid address, a hard bounce) will never succeed no matter how many times it's retried, so the code gives up immediately and marks the contact bounced instead of burning retries and delaying everything else behind it in the queue.

```python
def send_with_retry(email_data, max_retries=3):
    for attempt in range(max_retries):
        try:
            result = email_provider.send(email_data)
            if result.success:
                return result
        except RateLimitError:
            wait_time = 2 ** attempt  # Exponential backoff
            sleep(wait_time)
        except TransientError:
            wait_time = 2 ** attempt
            sleep(wait_time)
        except PermanentError:
            # Mark as bounced, don't retry
            mark_as_bounced(email_data)
            return
    
    # All retries failed
    mark_as_failed(email_data)
```

### Provider Load Balancing

**Strategies:**
1. **Round-Robin**: Distribute evenly across providers
2. **Weighted**: Based on provider capacity and reliability
3. **Least Loaded**: Send to provider with lowest current load
4. **Provider Priority**: Use primary provider, fallback to others

Round-robin is the simplest option, but it assumes every provider has the same capacity, which they don't — AWS SES, SendGrid, and Mailgun each have their own rate limits. Weighted distribution fixes that by routing proportionally more volume to whichever provider can actually handle more. Least Loaded reacts to real-time conditions, which matters when one provider is degraded but not fully down. Provider Priority is the right call when one provider is simply cheaper or more reliable day-to-day, and the others exist only as a fallback if it fails.

```python
class ProviderLoadBalancer:
    def select_provider(self):
        # Get active providers
        # Check current load
        # Select based on strategy
        # Return provider
        pass
    
    def update_provider_stats(self, provider_id, success, latency):
        # Update provider metrics
        # Adjust weights if needed
        pass
```

---

## Template Engine

### Variable System

**Supported Variables:**
- Contact variables: `{{contact.first_name}}`, `{{contact.email}}`
- Campaign variables: `{{campaign.name}}`, `{{campaign.subject}}`
- Custom fields: `{{contact.custom_fields.city}}`
- Conditional logic: `{% if contact.tags contains 'vip' %}...{% endif %}`

### Template Rendering Process

Parsing a template's variable syntax and conditionals from scratch on every single send would repeat the same structural work up to 10 million times a day for what's often a handful of distinct templates. Validating that all required variables are present before substitution also catches a broken campaign early — a template expecting `{{contact.first_name}}` for a contact missing that field fails here, before 100,000 personalized emails go out with blank or broken content.

```python
def render_template(template, context):
    # 1. Parse template
    # 2. Extract variables
    # 3. Validate all variables are provided
    # 4. Replace variables
    # 5. Process conditionals
    # 6. Return rendered HTML/text
    pass
```

### Caching Strategy

Rendering produces an identical result for every contact in the same segment who only differs by a name substitution, so caching by segment means that work is done once instead of once per recipient — a meaningful saving when a single campaign's segment can be sent to hundreds of thousands of contacts. The cache has to be invalidated on template or contact-data changes specifically because a stale cached render would otherwise silently send outdated content to everyone who hits that cache key.

- Cache rendered templates per contact segment
- Invalidate cache when template or contact data changes
- Use Redis for template caching

```python
def get_cached_template(template_id, contact_segment):
    cache_key = f"template:{template_id}:segment:{contact_segment}"
    cached = redis.get(cache_key)
    if cached:
        return cached
    # Render and cache
    rendered = render_template(template_id, contact_segment)
    redis.setex(cache_key, 3600, rendered)  # 1 hour TTL
    return rendered
```

---

## A/B Testing

### A/B Test Flow

```
1. Create campaign with A/B test config
   ↓
2. Split recipients into variants (50/50, 33/33/33, etc.)
   ↓
3. Send variants to different groups
   ↓
4. Track performance metrics for each variant
   ↓
5. After test duration, determine winner
   ↓
6. Send remaining recipients winner variant
```

Only a slice of the recipient list sees the test variants at first — sending every recipient a variant that turns out to perform worse would cost more opens and clicks than the test could ever recover, so the larger remaining segment only goes out once a winner is reasonably confident, within the `test_duration_hours` window set on the campaign.

### Winner Selection

**Metrics for Winner:**
- Open rate (primary)
- Click rate (secondary)
- Conversion rate (if tracked)

**Statistical Significance:**
- Use chi-square test or t-test
- Minimum sample size per variant
- Confidence level: 95%

Comparing open rates directly can be misleading on small samples — if Variant A gets 22% opens out of 50 sends and Variant B gets 18% out of 50, that four-point gap could easily be noise rather than a real difference in which subject line performs better. A chi-square or t-test checks whether the gap is large enough, given the sample size, to be unlikely by chance alone. A 95% confidence level means the system only calls a winner when there's at most a 5% chance the apparently better variant just got lucky — which is also why a minimum sample size per variant matters: declaring a winner too early risks locking in the wrong variant for every recipient still left to send to.

```python
def determine_winner(variants, metric='open_rate'):
    # Calculate metric for each variant
    # Perform statistical test
    # Return winner if significant, else None
    pass
```

### Implementation

```python
class ABTestManager:
    def split_recipients(self, recipients, variants):
        # Randomly assign recipients to variants
        # Ensure equal distribution
        pass
    
    def evaluate_test(self, campaign_id):
        # Get results for all variants
        # Calculate statistical significance
        # Determine winner
        # Send remaining emails with winner
        pass
```

---

## Analytics & Tracking

### Open Tracking

**Implementation:**
1. Add 1x1 transparent pixel to email HTML
2. Pixel URL: `https://track.example.com/open?c={campaign_id}&t={token}`
3. When pixel loads, log open event
4. Return 1x1 transparent GIF

```html
<img src="https://track.example.com/open?c=campaign_123&t=token_abc" 
     width="1" height="1" style="display:none" />
```

### Click Tracking

**Implementation:**
1. Wrap all links in email with tracking URL
2. Tracking URL: `https://track.example.com/click?c={campaign_id}&t={token}&url={encoded_url}`
3. When clicked, log click event
4. Redirect to original URL (HTTP 302)

```python
def wrap_link(original_url, campaign_id, contact_id):
    token = generate_tracking_token(campaign_id, contact_id)
    encoded_url = urllib.parse.quote(original_url)
    return f"https://track.example.com/click?c={campaign_id}&t={token}&url={encoded_url}"
```

### Event Processing

**Real-time Processing:**
- Use message queue for tracking events
- Process events asynchronously
- Update campaign stats in real-time

**Batch Processing:**
- Aggregate events hourly/daily
- Update analytics tables
- Generate reports

### Analytics Aggregation

**Metrics Calculated:**
- Open rate: (opens / delivered) × 100
- Click rate: (clicks / delivered) × 100
- Click-to-open rate: (clicks / opens) × 100
- Bounce rate: (bounces / sent) × 100
- Unsubscribe rate: (unsubscribes / delivered) × 100
- Deliverability rate: (delivered / sent) × 100

**Storage:**
- Real-time stats: Redis (for fast access)
- Historical data: ClickHouse or TimescaleDB (for time-series analytics)
- Aggregated reports: MySQL (for dashboard queries)

---

## Data Partitioning

### Partitioning Strategy

**email_events Table:**
- Partition by `occurred_at` (monthly partitions)
- Enables efficient time-range queries
- Easy to archive old data

```sql
PARTITION BY RANGE (UNIX_TIMESTAMP(occurred_at)) (
  PARTITION p2024_01 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
  PARTITION p2024_02 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
  ...
);
```

**campaign_contacts Table:**
- Shard by `campaign_id` (hash-based sharding)
- Distribute load across multiple databases
- Each shard handles subset of campaigns

**contacts Table:**
- Shard by `email` hash (consistent hashing)
- Distribute contacts across shards
- Enables horizontal scaling

### Sharding Strategy

**Consistent Hashing:**
- Use email hash to determine shard
- Add/remove shards without full rebalancing
- Replicate each shard for availability

---

## Caching Strategy

### Cache Layers

The five TTLs below aren't arbitrary — each one reflects how costly stale data would be for that specific thing. A rendered template barely changes within an hour, so it gets a long TTL; provider health can flip from healthy to rate-limited within seconds, so its cache (below) gets a TTL of just one minute. Getting this wrong in either direction either serves stale data for too long or re-computes expensive work (a template render, a segment query) far more often than necessary.

**1. Template Cache (Redis)**
- Cache rendered templates
- Key: `template:{template_id}:segment:{segment_hash}`
- TTL: 1 hour
- Invalidate on template update

**2. Contact Data Cache (Redis)**
- Cache frequently accessed contact data
- Key: `contact:{contact_id}`
- TTL: 15 minutes
- Invalidate on contact update

**3. Campaign Stats Cache (Redis)**
- Cache campaign analytics
- Key: `campaign:stats:{campaign_id}`
- TTL: 5 minutes
- Update on new events

**4. List/Segment Cache (Redis)**
- Cache segment contact lists
- Key: `segment:contacts:{segment_id}`
- TTL: 30 minutes
- Invalidate on list update

**5. Provider Stats Cache (Redis)**
- Cache provider load and health
- Key: `provider:stats:{provider_id}`
- TTL: 1 minute
- Real-time updates

### Cache Invalidation

```python
def invalidate_template_cache(template_id):
    # Find all cache keys for this template
    pattern = f"template:{template_id}:*"
    keys = redis.keys(pattern)
    redis.delete(*keys)

def invalidate_contact_cache(contact_id):
    redis.delete(f"contact:{contact_id}")
    # Also invalidate related segment caches
```

---

## Load Balancing

### API Load Balancing

**Strategy:**
- Round-robin or least connections
- Health checks for service instances
- Auto-scaling based on load

**Components:**
- Application Load Balancer (AWS ALB) or NGINX
- Multiple service instances
- Health check endpoints

### Database Load Balancing

**Read Replicas:**
- Primary database for writes
- Multiple read replicas for reads
- Automatic failover

**Connection Pooling:**
- Use connection pooler (PgBouncer, ProxySQL)
- Distribute reads across replicas
- Handle connection limits

---

## Security & Compliance

### Security Measures

1. **Authentication & Authorization**
   - API keys for programmatic access
   - OAuth 2.0 for user authentication
   - Role-based access control (RBAC)

2. **Data Encryption**
   - Encrypt sensitive data at rest
   - TLS/SSL for data in transit
   - Encrypt email content if needed

3. **Rate Limiting**
   - Per-user rate limits
   - Per-IP rate limits
   - Prevent abuse and spam

4. **Input Validation**
   - Sanitize all user inputs
   - Validate email addresses
   - Prevent XSS in templates

5. **Tracking Token Security**
   - Cryptographically secure tokens
   - Token expiration
   - Prevent token guessing

### Compliance

1. **CAN-SPAM Act (US)**
   - Include unsubscribe link in every email
   - Honor unsubscribe requests within 10 days
   - Include physical mailing address
   - Accurate "From" information

2. **GDPR (EU)**
   - Obtain explicit consent before sending
   - Right to access personal data
   - Right to be forgotten (delete contact)
   - Data portability
   - Privacy by design

3. **Unsubscribe Management**
   - One-click unsubscribe
   - Preference center (unsubscribe from specific lists)
   - Global unsubscribe option
   - Suppress unsubscribed contacts automatically

4. **Bounce Management**
   - Hard bounces: Remove immediately
   - Soft bounces: Retry with backoff
   - Suppress hard-bounced emails
   - Monitor bounce rates

5. **Spam Complaint Handling**
   - Track spam complaints
   - Remove complainers immediately
   - Monitor complaint rates
   - Investigate high complaint rates

### Implementation

```python
class ComplianceManager:
    def check_compliance(self, campaign, contact):
        # Check if contact is unsubscribed
        # Check if contact has opted in
        # Check bounce status
        # Return compliance status
        pass
    
    def handle_unsubscribe(self, contact_id, list_id=None):
        # Update contact status
        # Remove from lists
        # Log unsubscribe event
        pass
    
    def handle_bounce(self, email, bounce_type):
        if bounce_type == 'hard':
            # Mark as hard bounce
            # Suppress contact
        else:
            # Retry with backoff
        pass
```

---

## Monitoring & Alerting

### Key Metrics

1. **System Metrics**
   - API response times
   - Error rates
   - Queue depth
   - Database connection pool usage

2. **Campaign Metrics**
   - Emails sent per minute
   - Delivery success rate
   - Bounce rate
   - Open rate
   - Click rate

3. **Provider Metrics**
   - Provider health
   - Provider latency
   - Provider error rates
   - Rate limit usage

4. **Business Metrics**
   - Active campaigns
   - Total contacts
   - Daily email volume
   - Revenue (if applicable)

### Monitoring Tools

- **Application Monitoring**: Datadog, New Relic, Prometheus
- **Log Aggregation**: ELK Stack, Splunk, CloudWatch Logs
- **Error Tracking**: Sentry, Rollbar
- **Uptime Monitoring**: Pingdom, UptimeRobot

### Alerting Rules

1. **High Bounce Rate**: > 5% bounce rate
2. **High Error Rate**: > 1% delivery failures
3. **Queue Backup**: Queue depth > 100,000
4. **Provider Down**: Provider health check fails
5. **Low Deliverability**: < 90% deliverability rate
6. **High Complaint Rate**: > 0.1% spam complaints

### Dashboards

**Operational Dashboard:**
- Real-time email sending rate
- Queue depth
- Provider status
- Error rates

**Campaign Dashboard:**
- Active campaigns
- Campaign performance
- Top performing campaigns
- Campaign trends

**Analytics Dashboard:**
- Overall email metrics
- Engagement trends
- Contact growth
- List performance

---

## Scalability Considerations

### Horizontal Scaling

1. **Stateless Services**: All services are stateless, enable horizontal scaling
2. **Database Sharding**: Shard contacts and campaigns across databases
3. **Queue Workers**: Scale email delivery workers based on queue depth
4. **Caching**: Use distributed cache (Redis Cluster)

### Vertical Scaling

1. **Database Optimization**: Index optimization, query optimization
2. **Connection Pooling**: Efficient connection management
3. **Batch Processing**: Process emails in batches for efficiency

### Performance Optimization

1. **Async Processing**: Use message queues for async operations
2. **Batch Operations**: Batch database writes
3. **Connection Pooling**: Reuse database connections
4. **CDN for Assets**: Serve email images via CDN
5. **Template Caching**: Cache rendered templates

---

## Trade-offs & Design Decisions

### 1. Eventual vs Strong Consistency

**Decision**: Eventual consistency for tracking events, strong consistency for critical operations

**Rationale**:
- Tracking events (opens, clicks) can tolerate slight delays
- Unsubscribes and bounces need strong consistency to prevent sending to invalid contacts
- Improves performance and scalability

Forcing strong consistency onto tracking writes would mean every pixel load and click has to wait for a quorum commit before returning — exactly when a popular campaign is generating the most opens and the write path is under the most load. Eventual consistency lets those writes queue and settle a few seconds later with no visible effect on the recipient, while unsubscribes still commit synchronously because sending to someone who just opted out, even once, is the failure this system can't tolerate.

### 2. Real-time vs Batch Analytics

**Decision**: Hybrid approach - real-time for dashboard, batch for historical reports

**Rationale**:
- Real-time stats for active campaign monitoring
- Batch aggregation for historical analysis and reporting
- Balances performance and accuracy

Running every analytics query — including heavy historical rollups across months of `email_events` — as a live aggregation would mean a dashboard refresh competes for the same database capacity as the tracking pixels and click redirects it's trying to report on. Batching the expensive historical work into scheduled jobs keeps that load off the real-time path, at the cost of historical reports being minutes to hours stale instead of instant.

### 3. Multiple Email Providers

**Decision**: Support multiple providers with load balancing

**Rationale**:
- Redundancy and failover
- Distribute load to avoid rate limits
- Provider-specific optimizations
- Cost optimization

Relying on a single provider ties the system's entire daily sending capacity to that provider's rate limit and uptime — hitting SES's daily send limit or an SES outage would stall the whole delivery queue with no way to keep sending. Spreading volume across SES, SendGrid, and Mailgun means one provider's limit or outage only removes a fraction of total capacity, at the cost of having to build and maintain the Provider Load Balancer that decides where each send goes.

### 4. Template Rendering Strategy

**Decision**: Render on-demand with caching

**Rationale**:
- Personalization requires per-contact rendering
- Cache common segments to improve performance
- Balance between personalization and performance

Pre-rendering every email ahead of time for all 100 million contacts would mean re-rendering all of it whenever a template or a contact's data changes, most of it for recipients who may never open the email. Rendering on demand with segment-level caching avoids that wasted work while still answering most requests from cache rather than re-parsing the template for every single contact.

### 5. Tracking Implementation

**Decision**: Server-side tracking with pixel and link wrapping

**Rationale**:
- More reliable than client-side tracking
- Works across all email clients
- Can track opens even with images disabled (some clients)
- Privacy considerations (transparent pixels)

Client-side tracking (JavaScript embedded in the email) isn't really an option to weigh against this — most email clients strip scripts outright. That's why tracking falls back to a 1x1 pixel and wrapped links: they're the only mechanisms that still work across Gmail, Outlook, and Apple Mail without any client-side code running, even though pixel tracking alone misses opens in clients that block images by default.

---

## Future Enhancements

1. **Advanced Segmentation**: Machine learning-based segmentation
2. **Predictive Analytics**: Predict best send times, content preferences
3. **Dynamic Content**: Real-time content personalization
4. **Multi-channel**: Extend to SMS, push notifications
5. **Advanced A/B Testing**: Multi-variate testing, automatic optimization
6. **Email Automation**: Complex workflow automation
7. **AI-powered Content**: Generate email content using AI
8. **Advanced Analytics**: Cohort analysis, customer journey tracking

---

## Conclusion

This Email Campaign System design provides a scalable, reliable solution for managing and delivering email marketing campaigns at scale. Key highlights:

- **Scalable Architecture**: Handles millions of emails per day
- **High Deliverability**: Multiple providers, bounce management, compliance
- **Real-time Tracking**: Track opens, clicks, bounces in real-time
- **Comprehensive Analytics**: Detailed campaign performance metrics
- **Compliance Ready**: Built-in support for CAN-SPAM, GDPR
- **Flexible & Extensible**: Supports templates, segmentation, A/B testing

The system can be built incrementally, starting with core features (campaign creation, email delivery) and adding advanced features (A/B testing, automation) as needed.

