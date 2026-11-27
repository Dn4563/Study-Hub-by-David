// Builds the course list from courses.json. Adding a course is a new entry there; nothing here changes.
// A unit can have a "testDate" (YYYY-MM-DD). Until that day it shows "Test on Thu, Dec 3" (or today / tomorrow);
// after it, nothing. The course with the soonest upcoming test comes first; the rest keep their order.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chevron = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const list = document.getElementById('courses');

const DAY = 86400000;
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
// Days from today to a YYYY-MM-DD date (local time), or null if there is no valid date.
function daysTo(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return null;
  return Math.round((new Date(+m[1], m[2] - 1, +m[3]) - today()) / DAY);
}
function testLabel(d) {
  const n = daysTo(d);
  if (n === null || n < 0) return '';
  if (n === 0) return 'Test today';
  if (n === 1) return 'Test tomorrow';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return 'Test on ' + new Date(+m[1], m[2] - 1, +m[3]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
// The soonest upcoming test in a course, in days (Infinity if none).
const nextTest = c => Math.min(Infinity, ...c.units.map(u => daysTo(u.testDate)).filter(n => n !== null && n >= 0));

function unitRow(c, u) {
  const href = u.url || c.url;
  const t = testLabel(u.testDate);
  const status = t ? `<span class="st">${t}</span>` : '';
  return `<li><a href="${esc(href)}" aria-label="Open ${esc(c.name)}, ${esc(u.label)}: ${esc(u.title)}">
    <span class="ul">${esc(u.label)}</span>
    <span>${esc(u.title)}${status}</span>
    <span class="open">Open${chevron}</span></a></li>`;
}

function course(c, i, all) {
  const p = all.length > 1 ? i / (all.length - 1) : 0;
  const note = (c.links || []).length
    ? `<p class="note">${c.links.map(l => `${esc(l.before || '')}<a href="${esc(l.url)}">${esc(l.label)}</a>${esc(l.after || '')}`).join(' ')}</p>` : '';
  return `<li class="course" data-id="${esc(c.id)}" style="--i:${i};--p:${p};--light:${esc(c.accent)};--dark:${esc(c.accentDark || c.accent)}">
    <h2 class="tab">${esc(c.name)}</h2>
    <div class="sheet">
      <p class="desc">${esc(c.description)}</p>${note}
      <ul class="units">${c.units.map(u => unitRow(c, u)).join('')}</ul>
    </div></li>`;
}

fetch('courses.json', { cache: 'no-cache' })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => {
    const shown = d.courses.filter(c => c.status !== 'hidden')
      .map((c, i) => ({ c, i, t: nextTest(c) }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map(x => x.c);
    list.innerHTML = shown.map(course).join('');
  })
  .catch(e => {
    list.innerHTML = `<li class="msg">Couldn't load the course list (${esc(e.message)}). If you opened this file directly, run <code>npx http-server</code> in this folder and open the address it prints.</li>`;
  });

// Light/dark switch at the bottom. Follows the device until you choose, then remembers your choice.
// The choice is saved in "sk:theme", which every study kit on this site also reads, so it sets the theme everywhere.
const sw = document.getElementById('themeswitch');
const isDark = () => {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
const syncSwitch = () => sw.setAttribute('aria-checked', String(isDark()));
syncSwitch();
sw.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('sk:theme', next); } catch (e) {}
  syncSwitch();
});
// A kit open in another tab changed the theme (its Settings): follow it.
addEventListener('storage', e => {
  if (e.key !== 'sk:theme') return;
  const t = e.newValue;
  if (t === 'light' || t === 'dark' || t === 'auto') { document.documentElement.setAttribute('data-theme', t); syncSwitch(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncSwitch);

// What's new: the same news.json and "seen" memory (sk:news) as every kit (kit-core/js/06-news.js).
// The hub shows updates for the courses this browser has used, plus site-wide ones and any marked "everyone"
// (a new kit). Someone new sees nothing.
const NEWSK = 'sk:news';
const readJ = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
function usedCourses() {
  const used = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const m = /^sk:([^:]+):(?:[^:]+:(?:kit|pt|fr)|last)$/.exec(localStorage.key(i) || '');
      if (m) used[m[1]] = true;
    }
  } catch (e) {}
  return used;
}
const newsCourses = it => (it.course === 'all' ? [] : [].concat(it.course));
const newsDay = d => { const p = String(d || '').split('-').map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; };
const newsTag = it => `<span class="ntag${it.size === 'major' ? ' major' : ''}">${it.size === 'major' ? 'Major' : 'Small'}</span>`;
function newsList(N, items) {
  const shown = items.slice(0, 10), more = items.length - shown.length;
  const name = it => newsCourses(it).map(c => (N.courses || {})[c] || c).join(', ');
  return `<ul class="nlist">${shown.map(it => `<li>${newsTag(it)} <b>${esc((name(it) ? name(it) + ': ' : '') + it.title)}</b> ${esc(it.text)} <span class="ndate">${esc(newsDay(it.date))}</span></li>`).join('')}</ul>` +
    (more ? `<p class="nmore">And ${more} earlier change${more === 1 ? '' : 's'}.</p>` : '');
}
function newsDialog(N, steps, onEnd) {
  const dlg = document.createElement('dialog');
  dlg.className = 'news';
  dlg.setAttribute('aria-label', "What's new");
  let i = 0;
  const draw = () => {
    dlg.innerHTML = `<div class="ntop">${steps.length > 1 ? `<span class="ndots" role="img" aria-label="Step ${i + 1} of ${steps.length}">${steps.map((s, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>` : '<span></span>'}<button class="nx" type="button" data-n="x" aria-label="Close">✕</button></div>${steps[i]}
      <div class="nfoot"><button type="button" class="nb ghost" data-n="back"${i ? '' : ' disabled'}>Back</button><button type="button" class="nb" data-n="next">${i < steps.length - 1 ? 'Next' : 'Got it'}</button></div>`;
    dlg.querySelector('[data-n="next"]').focus();
  };
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (!b) return;
    if (b.dataset.n === 'x') dlg.close();
    else if (b.dataset.n === 'back' && i > 0) { i--; draw(); }
    else if (b.dataset.n === 'next') { if (i < steps.length - 1) { i++; draw(); } else dlg.close(); }
  });
  dlg.addEventListener('close', () => { dlg.remove(); if (onEnd) onEnd(); });
  document.body.appendChild(dlg);
  draw();
  dlg.showModal();
  dlg.querySelector('[data-n="next"]').focus();
}
function newsMarkSeen(N) {
  const seen = (readJ(NEWSK) || {}).seen || [];
  N.items.forEach(it => { if (seen.indexOf(it.id) < 0) seen.push(it.id); });
  try { localStorage.setItem(NEWSK, JSON.stringify({ seen, at: Date.now() })); } catch (e) {}
}
const byNewest = (a, b) => String(b.date).localeCompare(String(a.date));
fetch('news.json', { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : null))
  .then(N => {
    if (!N || !Array.isArray(N.items)) return;
    window.__hubNews = N;
    const used = usedCourses(), seen = (readJ(NEWSK) || {}).seen;
    if (!Object.keys(used).length && !seen) return newsMarkSeen(N); // first visit: nothing piles up
    const fresh = N.items.filter(it => it.id && (seen || []).indexOf(it.id) < 0 && (it.course === 'all' || it.everyone || newsCourses(it).some(c => used[c]))).sort(byNewest);
    if (!fresh.length) return newsMarkSeen(N);
    const majors = fresh.filter(it => it.size === 'major'), big = majors.slice(0, 4);
    const rest = majors.slice(4).concat(fresh.filter(it => it.size !== 'major')).sort(byNewest);
    const steps = big.map(it => `<p class="nhead">${newsTag(it)}<span class="ndate">${esc(newsDay(it.date))}</span></p><h2>${esc(it.title)}</h2><p>${esc(it.text)}</p>`);
    if (rest.length) steps.push(`<h2>${big.length ? 'Smaller changes' : "What's new"}</h2>${newsList(N, rest)}`);
    newsDialog(N, steps, () => newsMarkSeen(N));
  })
  .catch(() => {});
document.getElementById('newsall').addEventListener('click', () => {
  const N = window.__hubNews;
  if (N) newsDialog(N, [`<h2>What's new</h2>${newsList(N, N.items.slice().sort(byNewest))}`]);
});
