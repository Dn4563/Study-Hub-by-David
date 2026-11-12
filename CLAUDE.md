# How David wants new units built

These apply to every new unit or chapter in this kit, and to any rework of an old one.

## Learn questions
- Turn on mixed Learn questions for the unit: set `"learnMix": true` on the unit in `content/course.json`.
- Write `asks.json` for the unit with one applied question for every card. Applied questions make you use the idea (for example "Strontium is in group 2. What charge does its ion have?"), not repeat the definition. Every wrong choice gets a `why`, and the right answer is never the longest choice. The build checks this.
- Both kinds of questions stay: Learn picks a definition question or an applied question at random. A missed term comes back 2 or 3 questions later, asked the other way.
- Turn on old unit recall for every unit after the first: set `"recall": true` on the unit in `content/course.json`. Learn then asks at most 1 question from an earlier unit, in about 1 of 3 lessons, never in a deck's first lesson; it never counts against the lesson.
- For history, applied questions lean on cause, effect, comparison, continuity and change, not reciting definitions.

## Cards
- One fact per card. Split cards that pack several items together (for example a card per family or per group charge, not one card for four families).
- Definitions should explain the idea in other words, not repeat the term.

## Old units
- Current state of every site and unit: see `STATUS.md` in the Study-Hub-by-David repo.
- Leave units that classmates have already studied alone unless David asks. Chem Chapter 3 and AP World Unit 2 were brought up to the new Learn style on Nov 12, with David's OK. Review old units again before the midterm, the final, or the AP exam, since those cover everything again. Ask David first.

## Process
- Don't invent content. Mark anything not in David's sources VERIFY.
- Run `npm test`, show screenshots and examples, and wait for David's OK before pushing to `main`.
- Keep `STATUS.md` in the Study-Hub-by-David repo up to date after every change. Also tell David in the chat, in a few short lines, what changed, which site and file it is in, and what was updated in `STATUS.md`. He does not read the whole status file.
- Before building anything, describe the plan to David in the chat in plain words (what will change, where, and how it will work) and wait for his OK.
