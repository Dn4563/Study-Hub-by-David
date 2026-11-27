/* "Test tomorrow?": tonight's session, for a student who opens the unit the night before and may still need to
   learn the material. A short pop-up asks Read first or Quiz me first and how long they have; the unit is then cut
   into rounds of 6 to 10 terms (terms already marked known are skipped). Read first: read the round's terms with
   the section's "Read this first" text, then answer them. Quiz me first: answer first, then read. Terms missed in
   a round come back at the start of the next one. The session ends with a 10-question mixed check.
   Research behind it: testing beats rereading, and trying a question before studying helps as long as the answer
   follows (see the redesign brief). Saved in SAVE.tonight for today only. */
const TN_MINS = [30, 45, 60, 90],
  TN_FINAL = 10;
const tonightState = () => (SAVE && SAVE.tonight) || null;
const tonightToday = (T) => T && T.day === isoDay(today0());
const tnCard = (id) => BYID[id];

/* Rounds: each section's unknown terms in chunks of at most 10; small chunks in the same deck join up to 6+. */
function tonightRounds(mins) {
  const chunks = [];
  D.decks.forEach((dk) =>
    dk.sections.forEach((sc, si) => {
      const ids = sc.cards.filter((c) => !SAVE.known[c.id]).map((c) => c.id);
      if (!ids.length) return;
      const parts = Math.ceil(ids.length / 9),
        size = Math.ceil(ids.length / parts);
      for (let p = 0; p < parts; p++) chunks.push({ deck: dk.id, secs: [sc.key0 || dk.id + "." + si], names: [sc.name], ids: ids.slice(p * size, (p + 1) * size) });
    }),
  );
  const rounds = [];
  chunks.forEach((c) => {
    const last = rounds[rounds.length - 1];
    if (last && last.deck === c.deck && last.ids.length < 6 && last.ids.length + c.ids.length <= 10) {
      last.ids = last.ids.concat(c.ids);
      if (last.secs.indexOf(c.secs[0]) < 0) {
        last.secs.push(c.secs[0]);
        last.names.push(c.names[0]);
      }
    } else rounds.push(c);
  });
  /* About a minute per term plus 3 for reading and wrapping up; the mixed check takes about 8. */
  let used = 8;
  const fit = [];
  for (const r of rounds) {
    const m = r.ids.length + 3;
    if (fit.length && used + m > mins) break;
    fit.push(r);
    used += m;
  }
  return { rounds: fit, left: rounds.length - fit.length };
}
const roundTitle = (r) => (r.names.length > 2 ? r.names.slice(0, 2).join(", ") + " and more" : r.names.join(" and "));
const roundMins = (r) => r.ids.length + 3;

function tonightSetup() {
  const T0 = tonightState();
  const draft = { order: (T0 && T0.order) || "read", mins: (T0 && T0.mins) || 60 };
  UI.tnDraft = draft;
  openModal({
    title: "Tonight's session",
    done: "Start round 1",
    steps: [
      () =>
        '<h2>How do you want to start?</h2><p class="muted">You can switch any time.</p><div class="mopts">' +
        [
          ["read", "Read first", "See a few terms, then answer questions on them. Best if you're still learning it."],
          ["quiz", "Quiz me first", "Try the questions first, then see the terms. Best if you've studied it before."],
        ]
          .map((o) => '<button data-act="tnset" data-k="order" data-v="' + o[0] + '" aria-pressed="' + (UI.tnDraft.order === o[0]) + '"><b>' + o[1] + "</b><span>" + o[2] + "</span></button>")
          .join("") +
        "</div>",
      () =>
        '<h2>How long do you have tonight?</h2><div class="chips" role="group" aria-label="Minutes tonight">' +
        TN_MINS.map((m) => '<button class="chip" data-act="tnset" data-k="mins" data-v="' + m + '" aria-pressed="' + (UI.tnDraft.mins === m) + '">' + m + " min</button>").join("") +
        '</div><p class="muted">Terms you already marked as known are skipped. If there\'s more than fits, the rest waits in Learn.</p>',
      () => {
        const plan = tonightRounds(UI.tnDraft.mins);
        if (!plan.rounds.length) return "<h2>Tonight's session</h2><p>You've marked every term in this unit as known. The session will be just the mixed check.</p>";
        return (
          "<h2>Tonight's session</h2><ul class=\"msum\"><li>Rounds<span>" +
          plan.rounds.length +
          ", about " +
          Math.round(plan.rounds.reduce((n, r) => n + roundMins(r), 0) / plan.rounds.length) +
          " min each</span></li><li>Each round<span>" +
          (UI.tnDraft.order === "read" ? "Read 6 to 10 terms, then answer them" : "Answer questions, then read the terms") +
          "</span></li><li>First round<span>" +
          esc(roundTitle(plan.rounds[0])) +
          "</span></li><li>At the end<span>A " +
          TN_FINAL +
          "-question mixed check</span></li>" +
          (plan.left ? "<li>Not tonight<span>" + plural(plan.left, "more round") + " (in Learn)</span></li>" : "") +
          "</ul>"
        );
      },
    ],
    onDone: () => {
      const p = tonightRounds(UI.tnDraft.mins);
      SAVE.tonight = { v: 1, day: isoDay(today0()), order: UI.tnDraft.order, mins: UI.tnDraft.mins, rounds: p.rounds, left: p.left, cur: 0, phase: p.rounds.length ? "read" : "final", carry: [], seen: [], last: null, score: { ok: 0, n: 0 } };
      if (p.rounds.length && UI.tnDraft.order === "quiz") SAVE.tonight.phase = "quiz";
      save();
      UI.run = null;
      goTool("tonight");
      if (SAVE.tonight.phase === "quiz") tonightQuiz();
      else if (SAVE.tonight.phase === "final") tonightFinal();
    },
  });
}
ACT.tnset = (t) => {
  const d = UI.tnDraft;
  if (t.dataset.k === "mins") d.mins = Number(t.dataset.v);
  else d.order = t.dataset.v;
  modalRender();
};
ACT.tnstart = () => {
  const T = tonightState();
  if (T && T.rounds && T.phase !== "done" && tonightToday(T)) return goTool("tonight");
  tonightSetup();
};
/* One question per term: an applied question about half the time in mixed units, otherwise a definition one. */
function tnQ(card) {
  if (MIX && card.asks && card.asks.length && Math.random() < 0.5) return askQ(card, card.asks[Math.floor(Math.random() * card.asks.length)]);
  return mcQ(card, Math.random() < 0.5 ? "t2d" : "d2t", 4);
}
function tonightQuiz() {
  const T = tonightState(),
    r = T.rounds[T.cur],
    carry = T.carry.filter((id) => r.ids.indexOf(id) < 0),
    ids = carry.concat(shuf(r.ids));
  startRun({
    title: "Round " + (T.cur + 1) + " of " + T.rounds.length,
    qs: ids.map(tnCard).filter(Boolean).map(tnQ),
    immediate: true,
    timer: 0,
    retry: false,
    doneLabel: "Finish round",
    onDone: (R) => {
      T.last = { ok: R.res.filter((x) => x.ok).length, n: R.res.length, carry: carry.length };
      T.score.ok += T.last.ok;
      T.score.n += T.last.n;
      T.carry = R.res.filter((x) => !x.ok && x.q.card).map((x) => x.q.card.id);
      r.ids.forEach((id) => T.seen.indexOf(id) < 0 && T.seen.push(id));
      T.phase = T.order === "quiz" ? "readafter" : "after";
      UI.run = null;
      save();
      render();
      window.scrollTo(0, 0);
    },
  });
}
function tonightFinal() {
  const T = tonightState(),
    pool = T.carry.concat(shuf(T.seen.filter((id) => T.carry.indexOf(id) < 0)));
  const ids = (pool.length ? pool : shuf(ALL.map((c) => c.id))).slice(0, TN_FINAL);
  startRun({
    title: "Mixed check",
    qs: ids.map(tnCard).filter(Boolean).map(tnQ),
    immediate: true,
    timer: 0,
    retry: false,
    doneLabel: "See how tonight went",
    onDone: (R) => {
      T.final = { ok: R.res.filter((x) => x.ok).length, n: R.res.length };
      T.carry = R.res.filter((x) => !x.ok && x.q.card).map((x) => x.q.card.id);
      T.phase = "done";
      UI.run = null;
      save();
      render();
      window.scrollTo(0, 0);
    },
  });
}
function tnCardsHTML(ids) {
  return (
    '<div class="tncards">' +
    ids
      .map(tnCard)
      .filter(Boolean)
      .map((c) => '<div class="tncard"><b>' + esc(c.term) + "</b><span>" + esc(c.def) + "</span>" + (SAVE.settings.hooks && c.hook ? '<span class="tnhook">' + esc(c.hook) + "</span>" : "") + "</div>")
      .join("") +
    "</div>"
  );
}
function tnIntros(r) {
  let h = "";
  D.decks.forEach((dk) =>
    dk.sections.forEach((sc, si) => {
      if (r.secs.indexOf(sc.key0 || dk.id + "." + si) < 0 || !sc.intro || !sc.intro.some(Boolean)) return;
      h += '<div class="intro"><p class="introhead">Read this first: ' + esc(sc.name) + "</p>" + sc.intro.filter(Boolean).map((p) => "<p>" + esc(p) + "</p>").join("") + "</div>";
    }),
  );
  return h;
}
function tonightHTML() {
  if (UI.run) return runHTML();
  const T = tonightState();
  if (!T || !T.rounds || !tonightToday(T))
    return '<section class="panel"><h2>Test tomorrow?</h2><p>Answer two quick questions and get tonight\'s session: short rounds where you read a few terms, answer them, and the ones you miss come back.</p><div class="qnav"><button class="btn" data-act="tnstart">Set up tonight\'s session</button></div></section>';
  const n = T.rounds.length,
    r = T.rounds[Math.min(T.cur, n - 1)];
  const dots =
    '<div class="tndots" aria-label="Round ' + Math.min(T.cur + 1, n) + " of " + n + '">' + T.rounds.map((x, i) => '<i class="' + (i < T.cur ? "done" : i === T.cur && T.phase !== "done" && T.phase !== "final" ? "on" : "") + '"></i>').join("") + "</div>";
  let h = "";
  if (T.phase === "done") {
    const f = T.final || { ok: 0, n: 0 };
    h +=
      '<section class="panel"><h2>Done for tonight</h2><p>Mixed check: <b>' +
      f.ok +
      " of " +
      f.n +
      "</b> right. Across the rounds you answered " +
      T.score.ok +
      " of " +
      T.score.n +
      " right.</p>" +
      (T.carry.length ? "<p>Still shaky, look these over once more before bed:</p>" + tnCardsHTML(T.carry) : "<p>Nothing left to review. Get some sleep: it helps you remember what you studied.</p>") +
      (T.left ? '<p class="muted">' + plural(T.left, "round") + " didn't fit tonight; those terms are in Learn.</p>" : "") +
      '<div class="qnav"><button class="btn sec" data-act="tnreset">Start a new session</button><button class="btn ghost" data-act="tab" data-t="start">Back to Start</button></div></section>';
    return h;
  }
  h += '<div class="tnhead"><div><b>' + (T.phase === "final" ? "Mixed check" : "Round " + (T.cur + 1) + " of " + n + ": " + esc(roundTitle(r))) + '</b><span class="muted">' + (T.phase === "final" ? TN_FINAL + " questions from tonight" : "About " + roundMins(r) + " minutes") + "</span></div>" + dots + "</div>";
  if (T.phase === "read" || T.phase === "readafter") {
    const after = T.phase === "readafter";
    h += '<section class="panel">' + (after && T.last ? '<p class="tnres">' + T.last.ok + " of " + T.last.n + " right." + (T.carry.length ? " The ones you missed are marked below and come back next round." : "") + "</p>" : "") + tnIntros(r);
    if (after && T.carry.length) h += '<h3 class="tnsub">You missed these</h3>' + tnCardsHTML(T.carry) + '<h3 class="tnsub">All of this round</h3>';
    h += tnCardsHTML(r.ids);
    h +=
      '<div class="qnav">' +
      (after
        ? '<button class="btn" data-act="tnnext">' + (T.cur + 1 < n ? "Next round" : "Mixed check") + "</button>"
        : '<button class="btn" data-act="tnquiz">I\'ve read these. Quiz me</button><span class="muted">' + plural(r.ids.length + T.carry.length, "question") + "</span>") +
      '<button class="btn ghost" data-act="tnorder">' +
      (T.order === "read" ? "Switch to Quiz me first" : "Switch to Read first") +
      "</button></div></section>";
  } else if (T.phase === "after") {
    h +=
      '<section class="panel"><h2>Round ' +
      (T.cur + 1) +
      " done</h2><p>" +
      T.last.ok +
      " of " +
      T.last.n +
      " right." +
      (T.carry.length ? " The " + plural(T.carry.length, "term") + " you missed come back at the start of the next round." : " Nothing to carry over.") +
      "</p>" +
      (T.carry.length ? tnCardsHTML(T.carry) : "") +
      '<div class="qnav"><button class="btn" data-act="tnnext">' +
      (T.cur + 1 < n ? "Start round " + (T.cur + 2) + ": " + esc(roundTitle(T.rounds[T.cur + 1])) : "Mixed check") +
      "</button>" +
      (focusState().on ? "" : '<button class="btn ghost" data-act="focusopen">Take a timed break</button>') +
      "</div></section>";
  } else if (T.phase === "quiz") {
    h += '<section class="panel"><p>Quiz me first: answer this round\'s questions, then read the terms.</p><div class="qnav"><button class="btn" data-act="tnquiz">Start the questions</button></div></section>';
  } else if (T.phase === "final") {
    h += '<section class="panel"><p>Last step: ' + TN_FINAL + " mixed questions from tonight, missed ones first.</p><div class=\"qnav\"><button class=\"btn\" data-act=\"tnfinal\">Start the mixed check</button></div></section>";
  }
  return h;
}
ACT.tnquiz = () => tonightQuiz();
ACT.tnfinal = () => tonightFinal();
ACT.tnnext = () => {
  const T = tonightState();
  if (T.cur + 1 < T.rounds.length) {
    T.cur++;
    T.phase = T.order === "read" ? "read" : "quiz";
    save();
    if (T.phase === "quiz") return tonightQuiz();
  } else {
    T.phase = "final";
    save();
    return tonightFinal();
  }
  render();
  window.scrollTo(0, 0);
};
ACT.tnorder = () => {
  const T = tonightState();
  T.order = T.order === "read" ? "quiz" : "read";
  save();
  render();
};
ACT.tnreset = () => {
  SAVE.tonight = null;
  save();
  tonightSetup();
};
