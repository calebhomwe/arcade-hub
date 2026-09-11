'use strict';
const C = require('./lc-chess.js');
const PT = C.PT, CL = C.CL;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const VAL = { 1:0, 2:900, 3:500, 4:330, 5:320, 6:100 };
function evalSt(st) {
  let s = 0;
  for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p) continue;
    s += (C.pColor(p) === CL.WHITE ? 1 : -1) * VAL[C.pType(p)]; }
  return st.turn === CL.WHITE ? s : -s;
}
function sq(s) { return C.nameSq(s); }
function playLine(fen, moves) {
  let st = C.parseFEN(fen); const sans = [];
  for (const tok of moves.split(/\s+/).filter(Boolean)) {
    const t = tok.replace(/^\d+\.(\.\.)?/, '');
    if (!t) continue;
    const m = C.parseSAN(st, t);
    if (!m || m.ambiguous) return { ok: false, bad: tok, sans, fen: C.toFEN(st) };
    sans.push(C.toSAN(st, m)); st = C.doMove(st, m);
  }
  return { ok: true, sans, st, mate: C.inCheckmate(st, st.turn), check: C.isInCheck(st, st.turn) };
}

console.log('===== A. PUZZLE #2 hint claim: "The knight on e4 is attacked twice" =====');
{
  const st = C.parseFEN('r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1');
  const e4 = C.nameSq('e4');
  const attackers = [], defenders = [];
  for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p) continue;
    for (const m of C.pseudoMoves(st.board, i, null, null)) if (m.to === e4) {
      (C.pColor(p) === CL.WHITE ? attackers : defenders).push(C.pPiece ? '' : (C.sqName(i) + ':' + '?kqrbnp'[C.pType(p)]));
    } }
  console.log('  white attackers of e4: ' + (attackers.join(', ') || 'NONE'));
  console.log('  black defenders of e4: ' + (defenders.join(', ') || 'NONE'));
  console.log('  legal moves: ' + C.allLegal(st, st.turn).length + '; solution d7d5 legal: ' + !!C.allLegal(st, st.turn).find(m => C.sqName(m.from) === 'd7' && C.sqName(m.to) === 'd5'));
  const after = C.doMove(st, C.allLegal(st, st.turn).find(m => C.sqName(m.from) === 'd7' && C.sqName(m.to) === 'd5'));
  console.log('  after 1...d5 white legal replies: ' + C.allLegal(after, after.turn).map(x => C.toSAN(after, x)).join(' '));
}

console.log('');
console.log('===== B. PUZZLE #8 (broken mate-in-1) =====');
{
  const fen = '7k/8/8/8/8/8/8/6QK w - - 0 1';
  const st = C.parseFEN(fen);
  const mates = [];
  for (const m of C.allLegal(st, st.turn)) { const a = C.doMove(st, m); if (C.inCheckmate(a, a.turn)) mates.push(C.toSAN(st, m)); }
  console.log('  FEN ' + fen);
  console.log('  mate-in-1 moves: ' + (mates.length ? mates.join(', ') : 'NONE'));
  const g7 = C.allLegal(st, st.turn).find(m => C.sqName(m.from) === 'g1' && C.sqName(m.to) === 'g7');
  const a = C.doMove(st, g7);
  console.log('  after solution g1g7: white queen on g7 defended by? attackers-of-g7-by-white count = ' +
    (function(){ let n = 0; for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p || C.pColor(p) !== CL.WHITE) continue; if (i === C.nameSq('g1')) continue; for (const mm of C.pseudoMoves(st.board, i, null, null)) if (mm.to === C.nameSq('g7')) n++; } return n; })());
  console.log('  black replies after g1g7: ' + C.allLegal(a, a.turn).map(x => C.toSAN(a, x)).join(' '));
  console.log('  black best (captures queen)?: ' + (C.allLegal(a, a.turn).some(x => C.sqName(x.to) === 'g7')));
  for (const cand of ['7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', '7k/8/7K/8/8/8/8/6Q1 w - - 0 1', '7k/8/6K1/8/8/8/8/6Q1 w - - 0 1']) {
    const s2 = C.parseFEN(cand); const mm = [];
    for (const m of C.allLegal(s2, s2.turn)) { const aa = C.doMove(s2, m); if (C.inCheckmate(aa, aa.turn)) mm.push(C.toSAN(s2, m)); }
    console.log('  CANDIDATE ' + cand + ' -> mate-in-1: ' + (mm.join(', ') || 'NONE'));
  }
}

console.log('');
console.log('===== C. PUZZLE #3 (symmetrical K+P, solution Kf1) =====');
{
  const st = C.parseFEN('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1');
  console.log('  legal moves: ' + C.allLegal(st, st.turn).map(m => C.toSAN(st, m)).join(' '));
  console.log('  static eval: ' + evalSt(st) + ' (0 = dead equal)');
  const after = C.doMove(st, C.parseSAN(st, 'Kf1'));
  console.log('  server/engine view: material equal, no pawn can advance (all f/g/h files locked pawn-vs-pawn): ' +
    (function(){ let blocked = 0, tot = 0; for (let i = 0; i < 64; i++) { const p = st.board[i]; if (C.pType(p) !== PT.PAWN) continue; tot++; const d = C.pColor(p) === CL.WHITE ? -1 : 1; const f = C.idx(C.row(i) + d, C.col(i)); if (C.inB(C.row(i)+d, C.col(i)) && st.board[f]) blocked++; } return blocked + '/' + tot + ' pawns blocked head-on'; })());
}

console.log('');
console.log('===== D. COMBOS replay =====');
{
  const legal = playLine(START, '1.e4 e5 2.Bc4 d6 3.Nf3 Bg4 4.Nc3 g6 5.Nxe5 Bxd1 6.Bxf7+ Ke7 7.Nd5#');
  console.log('  Legal 1750 (COMBOS[0]): ok=' + legal.ok + ' san=' + legal.sans.join(' ') + ' mate=' + (legal.mate || false) + (legal.ok ? '' : ' bad=' + legal.bad));
}
{
  const opera = playLine(START, '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#');
  console.log('  Opera Game 1858 (COMBOS[3]): ok=' + opera.ok + ' plies=' + opera.sans.length + ' mate=' + (opera.mate || false) + (opera.ok ? ' final=' + opera.sans.slice(-4).join(' ') : ' bad=' + opera.bad + ' at fen ' + opera.fen));
}
{
  const imm = playLine(START, '1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7#');
  console.log('  Immortal Game 1851 (COMBOS[1]): ok=' + imm.ok + ' plies=' + imm.sans.length + ' mate=' + (imm.mate || false) + (imm.ok ? ' tail=' + imm.sans.slice(-6).join(' ') : ' bad=' + imm.bad + ' at ' + imm.fen));
}
{
  const ev = playLine(START, '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7#');
  console.log('  Evergreen Game 1852 (COMBOS[2]): ok=' + ev.ok + ' plies=' + ev.sans.length + ' mate=' + (ev.mate || false) + (ev.ok ? ' tail=' + ev.sans.slice(-6).join(' ') : ' bad=' + ev.bad + ' at ' + ev.fen));
}

console.log('');
console.log('===== E. Pattern claims =====');
{
  const sm = playLine('6rk/6pp/5N2/8/8/8/8/6QK b - - 0 1', 'Kg8');
  console.log('  (setup only) ' + JSON.stringify(sm.ok));
  const r = playLine('5rk1/5ppp/8/8/8/8/8/6QK w - - 0 1', 'Qg8+ Rxg8');
  console.log('  Philidor legacy alt line: ' + JSON.stringify(r.ok) + ' san=' + r.sans.join(' '));
  const p = playLine('6rk/5Npp/8/8/8/8/8/6QK w - - 0 1', 'Qg8+ Rxg8 Nf7#');
  console.log('  COMBOS[9] smothered finish Nf7+ Kg8 Nh6+ Kh8 Qg8+ Rxg8 Nf7# (given a start position): ok=' + p.ok + ' san=' + p.sans.join(' ') + ' mate=' + (p.mate || false) + (p.ok ? '' : ' bad=' + p.bad));
}
{
  const withPawn = playLine('7k/6p1/8/8/8/8/8/K5Q1 w - - 0 1', 'Qg6');
  const st = { fen: C.toFEN(C.doMove(C.parseFEN('7k/6p1/8/8/8/8/8/K5Q1 w - - 0 1'), C.parseSAN(C.parseFEN('7k/6p1/8/8/8/8/8/K5Q1 w - - 0 1'), 'Qh2+'))) };
  function mateTest(fen) { const s = C.parseFEN(fen); return C.isInCheck(s, s.turn) && C.allLegal(s, s.turn).length === 0; }
  console.log('  Anastasia: Qh5 with black pawn on g7 (king h7): mate? ' + mateTest('7k/6p1/8/8/8/8/8/K6Q b - - 0 1'));
  console.log('  Anastasia: same without the g7 pawn:            mate? ' + mateTest('7k/8/8/8/8/8/8/K6Q b - - 0 1'));
  console.log('  (position: black Kh7, white Qh5 + Ka1; g7 pawn present/absent)');
  console.log('  black king escapes -> ' + C.allLegal(C.parseFEN('7k/8/8/8/8/8/8/K6Q b - - 0 1'), CL.BLACK).map(m => C.toSAN(C.parseFEN('7k/8/8/8/8/8/8/K6Q b - - 0 1'), m)).join(' '));
}
{
  const hook = '7k/8/6PN/8/8/8/8/6K1 w - - 0 1';
  const st = C.parseFEN(hook);
  const m = C.allLegal(st, st.turn).find(x => C.toSAN(st, x).indexOf('Rh7#') >= 0);
  console.log('  Hook mate sample (Kg1, Pg6, Nf6, Rh7? no: white has no rook in this fen) -> ' + C.allLegal(st, st.turn).map(x => C.toSAN(st, x)).join(' '));
  const hook2 = '7k/8/6PN/8/8/8/8/R5K1 w - - 0 1';
  const st2 = C.parseFEN(hook2);
  const rh7 = C.allLegal(st2, st2.turn).find(x => C.sqName(x.from) === 'a1' && C.sqName(x.to) === 'h7');
  console.log('  Hook mate Ra1-h7# with Pg6+Nf6 vs Kh8: ' + (rh7 ? C.toSAN(st2, rh7) + ' mate=' + C.inCheckmate(C.doMove(st2, rh7), CL.BLACK) : 'no such move'));
}
