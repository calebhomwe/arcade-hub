'use strict';
/*
 * gen-memes.js — Chess Juice meme-sound bank generator.
 * Synthesises 100% original audio with plain arithmetic (DSP). No sample is
 * downloaded, ripped, decoded or copied from anywhere. Every clip is composed
 * from oscillators, noise and filters at generation time.
 *
 * Stdlib only. 22050 Hz / mono / 16-bit PCM WAV, 44-byte RIFF header.
 *
 *   node gen-memes.js          generate bank + manifest, print byte sizes
 *   node gen-memes.js verify   re-parse every artefact and assert the contract
 */
const fs = require('fs');
const path = require('path');

const SR = 22050;
const PEAK_DB = -3;
const FADE_IN = 0.005;
const FADE_OUT = 0.030;
const MAX_FILE_BYTES = 60 * 1024;
const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024;
const OUT_DIR = path.resolve(__dirname, '..', '..', 'games', 'audio', 'memes');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const EVENTS = ['blunder','capture','check','checkmate','castle','promote','win','lose','draw','start','undo','hint','combo3'];

/* ------------------------------------------------------------------ utils */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const buf = (dur) => new Float64Array(Math.max(1, Math.round(dur * SR)));

function wave(type, ph) {
  switch (type) {
    case 'saw': return 2 * ph - 1;
    case 'square': return ph < 0.5 ? 1 : -1;
    case 'tri': return 4 * Math.abs(ph - 0.5) - 1;
    default: return Math.sin(2 * Math.PI * ph);
  }
}
function addOsc(a, opt) {
  const type = opt.type || 'sine';
  const f = typeof opt.freq === 'function' ? opt.freq : () => opt.freq;
  const g = opt.gain === undefined ? () => 1 : (typeof opt.gain === 'function' ? opt.gain : () => opt.gain);
  const vibF = opt.vibF || 0, vibD = opt.vibD || 0, vibPh = opt.vibPhase || 0;
  let ph = opt.phase || 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    let hz = f(t);
    if (vibD) hz *= 1 + vibD * Math.sin(2 * Math.PI * vibF * t + vibPh);
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

/* --------------------------------------------------------------- filters */
class Biquad {
  constructor() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  set(type, fc, Q) {
    const w = 2 * Math.PI * clamp(fc, 10, SR * 0.49) / SR;
    const c = Math.cos(w), s = Math.sin(w), alpha = s / (2 * (Q || 0.7071));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    else if (type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
function filt(a, type, fc, Q, passes) {
  for (let p = 0; p < (passes || 1); p++) {
    const f = new Biquad().set(type, fc, Q);
    for (let i = 0; i < a.length; i++) a[i] = f.run(a[i]);
  }
  return a;
}
class SVF { // Chamberlin state-variable filter, cheap to modulate per sample
  constructor() { this.lo = 0; this.band = 0; }
  step(x, fc, Q) {
    const f = 2 * Math.sin(Math.PI * clamp(fc, 20, SR * 0.45) / SR);
    const q = 1 / (Q || 1);
    const hi = x - this.lo - q * this.band;
    this.band += f * hi; this.lo += f * this.band;
    return this.band;
  }
}
function shape(a, drive, mix) {
  const m = mix === undefined ? 1 : mix;
  for (let i = 0; i < a.length; i++) a[i] = lerp(a[i], Math.tanh(a[i] * drive), m);
  return a;
}
function reverb(a, mix, decay) {
  const out = Float64Array.from(a);
  const delays = [0.0297, 0.0371, 0.0411, 0.0437];
  for (const d of delays) {
    const D = Math.max(1, Math.round(d * SR)), line = new Float64Array(D);
    let idx = 0;
    for (let i = 0; i < a.length; i++) { const y = line[idx]; line[idx] = a[i] + y * decay; idx = (idx + 1) % D; out[i] += y * mix; }
  }
  return out;
}
function normalize(a, db) {
  const target = Math.pow(10, db / 20);
  let p = 0;
  for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; }
  if (p > 0) { const g = target / p; for (let i = 0; i < a.length; i++) a[i] *= g; }
  return a;
}
function fade(a) {
  // 5 ms power-curve fade-in and 30 ms power-curve fade-out. The curves are
  // deliberately flatter than linear near the ends so the first/last 40
  // samples (~1.8 ms) sit at essentially zero and cannot click.
  const fi = Math.round(FADE_IN * SR), fo = Math.round(FADE_OUT * SR);
  for (let i = 0; i < fi && i < a.length; i++) { const x = i / fi; a[i] *= x * x * x * x; }
  for (let i = 0; i < fo && i < a.length; i++) { const x = i / fo; a[a.length - 1 - i] *= x * x * x; }
  return a;
}
function attackWindow(a, sec) {
  // Intrinsic 4 ms smoothstep attack baked into the sound itself, so no
  // transient ever sits inside the fade window and the envelope stays smooth.
  const n = Math.round((sec || 0.004) * SR);
  for (let i = 0; i < n && i < a.length; i++) { const x = i / n; a[i] *= x * x * (3 - 2 * x); }
  return a;
}
function finish(a) { attackWindow(a, 0.004); fade(a); normalize(a, PEAK_DB); return a; }
function mixIn(target, src, gain) { for (let i = 0; i < target.length && i < src.length; i++) target[i] += src[i] * gain; return target; }
function dup(a) { return Float64Array.from(a); }

function clap(a, at, rng, gain, tone) {
  const start = Math.round(at * SR), len = Math.round(0.035 * SR);
  const c = buf(0.035);
  for (let i = 0; i < c.length; i++) c[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 90);
  filt(c, 'bp', tone || 1800, 0.9);
  for (let i = 0; i < len; i++) { const j = start + i; if (j < a.length) a[j] += c[i] * gain; }
}

/* ------------------------------------------------------- formant voice/TTS */
const V = {
  ah: [730, 1090, 2440], ae: [660, 1720, 2410], eh: [530, 1840, 2480], ee: [270, 2290, 3010],
  ih: [390, 1990, 2550], oh: [570, 840, 2410], oo: [300, 870, 2240], uh: [500, 1200, 2500],
  er: [490, 1350, 1690], ay: [660, 1500, 2300]
};
function fr(ms, vowel, f0, extra) {
  return Object.assign({ ms, F: Array.isArray(vowel) ? vowel : V[vowel], f0, voiced: 1, noise: 0, gain: 1 }, extra || {});
}
function speak(frames, opts) {
  opts = opts || {};
  const F = frames.map((f) => ({
    ms: f.ms, F: f.F || V.uh, f0: f.f0 === undefined ? 120 : f.f0,
    voiced: f.voiced === undefined ? 1 : f.voiced, noise: f.noise || 0,
    gain: f.gain === undefined ? 1 : f.gain
  }));
  const totalMs = F.reduce((s, f) => s + f.ms, 0);
  const n = Math.max(1, Math.round(totalMs / 1000 * SR));
  const starts = []; let acc = 0;
  for (const f of F) { starts.push(acc); acc += f.ms; }
  const rng = opts.rng || mulberry32(7);
  const hold = !!opts.holdPitch;
  const ctrl = (tms) => {
    let i = 0;
    if (tms >= acc) i = F.length - 1;
    else { while (i < F.length - 1 && tms >= starts[i + 1]) i++; }
    const f = F[i], nx = F[Math.min(i + 1, F.length - 1)];
    const local = tms - starts[i];
    const trans = Math.min(28, f.ms * 0.6);
    const k = i < F.length - 1 && local > f.ms - trans ? clamp((local - (f.ms - trans)) / trans, 0, 1) : 0;
    const g = k > 0 ? nx : f;
    return {
      F: [lerp(f.F[0], g.F[0], k), lerp(f.F[1], g.F[1], k), lerp(f.F[2], g.F[2], k)],
      f0: hold ? f.f0 : lerp(f.f0, g.f0, k),
      voiced: lerp(f.voiced, g.voiced, k),
      noise: lerp(f.noise, g.noise, k),
      gain: lerp(f.gain, g.gain, k)
    };
  };
  const out = new Float64Array(n);
  const svf = [new SVF(), new SVF(), new SVF()];
  const fGain = [1, 0.6, 0.35];
  let ph = 0, prevSaw = 0;
  for (let i = 0; i < n; i++) {
    const c = ctrl(i / SR * 1000);
    ph += c.f0 / SR; ph -= Math.floor(ph);
    const saw = 2 * ph - 1;
    const pulse = (saw - prevSaw) * (SR / (2 * Math.max(c.f0, 1)));
    prevSaw = saw;
    const src = pulse * c.voiced + (rng() * 2 - 1) * c.noise;
    let v = 0;
    for (let k = 0; k < 3; k++) v += svf[k].step(src, c.F[k], 10) * fGain[k];
    out[i] = v * c.gain;
  }
  filt(out, 'hp', 90, 0.7);
  filt(out, 'lp', 5500, 0.7);
  return out;
}
function robotize(a, holdSamples, levels) {
  holdSamples = holdSamples || 2; levels = levels || 900;
  let h = 0;
  for (let i = 0; i < a.length; i++) {
    if (i % holdSamples === 0) h = a[i];
    a[i] = Math.round(h * levels) / levels;
  }
  for (let i = 0; i < a.length; i++) a[i] *= 0.88 + 0.12 * Math.sin(2 * Math.PI * 37 * i / SR);
  return a;
}
function ksPluck(dur, f0, rng, damp) {
  const n = Math.round(dur * SR), N = Math.max(2, Math.round(SR / f0));
  const dl = new Float64Array(N);
  for (let i = 0; i < N; i++) dl[i] = rng() * 2 - 1;
  const out = new Float64Array(n);
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = dl[idx]; out[i] = cur;
    dl[idx] = (cur + prev) * 0.5 * (damp || 0.995);
    prev = cur; idx = (idx + 1) % N;
  }
  for (let i = 0; i < n; i++) out[i] *= Math.exp(-2.6 * i / n);
  return out;
}
function fmBell(dur, base, ratio, index, rng) {
  const a = buf(dur);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const m = Math.sin(2 * Math.PI * base * ratio * t) * index * Math.exp(-t * 2.2);
    a[i] = Math.sin(2 * Math.PI * base * t + m) * Math.exp(-t * 3.0);
  }
  return a;
}

/* ================================================================== SOUNDS */
const S = {};

/* ---- Boom & Bruh ------------------------------------------------------- */
S.vineboom = (rng) => { // deep sub-bass boom + noise transient
  const a = buf(0.72);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 34 + 46 * Math.exp(-t * 7);
    ph += hz / SR;
    a[i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 3.1);
  }
  const tr = buf(0.13);
  for (let i = 0; i < tr.length; i++) tr[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 55);
  filt(tr, 'lp', 900, 0.7);
  mixIn(a, tr, 0.9);
  shape(a, 1.7, 0.6);
  filt(a, 'lp', 2600, 0.7); filt(a, 'hp', 24, 0.7);
  return a;
};
S.bruh = (rng) => { // short pitch-swept "bruh" vowel formant
  return speak([
    { ms: 28, F: V.uh, f0: 132, voiced: 0.2, noise: 0.06, gain: 0.1 },
    { ms: 13, F: V.uh, f0: 130, voiced: 0, noise: 0.75, gain: 0.45 },
    fr(52, [360, 1000, 2400], 128),
    fr(150, V.uh, 122),
    fr(90, V.ah, 108)
  ], { rng });
};
S.slowooh = (rng) => {
  const a = speak([
    fr(140, V.oo, 168, { gain: 0.85 }),
    fr(620, V.oo, 118),
    fr(220, V.oo, 106, { gain: 0.7 })
  ], { rng });
  const wet = reverb(a, 0.30, 0.55);
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.8 + wet[i] * 1.1;
  return a;
};
S.scratch = (rng) => {
  const a = buf(0.5);
  const svf = new SVF();
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const fc = 380 + 1500 * Math.abs(Math.sin(2 * Math.PI * 2.2 * t + 1.2 * Math.sin(2 * Math.PI * 7 * t)));
    const x = (rng() * 2 - 1) * Math.exp(-t * 1.6);
    a[i] = svf.step(x, fc, 3.2) * 1.6;
  }
  for (let i = 0; i < a.length; i++) a[i] *= 0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * 2.2 * i / SR));
  filt(a, 'hp', 320, 0.7); filt(a, 'lp', 6500, 0.7);
  return a;
};
S.boom808 = (rng) => { // long 808-style boom with pitch drop
  const a = buf(0.92);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 38 + 52 * Math.exp(-t * 9);
    ph += hz / SR;
    a[i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.4);
  }
  const cl = buf(0.02);
  for (let i = 0; i < cl.length; i++) cl[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 200);
  mixIn(a, cl, 0.55);
  shape(a, 1.5, 0.5);
  filt(a, 'lp', 2200, 0.7);
  return a;
};
S.thud = (rng) => { // hard body impact
  const a = buf(0.32);
  addOsc(a, { type: 'sine', freq: (t) => 96 - 30 * Math.min(1, t / 0.2), gain: (t) => Math.exp(-t * 14) });
  const n = buf(0.09);
  for (let i = 0; i < n.length; i++) n[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 70);
  filt(n, 'lp', 1400, 0.8);
  mixIn(a, n, 0.7);
  shape(a, 1.4, 0.5);
  return a;
};

/* ---- Gamer / MLG ------------------------------------------------------- */
S.airhorn = (rng) => {
  const a = buf(0.6);
  const stack = [392, 415, 494, 523, 784, 830];
  for (const f of stack) {
    let ph = 0;
    for (let i = 0; i < a.length; i++) {
      const t = i / SR;
      const hz = f * (1 + 0.05 * Math.max(0, t - 0.35));
      ph += hz / SR;
      a[i] += (2 * (ph % 1) - 1) * 0.17;
    }
  }
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    a[i] *= (0.5 + 0.5 * Math.sin(2 * Math.PI * 27 * t));
    a[i] *= t < 0.015 ? t / 0.015 : 1;
    a[i] *= t > 0.48 ? Math.max(0, (0.6 - t) / 0.12) : 1;
  }
  filt(a, 'bp', 1100, 0.6);
  shape(a, 2.4, 0.75);
  filt(a, 'lp', 4800, 0.7);
  return a;
};
S.hitmarker = (rng) => {
  const a = buf(0.2);
  addOsc(a, { type: 'sine', freq: (t) => 1500 + 520 * Math.exp(-t * 45), gain: (t) => Math.exp(-t * 24) });
  addOsc(a, { type: 'sine', freq: 3050, gain: (t) => 0.35 * Math.exp(-t * 40) });
  for (let i = 0; i < 70; i++) a[i] += (rng() * 2 - 1) * Math.exp(-i / 9) * 0.35;
  return a;
};
S.noscope = (rng) => {
  const a = buf(0.6);
  const svf = new SVF();
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const fc = 280 + 3600 * Math.min(1, t / 0.3);
    const x = (rng() * 2 - 1) * Math.min(1, t / 0.05) * Math.exp(-Math.max(0, t - 0.3) * 3.5);
    a[i] = svf.step(x, fc, 4) * 1.4;
  }
  const cs = Math.round(0.34 * SR);
  for (let i = cs, k = 0; i < a.length && k < 1400; i++, k++) a[i] += (rng() * 2 - 1) * Math.exp(-k / 55) * 0.9;
  filt(a, 'hp', 220, 0.7);
  shape(a, 1.4, 0.4);
  return a;
};
S.wasted = (rng) => { // descending minor third, slow and heavy
  const a = buf(1.2);
  const seq = [[0, 0.62, 311.1], [0.55, 0.65, 261.6]];
  for (const [at, len, hz0] of seq) {
    const v = buf(len);
    let ph = 0;
    for (let i = 0; i < v.length; i++) {
      const t = i / SR;
      ph += hz0 * (1 + 0.008 * Math.sin(2 * Math.PI * 5.5 * t)) / SR;
      v[i] = (2 * (ph % 1) - 1) * 0.5;
    }
    filt(v, 'lp', 1600, 0.9);
    shape(v, 1.8, 0.6);
    v.forEach((_, i) => { v[i] *= (i / SR) < 0.03 ? (i / SR) / 0.03 : Math.exp(-(i / SR - 0.03) * 2.6); });
    for (let i = 0; i < v.length; i++) {
      const j = Math.round(at * SR) + i;
      if (j < a.length) a[j] += v[i];
    }
  }
  addOsc(a, { type: 'sine', freq: 65, gain: (t) => 0.25 * Math.exp(-t * 2) });
  return a;
};
S.levelup = (rng) => {
  const a = buf(0.5);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((hz, k) => {
    const at = Math.round(k * 0.11 * SR), len = Math.round(0.18 * SR);
    const v = buf(0.18);
    addOsc(v, { type: 'square', freq: hz, gain: (t) => Math.exp(-t * 9) });
    addOsc(v, { type: 'sine', freq: hz * 2, gain: (t) => 0.3 * Math.exp(-t * 12) });
    for (let i = 0; i < len && at + i < a.length; i++) {
      const env = Math.min(1, i / (0.008 * SR));
      a[at + i] += v[i] * env;
    }
  });
  filt(a, 'lp', 6000, 0.7);
  return a;
};

/* ---- Sad / Tragic ------------------------------------------------------ */
S.sadtrombone = (rng) => {
  const src = buf(1.28);
  let ph = 0;
  for (let i = 0; i < src.length; i++) {
    const t = i / SR;
    const base = [330, 294, 262, 233][Math.min(3, Math.floor(t / 0.32))];
    ph += (base * (1 + 0.05 * Math.exp(-(t % 0.32) * 8))) / SR;
    src[i] = (2 * (ph % 1) - 1) * Math.exp(-t * 0.75);
  }
  const out = new Float64Array(src.length);
  const svf = new SVF();
  for (let i = 0; i < src.length; i++) {
    const t = i / SR;
    const fc = 480 + 420 * Math.sin(2 * Math.PI * 3.4 * t - Math.PI / 2);
    out[i] = svf.step(src[i], fc, 4) * 1.9;
  }
  filt(out, 'lp', 3600, 0.7);
  return out;
};
S.ohnonono = (rng) => {
  return speak([
    fr(150, V.oh, 196),
    { ms: 35, F: [260, 1000, 2400], f0: 190, voiced: 1, noise: 0.04, gain: 0.55 },
    fr(160, V.oh, 182),
    { ms: 35, F: [260, 1000, 2400], f0: 176, voiced: 1, noise: 0.04, gain: 0.55 },
    fr(160, V.oh, 168),
    { ms: 35, F: [260, 1000, 2400], f0: 162, voiced: 1, noise: 0.04, gain: 0.55 },
    fr(380, V.oh, 150, { gain: 0.9 })
  ], { rng });
};
S.wilhelm = (rng) => { // distant yell, generic
  const a = speak([
    { ms: 90, F: V.ah, f0: 380, gain: 0.5 },
    fr(240, V.ah, 330),
    fr(320, V.ah, 268, { gain: 0.9 }),
    fr(220, V.ah, 236, { gain: 0.5 })
  ], { rng });
  filt(a, 'bp', 1400, 0.6);
  const wet = reverb(a, 0.42, 0.6);
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.7 + wet[i] * 1.25;
  return a;
};
S.sadbell = (rng) => { // mournful bell + soft rain
  const a = fmBell(1.3, 220, 2.76, 3.2, rng);
  const rain = buf(1.3);
  for (let i = 0; i < rain.length; i++) rain[i] = (rng() * 2 - 1);
  filt(rain, 'bp', 2600, 0.5);
  for (let i = 0; i < rain.length; i++) {
    const t = i / SR;
    rain[i] *= 0.05 + 0.12 * Math.abs(Math.sin(2 * Math.PI * 0.9 * t));
  }
  for (let k = 0; k < 26; k++) {
    const at = rng() * 1.2, j = Math.round(at * SR);
    for (let i = 0; i < 300 && j + i < rain.length; i++) rain[j + i] += (rng() * 2 - 1) * Math.exp(-i / 25) * 0.5;
  }
  mixIn(a, rain, 0.5);
  return a;
};
S.sadviolin = (rng) => {
  const a = buf(1.2);
  const notes = [440, 392, 349];
  notes.forEach((hz, k) => {
    const at = Math.round(k * 0.38 * SR), len = Math.round(0.44 * SR);
    const v = buf(0.44);
    for (const det of [1, 1.004]) {
      addOsc(v, { type: 'saw', freq: hz * det, vibF: 6, vibD: 0.012, gain: (t) => 0.4 * (t < 0.07 ? t / 0.07 : 1) * Math.exp(-t * 1.6) });
    }
    filt(v, 'lp', 2600, 0.8);
    for (let i = 0; i < len && at + i < a.length; i++) a[at + i] += v[i] * 0.5;
  });
  const wet = reverb(a, 0.35, 0.55);
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.75 + wet[i] * 1.0;
  return a;
};
S.sigh = (rng) => {
  const a = speak([
    fr(160, V.ah, 210, { gain: 0.8 }),
    fr(300, V.ah, 160, { gain: 0.5, noise: 0.12 })
  ], { rng });
  filt(a, 'lp', 2600, 0.7);
  return a;
};

/* ---- Victory / Hype ---------------------------------------------------- */
S.crowdroar = (rng) => {
  const a = buf(1.35);
  const roar = buf(1.35);
  for (let i = 0; i < roar.length; i++) roar[i] = (rng() * 2 - 1);
  filt(roar, 'bp', 1200, 0.5);
  filt(roar, 'lp', 3200, 0.7);
  for (let i = 0; i < roar.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.35) * Math.exp(-Math.max(0, t - 0.75) * 3.2);
    roar[i] *= env * 0.8;
  }
  mixIn(a, roar, 1);
  const cheer = speak([fr(280, V.ah, 240), fr(700, V.ah, 300, { gain: 0.8 }), fr(340, V.ah, 225, { gain: 0.5 })], { rng });
  mixIn(a, cheer, 0.32);
  for (let k = 0; k < 46; k++) clap(a, rng() * 1.2, rng, 0.35 + rng() * 0.5, 1400 + rng() * 1800);
  filt(a, 'hp', 180, 0.7);
  return a;
};
S.yeahbaby = (rng) => {
  return speak([
    fr(90, 'ih', 232, { gain: 0.9 }),
    fr(130, 'eh', 238),
    { ms: 24, F: V.eh, f0: 236, voiced: 0.2, noise: 0.04, gain: 0.08 },
    { ms: 12, F: V.eh, f0: 236, voiced: 0, noise: 0.7, gain: 0.4 },
    fr(170, V.ay, 226),
    { ms: 24, F: V.ee, f0: 240, voiced: 0.2, noise: 0.04, gain: 0.08 },
    { ms: 12, F: V.ee, f0: 240, voiced: 0, noise: 0.7, gain: 0.4 },
    fr(220, 'ee', 246)
  ], { rng });
};
S.fanfare = (rng) => {
  const a = buf(1.2);
  const seq = [[0.00, 0.16, 392], [0.17, 0.16, 523.25], [0.34, 0.30, 659.25], [0.66, 0.16, 784], [0.83, 0.34, 1046.5]];
  for (const [at, len, hz] of seq) {
    const v = buf(len + 0.06);
    for (const det of [0.996, 1, 1.005]) addOsc(v, { type: 'saw', freq: hz * det, vibF: 5.5, vibD: 0.008, gain: (t) => 0.3 * Math.exp(-t * 3.2) });
    filt(v, 'lp', 3400, 0.8);
    shape(v, 1.6, 0.5);
    for (let i = 0; i < v.length; i++) {
      const j = Math.round(at * SR) + i;
      if (j < a.length) a[j] += v[i];
    }
  }
  return a;
};
S.subdrop = (rng) => {
  const a = buf(0.9);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 30 + 150 * Math.exp(-t * 3.4);
    ph += hz / SR;
    a[i] += Math.sin(2 * Math.PI * ph) * Math.exp(-t * 1.4);
  }
  const im = buf(0.25);
  for (let i = 0; i < im.length; i++) im[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 28);
  filt(im, 'lp', 2000, 0.7);
  mixIn(a, im, 0.7);
  shape(a, 1.5, 0.5);
  const wet = reverb(a, 0.28, 0.5);
  for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.8 + wet[i] * 0.9;
  return a;
};
S.orchestrahit = (rng) => {
  const a = buf(0.7);
  const chord = [130.81, 155.56, 196, 261.63, 311.13, 392];
  for (const hz of chord) {
    addOsc(a, { type: 'saw', freq: hz, gain: (t) => Math.exp(-t * 4.2) });
    addOsc(a, { type: 'saw', freq: hz * 1.006, gain: (t) => 0.7 * Math.exp(-t * 4.2) });
  }
  filt(a, 'lp', 3000, 0.8);
  shape(a, 2.0, 0.6);
  addOsc(a, { type: 'sine', freq: 65.4, gain: (t) => 0.5 * Math.exp(-t * 5) });
  return a;
};
S.winsting = (rng) => {
  const a = buf(0.7);
  const notes = [659.25, 830.61, 987.77, 1318.5];
  notes.forEach((hz, k) => {
    const at = Math.round(k * 0.09 * SR);
    addOsc(a, { type: 'sine', freq: hz, phase: 0, gain: (t) => 0 });
    const v = buf(0.5);
    addOsc(v, { type: 'sine', freq: hz, gain: (t) => Math.exp(-t * 6) });
    addOsc(v, { type: 'sine', freq: hz * 2.01, gain: (t) => 0.35 * Math.exp(-t * 9) });
    addOsc(v, { type: 'sine', freq: hz * 3.02, gain: (t) => 0.15 * Math.exp(-t * 12) });
    for (let i = 0; i < v.length && at + i < a.length; i++) a[at + i] += v[i] * 0.9;
  });
  return a;
};

/* ---- Cartoon ----------------------------------------------------------- */
S.boing = (rng) => {
  const a = buf(0.5);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 160 + 820 * Math.exp(-t * 3.6);
    ph += hz * (1 + 0.07 * Math.sin(2 * Math.PI * 21 * t)) / SR;
    a[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.2);
  }
  addOsc(a, { type: 'tri', freq: (t) => 90 + 300 * Math.exp(-t * 5), gain: (t) => 0.3 * Math.exp(-t * 3) });
  return a;
};
S.pop = (rng) => {
  const a = buf(0.2);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (300 + 1400 * Math.min(1, t / 0.05)) / SR;
    a[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 26);
  }
  for (let i = 0; i < 60; i++) a[i] += (rng() * 2 - 1) * Math.exp(-i / 7) * 0.4;
  return a;
};
S.slidewhistle = (rng) => {
  const a = buf(0.9);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 340 + 980 * Math.exp(-t * 1.7);
    ph += hz * (1 + 0.02 * Math.sin(2 * Math.PI * 6.5 * t)) / SR;
    a[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 1.1);
  }
  const air = buf(0.9);
  for (let i = 0; i < air.length; i++) air[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 1.2);
  filt(air, 'bp', 2400, 0.7);
  mixIn(a, air, 0.12);
  return a;
};
S.twang = (rng) => {
  const a = ksPluck(0.52, 240, rng, 0.994);
  filt(a, 'lp', 3200, 0.7);
  addOsc(a, { type: 'sine', freq: (t) => 600 * Math.exp(-t * 8) + 140, gain: (t) => 0.25 * Math.exp(-t * 5) });
  return a;
};
S.squeak = (rng) => {
  const a = buf(0.26);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const hz = 520 + 1300 * Math.min(1, t / 0.2);
    ph += hz * (1 + 0.05 * Math.sin(2 * Math.PI * 28 * t)) / SR;
    a[i] = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * 0.9;
  }
  return a;
};
S.bonk = (rng) => {
  const a = buf(0.3);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (180 - 70 * Math.min(1, t / 0.12)) / SR;
    a[i] = (2 * (ph % 1) - 1) * Math.exp(-t * 12) * 0.5 + Math.sin(2 * Math.PI * ph * 1.5) * Math.exp(-t * 11);
  }
  const c = buf(0.05);
  for (let i = 0; i < c.length; i++) c[i] = (rng() * 2 - 1) * Math.exp(-i / SR * 120);
  filt(c, 'bp', 900, 1.2);
  mixIn(a, c, 0.5);
  return a;
};

/* ---- Robo TTS ---------------------------------------------------------- */
S.tts_blunder = (rng) => robotize(speak([
  { ms: 30, F: V.uh, f0: 118, voiced: 0.2, noise: 0.05, gain: 0.08 },
  { ms: 14, F: V.uh, f0: 118, voiced: 0, noise: 0.7, gain: 0.4 },
  fr(55, [360, 1000, 2400], 116),
  fr(120, V.uh, 114),
  { ms: 38, F: [250, 1300, 2400], f0: 112, voiced: 1, noise: 0.05, gain: 0.55 },
  { ms: 22, F: V.er, f0: 110, voiced: 0.2, noise: 0.03, gain: 0.08 },
  { ms: 12, F: V.er, f0: 110, voiced: 0, noise: 0.6, gain: 0.35 },
  fr(150, V.er, 106)
], { rng, holdPitch: true }));
S.tts_ohno = (rng) => robotize(speak([
  fr(180, V.oh, 190, { gain: 0.95 }),
  { ms: 45, F: [250, 1000, 2400], f0: 182, voiced: 1, noise: 0.04, gain: 0.6 },
  fr(240, V.oh, 168, { gain: 0.95 })
], { rng, holdPitch: true }));
S.tts_nice = (rng) => robotize(speak([
  { ms: 45, F: [250, 1700, 2500], f0: 150, voiced: 1, noise: 0.05, gain: 0.6 },
  fr(180, V.ay, 158),
  { ms: 130, F: [4200, 5200, 6200], f0: 150, voiced: 0, noise: 0.55, gain: 0.5 }
], { rng, holdPitch: true }));
S.tts_gg = (rng) => robotize(speak([
  { ms: 22, F: V.ee, f0: 150, voiced: 0, noise: 0.5, gain: 0.3 },
  fr(150, 'ee', 150),
  { ms: 26, F: V.ee, f0: 145, voiced: 0.2, noise: 0.03, gain: 0.1 },
  { ms: 22, F: V.ee, f0: 145, voiced: 0, noise: 0.5, gain: 0.3 },
  fr(170, 'ee', 142)
], { rng, holdPitch: true }));
S.tts_checkmate = (rng) => robotize(speak([
  { ms: 60, F: [2200, 3200, 4200], f0: 150, voiced: 0, noise: 0.6, gain: 0.5 },
  fr(110, 'eh', 152),
  { ms: 32, F: V.eh, f0: 150, voiced: 0.15, noise: 0.03, gain: 0.08 },
  { ms: 14, F: V.eh, f0: 150, voiced: 0, noise: 0.65, gain: 0.4 },
  { ms: 70, F: [250, 1100, 2300], f0: 148, voiced: 1, noise: 0.04, gain: 0.55 },
  fr(150, V.ay, 146),
  { ms: 30, F: V.ay, f0: 144, voiced: 0.15, noise: 0.03, gain: 0.08 },
  { ms: 14, F: V.ay, f0: 144, voiced: 0, noise: 0.65, gain: 0.4 },
  fr(60, V.ay, 140, { gain: 0.6 })
], { rng, holdPitch: true }));
S.tts_oof = (rng) => robotize(speak([
  fr(180, V.oo, 140, { gain: 1.0 }),
  { ms: 100, F: [1200, 2100, 2800], f0: 138, voiced: 0, noise: 0.4, gain: 0.45 }
], { rng, holdPitch: true }));

/* ================================================================== PACKS */
const PACKS = [
  {
    id: 'boom', name: 'Boom & Bruh', emoji: '\u{1F4A5}', on: true,
    desc: 'Deep impacts, bruh formants and record-scratch wobble.',
    sounds: [
      { id: 'vineboom', label: 'Vine Boom', file: 'boom_vineboom.wav', when: 'capture', make: S.vineboom },
      { id: 'bruh', label: 'Bruh', file: 'boom_bruh.wav', when: 'blunder', make: S.bruh },
      { id: 'slowooh', label: 'Slow-mo Ooh', file: 'boom_slowooh.wav', when: 'lose', make: S.slowooh },
      { id: 'scratch', label: 'Record Scratch', file: 'boom_scratch.wav', when: 'undo', make: S.scratch },
      { id: 'boom808', label: '808 Boom', file: 'boom_boom808.wav', when: 'checkmate', make: S.boom808 },
      { id: 'thud', label: 'Hard Thud', file: 'boom_thud.wav', when: 'check', make: S.thud }
    ]
  },
  {
    id: 'gamer', name: 'Gamer / MLG', emoji: '\u{1F3AE}', on: true,
    desc: 'Airhorn, hitmarkers, quickscope whooshes and wasted thuds.',
    sounds: [
      { id: 'airhorn', label: 'Airhorn', file: 'gamer_airhorn.wav', when: 'promote', make: S.airhorn },
      { id: 'hitmarker', label: 'Hitmarker', file: 'gamer_hitmarker.wav', when: 'combo3', make: S.hitmarker },
      { id: 'noscope', label: 'No-Scope', file: 'gamer_noscope.wav', when: 'hint', make: S.noscope },
      { id: 'wasted', label: 'Wasted', file: 'gamer_wasted.wav', when: 'lose', make: S.wasted },
      { id: 'levelup', label: 'Level Up', file: 'gamer_levelup.wav', when: 'promote', make: S.levelup }
    ]
  },
  {
    id: 'sad', name: 'Sad & Tragic', emoji: '\u{1F622}', on: false,
    desc: 'Trombone slides, oh-no formants and mournful bells.',
    sounds: [
      { id: 'sadtrombone', label: 'Sad Trombone', file: 'sad_sadtrombone.wav', when: 'blunder', make: S.sadtrombone },
      { id: 'ohnonono', label: 'Oh No No No', file: 'sad_ohnonono.wav', when: 'check', make: S.ohnonono },
      { id: 'wilhelm', label: 'Distant Yell', file: 'sad_wilhelm.wav', when: 'lose', make: S.wilhelm },
      { id: 'sadbell', label: 'Rain Bell', file: 'sad_sadbell.wav', when: 'draw', make: S.sadbell },
      { id: 'sadviolin', label: 'Sad Violin', file: 'sad_sadviolin.wav', when: 'lose', make: S.sadviolin },
      { id: 'sigh', label: 'Heavy Sigh', file: 'sad_sigh.wav', when: 'undo', make: S.sigh }
    ]
  },
  {
    id: 'victory', name: 'Victory & Hype', emoji: '\u{1F3C6}', on: true,
    desc: 'Crowd roars, yeah-baby shouts, fanfares and sub drops.',
    sounds: [
      { id: 'crowdroar', label: 'Crowd Roar', file: 'victory_crowdroar.wav', when: 'win', make: S.crowdroar },
      { id: 'yeahbaby', label: 'Yeah Baby', file: 'victory_yeahbaby.wav', when: 'win', make: S.yeahbaby },
      { id: 'fanfare', label: 'Fanfare', file: 'victory_fanfare.wav', when: 'start', make: S.fanfare },
      { id: 'subdrop', label: 'Sub Drop', file: 'victory_subdrop.wav', when: 'checkmate', make: S.subdrop },
      { id: 'orchestrahit', label: 'Orchestra Hit', file: 'victory_orchestrahit.wav', when: 'win', make: S.orchestrahit },
      { id: 'winsting', label: 'Win Chime', file: 'victory_winsting.wav', when: 'win', make: S.winsting }
    ]
  },
  {
    id: 'toon', name: 'Cartoon', emoji: '\u{1F0CF}', on: false,
    desc: 'Boings, pops, slide whistles and springy twangs.',
    sounds: [
      { id: 'boing', label: 'Boing', file: 'toon_boing.wav', when: 'castle', make: S.boing },
      { id: 'pop', label: 'Pop', file: 'toon_pop.wav', when: 'undo', make: S.pop },
      { id: 'slidewhistle', label: 'Slide Whistle', file: 'toon_slidewhistle.wav', when: 'check', make: S.slidewhistle },
      { id: 'twang', label: 'Spring Twang', file: 'toon_twang.wav', when: 'capture', make: S.twang },
      { id: 'squeak', label: 'Squeak', file: 'toon_squeak.wav', when: 'hint', make: S.squeak },
      { id: 'bonk', label: 'Hollow Bonk', file: 'toon_bonk.wav', when: 'blunder', make: S.bonk }
    ]
  },
  {
    id: 'tts', name: 'Robo Voice', emoji: '\u{1F916}', on: true,
    desc: 'Short robotic formant voice lines, zero real-voice cloning.',
    sounds: [
      { id: 'blunder', label: 'Blunder', file: 'tts_blunder.wav', when: 'blunder', make: S.tts_blunder },
      { id: 'ohno', label: 'Oh No', file: 'tts_ohno.wav', when: 'blunder', make: S.tts_ohno },
      { id: 'nice', label: 'Nice', file: 'tts_nice.wav', when: 'capture', make: S.tts_nice },
      { id: 'gg', label: 'GG', file: 'tts_gg.wav', when: 'win', make: S.tts_gg },
      { id: 'checkmate', label: 'Checkmate', file: 'tts_checkmate.wav', when: 'checkmate', make: S.tts_checkmate },
      { id: 'oof', label: 'Oof', file: 'tts_oof.wav', when: 'blunder', make: S.tts_oof }
    ]
  }
];

/* =================================================================== WAV IO */
function toWav(samples) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = clamp(samples[i], -1, 1);
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}
function parseWav(b) {
  if (b.length < 44) throw new Error('too short');
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('missing RIFF');
  if (b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('missing WAVE');
  if (b.toString('ascii', 12, 16) !== 'fmt ') throw new Error('missing fmt ');
  const fmtSize = b.readUInt32LE(16);
  const audioFormat = b.readUInt16LE(20);
  const channels = b.readUInt16LE(22);
  const sampleRate = b.readUInt32LE(24);
  const byteRate = b.readUInt32LE(28);
  const blockAlign = b.readUInt16LE(32);
  const bits = b.readUInt16LE(34);
  if (b.toString('ascii', 36, 40) !== 'data') throw new Error('missing data');
  const dataSize = b.readUInt32LE(40);
  const declared = b.readUInt32LE(4);
  const samples = new Int16Array(dataSize / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = b.readInt16LE(44 + i * 2);
  return { fmtSize, audioFormat, channels, sampleRate, byteRate, blockAlign, bits, dataSize, declared, samples };
}

/* ============================================================== generation */
function generate() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];
  const manifest = { version: 1, packs: [] };
  process.stdout.write('generating ' + OUT_DIR + '\n');
  for (const pack of PACKS) {
    const sounds = [];
    for (const s of pack.sounds) {
      const rng = mulberry32(hash(pack.id + '/' + s.id));
      const raw = s.make(rng);
      const done = finish(raw);
      const wav = toWav(done);
      const p = path.join(OUT_DIR, s.file);
      fs.writeFileSync(p, wav);
      const ms = Math.round(done.length / SR * 1000);
      sounds.push({ id: s.id, label: s.label, file: s.file, ms, when: s.when });
      rows.push({ pack: pack.id, file: s.file, bytes: wav.length, ms, sec: +(done.length / SR).toFixed(3) });
    }
    manifest.packs.push({ id: pack.id, name: pack.name, emoji: pack.emoji, desc: pack.desc, on: pack.on, sounds });
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  const total = rows.reduce((n, r) => n + r.bytes, 0);
  process.stdout.write('file'.padEnd(28) + 'bytes'.padStart(9) + 'ms'.padStart(7) + 'sec'.padStart(8) + '\n');
  for (const r of rows) process.stdout.write(r.file.padEnd(28) + String(r.bytes).padStart(9) + String(r.ms).padStart(7) + r.sec.toFixed(3).padStart(8) + '\n');
  process.stdout.write('-'.repeat(52) + '\n');
  process.stdout.write('files: ' + rows.length + '   total bytes: ' + total + ' (' + (total / 1024).toFixed(1) + ' KB)\n');
  process.stdout.write('manifest: ' + MANIFEST + '\n');
  return rows;
}

/* ================================================================ verify */
let failures = 0;
function check(ok, msg, detail) {
  if (!ok) { failures++; process.stdout.write('FAIL  ' + msg + (detail ? '  [' + detail + ']' : '') + '\n'); }
  else process.stdout.write('ok    ' + msg + (detail ? '  [' + detail + ']' : '') + '\n');
}
function peakDb(samples) {
  let p = 0;
  for (let i = 0; i < samples.length; i++) { const v = Math.abs(samples[i]) / 32767; if (v > p) p = v; }
  return 20 * Math.log10(p);
}
function verify() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const referenced = new Set();
  let total = 0, fileCount = 0;
  check(manifest.version === 1, 'manifest.version === 1', String(manifest.version));
  check(Array.isArray(manifest.packs) && manifest.packs.length >= 5 && manifest.packs.length <= 7, 'packs count in 5..7', String(manifest.packs.length));
  for (const pack of manifest.packs) {
    check(/^[a-z0-9]+$/.test(pack.id), 'pack id slug: ' + pack.id);
    check(typeof pack.name === 'string' && pack.name.length > 0, 'pack name: ' + pack.name);
    check(typeof pack.emoji === 'string' && pack.emoji.length > 0, 'pack emoji: ' + pack.emoji);
    check(typeof pack.on === 'boolean', 'pack on boolean: ' + pack.id);
    check(Array.isArray(pack.sounds) && pack.sounds.length >= 5 && pack.sounds.length <= 8, 'sounds in pack ' + pack.id + ' 5..8', String(pack.sounds.length));
    for (const s of pack.sounds) {
      fileCount++;
      check(s.file.startsWith(pack.id + '_') && s.file.endsWith('.wav'), 'file naming ' + s.file);
      check(s.label.length <= 22, 'label <=22 chars: ' + s.label, String(s.label.length));
      check(EVENTS.indexOf(s.when) !== -1, 'when valid in ' + s.file, s.when);
      check(s.ms >= 180 && s.ms <= 1600, 'ms in 180..1600 in ' + s.file, String(s.ms));
      const p = path.join(OUT_DIR, s.file);
      check(fs.existsSync(p), 'exists ' + s.file);
      if (!fs.existsSync(p)) continue;
      referenced.add(s.file);
      const raw = fs.readFileSync(p);
      total += raw.length;
      check(raw.length <= MAX_FILE_BYTES, '<60KB ' + s.file, raw.length + ' bytes');
      const w = parseWav(raw);
      check(w.audioFormat === 1, 'PCM format ' + s.file, String(w.audioFormat));
      check(w.channels === 1, 'mono ' + s.file, String(w.channels));
      check(w.sampleRate === SR, '22050 Hz ' + s.file, String(w.sampleRate));
      check(w.bits === 16, '16-bit ' + s.file, String(w.bits));
      check(w.byteRate === SR * 2 && w.blockAlign === 2, 'byteRate/blockAlign ' + s.file);
      check(w.declared === 36 + w.dataSize, 'RIFF size field ' + s.file);
      check(raw.length === 44 + w.dataSize, 'no trailing bytes ' + s.file);
      const expected = Math.round(s.ms / 1000 * SR);
      check(Math.abs(w.samples.length - expected) <= 2, 'sample count ' + s.file, w.samples.length + ' vs ~' + expected);
      const db = peakDb(w.samples);
      check(db >= -4 && db <= -2, 'peak -4..-2 dBFS ' + s.file, db.toFixed(2) + ' dB');
      let head = 0, tail = 0;
      for (let i = 0; i < 40; i++) { head = Math.max(head, Math.abs(w.samples[i]) / 32767); tail = Math.max(tail, Math.abs(w.samples[w.samples.length - 1 - i]) / 32767); }
      check(head < 0.02 && tail < 0.02, 'first/last 40 samples near zero ' + s.file, 'head=' + head.toFixed(4) + ' tail=' + tail.toFixed(4));
    }
  }
  // cross-check: every wav on disk is referenced
  const onDisk = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.wav'));
  const orphans = onDisk.filter((f) => !referenced.has(f));
  check(orphans.length === 0, 'no unreferenced .wav files on disk', orphans.join(',') || 'none');
  check(onDisk.length === fileCount, 'manifest file count == wav count', onDisk.length + ' vs ' + fileCount);
  check(total <= MAX_TOTAL_BYTES, 'total < 1.5 MB', (total / 1024).toFixed(1) + ' KB');
  process.stdout.write((failures === 0 ? 'VERIFY PASS' : 'VERIFY FAIL') + ': ' + failures + ' failure(s), ' + fileCount + ' clips, ' + onDisk.length + ' wav on disk, total ' + total + ' bytes\n');
  if (failures) process.exitCode = 1;
}

const cmd = process.argv[2];
if (cmd === 'verify') verify();
else generate();
