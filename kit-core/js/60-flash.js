/* Flashcards: pool (not known yet / all / trouble terms), order, which side first. "Not yet" returns the card
   about 4 cards later. Keys: Space flips, 1 = Not yet, 2 = Got it. */
function fcBuild() {
  let pool = deckCards().slice();
  const p = SAVE.settings.fcPool;
  if (p === "unknown") pool = pool.filter((c) => !SAVE.known[c.id]);
  else if (p === "trouble") pool = pool.filter((c) => SAVE.trouble[c.id] > 0);
  if (SAVE.settings.fcOrder === "shuffle") pool = shuf(pool);
  FC = { q: pool.map((c) => c.id), flip: false, total: pool.length };
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
  selHTML("fcPool", "Pool", [
    ["unknown", "Not known yet"],
    ["all", "All"],
    ["trouble", "Trouble terms"],
  ]) +
  selHTML("fcOrder", "Order", [
    ["shuffle", "Shuffled"],
    ["section", "Section order"],
  ]) +
  selHTML("fcFirst", "Show first", [
    ["term", "Term"],
    ["def", "Definition"],
  ]);
function fcHTML() {
  if (!FC) fcBuild();
  let h = '<div class="ctl">' + FC_CTL() + "</div>";
  if (!FC.q.length)
    return (
      h +
      '<section class="panel"><p class="big">Nothing left in this pool.</p><p class="muted">Switch the pool to All to review everything, or pick another deck.</p><button class="btn" data-act="fcagain">Start again</button></section>'
    );
  const c = BYID[FC.q[0]],
    showTerm = SAVE.settings.fcFirst === "term" ? !FC.flip : FC.flip;
  h +=
    '<button class="fcard" data-act="fcflip" aria-label="Flip card">' +
    (showTerm ? '<span class="fterm">' + esc(c.term) + "</span>" : '<span class="fdef">' + esc(c.def) + "</span>" + hookLine(c)) +
    '<small>Tap or press Space to flip</small></button><div class="qnav fcnav"><button class="btn sec" data-act="fcnot">Not yet</button><button class="btn" data-act="fcgot">Got it</button></div><p class="muted">' +
    plural(FC.q.length, "card") +
    ' left this round. Keys: Space flips, 1 is Not yet, 2 is Got it.</p>';
  return h;
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
  const id = FC.q.shift();
  setKnown(id, true);
  FC.flip = false;
  render();
};
ACT.fcnot = () => {
  const id = FC.q.shift();
  delete SAVE.known[id];
  SAVE.trouble[id] = (SAVE.trouble[id] || 0) + 1;
  FC.q.splice(Math.min(FC.q.length, 4), 0, id);
  FC.flip = false;
  save();
  render();
};
document.addEventListener("keydown", (e) => {
  if (!UNIT || UI.tab !== "flash" || UI.run || !FC || !FC.q.length) return;
  const tg = e.target && e.target.tagName;
  if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT") return;
  if (e.key === " ") {
    e.preventDefault();
    ACT.fcflip();
  } else if (e.key === "1") ACT.fcnot();
  else if (e.key === "2") ACT.fcgot();
});
