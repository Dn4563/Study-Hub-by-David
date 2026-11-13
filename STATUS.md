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
| AP Business: https://dn4563.github.io/AP-Business-Study-Kit-by-David/ (live Nov 13; Pages must be turned on) | `Dn4563/AP-Business-Study-Kit-by-David` | `/home/user/ap-business-study-kit-by-david` |
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
- **Chem Chapter 3 (Matter):** brought up to the new standard Nov 12 (David's OK): `learnMix` on (first unit, no recall), 2 applied questions per card (208), deck and section intros, 17 definitions reworded so they don't repeat their term (cards not split, so saved progress is safe). The test is done; marked "review".
- **Chem Chapter 4 (Elements, Atoms, and Ions):**
  - Learn: `learnMix` and `recall` are on. 95 cards (including carbon and oxygen isotope examples), each with 2 applied questions (190; the second added Nov 12) and deck and section intros; no definition repeats its own term.
  - Removed: polyatomic ion memorization (only the definition card stays).
  - Practice Test: long answer, true/false, labeling, crossover, MCQ sets A, B and C, molar mass and moles.
  - Mock test: the format isn't confirmed. Long answer #4 says "Pb-297", probably a typo (VERIFY).
- **World Unit 2 (Networks of Exchange):** brought up to the new standard Nov 12 (David's OK): `learnMix` on (first unit), 2 applied questions per card (232, cause/effect and comparison), deck and section intros, 8 definitions reworded, a cheat sheet, and MCQ Set A, MCQ Set B and the Mock MCQs rewritten in the Unit 1-test format (13 questions in 5 source sets each; 130–185-word practice passages from the kit's sources, two with real textbook quotes from Abdu Razzak and Ibn Battuta marked as such, plus two textbook tables). MCQ Set C and the SAQs are unchanged. The test is done; marked "review".
- **World Unit 3 (Land-Based Empires, 1450–1750):** `learnMix` and `recall` on. 147 cards in 6 decks plus an optional Scientific Revolution deck, each with an applied question. Built from the teacher's study guide, Pocket Dictionary, cheat sheets, slideshows 3.1–3.3 and AMSCO 3.1–3.4 (read from David's Google Drive: My PC → AP World). Mock test = 13 source-based MCQs + 3 SAQs (pick 2), the format of the real test. Two quotes (Luther thesis 86, Busbecq) are from memory and marked VERIFY. MCQ Set A, MCQ Set B and the Mock MCQs were rewritten (Nov 5) to match the Unit 1 test in Drive: 13 questions in 5 source sets each, with 120–185-word passages written from class materials (labeled as practice passages, not real quotes) plus two AMSCO tables, and AP-style stems (main idea, best evidence, cause/context, comparison). Practice Test MCQ Set C = the class practice handout (9 questions); the handout has no answer key, so the answers are VERIFY. Practice Test also has 4 "Guide quiz" tabs (3.1–3.4), rewritten Nov 5 in the test format: 12 MCQs per tab in 4 source sets (passages and the guide's own tables, written only from the teacher's Unit 3 study guide and labeled as practice passages) + each topic's "Check yourself" as a written question; where the guide differs from AMSCO (Safavid–Mughal religion, mansabdar system, Safavid land grants) the explanation says so. World `core/` is now synced with kit-core. Nov 12: every card has 2 applied questions (294).
- **Story intros:** `> ` lines under a `# Deck` or `## Section` heading in cards.md become plain-language intros ("The big picture" per deck, "Read this first" per section), shown in Learn before the terms (collapsed on later parts of a section) and in the Study guide. As of Nov 12 every unit has them: Chem Ch 3 and Ch 4, World Units 2 and 3, Jewish History Test 1, and Psych (Phineas's deck summaries plus our section intros in `content/<unit>/intros.json`).
- **AP Psychology (David's format), Nov 9:** repo `Dn4563/AP-Psych-Study-Kit-by-David-`, clone `/home/user/ap-psych-study-kit-by-david-`. All content (525 visible cards, 129 scenarios, 291 exam questions, chains, tables, watch-out notes) is imported from Phineas's kit with his permission by `scripts/import-phineas.mjs` (reads `source/phineas-psych-kit.html`; his 8 hidden phobia cards stay out; his "never pair" list was deliberately not imported, David wants similar cards as wrong answers). Units: Unit 0, Unit 1, Unit 5, Perception, all `learnMix` (+ `recall` after Unit 0). We wrote one applied question per card in `scripts/asks-src/<unit>.py` (`make_asks.py` writes `asks.json`; the importer never touches it). Re-import only when Phineas gives permission again. The test needs `--max-old-space-size=4096` (set in package.json). Hub: Phineas's card is one row linking to his single page; new card "AP Psychology (David's format)" lists Unit 0, 1 and 5 (Perception stays its own unit inside the kit but is not listed on the hub, David's choice). GitHub Pages must be turned on for the new repo.
- **Quiz limits and randomness (Nov 11, engine `70-quiz.js`):** each number box shows "(up to N)" for the chosen decks and lowers bigger numbers to N (on change and on Start). Multiple choice and true/false share the decks' terms; each term is asked once per quiz, and each applied question at most once. Questions from the last quiz go to the back of the line (after the Settings focus), so a rerun starts with new ones.
- **Psych test part 2 prep (Nov 11):** Quiz's applied pool now includes asks.json questions, not only scenarios (engine `70-quiz.js`, all kits). Psych Unit 5: new exam set "Practice exam: Treatment & Personality" (25 applied MCQs, `content/unit-05/practice-extra.json`, written by `scripts/asks-src/practice_extra.py`, merged by the importer); Personality Disorders and Treatment cards now have 3 applied questions each (2 new, harder). `scripts/asks-src/check_asks.py` checks counts, duplicates and repeated choices. Phase 2 done (Nov 12): every Psych card now has at least 2 applied questions (Unit 0: 184, Unit 1: 410, Unit 5: 482, Perception: 48; Personality and Treatment cards have 3). Also Nov 12: every wrong choice in Phineas's practice questions and scenarios has a why (`content/<unit>/whys.json`: about half from his own card definitions, the rest written by us; `scripts/asks-src/check_whys.py` finds gaps after a re-import), section intros (`intros.json`) and a cheat sheet per unit (`cheat.json`). The importer merges all three and never writes them. It also replaces two of his explanations' letter references ("so B is a trap", "the second option") with the choice's text, since we reorder his choices. His wording is otherwise unchanged, so some of his questions still have the right answer as the longest choice.
- **Answer letters (Nov 10):** Phineas's exam bank lists the right answer first, so every Psych practice/mock set was all or mostly A. The importer now spreads each set's right answers evenly across A–D in a fixed random order (question ids now start with "q", so old saved answers reset). The engine build now fails if any practice set with 8+ MCQs has over 40% of its answers on one letter. Chem, World and Jewish History were already balanced.
- **Whole-course backup (engine, Nov 9):** each kit's home page has Download backup / Restore from backup (one `.json` with every unit's saved keys, `js/85-backup.js`). If a kit has `content/import-map.json`, Restore also reads that other kit's backup: the Psych kit's map (written by `import-phineas.mjs`) turns Phineas's `ps1-known` and `ps1-miss` into known cards and trouble counts in the right units. His lesson numbers and quiz answers are not carried over.
- **Learn mix (engine, Nov 9):** in learnMix units each lesson asks every new term as a definition question first, then about 3 of 4 terms come back as their applied question (`AP_SHARE = 0.75`); review and recall questions are applied 1 time in 3 (`AP_REVIEW`). Missed terms still return 2–3 questions later in the other form.
- **Engine license and credit:** `kit-core/LICENSE` is MIT (copyright David Noskow, engine only, not course content). Every kit page shows "Study kit engine by David Noskow" linking to the hub (`creditLine()` in `js/10-shell.js`), checked by the click-through. A starter prompt for other students copies kit-core and must keep both.
- **Jewish History Honors, Test 1 (Avraham to Nation):** repo `Dn4563/Jewish-History-Study-Kit`, clone `/home/user/jewish-history-study-kit`. `learnMix` on (first unit, no recall). 120 cards in 8 decks (deck 8 = how traditions develop, an Honors topic), 3 practice sets of 12, 40-question mock test from passages in the class packets. Sources: teacher's study guide, Lesson 2.1–2.3 packets, Avraham text studies, family-tree chart, Israel quick check, JTA election assignment, Rosh Hashanah traditions article, What Would You Save, Mesopotamia evidence packet, class notes. Antisemitism = "hostility to Jews" (class definition, confirmed by David). VERIFY: Issachar/Zebulun drawn under Bilhah on the chart. GitHub Pages is on (main / root). Nov 12: every card has 2 applied questions (240), plus deck and section intros.

- **AP Business (live Nov 13; on the hub as Unit 1 review, Unit 2 current):** repo `Dn4563/AP-Business-Study-Kit-by-David`, clone `/home/user/ap-business-study-kit-by-david`, accent plum `#6B3A7A`. Sources: David's Google Drive (My PC → AP Business): Unit 1 study guide, practice assessment, guided notes, quizzes, 1.2 readings, candy simulation, slides 1.1–1.3, 1.5, 1.7, 1.8; Unit 2 slides 2.1, 2.3–2.7 and the worksheets scan (David's filled-in 2.2 notes). Slides 1.4 and 2.2 were too big to open; no 1.6 slides exist (decks 1.4, 1.6 and 2.2 come from the study guide or David's notes, marked VERIFY in watch.md). Slides and guided notes are Jacob Clifford's: no questions or cases copied; all scenarios are written for the kit and labeled as made up.
  - **Unit 1 (Business, Competition, and New Ideas):** `learnMix`. 133 cards in 8 decks (1.1–1.8) with intros, 2 applied questions per card (266), guide (flows, tables, cheat sheet), watch notes. Practice: Set A (1.1–1.4), Set B (1.5–1.8), math drills (profit, value capture, market share), and a 40-question mock in the real test's format (8 scenarios × 5 questions, many with data tables, "two good answers, pick the best").
  - **Unit 2 (Marketing):** `learnMix` + `recall`. 140 cards in 7 decks (2.1–2.7) with intros, 2 applied questions per card (280), guide (4 Ps, research methods, charts, pricing strategies, channels, promotion tools, Cialdini), cheat sheet with formulas. Practice: Set A (2.1–2.3), Set B (2.7), math drills (CAC, markup, margin, CTR, conversion, ROAS), 40-question mock in the Unit 1 format (Unit 2 test format not known yet). VERIFY: the worksheet's CAC answer ($25, no key), the "prototype vs. MVP" and "multichannel distribution" blanks.
  - Generators: `scripts/asks-src/u1_*.py`, `u2_*.py` (+ `mkasks.py`), `scripts/practice-src/*.py`.
  - GitHub Pages: David turns it on (Settings → Pages → main / root); until then the site and hub link 404.
- **Hub (Nov 13):** `hub.js` loads `courses.json` with `cache: 'no-cache'`, so a new course or unit shows up on the next visit instead of after the browser's 10-minute cache.
- **Engine (Nov 13):** a practice source can now show paragraphs and a data table together (`srcHTML` in `js/90-pt.js`); synced to every kit.

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
- **Ch 4 mock test:** update it once the real test format is known.
- **Next units:** David sends source PDFs. Read them all, report the test format and any source disagreements, propose an outline, wait for OK, then build.

## See also
The rules in `CLAUDE.md` and each kit repo's `CLAUDE.md` and `README.md`.
