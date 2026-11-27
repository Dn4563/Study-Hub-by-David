/* Midterm review (#mid): mixed questions from every unit on the midterm, a little each day, with more from the units the
   student is weakest in, and a mock midterm built from the units' practice questions (00-core.js, midData).
   Research behind it: mixing topics and spacing review over days beats cramming one unit at a time, and a practice
   test is one of the best ways to study. Answers here also update each unit's own trouble terms, so the unit's Learn
   and Quiz bring those terms back. The real dates, length and format come from course.json "midterm" (VERIFY until
   the teacher posts them). Saved in SAVE.mid of the midterm page (sk:<course>:mid:kit). */
const MID_MINS = [15, 30, 45, 60];
function midState() {
  if (!SAVE.mid) SAVE.mid = { v: 1, date: null, nodate: false, units: null, mins: null, style: "quiz", check: true, setup: false, hist: {}, days: {}, seed: 1, last: [] };
  return SAVE.mid;
}
const midPicked = () => {
  const M = midState();
  return midUnits().filter((u) => !M.units || !M.units.length || M.units.indexOf(u.id) >= 0);
};
const midShort = (u) => u.label + (u.title && u.title !== u.label ? ": " + u.title : "");
/* Monday of midterm week, from course.json. */
const midWeek = () => {
  if (!MIDCFG || !MIDCFG.week) return null;
  const p = MIDCFG.week.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};
const mdDay = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const mdMonth = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
function midDaysLeft() {
  const M = midState();
  if (!M.date) return null;
  const p = M.date.split("-").map(Number);
  return Math.round((new Date(p[0], p[1] - 1, p[2]) - today0()) / DAY);
}
function midTestLabel() {
  const M = midState(),
    n = midDaysLeft();
  if (M.date && n !== null) {
    if (n < 0) return "";
    const p = M.date.split("-").map(Number);
    return n === 0 ? "Midterm today" : n === 1 ? "Midterm tomorrow" : "Midterm on " + mdDay(new Date(p[0], p[1] - 1, p[2]));
  }
  const w = midWeek();
  return w && today0() - w < 5 * DAY ? "Midterms: week of " + mdMonth(w) : "";
}

/* How strong each unit looks: the last 20 midterm answers on it, plus how many of its terms are marked known. */
function midStrength(u) {
  const M = midState(),
    h = (M.hist[u.id] || []).slice(-20),
    p = unitProgress(u),
    known = p.tot ? p.got / p.tot : 0;
  if (h.length >= 3) return Math.round(100 * (0.7 * (h.reduce((a, b) => a + b, 0) / h.length) + 0.3 * known));
  return known > 0 ? Math.round(100 * known) : null;
}
const midWord = (p) => (p === null ? "Not checked yet" : p >= 85 ? "Strong" : p >= 60 ? "Getting there" : "Needs work");

/* Questions per day from the minutes: about 0.7 a minute, between 10 and 45. */
const midCount = () => Math.min(45, Math.max(10, Math.round((midState().mins || 30) * 0.7)));
/* Weak units get more questions: weight 1 to 3 by strength (not checked counts as halfway), at least 1 each. */
function midAlloc(n) {
  const us = midPicked(),
    w = us.map((u) => {
      const s = midStrength(u);
      return 1 + 2 * (1 - (s === null ? 50 : s) / 100);
    }),
    tot = w.reduce((a, b) => a + b, 0),
    a = w.map((x) => Math.max(1, Math.floor((n * x) / tot))),
    order = w.map((x, i) => i).sort((p, q) => w[q] - w[p]);
  for (let left = n - a.reduce((x, y) => x + y, 0), i = 0; left > 0; left--, i++) a[order[i % order.length]]++;
  return us.map((u, i) => [u, a[i]]);
}
/* Cards for one unit: its trouble terms first, then ones not marked known; none from the last session if avoidable. */
function midPickCards(u, n, avoid) {
  const saved = readJSON(keyOf(u, "kit")) || {},
    tr = saved.trouble || {},
    kn = saved.known || {},
    all = shuf(ALL.filter((c) => c.unit === u.id)),
    rank = (c) => (tr[c.oid] || 0) * 10 + (kn[c.oid] ? 0 : 1);
  const fresh = all.filter((c) => !avoid[c.id]).sort((a, b) => rank(b) - rank(a));
  return fresh.concat(all.filter((c) => avoid[c.id])).slice(0, n);
}
const midQ = (c) => (c.asks && c.asks.length && Math.random() < 0.5 ? askQ(c, c.asks[Math.floor(Math.random() * c.asks.length)]) : mcQ(c));
/* check: the quick check, 3 per unit, not weighted. Otherwise today's session, about 1 in 5 a scenario. */
function midBuild(check) {
  const M = midState(),
    avoid = {};
  (M.last || []).forEach((id) => (avoid[id] = 1));
  const plan = check ? midPicked().map((u) => [u, 3]) : midAlloc(midCount()),
    qs = [],
    cards = [];
  plan.forEach((x) => {
    const u = x[0],
      k = x[1],
      scen = check ? [] : shuf(D.sq.filter((s) => s.unit === u.id)).slice(0, Math.floor(k / 5));
    scen.forEach((s) => qs.push(Object.assign(scQ(s), { unit: u.id })));
    midPickCards(u, k - scen.length, avoid).forEach((c) => {
      cards.push(c);
      qs.push(midQ(c));
    });
  });
  return { qs: shuf(qs), cards: cards };
}
const midUnitOf = (q) => (q.card ? q.card.unit : q.unit);
function midStart(check) {
  const b = midBuild(check);
  if (!b.qs.length) return;
  UI.tab = "mid";
  if (!check && midState().style === "read") {
    UI.midRead = b;
    render();
    window.scrollTo(0, 0);
    return;
  }
  midRun(b.qs, check);
}
function midRun(qs, check) {
  UI.midRead = null;
  startRun({
    title: check ? "Midterm quick check" : "Today's midterm review",
    qs: qs,
    immediate: true,
    retry: !check,
    noSave: true,
    extraHTML: midResHTML,
    onDone: (R) => midDone(R, check),
  });
  window.scrollTo(0, 0);
}
/* A unit's own saved trouble count goes up on a miss and down on a right answer, as in the unit itself. */
function midTrouble(uid, oid, ok) {
  const u = COURSE.units.find((x) => x.id === uid);
  if (!u) return;
  const saved = readJSON(keyOf(u, "kit")) || {};
  saved.trouble = saved.trouble || {};
  if (!ok) saved.trouble[oid] = (saved.trouble[oid] || 0) + 1;
  else if (saved.trouble[oid]) saved.trouble[oid] = Math.max(0, saved.trouble[oid] - 1);
  writeJSON(keyOf(u, "kit"), saved);
}
function midDone(R, check) {
  const M = midState(),
    first = R.res.filter((r) => !r.q.tries);
  first.forEach((r) => {
    const uid = midUnitOf(r.q);
    if (!uid) return;
    const h = (M.hist[uid] = M.hist[uid] || []);
    h.push(r.ok ? 1 : 0);
    if (h.length > 40) h.splice(0, h.length - 40);
    if (r.q.card) midTrouble(uid, r.q.card.oid, r.ok);
  });
  M.last = first.filter((r) => r.q.card).map((r) => r.q.card.id);
  if (check) M.checked = true;
  else {
    const day = isoDay(today0());
    M.days[day] = (M.days[day] || 0) + first.length;
  }
  save();
  render();
}
/* Results by unit, under the runner's score. */
function midResHTML(R) {
  const m = {};
  R.res
    .filter((r) => !r.q.tries)
    .forEach((r) => {
      const k = midUnitOf(r.q);
      if (!k) return;
      m[k] = m[k] || [0, 0];
      m[k][1]++;
      if (r.ok) m[k][0]++;
    });
  const rows = midUnits().filter((u) => m[u.id]);
  if (!rows.length) return "";
  return (
    '<div class="scrollx"><table class="gt breakdown"><tr><th>By unit</th><th>Score</th><th></th></tr>' +
    rows.map((u) => "<tr><td>" + esc(midShort(u)) + "</td><td>" + m[u.id][0] + " of " + m[u.id][1] + "</td><td>" + Math.round((100 * m[u.id][0]) / m[u.id][1]) + "%</td></tr>").join("") +
    "</table></div>"
  );
}

/* The mock midterm's score so far, from the practice-test engine. */
function midMock() {
  const sec = PT.secs[0];
  if (!sec) return null;
  const done = sec.order.filter((id) => frac(sec.byId[id], sec.st[id]) !== null);
  const src = D.practice.sections[0] || {};
  return { n: sec.order.length, none: src.none || [], done: done.length, pct: done.length ? Math.round((100 * done.reduce((a, id) => a + frac(sec.byId[id], sec.st[id]), 0)) / done.length) : 0 };
}
/* Same seed, same mock; a new seed (or other units) builds a different one and clears the old answers. */
function midRebuildMock() {
  try {
    localStorage.removeItem(PTK);
  } catch (e) {}
  D.practice = midData().practice;
  if (PT.iv) clearInterval(PT.iv);
  Object.assign(PT, { sec: 0, secs: [], timerOn: false, elapsed: 0, iv: null, retest: null, msg: "", res: null });
  initPT();
  TABS = [["mid", "Midterm review"]].concat(D.practice.sections.length ? [["exam", "Mock midterm"]] : [], [["set", "Settings"]]);
}

function midHTML() {
  const M = midState(),
    w = midWeek(),
    frU = COURSE.units.filter((u) => UNITDATA[u.id] && UNITDATA[u.id].fr);
  let h = "";
  if (UI.midRead) {
    const b = UI.midRead;
    h +=
      '<section class="panel"><h2>Read these first</h2><p class="muted">The terms in today\'s questions, with the weakest units first. Then answer the questions.</p>' +
      midPicked()
        .map((u) => {
          const cs = b.cards.filter((c) => c.unit === u.id);
          return cs.length ? '<h3 class="midh">' + esc(midShort(u)) + '</h3><dl class="midread">' + cs.map((c) => "<dt>" + esc(c.term) + "</dt><dd>" + esc(c.def) + "</dd>").join("") + "</dl>" : "";
        })
        .join("") +
      '<div class="qnav"><button class="btn" data-act="midq">Start the questions</button><button class="btn ghost" data-act="midback">Back</button></div></section>';
    return h;
  }
  if (!M.setup) {
    h +=
      '<section class="panel midintro"><h2>Get ready for the midterm</h2><p>Mixed questions from every unit, a little each day, with more from the units you\'re weakest in. Then a mock midterm.</p>' +
      (w ? '<p class="muted">Midterms are the week of ' + esc(mdMonth(w)) + ". The exact day, length and format aren't posted yet.</p>" : "") +
      '<div class="qnav"><button class="btn" data-act="midsetup">Set it up (1 minute)</button><button class="btn sec" data-act="midgo">Just start mixed review</button></div></section>';
  } else {
    const n = midDaysLeft(),
      today = M.days[isoDay(today0())] || 0;
    h +=
      '<section class="panel midtoday"><div><h2>Today\'s review</h2><p class="muted">' +
      (n === null ? "" : n < 0 ? "Your midterm date has passed. " : n === 0 ? "Midterm today: a short warm-up. " : plural(n, "day") + " to go. ") +
      plural(midCount(), "question") +
      ", about " +
      (M.mins || 30) +
      " minutes, mixed from " +
      plural(midPicked().length, "unit") +
      ".</p>" +
      (today ? '<p class="midok">' + ICON.check + "Done today: " + plural(today, "question") + ".</p>" : "") +
      '</div><button class="btn" data-act="midgo">' +
      (today ? "Do another round" : "Start today's review") +
      "</button></section>";
  }
  h += '<h2 class="starth">Your units</h2><ul class="midtiles">';
  midUnits().forEach((u) => {
    const on = midPicked().indexOf(u) >= 0,
      s = midStrength(u);
    h +=
      '<li class="midtile' +
      (on ? "" : " off") +
      '"><b>' +
      esc(u.label) +
      "</b>" +
      (u.title && u.title !== u.label ? '<span class="muted">' + esc(u.title) + "</span>" : "") +
      (on
        ? '<span class="midw">' +
          esc(midWord(s)) +
          (s === null ? "" : ", " + s + "%") +
          '</span><span class="bar' +
          (s === null ? "" : s < 60 ? " low" : s < 85 ? " mid" : " high") +
          '" aria-hidden="true"><i style="width:' +
          (s || 0) +
          '%"></i></span>'
        : '<span class="midw">Not on your midterm</span>') +
      '<a class="lnk" href="#' +
      esc(u.id) +
      '">Open ' +
      esc(u.label) +
      "</a></li>";
  });
  h += "</ul>";
  if (!M.checked)
    h +=
      '<p class="midcheck">Not sure where you stand? <button class="btn sec small" data-act="midcheck">Quick check: ' +
      plural(midPicked().length * 3, "question") +
      "</button></p>";
  const mk = midMock();
  if (mk)
    h +=
      '<section class="panel midmock"><div><h2>Mock midterm</h2><p class="muted">' +
      plural(mk.n, "multiple-choice question") +
      " from your units" +
      (mk.none.length ? " (" + esc(mk.none.join(" and ")) + " " + (mk.none.length > 1 ? "have" : "has") + " no multiple choice, so practice " + (mk.none.length > 1 ? "them" : "it") + " in " + (mk.none.length > 1 ? "their units" : "its unit") + ")" : "") +
      ". The real length and format aren't posted yet." +
      (mk.done ? " So far: " + mk.done + " of " + mk.n + " answered, " + mk.pct + "% right." : "") +
      '</p></div><div class="qnav"><button class="btn" data-act="midmock">' +
      (mk.done ? (mk.done < mk.n ? "Continue the mock" : "See the mock") : "Take the mock midterm") +
      "</button>" +
      (mk.done ? '<button class="btn ghost" data-act="midnew">New mock</button>' : "") +
      "</div></section>";
  if (frU.length)
    h +=
      '<p class="muted midfr">Written practice is in its own unit: ' +
      frU.map((u) => '<a class="lnk" href="#' + esc(u.id) + '">' + esc(u.label) + "</a>").join(", ") +
      ".</p>";
  if (M.setup) h += '<div class="startfoot"><button class="btn ghost" data-act="midsetup">Change my setup</button><button class="btn ghost" data-act="midreset">Start over</button></div>';
  return h;
}

const mchip = (k, v, label, on) => '<button class="chip" data-act="midset" data-k="' + esc(k) + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '">' + esc(label) + "</button>";
function midSetup() {
  const M = midState(),
    us = midUnits(),
    w = midWeek(),
    before = JSON.stringify(midPicked().map((u) => u.id));
  if (!M.units) M.units = us.map((u) => u.id);
  openModal({
    title: "Midterm review",
    done: "Save",
    steps: [
      () =>
        "<h2>When is your midterm?</h2>" +
        (w ? '<p class="muted">Midterms are the week of ' + esc(mdMonth(w)) + ". Pick your day if you know it.</p>" : "") +
        '<div class="pldate"><input type="date" data-mid="date" min="' +
        isoDay(today0()) +
        '" value="' +
        esc(M.date || "") +
        '" aria-label="Midterm date"></div><div class="chips">' +
        (w ? [0, 1, 2, 3, 4].map((i) => new Date(w.getTime() + i * DAY)).filter((d) => d >= today0()).map((d) => mchip("date", isoDay(d), mdDay(d), M.date === isoDay(d))).join("") : "") +
        mchip("nodate", "1", "Not sure yet", M.nodate) +
        "</div>",
      () =>
        '<h2>Which units are on it?</h2><p class="muted">Not sure? Keep them all.</p><div class="mopts">' +
        us
          .map((u) => '<button data-act="midset" data-k="unit" data-v="' + esc(u.id) + '" aria-pressed="' + (M.units.indexOf(u.id) >= 0) + '"><b>' + esc(u.label) + "</b>" + (u.title !== u.label ? "<span>" + esc(u.title) + "</span>" : "") + "</button>")
          .join("") +
        "</div>" +
        (M.units.length ? "" : '<p class="hint">Pick at least one unit to go on.</p>'),
      () =>
        '<h2>How much time each day?</h2><div class="chips" role="group" aria-label="Minutes each day">' +
        MID_MINS.map((m) => mchip("mins", m, m + " min", (M.mins || 30) === m)).join("") +
        "</div>",
      () =>
        '<h2>How do you like to study?</h2><div class="mopts">' +
        [
          ["read", "Read first", "See the day's terms, then answer questions on them."],
          ["quiz", "Quiz me first", "Go straight to the questions; each answer shows the definition."],
        ]
          .map((o) => '<button data-act="midset" data-k="style" data-v="' + o[0] + '" aria-pressed="' + (M.style === o[0]) + '"><b>' + o[1] + "</b><span>" + o[2] + "</span></button>")
          .join("") +
        "</div>",
      () =>
        "<h2>Find your weak units?</h2><p>A quick check: 3 questions from each unit (" +
        plural(Math.max(1, M.units.length) * 3, "question") +
        '). Weak units then get more questions each day.</p><div class="chips">' +
        mchip("check", "1", "Yes, do the quick check", M.check !== false) +
        mchip("check", "0", "Skip it", M.check === false) +
        "</div>",
      () =>
        '<h2>Your midterm review</h2><ul class="msum"><li>Midterm<span>' +
        esc(M.date ? midTestLabel() || M.date : w ? "Week of " + mdMonth(w) : "Not set") +
        "</span></li><li>Units<span>" +
        esc(
          us
            .filter((u) => M.units.indexOf(u.id) >= 0)
            .map((u) => u.label)
            .join(", ") || "All",
        ) +
        "</span></li><li>Each day<span>" +
        (M.mins || 30) +
        " minutes, about " +
        plural(midCount(), "question") +
        "</span></li><li>Style<span>" +
        (M.style === "read" ? "Read first" : "Quiz me first") +
        "</span></li><li>Quick check<span>" +
        (M.check !== false ? "First" : "Skipped") +
        "</span></li></ul>",
    ],
    beforeNext: (i) => !(i === 1 && !M.units.length),
    onDone: () => {
      if (!M.mins) M.mins = 30;
      M.setup = true;
      if (JSON.stringify(midPicked().map((u) => u.id)) !== before) midRebuildMock();
      save();
      UI.tab = "mid";
      if (M.check !== false && !M.checked) midStart(true);
      else render();
    },
  });
}
ACT.midsetup = () => midSetup();
ACT.midset = (t) => {
  const M = midState(),
    k = t.dataset.k,
    v = t.dataset.v;
  if (k === "date") Object.assign(M, { date: v, nodate: false });
  else if (k === "nodate") Object.assign(M, { date: null, nodate: true });
  else if (k === "unit") {
    const i = M.units.indexOf(v);
    if (i >= 0) M.units.splice(i, 1);
    else M.units.push(v);
    M.units = midUnits()
      .map((u) => u.id)
      .filter((id) => M.units.indexOf(id) >= 0);
  } else if (k === "mins") M.mins = Number(v);
  else if (k === "style") M.style = v;
  else if (k === "check") M.check = v === "1";
  save();
  modalRender();
};
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!UNIT || !UNIT.mid || !t.matches || !t.matches('[data-mid="date"]')) return;
  Object.assign(midState(), { date: t.value || null, nodate: !t.value });
  save();
  modalRender();
});
ACT.midgo = () => midStart(false);
ACT.midcheck = () => midStart(true);
ACT.midq = () => UI.midRead && midRun(UI.midRead.qs, false);
ACT.midback = () => {
  UI.midRead = null;
  render();
};
ACT.midmock = () => goTool("exam");
ACT.midnew = () =>
  sure("Start a new mock?", "You get different questions, and your answers on this mock are cleared.", "New mock", () => {
    const M = midState();
    M.seed = (M.seed || 1) + 1;
    save();
    midRebuildMock();
    render();
  });
ACT.midreset = () =>
  sure("Start over?", "This clears your midterm setup, unit scores and mock answers. Each unit's own progress stays.", "Start over", () => {
    SAVE.mid = null;
    save();
    midRebuildMock();
    UI.midRead = null;
    render();
  });

/* The row on the course page. */
function midRowHTML() {
  let M = null;
  try {
    M = (JSON.parse(localStorage.getItem("sk:" + COURSE.id + ":mid:kit") || "{}") || {}).mid || null;
  } catch (e) {}
  const w = midWeek(),
    p = M && M.date ? M.date.split("-").map(Number) : null,
    d = p ? new Date(p[0], p[1] - 1, p[2]) : null,
    when = d && d >= today0() ? "Midterm on " + mdDay(d) : w && today0() - w < 5 * DAY ? "Midterms: week of " + mdMonth(w) : "";
  return (
    '<a class="resume midrow" href="#mid"><div><b>Midterm review</b><span class="muted">Mixed questions from ' +
    plural(midUnits().length, "unit") +
    ", weighted to your weak spots, and a mock midterm." +
    (when ? " " + esc(when) + "." : "") +
    '</span></div><span class="btn sec">Open</span></a>'
  );
}
