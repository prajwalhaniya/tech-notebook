---
sidebar_position: 25
---

# Container With Most Water

The full write-up (understand, clarify, brute force, the two-pointer proof, tests, alternatives and follow-ups) lives in **[100 Medium → Container With Most Water](../100%20Medium/08_Container%20with%20most%20water.md)**.

Quick reference (two pointers, O(n) time, O(1) space):

```js
function maxArea(height) {
  let left = 0, right = height.length - 1, best = 0;

  while (left < right) {
    best = Math.max(best, (right - left) * Math.min(height[left], height[right]));
    if (height[left] < height[right]) left++; // move the shorter wall: it's the bottleneck
    else right--;
  }
  return best;
}

console.log(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7])); // 49
```

Related: [Trapping Rain Water](../100%20Medium/39_Trapping%20Rain%20Water.md), where every bar counts and the water is summed.
