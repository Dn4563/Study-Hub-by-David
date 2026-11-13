/* Whole-course backup on the course home page: one file with every unit's saved progress (and the course's
   theme and text size). Restore reads that file back. In a kit built with content/import-map.json (for example
   the Psych kit, whose content came from Phineas's kit), Restore also reads that other kit's backup file and
   carries over the cards marked known and the missed-term counts. */
let bkMsg = "";
const BK_PREFIX = "sk:" + COURSE.id + ":";
function backupData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.indexOf(BK_PREFIX) === 0 || k === THEMEK)) data[k] = localStorage.getItem(k);
    }
  } catch (e) {}
  return { app: "study-kit", course: COURSE.id, saved: new Date().toISOString(), data: data };
}
function restoreData(o) {
  if (!o || o.app !== "study-kit" || typeof o.data !== "object") throw new Error("unreadable");
  if (o.course !== COURSE.id) throw new Error("other course");
  const keys = Object.keys(o.data).filter((k) => (k.indexOf(BK_PREFIX) === 0 || k === THEMEK) && typeof o.data[k] === "string");
  if (!keys.length) throw new Error("empty");
  keys.forEach((k) => {
    try {
      localStorage.setItem(k, o.data[k]);
    } catch (e) {}
  });
  return "Restored your progress for " + plural(new Set(keys.filter((k) => k !== THEMEK).map((k) => k.split(":")[2])).size - (o.data[BK_PREFIX + "prefs"] ? 1 : 0), "unit") + ".";
}
/* Every card in a unit, optional decks included, keyed by term. */
function termIds(u) {
  const out = {};
  UNITDATA[u.id].decks.forEach((dk) => dk.sections.forEach((sc, si) => sc.cards.forEach((c, ci) => (out[c.term] = dk.id + "." + si + "." + ci))));
  return out;
}
function importForeign(o) {
  const M = IMPORT_MAP;
  const parse = (k) => {
    try {
      return JSON.parse((o.data || {})[k] || "null") || {};
    } catch (e) {
      return {};
    }
  };
  const known = parse(M.known),
    miss = parse(M.miss);
  const per = {};
  const ids = {};
  const touch = (hisId) => {
    const m = M.cards[hisId];
    if (!m) return null;
    const u = COURSE.units.find((x) => x.id === m[0]);
    if (!u) return null;
    ids[u.id] = ids[u.id] || termIds(u);
    const id = ids[u.id][m[1]];
    if (!id) return null;
    if (!per[u.id]) per[u.id] = { u: u, saved: readJSON(keyOf(u, "kit")) || {}, known: 0, trouble: 0 };
    const p = per[u.id];
    p.saved.known = p.saved.known || {};
    p.saved.trouble = p.saved.trouble || {};
    return { p: p, id: id };
  };
  Object.keys(known).forEach((h) => {
    if (!known[h]) return;
    const t = touch(h);
    if (!t) return;
    if (!t.p.saved.known[t.id]) t.p.known++;
    t.p.saved.known[t.id] = true;
  });
  Object.keys(miss).forEach((h) => {
    const n = Number(miss[h]) || 0;
    if (n <= 0) return;
    const t = touch(h);
    if (!t) return;
    if (!((t.p.saved.trouble[t.id] || 0) > 0)) t.p.trouble++;
    t.p.saved.trouble[t.id] = Math.max(t.p.saved.trouble[t.id] || 0, n);
  });
  const parts = [];
  let nk = 0,
    nt = 0;
  COURSE.units.forEach((u) => {
    const p = per[u.id];
    if (!p) return;
    writeJSON(keyOf(u, "kit"), p.saved);
    nk += p.known;
    nt += p.trouble;
    parts.push(u.label + ": " + p.known + " known, " + p.trouble + " to practice");
  });
  if (!parts.length) throw new Error("nothing");
  return "Brought over " + plural(nk, "known card") + " and " + plural(nt, "missed term") + " from " + M.name + ". " + parts.join(" · ") + ".";
}
function readBackupFile(text) {
  const o = JSON.parse(text);
  if (IMPORT_MAP && o && o.app === IMPORT_MAP.app) return importForeign(o);
  return restoreData(o);
}
const BK_ERR = {
  "other course": "That backup is from a different course. Restore it in that course's study kit.",
  empty: "That backup has no saved progress in it.",
  nothing: "None of the cards in that backup match this kit.",
};
function backupHTML() {
  return (
    '<section class="panel backup"><h2>Backup</h2><p class="muted">Your progress saves in this browser. Download one file with every unit, then restore it on another device or browser.' +
    (IMPORT_MAP ? " Restore also accepts a backup file from " + esc(IMPORT_MAP.name) + "." : "") +
    '</p><div class="qnav"><button class="btn sec" data-act="bkdown">Download backup</button><button class="btn sec" data-act="bkup">Restore from backup</button></div>' +
    '<input type="file" id="bkfile" accept=".json,application/json" hidden>' +
    (bkMsg ? '<p class="bkmsg" role="status">' + esc(bkMsg) + "</p>" : "") +
    "</section>"
  );
}
ACT.bkdown = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(backupData(), null, 1)], { type: "application/json" }));
  a.download = COURSE.id + "-study-kit-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
};
ACT.bkup = () => document.getElementById("bkfile").click();
document.addEventListener("change", (e) => {
  if (!e.target || e.target.id !== "bkfile" || !e.target.files || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      bkMsg = readBackupFile(String(r.result));
    } catch (err) {
      bkMsg = BK_ERR[err.message] || "That file could not be read. Choose a backup file downloaded from a study kit.";
    }
    renderHome();
  };
  r.readAsText(e.target.files[0]);
});
