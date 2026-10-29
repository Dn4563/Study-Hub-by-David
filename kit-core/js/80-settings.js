/* Settings, export/import and resets. Theme and text size are shared by every unit of the course. */
function setHTML() {
  const s = SAVE.settings;
  const pref = (key, label, opts) =>
    "<label>" + label + ' <select data-pref="' + key + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (String(PREFS[key]) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>";
  const chk = (key, label) => '<label class="chk"><input type="checkbox" data-set="' + key + '"' + (s[key] ? " checked" : "") + "> " + label + "</label>";
  const hasOpt = D.allDecks.some((d) => d.optional);
  return (
    '<section class="panel form"><h2>Settings</h2><h3>Display</h3><div class="ctl">' +
    pref("theme", "Theme", [
      ["auto", "Match device"],
      ["light", "Light"],
      ["dark", "Dark"],
    ]) +
    pref("size", "Text size", [
      [0, "Small"],
      [1, "Medium"],
      [2, "Default"],
      [3, "Large"],
      [4, "Extra large"],
    ]) +
    "</div>" +
    chk("hooks", "Show memory hooks") +
    (hasOpt ? chk("optDeck", "Include optional decks in All decks, the progress meter and the mixed quiz") : "") +
    "<h3>Answering</h3>" +
    chk("confirm", "Lock in answers: pick a choice, then press Lock in answer, so a misclick does not count. Applies to Learn, Quiz and the Practice Test.") +
    '<h3>Flashcards</h3><div class="ctl">' +
    FC_CTL() +
    '</div><h3>Quiz</h3><div class="ctl">' +
    selHTML("qType", "Question types", [
      ["mixed", "Mixed"],
      ["terms", "Terms only"],
      ["scen", "Scenarios only"],
    ]) +
    selHTML("dir", "Term questions", [
      ["both", "Both directions"],
      ["t2d", "Term to definition"],
      ["d2t", "Definition to term"],
    ]) +
    selHTML("focus", "Focus", [
      ["unknown", "Not known first"],
      ["random", "Random"],
      ["trouble", "Trouble terms first"],
    ]) +
    '</div><h3>Saved progress</h3><p class="muted">Everything saves in this browser automatically. Export to move it to another device, then Import there.</p><div class="qnav"><button class="btn sec" data-act="exp">Export progress</button><button class="btn sec" data-act="imp">Import progress</button><button class="btn danger" data-act="resetall">Reset this unit</button></div><textarea id="xport" rows="4" aria-label="Exported progress" placeholder="Export fills this box. To import, paste exported text here and press Import progress."></textarea></section>'
  );
}
function SET(t) {
  const k = t.dataset.set;
  SAVE.settings[k] = t.type === "checkbox" ? t.checked : t.value;
  if (k === "optDeck") {
    rebuild();
    UI.deck = 0;
    UI.L = null;
    UI.run = null;
    UI.q = null;
    SAVE.li = Math.min(SAVE.li || 0, LESSONS.length - 1);
  }
  save();
  if (["fcPool", "fcOrder", "fcFirst", "optDeck"].indexOf(k) >= 0) FC = null;
  render();
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!UNIT || !t.dataset) return;
  if (t.dataset.pref !== undefined) {
    PREFS[t.dataset.pref] = t.dataset.pref === "size" ? Number(t.value) : t.value;
    writeJSON(PREFK, PREFS);
    applyPrefs();
    render();
  } else if (t.dataset.set !== undefined) SET(t);
  else if (t.dataset.q !== undefined || t.dataset.qd !== undefined) QSET(t);
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (UNIT && t.dataset && t.dataset.ans !== undefined) PTinput(t);
});
ACT.exp = () => {
  const e = document.getElementById("xport");
  e.value = JSON.stringify({ course: COURSE.id, unit: UNIT.id, known: SAVE.known, trouble: SAVE.trouble, done: SAVE.done, li: SAVE.li, settings: SAVE.settings, pt: PTpack() });
  e.select();
};
ACT.imp = () => {
  const e = document.getElementById("xport");
  try {
    const o = JSON.parse(e.value);
    if (o.unit && o.unit !== UNIT.id) throw new Error("other unit");
    SAVE.known = o.known || {};
    SAVE.trouble = o.trouble || {};
    SAVE.done = o.done || {};
    SAVE.li = o.li || 0;
    const s = Object.assign({}, o.settings || {});
    delete s.theme;
    delete s.size;
    SAVE.settings = Object.assign({}, DEF, s);
    rebuild();
    UI.deck = 0;
    UI.q = null;
    if (o.pt) PTload(o.pt);
    save();
    FC = null;
    UI.L = null;
    render();
  } catch (err) {
    e.value = err.message === "other unit" ? "That export is from a different unit. Open that unit and import it there." : "That text could not be read. Paste the exported text exactly.";
  }
};
ACT.resetall = () => {
  if (!ask("Reset everything in this unit: study progress, lessons and the whole practice test?")) return;
  SAVE.known = {};
  SAVE.trouble = {};
  SAVE.done = {};
  SAVE.li = 0;
  UI.L = null;
  FC = null;
  PTreset();
  save();
  render();
};
