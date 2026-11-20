---
sidebar_position: 4
---

# Design AWS EC2 Service

A comprehensive high-level design for building a cloud compute service similar to Amazon EC2 (Elastic Compute Cloud) that provides resizable compute capacity in the cloud.

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
9. [Instance Lifecycle Management](#instance-lifecycle-management)
10. [Networking Architecture](#networking-architecture)
11. [Storage Architecture](#storage-architecture)
12. [Security & Access Control](#security--access-control)
13. [Monitoring & Logging](#monitoring--logging)
14. [Scalability & Performance](#scalability--performance)
15. [Disaster Recovery & High Availability](#disaster-recovery--high-availability)
16. [Trade-offs & Design Decisions](#trade-offs--design-decisions)

---

## Problem Statement

Design a cloud compute service that allows users to launch and manage virtual servers (instances) on-demand. Users should be able to:

- Launch virtual machines with different configurations (CPU, memory, storage)
- Choose from various operating systems and software stacks
- Scale compute capacity up or down based on demand
- Pay only for the compute capacity they use
- Access instances remotely via SSH/RDP
- Attach persistent storage volumes
- Configure networking and security settings

### Key Challenges

1. **Resource Management**: Efficiently allocate and manage physical hardware resources across millions of instances
2. **Multi-tenancy**: Isolate customer instances while maximizing resource utilization
3. **Elasticity**: Handle dynamic scaling with millions of start/stop operations per day
4. **Networking**: Provide secure, isolated network environments for each customer
5. **Storage**: Manage persistent and ephemeral storage for millions of instances
6. **Availability**: Ensure high availability across multiple data centers and regions
7. **Billing**: Accurate metering and billing for compute usage

---

## Functional Requirements

### Core Features

**FR1:** Instance Management
- Launch instances with specified configurations (instance type, OS, storage)
- Start, stop, restart, and terminate instances
- List and describe running instances
- Modify instance attributes (instance type, security groups, etc.)

**FR2:** Instance Types
- Support multiple instance families (general-purpose, compute-optimized, memory-optimized, storage-optimized, GPU)
- Each instance type with predefined CPU, memory, and network capacity
- Ability to change instance types (resize)

**FR3:** Operating System Support
- Support multiple OS images (Linux distributions, Windows Server)
- Pre-configured AMIs (Amazon Machine Images) or custom images
- Boot instances from images

**FR4:** Storage Management
- Ephemeral storage (instance store) - temporary, instance-specific
- Persistent storage (EBS volumes) - attachable/detachable block storage
- Support multiple volume types (SSD, HDD, NVMe)
- Create snapshots of volumes

**FR5:** Networking
- Virtual Private Cloud (VPC) - isolated network environment
- Subnets - segment networks within VPC
- Security Groups - firewall rules for instances
- Elastic IP addresses - static public IPs
- Network ACLs - subnet-level firewall

**FR6:** Access Control
- IAM (Identity and Access Management) integration
- Role-based access control
- API authentication via access keys
- SSH key pair management for Linux instances
- Password management for Windows instances

**FR7:** Monitoring & Metrics
- CloudWatch integration for instance metrics
- CPU, memory, disk, network utilization
- Custom metrics and alarms
- Instance logs

**FR8:** Auto Scaling
- Launch instances based on demand
- Scale up/down automatically
- Integration with load balancers

**FR9:** Spot Instances
- Bid for unused capacity at lower prices
- Instances can be terminated when capacity is needed

**FR10:** Reserved Instances
- Reserve capacity for 1-3 years at discounted rates
- Predictable pricing for long-term workloads

### Optional Features

**FR11:** Dedicated Instances - Single-tenant hardware

**FR12:** Placement Groups - Control instance placement for low latency

**FR13:** Elastic GPUs - Attach GPU resources to instances

**FR14:** Instance Metadata Service - Access instance metadata

**FR15:** User Data Scripts - Run scripts at instance launch

---

## Non-Functional Requirements

### Performance

**NFR1:** High Availability - 99.99% uptime SLA

**NFR2:** Low Latency - Instance launch time < 60 seconds

**NFR3:** High Throughput - Support millions of API calls per second

**NFR4:** Network Performance - Up to 100 Gbps per instance

### Scalability

**NFR5:** Handle millions of concurrent instances across multiple regions

**NFR6:** Support thousands of instance types and configurations

**NFR7:** Scale to petabytes of storage across all instances

### Reliability

**NFR8:** Data Durability - 99.999999999% (11 nines) for EBS volumes

**NFR9:** Instance Migration - Automatic migration during hardware failures

**NFR10:** Multi-AZ Support - Distribute instances across availability zones

### Security

**NFR11:** Network Isolation - Complete isolation between customer instances

**NFR12:** Encryption - Support encryption at rest and in transit

**NFR13:** Compliance - Support various compliance standards (SOC, PCI-DSS, HIPAA)

### Cost

**NFR14:** Pay-per-use billing model

**NFR15:** Cost optimization through reserved instances and spot pricing

---

## Capacity Estimation

### Traffic Estimates

- **Total customers**: 1 million
- **Active customers**: 100,000 (10% active monthly)
- **Instances per customer**: Average 10 instances
- **Total running instances**: 1 million
- **API calls per day**: 1 billion
  - Launch: 10 million/day
  - Describe: 500 million/day
  - Start/Stop: 50 million/day
  - Terminate: 5 million/day
  - Other operations: 435 million/day
- **Read-to-write ratio**: 50:1 (more reads than writes)

### Storage Estimates

- **Instance metadata**: 1 KB per instance = 1 GB total
- **AMI images**: 10,000 images × 10 GB average = 100 TB
- **EBS volumes**: 1 million instances × 100 GB average = 100 PB
- **Snapshots**: 10% of volumes = 10 PB
- **Logs**: 1 MB per instance per day = 1 TB/day

### Network Estimates

- **API traffic**: 1 billion requests × 2 KB average = 2 TB/day
- **Instance traffic**: 1 million instances × 10 GB/day = 10 PB/day
- **Peak bandwidth**: 1 Tbps

### Compute Estimates

- **Physical servers**: 100,000 servers
- **Average utilization**: 60% (for over-provisioning)
- **Virtualization ratio**: 10:1 (10 VMs per physical server)
- **Total capacity**: 1 million VMs

### Conclusions

- **1 billion API calls/day at a 50:1 read-to-write ratio** means the system has to be built as a read-heavy workload from the start — caching and read replicas have to absorb most of that traffic, because hitting the primary database for every `describeInstances` call would make the database the bottleneck long before physical compute capacity is.
- **100 PB of EBS volumes plus 10 PB of snapshots** rules out any single storage array or filer. This only works as a distributed block storage system spread across many machines, which is why Storage Architecture (below) treats EBS as a distributed system with its own replication, not as a disk attached to a database server.
- **1 Tbps of peak instance network traffic** has to be spread across many physical links rather than one — it's why Networking Architecture (below) runs on an overlay (VXLAN/GRE) across many physical switches instead of relying on a single oversized pipe.
- **A 10:1 virtualization ratio packing 1 million VMs onto 100,000 physical servers** only stays safe if the hypervisor enforces hard isolation between tenants sharing a host. This is why Hypervisor Management (Core Components, below) treats CPU pinning, memory ballooning, and I/O throttling as required features, not optional ones.

---

## System APIs

### Instance Management APIs

#### 1. Launch Instance

```http
POST /api/v1/instances
Authorization: AWS4-HMAC-SHA256 Credential=...

Request Body:
{
  "imageId": "ami-12345678",
  "instanceType": "t3.medium",
  "keyName": "my-key-pair",
  "securityGroupIds": ["sg-12345678"],
  "subnetId": "subnet-12345678",
  "userData": "#!/bin/bash\necho 'Hello World'",
  "storage": {
    "volumes": [
      {
        "deviceName": "/dev/sda1",
        "volumeType": "gp3",
        "volumeSize": 20,
        "deleteOnTermination": true
      }
    ]
  },
  "tags": [
    {"key": "Name", "value": "web-server-1"},
    {"key": "Environment", "value": "production"}
  ],
  "minCount": 1,
  "maxCount": 1
}

Response:
{
  "instances": [
    {
      "instanceId": "i-1234567890abcdef0",
      "state": "pending",
      "instanceType": "t3.medium",
      "launchTime": "2024-01-15T10:30:00Z",
      "privateIpAddress": "10.0.1.5",
      "publicIpAddress": "54.123.45.67"
    }
  ]
}
```

#### 2. Describe Instances

```http
GET /api/v1/instances?instanceIds=i-1234567890abcdef0,i-0987654321fedcba0
Authorization: AWS4-HMAC-SHA256 Credential=...

Response:
{
  "instances": [
    {
      "instanceId": "i-1234567890abcdef0",
      "state": "running",
      "instanceType": "t3.medium",
      "imageId": "ami-12345678",
      "launchTime": "2024-01-15T10:30:00Z",
      "privateIpAddress": "10.0.1.5",
      "publicIpAddress": "54.123.45.67",
      "vpcId": "vpc-12345678",
      "subnetId": "subnet-12345678",
      "securityGroups": [
        {
          "groupId": "sg-12345678",
          "groupName": "web-servers"
        }
      ],
      "tags": [
        {"key": "Name", "value": "web-server-1"}
      ]
    }
  ]
}
```

#### 3. Start Instance

```http
POST /api/v1/instances/{instanceId}/start
Authorization: AWS4-HMAC-SHA256 Credential=...

Response:
{
  "instanceId": "i-1234567890abcdef0",
  "previousState": "stopped",
  "currentState": "pending"
}
```

#### 4. Stop Instance

```http
POST /api/v1/instances/{instanceId}/stop
Authorization: AWS4-HMAC-SHA256 Credential=...

Response:
{
  "instanceId": "i-1234567890abcdef0",
  "previousState": "running",
  "currentState": "stopping"
}
```

#### 5. Terminate Instance

```http
POST /api/v1/instances/{instanceId}/terminate
Authorization: AWS4-HMAC-SHA256 Credential=...

Response:
{
  "instanceId": "i-1234567890abcdef0",
  "previousState": "running",
  "currentState": "shutting-down"
}
```

#### 6. Modify Instance Attributes

```http
PUT /api/v1/instances/{instanceId}
Authorization: AWS4-HMAC-SHA256 Credential=...

Request Body:
{
  "instanceType": "t3.large",
  "securityGroupIds": ["sg-12345678", "sg-87654321"]
}

Response:
{
  "instanceId": "i-1234567890abcdef0",
  "modifications": {
    "instanceType": "t3.large",
    "securityGroups": ["sg-12345678", "sg-87654321"]
  }
}
```

### Image Management APIs

#### 7. Create Image (AMI)

```http
POST /api/v1/images
Authorization: AWS4-HMAC-SHA256 Credential=...

Request Body:
{
  "instanceId": "i-1234567890abcdef0",
  "name": "my-custom-ami",
  "description": "Custom AMI with web server",
  "noReboot": false
}

Response:
{
  "imageId": "ami-12345678",
  "state": "pending",
  "name": "my-custom-ami"
}
```

#### 8. Describe Images

```http
GET /api/v1/images?imageIds=ami-12345678
Authorization: AWS4-HMAC-SHA256 Credential=...

Response:
{
  "images": [
    {
      "imageId": "ami-12345678",
      "name": "my-custom-ami",
      "description": "Custom AMI with web server",
      "state": "available",
      "architecture": "x86_64",
      "platform": "Linux",
      "creationDate": "2024-01-15T10:30:00Z",
      "rootDeviceType": "ebs",
      "blockDeviceMappings": [
        {
          "deviceName": "/dev/sda1",
          "ebs": {
            "volumeId": "vol-12345678",
            "deleteOnTermination": true
          }
        }
      ]
    }
  ]
}
```

### Volume Management APIs

#### 9. Create Volume

```http
POST /api/v1/volumes
Authorization: AWS4-HMAC-SHA256 Credential=...

Request Body:
{
  "availabilityZone": "us-east-1a",
  "volumeType": "gp3",
  "size": 100,
  "encrypted": true,
  "kmsKeyId": "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012"
}

Response:
{
  "volumeId": "vol-1234567890abcdef0",
  "state": "creating",
  "size": 100,
  "volumeType": "gp3",
  "availabilityZone": "us-east-1a"
}
```

#### 10. Attach Volume

```http
POST /api/v1/volumes/{volumeId}/attach
Authorization: AWS4-HMAC-SHA256 Credential=...

Request Body:
{
  "instanceId": "i-1234567890abcdef0",
  "device": "/dev/sdf"
}

Response:
{
  "volumeId": "vol-1234567890abcdef0",
  "instanceId": "i-1234567890abcdef0",
  "device": "/dev/sdf",
  "state": "attaching"
}
```

---

## Database Design

Two partitioning strategies recur in the tables below, and each solves a different problem. Tables like `instances` partition by `HASH(account_id)` so that one customer's load — a burst of launches, a large `describeInstances` scan — stays confined to one shard instead of competing with every other customer's traffic on the same partition. Tables like `instance_metrics` and `billing_records` instead partition `RANGE` by year, because those tables only ever grow: old partitions can be dropped or archived to cold storage wholesale once a year's data ages out, which a hash partition can't do without touching every shard.

### 1. Instances Table

```sql
CREATE TABLE instances (
    instance_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    image_id VARCHAR(20) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    state ENUM('pending', 'running', 'stopping', 'stopped', 'shutting-down', 'terminated') NOT NULL,
    availability_zone VARCHAR(20) NOT NULL,
    subnet_id VARCHAR(20),
    vpc_id VARCHAR(20),
    private_ip_address VARCHAR(15),
    public_ip_address VARCHAR(15),
    elastic_ip_address VARCHAR(15),
    key_name VARCHAR(255),
    launch_time TIMESTAMP NOT NULL,
    termination_time TIMESTAMP,
    user_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_account_id (account_id),
    INDEX idx_state (state),
    INDEX idx_availability_zone (availability_zone),
    INDEX idx_launch_time (launch_time)
) PARTITION BY HASH(account_id);
```

### 2. Instance Tags Table

```sql
CREATE TABLE instance_tags (
    instance_id VARCHAR(20) NOT NULL,
    tag_key VARCHAR(255) NOT NULL,
    tag_value VARCHAR(255),
    PRIMARY KEY (instance_id, tag_key),
    FOREIGN KEY (instance_id) REFERENCES instances(instance_id) ON DELETE CASCADE,
    INDEX idx_tag_key_value (tag_key, tag_value)
);
```

### 3. Security Groups Table

```sql
CREATE TABLE security_groups (
    security_group_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    description TEXT,
    vpc_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_account_group (account_id, group_name, vpc_id),
    INDEX idx_account_id (account_id)
);
```

### 4. Security Group Rules Table

```sql
CREATE TABLE security_group_rules (
    rule_id VARCHAR(20) PRIMARY KEY,
    security_group_id VARCHAR(20) NOT NULL,
    type ENUM('ingress', 'egress') NOT NULL,
    protocol VARCHAR(10) NOT NULL,
    from_port INT,
    to_port INT,
    cidr_ipv4 VARCHAR(18),
    source_security_group_id VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (security_group_id) REFERENCES security_groups(security_group_id) ON DELETE CASCADE,
    INDEX idx_security_group_id (security_group_id)
);
```

### 5. Instance Security Groups Table

```sql
CREATE TABLE instance_security_groups (
    instance_id VARCHAR(20) NOT NULL,
    security_group_id VARCHAR(20) NOT NULL,
    PRIMARY KEY (instance_id, security_group_id),
    FOREIGN KEY (instance_id) REFERENCES instances(instance_id) ON DELETE CASCADE,
    FOREIGN KEY (security_group_id) REFERENCES security_groups(security_group_id) ON DELETE CASCADE
);
```

### 6. Images (AMIs) Table

```sql
CREATE TABLE images (
    image_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    state ENUM('pending', 'available', 'deregistered', 'failed') NOT NULL,
    architecture VARCHAR(20) NOT NULL,
    platform VARCHAR(50),
    root_device_type VARCHAR(20) NOT NULL,
    root_device_name VARCHAR(255),
    creation_date TIMESTAMP NOT NULL,
    public BOOLEAN DEFAULT FALSE,
    INDEX idx_account_id (account_id),
    INDEX idx_state (state),
    INDEX idx_name (name)
);
```

### 7. Volumes Table

```sql
CREATE TABLE volumes (
    volume_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    availability_zone VARCHAR(20) NOT NULL,
    volume_type VARCHAR(50) NOT NULL,
    size INT NOT NULL,
    state ENUM('creating', 'available', 'in-use', 'deleting', 'deleted', 'error') NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    kms_key_id VARCHAR(255),
    iops INT,
    throughput INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_id (account_id),
    INDEX idx_state (state),
    INDEX idx_availability_zone (availability_zone)
);
```

### 8. Volume Attachments Table

```sql
CREATE TABLE volume_attachments (
    volume_id VARCHAR(20) NOT NULL,
    instance_id VARCHAR(20) NOT NULL,
    device VARCHAR(255) NOT NULL,
    state ENUM('attaching', 'attached', 'detaching', 'detached') NOT NULL,
    attach_time TIMESTAMP,
    delete_on_termination BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (volume_id, instance_id),
    FOREIGN KEY (volume_id) REFERENCES volumes(volume_id) ON DELETE CASCADE,
    FOREIGN KEY (instance_id) REFERENCES instances(instance_id) ON DELETE CASCADE,
    INDEX idx_instance_id (instance_id)
);
```

### 9. Snapshots Table

```sql
CREATE TABLE snapshots (
    snapshot_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    volume_id VARCHAR(20) NOT NULL,
    state ENUM('pending', 'completed', 'error') NOT NULL,
    progress INT DEFAULT 0,
    size INT NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    start_time TIMESTAMP NOT NULL,
    completed_time TIMESTAMP,
    description TEXT,
    INDEX idx_account_id (account_id),
    INDEX idx_volume_id (volume_id),
    INDEX idx_state (state)
);
```

### 10. Instance Metrics Table (Time-Series)

```sql
CREATE TABLE instance_metrics (
    instance_id VARCHAR(20) NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10, 2) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    PRIMARY KEY (instance_id, metric_name, timestamp),
    INDEX idx_timestamp (timestamp)
) PARTITION BY RANGE (YEAR(timestamp));
```

### 11. Reservations Table

```sql
CREATE TABLE reservations (
    reservation_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(12) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    availability_zone VARCHAR(20),
    instance_count INT NOT NULL,
    state ENUM('active', 'payment-pending', 'retired') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    offering_type ENUM('Heavy Utilization', 'Medium Utilization', 'Light Utilization') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_id (account_id),
    INDEX idx_state (state)
);
```

### 12. Billing Records Table

```sql
CREATE TABLE billing_records (
    billing_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    account_id VARCHAR(12) NOT NULL,
    instance_id VARCHAR(20),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    usage_start TIMESTAMP NOT NULL,
    usage_end TIMESTAMP NOT NULL,
    usage_quantity DECIMAL(10, 4) NOT NULL,
    unit_price DECIMAL(10, 4) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    region VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_id (account_id),
    INDEX idx_usage_start (usage_start),
    INDEX idx_instance_id (instance_id)
) PARTITION BY RANGE (YEAR(usage_start));
```

---

## High-Level Architecture

The diagram below splits the system into six layers because each one changes, scales, and fails on a different schedule. The Application Layer's services hold no state of their own, so they can be redeployed independently and often; the Infrastructure Layer underneath (physical hypervisor hosts, storage backends, network gear) changes far less often, and a mistake there can affect running customer instances directly. Keeping these as separate layers means an API-layer bug — a broken rate limiter, a bad input check — can be rolled back without ever touching a host that has customer VMs running on it, and a hardware failure never has to wait on an application deploy to be handled.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web UI     │  │   CLI Tools   │  │   SDK/API    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    API Gateway Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Load Balancer (ALB/NLB)                      │   │
│  └───────────────────────────┬────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         API Gateway (Rate Limiting, Auth, Routing)        │   │
│  └────────────────────────────┼────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                    Application Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Instance Management Service (Stateless)           │   │
│  │  - Launch/Start/Stop/Terminate                            │   │
│  │  - Describe Instances                                     │   │
│  │  - Modify Attributes                                      │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Image Management Service                          │   │
│  │  - Create/Describe Images                                 │   │
│  │  - Image Registry                                         │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Storage Management Service                        │   │
│  │  - Volume Create/Attach/Detach                           │   │
│  │  - Snapshot Management                                    │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Networking Service                                │   │
│  │  - VPC/Subnet Management                                  │   │
│  │  - Security Groups                                        │   │
│  │  - IP Address Management                                  │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Orchestration Service                            │   │
│  │  - Resource Scheduling                                   │   │
│  │  - Capacity Management                                    │   │
│  │  - Placement Decisions                                   │   │
│  └────────────────────────────┼────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                    Control Plane Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Hypervisor Management                            │   │
│  │  - Instance Lifecycle Control                            │   │
│  │  - Resource Allocation                                   │   │
│  │  - Health Monitoring                                     │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Network Controller                               │   │
│  │  - Virtual Network Management                            │   │
│  │  - Security Group Enforcement                            │   │
│  │  - Routing & NAT                                         │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Storage Controller                               │   │
│  │  - Volume Management                                     │   │
│  │  - Snapshot Management                                   │   │
│  │  - Storage Backend Coordination                          │   │
│  └────────────────────────────┼────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                    Data Layer                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Metadata Database (MySQL/PostgreSQL)              │   │
│  │  - Instance Metadata                                     │   │
│  │  - Images, Volumes, Snapshots                            │   │
│  │  - Security Groups, Tags                                 │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Time-Series DB (InfluxDB/TimescaleDB)            │   │
│  │  - Metrics & Monitoring                                  │   │
│  │  - Billing Data                                          │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Cache (Redis)                                    │   │
│  │  - Instance State Cache                                 │   │
│  │  - Security Group Rules Cache                           │   │
│  │  - Rate Limiting                                        │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Message Queue (Kafka/RabbitMQ)                   │   │
│  │  - Event Streaming                                      │   │
│  │  - Async Operations                                     │   │
│  │  - State Change Events                                  │   │
│  └────────────────────────────┼────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────┐
│                    Infrastructure Layer                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Compute Nodes (Hypervisor Hosts)                 │   │
│  │  - KVM/Xen/Hyper-V                                       │   │
│  │  - Instance Execution                                    │   │
│  │  - Local Storage (Instance Store)                        │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Storage Backend                                   │   │
│  │  - Block Storage (EBS)                                   │   │
│  │  - Object Storage (S3) for Images                       │   │
│  │  - Distributed File System                              │   │
│  └────────────────────────────┼────────────────────────────┘   │
│                               │                                   │
│  ┌────────────────────────────┼────────────────────────────┐   │
│  │         Network Infrastructure                           │   │
│  │  - Physical Network                                      │   │
│  │  - SDN Controllers                                       │   │
│  │  - Load Balancers                                        │   │
│  └────────────────────────────┴────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. API Gateway

Every service below would otherwise need its own authentication, rate limiting, and request validation. The API Gateway exists to do that once, in one place, so a change to how IAM credentials are checked means editing one component instead of nine.

**Responsibilities:**
- Request routing and load balancing
- Authentication and authorization (IAM integration)
- Rate limiting and throttling
- Request/response transformation
- API versioning

**Technology:** AWS API Gateway, Kong, or custom gateway

**Scalability:**
- Stateless design for horizontal scaling
- Multiple instances behind load balancer
- Caching for frequently accessed data

### 2. Instance Management Service

This service owns the customer-facing state of an instance — what the API reports as pending, running, or stopped — while deciding *where* an instance actually runs is delegated to the Orchestration Service below. Splitting the two apart means the public API, and its <60s launch target (NFR2), doesn't get slower just because the placement logic underneath grows more sophisticated over time.

**Responsibilities:**
- Handle instance lifecycle operations (launch, start, stop, terminate)
- Validate instance configurations
- Coordinate with orchestration service
- Update instance state in database
- Emit events for state changes

**Key Operations:**
- `launchInstance(request)` → Returns instance ID
- `startInstance(instanceId)` → Starts stopped instance
- `stopInstance(instanceId)` → Stops running instance
- `terminateInstance(instanceId)` → Terminates instance
- `describeInstances(filters)` → Returns instance details
- `modifyInstance(instanceId, attributes)` → Updates instance

**State Machine:**
```
pending → running → stopping → stopped
   ↓         ↓
running → shutting-down → terminated
```

### 3. Orchestration Service

Deciding where an instance runs needs a global view — which availability zone has spare capacity, which hypervisor host can fit this instance type right now — that shouldn't have to be computed synchronously inside an API request. Pulling placement logic into its own service means placement strategies (spread, cluster, or partition placement, covered in Trade-offs below) can be tuned or replaced without changing the instance lifecycle API at all.

**Responsibilities:**
- Resource scheduling and placement
- Capacity management
- Instance placement decisions
- Health monitoring and auto-recovery
- Migration during hardware failures

**Placement Algorithm:**
1. Check availability zone capacity
2. Find suitable hypervisor host
3. Check resource availability (CPU, memory, network)
4. Consider placement constraints (dedicated, placement groups)
5. Reserve resources
6. Return placement decision

**Capacity Management:**
- Track available capacity per AZ
- Predict capacity needs
- Auto-scale hypervisor infrastructure
- Handle capacity constraints

### 4. Hypervisor Management

This is the only layer that actually touches physical hardware, which is why resource isolation lives here rather than in the Orchestration Service above it. *Deciding* which host an instance lands on and *enforcing* isolation on that host are different concerns — conflating them would mean a bug in scheduling logic could also compromise the boundary between tenants sharing the same server.

**Responsibilities:**
- Manage hypervisor hosts
- Allocate/deallocate resources
- Monitor host health
- Handle host failures
- Resource isolation and multi-tenancy

**Hypervisor Types:**
- **KVM** (Kernel-based Virtual Machine) - Linux
- **Xen** - Paravirtualization
- **Hyper-V** - Windows
- **VMware ESXi** - Enterprise

**Resource Isolation:**
- CPU pinning and quotas
- Memory ballooning
- Network bandwidth limiting
- I/O throttling

### 5. Image Management Service

Images are read far more often than they're written — thousands of instances can boot from the same popular AMI — and the same image often needs to be shared across accounts and regions. Those access patterns match object storage, not a transactional database, which is why this service's data path (below) stores images in S3-style object storage rather than the block storage used for live volumes.

**Responsibilities:**
- Store and manage AMI images
- Image versioning
- Image sharing (public/private)
- Image metadata management
- Boot image preparation

**Image Storage:**
- Images stored in object storage (S3)
- Metadata in database
- Image registry for quick lookup
- Support for multiple formats (RAW, QCOW2, VMDK)

**Image Lifecycle:**
1. Create image from instance
2. Store in object storage
3. Create metadata record
4. Make available for launch

### 6. Storage Management Service

EBS volumes are deliberately decoupled from any single instance: they can be created, attached, detached, and re-attached to a different instance independently of that instance's own lifecycle. This service exists to own that independent lifecycle, which is what makes persistent, instance-independent storage possible in the first place (see Storage Architecture below).

**Responsibilities:**
- Create and manage EBS volumes
- Volume attachment/detachment
- Snapshot creation and management
- Volume encryption
- Storage backend coordination

**Volume Types:**
- **gp3** - General Purpose SSD (3 IOPS/GB, up to 16,000 IOPS)
- **gp2** - General Purpose SSD (3 IOPS/GB baseline)
- **io1/io2** - Provisioned IOPS SSD (up to 64,000 IOPS)
- **st1** - Throughput Optimized HDD
- **sc1** - Cold HDD

**Storage Backend:**
- Distributed block storage system
- Replication across multiple AZs
- Encryption at rest
- Snapshot storage in object storage

### 7. Networking Service

Security group and network ACL rules have to be enforced consistently for every instance in a customer's VPC, no matter which hypervisor host that instance happens to land on. Centralizing rule management here, instead of letting each host keep its own copy, is what keeps a security group update applied everywhere at once rather than drifting host by host.

**Responsibilities:**
- VPC and subnet management
- Security group rule enforcement
- IP address allocation
- NAT gateway management
- Network ACL management

**Network Architecture:**
- **VPC** - Isolated network per customer
- **Subnets** - Network segments within VPC
- **Security Groups** - Instance-level firewall
- **Network ACLs** - Subnet-level firewall
- **Route Tables** - Routing configuration

**IP Management:**
- Private IP allocation from subnet CIDR
- Public IP allocation from public pool
- Elastic IP reservation
- IP address tracking

### 8. Monitoring Service

The Orchestration Service's auto-recovery and migration, and NFR9's requirement to migrate instances automatically during hardware failures, both depend on knowing a host or instance is unhealthy before the customer notices. This service is what produces that signal, which is why it runs as a continuous collection pipeline rather than something queried on demand.

**Responsibilities:**
- Collect instance metrics
- Store metrics in time-series database
- Generate alarms
- Instance health checks
- Log aggregation

**Metrics Collected:**
- CPU utilization
- Memory utilization
- Disk I/O
- Network I/O
- Instance status checks

**Monitoring Architecture:**
- Agent on hypervisor host collects metrics
- Metrics sent to monitoring service
- Stored in time-series database
- CloudWatch-like interface for querying

### 9. Billing Service

Metering has to keep running while instances start, stop, and terminate continuously. Tying billing calculations directly into the Instance Management Service's request path would mean a slow billing calculation could delay a `stopInstance` call — keeping billing a separate, event-driven service means usage metering never blocks a lifecycle operation.

**Responsibilities:**
- Meter instance usage
- Calculate costs
- Generate billing records
- Handle different pricing models (on-demand, reserved, spot)

**Pricing Models:**
- **On-Demand** - Pay per hour/second
- **Reserved** - 1-3 year commitment, discounted
- **Spot** - Bid for unused capacity
- **Dedicated** - Single-tenant hardware

**Billing Calculation:**
- Track instance runtime
- Apply pricing based on instance type
- Factor in data transfer costs
- Generate hourly/daily billing records

---

## Instance Lifecycle Management

### Launch Flow

```
1. Client → API Gateway
   POST /api/v1/instances
   {
     "imageId": "ami-12345678",
     "instanceType": "t3.medium",
     ...
   }

2. API Gateway
   - Authenticate request
   - Rate limit check
   - Route to Instance Management Service

3. Instance Management Service
   - Validate request
   - Check account limits
   - Create instance record in DB (state: pending)
   - Publish event: InstanceLaunchRequested

4. Orchestration Service (Event Consumer)
   - Receive launch event
   - Select availability zone
   - Find suitable hypervisor host
   - Reserve resources
   - Return placement decision

5. Hypervisor Management
   - Receive placement decision
   - Allocate resources on host
   - Download image from object storage
   - Create virtual machine
   - Configure networking
   - Start instance

6. Instance Management Service
   - Receive instance started notification
   - Update DB (state: running)
   - Allocate IP addresses
   - Apply security groups
   - Publish event: InstanceRunning

7. Response to Client
   {
     "instanceId": "i-1234567890abcdef0",
     "state": "running",
     "privateIpAddress": "10.0.1.5",
     "publicIpAddress": "54.123.45.67"
   }
```

### State Transitions

```
┌─────────┐
│ pending │  ← Instance launch initiated
└────┬────┘
     │
     │ (resources allocated, VM started)
     ↓
┌─────────┐
│ running │  ← Instance is operational
└────┬────┘
     │
     │ (stop command)
     ↓
┌──────────┐
│stopping  │  ← Graceful shutdown initiated
└────┬─────┘
     │
     │ (shutdown complete)
     ↓
┌─────────┐
│ stopped │  ← Instance stopped, resources retained
└────┬────┘
     │
     │ (start command)
     ↓
┌─────────┐
│ running │
└────┬────┘
     │
     │ (terminate command)
     ↓
┌──────────────┐
│shutting-down │  ← Termination initiated
└──────┬───────┘
       │
       │ (cleanup complete)
       ↓
┌────────────┐
│ terminated │  ← Instance deleted, resources released
└────────────┘
```

Three of these states — `pending`, `stopping`, and `shutting-down` — exist because the operations behind them take real time and can fail partway through. `pending` lets the API hand back an instance ID the moment a launch request is accepted, instead of making the client wait the full 30-60 seconds it takes the hypervisor to actually boot a VM — the <60s launch target in NFR2 depends on not blocking the response on this. `stopping` gives the guest OS a window to flush its in-memory state to EBS before power-off; collapsing `running` straight to `stopped` would risk tearing the instance down mid-write, with whatever the application was saving at that instant lost or corrupted. Once an instance reaches `stopped`, its hypervisor host and any ephemeral Instance Store are released — that data is simply gone (see Storage Architecture below) — which is why restarting a stopped instance isn't a resume: it re-enters the Launch Flow above and goes through placement on a host again, exactly like a fresh launch.

### Health Monitoring

**Instance Status Checks:**
1. **System Status Check** - Hypervisor host health
2. **Instance Status Check** - Instance reachability

These two checks stay separate because the fix differs depending on which one fails: a failing host (power, networking, a dead disk) is something only EC2 can act on by moving the instance elsewhere, while an unresponsive instance (a kernel panic, a hung process) is often resolved by a simple restart that doesn't need a new host at all.

**Auto-Recovery:**
- If system status check fails → Migrate instance to healthy host
- If instance status check fails → Attempt recovery, then notify user
- Health checks every 1-2 minutes

---

## Networking Architecture

### Virtual Private Cloud (VPC)

**VPC Structure:**
```
VPC (10.0.0.0/16)
├── Public Subnet (10.0.1.0/24) - AZ: us-east-1a
│   ├── Internet Gateway
│   ├── NAT Gateway
│   └── Instances with public IPs
├── Private Subnet (10.0.2.0/24) - AZ: us-east-1a
│   └── Instances without public IPs
└── Public Subnet (10.0.3.0/24) - AZ: us-east-1b
    └── Instances with public IPs
```

Each customer gets their own VPC and address range instead of sharing one address space because customers routinely reuse the same private ranges — `10.0.0.0/16` is a common default — across their own on-premises networks and other VPCs they own. Without per-customer isolation, two unrelated customers both using `10.0.1.5` would collide. The overlay networking covered in Trade-offs below (VXLAN/GRE) is what makes giving every customer an independent address space possible on top of physical network hardware that's actually shared.

### Security Groups

**Rule Structure:**
```json
{
  "securityGroupId": "sg-12345678",
  "rules": [
    {
      "type": "ingress",
      "protocol": "tcp",
      "fromPort": 80,
      "toPort": 80,
      "source": "0.0.0.0/0",
      "description": "Allow HTTP from anywhere"
    },
    {
      "type": "ingress",
      "protocol": "tcp",
      "fromPort": 22,
      "toPort": 22,
      "source": "sg-87654321",
      "description": "Allow SSH from bastion"
    },
    {
      "type": "egress",
      "protocol": "-1",
      "fromPort": 0,
      "toPort": 65535,
      "destination": "0.0.0.0/0",
      "description": "Allow all outbound"
    }
  ]
}
```

**Enforcement:**
- Security group rules enforced at hypervisor level
- Stateful firewall (return traffic automatically allowed)
- Rules evaluated in order
- Default deny all inbound, allow all outbound

Enforcing rules at the hypervisor, outside the guest OS, matters because a customer has root access inside their own instance. If the firewall lived inside the guest, that same root access would let them disable it; enforcing it one layer below is what makes a security group an actual boundary rather than a setting the customer could turn off.

### Network Isolation

**Multi-Tenancy:**
- Each customer gets isolated VPC
- Network virtualization (VXLAN, GRE tunnels)
- MAC address isolation
- VLAN tagging per customer

Each mechanism here closes a different gap: VXLAN/GRE tunnels keep one customer's traffic from being visible on the physical wire shared with others, MAC address isolation stops one tenant's VM from spoofing another's network identity, and VLAN tagging lets the physical switches drop a misdirected packet before it ever reaches the wrong host.

**Traffic Flow:**
```
Instance → Virtual Switch → Security Group Enforcement → 
Physical Network → Internet Gateway / NAT Gateway
```

---

## Storage Architecture

### Storage Types

#### 1. Instance Store (Ephemeral)

**Characteristics:**
- Temporary storage on hypervisor host
- High performance (NVMe SSD)
- Data lost on instance stop/terminate
- Included with instance at no extra cost

**Use Cases:**
- Temporary files
- Cache
- Scratch space
- High-performance workloads

#### 2. EBS Volumes (Persistent)

**Characteristics:**
- Network-attached block storage
- Persistent across instance lifecycle
- Can be attached/detached
- Replicated across multiple AZs
- Encryption support

**Volume Lifecycle:**
```
Create Volume → Available → Attach → In-Use → 
Detach → Available → Delete → Deleted
```

The loop back through `Available` after `Detach` — rather than going straight to `Deleted` — is what makes EBS useful as persistent, instance-independent storage: a detached volume keeps its data and can be attached to a different instance later, which is the entire point of separating EBS from the Instance Store in the first place.

**Snapshot Process:**
1. Create snapshot request
2. Freeze filesystem (if supported)
3. Copy data blocks to object storage
4. Unfreeze filesystem
5. Mark snapshot as completed

The freeze step exists because a snapshot is a block-level copy, not an application-aware backup. Without briefly quiescing the filesystem, step 3 could copy a volume mid-write and capture, say, half of a database transaction — with no way to tell afterward that the data on disk is inconsistent.

### Storage Backend

**Architecture:**
```
EBS Volume Request
    ↓
Storage Controller
    ↓
Distributed Block Storage
    ├── Replication (3x across AZs)
    ├── Encryption (optional)
    └── Snapshot to Object Storage
```

**Data Durability:**
- 99.999999999% (11 nines) for EBS volumes
- Achieved through replication
- Automatic repair of corrupted blocks

This works because the 3x replication above spreads copies across physically separate AZs with independent power and cooling (see Disaster Recovery & High Availability below). For data to actually be lost, the same block would have to fail in three unrelated facilities at once — a scenario rare enough to push the failure probability down to 11 nines.

---

## Security & Access Control

### Authentication & Authorization

**IAM Integration:**
- Users authenticate via IAM
- IAM policies control API access
- Resource-level permissions
- Instance role assumption

**Example IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:InstanceType": ["t3.micro", "t3.small"]
        }
      }
    }
  ]
}
```

The `Condition` block above is doing real work: without it, this policy would let the holder launch any instance type, including expensive GPU or memory-optimized instances. Scoping it to `t3.micro`/`t3.small` means a leaked credential carrying this policy can run up a small bill at worst, not an unbounded one — the same resource-level restriction pattern IAM encourages everywhere it's used.

### Network Security

**Security Measures:**
- VPC isolation per customer
- Security group enforcement
- Network ACLs
- DDoS protection
- VPN and Direct Connect support

### Data Security

**Encryption:**
- Encryption at rest (EBS volumes, snapshots)
- Encryption in transit (TLS for API, VPN for data)
- KMS integration for key management
- Customer-managed keys (CMK)

**Compliance:**
- SOC 2 Type II
- PCI-DSS Level 1
- HIPAA
- GDPR

### Instance Security

**Key Pairs:**
- SSH key pairs for Linux instances
- Password management for Windows instances
- Key rotation support
- Secure key storage

**Metadata Service:**
- Instance metadata available at `http://169.254.169.254`
- IAM role credentials
- Instance identity documents
- Secure access only from instance

---

## Monitoring & Logging

### Metrics Collection

**Instance Metrics:**
- CPU utilization (%)
- Memory utilization (%)
- Disk read/write operations
- Network in/out (bytes)
- Status check failures

**System Metrics:**
- Hypervisor host utilization
- Storage backend performance
- Network throughput
- API latency and errors

**Collection Architecture:**
```
Hypervisor Agent → Metrics Collector → 
Time-Series DB → Monitoring Dashboard
```

### Logging

**Log Types:**
- API access logs
- Instance system logs
- Security group rule evaluations
- Billing events
- Error logs

**Log Storage:**
- Centralized log aggregation
- Long-term storage in object storage
- Search and analysis tools
- Retention policies

### Alarms & Notifications

**Alarm Types:**
- Instance status check failures
- High CPU utilization
- Low disk space
- Security group rule violations
- Billing thresholds

**Notification Channels:**
- Email
- SMS
- SNS topics
- Webhooks

---

## Scalability & Performance

### Horizontal Scaling

**API Layer:**
- Stateless services
- Multiple instances behind load balancer
- Auto-scaling based on traffic

**Database:**
- Read replicas for read-heavy operations
- Sharding by account_id
- Connection pooling

**Compute Infrastructure:**
- Add hypervisor hosts as needed
- Distribute instances across hosts
- Auto-scale based on capacity

### Caching Strategy

**Cache Layers:**
1. **API Gateway Cache** - Frequently accessed instance metadata
2. **Application Cache (Redis)** - Instance state, security groups
3. **Database Query Cache** - Common queries

**Cache Invalidation:**
- TTL-based expiration
- Event-driven invalidation on state changes
- Cache warming for hot data

### Performance Optimization

**API Performance:**
- Connection pooling
- Async processing for long operations
- Batch operations where possible
- Pagination for list operations

**Database Optimization:**
- Indexes on frequently queried columns
- Partitioning by time/account
- Query optimization
- Read replicas

**Network Performance:**
- Enhanced networking (SR-IOV)
- Placement groups for low latency
- Bandwidth allocation per instance type

---

## Disaster Recovery & High Availability

### Multi-AZ Architecture

**Availability Zones:**
- Multiple AZs per region
- Independent power, networking, cooling
- Instances distributed across AZs
- Automatic failover

**Replication:**
- EBS volumes replicated across AZs
- Database replication
- Image storage replicated

### Backup & Recovery

**Backup Strategy:**
- EBS snapshots
- AMI images
- Database backups
- Configuration backups

**Recovery Procedures:**
- Instance recovery from snapshots
- Volume recovery from snapshots
- Cross-region replication
- RTO: < 1 hour, RPO: < 15 minutes

### Failure Handling

**Hypervisor Host Failure:**
1. Detect host failure
2. Mark instances as impaired
3. Migrate instances to healthy hosts
4. Notify customers

**Storage Failure:**
1. Detect storage failure
2. Use replicated copies
3. Rebuild failed storage
4. Verify data integrity

**Network Failure:**
1. Detect network partition
2. Route traffic to healthy paths
3. Maintain instance connectivity
4. Restore full connectivity

---

## Trade-offs & Design Decisions

### 1. Virtualization vs. Containers

**Decision:** Use full virtualization (KVM/Xen) for EC2 instances

**Rationale:**
- **Isolation:** Complete OS-level isolation between customer instances
- **Security:** Strong security boundaries, no shared kernel
- **Compatibility:** Run any OS without modification
- **Legacy Support:** Support older applications and OS versions
- **Resource Guarantees:** Better CPU, memory, and I/O guarantees

**Trade-offs:**
- Higher overhead (~5-10% vs containers' ~1-2%)
- Slower boot times (30-60s vs containers' <1s)
- More resource intensive

**Alternative:** Containers (Docker/Kubernetes) for specific use cases like serverless or batch processing

---

### 2. Hypervisor Choice: KVM vs Xen vs Hyper-V

**Decision:** Use KVM for Linux hosts, Hyper-V for Windows hosts

**Rationale:**

| Hypervisor | Pros | Cons | Use Case |
|------------|------|------|----------|
| **KVM** | Open source, good performance, Linux native | Linux only | Linux instances ✓ |
| **Xen** | Mature, paravirtualization support | More complex, declining adoption | Legacy systems |
| **Hyper-V** | Windows native, good Windows support | Windows only | Windows instances ✓ |
| **VMware ESXi** | Enterprise features, mature | Proprietary, expensive | Enterprise customers |

**Trade-offs:**
- KVM: Best performance on Linux, active development
- Hyper-V: Best Windows integration, native Microsoft stack
- Multi-hypervisor adds complexity but provides flexibility

---

### 3. Storage Architecture: Network-Attached vs Local

**Decision:** Hybrid approach - Instance Store (local) + EBS (network-attached)

**Rationale:**

**Instance Store (Local):**
- ✅ High performance (NVMe SSD)
- ✅ Low latency
- ✅ No network overhead
- ❌ Ephemeral (data lost on stop/terminate)
- ❌ Limited capacity

**EBS (Network-Attached):**
- ✅ Persistent across instance lifecycle
- ✅ Can attach/detach
- ✅ Replicated for durability
- ❌ Network latency
- ❌ Additional cost

**Trade-offs:**
- Offer both to match different use cases
- Instance store for temporary, high-performance workloads
- EBS for persistent, production workloads

---

### 4. Networking: Overlay vs Underlay

**Decision:** Use overlay networking (VXLAN/GRE) with SDN controller

**Rationale:**

**Overlay (VXLAN/GRE):**
- ✅ Flexible IP allocation per customer
- ✅ Easy multi-tenancy
- ✅ Scalable (16M VNIs)
- ✅ Works over existing physical network
- ❌ Additional encapsulation overhead (~50 bytes)

**Underlay (VLAN):**
- ✅ Lower overhead
- ✅ Better performance
- ❌ Limited scalability (4K VLANs)
- ❌ Complex IP management

**Trade-offs:**
- Overlay provides better isolation and scalability
- Performance overhead acceptable for most workloads
- Can use SR-IOV for high-performance instances

---

### 5. Instance Placement: Random vs Intelligent

**Decision:** Intelligent placement with multiple strategies

**Placement Strategies:**

1. **Spread Placement** - Distribute across distinct hardware
   - Use case: High availability
   - Reduces correlated failures

2. **Cluster Placement** - Pack instances on same hardware
   - Use case: Low latency (HPC)
   - Higher risk of correlated failures

3. **Partition Placement** - Logical partitions
   - Use case: Multi-AZ deployments
   - Balance between spread and cluster

**Trade-offs:**
- Intelligent placement improves availability and performance
- Adds complexity to orchestration
- May reduce resource utilization

---

### 6. Billing Model: Per-Second vs Per-Hour

**Decision:** Per-second billing with 1-minute minimum

**Rationale:**
- Fairer for customers (pay only for what you use)
- Competitive advantage
- More complex billing calculations
- Higher billing system load

**Trade-offs:**
- Per-second: Fairer, more complex
- Per-hour: Simpler, less fair
- 1-minute minimum balances fairness and complexity

The unfairness in per-hour billing is concrete: an instance launched, used for 5 minutes, and terminated would still be billed for a full hour. Per-second billing closes exactly that gap, at the cost of the billing system having to track and calculate usage at much finer granularity.

---

### 7. Instance State Persistence: Stop vs Hibernate

**Decision:** Support both Stop and Hibernate

**Stop:**
- ✅ Fast (saves instance state to EBS)
- ✅ Can change instance type
- ✅ Lower cost (no compute charges)
- ❌ EBS storage costs continue

**Hibernate:**
- ✅ Fastest resume (RAM saved to EBS)
- ✅ Preserves in-memory state
- ❌ Requires EBS root volume
- ❌ Limited instance types

**Trade-offs:**
- Offer both options
- Stop for most use cases
- Hibernate for long-running applications with state

---

### 8. Security Groups: Stateful vs Stateless

**Decision:** Stateful security groups

**Rationale:**
- Return traffic automatically allowed
- Simpler rule management
- Better user experience
- Matches traditional firewall behavior

**Trade-offs:**
- Stateful: Simpler, but requires connection tracking
- Stateless: More control, but complex rule management
- Stateful is industry standard and user-friendly

The complexity stateless rules would add is visible in the example rule set under Networking Architecture above: that security group defines inbound rules for HTTP and SSH plus one egress-all rule. Without connection tracking, letting the HTTP response back out would require its own explicit rule matching whatever ephemeral port the client connected from — stateful tracking is what lets "allow all outbound" implicitly cover every return packet instead.

---

### 9. Image Storage: Object Storage vs Block Storage

**Decision:** Object storage (S3-like) for images, block storage for volumes

**Rationale:**

**Object Storage for Images:**
- ✅ Cost-effective for large, infrequently accessed data
- ✅ High durability (11 nines)
- ✅ Easy sharing and versioning
- ✅ Scales to petabytes
- ❌ Higher latency for reads

**Block Storage for Volumes:**
- ✅ Low latency
- ✅ Random access
- ✅ Direct attach to instances
- ❌ More expensive
- ❌ Limited scalability per volume

**Trade-offs:**
- Images are read infrequently → object storage
- Volumes need low latency → block storage
- Hybrid approach optimizes cost and performance

---

### 10. Multi-Tenancy: Shared vs Dedicated Hardware

**Decision:** Shared hardware with strong isolation, dedicated option available

**Rationale:**

**Shared Hardware:**
- ✅ Higher resource utilization
- ✅ Lower cost for customers
- ✅ Better for most workloads
- ❌ Potential "noisy neighbor" issues
- ❌ Requires strong isolation

**Dedicated Hardware:**
- ✅ Complete isolation
- ✅ Compliance requirements
- ✅ Predictable performance
- ❌ Higher cost
- ❌ Lower utilization

**Trade-offs:**
- Default to shared for cost efficiency
- Offer dedicated for compliance/security needs
- Use hardware-level isolation (CPU pinning, memory isolation)

---

### 11. API Design: REST vs GraphQL vs gRPC

**Decision:** REST API with optional gRPC for high-performance operations

**Rationale:**

**REST:**
- ✅ Industry standard
- ✅ Easy to use and understand
- ✅ Good tooling and documentation
- ✅ Works well with HTTP caching
- ❌ Over-fetching/under-fetching

**GraphQL:**
- ✅ Flexible queries
- ✅ Reduces over-fetching
- ❌ More complex
- ❌ Caching challenges

**gRPC:**
- ✅ High performance
- ✅ Streaming support
- ✅ Type safety
- ❌ Less familiar to developers
- ❌ Limited browser support

**Trade-offs:**
- REST for general API access (web, CLI, SDKs)
- gRPC for internal services and high-throughput operations
- GraphQL for specific use cases if needed

---

### 12. Database: SQL vs NoSQL for Metadata

**Decision:** SQL (PostgreSQL) for metadata, NoSQL for metrics

**Rationale:**

**SQL for Metadata:**
- ✅ ACID transactions for consistency
- ✅ Complex queries (joins, aggregations)
- ✅ Relational data (instances, volumes, security groups)
- ✅ Mature tooling
- ❌ Scaling challenges at extreme scale

**NoSQL for Metrics:**
- ✅ High write throughput
- ✅ Time-series optimization
- ✅ Horizontal scaling
- ❌ Eventual consistency
- ❌ Limited query capabilities

**Trade-offs:**
- SQL for transactional metadata (instances, volumes, images)
- NoSQL (InfluxDB/TimescaleDB) for time-series metrics
- Can shard SQL database if needed

Launching an instance touches several related rows at once — the instance record, its security group attachments, its volume attachment, its IP allocation — and all of them need to succeed or roll back together. That's exactly what SQL's ACID transactions guarantee and most NoSQL stores don't, which is why metadata stays relational even though metrics (one row per instance per minute, never updated or joined) move to a time-series store instead.

---

### 13. Caching Strategy: Write-Through vs Write-Back

**Decision:** Write-through cache with TTL-based invalidation

**Rationale:**

**Write-Through:**
- ✅ Data consistency
- ✅ No data loss on cache failure
- ✅ Simpler implementation
- ❌ Higher write latency

**Write-Back:**
- ✅ Lower write latency
- ✅ Better write performance
- ❌ Risk of data loss
- ❌ More complex

**Trade-offs:**
- Write-through for instance state (consistency critical)
- Cache with TTL for frequently read data
- Event-driven invalidation for state changes

A write-back cache would let the API acknowledge a `stopInstance` call as soon as the cache is updated, before the database write actually lands. If that cache node crashed before flushing, the customer would be told their instance is stopping while the database still says `running` — a state mismatch the Instance Lifecycle state machine above has no way to recover from on its own.

---

### 14. Monitoring: Push vs Pull

**Decision:** Hybrid - Push from agents, Pull for health checks

**Rationale:**

**Push (Agent-based):**
- ✅ Real-time metrics
- ✅ Works behind firewalls
- ✅ Efficient for high-frequency metrics
- ❌ Requires agent on each host

**Pull (Scraping):**
- ✅ Centralized configuration
- ✅ No agent required
- ✅ Easy to debug
- ❌ Requires network access
- ❌ Higher latency

**Trade-offs:**
- Push for instance metrics (high frequency, behind firewall)
- Pull for health checks and service discovery
- Hybrid approach provides best of both

"Behind firewall" here means hypervisor hosts sit inside infrastructure that network isolation (NFR11, Networking Architecture above) is specifically designed to keep unreachable from outside. A centralized pull-based scraper would need an inbound path into every host across every customer's isolated network just to collect metrics; the push model avoids that entirely by having each agent open the connection outward instead.

---

### 15. Region Strategy: Single vs Multi-Region

**Decision:** Multi-region deployment from day one

**Rationale:**
- ✅ Disaster recovery
- ✅ Lower latency for global customers
- ✅ Regulatory compliance (data residency)
- ✅ Higher availability
- ❌ Higher operational complexity
- ❌ Data replication costs

**Trade-offs:**
- Start with 2-3 regions
- Expand based on customer demand
- Replicate critical data across regions
- Route customers to nearest region

Building multi-region in from day one is deliberately a harder starting point, chosen to avoid a much harder retrofit later. Once account IDs, instance IDs, and billing records already exist in one region's database with no region dimension, splitting that schema across regions without downtime for millions of existing customers is a far bigger migration than designing for regions from the start.

---

## Summary

This AWS EC2 design supports:

- **Scale:** Millions of instances, billions of API calls per day
- **Performance:** < 60s instance launch, < 100ms API latency
- **Availability:** 99.99% uptime with multi-AZ deployment
- **Security:** Complete network isolation, encryption at rest and in transit
- **Flexibility:** Multiple instance types, storage options, networking configurations

**Key Technologies:**
- **Hypervisor:** KVM (Linux), Hyper-V (Windows)
- **Orchestration:** Custom scheduler with intelligent placement
- **Storage:** EBS (block storage), Object Storage (images)
- **Networking:** VXLAN overlay, SDN controller
- **Database:** PostgreSQL (metadata), InfluxDB (metrics)
- **Cache:** Redis Cluster
- **Message Queue:** Kafka
- **Monitoring:** Prometheus + Grafana
- **API Gateway:** Custom gateway with rate limiting

**Design Principles:**
1. **Multi-tenancy with strong isolation** - Shared infrastructure with complete customer isolation
2. **Elasticity** - Scale compute capacity up/down on demand
3. **High availability** - Multi-AZ, automatic failover, health monitoring
4. **Security first** - Network isolation, encryption, IAM integration
5. **Cost optimization** - Pay-per-use, reserved instances, spot pricing
6. **Performance** - Low latency, high throughput, optimized networking
7. **Reliability** - 11 nines durability, automatic recovery, data replication

**Scaling Considerations:**
- Horizontal scaling of API services
- Database sharding by account_id
- Distributed storage backend
- Multi-region deployment
- Caching at multiple layers
- Async processing for long operations

This design provides a solid foundation for a cloud compute service that can scale to millions of instances while maintaining high performance, availability, and security.