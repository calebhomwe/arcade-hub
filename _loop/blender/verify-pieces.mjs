// verify-pieces.mjs -- stdlib-only receipts for the chess-piece sprite set.
// Usage: node verify-pieces.mjs [piecesDir] [--json]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { decodePNG, alphaBBox } from './pnglib.mjs';

const DIR = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : 'C:/Users/caleb/AppData/Local/arcade-hub/games/assets/pieces';
const JSON_OUT = process.argv.includes('--json');

const IDS = [];
for (const c of ['w', 'b'])
  for (const p of ['pawn', 'bishop', 'knight', 'rook', 'queen', 'king'])
    IDS.push(c + '_' + p);

const ALPHA_OPAQUE = 8;       // matches Blender ALPHA_THRESHOLD
const GRAIN_ALPHA = 250;      // interior mask: alpha >= this
const FLAT_GRAD = 1.5;        // per-pixel |dL/dx|+|dL/dy| below this = "flat lit"
const GRAIN_MAX = 1.20;       // flat-region Laplacian RMS, 0..255 units
const LINE = '-'.repeat(96);

function stats(img) {
  const { width: W, height: H, data } = img;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++)
    L[i] = 0.2126*data[i*4] + 0.7152*data[i*4+1] + 0.0722*data[i*4+2];
  const op = (x, y) => data[(y*W+x)*4+3] >= GRAIN_ALPHA;
  let n = 0, s2 = 0, fn = 0, fs2 = 0, big = 0;
  const lum = [];
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++)
      if (!op(x+dx, y+dy)) { ok = 0; break; }
    if (!ok) continue;
    const i = y*W + x;
    const lap = L[i] - 0.25*(L[i+1] + L[i-1] + L[i+W] + L[i-W]);
    n++; s2 += lap*lap; lum.push(L[i]);
    if (Math.abs(lap) > 4) big++;
    const gx = Math.abs(L[i+1]-L[i-1]), gy = Math.abs(L[i+W]-L[i-W]);
    if (gx + gy < FLAT_GRAD) { fn++; fs2 += lap*lap; }
  }
  lum.sort((a, b) => a - b);
  const pct = (p) => lum.length ? lum[Math.min(lum.length-1, Math.floor(lum.length*p))] : 0;
  return {
    lapRms: Math.sqrt(s2/n), fracBig: big/n, flatN: fn,
    flatRms: fn ? Math.sqrt(fs2/fn) : 0,
    p10: pct(0.10), p50: pct(0.50), p90: pct(0.90), p99: pct(0.99),
  };
}

function coverage(img) {
  const { data } = img;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > ALPHA_OPAQUE) n++;
  return n / (data.length / 4);
}

function borderWorst(img) {
  const { width: W, height: H, data } = img;
  let worst = 0;
  const check = (x, y) => { const a = data[(y*W + x)*4 + 3]; if (a > worst) worst = a; };
  for (let x = 0; x < W; x++) { check(x, 0); check(x, H-1); }
  for (let y = 0; y < H; y++) { check(0, y); check(W-1, y); }
  return worst;
}

const errors = [], rows = [];
const hashes = new Map();

for (const id of IDS) {
  const file = path.join(DIR, id + '.png');
  const r = { id, file: id + '.png' };
  if (!fs.existsSync(file)) { errors.push(id + ': MISSING'); rows.push(r); continue; }
  const buf = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  r.bytes = buf.length; r.sha = sha.slice(0, 12);
  r.pngSig = buf.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (!r.pngSig) errors.push(id + ': bad PNG signature');
  const img = decodePNG(buf);
  r.w = img.width; r.h = img.height; r.colorType = img.colorType; r.bitDepth = img.bitDepth;
  if (img.width !== 512 || img.height !== 512) errors.push(id + ': not 512x512 -> ' + img.width + 'x' + img.height);
  if (img.colorType !== 6) errors.push(id + ': colour type ' + img.colorType + ' (want 6/RGBA)');
  if (img.bitDepth !== 8) errors.push(id + ': bit depth ' + img.bitDepth);
  const bb = alphaBBox(img, ALPHA_OPAQUE);
  r.bbox = bb ? [bb.x, bb.y, bb.w, bb.h] : null;
  if (!bb) { errors.push(id + ': no opaque pixels'); rows.push(r); continue; }
  r.coverage = coverage(img);
  if (r.coverage < 0.04 || r.coverage > 0.70)
    errors.push(id + ': alpha coverage ' + (r.coverage*100).toFixed(1) + '% outside 4-70%');
  r.borderMax = borderWorst(img);
  if (r.borderMax > ALPHA_OPAQUE) errors.push(id + ': content touches border (alpha ' + r.borderMax + ')');
  Object.assign(r, stats(img));
  if (r.flatRms > GRAIN_MAX)
    errors.push(id + ': flat-region grain ' + r.flatRms.toFixed(3) + ' > ' + GRAIN_MAX);
  const prev = hashes.get(sha);
  if (prev) errors.push(id + ': duplicate file bytes of ' + prev);
  hashes.set(sha, id);
  rows.push(r);
}

const present = rows.filter(r => r.bbox);
const baselines = present.map(r => r.bbox[1] + r.bbox[3]);
const baselineSpread = baselines.length ? Math.max(...baselines) - Math.min(...baselines) : -1;
const heightOrder = ['pawn', 'bishop', 'knight', 'rook', 'queen', 'king'];
const wHeights = heightOrder.map(p => { const r = rows.find(x => x.id === 'w_' + p); return { p, h: r && r.bbox ? r.bbox[3] : -1 }; });
const heightsIncreasing = wHeights.every((v, i, a) => i === 0 || v.h > a[i-1].h);
if (baselineSpread > 6) errors.push('baseline spread ' + baselineSpread + 'px exceeds 6px');
if (!heightsIncreasing)
  errors.push('white height order not increasing: ' + wHeights.map(v => v.p + '=' + v.h).join(' < '));

const out = { dir: DIR, count: rows.length, baselineSpread, heightsIncreasing, whiteHeights: wHeights,
              grainThreshold: GRAIN_MAX, errors, rows };
if (JSON_OUT) console.log(JSON.stringify(out, null, 1));
else {
  console.log(LINE);
  console.log('PIECE VERIFICATION  ' + DIR);
  console.log(LINE);
  console.log('id        bytes  sha        sig  size       type  cover   bbox[x,y,w,h]          brd  flatGrain  lapRMS  p10/p50/p90/p99 luma');
  for (const r of rows) {
    if (!r.bbox) { console.log(r.id.padEnd(9) + ' ' + (r.bytes||0).toString().padStart(6) + '  MISSING/EMPTY'); continue; }
    console.log(r.id.padEnd(9) + ' ' + String(r.bytes).padStart(6) + '  ' + r.sha.padEnd(10) + ' ' +
      (r.pngSig ? 'OK ' : 'BAD') + '  ' + (r.w+'x'+r.h).padEnd(10) + ' ' + String(r.colorType).padEnd(5) + ' ' +
      (r.coverage*100).toFixed(1).padStart(5) + '%  [' + r.bbox.join(',').padEnd(20) + '] ' +
      String(r.borderMax).padStart(3) + '  ' + r.flatRms.toFixed(3).padStart(8) + '  ' +
      r.lapRms.toFixed(2).padStart(6) + '  ' +
      [r.p10,r.p50,r.p90,r.p99].map(v=>v.toFixed(0).padStart(3)).join('/'));
  }
  console.log(LINE);
  console.log('distinct files (sha256)   : ' + hashes.size + ' / ' + present.length);
  console.log('shared baseline spread    : ' + baselineSpread + ' px  (limit 6)');
  console.log('white heights (px)        : ' + wHeights.map(v => v.p + '=' + v.h).join(' < ') + '  -> increasing=' + heightsIncreasing);
  const fg = present.map(r => r.flatRms);
  console.log('flat-region grain (max)   : ' + (fg.length?Math.max(...fg):-1).toFixed(3) + '  (limit ' + GRAIN_MAX + ' = high-frequency Laplacian RMS in flat-lit interior)');
  console.log('ERRORS   : ' + (errors.length ? errors.length : 'none'));
  for (const e of errors) console.log('   ! ' + e);
  console.log(LINE);
}
process.exit(errors.length ? 1 : 0);
