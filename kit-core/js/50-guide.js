/* Study guide (every term by deck and section, with hooks, chains, trees, tables and Watch-out notes) and
   the optional one-page cheat sheet. */
function tableHTML(T) {
  return (
    '<figure class="tablewrap">' +
    (T.title ? "<figcaption>" + esc(T.title) + "</figcaption>" : "") +
    '<div class="scrollx"><table class="gt">' +
    T.rows.map((r, i) => "<tr>" + r.map((c, j) => (i === 0 || j === 0 ? "<th>" + esc(c) + "</th>" : "<td>" + esc(c) + "</td>")).join("") + "</tr>").join("") +
    "</table></div></figure>"
  );
}
function guideHTML() {
  let h = "";
  if (!UI.deck && D.decks.length > 1) {
    const all = D.decks.every((d) => UI.gopen && UI.gopen[d.id]);
    h += '<div class="gtools"><button class="btn ghost small" data-act="gall">' + (all ? "Close all" : "Open all") + "</button></div>";
  }
  D.decks
    .filter((d) => !UI.deck || d.id === UI.deck)
    .forEach((dk) => {
      /* Each deck folds to its title and one-line intro, so the guide isn't one endless page; one deck picked
         in the Deck picker opens on its own. */
      const one = (dk.intro || []).filter(Boolean)[0] || plural(dk.sections.reduce((n, sc) => n + sc.cards.length, 0), "term");
      const open = !!UI.deck || !!(UI.gopen && UI.gopen[dk.id]);
      h +=
        '<details class="deckblock gfold" id="gd-' +
        esc(dk.id) +
        '" data-gd="' +
        esc(dk.id) +
        '"' +
        (open ? " open" : "") +
        '><summary><span class="gh">' +
        dot(dk.id) +
        esc(dk.name) +
        '</span><span class="gs">' +
        esc(one) +
        "</span></summary>" +
        storyHTML(dk.intro, "The big picture", "bigpic");
      dk.sections.forEach((sc) => {
        h +=
          "<h3>" +
          esc(sc.name) +
          "</h3>" +
          storyHTML(sc.intro, "The story") +
          '<dl class="terms guide">' +
          sc.cards
            .map(
              (c) =>
                "<div><dt>" +
                esc(c.term) +
                "</dt><dd>" +
                esc(c.def) +
                hookLine(c) +
                '</dd><button class="know" data-act="gknow" data-id="' +
                c.id +
                '" aria-pressed="' +
                !!SAVE.known[c.id] +
                '">' +
                (SAVE.known[c.id] ? ICON.check + "Got it" : "Mark got it") +
                "</button></div>",
            )
            .join("") +
          "</dl>";
      });
      D.flows.filter((f) => f.deck === dk.id).forEach((f) => (h += chainHTML(f)));
      D.watch.filter((w) => w.deck === dk.id).forEach((w) => (h += watchHTML(w)));
      h += "</details>";
    });
  if (!UI.deck) {
    if (D.trees.length) h += '<section class="deckblock"><h2>Hierarchies</h2>' + D.trees.map((t) => '<pre class="tree">' + esc(t) + "</pre>").join("") + "</section>";
    if (D.tables.length) h += '<section class="deckblock"><h2>Comparisons</h2>' + D.tables.map(tableHTML).join("") + "</section>";
  }
  return h;
}
ACT.gknow = (t) => {
  const id = t.dataset.id;
  setKnown(id, !SAVE.known[id]);
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
};

function cheatHTML() {
  let h = '<section class="panel cheat"><div class="rtop"><h2>One-page cheat sheet</h2><button class="btn sec noprint" data-act="cheatprint">' + ICON.print + "Print</button></div><div class=\"cgrid\">";
  D.cheat.forEach((b) => {
    h += '<section class="cblock"><h3>' + esc(b.title) + "</h3>";
    if (b.kind === "list") h += "<ul>" + b.items.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>";
    else h += tableHTML({ rows: b.rows });
    h += "</section>";
  });
  return h + "</div></section>";
}
ACT.cheatprint = () => window.print();

ACT.gall = () => {
  const all = D.decks.every((d) => UI.gopen && UI.gopen[d.id]);
  UI.gopen = {};
  if (!all) D.decks.forEach((d) => (UI.gopen[d.id] = true));
  render();
};
/* Remember which decks are open while the guide is re-drawn. */
document.addEventListener(
  "toggle",
  (e) => {
    const t = e.target;
    if (!UNIT || !t.matches || !t.matches("details[data-gd]")) return;
    UI.gopen = UI.gopen || {};
    UI.gopen[t.dataset.gd] = t.open;
  },
  true,
);
