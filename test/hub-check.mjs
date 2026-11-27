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
await browser.close();
server.close();

if (fails.length) { console.error('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`PASS: ${expected.length} courses, ${expected.reduce((n, c) => n + c.units.length, 0)} unit links, 4 viewport/theme combinations`);
