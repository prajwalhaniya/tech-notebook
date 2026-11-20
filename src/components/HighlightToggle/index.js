import React, {useEffect, useState} from 'react';
import clsx from 'clsx';
import {EVENT_NAME, readEnabled, writeEnabled} from '@site/src/utils/highlightState';
import styles from './styles.module.css';

function HighlighterIcon({active}) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 3L21 11L12 20H6V14L13 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.22 : 0}
      />
      <path d="M6 14L12 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="2.5" y="20.3" width="8" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function HighlightToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readEnabled());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    writeEnabled(next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {detail: {enabled: next}}));
  };

  const title = enabled
    ? 'Highlights: On — select any text to find other mentions on this page. Click to turn off.'
    : 'Highlights: Off — click to turn on, then select text to find other mentions on this page.';

  return (
    <button
      type="button"
      className={clsx('clean-btn navbar__item', styles.toggleButton, enabled && styles.toggleButtonActive)}
      onClick={toggle}
      aria-pressed={enabled}
      title={title}
      aria-label={title}>
      <HighlighterIcon active={enabled} />
    </button>
  );
}
