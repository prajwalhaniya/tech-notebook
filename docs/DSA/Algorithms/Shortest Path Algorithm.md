---
sidebar_position: 1
---

# Shortest Path Algorithms

---

# 🌐 1. Graph Basics

## What is a Graph?

A graph consists of:

* Nodes (vertices)
* Edges (connections between nodes)

## Weighted Graph

A **weighted graph** is a graph where each edge has a value (weight).

Example:

```
A → B = 5
A → C = 2
```

Weights can represent:

* Distance
* Cost
* Time

---

## What are Negative Weights?

A **negative weight** means:

👉 Edge weight < 0

Example:

```
A → B = 4
B → C = -3
```

Interpretation:

* Moving from B → C reduces total cost

---

## Negative Cycle

A cycle where total weight is negative:

```
A → B = 1
B → C = -2
C → A = -2
```

Total = -3

👉 Infinite cost reduction → no shortest path exists

---

# ⚖️ Types of Graph Problems

| Graph Type                  | Algorithm    |
| --------------------------- | ------------ |
| Unweighted                  | BFS          |
| Weighted (non-negative)     | Dijkstra     |
| Weighted (negative allowed) | Bellman-Ford |

---

# 🚀 2. Dijkstra’s Algorithm

## When to Use

* Shortest path
* Minimum cost
* Non-negative weights

---

## Key Idea

* Always pick the **closest node first**
* Use **Min Heap (Priority Queue)**

---

## Complexity

* Time: O(E log V)

---

## Implementation (JS)

```javascript
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(node, dist) {
    this.heap.push({ node, dist });
    this.bubbleUp();
  }

  bubbleUp() {
    let i = this.heap.length - 1;
    while (i > 0) {
      let p = Math.floor((i - 1) / 2);
      if (this.heap[p].dist <= this.heap[i].dist) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  pop() {
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown(0);
    return top;
  }

  bubbleDown(i) {
    const n = this.heap.length;
    while (true) {
      let l = 2 * i + 1, r = 2 * i + 2, s = i;
      if (l < n && this.heap[l].dist < this.heap[s].dist) s = l;
      if (r < n && this.heap[r].dist < this.heap[s].dist) s = r;
      if (s === i) break;
      [this.heap[i], this.heap[s]] = [this.heap[s], this.heap[i]];
      i = s;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}

function dijkstra(graph, start) {
  const dist = {};
  const heap = new MinHeap();

  for (let node in graph) dist[node] = Infinity;
  dist[start] = 0;

  heap.push(start, 0);

  while (!heap.isEmpty()) {
    const { node, dist: d } = heap.pop();

    if (d > dist[node]) continue;

    for (let [nei, w] of graph[node]) {
      if (d + w < dist[nei]) {
        dist[nei] = d + w;
        heap.push(nei, dist[nei]);
      }
    }
  }

  return dist;
}
```

---

## Why Dijkstra Fails with Negative Weights

* Assumes current shortest path is final
* Negative edges can produce better paths later

---

# 🚀 3. Bellman-Ford Algorithm

## When to Use

* Negative weights exist
* Need to detect negative cycles

---

## Key Idea

* Relax all edges V-1 times
* Detect cycle in extra pass

---

## Complexity

* Time: O(V × E)

---

## Implementation (JS)

```javascript
function bellmanFord(vertices, edges, source) {
  const dist = {};

  for (let v of vertices) dist[v] = Infinity;
  dist[source] = 0;

  for (let i = 0; i < vertices.length - 1; i++) {
    let updated = false;

    for (let [u, v, w] of edges) {
      if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        updated = true;
      }
    }

    if (!updated) break;
  }

  for (let [u, v, w] of edges) {
    if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
      return { hasNegativeCycle: true };
    }
  }

  return { hasNegativeCycle: false, dist };
}
```

---

# 🌳 Graph vs Tree

* Tree = special graph with no cycles
* Only one path exists

👉 No need for Dijkstra in trees
👉 Use DFS/BFS instead

---

## Q1: When to use Dijkstra?

A: When graph has non-negative weights and we need shortest path

---

## Q2: When to use Bellman-Ford?

A: When graph has negative weights or need cycle detection

---

## Q3: Why does Dijkstra fail?

A: Greedy assumption breaks due to negative edges

---

## Q4: What is a negative cycle?

A: A cycle where total weight < 0, causing infinite cost reduction

---

## Q5: BFS vs Dijkstra?

| BFS        | Dijkstra |
| ---------- | -------- |
| Unweighted | Weighted |
| Queue      | Min Heap |

---

## Q6: Can we stop Dijkstra early?

A: Yes, when target node is reached

---

## Q7: Real-world use cases?

* Google Maps
* Network routing
* Pricing systems

---

# 🔥 Key Insight

> If multiple paths exist → optimization problem → use Dijkstra or Bellman-Ford

---

# 🚀 Final Summary

* Weighted graph = edges have cost
* Negative weight = cost reduction
* Dijkstra = fast, but no negative weights
* Bellman-Ford = slower, handles negatives
* Negative cycles = no valid shortest path

---

This is the complete interview-level understanding you need.
