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
};

/* Which unit is open: the part of the address after #. No match means the course home page. */
const UNIT = (() => {
  const id = decodeURIComponent(location.hash.slice(1));
  return COURSE.units.find((u) => u.id === id) || null;
})();
const D = UNIT ? UNITDATA[UNIT.id] : null;
addEventListener("hashchange", () => location.reload());

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
