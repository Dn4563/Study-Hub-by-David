// Builds the course list from courses.json. Adding a course is a new entry there; nothing here changes.
const STATUS = { current: 'Current', review: 'Test done, kept for review', ready: '' };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chevron = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const list = document.getElementById('courses');

function unitRow(c, u) {
  const href = u.url || c.url;
  const status = STATUS[u.status] ? `<span class="st">${STATUS[u.status]}</span>` : '';
  return `<li><a href="${esc(href)}" aria-label="Open ${esc(c.name)}, ${esc(u.label)}: ${esc(u.title)}">
    <span class="ul">${esc(u.label)}</span>
    <span>${esc(u.title)}${status}</span>
    <span class="open">Open${chevron}</span></a></li>`;
}

function course(c, i) {
  const note = c.owner === 'external'
    ? `<p class="note">Made by ${esc(c.maker)}. Opens in this tab; your browser's Back button returns here.</p>` : '';
  return `<li class="course" data-id="${esc(c.id)}" style="--i:${i};--light:${esc(c.accent)};--dark:${esc(c.accentDark || c.accent)}">
    <h2 class="tab">${esc(c.name)}</h2>
    <div class="sheet">
      <p class="desc">${esc(c.description)}</p>${note}
      <ul class="units">${c.units.map(u => unitRow(c, u)).join('')}</ul>
    </div></li>`;
}

fetch('courses.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => {
    const shown = d.courses.filter(c => c.status !== 'hidden');
    list.innerHTML = shown.map(course).join('');
  })
  .catch(e => {
    list.innerHTML = `<li class="msg">Couldn't load the course list (${esc(e.message)}). If you opened this file directly, run <code>npx http-server</code> in this folder and open the address it prints.</li>`;
  });

// Light/dark switch at the bottom. Follows the device until you choose, then remembers your choice.
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
  try { localStorage.setItem('sk:hub:theme', next); } catch (e) {}
  syncSwitch();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncSwitch);
