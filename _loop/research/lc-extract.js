'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/caleb/AppData/Local/arcade-hub';
const SRC = path.join(ROOT, 'games/chess.html');
const OUT = path.join(ROOT, '_loop/research');
const html = fs.readFileSync(SRC, 'utf8');
const lines = html.split(/\r?\n/);

const names = ['PUZZLES', 'TIPS', 'ACADEMY', 'COMBOS', 'ROUTES', 'ENDGAME2', 'QUIZ', 'TRAPS'];
const out = {}, meta = {};
for (const n of names) {
  const re = new RegExp('^const ' + n + ' = (.*);\\s*$');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) {
      try { out[n] = JSON.parse(m[1]); meta[n] = { line: i + 1, chars: m[1].length }; }
      catch (e) { console.log('PARSE FAIL ' + n + ' line ' + (i + 1) + ': ' + e.message); }
      break;
    }
  }
}
fs.writeFileSync(path.join(OUT, 'lc-data.json'), JSON.stringify(out, null, 1));
console.log('=== counts ===');
for (const n of names) {
  const v = out[n];
  if (v === undefined) { console.log(n + ': MISSING'); continue; }
  if (Array.isArray(v)) console.log(n.padEnd(9) + ' line ' + String(meta[n].line).padEnd(5) + ' entries=' + v.length);
  else console.log(n.padEnd(9) + ' line ' + String(meta[n].line).padEnd(5) + ' keys=' + Object.keys(v).map(k => k + '=' + (Array.isArray(v[k]) ? v[k].length : '?')).join(' '));
}
// per-section plain text dumps for reading
const w = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
if (out.ACADEMY) for (const k of Object.keys(out.ACADEMY)) {
  const v = out.ACADEMY[k];
  if (!Array.isArray(v)) { w('lc-academy-' + k + '.txt', JSON.stringify(v, null, 1)); continue; }
  w('lc-academy-' + k + '.txt', v.map((e, i) => ('[' + i + '] ' + JSON.stringify(e, null, 1))).join('\n\n'));
}
w('lc-tips.txt', out.TIPS.map((t, i) => i + '. ' + t).join('\n'));
w('lc-quiz.txt', out.QUIZ.map((q, i) => 'Q' + i + ': ' + q.q + '\n   A: ' + q.a).join('\n\n'));
w('lc-traps.txt', out.TRAPS.map((t, i) => '[' + i + '] ' + t.name + ' | ' + t.opening + ' | side=' + t.side + '\nmoves: ' + t.moves + '\nhook: ' + t.hook + '\npunish: ' + t.punish + '\navoid: ' + t.avoid).join('\n\n'));
w('lc-routes.txt', out.ROUTES.map(b => b.branch + '\n' + b.lines.map(l => '  - ' + l.name + ' :: ' + l.moves + '\n    ' + l.plan).join('\n')).join('\n\n'));
w('lc-combos.txt', out.COMBOS.map((c, i) => '[' + i + '] ' + JSON.stringify(c)).join('\n'));
w('lc-endgame2.txt', out.ENDGAME2.map((c, i) => '[' + i + '] ' + JSON.stringify(c)).join('\n'));
console.log('wrote per-section dumps to _loop/research/');
console.log('line 1230 exists as ENDGAME2: ' + (meta.ENDGAME2 ? 'yes line ' + meta.ENDGAME2.line : 'no'));
