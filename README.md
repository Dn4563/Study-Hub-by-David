# Study Hub by David Noskow

The home page that links to every course study kit. Each course is its own site and its own repo; this page only links out to them.

Live address once published: **https://dn4563.github.io/Study-Hub-by-David/**

## Files

| File | What it does |
|---|---|
| `courses.json` | The list of courses and units. **This is the only file you edit to change what the hub shows.** |
| `index.html` | The page shell (title, fonts, where the list goes). |
| `hub.css` | Layout and colors. |
| `hub.js` | Reads `courses.json` and builds the course list. |
| `test/hub-check.mjs` | Opens the hub in a real browser and checks it against `courses.json`. |

Everything is static and every path is relative, so it works on GitHub Pages with no server and no build step.

## Add a course

Add one entry to the `courses` list in `courses.json`. Courses appear in the order they're listed.

```json
{
  "id": "apbio",
  "name": "AP Biology",
  "description": "One sentence on what the kit has.",
  "url": "https://dn4563.github.io/AP-Bio-Study-Kit/",
  "owner": "self",
  "accent": "#5A4A8C",
  "accentDark": "#B7A6EC",
  "status": "active",
  "units": [
    { "label": "Unit 1", "title": "Chemistry of Life", "status": "current" }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | Short name with no spaces. Must be different from every other course. |
| `name` | Shown on the colored tab. |
| `description` | One sentence under the tab. |
| `url` | The course site's address. Every unit links here unless the unit has its own `url`. |
| `owner` | `"self"` for your kits. `"external"` for someone else's site; also add `"maker": "Their name"`, and the hub adds a note that the site opens in the same tab and the Back button returns. |
| `accent` | The course color in light mode. Pick a dark, saturated color so white tab text stays readable. |
| `accentDark` | The same color, lighter, for dark mode. Dark tab text has to be readable on it. |
| `status` | `"active"` shows the course. `"hidden"` keeps the entry but leaves it off the page. |
| `units[].label` | Short label, e.g. `"Unit 3"` or `"Chapter 4"`. |
| `units[].title` | The unit's name. |
| `units[].status` | `"current"` shows "Current", `"review"` shows "Test done, kept for review", and `"ready"` shows nothing extra. |
| `units[].url` | Optional. A link straight to that unit, once the kit supports it. |

To add a unit to an existing course, add one line to that course's `units` list.

Check that the JSON is valid before you commit; a missing comma breaks the whole list. Pasting the file into https://jsonlint.com works, or run the check below.

## Preview on your computer

`fetch` can't read `courses.json` when you double-click `index.html`, so serve the folder:

```bash
npx http-server -p 8080
```

Then open http://localhost:8080.

## Check it

Needs Node 18+ and Playwright (`npm install playwright`, then `npx playwright install chromium`):

```bash
node test/hub-check.mjs
```

It prints `PASS` or a list of what's wrong. It checks phone and desktop widths, in light and dark mode, for:
- one tab per course
- every unit link pointing at the right address
- no errors
- no sideways scrolling

Add `--shots` to save screenshots.

## Publish on GitHub Pages

1. Push your changes and merge them into `main`.
2. On GitHub, open the repo, then **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**, **Branch** to `main`, and the folder to `/ (root)`. Click **Save**.
4. Wait about a minute, then open https://dn4563.github.io/Study-Hub-by-David/.

Later changes go live a minute or so after they're merged into `main`.

## If a course site moves

If you rename a course repo, its GitHub Pages address changes and the old one stops working. Update that course's `url` in `courses.json`, and update the "Back to Study Hub" link in the kit if this hub's address changed.

## The shared engine (`kit-core/`)

Every study kit you own is built from `kit-core/`: the design tokens, styles, engine scripts, build script and click-through test. To change something in every kit:

1. Edit it in `kit-core/` and push.
2. In each kit repo (cloned next to this one), run `npm run sync-core` and then `npm test`, and commit the result.

`kit-core/README.md` lists the content and question formats.
