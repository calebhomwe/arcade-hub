'use strict';
/*
 * verify-memes2.js - fully independent second-opinion measurement of the meme
 * bank. Deliberately shares no code with level-memes.js: its own RIFF walker,
 * its own 10 ms envelope and a different onset rule (contiguous loud run around
 * the peak). If the two scripts agree, the numbers are cross-checked rather
 * than self-reported.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DIR = path.resolve(__dirname, '..', '..', 'games', 'audio', 'memes');
const MANIFEST = path.join(DIR, 'manifest.json');
const RATE = 44100;

function readRIFF(file) {
  const b = fs.readFileSync(file);
  if (b.slice(0, 4).toString('latin1') !== 'RIFF') throw new Error('not RIFF');
  let p = 12, fmt = null, dat = null;
  while (p + 8 <= b.length) {
    const tag = b.slice(p, p + 4).toString('latin1');
    const len = b.readUInt32LE(p + 4);
    if (tag === 'fmt ') fmt = { form: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    else if (tag === 'data') dat = b.slice(p + 8, p + 8 + len);
    p += 8 + len + (len & 1);
  }
  if (!fmt || !dat) throw new Error('missing chunks');
  const n = Math.floor(dat.length / (fmt.ch * (fmt.bits / 8)));
  const out = [];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * (fmt.bits / 8);
      v += fmt.bits === 16 ? dat.readInt16LE(o) / 32768 : 0;
    }
    out.push(v / fmt.ch);
  }
  return { fmt, samples: out };
}
function decode(file) {
  if (/\.wav$/i.test(file)) return readRIFF(file);
  const raw = execFileSync('C:\\Users\\caleb\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe', ['-v','error','-i',file,'-ac','1','-ar',String(RATE),'-f','f32le','-'], { maxBuffer: 512*1024*1024 });
  const s = []; for (let i = 0; i + 4 <= raw.length; i += 4) s.push(raw.readFloatLE(i));
  return { fmt: { form: 1, ch: 1, rate: RATE, bits: 16 }, samples: s };
}
function stats(s, rate) {
  let peak = 0, sq = 0;
  for (const x of s) { const a = Math.abs(x); if (a > peak) peak = a; sq += x * x; }
  const peakDb = peak ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = s.length ? 20 * Math.log10(Math.sqrt(sq / s.length) + 1e-12) : -Infinity;
  const W = Math.max(1, Math.round(rate * 0.01));
  const env = [];
  for (let i = 0; i + W <= s.length; i += W) { let e = 0; for (let j = 0; j < W; j++) e += s[i + j] * s[i + j]; env.push(Math.sqrt(e / W)); }
  let pmax = 0; for (const e of env) if (e > pmax) pmax = e;
  const thr = pmax * 0.035;   // ~ -29 dB below the loudest 10 ms frame
  let a = -1, b = -1;
  for (let i = 0; i < env.length; i++) if (env[i] >= thr) { a = i; break; }
  for (let i = env.length - 1; i >= 0; i--) if (env[i] >= thr) { b = i; break; }
  if (a < 0) { a = 0; b = 0; }
  const onset = (a * W) / rate * 1000;
  const end = ((b + 1) * W) / rate * 1000;
  const dur = s.length / rate * 1000;
  return { dur, peakDb, rmsDb, onset, meaning: end - onset, lead: onset, tail: Math.max(0, dur - end) };
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const seen = new Map();
let fails = 0, clips = 0;
console.log('fmt'.padEnd(6) + 'file'.padEnd(30) + 'rate'.padStart(6) + 'dur_ms'.padStart(8) + 'peakdB'.padStart(8) + 'rmsdB'.padStart(8) + 'onset_ms'.padStart(9) + 'mean_ms'.padStart(8) + 'lead'.padStart(6) + 'tail'.padStart(6) + '  checks');
console.log('-'.repeat(110));
for (const pack of manifest.packs) {
  for (const s of pack.sounds) {
    clips++;
    const fp = path.join(DIR, s.file);
    const bad = [];
    if (!fs.existsSync(fp)) { console.log('  MISSING ' + s.file); fails++; continue; }
    if (seen.has(s.file)) bad.push('dup'); seen.set(s.file, pack.id + '/' + s.id);
    const isWav = /\.wav$/i.test(s.file);
    const d = decode(fp);
    const st = stats(d.samples, d.fmt.rate);
    if (isWav && !(d.fmt.form === 1 && d.fmt.bits === 16)) bad.push('notpcm16');
    if (!isWav) bad.push('mp3-kept');
    if (st.dur < 30 || st.dur > 4000) bad.push('dur');
    if (st.peakDb < -4 || st.peakDb > -3) bad.push('peak');
    if (!/^[a-z0-9]+_/.test(s.file)) bad.push('name');
    if (typeof s.ms !== 'number' || Math.abs(s.ms - st.dur) > 5) bad.push('ms');
    if (bad.length) fails++;
    console.log((isWav ? 'pcm' : 'mp3').padEnd(6) + s.file.padEnd(30) + String(d.fmt.rate).padStart(6) + st.dur.toFixed(0).padStart(8) + (st.peakDb === -Infinity ? '-inf' : st.peakDb.toFixed(2)).padStart(8) + (st.rmsDb === -Infinity ? '-inf' : st.rmsDb.toFixed(2)).padStart(8) + st.onset.toFixed(0).padStart(9) + st.meaning.toFixed(0).padStart(8) + st.lead.toFixed(0).padStart(6) + st.tail.toFixed(0).padStart(6) + '  ' + (bad.length ? 'FAIL:' + bad.join(',') : 'ok'));
  }
}
console.log('---');
console.log('clips=' + clips + ' duplicate-targets=' + (clips - seen.size) + ' fails=' + fails);
console.log(fails === 0 ? 'INDEPENDENT PASS' : 'INDEPENDENT FAIL');
if (fails) process.exitCode = 1;
