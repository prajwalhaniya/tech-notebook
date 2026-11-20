# Reader-Focused Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the persistent doc sidebar site-wide, make dark the default/non-white look on both themes, make the blog reachable again via the existing Topics dropdown, and add a same-page highlight-to-concordance reading aid with its own on/off toggle.

**Architecture:** Entirely presentation-layer. No backend, no new runtime dependency, no swizzle of Docusaurus's layout components — the sidebar is removed via the two CSS custom properties Docusaurus's own layout already keys its width calculations off of (`--doc-sidebar-width`, `--doc-sidebar-hidden-width`), not a DOM/component change. The highlight feature is one new global, client-only React component (mounted in `Root.js`, same pattern as the existing `NotesWidget`) plus one new custom navbar item (same pattern as the existing `TopicsNavbarItem`), communicating over a single `window` CustomEvent so the two independently-mounted components agree on toggle state.

**Tech Stack:** Docusaurus 2.4.1 (classic preset), React, plain CSS (CSS Modules + a global `src/css/custom.css`), no test framework currently in this repo (confirmed: no jest/vitest/playwright in `package.json`, no existing `*.test.js` files).

**Spec:** `.claude/specs/2026-11-20-reader-focused-redesign-design.md`

## Global Constraints

- No backend/server dependency — the site stays 100% statically hosted (design doc Non-Goals).
- No white background on either theme's default background/navbar/footer surfaces (design doc Goal 1).
- Existing in-content/cross-document links (ToC anchors, HLD↔LLD references) must keep working unmodified (design doc, confirmed in conversation).
- Highlight feature: same-page concordance only — no glossary, no AI/backend call (design doc, confirmed in conversation).
- Highlight toggle defaults to **off** (design doc "My Calls").
- Docs topics keep their existing category grouping; only the blog is grouped by year (design doc "My Calls").
- Sidebar removal must be CSS-only, not a layout-component swizzle (design doc "Approaches Considered → Picked: A").

## Review Focus

- A doc page with no sidebar at all (`/docs/intro`, the Topics dropdown's fallback target) — `DocPageLayout` only renders the `<aside>` when `sidebar` is truthy, so the sidebar-width CSS override must be a no-op here, not break the full-width layout Docusaurus already gives such pages.
- A selection that spans multiple block elements (e.g., a drag across two paragraphs) — `window.getSelection().toString()` returns the concatenated text; matching must not crash or double-count.
- A selection inside a `<pre>`/`<code>` block — code tokens aren't prose terms and often repeat as noise (`const`, `}`); the feature should not activate there at all.
- A very short page where the highlighted text appears nowhere else — the panel must show a clear "nothing else mentions this" state, not an empty-looking panel that reads as broken.
- An excessively long selection (e.g., a triple-click selecting a whole paragraph or more) — must not attempt an expensive/meaningless whole-paragraph substring search; there should be a length ceiling after which the feature no-ops.

---

## Task 1: Non-white "paper" light palette + dark as default theme

**Files:**
- Modify: `src/css/custom.css:6-33` (`:root` block)
- Modify: `docusaurus.config.js` (`themeConfig`)

**Interfaces:**
- Consumes: nothing (first task, no dependencies).
- Produces: nothing other tasks directly consume — this is a pure color/config change.

- [ ] **Step 1: Change the light-theme background tokens in `src/css/custom.css`**

In the `:root` block, change these three literal near-white values (confirmed via `grep -n "#ffffff\|#fff\b" src/css/custom.css` — these are the only light-mode background-surface tokens that are literal white/near-white; everything else under `[data-theme='dark']` is already non-white and untouched):

```css
--ifm-background-color: #f7f4ec;      /* was #ffffff */
--ifm-navbar-background-color: #f7f4ec; /* was #ffffff */
--ifm-footer-background-color: #efebe0; /* was #fafafa */
```

Leave every other token in `:root` as-is (the heading/body text colors already don't need to change for this task).

- [ ] **Step 2: Make dark the default color mode in `docusaurus.config.js`**

Add a `colorMode` key to the `themeConfig` object (alongside the existing `navbar`, `docs`, `footer`, `prism` keys):

```js
colorMode: {
  defaultMode: 'dark',
  respectPrefersColorScheme: false,
},
```

`respectPrefersColorScheme: false` is deliberate: the spec says dark is the site's own default, not "whatever the OS prefers."

- [ ] **Step 3: Build and verify in the browser**

Run: `npx docusaurus build && npx docusaurus serve --port 3005`

Using browser automation, navigate to the homepage with no prior `localStorage` (fresh context/incognito-equivalent) and confirm via `getComputedStyle(document.body).backgroundColor` that the page loads dark by default. Then manually switch to light mode via the existing toggle and confirm `getComputedStyle(document.documentElement).backgroundColor` (or the `:root` background) is `rgb(247, 244, 236)` (i.e. `#f7f4ec`), not `rgb(255, 255, 255)`.

- [ ] **Step 4: Commit**

```bash
git add src/css/custom.css docusaurus.config.js
git commit -m "feat: non-white paper light palette, dark as default theme"
```

---

## Task 2: Remove the persistent doc sidebar

**Files:**
- Modify: `src/css/custom.css` (add a new rule block near the existing `.theme-doc-sidebar-container` rule)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Add the sidebar-collapsing CSS**

Docusaurus's own `DocPageLayoutMain`/`DocPageLayoutSidebar` size themselves entirely off two `:root`-scoped CSS custom properties defined by `@docusaurus/theme-classic` (`--doc-sidebar-width: 300px`, `--doc-sidebar-hidden-width: 30px` — confirmed in `node_modules/@docusaurus/theme-classic/lib/theme/DocPage/Layout/Sidebar/styles.module.css`). Overriding them in our own `:root` (which loads after the theme's base styles) collapses the sidebar's reserved width to zero and simultaneously expands the main content's `calc(100% - var(--doc-sidebar-width))` to the full container width — no component swizzle needed. Add, near the existing `.theme-doc-sidebar-container` rule:

```css
:root {
  --doc-sidebar-width: 0px;
  --doc-sidebar-hidden-width: 0px;
}

.theme-doc-sidebar-container {
  display: none;
}
```

The `display: none` is a belt-and-suspenders addition: even though the width collapses to zero either way, this also stops the sidebar's own links/expand-button from rendering in that zero-width space.

- [ ] **Step 2: Build and verify against the Review Focus case (a page with no sidebar at all)**

Run: `npx docusaurus build && npx docusaurus serve --port 3005`

Using browser automation:
1. Navigate to a doc page that has a topic sidebar (e.g. `/docs/HLD/Design_IRCTC`) and confirm, via `document.querySelector('.theme-doc-sidebar-container')`, that it's either absent or has `display: none`, and that the article content's bounding-rect width now spans close to the full container width (compare against the container's own width).
2. Navigate to `/docs/intro` (the Topics dropdown's fallback target, which `sidebars.js` gives no topic sidebar) and confirm the page still renders full-width with no layout gap or error — this page already had no `<aside>` before this change, so the fix must be a no-op here, not a regression.
3. Open the Topics dropdown, pick a topic (e.g. HLD), and confirm its generated Contents/category index page (`DocCategoryGeneratedIndexPage`) still renders its drill-down cards correctly with the sidebar gone — this page is itself a doc within that topic's sidebar, so it's also affected by this change, and per the design doc it's now the *primary* way to reach a specific article, not just a landing page. (Visual polish of that page for topics with many nested subcategories, like DSA's 113 docs across 8 subfolders, is explicitly out of scope for this plan — only confirm it still renders correctly, not that it's been redesigned.)

- [ ] **Step 3: Commit**

```bash
git add src/css/custom.css
git commit -m "feat: remove persistent doc sidebar, reclaim full content width"
```

---

## Task 3: Make the blog reachable via the existing Topics dropdown

**Files:**
- Modify: `src/components/TopicsNavbarItem/index.js:7-22` (the `TOPICS` array)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Add a Blog entry to the `TOPICS` array**

`docusaurus.config.js`'s blog plugin uses default options (`showReadingTime: true` only — no `archiveBasePath` override), so Docusaurus's built-in year-grouped blog archive page is already live at `/blog/archive`. Add this entry to the existing `TOPICS` array (matching the shape of every other entry):

```js
{label: 'Blog', prefix: '/blog', to: '/blog/archive'},
```

Add it wherever in the array reads naturally (e.g., first or last) — order doesn't affect behavior, `DropdownNavbarItem` renders the array in order.

- [ ] **Step 2: Build and verify**

Run: `npx docusaurus build && npx docusaurus serve --port 3005`

Using browser automation: open the Topics dropdown in the navbar, confirm "Blog" is listed, click it, and confirm the resulting page at `/blog/archive` shows posts grouped under year headings (matching the shape of prajwalhaniya.in/post — a year heading followed by that year's post titles and dates). Then click into one post and confirm it renders with no sidebar (Task 2's effect applies here too, since blog posts go through the same doc layout question — if blog posts use a *different* layout without a sidebar in the first place, note that and confirm there's simply nothing to remove).

- [ ] **Step 3: Commit**

```bash
git add src/components/TopicsNavbarItem/index.js
git commit -m "feat: add Blog to the Topics dropdown, pointing at the year archive"
```

---

## Task 4: Pure same-page concordance matching function (with tests)

**Files:**
- Create: `src/utils/concordance.js`
- Test: `src/utils/concordance.test.js`
- Create: `src/utils/highlightState.js` (shared storage/event helpers — see Step 5)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `findMatchingBlockIndices(selectedText: string, blockTexts: string[], excludeIndex: number): number[]` — exported from `src/utils/concordance.js`. Task 5 imports this.
  - `EVENT_NAME: string`, `readEnabled(): boolean`, `writeEnabled(value: boolean): void` — exported from `src/utils/highlightState.js`. Both Task 5 and Task 6 import these instead of each defining their own copy of the `localStorage` key and read/write logic.

This is the one piece of real logic in the whole feature, deliberately kept DOM-free (plain strings in, indices out) so it's testable without adding a new test-framework dependency to a project that has never had one — see Step 1.

- [ ] **Step 1: Write the failing tests using Node's built-in `assert`, no new dependency**

```js
// src/utils/concordance.test.js
// Run with: node src/utils/concordance.test.js
const assert = require('assert');
const {findMatchingBlockIndices} = require('./concordance');

// Finds other blocks containing the text, excludes the originating block
assert.deepStrictEqual(
  findMatchingBlockIndices('cache', ['The cache layer is fast.', 'No mention here.', 'A cache miss is slow.'], 0),
  [2],
);

// Case-insensitive
assert.deepStrictEqual(
  findMatchingBlockIndices('Cache', ['lowercase cache here'], -1),
  [0],
);

// No matches other than itself -> empty array
assert.deepStrictEqual(
  findMatchingBlockIndices('unique', ['unique term appears once'], 0),
  [],
);

// Selection shorter than 3 characters -> no-op, empty array, regardless of content
assert.deepStrictEqual(
  findMatchingBlockIndices('ab', ['ab appears here', 'and ab here too'], -1),
  [],
);

// Selection longer than 200 characters -> no-op, empty array
assert.deepStrictEqual(
  findMatchingBlockIndices('x'.repeat(201), ['x'.repeat(201) + ' appears here'], -1),
  [],
);

// Selection spanning what would have been multiple blocks is just a string -> matches normally
assert.deepStrictEqual(
  findMatchingBlockIndices('fast reliable', ['fast reliable systems win', 'slow systems lose'], -1),
  [0],
);

console.log('All concordance tests passed.');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/utils/concordance.test.js`
Expected: FAIL with a `Cannot find module './concordance'` error (the module doesn't exist yet).

- [ ] **Step 3: Implement `findMatchingBlockIndices(selectedText: string, blockTexts: string[], excludeIndex: number): number[]` in `src/utils/concordance.js`**

Export constants `MIN_LENGTH = 3` and `MAX_LENGTH = 200` (the exact bounds the tests above pin). The six tests above fully determine the function's behavior (bounds check, case-insensitive substring match, exclude one index by position) — implement directly against them rather than re-deriving the algorithm from scratch.

- [ ] **Step 4: Run it to verify it passes**

Run: `node src/utils/concordance.test.js`
Expected: `All concordance tests passed.` printed, process exits 0.

- [ ] **Step 5: Add the shared toggle-state helper in `src/utils/highlightState.js`**

Both `HighlightConcordance` (Task 5) and `HighlightToggle` (Task 6) need to read/write the same `localStorage` flag and agree on one event name — defining this once here, rather than once per component, is what keeps them from drifting apart:

```js
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
```

- [ ] **Step 6: Commit**

```bash
git add src/utils/concordance.js src/utils/concordance.test.js src/utils/highlightState.js
git commit -m "feat: add pure same-page concordance matching function and shared toggle state"
```

---

## Task 5: Highlight-to-concordance panel component

**Files:**
- Create: `src/components/HighlightConcordance/index.js`
- Create: `src/components/HighlightConcordance/styles.module.css`

**Interfaces:**
- Consumes: `findMatchingBlockIndices` from `src/utils/concordance.js`, and `EVENT_NAME`/`readEnabled` from `src/utils/highlightState.js` (both Task 4). Listens for a `window` CustomEvent named `EVENT_NAME` with `event.detail.enabled: boolean` (Task 6 dispatches this).
- Produces: a default-exported React component `HighlightConcordance` with no props, meant to be rendered once, globally (Task 7 mounts it).

- [ ] **Step 1: Implement the component**

Follow `src/components/NotesWidget/index.js`'s existing pattern for `localStorage` access (try/catch wrappers — storage can be unavailable in private browsing) and for scoping to the current page via `useLocation()`.

```js
// src/components/HighlightConcordance/index.js
import React, {useEffect, useState, useCallback} from 'react';
import {findMatchingBlockIndices} from '@site/src/utils/concordance';
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
      if (!text.trim()) {
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
```

One line on the approach where the signature leaves a choice: matches are recomputed on every `selectionchange` event rather than debounced — selection changes are infrequent enough (a human dragging a mouse) that this doesn't need throttling for a reading-aid feature.

- [ ] **Step 2: Style the panel in `styles.module.css`**

Fixed/sticky positioned `aside` on the right edge of the viewport (e.g. `position: fixed; top: var(--ifm-navbar-height); right: 0; width: 320px; height: calc(100vh - var(--ifm-navbar-height)); overflow-y: auto;`), using the site's existing dark-first color tokens (`var(--ifm-background-color)`, `var(--ifm-border-color)`, `var(--ifm-font-color-base)`) rather than new hardcoded colors, so it automatically matches whichever theme/palette is active (including Task 1's new light palette). Include a `.flash` class (e.g. a brief background-color transition) used by `jumpTo` above to visually confirm which block was jumped to.

- [ ] **Step 3: Build and manually verify in the browser**

Run: `npx docusaurus build && npx docusaurus serve --port 3005`

Since `enabled` defaults to `false` and nothing dispatches `'tn:highlight-toggle'` yet (that's Task 6), this component should render nothing visible at this point — confirm the build succeeds and the page looks unchanged. Full interactive verification happens in Task 6 once the toggle exists to turn it on.

- [ ] **Step 4: Commit**

```bash
git add src/components/HighlightConcordance/index.js src/components/HighlightConcordance/styles.module.css
git commit -m "feat: add highlight-to-concordance panel component"
```

---

## Task 6: Highlight on/off navbar toggle

**Files:**
- Create: `src/components/HighlightToggle/index.js`
- Modify: `src/theme/NavbarItem/ComponentTypes.js`
- Modify: `docusaurus.config.js` (`themeConfig.navbar.items`)

**Interfaces:**
- Consumes: `readEnabled`, `writeEnabled`, `EVENT_NAME` from `src/utils/highlightState.js` (Task 4).
- Produces: dispatches `window` CustomEvent `EVENT_NAME` with `detail: {enabled: boolean}` whenever clicked — this is what `HighlightConcordance` (Task 5) listens for.

- [ ] **Step 1: Implement the toggle button**

```js
// src/components/HighlightToggle/index.js
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
```

`className="clean-btn navbar__item"` reuses Infima's own utility classes so it visually matches other navbar controls without new CSS.

- [ ] **Step 2: Register it as a custom navbar item type**

In `src/theme/NavbarItem/ComponentTypes.js`, following the exact pattern already used for `'custom-topicsDropdown'`:

```js
import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import TopicsNavbarItem from '@site/src/components/TopicsNavbarItem';
import HighlightToggle from '@site/src/components/HighlightToggle';

export default {
  ...ComponentTypes,
  'custom-topicsDropdown': TopicsNavbarItem,
  'custom-highlightToggle': HighlightToggle,
};
```

- [ ] **Step 3: Add it to the navbar config**

In `docusaurus.config.js`, add to `themeConfig.navbar.items` (after the existing `custom-topicsDropdown` entry), with `position: 'right'` so it lands next to Docusaurus's own built-in color-mode toggle (which auto-renders on the right and isn't itself a configurable item):

```js
{
  type: 'custom-highlightToggle',
  position: 'right',
},
```

- [ ] **Step 4: Build and verify the full interactive feature end-to-end**

Run: `npx docusaurus build && npx docusaurus serve --port 3005`

Using browser automation, on a doc page with substantial prose containing a repeated term (e.g. `/docs/HLD/Design_IRCTC`, which repeats "Tatkal" and "seat" many times):
1. Confirm the navbar shows "Highlights: Off" and clicking it flips to "Highlights: On".
2. With it on, select the word "Tatkal" in the body text (via browser automation's selection APIs, or simulate via `document.execCommand`/a Range + dispatching `selectionchange`) and confirm the right-side panel opens listing other paragraphs containing "Tatkal", excluding the paragraph just selected from.
3. Click one listed match and confirm the page scrolls to it and it visually flashes.
4. Select a very short (1-2 character) or very long (notably past a sentence) span and confirm the panel does **not** open (Review Focus: length bounds).
5. Select text inside a fenced code block in the same doc and confirm the panel does **not** open (Review Focus: code blocks excluded).
6. Toggle "Highlights" back to Off and confirm a new selection no longer opens the panel, and any open panel closes.
7. Reload the page and confirm the toggle's On/Off state persisted (localStorage).

- [ ] **Step 5: Commit**

```bash
git add src/components/HighlightToggle/index.js src/theme/NavbarItem/ComponentTypes.js docusaurus.config.js
git commit -m "feat: add highlight on/off navbar toggle, wired to the concordance panel"
```

---

## Task 7: Mount the concordance panel site-wide

**Files:**
- Modify: `src/theme/Root.js`

**Interfaces:**
- Consumes: `HighlightConcordance` from `src/components/HighlightConcordance` (Task 5).
- Produces: nothing further — this is the final wiring task.

- [ ] **Step 1: Mount `HighlightConcordance` alongside the existing `NotesWidget`**

```js
// src/theme/Root.js
import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import NotesWidget from '@site/src/components/NotesWidget';
import HighlightConcordance from '@site/src/components/HighlightConcordance';

export default function Root({children}) {
  return (
    <>
      {children}
      <BrowserOnly>{() => <NotesWidget />}</BrowserOnly>
      <BrowserOnly>{() => <HighlightConcordance />}</BrowserOnly>
    </>
  );
}
```

- [ ] **Step 2: Full site build and whole-feature regression pass**

Run: `npx docusaurus build` (full site, not `--locale en` only, to catch anything feature-flagged per-locale) and `npx docusaurus serve --port 3005`.

Using browser automation, spot-check across the three content shapes the spec calls out:
1. A long HLD doc (`/docs/HLD/Design_IRCTC`) — sidebar gone, full width, highlight toggle works.
2. A short blog post (via the new Blog dropdown entry → `/blog/archive` → any post) — sidebar was never present here either way, highlight toggle still works (Review Focus: a short page where a highlighted term appears nowhere else shows the "nothing else mentions this" state, not a broken-looking empty panel).
3. `/docs/intro` (no sidebar to begin with) — unaffected by Task 2, full-width as before, highlight toggle still works.

Confirm no console errors on any of the three, and confirm an existing in-content cross-link (e.g. the IRCTC LLD doc's link back to its HLD companion) still navigates correctly — Global Constraint: links must keep working.

- [ ] **Step 3: Commit**

```bash
git add src/theme/Root.js
git commit -m "feat: mount highlight-to-concordance panel site-wide"
```
