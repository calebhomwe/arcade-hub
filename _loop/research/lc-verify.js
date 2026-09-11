'use strict';
const fs = require('fs');
const C = require('./lc-chess.js');
const DATA = JSON.parse(fs.readFileSync(__dirname + '/lc-data.json', 'utf8'));
const R = { traps: [], acadTraps: [], openings: [], routes: [], puzzles: [], combos: [], notes: [] };

function tokenToMove(st, tok) {
  const t = String(tok).replace(/[!?]+$/, '');
  if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(t)) {
    const from = C.nameSq(t.slice(0,2)), to = C.nameSq(t.slice(2));
    const promo = t.length === 5 ? ({q:C.PT.QUEEN,r:C.PT.ROOK,b:C.PT.BISHOP,n:C.PT.KNIGHT})[t[4].toLowerCase()] : undefined;
    const legal = C.allLegal(st, st.turn).filter(m => m.from === from && m.to === to && (!promo || m.promo === promo));
    if (legal.length === 1) return legal[0];
    if (legal.length > 1) return legal[0];
    return null;
  }
  const m = C.parseSAN(st, t);
  if (m && m.ambiguous) return null;
  return m;
}

function replay(line, opts) {
  opts = opts || {};
  const st = C.parseFEN(opts.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const toks = String(line).split(/\s+/).filter(Boolean);
  const sans = [], plies = [];
  let stt = st;
  for (let i = 0; i < toks.length; i++) {
    const m = tokenToMove(stt, toks[i]);
    if (!m) {
      return { ok: false, badIndex: i, badToken: toks[i], sans, plies, fenBefore: C.toFEN(stt), state: stt,
               legal: C.allLegal(stt, stt.turn).map(x => C.toSAN(stt, x)) };
    }
    sans.push(C.toSAN(stt, m));
    plies.push(m);
    stt = C.doMove(stt, m);
  }
  const mover = 1 - stt.turn;
  return { ok: true, sans, plies, state: stt, moves: toks.length,
           mate: C.inCheckmate(stt, stt.turn), stalemate: C.isStalemate(stt, stt.turn),
           check: C.isInCheck(stt, stt.turn), lastMover: mover };
}

function claimedMatesIn(text) {
  const out = [];
  const re = /(\d+)\s*\.{0,3}\s*([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)\s*#/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push({ num: parseInt(m[1],10), san: m[2] });
  return out;
}

// ---------------- TRAPS (the parent's verified table) ----------------
DATA.TRAPS.forEach((t, i) => {
  const r = replay(t.moves);
  const row = { i, name: t.name, side: t.side, opening: t.opening, moves: t.moves, ok: r.ok,
                sans: r.sans.join(' '), mate: !!r.mate, stalemate: !!r.stalemate, check: !!r.check,
                punishClaimsMate: /#/.test(t.punish), punishMates: claimedMatesIn(t.punish) };
  if (!r.ok) { row.badIndex = r.badIndex; row.badToken = r.badToken; row.fenBefore = r.fenBefore; row.legal = r.legal; }
  R.traps.push(row);
});

// ---------------- ACADEMY.traps ----------------
(DATA.ACADEMY.traps || []).forEach((t, i) => {
  const r = replay(t.moves);
  R.acadTraps.push({ i, name: t.name, ok: r.ok, sans: r.sans.join(' '), mate: !!r.mate, check: !!r.check,
                     punishClaimsMate: /#/.test(t.punish || ''), punishMates: claimedMatesIn(t.punish || ''),
                     badIndex: r.badIndex, badToken: r.badToken, fenBefore: r.fenBefore, legal: r.legal });
});

// ---------------- ACADEMY.openings ----------------
(DATA.ACADEMY.openings || []).forEach((o, i) => {
  const r = replay(o.moves);
  R.openings.push({ i, name: o.name, ok: r.ok, plies: r.moves, sans: r.sans.join(' '),
                    badIndex: r.badIndex, badToken: r.badToken, fenBefore: r.fenBefore, legal: r.legal, fmt: /^[a-h][1-8][a-h][1-8]/.test(o.moves.split(' ')[0]) ? 'uci' : 'san' });
});

// ---------------- ROUTES ----------------
(DATA.ROUTES || []).forEach(b => b.lines.forEach((l, j) => {
  const cleaned = l.moves.replace(/\d+\.(\.\.)?/g, ' ').replace(/[!?]+/g,' ').trim();
  const r = replay(cleaned);
  R.routes.push({ branch: b.branch, name: l.name, moves: l.moves, ok: r.ok, sans: r.sans.join(' '),
                  badIndex: r.badIndex, badToken: r.badToken, fenBefore: r.fenBefore, legal: r.legal });
}));

// ---------------- PUZZLES ----------------
DATA.PUZZLES.forEach((p, i) => {
  const row = { i, fen: p.fen, desc: p.desc, solution: p.solution, type: p.type || '', hint: p.hint };
  let st;
  try { st = C.parseFEN(p.fen); } catch (e) { row.fenError = e.message; R.puzzles.push(row); return; }
  row.turn = st.turn === C.CL.WHITE ? 'w' : 'b';
  row.descTurn = /White to move/i.test(p.desc) ? 'w' : (/Black to move/i.test(p.desc) ? 'b' : '?');
  row.turnMatchesDesc = row.descTurn === '?' ? null : row.turn === row.descTurn;
  // material/legality sanity
  row.whiteKings = st.board.filter(x => x === C.P(C.PT.KING, C.CL.WHITE)).length;
  row.blackKings = st.board.filter(x => x === C.P(C.PT.KING, C.CL.BLACK)).length;
  row.sideNotToMoveInCheck = C.isInCheck(st, 1 - st.turn);
  row.alreadyMate = C.inCheckmate(st, st.turn);
  row.castlingRightsValid = ['K','Q','k','q'].every(k => !st.castling[k] || (() => {
    const col = k === 'K' || k === 'Q' ? C.CL.WHITE : C.CL.BLACK;
    const r = col === C.CL.WHITE ? 7 : 0;
    const kingThere = st.board[C.idx(r,4)] === C.P(C.PT.KING, col);
    const rookThere = st.board[C.idx(r, k === 'K' || k === 'k' ? 7 : 0)] === C.P(C.PT.ROOK, col);
    return kingThere && rookThere;
  })());
  const m = tokenToMove(st, p.solution);
  if (!m) {
    row.solutionLegal = false;
    row.legalMoves = C.allLegal(st, st.turn).map(x => C.toSAN(st, x));
  } else {
    row.solutionLegal = true;
    row.solutionSAN = C.toSAN(st, m);
    const after = C.doMove(st, m);
    row.afterCheck = C.isInCheck(after, after.turn);
    row.afterMate = C.inCheckmate(after, after.turn);
    row.afterStalemate = C.isStalemate(after, after.turn);
    row.claimsMate = /mate/i.test(p.desc) || p.type === 'mate1' || /#/.test(p.solution);
    row.claimsMate1 = p.type === 'mate1' || /mate in 1/i.test(p.desc);
    const caps = st.board[m.to] ? C.pType(st.board[m.to]) : 0;
    row.captureValue = caps ? ({1:'K',2:'Q',3:'R',4:'B',5:'N',6:'P'})[caps] : (m.ep ? 'P(ep)' : '-');
  }
  R.puzzles.push(row);
});

fs.writeFileSync(__dirname + '/lc-verify.json', JSON.stringify(R, null, 1));

// ---------------- PRINT ----------------
const line = s => console.log(s);
line('=== TRAPS table (' + R.traps.length + ') ===');
for (const t of R.traps) line((t.ok ? 'LEGAL ' : 'ILLEGAL') + ' | ' + t.name.padEnd(30) + ' | plies=' + t.sans.split(' ').length + ' | final=' + (t.mate ? 'MATE' : t.stalemate ? 'STALEMATE' : t.check ? 'check' : 'quiet') + ' | punish#=' + t.punishClaimsMate + (t.ok ? '' : ' | FAILED at ' + t.badToken + ' (#' + t.badIndex + ') fen=' + t.fenBefore));
line('--- sans ---');
for (const t of R.traps) line('  ' + t.name + ': ' + t.sans);
line('');
line('=== ACADEMY.traps (' + R.acadTraps.length + ') ===');
for (const t of R.acadTraps) line((t.ok ? 'LEGAL ' : 'ILLEGAL') + ' | ' + t.name.padEnd(32) + ' | final=' + (t.mate ? 'MATE' : t.check ? 'check' : 'quiet') + ' | punish#=' + t.punishClaimsMate + (t.ok ? '' : ' | FAILED at ' + t.badToken + ' (#' + t.badIndex + ') fen=' + t.fenBefore + ' legal=' + JSON.stringify(t.legal)));
line('');
line('=== ACADEMY.openings (' + R.openings.length + ') ===');
for (const o of R.openings) line((o.ok ? 'LEGAL ' : 'ILLEGAL') + ' | fmt=' + o.fmt + ' | ' + o.name.padEnd(38) + ' | plies=' + o.plies + (o.ok ? '' : ' | FAILED at ' + o.badToken + ' (#' + o.badIndex + ') fen=' + o.fenBefore + ' legal=' + JSON.stringify(o.legal)));
line('');
line('=== ROUTES (' + R.routes.length + ') ===');
for (const o of R.routes) line((o.ok ? 'LEGAL ' : 'ILLEGAL') + ' | ' + (o.branch + ' / ' + o.name).padEnd(45) + ' | ' + o.sans + (o.ok ? '' : ' | FAILED at ' + o.badToken + ' fen=' + o.fenBefore + ' legal=' + JSON.stringify(o.legal)));
line('');
line('=== PUZZLES (' + R.puzzles.length + ') ===');
for (const p of R.puzzles) {
  const flags = [];
  if (p.fenError) flags.push('FEN_ERROR:' + p.fenError);
  if (p.turnMatchesDesc === false) flags.push('TURN_MISMATCH(desc=' + p.descTurn + ' fen=' + p.turn + ')');
  if (p.whiteKings !== 1 || p.blackKings !== 1) flags.push('KINGS w=' + p.whiteKings + ' b=' + p.blackKings);
  if (p.sideNotToMoveInCheck) flags.push('SIDE_NOT_TO_MOVE_IN_CHECK');
  if (p.castlingRightsValid === false) flags.push('BAD_CASTLING_RIGHTS');
  if (p.solutionLegal === false) flags.push('SOLUTION_ILLEGAL');
  if (p.solutionLegal && p.claimsMate1 && !p.afterMate) flags.push('CLAIMS_MATE1_BUT_' + (p.afterMate ? 'MATE' : p.afterCheck ? 'CHECK_ONLY' : p.afterStalemate ? 'STALEMATE' : 'QUIET'));
  line((flags.length ? 'FLAG  ' : 'ok    ') + ' | #' + String(p.i).padStart(2) + ' ' + String(p.type || '-').padEnd(10) + ' ' + (p.solutionSAN || p.solution).padEnd(10) + ' | ' + (p.desc || '').slice(0, 58).padEnd(58) + (flags.length ? ' << ' + flags.join(';') : ''));
  if (flags.length) line('        fen=' + p.fen + '  legal=' + JSON.stringify(p.legalMoves || []));
}
