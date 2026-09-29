/* Block Blast core: pure rules, no DOM. Loaded by block-blast.html and by the Node tuning script
 * (tools in the report: a greedy bot plays every adventure level to tune the move budgets). */
(function (root) {
  'use strict';
  const N = 8;
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rot = s => s[0].map((_, c) => s.map(r => r[c]).reverse());
  const uniq = list => { const seen = new Set(), out = []; for (const s of list) { const k = s.map(r => r.join('')).join('/'); if (!seen.has(k)) { seen.add(k); out.push(s); } } return out; };
  const rots = s => uniq([s, rot(s), rot(rot(s)), rot(rot(rot(s)))]);
  const mirrorRots = s => uniq(rots(s).concat(rots(s.map(r => r.slice().reverse()))));
  /* [shape family, weight per orientation] */
  const FAMILIES = [
    [[[1]], 1.2],
    [[[1, 1]], 3], [[[1, 1, 1]], 3], [[[1, 1, 1, 1]], 2], [[[1, 1, 1, 1, 1]], 1],
  ];
  const SHAPES = [];
  function add(list, w) { for (const s of list) SHAPES.push({ s, w, n: s.flat().reduce((a, b) => a + b, 0) }); }
  add([[[1]]], 1.2);
  add(rots([[1, 1]]), 3); add(rots([[1, 1, 1]]), 3); add(rots([[1, 1, 1, 1]]), 2); add(rots([[1, 1, 1, 1, 1]]), 1.1);
  add([[[1, 1], [1, 1]]], 3.2); add([[[1, 1, 1], [1, 1, 1]], [[1, 1], [1, 1], [1, 1]]], 2); add([[[1, 1, 1], [1, 1, 1], [1, 1, 1]]], 1);
  add(rots([[1, 1], [1, 0]]), 2.2);                                   // small corner, 3 cells
  add(rots([[1, 0, 0], [1, 0, 0], [1, 1, 1]]), 1.1);                  // big corner, 5 cells
  add(rots([[1, 1, 1], [0, 1, 0]]), 1.6);                              // T
  add(rots([[1, 1, 0], [0, 1, 1]]).concat(rots([[0, 1, 1], [1, 1, 0]])), 1.3);   // S and Z
  add(mirrorRots([[1, 0], [1, 0], [1, 1]]), 1.1);                     // L and J, 4 cells
  add(rots([[0, 1, 0], [1, 1, 1], [0, 1, 0]]), 0.5);                  // plus
  const cellsOf = s => s.flat().reduce((a, b) => a + b, 0);

  function canPlace(g, s, r, c) {
    const h = s.length, w = s[0].length; if (r < 0 || c < 0 || r + h > N || c + w > N) return false;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (s[y][x] && g[(r + y) * N + c + x]) return false;
    return true;
  }
  function anyFit(g, s) { for (let r = 0; r <= N - s.length; r++) for (let c = 0; c <= N - s[0].length; c++) if (canPlace(g, s, r, c)) return true; return false; }
  /* place a shape; returns { grid, rows, cols, cleared:[idx], lines } (grid already has full lines removed) */
  function place(g, s, r, c, color) {
    const ng = g.slice(); for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) ng[(r + y) * N + c + x] = color;
    return settle(ng);
  }
  function settle(ng) {
    const rows = [], cols = [];
    for (let y = 0; y < N; y++) { let f = true; for (let x = 0; x < N; x++) if (!ng[y * N + x]) { f = false; break; } if (f) rows.push(y); }
    for (let x = 0; x < N; x++) { let f = true; for (let y = 0; y < N; y++) if (!ng[y * N + x]) { f = false; break; } if (f) cols.push(x); }
    const cleared = new Set(); for (const y of rows) for (let x = 0; x < N; x++) cleared.add(y * N + x); for (const x of cols) for (let y = 0; y < N; y++) cleared.add(y * N + x);
    const before = ng.slice(); for (const i of cleared) ng[i] = 0;
    return { grid: ng, rows, cols, cleared: [...cleared], colorsBefore: before, lines: rows.length + cols.length };
  }
  function bombArea(r, c) { const out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const y = r + dy, x = c + dx; if (y >= 0 && y < N && x >= 0 && x < N) out.push(y * N + x); } return out; }

  /* Can all shapes be placed, in some order, allowing line clears in between? Budgeted so it can never stall the phone. */
  function trayPlayable(g, shapes, budget) {
    let ops = budget || 40000;
    function go(grid, rest) {
      if (!rest.length) return true;
      for (let k = 0; k < rest.length; k++) {
        const s = rest[k], others = rest.filter((_, j) => j !== k);
        for (let r = 0; r <= N - s.length; r++) for (let c = 0; c <= N - s[0].length; c++) {
          if (--ops < 0) return true;         // out of budget: do not block the game on a hard proof
          if (!canPlace(grid, s, r, c)) continue;
          if (go(place(grid, s, r, c, 1).grid, others)) return true;
        }
      }
      return false;
    }
    return go(g, shapes);
  }

  /* Choose one shape: small early, bigger when the board is open, tiny when the board is nearly full. */
  function pickShape(rnd, fill, moves, tiny) {
    const cap = tiny ? 3 : moves < 6 ? 5 : fill > 0.55 ? 5 : fill > 0.4 ? 6 : fill > 0.25 ? 9 : 25;
    let total = 0; const pool = SHAPES.filter(x => x.n <= cap);
    for (const x of pool) total += x.w;
    let t = rnd() * total; for (const x of pool) { t -= x.w; if (t <= 0) return x.s; }
    return pool[pool.length - 1].s;
  }
  function genTray(g, rnd, opts) {
    opts = opts || {}; const fill = g.filter(Boolean).length / (N * N);
    let best = null;
    for (let t = 0; t < 14; t++) {
      const shapes = [pickShape(rnd, fill, opts.moves || 0, opts.tiny), pickShape(rnd, fill, opts.moves || 0, opts.tiny), pickShape(rnd, fill, opts.moves || 0, opts.tiny)];
      if (shapes.every(s => anyFit(g, s)) && trayPlayable(g, shapes, 24000)) { best = shapes; break; }
      if (!best && shapes.some(s => anyFit(g, s))) best = shapes;
    }
    if (!best) { const small = SHAPES.filter(x => x.n <= 2).map(x => x.s); best = [small[(rnd() * small.length) | 0], small[(rnd() * small.length) | 0], small[(rnd() * small.length) | 0]]; }
    return best.map(s => s.map(r => r.slice()));
  }

  /* Score for one placement. combo is the streak AFTER this clear (1 = first clear in a row). */
  function scoreClear(lines, combo) { return Math.round(10 * lines * lines * (1 + 0.25 * (combo - 1))); }

  /* Greedy evaluation used by Hint and by the tuning bot. */
  function evalGrid(g) {
    let empty = 0, holes = 0, semi = 0, rough = 0, big = 0;
    for (let i = 0; i < N * N; i++) {
      if (g[i]) continue; empty++; const r = (i / N) | 0, c = i % N; let n = 0;
      if (r === 0 || g[i - N]) n++; if (r === N - 1 || g[i + N]) n++; if (c === 0 || g[i - 1]) n++; if (c === N - 1 || g[i + 1]) n++;
      if (n === 4) holes++; else if (n === 3) semi++;
    }
    for (const sh of [[[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]]]) { if (anyFit(g, sh)) big++; }
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (!!g[r * N + c] !== !!g[r * N + c + 1]) rough++;
    for (let c = 0; c < N; c++) for (let r = 0; r < N - 1; r++) if (!!g[r * N + c] !== !!g[(r + 1) * N + c]) rough++;
    return empty - holes * 6 - semi * 2 - rough * 0.6 + big * 4;
  }
  /* tray: [{shape, used, bomb}] -> { v, i, r, c, lines } or null. `want(placeResult)` can add a bonus (gems, etc.) */
  function bestMove(g, tray, want) {
    let best = null;
    tray.forEach((pc, i) => {
      if (pc.used) return;
      for (let r = 0; r <= N - pc.shape.length; r++) for (let c = 0; c <= N - pc.shape[0].length; c++) {
        if (!canPlace(g, pc.shape, r, c)) continue;
        let res;
        if (pc.bomb) { const ng = g.slice(); ng[r * N + c] = 1; for (const k of bombArea(r, c)) ng[k] = 0; res = settle(ng); res.cleared = res.cleared.concat(bombArea(r, c)); }
        else res = place(g, pc.shape, r, c, 1);
        const rest = tray.filter((q, j) => j !== i && !q.used);
        const stuck = rest.some(q => !anyFit(res.grid, q.shape));
        const v = res.lines * 40 + evalGrid(res.grid) - (stuck ? 60 : 0) + (want ? want(res, pc, r, c) : 0);
        if (!best || v > best.v) best = { v, i, r, c, lines: res.lines };
      }
    });
    return best;
  }

  /* ---------------- adventure levels ---------------- */
  const WORLDS = [
    { id: 'meadow', name: 'Sunny Meadow', sub: 'Learn the blocks', sky: ['#7fd6ff', '#c8f5b8'], icon: 'flower' },
    { id: 'caves', name: 'Crystal Caves', sub: 'Gems hide in the rock', sky: ['#5b4bb7', '#c98bff'], icon: 'gem' },
    { id: 'sky', name: 'Sky Kingdom', sub: 'Tight moves, big clouds', sky: ['#ff9a8b', '#ffd6a5'], icon: 'cloud' },
  ];
  const PER_WORLD = 8, LEVELS = WORLDS.length * PER_WORLD;
  const TYPES = ['lines', 'gems', 'score', 'gems', 'lines', 'gems', 'score', 'gems'];
  function levelDef(i) {
    const w = (i / PER_WORLD) | 0, n = i % PER_WORLD, rnd = mulberry(9100 + i * 131), type = TYPES[n];
    const pre = 4 + w * 6 + Math.floor(n * 1.3);                       // filled squares at the start
    const moves = 20 - w * 2 - Math.floor(n / 2) + (type === 'score' ? 1 : 0);
    const g = { type, w, n, i, pre, moves };
    g.goal = type === 'lines' ? 5 + w * 2 + n : type === 'score' ? 220 + w * 90 + n * 45 : 3 + w * 2 + Math.floor(n / 2);
    g.seed = 500 + i * 17; g.name = WORLDS[w].name + ' ' + (n + 1);
    g.boss = n === PER_WORLD - 1;
    return g;
  }
  /* start position of a level: the grid (colors 1..8) and the gem map */
  function levelStart(def) {
    const rnd = mulberry(def.seed), grid = new Array(N * N).fill(0), gems = new Array(N * N).fill(0);
    let tries = 0;
    while (grid.filter(Boolean).length < def.pre && tries++ < 400) {
      const sh = SHAPES[(rnd() * SHAPES.length) | 0].s; if (cellsOf(sh) > 5) continue;
      const r = (rnd() * (N - sh.length + 1)) | 0, c = (rnd() * (N - sh[0].length + 1)) | 0;
      if (!canPlace(grid, sh, r, c)) continue;
      const t = place(grid, sh, r, c, 1 + ((rnd() * 8) | 0)); if (t.lines) continue;   // never start with a finished line
      let rowmax = 0; for (let y = 0; y < N; y++) { let a = 0, b = 0; for (let x = 0; x < N; x++) { if (t.grid[y * N + x]) a++; if (t.grid[x * N + y]) b++; } rowmax = Math.max(rowmax, a, b); }
      if (rowmax > 6) continue;
      for (let i = 0; i < N * N; i++) grid[i] = t.grid[i];
    }
    if (def.type === 'gems') {
      const filled = []; for (let i = 0; i < N * N; i++) if (grid[i]) filled.push(i);
      for (let k = filled.length - 1; k > 0; k--) { const j = (rnd() * (k + 1)) | 0; [filled[k], filled[j]] = [filled[j], filled[k]]; }
      const want = Math.min(filled.length, def.goal + 2); for (let k = 0; k < want; k++) gems[filled[k]] = 1;
    }
    return { grid, gems };
  }
  function starsFor(def, movesLeft) { const f = movesLeft / def.moves; return f >= 0.5 ? 3 : f >= 0.25 ? 2 : 1; }

  const api = { N, SHAPES, mulberry, canPlace, anyFit, place, settle, bombArea, trayPlayable, pickShape, genTray, scoreClear, evalGrid, bestMove, WORLDS, PER_WORLD, LEVELS, levelDef, levelStart, starsFor, cellsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BBCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
