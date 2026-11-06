---
name: Decluttering-Reference-Docs
description: Use when a doc explains a list of config directives, options, or parameters as one long flat bullet list (7+ items, or any bullet cramming several distinct facts into one run-on paragraph) and reads as a dense, cluttered wall of text
---

# Decluttering Reference Docs

## Overview

A "what each directive/option does" bullet list degrades the same way regardless of topic: items accumulate one at a time as a doc grows, nobody steps back to group them, and a reader ends up scanning 10-15 undifferentiated bullets — some one line, some five sentences cramming unrelated facts together — to find the one they actually need.

**Core principle:** group the bullets by what they're collectively *responsible for*, not by the order they happen to appear in the config. Split any bullet that bundles multiple sub-parameters into its own nested sub-bullets. Change nothing else — this is restructuring, not rewriting or summarizing. Every fact stays; only the shape changes.

## When to Use

- A directive/option-explanation list has **7+ items** in one flat block.
- Any single bullet mixes **3+ distinct facts** into one run-on sentence (e.g. one bullet explaining five different parameters of the same directive).
- The list covers directives/options that clearly cluster into 3-6 natural categories (setup vs. timeouts vs. buffering vs. security, etc.) — if you can't name the clusters in five seconds, the list may not need grouping after all.

**Don't use when:**
- The list already has 5 or fewer items and each is a short, self-contained thought — adding subheadings here is ceremony, not clarity. Leave it as a plain list.
- The items don't actually cluster into anything coherent — forcing arbitrary groups is worse than a flat list.

## Core Pattern

Before — one flat list, one bullet doing five things at once:

```markdown
**What each directive does:**

- **`sendfile` / `tcp_nopush` / `tcp_nodelay`** — this trio controls exactly how
  bytes leave the socket: `sendfile` lets the kernel copy a file straight to the
  socket without a userspace copy; `tcp_nopush` holds off sending a packet until
  it's full; `tcp_nodelay` disables Nagle's algorithm so the last packet goes out
  immediately. Nginx applies nopush for the bulk of a transfer and nodelay for
  the tail end, which is why both are turned on together.
- **`keepalive_timeout 65`** — how long an idle connection stays open...
- ... (10 more bullets, no visual grouping)
```

After — grouped, and the crammed bullet split into sub-bullets:

```markdown
**What each directive does**, grouped by what it's actually responsible for:

#### Performance

- **`sendfile` / `tcp_nopush` / `tcp_nodelay`** — this trio controls exactly how
  bytes leave the socket, and they work together rather than independently:
  - `sendfile` lets the kernel copy a file straight to the socket without a
    userspace copy.
  - `tcp_nopush` (only meaningful alongside `sendfile`) holds off sending a
    packet until it's as full as possible.
  - `tcp_nodelay` disables Nagle's algorithm so the final, often-small packet
    goes out immediately instead of waiting to batch with more data.

  Nginx applies `tcp_nopush` for the bulk of a transfer and `tcp_nodelay` for
  the tail end, which is why both are conventionally turned on together.
- **`keepalive_timeout 65`** — how long an idle connection stays open...
```

## Quick Reference

| Step | Do this |
|---|---|
| 1. Read the whole list first | Don't group while reading top-to-bottom — you'll miss clusters that aren't adjacent |
| 2. Name 3-6 clusters | Name them by *purpose* ("Timeouts", "Session resumption", "Compression"), never "Misc" or "Other" |
| 3. Add a short label per cluster | A bold lead-in (`**Label**`) or a mini-heading one level below the surrounding heading (e.g. `####` under a `###` section) |
| 4. Split overstuffed bullets | A bullet explaining 3+ parameters of one directive becomes a lead sentence + nested sub-bullets, one per parameter |
| 5. Check nothing was lost | Every fact in the "before" version must still be present — diff the two mentally before moving on |
| 6. Check the heading doesn't clutter navigation | If the site renders a page table-of-contents, confirm the mini-heading level you chose is below what that TOC displays (many static-site generators cap it at h2/h3) |

## Common Mistakes

- **Grouping a list that was already fine.** 5 short, self-contained bullets don't need subheadings — that's adding structure as decoration, not for clarity.
- **Grouping by document order instead of by purpose.** "Directives 1-4" isn't a cluster; "Timeouts" is. If you can't give a cluster a one-or-two-word purpose-based name, it's not a real cluster yet.
- **Trimming content while restructuring.** The task is reshaping, not editing-for-length. If a sentence felt long enough to cut, split it into sub-bullets instead of shortening it.
- **Picking a heading level that bloats the page nav.** On a Docusaurus-style site (or similar) with an auto-generated "On this page" sidebar, grouping labels one level below the surrounding heading are usually safe, but verify — a label that shows up as a new nav entry for every cluster, on every section you touch, turns one wall of text into a different kind of clutter.
