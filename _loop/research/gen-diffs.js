#!/usr/bin/env node
// gen-diffs.js - unified diffs of the frozen snapshot vs each patched copy, retargeted at
// games/chess.html so the parent can run:  git -C <repo> apply <id>.diff
'use strict';
const fs = require('fs'), crypto = require('crypto'), cp = require('child_process');
const ROOT = 'C:/Users/caleb/AppData/Local/arcade-hub';
const SHOTS = ROOT + '/_loop/shots';
const RES = ROOT + '/_loop/research';
const SNAP = SHOTS + '/engfix-snapshot.html';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// round-trip check: is a fs read+write of the snapshot byte-exact?
const raw = fs.readFileSync(SNAP);
fs.writeFileSync(SHOTS + '/engfix-roundtrip.html', raw.toString('utf8'));
const rt = fs.readFileSync(SHOTS + '/engfix-roundtrip.html');
const roundTrip = sha(raw) === sha(rt);

const ids = ['review-castle-flag','puzzle8-fen','puzzle19-fen','castle-rook-present','castle-rook-present-q','rep-ep-key','insufficient-samecolor-bishops','all'];
const out = { snapshotBytes: raw.length, snapshotSha: sha(raw), utf8RoundTripExact: roundTrip, diffs: [] };
for (const id of ids) {
  let buf;
  try { buf = cp.execFileSync('git', ['-C', ROOT, 'diff', '--no-index', '--', '_loop/shots/engfix-snapshot.html', '_loop/shots/engfix-' + id + '.html'], { maxBuffer: 1 << 28 }); }
  catch (e) { buf = e.stdout; if (!buf) throw e; }
  const text = buf.toString('utf8').split('\n').map(l => {
    if (l.startsWith('diff --git ')) return 'diff --git a/games/chess.html b/games/chess.html';
    if (l.startsWith('--- a/')) return '--- a/games/chess.html';
    if (l.startsWith('+++ b/')) return '+++ b/games/chess.html';
    return l;
  }).join('\n');
  if (text.indexOf('+++ b/games/chess.html') < 0) throw new Error('header rewrite failed for ' + id);
  fs.writeFileSync(RES + '/' + id + '.diff', text, 'utf8');
  out.diffs.push({ id, file: id + '.diff', bytes: Buffer.byteLength(text), hunks: (text.match(/^@@/gm) || []).length });
}
console.log(JSON.stringify(out, null, 1));
