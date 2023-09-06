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
    component: ComponentCreator('/docs', '2ef'),
    routes: [
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
        path: '/docs/category/nodejs',
        component: ComponentCreator('/docs/category/nodejs', '1ac'),
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
        path: '/docs/category/react',
        component: ComponentCreator('/docs/category/react', '386'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/search-algorithms',
        component: ComponentCreator('/docs/category/search-algorithms', '7ea'),
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
        path: '/docs/DSA/Problems/Memoize',
        component: ComponentCreator('/docs/DSA/Problems/Memoize', 'e98'),
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
        path: '/docs/DSA/Problems/Sleep',
        component: ComponentCreator('/docs/DSA/Problems/Sleep', '0f7'),
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
        path: '/docs/DSA/Search/Binary Search',
        component: ComponentCreator('/docs/DSA/Search/Binary Search', '4c8'),
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
      },
      {
        path: '/docs/nodejs/concepts',
        component: ComponentCreator('/docs/nodejs/concepts', '672'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/React/Components',
        component: ComponentCreator('/docs/React/Components', '0a0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/React/Fundamentals',
        component: ComponentCreator('/docs/React/Fundamentals', '3db'),
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
