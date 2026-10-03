#!/usr/bin/env node
// Loads every page in a headless browser at phone size and fails on the two
// things that are always bugs: a JS error, or a request to our own origin that
// 404s (a missing asset). Run locally with `node tools/audit.mjs`.
//
// Deliberately NOT asserted, because each produced false positives when this
// was written:
//   - horizontal overflow: off-canvas drawers and `overflow-x:auto` strips
//     legitimately place children past the viewport
//   - WebGL availability: depends on the runner's GPU flags, not the page
//   - external hosts: a blocked CDN is the network's problem, not the code's

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(import.meta.dirname, '..');
const GAMES = path.join(ROOT, 'games');

// Requests we know fail and have decided not to fix. Keep this list short and
// justified — every entry is a bug someone chose to live with.
const IGNORED_PATHS = [
  '/favicon.ico', // no page defines one; cosmetic and site-wide
];

const VIEWPORT = { width: 430, height: 900, isMobile: true, hasTouch: true };
const SETTLE_MS = 2500; // games run a permanent rAF loop, so "network idle" never fires

const freePort = () => new Promise(res => {
  const s = net.createServer();
  s.listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
});

async function main() {
  const pages = [
    { url: '/', name: 'hub' },
    ...fs.readdirSync(GAMES).filter(f => f.endsWith('.html'))
      .sort().map(f => ({ url: `/games/${f}`, name: 'games/' + f.replace(/\.html$/, '') })),
  ];

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore' });
  const stop = () => { try { server.kill(); } catch {} };
  process.on('exit', stop);

  // wait for the server rather than sleeping a fixed amount
  for (let i = 0; i < 50; i++) {
    try { await fetch(base + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio', '--hide-scrollbars'],
  });

  const failures = [];
  console.log(`auditing ${pages.length} pages at ${VIEWPORT.width}x${VIEWPORT.height}\n`);

  for (const pg of pages) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    const jsErrors = [], badRequests = [];

    page.on('pageerror', e => jsErrors.push(String(e.message).split('\n')[0].slice(0, 200)));
    page.on('response', r => {
      const u = new URL(r.url());
      if (u.origin !== base) return;                       // external host: not ours
      if (IGNORED_PATHS.includes(u.pathname)) return;
      if (r.status() >= 400) badRequests.push(`${r.status()} ${u.pathname}`);
    });

    try {
      await page.goto(base + pg.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, SETTLE_MS));
    } catch (e) {
      jsErrors.push('navigation: ' + e.message.split('\n')[0].slice(0, 160));
    }
    await page.close();

    const bad = [...new Set(badRequests)];
    if (jsErrors.length || bad.length) {
      failures.push({ name: pg.name, jsErrors, bad });
      console.log(`FAIL ${pg.name}`);
      for (const e of jsErrors) console.log(`       js: ${e}`);
      for (const r of bad) console.log(`      req: ${r}`);
    } else {
      console.log(`ok   ${pg.name}`);
    }
  }

  await browser.close();
  stop();

  console.log(`\n${pages.length} pages, ${failures.length} with problems`);
  if (failures.length) {
    console.log('\nEach failure is either a JS error or a missing file this repo should ship.');
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
