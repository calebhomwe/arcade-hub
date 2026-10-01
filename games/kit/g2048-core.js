/* 2048 core: pure rules, no DOM. Used by game-2048.html and by the Node tuning script. */
(function (root) {
  'use strict';
  const DIRS = ['left', 'right', 'up', 'down'];
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* indices of line i, leading edge first, for a direction */
  function lineIdx(N, dir, i) {
    const out = [];
    for (let j = 0; j < N; j++) {
      const r = dir === 'left' || dir === 'right' ? i : dir === 'up' ? j : N - 1 - j;
      const c = dir === 'left' ? j : dir === 'right' ? N - 1 - j : i;
      out.push(r * N + c);
    }
    return out;
  }
  /* slide+merge the whole grid; moves lists every tile: {from,to,val,merge:true if it merges into another tile} */
  function slide(g, N, dir) {
    const ng = new Array(N * N).fill(0), moves = [], merges = []; let gain = 0, moved = false, top = 0;
    for (let i = 0; i < N; i++) {
      const idx = lineIdx(N, dir, i), out = [], mergedAt = [], dest = [];
      for (let k = 0; k < N; k++) {
        const v = g[idx[k]]; if (!v) continue;
        if (out.length && out[out.length - 1] === v && !mergedAt[out.length - 1]) { out[out.length - 1] = v * 2; mergedAt[out.length - 1] = true; dest[k] = out.length - 1; gain += v * 2; if (v * 2 > top) top = v * 2; }
        else { out.push(v); dest[k] = out.length - 1; }
      }
      for (let k = 0; k < N; k++) {
        if (dest[k] === undefined) continue;
        const from = idx[k], to = idx[dest[k]], v = g[from];
        moves.push({ from, to, val: v, merge: !!mergedAt[dest[k]] });
        if (from !== to) moved = true;
      }
      for (let d = 0; d < out.length; d++) { ng[idx[d]] = out[d]; if (mergedAt[d]) merges.push({ at: idx[d], val: out[d] }); }
    }
    return { g: ng, gain, moved, top, moves, merges };
  }
  const canMove = (g, N) => DIRS.some(d => slide(g, N, d).moved);
  function heur(g, N) {
    let empty = 0, max = 0, mono = 0, smooth = 0; const L = v => v ? Math.log2(v) : 0;
    for (const v of g) { if (!v) empty++; if (v > max) max = v; }
    for (let i = 0; i < N; i++) {
      let a = 0, b = 0, c = 0, d = 0;
      for (let j = 0; j < N - 1; j++) {
        const x = L(g[i * N + j]), y = L(g[i * N + j + 1]), u = L(g[j * N + i]), w = L(g[(j + 1) * N + i]);
        if (x > y) a += y - x; else b += x - y; if (u > w) c += w - u; else d += u - w;
        if (x && y) smooth -= Math.abs(x - y); if (u && w) smooth -= Math.abs(u - w);
      }
      mono += Math.max(a, b) + Math.max(c, d);
    }
    const corner = [0, N - 1, N * (N - 1), N * N - 1].some(k => g[k] === max) ? L(max) : 0;
    return empty * 2.7 + mono + smooth * 0.1 + corner * 1.5;
  }
  /* two-ply: for each move, average over where a 2 could appear, then the best reply */
  function bestMove(g, N) {
    let pick = null, top = -1e9;
    for (const d of DIRS) {
      const m = slide(g, N, d); if (!m.moved) continue;
      const em = []; m.g.forEach((v, k) => { if (!v) em.push(k); });
      let exp = 0, n = 0;
      for (const e of em) { const g2 = m.g.slice(); g2[e] = 2; let b = -60; for (const d2 of DIRS) { const m2 = slide(g2, N, d2); if (m2.moved) b = Math.max(b, heur(m2.g, N) + Math.log2(m2.gain + 1) * 0.4); } exp += b; n++; }
      const v = (n ? exp / n : heur(m.g, N)) + Math.log2(m.gain + 1) * 0.4;
      if (v > top) { top = v; pick = { d, m }; }
    }
    return pick;
  }

  /* ---------------- trials: 18 goals in three packs ---------------- */
  const PACKS = [
    { id: 'cozy', name: 'Cozy Corner', sub: 'Roomy 5x5 boards to learn on', sky: ['#ffe6c7', '#ffc9a8'], n: 5 },
    { id: 'town', name: 'Critter Town', sub: 'The classic 4x4 squeeze', sky: ['#c9f0d8', '#8fd6b0'], n: 4 },
    { id: 'tower', name: 'High Rise', sub: 'Tiny boards and crowded starts', sky: ['#d9d0ff', '#a99bff'], n: 4 },
  ];
  const PER_PACK = 6, TRIALS = PACKS.length * PER_PACK;
  /* [type, goal, moves, board size, pre-placed tiles] */
  const TABLE = [
    ['tile', 32, 35, 5, 3], ['merges', 14, 30, 5, 3], ['tile', 64, 65, 5, 4], ['score', 400, 70, 5, 4], ['tile', 128, 115, 5, 4], ['tile', 256, 230, 5, 4],
    ['tile', 64, 50, 4, 4], ['score', 1000, 135, 4, 5], ['merges', 50, 80, 4, 5], ['tile', 128, 105, 4, 6], ['score', 2000, 245, 4, 5], ['tile', 256, 205, 4, 6],
    ['tile', 64, 60, 3, 2], ['merges', 60, 90, 4, 8], ['tile', 256, 230, 4, 8], ['score', 350, 60, 3, 3], ['score', 3600, 350, 4, 8], ['tile', 512, 420, 4, 6],
  ];
  function trialDef(i) {
    const t = TABLE[i], p = (i / PER_PACK) | 0;
    return { i, type: t[0], goal: t[1], moves: t[2], n: t[3], pre: t[4], pack: p, k: i % PER_PACK, boss: i % PER_PACK === PER_PACK - 1, seed: 3100 + i * 37, name: PACKS[p].name + ' ' + (i % PER_PACK + 1) };
  }
  function trialStart(def) {
    const rnd = mulberry(def.seed), N = def.n, g = new Array(N * N).fill(0); let k = 0;
    const vals = [2, 2, 4, 2, 4, 8, 2, 4, 8, 16];
    while (k < def.pre) { const p = (rnd() * N * N) | 0; if (g[p]) continue; g[p] = vals[(rnd() * vals.length) | 0]; k++; }
    return g;
  }
  function starsFor(def, movesLeft) { const f = movesLeft / def.moves; return f >= 0.27 ? 3 : f >= 0.1 ? 2 : 1; }

  const api = { DIRS, mulberry, slide, canMove, heur, bestMove, PACKS, PER_PACK, TRIALS, TABLE, trialDef, trialStart, starsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.G2048 = api;
})(typeof window !== 'undefined' ? window : globalThis);
