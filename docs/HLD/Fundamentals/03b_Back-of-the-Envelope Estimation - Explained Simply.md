---
sidebar_position: 3.5
slug: /HLD/Envelope_Estimation_Simple
---

# Back-of-the-Envelope Estimation - Explained simply

> This is the gentle, slow, no-jargon version. Once this clicks, the
> [full cheat-sheet](./04_Back-of-the-Envelope%20Estimation.md) (the dense one real interviews expect) will make a lot more sense.

---

## Table of Contents

1. [The Jellybean Jar Story](#1-the-jellybean-jar-story)
2. [So What IS "Back-of-the-Envelope" Estimation?](#2-so-what-is-back-of-the-envelope-estimation)
3. [Why Software Engineers Need This](#3-why-software-engineers-need-this)
4. [The One Big Idea Behind Everything](#4-the-one-big-idea-behind-everything)
5. [Building Block 1: Big Numbers Aren't Scary (Powers of 10)](#5-building-block-1-big-numbers-arent-scary-powers-of-10)
6. [Building Block 2: Turning "Per Day" Into "Per Second"](#6-building-block-2-turning-per-day-into-per-second)
7. [Building Block 3: Busy Days vs. Quiet Days (Average vs. Peak)](#7-building-block-3-busy-days-vs-quiet-days-average-vs-peak)
8. [Building Block 4: How Big Is a "Thing"? (Data Sizes)](#8-building-block-4-how-big-is-a-thing-data-sizes)
9. [Building Block 5: Keeping Spares (Replication)](#9-building-block-5-keeping-spares-replication)
10. [Building Block 6: Your Favorite Toy Box (Caching)](#10-building-block-6-your-favorite-toy-box-caching)
11. [The Recipe: 6 Steps, Always in Order](#11-the-recipe-6-steps-always-in-order)
12. [A Full Worked Example, Slowly](#12-a-full-worked-example-slowly)
13. [Memory Techniques: How to Actually Remember All This](#13-memory-techniques-how-to-actually-remember-all-this)
14. [Mistakes Even Smart People Make](#14-mistakes-even-smart-people-make)
15. [Practice Problems (Start Here, Not With the Hard Ones)](#15-practice-problems-start-here-not-with-the-hard-ones)
16. [The One-Page Recap](#16-the-one-page-recap)

---

## 1. The Jellybean Jar Story

Imagine someone puts a huge glass jar of jellybeans on a table and asks: **"How many jellybeans are in there? You have 10 seconds, and no, you can't count them one by one."**

Here's a bad way to answer: "Ummm... a lot? Maybe a thousand? Or a billion?" — just blurting out a random number. That's a **wild guess**, and wild guesses are almost always way off.

Here's a much smarter way:
1. Look at the jar. It's about as tall as a water bottle and about as wide as two fists.
2. Guess roughly how many jellybeans fit along the bottom in one layer — maybe 20.
3. Guess roughly how many layers are stacked on top of each other — maybe 30.
4. Multiply: 20 × 30 = **600 jellybeans.**

You still didn't count anything. But your answer isn't a wild guess anymore — it's a **smart guess built from smaller, easier guesses you're more confident about.** Maybe the real answer is 550, maybe it's 700. You won't be exactly right, but you won't be insanely wrong either — you won't say "5" and you won't say "5 million."

**That's it. That's the whole idea of back-of-the-envelope estimation.** Everything in this document is just that jellybean trick, applied to computers, servers, and apps instead of candy.

---

## 2. So What IS "Back-of-the-Envelope" Estimation?

The name comes from a real, old-fashioned habit: scientists and engineers used to do quick math on the back of a paper envelope — because it was the nearest scrap of paper lying around — instead of grabbing a fancy calculator or spending an hour on exact numbers.

**Back-of-the-envelope estimation = doing quick, rough, smart math using round numbers and things you already know, to get an answer that's "close enough to be useful" — not a calculator-perfect answer.**

Three words matter a lot here:
- **Quick** — minutes, not hours.
- **Rough** — round numbers like 100, 1,000, 1,000,000 are totally fine. Nobody is grading decimal points.
- **Smart** — not a wild guess. Every number is built from a reason, like the jellybean layers.

---

## 3. Why Software Engineers Need This

Imagine you're asked to build a lemonade stand. Before you build anything, you'd probably ask yourself:
- "How many people walk past my street on a hot day?" (that's like **users**)
- "How many cups will I need?" (that's like **storage**)
- "How much lemonade do I need to squeeze per hour during the lunch rush?" (that's like **peak traffic**)
- "Do I need one table, or three tables with three friends helping?" (that's like **servers**)

You wouldn't build a lemonade stand sized for 3 customers a day if 3,000 people walk by every lunch hour. And you wouldn't build something fit for 3,000 people a day if only 3 people walk by — that's a huge waste of cups, tables, and lemons.

**Software is exactly the same.** Before engineers build an app, they estimate:
- How many people will use it?
- How much stuff (photos, messages, videos) will it need to store?
- How many requests per second does it need to survive?
- How many computers ("servers") does that require?

Guess too small, and the app crashes the moment it gets popular (like running out of lemonade at lunch rush). Guess too big, and you've wasted a ton of money on computers nobody needed (like buying 10 tables for 3 customers). **Estimation is how you build "just the right size" thing, on purpose, before you build it — not by accident.**

---

## 4. The One Big Idea Behind Everything

If you remember only one sentence from this whole document, remember this:

> **"I don't need the exact number. I need a number that's in the right neighborhood, and I need to know WHY it's in that neighborhood."**

Here's a kid-friendly way to feel that: if I ask "how many students are in your school?", and you say "exactly 1,482, I counted," that's great but it took forever. If you say "I don't know, 6 billion?" that's useless and wrong. But if you say "there are about 50 classrooms and about 25 kids in each, so about 1,250," you're close enough to actually plan things with — like how many pizza boxes to order for a school party. **That middle answer is the goal, every single time.**

---

## 5. Building Block 1: Big Numbers Aren't Scary (Powers of 10)

Big numbers just have more zeroes. That's genuinely the whole secret. Let's build them up slowly, like climbing stairs:

| How many | Normal name | Zeroes | Kid-friendly comparison |
| --- | --- | --- | --- |
| 1,000 | Thousand | 3 zeroes | About how many students might be in a big school |
| 1,000,000 | Million | 6 zeroes | About how many seconds are in **11 and a half days** |
| 1,000,000,000 | Billion | 9 zeroes | About how many seconds are in **31 and a half years** |
| 1,000,000,000,000 | Trillion | 12 zeroes | Nobody has a good physical feel for this — just trust the zero count |

That million-vs-billion seconds comparison is one of the best "aha" facts in this whole topic — **read it again.** A million seconds is less than two weeks. A billion seconds is longer than your parents have been alive. That one fact is why engineers get very careful, very fast, the moment a number crosses from "millions" into "billions" — the jump is enormous, way bigger than it feels when you just see one extra comma in the number.

**The climbing-stairs trick:** every time you add 3 zeroes, you've gone up one "floor" — thousand → million → billion → trillion. You almost never need to know the number in between floors precisely. You just need to know *which floor you're on.*

### A quick word on computers counting slightly differently

Computers sometimes count in groups of 1,024 instead of 1,000 (because computers think in binary, powers of 2, not powers of 10). 1,024 is so close to 1,000 that for estimating, **you're allowed to just pretend it's 1,000.** Using 1,000 instead of 1,024 makes your answer off by about 2–12%, which is like being off by a couple of cents when splitting a $10 pizza bill — nobody cares.

---

## 6. Building Block 2: Turning "Per Day" Into "Per Second"

Here's a question: "10 million people send a message today. How many messages happen *per second*, roughly?"

First, how many seconds are in a day? Let's build it the honest way, step by step, instead of memorizing it:
- 60 seconds in a minute
- 60 minutes in an hour → 60 × 60 = 3,600 seconds in an hour
- 24 hours in a day → 3,600 × 24 = **86,400 seconds in a day**

Now here's the trick: **86,400 is really close to 100,000.** And 100,000 is just a 1 followed by 5 zeroes — super easy to divide by.

So: "10 million messages ÷ 100,000 seconds ≈ **100 messages per second.**"

The real, exact answer (using 86,400) would be about 116 messages per second. We said "about 100." Is that a problem? **No** — just like rounding a $97 restaurant bill to $100 to figure out a quick tip. You were close enough to make a decision, which is the entire point.

**The memorable shortcut:** *"However many million-per-day you have, that's roughly ten times that, per second."* 10 million/day → ~100/second. 100 million/day → ~1,200/second (because the rounding gets slightly less perfect at bigger numbers, but it's still in the right neighborhood).

---

## 7. Building Block 3: Busy Days vs. Quiet Days (Average vs. Peak)

Think about an ice cream stand. Across a whole day, maybe it sells 240 ice creams. If you just divide that evenly across 24 hours, that's 10 ice creams an hour — nice and calm.

But that's not how ice cream actually sells. Nobody buys ice cream at 3 AM. Almost everybody buys it between 2 PM and 5 PM, on a hot afternoon. So during that hot afternoon window, the stand might need to serve **40 ice creams an hour** — four times busier than the "calm average" suggested.

**If you only prepared for the calm average of 10-an-hour, you'd run out of ice cream and disappoint a huge line of angry kids during the actual rush.** That's why engineers always ask: what's the *peak*, not just the *average*?

**The rule of thumb to remember:** peak is usually **2 to 5 times** the average. If you're not sure, **use 3x** — it's the safe, middle guess. So: figure out the calm average first (easy math), then multiply by 3 to get a safe, realistic busy-time number.

---

## 8. Building Block 4: How Big Is a "Thing"? (Data Sizes)

Different things take up different amounts of storage space, the same way different objects take up different amounts of space in your school bag. Let's build a size-comparison ladder:

| Thing | Roughly how big | Kid comparison |
| --- | --- | --- |
| One letter/character (like the letter "A") | 1 byte | One single Lego brick |
| A short text message | ~1,000 bytes (1 KB) | A small handful of Lego bricks |
| A full web page | ~50,000–100,000 bytes (50–100 KB) | A small Lego set box |
| A small photo thumbnail | ~10,000–30,000 bytes (10-30 KB) | A medium Lego set |
| A regular photo from your phone | ~2,000,000–5,000,000 bytes (2-5 MB) | A big Lego castle set |
| One minute of video | ~40,000,000 bytes (40 MB) | A whole room full of Lego |

**The pattern to notice:** text is tiny, photos are medium, video is huge. This single fact — *video is the heavyweight champion of data size* — explains almost every design decision in apps like YouTube or Instagram. If your app has video in it, assume storage and internet-bandwidth problems will show up there first, not in the text parts.

---

## 9. Building Block 5: Keeping Spares (Replication)

If you have one favorite stuffed animal and it gets lost or ripped, it's gone forever. So some kids keep a backup — an identical spare — just in case. Companies do the exact same thing with your data, except usually with **3 copies**, not just 1 backup, spread across different computers (sometimes in different cities!) so that even if a whole building loses power, your data is still safe somewhere else.

**The number to remember:** when a company stores your data "for real" (in a database), they usually keep about **3 copies.** So if your actual data is 10 GB, the real storage cost is closer to **30 GB** — not 10 GB — because of those safety spares. Forgetting this "×3" is one of the single most common mistakes people make, so it gets its own warning later in this doc too.

---

## 10. Building Block 6: Your Favorite Toy Box (Caching)

Think about your room. Your favorite 5 toys are probably sitting right on your bed or desk, within arm's reach, because you play with them every single day. Your old, rarely-used toys are probably packed in a box at the back of a closet, or up in the attic.

That's exactly what a **cache** is: a small, fast, easy-to-reach spot where you keep the stuff that gets asked for *the most often*, so you don't have to go dig through the entire closet (the slow, giant storage) every single time.

Here's the magic number engineers lean on: usually, about **20% of the data gets 80% of the requests.** (This is called the "80/20 rule," and it shows up everywhere in life, not just computers — 20% of your toys probably get played with 80% of the time too!) So you don't need to keep *everything* within arm's reach — just that busy top 20%, and that alone handles most of the demand.

---

## 11. The Recipe: 6 Steps, Always in Order

Just like baking cookies has a recipe you follow in order (mix dry stuff, then wet stuff, then combine, then bake — not randomly), estimation has a recipe too. Always do these **in this order**, because each step needs the answer from the step before it:

```
1. Users     →  How many people use this, and how many each day?
2. Traffic   →  How many actions per second does that create (average, then peak)?
3. Storage   →  How much space does all that stuff need, forever (with spare copies)?
4. Bandwidth →  How fast does data need to travel in and out?
5. Memory    →  How big should the "toy box" (cache) be?
6. Servers   →  How many computers do we need to survive the busiest moment?
```

**A silly sentence to remember the order** (first letters: U, T, S, B, M, S):
> **"Uncle Tony Saw Big Mean Sharks."**

Picture that sentence like a tiny cartoon in your head — Uncle Tony, at the beach, seeing big mean sharks. Silly sentences stick in memory far better than plain lists, because your brain is much better at remembering a weird little story than remembering six abstract words.

---

## 12. A Full Worked Example, Slowly

Let's estimate a tiny school photo-sharing app, one step at a time, out loud, the way you'd actually think through it.

**The setup:** 1,000 students use the app. Each student uploads 2 photos a day. Each photo is about 2 MB.

**Step 1 — Users:** 1,000 students use it daily. Easy, that's given.

**Step 2 — Traffic:**
- Uploads per day = 1,000 students × 2 photos = **2,000 photos/day**
- Turn that into "per second" using our Building Block 2 trick: 2,000 ÷ 100,000 ≈ **0.02 uploads/second** on average. That's less than one upload every second — a very calm, small system on average.
- Peak (lunch break, when everyone's on their phone): using our ×3 rule from Building Block 3, that's still under 1 per second. This app genuinely doesn't need much muscle.

**Step 3 — Storage:**
- 2,000 photos/day × 2 MB = **4,000 MB = 4 GB of new photos every day**
- Over a full school year (about 200 school days): 4 GB × 200 ≈ **800 GB**
- Now add the safety spares from Building Block 5 (×3): 800 GB × 3 ≈ **2.4 TB total**

**Step 4 — Bandwidth:** since traffic is so small (less than 1 photo/second), bandwidth isn't a real concern here — this is already a conclusion, not just a number! Some systems barely need this step at all, and that's a perfectly fine thing to notice and say out loud.

**Step 5 — Memory (cache):** using the 80/20 rule, the "popular" 20% of recent photos (today's photos, mostly) should sit in the fast toy-box cache. 20% of one day's 4 GB is less than 1 GB — tiny, fits easily in memory on a single machine.

**Step 6 — Servers:** with under 1 request per second even at peak, **one single ordinary computer could handle this whole school's app comfortably**, with maybe one spare machine in case the first one breaks.

**The conclusion, in plain words:** "This app is small. It doesn't need fancy spreading-across-many-computers tricks. One good computer, with a backup, handles the whole school easily — and the big ×3 storage trick for safety copies is the only thing that really matters here." **That sentence — the conclusion — is actually the real goal of the whole exercise.** The numbers are just how you got there.

---

## 13. Memory Techniques: How to Actually Remember All This

Here are concrete tricks, not just "practice more":

1. **Turn lists into silly stories.** We already did this for the 6-step recipe ("Uncle Tony Saw Big Mean Sharks"). Your brain remembers weird pictures and stories far better than plain word lists. Make up your own sillier version if that helps it stick even more — the sillier, the better it sticks.

2. **Anchor numbers to real-life "aha" facts.** Don't memorize "1 billion = 10^9" as a bare fact. Memorize "a billion seconds is 31 years" instead — now it's a story, not a number, and stories don't get forgotten the way bare facts do.

3. **Use the "floors of a building" trick for zeroes.** Thousand, million, billion, trillion are just floors going up, each one 3 zeroes higher. If you ever forget how many zeroes "billion" has, just count the floors: thousand (floor 1), million (floor 2), billion (floor 3) → 3 × 3 = 9 zeroes.

4. **Round numbers on purpose, out loud, every time.** Say "about" before every number you say. "About 100,000 seconds in a day." "About 3 copies for safety." Saying "about" trains your brain to stop chasing exact answers, which is exactly the skill this whole topic is testing.

5. **Teach it to someone else (or a rubber duck, or your pet, or a stuffed animal).** This is called the Feynman technique: if you can explain the jellybean jar trick to your little sibling or even just out loud to an empty room, and it still makes sense coming out of your mouth, you actually understand it. If you get stuck explaining a part, that's exactly the part you need to re-read.

6. **Practice with everyday objects, not just computer examples.** Estimate how many grains of rice are in a bag. Estimate how many steps you take in a day. Estimate how many words are in your favorite book. The jellybean-jar skill transfers perfectly — the more ordinary things you practice on, the more automatic it becomes when a computer question shows up.

7. **Always end with one spoken sentence of "so what."** Don't let a number just sit there. Force yourself to say what it *means*: "...so one computer is enough" or "...so we definitely need a backup plan." The meaning sticks in memory far longer than the raw digits do.

---

## 14. Mistakes Even Smart People Make

| Mistake | Why it happens | The fix |
| --- | --- | --- |
| Doing exact, careful, slow math | It feels "more correct," but it wastes time for no real benefit | Round on purpose: 86,400 → 100,000. Say "about." |
| Forgetting the busy-time spike | Only thinking about the calm average | Always multiply the calm average by 2–5x (use 3x if unsure) |
| Forgetting the safety spare copies | ×3 for replication is easy to forget because it's not "exciting" math | Make it a habit: the moment you write a storage number, immediately ×3 it |
| Giving a number with no meaning attached | Stopping right after the math | Always add the "...so what" sentence after every number |
| Freezing up because the numbers feel huge and scary | Treating "billion" the same panicked way as "100" | Use the floors-of-a-building trick — it's just more zeroes, climbed one step at a time |
| Guessing wildly instead of building the guess from smaller pieces | Skipping the jellybean-jar method entirely | Always break one big scary question into 2–3 smaller, easier ones first |

---

## 15. Practice Problems (Start Here, Not With the Hard Ones)

Try these out loud, the slow way, before trying the harder "real interview" problems at the bottom of the [full cheat-sheet](./04_Back-of-the-Envelope%20Estimation.md):

1. **Jellybean warm-up:** A jar is as tall as 2 soda cans stacked and as wide as 3 fists. Guess how many jellybeans fit along the bottom, how many layers stack up, and multiply. (There's no single right answer — the goal is practicing the *method*, not hitting an exact number.)
2. **Classroom pizza:** Your school has 40 classrooms with about 25 kids each. If each kid eats 2 slices, and a pizza has 8 slices, about how many pizzas does the whole school need? *(40 × 25 = 1,000 kids → 2,000 slices → ÷ 8 ≈ 250 pizzas.)*
3. **Messaging app, gently:** 1 million kids use a chat app and each sends 5 messages a day. About how many messages happen per second, on average? *(1,000,000 × 5 = 5,000,000/day ÷ 100,000 ≈ 50 messages/second.)*
4. **Storage with the safety trick:** If a school's app stores 500 GB of photos, and the company always keeps 3 safety copies, how much storage does it really need? *(500 GB × 3 = 1,500 GB = 1.5 TB.)*

---

## 16. The One-Page Recap

- **Back-of-the-envelope estimation** = smart, quick, rough math — like guessing jellybeans by layers, not counting one by one.
- **Goal:** get "in the right neighborhood," fast, and know *why* — not a calculator-perfect answer.
- **Six zeroes = million. Nine zeroes = billion.** A million seconds is under 2 weeks; a billion seconds is 31+ years — that jump is huge, always respect it.
- **"Per day" ÷ 100,000 ≈ "per second."**
- **Peak is usually 2–5x the calm average** — use 3x if you're unsure.
- **Text is tiny, photos are medium, video is huge** — in that order, always.
- **Real storage ≈ your data × 3** (safety spare copies) — this is the single most-forgotten trick.
- **About 20% of your stuff gets 80% of the attention** — that's what your fast "toy box" (cache) should hold.
- **The recipe, in order:** Users → Traffic → Storage → Bandwidth → Memory → Servers ("Uncle Tony Saw Big Mean Sharks").
- **Every number needs a "so what" sentence after it**, or it was just math, not an estimate that actually helps anyone decide anything.

**Ready for the grown-up version?** Head to the [full Back-of-the-Envelope Estimation reference](./04_Back-of-the-Envelope%20Estimation.md) — it's the exact same ideas you just learned, just written fast and dense, the way you'll actually need to use it in a real system design interview.
