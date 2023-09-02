import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', 'd92'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '584'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'd00'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'd9f'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', 'ab4'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '776'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '49e'),
    exact: true
  },
  {
    path: '/blog',
    component: ComponentCreator('/blog', 'bea'),
    exact: true
  },
  {
    path: '/blog/archive',
    component: ComponentCreator('/blog/archive', 'b9b'),
    exact: true
  },
  {
    path: '/blog/welcome',
    component: ComponentCreator('/blog/welcome', '8de'),
    exact: true
  },
  {
    path: '/markdown-page',
    component: ComponentCreator('/markdown-page', 'e16'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '68c'),
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
        path: '/docs/JavaScript/Concepts',
        component: ComponentCreator('/docs/JavaScript/Concepts', 'fa3'),
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
    component: ComponentCreator('/', '38b'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
