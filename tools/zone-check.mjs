// In That Zone check: serves the repo root on a random port, opens zone/index.html and every
// zone/play.html?g=<id> from zone/games.json in headless Chromium, and exits 1 on any page error,
// console error, same-origin 4xx/5xx, missing section, wrong tile count or horizontal overflow at
// phone width. There is no tolerance list: a failure is a failure.
//   node tools/zone-check.mjs                        the real site: exit 0 when every check passes
//   node tools/zone-check.mjs --fault missing-file   one catalog entry is served pointing at a file that does not exist: must exit 1
//   node tools/zone-check.mjs --fault broken-json    zone/games.json is served as invalid JSON: must exit 1
// Playwright comes from node_modules (CI installs playwright@1.58.2) or, on the shared box, from /opt/node-tools.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fi = args.indexOf('--fault');
const fault = fi >= 0 ? args[fi + 1] : null;
if (fault && fault !== 'missing-file' && fault !== 'broken-json') { console.error('unknown --fault "' + fault + '" (missing-file | broken-json)'); process.exit(2); }

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = createRequire('/opt/node-tools/node_modules/')('playwright')); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.md': 'text/plain' };
const DESK = { width: 1280, height: 800 }, PHONE = { width: 390, height: 844 };

// the catalog on disk is the reference; the served copy is what the pages see (and what a fault corrupts)
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'zone', 'games.json'), 'utf8'));
const games = catalog.games;
const ids = games.map(g => g.id);
function servedCatalog() {
  if (fault === 'broken-json') return '{"zone":{"name":"In That Zone"},"games":[{"id":"math-blast" oops';
  if (fault === 'missing-file') { const c = JSON.parse(JSON.stringify(catalog)); c.games[0].file = 'this-file-does-not-exist.html'; return JSON.stringify(c); }
  return null;
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/zone/games.json') { const b = servedCatalog(); if (b !== null) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(b); } }
  let f = path.join(ROOT, p);
  if (f !== ROOT && !f.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch { /* fall through to the 404 below */ }
  if (!fs.existsSync(f)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const origin = new URL(base).origin;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let passed = 0, failed = 0;
function report(name, problems, extra) {
  const bad = [...new Set(problems)];
  if (bad.length) failed++; else passed++;
  console.log((bad.length ? 'FAIL ' : 'ok   ') + name + (extra ? '  (' + extra + ')' : '') + (bad.length ? '\n     ' + bad.join('\n     ') : ''));
}
async function open(viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('page error: ' + String(e.message || e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text().split('\n')[0].slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(origin) && !/favicon\.ico$/.test(r.url())) problems.push(r.status() + ' ' + r.url().slice(origin.length)); });
  return { ctx, page, problems };
}
// no horizontal scroll and nothing sticking out past the right edge
function overflow(page) {
  return page.evaluate(() => {
    const w = window.innerWidth, sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (sw > w) return `horizontal overflow: scrollWidth ${sw} > viewport ${w}`;
    const out = [...document.querySelectorAll('[data-tile], .box, .frame-wrap, h1, .nav, .topbar')].filter(e => e.getBoundingClientRect().right > w + 1);
    return out.length ? 'past the right edge: ' + out.slice(0, 5).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.dataset.tile ? '[' + e.dataset.tile + ']' : '')).join(', ') : '';
  });
}

// what the pages actually receive
let live = null;
{
  const problems = [];
  const txt = await fetch(base + 'zone/games.json').then(r => r.text());
  try { live = JSON.parse(txt); } catch (e) { problems.push('served games.json is not valid JSON: ' + e.message); }
  if (live && (!Array.isArray(live.games) || !live.games.length)) { problems.push('served games.json has no games'); live = null; }
  report('zone/games.json', problems, live ? live.games.length + ' entries' : '');
}

async function checkLanding(viewport, label) {
  const { ctx, page, problems } = await open(viewport);
  try {
    await page.goto(base + 'zone/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('[data-tile]').length > 0 || (document.getElementById('err') && !document.getElementById('err').hidden), null, { timeout: 15000 })
      .catch(() => problems.push('landing: no tiles and no error message within 15 s'));
    const err = await page.$eval('#err', e => e.hidden ? '' : e.textContent).catch(() => '');
    if (err) problems.push('landing shows an error: ' + err);
    const tiles = await page.$$eval('[data-tile]', a => a.map(t => ({ id: t.dataset.tile, href: t.getAttribute('href') })));
    if (tiles.length !== games.length) problems.push(`landing renders ${tiles.length} tiles, the catalog has ${games.length}`);
    for (const g of games) if (!tiles.some(t => t.id === g.id)) problems.push('no tile for ' + g.id);
    const name = await page.$eval('#zoneName', e => e.textContent.trim()).catch(() => '');
    if (name !== catalog.zone.name) problems.push(`zone name on the page is "${name}", games.json says "${catalog.zone.name}"`);
    const shelves = await page.$$eval('.shelf', s => s.map(x => ({ id: x.dataset.shelf, count: parseInt((x.querySelector('.count') || {}).textContent || '0', 10), tiles: x.querySelectorAll('[data-tile]').length })));
    if (!shelves.length) problems.push('no shelf rows rendered');
    for (const s of shelves) { const n = games.filter(g => g.shelf === s.id).length; if (s.count !== n || s.tiles !== n) problems.push(`shelf ${s.id}: heading says ${s.count}, renders ${s.tiles} tiles, the catalog has ${n}`); }
    if (!(await page.$('#randomBtn'))) problems.push('no Random game button');
    if (!(await page.$('a.back[href="../index.html"]'))) problems.push('no Back to the arcade link');
    for (const t of tiles) { const u = new URL(t.href, base + 'zone/index.html'); const r = await fetch(u.href); if (r.status !== 200) problems.push(`tile ${t.id} href ${t.href} -> HTTP ${r.status}`); }
    for (const g of (live ? live.games : [])) { const r = await fetch(base + 'games/' + g.file); if (r.status !== 200) problems.push(`${g.id}: games/${g.file} -> HTTP ${r.status}`); }
    if (viewport === PHONE) { const ov = await overflow(page); if (ov) problems.push(ov); }
  } catch (e) { problems.push('load: ' + e.message.split('\n')[0]); }
  await ctx.close();
  report('zone/index.html' + label, problems);
}

async function checkGame(g, viewport, label) {
  const { ctx, page, problems } = await open(viewport);
  let ms = 0;
  try {
    const t0 = Date.now();
    await page.goto(base + 'zone/play.html?g=' + encodeURIComponent(g.id), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      const f = document.getElementById('frame'), err = document.getElementById('err'), fb = document.getElementById('fallback');
      if (!f) return !!((err && !err.hidden) || (fb && !fb.hidden));
      try { const d = f.contentDocument; return !!(d && d.readyState === 'complete' && d.body && (d.querySelector('canvas') || d.body.innerText.trim().length)); } catch (e) { return false; }
    }, null, { timeout: 20000 }).catch(() => problems.push('the game frame did not finish loading within 20 s'));
    ms = Date.now() - t0;
    await page.waitForTimeout(1500);
    const frame = page.frames().find(f => f !== page.mainFrame());
    if (!frame) problems.push('no game iframe on the page');
    else {
      const inside = await frame.evaluate(() => ({ canvas: !!document.querySelector('canvas'), text: (document.body && document.body.innerText || '').trim().length })).catch(e => ({ err: e.message }));
      if (inside.err) problems.push('could not read the game document: ' + inside.err.split('\n')[0]);
      else if (!inside.canvas && !inside.text) problems.push('the game document has no canvas and an empty body');
    }
    const info = await page.evaluate(() => {
      const txt = s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()).filter(Boolean);
      const t = id => ((document.getElementById(id) || {}).textContent || '').trim();
      const best = document.getElementById('best');
      return { title: document.title, h1: t('gTitle'), crumbs: t('crumbs'), controls: txt('#controls li'), goal: t('goal'), steps: txt('#howto li'), tips: txt('#tips li'),
        skills: txt('#skills span'), also: [...document.querySelectorAll('#also a[data-tile]')].map(a => a.dataset.tile), big: !!document.getElementById('bigBtn'),
        best: best ? { hidden: best.hidden, text: best.textContent } : null };
    });
    if (info.h1 !== g.title) problems.push(`title shows "${info.h1}", the catalog says "${g.title}"`);
    if (!info.title.includes(g.title)) problems.push('document.title lacks the game title: ' + info.title);
    if (!info.crumbs.includes(g.title) || !info.crumbs.includes(catalog.zone.name)) problems.push('breadcrumb lacks the zone name or the game title: ' + info.crumbs);
    if (!info.controls.length) problems.push('Controls box is empty');
    if (!info.goal) problems.push('How to play has no goal line');
    if (info.steps.length < 2) problems.push(`How to play has ${info.steps.length} steps, want at least 2`);
    if (!info.tips.length) problems.push('Tips is empty');
    if (info.skills.length < 2 || info.skills.length > 3) problems.push(`Skills shows ${info.skills.length} tags, want 2 or 3`);
    if (info.also.length !== 2) problems.push(`You'll also like has ${info.also.length} links, want exactly 2`);
    for (const a of info.also) { if (!ids.includes(a)) problems.push('also-like links to an unknown id: ' + a); if (a === g.id) problems.push('also-like links to the game itself'); }
    if (!info.big) problems.push('no Play Big Screen button');
    if (info.best && !info.best.hidden) problems.push('Best line is shown in a fresh browser profile (nothing is saved yet): ' + info.best.text);
    if (viewport === PHONE) { const ov = await overflow(page); if (ov) problems.push(ov); }
  } catch (e) { problems.push('load: ' + e.message.split('\n')[0]); }
  await ctx.close();
  report('zone/play.html?g=' + g.id + label, problems, 'frame ready in ' + ms + ' ms');
}

async function checkUnknown(q) {
  const { ctx, page, problems } = await open(DESK);
  try {
    await page.goto(base + 'zone/play.html' + q, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => (document.getElementById('fallback') && !document.getElementById('fallback').hidden) || (document.getElementById('err') && !document.getElementById('err').hidden), null, { timeout: 15000 })
      .catch(() => problems.push('no fallback and no error message within 15 s'));
    const fb = await page.evaluate(() => {
      const f = document.getElementById('fallback');
      return { shown: !!f && !f.hidden, msg: ((document.getElementById('fallbackMsg') || {}).textContent || ''), tiles: f ? f.querySelectorAll('[data-tile]').length : 0, frame: !!document.getElementById('frame') };
    });
    if (!fb.shown) problems.push('the fallback section is not shown');
    if (!fb.msg.trim()) problems.push('the fallback has no message');
    if (q.includes('=') && !fb.msg.includes(q.split('=')[1])) problems.push('the fallback message does not name the unknown id: ' + fb.msg);
    if (fb.tiles !== games.length) problems.push(`the fallback lists ${fb.tiles} tiles, the catalog has ${games.length}`);
    if (fb.frame) problems.push('an iframe was created although the id is unknown');
  } catch (e) { problems.push('load: ' + e.message.split('\n')[0]); }
  await ctx.close();
  report('zone/play.html' + (q || ' (no ?g=)'), problems);
}

await checkLanding(DESK, '');
for (const g of games) await checkGame(g, DESK, '');
await checkUnknown('?g=not-a-real-game');
await checkUnknown('');
await checkLanding(PHONE, '  [phone 390x844]');
await checkGame(games[0], PHONE, '  [phone 390x844]');

await browser.close();
server.close();
console.log(`${passed}/${passed + failed} checks passed` + (fault ? `  (fault: ${fault}; this run is expected to fail)` : ''));
process.exit(failed ? 1 : 0);
