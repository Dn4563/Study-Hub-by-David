/* Optional Gemini AI grading and generation for AAQ / EBQ practice (units whose practice.json has "frq").
   Each student pastes their own free Gemini API key in Settings. The key is kept only in this browser
   (localStorage "sk:gemini") and is sent only to Google's Gemini API; it is never part of the site's code.
   Prompts follow Phineas's (his rubric text comes from practice.frq). If a request fails, the key-word
   checker (js/92-frqcheck.js) is used instead. */
const GEMK = "sk:gemini";
const gemGet = () => readJSON(GEMK) || { key: "", model: "gemini-2.5-flash" };
const gemKey = () => gemGet().key || "";
const GENK = () => "sk:" + COURSE.id + ":" + (UNIT ? UNIT.id : "") + ":gen";
const hasFrq = () => !!(D && D.practice && D.practice.frq);

async function gemini(prompt) {
  const G = gemGet();
  if (!G.key) throw new Error("No Gemini API key saved.");
  const ctl = typeof AbortController === "function" ? new AbortController() : null,
    to = ctl ? setTimeout(() => ctl.abort(), 60000) : 0;
  let r;
  try {
    r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(G.model || "gemini-2.5-flash") + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": G.key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.3 } }),
      signal: ctl ? ctl.signal : undefined,
    });
  } catch (e) {
    throw new Error(e && e.name === "AbortError" ? "Gemini took too long to answer. Try again." : "Couldn't reach Gemini. Check your internet connection.");
  } finally {
    if (to) clearTimeout(to);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  const txt = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || "").join("");
  if (!txt) throw new Error("Gemini returned no answer" + (j.promptFeedback && j.promptFeedback.blockReason ? " (blocked: " + j.promptFeedback.blockReason + ")" : "") + ".");
  try {
    return JSON.parse(txt.replace(/^```(json)?\s*|\s*```$/g, ""));
  } catch (e) {
    throw new Error("Gemini's answer wasn't in the expected format. Try again.");
  }
}

/* ---------- grading (his prompts) ---------- */
const aaqArticleText = (src) => src.title + "\n\n" + (src.blocks || []).map((b) => b.h.toUpperCase() + "\n" + b.p).join("\n\n") + (src.table ? "\n\nPARTICIPANT DEMOGRAPHICS\n" + src.table.slice(1).map((r) => r[0] + ": " + r[1]).join("\n") : "");
const ebqText = (src) => (src.blocks || []).map((b, i) => "SOURCE " + (i + 1) + ": " + b.h.replace(/^Source \d+:\s*/, "") + "\n" + b.p).join("\n\n");
async function gemGradeQ(q, src, ans) {
  const C = frqCfg(),
    lab = (k) => frqPartLabel(q.grader, k),
    ks = q.parts.map((p) => p.k);
  let prompt;
  if (q.grader === "aaq")
    prompt =
      C.aaqRubric +
      "\n\nARTICLE:\n" +
      aaqArticleText(src) +
      "\n\nQUESTIONS:\n" +
      q.parts.map((p) => p.k + ". " + p.prompt).join("\n") +
      "\n\nREFERENCE ANSWERS (one correct way to answer; other correct answers also earn credit):\n" +
      q.parts.map((p) => p.k + ". " + p.model).join("\n") +
      "\n\nSTUDENT ANSWERS:\n" +
      q.parts.map((p) => p.k + ". " + ((ans[p.k] || "").trim() || "(blank)")).join("\n") +
      '\n\nGrade each part for a high school student. Respond with JSON only, exactly in this shape:\n{"parts":{"A":{"points":0,"earned":["what they did right"],"missing":["what is missing or wrong, specific to their answer"],"tip":"one concrete tip to fix or remember this"}, "B":{...}, "C":{...}, "D":{...}, "E":{...}, "F":{"points":0,...}}, "overall":"2-3 sentences: biggest strengths and what to practice next"}\npoints must be 0 or 1 for A-E and 0, 1, or 2 for F. Keep each list item under 25 words and speak directly to the student ("you").';
  else
    prompt =
      C.ebqRubric +
      "\n\nQUESTION: " +
      src.title +
      "\n\n" +
      ebqText(src) +
      "\n\nREFERENCE ANSWER (one correct way; other claims and concepts also earn credit):\n" +
      q.parts.map((p) => lab(p.k) + ". " + p.model).join("\n") +
      "\n\nSTUDENT ANSWERS:\n" +
      q.parts.map((p) => lab(p.k) + ". " + ((ans[p.k] || "").trim() || "(blank)")).join("\n") +
      "\n\nGrade each part for a high school student. Respond with JSON only, exactly in this shape, using the keys " +
      ks.join(", ") +
      ':\n{"parts":{"A":{"points":0,"earned":["what they did right"],"missing":["what is missing or wrong, specific to their answer"],"tip":"one concrete tip"}, "Bi":{...}, "Bii":{...}, "Ci":{...}, "Cii":{...}}, "overall":"2-3 sentences: biggest strengths and what to practice next"}\npoints: A, Bi, Ci are 0 or 1; Bii and Cii are 0, 1, or 2. Keep each list item under 25 words and speak directly to the student ("you").';
  const res = await gemini(prompt),
    parts = {};
  let total = 0;
  q.parts.forEach((p) => {
    const g = (res.parts || {})[p.k] || {},
      pts = Math.max(0, Math.min(p.max, Math.round(+g.points || 0)));
    parts[p.k] = { pts, max: p.max, ai: true, checks: [...(g.earned || []).map((t) => ({ ok: true, text: String(t) })), ...(g.missing || []).map((t) => ({ ok: false, text: String(t) }))], tips: g.tip ? [String(g.tip)] : [] };
    total += pts;
  });
  return { parts, total, overall: res.overall ? String(res.overall) : "", ai: true };
}
ACT.gemgrade = async () => {
  return gemGradeCur();
};
/* Exposed for the click-through test, which awaits it. */
window.ACT_gemgradeForTest = () => gemGradeCur();
async function gemGradeCur() {
  const c = cur3();
  if (!c.q || c.q.type !== "wfr" || c.s.aiLoading) return;
  const src = c.v.sec.sources[c.q.src],
    s = c.s;
  s.aiLoading = true;
  s.aiErr = "";
  render();
  try {
    s.ai = await gemGradeQ(c.q, src, s.ans);
  } catch (e) {
    s.ai = null;
    s.aiErr = e.message || String(e);
  }
  s.auto = frqGrade(c.q, src, s.ans);
  s.pm = {};
  s.revealed = true;
  s.aiLoading = false;
  syncMain();
  PTsave();
  render();
}

/* ---------- generating new articles and prompts (his prompts) ---------- */
function gemStore() {
  const o = readJSON(GENK()) || {};
  return { aaq: o.aaq || [], ebq: o.ebq || [] };
}
function genToQ(kind, a) {
  if (kind === "aaq")
    return {
      src: { id: "a-" + a.id, title: a.title, attr: "Generated by Gemini for practice. Fictional study.", label: "AI-generated practice article", blocks: a.sections.map((x) => ({ h: x[0], p: x[1] })), table: [a.table.head].concat(a.table.rows), tableAfter: "Participants" },
      q: { id: "aaq-" + a.id, type: "wfr", grader: "aaq", gen: true, topic: a.topic, title: a.title, src: "a-" + a.id, parts: frqCfg().aaqParts.map((p) => ({ k: p.k, prompt: a.q[p.k], model: a.model[p.k], max: p.pts })) },
    };
  return {
    src: { id: "e-" + a.id, title: a.question, label: "Generated by Gemini for practice. Fictional sources.", blocks: a.sources.map((x, i) => ({ h: "Source " + (i + 1) + ": " + x.title, p: x.text })) },
    q: { id: "ebq-" + a.id, type: "wfr", grader: "ebq", gen: true, topic: a.topic, title: a.title, src: "e-" + a.id, topicWords: a.topicWords || [], parts: frqCfg().ebqParts.map((p) => ({ k: p.k, prompt: p.q, model: a.model[p.k], max: p.pts })) },
  };
}
/* Read by initPT: generated items go at the top of that practice set. */
function gemGenerated(kind) {
  if (!UNIT || !hasFrq()) return [];
  return gemStore()[kind].map((a) => {
    try {
      return genToQ(kind, a);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}
async function gemGenerate(kind, topic, method) {
  let prompt;
  if (kind === "aaq") {
    prompt =
      "Write ONE new practice article for the AP Psychology Article Analysis Question (AAQ), like a summarized peer-reviewed study, for high school students.\nTopic: " +
      topic +
      ". Research method: " +
      (method || "choose experiment or correlational study") +
      '.\nRequirements: realistic but fictional study; plain clear language; 5 sections titled Introduction, Participants, Method, Results, Discussion (each 2-6 sentences); the Introduction states the hypothesis or claim; the Method clearly describes how each variable was measured (an operational definition with specific numbers/scales) and explicitly describes 2-3 ethical practices (e.g., informed consent, confidentiality, right to withdraw, debriefing, protection from harm, institutional approval) without always naming them; the Results include specific statistics (group means, or a correlation coefficient r, plus a p-value and/or effect size); the Participants section gives location and age, and the demographics table gives 5-8 rows of percentages (gender, race/ethnicity, age range).\nQuestions must follow the AAQ format: A "Identify the research method used in the study." B "State the operational definition of <a specific variable>." C "Describe what <a specific statistic> indicates..." D "Identify one ethical guideline the researchers followed and describe how they applied it." E "Explain the extent to which the research findings can be generalized, using specific evidence from the participants." F "Explain how the results support or refute the <hypothesis or claim>." For a correlational study, make F\'s claim causal so students must explain that correlation does not show causation.\nAlso write a full-credit model answer for each part.\nRespond with JSON only: {"title":"","topic":"' +
      topic +
      '","sections":[["Introduction",""],["Participants",""],["Method",""],["Results",""],["Discussion",""]],"table":{"head":["Characteristic","Percent"],"rows":[["",""]]},"q":{"A":"","B":"","C":"","D":"","E":"","F":""},"model":{"A":"","B":"","C":"","D":"","E":"","F":""}}';
  } else {
    prompt =
      "Write ONE new practice set for the AP Psychology Evidence-Based Question (EBQ) for high school students.\nTopic: " +
      topic +
      '.\nRequirements: a debatable question that starts "Develop and justify an argument about whether…"; three short summarized sources (realistic but fictional studies, 2-4 sentences each, with a title) that each give specific data (sample size, ages, location, group results with numbers). The sources should mostly support one side but leave room for a nuanced claim. Do NOT name AP Psychology theories in the sources (students must bring those in themselves).\nAlso write a full-credit model answer: A a specific defensible claim; Bi evidence from one source with a citation like "(Source 1)"; Bii explains how it supports the claim AND applies a named AP Psychology concept not mentioned in the sources; Ci evidence from a DIFFERENT source with a citation; Cii explains AND applies a DIFFERENT AP Psychology concept.\nRespond with JSON only: {"title":"","topic":"' +
      topic +
      '","question":"","sources":[{"title":"","text":""},{"title":"","text":""},{"title":"","text":""}],"topicWords":["2-5 lowercase key words from the question"],"model":{"A":"","Bi":"","Bii":"","Ci":"","Cii":""}}';
  }
  const a = await gemini(prompt);
  if (kind === "aaq" && (!a.title || !Array.isArray(a.sections) || !a.q || !a.model || !a.table || !Array.isArray(a.table.rows))) throw new Error("Gemini returned an incomplete article. Try again.");
  if (kind === "ebq" && (!a.title || !a.question || !Array.isArray(a.sources) || a.sources.length !== 3 || !a.model)) throw new Error("Gemini returned an incomplete EBQ. Try again.");
  a.id = "gen" + Date.now();
  a.topic = (a.topic || topic) + ", AI-generated";
  const st = gemStore();
  st[kind].unshift(a);
  st[kind] = st[kind].slice(0, 30);
  writeJSON(GENK(), st);
  return a;
}
/* Panel at the top of an AAQ / EBQ practice set, shown once a key is saved. */
function gemGenHTML(sec) {
  if (!sec.grader || sec.mode !== "practice" || !hasFrq() || !gemKey()) return "";
  const C = frqCfg(),
    topics = sec.grader === "ebq" ? C.ebqTopics : C.aaqTopics,
    g = UI.gemGen || {};
  return (
    '<div class="gemgen"><label>New ' +
    (sec.grader === "ebq" ? "EBQ prompt" : "AAQ article") +
    ' on <select data-gem="topic">' +
    (topics || []).map((t) => "<option" + (g.topic === t ? " selected" : "") + ">" + esc(t) + "</option>").join("") +
    "</select></label>" +
    (sec.grader === "aaq"
      ? '<label>Method <select data-gem="method"><option value="">Experiment or correlational</option>' +
        ["experiment", "correlational study", "case study", "naturalistic observation", "meta-analysis"].map((m) => "<option" + (g.method === m ? " selected" : "") + ">" + m + "</option>").join("") +
        "</select></label>"
      : "") +
    '<button class="btn sec small" data-act="gemgen"' +
    (g.loading ? " disabled" : "") +
    ">" +
    (g.loading ? "Generating…" : "Generate with Gemini") +
    "</button>" +
    (g.msg ? '<span class="hint">' + esc(g.msg) + "</span>" : "") +
    "</div>"
  );
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.gem) return;
  UI.gemGen = UI.gemGen || {};
  UI.gemGen[t.dataset.gem] = t.value;
});
ACT.gemgen = async () => {
  const sec = PT.secs[PT.sec];
  if (!sec || !sec.grader) return;
  const C = frqCfg(),
    g = (UI.gemGen = UI.gemGen || {}),
    topics = sec.grader === "ebq" ? C.ebqTopics : C.aaqTopics;
  g.loading = true;
  g.msg = "";
  render();
  try {
    const a = await gemGenerate(sec.grader, g.topic || topics[0], sec.grader === "aaq" ? g.method || "" : "");
    const it = genToQ(sec.grader, a);
    sec.sources[it.src.id] = it.src;
    sec.qs.unshift(it.q);
    sec.byId[it.q.id] = it.q;
    sec.st[it.q.id] = newSt();
    sec.orig.unshift(it.q.id);
    sec.order.unshift(it.q.id);
    PT.retest = null;
    sec.cur = 0;
    g.msg = "Added at the start of this set.";
  } catch (e) {
    g.msg = e.message || String(e);
  }
  g.loading = false;
  render();
};

/* ---------- Settings box ---------- */
function gemCardHTML() {
  if (!hasFrq()) return "";
  const G = gemGet(),
    m = UI.gemMsg || "";
  return (
    '<h3>Gemini AI grading (optional)</h3><div class="gemcard">' +
    "<p>Without this, every AAQ and EBQ is graded by the built-in checklist grader. With a free Gemini key, you can also have answers graded like an AP reader would, and generate unlimited new articles and prompts.</p>" +
    (G.key ? "<p><b>A key is saved in this browser</b> (it ends in …" + esc(G.key.slice(-4)) + ").</p>" : "") +
    '<h4>How to get a free key</h4><ol class="gemsteps">' +
    '<li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a> and sign in with a Google account.</li>' +
    '<li>Click <b>Get API key</b>, then <b>Create API key</b>. If you don\'t see those buttons, look for <b>API keys</b> in the menu on the left. Google may make a project for you; that\'s fine.</li>' +
    "<li>Copy the key (a long code that starts with <b>AIza</b>).</li>" +
    "<li>Paste it below, press <b>Save</b>, then press <b>Test</b> to make sure it works.</li></ol>" +
    '<div class="gemrow"><label>API key <input type="password" autocomplete="off" spellcheck="false" id="gemkey" placeholder="' +
    (G.key ? "Paste a new key to replace it" : "Paste your Gemini API key") +
    '"></label><label>Model <input type="text" id="gemmodel" spellcheck="false" value="' +
    esc(G.model || "gemini-2.5-flash") +
    '"></label></div><div class="qnav"><button class="btn" data-act="gemsave">Save</button><button class="btn sec" data-act="gemtest"' +
    (G.key ? "" : " disabled") +
    '>Test</button><button class="btn ghost danger" data-act="gemremove"' +
    (G.key ? "" : " disabled") +
    ">Remove key</button></div>" +
    (m ? '<p class="gemmsg">' + esc(m) + "</p>" : "") +
    '<h4>Good to know</h4><ul class="gemnotes">' +
    "<li>It's free with daily limits. If you hit the limit, try again later; the checklist grader always works.</li>" +
    "<li>School Google accounts, and accounts for students under 18, may not be allowed to make a key. A personal Google account usually works (ask a parent if you need to).</li>" +
    "<li>The key is saved only in this browser on this device. It's never part of the website, and your answers are sent only to Google's Gemini service for grading.</li>" +
    "<li>On a shared or school computer, press <b>Remove key</b> when you're done, since anyone using this browser could use it.</li>" +
    "<li>AI can make mistakes. Always compare with the model answer.</li></ul></div>"
  );
}
ACT.gemsave = () => {
  const k = (document.getElementById("gemkey") || {}).value || "",
    m = ((document.getElementById("gemmodel") || {}).value || "").trim() || "gemini-2.5-flash",
    G = gemGet();
  if (k.trim()) G.key = k.trim();
  G.model = m;
  writeJSON(GEMK, G);
  UI.gemMsg = G.key ? "Saved. Press Test to check it works." : "Paste a key first.";
  render();
};
ACT.gemremove = () => {
  try {
    localStorage.removeItem(GEMK);
  } catch (e) {}
  UI.gemMsg = "Key removed from this browser.";
  render();
};
ACT.gemtest = async () => {
  UI.gemMsg = "Testing…";
  render();
  try {
    const r = await gemini('Reply with JSON only: {"ok":true}');
    UI.gemMsg = r && r.ok ? "It works. Grade with Gemini now appears on every AAQ and EBQ." : "Gemini answered, but not as expected. Try again.";
  } catch (e) {
    UI.gemMsg = "That didn't work: " + (e.message || e) + " Check that you copied the whole key.";
  }
  render();
};
