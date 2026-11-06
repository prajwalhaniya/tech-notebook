# Load Balancing Methods: Deep Dive

Load balancing is the process of distributing network traffic across multiple servers to ensure no single server bears too much demand. This improves application responsiveness, availability, and scalability.

## Table of Contents
1. [Fundamentals](#fundamentals)
2. [Static Load Balancing Algorithms](#static-load-balancing-algorithms)
3. [Dynamic Load Balancing Algorithms](#dynamic-load-balancing-algorithms)
4. [Session Persistence](#session-persistence)
5. [Health Checks](#health-checks)
6. [Advanced Patterns](#advanced-patterns)
7. [Real-World Implementations](#real-world-implementations)

## Fundamentals

### Load Balancer Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐         ┌────▼────┐        ┌────▼────┐
    │Server 1 │         │Server 2 │        │Server 3 │
    │Load: 33%│         │Load: 33%│        │Load: 34%│
    └─────────┘         └─────────┘        └─────────┘
```

### Key Concepts

**Request Distribution**: How incoming requests are allocated to backend servers.

**Server Pool**: The collection of backend servers available to handle requests.

**Health Status**: Whether a server is available and capable of handling requests.

**Weight**: Relative capacity or priority assigned to a server.

**Persistence**: Maintaining connection between a client and specific server across multiple requests.

**Fairness**: How evenly load is distributed across servers.

## Static Load Balancing Algorithms

Static algorithms use predefined rules and don't consider current server load or performance.

### 1. Round Robin

**How It Works**: Requests are distributed sequentially across all servers in rotation. After reaching the last server, it cycles back to the first.

**Distribution Pattern**:
```
Request 1 → Server 1
Request 2 → Server 2
Request 3 → Server 3
Request 4 → Server 1
Request 5 → Server 2
Request 6 → Server 3
```

**Algorithm Logic**:
```javascript
class RoundRobinBalancer {
  constructor(servers) {
    this.servers = servers;
    this.currentIndex = 0;
  }

  getNextServer() {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }
}

const balancer = new RoundRobinBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);
```

**Nginx Configuration**:
```nginx
upstream backend {
    server backend1.example.com:8080;
    server backend2.example.com:8080;
    server backend3.example.com:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

**Advantages**:
- Simple to implement and understand
- Fair distribution when servers have equal capacity
- No complex calculations required
- Predictable behavior

**Disadvantages**:
- Doesn't consider server load or capacity
- Treats all servers equally regardless of specs
- Can overload slower servers
- No awareness of connection duration

**Best Use Cases**:
- Servers with identical hardware specifications
- Homogeneous workloads with similar processing times
- Stateless applications
- Equal capacity across all servers

### 2. Weighted Round Robin

**How It Works**: Similar to round robin but servers receive requests proportional to their assigned weights. Higher weight means more requests.

**Distribution Pattern with Weights [3, 2, 1]**:
```
Request 1 → Server 1 (weight: 3)
Request 2 → Server 1
Request 3 → Server 1
Request 4 → Server 2 (weight: 2)
Request 5 → Server 2
Request 6 → Server 3 (weight: 1)
Request 7 → Server 1 (cycle repeats)
```

**Algorithm Logic**:
```javascript
class WeightedRoundRobinBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      currentWeight: 0,
      effectiveWeight: s.weight
    }));
  }

  getNextServer() {
    let totalWeight = 0;
    let bestServer = null;
    let maxWeight = Number.MIN_SAFE_INTEGER;

    for (const server of this.servers) {
      server.currentWeight += server.effectiveWeight;
      totalWeight += server.effectiveWeight;

      if (server.currentWeight > maxWeight) {
        maxWeight = server.currentWeight;
        bestServer = server;
      }
    }

    bestServer.currentWeight -= totalWeight;
    return bestServer;
  }
}

const balancer = new WeightedRoundRobinBalancer([
  { host: '10.0.1.1', port: 8080, weight: 3 },
  { host: '10.0.1.2', port: 8080, weight: 2 },
  { host: '10.0.1.3', port: 8080, weight: 1 }
]);
```

**Nginx Configuration**:
```nginx
upstream backend {
    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 weight=1;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

**Advantages**:
- Accounts for different server capacities
- More powerful servers handle more load
- Better resource utilization
- Flexible distribution control

**Disadvantages**:
- Requires manual weight configuration
- Still doesn't consider current load
- Weight tuning can be challenging
- May need adjustment over time

**Best Use Cases**:
- Heterogeneous server infrastructure
- Servers with different CPU/RAM specifications
- Gradual traffic migration (canary deployments)
- A/B testing scenarios

**Weight Calculation Strategy**:
```
Weight = (Server_CPU × CPU_Factor) + (Server_RAM × RAM_Factor)

Example:
Server 1: 8 cores, 16GB RAM → Weight = (8 × 1) + (16 × 0.5) = 16
Server 2: 4 cores, 8GB RAM  → Weight = (4 × 1) + (8 × 0.5) = 8
Server 3: 2 cores, 4GB RAM  → Weight = (2 × 1) + (4 × 0.5) = 4

Normalized: [4, 2, 1]
```

### 3. IP Hash

**How It Works**: Uses client's IP address to determine which server receives the request. Same IP always routes to the same server (unless server becomes unavailable).

**Hash Calculation**:
```
hash = hash_function(client_ip)
server_index = hash % number_of_servers
```

**Algorithm Logic**:
```javascript
class IPHashBalancer {
  constructor(servers) {
    this.servers = servers;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  getServerForIP(clientIP) {
    const hash = this.simpleHash(clientIP);
    const index = hash % this.servers.length;
    return this.servers[index];
  }
}

const balancer = new IPHashBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

const server = balancer.getServerForIP('192.168.1.100');
```

**Nginx Configuration**:
```nginx
upstream backend {
    ip_hash;
    server backend1.example.com:8080;
    server backend2.example.com:8080;
    server backend3.example.com:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

**Advantages**:
- Natural session persistence
- Simple implementation
- No additional session storage needed
- Consistent routing for same client

**Disadvantages**:
- Uneven distribution if clients behind NAT
- Adding/removing servers disrupts routing
- No consideration of server load
- Multiple clients from same IP overload one server

**Best Use Cases**:
- Applications requiring session affinity
- Stateful applications without shared session storage
- Websocket connections
- File upload/download operations

**Hash Distribution Analysis**:
```
Scenario: 1000 unique IPs, 3 servers
Ideal distribution: 333, 333, 334
Actual distribution: 310-360 (within 10% variance)

Problem: NAT scenario
100 users behind corporate NAT (1 IP)
All 100 → Same server (overload)
```

### 4. Random

**How It Works**: Selects a random server from the available pool for each request.

**Algorithm Logic**:
```javascript
class RandomBalancer {
  constructor(servers) {
    this.servers = servers;
  }

  getNextServer() {
    const randomIndex = Math.floor(Math.random() * this.servers.length);
    return this.servers[randomIndex];
  }
}

const balancer = new RandomBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);
```

**Weighted Random**:
```javascript
class WeightedRandomBalancer {
  constructor(servers) {
    this.servers = servers;
    this.totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
  }

  getNextServer() {
    let random = Math.random() * this.totalWeight;

    for (const server of this.servers) {
      random -= server.weight;
      if (random <= 0) {
        return server;
      }
    }

    return this.servers[this.servers.length - 1];
  }
}

const balancer = new WeightedRandomBalancer([
  { host: '10.0.1.1', port: 8080, weight: 5 },
  { host: '10.0.1.2', port: 8080, weight: 3 },
  { host: '10.0.1.3', port: 8080, weight: 2 }
]);
```

**Advantages**:
- Very simple implementation
- No state tracking required
- Good distribution over large request volumes
- No coordination needed in distributed systems

**Disadvantages**:
- Can have uneven short-term distribution
- No session persistence
- Purely probabilistic fairness
- May send consecutive requests to same server

**Best Use Cases**:
- Distributed load balancers (no shared state)
- Extremely high request volumes
- Stateless services
- Quick prototyping

## Dynamic Load Balancing Algorithms

Dynamic algorithms adapt to current conditions and server performance.

### 1. Least Connections

**How It Works**: Routes requests to the server with the fewest active connections. Assumes equal capacity and connection duration.

**Selection Logic**:
```
Server 1: 45 active connections
Server 2: 32 active connections  ← Selected
Server 3: 58 active connections

New request → Server 2 (least loaded)
```

**Algorithm Logic**:
```javascript
class LeastConnectionsBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      activeConnections: 0
    }));
  }

  getNextServer() {
    return this.servers.reduce((min, server) =>
      server.activeConnections < min.activeConnections ? server : min
    );
  }

  incrementConnections(server) {
    server.activeConnections++;
  }

  decrementConnections(server) {
    server.activeConnections = Math.max(0, server.activeConnections - 1);
  }
}

const balancer = new LeastConnectionsBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

const server = balancer.getNextServer();
balancer.incrementConnections(server);

setTimeout(() => {
  balancer.decrementConnections(server);
}, 5000);
```

**Nginx Configuration**:
```nginx
upstream backend {
    least_conn;
    server backend1.example.com:8080;
    server backend2.example.com:8080;
    server backend3.example.com:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

**Advantages**:
- Adapts to actual server load
- Better for long-lived connections
- Handles varying request durations
- More balanced than round robin under load

**Disadvantages**:
- Requires connection tracking
- Doesn't consider request complexity
- May route heavy requests to same server
- Additional overhead for state management

**Best Use Cases**:
- Applications with varying request durations
- Long-polling or streaming connections
- Database connection pooling
- WebSocket applications

**Performance Comparison**:
```
Scenario: Mixed workload (10ms, 100ms, 1000ms requests)

Round Robin:
Server 1: 10ms, 1000ms, 100ms = Busy 1110ms
Server 2: 100ms, 10ms, 1000ms = Busy 1110ms
Server 3: 1000ms, 100ms, 10ms = Busy 1110ms

Least Connections:
Server 1: 10ms, 100ms, 10ms = Busy 120ms
Server 2: 100ms, 1000ms = Busy 1100ms
Server 3: 1000ms, 100ms = Busy 1100ms
Better distribution with fast completion detection
```

### 2. Weighted Least Connections

**How It Works**: Combines least connections with server weights. Calculates connection ratio based on capacity.

**Selection Formula**:
```
Score = Active_Connections / Weight
Select server with lowest score
```

**Algorithm Logic**:
```javascript
class WeightedLeastConnectionsBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      activeConnections: 0
    }));
  }

  getNextServer() {
    return this.servers.reduce((best, server) => {
      const serverScore = server.activeConnections / server.weight;
      const bestScore = best.activeConnections / best.weight;
      return serverScore < bestScore ? server : best;
    });
  }

  incrementConnections(server) {
    server.activeConnections++;
  }

  decrementConnections(server) {
    server.activeConnections = Math.max(0, server.activeConnections - 1);
  }
}

const balancer = new WeightedLeastConnectionsBalancer([
  { host: '10.0.1.1', port: 8080, weight: 3 },
  { host: '10.0.1.2', port: 8080, weight: 2 },
  { host: '10.0.1.3', port: 8080, weight: 1 }
]);
```

**Nginx Configuration**:
```nginx
upstream backend {
    least_conn;
    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 weight=1;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

**Advantages**:
- Accounts for both capacity and current load
- Optimal for heterogeneous environments
- Better resource utilization
- Adapts to server capabilities

**Disadvantages**:
- More complex state management
- Requires accurate weight configuration
- Higher computational overhead
- Weight recalibration may be needed

**Best Use Cases**:
- Mixed server specifications
- Cloud environments with different instance types
- Auto-scaling scenarios
- Cost-optimized deployments

**Load Distribution Example**:
```
3 Servers with weights [3, 2, 1] handling 60 requests

Perfect distribution:
Server 1 (weight 3): 30 requests (50%)
Server 2 (weight 2): 20 requests (33%)
Server 3 (weight 1): 10 requests (17%)

Weighted Least Connections achieves near-perfect distribution
by continuously balancing connection ratios.
```

### 3. Least Response Time

**How It Works**: Routes to the server with the fastest response time and fewest active connections.

**Selection Formula**:
```
Score = (Average_Response_Time × Response_Weight) + (Active_Connections × Connection_Weight)
Select server with lowest score
```

**Algorithm Logic**:
```javascript
class LeastResponseTimeBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      activeConnections: 0,
      responseTimes: [],
      maxSamples: 100
    }));
  }

  recordResponseTime(server, duration) {
    server.responseTimes.push(duration);
    if (server.responseTimes.length > server.maxSamples) {
      server.responseTimes.shift();
    }
  }

  getAverageResponseTime(server) {
    if (server.responseTimes.length === 0) return 0;
    const sum = server.responseTimes.reduce((a, b) => a + b, 0);
    return sum / server.responseTimes.length;
  }

  getNextServer() {
    return this.servers.reduce((best, server) => {
      const serverScore =
        this.getAverageResponseTime(server) +
        (server.activeConnections * 100);

      const bestScore =
        this.getAverageResponseTime(best) +
        (best.activeConnections * 100);

      return serverScore < bestScore ? server : best;
    });
  }

  incrementConnections(server) {
    server.activeConnections++;
  }

  decrementConnections(server) {
    server.activeConnections = Math.max(0, server.activeConnections - 1);
  }
}

const balancer = new LeastResponseTimeBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

async function handleRequest(req) {
  const server = balancer.getNextServer();
  balancer.incrementConnections(server);

  const startTime = Date.now();
  const response = await forwardRequest(server, req);
  const duration = Date.now() - startTime;

  balancer.recordResponseTime(server, duration);
  balancer.decrementConnections(server);

  return response;
}
```

**HAProxy Configuration**:
```
backend myapp
    balance leasttime
    server server1 10.0.1.1:8080 check
    server server2 10.0.1.2:8080 check
    server server3 10.0.1.3:8080 check
```

**Advantages**:
- Considers actual server performance
- Adapts to degrading servers
- Best user experience (fastest responses)
- Self-healing under varying conditions

**Disadvantages**:
- Complex implementation
- Higher overhead for tracking
- May oscillate under certain conditions
- Requires continuous monitoring

**Best Use Cases**:
- Applications with variable processing times
- Geographic distribution
- Mixed workload types
- Performance-critical services

### 4. Resource-Based (CPU, Memory)

**How It Works**: Routes based on actual server resource utilization (CPU, memory, disk I/O).

**Algorithm Logic**:
```javascript
class ResourceBasedBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      cpuUsage: 0,
      memoryUsage: 0,
      lastUpdate: Date.now()
    }));
  }

  updateServerMetrics(serverHost, metrics) {
    const server = this.servers.find(s => s.host === serverHost);
    if (server) {
      server.cpuUsage = metrics.cpu;
      server.memoryUsage = metrics.memory;
      server.lastUpdate = Date.now();
    }
  }

  calculateServerLoad(server) {
    const cpuWeight = 0.6;
    const memoryWeight = 0.4;
    return (server.cpuUsage * cpuWeight) + (server.memoryUsage * memoryWeight);
  }

  getNextServer() {
    const now = Date.now();
    const validServers = this.servers.filter(s =>
      (now - s.lastUpdate) < 10000
    );

    if (validServers.length === 0) {
      return this.servers[0];
    }

    return validServers.reduce((best, server) => {
      const serverLoad = this.calculateServerLoad(server);
      const bestLoad = this.calculateServerLoad(best);
      return serverLoad < bestLoad ? server : best;
    });
  }
}

const balancer = new ResourceBasedBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

setInterval(async () => {
  for (const server of balancer.servers) {
    const metrics = await fetchServerMetrics(server.host);
    balancer.updateServerMetrics(server.host, metrics);
  }
}, 5000);
```

**Advantages**:
- Most accurate load assessment
- Prevents server overload
- Optimal resource utilization
- Adapts to all workload types

**Disadvantages**:
- Requires monitoring infrastructure
- Network overhead for metrics
- More complex implementation
- Potential latency in metrics

**Best Use Cases**:
- CPU-intensive applications
- Memory-intensive workloads
- Unpredictable traffic patterns
- Critical production systems

## Session Persistence

### Sticky Sessions (Session Affinity)

**Cookie-Based Persistence**:
```nginx
upstream backend {
    server backend1.example.com:8080;
    server backend2.example.com:8080;
    server backend3.example.com:8080;

    sticky cookie srv_id expires=1h domain=.example.com path=/;
}
```

**Application-Level Implementation**:
```javascript
class StickySessionBalancer {
  constructor(servers) {
    this.servers = servers;
    this.sessionMap = new Map();
    this.roundRobinIndex = 0;
  }

  getServerForSession(sessionId) {
    if (this.sessionMap.has(sessionId)) {
      return this.sessionMap.get(sessionId);
    }

    const server = this.servers[this.roundRobinIndex];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % this.servers.length;

    this.sessionMap.set(sessionId, server);
    return server;
  }

  removeSession(sessionId) {
    this.sessionMap.delete(sessionId);
  }

  getSessionCount(server) {
    let count = 0;
    for (const [, srv] of this.sessionMap) {
      if (srv.host === server.host) count++;
    }
    return count;
  }
}

const balancer = new StickySessionBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

app.use((req, res, next) => {
  const sessionId = req.cookies.sessionId || generateSessionId();
  const server = balancer.getServerForSession(sessionId);
  req.targetServer = server;
  res.cookie('sessionId', sessionId);
  next();
});
```

**Consistent Hashing for Session Persistence**:
```javascript
class ConsistentHashBalancer {
  constructor(servers, virtualNodes = 150) {
    this.servers = servers;
    this.virtualNodes = virtualNodes;
    this.ring = new Map();
    this.buildRing();
  }

  hash(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  buildRing() {
    for (const server of this.servers) {
      for (let i = 0; i < this.virtualNodes; i++) {
        const virtualKey = `${server.host}:${server.port}#${i}`;
        const hash = this.hash(virtualKey);
        this.ring.set(hash, server);
      }
    }
  }

  getServer(key) {
    if (this.ring.size === 0) return null;

    const hash = this.hash(key);
    const sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);

    for (const ringHash of sortedHashes) {
      if (ringHash >= hash) {
        return this.ring.get(ringHash);
      }
    }

    return this.ring.get(sortedHashes[0]);
  }

  addServer(server) {
    this.servers.push(server);
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${server.host}:${server.port}#${i}`;
      const hash = this.hash(virtualKey);
      this.ring.set(hash, server);
    }
  }

  removeServer(server) {
    this.servers = this.servers.filter(s =>
      s.host !== server.host || s.port !== server.port
    );
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${server.host}:${server.port}#${i}`;
      const hash = this.hash(virtualKey);
      this.ring.delete(hash);
    }
  }
}

const balancer = new ConsistentHashBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

const server = balancer.getServer(req.sessionId);
```

## Health Checks

### Active Health Checks

**HTTP Health Check Implementation**:
```javascript
class HealthCheckBalancer {
  constructor(servers, healthCheckInterval = 10000) {
    this.servers = servers.map(s => ({
      ...s,
      healthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    }));

    this.healthCheckInterval = healthCheckInterval;
    this.maxFailures = 3;
    this.maxSuccesses = 2;

    this.startHealthChecks();
  }

  async checkServerHealth(server) {
    try {
      const response = await fetch(`http://${server.host}:${server.port}/health`, {
        timeout: 5000
      });

      if (response.ok) {
        server.consecutiveSuccesses++;
        server.consecutiveFailures = 0;

        if (server.consecutiveSuccesses >= this.maxSuccesses) {
          server.healthy = true;
        }
      } else {
        this.handleHealthCheckFailure(server);
      }
    } catch (error) {
      this.handleHealthCheckFailure(server);
    }
  }

  handleHealthCheckFailure(server) {
    server.consecutiveFailures++;
    server.consecutiveSuccesses = 0;

    if (server.consecutiveFailures >= this.maxFailures) {
      server.healthy = false;
      console.log(`Server ${server.host}:${server.port} marked unhealthy`);
    }
  }

  startHealthChecks() {
    setInterval(() => {
      for (const server of this.servers) {
        this.checkServerHealth(server);
      }
    }, this.healthCheckInterval);
  }

  getHealthyServers() {
    return this.servers.filter(s => s.healthy);
  }

  getNextServer() {
    const healthy = this.getHealthyServers();
    if (healthy.length === 0) {
      throw new Error('No healthy servers available');
    }
    return healthy[Math.floor(Math.random() * healthy.length)];
  }
}

const balancer = new HealthCheckBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);
```

**Nginx Health Check Configuration**:
```nginx
upstream backend {
    server backend1.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend2.example.com:8080 max_fails=3 fail_timeout=30s;
    server backend3.example.com:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
    }
}
```

### Passive Health Checks

**Implementation**:
```javascript
class PassiveHealthCheckBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      healthy: true,
      errorCount: 0,
      requestCount: 0,
      windowStart: Date.now()
    }));

    this.errorThreshold = 0.5;
    this.windowSize = 60000;
    this.minRequests = 10;
  }

  recordSuccess(server) {
    this.updateWindow(server);
    server.requestCount++;
    this.evaluateHealth(server);
  }

  recordFailure(server) {
    this.updateWindow(server);
    server.errorCount++;
    server.requestCount++;
    this.evaluateHealth(server);
  }

  updateWindow(server) {
    const now = Date.now();
    if (now - server.windowStart > this.windowSize) {
      server.errorCount = 0;
      server.requestCount = 0;
      server.windowStart = now;
    }
  }

  evaluateHealth(server) {
    if (server.requestCount < this.minRequests) {
      return;
    }

    const errorRate = server.errorCount / server.requestCount;

    if (errorRate > this.errorThreshold) {
      server.healthy = false;
      console.log(`Server ${server.host}:${server.port} marked unhealthy (error rate: ${errorRate.toFixed(2)})`);
    } else if (errorRate < this.errorThreshold * 0.5) {
      server.healthy = true;
    }
  }

  getHealthyServers() {
    return this.servers.filter(s => s.healthy);
  }
}

const balancer = new PassiveHealthCheckBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

async function handleRequest(req) {
  const server = balancer.getNextServer();

  try {
    const response = await forwardRequest(server, req);
    balancer.recordSuccess(server);
    return response;
  } catch (error) {
    balancer.recordFailure(server);
    throw error;
  }
}
```

## Advanced Patterns

### 1. Priority-Based Routing

**Implementation**:
```javascript
class PriorityBasedBalancer {
  constructor(serverGroups) {
    this.serverGroups = serverGroups.sort((a, b) => a.priority - b.priority);
  }

  getNextServer() {
    for (const group of this.serverGroups) {
      const healthyServers = group.servers.filter(s => s.healthy);
      if (healthyServers.length > 0) {
        return healthyServers[Math.floor(Math.random() * healthyServers.length)];
      }
    }
    throw new Error('No healthy servers in any priority group');
  }
}

const balancer = new PriorityBasedBalancer([
  {
    priority: 1,
    servers: [
      { host: 'primary1.example.com', port: 8080, healthy: true },
      { host: 'primary2.example.com', port: 8080, healthy: true }
    ]
  },
  {
    priority: 2,
    servers: [
      { host: 'secondary1.example.com', port: 8080, healthy: true },
      { host: 'secondary2.example.com', port: 8080, healthy: true }
    ]
  },
  {
    priority: 3,
    servers: [
      { host: 'backup.example.com', port: 8080, healthy: true }
    ]
  }
]);
```

**Nginx Configuration**:
```nginx
upstream backend {
    server primary1.example.com:8080;
    server primary2.example.com:8080;
    server secondary1.example.com:8080 backup;
    server secondary2.example.com:8080 backup;
}
```

### 2. Geographic Load Balancing

**Implementation**:
```javascript
class GeographicBalancer {
  constructor(regions) {
    this.regions = regions;
  }

  getRegionForIP(clientIP) {
    const clientLocation = this.geolocate(clientIP);

    let closestRegion = this.regions[0];
    let minDistance = this.calculateDistance(
      clientLocation,
      closestRegion.location
    );

    for (const region of this.regions) {
      const distance = this.calculateDistance(
        clientLocation,
        region.location
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestRegion = region;
      }
    }

    return closestRegion;
  }

  calculateDistance(loc1, loc2) {
    const R = 6371;
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLon = this.toRad(loc2.lon - loc1.lon);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  geolocate(ip) {
    return { lat: 0, lon: 0 };
  }

  getServerForClient(clientIP) {
    const region = this.getRegionForIP(clientIP);
    const healthyServers = region.servers.filter(s => s.healthy);

    if (healthyServers.length === 0) {
      return this.getFallbackServer();
    }

    return healthyServers[Math.floor(Math.random() * healthyServers.length)];
  }

  getFallbackServer() {
    for (const region of this.regions) {
      const healthy = region.servers.filter(s => s.healthy);
      if (healthy.length > 0) {
        return healthy[0];
      }
    }
    throw new Error('No healthy servers available in any region');
  }
}

const balancer = new GeographicBalancer([
  {
    name: 'us-east',
    location: { lat: 37.7749, lon: -122.4194 },
    servers: [
      { host: 'us-east-1.example.com', port: 8080, healthy: true },
      { host: 'us-east-2.example.com', port: 8080, healthy: true }
    ]
  },
  {
    name: 'eu-west',
    location: { lat: 51.5074, lon: -0.1278 },
    servers: [
      { host: 'eu-west-1.example.com', port: 8080, healthy: true },
      { host: 'eu-west-2.example.com', port: 8080, healthy: true }
    ]
  },
  {
    name: 'ap-south',
    location: { lat: 1.3521, lon: 103.8198 },
    servers: [
      { host: 'ap-south-1.example.com', port: 8080, healthy: true }
    ]
  }
]);
```

### 3. Adaptive Load Balancing

**Machine Learning-Based Selection**:
```javascript
class AdaptiveBalancer {
  constructor(servers) {
    this.servers = servers.map(s => ({
      ...s,
      performance: {
        responseTime: [],
        successRate: 1.0,
        throughput: 0
      }
    }));
  }

  recordMetrics(server, responseTime, success) {
    server.performance.responseTime.push(responseTime);
    if (server.performance.responseTime.length > 100) {
      server.performance.responseTime.shift();
    }

    const recentSuccess = server.performance.responseTime.map((_, i, arr) => {
      const total = arr.slice(Math.max(0, i - 10), i + 1).length;
      return success ? 1 / total : 0;
    }).reduce((a, b) => a + b, 0);

    server.performance.successRate = recentSuccess;
  }

  calculateServerScore(server) {
    const avgResponseTime = server.performance.responseTime.reduce((a, b) => a + b, 0) /
                           (server.performance.responseTime.length || 1);

    const responseTimeScore = 1 / (avgResponseTime + 1);
    const successScore = server.performance.successRate;

    return (responseTimeScore * 0.6) + (successScore * 0.4);
  }

  getNextServer() {
    const scores = this.servers.map(s => ({
      server: s,
      score: this.calculateServerScore(s)
    }));

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    let random = Math.random() * totalScore;

    for (const { server, score } of scores) {
      random -= score;
      if (random <= 0) {
        return server;
      }
    }

    return scores[scores.length - 1].server;
  }
}

const balancer = new AdaptiveBalancer([
  { host: '10.0.1.1', port: 8080 },
  { host: '10.0.1.2', port: 8080 },
  { host: '10.0.1.3', port: 8080 }
]);

async function handleRequest(req) {
  const server = balancer.getNextServer();
  const startTime = Date.now();

  try {
    const response = await forwardRequest(server, req);
    const responseTime = Date.now() - startTime;
    balancer.recordMetrics(server, responseTime, true);
    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    balancer.recordMetrics(server, responseTime, false);
    throw error;
  }
}
```

## Real-World Implementations

### AWS Elastic Load Balancer

**Application Load Balancer (Layer 7)**:
- Round robin by default
- Least outstanding requests
- Target group-based routing
- Path-based and host-based routing

**Network Load Balancer (Layer 4)**:
- Flow hash algorithm
- Uses 5-tuple hash (protocol, source IP/port, destination IP/port)
- Ultra-low latency
- Static IP support

### Kubernetes Service Load Balancing

**Implementation Details**:
- Uses iptables or IPVS
- Round robin within namespace
- SessionAffinity for client IP-based persistence
- External load balancers for cloud integration

**Example Configuration**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

### HAProxy Advanced Configuration

```
global
    maxconn 50000
    log /dev/log local0
    log /dev/log local1 notice
    user haproxy
    group haproxy
    daemon

defaults
    mode http
    log global
    option httplog
    option dontlognull
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend http_front
    bind *:80
    stats uri /haproxy?stats
    default_backend http_back

backend http_back
    balance leastconn
    option httpchk GET /health
    http-check expect status 200

    server server1 10.0.1.1:8080 check weight 3 maxconn 1000
    server server2 10.0.1.2:8080 check weight 2 maxconn 1000
    server server3 10.0.1.3:8080 check weight 1 maxconn 1000 backup

    cookie SERVERID insert indirect nocache

    option http-server-close
    option redispatch
    retries 3
```

## Algorithm Selection Guide

**Decision Matrix**:

| Scenario | Recommended Algorithm | Reason |
|----------|---------------------|---------|
| Stateless microservices | Round Robin | Simple, fair distribution |
| Heterogeneous servers | Weighted Round Robin | Accounts for capacity differences |
| Long-lived connections | Least Connections | Adapts to connection duration |
| Session-based apps | IP Hash | Built-in session persistence |
| Variable request complexity | Least Response Time | Optimizes for performance |
| WebSocket applications | IP Hash or Sticky | Maintains persistent connections |
| Auto-scaling environments | Weighted Least Connections | Handles dynamic capacity |
| Multi-region deployment | Geographic | Minimizes latency |
| High availability critical | Priority-Based | Ensures fallback servers |
| Cost optimization | Resource-Based | Efficient resource utilization |

## Performance Considerations

**Latency Impact**:
```
Algorithm             | Decision Time | State Overhead | Network Calls
---------------------|---------------|----------------|---------------
Round Robin          | O(1)          | Minimal        | None
Weighted RR          | O(n)          | Low            | None
Least Connections    | O(n)          | Medium         | None
Least Response Time  | O(n)          | High           | None
Resource-Based       | O(n)          | High           | Yes (metrics)
Geographic           | O(n)          | Medium         | Yes (geolocation)
```

**Scalability**:
- Static algorithms scale linearly with server count
- Dynamic algorithms require state synchronization
- Distributed systems benefit from stateless algorithms
- Consistent hashing scales well for session persistence

## Summary

**Key Takeaways**:

1. **Start Simple**: Begin with Round Robin, add complexity as needed
2. **Consider State**: Stateful apps need session persistence
3. **Monitor Performance**: Use metrics to validate algorithm choice
4. **Health Checks**: Essential for high availability
5. **Adaptability**: Dynamic algorithms provide better resource utilization
6. **Complexity Trade-off**: Balance sophistication with operational overhead

**Modern Best Practices**:
- Use multiple layers (DNS, Layer 4, Layer 7)
- Implement active and passive health checks
- Consider geographic distribution
- Plan for auto-scaling scenarios
- Monitor and adapt based on real traffic patterns
- Test failover scenarios regularly
- Document weight calculations and thresholds
