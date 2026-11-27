/* Study plan: a personal study route for this unit.
   1. Setup: the test date, minutes per day, and how well the student knows each deck (or each section).
   2. Quick check: one question per section (up to 20) on the shared question screen (cross-off, Lock in,
      full explanations), with "I was sure / I guessed" after each right answer and a Skip button.
   3. Each section is labeled Learn, Fix or Polish from the rating, the quick check, saved misses and
      Practice Test results. Nothing decides alone.
   4. A route of steps (with sub-steps) spread over the days until the test. "Start my route" opens each step
      already set up; a bar under the tabs shows the current step on every screen; steps finish on their own
      when the lesson, quiz, flashcard round or practice section is done. Steps can be reordered, removed and
      restored, and the route ends with a re-check that shows before and after. Saved in SAVE.plan. */
const PL_MINS = [15, 30, 60, 90];
const PL_RATE = [
  ["know", "I know it well", "I know it"],
  ["shaky", "It's shaky", "Shaky"],
  ["new", "I haven't learned it", "New to me"],
];
const PL_LABEL = { learn: "Learn", fix: "Fix", polish: "Polish" };
/* "Sections: A, B." without doubling a section name's own question mark. */
const secList = (names) => "Sections: " + names.join(", ") + (/[.?!]$/.test(names[names.length - 1]) ? " " : ". ");
const PL_MAXQ = 20,
  PL_RECHECK = 10,
  DAY = 86400000;

function planState() {
  if (!SAVE.plan || SAVE.plan.v !== 2) SAVE.plan = { v: 2, date: null, nodate: false, mins: null, rate: {}, rateSec: {}, check: {}, route: null, done: {}, recheck: null, on: false, phase: "about" };
  return SAVE.plan;
}
const planDecks = () => D.decks.filter((d) => ALL.some((c) => c.deck === d.id));
function planSecs() {
  const out = [];
  planDecks().forEach((d) =>
    d.sections.forEach((sc, si) => {
      if (sc.cards.length) out.push({ id: sc.key0 || d.id + "." + si, d: d, sc: sc, name: sc.name, cards: sc.cards });
    }),
  );
  return out;
}
const secById = (id) => planSecs().find((s) => s.id === id);
const secRate = (s) => planState().rateSec[s.id] || planState().rate[s.d.id];

/* ---------- dates ---------- */
const today0 = () => {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
};
const isoDay = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dayName = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
/* Days from today until the test: 0 = the test is today. No date counts as a week. */
function daysLeft() {
  const P = planState();
  if (P.nodate || !P.date) return 7;
  const p = P.date.split("-").map(Number),
    t = new Date(p[0], p[1] - 1, p[2]);
  return Math.max(0, Math.round((t - today0()) / DAY));
}
const studyDays = () => Math.max(1, Math.min(14, daysLeft()));
function dateLine() {
  const P = planState(),
    n = daysLeft();
  if (P.nodate || !P.date) return "No test date yet, so the route covers about a week";
  const p = P.date.split("-").map(Number),
    t = new Date(p[0], p[1] - 1, p[2]);
  return n === 0 ? "Your test is today" : n === 1 ? "Your test is tomorrow (" + dayName(t) + ")" : "Your test is in " + n + " days (" + dayName(t) + ")";
}
const budget = () => (planState().mins >= 90 ? 120 : planState().mins || 30);

/* ---------- what each section needs ---------- */
function secHistory(s) {
  const n = s.cards.length,
    trouble = s.cards.filter((c) => SAVE.trouble[c.id] > 0).length;
  return { trouble: trouble, weak: trouble >= Math.max(2, Math.ceil(n * 0.25)) };
}
/* Practice Test and mock topics under 60% (3+ answers), matched to decks the way the Progress tab does. */
function practiceWeak() {
  const T = {};
  PT.secs.forEach((sec) =>
    sec.qs.forEach((q) => {
      const f = frac(q, sec.st[q.id]);
      if (f === null) return;
      const t = (T[topicOf(q)] = T[topicOf(q)] || { n: 0, ok: 0 });
      t.n++;
      t.ok += f;
    }),
  );
  const out = {};
  Object.keys(T).forEach((topic) => {
    const t = T[topic],
      d = reviewDeck(topic);
    if (d && t.n >= 3 && t.ok / t.n < 0.6) out[d.id] = { topic: topic, pct: Math.round((100 * t.ok) / t.n) };
  });
  return out;
}
/* The rating, the quick check (and whether a right answer was a guess), saved misses and practice results all
   count; none decides alone. "I haven't learned it" is always Learn, since a right answer could be luck. */
function secLabel(s, pw) {
  const r = secRate(s),
    c = planState().check[s.id],
    h = secHistory(s),
    p = (pw || practiceWeak())[s.d.id];
  const extra = (h.weak ? " You've missed " + h.trouble + " of its terms before." : "") + (p ? " Practice on " + p.topic + " is at " + p.pct + "%." : "");
  if (r === "new") return { l: "learn", why: "You said you haven't learned it yet" + (c && c.ok ? ", so the right answer may have been a lucky guess." : ".") };
  if (c && c.ok && c.sure && !h.weak && !p) return { l: "polish", why: "Right, and you were sure." };
  if (c && c.ok && !c.sure) return { l: "fix", why: "Right, but you guessed." + extra };
  if (c && c.ok) return { l: "fix", why: "Right on the quick check, but:" + extra };
  if (c && c.ok === false) return r === "know" ? { l: "fix", light: true, why: "You rated it well but missed the quick check: a quick check-in, not a full relearn." + extra } : { l: "fix", why: "It feels shaky and the quick check agreed." + extra };
  if (c && c.ok === null) return { l: "fix", why: "You skipped it on the quick check." + extra };
  if (r === "know" && !h.weak && !p) return { l: "polish", why: "You rated it well (it wasn't in the quick check)." };
  return { l: "fix", why: (r === "know" ? "You rated it well, but:" : "It feels shaky.") + extra };
}

/* ---------- the route ---------- */
const lessonIdx = (id) => LESSONS.findIndex((l) => l.id === id);
const ptIdx = (mode) => PT.secs.map((s, i) => (s.mode === mode ? i : -1)).filter((i) => i >= 0);
function buildRoute() {
  const P = planState(),
    pw = practiceWeak(),
    secs = planSecs().map((s) => Object.assign({ lab: secLabel(s, pw) }, s)),
    left = daysLeft(),
    todayOnly = left === 0;
  const steps = [];
  const L = secs.filter((s) => s.lab.l === "learn"),
    F = secs.filter((s) => s.lab.l === "fix"),
    Po = secs.filter((s) => s.lab.l === "polish");
  /* One Learn step per deck; its sub-steps are the lessons of the sections to learn, in order. */
  planDecks().forEach((d) => {
    const ls = L.filter((s) => s.d.id === d.id);
    if (!ls.length) return;
    const names = ls.map((s) => s.name).join(", ");
    if (todayOnly) {
      steps.push({ key: "skim:" + d.id, kind: "skim", deck: d.id, title: "Skim: " + d.name, why: "The test is today, so don't start new lessons. Read these sections in the Study guide so the main ideas are familiar: " + names + ".", min: 4 * ls.length });
      return;
    }
    const les = LESSONS.filter((l) => ls.some((s) => s.id === l.sec));
    /* A deck with more lessons than fit in one day's time is split into day-sized parts. */
    const per = Math.max(2, Math.floor(budget() / 12)),
      parts = Math.ceil(les.length / per);
    for (let k = 0; k < parts; k++) {
      const chunk = les.slice(k * per, (k + 1) * per),
        cs = ls.filter((s) => chunk.some((l) => l.sec === s.id));
      steps.push({
        key: "learn:" + d.id + (parts > 1 ? ":" + k : ""),
        kind: "learn",
        title: "Learn: " + d.name + (parts > 1 ? " (part " + (k + 1) + " of " + parts + ")" : ""),
        why: secList(cs.map((s) => s.name)) + "Work through the lessons in order and read each \"Read this first\" box before the terms.",
        min: Math.max(6, chunk.length * 6),
        subs: chunk.map((l) => ({ key: "lesson:" + l.id, kind: "lesson", lesson: l.id, label: l.title })),
      });
    }
  });
  planDecks().forEach((d) => {
    const fs = F.filter((s) => s.d.id === d.id);
    if (!fs.length) return;
    const light = fs.every((s) => s.lab.light),
      cards = [].concat(...fs.map((s) => s.cards.map((c) => c.id)));
    const subs = [{ key: "fixq:" + d.id, kind: "quiz", cards: cards, label: "Quiz on " + (fs.length === 1 ? fs[0].name : fs.length + " sections") + ", with every explanation" }];
    if (!light) subs.push({ key: "fixf:" + d.id, kind: "flash", cards: cards, label: "Flashcards on the terms you miss" });
    const names = secList(fs.map((s) => s.name));
    steps.push({ key: "fix:" + d.id, kind: "fix", title: "Fix: " + d.name, why: names + (light ? "A quick check-in: a short Quiz, reading why any misses are wrong." : "A short Quiz on just these sections, then Flashcards on what you missed."), min: light ? 5 : 12, subs: subs });
  });
  /* Practice: a section for each weak practice topic, otherwise the first practice section. */
  const pi = ptIdx("practice");
  if (pi.length && !todayOnly) {
    const want = new Set();
    Object.keys(pw).forEach((dk) => {
      const topic = pw[dk].topic,
        best = pi.map((i) => ({ i: i, n: PT.secs[i].qs.filter((q) => topicOf(q) === topic).length })).sort((a, b) => b.n - a.n)[0];
      if (best && best.n) want.add(best.i);
    });
    if (!want.size) want.add(pi[0]);
    want.forEach((i) => steps.push({ key: "pt:" + i, kind: "pt", sec: i, title: "Practice Test: " + PT.secs[i].name, why: "Questions in your test's format. Check each one and read why the wrong answers are wrong.", min: 12 }));
  }
  if (Po.length) steps.push({ key: "polish", kind: "polish", cards: [].concat(...Po.map((s) => s.cards.map((c) => c.id))), title: "Polish: " + plural(Po.length, "section") + " you know", why: secList(Po.map((s) => s.name)) + "A quick mixed Quiz to keep these sharp. Don't spend long here.", min: 5 });
  const ei = ptIdx("exam");
  if (ei.length && !todayOnly && (left > 1 || P.mins >= 60))
    steps.push({ key: "exam", kind: "exam", sec: ei[0], final: true, title: "Full mock test, timed", why: "Turn the Timer on, leave Shuffle off, and don't look anything up. Afterward, use Retest missed questions.", min: Math.min(45, Math.max(20, ei.reduce((n, i) => n + PT.secs[i].qs.length, 0))) });
  steps.push({ key: "cheat", kind: "cheat", final: true, title: left <= 1 ? "Cheat sheet, then stop" : "Read the Cheat sheet", why: left <= 1 ? "Read it once, then stop new material. Sleep is when it sticks." : "The whole unit on one page. Notice anything that still looks unfamiliar.", min: 5 });
  steps.push({ key: "recheck", kind: "recheck", final: true, title: "Re-check: how much you've improved", why: "One question on each section you were learning or fixing, then a before-and-after.", min: 6 });
  P.route = { steps: steps, removed: [], built: isoDay(today0()) };
  P.done = {};
  P.recheck = null;
}
/* ---------- done state, mostly worked out from what the student actually did ---------- */
function subDone(sub) {
  if (sub.kind === "lesson") return !!SAVE.done[sub.lesson];
  return !!planState().done[sub.key];
}
function stepDone(st) {
  const P = planState();
  if (P.done[st.key]) return true;
  if (st.subs && st.subs.length) return st.subs.every(subDone);
  if (st.kind === "pt" || st.kind === "exam") {
    const secs = st.kind === "exam" ? ptIdx("exam") : [st.sec];
    return secs.every((i) => PT.secs[i] && PT.secs[i].qs.every((q) => frac(q, PT.secs[i].st[q.id]) !== null));
  }
  if (st.kind === "recheck") return !!(P.recheck && P.recheck.after);
  return false;
}
function planMarkDone(key) {
  const P = planState();
  if (!P.route) return;
  P.done[key] = true;
  save();
}
function activeSteps() {
  const P = planState();
  return P.route ? P.route.steps.filter((s) => P.route.removed.indexOf(s.key) < 0) : [];
}
/* Spread the steps that aren't done over the days left. The mock test, Cheat sheet and re-check go on the
   last day; everything else fills each day up to the minutes chosen, in route order. */
function schedule() {
  const n = studyDays(),
    left = activeSteps().filter((s) => !stepDone(s)),
    fin = left.filter((s) => s.final),
    rest = left.filter((s) => !s.final),
    days = [];
  for (let i = 0; i < n; i++) days.push({ i: i, steps: [], min: 0 });
  const cap = budget(),
    finMin = fin.reduce((m, s) => m + s.min, 0);
  let d = 0;
  rest.forEach((s) => {
    const room = (i) => cap - (i === n - 1 ? finMin : 0) - days[i].min;
    while (d < n - 1 && days[d].steps.length && s.min > room(d)) d++;
    days[d].steps.push(s);
    days[d].min += s.min;
  });
  fin.forEach((s) => {
    days[n - 1].steps.push(s);
    days[n - 1].min += s.min;
  });
  return days;
}
function currentStep() {
  for (const day of schedule()) if (day.steps.length) return day.steps[0];
  return null;
}
const stepNo = (st) => activeSteps().indexOf(st) + 1;

/* ---------- going to a step ---------- */
function routeQuiz(title, ids, n, key) {
  const cards = shuf(ids.map((id) => BYID[id]).filter(Boolean)).slice(0, n);
  const qs = cards.map((c) => (c.asks && c.asks.length ? askQ(c, c.asks[Math.floor(Math.random() * c.asks.length)]) : mcQ(c)));
  UI.tab = "quiz";
  startRun({ title: title, qs: qs, immediate: true, timer: 0, retry: true, breakdown: true, routeKey: key });
  window.scrollTo(0, 0);
}
function planGo(st, sub) {
  const P = planState();
  P.on = true;
  UI.run = null;
  stopTM();
  sub = sub || (st.subs ? st.subs.find((x) => !subDone(x)) || st.subs[0] : null);
  const k = sub ? sub.kind : st.kind;
  if (k === "lesson") {
    UI.tab = "learn";
    save();
    return startLesson(lessonIdx(sub.lesson));
  }
  if (k === "quiz") return routeQuiz(st.title, sub.cards, 8, sub.key);
  if (st.kind === "polish") return routeQuiz(st.title, st.cards, 6, st.key);
  if (k === "flash") {
    UI.tab = "flash";
    UI.deck = 0;
    SAVE.settings.fcMode = "sort";
    const missed = sub.cards.filter((id) => SAVE.trouble[id] > 0);
    fcBuild(missed.length ? missed : sub.cards);
    FC.route = sub.key;
  } else if (k === "skim") {
    UI.tab = "guide";
    UI.deck = st.deck;
    P.done[st.key] = true;
  } else if (k === "pt" || k === "exam") {
    UI.tab = k;
    PT.res = null;
    PT.sec = st.sec;
  } else if (k === "cheat") {
    UI.tab = D.cheat && D.cheat.length ? "cheat" : "guide";
    UI.deck = 0;
    P.done[st.key] = true;
  } else if (k === "recheck") {
    UI.tab = "plan";
    save();
    return startRecheck();
  }
  save();
  render();
  window.scrollTo(0, 0);
}

/* ---------- quick check and re-check (the shared question screen) ---------- */
function checkQ(s) {
  const withAsk = s.cards.filter((c) => c.asks && c.asks.length),
    pool = withAsk.length ? withAsk : s.cards,
    c = pool[Math.floor(Math.random() * pool.length)];
  const q = c.asks && c.asks.length ? askQ(c, c.asks[Math.floor(Math.random() * c.asks.length)]) : mcQ(c, "d2t");
  q.ask = "Checking: " + s.d.name + ", " + s.name;
  q.secId = s.id;
  return q;
}
/* Up to PL_MAXQ sections: spread evenly over the decks, sections with no saved history first. */
function checkSecs() {
  const all = planSecs();
  if (all.length <= PL_MAXQ) return all;
  const byDeck = planDecks().map((d) => all.filter((s) => s.d.id === d.id).sort((a, b) => secHistory(a).trouble - secHistory(b).trouble));
  const out = [];
  for (let r = 0; out.length < PL_MAXQ; r++) byDeck.forEach((list) => list[r] && out.length < PL_MAXQ && out.push(list[r]));
  return all.filter((s) => out.indexOf(s) >= 0);
}
function startCheck() {
  const P = planState();
  UI.tab = "plan";
  startRun({
    title: "Quick check",
    qs: checkSecs().map(checkQ),
    immediate: true,
    timer: 0,
    retry: false,
    noSave: true,
    skip: true,
    sure: true,
    doneLabel: "See my plan",
    onDone: (R) => {
      P.check = {};
      R.res.forEach((r) => (P.check[r.q.secId] = { ok: r.skipped ? null : r.ok, sure: r.ok ? r.sure === true : false }));
      P.phase = "plan";
      buildRoute();
      UI.run = null;
      save();
      render();
      window.scrollTo(0, 0);
    },
  });
  window.scrollTo(0, 0);
}
function startRecheck() {
  const P = planState(),
    ids = activeSteps()
      .filter((s) => s.kind === "learn" || s.kind === "fix" || s.kind === "skim")
      .map((s) => planSecs().filter((x) => String(x.d.id) === s.key.split(":")[1] && secLabel(x).l === (s.kind === "fix" ? "fix" : "learn")))
      .reduce((a, b) => a.concat(b), [])
      .filter((x, i, arr) => x && arr.indexOf(x) === i)
      .slice(0, PL_RECHECK);
  const secs = ids.length ? ids : planSecs().slice(0, PL_RECHECK);
  const before = secs.filter((s) => P.check[s.id] && P.check[s.id].ok && P.check[s.id].sure).length;
  startRun({
    title: "Re-check",
    qs: secs.map(checkQ),
    immediate: true,
    timer: 0,
    retry: false,
    noSave: true,
    skip: true,
    sure: true,
    doneLabel: "See how you did",
    onDone: (R) => {
      const after = R.res.filter((r) => r.ok && r.sure).length;
      R.res.forEach((r) => (P.check[r.q.secId] = { ok: r.ok, sure: r.ok ? r.sure === true : false }));
      P.recheck = { n: secs.length, before: before, after: after, still: R.res.filter((r) => !(r.ok && r.sure)).map((r) => r.q.secId) };
      UI.run = null;
      save();
      render();
      window.scrollTo(0, 0);
    },
  });
  window.scrollTo(0, 0);
}

/* ---------- views ---------- */
function planHTML() {
  if (UI.run) return runHTML();
  const P = planState();
  if (UI.planEdit || P.phase !== "plan" || !P.route) return planAboutHTML();
  return planMapHTML();
}
const pchip = (k, v, label, on) => '<button class="chip" data-act="plset" data-k="' + esc(k) + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '">' + esc(label) + "</button>";
/* Setup is a step-by-step pop-up (planWizard); this page only offers it, or shows the route once there is one. */
function planAboutHTML() {
  const P = planState();
  return (
    '<section class="panel plan"><h2>I have a few days</h2><p class="lead">Answer a few quick questions (about a minute) and get a plan spread over the days before your test, with a little each day. Each step opens the right tool for you.</p>' +
    '<div class="qnav"><button class="btn" data-act="plwiz">' +
    (P.route ? "Change my answers" : "Make my plan") +
    "</button>" +
    (P.route ? '<button class="btn sec" data-act="plback">Back to my route</button>' : "") +
    "</div></section>"
  );
}
/* The test date shown in the unit header: "Test on Thu, Dec 3" until the day (from the Study plan). */
function planTestLabel() {
  const P = SAVE && SAVE.plan;
  if (!P || P.nodate || !P.date) return "";
  const n = daysLeft();
  if (n < 0) return "";
  const p = P.date.split("-").map(Number),
    t = new Date(p[0], p[1] - 1, p[2]);
  if (t < today0()) return "";
  return n === 0 ? "Test today" : n === 1 ? "Test tomorrow" : "Test on " + t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function planWizard() {
  const P = planState(),
    ds = planDecks();
  if (P.style === undefined) P.style = "read";
  if (P.wcheck === undefined) P.wcheck = true;
  UI.planEdit = false;
  openModal({
    title: "Study plan",
    done: "Make my plan",
    steps: [
      () =>
        '<h2>When is your test?</h2><div class="pldate"><input type="date" data-plan="date" min="' +
        isoDay(today0()) +
        '" value="' +
        esc(P.date || "") +
        '" aria-label="Test date"></div><div class="chips">' +
        pchip("tomorrow", "1", "Tomorrow", P.date === isoDay(new Date(today0().getTime() + DAY)) && !P.nodate) +
        pchip("today", "1", "It's today", P.date === isoDay(today0()) && !P.nodate) +
        pchip("nodate", "1", "Not sure yet", P.nodate) +
        "</div>" +
        (P.date || P.nodate ? '<p class="hint">' + esc(dateLine()) + ".</p>" : ""),
      () =>
        '<h2>How much time can you study each day?</h2><div class="chips" role="group" aria-label="Minutes each day">' +
        PL_MINS.map((m) => pchip("mins", m, m === 90 ? "90+ min" : m + " min", P.mins === m)).join("") +
        "</div>",
      () =>
        '<h2>How do you like to study?</h2><div class="mopts">' +
        [
          ["read", "Read first", "See a few terms, then answer questions on them."],
          ["quiz", "Quiz me first", "Try the questions first, then see the answers."],
        ]
          .map((o) => '<button data-act="plset" data-k="style" data-v="' + o[0] + '" aria-pressed="' + (P.style === o[0]) + '"><b>' + o[1] + "</b><span>" + o[2] + "</span></button>")
          .join("") +
        "</div>",
      () =>
        '<h2>How well do you know each part?</h2><p class="muted">One tap per deck, or skip this step: anything you skip counts as shaky.</p><div class="plrate">' +
        ds
          .map(
            (d) =>
              '<div class="plrow"><span class="pld">' +
              dot(d.id) +
              esc(d.name) +
              '</span><span class="chips" role="group" aria-label="' +
              esc(d.name) +
              '">' +
              PL_RATE.map((r) => pchip("r:" + d.id, r[0], r[2] || r[1], P.rate[d.id] === r[0])).join("") +
              "</span></div>",
          )
          .join("") +
        "</div>",
      () =>
        '<h2>Find your weak spots?</h2><p>A short quick check: one question per section (' +
        plural(checkSecs().length, "question") +
        '). It makes the plan fit you better.</p><div class="chips">' +
        pchip("wcheck", "1", "Yes, do the quick check", P.wcheck) +
        pchip("wcheck", "0", "Skip it", !P.wcheck) +
        "</div>",
      () => {
        const sg = focusSuggest();
        return (
          '<h2>Focus timer?</h2><p class="muted">Work, then a short break. Suggested for ' +
          (P.mins || 30) +
          " minutes a day: <b>" +
          sg[0] +
          " + " +
          sg[1] +
          '</b>. You can turn it on or off any time from Start.</p><div class="chips">' +
          pchip("ftimer", "off", "Off", !P.ftimer || P.ftimer === "off") +
          pchip("ftimer", "25", "25 min + 5 break", P.ftimer === "25") +
          pchip("ftimer", "50", "50 min + 10 break", P.ftimer === "50") +
          "</div>"
        );
      },
      () =>
        '<h2>Your plan</h2><ul class="msum"><li>Test<span>' +
        esc(P.date || P.nodate ? dateLine() : "Not set (counts as a week)") +
        "</span></li><li>Each day<span>" +
        (P.mins ? (P.mins === 90 ? "90+" : P.mins) + " minutes" : "30 minutes") +
        "</span></li><li>Style<span>" +
        (P.style === "quiz" ? "Quiz me first" : "Read first") +
        "</span></li><li>Decks rated<span>" +
        ds.filter((d) => P.rate[d.id]).length +
        " of " +
        ds.length +
        "</span></li><li>Quick check<span>" +
        (P.wcheck ? plural(checkSecs().length, "question") + " first" : "Skipped") +
        "</span></li><li>Focus timer<span>" +
        (!P.ftimer || P.ftimer === "off" ? "Off" : P.ftimer === "50" ? "50 + 10" : "25 + 5") +
        '</span></li></ul><p class="muted">You can change any answer later, and skip, move or swap any step in the plan.</p>',
    ],
    onDone: () => {
      if (!P.date && !P.nodate) P.nodate = true;
      if (!P.mins) P.mins = 30;
      ds.forEach((d) => {
        if (!P.rate[d.id] && !planSecs().filter((s) => s.d.id === d.id).every((s) => P.rateSec[s.id])) P.rate[d.id] = "shaky";
      });
      if (P.ftimer === "25") focusStart(25, 5);
      else if (P.ftimer === "50") focusStart(50, 10);
      save();
      UI.tab = "plan";
      UI.last.start = "plan";
      if (P.wcheck) startCheck();
      else {
        P.phase = "plan";
        buildRoute();
        save();
        render();
        window.scrollTo(0, 0);
      }
    },
  });
}
ACT.plwiz = () => planWizard();
ACT.plstart = () => {
  const P = SAVE.plan;
  if (P && P.route) return goTool("plan");
  goTool("plan");
  planWizard();
};
function standHTML() {
  const pw = practiceWeak();
  let h = '<details class="plstand"><summary>Where you stand, section by section</summary>';
  planDecks().forEach((d) => {
    h += '<div class="pldeck"><h4>' + dot(d.id) + esc(d.name) + "</h4>";
    planSecs()
      .filter((s) => s.d.id === d.id)
      .forEach((s) => {
        const lab = secLabel(s, pw);
        h += '<div class="plrow sub"><span class="pld">' + esc(s.name) + '</span><span class="pltag ' + lab.l + '">' + PL_LABEL[lab.l] + (lab.light ? " (quick)" : "") + '</span><span class="plwhy">' + esc(lab.why) + "</span></div>";
      });
    h += "</div>";
  });
  return h + "</details>";
}
function stepHTML(st, n) {
  const done = stepDone(st),
    cur = currentStep() === st;
  let h =
    '<li class="plstep' +
    (done ? " done" : "") +
    (cur ? " cur" : "") +
    '"><div class="plsh"><span class="pln">' +
    (done ? ICON.check : n) +
    '</span><div class="plst"><b>' +
    esc(st.title) +
    '</b><span class="plmeta">About ' +
    st.min +
    " minutes" +
    (done ? ", done" : cur ? ", up next" : "") +
    "</span><p>" +
    esc(st.why) +
    "</p>";
  if (st.subs && st.subs.length > 1)
    h +=
      '<ul class="plsubs">' +
      st.subs
        .map(
          (sb, i) =>
            '<li class="' +
            (subDone(sb) ? "done" : "") +
            '"><button class="lnk" data-act="plgo" data-k="' +
            esc(st.key) +
            '" data-s="' +
            i +
            '">' +
            (subDone(sb) ? ICON.check : "") +
            esc(sb.label) +
            "</button></li>",
        )
        .join("") +
      "</ul>";
  h +=
    '</div></div><div class="plctl"><button class="btn ' +
    (cur ? "" : "sec ") +
    'small" data-act="plgo" data-k="' +
    esc(st.key) +
    '">' +
    (done ? "Open again" : cur ? "Go" : "Open") +
    '</button><span class="pllinks"><button class="lnk" data-act="plmove" data-k="' +
    esc(st.key) +
    '" data-v="-1" aria-label="Move ' +
    esc(st.title) +
    ' up">Up</button><button class="lnk" data-act="plmove" data-k="' +
    esc(st.key) +
    '" data-v="1" aria-label="Move ' +
    esc(st.title) +
    ' down">Down</button>' +
    (done ? "" : '<button class="lnk" data-act="pltick" data-k="' + esc(st.key) + '">Mark done</button>') +
    '<button class="lnk" data-act="plremove" data-k="' +
    esc(st.key) +
    '">Remove</button></span></div></li>';
  return h;
}
function planMapHTML() {
  const P = planState(),
    days = schedule(),
    steps = activeSteps(),
    finished = steps.filter(stepDone),
    cur = currentStep();
  let h = '<section class="panel plan"><div class="rtop"><h2>Your study route</h2><span class="muted">' + esc(dateLine()) + ", " + (P.mins >= 90 ? "90+" : P.mins) + " minutes a day</span></div>";
  h +=
    '<div class="qnav">' +
    (cur ? '<button class="btn" data-act="plgo" data-k="' + esc(cur.key) + '">' + (finished.length ? "Continue my route" : "Start my route") + "</button>" : "") +
    '<button class="btn sec" data-act="pledit">Change my answers</button><button class="btn ghost" data-act="plcheck">Redo the quick check</button></div>';
  if (P.recheck && P.recheck.after !== undefined) {
    h +=
      '<div class="recheck"><h3>Re-check</h3><p class="big">' +
      P.recheck.before +
      " of " +
      P.recheck.n +
      " → " +
      P.recheck.after +
      " of " +
      P.recheck.n +
      '</p><p class="muted">Sections answered right and sure, before the route and now.' +
      (P.recheck.still.length ? " Still worth another look: " + esc(P.recheck.still.map((id) => (secById(id) || { name: id }).name).join(", ")) + ". Press Rebuild to make a route for just those." : " Everything you worked on is solid now.") +
      '</p><button class="btn sec small" data-act="plrebuild">Rebuild from my results</button></div>';
  }
  h += standHTML();
  h += '<h3>The route</h3><p class="hint">Steps tick themselves off when you finish the lesson, quiz, flashcards or practice section. Tap any step or part to jump to it. Use Up, Down and Remove to change the order.</p>';
  let n = 0;
  days.forEach((day) => {
    if (!day.steps.length) return;
    const dt = new Date(today0().getTime() + day.i * DAY);
    h += '<div class="plday"><h4>' + (day.i === 0 ? "Today" : "Day " + (day.i + 1)) + ", " + esc(dayName(dt)) + '<span class="muted"> (about ' + day.min + " min)</span></h4>";
    if (day.min > budget() + 10)
      h += '<p class="hint plover">That\'s more than your ' + (P.mins >= 90 ? "90+" : P.mins) + " minutes. Choose more time each day (Change my answers), or remove a step you can skip.</p>";
    h += '<ol class="plsteps">';
    day.steps.forEach((st) => (h += stepHTML(st, stepNo(st))));
    h += "</ol></div>";
    n += day.steps.length;
  });
  if (!n) h += '<p class="big">Every step is done.</p>';
  if (finished.length) h += '<details class="pldone"><summary>Finished (' + finished.length + ')</summary><ol class="plsteps">' + finished.map((st) => stepHTML(st, stepNo(st))).join("") + "</ol></details>";
  if (P.route.removed.length)
    h +=
      '<h4>Removed steps</h4><ul class="plremoved">' +
      P.route.removed
        .map((k) => {
          const st = P.route.steps.find((s) => s.key === k);
          return st ? "<li>" + esc(st.title) + ' <button class="lnk" data-act="plrestore" data-k="' + esc(k) + '">Put it back</button></li>' : "";
        })
        .join("") +
      "</ul>";
  h +=
    '<h3>How to study well</h3><ul class="pltips"><li>Test yourself instead of rereading. Answering questions is what makes it stick.</li><li>After every miss, read why the right answer is right and why yours was wrong.</li>' +
    (daysLeft() <= 1 ? "<li>Sleep matters more than one more hour of cramming. Stop new material about an hour before bed.</li>" : "<li>Short sessions on several days beat one long session.</li>") +
    '</ul><div class="qnav"><button class="btn ghost" data-act="plrebuild">Rebuild from my results</button></div>';
  return h + "</section>";
}
/* The bar under the tabs on every screen while the route is on. */
function planBarHTML() {
  const P = SAVE.plan;
  if (!P || P.v !== 2 || !P.on || !P.route || UI.tab === "plan") return "";
  const cur = currentStep(),
    total = activeSteps().length;
  if (!cur) return '<div class="routebar"><span>Your study route is done.</span><button class="lnk" data-act="plmap">Route map</button></div>';
  const todayLeft = schedule()[0].steps.length;
  return (
    '<div class="routebar" role="region" aria-label="Study route"><span class="rbt">' +
    (todayLeft ? "" : "Today's steps are done. Next: ") +
    "Step " +
    stepNo(cur) +
    " of " +
    total +
    ": <b>" +
    esc(cur.title) +
    '</b></span><span class="rbb"><button class="btn small" data-act="plgo" data-k="' +
    esc(cur.key) +
    '">' +
    (todayLeft ? "Go to it" : "Start it early") +
    '</button><button class="btn sec small" data-act="plmap">Route map</button><button class="lnk" data-act="plpause" aria-label="Hide the route bar">Hide</button></span></div>'
  );
}

/* ---------- actions ---------- */
ACT.plset = (t) => {
  const P = planState(),
    k = t.dataset.k,
    v = t.dataset.v;
  if (k === "mins") P.mins = Number(v);
  else if (k === "style") P.style = v;
  else if (k === "wcheck") P.wcheck = v === "1";
  else if (k === "ftimer") P.ftimer = v;
  else if (k === "tomorrow") {
    P.date = isoDay(new Date(today0().getTime() + DAY));
    P.nodate = false;
  } else if (k === "today") {
    P.date = isoDay(today0());
    P.nodate = false;
  } else if (k === "nodate") {
    P.nodate = !P.nodate;
    if (P.nodate) P.date = null;
  } else if (k.indexOf("r:") === 0) {
    const d = D.decks.find((x) => String(x.id) === k.slice(2));
    if (d) {
      P.rate[d.id] = v;
      planSecs()
        .filter((s) => s.d.id === d.id)
        .forEach((s) => delete P.rateSec[s.id]);
    }
  } else if (k.indexOf("s:") === 0) P.rateSec[k.slice(2)] = v;
  save();
  render();
};
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t || !t.dataset || t.dataset.plan !== "date") return;
  const P = planState();
  P.date = t.value || null;
  if (P.date) P.nodate = false;
  save();
  render();
});
ACT.plopen = (t) => {
  UI.planOpen = UI.planOpen || {};
  UI.planOpen[t.dataset.d] = !UI.planOpen[t.dataset.d];
  render();
};
ACT.plcheck = () => {
  UI.planEdit = false;
  startCheck();
};
ACT.pledit = () => planWizard();
ACT.plback = () => {
  UI.planEdit = false;
  render();
};
ACT.plrebuild = () => {
  buildRoute();
  save();
  render();
};
const findStep = (k) => (planState().route ? planState().route.steps.find((s) => s.key === k) : null);
ACT.plgo = (t) => {
  const st = findStep(t.dataset.k);
  if (st) planGo(st, t.dataset.s !== undefined && st.subs ? st.subs[Number(t.dataset.s)] : null);
};
ACT.plmove = (t) => {
  const P = planState(),
    a = P.route.steps,
    i = a.findIndex((s) => s.key === t.dataset.k),
    dir = Number(t.dataset.v);
  /* Move past removed steps so one press always moves one visible place. */
  let j = i + dir;
  while (j >= 0 && j < a.length && P.route.removed.indexOf(a[j].key) >= 0) j += dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  const s = a.splice(i, 1)[0];
  a.splice(j, 0, s);
  if (s.final && dir < 0) s.final = false; /* moved earlier by the student: no longer pinned to the last day */
  save();
  render();
};
ACT.plremove = (t) => {
  const P = planState();
  if (P.route.removed.indexOf(t.dataset.k) < 0) P.route.removed.push(t.dataset.k);
  save();
  render();
};
ACT.plrestore = (t) => {
  const P = planState();
  P.route.removed = P.route.removed.filter((k) => k !== t.dataset.k);
  save();
  render();
};
ACT.pltick = (t) => {
  planMarkDone(t.dataset.k);
  render();
};
ACT.plmap = () => {
  UI.run = null;
  stopTM();
  UI.tab = "plan";
  UI.planEdit = false;
  render();
  window.scrollTo(0, 0);
};
ACT.plpause = () => {
  planState().on = false;
  save();
  render();
};
