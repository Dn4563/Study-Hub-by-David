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

export function parseUnit(dir) {
  const guide = JSON.parse(readIf(dir, "guide.json", "{}"));
  const data = {
    images: JSON.parse(readIf(dir, "images.json", "{}")),
    decks: parseCards(readFileSync(join(dir, "cards.md"), "utf8")),
    sq: JSON.parse(readIf(dir, "scenarios.json", "[]")),
    flows: guide.flows || [],
    trees: parseTrees(readIf(dir, "trees.md", "")),
    tables: guide.tables || [],
    watch: parseWatch(readIf(dir, "watch.md", "")),
    practice: JSON.parse(readIf(dir, "practice.json", '{"sections":[]}')),
  };
  if (guide.cheat) data.cheat = guide.cheat;
  if (guide.topicDeck) data.topicDeck = guide.topicDeck;
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
