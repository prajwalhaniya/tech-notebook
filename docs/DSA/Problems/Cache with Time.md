---
sidebar_position: 3
---

Write a class that allows getting and setting key-value pairs, however a time until expiration is associated with each key.

The class has three public methods:

`set(key, value, duration)`: accepts an integer key, an integer value, and a duration in milliseconds. Once the duration has elapsed, the key should be inaccessible. The method should return true if the same un-expired key already exists and false otherwise. Both the value and duration should be overwritten if the key already exists.

`get(key)`: if an un-expired key exists, it should return the associated value. Otherwise it should return -1.

`count()`: returns the count of un-expired keys.

```js
var TimeLimitedCache = function() {
    this.data = new Map();
};

TimeLimitedCache.prototype.set = function(key, value, duration) {
    const currentTime = Date.now();
    const expirationTime = currentTime + duration;
    
    if (this.data.has(key) && this.data.get(key).expirationTime > currentTime) {
        this.data.set(key, { value, expirationTime });
        return true;
    } else {
        this.data.set(key, { value, expirationTime });
        return false;
    }
};

TimeLimitedCache.prototype.get = function(key) {
    const entry = this.data.get(key);
    if (entry && entry.expirationTime > Date.now()) {
        return entry.value;
    }
    return -1;
};

TimeLimitedCache.prototype.count = function() {
    const currentTime = Date.now();
    let count = 0;

    for (const [, entry] of this.data) {
        if (entry.expirationTime > currentTime) {
            count++
        }
    }
    return count;
    
};

var obj = new TimeLimitedCache()
obj.set(1, 42, 1000);
obj.get(1)
obj.count()

```