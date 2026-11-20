import React, {useEffect, useState} from 'react';
import {EVENT_NAME, readEnabled, writeEnabled} from '@site/src/utils/highlightState';

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

  return (
    <button className="clean-btn navbar__item" onClick={toggle} aria-pressed={enabled}>
      {enabled ? 'Highlights: On' : 'Highlights: Off'}
    </button>
  );
}
