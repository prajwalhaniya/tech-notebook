---
sidebar_position: 7
---

# Design Invoice Follow-up System

A comprehensive high-level design for building a scalable, production-ready invoice follow-up and accounts receivable management system.

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
9. [Invoice Management Flow](#invoice-management-flow)
10. [Automated Follow-up Engine](#automated-follow-up-engine)
11. [Payment Tracking & Reconciliation](#payment-tracking--reconciliation)
12. [Integration Architecture](#integration-architecture)
13. [Notification System](#notification-system)
14. [Analytics & Reporting](#analytics--reporting)
15. [Security & Compliance](#security--compliance)
16. [Scalability & Performance](#scalability--performance)
17. [Trade-offs & Design Decisions](#trade-offs--design-decisions)

---

## Problem Statement

Design an invoice follow-up system that automates accounts receivable management, sends timely payment reminders, tracks customer payment behavior, and provides actionable insights to improve cash flow.

**Business Context:**
- Late payments cost businesses 25-30% of annual revenue in cash flow delays
- Manual follow-up is time-consuming and inconsistent
- Need to maintain professional customer relationships while ensuring timely payments
- Must integrate with existing accounting and CRM systems

### Key Challenges

1. **Timing Intelligence**: Send reminders at optimal times without annoying customers
2. **Multi-channel Communication**: Email, SMS, WhatsApp, in-app notifications
3. **Payment Reconciliation**: Match payments to invoices across multiple payment gateways
4. **Escalation Management**: Automated dunning workflows based on customer behavior
5. **Scale & Performance**: Handle millions of invoices and daily reminder processing
6. **Compliance**: GDPR, PCI-DSS, SOC 2 compliance requirements

---

## Functional Requirements

### Core Features

**FR1: Invoice Management**
- Create, read, update, delete invoices
- Support multiple invoice formats (standard, recurring, milestone-based)
- Generate PDF invoices with customizable templates
- Track invoice lifecycle: Draft → Sent → Viewed → Overdue → Paid → Disputed
- Support partial payments and payment plans

**FR2: Automated Follow-up**
- Configure follow-up rules per customer or invoice type
- Send automated reminders before due date, on due date, after due date
- Support multiple reminder schedules (gentle, standard, aggressive)
- Escalation workflows: Customer → Manager → Collections Agency
- Pause reminders when customer engages or disputes invoice

**FR3: Payment Tracking**
- Track payment status in real-time
- Support multiple payment methods (bank transfer, credit card, ACH, PayPal, Stripe)
- Automatic payment reconciliation from bank feeds
- Manual payment recording with audit trail
- Handle overpayments, underpayments, and refunds

**FR4: Customer Communication Hub**
- Centralized communication history per customer
- Track all emails, SMS, calls, and notes
- Customer portal for invoice viewing and payment
- Dispute management workflow
- Two-way email threading

**FR5: Multi-tenant Architecture**
- Complete data isolation per organization
- Custom branding per tenant (logo, colors, email templates)
- Tenant-specific configuration (payment terms, reminder schedules)
- Role-based access control (Admin, Accountant, Viewer)

**FR6: Reporting & Analytics**
- Days Sales Outstanding (DSO) tracking
- Aging reports (30, 60, 90, 120+ days)
- Payment behavior analytics per customer
- Cash flow forecasting
- Follow-up effectiveness metrics
- Custom report builder

**FR7: Integration Ecosystem**
- Accounting software sync (QuickBooks, Xero, FreshBooks, NetSuite)
- CRM integration (Salesforce, HubSpot)
- Payment gateway integration (Stripe, PayPal, Square)
- Calendar integration (Google Calendar, Outlook)
- Banking API integration for automatic reconciliation

### Optional Features

**FR8:** AI-powered payment prediction using historical data
**FR9:** WhatsApp Business API integration for follow-ups
**FR10:** Voice call reminders via Twilio
**FR11:** Smart scheduling (avoid weekends, holidays, customer time zones)
**FR12:** Multi-currency support with automatic FX rate updates
**FR13:** Credit management (credit limits, credit holds)
**FR14:** Document management (contracts, purchase orders, receipts)
**FR15:** Collections agency handoff automation

---

## Non-Functional Requirements

### Performance

**NFR1:** High Availability - 99.95% uptime

**NFR2:** Email delivery latency - < 2 minutes from trigger

**NFR3:** Dashboard load time - < 1 second

**NFR4:** Payment reconciliation - Within 5 minutes of bank feed update

**NFR5:** Support 10,000 concurrent users per tenant

### Scalability

**NFR6:** Handle 100 million invoices across all tenants

**NFR7:** Process 10 million reminder emails per day

**NFR8:** Support 50,000 organizations (tenants)

**NFR9:** Horizontal scaling for all services

### Reliability

**NFR10:** Data durability - 99.999999999% (11 9s)

**NFR11:** Zero data loss in payment transactions

**NFR12:** Automatic failover - < 30 seconds

**NFR13:** Point-in-time recovery within 5 minutes

### Security & Compliance

**NFR14:** Encryption at rest and in transit (TLS 1.3, AES-256)

**NFR15:** PCI-DSS Level 1 compliance for payment data

**NFR16:** GDPR compliant with data portability and right to erasure

**NFR17:** SOC 2 Type II certification

**NFR18:** Multi-factor authentication (MFA) for all users

**NFR19:** Audit logging for all financial transactions

### Data Retention

**NFR20:** Invoice data retention - 7 years (configurable per jurisdiction)

**NFR21:** Communication logs - 3 years

**NFR22:** Audit logs - 7 years, immutable

---

## Capacity Estimation

### Traffic Estimates

**Assumptions:**
- 50,000 organizations (tenants)
- Average 2,000 invoices per organization per year
- Total: 100 million active invoices
- Average invoice lifecycle: 45 days
- 30% of invoices require follow-up reminders
- Average 3 reminders per invoice

**Daily Active Invoices:**
- 100M invoices / 365 days * 45-day avg lifecycle = 12.3M active invoices/day

**Daily Reminder Volume:**
- 30% require follow-up = 3.7M invoices need reminders
- Average 3 reminders = 11M reminder checks/day
- Actual reminders sent = ~2M/day (not all checks result in sending)

**API Requests:**
- User dashboard requests: 50K tenants * 100 users * 20 requests/day = 100M requests/day
- Integration sync: 50K tenants * 96 syncs/day (every 15 min) = 4.8M requests/day
- Webhook events: 10M events/day
- **Total: ~115M requests/day = 1,330 requests/second (peak: 6,650 rps @ 5x)**

### Storage Estimates

**Invoice Data:**
- 100M invoices * 10KB avg = 1TB
- PDF storage: 100M * 200KB = 20TB

**Communication Logs:**
- 2M emails/day * 365 days * 3 years = 2.2B emails
- 2.2B * 50KB = 110TB

**Audit Logs:**
- 500M events/day * 1KB = 500GB/day
- 500GB * 365 * 7 years = 1.3PB

**Total Storage: ~1.5PB with 30% growth buffer**

### Bandwidth

**Ingress:**
- API requests: 1,330 rps * 10KB = 13.3 MB/s = 106 Mbps
- File uploads: ~50 Mbps
- **Total Ingress: ~156 Mbps (peak: 780 Mbps)**

**Egress:**
- Email sending: 2M/day * 100KB = 200GB/day = 2.3MB/s = 18.4 Mbps
- PDF generation: 100K/day * 200KB = 20GB/day = 2 Mbps
- Dashboard API: 100M requests * 20KB = 2TB/day = 23MB/s = 184 Mbps
- **Total Egress: ~204 Mbps (peak: 1 Gbps)**

### Cost Estimates (AWS)

**Compute:**
- 50 m5.2xlarge instances (8 vCPU, 32GB) @ $0.384/hr = $460/day = $168K/year

**Database:**
- RDS PostgreSQL Multi-AZ: 5 db.r5.4xlarge = $13,000/month = $156K/year
- DynamoDB: 25TB storage + 1M WCU + 5M RCU = $50K/year

**Storage:**
- S3: 1.5PB * $0.023/GB = $34,500/month = $414K/year
- EBS: 50TB * $0.10/GB = $5K/month = $60K/year

**Network:**
- Data transfer: 6TB/day out * 30 days * $0.09/GB = $16K/month = $192K/year

**Email (SendGrid/SES):**
- 60M emails/month * $0.001 = $60K/month = $720K/year

**Total: ~$1.76M/year (at scale)**

---

## System APIs

### REST API Endpoints

#### Invoice APIs

```http
POST /api/v1/invoices
Content-Type: application/json

{
  "customer_id": "cust_123",
  "invoice_number": "INV-2024-001",
  "issue_date": "2024-01-15",
  "due_date": "2024-02-15",
  "currency": "USD",
  "items": [
    {
      "description": "Professional Services",
      "quantity": 40,
      "unit_price": 150.00,
      "tax_rate": 0.10,
      "amount": 6000.00
    }
  ],
  "subtotal": 6000.00,
  "tax": 600.00,
  "total": 6600.00,
  "payment_terms": "net_30",
  "notes": "Payment due within 30 days"
}

Response 201 Created:
{
  "invoice_id": "inv_abc123",
  "status": "draft",
  "pdf_url": "https://cdn.example.com/invoices/inv_abc123.pdf",
  "created_at": "2024-01-15T10:00:00Z"
}
```

```http
GET /api/v1/invoices/{invoice_id}
GET /api/v1/invoices?status=overdue&customer_id=cust_123
PATCH /api/v1/invoices/{invoice_id}
DELETE /api/v1/invoices/{invoice_id}
POST /api/v1/invoices/{invoice_id}/send
```

#### Follow-up Rules APIs

```http
POST /api/v1/followup-rules
Content-Type: application/json

{
  "name": "Standard Follow-up",
  "enabled": true,
  "apply_to": "all_customers",
  "reminders": [
    {
      "trigger": "days_before_due",
      "days": 7,
      "channels": ["email"],
      "template_id": "tmpl_friendly_reminder"
    },
    {
      "trigger": "on_due_date",
      "days": 0,
      "channels": ["email"],
      "template_id": "tmpl_due_today"
    },
    {
      "trigger": "days_after_due",
      "days": 3,
      "channels": ["email", "sms"],
      "template_id": "tmpl_overdue_gentle"
    },
    {
      "trigger": "days_after_due",
      "days": 14,
      "channels": ["email", "sms"],
      "template_id": "tmpl_overdue_firm"
    },
    {
      "trigger": "days_after_due",
      "days": 30,
      "channels": ["email"],
      "template_id": "tmpl_final_notice",
      "escalate_to": "collections"
    }
  ],
  "exclusions": {
    "skip_weekends": true,
    "skip_holidays": true,
    "quiet_hours": {
      "start": "20:00",
      "end": "08:00"
    }
  }
}
```

```http
GET /api/v1/followup-rules
GET /api/v1/followup-rules/{rule_id}
PATCH /api/v1/followup-rules/{rule_id}
POST /api/v1/followup-rules/{rule_id}/test
```

#### Payment APIs

```http
POST /api/v1/payments
Content-Type: application/json

{
  "invoice_id": "inv_abc123",
  "amount": 6600.00,
  "currency": "USD",
  "payment_method": "bank_transfer",
  "payment_date": "2024-02-10",
  "reference": "REF-123456",
  "notes": "Wire transfer received"
}

Response 201 Created:
{
  "payment_id": "pmt_xyz789",
  "status": "completed",
  "invoice_status": "paid",
  "remaining_balance": 0.00,
  "reconciled_at": "2024-02-10T15:30:00Z"
}
```

```http
POST /api/v1/payments/bulk-reconcile
GET /api/v1/payments?invoice_id=inv_abc123
POST /api/v1/payments/{payment_id}/refund
```

#### Analytics APIs

```http
GET /api/v1/analytics/dso
Response:
{
  "current_dso": 42.5,
  "previous_period_dso": 48.2,
  "change_percentage": -11.8,
  "target_dso": 45.0,
  "trend": "improving"
}

GET /api/v1/analytics/aging
Response:
{
  "total_outstanding": 1250000.00,
  "aging_buckets": {
    "current": { "amount": 450000.00, "percentage": 36 },
    "1-30_days": { "amount": 320000.00, "percentage": 25.6 },
    "31-60_days": { "amount": 250000.00, "percentage": 20 },
    "61-90_days": { "amount": 150000.00, "percentage": 12 },
    "90+_days": { "amount": 80000.00, "percentage": 6.4 }
  }
}

GET /api/v1/analytics/customer/{customer_id}/payment-behavior
GET /api/v1/analytics/followup-effectiveness
```

#### Integration APIs

```http
POST /api/v1/integrations/quickbooks/sync
POST /api/v1/integrations/stripe/webhooks
GET /api/v1/integrations/status
```

### Webhook Events

```json
{
  "event": "invoice.overdue",
  "timestamp": "2024-02-16T00:05:00Z",
  "data": {
    "invoice_id": "inv_abc123",
    "customer_id": "cust_123",
    "amount": 6600.00,
    "days_overdue": 1,
    "reminder_sent": true
  }
}
```

**Supported Events:**
- `invoice.created`, `invoice.sent`, `invoice.viewed`, `invoice.paid`, `invoice.overdue`, `invoice.disputed`
- `payment.received`, `payment.failed`, `payment.refunded`
- `reminder.scheduled`, `reminder.sent`, `reminder.failed`
- `customer.responded`, `customer.dispute_opened`

---

## Database Design

### Schema Design

We'll use a hybrid approach:
- **PostgreSQL**: Transactional data (invoices, payments, customers)
- **DynamoDB**: Time-series data (events, audit logs, communication logs)
- **ElasticSearch**: Full-text search, analytics queries
- **Redis**: Caching, rate limiting, job queues

### PostgreSQL Schema

```sql
-- Organizations (Tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  plan_type VARCHAR(50) NOT NULL, -- starter, professional, enterprise
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orgs_subdomain ON organizations(subdomain);
CREATE INDEX idx_orgs_status ON organizations(status);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_number VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  billing_address JSONB,
  payment_terms VARCHAR(50) DEFAULT 'net_30', -- net_15, net_30, net_60, due_on_receipt
  credit_limit DECIMAL(15, 2),
  preferred_payment_method VARCHAR(50),
  preferred_contact_channel VARCHAR(50) DEFAULT 'email',
  payment_behavior_score INT, -- 0-100, AI-computed
  tags TEXT[],
  custom_fields JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, customer_number)
);

CREATE INDEX idx_customers_org ON customers(organization_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(organization_id, status);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, sent, viewed, partial_paid, paid, overdue, disputed, cancelled
  invoice_type VARCHAR(50) DEFAULT 'standard', -- standard, recurring, milestone, credit_note
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',

  -- Amounts
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL,
  paid_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(15, 2) NOT NULL,

  -- Line items stored as JSON
  line_items JSONB NOT NULL,

  -- Metadata
  payment_terms VARCHAR(50),
  notes TEXT,
  internal_notes TEXT,
  pdf_url TEXT,
  pdf_s3_key TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Follow-up
  followup_rule_id UUID,
  followup_paused BOOLEAN DEFAULT FALSE,
  followup_paused_reason TEXT,
  last_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_count INT DEFAULT 0,

  -- Integration
  external_id VARCHAR(255), -- ID from QuickBooks, Xero, etc.
  external_system VARCHAR(50),
  sync_status VARCHAR(50),
  last_synced_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(organization_id, status);
CREATE INDEX idx_invoices_due_date ON invoices(organization_id, due_date);
CREATE INDEX idx_invoices_overdue ON invoices(organization_id, status, due_date)
  WHERE status = 'overdue';
CREATE INDEX idx_invoices_external ON invoices(external_system, external_id);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  payment_number VARCHAR(100) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL, -- bank_transfer, credit_card, ach, paypal, stripe, check, cash
  payment_date DATE NOT NULL,
  reference_number VARCHAR(255),
  notes TEXT,

  -- Processing
  status VARCHAR(50) NOT NULL DEFAULT 'completed', -- pending, completed, failed, refunded
  gateway VARCHAR(50), -- stripe, paypal, square
  gateway_transaction_id VARCHAR(255),
  gateway_fee DECIMAL(15, 2),

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP WITH TIME ZONE,
  reconciled_by UUID, -- references users table
  bank_statement_id VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(organization_id, payment_number)
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_date ON payments(organization_id, payment_date);
CREATE INDEX idx_payments_reconciled ON payments(organization_id, reconciled);

-- Follow-up Rules
CREATE TABLE followup_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,

  -- Applicability
  apply_to VARCHAR(50) NOT NULL DEFAULT 'all_customers', -- all_customers, specific_customers, customer_segments
  customer_ids UUID[],
  customer_tags TEXT[],
  invoice_amount_min DECIMAL(15, 2),
  invoice_amount_max DECIMAL(15, 2),

  -- Reminder configuration (stored as JSON array)
  reminders JSONB NOT NULL,

  -- Exclusions
  skip_weekends BOOLEAN DEFAULT TRUE,
  skip_holidays BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_followup_rules_org ON followup_rules(organization_id);
CREATE INDEX idx_followup_rules_enabled ON followup_rules(organization_id, enabled);

-- Reminders (tracking)
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  followup_rule_id UUID NOT NULL REFERENCES followup_rules(id),

  -- Scheduling
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,

  -- Configuration
  reminder_type VARCHAR(50) NOT NULL, -- days_before_due, on_due_date, days_after_due
  days_offset INT,
  channels VARCHAR(50)[], -- email, sms, whatsapp, push
  template_id VARCHAR(255),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, sent, failed, cancelled

  -- Results
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Content snapshot
  subject TEXT,
  body TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminders_org ON reminders(organization_id);
CREATE INDEX idx_reminders_invoice ON reminders(invoice_id);
CREATE INDEX idx_reminders_scheduled ON reminders(organization_id, status, scheduled_at);
CREATE INDEX idx_reminders_sent ON reminders(organization_id, sent_at);

-- Communication Log
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  invoice_id UUID REFERENCES invoices(id),
  customer_id UUID NOT NULL REFERENCES customers(id),

  type VARCHAR(50) NOT NULL, -- email, sms, call, note, meeting
  direction VARCHAR(50) NOT NULL, -- inbound, outbound
  channel VARCHAR(50),
  subject TEXT,
  body TEXT,

  -- Participants
  from_address VARCHAR(255),
  to_addresses TEXT[],
  cc_addresses TEXT[],

  -- Metadata
  status VARCHAR(50), -- sent, delivered, opened, clicked, bounced, failed
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,

  -- Threading
  parent_id UUID REFERENCES communications(id),
  thread_id UUID,

  -- Attachments
  attachments JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comms_org ON communications(organization_id);
CREATE INDEX idx_comms_customer ON communications(customer_id);
CREATE INDEX idx_comms_invoice ON communications(invoice_id);
CREATE INDEX idx_comms_thread ON communications(thread_id);
CREATE INDEX idx_comms_created ON communications(organization_id, created_at DESC);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- admin, accountant, manager, viewer
  status VARCHAR(50) DEFAULT 'active',
  password_hash VARCHAR(255),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255),
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- Audit Log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),

  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,

  changes JSONB,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(organization_id, created_at DESC);
```

### DynamoDB Tables

**Events Table** (Time-series events)
```json
{
  "TableName": "InvoiceEvents",
  "KeySchema": [
    { "AttributeName": "PK", "KeyType": "HASH" },  // invoice_id
    { "AttributeName": "SK", "KeyType": "RANGE" }  // timestamp#event_type
  ],
  "Attributes": [
    { "AttributeName": "PK", "AttributeType": "S" },
    { "AttributeName": "SK", "AttributeType": "S" },
    { "AttributeName": "GSI1PK", "AttributeType": "S" }, // org_id
    { "AttributeName": "GSI1SK", "AttributeType": "S" }  // timestamp
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GSI1",
      "KeySchema": [
        { "AttributeName": "GSI1PK", "KeyType": "HASH" },
        { "AttributeName": "GSI1SK", "KeyType": "RANGE" }
      ]
    }
  ]
}
```

### Redis Cache Keys

```
# Invoice cache
invoice:{invoice_id} → Invoice object (TTL: 5 min)

# Customer cache
customer:{customer_id} → Customer object (TTL: 10 min)

# Analytics cache
analytics:dso:{org_id} → DSO metrics (TTL: 1 hour)
analytics:aging:{org_id} → Aging report (TTL: 6 hours)

# Rate limiting
ratelimit:api:{org_id}:{endpoint} → Request count (TTL: 1 min)

# Job queues
queue:reminders:scheduled → Sorted set by scheduled_at
queue:emails:pending → List of pending emails
queue:reconciliation:pending → List of transactions to reconcile
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  Web App    │  Mobile App  │  Customer Portal  │  Email Client  │
└──────┬──────┴──────┬───────┴────────┬──────────┴────────┬───────┘
       │             │                │                    │
       └─────────────┴────────────────┴────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CDN / Load Balancer                         │
│                     (CloudFront / ALB)                           │
└──────────────────────────────┬──────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Gateway Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Rate Limiting│  │     Auth     │  │   Routing    │          │
│  │   & Quotas   │  │  (JWT/OAuth) │  │  & Firewall  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────────────┬──────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Invoice        │  │  Payment        │  │  Follow-up      │
│  Service        │  │  Service        │  │  Engine         │
│                 │  │                 │  │                 │
│ • CRUD ops      │  │ • Record        │  │ • Rule engine   │
│ • Validation    │  │ • Reconcile     │  │ • Scheduler     │
│ • PDF gen       │  │ • Gateway calls │  │ • Reminder mgmt │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Customer       │  │  Communication  │  │  Analytics      │
│  Service        │  │  Service        │  │  Service        │
│                 │  │                 │  │                 │
│ • Profile mgmt  │  │ • Multi-channel │  │ • DSO calc      │
│ • Segmentation  │  │ • Templates     │  │ • Aging reports │
│ • Behavior score│  │ • History log   │  │ • Predictions   │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Integration    │  │  Notification   │  │  Reporting      │
│  Service        │  │  Service        │  │  Service        │
│                 │  │                 │  │                 │
│ • QuickBooks    │  │ • Email (SES)   │  │ • Report gen    │
│ • Xero sync     │  │ • SMS (Twilio)  │  │ • Dashboards    │
│ • Stripe/PayPal │  │ • WhatsApp      │  │ • Exports       │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Message Queue                             │
│                   (Amazon SQS / RabbitMQ)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │  Reminder  │  │   Email    │  │Reconcile   │                │
│  │   Queue    │  │   Queue    │  │  Queue     │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└──────────────────────────────┬──────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │    DynamoDB     │  │      Redis      │
│   (RDS Multi-AZ)│  │  (Events/Logs)  │  │   (Cache/Jobs)  │
│                 │  │                 │  │                 │
│ • Invoices      │  │ • Audit trail   │  │ • Session cache │
│ • Customers     │  │ • Time-series   │  │ • Rate limits   │
│ • Payments      │  │ • Analytics     │  │ • Job queues    │
└─────────┬───────┘  └─────────────────┘  └─────────────────┘
          │
          ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ElasticSearch  │  │    Amazon S3    │  │   CloudWatch    │
│  (Search/Analytics)│  │  (PDFs/Files) │  │ (Monitoring)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Service Communication

**Synchronous (REST):**
- Client → API Gateway → Services (user-initiated)
- Service → Service (when immediate response needed)

**Asynchronous (Events):**
- Service → Message Queue → Worker (background jobs)
- Service → Event Bus → Multiple subscribers (event notifications)

**Data Flow:**
- Services → Primary DB (PostgreSQL) for writes
- Services → Cache (Redis) for reads
- Services → Search (ElasticSearch) for analytics
- Services → S3 for file storage

---

## Core Components

### 1. Invoice Service

**Responsibilities:**
- Invoice CRUD operations
- Invoice lifecycle management (draft → sent → paid)
- PDF generation and storage
- Invoice validation and business rules
- Bulk import/export

**Key Operations:**
```
createInvoice(data) → invoice_id
updateInvoice(invoice_id, data) → updated_invoice
sendInvoice(invoice_id) → sent_status
generatePDF(invoice_id) → pdf_url
getInvoiceStatus(invoice_id) → status
markAsPaid(invoice_id, payment_id) → updated_invoice
```

**Technologies:**
- Language: Node.js / TypeScript
- Framework: Express / NestJS
- PDF Generation: Puppeteer / PDFKit
- Validation: Joi / Zod

### 2. Follow-up Engine

**Responsibilities:**
- Rule evaluation and reminder scheduling
- Smart timing (avoid weekends, holidays, quiet hours)
- Escalation management
- Reminder tracking and analytics
- A/B testing of reminder templates

**Key Operations:**
```
evaluateRules(invoice_id) → reminder_schedule
scheduleReminder(invoice_id, rule_id, days_offset) → reminder_id
processScheduledReminders() → sent_count
pauseFollowup(invoice_id, reason) → paused_status
resumeFollowup(invoice_id) → resumed_status
```

**Algorithm (Reminder Scheduling):**
```python
def schedule_reminders(invoice, followup_rule):
    reminders = []

    for reminder_config in followup_rule.reminders:
        # Calculate trigger date
        if reminder_config.trigger == 'days_before_due':
            trigger_date = invoice.due_date - timedelta(days=reminder_config.days)
        elif reminder_config.trigger == 'on_due_date':
            trigger_date = invoice.due_date
        elif reminder_config.trigger == 'days_after_due':
            trigger_date = invoice.due_date + timedelta(days=reminder_config.days)

        # Adjust for exclusions
        trigger_datetime = adjust_for_exclusions(
            trigger_date,
            followup_rule.skip_weekends,
            followup_rule.skip_holidays,
            followup_rule.quiet_hours_start,
            followup_rule.quiet_hours_end,
            followup_rule.timezone
        )

        # Create reminder record
        reminder = {
            'invoice_id': invoice.id,
            'scheduled_at': trigger_datetime,
            'channels': reminder_config.channels,
            'template_id': reminder_config.template_id,
            'status': 'scheduled'
        }

        reminders.append(reminder)

    return reminders

def adjust_for_exclusions(dt, skip_weekends, skip_holidays, quiet_start, quiet_end, tz):
    # Convert to target timezone
    local_dt = dt.astimezone(pytz.timezone(tz))

    # Skip weekends
    if skip_weekends:
        while local_dt.weekday() >= 5:  # Saturday = 5, Sunday = 6
            local_dt += timedelta(days=1)

    # Skip holidays
    if skip_holidays and is_holiday(local_dt.date(), tz):
        local_dt = get_next_business_day(local_dt)

    # Adjust for quiet hours
    if quiet_start and quiet_end:
        time = local_dt.time()
        if not (quiet_start <= time <= quiet_end):
            # Set to start of business hours
            local_dt = local_dt.replace(hour=quiet_start.hour, minute=quiet_start.minute)

            # If that's in the past, move to next day
            if local_dt < datetime.now(tz):
                local_dt += timedelta(days=1)

    return local_dt.astimezone(pytz.UTC)
```

**Scheduler Architecture:**
- Cron job runs every 5 minutes
- Queries reminders with `scheduled_at <= NOW() AND status = 'scheduled'`
- Batches reminders and pushes to notification queue
- Uses distributed locks (Redis) to prevent duplicate sends

### 3. Payment Service

**Responsibilities:**
- Payment recording (manual and automatic)
- Payment gateway integration (Stripe, PayPal, Square)
- Automatic reconciliation from bank feeds
- Partial payment handling
- Refund processing

**Key Operations:**
```
recordPayment(invoice_id, payment_data) → payment_id
reconcilePayment(payment_id, bank_transaction) → reconciliation_status
processStripeWebhook(event) → processed_status
getPaymentHistory(invoice_id) → payments[]
refundPayment(payment_id, amount) → refund_id
```

**Reconciliation Algorithm:**
```python
def auto_reconcile_bank_transaction(transaction):
    # Extract amount and reference
    amount = transaction.amount
    reference = extract_reference(transaction.description)
    date = transaction.date

    # Try exact match by reference
    if reference:
        invoice = find_invoice_by_number(reference)
        if invoice and abs(invoice.balance_due - amount) < 0.01:
            return create_payment(invoice.id, amount, date, 'bank_transfer', reference)

    # Try fuzzy matching by amount and customer name
    customer_name = extract_customer_name(transaction.description)
    if customer_name:
        invoices = find_invoices_by_customer_name(customer_name, status='overdue')

        for invoice in invoices:
            if abs(invoice.balance_due - amount) < 0.01:
                # High confidence match
                return create_payment(invoice.id, amount, date, 'bank_transfer', reference)

    # Cannot auto-reconcile, flag for manual review
    return create_pending_reconciliation(transaction)
```

### 4. Communication Service

**Responsibilities:**
- Multi-channel message delivery (email, SMS, WhatsApp, push)
- Template management and rendering
- Delivery tracking (opened, clicked)
- Two-way communication handling
- Communication history logging

**Key Operations:**
```
sendEmail(to, subject, template_id, variables) → message_id
sendSMS(to, message) → sms_id
trackEmailOpen(message_id) → logged
trackEmailClick(message_id, link) → logged
getConversationHistory(customer_id) → messages[]
```

**Email Template System:**
```html
<!-- Template: overdue_gentle -->
<html>
<body>
  <h2>Friendly Payment Reminder</h2>

  <p>Hi {{customer.name}},</p>

  <p>This is a friendly reminder that invoice <strong>{{invoice.number}}</strong>
  for <strong>{{invoice.total | currency}}</strong> was due on
  <strong>{{invoice.due_date | date}}</strong>.</p>

  <p>We understand things can get busy. If you've already sent the payment,
  please disregard this message.</p>

  <p>
    <a href="{{invoice.payment_url}}" style="...">
      Pay Now
    </a>
  </p>

  <p>If you have any questions or concerns, please don't hesitate to reach out.</p>

  <p>Best regards,<br>{{organization.name}}</p>

  <!-- Tracking pixel -->
  <img src="{{tracking.pixel_url}}" width="1" height="1" />
</body>
</html>
```

### 5. Analytics Service

**Responsibilities:**
- DSO (Days Sales Outstanding) calculation
- Aging report generation
- Payment behavior scoring
- Cash flow forecasting
- Follow-up effectiveness tracking
- Custom report building

**Key Metrics:**

**DSO Calculation:**
```python
def calculate_dso(organization_id, period_days=90):
    """
    DSO = (Accounts Receivable / Total Credit Sales) × Number of Days
    """
    end_date = datetime.now()
    start_date = end_date - timedelta(days=period_days)

    # Get accounts receivable (unpaid invoices)
    ar = db.query(
        "SELECT SUM(balance_due) FROM invoices "
        "WHERE organization_id = %s AND status IN ('sent', 'overdue')",
        [organization_id]
    )[0]

    # Get total credit sales in period
    total_sales = db.query(
        "SELECT SUM(total_amount) FROM invoices "
        "WHERE organization_id = %s "
        "AND issue_date >= %s AND issue_date <= %s",
        [organization_id, start_date, end_date]
    )[0]

    if total_sales == 0:
        return 0

    dso = (ar / total_sales) * period_days
    return round(dso, 2)
```

**Payment Behavior Score:**
```python
def calculate_payment_behavior_score(customer_id):
    """
    Score 0-100 based on payment history
    Higher score = more likely to pay on time
    """
    invoices = get_customer_invoices(customer_id, limit=20)

    if len(invoices) == 0:
        return 50  # Neutral for new customers

    score = 100

    for invoice in invoices:
        if invoice.status == 'paid':
            days_late = (invoice.paid_at.date() - invoice.due_date).days

            if days_late <= 0:
                score += 2  # Paid early or on time
            elif days_late <= 7:
                score -= 5
            elif days_late <= 30:
                score -= 10
            else:
                score -= 20
        elif invoice.status == 'overdue':
            days_overdue = (datetime.now().date() - invoice.due_date).days
            score -= min(days_overdue, 30)  # Cap penalty at 30 points
        elif invoice.status == 'disputed':
            score -= 5

    # Normalize to 0-100
    score = max(0, min(100, score))

    return score
```

### 6. Integration Service

**Responsibilities:**
- Bi-directional sync with accounting software
- Payment gateway webhooks handling
- CRM data synchronization
- Banking API integration
- Webhook delivery to third-party systems

**Supported Integrations:**

| System | Type | Sync Direction | Frequency |
|--------|------|---------------|-----------|
| QuickBooks Online | Accounting | Bi-directional | Every 15 min |
| Xero | Accounting | Bi-directional | Every 15 min |
| NetSuite | ERP | Bi-directional | Every 30 min |
| Stripe | Payment | Webhook (real-time) | Real-time |
| PayPal | Payment | Webhook (real-time) | Real-time |
| Plaid | Banking | Pull (bank feeds) | Every 6 hours |
| Salesforce | CRM | Bi-directional | Every 1 hour |
| HubSpot | CRM | Bi-directional | Every 1 hour |

**QuickBooks Sync Algorithm:**
```python
def sync_with_quickbooks(organization_id):
    org = get_organization(organization_id)
    qb_client = QuickBooksClient(org.qb_access_token)

    # Pull changes from QuickBooks
    last_sync = org.last_qb_sync_at

    # Sync invoices
    qb_invoices = qb_client.get_invoices(changed_since=last_sync)
    for qb_invoice in qb_invoices:
        local_invoice = find_invoice_by_external_id(qb_invoice.Id)

        if local_invoice:
            # Update existing
            if qb_invoice.MetaData.LastUpdatedTime > local_invoice.updated_at:
                update_invoice_from_qb(local_invoice, qb_invoice)
        else:
            # Create new
            create_invoice_from_qb(organization_id, qb_invoice)

    # Sync payments
    qb_payments = qb_client.get_payments(changed_since=last_sync)
    for qb_payment in qb_payments:
        local_payment = find_payment_by_external_id(qb_payment.Id)

        if not local_payment:
            create_payment_from_qb(organization_id, qb_payment)

    # Push changes to QuickBooks
    local_invoices = get_invoices(
        organization_id,
        sync_status='pending',
        external_system='quickbooks'
    )

    for invoice in local_invoices:
        if invoice.external_id:
            # Update existing QB invoice
            qb_invoice = map_to_qb_invoice(invoice)
            qb_client.update_invoice(invoice.external_id, qb_invoice)
        else:
            # Create new QB invoice
            qb_invoice = map_to_qb_invoice(invoice)
            qb_result = qb_client.create_invoice(qb_invoice)

            # Save external ID
            update_invoice(invoice.id, {
                'external_id': qb_result.Id,
                'sync_status': 'synced'
            })

    # Update last sync timestamp
    update_organization(organization_id, {
        'last_qb_sync_at': datetime.now()
    })
```

---

## Invoice Management Flow

### Create Invoice Flow

```
User/System
     │
     ├─> [1] Submit invoice data
     │
     ▼
Invoice Service
     │
     ├─> [2] Validate data (amounts, dates, customer exists)
     │
     ├─> [3] Generate invoice number (if not provided)
     │
     ├─> [4] Calculate totals (subtotal + tax - discount)
     │
     ├─> [5] Save to database (status: draft)
     │
     ├─> [6] Generate PDF asynchronously
     │         │
     │         └─> PDF Worker
     │                 │
     │                 ├─> Render HTML from template
     │                 ├─> Convert to PDF (Puppeteer)
     │                 ├─> Upload to S3
     │                 └─> Update invoice with PDF URL
     │
     ├─> [7] If auto-send enabled:
     │         │
     │         └─> Send invoice email
     │
     ├─> [8] Trigger event: invoice.created
     │         │
     │         └─> Event subscribers:
     │                 ├─> Accounting system sync
     │                 ├─> Analytics service
     │                 └─> Audit logging
     │
     └─> [9] Return invoice_id to caller
```

### Send Invoice Flow

```
User
     │
     ├─> [1] Click "Send Invoice"
     │
     ▼
Invoice Service
     │
     ├─> [2] Validate invoice can be sent (has PDF, not already sent recently)
     │
     ├─> [3] Update status: sent
     │
     ├─> [4] Set sent_at timestamp
     │
     ├─> [5] Evaluate applicable follow-up rules
     │         │
     │         └─> Follow-up Engine
     │                 │
     │                 └─> Schedule reminders based on due date
     │
     ├─> [6] Send invoice email
     │         │
     │         └─> Communication Service
     │                 │
     │                 ├─> Render email from template
     │                 ├─> Attach PDF
     │                 ├─> Add tracking pixel
     │                 ├─> Send via SES/SendGrid
     │                 └─> Log communication
     │
     ├─> [7] Trigger event: invoice.sent
     │
     └─> [8] Return success
```

### Mark as Paid Flow

```
Payment Received (Manual or Automatic)
     │
     ├─> [1] Record payment
     │
     ▼
Payment Service
     │
     ├─> [2] Validate payment data
     │
     ├─> [3] Create payment record
     │
     ├─> [4] Update invoice:
     │         │
     │         ├─> paid_amount += payment.amount
     │         ├─> balance_due = total - paid_amount
     │         │
     │         └─> If balance_due == 0:
     │                 ├─> status = 'paid'
     │                 ├─> paid_at = NOW()
     │                 └─> followup_paused = true
     │             Else:
     │                 └─> status = 'partial_paid'
     │
     ├─> [5] Cancel pending reminders
     │         │
     │         └─> Follow-up Engine
     │                 │
     │                 └─> UPDATE reminders
     │                     SET status = 'cancelled'
     │                     WHERE invoice_id = ? AND status = 'scheduled'
     │
     ├─> [6] Send payment confirmation email
     │
     ├─> [7] Trigger events:
     │         ├─> payment.received
     │         └─> invoice.paid (if fully paid)
     │
     └─> [8] Return payment_id
```

---

## Automated Follow-up Engine

### Reminder Processing Loop

```python
# Cron job: Run every 5 minutes
def process_scheduled_reminders():
    """
    Main reminder processing loop
    Runs as a cron job every 5 minutes
    """

    # Acquire distributed lock to prevent multiple instances
    lock_key = 'reminder_processor_lock'
    lock = redis.lock(lock_key, timeout=300)  # 5 minutes

    if not lock.acquire(blocking=False):
        logger.info("Another instance is processing reminders")
        return

    try:
        # Query reminders due for sending
        now = datetime.now(UTC)
        reminders = db.query("""
            SELECT r.*, i.invoice_number, i.total_amount, i.balance_due,
                   c.name, c.email, c.phone
            FROM reminders r
            JOIN invoices i ON r.invoice_id = i.id
            JOIN customers c ON r.customer_id = c.id
            WHERE r.status = 'scheduled'
              AND r.scheduled_at <= %s
              AND i.status IN ('sent', 'overdue')
              AND i.followup_paused = FALSE
            ORDER BY r.scheduled_at ASC
            LIMIT 1000
        """, [now])

        logger.info(f"Found {len(reminders)} reminders to process")

        # Process in batches
        for reminder in reminders:
            try:
                send_reminder(reminder)
            except Exception as e:
                logger.error(f"Failed to send reminder {reminder.id}: {e}")
                # Mark as failed
                db.execute("""
                    UPDATE reminders
                    SET status = 'failed', error_message = %s
                    WHERE id = %s
                """, [str(e), reminder.id])

        # Cleanup old processed reminders (older than 90 days)
        cleanup_date = now - timedelta(days=90)
        db.execute("""
            DELETE FROM reminders
            WHERE status IN ('sent', 'cancelled', 'failed')
              AND created_at < %s
        """, [cleanup_date])

    finally:
        lock.release()

def send_reminder(reminder):
    """
    Send a single reminder across configured channels
    """
    # Pre-flight checks
    invoice = get_invoice(reminder.invoice_id)

    # Skip if invoice is no longer eligible
    if invoice.status not in ['sent', 'overdue']:
        cancel_reminder(reminder.id, f"Invoice status changed to {invoice.status}")
        return

    if invoice.followup_paused:
        cancel_reminder(reminder.id, "Follow-up paused")
        return

    # Get template and render with variables
    template = get_template(reminder.template_id)
    variables = build_template_variables(reminder, invoice)

    # Send across all channels
    sent_channels = []

    for channel in reminder.channels:
        try:
            if channel == 'email':
                send_email_reminder(reminder, template, variables)
                sent_channels.append('email')

            elif channel == 'sms':
                send_sms_reminder(reminder, template, variables)
                sent_channels.append('sms')

            elif channel == 'whatsapp':
                send_whatsapp_reminder(reminder, template, variables)
                sent_channels.append('whatsapp')

        except Exception as e:
            logger.error(f"Failed to send {channel} reminder: {e}")

    # Update reminder status
    db.execute("""
        UPDATE reminders
        SET status = 'sent',
            sent_at = %s,
            channels_sent = %s
        WHERE id = %s
    """, [datetime.now(UTC), sent_channels, reminder.id])

    # Update invoice reminder tracking
    db.execute("""
        UPDATE invoices
        SET last_reminder_sent_at = %s,
            reminder_count = reminder_count + 1
        WHERE id = %s
    """, [datetime.now(UTC), reminder.invoice_id])

    # Log communication
    log_communication(
        organization_id=reminder.organization_id,
        customer_id=reminder.customer_id,
        invoice_id=reminder.invoice_id,
        type='reminder',
        channels=sent_channels,
        template_id=reminder.template_id
    )

    # Trigger event
    publish_event('reminder.sent', {
        'reminder_id': reminder.id,
        'invoice_id': reminder.invoice_id,
        'channels': sent_channels
    })

def build_template_variables(reminder, invoice):
    """
    Build variables for template rendering
    """
    customer = get_customer(reminder.customer_id)
    organization = get_organization(reminder.organization_id)

    # Calculate days overdue
    days_overdue = 0
    if invoice.due_date < date.today():
        days_overdue = (date.today() - invoice.due_date).days

    # Generate payment link with tracking
    payment_url = generate_payment_url(
        invoice.id,
        utm_source='email',
        utm_campaign='invoice_reminder'
    )

    return {
        'customer': {
            'name': customer.name,
            'email': customer.email,
            'first_name': customer.name.split()[0] if customer.name else 'there'
        },
        'invoice': {
            'number': invoice.invoice_number,
            'total': format_currency(invoice.total_amount, invoice.currency),
            'balance_due': format_currency(invoice.balance_due, invoice.currency),
            'due_date': format_date(invoice.due_date),
            'issue_date': format_date(invoice.issue_date),
            'days_overdue': days_overdue,
            'payment_url': payment_url,
            'pdf_url': invoice.pdf_url
        },
        'organization': {
            'name': organization.name,
            'email': organization.support_email,
            'phone': organization.phone,
            'address': organization.address
        },
        'tracking': {
            'pixel_url': generate_tracking_pixel_url(reminder.id)
        }
    }
```

### Smart Scheduling Logic

```python
def determine_optimal_send_time(scheduled_dt, followup_rule, customer):
    """
    Adjust scheduled time based on:
    - Time zone
    - Business hours
    - Customer engagement history
    - A/B testing results
    """

    # Get customer timezone
    tz = get_customer_timezone(customer)
    local_dt = scheduled_dt.astimezone(tz)

    # If customer has engagement history, use their most active time
    engagement_hour = get_customer_most_active_hour(customer.id)
    if engagement_hour:
        local_dt = local_dt.replace(hour=engagement_hour)
    else:
        # Default to 10 AM local time (best open rates)
        local_dt = local_dt.replace(hour=10, minute=0)

    # Adjust for exclusions
    local_dt = adjust_for_exclusions(
        local_dt,
        followup_rule.skip_weekends,
        followup_rule.skip_holidays,
        followup_rule.quiet_hours_start,
        followup_rule.quiet_hours_end,
        tz
    )

    return local_dt.astimezone(UTC)

def get_customer_most_active_hour(customer_id):
    """
    Analyze when customer typically opens emails
    """
    opens = db.query("""
        SELECT EXTRACT(HOUR FROM opened_at) as hour, COUNT(*) as count
        FROM communications
        WHERE customer_id = %s
          AND opened_at IS NOT NULL
        GROUP BY hour
        ORDER BY count DESC
        LIMIT 1
    """, [customer_id])

    if opens:
        return int(opens[0]['hour'])

    return None
```

---

## Payment Tracking & Reconciliation

### Automatic Reconciliation Pipeline

```
Bank Feed / Payment Gateway
         │
         ├─> [1] Transaction received via webhook or API pull
         │
         ▼
Payment Service
         │
         ├─> [2] Parse transaction data
         │         ├─> Amount
         │         ├─> Date
         │         ├─> Reference/Description
         │         └─> Payer information
         │
         ├─> [3] Attempt automatic matching
         │         │
         │         └─> Matching Algorithm:
         │                 │
         │                 ├─> [3a] Exact match by reference number
         │                 │     (e.g., "INV-2024-001" in description)
         │                 │
         │                 ├─> [3b] Amount + customer name match
         │                 │     (fuzzy matching on payer name)
         │                 │
         │                 ├─> [3c] Amount + date proximity match
         │                 │     (±3 days)
         │                 │
         │                 └─> [3d] ML-based matching
         │                       (trained on historical reconciliations)
         │
         ├─> [4] Confidence score
         │         │
         │         ├─> > 95%: Auto-reconcile
         │         ├─> 70-95%: Suggest to user (show top 3 matches)
         │         └─> < 70%: Flag for manual review
         │
         ├─> [5] If auto-reconciled:
         │         │
         │         ├─> Create payment record
         │         ├─> Update invoice status
         │         ├─> Cancel pending reminders
         │         ├─> Send payment confirmation
         │         └─> Trigger invoice.paid event
         │
         └─> [6] If manual review needed:
                   │
                   ├─> Create pending_reconciliation record
                   ├─> Notify accountants
                   └─> Show in reconciliation dashboard
```

### Reconciliation Dashboard

Features for manual reconciliation:
- Split view: Unmatched transactions | Open invoices
- Drag-and-drop matching
- Bulk actions
- Search and filters
- Match suggestions with confidence scores
- Notes and audit trail

```python
def get_reconciliation_suggestions(transaction):
    """
    Return top 3 invoice matches for a transaction
    """
    amount = transaction.amount
    date = transaction.date
    description = transaction.description.lower()

    # Extract potential invoice numbers from description
    invoice_numbers = extract_invoice_references(description)

    suggestions = []

    # Priority 1: Exact invoice number match
    if invoice_numbers:
        for inv_num in invoice_numbers:
            invoice = find_invoice_by_number(inv_num)
            if invoice and invoice.balance_due > 0:
                suggestions.append({
                    'invoice': invoice,
                    'confidence': 98,
                    'reason': f"Invoice number '{inv_num}' found in transaction description"
                })

    # Priority 2: Amount match with customer name
    customer_name = extract_customer_name(description)
    if customer_name:
        customer = fuzzy_find_customer(customer_name)
        if customer:
            invoices = get_open_invoices(customer.id)
            for invoice in invoices:
                amount_diff = abs(invoice.balance_due - amount)
                if amount_diff < 1.0:  # Within $1
                    confidence = 90 - (amount_diff * 10)
                    suggestions.append({
                        'invoice': invoice,
                        'confidence': confidence,
                        'reason': f"Exact amount match for customer '{customer.name}'"
                    })

    # Priority 3: Amount + date proximity
    date_range_start = date - timedelta(days=3)
    date_range_end = date + timedelta(days=3)

    invoices = db.query("""
        SELECT * FROM invoices
        WHERE status IN ('sent', 'overdue')
          AND ABS(balance_due - %s) < 5.0
          AND due_date BETWEEN %s AND %s
        ORDER BY ABS(balance_due - %s) ASC
        LIMIT 5
    """, [amount, date_range_start, date_range_end, amount])

    for invoice in invoices:
        if not any(s['invoice'].id == invoice.id for s in suggestions):
            amount_diff = abs(invoice.balance_due - amount)
            date_diff = abs((invoice.due_date - date).days)

            confidence = 75 - (amount_diff * 2) - (date_diff * 2)

            suggestions.append({
                'invoice': invoice,
                'confidence': max(50, confidence),
                'reason': f"Similar amount (${amount_diff:.2f} diff) and date ({date_diff} days)"
            })

    # Sort by confidence and return top 3
    suggestions.sort(key=lambda x: x['confidence'], reverse=True)
    return suggestions[:3]
```

---

## Integration Architecture

### QuickBooks Online Integration

**OAuth 2.0 Authentication Flow:**

```
User
  │
  ├─> [1] Click "Connect QuickBooks"
  │
  ▼
Our App
  │
  ├─> [2] Redirect to QuickBooks authorization URL
  │        URL: https://appcenter.intuit.com/connect/oauth2
  │        Params: client_id, redirect_uri, scope, state
  │
  ▼
QuickBooks
  │
  ├─> [3] User authorizes our app
  │
  ├─> [4] Redirect back to our app with auth code
  │        URL: https://ourapp.com/integrations/quickbooks/callback?code=ABC123&state=XYZ
  │
  ▼
Our App
  │
  ├─> [5] Exchange auth code for tokens
  │        POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  │        Body: code, grant_type, redirect_uri
  │
  ├─> [6] Receive access_token + refresh_token
  │
  ├─> [7] Save tokens to database (encrypted)
  │
  ├─> [8] Get company info
  │        GET https://quickbooks.api.intuit.com/v3/company/{realmId}/companyinfo/{realmId}
  │
  ├─> [9] Trigger initial sync
  │
  └─> [10] Redirect user to success page
```

**Bi-directional Sync:**

```python
# Sync every 15 minutes via cron
def sync_quickbooks_invoices(organization_id):
    org = get_organization(organization_id)

    if not org.qb_access_token:
        return

    # Refresh access token if expired
    if token_expired(org.qb_token_expires_at):
        refresh_qb_access_token(organization_id)
        org = get_organization(organization_id)  # Reload

    qb_client = QuickBooksClient(
        access_token=org.qb_access_token,
        realm_id=org.qb_realm_id
    )

    # Pull: Get updated invoices from QuickBooks
    last_sync = org.last_qb_sync_at or (datetime.now() - timedelta(days=30))

    qb_invoices = qb_client.query(
        "SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime > '{}'".format(
            last_sync.strftime('%Y-%m-%dT%H:%M:%S')
        )
    )

    for qb_invoice in qb_invoices:
        sync_invoice_from_qb(organization_id, qb_invoice)

    # Push: Send updated invoices to QuickBooks
    local_invoices = get_invoices(
        organization_id=organization_id,
        external_system='quickbooks',
        sync_status='pending'
    )

    for invoice in local_invoices:
        try:
            if invoice.external_id:
                # Update existing
                qb_invoice = qb_client.read('Invoice', invoice.external_id)
                updated_qb_invoice = map_to_qb_invoice(invoice, qb_invoice)
                qb_client.update(updated_qb_invoice)
            else:
                # Create new
                qb_invoice = map_to_qb_invoice(invoice)
                result = qb_client.create(qb_invoice)

                # Save external ID
                db.execute(
                    "UPDATE invoices SET external_id = %s WHERE id = %s",
                    [result.Id, invoice.id]
                )

            # Mark as synced
            db.execute(
                "UPDATE invoices SET sync_status = 'synced', last_synced_at = NOW() WHERE id = %s",
                [invoice.id]
            )

        except Exception as e:
            logger.error(f"Failed to sync invoice {invoice.id} to QB: {e}")
            db.execute(
                "UPDATE invoices SET sync_status = 'failed', sync_error = %s WHERE id = %s",
                [str(e), invoice.id]
            )

    # Update last sync timestamp
    db.execute(
        "UPDATE organizations SET last_qb_sync_at = NOW() WHERE id = %s",
        [organization_id]
    )

def map_to_qb_invoice(invoice, qb_invoice=None):
    """
    Map our invoice format to QuickBooks format
    """
    customer = get_customer(invoice.customer_id)

    # Get or create QB customer reference
    qb_customer_id = get_or_create_qb_customer(customer)

    qb_data = {
        'CustomerRef': {'value': qb_customer_id},
        'TxnDate': invoice.issue_date.strftime('%Y-%m-%d'),
        'DueDate': invoice.due_date.strftime('%Y-%m-%d'),
        'DocNumber': invoice.invoice_number,
        'Line': []
    }

    # Map line items
    for item in invoice.line_items:
        qb_data['Line'].append({
            'DetailType': 'SalesItemLineDetail',
            'Amount': item['amount'],
            'Description': item['description'],
            'SalesItemLineDetail': {
                'Qty': item['quantity'],
                'UnitPrice': item['unit_price'],
                'TaxCodeRef': {'value': 'TAX'}
            }
        })

    # If updating, preserve QB metadata
    if qb_invoice:
        qb_data['Id'] = qb_invoice.Id
        qb_data['SyncToken'] = qb_invoice.SyncToken

    return qb_data
```

### Stripe Integration

**Webhook Handling:**

```python
@app.route('/webhooks/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return 'Invalid payload', 400
    except stripe.error.SignatureVerificationError:
        return 'Invalid signature', 400

    # Handle the event
    if event.type == 'payment_intent.succeeded':
        payment_intent = event.data.object
        handle_successful_payment(payment_intent)

    elif event.type == 'payment_intent.payment_failed':
        payment_intent = event.data.object
        handle_failed_payment(payment_intent)

    elif event.type == 'charge.refunded':
        charge = event.data.object
        handle_refund(charge)

    return 'Success', 200

def handle_successful_payment(payment_intent):
    # Extract invoice ID from metadata
    invoice_id = payment_intent.metadata.get('invoice_id')

    if not invoice_id:
        logger.warning(f"Payment intent {payment_intent.id} has no invoice_id in metadata")
        return

    invoice = get_invoice(invoice_id)

    # Record payment
    payment_id = create_payment(
        invoice_id=invoice.id,
        amount=payment_intent.amount / 100,  # Convert cents to dollars
        currency=payment_intent.currency.upper(),
        payment_method='credit_card',
        payment_date=datetime.now().date(),
        gateway='stripe',
        gateway_transaction_id=payment_intent.id,
        reference=f"Stripe: {payment_intent.id}",
        status='completed'
    )

    # Send confirmation email
    send_payment_confirmation_email(invoice, payment_id)

    logger.info(f"Recorded payment {payment_id} for invoice {invoice.id}")
```

---

## Notification System

### Multi-channel Architecture

```
Notification Service
         │
         ├─> Channel Router
         │        │
         │        ├─> Email Channel (Amazon SES / SendGrid)
         │        ├─> SMS Channel (Twilio)
         │        ├─> WhatsApp Channel (Twilio WhatsApp API)
         │        └─> Push Channel (FCM / APNs)
         │
         ├─> Template Engine (Handlebars / Mustache)
         │
         ├─> Delivery Tracking
         │        ├─> Sent status
         │        ├─> Delivered status
         │        ├─> Opened tracking (pixel)
         │        ├─> Clicked tracking (link wrapping)
         │        └─> Bounced/Failed handling
         │
         └─> Queue Management (SQS)
                  ├─> Priority queue (immediate)
                  ├─> Standard queue (batched)
                  └─> Retry queue (failed messages)
```

### Email Delivery with Tracking

```python
def send_email(to, subject, template_id, variables, invoice_id=None):
    # Load template
    template = get_email_template(template_id)

    # Render HTML and text versions
    html_body = render_template(template.html_template, variables)
    text_body = render_template(template.text_template, variables)

    # Add tracking pixel to HTML
    tracking_id = generate_tracking_id()
    pixel_url = f"https://track.ourapp.com/pixel/{tracking_id}.gif"
    html_body += f'<img src="{pixel_url}" width="1" height="1" alt="" />'

    # Wrap links for click tracking
    html_body = wrap_links_with_tracking(html_body, tracking_id)

    # Send via Amazon SES
    try:
        response = ses_client.send_email(
            Source='invoices@ourapp.com',
            Destination={'ToAddresses': [to]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Html': {'Data': html_body},
                    'Text': {'Data': text_body}
                }
            },
            ConfigurationSetName='invoice-notifications'  # For bounce/complaint handling
        )

        message_id = response['MessageId']

        # Log communication
        db.execute("""
            INSERT INTO communications (
                organization_id, customer_id, invoice_id,
                type, direction, channel,
                subject, body, status,
                tracking_id, message_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            variables['organization']['id'],
            variables['customer']['id'],
            invoice_id,
            'email',
            'outbound',
            'email',
            subject,
            text_body,
            'sent',
            tracking_id,
            message_id
        ])

        return message_id

    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise

def wrap_links_with_tracking(html, tracking_id):
    """
    Replace all <a> tags with tracking URLs
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, 'html.parser')

    for link in soup.find_all('a'):
        original_url = link.get('href')
        if original_url and not original_url.startswith('mailto:'):
            tracked_url = f"https://track.ourapp.com/click/{tracking_id}?url={quote(original_url)}"
            link['href'] = tracked_url

    return str(soup)

@app.route('/pixel/<tracking_id>.gif')
def tracking_pixel(tracking_id):
    # Record email opened
    db.execute("""
        UPDATE communications
        SET status = 'opened', opened_at = NOW()
        WHERE tracking_id = %s AND opened_at IS NULL
    """, [tracking_id])

    # Return 1x1 transparent GIF
    from io import BytesIO
    import base64

    gif = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    return Response(gif, mimetype='image/gif')

@app.route('/click/<tracking_id>')
def track_click(tracking_id):
    url = request.args.get('url')

    # Record click
    db.execute("""
        UPDATE communications
        SET clicked_at = NOW()
        WHERE tracking_id = %s AND clicked_at IS NULL
    """, [tracking_id])

    # Redirect to original URL
    return redirect(url)
```

### SMS via Twilio

```python
def send_sms(to, message, invoice_id=None):
    try:
        twilio_message = twilio_client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=to
        )

        # Log communication
        db.execute("""
            INSERT INTO communications (
                organization_id, customer_id, invoice_id,
                type, direction, channel,
                body, status, message_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            org_id, customer_id, invoice_id,
            'sms', 'outbound', 'sms',
            message, 'sent', twilio_message.sid
        ])

        return twilio_message.sid

    except Exception as e:
        logger.error(f"Failed to send SMS: {e}")
        raise
```

---

## Analytics & Reporting

### Key Metrics Dashboard

**Cash Flow Metrics:**
```sql
-- Days Sales Outstanding (DSO)
WITH revenue AS (
  SELECT SUM(total_amount) as total_sales
  FROM invoices
  WHERE organization_id = $1
    AND issue_date >= CURRENT_DATE - INTERVAL '90 days'
    AND status != 'cancelled'
),
receivables AS (
  SELECT SUM(balance_due) as total_ar
  FROM invoices
  WHERE organization_id = $1
    AND status IN ('sent', 'overdue', 'partial_paid')
)
SELECT
  (r.total_ar / rev.total_sales * 90) as dso_days
FROM revenue rev, receivables r;

-- Aging Report
SELECT
  CASE
    WHEN CURRENT_DATE - due_date <= 0 THEN 'current'
    WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1-30_days'
    WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31-60_days'
    WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61-90_days'
    ELSE '90+_days'
  END as aging_bucket,
  COUNT(*) as invoice_count,
  SUM(balance_due) as total_amount
FROM invoices
WHERE organization_id = $1
  AND status IN ('sent', 'overdue', 'partial_paid')
GROUP BY aging_bucket;

-- Collection Effectiveness Index (CEI)
SELECT
  (SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) /
   SUM(total_amount) * 100) as cei_percentage
FROM invoices
WHERE organization_id = $1
  AND issue_date >= CURRENT_DATE - INTERVAL '30 days';
```

**Follow-up Effectiveness:**
```sql
-- Reminder response rate
WITH reminder_stats AS (
  SELECT
    template_id,
    COUNT(*) as total_sent,
    COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked_count
  FROM reminders r
  JOIN communications c ON c.id = r.communication_id
  WHERE r.organization_id = $1
    AND r.sent_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY template_id
)
SELECT
  template_id,
  total_sent,
  ROUND(opened_count::numeric / total_sent * 100, 2) as open_rate,
  ROUND(clicked_count::numeric / total_sent * 100, 2) as click_rate
FROM reminder_stats;

-- Time to payment after reminder
SELECT
  AVG(EXTRACT(DAY FROM i.paid_at - r.sent_at)) as avg_days_to_payment
FROM invoices i
JOIN reminders r ON r.invoice_id = i.id
WHERE i.organization_id = $1
  AND i.status = 'paid'
  AND r.sent_at IS NOT NULL
  AND i.paid_at > r.sent_at
  AND r.sent_at >= CURRENT_DATE - INTERVAL '90 days';
```

### Predictive Analytics

**Payment Prediction Model:**
```python
def predict_payment_likelihood(invoice_id):
    """
    Predict probability of on-time payment using ML model
    Features: customer history, invoice amount, terms, season, etc.
    """
    invoice = get_invoice(invoice_id)
    customer = get_customer(invoice.customer_id)

    # Extract features
    features = {
        # Customer features
        'payment_behavior_score': customer.payment_behavior_score or 50,
        'avg_days_late': get_customer_avg_days_late(customer.id),
        'payment_count': get_customer_payment_count(customer.id),
        'total_paid': get_customer_total_paid(customer.id),

        # Invoice features
        'amount': invoice.total_amount,
        'payment_terms_days': parse_payment_terms(invoice.payment_terms),
        'has_previous_invoices': has_previous_invoices(customer.id),
        'days_until_due': (invoice.due_date - date.today()).days,

        # Temporal features
        'month': invoice.issue_date.month,
        'day_of_week': invoice.issue_date.weekday(),
        'is_holiday_season': is_holiday_season(invoice.issue_date),

        # Relationship features
        'customer_age_days': (date.today() - customer.created_at.date()).days,
        'relationship_value': customer.lifetime_value or 0
    }

    # Load pre-trained model
    model = load_model('payment_prediction_model_v2.pkl')

    # Predict
    probability = model.predict_proba([list(features.values())])[0][1]

    return {
        'probability_on_time': probability,
        'confidence': 'high' if probability > 0.8 or probability < 0.3 else 'medium',
        'recommended_action': get_recommended_action(probability)
    }

def get_recommended_action(probability):
    if probability >= 0.8:
        return 'standard_followup'
    elif probability >= 0.5:
        return 'gentle_reminder_early'
    elif probability >= 0.3:
        return 'proactive_outreach'
    else:
        return 'request_payment_plan'
```

---

## Security & Compliance

### Authentication & Authorization

**Multi-Factor Authentication (MFA):**
```python
def enable_mfa(user_id):
    import pyotp

    # Generate secret
    secret = pyotp.random_base32()

    # Save to user
    db.execute(
        "UPDATE users SET mfa_secret = %s, mfa_enabled = TRUE WHERE id = %s",
        [encrypt(secret), user_id]
    )

    # Generate QR code for user to scan
    user = get_user(user_id)
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.email,
        issuer_name='Invoice Follow-up System'
    )

    return {
        'secret': secret,
        'qr_code_url': generate_qr_code(totp_uri)
    }

def verify_mfa(user_id, code):
    import pyotp

    user = get_user(user_id)
    secret = decrypt(user.mfa_secret)

    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)  # Allow ±30 seconds
```

**Role-Based Access Control (RBAC):**
```python
PERMISSIONS = {
    'admin': [
        'invoices:create', 'invoices:read', 'invoices:update', 'invoices:delete',
        'payments:create', 'payments:read', 'payments:update', 'payments:delete',
        'customers:create', 'customers:read', 'customers:update', 'customers:delete',
        'users:create', 'users:read', 'users:update', 'users:delete',
        'settings:read', 'settings:update',
        'integrations:manage'
    ],
    'accountant': [
        'invoices:create', 'invoices:read', 'invoices:update',
        'payments:create', 'payments:read', 'payments:update',
        'customers:read', 'customers:update',
        'reports:read'
    ],
    'manager': [
        'invoices:read',
        'payments:read',
        'customers:read',
        'reports:read'
    ],
    'viewer': [
        'invoices:read',
        'payments:read',
        'customers:read'
    ]
}

def check_permission(user_id, permission):
    user = get_user(user_id)
    return permission in PERMISSIONS.get(user.role, [])

@require_permission('invoices:delete')
def delete_invoice(invoice_id):
    # This function can only be called by admins
    pass
```

### Data Encryption

**Encryption at Rest:**
- Database: AWS RDS encryption with KMS
- Files: S3 server-side encryption (SSE-KMS)
- Backups: Encrypted snapshots

**Encryption in Transit:**
- TLS 1.3 for all API communication
- Certificate pinning for mobile apps

**Field-Level Encryption:**
```python
from cryptography.fernet import Fernet
import base64
from hashlib import sha256

# Derive encryption key from master key + organization ID
def get_encryption_key(organization_id):
    master_key = os.environ['MASTER_ENCRYPTION_KEY']
    derived = sha256(f"{master_key}:{organization_id}".encode()).digest()
    return base64.urlsafe_b64encode(derived)

def encrypt_sensitive_field(value, organization_id):
    key = get_encryption_key(organization_id)
    f = Fernet(key)
    return f.encrypt(value.encode()).decode()

def decrypt_sensitive_field(encrypted_value, organization_id):
    key = get_encryption_key(organization_id)
    f = Fernet(key)
    return f.decrypt(encrypted_value.encode()).decode()

# Use for sensitive fields
customer.ssn = encrypt_sensitive_field(ssn, org_id)
customer.bank_account = encrypt_sensitive_field(account_number, org_id)
```

### PCI DSS Compliance

**Credit Card Data Handling:**
- Never store full credit card numbers
- Use tokenization via Stripe/PayPal
- Only store last 4 digits for display

```python
# Process payment without touching card data
def charge_credit_card(customer_id, amount, stripe_token):
    customer = get_customer(customer_id)

    # Create charge via Stripe (they handle PCI compliance)
    charge = stripe.Charge.create(
        amount=int(amount * 100),  # Convert to cents
        currency='usd',
        source=stripe_token,  # Token from Stripe.js
        description=f'Payment from {customer.name}',
        metadata={'customer_id': customer_id}
    )

    # Store only non-sensitive data
    db.execute("""
        INSERT INTO payment_methods (customer_id, type, last4, stripe_card_id)
        VALUES (%s, %s, %s, %s)
    """, [customer_id, 'credit_card', charge.source.last4, charge.source.id])

    return charge.id
```

### Audit Logging

All financial transactions and sensitive operations are logged:

```python
def log_audit_event(user_id, action, resource_type, resource_id, changes=None):
    db.execute("""
        INSERT INTO audit_logs (
            organization_id, user_id, action, resource_type, resource_id,
            changes, metadata, ip_address, user_agent
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, [
        get_current_org_id(),
        user_id,
        action,
        resource_type,
        resource_id,
        json.dumps(changes),
        json.dumps({'timestamp': datetime.now().isoformat()}),
        request.remote_addr,
        request.user_agent.string
    ])

# Examples:
log_audit_event(user.id, 'invoice.created', 'invoice', invoice.id)
log_audit_event(user.id, 'payment.recorded', 'payment', payment.id, {
    'invoice_id': invoice.id,
    'amount': amount
})
log_audit_event(user.id, 'invoice.deleted', 'invoice', invoice.id, {
    'invoice_number': invoice.invoice_number,
    'reason': 'duplicate'
})
```

### GDPR Compliance

**Right to Access:**
```python
def export_customer_data(customer_id):
    """Export all data associated with a customer"""
    customer = get_customer(customer_id)
    invoices = get_invoices(customer_id=customer_id)
    payments = get_payments(customer_id=customer_id)
    communications = get_communications(customer_id=customer_id)

    return {
        'customer': customer.to_dict(),
        'invoices': [i.to_dict() for i in invoices],
        'payments': [p.to_dict() for p in payments],
        'communications': [c.to_dict() for c in communications]
    }
```

**Right to Erasure:**
```python
def anonymize_customer(customer_id):
    """
    Anonymize customer data while preserving financial records
    (required for tax compliance)
    """
    # Cannot delete invoices/payments (7-year retention requirement)
    # But can anonymize personal data

    db.execute("""
        UPDATE customers
        SET
            name = 'DELETED USER',
            email = CONCAT('deleted_', id, '@example.com'),
            phone = NULL,
            billing_address = NULL,
            notes = NULL,
            custom_fields = NULL,
            status = 'deleted'
        WHERE id = %s
    """, [customer_id])

    # Anonymize communications
    db.execute("""
        UPDATE communications
        SET
            from_address = 'deleted@example.com',
            to_addresses = ARRAY['deleted@example.com'],
            subject = 'REDACTED',
            body = 'REDACTED'
        WHERE customer_id = %s
    """, [customer_id])
```

---

## Scalability & Performance

### Horizontal Scaling

**Stateless Services:**
- All services are stateless and can scale horizontally
- Session data stored in Redis
- No sticky sessions required

**Auto-scaling Configuration (AWS):**
```yaml
# Auto Scaling Group for API servers
AutoScalingGroup:
  MinSize: 5
  MaxSize: 50
  DesiredCapacity: 10
  TargetTrackingScaling:
    - MetricName: CPUUtilization
      TargetValue: 70
    - MetricName: RequestCountPerTarget
      TargetValue: 1000
  ScaleOutCooldown: 60
  ScaleInCooldown: 300
```

### Database Scaling

**Read Replicas:**
- 3-5 read replicas for analytics queries
- Read-write split in application layer
- Replica lag monitoring

```python
# Database connection manager
class DatabaseManager:
    def __init__(self):
        self.master = connect_to_db(MASTER_DB_URL)
        self.replicas = [
            connect_to_db(REPLICA_1_URL),
            connect_to_db(REPLICA_2_URL),
            connect_to_db(REPLICA_3_URL)
        ]
        self.replica_index = 0

    def get_write_connection(self):
        return self.master

    def get_read_connection(self):
        # Round-robin load balancing
        conn = self.replicas[self.replica_index]
        self.replica_index = (self.replica_index + 1) % len(self.replicas)
        return conn

# Usage
db = DatabaseManager()

# Writes go to master
db.get_write_connection().execute("INSERT INTO invoices ...")

# Reads go to replicas
invoices = db.get_read_connection().query("SELECT * FROM invoices ...")
```

**Partitioning Strategy:**
```sql
-- Partition invoices by organization_id for tenant isolation
CREATE TABLE invoices (
  id UUID,
  organization_id UUID,
  ...
) PARTITION BY HASH (organization_id);

-- Create 16 partitions
CREATE TABLE invoices_0 PARTITION OF invoices FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE invoices_1 PARTITION OF invoices FOR VALUES WITH (MODULUS 16, REMAINDER 1);
-- ... up to invoices_15

-- Archive old data
CREATE TABLE invoices_archive (
  LIKE invoices INCLUDING ALL
) PARTITION BY RANGE (issue_date);

-- Move data older than 2 years to archive
INSERT INTO invoices_archive
SELECT * FROM invoices WHERE issue_date < CURRENT_DATE - INTERVAL '2 years';

DELETE FROM invoices WHERE issue_date < CURRENT_DATE - INTERVAL '2 years';
```

### Caching Strategy

**Cache Layers:**

1. **Application Cache (Redis):**
   - Invoice objects (TTL: 5 min)
   - Customer profiles (TTL: 10 min)
   - Computed metrics (TTL: 1 hour)

2. **CDN Cache (CloudFront):**
   - PDF invoices (TTL: 24 hours)
   - Static assets (TTL: 1 year)
   - API responses for public data (TTL: 5 min)

3. **Database Query Cache:**
   - PostgreSQL query results

**Cache Invalidation:**
```python
def update_invoice(invoice_id, updates):
    # Update database
    db.execute("UPDATE invoices SET ... WHERE id = %s", [..., invoice_id])

    # Invalidate caches
    redis.delete(f"invoice:{invoice_id}")
    redis.delete(f"invoices:customer:{invoice.customer_id}")
    redis.delete(f"analytics:dso:{invoice.organization_id}")
    redis.delete(f"analytics:aging:{invoice.organization_id}")

    # Publish event for other cache invalidations
    publish_event('invoice.updated', {'invoice_id': invoice_id})
```

### Rate Limiting

```python
def rate_limit(key, limit, window_seconds):
    """
    Token bucket rate limiting
    """
    current = int(time.time())
    window_start = current - window_seconds

    # Remove old entries
    redis.zremrangebyscore(f"ratelimit:{key}", 0, window_start)

    # Count requests in current window
    count = redis.zcard(f"ratelimit:{key}")

    if count >= limit:
        return False  # Rate limit exceeded

    # Add current request
    redis.zadd(f"ratelimit:{key}", {current: current})
    redis.expire(f"ratelimit:{key}", window_seconds)

    return True

# Middleware
@app.before_request
def check_rate_limit():
    api_key = request.headers.get('X-API-Key')
    org = get_org_by_api_key(api_key)

    # Different limits per plan
    limits = {
        'starter': (100, 60),      # 100 req/min
        'professional': (1000, 60), # 1000 req/min
        'enterprise': (10000, 60)   # 10000 req/min
    }

    limit, window = limits.get(org.plan_type, (100, 60))

    if not rate_limit(f"api:{org.id}", limit, window):
        return jsonify({'error': 'Rate limit exceeded'}), 429
```

---

## Trade-offs & Design Decisions

### 1. Multi-tenant Architecture: Shared vs Isolated Database

**Decision: Shared database with logical isolation**

**Pros:**
- Cost-effective at scale (one database cluster for all tenants)
- Easier maintenance and upgrades
- Resource sharing improves utilization

**Cons:**
- Risk of data leakage (mitigated by row-level security)
- Noisy neighbor problem (mitigated by resource quotas)
- Cannot offer dedicated database to enterprise customers

**Alternative:** Database-per-tenant
- Better isolation but much higher costs
- Harder to manage at scale (1000s of databases)

**Hybrid Solution:**
- Shared database for small/medium tenants
- Dedicated clusters for enterprise customers (>$10K/month)

### 2. Synchronous vs Asynchronous Follow-up Processing

**Decision: Asynchronous with scheduled jobs**

**Pros:**
- Doesn't block invoice creation
- Can batch process for efficiency
- Better error handling and retries

**Cons:**
- Slight delay (up to 5 minutes) before reminders are sent
- More complex architecture

**Why not real-time?**
- Follow-ups don't need sub-second precision
- Batching reduces email sending costs
- Allows smart scheduling (time zones, business hours)

### 3. PostgreSQL vs NoSQL for Invoice Data

**Decision: PostgreSQL for transactional data**

**Pros:**
- ACID guarantees critical for financial data
- Complex queries for reporting
- Strong consistency
- Mature ecosystem

**Cons:**
- Harder to scale horizontally
- Schema migrations can be slow

**Hybrid Approach:**
- PostgreSQL for invoices, payments, customers
- DynamoDB for time-series events, logs
- ElasticSearch for analytics and search

### 4. Push vs Pull for External Integrations

**Decision: Hybrid - webhooks (push) + polling (pull)**

**Push (Webhooks):**
- Real-time for payment gateways (Stripe)
- Requires stable callback URL
- Need to handle retries and idempotency

**Pull (Polling):**
- Every 15 min for accounting software (QuickBooks)
- More reliable (no webhook failures)
- Controlled rate limiting

**Why not just webhooks?**
- Not all systems support webhooks (QuickBooks uses polling)
- Webhooks can fail if our service is down
- Polling provides predictable sync schedule

### 5. Email Delivery: Own SMTP vs Service (SES/SendGrid)

**Decision: Use managed service (Amazon SES + SendGrid backup)**

**Pros:**
- High deliverability (managed IP reputation)
- Automatic bounce/complaint handling
- Pay-per-use pricing
- Built-in analytics

**Cons:**
- Vendor lock-in
- Additional cost per email
- Must comply with their policies

**Why not own SMTP?**
- Maintaining IP reputation is hard
- Risk of being blacklisted
- Requires dedicated team for deliverability

### 6. Real-time Analytics vs Batch Processing

**Decision: Hybrid - real-time dashboards + nightly batch reports**

**Real-time (cached):**
- DSO, aging, outstanding amounts
- Cached for 1 hour, updated on-demand
- Good enough for day-to-day operations

**Batch (nightly):**
- Complex reports (payment trends, predictions)
- ML model training
- Data warehouse sync

**Why not all real-time?**
- Expensive to compute complex metrics on every request
- Most users don't need second-by-second updates
- Batch allows more sophisticated analysis

### 7. Monolith vs Microservices

**Decision: Modular monolith with service boundaries**

**Current Architecture:**
- Single deployable unit
- Internal service boundaries (Invoice, Payment, Communication)
- Can extract to microservices later if needed

**Why not microservices from day 1?**
- Overkill for initial scale (< 1M invoices)
- Distributed systems complexity
- More expensive (separate infrastructure per service)

**Migration Path:**
- Start as monolith
- Extract high-traffic services first (Follow-up Engine, Notification Service)
- Keep transactional services together (Invoice, Payment)

---

## Deployment Architecture

### Infrastructure as Code (Terraform)

```hcl
# Production Environment
module "production" {
  source = "./modules/invoice-system"

  environment = "production"
  region = "us-east-1"

  # Compute
  api_instance_type = "m5.2xlarge"
  api_min_instances = 10
  api_max_instances = 50

  # Database
  db_instance_class = "db.r5.4xlarge"
  db_multi_az = true
  db_read_replicas = 3

  # Cache
  redis_node_type = "cache.r5.2xlarge"
  redis_num_nodes = 3

  # Storage
  s3_lifecycle_rules = {
    invoices_archive = 2555  # 7 years
    audit_logs_archive = 2555
  }

  # Monitoring
  enable_detailed_monitoring = true
  alert_email = "ops@company.com"
}
```

### CI/CD Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy-staging
  - deploy-production

test:
  stage: test
  script:
    - npm install
    - npm run lint
    - npm run test
    - npm run test:integration
  coverage: '/Statements\s*:\s*(\d+\.\d+)%/'

build:
  stage: build
  script:
    - docker build -t invoice-api:$CI_COMMIT_SHA .
    - docker push $ECR_REPO/invoice-api:$CI_COMMIT_SHA

deploy-staging:
  stage: deploy-staging
  script:
    - aws ecs update-service
        --cluster staging-cluster
        --service invoice-api
        --force-new-deployment
  environment:
    name: staging
    url: https://staging-api.invoices.com

deploy-production:
  stage: deploy-production
  script:
    - aws ecs update-service
        --cluster production-cluster
        --service invoice-api
        --force-new-deployment
  environment:
    name: production
    url: https://api.invoices.com
  when: manual  # Requires manual approval
  only:
    - main
```

### Monitoring & Alerting

**CloudWatch Alarms:**
```yaml
alarms:
  - name: HighAPILatency
    metric: TargetResponseTime
    threshold: 1.0  # seconds
    evaluation_periods: 2
    actions:
      - sns:ops-alerts

  - name: HighErrorRate
    metric: HTTPCode_Target_5XX_Count
    threshold: 50
    evaluation_periods: 1
    actions:
      - sns:ops-alerts
      - lambda:auto-rollback

  - name: HighDBConnections
    metric: DatabaseConnections
    threshold: 80  # % of max
    evaluation_periods: 3
    actions:
      - sns:ops-alerts

  - name: ReminderProcessingLag
    metric: custom/ReminderQueueDepth
    threshold: 10000
    evaluation_periods: 2
    actions:
      - sns:ops-alerts
      - lambda:scale-workers
```

---

## Conclusion

This invoice follow-up system is designed to:

1. **Scale to millions of invoices** through horizontal scaling, caching, and database optimization
2. **Ensure data integrity** with ACID transactions and comprehensive audit logging
3. **Maximize payment collection** through intelligent follow-up automation
4. **Integrate seamlessly** with existing accounting and payment systems
5. **Comply with regulations** (GDPR, PCI-DSS, SOC 2)
6. **Provide actionable insights** through analytics and predictive models

### Key Success Metrics

- **DSO Reduction**: Average 15-20% reduction in Days Sales Outstanding
- **Payment Rate**: 90%+ of invoices paid within terms (up from 70%)
- **Manual Work Reduction**: 80% less time spent on follow-ups
- **Customer Satisfaction**: Maintain >4.5/5 rating despite increased automation
- **System Reliability**: 99.95% uptime

### Next Steps for Implementation

1. **Phase 1 (Months 1-3)**: Core invoice management + manual follow-ups
2. **Phase 2 (Months 4-6)**: Automated follow-up engine + email notifications
3. **Phase 3 (Months 7-9)**: Payment integrations + reconciliation
4. **Phase 4 (Months 10-12)**: Advanced analytics + ML predictions
5. **Phase 5 (Year 2)**: Additional integrations + mobile apps
