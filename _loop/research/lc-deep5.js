'use strict';
const C = require('./lc-chess.js');
const D = require('./lc-data.json');
const PT = C.PT, CL = C.CL;
function tok(st, t) { const m = C.parseSAN(st, t); return (m && !m.ambiguous) ? m : null; }
function replay(moves) { let st = C.parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); const sans = []; for (const t of moves.split(' ')) { const m = tok(st, t); if (!m) return { ok:false, bad:t, sans }; sans.push(C.toSAN(st,m)); st = C.doMove(st,m); } return { ok:true, sans, st }; }
const t = D.TRAPS.find(x => x.name === 'Siberian Trap');
const r = replay(t.moves);
const whiteWait = C.allLegal(r.st, r.st.turn).find(m => C.toSAN(r.st, m) === 'a3');
const a = whiteWait ? C.doMove(r.st, whiteWait) : r.st;
const qh2 = C.allLegal(a, a.turn).find(m => C.toSAN(a, m) === 'Qh2#');
console.log('Siberian after 10.a3: Qh2# available? ' + (qh2 ? (C.inCheckmate(C.doMove(a, qh2), CL.WHITE) ? 'YES, mate confirmed' : 'move exists but not mate') : 'no Qh2#; black legal: ' + C.allLegal(a, a.turn).filter(m => C.sqName(m.to) === 'h2').map(x => C.toSAN(a, x)).join(',')));
console.log('  SAN check: ' + C.allLegal(a, a.turn).filter(m => C.sqName(m.to) === 'h2').map(x => C.toSAN(a, x)).join(',') || 'none');
console.log('');
console.log('QUIZ pin geometry: c3 and b5 square colors ->');
const colorOf = sq => ((C.row(C.nameSq(sq)) + C.col(C.nameSq(sq))) % 2 === 1) ? 'dark' : 'light';
console.log('  a1=' + colorOf('a1') + ' h1=' + colorOf('h1') + ' c3=' + colorOf('c3') + ' b5=' + colorOf('b5') + ' -> same diagonal possible? ' + (colorOf('c3') === colorOf('b5')));
const st = C.parseFEN('rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR b KQkq - 0 1');
console.log('  a queen on b5 with a knight on c3 (neither side has moved anything else relevant):');
console.log('    does Qb5 attack c3? ' + C.pseudoMoves(st.board, C.nameSq('b5'), null, null).some(m => m.to === C.nameSq('c3')));
console.log('    does Qb5 pin c3 against any king square? ' + (function () { for (let i = 0; i < 64; i++) { if (st.board[i] !== C.P(PT.KING, CL.WHITE)) continue; const line = []; const q = C.nameSq('b5'), k = C.nameSq(i); if (colorOf(q) !== colorOf(k)) continue; return 'check'; } return 'NO - b5 and c3 are not on a common line, so no pin is geometrically possible'; })());
