// cdp-persist.js - set preferences, reload the page for real, and read them back.
// usage: node cdp-persist.js [url]
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
function getJSON(u) { return new Promise((res, rej) => { http.get(u, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/games/chess.html';
  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9800 + Math.floor(Math.random() * 150);
  const profile = path.join(process.env.TEMP, 'dsh-persist-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=900,1000', url], { stdio: ['ignore', 'ignore', 'pipe'] });
  let target = null;
  for (let i = 0; i < 60 && !target; i++) { await new Promise(r => setTimeout(r, 300)); try { const l = await getJSON('http://127.0.0.1:' + port + '/json/list'); target = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {} }
  if (!target) { console.log('NO_TARGET'); process.exit(1); }
  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const errs = [];
  function send(method, params) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }); }
  const evalIn = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) return { error: r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '') };
    return { value: r.result.value };
  };
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.text || '') + ' ' + ((m.params.exceptionDetails.exception || {}).description || ''));
  });
  ws.on('open', async () => {
    try {
      await send('Runtime.enable'); await send('Page.enable');
      await new Promise(r => setTimeout(r, 4000));
      const setup = await evalIn(fs.readFileSync(path.join(__dirname, 'persist-setup.txt'), 'utf8'));
      console.log('SETUP ' + JSON.stringify(setup));
      await send('Page.reload', { ignoreCache: false });
      await new Promise(r => setTimeout(r, 5000));
      const after = await evalIn(fs.readFileSync(path.join(__dirname, 'persist-check.txt'), 'utf8'));
      console.log('AFTER_RELOAD ' + JSON.stringify(after));
    } catch (e) { console.log('ERR ' + e.message); }
    console.log('CONSOLE_ERRORS=' + errs.length);
    errs.slice(0, 4).forEach(e => console.log('  ' + e.slice(0, 160)));
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();
