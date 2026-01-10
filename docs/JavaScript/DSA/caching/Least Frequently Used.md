---
sidebar_position: 2
---

```js
class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.frequency = 1;
    this.prev = null;
    this.next = null;
  }
}

class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
    this.freqMap = new Map();
    this.minFrequency = 1;
  }

  get(key) {
    if (!this.cache.has(key)) {
      return -1; // Key not found
    }

    const node = this.cache.get(key);
    this.updateFrequency(node);

    return node.value;
  }

  put(key, value) {
    if (this.capacity === 0) {
      return; // No capacity, do nothing
    }

    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      node.value = value;
      this.updateFrequency(node);
    } else {
      if (this.cache.size >= this.capacity) {
        this.evict();
      }

      const newNode = new Node(key, value);
      this.cache.set(key, newNode);
      this.addToFreqMap(newNode);
      this.minFrequency = 1; // Reset minFrequency when adding a new node
    }
  }

  updateFrequency(node) {
    const frequency = node.frequency;
    this.freqMap.get(frequency).delete(node);

    if (this.minFrequency === frequency && this.freqMap.get(frequency).size === 0) {
      this.minFrequency += 1; // No nodes with minFrequency left
    }

    node.frequency += 1;
    this.addToFreqMap(node);
  }

  addToFreqMap(node) {
    const frequency = node.frequency;
    if (!this.freqMap.has(frequency)) {
      this.freqMap.set(frequency, new Set());
    }

    this.freqMap.get(frequency).add(node);
  }

  evict() {
    const minFreqNodes = this.freqMap.get(this.minFrequency);
    const evictNode = minFreqNodes.values().next().value;

    minFreqNodes.delete(evictNode);
    this.cache.delete(evictNode.key);
  }
}

const lfuCache = new LFUCache(2);
lfuCache.put(1, 1);
lfuCache.put(2, 2);
console.log(lfuCache.get(1)); // Output 1
lfuCache.put(3, 3); // Remove key 2
console.log(lfuCache.get(2)); // Output -1 (not found)
console.log(lfuCache.get(3)); // Output 3
console.log(lfuCache.get(1)); // Output 1

```