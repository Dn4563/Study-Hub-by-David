// Turns a unit's content folder into the data.json the engine reads. No dependencies.
//
//   cards.md        # Deck 1: Name            (add "(optional)" to the end for an optional deck)
//                   ## Section name
//                   | Term | Definition | Hook |   (Hook may be blank; write \| for a literal |)
//   watch.md        - (deck 2) Watch-out note text
//   trees.md        ```  a text tree  ```      (one fenced block per tree)
//   guide.json      { "flows": [...], "tables": [...], "cheat": [...], "topicDeck": {...} }
//   scenarios.json  [ { "deck", "q", "opts", "ans", "exp", "why" } ]
//   practice.json   { "sections": [...] }
//   images.json     { "key": "assets/file.png" }   (optional)
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));

export function parseCards(md, file = "cards.md") {
  const decks = [];
  let deck = null,
    sec = null;
  md.split(/\r?\n/).forEach((line, i) => {
    const where = `${file} line ${i + 1}`;
    let m;
    if ((m = line.match(/^# Deck (\S+?):\s*(.+?)\s*$/))) {
      const optional = /\(optional\)$/i.test(m[2]);
      const id = /^\d+$/.test(m[1]) ? Number(m[1]) : m[1];
      deck = { id, name: m[2].replace(/\s*\(optional\)$/i, ""), optional, sections: [] };
      decks.push(deck);
      sec = null;
    } else if ((m = line.match(/^## (.+?)\s*$/))) {
      if (!deck) throw new Error(`${where}: section before any "# Deck" heading`);
      sec = { name: m[1], cards: [] };
      deck.sections.push(sec);
    } else if (line.startsWith(">")) {
      // "> text" right under a deck or section heading = a plain-language intro shown before the terms.
      const target = sec || deck;
      if (!target) throw new Error(`${where}: intro text before any heading`);
      if (sec && sec.cards.length) throw new Error(`${where}: intro text must come before the section's table`);
      const t = line.replace(/^>\s?/, "").trim();
      target.intro = target.intro || [];
      if (!t) target.intro.push("");
      else if (target.intro.length && target.intro[target.intro.length - 1]) target.intro[target.intro.length - 1] += " " + t;
      else target.intro.push(t);
    } else if (line.trim().startsWith("|")) {
      const cells = splitRow(line);
      if (/^-+$/.test(cells[0].replace(/:/g, "")) || (cells[0] === "Term" && cells[1] === "Definition")) return;
      if (!sec) throw new Error(`${where}: card row before any "## Section" heading`);
      if (cells.length < 2 || !cells[0] || !cells[1]) throw new Error(`${where}: a card needs a term and a definition`);
      const card = { term: cells[0], def: cells[1] };
      card.hook = cells[2] || "";
      sec.cards.push(card);
    } else if (line.trim() && !line.startsWith("<!--")) {
      throw new Error(`${where}: not a deck heading, section heading or table row: "${line.slice(0, 60)}"`);
    }
  });
  return decks;
}

export function parseWatch(md) {
  return md
    .split(/\r?\n/)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => {
      const m = l.match(/^- \(deck (\S+?)\)\s*(.+)$/);
      if (!m) throw new Error(`watch.md: each note starts with "- (deck N)": "${l.slice(0, 60)}"`);
      return { deck: /^\d+$/.test(m[1]) ? Number(m[1]) : m[1], text: m[2] };
    });
}

export function parseTrees(md) {
  return [...md.matchAll(/```[^\n]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
}

const readIf = (dir, f, fallback) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : fallback);

/* groups.json (optional, ours): splits a big deck into smaller ones along its section lines, without touching card wording.
     { "2": [ { "name": "Research Methods: Studies & Correlation", "intro": "...", "sections": ["Why psychology needs research", ...] },
              { "id": "2b", "name": "Research Methods: Experiments & Ethics", "sections": ["Experiments", ...] } ] }
   The key is the original deck id. The first group keeps that id unless it names another; every section must be listed once,
   so a re-import that renames a section stops the build instead of losing cards. Each card keeps the id it had before
   (id0) and each section its key (key0), so saved progress, finished lessons and study plans still match. Watch-out notes,
   chains and scenarios tied to the old deck go to the new deck whose terms they mention most (ties: the first group);
   "pin": ["SQ3", "F2-1", "Informed consent comes"] in a group sends a scenario, chain or note (by id or opening words) there. */
const normT = (t) =>
  " " +
  String(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() +
  " ";
function termKeys(c) {
  const t = c.term.toLowerCase();
  return [t, t.replace(/\s*\(.*\)\s*/g, " ").trim(), ...t.split(/\s*[/,]\s*/)].map(normT).filter((k) => k.trim().length > 2);
}
function groupScore(g, text, answer) {
  const T = normT(text),
    A = answer ? normT(answer) : "";
  let n = 0;
  g.cards.forEach((c) =>
    [...new Set(termKeys(c))].forEach((k) => {
      if (A && (A.includes(k) || k.includes(A))) n += 5;
      if (T.includes(k)) n++;
    }),
  );
  return n;
}
export function applyGroups(data, groups, log = () => {}) {
  for (const [key, list] of Object.entries(groups)) {
    const di = data.decks.findIndex((d) => String(d.id) === key);
    if (di < 0) throw new Error(`groups.json: no deck ${key}`);
    const old = data.decks[di],
      used = new Set();
    old.sections.forEach((sc, si) => {
      sc.key0 = old.id + "." + si;
      sc.cards.forEach((c, ci) => (c.id0 = old.id + "." + si + "." + ci));
    });
    const made = list.map((g, gi) => {
      if (!g.name || !Array.isArray(g.sections) || !g.sections.length) throw new Error(`groups.json: deck ${key} group ${gi + 1} needs a name and sections`);
      const sections = g.sections.map((n) => {
        const sc = old.sections.find((s) => s.name === n);
        if (!sc) throw new Error(`groups.json: deck ${key} has no section "${n}"`);
        if (used.has(n)) throw new Error(`groups.json: section "${n}" is listed twice`);
        used.add(n);
        return sc;
      });
      const id = g.id !== undefined ? g.id : gi ? old.id + String.fromCharCode(97 + gi) : old.id;
      const d = { id, name: g.name, optional: old.optional, sections, from: old.id };
      if (g.intro) d.intro = [g.intro];
      else if (!gi && old.intro) d.intro = old.intro;
      return { d, pin: g.pin || [], cards: sections.flatMap((s) => s.cards) };
    });
    const left = old.sections.filter((s) => !used.has(s.name)).map((s) => s.name);
    if (left.length) throw new Error(`groups.json: deck ${key} sections not placed in any group: ${left.join(", ")}`);
    const ids = new Set(data.decks.filter((d) => d !== old).map((d) => String(d.id)));
    made.forEach((m) => {
      if (ids.has(String(m.d.id))) throw new Error(`groups.json: deck id ${m.d.id} is already used`);
      ids.add(String(m.d.id));
    });
    data.decks.splice(di, 1, ...made.map((m) => m.d));
    /* Move what was tied to the old deck. */
    const place = (item, tag, text, answer) => {
      let best = made.find((m) => m.pin.some((p) => p === item.id || (text && text.startsWith(p))));
      if (!best) {
        const sc = made.map((m) => groupScore(m, text, answer));
        best = made[sc.indexOf(Math.max(...sc))];
      }
      log(`  ${tag} -> ${best.d.name}`);
      item.deck = best.d.id;
    };
    data.watch.filter((w) => String(w.deck) === key).forEach((w) => place(w, "watch: " + w.text.slice(0, 50), w.text));
    data.flows.filter((f) => String(f.deck) === key).forEach((f) => place(f, "chain " + f.id, f.title + " " + (f.steps || []).join(" ")));
    data.sq
      .filter((s) => String(s.deck) === key)
      .forEach((s) => {
        const ans = Array.isArray(s.opts) && typeof s.ans === "number" ? s.opts[s.ans] : String(s.ans || "");
        place(s, "scenario " + s.id, s.q + " " + (s.exp || ""), ans);
      });
    if (data.topicDeck) for (const t in data.topicDeck) if (String(data.topicDeck[t]) === key) data.topicDeck[t] = made[0].d.id;
  }
}

export function parseUnit(dir) {
  const guide = JSON.parse(readIf(dir, "guide.json", "{}"));
  const data = {
    images: JSON.parse(readIf(dir, "images.json", "{}")),
    /* cards.md is optional: a practice-only unit (for example free-response practice) has no cards. */
    decks: parseCards(readIf(dir, "cards.md", "")),
    sq: JSON.parse(readIf(dir, "scenarios.json", "[]")),
    flows: guide.flows || [],
    trees: parseTrees(readIf(dir, "trees.md", "")),
    tables: guide.tables || [],
    watch: parseWatch(readIf(dir, "watch.md", "")),
    practice: JSON.parse(readIf(dir, "practice.json", '{"sections":[]}')),
  };
  // asks.json (optional): { "Term": [ { "q", "right", "wrong": [[text, why], ...], "exp" } ] } adds applied questions.
  const asks = JSON.parse(readIf(dir, "asks.json", "{}"));
  const byTerm = {};
  data.decks.forEach((d) => d.sections.forEach((s) => s.cards.forEach((c) => (byTerm[c.term] = c))));
  for (const [term, list] of Object.entries(asks)) {
    if (!byTerm[term]) throw new Error(`asks.json: no card named "${term}"`);
    list.forEach((a, i) => {
      if (!a.q || !a.right || !Array.isArray(a.wrong) || a.wrong.length < 2) throw new Error(`asks.json: "${term}" question ${i + 1} needs q, right and at least 2 wrong`);
      if (a.right.length > Math.max(...a.wrong.map((w) => w[0].length))) throw new Error(`asks.json: "${term}" question ${i + 1}: the right answer is the longest choice`);
    });
    byTerm[term].asks = list;
  }
  /* Free-response unit: fr.json (the questions, guide and links) and checker.json (the key-word checker's settings). */
  if (existsSync(join(dir, "fr.json"))) {
    data.fr = JSON.parse(readIf(dir, "fr.json", "{}"));
    const ck = JSON.parse(readIf(dir, "checker.json", "{}"));
    if (!ck.frq) throw new Error(dir + ": fr.json needs checker.json (npm run import writes it)");
    data.practice.frq = ck.frq;
    data.fr.items.forEach((q) => {
      if (!q.id || !q.source || !Array.isArray(q.parts) || !q.parts.length) throw new Error("fr.json: " + (q.id || "an item") + " needs id, source and parts");
      q.parts.forEach((p) => {
        if (!p.prompt || !p.model) throw new Error("fr.json: " + q.id + " part " + p.k + " needs a prompt and a model answer");
      });
    });
  }
  if (guide.cheat) data.cheat = guide.cheat;
  if (guide.topicDeck) data.topicDeck = guide.topicDeck;
  if (existsSync(join(dir, "groups.json"))) applyGroups(data, JSON.parse(readIf(dir, "groups.json", "{}")), (l) => process.env.GROUPS_LOG && console.log(l));
  return data;
}

export function parseAll(root) {
  const course = JSON.parse(readFileSync(join(root, "content/course.json"), "utf8"));
  return course.units.map((u) => {
    const dir = join(root, "content", u.dir);
    const data = parseUnit(dir);
    writeFileSync(join(dir, "data.json"), JSON.stringify(data, null, 1) + "\n");
    const cards = data.decks.reduce((n, d) => n + d.sections.reduce((m, s) => m + s.cards.length, 0), 0);
    return `${u.id}: ${data.decks.length} decks, ${cards} cards, ${data.sq.length} scenarios, ${data.practice.sections.length} practice sections`;
  });
}
