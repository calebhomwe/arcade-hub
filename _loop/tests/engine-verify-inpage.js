// engine-verify-inpage.js - runs INSIDE games/chess.html via CDP Runtime.evaluate.
// Uses only the page's engine functions (getAllLegalMoves / makeMove / isInCheck /
// evaluate / minimax / findBestMove) plus an independent FEN parser, an independent
// full-width minimax, an independent alpha-beta, and independent RNG-driven position
// generation written here. Reported as a JSON object by __ENGINE_VERIFY__().
function __ENGINE_VERIFY__() {
  const T0 = performance.now();
  const RESULT = {};

  // --- piece encoding, re-derived here (page PT: K1 Q2 R3 B4 N5 P6; colour bit 3) ---
  const K = 1, QU = 2, RO = 3, BI = 4, KN = 5, PA = 6;
  const WHITE = 0, BLACK = 1;
  const PIECE = (t, c) => (c << 3) | t;
  const pType = p => p & 7;
  const pColor = p => (p >> 3) & 1;
  const idx = (r, c) => r * 8 + c;
  const row = i => i >> 3, col = i => i & 7;

  RESULT.page_function_visibility = {
    getPseudoMoves: typeof getPseudoMoves,
    getLegalMoves: typeof getLegalMoves,
    getAllLegalMoves: typeof getAllLegalMoves,
    isInCheck: typeof isInCheck,
    makeMove: typeof makeMove,
    evaluate: typeof evaluate,
    minimax: typeof minimax,
    findBestMove: typeof findBestMove,
    positionKey: typeof positionKey,
    initBoard: typeof initBoard,
    PT: typeof PT,
    CL: typeof CL,
    PST: typeof PST,
    VAL: typeof VAL
  };

  // ---------------- independent FEN parsing / formatting ----------------
  const LET = 'kqrbnp';
  function parseFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('bad FEN rows: ' + fen);
    const b = new Array(64).fill(0);
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') { c += +ch; continue; }
        const lo = ch.toLowerCase();
        const t = lo === 'k' ? K : lo === 'q' ? QU : lo === 'r' ? RO : lo === 'b' ? BI : lo === 'n' ? KN : PA;
        b[idx(r, c)] = PIECE(t, ch === lo ? BLACK : WHITE);
        c++;
      }
      if (c !== 8) throw new Error('bad FEN row width: ' + fen);
    }
    const crStr = parts[2] || '-';
    const cr = { K: crStr.indexOf('K') >= 0, Q: crStr.indexOf('Q') >= 0, k: crStr.indexOf('k') >= 0, q: crStr.indexOf('q') >= 0 };
    let ep = null;
    if (parts[3] && parts[3] !== '-') ep = idx(8 - Number(parts[3][1]), parts[3].charCodeAt(0) - 97);
    return { b, turn: parts[1] === 'w' ? WHITE : BLACK, cr, ep };
  }
  function toFEN(b, turn, cr, ep) {
    let s = '';
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let c = 0; c < 8; c++) {
        const p = b[idx(r, c)];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const lo = LET[pType(p) - 1];
        s += pColor(p) === WHITE ? lo.toUpperCase() : lo;
      }
      if (e) s += e;
      if (r < 7) s += '/';
    }
    let crs = (cr.K ? 'K' : '') + (cr.Q ? 'Q' : '') + (cr.k ? 'k' : '') + (cr.q ? 'q' : '');
    if (!crs) crs = '-';
    let eps = '-';
    if (ep !== null) eps = String.fromCharCode(97 + col(ep)) + (8 - row(ep));
    return s + ' ' + (turn === WHITE ? 'w' : 'b') + ' ' + crs + ' ' + eps + ' - -';
  }

  // ---------------- perft (own recursive counter) ----------------
  function perft(b, turn, ep, cr, d) {
    const moves = getAllLegalMoves(b, turn, ep, cr);
    if (d === 1) return moves.length;
    let n = 0;
    for (const m of moves) {
      const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
      n += perft(nx.board, 1 - turn, nx.ep, nx.castling, d - 1);
    }
    return n;
  }

  const PERFT_SUITE = [
    ['startpos', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
    ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
  ];
  const perftRows = [], perftBad = [];
  let perftNodes = 0;
  const pt0 = performance.now();
  for (const [name, fen, want] of PERFT_SUITE) {
    const st = parseFEN(fen);
    want.forEach((w, i) => {
      const d = i + 1;
      const got = perft(st.b, st.turn, st.ep, st.cr, d);
      perftNodes += got;
      const ok = got === w;
      perftRows.push({ name, depth: d, got, want: w, ok });
      if (!ok) perftBad.push(name + ' d' + d + ' got ' + got + ' want ' + w);
    });
  }
  RESULT.perft = {
    rows: perftRows,
    nodes: perftNodes,
    ms: Math.round(performance.now() - pt0),
    failures: perftBad,
    pass: perftBad.length === 0
  };

  // ---------------- independent full-width minimax + own alpha-beta ----------------
  // Terminal/mate scoring deliberately mirrors the page's minimax so scores are comparable.
  function mateScore(depth, isMax) { return isMax ? -99999 + (3 - depth) * 100 : 99999 - (3 - depth) * 100; }

  // Mirrors the page's depth-0 terminal rule: a leaf whose side to move is in check with no
  // legal reply is mate (the page added this so shallow searches can see mate in one).
  function leafScore(b, color, ep, cr, isMax, depth, personality) {
    if (isInCheck(b, color)) {
      if (getAllLegalMoves(b, color, ep, cr).length === 0) return mateScore(depth, isMax);
    }
    return evaluate(b, personality);
  }

  function fullWidth(b, depth, color, ep, cr, isMax, personality) {
    if (depth === 0) return leafScore(b, color, ep, cr, isMax, 0, personality);
    const moves = getAllLegalMoves(b, color, ep, cr);
    if (moves.length === 0) return isInCheck(b, color) ? mateScore(depth, isMax) : 0;
    if (isMax) {
      let best = -Infinity;
      for (const m of moves) {
        const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
        const sc = fullWidth(nx.board, depth - 1, 1 - color, nx.ep, nx.castling, false, personality);
        if (sc > best) best = sc;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
      const sc = fullWidth(nx.board, depth - 1, 1 - color, nx.ep, nx.castling, true, personality);
      if (sc < best) best = sc;
    }
    return best;
  }

  function ownAlphaBeta(b, depth, alpha, beta, color, ep, cr, isMax, personality) {
    if (depth === 0) return leafScore(b, color, ep, cr, isMax, 0, personality);
    const moves = getAllLegalMoves(b, color, ep, cr);
    if (moves.length === 0) return isInCheck(b, color) ? mateScore(depth, isMax) : 0;
    if (isMax) {
      let best = -Infinity;
      for (const m of moves) {
        const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
        const sc = ownAlphaBeta(nx.board, depth - 1, alpha, beta, 1 - color, nx.ep, nx.castling, false, personality);
        if (sc > best) best = sc;
        if (sc > alpha) alpha = sc;
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
      const sc = ownAlphaBeta(nx.board, depth - 1, alpha, beta, 1 - color, nx.ep, nx.castling, true, personality);
      if (sc < best) best = sc;
      if (sc < beta) beta = sc;
      if (alpha >= beta) break;
    }
    return best;
  }

  function moveKey(m) { return m.from + '-' + m.to + (m.promo ? '=' + m.promoPiece : '') + (m.ep ? 'e' : '') + (m.castle ? 'c' : ''); }

  const SEARCH_FENS = [
    ['startpos', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [1, 2, 3, 4]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [1, 2, 3, 4]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'],
    ['position 6', 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10'],
    ['promotion', '8/P6k/8/8/8/8/6K1/8 w - - 0 1'],
    ['endgame KPK', '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1'],
    ['in check', '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'],
    ['mate in 1', '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1'],
    ['black to move', '8/8/8/8/8/5k2/5p2/5K2 b - - 0 1']
  ];

  const searchRows = [], searchBad = [];
  const EPS = 12; // findBestMove's documented near-best tie margin
  let searchExact = 0, searchWithin = 0, searchCompared = 0;
  for (const entry of SEARCH_FENS) {
    const name = entry[0], fen = entry[1];
    const st = parseFEN(fen);
    for (const depth of (entry[2] || [1, 2, 3])) {
      const isMax = st.turn === WHITE;
      let pageScore, fwScore, abScore, thrown = null, bestMove = null, bestChild = null;
      const t0 = performance.now();
      try {
        pageScore = minimax(st.b, depth, -Infinity, Infinity, st.turn, st.ep, st.cr, isMax, undefined);
        fwScore = fullWidth(st.b, depth, st.turn, st.ep, st.cr, isMax, undefined);
        abScore = ownAlphaBeta(st.b, depth, -Infinity, Infinity, st.turn, st.ep, st.cr, isMax, undefined);
        bestMove = findBestMove(st.b, st.turn, st.ep, st.cr, depth, undefined);
        if (bestMove) {
          const nx = makeMove(st.b, bestMove, { castlingRights: st.cr, epTarget: st.ep });
          bestChild = fullWidth(nx.board, depth - 1, 1 - st.turn, nx.ep, nx.castling, !isMax, undefined);
        }
      } catch (e) { thrown = String(e && e.message || e); }
      const ms = Math.round(performance.now() - t0);
      if (thrown) {
        searchBad.push({ name, depth, fen, error: thrown });
        searchRows.push({ name, depth, fen, error: thrown, ms });
        continue;
      }
      const abMatchesFw = (pageScore === fwScore && abScore === fwScore);
      const scoreDiff = (bestMove && bestChild !== null) ? Math.abs(fwScore - bestChild) : null;
      const scoreOk = (scoreDiff !== null && scoreDiff <= EPS);
      searchCompared++;
      if (pageScore === fwScore) searchExact++;
      if (scoreOk) searchWithin++;
      if (!abMatchesFw || !scoreOk) {
        searchBad.push({
          name, depth, fen, pageScore, fwScore, abScore, bestMove: bestMove ? moveKey(bestMove) : null,
          bestChildScore: bestChild, scoreDiff, abMatchesFw, scoreOk
        });
      }
      searchRows.push({
        name, depth, fen, pageScore, fwScore, abScore,
        ab_matches_fullwidth: abMatchesFw, bestMove: bestMove ? moveKey(bestMove) : null,
        bestChildScore: bestChild, bestScoreDiff: scoreDiff, within_eps12: scoreOk, ms
      });
    }
  }
  RESULT.search_soundness = {
    eps: EPS,
    positions: SEARCH_FENS.length,
    compared: searchCompared,
    exact_page_equals_fullwidth: searchExact,
    bestMove_within_eps: searchWithin,
    rows: searchRows,
    failures: searchBad,
    pass: searchBad.length === 0
  };

  // ---------------- mate in 1 generation + findBestMove check ----------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(0x5EED1234);

  function mateInOne(b, turn, ep, cr) {
    const out = [];
    for (const m of getAllLegalMoves(b, turn, ep, cr)) {
      const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
      const rep = 1 - turn;
      if (getAllLegalMoves(nx.board, rep, nx.ep, nx.castling).length === 0 && isInCheck(nx.board, rep)) out.push(moveKey(m));
    }
    return out;
  }

  function randomSparse() {
    const b = new Array(64).fill(0);
    const free = () => { for (let t = 0; t < 300; t++) { const s = (rnd() * 64) | 0; const r = row(s); if (!b[s] && r >= 1 && r <= 6) return s; } return -1; };
    const br = (rnd() * 8) | 0, bc = (rnd() * 8) | 0;
    b[idx(br, bc)] = PIECE(K, BLACK);
    let wks = -1;
    for (let t = 0; t < 400; t++) {
      const s = (rnd() * 64) | 0;
      if (b[s]) continue;
      if (Math.abs(row(s) - br) <= 1 && Math.abs(col(s) - bc) <= 1) continue;
      wks = s; break;
    }
    if (wks < 0) return null;
    b[wks] = PIECE(K, WHITE);
    const near = () => {
      for (let t = 0; t < 200; t++) {
        const r = Math.max(0, Math.min(7, br + ((rnd() * 5) | 0) - 2));
        const c = Math.max(0, Math.min(7, bc + ((rnd() * 5) | 0) - 2));
        const s = idx(r, c); if (!b[s]) return s;
      }
      return -1;
    };
    const wq = near(); if (wq >= 0) b[wq] = PIECE(QU, WHITE);
    if (rnd() < 0.65) { const wr = near(); if (wr >= 0) b[wr] = PIECE(RO, WHITE); }
    if (rnd() < 0.5) { const bs = free(); if (bs >= 0) b[bs] = PIECE(PA, BLACK); }
    if (rnd() < 0.3) { const ws = free(); if (ws >= 0) b[ws] = PIECE(PA, WHITE); }
    const cr = { K: false, Q: false, k: false, q: false };
    if (isInCheck(b, WHITE) || isInCheck(b, BLACK)) return null;
    return { b, turn: WHITE, ep: null, cr };
  }

  const matePositions = [], mateKeys = {};
  const CANDIDATES = [
    '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1',
    '6k1/8/6K1/8/8/8/8/7Q w - - 0 1',
    'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1'
  ];
  for (const fen of CANDIDATES) {
    const st = parseFEN(fen);
    const m = mateInOne(st.b, st.turn, st.ep, st.cr);
    if (m.length && !mateKeys[fen]) { mateKeys[fen] = 1; matePositions.push({ fen, b: st.b, turn: st.turn, ep: st.ep, cr: st.cr, mates: m }); }
  }
  let sparseTries = 0;
  while (matePositions.length < 40 && sparseTries < 80000) {
    sparseTries++;
    const pos = randomSparse();
    if (!pos) continue;
    const mates = mateInOne(pos.b, pos.turn, pos.ep, pos.cr);
    if (!mates.length) continue;
    const fen = toFEN(pos.b, pos.turn, pos.cr, pos.ep);
    if (mateKeys[fen]) continue;
    mateKeys[fen] = 1;
    matePositions.push({ fen, b: pos.b, turn: pos.turn, ep: pos.ep, cr: pos.cr, mates });
  }

  const mateRows = [], mateBad = [];
  for (const mp of matePositions) {
    let best = null, thrown = null;
    try { best = findBestMove(mp.b, mp.turn, mp.ep, mp.cr, 2, undefined); }
    catch (e) { thrown = String(e && e.message || e); }
    const key = best ? moveKey(best) : null;
    const ok = !thrown && key !== null && mp.mates.indexOf(key) >= 0;
    const row = { fen: mp.fen, mates: mp.mates, bestMove: key, thrown, ok };
    mateRows.push(row);
    if (!ok) mateBad.push(row);
  }
  RESULT.mate_in_1 = {
    generated: matePositions.length,
    sparseTries,
    tested: mateRows.length,
    failures: mateBad,
    rows: mateRows,
    pass: mateBad.length === 0 && mateRows.length >= 20
  };

  // ---------------- legality fuzz over random legal play ----------------
  function startBoard() { return initBoard(); }
  function randomGame(maxPlies) {
    let b = startBoard(), turn = WHITE, ep = null, cr = { K: true, Q: true, k: true, q: true };
    const plies = 1 + ((rnd() * maxPlies) | 0);
    for (let i = 0; i < plies; i++) {
      const moves = getAllLegalMoves(b, turn, ep, cr);
      if (!moves.length) break;
      const m = moves[(rnd() * moves.length) | 0];
      const nx = makeMove(b, m, { castlingRights: cr, epTarget: ep });
      b = nx.board; ep = nx.ep; cr = nx.castling; turn = 1 - turn;
    }
    return { b, turn, ep, cr };
  }
  function fuzzOne(pos, depth, store) {
    store.tested++;
    const fen = toFEN(pos.b, pos.turn, pos.cr, pos.ep);
    let best;
    try { best = findBestMove(pos.b, pos.turn, pos.ep, pos.cr, depth, undefined); }
    catch (e) {
      store.throws++;
      if (store.failures.length < 6) store.failures.push({ kind: 'throw', fen, depth, error: String(e && e.message || e) });
      return;
    }
    const legal = getAllLegalMoves(pos.b, pos.turn, pos.ep, pos.cr);
    if (best === null) {
      if (legal.length > 0) {
        store.illegal++;
        if (store.failures.length < 6) store.failures.push({ kind: 'null-with-legal', fen, depth, legalCount: legal.length });
      }
      return;
    }
    const keys = {};
    for (const m of legal) keys[moveKey(m)] = 1;
    if (!keys[moveKey(best)]) {
      store.illegal++;
      if (store.failures.length < 6) store.failures.push({ kind: 'illegal', fen, depth, move: moveKey(best), legalCount: legal.length, legal: legal.slice(0, 30).map(moveKey) });
    }
  }
  const fuzz1 = { tested: 0, illegal: 0, throws: 0, failures: [] };
  const fuzz2 = { tested: 0, illegal: 0, throws: 0, failures: [] };
  const ft0 = performance.now();
  for (let i = 0; i < 250; i++) fuzzOne(randomGame(50), 1, fuzz1);
  for (let i = 0; i < 60; i++) fuzzOne(randomGame(50), 2, fuzz2);
  RESULT.legality_fuzz = {
    depth1: fuzz1,
    depth2: fuzz2,
    ms: Math.round(performance.now() - ft0),
    pass: fuzz1.illegal === 0 && fuzz1.throws === 0 && fuzz2.illegal === 0 && fuzz2.throws === 0 && fuzz1.tested === 250 && fuzz2.tested === 60
  };

  // ---------------- evaluation sanity ----------------
  function mirror(b) {
    const nb = new Array(64).fill(0);
    for (let i = 0; i < 64; i++) if (b[i]) nb[63 - i] = b[i] ^ 8;
    return nb;
  }
  const symRows = [], symBad = [];
  const symFens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    '8/P6k/8/8/8/8/6K1/8 w - - 0 1'
  ];
  for (let i = 0; i < 20; i++) symFens.push(toFEN(randomGame(60).b, WHITE, { K: false, Q: false, k: false, q: false }, null));
  for (const fen of symFens) {
    const st = parseFEN(fen);
    const a = evaluate(st.b, undefined);
    const m = evaluate(mirror(st.b), undefined);
    const diff = a + m;
    const ok = diff === 0;
    symRows.push({ fen, white: a, mirrored: m, sum: diff, ok });
    if (!ok) symBad.push({ fen, white: a, mirrored: m, sum: diff });
  }
  const zeroStart = evaluate(parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').b, undefined);
  const wqBoard = new Array(64).fill(0);
  wqBoard[idx(7, 4)] = PIECE(K, WHITE); wqBoard[idx(0, 4)] = PIECE(K, BLACK); wqBoard[idx(7, 3)] = PIECE(QU, WHITE);
  const bqBoard = new Array(64).fill(0);
  bqBoard[idx(7, 4)] = PIECE(K, WHITE); bqBoard[idx(0, 4)] = PIECE(K, BLACK); bqBoard[idx(0, 3)] = PIECE(QU, BLACK);
  const wqEval = evaluate(wqBoard, undefined);
  const bqEval = evaluate(bqBoard, undefined);
  RESULT.evaluation_sanity = {
    symmetry_test_count: symRows.length,
    symmetry_rows: symRows,
    symmetry_failures: symBad,
    startpos_eval: zeroStart,
    white_extra_queen_eval: wqEval,
    black_extra_queen_eval: bqEval,
    pass: symBad.length === 0 && zeroStart === 0 && wqEval > 0 && bqEval < 0
  };

  RESULT.failures_summary = {
    perft: RESULT.perft.failures,
    search_soundness: RESULT.search_soundness.failures,
    mate_in_1: RESULT.mate_in_1.failures,
    legality_fuzz: [].concat(RESULT.legality_fuzz.depth1.failures, RESULT.legality_fuzz.depth2.failures),
    evaluation_sanity: RESULT.evaluation_sanity.symmetry_failures
  };
  RESULT.all_pass = RESULT.perft.pass && RESULT.search_soundness.pass && RESULT.mate_in_1.pass &&
    RESULT.legality_fuzz.pass && RESULT.evaluation_sanity.pass;
  RESULT.total_ms = Math.round(performance.now() - T0);
  return RESULT;
}
