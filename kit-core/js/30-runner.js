/* Question builders and the one-at-a-time runner used by Quiz, the final mixed quiz and retries. */
let FC = null,
  TM = null;
const LET = "ABCDE";
function stopTM() {
  clearInterval(TM);
  TM = null;
}
function pickDir() {
  const d = SAVE.settings.dir;
  return d === "both" ? (Math.random() < 0.5 ? "t2d" : "d2t") : d;
}
/* Distractors come from the same section first, then the same deck, then anywhere, preferring similar lengths
   so the right answer never stands out by length. */
function distractors(card, n, field) {
  const target = card[field];
  const tiers = [
    ALL.filter((c) => c !== card && c.sec === card.sec),
    ALL.filter((c) => c !== card && c.deck === card.deck && c.sec !== card.sec),
    ALL.filter((c) => c.deck !== card.deck),
  ];
  const out = [];
  for (const tier of tiers) {
    const cand = shuf(tier);
    const close = cand.filter((c) => {
      const r = c[field].length / target.length;
      return r >= 0.7 && r <= 1.3;
    });
    const ord = close.concat(cand.filter((c) => close.indexOf(c) < 0));
    for (const c of ord) {
      if (out.length >= n) break;
      if (c[field] !== target && !out.some((o) => o[field] === c[field])) out.push(c);
    }
    if (out.length >= n) break;
  }
  return out;
}
function mcQ(card, dir, nopt) {
  dir = dir || pickDir();
  nopt = nopt || 4;
  const field = dir === "t2d" ? "def" : "term";
  const opts = shuf(
    [{ t: card[field], ok: true }].concat(
      distractors(card, nopt - 1, field).map((c) => ({
        t: c[field],
        ok: false,
        why:
          dir === "t2d"
            ? 'That description belongs to "' + c.term + '", not to "' + card.term + '".'
            : '"' + c.term + '" means: ' + c.def + ' That is a different idea from the description in the question, which fits "' + card.term + '".',
      })),
    ),
  );
  return {
    kind: "mc",
    card: card,
    dir: dir,
    ask: dir === "t2d" ? "Which description best matches this term?" : "Which term matches this description?",
    prompt: dir === "t2d" ? "<b>" + esc(card.term) + "</b>" : esc(card.def),
    options: opts,
    explain: "<b>" + esc(card.term) + "</b>: " + esc(card.def) + hookLine(card),
  };
}
function tfQ(card) {
  let isTrue = Math.random() < 0.5,
    other = null;
  if (!isTrue) {
    const pool = ALL.filter((c) => c !== card && c.sec === card.sec);
    const pool2 = pool.length ? pool : ALL.filter((c) => c !== card && c.deck === card.deck);
    if (pool2.length) other = shuf(pool2)[0];
    else isTrue = true;
  }
  return {
    kind: "tf",
    card: card,
    ask: "True or false: this definition matches the term.",
    prompt: "<b>" + esc(card.term) + "</b><br>" + esc(isTrue ? card.def : other.def),
    options: [
      { t: "True", ok: isTrue },
      { t: "False", ok: !isTrue },
    ],
    explain: (isTrue ? "True. " : "False. That definition belongs to <b>" + esc(other.term) + "</b>. ") + "<b>" + esc(card.term) + "</b>: " + esc(card.def),
  };
}
function scQ(s, ask) {
  return {
    kind: "sc",
    deck: s.deck,
    ask: ask || "Apply it",
    prompt: esc(s.q),
    options: shuf(s.opts.map((t, i) => ({ t: t, ok: i === s.ans, why: i === s.ans ? "" : (s.why && s.why[i]) || "" }))),
    explain: esc(s.exp),
  };
}
const hookLine = (c) => (SAVE.settings.hooks && c.hook ? '<span class="hook"><b>Hook</b> ' + esc(c.hook) + "</span>" : "");
const fresh = (q) => (q.kind === "mc" ? mcQ(q.card, q.dir, q.options.length) : q.kind === "tf" ? tfQ(q.card) : Object.assign({}, q, { elim: [] }));
/* A missed term comes back re-rolled: 35% chance it flips direction, always with reshuffled options. */
const reroll = (q) => mcQ(q.card, Math.random() < 0.35 ? (q.dir === "t2d" ? "d2t" : "t2d") : q.dir, q.options.length);

function startRun(cfg) {
  stopTM();
  UI.run = Object.assign({ i: 0, picked: null, sel: null, res: [], left: 0, done: false, fin: false }, cfg);
  armTM();
  render();
}
/* Per-question timer: running out counts as a miss. */
function armTM() {
  stopTM();
  const R = UI.run;
  if (!R || R.done || !R.timer) return;
  R.left = R.timer;
  TM = setInterval(() => {
    R.left--;
    const e = document.getElementById("rt");
    if (e) e.textContent = R.left + " s";
    if (R.left <= 0) {
      stopTM();
      if (R.picked === null) rpickAct(-1);
    }
  }, 1000);
}
function runHTML() {
  const R = UI.run;
  if (R.done) return resultHTML();
  const q = R.qs[R.i],
    n = R.qs.length,
    answered = R.picked !== null,
    confirmOn = SAVE.settings.confirm;
  let h =
    '<section class="panel"><div class="rtop"><h2>' +
    esc(R.title) +
    '</h2><span class="muted">Question ' +
    (R.i + 1) +
    " of " +
    n +
    "</span>" +
    (R.timer ? '<span class="timer">' + ICON.clock + '<span id="rt">' + R.left + " s</span></span>" : "") +
    '<button class="lnk" data-act="rquit">Quit</button></div>' +
    lockToggle();
  h += '<p class="qask">' + esc(q.ask) + '</p><div class="qprompt">' + q.prompt + '</div><div class="opts">';
  q.elim = q.elim || [];
  q.options.forEach((o, k) => {
    let c = "opt";
    if (answered && R.immediate) {
      if (o.ok) c += " right";
      else if (k === R.picked) c += " wrong";
    }
    if (!answered && confirmOn && R.sel === k) c += " sel";
    h += optRow(c, "rpick", k, LET[k], esc(o.t), "relim", q.elim.indexOf(k) >= 0, answered);
  });
  h += "</div>";
  if (!answered && confirmOn) h += lockHTML("rconfirm", R.sel);
  if (answered && R.immediate) {
    const ok = R.picked >= 0 && q.options[R.picked].ok;
    h +=
      '<div class="fb ' +
      (ok ? "ok" : "bad") +
      '"><b>' +
      (R.picked < 0 ? "Time's up." : ok ? "Correct." : "Not quite.") +
      "</b> " +
      q.explain +
      "</div>" +
      (q.kind === "tf" ? "" : whyHTML(q.options, R.picked, "")) +
      '<div class="qnav"><button class="btn" data-act="rnext">' +
      (R.i + 1 < n ? "Next" : "See results") +
      "</button></div>";
  }
  return h + '</section><p class="kbd">Keys: A to E or 1 to 5 picks a choice. Enter locks it in, then goes to the next question.</p>';
}
function resultHTML() {
  const R = UI.run,
    first = R.res.filter((r) => !r.q.tries),
    ok = first.filter((r) => r.ok).length,
    miss = first.filter((r) => !r.ok);
  let h =
    '<section class="panel"><h2>' +
    esc(R.title) +
    ': results</h2><p class="big">' +
    ok +
    " of " +
    first.length +
    " right on the first try (" +
    (first.length ? Math.round((ok / first.length) * 100) : 0) +
    "%)</p>";
  if (R.breakdown) h += breakdownHTML(R);
  if (miss.length) {
    h += "<h3>Review these</h3>";
    miss.forEach((r) => {
      const c = r.q.options.find((o) => o.ok);
      h += '<div class="rev"><div class="qprompt">' + r.q.prompt + "</div><p><b>Answer:</b> " + esc(c.t) + '</p><p class="muted">' + r.q.explain + "</p></div>";
    });
  }
  h +=
    '<div class="qnav">' +
    (miss.length && !R.noRetry ? '<button class="btn" data-act="rretry">Retry the ' + plural(miss.length, "missed question") + "</button>" : "") +
    (R.again ? '<button class="btn sec" data-act="qagain">Same settings, new quiz</button>' : "") +
    '<button class="btn sec" data-act="rdone">Back</button></div></section>';
  return h;
}
function rpickAct(k) {
  const R = UI.run;
  if (!R || R.picked !== null || R.done) return;
  stopTM();
  const q = R.qs[R.i],
    ok = k >= 0 && !!q.options[k].ok;
  R.picked = k;
  R.res.push({ q: q, ok: ok });
  if (q.card) {
    const id = q.card.id;
    if (!ok) SAVE.trouble[id] = (SAVE.trouble[id] || 0) + 1;
    else if (SAVE.trouble[id]) SAVE.trouble[id] = Math.max(0, SAVE.trouble[id] - 1);
    save();
  }
  if (!ok && R.retry && q.kind === "mc" && (q.tries || 0) < 3) {
    const nq = reroll(q);
    nq.tries = (q.tries || 0) + 1;
    R.qs.splice(Math.min(R.qs.length, R.i + 3), 0, nq);
  }
  if (R.immediate) render();
  else rnext();
}
function rnext() {
  const R = UI.run;
  R.i++;
  R.picked = null;
  R.sel = null;
  if (R.i >= R.qs.length) {
    R.done = true;
    stopTM();
  } else armTM();
  render();
}
ACT.rpick = (t) => {
  const R = UI.run,
    k = Number(t.dataset.k);
  if (!R || R.picked !== null || R.done) return;
  if (SAVE.settings.confirm) {
    R.sel = k;
    render();
  } else rpickAct(k);
};
ACT.rconfirm = () => {
  const R = UI.run;
  if (R && R.picked === null && R.sel != null) rpickAct(R.sel);
};
ACT.relim = (t) => {
  const R = UI.run;
  if (!R || R.picked !== null) return;
  const q = R.qs[R.i],
    k = Number(t.dataset.k);
  toggleElim((q.elim = q.elim || []), k);
  if (R.sel === k) R.sel = null;
  render();
};
ACT.rnext = () => UI.run && UI.run.picked !== null && rnext();
ACT.rquit = ACT.rdone = () => {
  stopTM();
  UI.run = null;
  render();
};
ACT.rretry = () => {
  const R = UI.run,
    miss = R.res.filter((r) => !r.q.tries && !r.ok).map((r) => fresh(r.q));
  startRun({ title: R.title + " (retry)", qs: miss, immediate: true, timer: R.timer, retry: false, noRetry: true, breakdown: R.breakdown });
};

/* Shared keyboard: Learn quiz and the runner. */
document.addEventListener("keydown", (e) => {
  if (!UNIT || e.metaKey || e.ctrlKey || e.altKey) return;
  const tg = e.target && e.target.tagName;
  if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  let ctx = null;
  if (UI.run && !UI.run.done) {
    const R = UI.run;
    ctx = { q: R.qs[R.i], picked: R.picked, sel: R.sel, setSel: (i) => (R.sel = i), pick: rpickAct, next: ACT.rnext, immediate: R.immediate };
  } else if (UI.tab === "learn" && UI.L && UI.L.phase === "quiz") {
    const L = UI.L;
    ctx = { q: L.cur, picked: L.picked, sel: L.sel, setSel: (i) => (L.sel = i), pick: learnPick, next: ACT.lnext, immediate: true };
  }
  if (!ctx || !ctx.q) return;
  if (ctx.picked === null) {
    const k = "abcde".indexOf(e.key.toLowerCase()),
      n = "12345".indexOf(e.key),
      i = k >= 0 ? k : n;
    if (i >= 0 && i < ctx.q.options.length && (ctx.q.elim || []).indexOf(i) < 0) {
      e.preventDefault();
      if (SAVE.settings.confirm) {
        ctx.setSel(i);
        render();
      } else ctx.pick(i);
    } else if (e.key === "Enter" && SAVE.settings.confirm && ctx.sel != null) {
      e.preventDefault();
      ctx.pick(ctx.sel);
    }
  } else if (e.key === "Enter" && ctx.immediate) {
    e.preventDefault();
    ctx.next();
  }
});
