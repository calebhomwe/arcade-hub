'use strict';
// Trim the 2-5s model-generated takes into short, punchy chess cues.
const fs = require('fs'), path = require('path');
const RAW = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub\\_loop\\audio-gen\\raw';
const OUT = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub\\games\\audio\\chess\\natural';
const SRC = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub\\games\\audio\\chess';
const MAP = [
  ['move_pawn', 'move', 260], ['move_piece', 'move-2', 260],
  ['capture_light', 'capture', 340], ['capture_heavy', 'capture-2', 380],
  ['castle', 'castle', 360], ['check', 'check', 600], ['promote', 'promote', 1000],
  ['illegal', 'illegal', 300], ['mate_win', 'game-end-win', 1400], ['mate_lose', 'game-end-loss', 1400],
  ['ui_click', 'ui-click', 200], ['ui_hover', 'ui-hover', 160]
];
const COPY = [['game-start.wav', 'game-start', 300], ['low-time-tick.wav', 'low-time-tick', 60]];

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not wav ' + file);
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4), size = b.readUInt32LE(pos + 4);
    const body = b.slice(pos + 8, pos + 8 + size);
    if (id === 'fmt ') fmt = { channels: body.readUInt16LE(2), rate: body.readUInt32LE(4), bits: body.readUInt16LE(14) };
    else if (id === 'data') data = body;
    pos += 8 + size + (size % 2);
  }
  const n = data.length / 2, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = data.readInt16LE(i * 2) / 32768;
  return { fmt, samples: s, rate: fmt.rate };
}

function writeWav(file, samples, rate) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

function envelope(s, rate, winMs) {
  const w = Math.max(1, Math.floor(rate * winMs / 1000)), out = [];
  for (let i = 0; i + w <= s.length; i += w) {
    let sum = 0;
    for (let j = 0; j < w; j++) sum += s[i + j] * s[i + j];
    out.push(Math.sqrt(sum / w));
  }
  return out;
}

function centroid(s, rate, ms) {
  const n = Math.min(s.length, Math.floor(rate * ms / 1000));
  if (n < 32) return 0;
  let num = 0, den = 0;
  for (let k = 1; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const a = -2 * Math.PI * k * i / n; re += s[i] * Math.cos(a); im += s[i] * Math.sin(a); }
    const mag = Math.sqrt(re * re + im * im);
    num += mag * k * rate / n; den += mag;
  }
  return den ? num / den : 0;
}

fs.mkdirSync(OUT, { recursive: true });
const report = [];
function process(name, outId, maxMs, sourceFile) {
  const w = readWav(sourceFile);
  const env = envelope(w.samples, w.rate, 2);
  let peak = 0; for (const v of env) peak = Math.max(peak, v);
  const floor = peak * 0.02;
  let start = 0; while (start < env.length && env[start] < floor) start++;
  let end = env.length - 1; while (end > start && env[end] < floor) end--;
  const onset = Math.max(0, start - 1);
  const tailMs = outId.indexOf('game-end') === 0 ? 320 : 70;
  let endSample = Math.min(w.samples.length, (end + 1) * Math.floor(w.rate * 0.002) + Math.floor(w.rate * tailMs / 1000));
  const maxSamples = Math.floor(w.rate * maxMs / 1000);
  if (endSample - onset * Math.floor(w.rate * 0.002) > maxSamples) endSample = onset * Math.floor(w.rate * 0.002) + maxSamples;
  const from = onset * Math.floor(w.rate * 0.002);
  const slice = w.samples.slice(from, endSample);
  // fades
  const fi = Math.floor(w.rate * 0.004), fo = Math.floor(w.rate * (outId.indexOf('game-end') === 0 ? 0.12 : 0.045));
  for (let i = 0; i < Math.min(fi, slice.length); i++) slice[i] *= i / fi;
  for (let i = 0; i < Math.min(fo, slice.length); i++) slice[slice.length - 1 - i] *= i / fo;
  // peak normalise to -3.5 dBFS
  let p = 0; for (const v of slice) p = Math.max(p, Math.abs(v));
  const target = Math.pow(10, -3.5 / 20);
  const gain = p > 0 ? target / p : 1;
  for (let i = 0; i < slice.length; i++) slice[i] *= gain;
  const dest = path.join(OUT, outId + '.wav');
  writeWav(dest, slice, w.rate);
  report.push({ id: outId, from: name, onsetMs: Math.round(from / w.rate * 1000), ms: Math.round(slice.length / w.rate * 1000), kb: (fs.statSync(dest).size / 1024).toFixed(1), centroidHz: Math.round(centroid(slice, w.rate, 30)), peakDb: (20 * Math.log10(Math.max(...Array.from(slice, Math.abs)))).toFixed(2) });
}
for (const [src, id, ms] of MAP) process(src, id, ms, path.join(RAW, src + '.wav'));
for (const [file, id, ms] of COPY) process(id, id, ms, path.join(SRC, file));
console.log('id'.padEnd(14) + 'from'.padEnd(16) + 'onset'.padStart(7) + 'ms'.padStart(7) + 'kb'.padStart(8) + 'centroid'.padStart(10) + 'peak'.padStart(8));
for (const r of report) console.log(r.id.padEnd(14) + r.from.padEnd(16) + String(r.onsetMs).padStart(7) + String(r.ms).padStart(7) + String(r.kb).padStart(8) + String(r.centroidHz).padStart(10) + String(r.peakDb).padStart(8));
