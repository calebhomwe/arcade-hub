// cdp-perf.js - real wall-clock performance, measured over CDP because virtual time reports 0 ms.
// Reports bot move latency per difficulty, frame cost, review cost and load bytes, then compares
// each against the budget in _loop/research/chess-perf-budget.md.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
function getJSON(u) { return new Promise((res, rej) => { http.get(u, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
const MEASURE = `(function () {
  const now = () => performance.now();
  const st = stateFromFen('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1');
  const mid = { board: st.board, turn: st.turn, ep: st.epTarget, cr: st.castlingRights };
  const end = stateFromFen('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
  const time = (label, fn, n) => { const t0 = now(); for (let i = 0; i < n; i++) fn(); return { label: label, ms: (now() - t0) / n }; };
  const out = { bot: [], frame: 0, review: 0, bytes: 0, load: 0, resources: 0, budget: (typeof PERF_BUDGET !== 'undefined') ? PERF_BUDGET : null };
  out.bot.push(time('easy (depth 1, near-best window)', () => pickWeakerMove(mid.board, mid.turn, mid.ep, mid.cr, 1, 250, 6, 0.18), 12));
  out.bot.push(time('medium (depth 2)', () => findBestMove(mid.board, mid.turn, mid.ep, mid.cr, 2, 'balanced'), 12));
  out.bot.push(time('hard (depth 3)', () => findBestMove(mid.board, mid.turn, mid.ep, mid.cr, 3, 'balanced'), 6));
  out.bot.push(time('endgame (few pieces, depth raised)', () => findBestMove(end.board, end.turn, end.epTarget, end.castlingRights, 3, 'balanced'), 6));
  const rk = stateFromFen('7k/8/8/8/8/8/8/K5R1 w - - 0 1');
  out.bot.push(time('bare-king rook ending (deepest search)', () => findBestMove(rk.board, rk.turn, rk.epTarget, rk.castlingRights, 3, 'balanced'), 6));
  out.frame = time('draw()', () => draw(), 60).ms;
  out.review = (function () {
    resetGame(); if (window.showStartScreen) window.showStartScreen(false);
    const moves = ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7','f1e1','b7b5','a4b3','d7d6','c2c3','e8g8','h2h3','c6a5','b3c2','c7c5'];
    for (const m of moves) {
      const mv = getAllLegalMoves(game.board, game.turn, game.epTarget, game.castlingRights).find(x => sqName(x.from) + sqName(x.to) === m);
      if (mv) executeMove(mv);
    }
    const t0 = now();
    const entries = buildReviewEntries();
    entries.forEach(e => analyzeReviewEntry(e));
    const ms = now() - t0;
    resetGame(); if (window.showStartScreen) window.showStartScreen(false);
    return { plies: entries.length, ms: ms };
  })();
  const nav = performance.getEntriesByType('navigation')[0] || {};
  out.load = nav.domContentLoadedEventEnd || 0;
  const res = performance.getEntriesByType('resource') || [];
  out.resources = res.length;
  out.bytes = res.reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) + (nav.transferSize || 0);
  return JSON.stringify(out);
})()`;
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/games/chess.html?nomenu';
  const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9950 + Math.floor(Math.random() * 40);
  const profile = path.join(process.env.TEMP, 'dsh-perf-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=488,1055', url], { stdio: ['ignore', 'ignore', 'pipe'] });
  let target = null;
  for (let i = 0; i < 80 && !target; i++) { await new Promise(r => setTimeout(r, 300)); try { const l = await getJSON('http://127.0.0.1:' + port + '/json/list'); target = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {} }
  if (!target) { console.log('NO_TARGET'); process.exit(1); }
  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const errs = [];
  function send(method, params) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text || '');
  });
  ws.on('open', async () => {
    try {
      await send('Runtime.enable');
      await new Promise(r => setTimeout(r, 8000));
      const r = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) { console.log('MEASURE_FAILED ' + r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '').slice(0, 200)); }
      else {
        const v = JSON.parse(r.result.value);
        const b = v.budget;
        const checks = [];
        if (b) {
          checks.push(['easy bot move', v.bot[0].ms, b.botEasyMs]);
          checks.push(['medium bot move', v.bot[1].ms, b.botMediumMs]);
          checks.push(['hard bot move', v.bot[2].ms, b.botHardMs]);
          checks.push(['endgame move', v.bot[3].ms, b.endgameMs]);
          checks.push(['rook ending move', v.bot[4].ms, b.rookEndingMs]);
          checks.push(['frame repaint', v.frame, b.frameMs]);
          checks.push(['review per ply', v.review.ms / Math.max(1, v.review.plies), b.reviewMsPerPly]);
          checks.push(['load bytes', v.bytes, b.loadBytes]);
          checks.push(['dom content loaded', v.load, b.domContentLoadedMs]);
        }
        console.log('RESULT ' + JSON.stringify(v));
        const bad = checks.filter(c => c[1] > c[2]);
        for (const c of checks) console.log('  ' + (c[1] > c[2] ? 'OVER ' : 'ok   ') + c[0] + ': ' + Number(c[1]).toFixed(2) + ' (budget ' + c[2] + ')');
        console.log('BUDGET ' + (b ? (bad.length ? 'VIOLATED ' + bad.map(c => c[0]).join(', ') : 'ok, ' + checks.length + ' lines within budget') : 'not published by the page'));
      }
    } catch (e) { console.log('ERR ' + e.message); }
    console.log('CONSOLE_ERRORS=' + errs.length);
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();