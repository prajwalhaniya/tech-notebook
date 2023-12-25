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
    component: ComponentCreator('/blog', '2d9'),
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
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', '389'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '59c'),
    routes: [
      {
        path: '/docs/category/binary-search',
        component: ComponentCreator('/docs/category/binary-search', '721'),
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
        path: '/docs/category/depth-first-search',
        component: ComponentCreator('/docs/category/depth-first-search', '942'),
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
        path: '/docs/category/problems',
        component: ComponentCreator('/docs/category/problems', '3d8'),
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
        path: '/docs/DSA/Binary Search/overview',
        component: ComponentCreator('/docs/DSA/Binary Search/overview', '706'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Depth First Search/overview',
        component: ComponentCreator('/docs/DSA/Depth First Search/overview', '65e'),
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
        path: '/docs/DSA/Problems/Array Prototype Last',
        component: ComponentCreator('/docs/DSA/Problems/Array Prototype Last', '6b0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Array Reduce Transformation',
        component: ComponentCreator('/docs/DSA/Problems/Array Reduce Transformation', '448'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Cache with Time',
        component: ComponentCreator('/docs/DSA/Problems/Cache with Time', '670'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Compact Object',
        component: ComponentCreator('/docs/DSA/Problems/Compact Object', 'd15'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Container with most water',
        component: ComponentCreator('/docs/DSA/Problems/Container with most water', '540'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Counter',
        component: ComponentCreator('/docs/DSA/Problems/Counter', '4d0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Counter Two',
        component: ComponentCreator('/docs/DSA/Problems/Counter Two', '13e'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Event Emitter',
        component: ComponentCreator('/docs/DSA/Problems/Event Emitter', '700'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Execute Asynchronous Functions In Parallel',
        component: ComponentCreator('/docs/DSA/Problems/Execute Asynchronous Functions In Parallel', '4b2'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Fibonnacci',
        component: ComponentCreator('/docs/DSA/Problems/Fibonnacci', 'efb'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Filter Elements From Array',
        component: ComponentCreator('/docs/DSA/Problems/Filter Elements From Array', 'fd7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Function Composition',
        component: ComponentCreator('/docs/DSA/Problems/Function Composition', '6b0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Group Anagrams',
        component: ComponentCreator('/docs/DSA/Problems/Group Anagrams', '57a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Group By',
        component: ComponentCreator('/docs/DSA/Problems/Group By', '474'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Join Two Arrays By Id',
        component: ComponentCreator('/docs/DSA/Problems/Join Two Arrays By Id', '1ad'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Longest substring without repeating characters',
        component: ComponentCreator('/docs/DSA/Problems/Longest substring without repeating characters', '396'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Memoize',
        component: ComponentCreator('/docs/DSA/Problems/Memoize', 'e98'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Merge Intervals',
        component: ComponentCreator('/docs/DSA/Problems/Merge Intervals', '648'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Merge Sorted Array',
        component: ComponentCreator('/docs/DSA/Problems/Merge Sorted Array', 'c08'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Minimum size subarray sum',
        component: ComponentCreator('/docs/DSA/Problems/Minimum size subarray sum', '491'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Nested Array Generator',
        component: ComponentCreator('/docs/DSA/Problems/Nested Array Generator', '02f'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Promise Time Limit',
        component: ComponentCreator('/docs/DSA/Problems/Promise Time Limit', 'a09'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Recursive Flatten',
        component: ComponentCreator('/docs/DSA/Problems/Recursive Flatten', 'b6b'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Reverse words in a string',
        component: ComponentCreator('/docs/DSA/Problems/Reverse words in a string', '831'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Sleep',
        component: ComponentCreator('/docs/DSA/Problems/Sleep', '0f7'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Summary Ranges',
        component: ComponentCreator('/docs/DSA/Problems/Summary Ranges', '11a'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/To Be or Not To Be',
        component: ComponentCreator('/docs/DSA/Problems/To Be or Not To Be', 'e96'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Two Sum II',
        component: ComponentCreator('/docs/DSA/Problems/Two Sum II', '9b5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Valid Palindrome',
        component: ComponentCreator('/docs/DSA/Problems/Valid Palindrome', 'd54'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Valid Sudoku',
        component: ComponentCreator('/docs/DSA/Problems/Valid Sudoku', '0e5'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Problems/Zigzag Conversion',
        component: ComponentCreator('/docs/DSA/Problems/Zigzag Conversion', 'b5f'),
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
