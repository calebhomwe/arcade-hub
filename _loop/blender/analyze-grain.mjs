import fs from 'node:fs';
import { decodePNG, encodePNG } from './pnglib.mjs';
const raw = process.argv.slice(2);
const cropIdx = raw.indexOf('--crop');
const files = cropIdx < 0 ? raw : raw.slice(0, cropIdx);
const cropArgs = cropIdx < 0 ? null : raw.slice(cropIdx + 1).map(Number); // x0 y0 w h scale

function gray(img) {
  const { width: W, height: H, data } = img;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.2126*data[i*4] + 0.7152*data[i*4+1] + 0.0722*data[i*4+2];
  return L;
}
function metrics(f) {
  const img = decodePNG(fs.readFileSync(f));
  const { width: W, height: H, data } = img;
  const L = gray(img);
  const op = (x,y) => data[(y*W+x)*4+3] >= 250;
  let n=0, s2=0, fn=0, fs2=0, fmed=[];
  for (let y = 2; y < H-2; y++) for (let x = 2; x < W-2; x++) {
    let ok = 1;
    for (let dy=-1; dy<=1 && ok; dy++) for (let dx=-1; dx<=1; dx++) if (!op(x+dx,y+dy)) { ok=0; break; }
    if (!ok) continue;
    const i = y*W+x;
    const lap = L[i] - 0.25*(L[i+1]+L[i-1]+L[i+W]+L[i-W]);
    n++; s2 += lap*lap;
    const gx = Math.abs(L[i+1]-L[i-1]), gy = Math.abs(L[i+W]-L[i-W]);
    if (gx + gy < 1.5) { fn++; fs2 += lap*lap; fmed.push(Math.abs(lap)); }
  }
  fmed.sort((a,b)=>a-b);
  return { n, lapRms: Math.sqrt(s2/n), flatN: fn,
           flatRms: fn ? Math.sqrt(fs2/fn) : -1,
           flatMed: fn ? fmed[fn>>1] : -1 };
}
for (const f of files) {
  try {
    const r = metrics(f);
    console.log(f.padEnd(26), 'interior=' + String(r.n).padStart(6),
      'lapRMS=' + r.lapRms.toFixed(3),
      '| flat px=' + String(r.flatN).padStart(6), 'flatLapRMS=' + r.flatRms.toFixed(3),
      'flatMed=' + r.flatMed.toFixed(2));
  } catch (e) { console.log(f, 'ERR', e.message); }
}
if (cropArgs) {
  const src = files[0];
  const [x0, y0, cw, ch, scale] = cropArgs;
  const img = decodePNG(fs.readFileSync(src));
  const out = new Uint8Array(cw*scale*ch*scale*4);
  for (let y=0;y<ch*scale;y++) for (let x=0;x<cw*scale;x++) {
    const sx = Math.min(img.width-1, x0 + Math.floor(x/scale));
    const sy = Math.min(img.height-1, y0 + Math.floor(y/scale));
    const si = (sy*img.width+sx)*4, di=(y*(cw*scale)+x)*4;
    for (let k=0;k<4;k++) out[di+k]=img.data[si+k];
  }
  const p = src.replace(/\.png$/, '_crop.png');
  fs.writeFileSync(p, encodePNG(cw*scale, ch*scale, out));
  console.log('wrote', p, cw*scale+'x'+ch*scale);
}
