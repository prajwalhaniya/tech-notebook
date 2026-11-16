---
name: simplified-technical-english
description: Use when writing or rewriting technical procedures, maintenance manuals, user documentation, API/tool descriptions, or warnings and cautions that must be unambiguous, translation-friendly, and readable by non-native English speakers — applies the ASD-STE100 (Simplified Technical English / STE100) controlled-language rules: approved-word vocabulary, one-word-one-meaning, noun-cluster limits, restricted verb forms, sentence-length caps, active voice, and Warning/Caution/Note structure.
---

# Simplified Technical English (ASD-STE100)

## Overview

ASD-STE100 is the aerospace/defense industry's controlled-language standard for
technical writing. It has two parts: a **dictionary** of ~900 approved words
(each with exactly one approved meaning and one approved part of speech) and a
set of **writing rules** (53 rules across 9 categories in Issue 9: words, noun
clusters, verbs, sentences, procedures, descriptive writing, warnings/cautions,
punctuation, and general practice). It is required or referenced by MIL-SPEC,
S1000D, and ATA iSpec 2200, and is now used well beyond aerospace (automotive,
medical devices, defense, energy) anywhere instructions must survive
translation and non-native readers without ambiguity.

The full ~900-word dictionary is the publisher's copyrighted content
(available from asd-ste100.org) and is not reproduced here. What's below is
the rule pattern plus commonly-cited, publicly documented example words —
enough to apply the same judgment to words not listed. When exact dictionary
compliance matters (a regulatory submission, an official manual), get the
real dictionary and check the specific word there.

**Core principle:** One word, one job, one meaning. Say exactly what must
happen, in the fewest plain words, the same way every time it's said.

## The Rules

| Category | Rule | Example |
|---|---|---|
| Words | Use one word per meaning. If an approved word already covers a meaning, never reach for a synonym. | Use "make sure" — not "ensure", "verify", "check", "confirm". Use "start" — not "begin", "commence", "initiate". |
| Part of speech | Each word has exactly one approved part of speech — don't verb a noun or noun a verb. | "oil" is a noun only → "Put oil on the valve", not "Oil the valve". |
| Verbs | Use only: infinitive, imperative, simple present, simple past, simple future, and past participle as an adjective. No perfect or continuous tenses, no stacked modals. | "We received the report" — not "We have received the report" or "We were receiving the report". |
| Voice | Active voice by default. Passive only when the actor is unknown or truly irrelevant. | "Remove the filter" — not "The filter is to be removed". |
| Noun clusters | Max 3 nouns in a row. Break a longer stack apart with a preposition or relative clause. | "the bracket for the oil drain plug" — not "the oil drain plug access panel fastener bracket". |
| Sentences | Procedural sentence ≤ 20 words; descriptive sentence ≤ 25 words. One instruction per sentence. Never drop articles, relative pronouns, or other words to save space. | Split any sentence with "and then", "following which", or a semicolon into separate sentences. |
| Procedures | Write each step as a direct command, in the order the reader must do it. One action per step. | "1. Remove the plug. 2. Drain the oil. 3. Install the new filter." |
| Descriptive text | Max 6 sentences per paragraph. One topic per paragraph. | — |
| Warnings / Cautions / Notes | WARNING = hazard to people. CAUTION = hazard to equipment, data, or the mission. NOTE = non-safety extra info. State hazard → consequence → how to avoid it. Place it immediately before the step it protects, as its own labeled block — never bury a hazard inside a plain sentence. | See example below. |
| Punctuation & word order | No semicolons. Use a vertical list for 3+ related items. Keep standard subject-verb-object order. | — |

## Rewrite Checklist

When converting existing text to STE100, work in this order:

1. Read the whole passage and list every distinct fact or instruction before changing any words.
2. Split run-on sentences at each distinct instruction or fact (watch for "and then", "following which", "; ").
3. Convert passive to active; name the actor when it's known.
4. Replace perfect/continuous tenses with simple present, simple past, or simple future.
5. Replace every synonym with the one approved word for that meaning (see table below for common ones).
6. Break any noun cluster of 4+ words into a preposition phrase or relative clause.
7. Pull hazards and risk statements out into labeled WARNING/CAUTION blocks — don't leave them as plain prose.
8. Count words per sentence; split anything over the 20/25-word cap.
9. Re-read each sentence alone, with no surrounding context — can a reader still act on it correctly?

## Common Word Substitutions (illustrative, not the full dictionary)

| Avoid | Use instead |
|---|---|
| ensure, verify, confirm | make sure (confirm a condition is true) |
| begin, commence, initiate | start |
| prior to | before |
| subsequent to, following (as preposition) | after |
| perform, carry out, execute | do |
| fit | install |
| shut | close |
| take out | remove |
| in the event that, in case | if |
| utilize | use |
| terminate | end, stop |
| sufficient | enough |
| additional | more, extra |
| approximately | about |
| is able to | can |
| obtain | get |
| follow (meaning "obey") | obey — "follow" means only "come after" in STE |

"check" and "make sure" are not interchangeable: "check" is its own approved
word for a physical inspection or test ("check the fitting for leaks"); "make
sure" is for confirming a condition is true ("make sure the valve is closed").
Don't use "check" as a blanket replacement for "ensure/verify/confirm" —
use "make sure" for confirmation, "check" only when an actual inspection is
being done.

## Example: Before and After

**Before (not STE100):**
> Prior to the commencement of the engine oil replacement procedure, technicians should ensure that the aircraft has been properly secured and that all residual engine heat has been allowed to dissipate. The oil drain plug access panel fastener retention bracket assembly must be carefully removed by qualified personnel, following which the old oil filter can be unscrewed and discarded in accordance with the applicable environmental regulations. It is recommended that a replacement filter, which has been pre-lubricated with a thin film of fresh oil, be installed prior to the refilling of the engine with the manufacturer-specified oil grade.

**After (STE100):**
> Before you start the engine oil replacement procedure, make sure that the aircraft is secure.
>
> **WARNING: HOT SURFACE**
> Hot engine parts can burn you. Wait until the engine is cool before you touch it.
>
> 1. Remove the bracket that holds the fasteners for the oil drain plug access panel.
> 2. Remove the old oil filter.
> 3. Discard the old oil filter as the environmental regulations specify.
> 4. Put a thin film of new oil on the new filter.
> 5. Install the new filter.
> 6. Fill the engine with the oil grade that the manufacturer specifies.

Note how the hazard moved into its own labeled WARNING block instead of staying
as a buried fact, and the panel name is carried as a relative clause ("the
bracket that holds the fasteners for...") rather than left as one long noun
stack.

## Common Mistakes / Red Flags

| Red flag | What's wrong |
|---|---|
| 4+ nouns in a row with no preposition ("oil drain plug access panel fastener bracket") | Noun cluster too long — break it apart. |
| A hazard word ("hot", "danger", "damage", "injury", "do not touch") sitting inside a plain declarative sentence | Safety information must be its own labeled WARNING/CAUTION block, not prose. |
| "has been", "have been", "was being" anywhere | Perfect or continuous tense — rewrite in simple present/past/future. |
| A sentence that still reads fine after you delete "and then" or split it at a semicolon | It was really two instructions — split it. |
| A word that feels like a slightly fancier version of a simpler word you already used elsewhere ("in agreement with" instead of "as ... specifies", "specified by" doing the same job as "that ... specifies") | Likely an unapproved synonym — check the dictionary pattern and standardize on one term. |
| Sentence over ~20 words (procedure) or ~25 words (description) | Split it — one instruction or one fact per sentence. |
