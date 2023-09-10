---
sidebar_position: 25
---
You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]).

Find two lines that together with the x-axis form a container, such that the container contains the most water.

Return the maximum amount of water a container can store.

Notice that you may not slant the container.

```js
function maxWater(arr) {
    let max = 0;
    let left = 0;
    let right = arr.length - 1;

    while (left < right) {
        const h1 = arr[left];
        const h2 = arr[right];
        const minHeight = Math.min(h1, h2);
        const width = right - left;
        const area = minHeight * width;

        max = Math.max(max, area);

        if (h1 < h2) {
            left++;
        } else {
            right--;
        }
    }
    return max;
}

const arr = [1,8,6,2,5,4,8,3,7];
console.log(maxWater(arr));
```