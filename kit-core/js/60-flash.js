/* Flashcards, modeled on Quizlet's flashcard mode.
   Pool: not known yet / all / trouble terms / starred. Order: shuffled or section order. Side first: term or definition
   (the Swap sides button flips it in one tap).
   Two modes:
   - Sort: Not yet / Got it. "Not yet" returns the card about 4 cards later. Back undoes the last choice,
     including its Got it / trouble change. The round ends with a results screen.
   - Browse: Previous / Next through the pool, no sorting.
   Keys: Space or Up/Down flips, Right = Got it (Sort) or Next (Browse), Left = Back (Sort) or Previous (Browse),
   1 = Not yet, 2 = Got it, S = star. */
function fcBuild(onlyIds) {
  let pool = deckCards().slice();
  const p = SAVE.settings.fcPool;
  if (onlyIds) pool = pool.filter((c) => onlyIds.indexOf(c.id) >= 0);
  else if (p === "unknown") pool = pool.filter((c) => !SAVE.known[c.id]);
  else if (p === "trouble") pool = pool.filter((c) => SAVE.trouble[c.id] > 0);
  else if (p === "starred") pool = pool.filter((c) => SAVE.star[c.id]);
  if (SAVE.settings.fcOrder === "shuffle") pool = shuf(pool);
  FC = { q: pool.map((c) => c.id), list: pool.map((c) => c.id), i: 0, flip: false, total: pool.length, hist: [], got: [], learning: [] };
}
function selHTML(key, label, opts) {
  const v = SAVE.settings[key];
  return (
    "<label>" +
    label +
    ' <select data-set="' +
    key +
    '">' +
    opts.map((o) => '<option value="' + o[0] + '"' + (String(v) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>").join("") +
    "</select></label>"
  );
}
const FC_CTL = () =>
  selHTML("fcMode", "Mode", [
    ["sort", "Sort (Got it / Not yet)"],
    ["browse", "Browse (Previous / Next)"],
  ]) +
  selHTML("fcPool", "Pool", [
    ["unknown", "Not known yet"],
    ["all", "All"],
    ["trouble", "Trouble terms"],
    ["starred", "Starred"],
  ]) +
  selHTML("fcOrder", "Order", [
    ["shuffle", "Shuffled"],
    ["section", "Section order"],
  ]) +
  selHTML("fcFirst", "Show first", [
    ["term", "Term"],
    ["def", "Definition"],
  ]);
const fcBrowse = () => SAVE.settings.fcMode === "browse";
const fcCur = () => (fcBrowse() ? FC.list[FC.i] : FC.q[0]);

function fcCardHTML(c) {
  const showTerm = SAVE.settings.fcFirst === "term" ? !FC.flip : FC.flip,
    starred = !!SAVE.star[c.id];
  return (
    '<div class="fctools"><button class="btn sec small" data-act="fcstar" aria-pressed="' +
    starred +
    '">' +
    (starred ? "★ Starred" : "☆ Star") +
    '</button><button class="btn sec small" data-act="fcswap">⇄ Swap sides</button><button class="btn sec small" data-act="fcshuf">Shuffle</button><button class="btn sec small" data-act="fcagain">Restart</button></div>' +
    '<button class="fcard" data-act="fcflip" aria-label="Flip card">' +
    (showTerm ? '<span class="fterm">' + esc(c.term) + "</span>" : '<span class="fdef">' + esc(c.def) + "</span>" + hookLine(c)) +
    "<small>Tap or press Space to flip</small></button>"
  );
}
function fcHTML() {
  if (!FC) fcBuild();
  let h = '<div class="ctl">' + FC_CTL() + "</div>";
  const empty =
    '<section class="panel"><p class="big">Nothing in this pool.</p><p class="muted">' +
    (SAVE.settings.fcPool === "starred" ? "Star cards with the ☆ button, or switch the pool to All." : "Switch the pool to All to review everything, or pick another deck.") +
    '</p><button class="btn" data-act="fcagain">Start again</button></section>';
  if (fcBrowse()) {
    if (!FC.list.length) return h + empty;
    const n = FC.list.length,
      i = FC.i;
    h +=
      '<div class="fcprog"><span class="muted">Card ' +
      (i + 1) +
      " of " +
      n +
      '</span><span class="bar" aria-hidden="true"><i style="width:' +
      Math.round((100 * (i + 1)) / n) +
      '%"></i></span></div>' +
      fcCardHTML(BYID[FC.list[i]]) +
      '<div class="qnav fcnav"><button class="btn sec" data-act="fcprev"' +
      (i === 0 ? " disabled" : "") +
      '>← Previous</button><button class="btn" data-act="fcnext"' +
      (i === n - 1 ? " disabled" : "") +
      '>Next →</button></div><p class="muted">Keys: Space flips · ← and → move · S star.</p>';
    return h;
  }
  if (!FC.q.length) {
    if (!FC.total) return h + empty;
    const learning = FC.learning.length;
    h +=
      '<section class="panel"><h2>Round done</h2><p class="scorebig">' +
      FC.got.length +
      " of " +
      FC.total +
      '</p><p class="muted">known on the first try. ' +
      (learning ? "Still learning: " + plural(learning, "card") + "." : "Every card on the first try.") +
      "</p>" +
      (learning ? '<ul class="missed">' + FC.learning.map((id) => "<li><b>" + esc(BYID[id].term) + "</b> " + esc(BYID[id].def) + "</li>").join("") + "</ul>" : "") +
      '<div class="qnav">' +
      (FC.hist.length ? '<button class="btn sec" data-act="fcback">← Back</button>' : "") +
      '<button class="btn sec" data-act="fcagain">Restart</button>' +
      (learning ? '<button class="btn" data-act="fclearn">Keep reviewing the ' + learning + "</button>" : "") +
      "</div></section>";
    return h;
  }
  const done = FC.total - FC.q.length;
  h +=
    '<div class="fcprog"><span class="muted">' +
    done +
    " of " +
    FC.total +
    " sorted · Know " +
    FC.got.length +
    " · Still learning " +
    FC.learning.length +
    '</span><span class="bar" aria-hidden="true"><i style="width:' +
    Math.round((100 * done) / FC.total) +
    '%"></i></span></div>' +
    fcCardHTML(BYID[FC.q[0]]) +
    '<div class="qnav fcnav"><button class="btn sec" data-act="fcback"' +
    (FC.hist.length ? "" : " disabled") +
    '>← Back</button><button class="btn sec" data-act="fcnot">Not yet</button><button class="btn" data-act="fcgot">Got it</button></div><p class="muted">' +
    plural(FC.q.length, "card") +
    " left this round. Keys: Space flips · 1 Not yet · 2 or → Got it · ← Back · S star.</p>";
  return h;
}
/* Every sort records enough to undo it exactly. */
function fcPush(id) {
  FC.hist.push({ q: FC.q.slice(), got: FC.got.slice(), learning: FC.learning.slice(), known: !!SAVE.known[id], trouble: SAVE.trouble[id], id: id });
}
ACT.fcflip = () => {
  FC.flip = !FC.flip;
  render();
};
ACT.fcagain = () => {
  FC = null;
  render();
};
ACT.fcgot = () => {
  if (fcBrowse() || !FC.q.length) return;
  const id = FC.q[0];
  fcPush(id);
  FC.q.shift();
  setKnown(id, true);
  if (FC.learning.indexOf(id) < 0 && FC.got.indexOf(id) < 0) FC.got.push(id);
  FC.flip = false;
  render();
};
ACT.fcnot = () => {
  if (fcBrowse() || !FC.q.length) return;
  const id = FC.q[0];
  fcPush(id);
  FC.q.shift();
  delete SAVE.known[id];
  SAVE.trouble[id] = (SAVE.trouble[id] || 0) + 1;
  if (FC.learning.indexOf(id) < 0) FC.learning.push(id);
  FC.q.splice(Math.min(FC.q.length, 4), 0, id);
  FC.flip = false;
  save();
  render();
};
ACT.fcback = () => {
  const h = FC && FC.hist.pop();
  if (!h) return;
  FC.q = h.q;
  FC.got = h.got;
  FC.learning = h.learning;
  if (h.known) SAVE.known[h.id] = true;
  else delete SAVE.known[h.id];
  if (h.trouble === undefined) delete SAVE.trouble[h.id];
  else SAVE.trouble[h.id] = h.trouble;
  FC.flip = false;
  save();
  render();
};
ACT.fclearn = () => {
  const ids = FC.learning.slice();
  fcBuild(ids);
  render();
};
ACT.fcprev = () => {
  if (FC.i > 0) FC.i--;
  FC.flip = false;
  render();
};
ACT.fcnext = () => {
  if (FC.i < FC.list.length - 1) FC.i++;
  FC.flip = false;
  render();
};
ACT.fcswap = () => {
  SAVE.settings.fcFirst = SAVE.settings.fcFirst === "term" ? "def" : "term";
  FC.flip = false;
  save();
  render();
};
ACT.fcshuf = () => {
  if (fcBrowse()) {
    FC.list = shuf(FC.list);
    FC.i = 0;
  } else FC.q = shuf(FC.q);
  FC.flip = false;
  render();
};
ACT.fcstar = () => {
  const id = fcCur();
  if (!id) return;
  if (SAVE.star[id]) delete SAVE.star[id];
  else SAVE.star[id] = true;
  save();
  render();
};
document.addEventListener("keydown", (e) => {
  if (!UNIT || UI.tab !== "flash" || UI.run || !FC) return;
  const tg = e.target && e.target.tagName;
  if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const browse = fcBrowse();
  if (!(browse ? FC.list.length : FC.q.length)) {
    if (!browse && e.key === "ArrowLeft") ACT.fcback();
    return;
  }
  if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    ACT.fcflip();
  } else if (e.key === "ArrowRight") browse ? ACT.fcnext() : ACT.fcgot();
  else if (e.key === "ArrowLeft") browse ? ACT.fcprev() : ACT.fcback();
  else if (e.key === "s" || e.key === "S") ACT.fcstar();
  else if (!browse && e.key === "1") ACT.fcnot();
  else if (!browse && e.key === "2") ACT.fcgot();
});
