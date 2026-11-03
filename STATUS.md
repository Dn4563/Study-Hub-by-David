# Status: Study Hub and study kits

## Context
David Noskow (10th grade, DKJA) keeps study kits for his classes. They all build from one shared engine and appear under one hub site. Everything below is live on `main` as of 2026-11-02. Read this file first in a new session. Update it when something changes.

## Live sites and repos (GitHub account Dn4563)
| Site | Repo | Local clone |
|---|---|---|
| Hub: https://dn4563.github.io/Study-Hub-by-David/ | `Dn4563/Study-Hub-by-David` (renamed from 10th-grade-APs) | `/home/user/study-hub-by-david` |
| Chem: https://dn4563.github.io/Pre-AP-Chemistry-Study-Kit/ | `Dn4563/Pre-AP-Chemistry-Study-Kit` | `/home/user/Pre-AP-Chemistry-Study-Kit` |
| World: https://dn4563.github.io/AP-World-History-Study-Kit/ | `Dn4563/AP-World-History-Study-Kit` (renamed from AP-World-Unit2-Study-Kit) | `/home/user/ap-world-history-study-kit` |
| Jewish History Honors: https://dn4563.github.io/Jewish-History-Study-Kit/ | `Dn4563/Jewish-History-Study-Kit` | `/home/user/jewish-history-study-kit` |
| Psych (Phineas's, link only, never edit) | brother12334/Psych-Unit-1 | none |

- **Work branch** in every repo: `claude/practical-cray-jo2t43`. Publishing means pushing that branch to `main` (`git push origin claude/practical-cray-jo2t43:main`), and only after David says "push".
- **New sessions:** a fresh session may need `add_repo` for the two renamed repos before it can push.

## Repo shape
- **Hub:**
  - Page and data: `index.html`, `hub.css`, `hub.js`, `courses.json` (one entry per course; units listed with status current / review / ready; each unit's `url` ends in its hash, e.g. `#u3`, so Open goes straight to that unit).
  - Course tabs are spread evenly from left to right (`--p` in `hub.js`), so the last tab always ends at the card's right edge; `hub-check.mjs` fails if a tab sticks out.
  - `test/hub-check.mjs`: the Playwright check, including the light/dark switch.
  - `kit-core/`: the shared engine.
    - `tokens.css`, `kit.css`
    - `js/00-core.js` … `99-boot.js`
    - `build-lib.mjs`, `parse-lib.mjs`, `test-lib.mjs` (the jsdom click-through)
- **Each kit:**
  - `content/course.json` lists the units. Per-unit flags: `learnMix`, `recall` and `legacyKeys`.
  - `content/<unit>/` holds the unit's files:
    - `cards.md` (`# Deck N: Name`, `## Section`, `| Term | Definition | Hook |`)
    - `asks.json` (applied questions per card), `watch.md`, `trees.md`, `guide.json`
    - `scenarios.json`, `practice.json`, `images.json` with `assets/`
    - `data.json` is generated and gitignored.
  - `core/` is a copy of kit-core; refresh it with `npm run sync-core`.
  - `npm test` parses, builds `index.html` and runs the click-through. `legacy/index.html` is the old hand-made page. `CLAUDE.md` holds David's rules.

## Units
- **Chem Chapter 3 (Matter):** old Learn style. The test is done; mark it "review".
- **Chem Chapter 4 (Elements, Atoms, and Ions):**
  - Learn: `learnMix` and `recall` are on. 95 cards (including carbon and oxygen isotope examples), each with an applied question; no definition repeats its own term.
  - Removed: polyatomic ion memorization (only the definition card stays).
  - Practice Test: long answer, true/false, labeling, crossover, MCQ sets A, B and C, molar mass and moles.
  - Mock test: the format isn't confirmed. Long answer #4 says "Pb-297", probably a typo (VERIFY).
- **World Unit 2 (Networks of Exchange):** old Learn style. The test is done; marked "review".
- **World Unit 3 (Land-Based Empires, 1450–1750):** `learnMix` and `recall` on. 147 cards in 6 decks plus an optional Scientific Revolution deck, each with an applied question. Built from the teacher's study guide, Pocket Dictionary, cheat sheets, slideshows 3.1–3.3 and AMSCO 3.1–3.4 (read from David's Google Drive: My PC → AP World). Mock test = 13 source-based MCQs + 3 SAQs (pick 2), the format of the real test. Two quotes (Luther thesis 86, Busbecq) are from memory and marked VERIFY. World `core/` is now synced with kit-core.
- **Jewish History Honors, Test 1 (Avraham to Nation):** repo `Dn4563/Jewish-History-Study-Kit`, clone `/home/user/jewish-history-study-kit`. `learnMix` on (first unit, no recall). 120 cards in 8 decks (deck 8 = how traditions develop, an Honors topic), 3 practice sets of 12, 40-question mock test from passages in the class packets. Sources: teacher's study guide, Lesson 2.1–2.3 packets, Avraham text studies, family-tree chart, Israel quick check, JTA election assignment, Rosh Hashanah traditions article, What Would You Save, Mesopotamia evidence packet, class notes. VERIFY: course definition of antisemitism (kit uses "hostility toward Jews as Jews"); Issachar/Zebulun drawn under Bilhah on the chart. GitHub Pages is on (main / root).

## Engine features (kit-core)
- **Learn, Quiz and Flashcards:** Learn uses lessons of 5 cards or fewer, review questions from earlier lessons, checkpoints and trouble terms. The Quiz has a timer, and every multiple-choice question has cross-off and Lock in.
- **Section review (Learn):** when a section is split into 2+ lessons, its last lesson offers a 5-question review of the whole section (trouble terms first, Skip button). Best score per section is saved (`SAVE.secRev`) and shown in the lesson map.
- **Flashcards (Quizlet-style):** Sort mode (Not yet / Got it) with ← Back that undoes the last choice, or Browse mode (Previous / Next); Swap sides button; ☆ Star with a Starred pool; Shuffle, Restart, counter and progress bar; round results with "Keep reviewing" the still-learning cards. Keys: Space/↑/↓ flip, → Got it or Next, ← Back or Previous, 1 Not yet, 2 Got it, S star. No audio yet.
- **Practice Test:**
  - palette, flags, shuffle, Retest Missed, print view
  - partial credit for multi-part questions
  - diagram labeling with pins on images
  - per-exam results page
- **`learnMix`** (per unit):
  - Learn picks a definition or an applied question at random.
  - Blanks appear in clues only, never in choices.
  - Term → definition is skipped if a definition contains its term, and wrong choices that mention the asked term are left out.
  - A missed term returns 2–3 questions later, asked the other way.
- **`recall`** (per unit): at most 1 question from an earlier unit, in about 1 of 3 lessons, never in a deck's first lesson. It never counts against the lesson, and it updates the old unit's trouble count. Picks are weighted random (trouble terms not marked "Got it" are 3x as likely) with a cooldown: no term again within 10 recalls or 2 days. Review questions in mixed units skip terms used in the last 2 lessons. There's a Settings switch.
- **Storage:** progress keys are `sk:<course>:<unit>:kit` and `:pt`. Old keys migrate automatically. The hub's theme is saved in `sk:hub:theme`.

## David's standing rules (also in each repo's CLAUDE.md)
- **New units:** `learnMix` and `recall` on, plus `asks.json`. One fact per card, and definitions never repeat their term.
- **Questions:**
  - Hard. The right answer is never the longest choice, and answer letters are balanced.
  - Every wrong choice gets a `why`, and choices are never referred to by letter.
  - History questions lean on source analysis.
- **Content:** don't invent content; mark anything not in his sources VERIFY.
- **Old units:** don't change units classmates have studied (Chem Ch 3, World Unit 2) unless David asks. Review them before the midterm, final and AP exam.
- **Publishing:** test, show screenshots and examples, and push to `main` only after David says "push".
- **Wording:** be direct and precise; David notices word choice.

## Open items
- **Diagram licenses:** license and author for the two Chem Ch 3 diagram images (David chose to leave these for now).
- **Old units:** bring Chem Ch 3 and World Unit 2 up to the new Learn style before the midterm, final or AP exam (ask first).
- **Ch 4 mock test:** update it once the real test format is known.
- **Next units:** David sends source PDFs. Read them all, report the test format and any source disagreements, propose an outline, wait for OK, then build.

## See also
The rules in `CLAUDE.md` and each kit repo's `CLAUDE.md` and `README.md`.
