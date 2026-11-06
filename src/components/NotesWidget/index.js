import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const PREFIX = 'tn-notes:';
const SAVE_DELAY = 400;

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    // Storage unavailable (private browsing, disabled, quota) — notes just
    // won't persist for this session. Nothing to surface to the reader.
  }
}

function listAllNotes() {
  const notes = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        const value = window.localStorage.getItem(key);
        if (value && value.trim()) {
          notes.push({path: key.slice(PREFIX.length), text: value});
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return notes;
}

function downloadAllNotes() {
  const notes = listAllNotes();
  if (notes.length === 0) return;

  const body = notes
    .map(({path, text}) => `${path}\n${'-'.repeat(path.length)}\n${text}`)
    .join('\n\n');

  const blob = new Blob([body], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tech-notebook-notes.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function NotesWidget() {
  const location = useLocation();
  const pathname = location.pathname;
  const key = PREFIX + pathname;

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('page'); // 'page' | 'all'
  const [text, setText] = useState('');
  const [hasNotes, setHasNotes] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [allNotes, setAllNotes] = useState([]);
  const saveTimeout = useRef(null);
  const savedTimeout = useRef(null);

  useEffect(() => {
    const stored = readStorage(key) || '';
    setText(stored);
    setHasNotes(Boolean(stored.trim()));
    setAllNotes(listAllNotes());
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const flushSave = (value) => {
    writeStorage(key, value);
    setHasNotes(Boolean(value.trim()));
    setAllNotes(listAllNotes());
    setJustSaved(true);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setJustSaved(false), 1500);
  };

  const showAllNotes = () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      flushSave(text);
    }
    setAllNotes(listAllNotes());
    setView('all');
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => flushSave(value), SAVE_DELAY);
  };

  const handleClose = () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      flushSave(text);
    }
    setIsOpen(false);
    setView('page');
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close notes' : 'Open notes for this page'}
        aria-expanded={isOpen}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            fill="currentColor"
            d="M5 3h10.5L19 6.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
            opacity="0.12"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            d="M5 3h10.5L19 6.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            d="M8 10h8M8 13.5h8M8 17h5"
          />
        </svg>
        {hasNotes && <span className={styles.dot} aria-hidden="true" />}
      </button>

      <div className={styles.panel} data-open={isOpen} role="dialog" aria-label="Notes">
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={clsx(styles.tab, view === 'page' && styles.tabActive)}
              onClick={() => setView('page')}>
              This page
            </button>
            <button
              type="button"
              className={clsx(styles.tab, view === 'all' && styles.tabActive)}
              onClick={showAllNotes}>
              All notes{allNotes.length > 0 ? ` (${allNotes.length})` : ''}
            </button>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={handleClose}
            aria-label="Close notes">
            ×
          </button>
        </div>

        {view === 'page' ? (
          <textarea
            className={styles.textarea}
            value={text}
            onChange={handleChange}
            placeholder="Jot down anything worth remembering from this page..."
            spellCheck={false}
          />
        ) : (
          <div className={styles.allList}>
            {allNotes.length === 0 ? (
              <p className={styles.empty}>Nothing saved yet — your notes will show up here.</p>
            ) : (
              allNotes.map(({path, text: noteText}) => (
                <div key={path} className={styles.allItem}>
                  <Link
                    to={path}
                    className={styles.allItemPath}
                    onClick={() => {
                      setIsOpen(false);
                      setView('page');
                    }}>
                    {path}
                  </Link>
                  <p className={styles.allItemText}>{noteText}</p>
                </div>
              ))
            )}
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.status}>
            {view === 'page'
              ? justSaved
                ? 'Saved'
                : 'Autosaved locally'
              : `${allNotes.length} page${allNotes.length === 1 ? '' : 's'} with notes`}
          </span>
          <button type="button" className={styles.exportLink} onClick={downloadAllNotes}>
            Download all notes
          </button>
        </div>
      </div>
    </>
  );
}
