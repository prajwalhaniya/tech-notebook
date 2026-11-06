// Single source of truth for which topics have a reels deck. Add an entry
// here once src/data/reels/<slug>.json exists — never speculatively, since
// dynamic-importing a file that doesn't exist fails the production build,
// not just this page. `count` is static (set after generation) so the hub
// page can show a card count without eagerly loading every topic's JSON.
export const REELS_TOPICS = {
  programming: {
    label: 'Programming',
    count: 117,
    loader: () => import('@site/src/data/reels/programming.json'),
  },
  dsa: {
    label: 'DSA',
    count: 94,
    loader: () => import('@site/src/data/reels/dsa.json'),
  },
  'nodejs-internals': {
    label: 'Node.js Internals',
    count: 127,
    loader: () => import('@site/src/data/reels/nodejs-internals.json'),
  },
  'design-patterns': {
    label: 'Design Patterns',
    count: 78,
    loader: () => import('@site/src/data/reels/design-patterns.json'),
  },
  database: {
    label: 'Database',
    count: 121,
    loader: () => import('@site/src/data/reels/database.json'),
  },
  lld: {
    label: 'LLD',
    count: 86,
    loader: () => import('@site/src/data/reels/lld.json'),
  },
  hld: {
    label: 'HLD',
    count: 105,
    loader: () => import('@site/src/data/reels/hld.json'),
  },
  development: {
    label: 'Development',
    count: 155,
    loader: () => import('@site/src/data/reels/development.json'),
  },
  testing: {
    label: 'Testing',
    count: 92,
    loader: () => import('@site/src/data/reels/testing.json'),
  },
  'c-addons-for-nodejs': {
    label: 'C++ Addons for Node.js',
    count: 55,
    loader: () => import('@site/src/data/reels/c-addons-for-nodejs.json'),
  },
  'ai-agents': {
    label: 'AI Agents',
    count: 118,
    loader: () => import('@site/src/data/reels/ai-agents.json'),
  },
  deployment: {
    label: 'Deployment',
    count: 99,
    loader: () => import('@site/src/data/reels/deployment.json'),
  },
  'software-management': {
    label: 'Software Management',
    count: 88,
    loader: () => import('@site/src/data/reels/software-management.json'),
  },
  technology: {
    label: 'Technology',
    count: 97,
    loader: () => import('@site/src/data/reels/technology.json'),
  },
};

export const AVAILABLE_REELS_TOPICS = Object.keys(REELS_TOPICS);
