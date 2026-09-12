// engine-verify.js - independent chess engine verification harness.
// Starts its own static server for the repo, loads games/chess.html in real headless
// Chrome, and runs engine-verify-inpage.js against the page's own engine functions.
// usage: node engine-verify.js [url] [inpageFile] [waitMs]
const fs = require('fs'), cp = require('child_process'), path = require('path'), http = require('http');
const MiniWS = require('./minws.js');

const REPO = path.resolve(__dirname, '..', '..');
const crypto = require('crypto');
const CHESS = path.join(REPO, 'games', 'chess.html');
function sha256File(p) { try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (e) { return 'ERR:' + e.message; } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' };

function getJSON(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let s = ''; r.on('data', c => s += c); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((q, r) => {
      let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/') u = '/index.html';
      const f = path.join(REPO, u.replace(/^[/\\]+/, ''));
      fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end('not found'); return; }
        r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
        r.end(d);
      });
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const explicitUrl = process.argv[2] || '';
  const bodyFile = process.argv[3] || path.join(__dirname, 'engine-verify-inpage.js');
  const waitMs = parseInt(process.argv[4] || '4000', 10);
  const body = fs.readFileSync(bodyFile, 'utf8');
  const expr = '(function(){\n' + body + '\n; return __ENGINE_VERIFY__(); })()';
  const outFile = process.argv[5] || path.join(REPO, '_loop', 'research', 'engine-verify-output.json');

  let srv = null, url = explicitUrl;
  if (!url) {
    const port = 8280 + Math.floor(Math.random() * 300);
    srv = await startServer(port);
    url = 'http://127.0.0.1:' + port + '/games/chess.html';
  }
  console.log('URL=' + url);

  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cport = 9333 + Math.floor(Math.random() * 200);
  const profile = path.join(process.env.TEMP, 'dsh-engine-' + cport);
  const chrome = cp.spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--remote-debugging-port=' + cport, '--user-data-dir=' + profile, '--window-size=500,900', url], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; chrome.stderr.on('data', d => { stderr += d.toString(); });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise(r => setTimeout(r, 300));
    try { const list = await getJSON('http://127.0.0.1:' + cport + '/json/list'); target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl); } catch (e) {}
  }
  if (!target) { console.log('NO_TARGET ' + stderr.slice(-400)); try { chrome.kill(); } catch (e) {} if (srv) srv.close(); process.exit(1); }

  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const logs = [];
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
      const t0 = Date.now();
      const hashBefore = sha256File(CHESS);
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
      const hashAfter = sha256File(CHESS);
      const meta = { url, wallMs: Date.now() - t0, chessSha256Before: hashBefore, chessSha256After: hashAfter, hashStable: hashBefore === hashAfter };
      if (r.exceptionDetails) {
        meta.evalException = r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || '');
        console.log('EVAL_EXCEPTION ' + meta.evalException);
      } else {
        meta.result = r.result.value;
        console.log('WALL_MS=' + meta.wallMs);
        console.log('CHESS_SHA256=' + hashBefore + (hashBefore === hashAfter ? ' (stable)' : ' (CHANGED DURING RUN -> ' + hashAfter + ')'));
        console.log('ALL_PASS=' + (r.result.value && r.result.value.all_pass));
      }
      const bad = logs.filter(l => l.level === 'EXCEPTION' || l.level === 'error');
      meta.consoleErrors = bad.map(l => ({ level: l.level, text: l.text.slice(0, 220) }));
      fs.writeFileSync(outFile, JSON.stringify(meta, null, 1));
      console.log('OUTFILE=' + outFile);
      console.log('CONSOLE_ERRORS=' + bad.length);
    } catch (e) { console.log('ERR ' + e.message); }
    try { ws.close(); } catch (e) {}
    try { chrome.kill(); } catch (e) {}
    if (srv) try { srv.close(); } catch (e) {}
    process.exit(0);
  });
  ws.on('error', e => { console.log('WS_ERR ' + e.message); try { chrome.kill(); } catch (e2) {} if (srv) try { srv.close(); } catch (e3) {} process.exit(1); });
  ws.connect();
})();
