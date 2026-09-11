#!/usr/bin/env node
// normalize-diffs.js - retarget the raw no-index diffs at games/chess.html so the
// parent can apply them from the repo root with: git apply <file>.diff
'use strict';
const fs = require('fs'), crypto = require('crypto');
const RES = 'C:/Users/caleb/AppData/Local/arcade-hub/_loop/research';
const ids = ['review-castle-flag','puzzle8-fen','puzzle19-fen','castle-rook-present','castle-rook-present-q','rep-ep-key','insufficient-samecolor-bishops','all'];
const out = [];
for (const id of ids) {
  const raw = fs.readFileSync(RES + '/' + id + '.raw.diff', 'utf8');
  const fixed = raw.split('\n').map(l => {
    if (l.startsWith('diff --git ')) return 'diff --git a/games/chess.html b/games/chess.html';
    if (l.startsWith('--- a/')) return '--- a/games/chess.html';
    if (l.startsWith('+++ b/')) return '+++ b/games/chess.html';
    return l;
  }).join('\n');
  fs.writeFileSync(RES + '/' + id + '.diff', fixed);
  fs.unlinkSync(RES + '/' + id + '.raw.diff');
  out.push({ id, file: id + '.diff', lines: fixed.split('\n').length, sha: crypto.createHash('sha256').update(fixed).digest('hex').slice(0, 16) });
}
// hash of the fully patched copy for the apply round-trip check
const all = fs.readFileSync('C:/Users/caleb/AppData/Local/arcade-hub/_loop/shots/engfix-all.html');
out.push({ id: 'engfix-all.html sha256', sha: crypto.createHash('sha256').update(all).digest('hex') });
const orig = fs.readFileSync('C:/Users/caleb/AppData/Local/arcade-hub/games/chess.html');
out.push({ id: 'games/chess.html sha256', sha: crypto.createHash('sha256').update(orig).digest('hex') });
console.log(JSON.stringify(out, null, 1));
