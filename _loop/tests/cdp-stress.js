// cdp-stress.js - play a long game and look for unbounded growth: pending timers, live event
// listeners, DOM nodes, heap, and the bookkeeping arrays the game keeps per move.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
function getJSON(u) { return new Promise((res, rej) => { http.get(u, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
const SPY = [
  "window.__spy = { timers: 0, cleared: 0, fired: 0, listeners: new Set(), pending: function () { return this.timers - this.cleared - this.fired; } };",
  "(function () {",
  "  var st = window.setTimeout, si = window.setInterval, ct = window.clearTimeout, ci = window.clearInterval;",
  "  window.setTimeout = function (fn, ms) { window.__spy.timers++; var id = st(function () { window.__spy.fired++; return fn.apply(this, arguments); }, ms); return id; };",
  "  window.setInterval = function (fn, ms) { window.__spy.timers++; var id = si(function () { return fn.apply(this, arguments); }, ms); return id; };",
  "  window.clearTimeout = function (id) { window.__spy.cleared++; return ct(id); };",
  "  window.clearInterval = function (id) { window.__spy.cleared++; return ci(id); };",
  "  var key = function (t, type, f) { var who = (t === window) ? 'window' : (t && t.id ? '#' + t.id : (t && t.tagName ? t.tagName : 'node')); return who + '|' + type + '|' + String(f).slice(0, 40); };",
  "  var add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;",
  "  EventTarget.prototype.addEventListener = function (type, f, o) { try { window.__spy.listeners.add(key(this, type, f)); } catch (e) {} return add.apply(this, arguments); };",
  "  EventTarget.prototype.removeEventListener = function (type, f, o) { try { window.__spy.listeners.delete(key(this, type, f)); } catch (e) {} return rem.apply(this, arguments); };",
  "})();"
].join("\n");
const STRESS = `(async function () {
  if (window.showStartScreen) window.showStartScreen(false);
  botEnabled = false;
  const snap = () => ({
    nodes: document.querySelectorAll('*').length,
    listeners: window.__spy.listeners.size,
    pendingTimers: window.__spy.pending(),
    timersCreated: window.__spy.timers,
    heapKB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024) : -1,
    history: game.moveHistory.length,
    redo: (typeof redoStack !== 'undefined' && redoStack) ? redoStack.length : -1,
    counts: game.positionCounts ? Object.keys(game.positionCounts).length : -1,
    tags: game.tags ? Object.keys(game.tags).length : -1
  });
  const before = snap();
  let plies = 0, games = 1, resetNodes = [], resetListeners = []; peakNodes = before.nodes, peakListeners = before.listeners, peakTimers = before.pendingTimers;
  for (let i = 0; i < 600 && games <= 4; i++) {
    const legal = getAllLegalMoves(game.board, game.turn, game.epTarget, game.castlingRights);
    if (!legal.length || game.gameOver) {
      resetGame(); botEnabled = false; games++;
      resetNodes.push(document.querySelectorAll('*').length);
      resetListeners.push(window.__spy.listeners.size);
      continue;
    }
    const mv = findBestMove(game.board, game.turn, game.epTarget, game.castlingRights, 1, 'balanced') || legal[0];
    executeMove(mv);
    plies++;
    const s = snap();
    peakNodes = Math.max(peakNodes, s.nodes);
    peakListeners = Math.max(peakListeners, s.listeners);
    peakTimers = Math.max(peakTimers, s.pendingTimers);
    if (i % 20 === 0) await new Promise(r => setTimeout(r, 8));
  }
  await new Promise(r => setTimeout(r, 800));
  const after = snap();
  // the move list is expected to grow with the plies; a reset must hand the nodes back
  const nodesWithGame = document.querySelectorAll('*').length;
  resetGame();
  if (window.showStartScreen) window.showStartScreen(false);
  await new Promise(r => setTimeout(r, 300));
  const afterReset = snap();
  const resetGaveBack = nodesWithGame - afterReset.nodes;
  return JSON.stringify({
    plies: plies, games: games, before: before, after: after,
    peak: { nodes: peakNodes, listeners: peakListeners, pendingTimers: peakTimers },
    growth: {
      nodes: after.nodes - before.nodes, listeners: after.listeners - before.listeners,
      pendingTimers: after.pendingTimers - before.pendingTimers, heapKB: after.heapKB - before.heapKB,
      history: after.history - before.history
    },
    moveListNodes: nodesWithGame - before.nodes,
    resetTrace: { nodes: resetNodes, listeners: resetListeners },
    nodesReturnedByReset: resetGaveBack,
    nodesAfterReset: afterReset.nodes,
    listenersAfterReset: afterReset.listeners,
    pendingTimersAfterReset: afterReset.pendingTimers
  });
})()`;
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/games/chess.html?nomenu';
  const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const port = 9990 + Math.floor(Math.random() * 9);
  const profile = path.join(process.env.TEMP, 'dsh-stress-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio', '--js-flags=--expose-gc',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=488,1055', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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
      await send('Runtime.enable'); await send('Page.enable');
      await send('Page.addScriptToEvaluateOnNewDocument', { source: SPY });
      await send('Page.navigate', { url: url });
      await new Promise(r => setTimeout(r, 8000));
      const r = await send('Runtime.evaluate', { expression: STRESS, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) console.log('STRESS_FAILED ' + r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '').slice(0, 200));
      else console.log('RESULT ' + r.result.value);
    } catch (e) { console.log('ERR ' + e.message); }
    console.log('CONSOLE_ERRORS=' + errs.length);
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();