'use strict';
const C = require('./lc-chess.js');
const PT = C.PT, CL = C.CL;
const VAL = { 1:0, 2:900, 3:500, 4:330, 5:320, 6:100 };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
console.log('===== E3. Smothered mate finish (TIPS[31], COMBOS[9], ACADEMY.mates[1]) =====');
{
  const fen = '6rk/6pp/5N2/8/8/8/8/3Q3K w - - 0 1';
  const st = C.parseFEN(fen);
  console.log('  start FEN: ' + fen + '  (white Qd1, Nf6, Kh1 vs black Kh8, Rg8, Pg7 Ph7)');
  console.log('  legal: ' + C.allLegal(st, st.turn).map(m => C.toSAN(st, m)).join(' '));
  const q = C.allLegal(st, st.turn).find(m => C.toSAN(st, m).indexOf('Qg8') === 0);
  if (q) {
    const a = C.doMove(st, q);
    const replies = C.allLegal(a, a.turn);
    console.log('  1.' + C.toSAN(st, q) + ' black replies: ' + replies.map(x => C.toSAN(a, x)).join(' ') + ' (Kxg8 illegal: Nh6 needed?)');
    if (replies.length === 1) {
      const b = C.doMove(a, replies[0]);
      const m = C.allLegal(b, b.turn).find(x => C.toSAN(b, x).replace(/[+#]$/,'') === 'Nf7');
      console.log('  2.' + (m ? C.toSAN(b, m) + ' -> mate=' + C.inCheckmate(C.doMove(b, m), CL.BLACK) : 'no Nf7# available'));
    }
  }
  const st2 = C.parseFEN('6rk/6pp/8/5N2/8/8/8/3Q3K w - - 0 1');
  const nh6 = C.allLegal(st2, st2.turn).find(m => C.toSAN(st2, m) === 'Nh6');
  if (nh6) {
    const a2 = C.doMove(st2, nh6);
    console.log('  with knight on f5: 1.Nh6 available; after it black: ' + C.allLegal(a2, a2.turn).map(x => C.toSAN(a2, x)).join(' '));
    const q2 = C.allLegal(a2, a2.turn === CL.BLACK ? a2.turn : a2.turn);
  }
}
console.log('  ACADEMY.mates[1] printed line "Nf7+ Kg8 Nh6+ Kh8 Qg8+ Rxg8 Nf7#": is the prefix forced?');
{
  const st = C.parseFEN('5r1k/6pp/8/6N1/8/8/8/K2Q4 w - - 0 1');
  const nf7 = C.allLegal(st, st.turn).find(m => C.toSAN(st, m) === 'Nf7+');
  const a = C.doMove(st, nf7);
  console.log('    Kh8 + Rf8 + Pg7,h7 setting -> 1.' + C.toSAN(st, nf7) + ' black legal replies: ' + C.allLegal(a, a.turn).map(x => C.toSAN(a, x)).join(' '));
  console.log('    => ...Rxf7 exists, so the printed 4-move prefix is NOT forced in the rook-on-f8 setup.');
}

console.log('');
console.log('===== H. KQ vs K and KR vs K: engine play-out of the stated methods =====');
function kxEval(st, kind) {
  const bk = C.kingSq(st.board, CL.BLACK), wk = C.kingSq(st.board, CL.WHITE);
  if (bk < 0) return 0;
  const edgeDist = Math.min(C.row(bk), 7 - C.row(bk), C.col(bk), 7 - C.col(bk));
  const kingDist = Math.abs(C.row(bk) - C.row(wk)) + Math.abs(C.col(bk) - C.col(wk));
  let s = (4 - edgeDist) * 60 - kingDist * 12;
  if (kind === 'R') s += (4 - edgeDist) * 40;
  let base = 0;
  for (let i = 0; i < 64; i++) { const p = st.board[i]; if (!p) continue; base += (C.pColor(p) === CL.WHITE ? 1 : -1) * VAL[C.pType(p)]; }
  const val = base + (st.turn === CL.WHITE ? s : -s);
  return st.turn === CL.WHITE ? val : -val;
}
function abSearch(st, depth, alpha, beta, kind) {
  const moves = C.allLegal(st, st.turn);
  if (!moves.length) return C.isInCheck(st, st.turn) ? (st.turn === CL.WHITE ? -99999 + (10 - depth) : 99999 - (10 - depth)) : 0;
  if (depth === 0) return kxEval(st, kind);
  moves.sort((a, b) => (b.capture ? VAL[C.pType(b.capture)] : 0) - (a.capture ? VAL[C.pType(a.capture)] : 0));
  let best = -Infinity;
  for (const m of moves) { const sc = -abSearch(C.doMove(st, m), depth - 1, -beta, -alpha, kind); if (sc > best) best = sc; if (best > alpha) alpha = best; if (alpha >= beta) break; }
  return best;
}
function playOut(fen, kind, depth, maxMoves) {
  let st = C.parseFEN(fen); const log = [];
  for (let ply = 0; ply < maxMoves * 2; ply++) {
    const legal = C.allLegal(st, st.turn);
    if (!legal.length) return { mate: C.isInCheck(st, st.turn), plies: ply, log, fen: C.toFEN(st) };
    if (st.turn === CL.WHITE) {
      let best = null, bs = -Infinity;
      for (const m of legal) { const sc = -abSearch(C.doMove(st, m), depth - 1, -Infinity, Infinity, kind); if (sc > bs) { bs = sc; best = m; } }
      log.push(C.toSAN(st, best)); st = C.doMove(st, best);
    } else {
      let best = null, bs = Infinity;
      for (const m of legal) { const sc = -abSearch(C.doMove(st, m), depth - 1, -Infinity, Infinity, kind); if (sc < bs) { bs = sc; best = m; } }
      log.push(C.toSAN(st, best)); st = C.doMove(st, best);
    }
  }
  return { mate: false, plies: maxMoves * 2, log, fen: C.toFEN(st) };
}
{
  const kq = ['8/8/8/4k3/8/8/8/K5Q1 w - - 0 1', '8/8/3k4/8/8/8/8/K5Q1 w - - 0 1', '7k/8/8/3K4/8/8/8/6Q1 w - - 0 1', '8/2k5/8/8/8/8/8/K6Q w - - 0 1'];
  for (const f of kq) { const r = playOut(f, 'Q', 5, 45); console.log('  KQvK ' + f.padEnd(32) + ' -> ' + (r.mate ? 'MATE after ' + Math.ceil(r.plies / 2) + ' white moves' : 'no mate in 45 (' + r.fen + ')') + ' :: ' + r.log.slice(0, 24).join(' ')); }
  const kr = ['8/8/8/4k3/8/8/8/K6R w - - 0 1', '8/8/3k4/8/8/8/8/K6R w - - 0 1', '7k/8/8/3K4/8/8/8/7R w - - 0 1'];
  for (const f of kr) { const r = playOut(f, 'R', 6, 45); console.log('  KRvK ' + f.padEnd(32) + ' -> ' + (r.mate ? 'MATE after ' + Math.ceil(r.plies / 2) + ' white moves' : 'no mate in 45 (' + r.fen + ')') + ' :: ' + r.log.slice(0, 30).join(' ')); }
}
console.log('');
console.log('===== I. Explicit KR vs K box-method line (ENDGAME2[6]) =====');
{
  let st = C.parseFEN('8/8/8/4k3/8/8/8/K6R w - - 0 1');
  const line = 'Rh5+ Kd4 Kb2 Kc4 Kc2 Kd4 Kd2 Ke4 Ke2 Kf4 Rf5+ Ke4 Rf1 Ke5 Ke3 Ke6 Re1+ Kd6 Kd4 Kc6 Rc1+ Kb6 Kc4 Kb7 Kb5 Ka7 Rc7+ Ka8 Kb6 Kb8 Rc1 Ka8 Rh1 Kb8 Rh8#';
  const sans = [];
  for (const tok of line.split(' ')) { const m = C.parseSAN(st, tok); if (!m || m.ambiguous) { sans.push('FAIL:' + tok); break; } sans.push(C.toSAN(st, m)); st = C.doMove(st, m); }
  console.log('  ' + sans.join(' '));
  console.log('  final mate: ' + C.inCheckmate(st, st.turn) + ' fen=' + C.toFEN(st));
}
