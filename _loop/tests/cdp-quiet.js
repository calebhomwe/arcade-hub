// cdp-quiet.js - fresh profile: is the game silent and free of arcade content until asked?
// Installs an audio spy BEFORE any page script runs, loads the game with no stored preferences,
// checks the defaults, then makes a real move and checks that sound only happens afterwards.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
function getJSON(u) { return new Promise((res, rej) => { http.get(u, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
const SPY = "window.__audioSpy = { contexts: 0, started: 0, media: 0, tones: 0 };" +
  "(function(){ try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) { var W = function(){ window.__audioSpy.contexts++; if (!window.__audioSpy.stack) { try { window.__audioSpy.stack = String((new Error()).stack).split(String.fromCharCode(10)).slice(1, 5).join(' | '); } catch (e) {} } return new AC(); }; W.prototype = AC.prototype; window.AudioContext = W; window.webkitAudioContext = W; } " +
  "var P = (window.AudioBufferSourceNode||{}).prototype; if (P && P.start) { var o = P.start; P.start = function(){ window.__audioSpy.started++; return o.apply(this, arguments); }; } " +
  "var O = (window.OscillatorNode||{}).prototype; if (O && O.start) { var o2 = O.start; O.start = function(){ window.__audioSpy.tones++; return o2.apply(this, arguments); }; } " +
  "var M = (window.HTMLMediaElement||{}).prototype; if (M && M.play) { var o3 = M.play; M.play = function(){ window.__audioSpy.media++; return o3.apply(this, arguments); }; } } catch (e) {} })();";
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/games/chess.html?nomenu';
  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9850 + Math.floor(Math.random() * 120);
  const profile = path.join(process.env.TEMP, 'dsh-quiet-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=488,1055', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { await new Promise(r => setTimeout(r, 300)); try { const l = await getJSON('http://127.0.0.1:' + port + '/json/list'); target = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {} }
  if (!target) { console.log('NO_TARGET'); process.exit(1); }
  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const errs = [];
  function send(method, params) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
  const evalIn = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) return 'ERR ' + r.exceptionDetails.text;
    return r.result.value;
  };
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
      await new Promise(r => setTimeout(r, 6000));
      console.log('DEFAULTS ' + await evalIn(fs.readFileSync(path.join(__dirname, 'quiet-defaults.txt'), 'utf8')));
      console.log('BEFORE_GESTURE ' + await evalIn('JSON.stringify(window.__audioSpy)'));
      console.log('AFTER_GESTURE ' + await evalIn(fs.readFileSync(path.join(__dirname, 'quiet-after.txt'), 'utf8')));
      await new Promise(r => setTimeout(r, 1500));
      console.log('SPY_END ' + await evalIn('JSON.stringify(window.__audioSpy)'));
    } catch (e) { console.log('ERR ' + e.message); }
    console.log('CONSOLE_ERRORS=' + errs.length);
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();