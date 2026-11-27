/* Start: the first screen of every unit. "Pick up where you left off", then three ways to study:
   Test tomorrow? (tonight's session, 76-tonight.js), I have a few days (the Study plan, 75-plan.js) and
   Let me pick (every tool). Built so a student who opens the unit the night before is studying in two clicks
   and never sees the unit's full size first. */
function resumeLine() {
  const t = UI.resume;
  if (!t || !hasTool(t)) return null;
  if (t === "tonight") {
    const T = tonightState();
    if (!T || !T.rounds || T.phase === "done" || !tonightToday(T)) return null;
    return ["Tonight's session", "Round " + Math.min(T.cur + 1, T.rounds.length) + " of " + T.rounds.length];
  }
  if (t === "plan") {
    const P = SAVE.plan;
    if (!P || !P.route) return null;
    const st = currentStep();
    return ["Your study plan", st ? "Next: " + st.title : "Plan finished"];
  }
  if (t === "learn") {
    const l = LESSONS[LI()];
    return ["Learn", l ? l.title : ""];
  }
  if ((t === "pt" || t === "exam") && PT.secs.length) {
    const s = PT.secs[PT.sec];
    return [toolName(t), s && s.mode === (t === "exam" ? "exam" : "practice") ? s.name : ""];
  }
  return [toolName(t), ""];
}
function startHTML() {
  if (UI.run) return runHTML();
  const r = resumeLine(),
    T = tonightState(),
    tonightOn = T && T.rounds && T.phase !== "done" && tonightToday(T),
    P = SAVE.plan,
    planOn = P && P.route;
  let h = "";
  if (r)
    h +=
      '<div class="resume"><div><b>Pick up where you left off</b><span class="muted">' +
      esc(r[0] + (r[1] ? ": " + r[1] : "")) +
      '</span></div><button class="btn sec" data-act="resume">Continue</button></div>';
  h += '<h2 class="starth">How do you want to study?</h2><div class="choices">';
  h +=
    '<button class="choice main" data-act="tnstart"><span class="ch">Test tomorrow?</span><span class="cd">' +
    (tonightOn
      ? "Tonight's session: round " + Math.min(T.cur + 1, T.rounds.length) + " of " + T.rounds.length + "."
      : "About an hour tonight, in short rounds: read a few terms, answer them, and the ones you miss come back.") +
    '</span><span class="cgo">' +
    (tonightOn ? "Continue tonight's session" : "Start tonight's session") +
    "</span></button>";
  h +=
    '<button class="choice" data-act="plstart"><span class="ch">I have a few days</span><span class="cd">' +
    (planOn ? esc(dateLine()) + "." : "A plan spread over the days before your test, with a little each day.") +
    '</span><span class="cgo">' +
    (planOn ? "Open my plan" : "Make my plan") +
    "</span></button>";
  h +=
    '<button class="choice" data-act="tools" aria-expanded="' +
    !!UI.showTools +
    '"><span class="ch">Let me pick</span><span class="cd">Choose any tool yourself: lessons, flashcards, quizzes, practice tests and notes.</span><span class="cgo">' +
    (UI.showTools ? "Hide the tools" : "Show all tools") +
    "</span></button></div>";
  if (UI.showTools) h += toolsGridHTML();
  h +=
    '<div class="startfoot"><button class="btn ghost" data-act="focusopen">' +
    ICON.clock +
    (focusState().on ? "Focus timer is on" : "Focus timer") +
    "</button></div>";
  return h;
}
const TOOL_HINT = {
  learn: "Read a few terms, then answer them",
  flash: "Flip and sort",
  quiz: "Mixed questions",
  pt: "By section, with explanations",
  exam: "Timed, like the real test",
  guide: "One deck at a time",
  cheat: "One page",
  prog: "What you know and what to review",
};
function toolsGridHTML() {
  return (
    '<div class="toolsgrid">' +
    GROUPS.filter((g) => g[0] !== "start" && g[2].some(hasTool))
      .map(
        (g) =>
          '<div class="tg"><h3>' +
          esc(g[1]) +
          "</h3>" +
          g[2]
            .filter(hasTool)
            .map((t) => '<button data-act="tab" data-t="' + t + '">' + esc(toolName(t)) + "<span>" + esc(TOOL_HINT[t] || "") + "</span></button>")
            .join("") +
          "</div>",
      )
      .join("") +
    "</div>"
  );
}
ACT.tools = () => {
  UI.showTools = !UI.showTools;
  render();
};
ACT.resume = () => {
  const t = UI.resume;
  UI.resume = null;
  goTool(t);
};
