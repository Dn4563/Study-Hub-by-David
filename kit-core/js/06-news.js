/* What's new: a short pop-up after an update, in every kit and on the hub. The list is one file for the whole site,
   news.json in the hub repo ({ "courses": { id: name }, "items": [ { id, date, size: "major" | "small",
   course: "all" | id | [ids], title, text } ] }), read when a page opens, so no kit needs rebuilding to announce
   something. All kits and the hub are on one site, so they share what this browser has seen (sk:news).
   - This kit's news: one screen per major change (newest first, up to 4), then all small ones on one list screen.
   - Other kits: listed on a last "Elsewhere on the site" screen, but only for kits this browser has used.
   - Someone with no saved progress anywhere on the site is new: everything is marked seen and nothing shows.
   - It shows as soon as the page opens, even mid-lesson; ✕, Esc or "Got it" mark everything seen.
   A test can set window.__NEWS instead of fetching. */
const NEWSK = "sk:news";
const newsSeen = () => (readJSON(NEWSK) || {}).seen || null;
/* Courses this browser has used: any saved unit progress, or a last-opened unit. */
function newsUsed() {
  const used = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^sk:([^:]+):(?:[^:]+:(?:kit|pt|fr)|last)$/.exec(localStorage.key(i) || "");
      if (m) used[m[1]] = true;
    }
  } catch (e) {}
  return used;
}
/* Checked before this page saves anything, so a first visit counts as new. */
const NEWS_NEW_VISITOR = !Object.keys(newsUsed()).length && !newsSeen();
const newsFor = (it, cid) => it.course === "all" || it.course === cid || (Array.isArray(it.course) && it.course.indexOf(cid) >= 0);
const newsCourses = (it) => (it.course === "all" ? [] : [].concat(it.course));
const newsDate = (d) => {
  const p = String(d || "").split("-").map(Number);
  return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
};
const newsTag = (it) => '<span class="ntag' + (it.size === "major" ? " major" : "") + '">' + (it.size === "major" ? "Major" : "Small") + "</span>";
const newsLine = (it, names) =>
  "<li>" +
  newsTag(it) +
  " <b>" +
  esc((names ? names + ": " : "") + it.title) +
  "</b> " +
  esc(it.text) +
  ' <span class="ndate">' +
  esc(newsDate(it.date)) +
  "</span></li>";
/* The screens for a list of items: majors first, one each; smalls on one list; other courses on a last list. */
function newsSteps(N, here, elsewhere) {
  const byNew = (a, b) => String(b.date).localeCompare(String(a.date)),
    majors = here.filter((x) => x.size === "major").sort(byNew),
    big = majors.slice(0, 4),
    small = majors.slice(4).concat(here.filter((x) => x.size !== "major")).sort(byNew),
    steps = [];
  const listHTML = (items, nameOf) => {
    const shown = items.slice(0, 8),
      more = items.length - shown.length;
    return '<ul class="nlist">' + shown.map((x) => newsLine(x, nameOf && nameOf(x))).join("") + "</ul>" + (more ? '<p class="muted">And ' + plural(more, "earlier change") + ".</p>" : "");
  };
  big.forEach((x) =>
    steps.push(
      () => '<p class="nhead">' + newsTag(x) + '<span class="ndate">' + esc(newsDate(x.date)) + "</span></p><h2>" + esc(x.title) + "</h2><p>" + esc(x.text) + "</p>",
    ),
  );
  if (small.length) steps.push(() => "<h2>" + (big.length ? "Smaller changes" : "What's new") + "</h2>" + listHTML(small));
  if (elsewhere.length) {
    const nm = (x) =>
      newsCourses(x)
        .map((c) => (N.courses && N.courses[c]) || c)
        .join(", ");
    steps.push(() => '<h2>Elsewhere on the site</h2><p class="muted">Updates in other kits you use.</p>' + listHTML(elsewhere.sort(byNew), nm));
  }
  return steps;
}
function newsMarkSeen(N) {
  const seen = newsSeen() || [];
  N.items.forEach((x) => seen.indexOf(x.id) < 0 && seen.push(x.id));
  writeJSON(NEWSK, { seen: seen, at: Date.now() });
}
function newsShow(N, steps, title) {
  if (!steps.length) return;
  /* Another pop-up is open (a setup the student started): wait until it closes. */
  if (MODAL.o) return setTimeout(() => newsShow(N, steps, title), 1500);
  openModal({ title: title, steps: steps, done: "Got it", onDone: () => newsMarkSeen(N), onClose: () => newsMarkSeen(N) });
}
function newsCheck(N) {
  if (!N || !Array.isArray(N.items)) return;
  if (NEWS_NEW_VISITOR) return newsMarkSeen(N);
  const seen = newsSeen() || [],
    used = newsUsed(),
    fresh = N.items.filter((x) => x.id && seen.indexOf(x.id) < 0),
    here = fresh.filter((x) => newsFor(x, COURSE.id)),
    elsewhere = fresh.filter((x) => !newsFor(x, COURSE.id) && newsCourses(x).some((c) => used[c]));
  if (!here.length && !elsewhere.length) return newsMarkSeen(N);
  newsShow(N, newsSteps(N, here, elsewhere), "What's new");
}
let NEWS = null;
function newsLoad(then) {
  if (NEWS) return then(NEWS);
  if (window.__NEWS) return then((NEWS = window.__NEWS));
  if (!COURSE.hub || typeof fetch !== "function" || !/^https?:/.test(location.protocol)) return;
  fetch(COURSE.hub + "news.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d && then((NEWS = d)))
    .catch(() => {});
}
/* "What's new" on the course page: this course's last 10 updates, seen or not. */
ACT.newsall = () =>
  newsLoad((N) => {
    const mine = N.items
      .filter((x) => newsFor(x, COURSE.id))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 10);
    openModal({
      title: "What's new",
      body: () =>
        "<h2>What's new</h2>" +
        (mine.length ? '<ul class="nlist">' + mine.map((x) => newsLine(x)).join("") + "</ul>" : '<p class="muted">Nothing yet.</p>') +
        '<div class="mfoot"><span></span><button class="btn" data-act="mclose">Close</button></div>',
    });
  });
