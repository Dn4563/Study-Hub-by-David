/* Course home (list of units) and the frame around an open unit: header, progress meter, tabs, deck chips. */
function hubLink() {
  return COURSE.hub ? '<a class="hublink" href="' + esc(COURSE.hub) + '">' + ICON.back + "Study Hub</a>" : "<span></span>";
}

function unitProgress(u) {
  const data = UNITDATA[u.id],
    saved = readJSON(keyOf(u, "kit")) || {},
    known = saved.known || {};
  const ids = [];
  data.decks.forEach((dk) => {
    if (dk.optional) return;
    dk.sections.forEach((sc, si) => sc.cards.forEach((c, ci) => ids.push(dk.id + "." + si + "." + ci)));
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
  h += '<main><ul class="unitlist">';
  COURSE.units.forEach((u) => {
    const p = unitProgress(u),
      pct = p.tot ? Math.round((100 * p.got) / p.tot) : 0;
    h +=
      '<li><a class="unitrow" href="#' +
      esc(u.id) +
      '"><span class="ulabel">' +
      esc(u.label) +
      '</span><span class="ubody"><span class="utitle">' +
      esc(u.title) +
      "</span>" +
      (u.blurb ? '<span class="ublurb">' + esc(u.blurb) + "</span>" : "") +
      '<span class="ustat">' +
      p.got +
      " of " +
      p.tot +
      " terms marked got it" +
      (p.total ? ", " + p.answered + " of " + p.total + " practice questions answered" : "") +
      '</span><span class="bar" aria-hidden="true"><i style="width:' +
      pct +
      '%"></i></span></span><span class="ugo">Open' +
      ICON.chev +
      "</span></a></li>";
  });
  return h + "</ul></main>";
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
  qType: "mixed",
  dir: "both",
  focus: "unknown",
  timer: 0,
};
let SAVE, ALL, BYID, LESSONS, UI, TABS;

function loadSave() {
  SAVE = { settings: Object.assign({}, DEF), known: {}, trouble: {}, done: {}, li: 0 };
  const o = readJSON(LSK);
  if (!o) return;
  SAVE.known = o.known || {};
  SAVE.trouble = o.trouble || {};
  SAVE.done = o.done || {};
  SAVE.li = o.li || 0;
  SAVE.ui = o.ui || null;
  const s = o.settings || {};
  /* Older kits kept theme and size per kit; carry them over once. */
  if (!readJSON(PREFK) && (s.theme || s.size !== undefined)) {
    if (s.theme) PREFS.theme = s.theme;
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
        c.id = dk.id + "." + si + "." + ci;
        c.deck = dk.id;
        c.sec = dk.id + "." + si;
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
        LESSONS.push({
          id: dk.id + "." + si + "." + p,
          deck: dk.id,
          title: sc.name + (parts > 1 ? " (part " + (p + 1) + " of " + parts + ")" : ""),
          cards: sc.cards.slice(i, i + sz),
        });
        i += sz;
      }
    }),
  );
}

function initShell() {
  loadSave();
  indexCards();
  rebuild();
  const secs = D.practice.sections;
  TABS = [
    ["learn", "Learn"],
    ["guide", "Study guide"],
  ];
  if (D.cheat && D.cheat.length) TABS.push(["cheat", "Cheat sheet"]);
  TABS.push(["flash", "Flashcards"], ["quiz", "Quiz"]);
  if (secs.some((s) => s.mode !== "exam")) TABS.push(["pt", "Practice Test"]);
  if (secs.some((s) => s.mode === "exam")) TABS.push(["exam", COURSE.examTab || "Full exam"]);
  if (secs.length) TABS.push(["prog", "Progress"]);
  TABS.push(["set", "Settings"]);
  UI = { tab: "learn", deck: 0, run: null, q: null, qmsg: "" };
  const u = SAVE.ui;
  if (u) {
    if (TABS.some((t) => t[0] === u.tab)) UI.tab = u.tab;
    if (u.deck && D.decks.some((d) => d.id === u.deck)) UI.deck = u.deck;
    if (u.q && typeof u.q === "object" && u.q.decks) UI.q = u.q;
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

function view() {
  switch (UI.tab) {
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
    case "cheat":
      return cheatHTML();
    case "prog":
      return progHTML();
    default:
      return setHTML();
  }
}
function persistUI() {
  SAVE.ui = { tab: UI.tab, deck: UI.deck, q: UI.q, L: packL() };
  save();
  PTsave();
}
function render() {
  if (!UNIT) return renderHome();
  const got = ALL.filter((c) => SAVE.known[c.id]).length,
    tot = ALL.length,
    pct = tot ? Math.round((got / tot) * 100) : 0;
  let h =
    '<header class="top"><div class="topbar">' +
    hubLink() +
    '<button class="btn ghost" data-act="home">' +
    ICON.grid +
    "All units</button></div>" +
    '<p class="kicker">' +
    esc(COURSE.name + ", " + UNIT.label) +
    "</p><h1>" +
    esc(UNIT.title) +
    "</h1>" +
    '<div class="meter"><span>' +
    got +
    " of " +
    tot +
    ' terms marked got it</span><span class="bar" aria-hidden="true"><i style="width:' +
    pct +
    '%"></i></span><button class="lnk" data-act="resetprog">Reset progress</button></div></header>';
  h +=
    '<nav class="tabs" aria-label="Sections"><div class="tabrow">' +
    TABS.map(
      (t) =>
        '<button class="tab" data-act="tab" data-t="' + t[0] + '"' + (UI.tab === t[0] ? ' aria-current="page"' : "") + ">" + t[1] + "</button>",
    ).join("") +
    "</div></nav>";
  if (["guide", "flash", "quiz"].indexOf(UI.tab) >= 0 && !UI.run)
    h +=
      '<div class="chips" role="group" aria-label="Deck"><button class="chip" data-act="deck" data-d="0" aria-pressed="' +
      !UI.deck +
      '">All decks</button>' +
      D.decks
        .map(
          (d) =>
            '<button class="chip" data-act="deck" data-d="' +
            d.id +
            '" aria-pressed="' +
            (UI.deck === d.id) +
            '">' +
            dot(d.id) +
            esc(d.name) +
            " <small>" +
            ALL.filter((c) => c.deck === d.id && SAVE.known[c.id]).length +
            "/" +
            ALL.filter((c) => c.deck === d.id).length +
            "</small></button>",
        )
        .join("") +
      "</div>";
  h += '<main id="main">' + view() + "</main>";
  document.getElementById("app").innerHTML = h;
  persistUI();
}

ACT.home = () => {
  location.hash = "";
};
ACT.tab = (t) => {
  UI.tab = t.dataset.t;
  UI.run = null;
  stopTM();
  render();
  window.scrollTo(0, 0);
};
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
ACT.resetprog = () => {
  if (!ask("Reset study progress for this unit (got-it marks, trouble terms, finished lessons)?")) return;
  SAVE.known = {};
  SAVE.trouble = {};
  SAVE.done = {};
  SAVE.li = 0;
  UI.L = null;
  save();
  FC = null;
  render();
};
