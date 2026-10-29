/* Per-exam results page (score with partial credit, by type, what to study next, question by question) and
   the Progress tab (every practice topic ranked weakest first). */
const topicOf = (q) => q.topic || q.skill || "Other";
function reviewDeck(topic) {
  const d = D.topicDeck && D.topicDeck[topic];
  return d === undefined ? null : D.allDecks.find((x) => x.id === d) || null;
}
const barHTML = (p) => '<span class="bar ' + (p < 60 ? "low" : p < 85 ? "mid" : "high") + '" aria-hidden="true"><i style="width:' + p + '%"></i></span>';
const jumpBtn = (si, q, label) => '<button class="lnk" data-act="progjump" data-s="' + si + '" data-id="' + esc(q.id) + '">' + esc(label) + "</button>";

function resDetail(q, s) {
  if (q.type === "mcq" || q.type === "tf")
    return "<p><b>Your answer:</b> " + (s.sel == null ? "none" : esc(q.options[s.sel])) + "</p><p><b>Correct answer:</b> " + esc(q.options[q.ai]) + '</p><p class="muted">' + esc(q.exp) + "</p>";
  if (q.type === "label" || q.type === "diagram")
    return (
      "<ul>" +
      itemsOf(q)
        .map((it, i) => {
          const sel = s.items[i],
            ok = sel === it.ans;
          return (
            "<li>" +
            esc(q.type === "diagram" ? "Pin " + (i + 1) : it.t) +
            ": " +
            (ok ? "<b>" + esc(q.labels[it.ans]) + "</b>, correct" : "you said " + (sel === undefined ? "nothing" : esc(q.labels[sel])) + ", correct is <b>" + esc(q.labels[it.ans]) + '</b>. <span class="muted">' + esc(it.exp || "") + "</span>") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  return (
    '<ol class="fparts" type="a">' +
    q.parts
      .map((p) => "<li><p><b>" + (s.pm[p.k] === true ? "Got it. " : s.pm[p.k] === false ? "Missed. " : "") + "</b>" + esc(p.prompt) + "</p><p>" + esc(p.tea ? p.tea.join(" ") : p.model) + "</p></li>")
      .join("") +
    "</ol>"
  );
}

function resHTML(group) {
  const secs = PT.secs.map((sec, si) => ({ sec: sec, si: si })).filter((x) => x.sec.mode === "exam" && x.sec.exam === group);
  let tot = 0,
    ok = 0,
    done = 0;
  const byType = {},
    byTopic = {},
    rows = [];
  secs.forEach((x) =>
    x.sec.orig.forEach((id, n) => {
      const q = x.sec.byId[id],
        s = x.sec.st[id],
        f0 = frac(q, s),
        f = f0 === null ? 0 : f0;
      tot++;
      ok += f;
      if (f0 !== null) done++;
      const T = (byType[TYPE_NAME[q.type]] = byType[TYPE_NAME[q.type]] || { ok: 0, tot: 0, n: 0 });
      T.tot++;
      T.ok += f;
      if (f0 !== null) T.n++;
      const P = (byTopic[topicOf(q)] = byTopic[topicOf(q)] || { ok: 0, tot: 0, bad: 0, none: 0 });
      P.tot++;
      P.ok += f;
      if (f0 === null) P.none++;
      else if (f0 < 1) P.bad++;
      rows.push({ x: x, q: q, s: s, f0: f0, n: n });
    }),
  );
  let h = '<section class="panel"><div class="rtop"><h2>' + esc(group) + " results</h2></div>";
  if (!done) return h + '<p class="muted">Nothing checked yet. Work through this exam, press Check Answer (or self-mark written answers), then come back. Each exam is scored on its own.</p></section>';
  const pct = Math.round((ok / tot) * 100);
  h +=
    '<div class="fb' +
    (pct >= 85 ? " ok" : pct < 60 ? " bad" : "") +
    '"><p class="big">' +
    fmt1(ok) +
    " of " +
    tot +
    " points (" +
    pct +
    "%)</p><p>Partial credit counts." +
    (done < tot ? " " + plural(tot - done, "question") + " not answered or self-marked yet, worth 0 points." : "") +
    " " +
    (pct >= 85 ? "Strong. Review the few misses below." : pct >= 70 ? "Solid, but the topics below still need work." : "Not there yet. Use the study list below, then retake this exam.") +
    "</p></div>";
  h +=
    '<h3>By question type</h3><div class="wk">' +
    Object.keys(byType)
      .map((k) => {
        const t = byType[k],
          p = Math.round((t.ok / t.tot) * 100);
        return '<div class="wkrow"><div class="wkhead"><b>' + esc(k) + "</b><span>" + fmt1(t.ok) + " of " + t.tot + " points" + (t.n < t.tot ? ", " + (t.tot - t.n) + " not answered" : "") + "</span></div>" + barHTML(p) + "</div>";
      })
      .join("") +
    "</div>";
  const need = Object.keys(byTopic)
    .filter((k) => byTopic[k].bad || byTopic[k].none)
    .sort((a, b) => byTopic[a].ok / byTopic[a].tot - byTopic[b].ok / byTopic[b].tot);
  h += "<h3>What to study next</h3>";
  if (!need.length) h += "<p>Nothing missed. Try the Practice Test sections for more.</p>";
  else
    h +=
      '<div class="wk">' +
      need
        .map((k) => {
          const t = byTopic[k],
            p = Math.round((t.ok / t.tot) * 100),
            dk = reviewDeck(k);
          const miss = rows.filter((r) => topicOf(r.q) === k && r.f0 !== 1);
          return (
            '<div class="wkrow"><div class="wkhead"><b>' +
            esc(k) +
            "</b><span>" +
            fmt1(t.ok) +
            " of " +
            t.tot +
            " points" +
            (t.none ? ", " + t.none + " not answered" : "") +
            "</span></div>" +
            barHTML(p) +
            '<p class="wkmiss">Go back to: ' +
            miss.map((r) => jumpBtn(r.x.si, r.q, r.x.sec.name + ", question " + (r.n + 1))).join(", ") +
            "</p>" +
            (dk ? '<p class="wkrev">Then review <b>' + esc(dk.name) + "</b> in the Study guide.</p>" : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  h += "<h3>Question by question</h3>";
  rows.forEach((r) => {
    const st = r.f0 === null ? "none" : r.f0 === 1 ? "ok" : r.f0 > 0 ? "partial" : "bad";
    const parts = isWritten(r.q) ? r.q.parts.length : r.q.type === "label" || r.q.type === "diagram" ? itemsOf(r.q).length : 1;
    const lbl = { ok: "Correct", bad: "Missed", none: "Not answered", partial: "Partly right, " + fmt1(r.f0 * parts) + " of " + parts }[st];
    const stem = r.q.title || r.q.stem || r.q.lead || "";
    h +=
      '<details class="resq ' +
      st +
      '"' +
      (st === "ok" ? "" : " open") +
      '><summary><span class="pal ' +
      st +
      '" aria-hidden="true">' +
      (r.n + 1) +
      "</span><span><b>" +
      lbl +
      "</b> " +
      esc(r.x.sec.name) +
      ", " +
      esc(TYPE_NAME[r.q.type]) +
      ' <span class="skill">' +
      esc(topicOf(r.q)) +
      "</span><br>" +
      esc(stem.length > 160 ? stem.slice(0, 160) + "..." : stem) +
      "</span></summary>" +
      (st === "ok"
        ? ""
        : '<div class="resd">' +
          (r.f0 !== null || isWritten(r.q) ? resDetail(r.q, r.s) : '<p class="muted">You did not check this question.</p>') +
          "<p>" +
          jumpBtn(r.x.si, r.q, "Go to this question") +
          "</p></div>") +
      "</details>";
  });
  return h + "</section>";
}

function progHTML() {
  const T = {};
  PT.secs.forEach((sec, si) =>
    sec.qs.forEach((q) => {
      const o = (T[topicOf(q)] = T[topicOf(q)] || { ok: 0, n: 0, miss: [], total: 0 });
      o.total++;
      const f = frac(q, sec.st[q.id]);
      if (f !== null) {
        o.n++;
        o.ok += f;
        if (f < 1) o.miss.push({ si: si, q: q });
      }
    }),
  );
  const rows = Object.keys(T)
    .map((n) => ({ n: n, o: T[n], pct: T[n].n ? T[n].ok / T[n].n : null }))
    .sort((a, b) => (a.pct === null) - (b.pct === null) || (a.pct || 0) - (b.pct || 0));
  let h = '<section class="panel"><h2>Weak topics</h2>';
  h += rows.some((r) => r.o.n)
    ? '<p class="muted">Every question you have checked or self-marked, ranked weakest first. Under 3 answers counts as an early number.</p>'
    : '<p class="muted">Answer some practice or exam questions and your topics show up here, weakest first.</p>';
  h += '<div class="wk">';
  rows.forEach((r) => {
    const p = r.pct === null ? 0 : Math.round(r.pct * 100),
      dk = reviewDeck(r.n);
    h +=
      '<div class="wkrow"><div class="wkhead"><b>' +
      esc(r.n) +
      "</b><span>" +
      (r.pct === null ? "Not started" : fmt1(r.o.ok) + " of " + r.o.n + " points (" + p + "%)" + (r.o.n < 3 ? ", early" : "")) +
      ", " +
      plural(r.o.total, "question") +
      " in the kit</span></div>" +
      barHTML(p);
    if (r.o.miss.length) h += '<p class="wkmiss">Missed: ' + r.o.miss.map((m) => jumpBtn(m.si, m.q, PT.secs[m.si].name + ", question " + (PT.secs[m.si].orig.indexOf(m.q.id) + 1))).join(", ") + "</p>";
    if (dk && (r.pct === null || r.pct < 0.85)) h += '<p class="wkrev">Review <b>' + esc(dk.name) + "</b> in the Study guide.</p>";
    h += "</div>";
  });
  h += "</div>";
  const tr = Object.keys(SAVE.trouble).filter((k) => SAVE.trouble[k] && !SAVE.known[k] && BYID[k]).length;
  if (tr) h += '<p class="muted">You also have ' + plural(tr, "trouble term") + " in the Flashcards pool.</p>";
  return h + "</section>";
}
ACT.progjump = (t) => {
  const si = Number(t.dataset.s),
    sec = PT.secs[si];
  UI.tab = sec.mode === "exam" ? "exam" : "pt";
  PT.res = null;
  PT.sec = si;
  PT.retest = null;
  const i = sec.order.indexOf(t.dataset.id);
  if (i >= 0) sec.cur = i;
  render();
  window.scrollTo(0, 0);
};
