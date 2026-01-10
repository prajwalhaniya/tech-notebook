---
sidebar_position: 1
---

```js
class TokenBucket {
  constructor(capacity) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
    
    setInterval(() => {
        // the interval at which the bucket will be filled can be dynamic
        this.refill();
    }, 10 * 1000);
  }

  consume(tokens = 1) {
    if (this.tokens >= tokens) {
        this.tokens -= tokens;
        console.log('Consumed', tokens);
        console.log('Remaining tokens:', this.tokens);
        return true;
    } else {
        console.log('No Tokens available to consume. Please try again later');
        return false;
    }
  }

  refill() {
    const now = Date.now();
    console.log('Refilling tokens');
    const timePassed = now - this.lastRefill;
    const tokensToAdd = this.capacity - this.tokens;
    console.log(tokensToAdd);
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
    console.log('Total Available tokens after refill: ', this.tokens)
  }
}

const bucket = new TokenBucket(20, 10);
setInterval(() => {
    bucket.consume(5);
}, 3000);

```