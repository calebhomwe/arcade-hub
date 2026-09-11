// cdp-eval.js — open a URL in real headless Chrome via CDP and evaluate an expression
// usage: node cdp-eval.js <url> <expression> [screenshotPath] [waitMs]
const fs = require('fs'), cp = require('child_process'), path = require('path'), http = require('http');
const MiniWS = require('./minws.js');
const SHOTS = __dirname;

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}

(async () => {
  const url = process.argv[2];
  const expr = process.argv[3] || 'document.title';
  const shot = process.argv[4] || '';
  const waitMs = parseInt(process.argv[5] || '2500', 10);
  if (!url) { console.log('usage: node cdp-eval.js <url> <expr> [screenshot] [waitMs]'); process.exit(2); }

  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const port = 9333 + Math.floor(Math.random() * 200);
  const profile = path.join(process.env.TEMP, 'dsh-cdp-' + port);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--window-size=500,900', url], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', d => { stderr += d.toString(); });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise(r => setTimeout(r, 300));
    try { const list = await getJSON('http://127.0.0.1:' + port + '/json/list'); target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {}
  }
  if (!target) { console.log('NO_TARGET ' + stderr.slice(-400)); try { chrome.kill(); } catch (e) {} process.exit(1); }

  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  const logs = [];
  function send(method, params) {
    return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  }
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push({ level: m.params.type, text: (m.params.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ') });
    if (m.method === 'Runtime.exceptionThrown') logs.push({ level: 'EXCEPTION', text: (m.params.exceptionDetails.text || '') + ' ' + ((m.params.exceptionDetails.exception || {}).description || '') });
  });
  ws.on('open', async () => {
    try {
      await send('Runtime.enable');
      await send('Page.enable');
      await new Promise(r => setTimeout(r, waitMs));
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) console.log('EVAL_EXCEPTION ' + r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
      else console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value));
      if (shot) {
        const s = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(SHOTS, shot), Buffer.from(s.data, 'base64'));
      }
    } catch (e) { console.log('ERR ' + e.message); }
    const bad = logs.filter(l => l.level === 'EXCEPTION' || l.level === 'error');
    console.log('CONSOLE_ERRORS=' + bad.length);
    bad.slice(0, 8).forEach(l => console.log('  [' + l.level + '] ' + l.text.slice(0, 220)));
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); try { chrome.kill(); } catch (e2) {} process.exit(1); });
  ws.connect();
})();
