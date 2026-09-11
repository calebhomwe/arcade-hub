// cdp.js — serve arcade-hub, drive real Chrome, run a probe page, report JSON + screenshot
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub';
const SHOTS = path.join(ROOT, '_loop', 'shots');
const PORT = 8137;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(ROOT, u.replace(/^\//,''));
  fs.readFile(f, (e,d)=>{
    if (e) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'});
    res.end(d);
  });
});
function getJSON(url){ return new Promise((res,rej)=>{ http.get(url, r=>{ let s=''; r.on('data',c=>s+=c); r.on('end',()=>{ try{res(JSON.parse(s));}catch(e){rej(e);} }); }).on('error',rej); }); }

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const profile = path.join(process.env.TEMP, 'dsh-cdp-profile');
  const page = process.argv[2] || '_loop/shots/probe.html';
  const url = 'http://127.0.0.1:' + PORT + '/' + page;
  const args = ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--mute-audio',
    '--remote-debugging-port=9222','--user-data-dir=' + profile, '--window-size=488,1055', url];
  const chrome = cp.spawn(CHROME, args, { stdio: ['ignore','ignore','pipe'] });
  let stderr = ''; chrome.stderr.on('data', d => { stderr += d.toString(); });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await new Promise(r => setTimeout(r, 300));
    try { const list = await getJSON('http://127.0.0.1:9222/json/list');
      target = list.find(t => t.type === 'page' && t.url.indexOf(page.split('/').pop()) >= 0) || list.find(t => t.type === 'page'); } catch (e) {}
  }
  if (!target) { console.log('NO_TARGET\n' + stderr.slice(-1500)); process.exit(1); }

  const MiniWS = require(path.join(SHOTS, 'minws.js'));
  const ws = new MiniWS(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0; const logs = [];
  function send(method, params) {
    return new Promise((res, rej) => { const i = ++id; pending.set(i, {res, rej}); ws.send(JSON.stringify({id:i, method, params})); });
  }
  ws.on('message', raw => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result); return; }
    if (m.method === 'Runtime.consoleAPICalled') logs.push({ level: m.params.type, args: (m.params.args||[]).map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)) });
    if (m.method === 'Runtime.exceptionThrown') logs.push({ level: 'EXCEPTION', args: [ (m.params.exceptionDetails.text||'') + ' ' + ((m.params.exceptionDetails.exception||{}).description||'') ] });
  });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  await send('Runtime.enable'); await send('Page.enable');

  async function evaluate(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + ((r.exceptionDetails.exception||{}).description||''));
    return r.result.value;
  }
  let probe = null;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { probe = await evaluate('window.__PROBE || null'); } catch (e) {}
    if (probe) break;
  }
  if (probe) { try { console.log(JSON.stringify(JSON.parse(probe), null, 1)); } catch (e) { console.log(probe); } }
  else console.log('PROBE_TIMEOUT');

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOTS, 'probe.png'), Buffer.from(shot.data, 'base64'));

  const uncaught = logs.filter(l => l.level === 'EXCEPTION' || l.level === 'error');
  console.log('CONSOLE_ERRORS=' + uncaught.length);
  for (const l of uncaught.slice(0, 15)) console.log('  [' + l.level + '] ' + l.args.join(' ').slice(0, 400));
  try { ws.close(); } catch (e) {}
  chrome.kill(); server.close(); process.exit(0);
})();
