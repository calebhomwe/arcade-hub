#!/usr/bin/env node
// engine-extract.js - extracts the pure chess engine out of games/chess.html by
// source slicing (no hand-copying) and runs a perft/legality/FEN/game-end suite.
// Usage: node engine-extract.js [--perft-max=N] [--json] [--only=name,..]
'use strict';
const fs = require('fs');

const HTML = process.env.CHESS_HTML || 'C:/Users/caleb/AppData/Local/arcade-hub/games/chess.html';
const src = fs.readFileSync(HTML, 'utf8');
const BT = String.fromCharCode(96);

function matchBracket(s, i) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const open = s[i];
  const close = pairs[open];
  if (!close) throw new Error('not a bracket at ' + i);
  let depth = 0, inS = null, inLC = false, inBC = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j], n = s[j + 1];
    if (inLC) { if (c === '\n') inLC = false; continue; }
    if (inBC) { if (c === '*' && n === '/') { inBC = false; j++; } continue; }
    if (inS) { if (c === '\\') { j++; continue; } if (c === inS) inS = null; continue; }
    if (c === '/' && n === '/') { inLC = true; j++; continue; }
    if (c === '/' && n === '*') { inBC = true; j++; continue; }
    if (c === '"' || c === "'" || c === BT) { inS = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return j; }
  }
  throw new Error('unbalanced from ' + i);
}
function lineOf(index) { return src.slice(0, index).split('\n').length; }
function extractFunction(name) {
  const re = new RegExp('(?:^|\\n)function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('function not found: ' + name);
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  const parenIdx = src.indexOf('(', start);
  const bodyStart = src.indexOf('{', matchBracket(src, parenIdx));
  const bodyEnd = matchBracket(src, bodyStart);
  return { code: src.slice(start, bodyEnd + 1), line: lineOf(start) };
}
function extractConst(name) {
  const re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=');
  const m = re.exec(src);
  if (!m) throw new Error('const not found: ' + name);
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  const eq = src.indexOf('=', m.index);
  let depth = 0, inS = null, inLC = false, inBC = false, end = -1;
  for (let j = eq + 1; j < src.length; j++) {
    const c = src[j], n = src[j + 1];
    if (inLC) { if (c === '\n') inLC = false; continue; }
    if (inBC) { if (c === '*' && n === '/') { inBC = false; j++; } continue; }
    if (inS) { if (c === '\\') { j++; continue; } if (c === inS) inS = null; continue; }
    if (c === '/' && n === '/') { inLC = true; j++; continue; }
    if (c === '/' && n === '*') { inBC = true; j++; continue; }
    if (c === '"' || c === "'" || c === BT) { inS = c; continue; }
    if ('{[('.includes(c)) depth++;
    else if ('}])'.includes(c)) depth--;
    else if (c === ';' && depth === 0) { end = j; break; }
  }
  if (end < 0) throw new Error('no terminator for const ' + name);
  return { code: src.slice(start, end + 1), line: lineOf(start) };
}
function extractFenParser() {
  const marker = 'const parts = pz.fen.split';
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('loadPuzzle FEN parser marker not found');
  const endMarker = 'ep = idx(r, f); }';
  const j = src.indexOf(endMarker, i);
  if (j < 0) throw new Error('loadPuzzle FEN parser end marker not found');
  const code = src.slice(src.lastIndexOf('\n', i) + 1, j + endMarker.length);
  return { code, line: lineOf(i) };
}

const FN_NAMES = ['initBoard','cloneB','inB','idx','row','col','getPseudoMoves','isInCheck','applyMove',
  'getLegalMoves','getAllLegalMoves','makeMove','evaluate','minimax','findBestMove','sqName','moveToSAN',
  'positionKey','recordPosition','hasInsufficientMaterial','reconstructReviewMove','analyzeReviewEntry',
  '_parseMoveToken','puzzleAnswerMatches'];
const CONST_NAMES = ['PT','CL','P','pType','pColor','CH','VAL','PST','SAN_LETTER','PUZZLES'];

const meta = { functions: {}, consts: {} };
const parts = [];
for (const n of CONST_NAMES) { const e = extractConst(n); meta.consts[n] = e.line; parts.push(e.code); }
for (const n of FN_NAMES) { const e = extractFunction(n); meta.functions[n] = e.line; parts.push(e.code); }
const fenParser = extractFenParser();
const fenFn = 'function parseFenPage(pz) {\n' + fenParser.code + '\nreturn { board, turn, epTarget: ep, castlingRights: castling }; }';
const code = parts.join('\n') + '\n' + fenFn + '\nreturn {' + FN_NAMES.concat(CONST_NAMES).join(',') + ', parseFenPage};';
const E = new Function(code)();

const SQ = s => (8 - parseInt(s[1], 10)) * 8 + (s.charCodeAt(0) - 97);
const PT = E.PT, CL = E.CL, P = E.P, pType = E.pType, pColor = E.pColor;

function genAll(b, color, ep, cr) {
  const raw = E.getAllLegalMoves(b, color, ep, cr);
  const out = [];
  for (const m of raw) {
    if (m.promo) for (const pc of [PT.QUEEN, PT.ROOK, PT.BISHOP, PT.KNIGHT]) out.push(Object.assign({}, m, { promoPiece: pc }));
    else out.push(m);
  }
  return out;
}
function perft(b, color, ep, cr, depth) {
  const moves = genAll(b, color, ep, cr);
  if (depth <= 1) return moves.length;
  let n = 0;
  for (const m of moves) {
    const r = E.makeMove(b, m, { castlingRights: cr });
    n += perft(r.board, 1 - color, r.ep, r.castling, depth - 1);
  }
  return n;
}
function perftDiv(b, color, ep, cr, depth) {
  const out = [];
  for (const m of genAll(b, color, ep, cr)) {
    const r = E.makeMove(b, m, { castlingRights: cr });
    out.push({ move: E.sqName(m.from) + E.sqName(m.to), n: perft(r.board, 1 - color, r.ep, r.castling, depth - 1) });
  }
  return out;
}

const SUITE = [
  { name: 'startpos', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', exp: [20, 400, 8902, 197281, 4865609] },
  { name: 'kiwipete', fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', exp: [48, 2039, 97862, 4085603, 193690690] },
  { name: 'pos3-ep-pins', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', exp: [14, 191, 2812, 43238, 674624] },
  { name: 'pos4-promo-castle', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', exp: [6, 264, 9467, 422333, 15833292] },
  { name: 'pos5-promo-pins', fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', exp: [44, 1486, 62379, 2103487] },
  { name: 'pos6-quiet', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', exp: [46, 2079, 89890, 3894594] },
];

function refParseFen(fen) {
  const f = fen.trim().split(/\s+/);
  const b = new Array(64).fill(0);
  const ranks = f[0].split('/');
  const map = { k: PT.KING, q: PT.QUEEN, r: PT.ROOK, b: PT.BISHOP, n: PT.KNIGHT, p: PT.PAWN };
  const errors = [];
  if (ranks.length !== 8) errors.push('rank count ' + ranks.length);
  for (let r = 0; r < 8 && r < ranks.length; r++) {
    let c = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '9') { c += +ch; continue; }
      const t = map[ch.toLowerCase()];
      if (!t) { errors.push('bad piece char ' + ch); continue; }
      if (c > 7) { errors.push('rank ' + r + ' overflow'); break; }
      b[r * 8 + c] = P(t, ch === ch.toUpperCase() ? CL.WHITE : CL.BLACK);
      c++;
    }
    if (c !== 8) errors.push('rank ' + r + ' sums to ' + c);
  }
  const turn = f[1] === 'w' ? CL.WHITE : CL.BLACK;
  const cr = f[2] || '-';
  const castling = { K: cr.includes('K'), Q: cr.includes('Q'), k: cr.includes('k'), q: cr.includes('q') };
  let ep = null;
  if (f[3] && f[3] !== '-') ep = SQ(f[3]);
  const kings = { 0: 0, 1: 0 };
  for (let i = 0; i < 64; i++) if (b[i] && pType(b[i]) === PT.KING) kings[pColor(b[i])]++;
  if (kings[0] !== 1 || kings[1] !== 1) errors.push('kings w=' + kings[0] + ' b=' + kings[1]);
  return { board: b, turn, castling, ep, errors, fields: f.length };
}
function boardStr(b) { let s = ''; for (let i = 0; i < 64; i++) s += b[i] ? E.CH[b[i]] : '.'; return s; }
function fenFromBoard(b) {
  const out = [];
  for (let r = 0; r < 8; r++) {
    let s = '', e = 0;
    for (let c = 0; c < 8; c++) {
      const p = b[r * 8 + c];
      if (!p) { e++; continue; }
      if (e) { s += e; e = 0; }
      const L = '?kqrbnp'[pType(p)];
      s += pColor(p) === CL.WHITE ? L.toUpperCase() : L;
    }
    if (e) s += e;
    out.push(s);
  }
  return out.join('/');
}

const R = { source: HTML, lineMap: meta, fenParserLine: fenParser.line, perft: [], puzzles: [], gameEnd: [], review: [], hint: [], notes: [] };
const argv = process.argv.slice(2);
const MAXD = (() => { const a = argv.find(x => x.startsWith('--perft-max=')); return a ? +a.split('=')[1] : 4; })();
const only = (() => { const a = argv.find(x => x.startsWith('--only=')); return a ? a.split('=')[1].split(',') : null; })();

for (const t of SUITE) {
  if (only && !only.includes(t.name)) continue;
  const ref = refParseFen(t.fen);
  if (ref.errors.length) R.notes.push('SUITE FEN ' + t.name + ' bad: ' + ref.errors.join('; '));
  const row = { name: t.name, fen: t.fen, got: [], exp: [], ok: [], ms: [] };
  for (let d = 1; d <= Math.min(MAXD, t.exp.length); d++) {
    const t0 = Date.now();
    const n = perft(ref.board, ref.turn, ref.ep, ref.castling, d);
    row.ms.push(Date.now() - t0);
    row.got.push(n); row.exp.push(t.exp[d - 1]); row.ok.push(n === t.exp[d - 1]);
  }
  R.perft.push(row);
}
if (!only || only.includes('startpos-div')) {
  const ref = refParseFen(SUITE[0].fen);
  R.startposDiv2 = perftDiv(ref.board, ref.turn, ref.ep, ref.castling, 2).sort((a, b) => a.move < b.move ? -1 : 1);
}

R.puzzleCount = E.PUZZLES.length;
E.PUZZLES.forEach((pz, i) => {
  const got = E.parseFenPage(pz);
  const ref = refParseFen(pz.fen);
  const r = { i, desc: (pz.desc || '').slice(0, 60), fen: pz.fen, solution: pz.solution,
    turnOk: got.turn === ref.turn, castlingOk: JSON.stringify(got.castlingRights) === JSON.stringify(ref.castling),
    epOk: got.epTarget === ref.ep, boardOk: boardStr(got.board) === boardStr(ref.board),
    refErrors: ref.errors, pageEp: got.epTarget, refEp: ref.ep };
  r.allOk = r.turnOk && r.castlingOk && r.epOk && r.boardOk && ref.errors.length === 0;
  const b = got.board;
  r.checks = {};
  r.checks.pawnsOnBackRank = (() => { for (let i = 0; i < 8; i++) { const a = b[i], h = b[56 + i]; if (a && pType(a) === PT.PAWN) return true; if (h && pType(h) === PT.PAWN) return true; } return false; })();
  r.checks.sideNotToMoveInCheck = E.isInCheck(b, 1 - got.turn);
  r.checks.moverHasNoMoves = E.getAllLegalMoves(b, got.turn, got.epTarget, got.castlingRights).length === 0;
  const sol = String(pz.solution || '');
  if (/^[a-h][1-8][a-h][1-8]$/.test(sol)) {
    const m = { from: SQ(sol.slice(0, 2)), to: SQ(sol.slice(2)) };
    const legal = E.getAllLegalMoves(b, got.turn, got.epTarget, got.castlingRights);
    r.checks.solutionLegal = legal.some(x => x.from === m.from && x.to === m.to);
    const cand = legal.filter(x => x.from === m.from && x.to === m.to)[0];
    if (cand) {
      const after = E.makeMove(b, cand, { castlingRights: got.castlingRights });
      const opp = E.getAllLegalMoves(after.board, 1 - got.turn, after.ep, after.castling);
      r.checks.solutionIsMate = opp.length === 0 && E.isInCheck(after.board, 1 - got.turn);
    }
  } else if (/^[Oo0]-[Oo0](-[Oo0])?$/.test(sol)) {
    const legal = E.getAllLegalMoves(b, got.turn, got.epTarget, got.castlingRights);
    const want = sol.toUpperCase().replace(/0/g, 'O');
    r.checks.solutionLegal = legal.some(x => x.castle && (want === 'O-O' ? x.castle === 'kingside' : x.castle === 'queenside'));
  } else { r.checks.solutionLegal = null; r.checks.note = 'solution not from-to or castling form'; }
  R.puzzles.push(r);
});

const END = [
  { name: 'fools-mate', fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', expect: 'checkmate' },
  { name: 'back-rank-mate', fen: '4R1k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', expect: 'checkmate' },
  { name: 'classic-stalemate', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', expect: 'stalemate' },
  { name: 'stalemate-a1', fen: 'k7/8/1Q6/8/8/8/8/6K1 b - - 0 1', expect: 'stalemate' },
  { name: 'not-over', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', expect: 'open' },
  { name: 'kvk', fen: '8/8/4k3/8/8/4K3/8/8 w - - 0 1', expect: 'insufficient' },
  { name: 'kbvk', fen: '8/8/4k3/8/8/4K3/8/5B2 w - - 0 1', expect: 'insufficient' },
  { name: 'knvk', fen: '8/8/4k3/8/8/4K3/8/5N2 w - - 0 1', expect: 'insufficient' },
  { name: 'kbpvk', fen: '8/8/4k3/8/8/4K3/8/5P2 w - - 0 1', expect: 'open' },
  { name: 'kb-b-opposite-colours', fen: '8/8/4k3/8/8/4K3/8/2b2B2 w - - 0 1', expect: 'insufficient' },
  { name: 'kb-b-same-colour', fen: '4b3/8/4k3/8/8/4K3/8/5B2 w - - 0 1', expect: 'insufficient-gap' },
  { name: 'kbb-same-side-same-colour', fen: '2B5/8/4k3/8/8/4K3/8/5B2 w - - 0 1', expect: 'insufficient-gap' },
  { name: 'knvkn', fen: '8/8/4k3/8/8/4K3/8/4N1n1 w - - 0 1', expect: 'open' },
  { name: 'knnvk', fen: '8/8/4k3/8/8/4K3/8/4NN2 w - - 0 1', expect: 'open' },
];
for (const t of END) {
  const ref = refParseFen(t.fen);
  const moves = E.getAllLegalMoves(ref.board, ref.turn, ref.ep, ref.castling);
  let cls;
  if (moves.length === 0) cls = E.isInCheck(ref.board, ref.turn) ? 'checkmate' : 'stalemate';
  else if (E.hasInsufficientMaterial(ref.board)) cls = 'insufficient';
  else cls = 'open';
  R.gameEnd.push({ name: t.name, fen: t.fen, got: cls, expect: t.expect, ok: cls === t.expect, legalMoves: moves.length, refErrors: ref.errors });
}

{
  const cases = [];
  const boards = [
    { fen: '8/8/8/8/8/8/4k3/R3K2R w KQ - 0 1', why: 'white can castle both ways (control)' },
    { fen: '8/8/8/8/8/5k2/8/5K1R w - - 0 1', why: 'king f1, rook h1: Kf1-g1 is a normal king move' },
    { fen: '8/8/8/8/8/5k2/8/R2K4 w - - 0 1', why: 'king d1, rook a1: Kd1-c1 is a normal king move' },
    { fen: '5k1r/8/8/8/8/8/8/K7 b - - 0 1', why: 'black king f8, rook h8: Kf8-g8 normal' },
    { fen: 'r2k4/8/8/8/8/8/8/7K b - - 0 1', why: 'black king d8, rook a8: Kd8-c8 normal' },
    { fen: 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', why: 'black king e8, rooks a8/h8' },
  ];
  for (const c of boards) {
    const ref = refParseFen(c.fen);
    const legal = E.getAllLegalMoves(ref.board, ref.turn, ref.ep, ref.castling);
    for (const m of legal) {
      if (pType(ref.board[m.from]) !== PT.KING) continue;
      if (![2, 6, 58, 62].includes(m.to)) continue;
      const snap = { board: ref.board, castlingRights: ref.castling, epTarget: ref.ep };
      const re = E.reconstructReviewMove(snap, { from: m.from, to: m.to });
      const bogus = !!re.castle && !m.castle;
      if (bogus) cases.push({ fen: c.fen, why: c.why, move: E.sqName(m.from) + E.sqName(m.to),
        realMoveIsCastle: !!m.castle, reviewFlags: JSON.stringify(re),
        rookOnCorner: ref.board[m.to === 6 || m.to === 62 ? 63 : 56] ? 'yes' : 'no',
        boardAfterReviewMakeMove: fenFromBoard(E.makeMove(ref.board, re, { castlingRights: ref.castling }).board),
        boardAfterRealMakeMove: fenFromBoard(E.makeMove(ref.board, m, { castlingRights: ref.castling }).board) });
    }
  }
  R.review = cases;
}

{
  const bad = [];
  let tested = 0;
  function walk(fen, b, turn, ep, cr, depth) {
    if (depth === 0 || bad.length > 6) return;
    let best;
    try { best = E.findBestMove(b, turn, ep, cr, 2, 'balanced'); }
    catch (e) { bad.push({ fen, kind: 'crash', error: String(e && e.message) }); return; }
    if (!best) return;
    const legal = E.getAllLegalMoves(b, turn, ep, cr);
    if (!legal.some(m => m.from === best.from && m.to === best.to)) bad.push({ fen, kind: 'illegal-hint', move: E.sqName(best.from) + E.sqName(best.to) });
    tested++;
    const r = E.makeMove(b, best, { castlingRights: cr });
    const next = E.getAllLegalMoves(r.board, 1 - turn, r.ep, r.castling);
    if (next.length) {
      const pick = next[Math.floor(next.length / 2)];
      const r2 = E.makeMove(r.board, pick, { castlingRights: r.castling });
      walk(fen, r2.board, turn, r2.ep, r2.castling, depth - 1);
    }
  }
  for (const t of [SUITE[1], SUITE[4], SUITE[3]]) walk(t.fen, refParseFen(t.fen).board, refParseFen(t.fen).turn, refParseFen(t.fen).ep, refParseFen(t.fen).castling, 3);
  R.hint = { positionsTested: tested, problems: bad };
}

if (argv.includes('--json')) process.stdout.write(JSON.stringify(R, null, 1));
else {
  const L = [];
  L.push('== engine-extract: ' + HTML);
  L.push('const lines: ' + JSON.stringify(meta.consts));
  L.push('fn lines: ' + JSON.stringify(meta.functions));
  L.push('FEN parser (loadPuzzle) at line ' + fenParser.line);
  L.push('');
  L.push('-- PERFT --');
  for (const r of R.perft) L.push(r.name.padEnd(18) + ' exp ' + JSON.stringify(r.exp) + ' got ' + JSON.stringify(r.got) + ' ok ' + JSON.stringify(r.ok) + ' ms ' + JSON.stringify(r.ms));
  L.push('');
  L.push('-- PUZZLES (' + R.puzzleCount + ') --');
  const badP = R.puzzles.filter(p => !p.allOk || p.checks.solutionLegal === false || p.checks.sideNotToMoveInCheck || p.checks.pawnsOnBackRank || p.checks.moverHasNoMoves || p.checks.solutionIsMate === false);
  L.push('parse-clean: ' + R.puzzles.filter(p => p.allOk).length + '/' + R.puzzles.length + '; flagged: ' + badP.length);
  for (const p of badP) L.push('  #' + p.i + ' ' + JSON.stringify({ fen: p.fen, solution: p.solution, turnOk: p.turnOk, castlingOk: p.castlingOk, epOk: p.epOk, boardOk: p.boardOk, refErrors: p.refErrors, checks: p.checks }));
  L.push('');
  L.push('-- GAME END --');
  for (const g of R.gameEnd) L.push('  ' + (g.ok ? 'ok  ' : 'FAIL') + ' ' + g.name.padEnd(32) + ' got ' + g.got + ' expect ' + g.expect + (g.refErrors.length ? ' refErrors=' + JSON.stringify(g.refErrors) : ''));
  L.push('');
  L.push('-- REVIEW reconstruction bogus-castle cases: ' + R.review.length + ' --');
  for (const c of R.review) L.push('  ' + JSON.stringify(c));
  L.push('');
  L.push('-- HINT depth2: tested ' + R.hint.positionsTested + ' problems ' + R.hint.problems.length + ' --');
  for (const p of R.hint.problems) L.push('  ' + JSON.stringify(p));
  if (R.notes.length) L.push('NOTES: ' + R.notes.join(' | '));
  console.log(L.join('\n'));
}
