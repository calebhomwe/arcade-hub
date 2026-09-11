const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='C:\\Users\\caleb\\AppData\\Local\\arcade-hub';
const M={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
http.createServer((q,r)=>{
  let u=decodeURIComponent(q.url.split('?')[0]);
  if(u==='/')u='/index.html';
  const rel=u.replace(/^[/\\]+/,'');
  const f=path.join(ROOT,rel);
  fs.readFile(f,(e,d)=>{ if(e){ console.error('404',rel); r.writeHead(404); r.end('not found: '+rel); return; }
    r.writeHead(200,{'Content-Type':M[path.extname(f).toLowerCase()]||'application/octet-stream'}); r.end(d); });
}).listen(8137,'127.0.0.1',()=>console.error('serving',ROOT,'on 8137'));