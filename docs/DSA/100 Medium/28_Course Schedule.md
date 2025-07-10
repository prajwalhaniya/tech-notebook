---
sidebar_position: 26
---

There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai.

For example, the pair [0, 1], indicates that to take course 0 you have to first take course 1.
Return the ordering of courses you should take to finish all courses. If there are many valid answers, return any of them. If it is impossible to finish all courses, return an empty array.

Example 1:

Input: numCourses = 2, prerequisites = [[1,0]]
Output: [0,1]
Explanation: There are a total of 2 courses to take. To take course 1 you should have finished course 0. So the correct course order is [0,1].

```js
/**
 * @param {number} numCourses
 * @param {number[][]} prerequisites
 * @return {number[]}
 */
var findOrder = function(numCourses, prerequisites) {
    const adjList = new Array(numCourses).fill(0).map(() => []);
    const inDegree = new Array(numCourses).fill(0);
    const result = [];

    for (const [course, prereq] of prerequisites) {
        adjList[prereq].push(course);
        inDegree[course]++;
    }

    const queue = [];

    for (let i = 0; i < numCourses; i++) {
        if (inDegree[i] === 0) {
            queue.push(i);
        }
    }

    let count = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        result.push(current);
        count++;
    
        for (const neighbor of adjList[current]) {
            inDegree[neighbor]--;

            if (inDegree[neighbor] === 0) {
                queue.push(neighbor);
            }
        }
    }

    if (count !== numCourses) {
        return [];
    }

    return result;
};
```