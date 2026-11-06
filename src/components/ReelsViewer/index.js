import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {REELS_TOPICS} from '@site/src/data/reels';
import useQueryTopic from '@site/src/data/reels/useQueryTopic';
import styles from './styles.module.css';

// Deterministic per-tag hue so each card gets its own accent color, like a
// reel's category color-coding — no manual tag-to-color map to maintain.
function accentForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 45%)`;
}

// Renders the deck for a known-valid topic. The caller (the /reels page
// router) is responsible for sending unknown/missing topics to the hub
// instead, so this component can assume `entry` exists.
export default function ReelsViewer() {
  const topic = useQueryTopic();
  const entry = REELS_TOPICS[topic];
  const closeTo = entry ? `/docs/category/${topic}/` : '/reels';

  const [data, setData] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  // Tracks the index we're navigating toward, updated synchronously on each
  // key press so rapid repeats stack correctly instead of all reading the
  // same stale value while a smooth-scroll/IntersectionObserver round trip
  // is still in flight.
  const activeIndexRef = useRef(0);

  useEffect(() => {
    setData(null);
    setActiveIndex(0);
    activeIndexRef.current = 0;
    if (!entry) return;
    let cancelled = false;
    entry.loader().then((mod) => {
      if (!cancelled) setData(mod.default ?? mod);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!data) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActiveIndex(Number(e.target.dataset.index));
          }
        });
      },
      {root: container, threshold: [0.6]},
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [data]);

  const goTo = (index) => {
    const cards = data?.cards ?? [];
    const clamped = Math.max(0, Math.min(cards.length - 1, index));
    activeIndexRef.current = clamped;
    cardRefs.current[clamped]?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  useEffect(() => {
    if (!data) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goTo(activeIndexRef.current + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(activeIndexRef.current - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>Loading…</p>
      </div>
    );
  }

  const cards = data.cards;
  const progress = ((activeIndex + 1) / cards.length) * 100;
  const activeAccent = accentForTag(cards[activeIndex]?.tag || '');

  return (
    <div className={styles.shell} style={{'--reel-accent': activeAccent}}>
      <div className={styles.topBar}>
        <Link to={closeTo} className={styles.closeLink} aria-label="Close reels">
          ×
        </Link>
        <span className={styles.topicLabel}>{data.topicLabel}</span>
        <span className={styles.counter}>
          {activeIndex + 1} / {cards.length}
        </span>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{width: `${progress}%`}} />
      </div>

      <div className={styles.deck} ref={containerRef}>
        {cards.map((card, i) => {
          const accent = accentForTag(card.tag);
          return (
            <article
              key={card.id}
              className={styles.card}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              data-index={i}
              style={{'--reel-accent': accent}}>
              <div className={styles.cardInner}>
                <span className={styles.cardNumber} aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.tag}>{card.tag}</span>
                <h2 className={styles.heading}>{card.heading}</h2>
                <span className={styles.accentBar} aria-hidden="true" />
                <p className={styles.hook}>{card.hook}</p>
                {card.body && <p className={styles.detail}>{card.body}</p>}
                {card.code && (
                  <pre className={styles.code}>
                    <code>{card.code}</code>
                  </pre>
                )}
                {card.sourceDoc && (
                  <Link to={card.sourceDoc} className={styles.sourceLink}>
                    Go deeper →
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className={styles.navHint}>↑ / ↓ · scroll · swipe</div>
    </div>
  );
}
