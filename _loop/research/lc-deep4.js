'use strict';
const C = require('./lc-chess.js');
const D = require('./lc-data.json');
const PT = C.PT, CL = C.CL;
function tokToMove(st, tok) {
  const t = String(tok).replace(/[!?]+$/, '');
  if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(t)) {
    const from = C.nameSq(t.slice(0,2)), to = C.nameSq(t.slice(2));
    const legal = C.allLegal(st, st.turn).filter(m => m.from === from && m.to === to);
    return legal[0] || null;
  }
  const m = C.parseSAN(st, t); return (m && !m.ambiguous) ? m : null;
}
function replay(moves, fen) {
  let st = C.parseFEN(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); const sans = [];
  for (const tok of String(moves).split(/\s+/).filter(Boolean)) { const m = tokToMove(st, tok); if (!m) return { ok:false, bad:tok, sans, fen:C.toFEN(st) }; sans.push(C.toSAN(st,m)); st = C.doMove(st, m); }
  return { ok:true, sans, st, mate: C.inCheckmate(st, st.turn) };
}
console.log('===== J. PROPOSED FIXES for ACADEMY.traps (6 token corrections) =====');
const fixes = [
  [1, 'Fried Liver Setup', 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5 g5f7 e8f7 d1f3 f7e6 b1c3'],
  [5, 'Noah\'s Ark Trap', 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6 d2d4 b7b5 a4b3 c6d4 f3d4 e5d4 d1d4 c7c5 d4d5 c8e6 d5c6 e6d7 c6d5 c5c4'],
  [7, 'Kostic Trap', 'e2e4 e7e5 g1f3 b8c6 f1c4 c6d4 f3e5 d8g5 e5f7 g5g2 h1f1 g2e4 c4e2 d4f3'],
  [9, 'Siberian Trap', 'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3 b8c6 g1f3 e7e6 f1c4 d8c7 e1g1 g8f6 d1e2 f6g4 h2h3 c6d4'],
  [10, 'Englund Gambit Trap', 'd2d4 e7e5 d4e5 b8c6 g1f3 d8e7 c1f4 e7b4 f4d2 b4b2 d2c3 f8b4 d1d2 b4c3 d2c3 b2c1'],
];
for (const [idx, name, moves] of fixes) {
  const orig = D.ACADEMY.traps[idx];
  const r = replay(moves);
  console.log('  [' + idx + '] ' + name);
  console.log('      orig : ' + orig.moves);
  console.log('      fix  : ' + moves);
  console.log('      result: ok=' + r.ok + ' final=' + (r.mate ? 'MATE' : r.st ? (C.isInCheck(r.st, r.st.turn) ? 'check' : 'quiet') : 'n/a') + ' san=' + r.sans.join(' ') + (r.ok ? '' : ' BAD=' + r.bad + ' at ' + r.fen));
  console.log('      punish text expects: ' + JSON.stringify(orig.punish.slice(0, 90)));
}
console.log('');
console.log('===== K. TRAPS punish-text verification =====');
{
  const t = D.TRAPS.find(x => x.name === 'Siberian Trap');
  const r = replay(t.moves);
  console.log('  Siberian Trap final position: ' + C.toFEN(r.st));
  const whiteWait = C.allLegal(r.st, r.st.turn).find(m => C.toSAN(r.st, m) === 'a3');
  const a = C.doMove(r.st, whiteWait);
  const qh2 = C.allLegal(a, a.turn).find(m => C.toSAN(a, m) === 'Qxh2#');
  console.log('  after a neutral 10.a3: does ...Qxh2# mate? ' + (qh2 ? (C.inCheckmate(C.doMove(a, qh2), CL.WHITE) ? 'YES - punish text claim holds' : 'Qxh2 exists but is not mate') : 'no Qxh2# available'));
  console.log('  (black Nd4 attacks e2 queen? ' + C.pseudoMoves(a.board, C.nameSq('d4'), null, null).some(m => m.to === C.nameSq('e2')) + ')');
}
{
  const t = D.TRAPS.find(x => x.name === 'Elephant Trap');
  const r = replay(t.moves);
  console.log('  Elephant Trap final SAN: ' + r.sans.join(' ') + ' | mate=' + r.mate);
  const t2 = D.TRAPS.find(x => x.name === 'Lasker Trap');
  const r2 = replay(t2.moves);
  console.log('  Lasker Trap final SAN: ' + r2.sans.join(' ') + ' | after 7.Ke2 is fxg1=N+ available: ' +
    (function(){ const m = C.allLegal(r2.st, r2.st.turn).find(x => C.sqName(x.from) === 'f2' && C.sqName(x.to) === 'g1'); return m ? 'yes (promo:' + m.promo + ')' : 'NO'; })());
}
console.log('');
console.log('===== L. PUZZLE #3 - is Kf1 "best"? (depth-6 eval of every legal move) =====');
{
  const VAL = { 1:0, 2:900, 3:500, 4:330, 5:320, 6:100 };
  let N = 0;
  function ev(st) { let s = 0; for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p) continue; s += (C.pColor(p) === CL.WHITE ? 1 : -1) * VAL[C.pType(p)]; } return st.turn === CL.WHITE ? s : -s; }
  function s(st, d, alpha, beta) { N++; if (d === 0) return ev(st); const ms = C.allLegal(st, st.turn); if (!ms.length) return C.isInCheck(st, st.turn) ? (st.turn === CL.WHITE ? -99999 : 99999) : 0; let b = -Infinity; for (const m of ms) { const sc = -s(C.doMove(st, m), d - 1, -beta, -alpha); if (sc > b) b = sc; if (b > alpha) alpha = b; if (alpha >= beta) break; } return b; }
  const st = C.parseFEN('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1');
  const rows = C.allLegal(st, st.turn).map(m => ({ san: C.toSAN(st, m), v: -s(C.doMove(st, m), 5, -Infinity, Infinity) }));
  rows.sort((a, b) => b.v - a.v);
  console.log('  depth 6 evals (centipawns, white POV): ' + rows.map(r => r.san + '=' + r.v).join(' '));
  console.log('  solution Kf1 value: ' + rows.find(r => r.san === 'Kf1').v + ' ; best: ' + rows[0].san + '=' + rows[0].v);
}
console.log('');
console.log('===== M. TIPS / QUIZ structural sanity =====');
{
  const tips = D.TIPS;
  const dupes = {}; tips.forEach((t, i) => { const k = t.slice(0, 40); (dupes[k] = dupes[k] || []).push(i); });
  const d = Object.entries(dupes).filter(([, v]) => v.length > 1);
  console.log('  TIPS count=' + tips.length + ' duplicates(by first 40 chars)=' + d.length + (d.length ? ' -> ' + JSON.stringify(d) : ''));
  const q = D.QUIZ;
  console.log('  QUIZ count=' + q.length + ' ; entries with empty answers: ' + q.filter(x => !x.a || !x.a.trim()).length);
  const chk = q.filter(x => /pin/i.test(x.q));
  chk.forEach(x => console.log('    pin-quiz: ' + x.q + ' || ' + x.a));
}
