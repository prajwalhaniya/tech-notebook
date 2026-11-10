const PREFETCH_LIMIT = 10;
const PREFETCH_THRESHOLD = 3; // fetch the next batch once this many cards remain unseen

const app = document.getElementById('app');

// ---------------------------------------------------------------
// THEME — light/dark toggle, persisted and independent of the router
// ---------------------------------------------------------------

const THEME_KEY = 'reels-theme';
const themeToggle = document.getElementById('theme-toggle');

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function effectiveTheme() {
  return document.documentElement.getAttribute('data-theme') || (systemPrefersDark() ? 'dark' : 'light');
}

function applyTheme(theme) {
  if (theme) {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const isDark = effectiveTheme() === 'dark';
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage unavailable (private browsing, etc.) — the toggle still
    // works for the current page load, it just won't persist.
  }
}

const storedTheme = readStoredTheme();
applyTheme(storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null);

themeToggle.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  storeTheme(next);
  applyTheme(next);
});

function accentFor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 45%)`;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null) {
      node.setAttribute(key, value);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === undefined || child === null || child === false) return;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------
// HUB — topic picker
// ---------------------------------------------------------------

async function renderHub() {
  app.innerHTML = '';
  const hub = el('div', {className: 'hub'}, [
    el('span', {className: 'hub-kicker'}, 'Tech Notebook'),
    el('h1', {className: 'hub-title'}, 'Reels'),
    el(
      'p',
      {className: 'hub-subtitle'},
      'A swipeable, bite-sized way to read through a topic — one idea per card. Pick a topic to start.',
    ),
  ]);
  const grid = el('div', {className: 'hub-grid'});
  hub.appendChild(grid);
  app.appendChild(hub);

  let topics;
  try {
    ({topics} = await fetchJSON('/api/topics'));
  } catch (err) {
    grid.appendChild(el('p', {className: 'hub-empty'}, `Couldn't load topics: ${err.message}`));
    return;
  }

  if (!topics.length) {
    grid.appendChild(el('p', {className: 'hub-empty'}, 'No reels decks found yet.'));
    return;
  }

  topics.forEach((topic) => {
    const accent = accentFor(topic.label);
    const card = el(
      'a',
      {
        className: 'hub-card',
        href: `/?topic=${encodeURIComponent(topic.slug)}`,
        style: {'--accent': accent},
      },
      [
        el('span', {className: 'hub-card-accent'}),
        el('span', {className: 'hub-card-label'}, topic.label),
        el('span', {className: 'hub-card-arrow'}, '→'),
      ],
    );
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------
// DECK — the swipeable reel viewer, with progressive loading
// ---------------------------------------------------------------

function renderCard(card, index) {
  const accent = accentFor(card.tag);
  const inner = el('div', {className: 'card-inner'}, [
    el('span', {className: 'card-number'}, String(index + 1).padStart(2, '0')),
    el('span', {className: 'tag'}, card.tag),
    el('h2', {className: 'heading'}, card.heading),
    el('span', {className: 'accent-bar'}),
    el('p', {className: 'hook'}, card.hook),
    card.body ? el('p', {className: 'detail'}, card.body) : null,
    card.code ? el('pre', {className: 'code'}, el('code', {}, card.code)) : null,
  ]);
  return el(
    'article',
    {className: 'card', style: {'--accent': accent}},
    [inner],
  );
}

async function renderDeck(slug) {
  app.innerHTML = '';

  let first;
  try {
    first = await fetchJSON(`/api/reels/${encodeURIComponent(slug)}?offset=0&limit=${PREFETCH_LIMIT}`);
  } catch (err) {
    app.appendChild(
      el('div', {className: 'empty'}, [
        el('p', {className: 'empty-title'}, "Reels aren't available for this topic"),
        el('a', {href: '/'}, '← Back to the notebook'),
      ]),
    );
    return;
  }

  const state = {
    topicLabel: first.topicLabel,
    total: first.total,
    cards: [],
    loadedCount: 0,
    activeIndex: 0,
    fetchingMore: false,
  };

  const closeLink = el('a', {className: 'close-link', href: '/'}, '×');
  const topicLabel = el('span', {className: 'topic-label'}, state.topicLabel);
  const topBar = el('div', {className: 'top-bar'}, [closeLink, topicLabel]);

  const progressFill = el('div', {className: 'progress-fill', style: {width: '0%'}});
  const progressTrack = el('div', {className: 'progress-track'}, [progressFill]);

  const deckEl = el('div', {className: 'deck'});
  const navHint = el('div', {className: 'nav-hint'}, '↑ / ↓ · scroll · swipe');

  const shell = el('div', {className: 'shell'}, [topBar, progressTrack, deckEl, navHint]);
  app.appendChild(shell);

  function setActive(index, accent) {
    state.activeIndex = index;
    progressFill.style.width = `${((index + 1) / state.total) * 100}%`;
    if (accent) {
      shell.style.setProperty('--accent', accent);
      progressFill.style.setProperty('--accent', accent);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const index = Number(entry.target.dataset.index);
          const card = state.cards[index];
          setActive(index, accentFor(card.tag));
          maybePrefetch();
        }
      });
    },
    {root: deckEl, threshold: [0.6]},
  );

  function appendCards(cards) {
    cards.forEach((card) => {
      const index = state.cards.length;
      state.cards.push(card);
      const cardEl = renderCard(card, index);
      cardEl.dataset.index = String(index);
      deckEl.appendChild(cardEl);
      observer.observe(cardEl);
    });
    state.loadedCount = state.cards.length;
  }

  async function maybePrefetch() {
    if (state.fetchingMore) return;
    if (state.loadedCount >= state.total) return;
    if (state.loadedCount - state.activeIndex - 1 > PREFETCH_THRESHOLD) return;
    state.fetchingMore = true;
    try {
      const next = await fetchJSON(
        `/api/reels/${encodeURIComponent(slug)}?offset=${state.loadedCount}&limit=${PREFETCH_LIMIT}`,
      );
      appendCards(next.cards);
    } catch (err) {
      console.error('Failed to load more reels:', err);
    } finally {
      state.fetchingMore = false;
    }
  }

  appendCards(first.cards);
  setActive(0, accentFor(first.cards[0]?.tag || ''));
  maybePrefetch();

  // Optimistic target index so rapid key repeats stack correctly instead of
  // all reading the same stale value while a smooth-scroll round trip is
  // still in flight.
  let targetIndex = 0;
  function goTo(index) {
    const clamped = Math.max(0, Math.min(state.loadedCount - 1, index));
    targetIndex = clamped;
    const cardEl = deckEl.children[clamped];
    cardEl?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  window.addEventListener('keydown', (e) => {
    if (!app.contains(shell)) return;
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      goTo(targetIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goTo(targetIndex - 1);
    }
  });
}

// ---------------------------------------------------------------
// ROUTER
// ---------------------------------------------------------------

function route() {
  const topic = new URLSearchParams(window.location.search).get('topic');
  if (topic) {
    renderDeck(topic);
  } else {
    renderHub();
  }
}

window.addEventListener('popstate', route);
route();
