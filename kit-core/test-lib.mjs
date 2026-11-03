// Click-through test for a built kit: opens every tab, runs a lesson, a quiz, flashcards, every practice-test
// section, exam results, settings export/import, save and reload, reset, and the move from old storage keys.
// Fails loudly on any page error. Needs jsdom (npm install --save-dev jsdom).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

export async function clickthrough(htmlPath, { log = console.log } = {}) {
  const require = createRequire(pathToFileURL(htmlPath));
  const { JSDOM, VirtualConsole } = require("jsdom");
  const html = readFileSync(htmlPath, "utf8");
  const base = "https://kit.test/index.html"; // a real origin, so localStorage works
  const errors = [];
  let passed = 0;
  const ok = (cond, msg) => {
    if (!cond) throw new Error("Check failed: " + msg);
    passed++;
  };

  function open(hash, store) {
    const vc = new VirtualConsole();
    vc.on("jsdomError", (e) => errors.push(e.message + (e.detail ? " " + e.detail : "")));
    vc.on("error", (...a) => errors.push(a.join(" ")));
    const dom = new JSDOM(html, {
      url: base + (hash ? "#" + hash : ""),
      runScripts: "dangerously",
      pretendToBeVisual: true,
      virtualConsole: vc,
      beforeParse(w) {
        w.confirm = () => true;
        w.scrollTo = () => {};
        w.open = () => null;
        w.print = () => {};
        for (const [k, v] of Object.entries(store || {})) w.localStorage.setItem(k, v);
      },
    });
    const w = dom.window,
      d = w.document;
    const q = (s) => d.querySelector(s),
      qa = (s) => [...d.querySelectorAll(s)];
    const click = (el, what) => {
      ok(el, "found " + what);
      el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    };
    const byText = (sel, text) => qa(sel).find((e) => e.textContent.trim().startsWith(text));
    const change = (el, v) => {
      if (el.type === "checkbox") el.checked = v;
      else el.value = v;
      el.dispatchEvent(new w.Event("change", { bubbles: true }));
    };
    const storage = () => {
      const o = {};
      for (let i = 0; i < w.localStorage.length; i++) o[w.localStorage.key(i)] = w.localStorage.getItem(w.localStorage.key(i));
      return o;
    };
    return { w, d, q, qa, click, byText, change, storage, close: () => w.close() };
  }
  const assertNoErrors = (where) => {
    if (errors.length) throw new Error(where + ": page errors:\n  " + errors.join("\n  "));
  };

  // 1. Course home
  let P = open("");
  const course = P.w.eval("COURSE");
  const units = course.units.map((u) => u.id);
  ok(P.qa(".unitrow").length === units.length, "home lists every unit");
  ok(P.q(".hublink") && P.q(".hublink").getAttribute("href") === course.hub, "home links back to the Study Hub");
  assertNoErrors("home");
  P.close();

  for (const unit of units) {
    // 2. Every tab renders
    P = open(unit);
    ok(P.q("h1"), "unit header");
    const tabs = P.qa(".tab").map((t) => t.dataset.t);
    for (const t of tabs) {
      P.click(P.q('.tab[data-t="' + t + '"]'), "tab " + t);
      ok(P.q("main").innerHTML.length > 50, "tab " + t + " has content");
    }
    assertNoErrors(unit + " tabs");

    // 3. One full lesson, answering wrong once so the retry path runs
    P.click(P.q('.tab[data-t="learn"]'), "Learn tab");
    P.click(P.q('[data-act="lquiz"]'), "Quiz me");
    let guard = 0,
      missedOnce = false;
    while (P.q('[data-act="lopt"]') && guard++ < 60) {
      const opts = P.qa('[data-act="lopt"]');
      const right = P.w.eval("UI.L.cur.options.findIndex(o => o.ok)");
      const pick = !missedOnce ? (right + 1) % opts.length : right;
      missedOnce = true;
      P.click(opts[pick], "option");
      if (P.q('[data-act="lconfirm"]')) P.click(P.q('[data-act="lconfirm"]'), "Lock in");
      P.click(P.q('[data-act="lnext"]'), "Next");
    }
    ok(P.q(".scorebig"), "lesson summary shown");
    ok(Object.keys(P.w.eval("SAVE.trouble")).length > 0, "missed term became a trouble term");
    assertNoErrors(unit + " lesson");

    // 3b. Section review: the last part of a section split into 2+ lessons offers a short review on the whole section
    const srIdx = P.w.eval("LESSONS.findIndex(l => l.parts > 1 && l.part === l.parts - 1)");
    const soloIdx = P.w.eval("LESSONS.findIndex(l => l.parts === 1)");
    const runLesson = (what) => {
      let g = 0;
      while (P.q('[data-act="lopt"]') && g++ < 60) {
        const right = P.w.eval("UI.L.cur.options.findIndex(o => o.ok)");
        P.click(P.qa('[data-act="lopt"]')[right], what + " option");
        if (P.q('[data-act="lconfirm"]')) P.click(P.q('[data-act="lconfirm"]'), "Lock in");
        P.click(P.q('[data-act="lnext"]'), "Next");
      }
    };
    if (soloIdx >= 0) {
      P.w.eval("startLesson(" + soloIdx + ")");
      P.click(P.q('[data-act="lquiz"]'), "Quiz me (one-part section)");
      runLesson("one-part lesson");
      ok(P.q(".scorebig") && !P.q('[data-act="srstart"]'), "a one-part section has no section review");
    }
    if (srIdx >= 0) {
      P.w.eval("startLesson(" + srIdx + ")");
      P.click(P.q('[data-act="lquiz"]'), "Quiz me (last part)");
      runLesson("last-part lesson");
      P.click(P.q('[data-act="srstart"]'), "Section review button");
      const n = P.w.eval("UI.L.queue.length + 1");
      ok(n === Math.min(5, P.w.eval("secCards(LESSONS[" + srIdx + "].sec).length")), "section review has 5 questions (or the whole section if smaller)");
      ok(/Section review/.test(P.q("main .panel .rtop").textContent), "section review is labeled");
      runLesson("section review");
      ok(/Section review/.test(P.q("main h2").textContent) && P.q(".scorebig"), "section review results shown");
      const rec = P.w.eval("SAVE.secRev[LESSONS[" + srIdx + "].sec]");
      ok(rec && rec.best === rec.n, "section review score saved");
      P.click(P.q('[data-act="lmap"]'), "Lesson map");
      ok(P.q(".lmap .srb"), "lesson map shows the section review score");
      P.click(P.q('[data-act="lmap"]'), "close Lesson map");
    }
    assertNoErrors(unit + " section review");

    // 4. Quiz builder with immediate feedback, then results and retry
    P.click(P.q('.tab[data-t="quiz"]'), "Quiz tab");
    P.click(P.q('[data-act="qstart"]'), "Start quiz");
    guard = 0;
    while (P.q('[data-act="rpick"]') && guard++ < 80) {
      P.click(P.q('[data-act="relim"]'), "cross-off");
      ok(P.q(".optrow.crossed"), "cross-off strikes a choice");
      P.click(P.q('[data-act="relim"]'), "un-cross");
      P.click(P.qa('[data-act="rpick"]')[0], "quiz option");
      if (P.q('[data-act="rconfirm"]')) P.click(P.q('[data-act="rconfirm"]'), "Lock in");
      P.click(P.q('[data-act="rnext"]'), "Next");
    }
    ok(/results/.test(P.q("main h2").textContent), "quiz results");
    ok(P.q(".breakdown"), "results break down by type and deck");
    if (P.q('[data-act="rretry"]')) P.click(P.q('[data-act="rretry"]'), "Retry missed");
    assertNoErrors(unit + " quiz");

    // 5. Flashcards (Quizlet-style): flip, sort, Back undoes, swap sides, star, browse, round results
    P.click(P.q('.tab[data-t="flash"]'), "Flashcards tab");
    P.change(P.q('select[data-set="fcPool"]'), "all");
    if (P.q('[data-act="fcgot"]')) {
      P.click(P.q('[data-act="fcflip"]'), "flip");
      const id0 = P.w.eval("FC.q[0]"),
        known0 = P.w.eval("!!SAVE.known['" + id0 + "']");
      P.click(P.q('[data-act="fcgot"]'), "Got it");
      ok(P.w.eval("FC.q[0]") !== id0 && P.w.eval("!!SAVE.known['" + id0 + "']"), "Got it moves on and marks the card known");
      P.click(P.q('[data-act="fcback"]'), "Back");
      ok(P.w.eval("FC.q[0]") === id0 && P.w.eval("!!SAVE.known['" + id0 + "']") === known0, "Back returns the card and undoes Got it");
      const tr0 = P.w.eval("SAVE.trouble['" + id0 + "'] || 0");
      P.click(P.q('[data-act="fcnot"]'), "Not yet");
      P.click(P.q('[data-act="fcback"]'), "Back after Not yet");
      ok((P.w.eval("SAVE.trouble['" + id0 + "'] || 0")) === tr0 && P.w.eval("FC.q[0]") === id0, "Back undoes Not yet");
      const side0 = P.w.eval("SAVE.settings.fcFirst"),
        face0 = P.q(".fcard").textContent;
      P.click(P.q('[data-act="fcswap"]'), "Swap sides");
      ok(P.w.eval("SAVE.settings.fcFirst") !== side0 && P.q(".fcard").textContent !== face0, "Swap sides shows the other side first");
      P.click(P.q('[data-act="fcswap"]'), "Swap back");
      P.click(P.q('[data-act="fcstar"]'), "Star");
      ok(P.w.eval("!!SAVE.star['" + id0 + "']"), "star saved");
      P.change(P.q('select[data-set="fcPool"]'), "starred");
      ok(P.w.eval("FC.q.length") === 1 && P.w.eval("FC.q[0]") === id0, "Starred pool holds the starred card");
      P.click(P.q('[data-act="fcnot"]'), "Not yet in starred pool");
      P.click(P.q('[data-act="fcgot"]'), "Got it in starred pool");
      ok(/Round done/.test(P.q("main").textContent) && P.q('[data-act="fclearn"]'), "round results with Keep reviewing");
      P.click(P.q('[data-act="fclearn"]'), "Keep reviewing");
      ok(P.w.eval("FC.q.length") === 1, "Keep reviewing restarts with the still-learning cards");
      P.click(P.q('[data-act="fcstar"]'), "Unstar");
      P.change(P.q('select[data-set="fcPool"]'), "all");
      P.change(P.q('select[data-set="fcMode"]'), "browse");
      ok(P.q('[data-act="fcprev"]').disabled && !P.q('[data-act="fcgot"]'), "Browse mode: Previous/Next, no sorting");
      P.click(P.q('[data-act="fcnext"]'), "Next");
      ok(P.w.eval("FC.i") === 1, "Next moves forward");
      P.click(P.q('[data-act="fcprev"]'), "Previous");
      ok(P.w.eval("FC.i") === 0, "Previous moves back");
      P.change(P.q('select[data-set="fcMode"]'), "sort");
      P.change(P.q('select[data-set="fcPool"]'), "unknown");
    }
    assertNoErrors(unit + " flashcards");

    // 6. Every practice and exam section: answer the first question
    for (const mode of ["pt", "exam"]) {
      if (!P.q('.tab[data-t="' + mode + '"]')) continue;
      P.click(P.q('.tab[data-t="' + mode + '"]'), mode + " tab");
      const nsec = P.qa('[data-act="ptsec"]').length;
      for (let i = 0; i < nsec; i++) {
        P.click(P.qa('[data-act="ptsec"]')[i], "section " + i);
        const type = P.w.eval("cur3().q.type");
        if (type === "mcq" || type === "tf") {
          P.click(P.q('[data-act="ptopt"]'), "choice");
          if (P.q('[data-act="ptcheck"]:not([disabled])')) P.click(P.q('[data-act="ptcheck"]'), "Check Answer");
          ok(P.q(".fb"), mode + " " + i + ": feedback after check");
          if (type === "mcq") ok(P.q(".whyall") || P.q(".why"), "explanation shown");
        } else if (type === "label" || type === "diagram") {
          const n = P.w.eval("itemsOf(cur3().q).length");
          for (let k = 0; k < n; k++) P.click(P.q('[data-act="ptitem"][data-i="' + k + '"][data-v="0"]'), "label");
          P.click(P.q('[data-act="ptcheck"]'), "Check Answer");
          ok(P.q(".fb"), "label score shown");
        } else {
          const ta = P.q("textarea[data-ans]");
          ta.value = "My answer";
          ta.dispatchEvent(new P.w.Event("input", { bubbles: true }));
          P.click(P.q('[data-act="ptcheck"]'), "Check Answer");
          ok(P.q(".model"), "model answer revealed");
          P.click(P.q('[data-act="ptmark"][data-v="1"]'), "All parts right");
          P.click(P.q('[data-act="ptpart"][data-v="0"]'), "first part missed");
          ok(P.q('.pal.partial[aria-current], .pal.bad[aria-current]'), "self-marking one part wrong gives partial credit");
        }
        P.click(P.q('[data-act="ptflag"]'), "flag");
        ok(P.q(".pal.flag"), "flag shows on palette");
        P.click(P.q('[data-act="ptnext"]'), "Next");
        P.click(P.q('[data-act="ptprev"]'), "Previous");
      }
      P.click(P.q('[data-act="ptshuffle"]'), "Shuffle");
      P.click(P.q('[data-act="ptunshuffle"]'), "Original order");
      P.click(P.q('[data-act="ptretest"]'), "Retest missed");
      P.click(P.q('[data-act="pttimer"]'), "Timer on");
      P.click(P.q('[data-act="pttimer"]'), "Timer off");
      P.click(P.q('[data-act="ptprint"]'), "Print view");
      if (mode === "exam") {
        P.click(P.q('[data-act="ptres"]'), "exam results");
        ok(/results/.test(P.q("main h2").textContent) && P.q(".resq"), "exam results page lists questions");
      }
      assertNoErrors(unit + " " + mode);
    }

    // 6b. Diagram labeling: image embedded, pins placed, partial credit
    const dg = P.w.eval("(() => { for (let i = 0; i < PT.secs.length; i++) { const s = PT.secs[i], n = s.order.findIndex((id) => s.byId[id].type === 'diagram'); if (n >= 0) return [i, n, s.mode]; } return null; })()");
    if (dg) {
      P.click(P.q('.tab[data-t="' + (dg[2] === "exam" ? "exam" : "pt") + '"]'), "practice tab");
      P.click(P.q('[data-act="ptsec"][data-i="' + dg[0] + '"]'), "diagram section");
      P.click(P.q('[data-act="ptjump"][data-n="' + dg[1] + '"]'), "diagram question");
      ok(P.q(".dimg img").getAttribute("src").startsWith("data:image/"), "diagram image is embedded");
      ok(P.q(".diagram .credit"), "diagram shows its image credit");
      const pins = P.w.eval("cur3().q.pins");
      ok(P.qa(".pin").length === pins.length, "one numbered pin per label");
      pins.forEach((pin, k) => P.click(P.q('[data-act="ptitem"][data-i="' + k + '"][data-v="' + (k === 0 ? (pin.ans + 1) % P.w.eval("cur3().q.labels.length") : pin.ans) + '"]'), "pin label"));
      P.click(P.q('[data-act="ptcheck"]'), "Check diagram");
      ok(P.qa(".pin.wrong").length === 1 && P.qa(".pin.right").length === pins.length - 1, "diagram marks each pin right or wrong");
      ok(P.q(".pal.partial[aria-current]"), "one wrong pin gives partial credit");
      assertNoErrors(unit + " diagram");
    }

    // 6d. Mixed units: no blanks in choices; neither the right nor a wrong definition choice contains the asked term.
    if (P.w.eval("MIX")) {
      const leaks = P.w.eval(`(() => { const bad = []; for (let t = 0; t < 6; t++) ALL.forEach((c) => ["t2d", "d2t"].forEach((d) => {
          const q = mcQ(c, d); if (q.kind !== "mc") return;
          q.options.forEach((o) => { if (o.t.indexOf("_____") >= 0) bad.push(c.term + ": blank in a choice");
            if (q.dir === "t2d" && hasTerm(o.t, c.term)) bad.push(c.term + ": choice contains the term"); });
          if (q.dir === "d2t" && hasTerm(q.prompt, c.term)) bad.push(c.term + ": clue contains the term"); }));
        return [...new Set(bad)]; })()`);
      ok(!leaks.length, "definition questions never give away the term: " + leaks.slice(0, 4).join("; "));
    }

    // 6e. Mixed units: review terms don't repeat in back-to-back lessons.
    if (P.w.eval("MIX") && P.w.eval("LESSONS.length > 8")) {
      const rv = P.w.eval(`(() => { LESSONS.forEach((l) => (SAVE.done[l.id] = true)); let prev = [], clash = 0;
        for (let t = 0; t < 30; t++) { startLesson(5 + (t % 3)); ACT.lquiz(); const ids = UI.L.queue.concat([UI.L.item]).filter((it) => it && it.review).map((it) => it.id);
          if (ids.some((id) => prev.indexOf(id) >= 0)) clash++; prev = ids; } SAVE.done = {}; return clash; })()`);
      ok(rv === 0, "review terms don't repeat in back-to-back lessons (" + rv + " repeats)");
    }

    // 6c. Old unit recall: at most 1 per lesson, never in a deck's first lesson, only earlier units.
    if (P.w.eval("!!UNIT.recall") && P.w.eval("earlierUnits().length > 0")) {
      const r = P.w.eval(`(() => { let lessons = 0, withRecall = 0, bad = []; const early = earlierUnits().map((u) => u.id);
        for (let t = 0; t < 300; t++) { const i = t % LESSONS.length; startLesson(i); ACT.lquiz();
          const items = UI.L.queue.concat(UI.L.item ? [UI.L.item] : []).filter((it) => it.type === "recall");
          lessons++; if (items.length) withRecall++;
          if (items.length > 1) bad.push("lesson " + i + " has " + items.length);
          if (items.length && isFirstOfDeck(LESSONS[i])) bad.push("recall in first lesson of a deck");
          items.forEach((it) => early.indexOf(it.unit) < 0 && bad.push("recall from " + it.unit)); }
        return { lessons, withRecall, bad }; })()`);
      ok(!r.bad.length, "recall limits: " + r.bad.slice(0, 3).join("; "));
      ok(r.withRecall > 0 && r.withRecall / r.lessons < 0.5, "recall shows up now and then (" + r.withRecall + " of " + r.lessons + " lessons)");
      // A wrong recall answer raises that term's trouble count in its own unit, not this one.
      const res = P.w.eval(`(() => { for (let t = 0; t < 200; t++) { startLesson(t % LESSONS.length); if (isFirstOfDeck(LESSONS[t % LESSONS.length])) continue; ACT.lquiz();
          const L = UI.L, j = L.queue.findIndex((it) => it.type === "recall"); if (j < 0) continue;
          L.queue.splice(0, j); nextLearnQ(); const q = UI.L.cur, before = (readJSON(keyOf(COURSE.units.find((u) => u.id === q.recall.unit), "kit")) || {}).trouble || {};
          const b = before[q.recall.id] || 0, firstTotal = UI.L.firstTotal; learnPick(q.options.findIndex((o) => !o.ok));
          const after = ((readJSON(keyOf(COURSE.units.find((u) => u.id === q.recall.unit), "kit")) || {}).trouble || {})[q.recall.id] || 0;
          return { ok: after === b + 1, label: /^From /.test(q.ask), noRequeue: !UI.L.queue.some((it) => it.type === "recall"), firstTotal, missList: UI.L.recallMiss.length }; } return null; })()`);
      ok(res && res.ok && res.label && res.noRequeue && res.missList === 1, "a missed recall question updates the old unit, is labeled, and is not re-queued");
      // Recall is weighted random with a cooldown: no term twice within 10 picks; a trouble term comes up more, not always.
      const rr = P.w.eval(`(() => { const u = earlierUnits()[0], k = keyOf(u, "kit"), s0 = readJSON(k) || {}; const cards = unitCards(u);
        writeJSON(k, Object.assign({}, s0, { trouble: { [cards[0].id]: 5 }, known: {}, recallSeen: {} }));
        const picks = []; for (let i = 0; i < 60; i++) picks.push(pickRecall().id);
        let repeat = 0; picks.forEach((id, i) => { if (picks.slice(Math.max(0, i - 10), i).indexOf(id) >= 0) repeat++; });
        writeJSON(k, s0); return { repeat, distinct: new Set(picks).size, hot: picks.filter((id) => id === cards[0].id).length }; })()`);
      ok(rr.repeat === 0, "recall never repeats a term within 10 picks (" + rr.repeat + " repeats)");
      ok(rr.distinct >= 40, "recall spreads across many terms (" + rr.distinct + " different in 60)");
      assertNoErrors(unit + " recall");
    }

    // 7. Save and reload: progress and practice answers survive
    const knownBefore = Object.keys(P.w.eval("SAVE.known")).length;
    const store = P.storage();
    ok(Object.keys(store).some((k) => k === "sk:" + course.id + ":" + unit + ":kit"), "progress saved under a namespaced key");
    P.close();
    P = open(unit, store);
    ok(Object.keys(P.w.eval("SAVE.known")).length === knownBefore, "known terms survive reload");
    ok(P.w.eval("PT.secs.some(s => Object.values(s.st).some(x => x.checked || Object.keys(x.pm).length))"), "practice answers survive reload");

    // 8. Settings: lock-in off, export, import, reset
    P.click(P.q('.tab[data-t="set"]'), "Settings tab");
    P.change(P.q('input[data-set="confirm"]'), false);
    ok(P.w.eval("SAVE.settings.confirm") === false, "Lock in can be turned off");
    P.click(P.q('[data-act="exp"]'), "Export");
    const exported = P.q("#xport").value;
    ok(exported.length > 20, "export text");
    P.click(P.q('[data-act="resetall"]'), "Reset this unit");
    ok(Object.keys(P.w.eval("SAVE.known")).length === 0, "reset clears progress");
    P.q("#xport").value = exported;
    P.click(P.q('[data-act="imp"]'), "Import");
    ok(Object.keys(P.w.eval("SAVE.known")).length === knownBefore, "import restores progress");
    assertNoErrors(unit + " settings");
    P.close();

    // 9. Progress saved by the old single-unit kit carries over
    const u = course.units.find((x) => x.id === unit);
    if (u.legacyKeys && u.legacyKeys.kit) {
      P = open(unit, { [u.legacyKeys.kit]: JSON.stringify({ known: { "1.0.0": true }, settings: { theme: "dark" } }) });
      ok(P.w.eval("SAVE.known['1.0.0']") === true, "old saved progress is carried over");
      ok(P.d.documentElement.getAttribute("data-theme") === "dark", "old theme setting is carried over");
      assertNoErrors(unit + " migration");
      P.close();
    }
    log(`  ${unit}: OK`);
  }
  return { passed, units };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  clickthrough(process.argv[2])
    .then((r) => console.log(`PASS: ${r.passed} checks across units ${r.units.join(", ")}`))
    .catch((e) => {
      console.error("FAIL: " + (process.env.DEBUG ? e.stack : e.message));
      process.exit(1);
    });
}
