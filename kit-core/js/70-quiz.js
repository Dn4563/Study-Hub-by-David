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
    return;
  }
  UI.q[t.dataset.q] = t.type === "number" ? Math.max(0, Number(t.value) || 0) : t.value;
}
function quizHTML() {
  if (UI.run) return runHTML();
  initQ();
  const q = UI.q;
  const so = (k, opts) =>
    '<select data-q="' + k + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (String(q[k]) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
  const num = (k, label, max) => "<label>" + label + ' <input type="number" min="0" max="' + max + '" data-q="' + k + '" value="' + q[k] + '"></label>';
  return (
    '<section class="panel form"><h2>Build a quiz</h2><fieldset><legend>Decks</legend><div class="grp">' +
    D.decks.map((d) => '<label><input type="checkbox" data-qd="' + d.id + '"' + (q.decks[d.id] ? " checked" : "") + ">" + dot(d.id) + esc(d.name) + "</label>").join("") +
    '</div></fieldset><fieldset><legend>Questions</legend><div class="grp">' +
    num("mc", "Multiple choice", 40) +
    num("tf", "True or false", 40) +
    num("sc", "Scenario", D.sq.length) +
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
    '</label></div></fieldset><p class="muted">Running out of time counts as a miss. Question types, term direction and focus are in Settings.</p>' +
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
  let pool = shuf(ALL.filter((c) => decks.indexOf(c.deck) >= 0));
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
  if (pool.length) {
    for (let i = 0; i < nmc; i++) qs.push(mcQ(pool[i % pool.length], null, np));
    for (let i = 0; i < ntf; i++) qs.push(tfQ(pool[(nmc + i) % pool.length]));
  }
  shuf(D.sq.filter((s) => decks.indexOf(s.deck) >= 0))
    .slice(0, nsc)
    .forEach((s) => qs.push(scQ(s)));
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
const KIND_NAME = { mc: "Multiple choice", tf: "True or false", sc: "Scenario" };
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
