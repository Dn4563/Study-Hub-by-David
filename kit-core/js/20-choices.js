/* Answer choices shared by Learn, Quiz and the Practice Test: cross-off, Lock in, and per-choice explanations.
   Explanations name the choice by its text, never by letter, because choices are shuffled. */
function whyHTML(opts, picked, okTxt) {
  const ci = opts.findIndex((o) => o.ok);
  const quote = (o) => '<span class="qt">' + esc(o.t) + "</span>";
  let h = "";
  if (picked >= 0 && !opts[picked].ok)
    h +=
      '<div class="why bad"><div class="wh">Why your answer is wrong</div>' +
      quote(opts[picked]) +
      (opts[picked].why ? "<p>" + esc(opts[picked].why) + "</p>" : "") +
      "</div>";
  if (ci >= 0 && okTxt) h += '<div class="why good"><div class="wh">Why the correct answer is right</div>' + quote(opts[ci]) + "<p>" + okTxt + "</p></div>";
  if (opts.some((o) => o.why))
    h +=
      '<details class="whyall"><summary>Every choice explained</summary><ul>' +
      opts
        .map(
          (o) =>
            "<li>" +
            quote(o) +
            (o.ok ? '<span class="tag ok">Correct</span>' + (okTxt ? "<p>" + okTxt + "</p>" : "") : '<span class="tag bad">Wrong</span><p>' + esc(o.why || "") + "</p>") +
            "</li>",
        )
        .join("") +
      "</ul></details>";
  return h;
}

function optRow(cls, act, k, label, text, elimAct, isElim, locked) {
  return (
    '<div class="optrow' +
    (isElim ? " crossed" : "") +
    '">' +
    '<button class="' +
    cls +
    '" data-act="' +
    act +
    '" data-k="' +
    k +
    '"' +
    (locked || isElim ? " disabled" : "") +
    ">" +
    (label ? '<span class="k">' + label + "</span>" : "") +
    '<span class="ot">' +
    text +
    "</span></button>" +
    (locked
      ? ""
      : '<button class="xoff" data-act="' +
        elimAct +
        '" data-k="' +
        k +
        '" aria-pressed="' +
        !!isElim +
        '" title="' +
        (isElim ? "Bring this choice back" : "Cross this choice off") +
        '" aria-label="' +
        (isElim ? "Bring back" : "Cross off") +
        (label ? " choice " + label : " this choice") +
        '">' +
        (isElim ? ICON.undo : ICON.x) +
        "</button>") +
    "</div>"
  );
}

function lockHTML(act, sel) {
  return (
    '<div class="qnav"><button class="btn" data-act="' +
    act +
    '"' +
    (sel == null ? " disabled" : "") +
    ">Lock in answer</button>" +
    (sel == null ? '<span class="hint">Pick a choice first.</span>' : "") +
    "</div>"
  );
}
const lockToggle = () =>
  '<label class="lockt"><input type="checkbox" data-set="confirm"' + (SAVE.settings.confirm ? " checked" : "") + "> Lock in answers</label>";

function toggleElim(list, i) {
  const p = list.indexOf(i);
  if (p >= 0) list.splice(p, 1);
  else list.push(i);
}
