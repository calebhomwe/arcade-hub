'use strict';
/*
 * level-memes.js - audit / trim / level / regenerate / verify the chess meme bank.
 *
 *   node level-memes.js audit    measure every clip on disk and print a table
 *   node level-memes.js inspect  print a coarse dB envelope (structure) per clip
 *   node level-memes.js apply    trim forge MP3s, level synth WAVs, regen weak
 *                                clips, rewrite manifest.json
 *   node level-memes.js verify   re-parse everything the manifest references and
 *                                assert the delivery contract
 *
 * NOTHING IS DOWNLOADED. Audio is either (a) re-levelled / re-trimmed from files
 * that already shipped in this repo, or (b) synthesised from the arithmetic DSP
 * below. Stdlib only.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'games', 'audio', 'memes');
const MANIFEST = path.join(DIR, 'manifest.json');
const TARGET_PEAK_DB = -3.5;
const SRC_RATE = 44100;          // decode rate used for forge measurement
const SR = 22050;                // synth rate, same as gen-memes.js
const ENV_MS = 5;                // envelope window for onset/offset detection
const PEAK_LO = -4, PEAK_HI = -3;
const DUR_LO = 30, DUR_HI = 4000;
const EVENTS = ['blunder','capture','check','checkmate','castle','promote','win','lose','draw','start','undo','hint','combo3'];

/* ------------------------------------------------------------------ ffmpeg */
function ffmpegBin() {
  const cands = [process.env.FFMPEG, 'ffmpeg',
    'C:\\Users\\caleb\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe'];
  for (const c of cands) {
    if (!c) continue;
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch (e) { /* next */ }
  }
  throw new Error('ffmpeg not found');
}
function decodeToFloat(file) {
  const raw = execFileSync(ffmpegBin(),
    ['-v','error','-i', file, '-ac','1','-ar', String(SRC_RATE), '-f','f32le','-'],
    { maxBuffer: 512 * 1024 * 1024 });
  const n = Math.floor(raw.length / 4);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readFloatLE(i * 4);
  return out;
}

/* --------------------------------------------------------------- wav codec */
function parseWavBytes(b) {
  if (b.length < 44) throw new Error('too short');
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not RIFF/WAVE');
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    const body = b.slice(pos + 8, pos + 8 + size);
    if (id === 'fmt ') {
      fmt = { audioFormat: body.readUInt16LE(0), channels: body.readUInt16LE(2),
        sampleRate: body.readUInt32LE(4), byteRate: body.readUInt32LE(8),
        blockAlign: body.readUInt16LE(12), bits: body.readUInt16LE(14) };
    } else if (id === 'data') data = body;
    pos += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt/data');
  const bytesPer = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytesPer * fmt.channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bytesPer; let v;
      if (fmt.bits === 16) v = data.readInt16LE(o) / 32768;
      else if (fmt.bits === 8) v = (data.readUInt8(o) - 128) / 128;
      else if (fmt.bits === 24) v = ((data.readUInt8(o) | (data.readUInt8(o+1) << 8) | (data.readInt8(o+2) << 16)) / 8388608);
      else if (fmt.bits === 32) v = data.readInt32LE(o) / 2147483648;
      else throw new Error('unsupported bits ' + fmt.bits);
      acc += v;
    }
    samples[i] = acc / fmt.channels;
  }
  return { fmt, samples, dataSize: data.length, bytes: b.length };
}
function readWav(file) { return parseWavBytes(fs.readFileSync(file)); }
function toWav16(samples, rate) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}

/* ------------------------------------------------------------- measurement */
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.max(0, Math.min(sorted.length - 1, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}
function measure(s, rate) {
  const n = s.length;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(s[i]); if (a > peak) peak = a; sum += s[i] * s[i]; }
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = n ? 20 * Math.log10(Math.sqrt(sum / n) + 1e-12) : -Infinity;
  const w = Math.max(1, Math.round(rate * ENV_MS / 1000));
  const envDb = [];
  for (let i = 0; i + w <= n; i += w) {
    let e = 0; for (let j = 0; j < w; j++) e += s[i + j] * s[i + j];
    envDb.push(20 * Math.log10(Math.sqrt(e / w) + 1e-12));
  }
  const sorted = envDb.slice().sort((a, b) => a - b);
  const peakEnv = sorted.length ? sorted[sorted.length - 1] : -Infinity;
  const noise = percentile(sorted, 20);
  let gate = Math.max(peakEnv - 34, noise + 8, -58);
  if (gate > peakEnv - 6) gate = peakEnv - 6;
  let a = -1, b2 = -1;
  for (let i = 0; i < envDb.length; i++) if (envDb[i] >= gate) { a = i; break; }
  for (let i = envDb.length - 1; i >= 0; i--) if (envDb[i] >= gate) { b2 = i; break; }
  if (a < 0) { a = 0; b2 = 0; }
  const onsetMs = Math.max(0, (a - 1) * w) / rate * 1000;
  let endMs = Math.min(n, (b2 + 2) * w) / rate * 1000;
  if (endMs < onsetMs) endMs = onsetMs;
  const totalMs = n / rate * 1000;
  return { ms: totalMs, peakDb, rmsDb, onsetMs, endMs, meaningMs: endMs - onsetMs,
    leadSilenceMs: onsetMs, tailSilenceMs: Math.max(0, totalMs - endMs), envDb, win: w, gate };
}
function peakOf(s) { let p = 0; for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > p) p = a; } return p; }
function gainTo(s, db) {
  const target = Math.pow(10, db / 20), p = peakOf(s);
  const o = Float32Array.from(s);
  if (p > 0) { const g = target / p; for (let i = 0; i < o.length; i++) o[i] *= g; }
  return o;
}
function fadeEdges(s, rate, inMs, outMs) {
  const fi = Math.min(s.length, Math.round(rate * inMs / 1000));
  const fo = Math.min(s.length, Math.round(rate * outMs / 1000));
  for (let i = 0; i < fi; i++) s[i] *= i / fi;
  for (let i = 0; i < fo; i++) s[s.length - 1 - i] *= i / fo;
  return s;
}
function db(x) { return x === -Infinity || Number.isNaN(x) ? '   -inf' : x.toFixed(2).padStart(7); }
const pad = (s, n) => String(s).padStart(n);

/* ================================================= synth DSP (regen only) */
function mulberry32(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const nb = (dur) => new Float64Array(Math.max(1, Math.round(dur * SR)));
function wave(type, ph) { if (type === 'saw') return 2 * ph - 1; if (type === 'square') return ph < 0.5 ? 1 : -1; if (type === 'tri') return 4 * Math.abs(ph - 0.5) - 1; return Math.sin(2 * Math.PI * ph); }
function addOsc(a, opt) {
  const type = opt.type || 'sine';
  const f = typeof opt.freq === 'function' ? opt.freq : () => opt.freq;
  const g = opt.gain === undefined ? () => 1 : (typeof opt.gain === 'function' ? opt.gain : () => opt.gain);
  const vibF = opt.vibF || 0, vibD = opt.vibD || 0;
  let ph = opt.phase || 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR; let hz = f(t);
    if (vibD) hz *= 1 + vibD * Math.sin(2 * Math.PI * vibF * t);
    ph += hz / SR; ph -= Math.floor(ph);
    a[i] += wave(type, ph) * g(t);
  }
  return a;
}
function addNoise(a, gainFn, rng) {
  const g = typeof gainFn === 'function' ? gainFn : () => gainFn;
  for (let i = 0; i < a.length; i++) a[i] += (rng() * 2 - 1) * g(i / SR);
  return a;
}
class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  set(type, fc, Q) {
    const w = 2 * Math.PI * clamp(fc, 10, SR * 0.49) / SR;
    const c = Math.cos(w), s = Math.sin(w), alpha = s / (2 * (Q || 0.7071));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    else if (type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
function filt(a, type, fc, Q, passes) {
  for (let p = 0; p < (passes || 1); p++) { const f = new Biquad().set(type, fc, Q); for (let i = 0; i < a.length; i++) a[i] = f.run(a[i]); }
  return a;
}
class SVF { constructor() { this.lo = 0; this.band = 0; } step(x, fc, Q) { const f = 2 * Math.sin(Math.PI * clamp(fc, 20, SR * 0.45) / SR); const q = 1 / (Q || 1); const hi = x - this.lo - q * this.band; this.band += f * hi; this.lo += f * this.band; return this.band; } }
function shape(a, drive, mix) { const m = mix === undefined ? 1 : mix; for (let i = 0; i < a.length; i++) a[i] = lerp(a[i], Math.tanh(a[i] * drive), m); return a; }
function reverb(a, mix, decay) {
  const out = Float64Array.from(a); const delays = [0.0297, 0.0371, 0.0411, 0.0437];
  for (const d of delays) { const D = Math.max(1, Math.round(d * SR)), line = new Float64Array(D); let idx = 0; for (let i = 0; i < a.length; i++) { const y = line[idx]; line[idx] = a[i] + y * decay; idx = (idx + 1) % D; out[i] += y * mix; } }
  return out;
}
function mixIn(t, s, g) { for (let i = 0; i < t.length && i < s.length; i++) t[i] += s[i] * g; return t; }
function ksPluck(dur, f0, rng, damp) {
  const n = Math.round(dur * SR), a = new Float64Array(n), D = Math.max(2, Math.round(SR / f0));
  const line = new Float64Array(D); for (let i = 0; i < D; i++) line[i] = rng() * 2 - 1;
  let idx = 0;
  for (let i = 0; i < n; i++) { const y = line[idx], nxt = (idx + 1) % D; line[idx] = 0.5 * (y + line[nxt]) * damp; a[i] = y; idx = nxt; }
  return a;
}
function finishSynth(s) { fadeEdges(s, SR, 4, 45); const g = gainTo(s, TARGET_PEAK_DB); return g; }

/* =========================================================== regen recipes */
/* These replace clips that measured badly (bare sine sweeps, mostly silence,
 * very low RMS) with modal / FM / noise bodies. Same synth style as
 * gen-memes.js: no sample playback, no downloads. */
const REGEN = {};
REGEN['boom_vineboom.wav'] = (rng) => {
  const a = nb(0.62);
  addOsc(a, { type: 'sine', freq: (t) => 46 + 150 * Math.exp(-t * 16), gain: (t) => Math.exp(-t * 3.6) });
  addOsc(a, { type: 'sine', freq: (t) => (46 + 150 * Math.exp(-t * 16)) * 2.02, gain: (t) => 0.45 * Math.exp(-t * 8) });
  addOsc(a, { type: 'tri', freq: (t) => 46 + 150 * Math.exp(-t * 16), gain: (t) => 0.35 * Math.exp(-t * 4.5) });
  const tr = nb(0.05); for (let i = 0; i < tr.length; i++) tr[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 120);
  filt(tr, 'bp', 1800, 0.8); mixIn(a, tr, 1.1);
  shape(a, 2.0, 0.65); filt(a, 'lp', 2600, 0.7); filt(a, 'hp', 26, 0.7);
  const wet = reverb(a, 0.16, 0.4); for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.86 + wet[i] * 1.0;
  return a;
};
REGEN['boom_boom808.wav'] = (rng) => {
  const a = nb(0.8);
  addOsc(a, { type: 'sine', freq: (t) => 42 + 118 * Math.exp(-t * 9), gain: (t) => Math.exp(-t * 2.1) });
  addOsc(a, { type: 'tri', freq: (t) => (42 + 118 * Math.exp(-t * 9)) * 2.0, gain: (t) => 0.3 * Math.exp(-t * 5.5) });
  const cl = nb(0.02); for (let i = 0; i < cl.length; i++) cl[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 220);
  filt(cl, 'hp', 900, 0.7); mixIn(a, cl, 0.7);
  shape(a, 1.8, 0.55); filt(a, 'lp', 2400, 0.7);
  const wet = reverb(a, 0.14, 0.35); for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.88 + wet[i] * 0.9;
  return a;
};
REGEN['boom_thud.wav'] = (rng) => {
  const a = nb(0.34);
  addOsc(a, { type: 'sine', freq: (t) => 54 + 96 * Math.exp(-t * 22), gain: (t) => Math.exp(-t * 11) });
  addOsc(a, { type: 'tri', freq: (t) => 108 + 192 * Math.exp(-t * 22), gain: (t) => 0.5 * Math.exp(-t * 16) });
  addOsc(a, { type: 'sine', freq: 210, gain: (t) => 0.25 * Math.exp(-t * 26) });
  const n = nb(0.06); for (let i = 0; i < n.length; i++) n[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 90);
  filt(n, 'lp', 900, 0.8); mixIn(a, n, 0.8);
  shape(a, 1.7, 0.55); filt(a, 'lp', 2200, 0.7); return a;
};
REGEN['toon_pop.wav'] = (rng) => {
  const a = nb(0.22);
  addOsc(a, { type: 'sine', freq: (t) => 430 + 90 * Math.exp(-t * 40), gain: (t) => Math.exp(-t * 26) });
  addOsc(a, { type: 'sine', freq: (t) => 980 * (1 + 0.05 * Math.exp(-t * 40)), gain: (t) => 0.6 * Math.exp(-t * 34) });
  addOsc(a, { type: 'tri', freq: (t) => 1650 * (1 + 0.04 * Math.exp(-t * 50)), gain: (t) => 0.35 * Math.exp(-t * 46) });
  const t = nb(0.008); for (let i = 0; i < t.length; i++) t[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 320);
  filt(t, 'bp', 2600, 0.7); mixIn(a, t, 0.7);
  shape(a, 1.3, 0.4); return a;
};
REGEN['toon_squeak.wav'] = (rng) => {
  const a = nb(0.3);
  addOsc(a, { type: 'saw', freq: (t) => 520 + 1500 * Math.min(1, t / 0.15), vibF: 30, vibD: 0.03, gain: (t) => Math.exp(-t * 6) * 0.7 });
  const sv = new SVF();
  for (let i = 0; i < a.length; i++) { const t = i / SR; const fc = 900 + 2600 * Math.min(1, t / 0.15); a[i] = sv.step(a[i], fc, 5) * 1.5; }
  const br = nb(0.3); for (let i = 0; i < br.length; i++) br[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 7);
  filt(br, 'bp', 3200, 0.9); mixIn(a, br, 0.22);
  shape(a, 1.5, 0.5); return a;
};
REGEN['toon_twang.wav'] = (rng) => {
  const a = nb(0.52);
  const p1 = ksPluck(0.5, 247, rng, 0.995), p2 = ksPluck(0.5, 371, rng, 0.993);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR, env = Math.exp(-t * 2.4);
    a[i] = (p1[i] * 0.9 + p2[i] * 0.45) * env;
  }
  filt(a, 'lp', 3600, 0.7); filt(a, 'hp', 130, 0.7);
  addOsc(a, { type: 'sine', freq: (t) => 620 * Math.exp(-t * 7) + 150, gain: (t) => 0.3 * Math.exp(-t * 4) });
  shape(a, 1.2, 0.3); return a;
};
REGEN['gamer_hitmarker.wav'] = (rng) => {
  const a = nb(0.22);
  addOsc(a, { type: 'sine', freq: (t) => 1750 + 400 * Math.exp(-t * 50), gain: (t) => Math.exp(-t * 26) });
  addOsc(a, { type: 'sine', freq: (t) => 3100 + 300 * Math.exp(-t * 60), gain: (t) => 0.5 * Math.exp(-t * 38) });
  addOsc(a, { type: 'sine', freq: 520, gain: (t) => 0.5 * Math.exp(-t * 46) });
  addOsc(a, { type: 'sine', freq: 1450, gain: (t) => 0.35 * Math.exp(-t * 55) });
  const n = nb(0.006); for (let i = 0; i < n.length; i++) n[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 400);
  filt(n, 'hp', 2500, 0.7); mixIn(a, n, 0.6);
  shape(a, 1.3, 0.35); return a;
};
REGEN['victory_crowdroar.wav'] = (rng) => {
  const a = nb(1.4);
  const roar = nb(1.4);
  for (let i = 0; i < roar.length; i++) roar[i] = (rng() * 2 - 1);
  filt(roar, 'bp', 950, 0.5); filt(roar, 'lp', 3000, 0.7);
  for (let i = 0; i < roar.length; i++) { const t = i / SR; roar[i] *= Math.min(1, t / 0.22) * (t > 1.0 ? Math.max(0, (1.4 - t) / 0.4) : 1) * 0.9; }
  mixIn(a, roar, 1.0);
  const cheer = nb(1.4);
  for (const hz of [196, 294, 392, 494]) addOsc(cheer, { type: 'saw', freq: hz, vibF: 6, vibD: 0.02, gain: (t) => 0.16 * Math.min(1, t / 0.3) * (t > 0.9 ? Math.max(0, (1.35 - t) / 0.45) : 1) });
  filt(cheer, 'lp', 2400, 0.8); mixIn(a, cheer, 0.7);
  for (let k = 0; k < 60; k++) { const at = 0.15 + rng() * 1.1, j = Math.round(at * SR); for (let i = 0; i < 700 && j + i < a.length; i++) a[j + i] += (rng() * 2 - 1) * Math.exp(-i / 22) * (0.25 + rng() * 0.4); }
  filt(a, 'hp', 160, 0.7);
  const wet = reverb(a, 0.3, 0.55); for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.8 + wet[i] * 1.0;
  return a;
};

/* ------------------------------------------------------------ forge config */
/* maxMs is a safety cap; the actual cut is the measured onset..offset.
 * outMs is the tail fade. Long-out fades are used where the cap may bite. */
const FORGE = {
  'forge_tension_riser.mp3':  { maxMs: 3200, outMs: 60 },
  'forge_epic_hit.mp3':       { maxMs: 1600, outMs: 160 },
  'forge_glass_shatter.mp3':  { maxMs: 1200, outMs: 220, focusLoud: true },
  'forge_crowd_boo.mp3':      { maxMs: 3000, outMs: 400 },
  'forge_slot_win.mp3':       { maxMs: 2200, outMs: 250 },
  'forge_vine_boom2.mp3':     { maxMs: 1400, outMs: 200 },
  'forge_applause.mp3':       { maxMs: 3900, outMs: 420 },
  'forge_dramatic_sting.mp3': { maxMs: 2400, outMs: 300 },
  'forge_sub_impact.mp3':     { maxMs: 1700, outMs: 260 },
  'forge_buzzer.mp3':         { maxMs: 1200, outMs: 140 },
  'forge_ding.mp3':           { maxMs: 1400, outMs: 420 },
  'forge_coin.mp3':           { maxMs: 1700, outMs: 200 },
  'forge_sad_trombone2.mp3':  { maxMs: 2600, outMs: 300 },
  'forge_airhorn2.mp3':       { maxMs: 1900, outMs: 140 },
  'forge_crowd_gasp.mp3':     { maxMs: 1900, outMs: 260 },
  'forge_cartoon_boom.mp3':   { maxMs: 1300, outMs: 260 },
  'forge_boing2.mp3':         { maxMs: 1200, outMs: 180 },
  'forge_levelup.mp3':        { maxMs: 1800, outMs: 220 },
  'forge_scratch2.mp3':       { maxMs: 1900, outMs: 120 }
};

function trimForge(samples, rate, cfg) {
  const m = measure(samples, rate);
  const env = m.envDb, w = m.win;
  const sorted = env.slice().sort((x, y) => x - y);
  const peakEnv = sorted.length ? sorted[sorted.length - 1] : -Infinity;
  const noise = percentile(sorted, 20);
  const loudGate = Math.min(peakEnv - 6, Math.max(peakEnv - 30, noise + 10, -55));
  const endGate = Math.min(peakEnv - 6, Math.max(peakEnv - 22, noise + 12, -50));
  let first = -1, last = -1, peakIdx = 0, bp = -Infinity;
  for (let i = 0; i < env.length; i++) {
    if (env[i] > bp) { bp = env[i]; peakIdx = i; }
    if (first < 0 && env[i] >= loudGate) first = i;
    if (env[i] >= endGate) last = i;
  }
  if (first < 0) first = 0;
  if (last < first) last = first;
  if (cfg.focusLoud) {
    // keep the one above-gate run that contains the loudest frame
    let j = peakIdx;
    while (j > 0 && env[j - 1] >= loudGate) j--;
    first = j;
  }
  const pre = Math.round(rate * 0.006);
  let a = Math.max(0, first * w - pre);
  let b = Math.min(samples.length, (last + 1) * w + Math.round(rate * 0.03));
  if (b - a < Math.round(rate * DUR_LO / 1000)) b = Math.min(samples.length, a + Math.round(rate * DUR_LO / 1000));
  const cap = Math.round(cfg.maxMs / 1000 * rate);
  if (b - a > cap) b = a + cap;
  if (b > samples.length) b = samples.length;
  if (a > b) a = Math.max(0, b - Math.round(rate * DUR_LO / 1000));
  const out = Float32Array.from(samples.slice(a, b));
  fadeEdges(out, rate, 4, cfg.outMs);
  return { out: gainTo(out, TARGET_PEAK_DB), onsetMs: first * w / rate * 1000, endMs: (last + 1) * w / rate * 1000 };
}

/* ------------------------------------------------------------------ audit */
function entries(manifest) {
  const out = [];
  for (const p of manifest.packs) for (const s of p.sounds) out.push({ pack: p.id, ...s });
  return out;
}
function loadManifest() { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }

function audit() {
  const manifest = loadManifest();
  const files = entries(manifest).map((s) => ({ pack: s.pack, file: s.file, label: s.label }));
  for (const f of fs.readdirSync(DIR)) if (/\.(wav|mp3)$/i.test(f) && !files.some((x) => x.file === f)) files.push({ pack: '(disk)', file: f, label: '' });
  const rows = [];
  for (const f of files) {
    const p = path.join(DIR, f.file);
    if (!fs.existsSync(p)) { rows.push({ ...f, missing: true }); continue; }
    let samples, rate;
    if (/\.wav$/i.test(f.file)) { const w = readWav(p); samples = w.samples; rate = w.fmt.sampleRate; }
    else { samples = decodeToFloat(p); rate = SRC_RATE; }
    rows.push({ ...f, ...measure(samples, rate), rate });
  }
  const H = 'file'.padEnd(30) + 'rate'.padStart(6) + 'dur_ms'.padStart(8) + 'peakdB'.padStart(8) + 'rmsdB'.padStart(8) + 'onset_ms'.padStart(9) + 'mean_ms'.padStart(8) + 'leadSil'.padStart(8) + 'tailSil'.padStart(8);
  console.log(H); console.log('-'.repeat(H.length));
  for (const r of rows) {
    if (r.missing) { console.log(r.file.padEnd(30) + '  MISSING'); continue; }
    console.log(r.file.padEnd(30) + pad(r.rate, 6) + pad(r.ms.toFixed(0), 8) + db(r.peakDb) + db(r.rmsDb) + pad(r.onsetMs.toFixed(0), 9) + pad(r.meaningMs.toFixed(0), 8) + pad(r.leadSilenceMs.toFixed(0), 8) + pad(r.tailSilenceMs.toFixed(0), 8));
  }
  console.log('---');
  console.log('files=' + rows.length + '  wav=' + fs.readdirSync(DIR).filter((f) => f.endsWith('.wav')).length + '  mp3=' + fs.readdirSync(DIR).filter((f) => f.endsWith('.mp3')).length);
}

function inspect() {
  const manifest = loadManifest();
  for (const s of entries(manifest)) {
    const p = path.join(DIR, s.file);
    if (!fs.existsSync(p)) continue;
    let samples, rate;
    if (/\.wav$/i.test(s.file)) { const w = readWav(p); samples = w.samples; rate = w.fmt.sampleRate; }
    else { samples = decodeToFloat(p); rate = SRC_RATE; }
    const step = Math.max(1, Math.round(rate * 0.05));
    const cols = [];
    let peakAll = 0;
    for (let i = 0; i + step <= samples.length; i += step) { let e = 0; for (let j = 0; j < step; j++) e += samples[i + j] * samples[i + j]; e = Math.sqrt(e / step); if (e > peakAll) peakAll = e; }
    for (let i = 0, k = 0; i + step <= samples.length; i += step, k++) {
      let e = 0; for (let j = 0; j < step; j++) e += samples[i + j] * samples[i + j]; e = Math.sqrt(e / step);
      const rel = 20 * Math.log10(e / (peakAll + 1e-12) + 1e-12);
      const ch = rel > -3 ? '#' : rel > -8 ? '=' : rel > -16 ? '+' : rel > -28 ? '.' : rel > -45 ? ':' : ' ';
      cols.push(ch);
    }
    console.log(s.file.padEnd(30) + ' [' + cols.join('') + ']');
  }
}

/* ------------------------------------------------------------------ apply */
function synthSources(manifest) {
  const out = [];
  for (const p of manifest.packs) if (p.id !== 'forge') for (const s of p.sounds) out.push(s.file);
  return out;
}
function apply() {
  const manifest = loadManifest();
  fs.mkdirSync(DIR, { recursive: true });
  const mbak = MANIFEST + '.bak-pre-level';
  if (!fs.existsSync(mbak)) fs.writeFileSync(mbak, fs.readFileSync(MANIFEST));
  const log = [];
  // 1) synth WAVs - level (and regenerate the weak ones)
  for (const file of synthSources(manifest)) {
    const p = path.join(DIR, file);
    if (!fs.existsSync(p)) { log.push(['MISSING', file]); continue; }
    const bak = p + '.bak';
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, fs.readFileSync(p));
    const before = measure(readWav(p).samples, SR);
    if (REGEN[file]) {
      const rng = mulberry32(hash('regen/' + file));
      const done = finishSynth(REGEN[file](rng));
      fs.writeFileSync(p, toWav16(done, SR));
      const after = measure(done, SR);
      log.push(['REGEN', file, before.peakDb.toFixed(2), after.peakDb.toFixed(2), after.ms.toFixed(0)]);
    } else {
      const w = readWav(p);
      const done = gainTo(w.samples, TARGET_PEAK_DB);
      fs.writeFileSync(p, toWav16(done, w.fmt.sampleRate));
      const after = measure(done, w.fmt.sampleRate);
      log.push(['LEVEL', file, before.peakDb.toFixed(2), after.peakDb.toFixed(2), after.ms.toFixed(0)]);
    }
  }
  // 2) forge MP3s - decode, trim, fade, normalise, write .wav
  for (const s of entries(manifest)) {
    if (s.pack !== 'forge') continue;
    const src = /\.mp3$/i.test(s.file) ? s.file : s.file.replace(/_trim\.wav$/i, '.mp3');
    const p = path.join(DIR, src);
    if (!fs.existsSync(p)) { log.push(['MISSING', src]); continue; }
    const cfg = FORGE[src] || { maxMs: 2000, outMs: 120 };
    const dec = decodeToFloat(p);
    const t = trimForge(dec, SRC_RATE, cfg);
    const name = src.replace(/\.mp3$/i, '') + '_trim.wav';
    fs.writeFileSync(path.join(DIR, name), toWav16(t.out, SRC_RATE));
    log.push(['FORGE', src + ' -> ' + name, t.onsetMs.toFixed(0) + 'ms onset', (t.endMs - t.onsetMs).toFixed(0) + 'ms mean', (t.out.length / SRC_RATE * 1000).toFixed(0) + 'ms out']);
  }
  // 3) rewrite manifest: best file, measured ms, unchanged id/when/label
  const out = { version: manifest.version, packs: [] };
  for (const p of manifest.packs) {
    const sounds = [];
    for (const s of p.sounds) {
      let file = s.file, ms;
      if (p.id === 'forge') file = s.file.replace(/_trim\.wav$/i, '').replace(/\.mp3$/i, '') + '_trim.wav';
      const fp = path.join(DIR, file);
      if (!fs.existsSync(fp)) throw new Error('missing ' + file);
      const wv = readWav(fp);
      ms = Math.round(wv.samples.length / wv.fmt.sampleRate * 1000);
      sounds.push({ id: s.id, label: s.label, file, ms, when: s.when });
    }
    out.packs.push({ id: p.id, name: p.name, emoji: p.emoji, desc: p.desc, on: p.on, sounds });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + '\n');
  console.log('step'.padEnd(7) + 'file'.padEnd(40) + 'before-peak'.padStart(12) + 'after-peak'.padStart(12) + 'result');
  console.log('-'.repeat(90));
  for (const r of log) console.log(String(r[0]).padEnd(7) + String(r[1]).padEnd(40) + String(r[2] || '').padStart(12) + String(r[3] || '').padStart(12) + (r[4] !== undefined ? ' ' + r[4] : ''));
  console.log('---');
  console.log('manifest rewritten: ' + MANIFEST);
}

/* ----------------------------------------------------------------- verify */
function verify() {
  const manifest = loadManifest();
  const seen = new Map();
  let fails = 0;
  const H = 'file'.padEnd(30) + 'fmt'.padStart(7) + 'rate'.padStart(7) + 'ch'.padStart(3) + 'dur_ms'.padStart(8) + 'peakdB'.padStart(8) + 'rmsdB'.padStart(8) + 'onset_ms'.padStart(9) + 'mean_ms'.padStart(8) + 'lead'.padStart(6) + 'tail'.padStart(6);
  console.log('version=' + manifest.version + '  packs=' + manifest.packs.length + '  clips=' + entries(manifest).length);
  console.log(H); console.log('-'.repeat(H.length));
  for (const p of manifest.packs) {
    for (const s of p.sounds) {
      const fp = path.join(DIR, s.file);
      const bad = [];
      if (!fs.existsSync(fp)) { fails++; console.log(s.file.padEnd(30) + '  MISSING'); continue; }
      if (seen.has(s.file)) { fails++; bad.push('duplicate-file'); }
      seen.set(s.file, p.id + '/' + s.id);
      const isWav = /\.wav$/i.test(s.file);
      let samples, rate, fmtDesc, ch;
      if (isWav) { const w = readWav(fp); samples = w.samples; rate = w.fmt.sampleRate; fmtDesc = 'pcm' + w.fmt.bits; ch = w.fmt.channels; }
      else { samples = decodeToFloat(fp); rate = SRC_RATE; fmtDesc = 'mp3'; ch = 1; }
      const m = measure(samples, rate);
      if (!isWav) bad.push('non-wav');
      if (m.ms < DUR_LO || m.ms > DUR_HI) bad.push('dur');
      if (m.peakDb < PEAK_LO || m.peakDb > PEAK_HI) bad.push('peak');
      if (Math.abs(s.ms - m.ms) > 5) bad.push('ms-field=' + s.ms);
      console.log(s.file.padEnd(30) + pad(fmtDesc, 7) + pad(rate, 7) + pad(ch, 3) + pad(m.ms.toFixed(0), 8) + db(m.peakDb) + db(m.rmsDb) + pad(m.onsetMs.toFixed(0), 9) + pad(m.meaningMs.toFixed(0), 8) + pad(m.leadSilenceMs.toFixed(0), 6) + pad(m.tailSilenceMs.toFixed(0), 6) + (bad.length ? '  <- ' + bad.join(',') : ''));
      if (bad.length) fails++;
    }
  }
  console.log('---');
  console.log(fails === 0 ? 'VERIFY PASS' : 'VERIFY FAIL (' + fails + ')');
  if (fails) process.exitCode = 1;
}

module.exports = { measure, readWav, decodeToFloat, toWav16, entries, loadManifest, parseWavBytes, peakOf, DIR, MANIFEST, SRC_RATE };

const cmd = process.argv[2];
if (require.main === module) {
  if (cmd === 'audit') audit();
  else if (cmd === 'inspect') inspect();
  else if (cmd === 'apply') apply();
  else if (cmd === 'verify') verify();
  else { console.log('usage: node level-memes.js <audit|inspect|apply|verify>'); process.exitCode = 1; }
}
