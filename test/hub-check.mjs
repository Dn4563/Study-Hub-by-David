// Opens the hub in a real browser (Playwright) and checks it against courses.json.
// Run from the repo folder: node test/hub-check.mjs   (starts its own local server)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(process.execPath, '../../lib/node_modules/playwright'))); }

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const data = JSON.parse(await readFile(join(root, 'courses.json'), 'utf8'));
const expected = data.courses.filter(c => c.status !== 'hidden');
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

const browser = await chromium.launch();
for (const [w, h] of [[390, 844], [1280, 900]]) for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !/fonts\.g/.test(m.location().url) && errors.push(m.text()));
  await page.goto(base);
  await page.waitForSelector('.course');
  const where = `${w}px ${scheme}`;
  check(errors.length === 0, `${where}: console errors: ${errors.join(' | ')}`);
  const ids = await page.$$eval('.course', els => els.map(e => e.dataset.id));
  check(JSON.stringify(ids) === JSON.stringify(expected.map(c => c.id)), `${where}: courses shown ${ids} != courses.json`);
  for (const c of expected) {
    const hrefs = await page.$$eval(`.course[data-id="${c.id}"] .units a`, as => as.map(a => a.getAttribute('href')));
    check(hrefs.length === c.units.length, `${where}: ${c.id} shows ${hrefs.length} units, expected ${c.units.length}`);
    c.units.forEach((u, i) => check(hrefs[i] === (u.url || c.url), `${where}: ${c.id} ${u.label} links to ${hrefs[i]}`));
    /* Extra links (like Phineas's kit) read as one sentence: the text around each link, then the link. */
    for (const l of c.links || []) {
      const note = await page.$eval(`.course[data-id="${c.id}"] .note`, (e) => ({ text: e.textContent, hrefs: [...e.querySelectorAll('a')].map((a) => a.getAttribute('href')) }));
      check(note.hrefs.includes(l.url), `${where}: ${c.id} note links to ${l.url}`);
      check(note.text.includes((l.before || '') + l.label + (l.after || '')), `${where}: ${c.id} note reads "${(l.before || '') + l.label + (l.after || '')}"`);
    }
  }
  const tabsOut = await page.$$eval('.course', els => els.filter(e => {
    const t = e.querySelector('.tab').getBoundingClientRect(), s = e.querySelector('.sheet').getBoundingClientRect();
    return t.left < s.left - 0.5 || t.right > s.right + 0.5;
  }).map(e => e.dataset.id));
  check(tabsOut.length === 0, `${where}: tab sticks out past its sheet: ${tabsOut}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, `${where}: page scrolls sideways by ${overflow}px`);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#themeswitch');
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(before !== after, `${where}: theme switch did not change the colors`);
  const chosen = await page.getAttribute('html', 'data-theme');
  check(chosen === (scheme === 'dark' ? 'light' : 'dark'), `${where}: switch set theme to ${chosen}`);
  check(await page.evaluate(() => localStorage.getItem('sk:theme')) === chosen, `${where}: switch did not save the site-wide theme (sk:theme)`);
  await page.reload(); await page.waitForSelector('.course');
  check(await page.getAttribute('html', 'data-theme') === chosen, `${where}: theme choice not remembered after reload`);
  check(await page.getAttribute('#themeswitch', 'aria-checked') === String(chosen === 'dark'), `${where}: switch position wrong after reload`);
  await page.click('#themeswitch');
  if (process.argv.includes('--shots')) await page.screenshot({ path: `hub-${w}-${scheme}.png`, fullPage: true });
  await page.close();
}
// Test dates: serve a copy of courses.json with sample dates (one past, today, tomorrow, next week).
{
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const at = n => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
  const sample = JSON.parse(JSON.stringify(data));
  const shownC = sample.courses.filter(c => c.status !== 'hidden');
  const last = shownC[shownC.length - 1], mid = shownC[1];
  last.units[0].testDate = at(7);
  mid.units[0].testDate = at(-3);
  if (mid.units[1]) mid.units[1].testDate = at(1);
  shownC[0].units[0].testDate = at(0);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('**/courses.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(sample) }));
  await page.goto(base);
  await page.waitForSelector('.course');
  const ids = await page.$$eval('.course', els => els.map(e => e.dataset.id));
  const want = [shownC[0].id, mid.units[1] ? mid.id : null, last.id].filter(Boolean);
  check(JSON.stringify(ids.slice(0, want.length)) === JSON.stringify(want), `test dates: soonest test should come first, got ${ids.join(', ')}`);
  const labels = await page.$$eval('.st', els => els.map(e => e.textContent));
  check(labels.includes('Test today'), `test dates: "Test today" missing (${labels})`);
  if (mid.units[1]) check(labels.includes('Test tomorrow'), `test dates: "Test tomorrow" missing (${labels})`);
  check(labels.some(l => /^Test on \w{3}, \w{3} \d{1,2}$/.test(l)), `test dates: "Test on Thu, Dec 3" style label missing (${labels})`);
  check(labels.length === (mid.units[1] ? 3 : 2), `test dates: a past test should show nothing (${labels.length} labels: ${labels})`);
  const text = await page.textContent('#courses');
  check(!/Current|Test done|kept for review/.test(text), 'old status labels still shown');
  await page.close();
}
// What's new: a returning visitor (has Psych progress) gets news for Psych and site-wide items, not other courses';
// "Got it" marks everything seen, so it doesn't come back. A brand-new visitor sees nothing.
{
  const news = JSON.parse(await readFile(join(root, 'news.json'), 'utf8'));
  for (const it of news.items) check(it.id && it.date && /^(major|small)$/.test(it.size) && it.title && it.text && it.course, `news.json: item ${it.id || '?'} needs id, date, size (major/small), course, title and text`);
  check(new Set(news.items.map(it => it.id)).size === news.items.length, 'news.json: ids must be unique');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sk:psych:u0:kit', '{}'); });
  await page.reload();
  await page.waitForSelector('dialog.news[open]');
  const forPsych = news.items.filter(it => it.course === 'all' || [].concat(it.course).includes('psych'));
  const majors = forPsych.filter(it => it.size === 'major').length;
  let all = '';
  for (let i = 0; i < 12; i++) {
    all += await page.textContent('dialog.news');
    const next = await page.$('dialog.news [data-n="next"]');
    if (!next) break;
    const last = (await next.textContent()) === 'Got it';
    await next.click();
    if (last) break;
  }
  check(forPsych.every(it => all.includes(it.title)), "hub what's new: shows every item for Psych and the whole site");
  check(!news.items.filter(it => it.course !== 'all' && ![].concat(it.course).includes('psych')).some(it => all.includes(it.title)), "hub what's new: leaves out courses this browser hasn't used");
  check(majors > 0 && /Major/.test(all) && /Small/.test(all), "hub what's new: labels Major and Small");
  check(!(await page.$('dialog.news')), "hub what's new: Got it closes it");
  const seen = await page.evaluate(() => (JSON.parse(localStorage.getItem('sk:news')) || {}).seen || []);
  check(news.items.every(it => seen.includes(it.id)), "hub what's new: everything is marked seen");
  await page.reload();
  await page.waitForSelector('.course');
  await page.waitForTimeout(300);
  check(!(await page.$('dialog.news')), "hub what's new: doesn't come back after Got it");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('.course');
  await page.waitForTimeout(300);
  check(!(await page.$('dialog.news')), "hub what's new: a brand-new visitor sees nothing");
  check(await page.evaluate(() => !!localStorage.getItem('sk:news')), "hub what's new: a brand-new visitor's news is marked seen");
  await page.click('#newsall');
  check(!!(await page.$('dialog.news[open]')), "hub What's new link opens the list");
  // A new kit (everyone: true) reaches a student who only uses Psych.
  await page.route('**/news.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ courses: { nnn: 'New Kit' }, items: [{ id: 'x-newkit', date: '2026-12-01', size: 'major', course: 'nnn', everyone: true, title: 'New Kit is here', text: 'A new kit.' }] }) }));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('sk:psych:u0:kit', '{}'); });
  await page.reload();
  await page.waitForSelector('dialog.news[open]');
  check(/New Kit is here/.test(await page.textContent('dialog.news')), "hub what's new: a new kit is announced to everyone");
  await ctx.close();
}
await browser.close();
server.close();

if (fails.length) { console.error('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`PASS: ${expected.length} courses, ${expected.reduce((n, c) => n + c.units.length, 0)} unit links, 4 viewport/theme combinations`);
