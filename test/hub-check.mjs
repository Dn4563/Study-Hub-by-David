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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(overflow <= 0, `${where}: page scrolls sideways by ${overflow}px`);
  if (process.argv.includes('--shots')) await page.screenshot({ path: `hub-${w}-${scheme}.png`, fullPage: true });
  await page.close();
}
await browser.close();
server.close();

if (fails.length) { console.error('FAIL\n- ' + fails.join('\n- ')); process.exit(1); }
console.log(`PASS: ${expected.length} courses, ${expected.reduce((n, c) => n + c.units.length, 0)} unit links, 4 viewport/theme combinations`);
