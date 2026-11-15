/* Study plan: a personal, step-by-step plan for this unit. The student says when the test is, how much time
   they have and how well they know each deck; a short quick check (one question per deck) and their saved
   progress refine that. Each deck becomes Learn, Fix or Polish, and the plan lists timed steps whose buttons
   open the right tool (Learn, Flashcards, Quiz, Practice Test, exam, Cheat sheet). Saved in SAVE.plan. */
const PL_WHEN = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["days", "In 2–3 days"],
  ["week", "A week or more"],
];
const PL_MINS = [15, 30, 60, 90];
const PL_RATE = [
  ["know", "I know it well"],
  ["shaky", "It's shaky"],
  ["new", "I haven't learned it"],
];
const PL_LABEL = { learn: "Learn", fix: "Fix", polish: "Polish" };

function planState() {
  if (!SAVE.plan || typeof SAVE.plan !== "object") SAVE.plan = { when: null, mins: null, rate: {}, check: {}, done: {}, phase: "about" };
  const P = SAVE.plan;
  P.rate = P.rate || {};
  P.check = P.check || {};
  P.done = P.done || {};
  P.phase = P.phase || "about";
  return P;
}
const planDecks = () => D.decks.filter((d) => ALL.some((c) => c.deck === d.id));

/* What the saved progress says about a deck: share of terms with a miss on record, share marked Got it. */
function deckHistory(d) {
  const cards = ALL.filter((c) => c.deck === d.id),
    n = cards.length || 1;
  const trouble = cards.filter((c) => SAVE.trouble[c.id] > 0).length,
    known = cards.filter((c) => SAVE.known[c.id]).length;
  return { n: cards.length, trouble: trouble, known: known, weak: trouble >= Math.max(2, Math.ceil(n * 0.2)) };
}
/* Neither the rating nor one quiz answer decides alone:
   - "I haven't learned it" is always Learn (a right answer could be a lucky guess);
   - a miss on the quick check means Fix, but only a quick check-in when the student rated it "know it";
   - a right answer is Polish unless the saved history shows repeated misses. */
function deckLabel(d) {
  const P = planState(),
    r = P.rate[d.id],
    q = P.check[d.id],
    h = deckHistory(d);
  if (r === "new") return { l: "learn", why: "You said you haven't learned it yet" + (q === true ? " (the quick-check answer may have been a lucky guess)." : ".") };
  if (q === true && !h.weak) return { l: "polish", why: r === "know" ? "You know it and got the quick check right." : "You got the quick check right, so it's closer than it feels." };
  if (q === true && h.weak) return { l: "fix", why: "Right on the quick check, but you've missed " + h.trouble + " of its terms before." };
  if (r === "know") return { l: "fix", light: true, why: "You rated it well but missed the quick check: one quick check-in, not a full relearn." };
  return { l: "fix", why: q === false ? "It feels shaky and the quick check agreed." : "It feels shaky and you skipped the quick check." };
}

/* ---------- step builders: each returns {key, min, title, why, go} ---------- */
function lessonFor(d) {
  let i = LESSONS.findIndex((l) => l.deck === d.id && !SAVE.done[l.id]);
  if (i < 0) i = LESSONS.findIndex((l) => l.deck === d.id);
  return i;
}
const deckLessons = (d) => LESSONS.filter((l) => l.deck === d.id && !SAVE.done[l.id]).length || LESSONS.filter((l) => l.deck === d.id).length;
const ptIdx = (mode) => PT.secs.map((s, i) => (s.mode === mode ? i : -1)).filter((i) => i >= 0);
function stepsFor(when, labs) {
  const L = labs.filter((x) => x.lab.l === "learn").map((x) => x.d),
    F = labs.filter((x) => x.lab.l === "fix").map((x) => x.d),
    Po = labs.filter((x) => x.lab.l === "polish").map((x) => x.d);
  const names = (ds) => ds.map((d) => d.name).join(", ");
  const hasTrouble = ALL.some((c) => SAVE.trouble[c.id] > 0);
  const cheat = D.cheat && D.cheat.length;
  const S = [];
  const learnStep = (d) => ({
    key: "learn:" + d.id,
    min: Math.min(60, deckLessons(d) * 6),
    title: "Learn: " + d.name,
    why: "Work through its Learn lessons in order (about 6 minutes each). Read the \"Read this first\" box before the terms.",
    go: { t: "learn", i: lessonFor(d), label: "Open Learn" },
  });
  const skimStep = (d) => ({
    key: "skim:" + d.id,
    min: 4,
    title: "Skim the big picture: " + d.name,
    why: "No time to learn it fully today. Read this deck's summaries in the Study guide so the main ideas are familiar.",
    go: { t: "guide", d: d.id, label: "Open Study guide" },
  });
  const fixStep = (ds) => ({
    key: "fix:" + ds.map((d) => d.id).join(","),
    min: Math.max(8, ds.length * 6),
    title: "Fix: " + names(ds),
    why: "A short Quiz on just these decks. Read every explanation for the ones you miss, then do the Flashcards step.",
    go: { t: "quiz", decks: ds.map((d) => d.id), label: "Start the Quiz" },
  });
  const flashStep = (min) => ({
    key: "flash",
    min: min,
    title: hasTrouble ? "Flashcards: your trouble terms" : "Flashcards: terms you haven't marked Got it",
    why: "Say the answer out loud before you flip. Mark Not yet honestly; those come back.",
    go: { t: "flash", pool: hasTrouble ? "trouble" : "unknown", label: "Open Flashcards" },
  });
  const polishStep = (ds) => ({
    key: "polish",
    min: 5,
    title: "Polish: " + names(ds),
    why: "A quick mixed Quiz to keep these sharp. Don't spend long here.",
    go: { t: "quiz", decks: ds.map((d) => d.id), label: "Start the Quiz" },
  });
  const pi = ptIdx("practice"),
    ei = ptIdx("exam");
  const practiceStep = () =>
    pi.length && {
      key: "pt",
      min: 12,
      title: "Practice Test: " + PT.secs[pi[0]].name,
      why: "Questions in the format of your test. Check each one and read why the wrong answers are wrong.",
      go: { t: "pt", sec: pi[0], label: "Open Practice Test" },
    };
  const examStep = () =>
    ei.length && {
      key: "exam",
      min: Math.min(45, Math.max(20, ei.reduce((n, i) => n + PT.secs[i].qs.length, 0))),
      title: "Full mock test, timed",
      why: "Turn the Timer on, leave Shuffle off, and don't look anything up. Afterward, use Retest missed questions.",
      go: { t: "exam", sec: ei[0], label: "Open the mock test" },
    };
  const cheatStep = (title, why) => ({ key: "cheat:" + title, min: 5, title: title, why: why, go: { t: cheat ? "cheat" : "guide", label: cheat ? "Open Cheat sheet" : "Open Study guide" } });

  if (when === "today") {
    S.push(cheatStep("Read the Cheat sheet", "Start with the whole unit on one page. Notice anything that looks unfamiliar."));
    if (hasTrouble || ALL.some((c) => !SAVE.known[c.id])) S.push(flashStep(10));
    if (F.length) S.push(fixStep(F));
    L.forEach((d) => S.push(skimStep(d)));
    if (Po.length) S.push(polishStep(Po));
    S.push(Object.assign(cheatStep("Last look at the Cheat sheet", "Stop studying new things. A calm last read beats cramming."), { last: true }));
  } else if (when === "tomorrow") {
    /* The mock test is the best practice the night before, so with an hour or more it comes right after Learn and Fix. */
    const e = examStep(),
      p = practiceStep(),
      long = planState().mins >= 60;
    L.forEach((d) => S.push(learnStep(d)));
    if (F.length) S.push(fixStep(F));
    if (long && e) S.push(e);
    else if (p) S.push(p);
    S.push(flashStep(10));
    if (long && p) S.push(p);
    else if (e) S.push(e);
    if (Po.length) S.push(polishStep(Po));
    S.push(Object.assign(cheatStep("Cheat sheet, then sleep", "Read it once, then stop. Stop new material about an hour before bed; sleep is when it sticks."), { last: true }));
  } else {
    /* Several days: today's session starts the schedule (Learn first, then Fix). */
    L.forEach((d) => S.push(learnStep(d)));
    if (F.length) S.push(fixStep(F));
    S.push(flashStep(10));
    const p = practiceStep();
    if (p) S.push(p);
    if (Po.length) S.push(polishStep(Po));
  }
  return S.filter(Boolean);
}
/* Fit the steps into the time chosen; a Learn step that doesn't fit is cut to its first lessons. */
function fitSteps(steps, mins) {
  const now = [],
    later = [];
  /* A step marked "last" (the final Cheat sheet look) always ends today's list, so its time is set aside first. */
  const fin = steps.filter((s) => s.last);
  steps = steps.filter((s) => !s.last);
  let left = (mins >= 90 ? 120 : mins) - fin.reduce((n, s) => n + s.min, 0);
  steps.forEach((s, n) => {
    if (s.min <= left) {
      now.push(s);
      left -= s.min;
    } else if (s.key.indexOf("learn:") === 0 && left >= 6) {
      const k = Math.floor(left / 6);
      now.push(Object.assign({}, s, { min: k * 6, title: s.title + " (first " + k + " lesson" + (k > 1 ? "s" : "") + ")" }));
      later.push(Object.assign({}, s, { key: s.key + ":rest", title: s.title + " (the rest)" }));
      left -= k * 6;
    } else if (!now.length && n === 0) {
      now.push(s);
      left -= s.min;
    } else later.push(s);
  });
  return { now: now.concat(fin), later: later };
}
function dayPlan(when, labs) {
  const L = labs.filter((x) => x.lab.l === "learn").map((x) => x.d.name),
    F = labs.filter((x) => x.lab.l === "fix").map((x) => x.d.name);
  const ex = ptIdx("exam").length;
  if (when === "days")
    return [
      ["Day 1 (today)", "Learn " + (L.length ? L.join(", ") : "anything still new") + ". Finish with trouble-term Flashcards."],
      ["Day 2", "Fix " + (F.length ? F.join(", ") : "your weakest decks") + " with a Quiz, then one Practice Test section."],
      ["Last day", (ex ? "Timed mock test, then Retest missed questions. " : "A mixed Quiz on every deck. ") + "Cheat sheet, then sleep."],
    ];
  if (when === "week") {
    const order = L.concat(F);
    const rows = order.map((n, i) => ["Day " + (i + 1), (i < L.length ? "Learn " : "Fix ") + n + ", then 10 minutes of trouble-term Flashcards on earlier decks."]);
    rows.push(["2 days before", ex ? "Timed mock test. Redo every missed question." : "A long mixed Quiz on every deck."]);
    rows.push(["Day before", "Fix whatever the mock showed, Cheat sheet, sleep."]);
    return rows;
  }
  return null;
}

/* ---------- views ---------- */
function planHTML() {
  const P = planState();
  if (!UI.P) UI.P = { phase: P.phase === "check" ? "about" : P.phase, qs: null, i: 0, picked: null };
  if (UI.P.phase === "check") return planCheckHTML();
  if (UI.P.phase === "plan" && P.when && P.mins) return planViewHTML();
  return planAboutHTML();
}
function pick(k, v, label, on) {
  return '<button class="chip" data-act="plset" data-k="' + esc(k) + '" data-v="' + esc(v) + '" aria-pressed="' + !!on + '">' + esc(label) + "</button>";
}
function planAboutHTML() {
  const P = planState(),
    ds = planDecks();
  const ready = P.when && P.mins && ds.every((d) => P.rate[d.id]);
  let h = '<section class="panel plan"><h2>Study plan</h2><p class="muted">Answer three quick things, take a short check (one question per deck), and get a step-by-step plan for the time you have. Nothing here counts against your progress.</p>';
  h += '<h3>1. When is your test?</h3><div class="chips" role="group" aria-label="When is your test">' + PL_WHEN.map((w) => pick("when", w[0], w[1], P.when === w[0])).join("") + "</div>";
  h += '<h3>2. How much time do you have right now?</h3><div class="chips" role="group" aria-label="Time you have">' + PL_MINS.map((m) => pick("mins", m, m === 90 ? "90+ min" : m + " min", P.mins === m)).join("") + "</div>";
  h += '<h3>3. How well do you know each part?</h3><p class="hint">Be honest: the quick check and your saved progress are used too, so one guess either way won\'t decide it.</p><div class="plrate">';
  ds.forEach((d) => {
    h += '<div class="plrow"><span class="pld">' + dot(d.id) + esc(d.name) + '</span><span class="chips" role="group" aria-label="' + esc(d.name) + '">' + PL_RATE.map((r) => pick("r:" + d.id, r[0], r[1], P.rate[d.id] === r[0])).join("") + "</span></div>";
  });
  h += '</div><div class="qnav"><button class="btn" data-act="plcheck"' + (ready ? "" : " disabled") + ">Start the quick check (" + ds.length + " questions)</button>";
  if (P.phase === "plan") h += '<button class="btn sec" data-act="plshow">Back to my plan</button>';
  return h + "</div></section>";
}
function planCheckHTML() {
  const U = UI.P,
    q = U.qs[U.i];
  let h = '<section class="panel plan"><div class="rtop"><h2>Quick check</h2><span class="muted">Question ' + (U.i + 1) + " of " + U.qs.length + "</span></div>";
  h += '<p class="qtitle">' + dot(q.deck.id) + esc(q.deck.name) + '</p><div class="stem">' + q.q.prompt + '</div><div class="opts">';
  q.q.options.forEach((o, k) => {
    let c = "opt";
    if (U.picked !== null) {
      if (o.ok) c += " right";
      else if (k === U.picked) c += " wrong";
    }
    h += optRow(c, "plpick", k, LET[k], esc(o.t), null, false, U.picked !== null);
  });
  h += '</div><div class="qnav">';
  if (U.picked === null) h += '<button class="btn sec" data-act="plpick" data-k="-1">Skip: I don\'t know</button>';
  else {
    h += '<button class="btn" data-act="plnext">' + (U.i + 1 < U.qs.length ? "Next question" : "See my plan") + "</button>";
  }
  h += "</div>";
  if (U.picked !== null) h += U.picked >= 0 ? whyHTML(q.q.options, U.picked, q.q.explain) : '<div class="why good"><p>' + q.q.explain + "</p></div>";
  return h + "</section>";
}
function planViewHTML() {
  const P = planState(),
    labs = planDecks().map((d) => ({ d: d, lab: deckLabel(d) }));
  const when = PL_WHEN.find((w) => w[0] === P.when)[1];
  const fit = fitSteps(stepsFor(P.when, labs), P.mins);
  const total = fit.now.reduce((n, s) => n + s.min, 0);
  let h = '<section class="panel plan"><div class="rtop"><h2>Your study plan</h2><span class="muted">Test: ' + esc(when) + " · " + (P.mins === 90 ? "90+" : P.mins) + " min now</span></div>";
  h += '<h3>Where you stand</h3><div class="pltable">';
  labs.forEach((x) => {
    const q = P.check[x.d.id];
    h +=
      '<div class="plrow"><span class="pld">' +
      dot(x.d.id) +
      esc(x.d.name) +
      '</span><span class="pltag ' +
      x.lab.l +
      '">' +
      PL_LABEL[x.lab.l] +
      (x.lab.light ? " (quick)" : "") +
      '</span><span class="plwhy">' +
      esc(x.lab.why) +
      ' <span class="muted">Quick check: ' +
      (q === true ? "right" : q === false ? "missed" : "skipped") +
      ".</span></span></div>";
  });
  h += "</div>";
  h += "<h3>Do these now, in order (about " + total + " min)</h3><ol class=\"plsteps\">";
  fit.now.forEach((s, n) => (h += stepHTML(s, n)));
  h += "</ol>";
  if (fit.later.length) {
    h += '<h3>If you have more time</h3><ol class="plsteps later">';
    fit.later.forEach((s, n) => (h += stepHTML(s, n + fit.now.length)));
    h += "</ol>";
  }
  const days = dayPlan(P.when, labs);
  if (days) h += '<h3>Day by day</h3><dl class="pldays">' + days.map((r) => "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>").join("") + "</dl>";
  h +=
    '<h3>How to study well</h3><ul class="pltips"><li>Test yourself instead of rereading: answering questions is what makes it stick.</li><li>After every miss, read why the right answer is right and why yours was wrong.</li>' +
    (P.when === "today" || P.when === "tomorrow" ? "<li>Sleep matters more than one more hour of cramming. Stop new material about an hour before bed.</li>" : "<li>Short sessions on several days beat one long session.</li>") +
    "</ul>";
  h += '<div class="qnav"><button class="btn sec" data-act="plredo">Redo the quick check</button><button class="btn ghost" data-act="plabout">Change my answers</button></div>';
  return h + "</section>";
}
function stepHTML(s, n) {
  const P = planState(),
    done = !!P.done[s.key];
  return (
    '<li class="plstep' +
    (done ? " done" : "") +
    '"><label class="chk"><input type="checkbox" data-act="plstep" data-k="' +
    esc(s.key) +
    '"' +
    (done ? " checked" : "") +
    '> <b>' +
    esc(s.title) +
    '</b> <span class="muted">~' +
    s.min +
    " min</span></label><p>" +
    esc(s.why) +
    '</p><button class="btn sec small" data-act="plgo" data-n="' +
    n +
    '">' +
    esc(s.go.label) +
    "</button></li>"
  );
}

/* ---------- actions ---------- */
let PL_SHOWN = [];
ACT.plset = (t) => {
  const P = planState(),
    k = t.dataset.k,
    v = t.dataset.v;
  if (k === "when") P.when = v;
  else if (k === "mins") P.mins = Number(v);
  else if (k.indexOf("r:") === 0) {
    const d = D.decks.find((x) => String(x.id) === k.slice(2));
    if (d) P.rate[d.id] = v;
  }
  save();
  render();
};
ACT.plcheck = () => {
  const ds = planDecks();
  UI.P = {
    phase: "check",
    i: 0,
    picked: null,
    qs: ds.map((d) => {
      const cards = ALL.filter((c) => c.deck === d.id);
      const withAsk = cards.filter((c) => c.asks && c.asks.length);
      const card = (withAsk.length ? withAsk : cards)[Math.floor(Math.random() * (withAsk.length || cards.length))];
      const q = card.asks && card.asks.length ? askQ(card, card.asks[Math.floor(Math.random() * card.asks.length)]) : mcQ(card, "d2t");
      return { deck: d, q: q };
    }),
  };
  render();
  window.scrollTo(0, 0);
};
ACT.plpick = (t) => {
  const U = UI.P;
  if (!U || U.phase !== "check" || U.picked !== null) return;
  const k = Number(t.dataset.k),
    q = U.qs[U.i];
  U.picked = k;
  planState().check[q.deck.id] = k >= 0 ? !!q.q.options[k].ok : null;
  save();
  render();
};
ACT.plnext = () => {
  const U = UI.P;
  if (U.i + 1 < U.qs.length) {
    U.i++;
    U.picked = null;
  } else {
    const P = planState();
    P.phase = "plan";
    P.done = {};
    U.phase = "plan";
    save();
  }
  render();
  window.scrollTo(0, 0);
};
ACT.plredo = () => ACT.plcheck();
ACT.plabout = () => {
  UI.P = { phase: "about" };
  render();
};
ACT.plshow = () => {
  UI.P = { phase: "plan" };
  render();
};
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t || t.dataset.act !== "plstep") return;
  const P = planState();
  if (t.checked) P.done[t.dataset.k] = true;
  else delete P.done[t.dataset.k];
  save();
  render();
});
ACT.plstep = () => {}; /* the checkbox is handled on change, so a click doesn't toggle twice */
ACT.plgo = (t) => {
  const P = planState(),
    labs = planDecks().map((d) => ({ d: d, lab: deckLabel(d) }));
  const fit = fitSteps(stepsFor(P.when, labs), P.mins),
    all = fit.now.concat(fit.later),
    s = all[Number(t.dataset.n)];
  if (!s) return;
  const g = s.go;
  UI.run = null;
  stopTM();
  if (g.t === "learn") {
    UI.tab = "learn";
    if (g.i >= 0) return startLesson(g.i);
  } else if (g.t === "guide") {
    UI.tab = "guide";
    UI.deck = g.d || 0;
  } else if (g.t === "flash") {
    UI.tab = "flash";
    UI.deck = 0;
    SAVE.settings.fcPool = g.pool;
    FC = null;
  } else if (g.t === "quiz") {
    UI.tab = "quiz";
    initQ();
    D.decks.forEach((d) => (UI.q.decks[d.id] = g.decks.indexOf(d.id) >= 0));
    UI.q.mc = 6;
    UI.q.tf = 0;
    UI.q.sc = 4;
    clampQ();
    save();
    return ACT.qstart();
  } else if (g.t === "pt" || g.t === "exam") {
    UI.tab = g.t;
    PT.res = null;
    PT.sec = g.sec;
  } else UI.tab = g.t;
  render();
  window.scrollTo(0, 0);
};
