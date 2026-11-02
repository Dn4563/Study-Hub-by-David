/* Learn: lessons of at most 5 cards. Read step, then one question at a time. A missed term comes back two
   questions later, earlier lessons feed up to 3 review questions (trouble terms first), and the last lesson
   of each deck ends with a scenario checkpoint. */
const LI = () => Math.min(Math.max(SAVE.li || 0, 0), LESSONS.length - 1);
const isLastOfDeck = (l) => {
  const ls = LESSONS.filter((x) => x.deck === l.deck);
  return ls[ls.length - 1] === l;
};
const isFirstOfDeck = (l) => LESSONS.filter((x) => x.deck === l.deck)[0] === l;
function setKnown(id, v) {
  if (v) SAVE.known[id] = true;
  else delete SAVE.known[id];
  save();
}
function chainHTML(f) {
  return (
    '<figure class="chain"><figcaption>' +
    esc(f.title) +
    '</figcaption><ol>' +
    f.steps.map((s) => "<li>" + esc(s) + "</li>").join("") +
    "</ol></figure>"
  );
}
const watchHTML = (w) => '<aside class="watch"><b>Watch out</b> ' + esc(w.text) + "</aside>";

function learnHTML() {
  if (UI.run) return runHTML();
  if (!UI.L) UI.L = { phase: "teach" };
  const L = UI.L,
    li = LI(),
    lesson = LESSONS[li],
    dk = deckOf(lesson.deck);
  const nDone = LESSONS.filter((l) => SAVE.done[l.id]).length,
    pct = Math.round((100 * nDone) / LESSONS.length);
  let h =
    '<section class="lessonbar"><div class="rtop"><span class="muted">Lesson ' +
    (li + 1) +
    " of " +
    LESSONS.length +
    ", " +
    nDone +
    ' done</span><button class="btn sec small" data-act="lmap" aria-expanded="' +
    !!UI.showMap +
    '">Lesson map</button></div><span class="bar" aria-hidden="true"><i style="width:' +
    pct +
    '%"></i></span>';
  if (UI.showMap)
    h +=
      '<div class="lmap">' +
      D.decks
        .map(
          (d) =>
            '<div class="lmdeck"><h3>' +
            dot(d.id) +
            esc(d.name) +
            '</h3><div class="lmlist">' +
            LESSONS.map((l, i) =>
              l.deck === d.id
                ? '<button class="lm' +
                  (SAVE.done[l.id] ? " done" : "") +
                  '" data-act="lgo" data-i="' +
                  i +
                  '"' +
                  (i === li ? ' aria-current="step"' : "") +
                  ">" +
                  (SAVE.done[l.id] ? ICON.check : "") +
                  esc(l.title) +
                  "</button>"
                : "",
            ).join("") +
            "</div></div>",
        )
        .join("") +
      "</div>";
  h += "</section>";
  const head = '<p class="deckname">' + dot(lesson.deck) + esc(dk.name) + "</p><h2>" + esc(lesson.title) + "</h2>";

  if (L.phase === "teach") {
    h +=
      '<section class="panel">' +
      head +
      '<p class="muted">Read these ' +
      lesson.cards.length +
      " terms. Cover each definition and explain it out loud. Then you get one question at a time" +
      (nDone ? ", with a few review questions from earlier lessons mixed in" : "") +
      ".</p>";
    if (isFirstOfDeck(lesson)) D.flows.filter((f) => f.deck === lesson.deck).forEach((f) => (h += chainHTML(f)));
    h +=
      '<dl class="terms">' +
      lesson.cards.map((c) => "<div><dt>" + esc(c.term) + "</dt><dd>" + esc(c.def) + hookLine(c) + "</dd></div>").join("") +
      "</dl>";
    if (isLastOfDeck(lesson)) {
      D.watch.filter((w) => w.deck === lesson.deck).forEach((w) => (h += watchHTML(w)));
      if (D.sq.some((s) => s.deck === lesson.deck))
        h += '<p class="muted">This is the last lesson in ' + esc(dk.name) + ", so the questions end with a scenario checkpoint on the whole deck.</p>";
    }
    h += '<div class="qnav"><button class="btn" data-act="lquiz">I have read them. Quiz me</button></div></section>';
  } else if (L.phase === "quiz") {
    const q = L.cur,
      answered = L.picked !== null,
      ok = answered && q.options[L.picked].ok,
      left = L.queue.length + (answered ? 0 : 1);
    h +=
      '<section class="panel"><div class="rtop"><span class="muted">' +
      esc(lesson.title) +
      '</span><span class="muted">' +
      left +
      " left</span></div>" +
      lockToggle() +
      '<p class="qask">' +
      esc(q.ask) +
      '</p><div class="qprompt">' +
      q.prompt +
      '</div><div class="opts">';
    q.elim = q.elim || [];
    q.options.forEach((o, i) => {
      let c = "opt";
      if (answered && o.ok) c += " right";
      if (answered && i === L.picked && !ok) c += " wrong";
      if (!answered && SAVE.settings.confirm && L.sel === i) c += " sel";
      h += optRow(c, "lopt", i, LET[i], esc(o.t), "lelim", q.elim.indexOf(i) >= 0, answered);
    });
    h += "</div>";
    if (!answered && SAVE.settings.confirm) h += lockHTML("lconfirm", L.sel);
    if (answered)
      h +=
        '<div class="fb ' +
        (ok ? "ok" : "bad") +
        '"><b>' +
        (ok ? "Correct." : "Not quite.") +
        "</b> " +
        q.explain +
        (!ok && q.recall ? '<p class="muted">This one is from ' + esc(q.recall.label) + ". It doesn't count against this lesson.</p>" : "") +
        (!ok && q.card ? '<p class="muted">' + (MIX ? "This term comes back in a few questions, asked a different way." : "This term comes back in two questions.") + "</p>" : "") +
        "</div>" +
        (q.kind === "tf" ? "" : whyHTML(q.options, L.picked, "")) +
        '<div class="qnav"><button class="btn" data-act="lnext">Next</button></div>';
    h += '</section><p class="kbd">Keys: A to D or 1 to 4 picks a choice. Enter locks it in, then goes to the next question.</p>';
  } else {
    const missed = [...L.missed].map((id) => BYID[id]),
      allDone = nDone === LESSONS.length,
      last = li >= LESSONS.length - 1,
      nxt = LESSONS[li + 1];
    h +=
      '<section class="panel">' +
      head +
      '<p class="scorebig">' +
      L.first +
      " of " +
      L.firstTotal +
      '</p><p class="muted">right on the first try.' +
      (missed.length ? " The terms below are now trouble terms. They come back as review questions in later lessons." : " Clean lesson.") +
      "</p>";
    if (missed.length) h += '<ul class="missed">' + missed.map((c) => "<li><b>" + esc(c.term) + "</b> " + esc(c.def) + "</li>").join("") + "</ul>";
    if (L.scenMiss.length)
      h +=
        '<h3>Checkpoint questions to review</h3><ul class="missed">' +
        L.scenMiss.map((q) => "<li>" + q.prompt + " <b>" + esc(q.options.find((o) => o.ok).t) + "</b>. " + q.explain + "</li>").join("") +
        "</ul>";
    if ((L.recallMiss || []).length)
      h +=
        '<h3>Earlier-unit questions to review</h3><ul class="missed">' +
        L.recallMiss.map((q) => "<li><b>" + esc(q.recall.term) + "</b> (" + esc(q.recall.label) + "). " + q.explain + "</li>").join("") +
        "</ul>";
    if (allDone) h += '<aside class="watch"><b>Every lesson done</b> Take the 40-question mixed quiz on everything and retry what you miss.</aside>';
    h +=
      '<div class="qnav"><button class="btn sec" data-act="lredo">Redo this lesson</button>' +
      (last
        ? '<button class="btn" data-act="lfinal">Take the final mixed quiz</button>'
        : '<button class="btn" data-act="lgo" data-i="' + (li + 1) + '">Next lesson: ' + esc(nxt.title) + "</button>") +
      "</div></section>";
  }
  return h;
}
/* ---------- old unit recall ----------
   Units with "recall": true (course.json) occasionally ask about an earlier unit of the same course:
   at most 1 question per lesson, in about 1 of 3 lessons, never in a deck's first lesson or its checkpoint.
   Trouble terms from the old unit come first, then the ones recalled longest ago. */
const RECALL_RATE = 1 / 3;
const recallOn = () => !!(UNIT.recall && SAVE.settings.recall);
const earlierUnits = () => COURSE.units.slice(0, COURSE.units.indexOf(UNIT));
function unitCards(u) {
  const out = [];
  UNITDATA[u.id].decks.forEach((dk) => {
    if (dk.optional) return;
    dk.sections.forEach((sc, si) => sc.cards.forEach((c, ci) => out.push(Object.assign({}, c, { id: dk.id + "." + si + "." + ci, deck: dk.id, sec: dk.id + "." + si }))));
  });
  return out;
}
function pickRecall() {
  const cands = [];
  earlierUnits().forEach((u) => {
    const saved = readJSON(keyOf(u, "kit")) || {},
      tr = saved.trouble || {},
      seen = saved.recallSeen || {};
    unitCards(u).forEach((c) => cands.push({ u: u.id, id: c.id, tr: tr[c.id] || 0, seen: seen[c.id] || 0, r: Math.random() }));
  });
  if (!cands.length) return null;
  cands.sort((a, b) => b.tr - a.tr || a.seen - b.seen || a.r - b.r);
  return cands[0];
}
function recallQ(item) {
  const u = COURSE.units.find((x) => x.id === item.unit),
    cards = unitCards(u),
    card = cards.find((c) => c.id === item.id);
  const label = "From " + u.label + ": " + u.title + ". ";
  let q;
  if (u.learnMix && card.asks && card.asks.length && Math.random() < 0.5) q = askQ(card, card.asks[Math.floor(Math.random() * card.asks.length)]);
  else {
    const dir = Math.random() < 0.5 ? "t2d" : "d2t",
      field = dir === "t2d" ? "def" : "term",
      same = shuf(cards.filter((c) => c !== card && c.sec === card.sec)),
      rest = shuf(cards.filter((c) => c !== card && c.sec !== card.sec)),
      ds = same.concat(rest).filter((c, i, a) => c[field] !== card[field] && a.findIndex((x) => x[field] === c[field]) === i).slice(0, 3);
    q = {
      kind: "mc",
      dir: dir,
      ask: dir === "t2d" ? "Which description best matches this term?" : "Which term matches this description?",
      prompt: dir === "t2d" ? "<b>" + esc(card.term) + "</b>" : esc(card.def),
      options: shuf([{ t: card[field], ok: true }].concat(ds.map((c) => ({ t: c[field], ok: false, why: dir === "t2d" ? 'That describes "' + c.term + '".' : '"' + c.term + '" means: ' + c.def })))),
      explain: "<b>" + esc(card.term) + "</b>: " + esc(card.def),
    };
  }
  q.card = null;
  q.recall = { unit: u.id, id: card.id, label: u.label + ": " + u.title, term: card.term };
  q.ask = label + q.ask;
  return q;
}
/* A recall answer updates the old unit's own saved trouble count. */
function recallResult(r, ok) {
  const u = COURSE.units.find((x) => x.id === r.unit),
    k = keyOf(u, "kit"),
    saved = readJSON(k) || {};
  saved.trouble = saved.trouble || {};
  saved.recallSeen = saved.recallSeen || {};
  if (ok) saved.trouble[r.id] = Math.max(0, (saved.trouble[r.id] || 0) - 1);
  else saved.trouble[r.id] = (saved.trouble[r.id] || 0) + 1;
  saved.recallSeen[r.id] = Date.now();
  writeJSON(k, saved);
}

function learnQ(item) {
  if (item.type === "recall") return recallQ(item);
  if (item.type === "sc") return scQ(D.sq[item.idx], "Checkpoint: apply it");
  const card = BYID[item.id];
  /* Mixed units: about half the questions are applied ones when the card has them. A term that comes back
     after a miss switches form: missed a definition question, get an applied one, and the other way round. */
  const hasAsk = MIX && card.asks && card.asks.length;
  const applied = hasAsk && (item.avoid === "ap" ? false : item.avoid ? true : Math.random() < 0.5);
  if (applied) {
    const q = askQ(card, card.asks[Math.floor(Math.random() * card.asks.length)]);
    if (item.review) q.ask = "Review from an earlier lesson. " + q.ask;
    return q;
  }
  const q = mcQ(card, Math.random() < 0.35 ? "t2d" : "d2t", 4);
  if (item.review) q.ask = "Review from an earlier lesson. " + q.ask;
  return q;
}
function startLesson(i) {
  SAVE.li = i;
  save();
  UI.L = { phase: "teach" };
  UI.showMap = false;
  render();
  window.scrollTo(0, 0);
}
function nextLearnQ() {
  const L = UI.L;
  if (!L.queue.length) {
    SAVE.done[LESSONS[LI()].id] = true;
    save();
    L.phase = "summary";
    render();
    return;
  }
  L.item = L.queue.shift();
  L.cur = learnQ(L.item);
  L.picked = null;
  L.sel = null;
  render();
}
ACT.lmap = () => {
  UI.showMap = !UI.showMap;
  render();
};
ACT.lgo = (t) => startLesson(Number(t.dataset.i));
ACT.lredo = () => startLesson(LI());
ACT.lquiz = () => {
  const li = LI(),
    lesson = LESSONS[li];
  const doneC = [];
  LESSONS.forEach((l, i) => {
    if (i !== li && SAVE.done[l.id]) l.cards.forEach((c) => doneC.push(c));
  });
  const weak = shuf(doneC.filter((c) => SAVE.trouble[c.id] > 0)),
    other = shuf(doneC.filter((c) => !(SAVE.trouble[c.id] > 0)));
  const reviews = weak
    .concat(other)
    .slice(0, Math.min(3, doneC.length))
    .map((c) => ({ type: "card", id: c.id, review: true }));
  let q = shuf(lesson.cards).map((c) => ({ type: "card", id: c.id }));
  reviews.forEach((r) => q.splice(1 + Math.floor(Math.random() * q.length), 0, r));
  if (isLastOfDeck(lesson)) {
    const idx = [];
    D.sq.forEach((s, i) => s.deck === lesson.deck && idx.push(i));
    q = q.concat(
      shuf(idx)
        .slice(0, 6)
        .map((i) => ({ type: "sc", idx: i })),
    );
  }
  let nRecall = 0;
  if (recallOn() && !isFirstOfDeck(lesson) && earlierUnits().length && Math.random() < RECALL_RATE) {
    const pick = pickRecall();
    if (pick) {
      const nCards = q.filter((it) => it.type !== "sc").length;
      q.splice(1 + Math.floor(Math.random() * Math.max(1, nCards - 1)), 0, { type: "recall", unit: pick.u, id: pick.id });
      nRecall = 1;
    }
  }
  UI.L = { phase: "quiz", queue: q, cur: null, picked: null, first: 0, firstTotal: q.length - nRecall, missed: new Set(), scenMiss: [], scenMissIdx: [], recallMiss: [], tried: new Set() };
  nextLearnQ();
};
function learnPick(k) {
  const L = UI.L;
  if (!L || L.phase !== "quiz" || L.picked !== null || UI.run) return;
  L.picked = k;
  if (L.cur.recall) {
    const ok = !!L.cur.options[k].ok;
    recallResult(L.cur.recall, ok);
    if (!ok) (L.recallMiss = L.recallMiss || []).push(L.cur);
    return render();
  }
  const q = L.cur,
    ok = !!q.options[k].ok,
    key = L.item.type === "sc" ? "s" + L.item.idx : L.item.id,
    firstTime = !L.tried.has(key);
  L.tried.add(key);
  if (ok && firstTime) L.first++;
  if (q.card) {
    const id = q.card.id;
    if (ok) {
      if (!L.missed.has(id)) {
        setKnown(id, true);
        if (SAVE.trouble[id]) SAVE.trouble[id] = Math.max(0, SAVE.trouble[id] - 1);
        save();
      }
    } else {
      L.missed.add(id);
      SAVE.trouble[id] = (SAVE.trouble[id] || 0) + 1;
      setKnown(id, false);
      /* Mixed units bring the term back 2 or 3 questions later, in a different form; others keep the fixed 2. */
      const gap = MIX ? 2 + Math.floor(Math.random() * 2) : 2;
      L.queue.splice(Math.min(L.queue.length, gap), 0, Object.assign({}, L.item, MIX ? { avoid: q.kind === "ap" ? "ap" : "mc" } : {}));
    }
  } else if (!ok) {
    L.scenMiss.push(q);
    L.scenMissIdx.push(L.item.idx);
  }
  render();
}
ACT.lopt = (t) => {
  const L = UI.L,
    k = Number(t.dataset.k);
  if (!L || L.phase !== "quiz" || L.picked !== null) return;
  if (SAVE.settings.confirm) {
    L.sel = k;
    render();
  } else learnPick(k);
};
ACT.lconfirm = () => {
  const L = UI.L;
  if (L && L.phase === "quiz" && L.picked === null && L.sel != null) learnPick(L.sel);
};
ACT.lelim = (t) => {
  const L = UI.L;
  if (!L || L.phase !== "quiz" || L.picked !== null) return;
  const k = Number(t.dataset.k);
  toggleElim((L.cur.elim = L.cur.elim || []), k);
  if (L.sel === k) L.sel = null;
  render();
};
ACT.lnext = () => {
  if (UI.L && UI.L.phase === "quiz" && UI.L.picked !== null) nextLearnQ();
};
ACT.lfinal = () =>
  startRun({
    title: "Final mixed quiz",
    qs: shuf(ALL)
      .slice(0, 40)
      .map((c) => mcQ(c)),
    immediate: true,
    timer: 0,
    retry: true,
    breakdown: true,
  });

/* A lesson in progress survives a reload. */
function packL() {
  const L = UI.L;
  if (!L) return null;
  if (L.phase === "teach") return { phase: "teach" };
  const o = { phase: L.phase, first: L.first, firstTotal: L.firstTotal, missed: [...L.missed], tried: [...L.tried], scen: L.scenMissIdx || [] };
  if (L.phase === "quiz") {
    const q = L.queue.slice();
    if (L.item && L.picked === null) q.unshift(L.item);
    o.queue = q;
  }
  return o;
}
function restoreL() {
  const p = SAVE.ui && SAVE.ui.L;
  if (!p || !p.phase) return;
  try {
    if (p.phase === "teach") {
      UI.L = { phase: "teach" };
      return;
    }
    const L = {
      phase: p.phase,
      queue: (p.queue || []).filter((it) =>
        it.type === "sc" ? D.sq[it.idx] : it.type === "recall" ? COURSE.units.some((u) => u.id === it.unit && UNITDATA[u.id]) : BYID[it.id],
      ),
      cur: null,
      picked: null,
      first: p.first || 0,
      firstTotal: p.firstTotal || 0,
      missed: new Set((p.missed || []).filter((id) => BYID[id])),
      scenMissIdx: (p.scen || []).filter((i) => D.sq[i]),
      tried: new Set(p.tried || []),
    };
    L.scenMiss = L.scenMissIdx.map((i) => learnQ({ type: "sc", idx: i }));
    UI.L = L;
    if (L.phase === "quiz") {
      if (!L.queue.length) UI.L = { phase: "teach" };
      else {
        L.item = L.queue.shift();
        L.cur = learnQ(L.item);
      }
    }
  } catch (e) {
    UI.L = { phase: "teach" };
  }
}
