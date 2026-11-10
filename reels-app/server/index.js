const crypto = require('crypto');
const path = require('path');
const express = require('express');
const {loadDecks, listTopics, getDeck} = require('./data');
const {recordVisitor, getUniqueVisitCount} = require('./db');

const PORT = process.env.PORT || 4100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const VISITOR_COOKIE = 'reels_visitor_id';
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, in seconds

loadDecks();

const app = express();

// Access log — every request that reaches the server gets one line, logged
// on response finish so it carries the real status code and timing.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });
  next();
});

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

// Unique-visit tracking — a long-lived anonymous cookie identifies the
// visitor; first time we see an id, it's recorded in SQLite.
app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  let visitorId = cookies[VISITOR_COOKIE];
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.setHeader(
      'Set-Cookie',
      `${VISITOR_COOKIE}=${visitorId}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`,
    );
  }
  recordVisitor(visitorId);
  next();
});

app.get('/api/stats', (req, res) => {
  res.json({uniqueVisits: getUniqueVisitCount()});
});

app.get('/api/topics', (req, res) => {
  res.json({topics: listTopics()});
});

app.get('/api/reels/:slug', (req, res) => {
  const deck = getDeck(req.params.slug);
  if (!deck) {
    res.status(404).json({error: `Unknown topic "${req.params.slug}"`});
    return;
  }

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT),
  );

  const cards = deck.cards.slice(offset, offset + limit);

  res.json({
    topic: deck.topic,
    topicLabel: deck.topicLabel,
    total: deck.cards.length,
    offset,
    limit,
    cards,
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Reels app running at http://localhost:${PORT}`);
});
