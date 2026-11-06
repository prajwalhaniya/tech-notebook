import React from 'react';
import Link from '@docusaurus/Link';
import {REELS_TOPICS} from '@site/src/data/reels';
import styles from './styles.module.css';

// Same deterministic hash-to-hue trick the deck uses for its tag accents,
// applied here to each topic's label so the hub's color language matches
// the deck a visitor is about to open.
function accentForText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 45%)`;
}

export default function ReelsHub() {
  const topics = Object.entries(REELS_TOPICS);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.kicker}>Tech Notebook</span>
        <h1 className={styles.title}>Reels</h1>
        <p className={styles.subtitle}>
          A swipeable, bite-sized way to read through a topic — one idea per card. Pick a topic to start.
        </p>
      </div>

      <div className={styles.grid}>
        {topics.map(([slug, meta]) => (
          <Link
            key={slug}
            to={`/reels?topic=${slug}`}
            className={styles.card}
            style={{'--reel-accent': accentForText(meta.label)}}>
            <span className={styles.cardAccent} aria-hidden="true" />
            <span className={styles.cardLabel}>{meta.label}</span>
            <span className={styles.cardMeta}>
              {meta.count ? `${meta.count} cards` : 'Start reading'}
            </span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>

      <Link to="/docs/intro" className={styles.backLink}>
        ← Back to the notebook
      </Link>
    </div>
  );
}
