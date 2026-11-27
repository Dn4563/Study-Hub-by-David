/* Shared pop-up: a centered window over a dimmed page. Used for step-by-step setups (Study plan, tonight's session,
   midterm, focus timer), Options menus and confirms.
   openModal({ title, steps: [fn -> html], body: fn -> html, done: "Start", onDone, onClose, wide })
   - steps: one screen per step, with step dots and Back / Next; the last step's button says `done`.
   - body: a single screen (no dots); its own buttons do the work.
   Esc and ✕ close it, Tab stays inside it, and focus goes back to where it was. Content is re-drawn with
   modalRender() after a choice, so step functions read their state from wherever they keep it. */
const MODAL = { o: null, step: 0, back: null };
function openModal(o) {
  MODAL.o = o;
  MODAL.step = 0;
  MODAL.back = document.activeElement;
  modalRender(true);
}
function modalRender(first) {
  const o = MODAL.o;
  let host = document.getElementById("modalhost");
  if (!host) {
    host = document.createElement("div");
    host.id = "modalhost";
    document.body.appendChild(host);
  }
  if (!o) {
    host.innerHTML = "";
    return;
  }
  const steps = o.steps || null,
    n = steps ? steps.length : 0,
    s = MODAL.step;
  const inner = steps ? steps[s]() : o.body();
  host.innerHTML =
    '<div class="scrim" data-act="mclose"><div class="modal' +
    (o.wide ? " wide" : "") +
    '" role="dialog" aria-modal="true" aria-label="' +
    esc(o.title || "Pop-up") +
    '" data-act="mnoop"><div class="mtop">' +
    (n > 1 ? '<div class="mdots" role="img" aria-label="Step ' + (s + 1) + " of " + n + '">' + Array.from({ length: n }, (_, i) => '<i class="' + (i === s ? "on" : i < s ? "done" : "") + '"></i>').join("") + "</div>" : "<span></span>") +
    '<button class="mx" data-act="mclose" aria-label="Close">' +
    ICON.x +
    "</button></div>" +
    inner +
    (steps
      ? '<div class="mfoot"><button class="btn ghost" data-act="mback"' +
        (s === 0 ? " disabled" : "") +
        '>Back</button><button class="btn" data-act="mnext">' +
        esc(s < n - 1 ? o.next || "Next" : o.done || "Done") +
        "</button></div>"
      : "") +
    "</div></div>";
  const m = host.querySelector(".modal");
  if (first || !m.contains(document.activeElement)) {
    const f = m.querySelector("[autofocus], [aria-pressed='true'], input, select, textarea, .mfoot .btn:not([disabled]), .btn");
    (f || m).focus();
  }
}
function closeModal(skipHook) {
  const o = MODAL.o;
  MODAL.o = null;
  modalRender();
  if (MODAL.back && document.contains(MODAL.back)) MODAL.back.focus();
  if (o && o.onClose && !skipHook) o.onClose();
}
const modalOpen = () => !!MODAL.o;
ACT.mnoop = () => {};
ACT.mclose = (t, e) => {
  /* A click inside the window bubbles to the scrim; only the scrim itself or ✕ closes. */
  if (t.classList.contains("scrim") && e && e.target !== t) return;
  closeModal();
};
ACT.mback = () => {
  MODAL.step = Math.max(0, MODAL.step - 1);
  modalRender(true);
};
ACT.mnext = () => {
  const o = MODAL.o;
  if (!o) return;
  if (o.beforeNext && o.beforeNext(MODAL.step) === false) return;
  if (MODAL.step < o.steps.length - 1) {
    MODAL.step++;
    modalRender(true);
    return;
  }
  closeModal(true);
  if (o.onDone) o.onDone();
};
document.addEventListener("keydown", (e) => {
  if (!MODAL.o) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeModal();
    return;
  }
  if (e.key === "Tab") {
    const m = document.querySelector("#modalhost .modal");
    if (!m) return;
    const f = [...m.querySelectorAll("button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")];
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
/* An in-page "are you sure?" (the browser's confirm() can be blocked inside some frames). Calls yes() on confirm.
   Tests and old code can still use ask(); this is for buttons that clear progress. */
function confirmBox(title, text, yesLabel, yes) {
  openModal({
    title: title,
    body: () =>
      "<h2>" +
      esc(title) +
      "</h2><p>" +
      esc(text) +
      '</p><div class="mfoot"><button class="btn ghost" data-act="mclose">Cancel</button><button class="btn danger" data-act="myes">' +
      esc(yesLabel) +
      "</button></div>",
    yes: yes,
  });
}
ACT.myes = () => {
  const o = MODAL.o;
  closeModal(true);
  if (o && o.yes) o.yes();
};
/* Destructive actions go through here: a pop-up in the page, or confirm() when a test has replaced it. */
function sure(title, text, yesLabel, yes) {
  if (window.__useConfirm) {
    if (ask(text)) yes();
    return;
  }
  confirmBox(title, text, yesLabel, yes);
}

/* "How much time": one dropdown from 15 minutes to 5 hours instead of a few fixed buttons (Tonight's session,
   Study plan, Midterm review). MINS_SET[key](minutes) saves a choice; the pop-up isn't redrawn, so keyboard focus
   stays on the menu. */
const MINS_OPTS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
const minsLabel = (m) => {
  const h = Math.floor(m / 60),
    r = m % 60;
  return h ? h + (h === 1 ? " hour" : " hours") + (r ? " " + r + " min" : "") : m + " min";
};
const MINS_SET = {};
function minsSelectHTML(key, value, label) {
  const opts = !value || MINS_OPTS.indexOf(value) >= 0 ? MINS_OPTS : MINS_OPTS.concat([value]).sort((a, b) => a - b);
  return (
    '<label class="minsel"><span>' +
    esc(label || "Time") +
    '</span><select data-mins="' +
    esc(key) +
    '">' +
    opts.map((m) => '<option value="' + m + '"' + (m === value ? " selected" : "") + ">" + minsLabel(m) + "</option>").join("") +
    "</select></label>"
  );
}
document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t.matches || !t.matches("select[data-mins]") || !MINS_SET[t.dataset.mins]) return;
  MINS_SET[t.dataset.mins](Number(t.value));
});
