// cdp-swr.js - does a deployed change reach an installed client, or is it pinned in the cache?
// Loads the isolated harness (_loop/staleness) whose sw.js is a copy of the real chess-sw.js,
// caches stub.js, rewrites it on disk, and watches what the next fetches return.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const MiniWS = require(path.join(__dirname, 'minws.js'));
const HARNESS = path.join(__dirname, '..', 'staleness');
const STUB = path.join(HARNESS, 'stub.js');
function getJSON(u) { return new Promise((res, rej) => { http.get(u, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
(async () => {
  const url = process.argv[2] || 'http://127.0.0.1:8137/_loop/staleness/index.html';
  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9700 + Math.floor(Math.random() * 150);
  const profile = path.join(process.env.TEMP, 'dsh-swr-' + port);
  fs.writeFileSync(STUB, 'VERSION_ONE');
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=488,1055', url], { stdio: ['ignore', 'ignore', 'pipe'] });
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
  const grab = () => evalIn("fetch('stub.js?x=' + Math.random()).then(r => r.text())");
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.text || ''));
  });
  ws.on('open', async () => {
    try {
      await send('Runtime.enable'); await send('Page.enable');
      await new Promise(r => setTimeout(r, 3000));
      console.log('worker ready: ' + await evalIn("navigator.serviceWorker.ready.then(r => !!r.active)"));
      console.log('first fetch (expected VERSION_ONE): ' + await grab());
      fs.writeFileSync(STUB, 'VERSION_TWO');
      console.log('after changing the file on disk:');
      console.log('  immediate fetch (expected VERSION_ONE from cache): ' + await grab());
      await new Promise(r => setTimeout(r, 1500));
      console.log('  after the background refresh (expected VERSION_TWO): ' + await grab());
    } catch (e) { console.log('ERR ' + e.message); }
    console.log('CONSOLE_ERRORS=' + errs.length);
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); process.exit(1); });
  ws.connect();
})();
