/* Free-response unit (AP Psych AAQ & EBQ): its own simple page instead of the Practice Test tabs.
   A unit turns this on with an fr.json file: { items: [...wfr questions, each with its source], guide: {aaq, ebq},
   links: {short, past} }. Two things to do:
   - Practice: one question at a time. Check grades every part (the key-word checker, or Gemini with a key),
     shows what was missed and a model answer; Next gives one not done yet.
   - Mock exam: 1 AAQ + 1 EBQ on one countdown clock, like Section II of the real exam (70 minutes, or
     +50% / +100% extended time). The clock is pinned at the top and can be hidden; it comes back and turns red
     at 5 minutes left. Answers are graded when the student submits or time runs out.
   Saved per unit in sk:<course>:<unit>:fr. Grading lives in 92-frqcheck.js, Gemini in 93-gemini.js. */
const FR_MIN = 70;
/* What to take: the full Section II, or one question on College Board's suggested time for it. */
const FR_TAKE = [
  ["both", "Full Section II: 1 AAQ + 1 EBQ", 70],
  ["aaq", "AAQ only", 25],
  ["ebq", "EBQ only", 45],
];
const frTakeMin = (k) => (FR_TAKE.find((x) => x[0] === k) || FR_TAKE[0])[2];
const frMinText = (n) => {
  const h = Math.floor(n / 60),
    mm = n % 60;
  return (h ? plural(h, "hour") + (mm ? " " : "") : "") + (mm ? plural(mm, "minute") : "");
};
const FR_MULTS = [
  [1, "Regular time"],
  [1.5, "+50% extended time"],
  [2, "+100% extended time"],
];
const FR = { view: "home", kind: "aaq", cur: {}, st: {}, done: {}, mock: null, msg: "", iv: null, gen: false };
const FRK = () => "sk:" + COURSE.id + ":" + UNIT.id + ":fr";
const hasFR = () => !!(D && D.fr);
const frNewSt = () => ({ ans: {}, auto: null, ai: null, pm: {}, revealed: false, aiErr: "", aiLoading: false });

function frItems(kind) {
  const ours = D.fr.items.filter((q) => q.grader === kind);
  const gen = typeof gemGenerated === "function" ? gemGenerated(kind).map((g) => Object.assign({}, g.q, { source: g.src })) : [];
  return gen.concat(ours);
}
const frById = (id) => frItems("aaq").concat(frItems("ebq")).find((q) => q.id === id);
const frKindName = (k) => (k === "ebq" ? "EBQ" : "AAQ");
const frMax = (q) => q.parts.reduce((n, p) => n + (p.max || 1), 0);

function frLoad() {
  const o = readJSON(FRK()) || {};
  FR.cur = o.cur || {};
  FR.st = o.st || {};
  FR.done = o.done || {};
  FR.mock = o.mock || null;
  FR.view = o.view === "mock" && FR.mock ? "mock" : o.view === "practice" ? "practice" : "home";
  FR.kind = o.kind === "ebq" ? "ebq" : "aaq";
  Object.values(FR.st).forEach((s) => (s.aiLoading = false));
  if (FR.mock) Object.values(FR.mock.st || {}).forEach((s) => (s.aiLoading = false));
}
function frSave() {
  writeJSON(FRK(), { cur: FR.cur, st: FR.st, done: FR.done, mock: FR.mock, view: FR.view, kind: FR.kind });
}
/* The next question of a kind: the first one not done yet, else (all done) any other one. */
function frPick(kind, avoid, ownOnly) {
  const pool = ownOnly ? D.fr.items.filter((q) => q.grader === kind) : frItems(kind),
    fresh = pool.filter((q) => !FR.done[q.id] && avoid.indexOf(q.id) < 0);
  if (fresh.length) return fresh[0].id;
  const rest = pool.filter((q) => avoid.indexOf(q.id) < 0);
  return (rest.length ? rest[Math.floor(Math.random() * rest.length)] : pool[0]).id;
}

/* ---------- the article / sources ---------- */
/* Article text: blank lines split paragraphs; "## " lines are subheadings, "- " lines bullets, "1. " numbered,
   and "| a | b |" lines a table (first row is the header; a "Table:" line just above is its title). */
function frDocHTML(text) {
  const lines = String(text || "").split("\n");
  let h = "",
    i = 0;
  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l) {
      i++;
      continue;
    }
    if (/^## /.test(l)) {
      h += '<h5 class="frsub">' + esc(l.slice(3)) + "</h5>";
      i++;
    } else if (/^Table: /.test(l) || /^\|/.test(l)) {
      let title = "";
      if (/^Table: /.test(l)) {
        title = l.slice(7);
        i++;
      }
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        rows.push(
          lines[i]
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim()),
        );
        i++;
      }
      if (rows.length) h += tableHTML({ title: title, rows: rows });
    } else if (/^- /.test(l) || /^\d+\. /.test(l)) {
      const num = /^\d+\. /.test(l),
        items = [];
      while (i < lines.length && (num ? /^\d+\. /.test(lines[i].trim()) : /^- /.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^- |^\d+\. /, ""));
        i++;
      }
      h += (num ? "<ol" : "<ul") + ' class="frlist">' + items.map((x) => "<li>" + esc(x) + "</li>").join("") + (num ? "</ol>" : "</ul>");
    } else {
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(## |- |\d+\. |\||Table: )/.test(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      h += '<p class="stext">' + esc(para.join(" ")) + "</p>";
    }
  }
  return h;
}
function frSourceHTML(q) {
  const s = q.source;
  let h = '<article class="frsrc">';
  if (q.grader === "ebq") {
    h += '<p class="frask frask-src">' + esc(s.title) + '</p><p class="frlabel">' + esc(s.label || "") + "</p>";
    s.blocks.forEach((b) => (h += '<section class="frone"><h4>' + esc(b.h.replace(/:.*/, "")) + "</h4>" + (b.h.indexOf(":") > 0 ? '<p class="frtitle">' + esc(b.h.replace(/^[^:]*:\s*/, "")) + "</p>" : "") + frDocHTML(b.p) + "</section>"));
  } else {
    h += '<h4 class="frtitle">' + esc(s.title) + "</h4>" + (s.label ? '<p class="frlabel">' + esc(s.label) + "</p>" : "");
    s.blocks.forEach((b) => {
      h += '<h5 class="frsub">' + esc(b.h) + "</h5>" + frDocHTML(b.p);
      if (s.table && s.tableAfter === b.h) h += tableHTML({ rows: s.table });
    });
  }
  if (s.cite) h += '<p class="frcite">' + esc(s.cite) + "</p>";
  return h + "</article>";
}

/* ---------- answer parts ---------- */
/* mode: "practice" (Check shows feedback), "exam" (answer only), "review" (graded mock, read only). */
function frPartsHTML(q, s, mode) {
  const g = s.revealed ? s.ai || s.auto : null;
  /* As on the exam: the EBQ question sits above its parts. */
  let h = q.grader === "ebq" ? '<p class="frask">' + esc(q.source.title) + "</p>" : "";
  q.parts.forEach((p) => {
    const meta = frqPart(q.grader, p.k),
      r = g ? g.parts[p.k] : null,
      over = s.pm[p.k],
      pts = r ? (over === true ? p.max : over === false ? 0 : r.pts) : null,
      lab = meta.label || p.k;
    h +=
      '<div class="wpart"><div class="wph"><span><b>Part ' +
      esc(lab) +
      "</b></span>" +
      '<span class="wpts' +
      (pts === null ? "" : pts === p.max ? " ok" : " no") +
      '">' +
      (pts === null ? plural(p.max, "point") : fmt1(pts) + " of " + p.max) +
      "</span></div>" +
      '<p class="wpq">' +
      esc(p.prompt) +
      "</p>";
    if (mode === "review") h += '<p class="frans">' + (s.ans[p.k] ? esc(s.ans[p.k]) : '<span class="muted">No answer</span>') + "</p>";
    else
      h +=
        '<textarea rows="' +
        (p.max > 1 || "EF".indexOf(p.k) >= 0 ? 5 : 3) +
        '" data-fra="' +
        esc(p.k) +
        '" aria-label="Answer for part ' +
        esc(lab) +
        '">' +
        esc(s.ans[p.k] || "") +
        "</textarea>";
    if (mode !== "exam" && s.revealed) {
      if (r)
        h +=
          '<ul class="wchecks">' +
          r.checks.map((c) => '<li class="' + (c.ok ? "ok" : "no") + '"><span aria-hidden="true">' + (c.ok ? "✓" : "✗") + "</span> " + esc(c.text) + "</li>").join("") +
          "</ul>" +
          r.tips.map((t) => '<p class="wtip"><b>Tip:</b> ' + esc(t) + "</p>").join("");
      if (r && r.pts < r.max && meta.mistake) h += '<p class="wtip"><b>Common mistake:</b> ' + esc(meta.mistake) + "</p>";
      h += "<details" + (!r || pts < p.max ? " open" : "") + "><summary>Model answer</summary><p>" + esc(p.model) + "</p></details>";
      if (r)
        h +=
          '<div class="selfmark" role="group" aria-label="Override part ' +
          esc(lab) +
          '"><span>Override</span><button class="mk' +
          (over === true ? " on right" : "") +
          '" data-act="frpart" data-p="' +
          esc(p.k) +
          '" data-v="1" aria-pressed="' +
          (over === true) +
          '">I got it</button><button class="mk' +
          (over === false ? " on wrong" : "") +
          '" data-act="frpart" data-p="' +
          esc(p.k) +
          '" data-v="0" aria-pressed="' +
          (over === false) +
          '">I missed it</button></div>';
    }
    h += "</div>";
  });
  if (mode !== "exam" && s.revealed && q.grader === "ebq") {
    const ideas = ebqIdeas(q, q.source);
    if (ideas.length) h += '<p class="wtip"><b>Concepts that fit this prompt:</b> ' + esc(ideas.join(", ")) + ". Other concepts from class can work too.</p>";
  }
  return h;
}
function frPoints(q, s) {
  const g = s.ai || s.auto;
  if (!s.revealed || !g) return null;
  return q.parts.reduce((n, p) => n + (s.pm[p.k] === true ? p.max : s.pm[p.k] === false ? 0 : (g.parts[p.k] && g.parts[p.k].pts) || 0), 0);
}
function frScoreHTML(q, s) {
  const pts = frPoints(q, s),
    max = frMax(q);
  let h = "";
  if (pts !== null)
    h +=
      '<div class="wscore"><span class="wsl">Your score, ' +
      (s.ai ? "graded by Gemini" : "checklist grader") +
      '</span><span class="wsn">' +
      fmt1(pts) +
      " of " +
      max +
      "</span>" +
      (s.ai && s.ai.overall ? "<p>" + esc(s.ai.overall) + "</p>" : "") +
      "</div>";
  if (s.aiLoading) h += '<p class="wnote">Grading with Gemini. This usually takes 5 to 20 seconds.</p>';
  if (s.aiErr) h += '<p class="wnote bad">Gemini couldn\'t grade this: ' + esc(s.aiErr) + (s.auto ? " Showing the checklist grader instead." : "") + "</p>";
  if (s.revealed && !s.ai && !s.auto) h += '<p class="wnote">This one was made with Gemini, so it has no checklist. Use Grade with Gemini, or compare with the model answers.</p>';
  return h;
}

/* ---------- views ---------- */
function frHTML() {
  frTimer();
  if (FR.view === "practice") return frPracticeHTML();
  if (FR.view === "mock") return frMockHTML();
  if (FR.view === "guide") return frGuideHTML();
  return frHomeHTML();
}
function frDoneCount(kind) {
  const pool = frItems(kind);
  return pool.filter((q) => FR.done[q.id]).length + " of " + pool.length + " done";
}
function frHomeHTML() {
  const L = D.fr.links || {},
    gemOn = typeof gemKey === "function" && !!gemKey(),
    m = FR.mock && !FR.mock.submitted ? FR.mock : null;
  let h =
    '<section class="panel frcard"><h2>Practice</h2><p>One question at a time. Write your answer to each part, then Check to see your points, what you missed, and a model answer.</p>' +
    '<div class="frpick"><button class="btn" data-act="frgo" data-v="practice" data-k="aaq">AAQ: Article Analysis</button><button class="btn" data-act="frgo" data-v="practice" data-k="ebq">EBQ: Evidence-Based</button></div>' +
    '<p class="hint muted">AAQ ' +
    frDoneCount("aaq") +
    ". EBQ " +
    frDoneCount("ebq") +
    ".</p></section>";
  h +=
    '<section class="panel frcard"><h2>Mock exam</h2><p>One AAQ and one EBQ on one ' +
    FR_MIN +
    "-minute clock, like Section II of the real exam, or just one of them on its suggested time. The clock counts down at the top; your answers are graded when you submit or time runs out.</p>" +
    (m
      ? '<div class="frpick"><button class="btn" data-act="frgo" data-v="mock">Resume mock exam</button></div><p class="hint muted">' + frClock(frLeft()) + " left.</p>"
      : '<div class="frpick"><button class="btn" data-act="frgo" data-v="mock">Set up a mock exam</button></div>') +
    "</section>";
  h += '<section class="frmore"><p><button class="lnk" data-act="frgo" data-v="guide">How the AAQ and EBQ work</button></p>';
  h += gemOn
    ? "<p>Gemini is on: practice has a <b>Generate a new one</b> button for unlimited new questions.</p>"
    : '<p>Want unlimited new questions? Add a free Gemini key in <button class="lnk" data-act="tab" data-t="set">Settings</button>.</p>';
  if (L.short) h += '<p>Want shorter, quicker practice? Try <a href="' + esc(L.short.url) + '" target="_blank" rel="noopener">' + esc(L.short.label) + "</a>.</p>";
  if (L.past && L.past.length)
    h += "<p>Real past exam questions from College Board:</p><ul class=\"frlinks\">" + L.past.map((x) => '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label) + "</a></li>").join("") + "</ul>";
  return h + "</section>";
}
function frBack() {
  return '<p class="frback"><button class="btn ghost" data-act="frgo" data-v="home">' + ICON.back + "Free response</button></p>";
}
function frPracticeHTML() {
  const kind = FR.kind;
  if (!FR.cur[kind] || !frById(FR.cur[kind])) FR.cur[kind] = frPick(kind, []);
  const q = frById(FR.cur[kind]),
    s = FR.st[q.id] || (FR.st[q.id] = frNewSt()),
    gemOn = typeof gemKey === "function" && !!gemKey(),
    has = Object.values(s.ans).some((v) => String(v).trim());
  let h = frBack() + '<div class="frhead"><h2>' + frKindName(kind) + " practice</h2>" + '<p class="muted">' + esc(q.topic) + (FR.done[q.id] ? ", done before" : "") + "</p></div>";
  if (FR.msg) h += '<p class="wnote">' + esc(FR.msg) + "</p>";
  FR.msg = "";
  h += '<div class="frsplit"><div class="frleft">' + frSourceHTML(q) + '</div><div class="frright">';
  h += frScoreHTML(q, s) + frPartsHTML(q, s, "practice");
  h +=
    '<div class="qnav"><button class="btn" data-act="frcheck">' +
    (s.revealed ? "Recheck my answers" : "Check my answers") +
    "</button>" +
    (gemOn ? '<button class="btn sec" data-act="frgem"' + (s.aiLoading ? " disabled" : "") + ">Grade with Gemini</button>" : "") +
    '<button class="btn sec frnext" data-act="frnext">Next ' +
    (kind === "ebq" ? "prompt" : "article") +
    ICON.chev +
    "</button></div>";
  h +=
    '<div class="frfoot">' +
    (gemOn ? '<button class="btn ghost" data-act="frgen"' + (FR.gen ? " disabled" : "") + ">" + (FR.gen ? "Generating, about 20 seconds" : "Generate a new one with Gemini") + "</button>" : "") +
    (has ? '<button class="btn ghost danger" data-act="frclear">Clear my answers</button>' : "") +
    "</div>";
  return h + "</div></div>";
}
function frGuideHTML() {
  const G = D.fr.guide || {};
  return frBack() + '<section class="panel frguide"><h2>How the AAQ works</h2>' + guideHTML2(G.aaq || []) + "</section>" + '<section class="panel frguide"><h2>How the EBQ works</h2>' + guideHTML2(G.ebq || []) + "</section>";
}

/* ---------- mock exam ---------- */
const frClock = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000)),
    hh = Math.floor(t / 3600),
    mm = Math.floor((t % 3600) / 60),
    ss = t % 60;
  return (hh ? hh + ":" + String(mm).padStart(2, "0") : mm) + ":" + String(ss).padStart(2, "0");
};
const frLeft = () => (FR.mock ? FR.mock.endAt - Date.now() : 0);
const frMultName = (m) => (FR_MULTS.find((x) => x[0] === m) || FR_MULTS[0])[1];
function frMockHTML() {
  const m = FR.mock;
  if (!m || !m.started) return frSetupHTML();
  if (m.submitted) return frResultsHTML();
  const left = frLeft(),
    warn = left <= 5 * 60000,
    q = frById(m.ids[m.q]),
    s = m.st[q.id];
  let h =
    '<div class="frbar' +
    (warn ? " warn" : "") +
    '" role="region" aria-label="Mock exam clock"><span class="frclock">' +
    (m.hidden && !warn ? '<span class="muted">Timer hidden</span>' : ICON.clock + '<span id="frtime">' + frClock(left) + "</span>" + (warn ? '<span class="frwarn"> left</span>' : "")) +
    "</span>" +
    (warn ? "" : '<button class="btn ghost small" data-act="frhide">' + (m.hidden ? "Show timer" : "Hide") + "</button>") +
    (m.ids.length < 2 ? "" : '<span class="frqs" role="group" aria-label="Questions">') +
    (m.ids.length < 2 ? [] : m.ids).map((id, i) => '<button class="btn small' + (i === m.q ? "" : " sec") + '" data-act="frq" data-i="' + i + '" aria-pressed="' + (i === m.q) + '"><span><span class="frqw">Question </span><span class="frqn">Q</span>' + (i + 1) + ": " + frKindName(frById(id).grader) + "</span></button>").join("") +
    (m.ids.length < 2 ? "" : "</span>") +
    '<button class="btn small sec frsub" data-act="frsubmit">Submit exam</button></div>';
  if (warn) h += '<p class="wnote bad" role="alert">Less than 5 minutes left.</p>';
  h += '<div class="frsplit"><div class="frleft">' + frSourceHTML(q) + '</div><div class="frright"><p class="hint muted">' + (q.grader === "ebq" ? "Suggested: about 45 minutes, the first 15 reading the sources." : "Suggested: about 25 minutes, the first 10 reading the source.") + "</p>";
  h += frPartsHTML(q, s, "exam");
  if (m.ids.length > 1) h += '<div class="qnav">' + (m.q === 0 ? '<button class="btn sec" data-act="frq" data-i="1">Go to Question 2' + ICON.chev + "</button>" : '<button class="btn sec" data-act="frq" data-i="0">' + ICON.back + "Back to Question 1</button>") + "</div>";
  return h + "</div></div>";
}
function frSetupHTML() {
  const m = FR.mock || {},
    mult = m.mult || 1,
    take = m.take || "both";
  return (
    frBack() +
    '<section class="panel frsetup"><h2>Mock exam</h2><p>Section II of the AP Psychology exam is <b>2 questions in 1 hour 10 minutes</b>: Question 1 is an AAQ, Question 2 is an EBQ, and you can move between them until time runs out. You can take the full section, or one question on its suggested time. A clock counts down at the top. You can hide it, but it comes back at 5 minutes left. When time runs out your answers are submitted and graded.</p>' +
    '<fieldset class="frtime"><legend>What to take</legend>' +
    FR_TAKE.map((x) => '<label><input type="radio" name="frtake" data-act="frtake" data-v="' + x[0] + '"' + (x[0] === take ? " checked" : "") + "> " + esc(x[1]) + "</label>").join("") +
    "</fieldset>" +
    '<fieldset class="frtime"><legend>Your time</legend>' +
    FR_MULTS.map(
      (x) =>
        '<label><input type="radio" name="frmult" data-act="frmult" data-m="' +
        x[0] +
        '"' +
        (x[0] === mult ? " checked" : "") +
        "> " +
        esc(x[1]) +
        ": " +
        frMinText(Math.round(frTakeMin(take) * x[0])) +
        "</label>",
    ).join("") +
    '<p class="hint muted">Pick extended time only if College Board approved it for you.</p></fieldset>' +
    '<div class="qnav"><button class="btn" data-act="frstart">Start mock exam</button></div>' +
    "</section>"
  );
}
function frResultsHTML() {
  const m = FR.mock;
  let tot = 0,
    max = 0,
    pending = false;
  m.ids.forEach((id) => {
    const q = frById(id),
      p = frPoints(q, m.st[id]);
    max += frMax(q);
    if (p === null) pending = true;
    else tot += p;
  });
  const gemOn = typeof gemKey === "function" && !!gemKey();
  let h =
    frBack() +
    '<section class="panel frres"><h2>Mock exam results</h2>' +
    (m.timeUp ? "<p>Time ran out, so your answers were submitted.</p>" : "") +
    '<div class="wscore"><span class="wsl">' + (m.ids.length > 1 ? "Section II score" : frKindName(frById(m.ids[0]).grader) + " score") + '</span><span class="wsn">' +
    fmt1(tot) +
    " of " +
    max +
    "</span>" +
    (pending ? '<p class="muted">A question made with Gemini has no checklist: use Grade with Gemini for it.</p>' : "") +
    "<p class=\"muted\">" +
    esc(frMultName(m.mult)) +
    ". Each question is out of 7, graded by the checklist grader unless you use Gemini. Read each part's feedback and the model answers below.</p></div>" +
    '<div class="qnav"><button class="btn" data-act="frnewmock">New mock exam</button></div></section>';
  m.ids.forEach((id, i) => {
    const q = frById(id),
      s = m.st[id];
    h +=
      '<section class="panel" data-i="' +
      i +
      '"><h3>Question ' +
      (i + 1) +
      ": " +
      frKindName(q.grader) +
      '</h3><details class="frsrcbox"><summary>Show the ' +
      (q.grader === "ebq" ? "sources" : "article") +
      "</summary>" +
      frSourceHTML(q) +
      "</details>" +
      frScoreHTML(q, s) +
      frPartsHTML(q, s, "review") +
      (gemOn ? '<div class="qnav"><button class="btn sec" data-act="frgem" data-i="' + i + '"' + (s.aiLoading ? " disabled" : "") + ">Grade with Gemini</button></div>" : "") +
      "</section>";
  });
  return h;
}
function frTick() {
  const m = FR.mock;
  if (!m || !m.started || m.submitted) return frTimer();
  const left = frLeft(),
    e = document.getElementById("frtime");
  if (left <= 0) return frSubmit(true);
  if (e) e.textContent = frClock(left);
  if (left <= 5 * 60000 && !m.warned) {
    m.warned = true;
    m.hidden = false;
    frSave();
    if (UI.tab === "fr" && FR.view === "mock") render();
  }
}
/* One interval while a mock exam is running, wherever the student is in the unit. */
function frTimer() {
  const on = !!(FR.mock && FR.mock.started && !FR.mock.submitted);
  if (on && !FR.iv) FR.iv = setInterval(frTick, 1000);
  if (!on && FR.iv) {
    clearInterval(FR.iv);
    FR.iv = null;
  }
}
function frSubmit(timeUp) {
  const m = FR.mock;
  m.submitted = true;
  m.timeUp = !!timeUp;
  m.ids.forEach((id) => {
    const q = frById(id),
      s = m.st[id];
    s.auto = frqGrade(q, q.source, s.ans);
    s.revealed = true;
    FR.done[id] = true;
  });
  FR.view = "mock";
  frTimer();
  frSave();
  render();
  window.scrollTo(0, 0);
}

/* ---------- actions ---------- */
function frCurS() {
  if (FR.view === "mock" && FR.mock && FR.mock.started) {
    const id = FR.mock.ids[FR.mock.q];
    return { q: frById(id), s: FR.mock.st[id] };
  }
  const q = frById(FR.cur[FR.kind]);
  return { q: q, s: FR.st[q.id] };
}
function frInput(t) {
  const c = frCurS();
  if (!c.q || (FR.mock && FR.view === "mock" && FR.mock.submitted)) return;
  c.s.ans[t.dataset.fra] = t.value;
  frSave();
}
ACT.frgo = (t) => {
  FR.view = t.dataset.v;
  if (t.dataset.k) FR.kind = t.dataset.k;
  frSave();
  render();
  window.scrollTo(0, 0);
};
ACT.frcheck = () => {
  const c = frCurS();
  c.s.auto = frqGrade(c.q, c.q.source, c.s.ans);
  c.s.ai = null;
  c.s.aiErr = "";
  c.s.pm = {};
  c.s.revealed = true;
  FR.done[c.q.id] = true;
  frSave();
  render();
};
ACT.frpart = (t) => {
  const c = FR.view === "mock" && FR.mock && FR.mock.submitted ? { s: FR.mock.st[FR.mock.ids[+t.closest(".panel").dataset.i || 0]] } : frCurS();
  const k = t.dataset.p,
    v = t.dataset.v === "1";
  c.s.pm[k] = c.s.pm[k] === v ? undefined : v;
  frSave();
  render();
};
ACT.frclear = () => {
  const c = frCurS(),
    n = Object.values(c.s.ans).filter((v) => String(v).trim()).length;
  if (!ask("Clear all " + plural(n, "answer") + " you wrote for this " + (c.q.grader === "ebq" ? "prompt" : "article") + "? This can't be undone.")) return;
  FR.st[c.q.id] = frNewSt();
  frSave();
  render();
};
ACT.frnext = () => {
  const all = frItems(FR.kind);
  FR.cur[FR.kind] = frPick(FR.kind, [FR.cur[FR.kind]]);
  if (all.every((q) => FR.done[q.id])) FR.msg = "You've done all " + all.length + " " + frKindName(FR.kind) + "s, so this one repeats." + (typeof gemKey === "function" && gemKey() ? " Generate a new one with Gemini for a fresh one." : "");
  frSave();
  render();
  window.scrollTo(0, 0);
};
ACT.frmult = (t) => {
  FR.mock = FR.mock && !FR.mock.started ? FR.mock : {};
  FR.mock.mult = +t.dataset.m;
  frSave();
};
ACT.frtake = (t) => {
  FR.mock = FR.mock && !FR.mock.started ? FR.mock : {};
  FR.mock.take = t.dataset.v;
  frSave();
  render();
};
ACT.frstart = () => {
  const mult = (FR.mock && FR.mock.mult) || 1,
    take = (FR.mock && FR.mock.take) || "both",
    /* the mock exam draws from the kit's own exam-length questions, not Gemini-made ones */
    ids = take === "both" ? [frPick("aaq", [], true), frPick("ebq", [], true)] : [frPick(take, [], true)],
    st = {};
  ids.forEach((id) => (st[id] = frNewSt()));
  FR.mock = { started: true, take: take, mult: mult, ids: ids, q: 0, st: st, endAt: Date.now() + Math.round(frTakeMin(take) * mult) * 60000, hidden: false, warned: false, submitted: false };
  FR.view = "mock";
  frSave();
  render();
  window.scrollTo(0, 0);
};
ACT.frq = (t) => {
  FR.mock.q = +t.dataset.i;
  frSave();
  render();
  window.scrollTo(0, 0);
};
ACT.frhide = () => {
  FR.mock.hidden = !FR.mock.hidden;
  frSave();
  render();
};
ACT.frsubmit = () => {
  if (!ask("Submit your mock exam? You can't change your answers after this.")) return;
  frSubmit(false);
};
ACT.frnewmock = () => {
  FR.mock = { mult: (FR.mock && FR.mock.mult) || 1, take: (FR.mock && FR.mock.take) || "both" };
  FR.view = "mock";
  frSave();
  render();
  window.scrollTo(0, 0);
};
ACT.frgem = async (t) => {
  let q, s;
  if (FR.view === "mock" && FR.mock && FR.mock.submitted) {
    const id = FR.mock.ids[+t.dataset.i || 0];
    q = frById(id);
    s = FR.mock.st[id];
  } else {
    const c = frCurS();
    q = c.q;
    s = c.s;
  }
  if (s.aiLoading) return;
  s.aiLoading = true;
  s.aiErr = "";
  render();
  try {
    s.ai = await gemGradeQ(q, q.source, s.ans);
  } catch (e) {
    s.ai = null;
    s.aiErr = e.message || String(e);
  }
  s.auto = frqGrade(q, q.source, s.ans);
  s.pm = {};
  s.revealed = true;
  s.aiLoading = false;
  FR.done[q.id] = true;
  frSave();
  render();
};
ACT.frgen = async () => {
  if (FR.gen) return;
  FR.gen = true;
  render();
  try {
    const C = frqCfg(),
      topics = FR.kind === "ebq" ? C.ebqTopics : C.aaqTopics,
      a = await gemGenerate(FR.kind, topics[Math.floor(Math.random() * topics.length)], "");
    FR.cur[FR.kind] = genToQ(FR.kind, a).q.id;
    FR.msg = "New " + frKindName(FR.kind) + " made with Gemini. It's fictional and AI-written, so it may have mistakes.";
  } catch (e) {
    FR.msg = "Gemini couldn't make one: " + (e.message || String(e));
  }
  FR.gen = false;
  frSave();
  render();
  window.scrollTo(0, 0);
};
document.addEventListener("input", (e) => {
  const t = e.target;
  if (UNIT && hasFR() && t.dataset && t.dataset.fra !== undefined) frInput(t);
});
/* Exposed for the click-through test. */
window.FR_test = { tick: frTick, state: () => FR, grade: (t) => ACT.frgem(t || { dataset: {} }) };
