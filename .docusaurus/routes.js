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
    component: ComponentCreator('/docs', 'c0a'),
    routes: [
      {
        path: '/docs/category/arrays',
        component: ComponentCreator('/docs/category/arrays', '6e2'),
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
        path: '/docs/category/hash-table',
        component: ComponentCreator('/docs/category/hash-table', '660'),
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
        path: '/docs/category/react',
        component: ComponentCreator('/docs/category/react', '386'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/category/strings',
        component: ComponentCreator('/docs/category/strings', '0d5'),
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
        path: '/docs/DSA/Arrays/Introduction',
        component: ComponentCreator('/docs/DSA/Arrays/Introduction', '5ba'),
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
        path: '/docs/DSA/Hashtable/Concepts',
        component: ComponentCreator('/docs/DSA/Hashtable/Concepts', '6e0'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/DSA/Strings/Concepts',
        component: ComponentCreator('/docs/DSA/Strings/Concepts', '7fa'),
        exact: true,
        sidebar: "tutorialSidebar"
      },
      {
        path: '/docs/JavaScript/Concepts',
        component: ComponentCreator('/docs/JavaScript/Concepts', 'fa3'),
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
        path: '/docs/React/concepts',
        component: ComponentCreator('/docs/React/concepts', '49f'),
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
