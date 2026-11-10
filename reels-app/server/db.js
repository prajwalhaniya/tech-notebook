const path = require('path');
const {DatabaseSync} = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL
  );
`);

const insertVisitor = db.prepare(
  'INSERT OR IGNORE INTO visitors (id, first_seen) VALUES (?, ?)',
);
const countVisitors = db.prepare('SELECT COUNT(*) AS count FROM visitors');

function recordVisitor(id) {
  insertVisitor.run(id, new Date().toISOString());
}

function getUniqueVisitCount() {
  return countVisitors.get().count;
}

module.exports = {recordVisitor, getUniqueVisitCount};
