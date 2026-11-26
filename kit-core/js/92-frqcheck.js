/* Free-response checking for AP Psych AAQ and EBQ practice ("wfr" practice questions).
   The rules, wording and tips are Phineas's (from his AP Psych kit, used with his permission), ported as is.
   The checker looks for the pieces the rubric requires; it can't judge reasoning like a real reader, so the
   student can always override a part with "I got it" / "I missed it", or use optional Gemini grading
   (js/93-gemini.js). Rubric data comes from the unit's practice.json: q.r per article, practice.frq for the
   shared word lists, part names and concepts. */
let FRQ_CFG = null;
function frqCfg() {
  if (FRQ_CFG) return FRQ_CFG;
  const f = (D && D.practice && D.practice.frq) || {};
  FRQ_CFG = Object.assign({}, f, {
    concepts: (f.concepts || []).map((c) => [c[0], new RegExp(c[1], c[2] || "")]),
    stopSet: new Set(f.stop || []),
  });
  return FRQ_CFG;
}
const frqPart = (grader, k) => ((grader === "aaq" ? frqCfg().aaqParts : frqCfg().ebqParts) || []).find((p) => p.k === k) || { k: k, name: k, verb: "", pts: 1, tip: "", mistake: "" };
const frqPartLabel = (grader, k) => frqPart(grader, k).label || k;

/* ---------- AAQ (his gradeAAQ) ---------- */
const aaqHas = (t, list) => (list || []).find((w) => t.includes(w));
const aaqWords = (t) => (t.trim().match(/\S+/g) || []).length;
function gradeAAQPart(art, k, raw) {
  const C = frqCfg(),
    AAQ_METHODS = C.methods || {},
    AAQ_WORDS = C.words || {};
  const t = (" " + (raw || "") + " ").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");
  const R = art.r[k],
    checks = [],
    tips = [];
  let pts = 0;
  const ck = (ok, good, bad) => {
    checks.push({ ok, text: ok ? good : bad });
    return ok;
  };
  if (!raw || !raw.trim()) return { pts: 0, max: k === "F" ? 2 : 1, checks: [{ ok: false, text: "No answer written. Even a one-sentence attempt can earn the point." }], tips };
  const n = aaqWords(raw);
  if (k === "A") {
    const right = aaqHas(t, R.keys);
    const named = Object.entries(AAQ_METHODS)
      .filter(([m, keys]) => m !== R.answer && aaqHas(t, keys))
      .map(([m]) => m);
    if (ck(!!right, `Names the correct method: ${R.answer}.`, named.length ? `You named ${named.join(" / ")}, but this study is a ${R.answer}.` : `Doesn't name a research method. The answer is: ${R.answer}.`)) pts = 1;
    if (!right && R.trap && named.includes(R.trap)) tips.push(R.trapHint);
    if (right && named.length) tips.push(`You also mentioned ${named.join(" / ")}. Only name one method, or a reader may see it as contradicting yourself.`);
    if (!aaqHas(t, R.clues)) tips.push('Not required for the point, but backing it up with a clue from the article ("participants were randomly assigned…") shows you understand why.');
    if (n > 50) tips.push('"Identify" only needs one clear sentence. Save the time for Parts E and F.');
  }
  if (k === "B") {
    let all = true;
    R.groups.forEach((g, i) => {
      if (!ck(!!aaqHas(t, g), R.labels[i] + ".", "Missing: " + R.labels[i].toLowerCase() + ".")) all = false;
    });
    if (all) pts = 1;
    if (!all && /\b(is|means|refers to) (the|a|an)? ?(ability|process|tendency|state)\b/.test(t))
      tips.push("That sounds like a textbook definition. The rubric wants how the researchers MEASURED it in this study. The answer is always in the Method section.");
  }
  if (k === "C") {
    const num = aaqHas(t, R.nums),
      cmp = aaqHas(t, AAQ_WORDS.compare) || (R.needPositive && aaqHas(t, ["positive"])),
      mean = aaqHas(t, R.meaning),
      subj = aaqHas(t, R.subject);
    ck(!!num, "Uses the statistic from the article.", "Doesn't mention the actual numbers from the Results.");
    const corr = R.needPositive || R.kind === "corr";
    const dir =
      R.kind === "other"
        ? true
        : corr
          ? ck(
              !!aaqHas(t, ["positive", "negative", "more", "higher", "increase", "go up", "goes up", "tend", "fewer", "less", "lower"]),
              "Says the direction of the relationship (positive or negative).",
              "Doesn't say the direction. A + sign means positive (both go up together); a − sign means negative (one goes up as the other goes down).",
            )
          : ck(!!cmp && !!subj, "Compares the groups (which one did better).", "Doesn't clearly say which group scored higher or lower.");
    const meaning = ck(!!mean, "Connects the number to what was being studied.", "Doesn't say what the number MEANS for the research question. Restating numbers alone earns 0.");
    if (dir && meaning) pts = 1;
    if (num && !meaning) tips.push('You have the numbers. Now add "which indicates that…" and say what it means.');
    if (R.speedHint && !aaqHas(t, ["faster", "quicker", "less time", "shorter", "lower"])) tips.push("Careful: here a LOWER time is BETTER (faster). Say which group was faster.");
    if (corr && aaqHas(t, ["cause", "causes", "led to", "makes"])) tips.push('Don\'t say one variable "causes" the other in Part C. A correlation only shows a relationship.');
  }
  if (k === "D") {
    const hit = R.eth.find((g) => aaqHas(t, g.keys.map((x) => x.toLowerCase())));
    const otherHit = R.notIn.find((x) =>
      aaqHas(
        t,
        {
          consent: ["informed consent", "consent"],
          confid: ["confidential", "anonym"],
          withdraw: ["withdraw"],
          debrief: ["debrief"],
          harm: ["protection from harm"],
          approval: ["institutional", "review board", "irb", "ethics board"],
        }[x] || [],
      ),
    );
    const named = ck(
      !!hit,
      `Identifies a guideline this study followed: ${hit ? hit.name : ""}.`,
      otherHit ? "The guideline you named isn't described in this article. Stick to what the text shows." : "Doesn't name a specific ethical guideline (informed consent, confidentiality, debriefing, right to withdraw, protection from harm…).",
    );
    const desc = ck(
      !!(hit && aaqHas(t, hit.ev)),
      "Describes how the researchers applied it, with evidence from the article.",
      hit ? `Name is there, but describe HOW they did it in this study (find the sentence in the Method that shows ${hit.name.toLowerCase()}).` : "Doesn't describe how the researchers applied a guideline.",
    );
    if (named && desc) pts = 1;
    tips.push("Guidelines this article actually describes: " + R.eth.map((g) => g.name).join(", ") + ".");
  }
  if (k === "E") {
    const claim = ck(!!aaqHas(t, AAQ_WORDS.claim), "Makes a claim about whether the findings generalize.", 'Doesn\'t make a clear claim ("The findings can / cannot be generalized to…").');
    const demo = ck(!!aaqHas(t, R.demo), "Cites specific participant demographics from the study.", "Doesn't cite specific demographics (percentages, ages, location). This is the #1 way students lose this point.");
    const pop = ck(!!aaqHas(t, R.pop), "Names a population the results may or may not apply to.", 'Doesn\'t name a specific population (e.g., "older adults," "teens in other states").');
    if (claim && demo && pop) pts = 1;
    if (!/\d/.test(raw)) tips.push("Put a number in: quote a percentage or age range straight from the demographic table.");
    if (n < 20) tips.push('"Explain" needs reasoning. One short sentence usually isn\'t enough here.');
  }
  if (k === "F") {
    const data = ck(!!aaqHas(t, R.data), "Point 1: Uses a specific result (numbers) from the study.", "Point 1 missing: quote specific numbers from the Results section.");
    const stance = aaqHas(t, AAQ_WORDS.support),
      link = aaqHas(t, AAQ_WORDS.link),
      concept = aaqHas(t, R.concept);
    const accurate = R.stanceWant !== "refute" || !!aaqHas(t, ["not support", "doesn't support", "does not support", "refute", "cannot", "can't", "partially", "not prove", "doesn't prove", "does not prove", "not show caus", "correlational"]);
    if (stance && link && concept && !accurate) {
      ck(false, "", "Point 2 missing: the explanation isn't accurate. " + R.stanceHint);
      pts = data ? 1 : 0;
      return { pts, max: 2, checks, tips };
    }
    const expl = ck(
      !!(stance && link && concept),
      "Point 2: Says support/refute and explains how the result connects to the hypothesis.",
      !stance ? "Point 2 missing: say clearly whether the results SUPPORT or REFUTE the hypothesis." : !link ? 'Point 2 missing: explain HOW the data connects ("…which shows that…", "because…").' : "Point 2 missing: connect it back to the specific concept in the hypothesis.",
    );
    pts = (data ? 1 : 0) + (expl ? 1 : 0);
    if (R.stanceWant === "refute" && stance && !aaqHas(t, ["not support", "doesn't support", "does not support", "refute", "cannot", "can't", "partially", "correlation does not", "correlational"])) tips.push(R.stanceHint);
    if (n < 25) tips.push("Part F is worth 2 points. Plan on 2–3 sentences: claim, data, and how the data proves the claim.");
  }
  return { pts, max: k === "F" ? 2 : 1, checks, tips };
}

/* ---------- EBQ (his gradeEBQ) ---------- */
const ebqNorm = (s) =>
  (" " + (s || "") + " ")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
const ebqSrcText = (set) => ebqNorm(set.sources.map((s) => s.title + " " + s.text).join(" "));
const ebqNums = (t) => (ebqNorm(t).match(/\d+(?:[.:,]\d+)?/g) || []).map((x) => x.replace(/,/g, ""));
const ebqWords = (t) => new Set((ebqNorm(t).match(/[a-z]{5,}/g) || []).filter((w) => !frqCfg().stopSet.has(w)));
function ebqConcepts(set, raw) {
  const t = ebqNorm(raw),
    src = ebqSrcText(set),
    used = [],
    fromSrc = [];
  frqCfg().concepts.forEach(([n, re]) => {
    if (re.test(t)) (re.test(src) ? fromSrc : used).push(n);
  });
  return { used, fromSrc };
}
function ebqCites(raw) {
  const t = ebqNorm(raw),
    s = new Set();
  for (const m of t.matchAll(/\bsources?\s*#?\s*([123])\b/g)) s.add(+m[1]);
  return [...s];
}
function ebqEvidence(set, raw) {
  const cites = ebqCites(raw),
    t = raw.replace(/\bsources?\s*#?\s*[123]\b/gi, " "),
    nums = ebqNums(t).filter((n) => !/^[123]$/.test(n)),
    words = ebqWords(t);
  const match = (i) => {
    if (!set.sources[i - 1]) return { nHit: 0, wHit: 0, ok: false };
    const st = set.sources[i - 1].title + " " + set.sources[i - 1].text,
      sn = new Set(ebqNums(st)),
      sw = ebqWords(st);
    const nHit = nums.filter((n) => sn.has(n)).length,
      wHit = [...words].filter((w) => sw.has(w)).length;
    return { nHit, wHit, ok: (nHit >= 1 && wHit >= 2) || wHit >= 5 };
  };
  const per = [1, 2, 3].map(match),
    best = per.reduce((b, m, i) => (m.nHit * 3 + m.wHit > b.s ? { s: m.nHit * 3 + m.wHit, i: i + 1 } : b), { s: 0, i: 0 }).i;
  return { cites, per, best, nums };
}
function ebqExplains(raw) {
  const t = ebqNorm(raw),
    n = (t.match(/[a-z']+/g) || []).length;
  return n >= 10 && /\b(because|support|supports|shows?|since|therefore|this means|which means|suggests?|so|as a result|explains?|demonstrat\w*|proves?|indicates?|leads? to|causes?|meaning|backs up|consistent with|reflects?)\b/.test(t);
}
function gradeEBQ(set, ans) {
  const parts = {},
    ev = {},
    conc = {};
  let total = 0;
  const P = (k, pts, max, checks, tips = []) => {
    parts[k] = { pts, max, checks, tips };
    total += pts;
  };
  const blank = (k) => !(ans[k] || "").trim();
  {
    const k = "A",
      raw = ans[k] || "",
      t = ebqNorm(raw),
      n = (t.match(/[a-z']+/g) || []).length,
      c = [],
      tips = [];
    if (blank(k)) P(k, 0, 1, [{ ok: false, text: "No claim written." }]);
    else {
      const pos = /\b(should|shouldn't|must|need to|ought|because|depends?|unless|only|especially|more|less|fewer|increases?|decreases?|reduces?|raises?|lowers?|improves?|worsens?|harms?|hurts?|helps?|protects?|prevents?|benefits?|better|worse|effective|ineffective|outweigh|not)\b/.test(t);
      const topic = (set.topicWords || []).some((w) => t.includes(w.toLowerCase())),
        specific = n >= 8,
        ok = pos && specific && topic;
      c.push({ ok: specific, text: specific ? "Specific enough: more than a one-line slogan." : 'Too short/vague. A claim like "X affects Y" earns 0. Say HOW or WHAT should happen.' });
      c.push({ ok: pos, text: pos ? "Takes a clear, defensible position." : 'No clear position. Use words like "should," "because," "reduces," or "depends on."' });
      c.push({ ok: topic, text: topic ? "Responds to the question's topic." : "Doesn't clearly respond to the question. Use the topic's key words." });
      if (!ok) tips.push("Formula: [Who] should/shouldn't [do what] because [result the sources show].");
      P(k, ok ? 1 : 0, 1, c, tips);
    }
  }
  for (const k of ["Bi", "Ci"]) {
    const raw = ans[k] || "",
      c = [],
      tips = [];
    if (blank(k)) {
      P(k, 0, 1, [{ ok: false, text: "No evidence written." }]);
      continue;
    }
    const e = ebqEvidence(set, raw);
    ev[k] = e;
    const cited = e.cites.length > 0,
      src = e.cites[0] || 0;
    c.push({ ok: cited, text: cited ? `Cites Source ${e.cites.join(" and ")}.` : 'No citation. Add "(Source 1)" after the evidence or start with "According to Source 2,…".' });
    const spec = src ? e.per[src - 1].ok : false,
      wrong = src && !spec && e.best && e.best !== src && e.per[e.best - 1].ok;
    if (cited)
      c.push({
        ok: spec,
        text: spec
          ? `Uses specific evidence from Source ${src}${e.per[src - 1].nHit ? " (with its data)" : ""}.`
          : wrong
            ? `This evidence looks like it comes from Source ${e.best}, not Source ${src}. Check your citation.`
            : `Not specific enough. Quote the actual data from Source ${src} (numbers, groups, what changed).`,
      });
    let diff = true;
    if (k === "Ci" && cited && ev.Bi && ev.Bi.cites.length) {
      diff = !e.cites.every((x) => ev.Bi.cites.includes(x));
      c.push({ ok: diff, text: diff ? "Uses a different source than Part B(i)." : `Same source as Part B(i) (Source ${src}). Part C must use a DIFFERENT source.` });
    }
    if (!e.nums.length) tips.push("Numbers make evidence specific: include a statistic from the source.");
    P(k, cited && spec && diff ? 1 : 0, 1, c, tips);
  }
  for (const k of ["Bii", "Cii"]) {
    const raw = ans[k] || "",
      c = [],
      tips = [];
    if (blank(k)) {
      P(k, 0, 2, [{ ok: false, text: "No explanation written." }]);
      continue;
    }
    const ex = ebqExplains(raw),
      cc = ebqConcepts(set, raw);
    conc[k] = cc;
    c.push({ ok: ex, text: ex ? "Explains how the evidence supports your claim." : 'Doesn\'t explain HOW the evidence supports your claim. Start with "This supports my claim because…".' });
    let used = cc.used;
    if (k === "Cii" && conc.Bii) {
      const same = used.filter((x) => conc.Bii.used.includes(x));
      used = used.filter((x) => !conc.Bii.used.includes(x));
      if (same.length && !used.length) c.push({ ok: false, text: `Uses the same concept as Part B(ii) (${same.join(", ")}). C(ii) needs a DIFFERENT one, so it's capped at 1 point.` });
    }
    const app = ex && used.length > 0;
    if (used.length) c.push({ ok: app, text: app ? `Applies a psych concept: ${used.slice(0, 3).join(", ")}.` : `Names ${used[0]}, but you also need to explain how the evidence supports your claim.` });
    else if (cc.fromSrc.length) c.push({ ok: false, text: `"${cc.fromSrc[0]}" appears in the sources, so it doesn't count as an applied concept. Bring in a concept from class.` });
    else if (!(k === "Cii" && conc.Bii && cc.used.length))
      c.push({ ok: false, text: "No psych concept from class applied. Name one (e.g., social comparison theory, operant conditioning, circadian rhythm) and use it to explain WHY." });
    if (app && !/\b(this (can be|is) explained|explained by|according to|because of|due to|through|by|which)\b/.test(ebqNorm(raw))) tips.push('Link the concept to the evidence: "This can be explained by ___, which…".');
    P(k, (ex ? 1 : 0) + (app ? 1 : 0), 2, c, tips);
  }
  return { parts, total };
}

/* ---------- engine glue ---------- */
/* An EBQ question's sources, in the shape his grader expects. */
function ebqSet(q, src) {
  return {
    question: src ? src.title : "",
    topicWords: q.topicWords || [],
    sources: ((src && src.blocks) || []).map((b) => ({ title: b.h.replace(/^Source \d+:\s*/, ""), text: b.p })),
  };
}
/* Check every part of a wfr question with the key-word checker. Returns {parts: {k: {pts, max, checks, tips}}, total, max}. */
function frqGrade(q, src, ans) {
  let parts = {};
  if (q.grader === "aaq") {
    if (!q.r) return null; /* an AI-generated article has no rubric: only Gemini can grade it */
    q.parts.forEach((p) => (parts[p.k] = gradeAAQPart(q, p.k, ans[p.k] || "")));
  } else if (q.grader === "ebq") parts = gradeEBQ(ebqSet(q, src), ans).parts;
  else return null;
  const total = q.parts.reduce((n, p) => n + ((parts[p.k] && parts[p.k].pts) || 0), 0),
    max = q.parts.reduce((n, p) => n + (p.max || 1), 0);
  return { parts, total, max };
}
/* Psych concepts that fit an EBQ prompt: the ones his model answers use. */
function ebqIdeas(q, src) {
  const set = ebqSet(q, src);
  return [...new Set(["Bii", "Cii"].flatMap((k) => ebqConcepts(set, (q.parts.find((p) => p.k === k) || {}).model || "").used))];
}
