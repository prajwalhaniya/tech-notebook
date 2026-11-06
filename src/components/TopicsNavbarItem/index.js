import React from 'react';
import {useLocation} from '@docusaurus/router';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';

// `prefix` must match the real top-level URL segment for that topic
// (i.e. the docs/<folder> name), not the slugified category label.
const TOPICS = [
  {label: 'Programming', prefix: '/docs/programming', to: '/docs/category/programming/'},
  {label: 'DSA', prefix: '/docs/DSA', to: '/docs/category/dsa/'},
  {label: 'Node.js Internals', prefix: '/docs/nodejs', to: '/docs/category/nodejs-internals/'},
  {label: 'Design Patterns', prefix: '/docs/designPatterns', to: '/docs/category/design-patterns/'},
  {label: 'Database', prefix: '/docs/Database', to: '/docs/category/database/'},
  {label: 'LLD', prefix: '/docs/LLD', to: '/docs/category/lld/'},
  {label: 'HLD', prefix: '/docs/HLD', to: '/docs/category/hld/'},
  {label: 'Development', prefix: '/docs/Development', to: '/docs/category/development/'},
  {label: 'Testing', prefix: '/docs/Testing', to: '/docs/category/testing/'},
  {label: 'C++ Addons for Node.js', prefix: '/docs/CPP_Addons', to: '/docs/category/c-addons-for-nodejs/'},
  {label: 'AI Agents', prefix: '/docs/agents', to: '/docs/category/ai-agents/'},
  {label: 'Deployment', prefix: '/docs/Deployment', to: '/docs/category/deployment/'},
  {label: 'Software Management', prefix: '/docs/Software_Management', to: '/docs/category/software-management/'},
  {label: 'Technology', prefix: '/docs/Tech_Fundamentals', to: '/docs/category/technology/'},
];

export default function TopicsNavbarItem(props) {
  const {pathname} = useLocation();
  // A topic's own Contents page lives under /docs/category/<slug>/, not
  // under /docs/<folder>/ — so both have to be checked to catch landing
  // on the Contents page itself, not just a doc nested inside the topic.
  const active = TOPICS.find(
    (topic) => pathname.startsWith(topic.prefix) || pathname.startsWith(topic.to),
  );

  return (
    <DropdownNavbarItem
      {...props}
      label={active ? active.label : 'Topics'}
      to={active ? active.to : '/docs/intro'}
      items={TOPICS.map(({label, to}) => ({label, to}))}
    />
  );
}
