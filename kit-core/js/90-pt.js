/* Practice Test and exams. Sections sit behind their own top tabs. One question at a time with a numbered
   palette (gray = not visited, outlined = visited, green = correct, red = incorrect, amber = partly right,
   ring = current, corner mark = flagged). Question types: mcq, tf, label, diagram, frq, saq. */
const PT = { sec: 0, secs: [], timerOn: false, elapsed: 0, iv: null, retest: null, msg: "", intro: {}, res: null };
const TYPE_NAME = { mcq: "Multiple choice", tf: "True or false", label: "Labeling", diagram: "Diagram labeling", frq: "Free response", saq: "Short answer" };
const newSt = () => ({ elim: [], visited: false, checked: false, sel: null, correct: null, flag: false, items: {}, work: "", abox: "", ans: {}, revealed: false, mark: null, pm: {} });
const isWritten = (q) => q.type === "frq" || q.type === "saq";
const itemsOf = (q) => (q.type === "diagram" ? q.pins.map((p, i) => Object.assign({ t: "Pin " + (i + 1) }, p)) : q.items);

function initPT() {
  D.practice.sections.forEach((s) => {
    const sec = { name: s.name, mode: s.mode || "practice", exam: s.exam || s.name, tips: s.tips || [], examTips: s.examTips || [], sources: s.sources || {}, qs: s.questions, byId: {}, cur: 0, st: {}, oo: {} };
    sec.qs.forEach((q) => {
      if (q.type === "tf") {
        q.options = ["True", "False"];
        q.ai = q.ans ? 0 : 1;
      } else if (q.type === "mcq") q.ai = q.ans;
      sec.byId[q.id] = q;
      sec.st[q.id] = newSt();
      if (q.type === "mcq") sec.oo[q.id] = q.options.map((o, i) => i);
    });
    sec.orig = sec.qs.map((q) => q.id);
    sec.order = sec.orig.slice();
    PT.secs.push(sec);
  });
  PTload(readJSON(PTK));
}

/* Points earned on one question, 0 to 1, or null if not answered yet. Multi-part items earn partial credit. */
function frac(q, s) {
  if (isWritten(q)) {
    const ks = q.parts.map((p) => p.k),
      pm = s.pm || {};
    if (ks.every((k) => pm[k] !== undefined)) return ks.filter((k) => pm[k]).length / ks.length;
    return null;
  }
  if (q.type === "label" || q.type === "diagram") {
    const it = itemsOf(q);
    return s.checked ? it.filter((x, i) => s.items[i] === x.ans).length / it.length : null;
  }
  return s.checked ? (s.correct ? 1 : 0) : null;
}
function status(q, s) {
  const f = frac(q, s);
  if (f !== null) return f === 1 ? "ok" : f === 0 ? "bad" : "partial";
  return s.visited ? "vis" : "new";
}
const ptMode = () => (UI.tab === "exam" ? "exam" : "practice");
function curView() {
  const sec = PT.secs[PT.sec],
    R = PT.retest && PT.retest.sec === PT.sec ? PT.retest : null;
  return { sec: sec, R: R, ids: R ? R.ids : sec.order, st: R ? R.st : sec.st, h: R || sec };
}
function cur3() {
  const v = curView(),
    id = v.ids[v.h.cur];
  return { v: v, id: id, q: v.sec.byId[id], s: v.st[id] };
}
function secScore(sec, ids, st) {
  let pts = 0,
    n = 0;
  ids.forEach((id) => {
    const f = frac(sec.byId[id], st[id]);
    if (f !== null) {
      n++;
      pts += f;
    }
  });
  return fmt1(pts) + " of " + plural(n, "point") + " so far";
}
const fmtT = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const ul = (a) => "<ol>" + a.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ol>";

function srcImg(key) {
  if (!key || !D.images) return "";
  return D.images[key] || D.images[String(key).replace(/^map_/, "")] || "";
}
function srcHTML(s) {
  if (!s) return "";
  let h = '<figure class="src"><figcaption><b>' + esc(s.title) + "</b>" + (s.attr ? '<span class="sattr">' + esc(s.attr) + "</span>" : "") + (s.label ? '<span class="slab">' + esc(s.label) + "</span>" : "") + "</figcaption>";
  const img = srcImg(s.img);
  if (img) h += '<img class="srcimg" alt="' + esc(s.alt || s.title) + '" src="' + img + '">';
  if (s.table) h += tableHTML({ rows: s.table });
  else if (s.paras) h += s.paras.map((p, i) => '<p class="stext"><span class="pn">Paragraph ' + (i + 1) + "</span> " + esc(p) + "</p>").join("");
  else if (s.text) h += '<p class="stext">' + esc(s.text) + "</p>";
  return h + "</figure>";
}
function introHTML(sec) {
  if (!sec.tips.length && !sec.examTips.length) return "";
  const open = !!PT.intro[sec.name];
  let h =
    '<div class="intro"><button class="lnk disclose" data-act="ptintro" aria-expanded="' +
    open +
    '">' +
    ICON.chev +
    (sec.examTips.length ? "How to take this test" : "How to attack these questions") +
    "</button>";
  if (open) {
    if (sec.examTips.length) h += ul(sec.examTips) + (sec.tips.length ? "<h4>Question tips</h4>" : "");
    h += ul(sec.tips);
  }
  return h + "</div>";
}

/* ---------- one question ---------- */
function choiceQHTML(q, s, sec, id, nav, topic) {
  const order = q.type === "mcq" ? sec.oo[id] : [0, 1];
  let h = '<div class="stem">' + esc(q.stem) + '</div><div class="opts' + (q.type === "tf" ? " tf" : "") + '">';
  order.forEach((oi, pos) => {
    let c = "opt";
    const ex = s.elim.indexOf(oi) >= 0;
    if (s.checked) {
      if (oi === q.ai) c += " right";
      else if (oi === s.sel) c += " wrong";
    } else if (oi === s.sel && !ex) c += " sel";
    h += q.type === "mcq" ? optRow(c, "ptopt", oi, LET[pos], esc(q.options[oi]), "ptelim", ex, s.checked) : '<div class="optrow"><button class="' + c + '" data-act="ptopt" data-k="' + oi + '"' + (s.checked ? " disabled" : "") + '><span class="ot">' + q.options[oi] + "</span></button></div>";
  });
  h += '</div><div class="qnav">';
  if (!s.checked && SAVE.settings.confirm) h += '<button class="btn" data-act="ptcheck"' + (s.sel === null ? " disabled" : "") + ">Check Answer</button>";
  h += nav + "</div>";
  if (s.checked) {
    h += '<div class="fb ' + (s.correct ? "ok" : "bad") + '"><b>' + (s.correct ? "Correct." : "Incorrect.") + "</b>" + (q.type === "tf" ? " The statement is " + (q.ans ? "true." : "false.") : "") + topic + "</div>";
    if (q.type === "mcq") {
      const od = sec.oo[id].map((oi) => ({ t: q.options[oi], ok: oi === q.ai, why: oi === q.ai ? "" : (q.why && q.why[oi]) || "" }));
      h += whyHTML(od, sec.oo[id].indexOf(s.sel), esc(q.exp));
    } else h += '<div class="why good"><p>' + esc(q.exp) + "</p></div>";
  }
  return h;
}
function labelRowsHTML(q, s) {
  return (
    '<ol class="litems">' +
    itemsOf(q)
      .map((it, i) => {
        const sel = s.items[i],
          right = s.checked && sel === it.ans;
        return (
          '<li class="litem' +
          (q.type === "diagram" ? " pinrow" : "") +
          (s.checked ? (right ? " right" : " wrong") : "") +
          '"><span class="lt"><span class="ln">' +
          (i + 1) +
          "</span>" +
          esc(q.type === "diagram" ? "" : it.t) +
          '</span><span class="lbtns" role="group" aria-label="Label for item ' +
          (i + 1) +
          '">' +
          q.labels
            .map((lb, k) => {
              let c = "lb";
              if (s.checked) {
                if (k === it.ans) c += " right";
                else if (k === sel) c += " wrong";
              } else if (k === sel) c += " sel";
              return '<button class="' + c + '" data-act="ptitem" data-i="' + i + '" data-v="' + k + '"' + (s.checked ? " disabled" : "") + ' aria-pressed="' + (k === sel) + '">' + esc(lb) + "</button>";
            })
            .join("") +
          "</span>" +
          (s.checked ? '<span class="lfb">' + (right ? "<b>Correct.</b> " : "<b>Answer: " + esc(q.labels[it.ans]) + ".</b> ") + esc(it.exp || "") + "</span>" : "") +
          "</li>"
        );
      })
      .join("") +
    "</ol>"
  );
}
function diagramHTML(q, s) {
  return (
    '<figure class="diagram"><div class="dimg"><img src="' +
    srcImg(q.img) +
    '" alt="' +
    esc(q.alt || "Diagram for this question") +
    '">' +
    q.pins
      .map((p, i) => {
        const st = s.checked ? (s.items[i] === p.ans ? " right" : " wrong") : s.items[i] !== undefined ? " set" : "";
        return '<span class="pin' + st + '" style="left:' + p.x + "%;top:" + p.y + '%">' + (i + 1) + "</span>";
      })
      .join("") +
    "</div>" +
    (q.credit ? '<figcaption class="credit">' + esc(q.credit) + "</figcaption>" : "") +
    "</figure>"
  );
}
function writtenHTML(q, s, nav, topic) {
  let h = q.title ? '<h3 class="qhead">' + esc(q.title) + "</h3>" : "";
  if (q.stem) h += '<div class="stem">' + esc(q.stem) + "</div>";
  if (q.lead) h += '<p class="stem">' + esc(q.lead) + "</p>";
  if (q.data && q.data.length) h += '<figure class="src"><figcaption><b>Data</b></figcaption>' + q.data.map((d) => "<p>" + esc(d) + "</p>").join("") + "</figure>";
  if (q.type === "frq") {
    h += '<ol class="fparts" type="a">' + q.parts.map((p) => "<li>" + esc(p.prompt) + "</li>").join("") + "</ol>";
    h += '<label class="part"><span class="pl">Work area <small>Show your steps and reasoning.</small></span><textarea rows="7" data-ans="work">' + esc(s.work) + "</textarea></label>";
    h += '<label class="part"><span class="pl">Answer box <small>Final answers, labeled a, b, c.</small></span><textarea rows="4" data-ans="abox">' + esc(s.abox) + "</textarea></label>";
  } else
    q.parts.forEach((p) => {
      h += '<label class="part"><span class="pl">(' + esc(p.k) + ") " + esc(p.prompt) + '</span><textarea rows="4" data-ans="' + esc(p.k) + '" placeholder="Complete sentences: topic sentence, evidence, analysis.">' + esc(s.ans[p.k] || "") + "</textarea></label>";
    });
  h += '<div class="qnav"><button class="btn" data-act="ptcheck"' + (s.revealed ? " disabled" : "") + ">Check Answer</button>" + nav + "</div>";
  if (!s.revealed) return h;
  h += '<div class="model"><h4>' + (q.type === "saq" ? "Model answers" : "Worked solution") + "</h4>";
  q.parts.forEach((p) => {
    h += '<div class="mpart"><p class="mk-q"><b>(' + esc(p.k) + ")</b> " + esc(p.prompt) + (p.skill ? ' <span class="skill">' + esc(p.skill) + "</span>" : "") + "</p>";
    if (p.tea)
      h +=
        '<dl class="tea"><div><dt>Topic sentence</dt><dd>' +
        esc(p.tea[0]) +
        "</dd></div><div><dt>Evidence</dt><dd>" +
        esc(p.tea[1]) +
        "</dd></div><div><dt>Analysis</dt><dd>" +
        esc(p.tea[2]) +
        "</dd></div></dl>";
    else h += "<p>" + esc(p.model) + "</p>";
    if (p.earns) h += '<p class="earns"><b>Earns the point if:</b> ' + esc(p.earns) + "</p>";
    if (p.weak) h += '<p class="weak"><b>Weak answer:</b> ' + esc(p.weak) + "</p>";
    h +=
      '<div class="selfmark" role="group" aria-label="Self-mark part ' +
      esc(p.k) +
      '"><span>Part (' +
      esc(p.k) +
      ')</span><button class="mk' +
      (s.pm[p.k] === true ? " on right" : "") +
      '" data-act="ptpart" data-p="' +
      esc(p.k) +
      '" data-v="1" aria-pressed="' +
      (s.pm[p.k] === true) +
      '">I got it</button><button class="mk' +
      (s.pm[p.k] === false ? " on wrong" : "") +
      '" data-act="ptpart" data-p="' +
      esc(p.k) +
      '" data-v="0" aria-pressed="' +
      (s.pm[p.k] === false) +
      '">I missed it</button></div></div>';
  });
  const f = frac(q, s);
  h += '<div class="qnav"><button class="mk" data-act="ptmark" data-v="1">All parts right</button><button class="mk" data-act="ptmark" data-v="0">All parts wrong</button></div>';
  if (f !== null) h += '<div class="fb' + (f === 1 ? " ok" : f === 0 ? " bad" : "") + '"><b>' + fmt1(f * q.parts.length) + " of " + q.parts.length + " parts</b> counted." + topic + "</div>";
  return h + "</div>";
}

function ptSectionHTML() {
  const M = ptMode();
  if (!PT.secs[PT.sec] || PT.secs[PT.sec].mode !== M) PT.sec = Math.max(0, PT.secs.findIndex((x) => x.mode === M));
  const v = curView(),
    sec = v.sec,
    ids = v.ids,
    st = v.st,
    hd = v.h;
  if (hd.cur >= ids.length) hd.cur = Math.max(0, ids.length - 1);
  const id = ids[hd.cur],
    q = sec.byId[id],
    s = st[id];
  s.visited = true;
  let h = '<section class="panel pt"><div class="rtop"><h2>' + esc(sec.name) + '</h2><span class="score">' + secScore(sec, ids, st) + "</span></div>";
  if (v.R)
    h +=
      '<div class="banner">Retest round: ' +
      ids.filter((i) => status(sec.byId[i], st[i]) === "ok").length +
      " of " +
      ids.length +
      ' now correct. Right answers here update the main section. <button class="lnk" data-act="ptendretest">Back to the full section</button></div>';
  h += introHTML(sec);
  h +=
    '<div class="pals" role="group" aria-label="Questions">' +
    ids
      .map(
        (x, n) =>
          '<button class="pal ' +
          status(sec.byId[x], st[x]) +
          (st[x].flag ? " flag" : "") +
          '" data-act="ptjump" data-n="' +
          n +
          '"' +
          (n === hd.cur ? ' aria-current="step"' : "") +
          ' aria-label="Question ' +
          (n + 1) +
          (st[x].flag ? ", flagged" : "") +
          '">' +
          (n + 1) +
          "</button>",
      )
      .join("") +
    "</div>";
  h += '<p class="qtitle">Question ' + (hd.cur + 1) + " of " + ids.length + ", " + TYPE_NAME[q.type] + "</p>";
  h += srcHTML(q.src ? sec.sources[q.src] : null);
  const nav =
    '<button class="btn sec" data-act="ptprev"' +
    (hd.cur === 0 ? " disabled" : "") +
    ">Previous</button>" +
    '<button class="btn sec" data-act="ptnext"' +
    (hd.cur >= ids.length - 1 ? " disabled" : "") +
    ">Next</button>" +
    '<button class="btn ghost" data-act="ptflag" aria-pressed="' +
    !!s.flag +
    '">' +
    ICON.flag +
    (s.flag ? "Flagged" : "Flag for review") +
    "</button>";
  const tp = q.topic || q.skill;
  const topic = tp ? ' <span class="skill">' + esc(tp) + "</span>" : "";
  if (q.type === "mcq" || q.type === "tf") h += choiceQHTML(q, s, sec, id, nav, topic);
  else if (q.type === "label" || q.type === "diagram") {
    h += '<div class="stem">' + esc(q.stem) + "</div>";
    if (q.type === "diagram") h += diagramHTML(q, s);
    h += labelRowsHTML(q, s);
    const all = itemsOf(q).every((it, i) => s.items[i] !== undefined);
    h += '<div class="qnav"><button class="btn" data-act="ptcheck"' + (!all || s.checked ? " disabled" : "") + ">Check Answer</button>" + nav + "</div>";
    if (s.checked) {
      const it = itemsOf(q),
        n = it.filter((x, i) => s.items[i] === x.ans).length;
      h += '<div class="fb' + (s.correct ? " ok" : n ? "" : " bad") + '"><b>' + n + " of " + it.length + " correct.</b> You earn " + fmt1(n / it.length) + " of 1 point." + topic + "</div>";
    }
  } else h += writtenHTML(q, s, nav, topic);
  return h + "</section>";
}

function ptControls(M) {
  const sec = PT.secs[PT.sec];
  return (
    '<div class="ptctl"><button class="btn ghost" data-act="pttimer" aria-pressed="' +
    PT.timerOn +
    '">' +
    ICON.clock +
    (PT.timerOn ? '<span id="pttime">' + fmtT(PT.elapsed) + "</span>" : "Timer off") +
    '</button><button class="btn ghost" data-act="ptshuffle" aria-pressed="' +
    !!sec.shuffled +
    '">' +
    ICON.shuffle +
    (sec.shuffled ? "Shuffled" : "Shuffle questions") +
    "</button>" +
    (sec.shuffled ? '<button class="btn ghost" data-act="ptunshuffle">' + ICON.undo + "Original order</button>" : "") +
    '<button class="btn ghost" data-act="ptretest">' +
    ICON.redo +
    'Retest missed questions</button><button class="btn ghost" data-act="ptprint">' +
    ICON.print +
    'Print view</button><button class="btn ghost" data-act="ptresetsec">Reset section</button><button class="btn ghost danger" data-act="ptresetall">' +
    (M === "exam" ? "Reset entire exam" : "Reset entire test") +
    "</button></div>"
  );
}
function examGroups() {
  const g = [];
  PT.secs.forEach((x) => {
    if (x.mode === "exam" && g.indexOf(x.exam) < 0) g.push(x.exam);
  });
  return g;
}
function ptHTML() {
  const M = ptMode();
  const groups = M === "exam" ? examGroups() : [];
  const showRes = M === "exam" && PT.res != null && groups.indexOf(PT.res) >= 0;
  let h =
    '<div class="subtabs" role="tablist">' +
    PT.secs
      .map((x, i) =>
        x.mode !== M ? "" : '<button class="stab" role="tab" data-act="ptsec" data-i="' + i + '" aria-selected="' + (!showRes && i === PT.sec) + '">' + esc(x.name) + "</button>",
      )
      .join("") +
    groups.map((g) => '<button class="stab res" role="tab" data-act="ptres" data-g="' + esc(g) + '" aria-selected="' + (showRes && PT.res === g) + '">' + esc(g) + " results</button>").join("") +
    "</div>";
  if (showRes) return h + resHTML(PT.res);
  if (!PT.secs.some((x) => x.mode === M)) return h + '<section class="panel"><p class="muted">No sections here yet.</p></section>';
  h += ptControls(M) + (PT.msg ? '<p class="msg">' + esc(PT.msg) + "</p>" : "");
  PT.msg = "";
  h += ptSectionHTML();
  if (M === "exam") h += '<div class="qnav"><button class="btn" data-act="ptres" data-g="' + esc(PT.secs[PT.sec].exam) + '">Finish and see ' + esc(PT.secs[PT.sec].exam) + " results</button></div>";
  return h;
}

/* ---------- actions ---------- */
function PTinput(t) {
  const c = cur3(),
    k = t.dataset.ans;
  if (k === "work" || k === "abox") c.s[k] = t.value;
  else c.s.ans[k] = t.value;
  PTsave();
}
/* A right answer in a retest round also updates the main section. */
function syncMain() {
  const R = PT.retest;
  if (!R || R.sec !== PT.sec) return;
  const sec = PT.secs[R.sec],
    c = cur3(),
    m = sec.st[c.id],
    r = R.st[c.id];
  if (frac(c.q, r) === 1) {
    Object.assign(m, { checked: r.checked, correct: r.correct, sel: r.sel, revealed: r.revealed, mark: r.mark });
    m.items = Object.assign({}, r.items);
    m.pm = Object.assign({}, r.pm);
  }
}
function checkCur() {
  const c = cur3();
  if (isWritten(c.q)) c.s.revealed = true;
  else if (c.q.type === "label" || c.q.type === "diagram") {
    const it = itemsOf(c.q);
    if (c.s.checked || !it.every((x, i) => c.s.items[i] !== undefined)) return;
    c.s.checked = true;
    c.s.correct = it.every((x, i) => c.s.items[i] === x.ans);
  } else {
    if (c.s.sel === null || c.s.checked) return;
    c.s.checked = true;
    c.s.correct = c.s.sel === c.q.ai;
  }
  syncMain();
  render();
}
ACT.ptsec = (t) => {
  PT.res = null;
  PT.sec = Number(t.dataset.i);
  render();
};
ACT.ptres = (t) => {
  PT.res = t.dataset.g;
  render();
  window.scrollTo(0, 0);
};
ACT.ptintro = () => {
  const n = PT.secs[PT.sec].name;
  PT.intro[n] = !PT.intro[n];
  render();
};
ACT.ptjump = (t) => {
  curView().h.cur = Number(t.dataset.n);
  render();
};
ACT.ptprev = () => {
  const v = curView();
  if (v.h.cur > 0) v.h.cur--;
  render();
};
ACT.ptnext = () => {
  const v = curView();
  if (v.h.cur < v.ids.length - 1) v.h.cur++;
  render();
};
ACT.ptopt = (t) => {
  const c = cur3(),
    o = Number(t.dataset.k);
  if (c.s.checked || c.s.elim.indexOf(o) >= 0) return;
  c.s.sel = o;
  if (!SAVE.settings.confirm) return checkCur();
  render();
};
ACT.ptcheck = checkCur;
ACT.ptelim = (t) => {
  const c = cur3();
  if (c.s.checked) return;
  const o = Number(t.dataset.k);
  toggleElim(c.s.elim, o);
  if (c.s.sel === o) c.s.sel = null;
  render();
};
ACT.ptitem = (t) => {
  const c = cur3();
  if (c.s.checked) return;
  c.s.items[Number(t.dataset.i)] = Number(t.dataset.v);
  render();
};
ACT.ptmark = (t) => {
  const c = cur3(),
    v = t.dataset.v === "1";
  c.s.mark = v;
  c.q.parts.forEach((p) => (c.s.pm[p.k] = v));
  syncMain();
  render();
};
ACT.ptpart = (t) => {
  const c = cur3();
  c.s.pm[t.dataset.p] = t.dataset.v === "1";
  c.s.mark = null;
  syncMain();
  render();
};
ACT.ptflag = () => {
  const c = cur3();
  c.s.flag = !c.s.flag;
  render();
};
ACT.ptshuffle = () => {
  const sec = PT.secs[PT.sec];
  sec.order = shuf(sec.orig);
  sec.cur = 0;
  sec.qs.forEach((q) => q.type === "mcq" && (sec.oo[q.id] = shuf(q.options.map((o, i) => i))));
  sec.shuffled = true;
  PT.retest = null;
  render();
};
ACT.ptunshuffle = () => {
  const sec = PT.secs[PT.sec];
  sec.order = sec.orig.slice();
  sec.cur = 0;
  sec.qs.forEach((q) => q.type === "mcq" && (sec.oo[q.id] = q.options.map((o, i) => i)));
  sec.shuffled = false;
  PT.retest = null;
  render();
};
function freshSec(sec) {
  sec.qs.forEach((q) => (sec.st[q.id] = newSt()));
  sec.cur = 0;
}
ACT.ptresetsec = () => {
  if (!ask("Clear every answer in " + PT.secs[PT.sec].name + "?")) return;
  freshSec(PT.secs[PT.sec]);
  if (PT.retest && PT.retest.sec === PT.sec) PT.retest = null;
  render();
};
ACT.ptresetall = () => {
  const M = ptMode();
  if (!ask(M === "exam" ? "Clear every answer in every exam section?" : "Clear every answer in every practice section?")) return;
  PT.secs.forEach((x) => x.mode === M && freshSec(x));
  PT.retest = null;
  PT.elapsed = 0;
  render();
};
ACT.ptretest = () => {
  const sec = PT.secs[PT.sec],
    ids = sec.order.filter((id) => ["bad", "partial"].indexOf(status(sec.byId[id], sec.st[id])) >= 0);
  if (!ids.length) {
    PT.msg = "No missed questions in this section yet. Check some answers first.";
    return render();
  }
  const st = {};
  ids.forEach((id) => (st[id] = newSt()));
  PT.retest = { sec: PT.sec, ids: ids, st: st, cur: 0 };
  render();
};
ACT.ptendretest = () => {
  PT.retest = null;
  render();
};
function tick() {
  PT.elapsed++;
  const e = document.getElementById("pttime");
  if (e) e.textContent = fmtT(PT.elapsed);
  if (PT.elapsed % 5 === 0) PTsave();
}
ACT.pttimer = () => {
  PT.timerOn = !PT.timerOn;
  clearInterval(PT.iv);
  if (PT.timerOn) PT.iv = setInterval(tick, 1000);
  render();
};

/* ---------- printable view ---------- */
ACT.ptprint = () => {
  const sec = PT.secs[PT.sec],
    seen = {};
  let b = "";
  sec.order.forEach((id, n) => {
    const q = sec.byId[id];
    if (q.src && !seen[q.src]) {
      seen[q.src] = 1;
      b += srcHTML(sec.sources[q.src]);
    }
    b += '<div class="q"><b>' + (n + 1) + ".</b> ";
    if (q.type === "mcq") b += esc(q.stem) + sec.oo[id].map((oi, pos) => "<div>" + LET[pos] + ". " + esc(q.options[oi]) + "</div>").join("");
    else if (q.type === "tf") b += "True or false: " + esc(q.stem);
    else if (q.type === "label" || q.type === "diagram")
      b +=
        esc(q.stem) +
        " (" +
        q.labels.map(esc).join(" / ") +
        ")" +
        (q.type === "diagram" ? '<div><img style="max-width:100%" src="' + srcImg(q.img) + '"></div><p>' + esc(q.credit || "") + "</p>" : "") +
        itemsOf(q)
          .map((it, i) => "<div>" + (i + 1) + ". " + esc(q.type === "diagram" ? "Pin " + (i + 1) : it.t) + " ______________</div>")
          .join("");
    else
      b +=
        esc(q.title || q.lead || "") +
        " " +
        esc(q.stem || "") +
        (q.data && q.data.length ? '<div class="src">' + q.data.map(esc).join("<br>") + "</div>" : "") +
        q.parts.map((p) => "<p>(" + esc(p.k) + ") " + esc(p.prompt) + '</p><div class="ln"></div><div class="ln"></div><div class="ln"></div>').join("");
    b += "</div>";
  });
  const w = window.open("", "_blank");
  if (!w) {
    PT.msg = "Your browser blocked the print window. Allow pop-ups for this page and try again.";
    return render();
  }
  w.document.write(
    "<!doctype html><html><head><meta charset=utf-8><title>" +
      esc(sec.name) +
      "</title><style>body{font:15px/1.5 Georgia,serif;margin:28px;max-width:46rem}.src{border:1px solid #888;padding:10px;margin:14px 0}figcaption span{display:block;font-size:13px;color:#444}.q{margin:16px 0;break-inside:avoid}.ln{border-bottom:1px solid #999;height:26px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #888;padding:4px 8px}</style></head><body><h2>" +
      esc(COURSE.name + ", " + UNIT.label + ": " + sec.name) +
      "</h2>" +
      b +
      "</body></html>",
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
};

/* ---------- saving ---------- */
function PTpack() {
  return {
    sec: PT.sec,
    timerOn: PT.timerOn,
    elapsed: PT.elapsed,
    intro: PT.intro,
    secs: PT.secs.map((s) => ({ name: s.name, order: s.order, cur: s.cur, st: s.st, oo: s.oo, shuffled: !!s.shuffled })),
    retest: PT.retest ? { sec: PT.retest.sec, ids: PT.retest.ids, st: PT.retest.st, cur: PT.retest.cur } : null,
  };
}
function PTsave() {
  if (PTK) writeJSON(PTK, PTpack());
}
function PTload(o) {
  try {
    if (!o || !o.secs) return;
    o.secs.forEach((x) => {
      const s = PT.secs.find((y) => y.name === x.name);
      if (!s) return;
      if (Array.isArray(x.order) && x.order.length === s.orig.length && x.order.every((id) => s.byId[id])) s.order = x.order;
      if (typeof x.cur === "number") s.cur = Math.min(Math.max(0, x.cur), s.order.length - 1);
      s.shuffled = x.shuffled === undefined ? !!o.shuffled : !!x.shuffled;
      s.qs.forEach((q) => {
        const st = x.st && x.st[q.id];
        if (st && typeof st === "object") {
          const n = Object.assign(newSt(), st, { items: Object.assign({}, st.items || {}), pm: Object.assign({}, st.pm || {}), ans: Object.assign({}, st.ans || {}), elim: (st.elim || []).slice() });
          /* Old World SAQ saves kept per-part marks in "parts". */
          if (st.parts && q.type === "saq") Object.keys(st.parts).forEach((k) => st.parts[k] !== null && (n.pm[k] = st.parts[k]));
          if (st.ans && typeof st.ans === "object" && q.type === "saq") n.ans = Object.assign({}, st.ans);
          s.st[q.id] = n;
        }
        const oo = x.oo && x.oo[q.id];
        if (q.type === "mcq" && Array.isArray(oo) && oo.length === q.options.length) s.oo[q.id] = oo;
      });
    });
    if (typeof o.sec === "number" && PT.secs[o.sec]) PT.sec = o.sec;
    PT.intro = o.intro || {};
    PT.elapsed = Number(o.elapsed) || 0;
    PT.retest = null;
    if (o.retest && PT.secs[o.retest.sec] && Array.isArray(o.retest.ids)) {
      const rs = PT.secs[o.retest.sec];
      if (o.retest.ids.every((id) => rs.byId[id])) {
        PT.retest = { sec: o.retest.sec, ids: o.retest.ids, st: {}, cur: o.retest.cur || 0 };
        o.retest.ids.forEach((id) => (PT.retest.st[id] = Object.assign(newSt(), (o.retest.st || {})[id] || {})));
      }
    }
    if (o.timerOn && !PT.timerOn) {
      PT.timerOn = true;
      PT.iv = setInterval(tick, 1000);
    }
  } catch (e) {}
}
function PTreset() {
  PT.secs.forEach((s) => {
    s.qs.forEach((q) => {
      s.st[q.id] = newSt();
      if (q.type === "mcq") s.oo[q.id] = q.options.map((o, i) => i);
    });
    s.order = s.orig.slice();
    s.cur = 0;
    s.shuffled = false;
  });
  PT.retest = null;
  PT.elapsed = 0;
  PT.sec = 0;
  PTsave();
}
