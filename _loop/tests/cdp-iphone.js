// cdp-iphone.js - emulate an iPhone in real Chrome, run the game end to end, print evidence.
// usage: node cdp-iphone.js [url] [screenshot.png]
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
function getJSON(url) { return new Promise((res, rej) => { http.get(url, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/games/chess.html';
  const shot = process.argv[3] || 'iphone.png';
  const vw = Number(process.argv[4]) || 393;
  const vh = Number(process.argv[5]) || 852;
  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9600 + Math.floor(Math.random() * 300);
  const profile = path.join(process.env.TEMP, 'dsh-iphone-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=1200,900', url], { stdio: ['ignore', 'ignore', 'pipe'] });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise(r => setTimeout(r, 300));
    try { const list = await getJSON('http://127.0.0.1:' + port + '/json/list'); target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {}
  }
  if (!target) { console.log('NO_TARGET'); process.exit(1); }
  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const logs = [];
  function send(method, params) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push({ level: m.params.type, text: (m.params.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ') });
    if (m.method === 'Runtime.exceptionThrown') logs.push({ level: 'EXCEPTION', text: (m.params.exceptionDetails.text || '') + ' ' + ((m.params.exceptionDetails.exception || {}).description || '') });
  });
  ws.on('open', async () => {
    try {
      await send('Runtime.enable'); await send('Page.enable');
      // iPhone 15 Pro class viewport, touch, DPR 3
      await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 3, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
      await new Promise(r => setTimeout(r, 4000));
      const expr = fs.readFileSync(path.join(__dirname, process.argv[6] || 'iphone-session.txt'), 'utf8');
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) console.log('EVAL_EXCEPTION ' + r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
      else {
        try { const j = JSON.parse(r.result.value); console.log(JSON.stringify(j, null, 1)); }
        catch (e) { console.log(String(r.result.value)); }
      }
      const s = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(__dirname, shot), Buffer.from(s.data, 'base64'));
    } catch (e) { console.log('ERR ' + e.message); }
    const bad = logs.filter(l => l.level === 'EXCEPTION' || l.level === 'error');
    console.log('CONSOLE_ERRORS=' + bad.length);
    bad.slice(0, 6).forEach(l => console.log('  [' + l.level + '] ' + l.text.slice(0, 200)));
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();