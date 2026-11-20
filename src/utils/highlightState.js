export const STORAGE_KEY = 'tn-highlight-enabled';
export const EVENT_NAME = 'tn:highlight-toggle';

export function readEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function writeEnabled(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch (e) {
    // Storage unavailable (private browsing, disabled, quota) — the
    // toggle just won't persist across reloads for this session.
  }
}
