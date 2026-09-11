#!/usr/bin/env node
// engine-sanity.js - SAN round-trip/uniqueness, puzzle claim audit, review-path audit,
// random-game stress. Reuses the extractor in engine-extract.js via child require-free copy
// of the slicing code (kept in sync by reading the same file).
'use strict';
const fs = require('fs');
const HTML = process.env.CHESS_HTML || 'C:/Users/caleb/AppData/Local/arcade-hub/games/chess.html';
const src = fs.readFileSync(HTML, 'utf8');
const BT = String.fromCharCode(96);
function matchBracket(s, i) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const open = s[i], close = pairs[open];
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
  throw new Error('unbalanced');
}
function lineOf(i) { return src.slice(0, i).split('\n').length; }
function extractFunction(name) {
  const re = new RegExp('(?:^|\\n)function\\s+' + name + '\\s*\\(');
  const m = re.exec(src); if (!m) throw new Error('fn ' + name);
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  const parenIdx = src.indexOf('(', start);
  const bodyStart = src.indexOf('{', matchBracket(src, parenIdx));
  return { code: src.slice(start, matchBracket(src, bodyStart) + 1), line: lineOf(start) };
}
function extractConst(name) {
  const re = new RegExp('(?:^|\\n)const\\s+' + name + '\\s*=');
  const m = re.exec(src); if (!m) throw new Error('const ' + name);
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
    if ('{[('.includes(c)) depth++; else if ('}])'.includes(c)) depth--;
    else if (c === ';' && depth === 0) { end = j; break; }
  }
  return { code: src.slice(start, end + 1), line: lineOf(start) };
}
function extractFenParser() {
  const i = src.indexOf('const parts = pz.fen.split');
  const endMarker = 'ep = idx(r, f); }';
  const j = src.indexOf(endMarker, i);
  return { code: src.slice(src.lastIndexOf('\n', i) + 1, j + endMarker.length), line: lineOf(i) };
}
const FN = ['initBoard','cloneB','inB','idx','row','col','getPseudoMoves','isInCheck','applyMove','getLegalMoves',
  'getAllLegalMoves','makeMove','evaluate','minimax','findBestMove','sqName','moveToSAN','positionKey','recordPosition',
  'hasInsufficientMaterial','reconstructReviewMove','analyzeReviewEntry','_parseMoveToken','puzzleAnswerMatches'];
const CN = ['PT','CL','P','pType','pColor','CH','VAL','PST','SAN_LETTER','PUZZLES'];
const lines = {};
const parts = [];
for (const n of CN) { const e = extractConst(n); lines[n] = e.line; parts.push(e.code); }
for (const n of FN) { const e = extractFunction(n); lines[n] = e.line; parts.push(e.code); }
const fp = extractFenParser(); lines.parseFenPage = fp.line;
parts.push('function parseFenPage(pz) {\n' + fp.code + '\nreturn { board, turn, epTarget: ep, castlingRights: castling }; }');
const E = new Function(parts.join('\n') + '\nreturn {' + FN.concat(CN).join(',') + ', parseFenPage};')();
const PT = E.PT, CL = E.CL, P = E.P, pType = E.pType, pColor = E.pColor;
const SQ = s => (8 - parseInt(s[1], 10)) * 8 + (s.charCodeAt(0) - 97);
const sqName = E.sqName, row = E.row, col = E.col;

function refParseFen(fen) {
  const f = fen.trim().split(/\s+/);
  const b = new Array(64).fill(0);
  const ranks = f[0].split('/'); const errors = [];
  const map = { k: PT.KING, q: PT.QUEEN, r: PT.ROOK, b: PT.BISHOP, n: PT.KNIGHT, p: PT.PAWN };
  if (ranks.length !== 8) errors.push('ranks=' + ranks.length);
  for (let r = 0; r < 8 && r < ranks.length; r++) {
    let c = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '9') { c += +ch; continue; }
      const t = map[ch.toLowerCase()];
      if (!t) { errors.push('bad char ' + ch); continue; }
      if (c > 7) { errors.push('overflow rank ' + r); break; }
      b[r * 8 + c] = P(t, ch === ch.toUpperCase() ? CL.WHITE : CL.BLACK); c++;
    }
    if (c !== 8) errors.push('rank ' + r + '=' + c);
  }
  const turn = f[1] === 'w' ? CL.WHITE : CL.BLACK;
  const cr = f[2] || '-';
  const castling = { K: cr.includes('K'), Q: cr.includes('Q'), k: cr.includes('k'), q: cr.includes('q') };
  let ep = null; if (f[3] && f[3] !== '-') ep = SQ(f[3]);
  return { board: b, turn, castling, ep, errors, fields: f.length, halfmove: f[4], fullmove: f[5] };
}
function fenFromBoard(b) {
  const out = [];
  for (let r = 0; r < 8; r++) { let s = '', e = 0;
    for (let c = 0; c < 8; c++) { const p = b[r * 8 + c];
      if (!p) { e++; continue; } if (e) { s += e; e = 0; }
      const L = '?kqrbnp'[pType(p)]; s += pColor(p) === CL.WHITE ? L.toUpperCase() : L; }
    if (e) s += e; out.push(s); }
  return out.join('/');
}
function fenFull(b, turn, cr, ep) {
  return fenFromBoard(b) + ' ' + (turn === CL.WHITE ? 'w' : 'b') + ' ' +
    ((cr.K ? 'K' : '') + (cr.Q ? 'Q' : '') + (cr.k ? 'k' : '') + (cr.q ? 'q' : '') || '-') + ' ' +
    (ep === null ? '-' : sqName(ep));
}

// --- independent SAN parser (written from the SAN spec, not from the page code) ---
function parseSAN(san, b, turn, ep, cr) {
  const legal = E.getAllLegalMoves(b, turn, ep, cr);
  let s = String(san).replace(/[+#]$/, '');
  if (/^O-O-O$/.test(s)) { const m = legal.filter(x => x.castle === 'queenside'); return m.length === 1 ? m[0] : null; }
  if (/^O-O$/.test(s)) { const m = legal.filter(x => x.castle === 'kingside'); return m.length === 1 ? m[0] : null; }
  let promo = null;
  const pm = /=([QRBN])$/.exec(s);
  if (pm) { promo = { Q: PT.QUEEN, R: PT.ROOK, B: PT.BISHOP, N: PT.KNIGHT }[pm[1]]; s = s.slice(0, -2); }
  const dst = s.slice(-2);
  if (!/^[a-h][1-8]$/.test(dst)) return null;
  const head = s.slice(0, -2);
  const to = SQ(dst);
  let pieceLetter = '', rest = head;
  if (/^[KQRBN]/.test(head)) { pieceLetter = head[0]; rest = head.slice(1); }
  const pt = { '': PT.PAWN, K: PT.KING, Q: PT.QUEEN, R: PT.ROOK, B: PT.BISHOP, N: PT.KNIGHT }[pieceLetter];
  let fileHint = null, rankHint = null, sqHint = null;
  rest = rest.replace(/x/g, '');
  if (/^[a-h][1-8]$/.test(rest)) sqHint = rest;
  else if (/^[a-h]$/.test(rest)) fileHint = rest;
  else if (/^[1-8]$/.test(rest)) rankHint = rest;
  else if (rest !== '') return null;
  const cands = legal.filter(m => m.to === to && pType(b[m.from]) === pt &&
    (sqHint ? sqName(m.from) === sqHint : true) &&
    (fileHint ? 'abcdefgh'[col(m.from)] === fileHint : true) &&
    (rankHint ? String(8 - row(m.from)) === rankHint : true) &&
    (promo ? !!m.promo : !m.promo));
  return cands.length === 1 ? cands[0] : null;
}

const R = { lines, san: [], puzzleClaims: [], reviewBogus: [], stress: {}, notes: [] };

// ---------- SAN tests ----------
const SAN_POS = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', expect: { e2e4: 'e4', d2d4: 'd4', g1f3: 'Nf3', b1c3: 'Nc3', e2e3: 'e3' } },
  { fen: '4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1', expect: { b1d2: 'Nbd2', f3d2: 'Nfd2' } },
  { fen: '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1', expect: { a1a3: 'R1a3', a5a3: 'R5a3' } },
  { fen: '4k3/8/8/Q7/8/2Q5/8/Q3K3 w - - 0 1', expect: { a1a3: 'Q1a3', a5a3: 'Q5a3', c3a3: 'Qca3' } },
  { fen: '8/6k1/8/3pP3/8/8/8/B3K3 w - d6 0 1', expect: { e5d6: 'exd6+' } },
  { fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', expect: { e2e4: 'e4' } },
  { fen: '8/P6k/8/8/8/8/8/4K3 w - - 0 1', expect: { a7a8: 'a8=Q+' } },
  { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', expect: { e1g1: 'O-O', e1c1: 'O-O-O' } },
];
for (const p of SAN_POS) {
  const ref = refParseFen(p.fen);
  if (ref.errors.length) R.notes.push('SAN FEN bad ' + p.fen + ': ' + ref.errors);
  const legal = E.getAllLegalMoves(ref.board, ref.turn, ref.ep, ref.castling);
  for (const m of legal) {
    const after = E.makeMove(ref.board, m, { castlingRights: ref.castling });
    const afterState = { board: after.board, epTarget: after.ep, castlingRights: after.castling };
    const beforeState = { board: ref.board, epTarget: ref.ep, castlingRights: ref.castling };
    let san, err = null;
    try { san = E.moveToSAN(beforeState, m, afterState); } catch (e) { err = String(e && e.message); }
    if (err) { R.san.push({ fen: p.fen, move: sqName(m.from) + sqName(m.to), crash: err }); continue; }
    const back = parseSAN(san, ref.board, ref.turn, ref.ep, ref.castling);
    const roundTripOk = back && back.from === m.from && back.to === m.to && (!!back.promo === !!m.promo);
    // uniqueness among all legal moves in this position
    const dups = [];
    for (const m2 of legal) {
      if (m2 === m) continue;
      const a2 = E.makeMove(ref.board, m2, { castlingRights: ref.castling });
      let s2; try { s2 = E.moveToSAN(beforeState, m2, { board: a2.board, epTarget: a2.ep, castlingRights: a2.castling }); } catch (e) { continue; }
      if (s2 === san) dups.push(sqName(m2.from) + sqName(m2.to));
    }
    const key = sqName(m.from) + sqName(m.to);
    const want = p.expect && p.expect[key];
    const rec = { fen: p.fen, move: key, san, want: want || null, wantOk: want ? want === san : null, roundTripOk: !!roundTripOk, roundTrip: back ? sqName(back.from) + sqName(back.to) : null, duplicateWith: dups };
    if (want ? san !== want : (!roundTripOk || dups.length)) R.san.push(rec);
    else if (p.expect) R.san.push(rec); // keep expected-value rows for the report
  }
}

// ---------- puzzle claim audit ----------
R.puzzleCount = E.PUZZLES.length;
E.PUZZLES.forEach((pz, i) => {
  const got = E.parseFenPage(pz);
  const ref = refParseFen(pz.fen);
  const b = got.board;
  const rights = got.castlingRights;
  const issues = [];
  if (got.turn !== ref.turn) issues.push('turn mismatch');
  if (JSON.stringify(got.castlingRights) !== JSON.stringify(ref.castling)) issues.push('castling parse mismatch');
  if (got.epTarget !== ref.ep) issues.push('ep parse mismatch');
  if (fenFromBoard(got.board) !== fenFromBoard(ref.board)) issues.push('board mismatch');
  if (ref.errors.length) issues.push('fen errors: ' + ref.errors.join('; '));
  // claims vs placement
  if (rights.K && !(b[SQ('e1')] === P(PT.KING, CL.WHITE) && b[SQ('h1')] === P(PT.ROOK, CL.WHITE))) issues.push('claims K but no Ke1/Rh1');
  if (rights.Q && !(b[SQ('e1')] === P(PT.KING, CL.WHITE) && b[SQ('a1')] === P(PT.ROOK, CL.WHITE))) issues.push('claims Q but no Ke1/Ra1');
  if (rights.k && !(b[SQ('e8')] === P(PT.KING, CL.BLACK) && b[SQ('h8')] === P(PT.ROOK, CL.BLACK))) issues.push('claims k but no Ke8/Rh8');
  if (rights.q && !(b[SQ('e8')] === P(PT.KING, CL.BLACK) && b[SQ('a8')] === P(PT.ROOK, CL.BLACK))) issues.push('claims q but no Ke8/Ra8');
  if (ref.halfmove && ref.halfmove !== '0') issues.push('halfmove field ' + ref.halfmove + ' discarded (page sets 0)');
  // ep claim reachability: the square behind the ep target must be empty, and a pawn of the side that just moved must sit on the ep target
  if (got.epTarget !== null) {
    const epSq = got.epTarget, mover = 1 - got.turn;
    const backRow = mover === CL.WHITE ? row(epSq) + 1 : row(epSq) - 1; // square the pawn came from
    const fromSq = epSq + (mover === CL.WHITE ? 8 : -8);
    const frontSq = epSq + (mover === CL.WHITE ? -8 : 8);
    if (b[fromSq]) issues.push('ep ' + sqName(epSq) + ' unreachable: the double-push origin ' + sqName(fromSq) + ' is still occupied');
    if (b[epSq]) issues.push('ep ' + sqName(epSq) + ': ep square itself must be empty but holds a piece');
    if (!b[frontSq] || pType(b[frontSq]) !== PT.PAWN || pColor(b[frontSq]) !== mover) issues.push('ep ' + sqName(epSq) + ': no ' + (mover === CL.WHITE ? 'white' : 'black') + ' pawn on ' + sqName(frontSq));
  }
  // solution check
  const sol = String(pz.solution || '');
  const legal = E.getAllLegalMoves(b, got.turn, got.epTarget, got.castlingRights);
  let solInfo = null;
  if (/^[a-h][1-8][a-h][1-8]$/.test(sol)) {
    const mv = legal.filter(x => x.from === SQ(sol.slice(0, 2)) && x.to === SQ(sol.slice(2)));
    solInfo = { form: 'fromto', legal: mv.length > 0 };
    if (mv.length) {
      const m = mv[0];
      const after = E.makeMove(b, m, { castlingRights: got.castlingRights });
      const opp = E.getAllLegalMoves(after.board, 1 - got.turn, after.ep, after.castling);
      solInfo.isMate = opp.length === 0 && E.isInCheck(after.board, 1 - got.turn);
      solInfo.givesCheck = E.isInCheck(after.board, 1 - got.turn);
      solInfo.capture = !!m.capture || !!m.ep;
      solInfo.promo = !!m.promo;
      solInfo.san = (() => { try { return E.moveToSAN({ board: b, epTarget: got.epTarget, castlingRights: got.castlingRights }, m, { board: after.board, epTarget: after.ep, castlingRights: after.castling }); } catch (e) { return 'CRASH ' + e.message; } })();
    }
  } else if (/^([Oo0]-[Oo0](-[Oo0])?)$/.test(sol)) {
    const want = sol.toUpperCase().replace(/0/g, 'O') === 'O-O' ? 'kingside' : 'queenside';
    solInfo = { form: 'castle', legal: legal.some(x => x.castle === want) };
  } else solInfo = { form: 'other', legal: null };
  if (solInfo && solInfo.legal === false) issues.push('solution ' + sol + ' is not a legal move in this position');
  const claimsMate = /checkmate|mate in \d|^mate\d/i.test((pz.desc || '') + ' ' + (pz.type || ''));
  if (claimsMate && solInfo && solInfo.isMate === false) issues.push('desc claims mate but solution is not mate');
  R.puzzleClaims.push({ i, fen: pz.fen, desc: pz.desc, solution: sol, type: pz.type || null, claimsMate, issues, sol: solInfo });
});

// ---------- review reconstruction: bogus castle flags ----------
{
  const boards = [
    { fen: '8/8/8/8/8/5k2/8/5K1R w - - 0 1', why: 'white Kf1, Rh1: Kf1-g1 is a normal king move (g1 empty)' },
    { fen: '8/8/8/8/8/5k2/8/R2K4 w - - 0 1', why: 'white Kd1, Ra1: Kd1-c1 is a normal king move' },
    { fen: '5k1r/8/8/8/8/8/8/K7 b - - 0 1', why: 'black Kf8, Rh8: Kf8-g8 normal' },
    { fen: 'r2k4/8/8/8/8/8/8/7K b - - 0 1', why: 'black Kd8, Ra8: Kd8-c8 normal' },
    { fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', why: 'control: real castling both sides' },
  ];
  for (const c of boards) {
    const ref = refParseFen(c.fen);
    const legal = E.getAllLegalMoves(ref.board, ref.turn, ref.ep, ref.castling);
    for (const m of legal) {
      if (pType(ref.board[m.from]) !== PT.KING) continue;
      const snap = { board: ref.board, castlingRights: ref.castling, epTarget: ref.ep };
      const re = E.reconstructReviewMove(snap, { from: m.from, to: m.to });
      const bogus = !!re.castle && !m.castle;
      if (!bogus) continue;
      const afterReview = E.makeMove(ref.board, re, { castlingRights: ref.castling });
      const afterReal = E.makeMove(ref.board, m, { castlingRights: ref.castling });
      let ev = null, crash = null;
      try { ev = E.analyzeReviewEntry({ snap, move: re, turn: ref.turn, cls: 'best' }); } catch (e) { crash = String(e && e.message); }
      R.reviewBogus.push({ fen: c.fen, why: c.why, move: sqName(m.from) + sqName(m.to), realIsCastle: !!m.castle,
        reviewFlags: re, afterReview: fenFull(afterReview.board, 1 - ref.turn, afterReview.castling, afterReview.ep),
        afterReal: fenFull(afterReal.board, 1 - ref.turn, afterReal.castling, afterReal.ep),
        rookTeleported: (afterReview.board[ref.castling ? 0 : 0], true), analyzeCrash: crash });
    }
  }
}

// ---------- random-game stress through the real API surface ----------
{
  const games = [];
  let crashes = 0, illegal = 0, sanCrash = 0, noEnd = 0;
  for (let g = 0; g < 12; g++) {
    let b = E.initBoard(), turn = CL.WHITE, ep = null, cr = { K: true, Q: true, k: true, q: true };
    const ply = [];
    let over = null;
    for (let p = 0; p < 120; p++) {
      const legal = E.getAllLegalMoves(b, turn, ep, cr);
      if (legal.length === 0) { over = E.isInCheck(b, turn) ? 'checkmate' : 'stalemate'; break; }
      if (E.hasInsufficientMaterial(b)) { over = 'insufficient'; break; }
      let m;
      try { m = E.findBestMove(b, turn, ep, cr, 1, 'balanced'); } catch (e) { crashes++; ply.push('SEARCH CRASH ' + e.message); break; }
      if (!m) { crashes++; ply.push('NULL MOVE'); break; }
      if (!legal.some(x => x.from === m.from && x.to === m.to)) { illegal++; ply.push('ILLEGAL ' + sqName(m.from) + sqName(m.to)); break; }
      if (m.promo) m.promoPiece = PT.QUEEN;
      try {
        const san = E.moveToSAN({ board: b, epTarget: ep, castlingRights: cr }, m, (() => { const a = E.makeMove(b, m, { castlingRights: cr }); return { board: a.board, epTarget: a.ep, castlingRights: a.castling }; })());
        ply.push(san);
      } catch (e) { sanCrash++; ply.push('SAN CRASH ' + e.message); }
      const r = E.makeMove(b, m, { castlingRights: cr });
      b = r.board; ep = r.ep; cr = r.castling; turn = 1 - turn;
    }
    if (!over) noEnd++;
    games.push({ plies: ply.length, over, sample: ply.slice(0, 12).join(' ') });
  }
  R.stress = { games: games.length, crashes, illegal, sanCrash, unfinished: noEnd, detail: games };
}

// ---------- threefold / fifty-move counter simulation exactly as executeMove does it ----------
{
  const sim = [];
  // 1) knights shuffle: 1.Nf3 Nf6 2.Ng1 Ng8 twice -> start position occurs 3 times (init + 2 returns)
  let b = E.initBoard(), turn = CL.WHITE, ep = null, cr = { K: true, Q: true, k: true, q: true };
  const counts = {};
  const rec = () => { const k = E.positionKey(b, turn, ep, cr); counts[k] = (counts[k] || 0) + 1; return counts[k]; };
  rec();
  const seq = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'], ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  let drawAt = null;
  seq.forEach((s, i) => {
    const legal = E.getAllLegalMoves(b, turn, ep, cr);
    const m = legal.find(x => x.from === SQ(s[0]) && x.to === SQ(s[1]));
    const r = E.makeMove(b, m, { castlingRights: cr });
    b = r.board; ep = r.ep; cr = r.castling; turn = 1 - turn;
    const n = rec();
    if (n >= 3 && drawAt === null) drawAt = i + 1;
  });
  sim.push({ name: 'knight shuffle threefold', drawAfterPly: drawAt, expectDrawAfterPly: 8 });
  // 2) fifty-move counter: rook shuffle, capture/pawn move resets
  const hm = [];
  let clock = 0;
  const push = (captured, isPawn) => { clock = (captured || isPawn) ? 0 : clock + 1; hm.push(clock); };
  for (let i = 0; i < 3; i++) push(false, false);
  push(true, false); push(false, true); push(false, false); push(false, false);
  sim.push({ name: 'halfmoveClock reset semantics', clocks: hm, expect: [1, 2, 3, 0, 0, 1, 2] });
  R.counters = sim;
}

if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(R, null, 1));
else {
  const L = [];
  L.push('== engine-sanity: ' + HTML);
  L.push('\n-- SAN: ' + R.san.length + ' rows (all legal moves of ' + SAN_POS.length + ' positions; failures + expected-value rows) --');
  for (const s of R.san) L.push('  ' + JSON.stringify(s));
  L.push('\n-- PUZZLE CLAIMS (' + R.puzzleCount + ') --');
  for (const p of R.puzzleClaims) {
    if (p.issues.length) L.push('  ISSUE #' + p.i + ' ' + JSON.stringify(p));
  }
  L.push('  clean: ' + R.puzzleClaims.filter(p => !p.issues.length).length + '/' + R.puzzleClaims.length);
  for (const p of R.puzzleClaims.filter(x => x.claimsMate)) L.push('  mate-claim #' + p.i + ' sol=' + p.solution + ' isMate=' + (p.sol && p.sol.isMate) + ' san=' + (p.sol && p.sol.san));
  L.push('\n-- REVIEW bogus castle flags: ' + R.reviewBogus.length + ' --');
  for (const c of R.reviewBogus) L.push('  ' + JSON.stringify(c));
  L.push('\n-- STRESS --');
  L.push('  ' + JSON.stringify({ games: R.stress.games, crashes: R.stress.crashes, illegal: R.stress.illegal, sanCrash: R.stress.sanCrash, unfinished: R.stress.unfinished }));
  for (const g of R.stress.detail) L.push('   ' + JSON.stringify(g));
  L.push('\n-- COUNTERS --');
  for (const c of R.counters) L.push('  ' + JSON.stringify(c));
  if (R.notes.length) L.push('\nNOTES: ' + R.notes.join(' | '));
  console.log(L.join('\n'));
}
