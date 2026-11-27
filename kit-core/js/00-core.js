"use strict";
/* Shared helpers, storage keys and the unit picked in the address (#unit-id). */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const shuf = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const ask = (m) => (typeof confirm === "function" ? confirm(m) : true);
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
const fmt1 = (x) => String(Math.round(x * 10) / 10);

/* Inline SVG icons (stroke = currentColor). */
const svg = (d, w) =>
  '<svg class="ic" width="' + (w || 18) + '" height="' + (w || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
const ICON = {
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  grid: svg('<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 16),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 16),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 16),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>', 16),
  print: svg('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>', 16),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 16),
  shuffle: svg('<path d="M3 7h3.5c4 0 6 10 10 10H21"/><path d="M3 17h3.5c1.6 0 2.8-1.6 3.8-3.5"/><path d="M14 9.5c.9-1.4 1.9-2.5 3.5-2.5H21"/><path d="M18 4l3 3-3 3M18 14l3 3-3 3"/>', 16),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>', 16),
  redo: svg('<path d="M3 12a9 9 0 1015.5-6.2"/><path d="M21 3v6h-6"/>', 16),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.2"/>', 20),
};

/* Midterm review (course.json "midterm": { "week": "YYYY-MM-DD", "units": [...], "mockQs": 40 }): a page at #mid built
   from the course's units, for courses with 2 or more units that have cards. */
const MIDCFG = COURSE.midterm || null;
const midUnits = () =>
  MIDCFG ? COURSE.units.filter((u) => (!MIDCFG.units || MIDCFG.units.indexOf(u.id) >= 0) && UNITDATA[u.id] && (UNITDATA[u.id].decks || []).some((d) => !d.optional)) : [];
const midOn = () => midUnits().length > 1;

/* Which unit is open: the part of the address after #. No match means the course home page. */
const UNIT = (() => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id === "mid" && midOn()) return { id: "mid", label: "Midterm", title: "Midterm review", mid: true, learnMix: midUnits().every((u) => u.learnMix) };
  return COURSE.units.find((u) => u.id === id) || null;
})();
/* The midterm page's data: every deck and scenario of its units (ids prefixed with the unit, so they never clash),
   and a mock midterm of multiple-choice questions from the units the student picked, split evenly. Questions that
   share a source stay together. The same mock comes back on every visit until the student asks for a new one. */
function midData() {
  let M = {};
  try {
    M = (JSON.parse(localStorage.getItem("sk:" + COURSE.id + ":mid:kit") || "{}") || {}).mid || {};
  } catch (e) {}
  const us = midUnits(),
    pick = us.filter((u) => !M.units || !M.units.length || M.units.indexOf(u.id) >= 0);
  const data = { images: {}, decks: [], sq: [], flows: [], trees: [], tables: [], watch: [], practice: { sections: [] } };
  us.forEach((u) => {
    const src = UNITDATA[u.id];
    Object.assign(data.images, src.images || {});
    src.decks.forEach((dk) => {
      if (dk.optional) return;
      data.decks.push({
        id: u.id + ":" + dk.id,
        name: dk.name,
        unit: u.id,
        sections: dk.sections.map((sc, si) => ({
          name: sc.name,
          key0: u.id + ":" + (sc.key0 || dk.id + "." + si),
          cards: sc.cards.map((c, ci) => {
            const oid = c.id0 || dk.id + "." + si + "." + ci;
            return Object.assign({}, c, { id0: u.id + ":" + oid, oid: oid, unit: u.id });
          }),
        })),
      });
    });
    (src.sq || []).forEach((s) => data.sq.push(Object.assign({}, s, { deck: u.id + ":" + s.deck, unit: u.id })));
  });
  let seed = (M.seed || 1) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mix = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const N = (MIDCFG && MIDCFG.mockQs) || 40,
    groups = [],
    sources = {};
  /* Each picked unit's multiple-choice questions, in groups (questions that share a source stay together). */
  const pools = pick.map((u) => {
    const seen = {},
      byKey = {},
      keys = [];
    (UNITDATA[u.id].practice.sections || []).forEach((s) =>
      s.questions.forEach((q) => {
        if (q.type !== "mcq" || seen[q.stem + "|" + (q.src || "")]) return;
        seen[q.stem + "|" + (q.src || "")] = 1;
        const k = q.src ? "s:" + q.src : "q:" + q.id;
        if (!byKey[k]) {
          keys.push(k);
          byKey[k] = [];
        }
        byKey[k].push({ q: q, s: s });
      }),
    );
    return { u: u, groups: mix(keys).map((k) => byKey[k]), n: keys.reduce((a, k) => a + byKey[k].length, 0) };
  });
  /* Split N evenly; a unit with too few questions gives the rest to the others. */
  const quota = new Map(pools.map((p) => [p, 0]));
  let open = pools.filter((p) => p.n > 0),
    left = N;
  while (left > 0 && open.length) {
    const share = Math.max(1, Math.floor(left / open.length));
    open.forEach((p) => {
      const add = Math.min(share, p.n - quota.get(p), left);
      quota.set(p, quota.get(p) + add);
      left -= add;
    });
    open = open.filter((p) => quota.get(p) < p.n);
  }
  pools.forEach((p) => {
    let n = 0;
    p.groups.forEach((g) => {
      if (n >= quota.get(p)) return;
      n += g.length;
      groups.push(
        g.map((x) => {
          const c = Object.assign({}, x.q, { id: p.u.id + ":" + x.q.id, topic: p.u.label + ": " + (x.q.topic || x.q.skill || "Mixed"), unit: p.u.id });
          if (x.q.src) {
            c.src = p.u.id + ":" + x.q.src;
            sources[c.src] = (x.s.sources || {})[x.q.src];
          }
          return c;
        }),
      );
    });
  });
  const none = pools.filter((p) => !p.n).map((p) => p.u.label);
  const qs = [].concat(...mix(groups));
  if (qs.length)
    data.practice.sections.push({
      name: "Mock midterm",
      mode: "exam",
      exam: "Mock midterm",
      tips: [
        "Multiple-choice questions from the units you picked, split evenly." + (none.length ? " " + none.join(" and ") + (none.length > 1 ? " have" : " has") + " no multiple-choice practice, so " + (none.length > 1 ? "they aren't" : "it isn't") + " in the mock; practice " + (none.length > 1 ? "them" : "it") + " in " + (none.length > 1 ? "their units" : "its unit") + "." : ""),
        "The real midterm's length and format aren't posted yet, so treat this as practice, not a preview.",
        "To time yourself, open Options and turn on the timer.",
      ],
      none: none,
      examTips: ["Answer every question, then check your score by unit."],
      sources: sources,
      questions: qs,
    });
  return data;
}
const D = UNIT ? (UNIT.mid ? midData() : UNITDATA[UNIT.id]) : null;
/* Moving between units reloads the page; the focus timer's "leave this page?" check skips this case. */
addEventListener("hashchange", () => {
  window.__navOK = true;
  location.reload();
});

/* Saved progress is namespaced per course and unit, so kits on the same github.io site never overwrite each other. */
const keyOf = (u, part) => "sk:" + COURSE.id + ":" + u.id + ":" + part;
const PREFK = "sk:" + COURSE.id + ":prefs";
COURSE.units.forEach((u) => {
  /* One-time copy from the keys the old single-unit kits used. */
  const legacy = u.legacyKeys || {};
  ["kit", "pt"].forEach((part) => {
    try {
      const k = keyOf(u, part);
      if (legacy[part] && localStorage.getItem(k) === null) {
        const v = localStorage.getItem(legacy[part]);
        if (v !== null) localStorage.setItem(k, v);
      }
    } catch (e) {}
  });
});
const LSK = UNIT ? keyOf(UNIT, "kit") : null;
const LASTK = "sk:" + COURSE.id + ":last";
const PTK = UNIT ? keyOf(UNIT, "pt") : null;
const readJSON = (k) => {
  try {
    const r = localStorage.getItem(k);
    return r ? JSON.parse(r) : null;
  } catch (e) {
    return null;
  }
};
const writeJSON = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
};

/* Theme and text size apply to the whole course, including the unit list. */
const PREF_DEF = { theme: "auto", size: 2 };
const PREFS = Object.assign({}, PREF_DEF, readJSON(PREFK) || {});
/* Theme is one setting for the whole site: the hub's Dark mode switch and every kit's Settings share "sk:theme"
   (all kits live on the same github.io site). Older choices carry over: the hub's old key, then this course's. */
const THEMEK = "sk:theme";
function savedTheme() {
  try {
    const t = localStorage.getItem(THEMEK) || localStorage.getItem("sk:hub:theme");
    if (t === "auto" || t === "light" || t === "dark") return t;
  } catch (e) {}
  return null;
}
function setTheme(t) {
  PREFS.theme = t;
  try {
    localStorage.setItem(THEMEK, t);
  } catch (e) {}
}
PREFS.theme = savedTheme() || PREFS.theme;
/* Another open tab (the hub or another kit) changed the theme: follow it. */
addEventListener("storage", (e) => {
  if (e.key !== THEMEK) return;
  const t = savedTheme();
  if (t && t !== PREFS.theme) {
    PREFS.theme = t;
    applyPrefs();
    if (typeof render === "function" && UNIT) render();
  }
});
function applyPrefs() {
  const root = document.documentElement;
  root.setAttribute("data-theme", PREFS.theme);
  root.style.fontSize = [15, 16, 17, 19, 21][PREFS.size] + "px";
  root.style.setProperty("--accent-l", COURSE.accent);
  root.style.setProperty("--accent-d", COURSE.accentDark || COURSE.accent);
}
applyPrefs();

const ACT = {};
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const f = ACT[t.dataset.act];
  if (f) f(t, e);
});
