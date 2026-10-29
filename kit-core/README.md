# kit-core

The shared engine and design system for every study kit. A fix or feature made here reaches every kit the next time that kit runs `npm run sync-core` and rebuilds.

| File | What it is |
|---|---|
| `tokens.css` | Colors, fonts, radii and motion speeds. Light and dark values. The course accent comes from the kit's `course.json`. |
| `kit.css` | Layout and components (tabs, choices, practice test, results). Uses only the tokens. |
| `js/*.js` | The engine, joined in file-name order into one script: core and storage, page frame, answer choices, quiz runner, Learn, Study guide, Flashcards, Quiz builder, Settings, Practice Test, results, start-up. |
| `build-lib.mjs` | Builds a kit's single `index.html` from its `content/` folder and these files. |
| `test-lib.mjs` | The click-through test every kit runs (`npm test`). |

## Unit data format

Each unit's `data.json` holds: `decks` (with `sections` of `cards`: `term`, `def`, optional `hook`; a deck with `"optional": true` stays out of All decks, the meter and the mixed quiz unless turned on in Settings), `sq` (scenario questions), `flows` (ordered chains), `trees`, `tables`, `watch` (Watch-out notes), optional `cheat` and `topicDeck`, `images`, and `practice.sections`.

A practice section has `name`, `mode` (`practice` or `exam`), `exam` (exam sections with the same name share one results page), `tips`, `examTips`, optional `sources`, and `questions`. Question types:

| type | Fields |
|---|---|
| `mcq` | `stem`, `options`, `ans` (index), `exp`, `why` (one reason per wrong option; never cite a letter), optional `src`, `topic` or `skill` |
| `tf` | `stem`, `ans` (true/false), `exp` |
| `label` | `stem`, `labels`, `items` (`t`, `ans`, `exp`) |
| `diagram` | `stem`, `img` (key in `images`), `alt`, `credit` (required), `labels`, `pins` (`x`, `y` in percent of the image, `ans`, `exp`) |
| `frq` | `title`, `stem`, `data`, `parts` (`k`, `prompt`, `model`) |
| `saq` | `lead`, `src`, `parts` (`k`, `prompt`, `skill`, `model`, `tea` [topic sentence, evidence, analysis], `earns`, `weak`) |

Multi-part types (`label`, `diagram`, `frq`, `saq`) earn partial credit.
