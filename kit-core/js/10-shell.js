/* Course home (list of units) and the frame around an open unit: header, progress meter, tabs, deck chips. */
function hubLink() {
  return COURSE.hub ? '<a class="hublink" href="' + esc(COURSE.hub) + '">' + ICON.back + "Study Hub</a>" : "<span></span>";
}

/* Credit line on every kit page. The engine is MIT-licensed (kit-core/LICENSE): copies must keep this line. */
const CREDIT_URL = "https://dn4563.github.io/Study-Hub-by-David/";
function creditLine() {
  return '<footer class="credit">Study kit engine by <a href="' + CREDIT_URL + '">David Noskow</a></footer>';
}

function unitProgress(u) {
  const data = UNITDATA[u.id],
    saved = readJSON(keyOf(u, "kit")) || {},
    known = saved.known || {};
  const ids = [];
  data.decks.forEach((dk) => {
    if (dk.optional) return;
    dk.sections.forEach((sc, si) => sc.cards.forEach((c, ci) => ids.push(c.id0 || dk.id + "." + si + "." + ci)));
  });
  let answered = 0,
    total = 0;
  const pt = readJSON(keyOf(u, "pt"));
  data.practice.sections.forEach((s) => {
    const st = pt && pt.secs ? (pt.secs.find((x) => x.name === s.name) || {}).st || {} : {};
    s.questions.forEach((q) => {
      total++;
      const x = st[q.id];
      if (x && (x.checked || x.mark != null || Object.keys(x.pm || {}).length)) answered++;
    });
  });
  /* A free-response unit counts questions done (practiced or in a mock exam). */
  if (data.fr) {
    const fr = readJSON(keyOf(u, "fr")) || {},
      done = fr.done || {};
    data.fr.items.forEach((q) => {
      total++;
      if (done[q.id]) answered++;
    });
  }
  return { got: ids.filter((id) => known[id]).length, tot: ids.length, answered: answered, total: total };
}

function homeHTML() {
  let h =
    '<header class="top"><div class="topbar">' +
    hubLink() +
    '</div><h1 class="course">' +
    esc(COURSE.name) +
    '</h1><p class="lede">' +
    esc(COURSE.tagline || "Pick a unit. Progress in each unit is saved in this browser.") +
    "</p></header>";
  /* "Continue": the unit opened last in this browser. */
  const last = readJSON(LASTK),
    lu = last && COURSE.units.find((u) => u.id === last.unit);
  h += "<main>";
  if (lu)
    h +=
      '<a class="resume homeresume" href="#' +
      esc(lu.id) +
      '"><div><b>Continue: ' +
      esc(lu.label) +
      '</b><span class="muted">' +
      esc(lu.title) +
      '</span></div><span class="btn sec">Continue</span></a>';
  h += '<ul class="unitlist">';
  COURSE.units.forEach((u) => {
    const p = unitProgress(u),
      pct = p.tot ? Math.round((100 * p.got) / p.tot) : p.total ? Math.round((100 * p.answered) / p.total) : 0;
    h +=
      '<li><a class="unitrow" href="#' +
      esc(u.id) +
      '"><span class="ulabel">' +
      esc(u.label) +
      '</span><span class="ubody"><span class="utitle">' +
      esc(u.title) +
      "</span>" +
      (u.blurb ? '<span class="ublurb">' + esc(u.blurb) + "</span>" : "") +
      /* No "0 of 204 terms" here (the audit found big totals scare people off); a slim bar shows how far along. */
      '<span class="ustat">' +
      (pct ? pct + "% done" : "Not started") +
      (testOf(u) ? ", " + esc(testOf(u)) : "") +
      '</span><span class="bar" aria-hidden="true"><i style="width:' +
      pct +
      '%"></i></span></span><span class="ugo">Open' +
      ICON.chev +
      "</span></a></li>";
  });
  return h + "</ul>" + backupHTML() + "</main>" + creditLine();
}

/* A unit's test date from its saved Study plan, as "test on Thu, Dec 3" (until the day). */
function testOf(u) {
  const P = (readJSON(keyOf(u, "kit")) || {}).plan;
  if (!P || P.nodate || !P.date) return "";
  const p = P.date.split("-").map(Number),
    t = new Date(p[0], p[1] - 1, p[2]),
    t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const n = Math.round((t - t0) / 86400000);
  return n < 0 ? "" : n === 0 ? "test today" : n === 1 ? "test tomorrow" : "test on " + t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function renderHome() {
  document.title = COURSE.name + " Study Kit";
  document.getElementById("app").innerHTML = homeHTML();
}

/* ---------- open unit ---------- */
const DEF = {
  hooks: true,
  confirm: true,
  optDeck: false,
  fcPool: "unknown",
  fcOrder: "shuffle",
  fcFirst: "term",
  fcMode: "sort",
  qType: "mixed",
  dir: "both",
  focus: "unknown",
  timer: 0,
  recall: true,
};
let SAVE, ALL, BYID, LESSONS, UI, TABS;

function loadSave() {
  SAVE = { settings: Object.assign({}, DEF), known: {}, trouble: {}, done: {}, li: 0, revHist: [], secRev: {}, star: {} };
  const o = readJSON(LSK);
  if (!o) return;
  SAVE.known = o.known || {};
  SAVE.trouble = o.trouble || {};
  SAVE.done = o.done || {};
  SAVE.li = o.li || 0;
  SAVE.ui = o.ui || null;
  SAVE.revHist = o.revHist || [];
  SAVE.secRev = o.secRev || {};
  SAVE.star = o.star || {};
  SAVE.plan = o.plan || null;
  SAVE.tonight = o.tonight || null;
  const s = o.settings || {};
  /* Older kits kept theme and size per kit; carry them over once. */
  if (!readJSON(PREFK) && (s.theme || s.size !== undefined)) {
    if (s.theme && !savedTheme()) setTheme(s.theme);
    if (typeof s.size === "number") PREFS.size = s.size;
    writeJSON(PREFK, PREFS);
    applyPrefs();
  }
  delete s.theme;
  delete s.size;
  SAVE.settings = Object.assign({}, DEF, s);
}
function save() {
  writeJSON(LSK, SAVE);
}

function indexCards() {
  BYID = {};
  D.allDecks = D.allDecks || D.decks;
  D.allDecks.forEach((dk, di) => {
    dk.tone = di % 8;
    dk.sections.forEach((sc, si) =>
      sc.cards.forEach((c, ci) => {
        /* id0 / key0: a card or section moved by groups.json keeps the id it had before, so saved progress still matches. */
        c.id = c.id0 || dk.id + "." + si + "." + ci;
        c.deck = dk.id;
        c.sec = sc.key0 || dk.id + "." + si;
        BYID[c.id] = c;
      }),
    );
  });
}
/* Optional decks stay out of "All decks", the meter and the mixed quiz unless turned on in Settings. */
function rebuild() {
  D.decks = D.allDecks.filter((d) => !d.optional || SAVE.settings.optDeck);
  ALL = [];
  LESSONS = [];
  D.decks.forEach((dk) =>
    dk.sections.forEach((sc, si) => {
      sc.cards.forEach((c) => ALL.push(c));
      const n = sc.cards.length,
        parts = Math.max(1, Math.ceil(n / 5)),
        base = Math.floor(n / parts),
        extra = n % parts;
      let i = 0;
      for (let p = 0; p < parts; p++) {
        const sz = base + (p < extra ? 1 : 0);
        const sk = sc.key0 || dk.id + "." + si;
        LESSONS.push({
          id: sk + "." + p,
          deck: dk.id,
          sec: sk,
          secName: sc.name,
          part: p,
          parts: parts,
          title: sc.name + (parts > 1 ? " (part " + (p + 1) + " of " + parts + ")" : ""),
          cards: sc.cards.slice(i, i + sz),
        });
        i += sz;
      }
    }),
  );
}

function initShell() {
  writeJSON(LASTK, { unit: UNIT.id, at: Date.now() });
  loadSave();
  indexCards();
  rebuild();
  const secs = D.practice.sections;
  /* A free-response unit (fr.json) has its own simple page, plus Settings. */
  if (hasFR()) {
    frLoad();
    TABS = [["fr", "Free response"], ["set", "Settings"]];
    UI = { tab: "fr", deck: 0, run: null, q: null, qmsg: "" };
    if (SAVE.ui && SAVE.ui.tab === "set") UI.tab = "set";
    document.title = UNIT.label + ": " + UNIT.title + " | " + COURSE.name;
    return;
  }
  /* Every tool a unit can have. The top tabs group them (GROUPS); the ids never change, so saved progress and old
     saved tabs keep working. A unit with no cards is practice only: no Start, Learn, Study guide, Flashcards or Quiz. */
  TABS = ALL.length
    ? [
        ["start", "Start"],
        ["plan", "Study plan"],
        ["tonight", "Tonight's session"],
        ["learn", "Learn"],
        ["flash", "Flashcards"],
        ["quiz", "Quiz"],
      ]
    : [];
  if (secs.some((s) => s.mode !== "exam")) TABS.push(["pt", "Practice Test"]);
  if (secs.some((s) => s.mode === "exam")) TABS.push(["exam", "Mock exam"]);
  if (ALL.length) TABS.push(["guide", "Study guide"]);
  if (D.cheat && D.cheat.length) TABS.push(["cheat", "Cheat sheet"]);
  if (secs.length || ALL.length) TABS.push(["prog", "Progress"]);
  TABS.push(["set", "Settings"]);
  UI = { tab: TABS[0][0], deck: 0, run: null, q: null, qmsg: "", last: {} };
  const u = SAVE.ui;
  if (u) {
    /* A unit opens on Start; the tool used last is offered there as "Pick up where you left off". */
    if (TABS.some((t) => t[0] === u.tab) && u.tab !== "start" && u.tab !== "set") UI.resume = u.tab;
    if (!ALL.length && TABS.some((t) => t[0] === u.tab)) UI.tab = u.tab;
    if (u.deck && D.decks.some((d) => d.id === u.deck)) UI.deck = u.deck;
    if (u.q && typeof u.q === "object" && u.q.decks) UI.q = u.q;
    if (u.last && typeof u.last === "object") UI.last = u.last;
  }
  document.title = UNIT.label + ": " + UNIT.title + " | " + COURSE.name;
}

const deckOf = (id) => D.allDecks.find((d) => d.id === id);
const deckTone = (id) => {
  const d = deckOf(id);
  return d ? d.tone : 0;
};
const dot = (id) => '<i class="dot t' + deckTone(id) + '" aria-hidden="true"></i>';
const deckCards = () => (UI.deck ? ALL.filter((c) => c.deck === UI.deck) : ALL);

/* Top tabs: Start, Study, Test yourself, Notes (plus the Settings gear). Each groups some tools. */
const GROUPS = [
  ["start", "Start", ["start", "plan", "tonight"]],
  ["study", "Study", ["learn", "flash", "quiz"]],
  ["test", "Test yourself", ["pt", "exam"]],
  ["notes", "Notes", ["guide", "cheat", "prog"]],
];
const hasTool = (t) => TABS.some((x) => x[0] === t);
const toolName = (t) => (TABS.find((x) => x[0] === t) || [t, t])[1];
const groupOf = (t) => (GROUPS.find((g) => g[2].indexOf(t) >= 0) || ["set"])[0];
function goTool(t) {
  if (!hasTool(t)) return;
  UI.tab = t;
  UI.run = null;
  if (typeof stopTM === "function") stopTM();
  UI.last = UI.last || {};
  UI.last[groupOf(t)] = t;
  render();
  window.scrollTo(0, 0);
}
function navHTML() {
  if (hasFR())
    return (
      '<nav class="tabs" aria-label="Sections"><div class="tabrow"><button class="tab" data-act="tab" data-t="fr"' +
      (UI.tab === "fr" ? ' aria-current="page"' : "") +
      '>Free response</button></div><button class="tab tabgear" data-act="tab" data-t="set" aria-label="Settings" title="Settings"' +
      (UI.tab === "set" ? ' aria-current="page"' : "") +
      ">" +
      ICON.gear +
      "</button></nav>"
    );
  const g = groupOf(UI.tab),
    groups = GROUPS.filter((x) => x[2].some(hasTool));
  let h =
    '<nav class="tabs" aria-label="Sections"><div class="tabrow">' +
    groups.map((x) => '<button class="tab" data-act="group" data-g="' + x[0] + '"' + (g === x[0] ? ' aria-current="page"' : "") + ">" + x[1] + "</button>").join("") +
    /* Settings is an icon at the end, outside the scrolling row, so it never wraps or scrolls away. */
    '</div><button class="tab tabgear" data-act="tab" data-t="set" aria-label="Settings" title="Settings"' +
    (UI.tab === "set" ? ' aria-current="page"' : "") +
    ">" +
    ICON.gear +
    "</button></nav>";
  const grp = GROUPS.find((x) => x[0] === g),
    tools = grp && g !== "start" ? grp[2].filter(hasTool) : [];
  if (tools.length > 1)
    h +=
      '<div class="seg" role="group" aria-label="' +
      esc(grp[1]) +
      '">' +
      tools.map((t) => '<button data-act="tab" data-t="' + t + '" aria-pressed="' + (UI.tab === t) + '">' + esc(toolName(t)) + "</button>").join("") +
      "</div>";
  return h;
}
/* One "Deck" picker for the Study guide and Flashcards (it replaces the rows of deck buttons). */
function deckPickerHTML() {
  if (D.decks.length < 2) return "";
  return (
    '<label class="decksel">Deck <select data-deckpick aria-label="Deck"><option value="0"' +
    (!UI.deck ? " selected" : "") +
    ">All decks</option>" +
    D.decks.map((d) => '<option value="' + esc(d.id) + '"' + (UI.deck === d.id ? " selected" : "") + ">" + esc(d.name) + "</option>").join("") +
    "</select></label>"
  );
}
function view() {
  switch (UI.tab) {
    case "start":
      return startHTML();
    case "tonight":
      return tonightHTML();
    case "plan":
      return planHTML();
    case "learn":
      return learnHTML();
    case "guide":
      return guideHTML();
    case "flash":
      return fcHTML();
    case "quiz":
      return quizHTML();
    case "pt":
    case "exam":
      return ptHTML();
    case "fr":
      return frHTML();
    case "cheat":
      return cheatHTML();
    case "prog":
      return progHTML();
    default:
      return setHTML();
  }
}
function persistUI() {
  SAVE.ui = { tab: UI.tab === "start" && UI.resume ? UI.resume : UI.tab, deck: UI.deck, q: UI.q, L: packL(), last: UI.last };
  save();
  PTsave();
}
function render() {
  if (!UNIT) return renderHome();
  /* The full header (course, unit title, test date) only on Start; every other screen gets one slim line. */
  const fullHead = UI.tab === "start" || !ALL.length;
  const test = typeof planTestLabel === "function" ? planTestLabel() : "";
  let h =
    '<header class="top' +
    (fullHead ? "" : " slimtop") +
    '"><div class="topbar">' +
    hubLink() +
    '<button class="btn ghost" data-act="home">' +
    ICON.grid +
    "All units</button></div>" +
    (fullHead
      ? '<p class="kicker">' + esc(COURSE.name + ", " + UNIT.label) + "</p><h1>" + esc(UNIT.title) + "</h1>" + (test ? '<p class="testchip">' + esc(test) + "</p>" : "")
      : '<p class="slimline"><span class="slimt">' + esc(UNIT.label + ": " + UNIT.title) + "</span>" + (test ? '<span class="slimd">' + esc(test) + "</span>" : "") + "</p>") +
    "</header>";
  h += navHTML() + (typeof planBarHTML === "function" ? planBarHTML() : "") + (typeof focusBarHTML === "function" ? focusBarHTML() : "");
  if (["guide", "flash"].indexOf(UI.tab) >= 0 && !UI.run) {
    const dp = deckPickerHTML(),
      ob = UI.tab === "flash" && typeof fcOptsBtn === "function" ? fcOptsBtn() : "";
    if (dp || ob) h += '<div class="toolrow">' + (dp || "<span></span>") + ob + "</div>";
  }
  h += '<main id="main">' + view() + "</main>" + creditLine();
  document.getElementById("app").innerHTML = h;
  /* Keep the current tab in view when the tab row scrolls sideways (phones), since rebuilding resets the scroll. */
  const row = document.querySelector(".tabrow"),
    cur = row && row.querySelector(".tab[aria-current]");
  if (cur && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, cur.offsetLeft - row.offsetLeft - (row.clientWidth - cur.offsetWidth) / 2);
  if (MODAL.o) modalRender();
  persistUI();
}

ACT.home = () => {
  location.hash = "";
};
ACT.tab = (t) => goTool(t.dataset.t);
ACT.group = (t) => {
  const g = GROUPS.find((x) => x[0] === t.dataset.g);
  if (!g) return;
  const last = UI.last[g[0]];
  goTool(g[0] === "start" ? "start" : last && hasTool(last) ? last : g[2].find(hasTool));
};
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!UNIT || !t.matches || !t.matches("[data-deckpick]")) return;
  const d = D.decks.find((x) => String(x.id) === t.value);
  UI.deck = d ? d.id : 0;
  UI.run = null;
  FC = null;
  stopTM();
  render();
});
ACT.deck = (t) => {
  const d = D.decks.find((x) => String(x.id) === t.dataset.d);
  UI.deck = d ? d.id : 0;
  UI.run = null;
  FC = null;
  stopTM();
  initQ();
  D.decks.forEach((d) => {
    UI.q.decks[d.id] = UI.deck ? d.id === UI.deck : true;
  });
  render();
};
ACT.resetprog = () => sure("Reset study progress?", "This clears this unit's got-it marks, trouble terms and finished lessons. Practice test answers stay.", "Reset progress", resetProgNow);
function resetProgNow() {
  SAVE.known = {};
  SAVE.trouble = {};
  SAVE.done = {};
  SAVE.li = 0;
  SAVE.secRev = {};
  SAVE.revHist = [];
  UI.L = null;
  save();
  FC = null;
  render();
}
