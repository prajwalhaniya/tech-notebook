# Reels App

Standalone server + UI for browsing the Tech Notebook reels decks, independent of the Docusaurus site.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:4100 (set `PORT` to use a different port).

## How it works

- `data/reels/*.json` — one file per topic, each `{ topic, topicLabel, cards: [...] }`. This is the single source of truth; add a new topic by dropping another file here, no code changes needed.
- `server/` — a small Express app:
  - `GET /api/topics` — list of topics with label and card count.
  - `GET /api/reels/:slug?offset=0&limit=10` — a page of cards for one topic.
  - Serves `public/` as static files.
- `public/` — plain HTML/CSS/JS (no build step, no framework). `app.js` renders a topic-picker hub when there's no `?topic=` in the URL, or a swipeable deck when there is. The deck loads 10 cards up front and quietly fetches the next 10 once you're a few cards from the end of what's loaded, so scrolling never has to wait on the network.
