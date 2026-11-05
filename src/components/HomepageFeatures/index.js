import React from 'react';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const Contents = [
  {
    number: '01',
    title: 'Programming',
    description:
      'C++ and JavaScript fundamentals — syntax, paradigms, closures, and asynchronous programming.',
    link: '/docs/category/programming/',
  },
  {
    number: '02',
    title: 'DSA',
    description:
      'Data structures, algorithms, and the problem-solving patterns behind them.',
    link: '/docs/category/dsa/',
  },
  {
    number: '03',
    title: 'Node.js Internals',
    description:
      'The event loop, streams, memory management, and concurrency underneath the Node.js API.',
    link: '/docs/category/nodejs-internals/',
  },
  {
    number: '04',
    title: 'Design Patterns',
    description:
      'Reusable solutions to recurring design problems, and when each one actually applies.',
    link: '/docs/category/design-patterns/',
  },
  {
    number: '05',
    title: 'Database',
    description:
      'How data is stored, indexed, queried, modeled, and optimized across SQL and NoSQL systems.',
    link: '/docs/category/database/',
  },
  {
    number: '06',
    title: 'LLD',
    description:
      'Low-level design: classes, interfaces, and object-oriented design for real systems.',
    link: '/docs/category/lld/',
  },
  {
    number: '07',
    title: 'HLD',
    description:
      'High-level system design: architecture, scalability, reliability, and distributed systems.',
    link: '/docs/category/hld/',
  },
  {
    number: '08',
    title: 'Development',
    description:
      'Engineering practices — API design, code review, Git workflows, observability, and security.',
    link: '/docs/category/development/',
  },
  {
    number: '09',
    title: 'Testing',
    description:
      'Unit, integration, and load testing strategies for building reliable software.',
    link: '/docs/category/testing/',
  },
  {
    number: '10',
    title: 'C++ Addons for Node.js',
    description:
      'Building high-performance native addons for Node.js with the V8 API.',
    link: '/docs/category/c-addons-for-nodejs/',
  },
  {
    number: '11',
    title: 'AI Agents',
    description:
      'Agent architectures, memory systems, tool use, and multi-agent systems in production.',
    link: '/docs/category/ai-agents/',
  },
  {
    number: '12',
    title: 'Deployment',
    description:
      'Containers, CI/CD, load balancing, and the infrastructure that ships software to production.',
    link: '/docs/category/deployment/',
  },
  {
    number: '13',
    title: 'Software Management',
    description:
      'Project planning, stakeholder management, and productivity for engineering teams.',
    link: '/docs/category/software-management/',
  },
  {
    number: '14',
    title: 'Technology Fundamentals',
    description:
      'Protocols, networking, DNS, and the infrastructure that powers the internet.',
    link: '/docs/category/technology/',
  },
];

function ContentsRow({number, title, description, link}) {
  return (
    <Link to={link} className="notebookIndexEntry">
      <span className="notebookIndexNumber">{number}</span>
      <span className="notebookIndexBody">
        <span className="notebookIndexTitleRow">
          <span className="notebookIndexTitle">{title}</span>
          <span className="notebookIndexLeader" />
        </span>
        <span className="notebookIndexDescription">{description}</span>
      </span>
      <span className="notebookIndexArrow">→</span>
    </Link>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.contents}>
      <div className="container">
        <div className={styles.contentsHeader}>
          <h2 className={styles.contentsTitle}>Contents</h2>
          <span className={styles.contentsCount}>
            {String(Contents.length).padStart(2, '0')} sections
          </span>
        </div>

        <div className="notebookIndex">
          {Contents.map((entry) => (
            <ContentsRow key={entry.number} {...entry} />
          ))}
        </div>
      </div>
    </section>
  );
}
