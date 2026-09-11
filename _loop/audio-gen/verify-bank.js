'use strict';
// Independent second-opinion checker for the meme bank.
// Parses every WAV by hand (does NOT import gen-memes.js) and validates the
// manifest contract. "near zero" = |sample| <= 0.005 full scale (-46 dBFS).
const fs = require('fs'), path = require('path');
const DIR = path.resolve(__dirname, '..', '..', 'games', 'audio', 'memes');
const NEAR_ZERO = 0.005;
const EVENTS = ['blunder','capture','check','checkmate','castle','promote','win','lose','draw','start','undo','hint','combo3'];

function parseWav(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  if (b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not WAVE');
  if (b.toString('ascii', 12, 16) !== 'fmt ') throw new Error('no fmt chunk');
  if (b.toString('ascii', 36, 40) !== 'data') throw new Error('no data chunk');
  const dataSize = b.readUInt32LE(40);
  const o = {
    riffSize: b.readUInt32LE(4), fmtSize: b.readUInt32LE(16), audioFormat: b.readUInt16LE(20),
    channels: b.readUInt16LE(22), sampleRate: b.readUInt32LE(24), byteRate: b.readUInt32LE(28),
    blockAlign: b.readUInt16LE(32), bits: b.readUInt16LE(34), dataSize, bytes: b.length
  };
  o.samples = new Int16Array(dataSize / 2);
  for (let i = 0; i < o.samples.length; i++) o.samples[i] = b.readInt16LE(44 + i * 2);
  let peak = 0;
  for (const v of o.samples) peak = Math.max(peak, Math.abs(v) / 32767);
  o.peakDb = 20 * Math.log10(peak);
  let head = 0, tail = 0;
  for (let i = 0; i < 40; i++) { head = Math.max(head, Math.abs(o.samples[i]) / 32767); tail = Math.max(tail, Math.abs(o.samples[o.samples.length - 1 - i]) / 32767); }
  o.head = head; o.tail = tail;
  o.sec = o.samples.length / o.sampleRate;
  return o;
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
let fails = 0, clips = 0, referenced = new Set(), total = 0;
const rows = [];
for (const pack of manifest.packs) {
  if (!(pack.sounds.length >= 5 && pack.sounds.length <= 8)) { fails++; console.log('FAIL pack size ' + pack.id); }
  for (const s of pack.sounds) {
    clips++;
    const p = path.join(DIR, s.file);
    if (!fs.existsSync(p)) { fails++; console.log('FAIL missing ' + s.file); continue; }
    referenced.add(s.file);
    const raw = fs.readFileSync(p); total += raw.length;
    const w = parseWav(raw);
    const checks = [
      ['pcm16', w.audioFormat === 1 && w.bits === 16],
      ['mono', w.channels === 1],
      ['sr22050', w.sampleRate === 22050],
      ['byteRate', w.byteRate === 44100 && w.blockAlign === 2],
      ['sizes', w.riffSize === 36 + w.dataSize && w.bytes === 44 + w.dataSize],
      ['dur', w.sec >= 0.18 && w.sec <= 1.6],
      ['peak', w.peakDb >= -4 && w.peakDb <= -2],
      ['endsNearZero', w.head <= NEAR_ZERO && w.tail <= NEAR_ZERO],
      ['under60k', raw.length <= 60 * 1024],
      ['event', EVENTS.indexOf(s.when) !== -1],
      ['label<=22', s.label.length <= 22]
    ];
    const bad = checks.filter(c => !c[1]).map(c => c[0]);
    if (bad.length) { fails++; console.log('FAIL ' + s.file + ' -> ' + bad.join(',')); }
    rows.push({ file: s.file, bytes: raw.length, samples: w.samples.length, sec: +w.sec.toFixed(3), peakDb: +w.peakDb.toFixed(2), head: w.head, tail: w.tail });
  }
}
const onDisk = fs.readdirSync(DIR).filter(f => f.endsWith('.wav'));
const orphans = onDisk.filter(f => !referenced.has(f));
if (orphans.length) { fails++; console.log('FAIL orphans: ' + orphans.join(',')); }
for (const r of rows) console.log(r.file.padEnd(26) + String(r.bytes).padStart(7) + ' B  ' + String(r.samples).padStart(6) + ' smp  ' + r.sec.toFixed(3) + 's  peak ' + r.peakDb.toFixed(2) + ' dBFS  head ' + r.head.toFixed(5) + '  tail ' + r.tail.toFixed(5));
console.log('---');
console.log('clips=' + clips + ' wav_on_disk=' + onDisk.length + ' total=' + total + ' bytes (' + (total / 1024).toFixed(1) + ' KB) packs=' + manifest.packs.length);
console.log('max head=' + Math.max(...rows.map(r => r.head)).toFixed(5) + '  max tail=' + Math.max(...rows.map(r => r.tail)).toFixed(5) + '  max file=' + Math.max(...rows.map(r => r.bytes)) + ' bytes');
console.log(fails === 0 ? 'INDEPENDENT CHECK PASS' : 'INDEPENDENT CHECK FAIL (' + fails + ')');
if (fails) process.exitCode = 1;
