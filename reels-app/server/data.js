const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'reels');

// Loaded once at startup and kept in memory — the decks are static content,
// so there's no reason to hit disk on every request.
const decks = new Map();

function loadDecks() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
    const deck = JSON.parse(raw);
    const slug = file.replace(/\.json$/, '');
    decks.set(slug, deck);
  }
  console.log(`Loaded ${decks.size} reels decks:`, [...decks.keys()].join(', '));
}

function listTopics() {
  return [...decks.entries()]
    .map(([slug, deck]) => ({
      slug,
      label: deck.topicLabel,
      count: deck.cards.length,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getDeck(slug) {
  return decks.get(slug) || null;
}

module.exports = {loadDecks, listTopics, getDeck};
