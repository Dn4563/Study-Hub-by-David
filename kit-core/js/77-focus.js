/* Focus timer (Pomodoro-style): optional work/break cycles shown in a bar at the top of every screen of the kit.
   Presets 25 + 5 and 50 + 10, or custom; the suggestion follows the time the student has (Study plan or tonight).
   Research: fixed breaks don't raise output by themselves, but they help students who skip breaks or put off
   starting, so it's optional and adjustable. "Lock-in" as far as a website can: full screen, a pause and a note
   when the student switches tabs ("You left at 8:42"), and the browser asks before the page is closed or reloaded
   while a session runs. A website can't block other apps. Saved per course in sk:<course>:focus. */
const FOCUSK = "sk:" + COURSE.id + ":focus";
let FOC = null,
  FOC_IV = null;
function focusState() {
  if (!FOC) {
    const o = readJSON(FOCUSK) || {};
    FOC = { on: !!o.on, mode: o.mode || "focus", work: o.work || 25, brk: o.brk || 5, endAt: o.endAt || 0, paused: o.paused || 0, leaves: o.leaves || 0, leftAt: o.leftAt || "", rounds: o.rounds || 0 };
    /* A session left running in a closed tab is over if its end time passed long ago. */
    if (FOC.on && !FOC.paused && FOC.endAt && Date.now() - FOC.endAt > 30 * 60000) FOC.on = false;
  }
  return FOC;
}
const focusSave = () => writeJSON(FOCUSK, FOC);
const focusLeft = () => {
  const F = focusState();
  return Math.max(0, F.paused ? F.paused : F.endAt - Date.now());
};
const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
};
/* Suggested lengths from the time the student said they have. */
function focusSuggest() {
  const mins = (SAVE && SAVE.tonight && SAVE.tonight.mins) || (SAVE && SAVE.plan && SAVE.plan.mins) || 45;
  return mins >= 90 ? [50, 10] : [25, 5];
}
function focusStart(work, brk) {
  const F = focusState();
  Object.assign(F, { on: true, mode: "focus", work: work, brk: brk, endAt: Date.now() + work * 60000, paused: 0, leaves: 0, leftAt: "", rounds: 0 });
  focusSave();
  focusTick();
  if (UNIT) render();
}
function focusStop() {
  const F = focusState();
  F.on = false;
  F.paused = 0;
  F.leftAt = "";
  focusSave();
  if (UNIT) render();
}
function focusTick() {
  clearInterval(FOC_IV);
  FOC_IV = null;
  const F = focusState();
  if (!F.on) return;
  FOC_IV = setInterval(() => {
    if (!F.on) return clearInterval(FOC_IV);
    if (F.paused) return;
    const left = F.endAt - Date.now(),
      el = document.getElementById("fclock");
    if (left <= 0) {
      F.mode = F.mode === "focus" ? "break" : "focus";
      if (F.mode === "break") F.rounds++;
      F.endAt = Date.now() + (F.mode === "focus" ? F.work : F.brk) * 60000;
      focusSave();
      if (UNIT) render();
      return;
    }
    if (el) el.textContent = mmss(left);
  }, 1000);
}
function focusBarHTML() {
  const F = focusState();
  if (!F.on) return "";
  const brk = F.mode === "break";
  let h =
    '<div class="fbar' +
    (brk ? " brk" : "") +
    '" role="timer"><span class="fclock" id="fclock">' +
    mmss(focusLeft()) +
    '</span><span class="flab">' +
    (brk ? "Break. Stand up, stretch, get water." : F.paused ? "Paused" : "Focus. Break when this hits zero.") +
    '</span><span class="fbtns"><button class="btn ghost small" data-act="focuspause">' +
    (F.paused ? "Resume" : "Pause") +
    '</button><button class="btn ghost small" data-act="focusfull">Full screen</button><button class="btn ghost small" data-act="focusend">End</button></span></div>';
  if (F.leftAt)
    h +=
      '<div class="fleft" role="status"><b>You left at ' +
      esc(F.leftAt) +
      ".</b> The timer paused while you were away." +
      (F.leaves > 1 ? " That's " + F.leaves + " times this session." : "") +
      ' <button class="btn small" data-act="focusback">Back to it</button></div>';
  return h;
}
function focusSetup() {
  const sug = focusSuggest();
  UI.fDraft = UI.fDraft || { work: sug[0], brk: sug[1] };
  openModal({
    title: "Focus timer",
    body: () => {
      const d = UI.fDraft,
        presets = [
          [25, 5],
          [50, 10],
        ];
      return (
        '<h2>Focus timer</h2><p class="muted">Work, then a short break, on repeat. Suggested for your time: <b>' +
        sug[0] +
        " min + " +
        sug[1] +
        ' min break</b>.</p><div class="chips" role="group" aria-label="Lengths">' +
        presets.map((p) => '<button class="chip" data-act="fset" data-w="' + p[0] + '" data-b="' + p[1] + '" aria-pressed="' + (d.work === p[0] && d.brk === p[1]) + '">' + p[0] + " min + " + p[1] + " break</button>").join("") +
        '</div><div class="fcustom"><label>Focus <input type="number" min="5" max="120" id="fwork" value="' +
        d.work +
        '"> min</label><label>Break <input type="number" min="1" max="30" id="fbrk" value="' +
        d.brk +
        '"> min</label></div><ul class="msum"><li>If you switch tabs<span>It pauses and tells you when you come back</span></li><li>If you close the page<span>Your browser asks first</span></li><li>Full screen<span>A button on the timer bar</span></li></ul>' +
        '<div class="mfoot">' +
        (focusState().on ? '<button class="btn ghost" data-act="focusend">Turn it off</button>' : '<button class="btn ghost" data-act="mclose">Cancel</button>') +
        '<button class="btn" data-act="focusgo">Start</button></div>'
      );
    },
  });
}
ACT.focusopen = () => focusSetup();
ACT.fset = (t) => {
  UI.fDraft = { work: Number(t.dataset.w), brk: Number(t.dataset.b) };
  modalRender();
};
ACT.focusgo = () => {
  const w = Math.min(120, Math.max(5, Number(($("#fwork") || {}).value) || UI.fDraft.work)),
    b = Math.min(30, Math.max(1, Number(($("#fbrk") || {}).value) || UI.fDraft.brk));
  closeModal(true);
  focusStart(w, b);
};
ACT.focuspause = () => {
  const F = focusState();
  if (F.paused) {
    F.endAt = Date.now() + F.paused;
    F.paused = 0;
  } else F.paused = Math.max(1000, F.endAt - Date.now());
  focusSave();
  render();
};
ACT.focusend = () => {
  if (MODAL.o) closeModal(true);
  focusStop();
};
ACT.focusfull = () => {
  const el = document.documentElement;
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  } catch (e) {}
};
/* Leaving the tab pauses the timer; coming back shows when they left. */
function focusLeave() {
  const F = focusState();
  if (!F.on || F.paused || F.mode !== "focus") return;
  F.paused = Math.max(1000, F.endAt - Date.now());
  F.leaves++;
  F.leftAt = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  focusSave();
}
function focusReturn() {
  if (UNIT && focusState().leftAt) render();
}
ACT.focusback = () => {
  const F = focusState();
  F.leftAt = "";
  if (F.paused) {
    F.endAt = Date.now() + F.paused;
    F.paused = 0;
  }
  focusSave();
  render();
};
document.addEventListener("visibilitychange", () => (document.hidden ? focusLeave() : focusReturn()));
addEventListener("beforeunload", (e) => {
  const F = focusState();
  if (!window.__navOK && F.on && !F.paused && F.mode === "focus") {
    e.preventDefault();
    e.returnValue = "";
  }
});
focusTick();
