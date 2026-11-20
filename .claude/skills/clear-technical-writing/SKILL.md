---
name: clear-technical-writing
description: Use when writing or editing a blog post, article, tutorial, or any prose-form technical explainer that needs to be clean, readable, and easy to understand — catches AI-blog clichés (throat-clearing openers like "in today's fast-paced world", filler words like "leverage/utilize/seamless", formulaic "in this article we'll cover" roadmaps), enforces concrete-over-abstract explanation (named examples and numbers instead of vague claims), and keeps structure scannable (short paragraphs, one idea each, purposeful headers).
---

# Clear Technical Writing

## Overview

Most "unreadable" technical writing isn't wrong, it's just padded: throat-clearing
openers, hedge words, buzzword adjectives, and abstract claims with no example
attached. None of that adds information — it just makes the reader work harder
to find the sentence that actually says something.

**Core principle:** every sentence should do real work — state a fact, show an
example, or move the argument forward. If a sentence could be deleted without
losing information, delete it. Readability comes from concrete nouns, active
verbs, and short sentences, not from decoration.

This skill is for prose (articles, blog posts, tutorials, explainers). For a
large flat bullet list of config options/parameters specifically, use
[decluttering-reference-docs](../decluttering-reference-docs/SKILL.md) instead.
For procedures/manuals that must be unambiguous and translation-safe, see
[simplified-technical-english](../simplified-technical-english/SKILL.md) — that
skill is stricter and narrower (controlled vocabulary, word-count caps); this
one is for readable prose aimed at a human audience.

## The Banned-Phrase List

These survive editing passes more often than anything else — cut them on
sight, every time, no exceptions for "but it reads more professional."

**Throat-clearing openers** (delay the actual content):
- "In today's fast-paced world of..."
- "In the ever-evolving landscape of..."
- "In this digital age..." / "Nowadays..."
- "{Topic} has become increasingly important..."

**Formulaic roadmaps and closers** (tell the reader what you're about to do
instead of just doing it):
- "In this article, we'll explore/break down/dive into..."
- "Let's dive in." / "Without further ado..."
- "In conclusion," / "To sum up," / "To wrap things up,"

**Hedge words** (add length, remove nothing):
- "basically", "essentially", "arguably", "needless to say"
- "it is important to note that", "it is worth mentioning that"

**Buzzword fillers** (vague intensity standing in for a real claim):
- "leverage" → use "use". "utilize" → use "use".
- "seamless/seamlessly", "robust", "powerful", "cutting-edge", "game-changer"
- "unlock", "delve into", "a variety of", "a plethora of"
- "significantly/dramatically" when no number follows

**Stacked weak transitions** (a crutch when every paragraph needs one):
- Starting three-plus paragraphs in a row with "Furthermore," "Moreover," or
  "Additionally," — use a real logical connector, or just start the sentence.

## The Concreteness Rule

An abstract claim with no instance attached teaches nothing. **"Several,"
"various," "different," "many," "some," and "numerous" are trigger words —
every time one of them describes a category of things (strategies, types,
options, approaches, ways), a real named instance of that category must
appear in the same sentence or the very next one.** This applies whether
you're drafting new text or editing an existing sentence — stripping a
cliché out of an already-vague sentence is not the same as fixing it; the
sentence is still vague until something real is named in it.

**Before:** "Several caching strategies exist, each with its own trade-offs.
Choosing the right one can significantly impact your application's overall
performance."

**After:** "Cache-aside, write-through, and LRU eviction solve different
problems — cache-aside is simplest to add to an existing app, write-through
trades write latency for never serving stale data. Picking the wrong one is
why a 'fast' app still feels slow under load: a write-heavy workload on an
LRU cache thrashes constantly."

**Also before (a cliché-free sentence that is still just as vague):**
"Several index types exist, each with different trade-offs, so it's
important to choose carefully." Deleting "leverage," "seamlessly," and "a
variety of" from around this sentence does not fix it — it still names
nothing. It needs the same treatment as the caching example above: name at
least one index type (B-tree, hash index, composite index) and say what
choosing wrong actually costs.

If you can't name an instance, the claim is either too vague to be worth
making, or you don't understand the topic well enough yet to write about it —
either way, that's the sentence to fix before moving on, not polish around.

## Structure & Flow

- **Open with something concrete** — a scenario, a specific question, a
  surprising number, or a one-line example — never a throat-clearing windup.
- **One idea per paragraph.** 3-5 sentences is a reasonable default. If a
  paragraph covers two separate ideas, split it; if two one-sentence
  paragraphs state the same idea, merge them.
- **Headers should stand alone as a skim-summary.** A reader scanning only
  the headers should be able to reconstruct the article's shape and
  argument, not just its topic list.
- **Close with a specific takeaway**, not a restatement of the title. "So:
  reach for a queue the moment 'this step might be slow' becomes true"
  beats "In conclusion, message queues are a useful backend tool."

## Voice & Word Choice

- **Active voice by default.** "The scheduler retries the job" beats "The job
  is retried by the scheduler," unless the actor genuinely doesn't matter.
- **Plain word over fancy synonym.** use/leverage, help/facilitate,
  show/demonstrate, start/commence — pick the first one every time.
- **Define jargon at first use** with a short gloss or parenthetical example,
  not a separate glossary the reader has to go find.
- **One term per concept, for the whole piece.** If you call it a "task" in
  paragraph two, don't switch to "job" in paragraph six for the same thing —
  synonym-switching reads as elegant variation but costs the reader a
  double-take each time.

## Formatting for Scanning

- Use bullets only for genuinely parallel, short items. Connected reasoning
  (cause → effect, comparison, a worked example) reads better as prose than
  as a bullet list pretending to be sentences.
- If a list grows past ~7 items, or any bullet crams 3+ distinct facts into
  one run-on, that's a decluttering problem — see
  [decluttering-reference-docs](../decluttering-reference-docs/SKILL.md).
- Bold 1-2 genuinely key terms per section, not every noun — bolding
  everything is the same as bolding nothing.
- Prefer a code block or a real example over a paragraph describing one
  mechanically.

## The Edit Pass

Work in this order on a finished draft:

1. Read the whole thing once, without editing.
2. Strike every phrase from the banned list above.
3. **Concreteness gate (required, not optional).** Before treating the edit
   as finished, write a short checklist, one line per occurrence:
   `"several/various/different/many/some/numerous" in "<the sentence>" →
   named instance: <what you named, or NONE>`. Any line ending in `NONE`
   means the sentence isn't done — go back and either name a real instance
   or cut the sentence, then update the line. Produce this checklist even
   when the task only asked for the final edited text; it's how you verify
   the edit before handing it over, the same way you'd run a test before
   calling code finished. A sentence that passed the banned-phrase check in
   step 2 can still fail this gate — they catch different things.
4. Check each paragraph carries exactly one idea — split or merge as needed.
5. Read each sentence as if aloud — if you'd stumble or need to re-read it,
   shorten it.
6. Check the opening: concrete hook, or throat-clearing windup? Rewrite if
   the latter.
7. Check the closing: specific takeaway, or vague restatement of the title?
   Rewrite if the latter.
8. Check term consistency: same concept, same word, every time it appears.

## Common Mistakes / Rationalizations

| Rationalization | Reality |
|---|---|
| "It's a standard blog-intro convention" | Readers skim past it on autopilot — cutting it loses nothing and the piece reads tighter immediately. |
| "It sounds more formal/professional" | Padding reads as filler, not authority. Concrete specifics read as more credible than vague intensity. |
| "I need a transition word here" | A real logical connector works, or no connector at all — "Furthermore" as a reflex is the tell, not the fix. |
| "The roadmap sentence orients the reader" | A clear header structure already orients them; the roadmap sentence just delays the actual content. |
| "'Several strategies exist' is true, so it's fine to leave as-is" | True but useless — the reader learns nothing actionable until you name one. |
| "I used a synonym so the writing doesn't feel repetitive" | Synonym-switching for the same concept reads as inconsistency, not elegance — repeat the exact term instead. |

## Red Flags (catch these on a re-read)

- A sentence starting with "In today's..." or "In the ever-evolving..." — delete and replace with a concrete opener.
- Any sentence ending in "...we'll explore/cover/break down" — cut it, start the actual content instead.
- "leverage," "utilize," "seamless," "robust," "a variety of" anywhere.
- "several," "various," "different," "many," "some," or "numerous" describing a category (strategies/types/options/approaches/ways) with no specific instance named in that sentence or the next — removing nearby buzzwords does NOT fix this on its own; check it as its own step.
- Three or more consecutive paragraphs opening with "Furthermore/Moreover/Additionally."
- The same underlying concept referred to by two different words across the piece.
