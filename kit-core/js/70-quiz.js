/* Quiz builder: decks, how many of each type, number of choices, feedback timing, order and an optional
   per-question timer. Results break down by type and topic, with retry-missed and rerun. */
function initQ() {
  if (!UI.q) UI.q = { decks: {}, mc: 10, tf: 5, sc: 6, nopt: 4, fb: "immediate", order: "shuffle", timer: SAVE.settings.timer };
  D.decks.forEach((d) => {
    if (UI.q.decks[d.id] === undefined) UI.q.decks[d.id] = true;
  });
}
function QSET(t) {
  initQ();
  if (t.dataset.qd !== undefined) {
    const d = D.decks.find((x) => String(x.id) === t.dataset.qd);
    if (d) UI.q.decks[d.id] = t.checked;
    clampQ();
    return render();
  }
  if (t.type === "number") {
    UI.q[t.dataset.q] = Math.max(0, Math.floor(Number(t.value) || 0));
    clampQ();
    return render();
  }
  UI.q[t.dataset.q] = t.value;
}
/* Real limits for the chosen decks. Multiple choice and true/false share the decks' terms (a term is asked
   once, one way or the other); applied questions are counted separately. */
function quizCaps() {
  const decks = quizDecks();
  return { terms: ALL.filter((c) => decks.indexOf(c.deck) >= 0).length, applied: appliedCount() };
}
function clampQ() {
  const c = quizCaps(),
    q = UI.q;
  q.mc = Math.min(Math.max(0, Number(q.mc) || 0), c.terms);
  q.tf = Math.min(Math.max(0, Number(q.tf) || 0), c.terms - q.mc);
  q.sc = Math.min(Math.max(0, Number(q.sc) || 0), c.applied);
}
/* Questions from the last quiz go to the back of the line next time, so a rerun starts with new ones. */
let QRECENT = new Set();
/* How many applied questions the chosen decks have: scenarios plus applied (asks.json) questions. */
function appliedPool(decks) {
  const pool = [];
  D.sq.forEach((s, i) => decks.indexOf(s.deck) >= 0 && pool.push({ key: "s" + i, make: () => scQ(s) }));
  ALL.filter((c) => decks.indexOf(c.deck) >= 0).forEach((c) => (c.asks || []).forEach((a, i) => pool.push({ key: "a" + c.id + ":" + i, make: () => askQ(c, a) })));
  return pool;
}
const quizDecks = () => D.decks.map((d) => d.id).filter((id) => !UI.q || UI.q.decks[id] !== false);
function appliedCount() {
  return appliedPool(quizDecks()).length;
}
function quizHTML() {
  if (UI.run) return runHTML();
  initQ();
  const q = UI.q;
  const so = (k, opts) =>
    '<select data-q="' + k + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (String(q[k]) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
  clampQ();
  const caps = quizCaps();
  const num = (k, label, max) =>
    "<label>" + label + ' <small class="muted">(up to ' + max + ')</small> <input type="number" min="0" max="' + max + '" data-q="' + k + '" value="' + q[k] + '"></label>';
  return (
    '<section class="panel form"><h2>Build a quiz</h2><fieldset><legend>Decks</legend><div class="grp">' +
    D.decks.map((d) => '<label><input type="checkbox" data-qd="' + d.id + '"' + (q.decks[d.id] ? " checked" : "") + ">" + dot(d.id) + esc(d.name) + "</label>").join("") +
    '</div></fieldset><fieldset><legend>Questions</legend><div class="grp">' +
    num("mc", "Multiple choice", caps.terms) +
    num("tf", "True or false", caps.terms - q.mc) +
    num("sc", ALL.some((c) => c.asks && c.asks.length) ? "Applied (scenarios and apply-it)" : "Scenario", caps.applied) +
    '</div></fieldset><fieldset><legend>Options</legend><div class="grp">' +
    "<label>Choices per question " +
    so("nopt", [
      [3, "3"],
      [4, "4"],
      [5, "5"],
    ]) +
    "</label><label>Feedback " +
    so("fb", [
      ["immediate", "After each question"],
      ["end", "At the end"],
    ]) +
    "</label><label>Order " +
    so("order", [
      ["shuffle", "Shuffled"],
      ["deck", "Deck order"],
    ]) +
    "</label><label>Timer per question " +
    so("timer", [
      [0, "Off"],
      [15, "15 s"],
      [30, "30 s"],
      [60, "60 s"],
    ]) +
    '</label></div></fieldset><p class="muted">Every question in a quiz is different: a term is asked once, as multiple choice or true or false. Numbers above the limit are lowered to it. Running out of time counts as a miss. Question types, term direction and focus are in Settings.</p>' +
    (UI.qmsg ? '<p class="msg">' + esc(UI.qmsg) + "</p>" : "") +
    '<div class="qnav"><button class="btn" data-act="qstart">Start quiz</button></div></section>'
  );
}
ACT.qstart = () => {
  initQ();
  const q = UI.q,
    decks = D.decks.map((d) => d.id).filter((id) => q.decks[id]);
  if (!decks.length) {
    UI.qmsg = "Pick at least one deck.";
    return render();
  }
  clampQ();
  /* Random order, then (stable sorts) the Settings focus first and last quiz's questions last. */
  const recentLast = (key) => (QRECENT.has(key) ? 1 : 0);
  let pool = shuf(ALL.filter((c) => decks.indexOf(c.deck) >= 0));
  pool.sort((a, b) => recentLast("c" + a.id) - recentLast("c" + b.id));
  const f = SAVE.settings.focus;
  if (f === "trouble") pool.sort((a, b) => (SAVE.trouble[b.id] || 0) - (SAVE.trouble[a.id] || 0));
  else if (f === "unknown") pool.sort((a, b) => (SAVE.known[a.id] ? 1 : 0) - (SAVE.known[b.id] ? 1 : 0));
  let nmc = Number(q.mc) || 0,
    ntf = Number(q.tf) || 0,
    nsc = Number(q.sc) || 0;
  const qt = SAVE.settings.qType;
  if (qt === "terms") nsc = 0;
  if (qt === "scen") nmc = ntf = 0;
  const qs = [],
    np = Number(q.nopt) || 4;
  /* Each term once: the first nmc as multiple choice, the next ntf as true or false. */
  nmc = Math.min(nmc, pool.length);
  ntf = Math.min(ntf, pool.length - nmc);
  const used = new Set();
  for (let i = 0; i < nmc; i++) {
    const mq = mcQ(pool[i], null, np);
    qs.push(mq);
    used.add("c" + pool[i].id);
    /* A card with no fair definition question is asked with its applied question; don't ask that one again below. */
    if (mq.kind === "ap") used.add("a" + pool[i].id + ":" + pool[i].asks.findIndex((a) => esc(a.q) === mq.prompt));
  }
  for (let i = nmc; i < nmc + ntf; i++) {
    qs.push(tfQ(pool[i]));
    used.add("c" + pool[i].id);
  }
  /* Applied pool: the decks' scenario questions plus every applied (asks.json) question, each at most once. */
  const ap = shuf(appliedPool(decks).filter((it) => !used.has(it.key)));
  ap.sort((a, b) => recentLast(a.key) - recentLast(b.key));
  ap.slice(0, nsc).forEach((it) => {
    qs.push(it.make());
    used.add(it.key);
  });
  QRECENT = used;
  if (!qs.length) {
    UI.qmsg = "Nothing to ask with those settings.";
    return render();
  }
  UI.qmsg = "";
  startRun({ title: "Quiz", qs: q.order === "shuffle" ? shuf(qs) : qs, immediate: q.fb === "immediate", timer: Number(q.timer) || 0, retry: false, breakdown: true, again: true });
};
ACT.qagain = () => {
  UI.run = null;
  stopTM();
  ACT.qstart();
};
const KIND_NAME = { mc: "Multiple choice", tf: "True or false", sc: "Scenario", ap: "Applied" };
function breakdownHTML(R) {
  const tally = (f) => {
    const m = {};
    R.res.forEach((r) => {
      const k = f(r.q);
      if (k == null) return;
      m[k] = m[k] || [0, 0];
      m[k][1]++;
      if (r.ok) m[k][0]++;
    });
    return m;
  };
  const rows = (m, nm) =>
    Object.keys(m)
      .map((k) => "<tr><td>" + esc(nm(k)) + "</td><td>" + m[k][0] + " of " + m[k][1] + "</td><td>" + Math.round((100 * m[k][0]) / m[k][1]) + "%</td></tr>")
      .join("");
  return (
    '<div class="scrollx"><table class="gt breakdown"><tr><th>By question type</th><th>Score</th><th></th></tr>' +
    rows(tally((q) => q.kind), (k) => KIND_NAME[k] || k) +
    "<tr><th>By deck</th><th>Score</th><th></th></tr>" +
    rows(
      tally((q) => (q.card ? q.card.deck : q.deck)),
      (k) => (deckOf(Number(k)) || deckOf(k) || { name: k }).name,
    ) +
    "</table></div>"
  );
}
