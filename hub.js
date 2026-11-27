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
