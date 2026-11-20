---
sidebar_position: 27
---

# Longest Substring Without Repeating Characters

The full write-up (understand, clarify, brute force, two sliding-window versions, the `"abba"` trap, tests, alternatives and follow-ups) lives in **[Sliding Window → Longest Substring Without Repeating Characters](../Sliding%20Window/03_Longest%20substring%20without%20repeating%20characters.md)**.

Quick reference (sliding window + last-seen index, O(n) time, O(min(n, alphabet)) space):

```js
function lengthOfLongestSubstring(s) {
  const lastSeen = new Map();
  let left = 0, best = 0;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) left = lastSeen.get(ch) + 1; // jump only within the window
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}

console.log(lengthOfLongestSubstring('abcabcbb')); // 3
console.log(lengthOfLongestSubstring('abba'));     // 2
```

Related: [Longest Repeating Character Replacement](../Sliding%20Window/05_Longest%20repeating%20character%20replacement.md), [Minimum Window Substring](../Sliding%20Window/06_Minimum%20Window%20Substring.md).
