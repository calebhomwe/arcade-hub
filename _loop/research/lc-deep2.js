'use strict';
const C = require('./lc-chess.js');
const PT = C.PT, CL = C.CL;
const VAL = { 1:0, 2:900, 3:500, 4:330, 5:320, 6:100 };
let NODES = 0;
function evalSt(st) { let s = 0; for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p) continue; s += (C.pColor(p) === CL.WHITE ? 1 : -1) * VAL[C.pType(p)]; } return st.turn === CL.WHITE ? s : -s; }
function search(st, depth, alpha, beta) {
  NODES++;
  if (depth === 0) return evalSt(st);
  const moves = C.allLegal(st, st.turn);
  if (!moves.length) return C.isInCheck(st, st.turn) ? (st.turn === CL.WHITE ? -100000 : 100000) : 0;
  moves.sort((a, b) => (b.capture ? VAL[C.pType(b.capture)] : 0) - (a.capture ? VAL[C.pType(a.capture)] : 0));
  let best = -Infinity;
  for (const m of moves) {
    const sc = -search(C.doMove(st, m), depth - 1, -beta, -alpha);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function evalDepth(st, depth) { NODES = 0; const v = search(st, depth, -Infinity, Infinity); return { v, nodes: NODES }; }
const mateTest = fen => { const s = C.parseFEN(fen); return C.isInCheck(s, s.turn) && C.allLegal(s, s.turn).length === 0; };

console.log('===== E2. Pattern claims (corrected FENs) =====');
console.log('  Anastasia WITH black pawn on g7  8/4N1pk/8/7Q/8/8/8/K7 b  -> Qh5 mate? ' + mateTest('8/4N1pk/8/7Q/8/8/8/K7 b - - 0 1'));
console.log('  Anastasia WITHOUT the g7 pawn    8/4N2k/8/7Q/8/8/8/K7 b  -> Qh5 mate? ' + mateTest('8/4N2k/8/7Q/8/8/8/K7 b - - 0 1'));
{
  const s = C.parseFEN('8/4N2k/8/7Q/8/8/8/K7 b - - 0 1');
  console.log('    (without g7 pawn black has: ' + C.allLegal(s, s.turn).map(m => C.toSAN(s, m)).join(' ') + ')');
}
{
  const st = C.parseFEN('6rk/5Npp/8/8/8/8/8/6QK w - - 0 1');
  console.log('  Smothered finish: 1.Qg8+ Rxg8 2.Nf7#  -> ' + (function () {
    const q = C.allLegal(st, st.turn).find(m => C.sqName(m.to) === 'g8' && C.pType(st.board[m.from]) === PT.QUEEN);
    if (!q) return 'Qg8 not available';
    const a = C.doMove(st, q);
    const replies = C.allLegal(a, a.turn);
    if (replies.length !== 1) return 'replies=' + replies.map(x => C.toSAN(a, x)).join(',');
    const b = C.doMove(a, replies[0]);
    const m = C.allLegal(b, b.turn).find(x => C.pType(b.board[x.from]) === PT.KNIGHT && C.toSAN(b, x) === 'Nf7#');
    return 'Qg8+ ' + C.toSAN(a, replies[0]) + ' then ' + (m ? C.toSAN(b, m) + ' MATE=' + C.inCheckmate(C.doMove(b, m), CL.BLACK) : 'no Nf7#');
  })());
}
{
  const st = C.parseFEN('6rk/5Npp/8/8/8/8/8/6QK w - - 0 1');
  const alt = C.parseFEN('7k/5Npp/5Q2/8/8/8/8/6K1 w - - 0 1');
  console.log('  Longer prefix Nf7+ Kg8 Nh6+ Kh8 Qg8+ Rxg8 Nf7# as an unconditional claim:');
  console.log('    In a standard Kh8+Rf8 setting the rook can capture the knight instead:');
  const s2 = C.parseFEN('5r1k/6pp/8/6N1/8/8/8/K2Q4 w - - 0 1');
  const nf7 = C.allLegal(s2, s2.turn).find(m => C.toSAN(s2, m) === 'Nf7+');
  if (nf7) { const a2 = C.doMove(s2, nf7); console.log('    1.Nf7+ black replies: ' + C.allLegal(a2, a2.turn).map(x => C.toSAN(a2, x)).join(' ') + '   <-- Rxf7 present'); }
  else console.log('    (Nf7+ unavailable in that construction)');
}
console.log('  Hook mate: Ra1? no -> Kh1/G1 rook h-file: 7k/8/5NP1/8/8/8/8/6KR w, Rh7# -> ' + (function () {
  const st = C.parseFEN('7k/8/5NP1/8/8/8/8/6KR w - - 0 1');
  const m = C.allLegal(st, st.turn).find(x => C.toSAN(st, x) === 'Rh7#');
  return m ? 'legal and mate=' + C.inCheckmate(C.doMove(st, m), CL.BLACK) : 'no Rh7#; legal: ' + C.allLegal(st, st.turn).map(x => C.toSAN(st, x)).join(' ');
})());

console.log('');
console.log('===== F. PAWN BREAKTHROUGH (ENDGAME2[8] + ACADEMY.endgame[6]) =====');
{
  const BASE = '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1';
  function line(fen, tokens) {
    let st = C.parseFEN(fen); const sans = [];
    for (const t of tokens.split(' ')) { const m = C.parseSAN(st, t); if (!m || m.ambiguous) return { ok: false, bad: t, sans, fen: C.toFEN(st) }; sans.push(C.toSAN(st, m)); st = C.doMove(st, m); }
    return { ok: true, sans, st };
  }
  const asWritten = line(BASE, 'b6 axb6 a6 bxa6 c6');
  console.log('  AS WRITTEN (ENDGAME2[8]): ' + BASE);
  console.log('    b6 axb6 a6 bxa6 c6 -> ' + asWritten.sans.join(' ') + '  fen=' + C.toFEN(asWritten.st));
  const c6 = asWritten.st.board[C.nameSq('c6')];
  const cPawnMoves = C.allLegal(asWritten.st, CL.WHITE).filter(m => m.from === C.nameSq('c6'));
  const bPawn = asWritten.st.board[C.nameSq('b6')];
  console.log('    white c6 pawn legal moves: ' + cPawnMoves.length + ' ; black pawn on b6 (path to b1 open?)');
  let st2 = asWritten.st; let i = 0; const blackPath = [];
  while (i < 6) { const m = C.allLegal(st2, st2.turn).find(x => C.sqName(x.from) === 'b6' && C.sqName(x.to) === 'b5'); if (!m) break; blackPath.push(C.toSAN(st2, m)); st2 = C.doMove(st2, m); const wm = C.allLegal(st2, st2.turn).find(x => C.pType(st2.board[x.from]) === PT.KING); if (!wm) break; blackPath.push(C.toSAN(st2, wm)); st2 = C.doMove(st2, wm); i++; }
  console.log('    black b6-pawn advance sequence (b6 king shuffle): ' + blackPath.join(' '));
  console.log('    search depth 8 from position after 3.c6: ' + JSON.stringify(evalDepth(asWritten.st, 8)) + '  (positive = White better)');
  const fixed1 = line(BASE, 'b6 axb6 c6 bxc6 a6');
  console.log('  CORRECTED A: b6 axb6 c6! bxc6 a6 -> ' + fixed1.sans.join(' ') + ' ; white a6 pawn ahead of it: ' +
    (function () { const f = C.toFEN(fixed1.st); const s = C.parseFEN(f); let blocked = 0; for (let r = C.row(C.nameSq('a6')) - 1; r >= 0; r--) if (s.board[C.idx(r, 0)]) blocked++; return blocked === 0 ? 'CLEAR (a6-a7-a8=Q)' : blocked + ' blockers'; })());
  console.log('    search depth 8 from position after 3.a6: ' + JSON.stringify(evalDepth(fixed1.st, 8)));
  const fixed2 = line(BASE, 'b6 cxb6 a6 bxa6 c6');
  console.log('  CORRECTED B: b6 cxb6 a6! bxa6 c6 -> ' + fixed2.sans.join(' ') + ' ; black pawns left: ' +
    (function () { const s = fixed2.st; const list = []; for (let i = 0; i < 64; i++) if (s.board[i] === C.P(PT.PAWN, CL.BLACK)) list.push(C.sqName(i)); return list.join(',') + ' -> can they touch c6/c7/c8? ' + list.some(q => ['a6', 'b6'].includes(q) ? false : true); })());
  console.log('    search depth 8 after 3.c6: ' + JSON.stringify(evalDepth(fixed2.st, 8)));
}

console.log('');
console.log('===== G. KQ vs K driver (ENDGAME2[5]: queen a knight-move away, shrink box, escort king) =====');
function kqk(startFen, verbose) {
  let st = C.parseFEN(startFen); const movelog = [];
  for (let ply = 0; ply < 120; ply++) {
    const legal = C.allLegal(st, st.turn);
    const me = st.turn;
    for (const m of legal) { const a = C.doMove(st, m); if (C.inCheckmate(a, a.turn)) { movelog.push(C.toSAN(st, m)); return { mate: true, plies: ply + 1, movelog }; } }
    if (me === CL.WHITE) {
      const bk = C.kingSq(st.board, CL.BLACK), qs = st.board.findIndex(p => p === C.P(PT.QUEEN, CL.WHITE)), wk = C.kingSq(st.board, CL.WHITE);
      const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      let pick = null;
      const safe = (m, s) => { const a = C.doMove(s, m); if (C.isInCheck(a, a.turn - 0) && false) return false; return !C.attacked(a.board, m.to, CL.BLACK) && !(C.allLegal(a, a.turn).length === 0 && !C.isInCheck(a, a.turn)); };
      const cands = legal.filter(m => C.pType(st.board[m.from]) === PT.QUEEN);
      const nk = cands.filter(m => knightOffsets.some(([dr, dc]) => C.row(m.to) + dr === C.row(bk) && C.col(m.to) + dc === C.col(bk)) && safe(m, st));
      const pool = nk.length ? nk : cands.filter(m => safe(m, st));
      if (pool.length) {
        pool.sort((a, b) => { const da = Math.abs(C.row(a.to) - C.row(bk)) + Math.abs(C.col(a.to) - C.col(bk)); const db = Math.abs(C.row(b.to) - C.row(bk)) + Math.abs(C.col(b.to) - C.col(bk)); return db - da; });
        pick = pool[0];
      } else {
        const ks = legal.filter(m => C.pType(st.board[m.from]) === PT.KING && safe(m, st));
        if (ks.length) { ks.sort((a, b) => (Math.abs(C.row(a.to) - C.row(bk)) + Math.abs(C.col(a.to) - C.col(bk))) - (Math.abs(C.row(b.to) - C.row(bk)) + Math.abs(C.col(b.to) - C.col(bk)))); pick = ks[0]; }
      }
      if (!pick) pick = legal.find(m => safe(m, st)) || legal[0];
      movelog.push(C.toSAN(st, pick)); st = C.doMove(st, pick);
    } else {
      const wk = C.kingSq(st.board, CL.WHITE);
      const opts = legal.map(m => ({ m, d: Math.abs(C.row(m.to) - C.row(wk)) + Math.abs(C.col(m.to) - C.col(wk)) })).sort((a, b) => b.d - a.d);
      const m = opts[0].m; movelog.push(C.toSAN(st, m)); st = C.doMove(st, m);
    }
  }
  return { mate: false, plies: 120, movelog };
}
{
  const tests = ['8/8/8/4k3/8/8/8/K5Q1 w - - 0 1', '8/8/3k4/8/8/8/8/K5Q1 w - - 0 1', '7k/8/8/3K4/8/8/8/6Q1 w - - 0 1', '8/8/8/2k5/8/8/8/K6Q w - - 0 1'];
  for (const f of tests) { const r = kqk(f); console.log('  ' + f.padEnd(36) + ' -> ' + (r.mate ? 'MATE in ' + Math.ceil(r.plies / 2) + ' white moves: ' + r.movelog.join(' ') : 'FAILED to mate in 60 white moves')); }
}
