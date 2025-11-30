import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '6b3'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '286'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', '4d9'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', '932'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', 'd30'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '183'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '931'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', 'ca7'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', 'eaa'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', '312'),
    exact: true
  },
  {
    path: '/blog/why dsa matter',
    component: ComponentCreator('/blog/why dsa matter', '8ed'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '79b'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', 'ee0'),
    routes: [
      {
        path: '/docs/category/100-easy',
        component: ComponentCreator('/docs/category/100-easy', 'c15'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/100-medium',
        component: ComponentCreator('/docs/category/100-medium', '070'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/arrays-specific-problems',
        component: ComponentCreator('/docs/category/arrays-specific-problems', '096'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/arraysstrings',
        component: ComponentCreator('/docs/category/arraysstrings', 'e3b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/caching',
        component: ComponentCreator('/docs/category/caching', '752'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/database',
        component: ComponentCreator('/docs/category/database', '03e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/deployment',
        component: ComponentCreator('/docs/category/deployment', '901'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/dsa',
        component: ComponentCreator('/docs/category/dsa', '14a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/java-specific-problems',
        component: ComponentCreator('/docs/category/java-specific-problems', '42a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/javascript',
        component: ComponentCreator('/docs/category/javascript', 'bb0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/javascript-specific-problems',
        component: ComponentCreator('/docs/category/javascript-specific-problems', 'b72'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/lld',
        component: ComponentCreator('/docs/category/lld', '3cc'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/object-oriented-javascript',
        component: ComponentCreator('/docs/category/object-oriented-javascript', '2ac'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/programming-languages',
        component: ComponentCreator('/docs/category/programming-languages', '5d7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/rate-limiting-algorithms',
        component: ComponentCreator('/docs/category/rate-limiting-algorithms', '48a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/rust',
        component: ComponentCreator('/docs/category/rust', 'ec7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/trees',
        component: ComponentCreator('/docs/category/trees', 'ba9'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Database/concepts',
        component: ComponentCreator('/docs/Database/concepts', '3ca'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/Deployment/concepts',
        component: ComponentCreator('/docs/Deployment/concepts', '7a1'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Add binary',
        component: ComponentCreator('/docs/DSA/100 Easy/Add binary', '6d9'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Best time to buy & sell stock',
        component: ComponentCreator('/docs/DSA/100 Easy/Best time to buy & sell stock', 'cc5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Can place flowers',
        component: ComponentCreator('/docs/DSA/100 Easy/Can place flowers', '875'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Convert sorted array to binary search tree',
        component: ComponentCreator('/docs/DSA/100 Easy/Convert sorted array to binary search tree', 'f3a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Diameter of a binary tree',
        component: ComponentCreator('/docs/DSA/100 Easy/Diameter of a binary tree', 'aa7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Find Pivot Index',
        component: ComponentCreator('/docs/DSA/100 Easy/Find Pivot Index', '02e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Greatest common divisor of strings',
        component: ComponentCreator('/docs/DSA/100 Easy/Greatest common divisor of strings', '22e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Linked list cycle',
        component: ComponentCreator('/docs/DSA/100 Easy/Linked list cycle', '16e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Longest common prefix',
        component: ComponentCreator('/docs/DSA/100 Easy/Longest common prefix', 'd91'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Maximum Average Subarray I',
        component: ComponentCreator('/docs/DSA/100 Easy/Maximum Average Subarray I', 'c05'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Maximum Depth of a Binary tree',
        component: ComponentCreator('/docs/DSA/100 Easy/Maximum Depth of a Binary tree', '6dc'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Maximum Depth of binary tree',
        component: ComponentCreator('/docs/DSA/100 Easy/Maximum Depth of binary tree', '150'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Merge two sorted lists',
        component: ComponentCreator('/docs/DSA/100 Easy/Merge two sorted lists', '71d'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Move Zeros',
        component: ComponentCreator('/docs/DSA/100 Easy/Move Zeros', '941'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Palindrome',
        component: ComponentCreator('/docs/DSA/100 Easy/Palindrome', '2e3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Palindrome Linked List',
        component: ComponentCreator('/docs/DSA/100 Easy/Palindrome Linked List', 'de6'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Remove duplicates from sorted list',
        component: ComponentCreator('/docs/DSA/100 Easy/Remove duplicates from sorted list', 'e1d'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Reverse a linked list',
        component: ComponentCreator('/docs/DSA/100 Easy/Reverse a linked list', '2e3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Reverse vowels of a string',
        component: ComponentCreator('/docs/DSA/100 Easy/Reverse vowels of a string', '9fa'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Roman to integer',
        component: ComponentCreator('/docs/DSA/100 Easy/Roman to integer', '3ea'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Square Root',
        component: ComponentCreator('/docs/DSA/100 Easy/Square Root', 'b16'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Two Sum',
        component: ComponentCreator('/docs/DSA/100 Easy/Two Sum', 'dc4'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Valid Parentheses',
        component: ComponentCreator('/docs/DSA/100 Easy/Valid Parentheses', '46e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Add Two Numbers',
        component: ComponentCreator('/docs/DSA/100 Medium/Add Two Numbers', '743'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Best time to buy & sell stock',
        component: ComponentCreator('/docs/DSA/100 Medium/Best time to buy & sell stock', 'cbb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Binary Tree Level Order Traversal',
        component: ComponentCreator('/docs/DSA/100 Medium/Binary Tree Level Order Traversal', 'c7b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Binary Tree Right Side View',
        component: ComponentCreator('/docs/DSA/100 Medium/Binary Tree Right Side View', '83d'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Construct Binary Tree from Preorder and Inorder Traversal',
        component: ComponentCreator('/docs/DSA/100 Medium/Construct Binary Tree from Preorder and Inorder Traversal', '311'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Container with most water',
        component: ComponentCreator('/docs/DSA/100 Medium/Container with most water', '704'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Course Schedule',
        component: ComponentCreator('/docs/DSA/100 Medium/Course Schedule', '920'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Decode string',
        component: ComponentCreator('/docs/DSA/100 Medium/Decode string', 'ef8'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Delete the middle node of a linked list',
        component: ComponentCreator('/docs/DSA/100 Medium/Delete the middle node of a linked list', '100'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Dota2 Senate',
        component: ComponentCreator('/docs/DSA/100 Medium/Dota2 Senate', 'd14'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Find All Anagrams in a String',
        component: ComponentCreator('/docs/DSA/100 Medium/Find All Anagrams in a String', 'a44'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Increasing triplet subsequence',
        component: ComponentCreator('/docs/DSA/100 Medium/Increasing triplet subsequence', 'c50'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Kth smallest element in BST',
        component: ComponentCreator('/docs/DSA/100 Medium/Kth smallest element in BST', '792'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Largest Number',
        component: ComponentCreator('/docs/DSA/100 Medium/Largest Number', 'd10'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Longest Palidromic Substring',
        component: ComponentCreator('/docs/DSA/100 Medium/Longest Palidromic Substring', '171'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Longest repeating character replacement',
        component: ComponentCreator('/docs/DSA/100 Medium/Longest repeating character replacement', 'f97'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Longest substring without repeating characters',
        component: ComponentCreator('/docs/DSA/100 Medium/Longest substring without repeating characters', '6a1'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Lowest Common Ancestor of binary tree.md',
        component: ComponentCreator('/docs/DSA/100 Medium/Lowest Common Ancestor of binary tree.md', 'f25'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Max width of a binary tree',
        component: ComponentCreator('/docs/DSA/100 Medium/Max width of a binary tree', 'f73'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Number of Islands',
        component: ComponentCreator('/docs/DSA/100 Medium/Number of Islands', 'acb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Odd even linked list',
        component: ComponentCreator('/docs/DSA/100 Medium/Odd even linked list', '3f8'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Path sum',
        component: ComponentCreator('/docs/DSA/100 Medium/Path sum', '3ca'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Product of Array Except Self',
        component: ComponentCreator('/docs/DSA/100 Medium/Product of Array Except Self', '683'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Remove starts from string',
        component: ComponentCreator('/docs/DSA/100 Medium/Remove starts from string', '23a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Reorder List',
        component: ComponentCreator('/docs/DSA/100 Medium/Reorder List', 'eda'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Rotate Image',
        component: ComponentCreator('/docs/DSA/100 Medium/Rotate Image', 'dd8'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Rotate list',
        component: ComponentCreator('/docs/DSA/100 Medium/Rotate list', 'de3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Set Matrix Zeros',
        component: ComponentCreator('/docs/DSA/100 Medium/Set Matrix Zeros', '4cb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Sort List',
        component: ComponentCreator('/docs/DSA/100 Medium/Sort List', '2de'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Spiral Matrix',
        component: ComponentCreator('/docs/DSA/100 Medium/Spiral Matrix', 'f79'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/String to integer',
        component: ComponentCreator('/docs/DSA/100 Medium/String to integer', '027'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/trie',
        component: ComponentCreator('/docs/DSA/100 Medium/trie', '05a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Valid Sudoku',
        component: ComponentCreator('/docs/DSA/100 Medium/Valid Sudoku', 'e21'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Medium/Validate Binary Search Tree',
        component: ComponentCreator('/docs/DSA/100 Medium/Validate Binary Search Tree', '3f9'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/caching/Introduction',
        component: ComponentCreator('/docs/DSA/caching/Introduction', '640'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/caching/Least Frequently Used',
        component: ComponentCreator('/docs/DSA/caching/Least Frequently Used', '978'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/caching/Least Recently Used',
        component: ComponentCreator('/docs/DSA/caching/Least Recently Used', '7c5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Fundamentals',
        component: ComponentCreator('/docs/DSA/Fundamentals', '570'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/java/Arrays/Best Time to Buy and Sell Stock',
        component: ComponentCreator('/docs/DSA/java/Arrays/Best Time to Buy and Sell Stock', 'f50'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/java/Arrays/Best Time to Buy And Sell Stock II',
        component: ComponentCreator('/docs/DSA/java/Arrays/Best Time to Buy And Sell Stock II', '18a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Array Prototype Last',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Array Prototype Last', 'f56'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Array Reduce Transformation',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Array Reduce Transformation', 'e6f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Cache with Time',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Cache with Time', 'ddd'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Compact Object',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Compact Object', 'a2c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Container with most water',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Container with most water', 'a48'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Counter',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Counter', '273'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Counter Two',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Counter Two', 'e47'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Event Emitter',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Event Emitter', '281'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Execute Asynchronous Functions In Parallel',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Execute Asynchronous Functions In Parallel', 'e72'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Fibonnacci',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Fibonnacci', '9f8'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Filter Elements From Array',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Filter Elements From Array', '250'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Function Composition',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Function Composition', 'd5c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Group Anagrams',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Group Anagrams', '894'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Group By',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Group By', '143'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Join Two Arrays By Id',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Join Two Arrays By Id', '4a3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Longest substring without repeating characters',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Longest substring without repeating characters', 'c9c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Memoize',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Memoize', 'e6b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Merge Intervals',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Merge Intervals', '86c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Merge Sorted Array',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Merge Sorted Array', '2c7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Minimum size subarray sum',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Minimum size subarray sum', 'a01'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Nested Array Generator',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Nested Array Generator', '2bb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Promise Time Limit',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Promise Time Limit', 'e17'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Recursive Flatten',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Recursive Flatten', 'e9c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Reverse words in a string',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Reverse words in a string', '33b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Sleep',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Sleep', '176'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Summary Ranges',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Summary Ranges', '83c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/To Be or Not To Be',
        component: ComponentCreator('/docs/DSA/Javascript Specific/To Be or Not To Be', '5dc'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Two Sum II',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Two Sum II', 'b6b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Valid Palindrome',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Valid Palindrome', 'b85'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Valid Sudoku',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Valid Sudoku', '6ec'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Javascript Specific/Zigzag Conversion',
        component: ComponentCreator('/docs/DSA/Javascript Specific/Zigzag Conversion', '5d6'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Rate Limiting Algorithms/Token Bucket Algorithm',
        component: ComponentCreator('/docs/DSA/Rate Limiting Algorithms/Token Bucket Algorithm', 'a3b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Trees/concepts',
        component: ComponentCreator('/docs/DSA/Trees/concepts', 'eac'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/LLD/Design a parking lot',
        component: ComponentCreator('/docs/LLD/Design a parking lot', 'e88'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Arrays&Strings/Array Methods',
        component: ComponentCreator('/docs/programming/JavaScript/Arrays&Strings/Array Methods', 'b99'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Fundamentals',
        component: ComponentCreator('/docs/programming/JavaScript/Fundamentals', 'c05'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Object-oriented-JavaScript/Design Patterns',
        component: ComponentCreator('/docs/programming/JavaScript/Object-oriented-JavaScript/Design Patterns', '793'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Object-oriented-JavaScript/Interfaces',
        component: ComponentCreator('/docs/programming/JavaScript/Object-oriented-JavaScript/Interfaces', 'ecd'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Object-oriented-JavaScript/Introduction',
        component: ComponentCreator('/docs/programming/JavaScript/Object-oriented-JavaScript/Introduction', '687'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/JavaScript/Projects',
        component: ComponentCreator('/docs/programming/JavaScript/Projects', 'fd3'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/programming/Rust/Fundamentals',
        component: ComponentCreator('/docs/programming/Rust/Fundamentals', 'b51'),
        exact: true,
        sidebar: "tutorialSidebar"
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', '322'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
