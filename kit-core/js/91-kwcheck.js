/* Key-word checker for written answers (no AI, no key needed). A part with
     "check": [["empire", "dynasty"], ["tax", "tribute"]], "checkLabels": ["Names the empire", "Says how it raised money"]
   earns its point when every group has at least one of its words or phrases in the student's answer (case and
   punctuation ignored). The ✓/✗ list shows what was found; the student can still override with I got it / I missed it,
   and Gemini (if a key is saved) can grade it like a teacher would. Used for AP World short answers. */
const kwNorm = (t) =>
  " " +
  String(t || "")
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(d)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => String("⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(d)))
    .replace(/⁺/g, "+")
    .replace(/[⁻−–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'%.+ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() +
  " ";
/* A key word or number counts only as a whole word ("tin" is not found inside "getting"; "0.19" not in "10.19"). */
const kwHas = (t, a) => {
  const w = kwNorm(a).trim();
  if (!w) return false;
  const re = new RegExp("(^|[^a-z0-9.])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])");
  return re.test(t.replace(/\.(\s|$)/g, " "));
};
const hasKw = (q) => !!(q.parts && q.parts.some((p) => Array.isArray(p.check) && p.check.length));
function kwPart(p, raw) {
  const t = kwNorm(raw),
    blank = !String(raw || "").trim();
  const checks = p.check.map((g, i) => ({
    ok: !blank && g.some((a) => kwHas(t, a)),
    text: (p.checkLabels || [])[i] || "Mentions " + g[0],
  }));
  return { ok: !blank && checks.every((c) => c.ok), checks: checks, blank: blank };
}
/* The text a part is graded on: its own box, or for work-area questions, everything the student wrote. */
const partAnswer = (q, s, p) => (q.type === "saq" ? s.ans[p.k] || "" : [s.ans[p.k] || "", s.work || "", s.abox || ""].join(" "));
function kwGrade(q, s) {
  s.kw = {};
  q.parts.forEach((p) => {
    if (!Array.isArray(p.check) || !p.check.length) return;
    const r = kwPart(p, partAnswer(q, s, p));
    s.kw[p.k] = r;
    s.pm[p.k] = r.ok;
  });
}
function kwHTML(s, p) {
  const r = s.kw && s.kw[p.k];
  if (!r) return "";
  return (
    '<div class="kwbox"><p class="kwh">' +
    (r.ok ? "The checker found every key idea." : r.blank ? "No answer written for this part." : "The checker is missing something:") +
    '</p><ul class="wchecks">' +
    r.checks.map((c) => '<li class="' + (c.ok ? "ok" : "no") + '"><span aria-hidden="true">' + (c.ok ? "✓" : "✗") + "</span> " + esc(c.text) + "</li>").join("") +
    '</ul><p class="hint">It only looks for key words, so if you said it another way, use I got it below.</p></div>'
  );
}
