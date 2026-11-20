import React, {useEffect, useState, useCallback} from 'react';
import {findMatchingBlockIndices, MIN_LENGTH, MAX_LENGTH} from '@site/src/utils/concordance';
import {EVENT_NAME, readEnabled} from '@site/src/utils/highlightState';
import styles from './styles.module.css';

const CONTENT_SELECTOR = '.markdown, article';
const BLOCK_SELECTOR = 'p, li, td, th, h1, h2, h3, h4, blockquote, figcaption';

export default function HighlightConcordance() {
  const [enabled, setEnabled] = useState(false);
  const [matches, setMatches] = useState(null); // null = panel closed

  useEffect(() => {
    setEnabled(readEnabled());
    const onToggle = (event) => setEnabled(Boolean(event.detail && event.detail.enabled));
    window.addEventListener(EVENT_NAME, onToggle);
    return () => window.removeEventListener(EVENT_NAME, onToggle);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMatches(null);
      return undefined;
    }
    const onSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection ? selection.toString() : '';
      const trimmedLength = text.trim().length;
      if (trimmedLength < MIN_LENGTH || trimmedLength > MAX_LENGTH) {
        // Out of bounds: leave the panel exactly as it was (closed, or
        // showing a previous real result) rather than opening/replacing
        // it with a result for a selection too short or long to be a
        // meaningful lookup — findMatchingBlockIndices would return an
        // empty array for this case too, but that's indistinguishable
        // from "searched and found nothing", which is a different,
        // genuine result worth showing. Gate here instead.
        return;
      }
      const anchorNode = selection.anchorNode;
      if (!anchorNode) return;
      const anchorEl = anchorNode.nodeType === 1 ? anchorNode : anchorNode.parentElement;
      if (anchorEl && anchorEl.closest('pre, code')) {
        return; // Review Focus: ignore selections inside code blocks
      }
      const container = anchorEl ? anchorEl.closest(CONTENT_SELECTOR) : null;
      if (!container) return;
      const blocks = Array.from(container.querySelectorAll(BLOCK_SELECTOR));
      const excludeIndex = blocks.findIndex((el) => el.contains(anchorEl));
      const blockTexts = blocks.map((el) => el.textContent || '');
      const matchIndices = findMatchingBlockIndices(text, blockTexts, excludeIndex);
      setMatches({
        selectedText: text.trim(),
        items: matchIndices.map((i) => ({element: blocks[i], text: blockTexts[i]})),
      });
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [enabled]);

  const closePanel = useCallback(() => setMatches(null), []);
  const jumpTo = useCallback((element) => {
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    element.classList.add(styles.flash);
    window.setTimeout(() => element.classList.remove(styles.flash), 1500);
  }, []);

  if (!enabled || !matches) {
    return null;
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>“{matches.selectedText}”</span>
        <button onClick={closePanel} aria-label="Close">×</button>
      </div>
      {matches.items.length === 0 ? (
        <p className={styles.empty}>Nothing else on this page mentions this.</p>
      ) : (
        <ul className={styles.matchList}>
          {matches.items.map((item, i) => (
            <li key={i}>
              <button onClick={() => jumpTo(item.element)}>{item.text.slice(0, 120)}</button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
