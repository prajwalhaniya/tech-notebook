import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '516'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '288'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'ecc'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'bb1'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '335'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '03c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '52a'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', '98e'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', 'cf9'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', '1bb'),
    exact: true
  },
  {
    path: '/blog/why dsa matter',
    component: ComponentCreator('/blog/why dsa matter', 'ddd'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '389'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '175'),
    routes: [
      {
        path: '/docs/category/100-easy',
        component: ComponentCreator('/docs/category/100-easy', 'c15'),
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
        path: '/docs/category/object-oriented-javascript',
        component: ComponentCreator('/docs/category/object-oriented-javascript', '2ac'),
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
        component: ComponentCreator('/docs/DSA/100 Easy/Add binary', '70d'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Longest common prefix',
        component: ComponentCreator('/docs/DSA/100 Easy/Longest common prefix', '7ce'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Merge two sorted lists',
        component: ComponentCreator('/docs/DSA/100 Easy/Merge two sorted lists', '851'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Palindrome',
        component: ComponentCreator('/docs/DSA/100 Easy/Palindrome', 'f0c'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Remove duplicates from sorted list',
        component: ComponentCreator('/docs/DSA/100 Easy/Remove duplicates from sorted list', '732'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Roman to integer',
        component: ComponentCreator('/docs/DSA/100 Easy/Roman to integer', '247'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Square Root',
        component: ComponentCreator('/docs/DSA/100 Easy/Square Root', '3a5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Two Sum',
        component: ComponentCreator('/docs/DSA/100 Easy/Two Sum', 'c3a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/100 Easy/Valid Parentheses',
        component: ComponentCreator('/docs/DSA/100 Easy/Valid Parentheses', '62e'),
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
        path: '/docs/JavaScript/Fundamentals',
        component: ComponentCreator('/docs/JavaScript/Fundamentals', 'c80'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/JavaScript/Object-oriented-JavaScript/Design Patterns',
        component: ComponentCreator('/docs/JavaScript/Object-oriented-JavaScript/Design Patterns', '0b6'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/JavaScript/Object-oriented-JavaScript/Interfaces',
        component: ComponentCreator('/docs/JavaScript/Object-oriented-JavaScript/Interfaces', '9cb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/JavaScript/Object-oriented-JavaScript/Introduction',
        component: ComponentCreator('/docs/JavaScript/Object-oriented-JavaScript/Introduction', '29d'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/JavaScript/Projects',
        component: ComponentCreator('/docs/JavaScript/Projects', 'e95'),
        exact: true,
        sidebar: "tutorialSidebar"
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', '54a'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
