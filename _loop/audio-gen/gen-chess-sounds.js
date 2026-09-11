#!/usr/bin/env node
'use strict';
/*
 * gen-chess-sounds.js -- procedural chess SFX bank for "Chess Juice".
 *
 * Every sample is synthesised from scratch here: physical/modal modelling (a wooden
 * piece is a handful of exponentially decaying inharmonic plate modes + a low board
 * thump + a sub-2 ms filtered-noise contact transient), additive mallet tones for the
 * musical cues, and inharmonic metal partials for the check alert. Nothing is sampled,
 * downloaded, ripped or copied from any website, game or clip.
 *
 * Usage:
 *   node gen-chess-sounds.js          render bank + manifest into games/audio/chess
 *   node gen-chess-sounds.js verify   parse every WAV back and assert the contract
 *
 * Stdlib only. No build step, no server.
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'games', 'audio', 'chess');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const PEAK_DBFS = -3.5;
const SIZE_CAP = 40 * 1024;      // each file < 40 KiB
const BANK_CAP = 700 * 1024;     // whole bank < 700 KiB

/* ------------------------------------------------------------------ rng */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function jf(rand, frac) { return 1 + (rand() * 2 - 1) * frac; }

/* ---------------------------------------------------------------- maths */
function t10tau(ms) { return Math.max(1e-5, (ms / 1000) / Math.LN10); }
function db2a(db) { return Math.pow(10, db / 20); }
function buffer(ms) { return new Float64Array(Math.round(ms * SR / 1000)); }

/* ------------------------------------------------------- biquad filters */
function biquad(type, f0, Q) {
  const w = 2 * Math.PI * f0 / SR, cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  else { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function filt(buf, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
}
function dcBlock(buf) {
  const R = 0.995; let x1 = 0, y1 = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i]; const y = x - x1 + R * y1; x1 = x; y1 = y; buf[i] = y; }
}
function saturate(buf, drive) { for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(drive * buf[i]); }

/* ------------------------------------------------------------- voices */
/* Amplitude envelope e(t) falls to 10% of its initial value after t10ms. */
function addSine(buf, at, freq, t10ms, amp, phase) {
  const tau = t10tau(t10ms);
  for (let i = at; i < buf.length; i++) {
    const t = (i - at) / SR;
    buf[i] += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * t + phase);
  }
}
function addSineEnv(buf, at, freq, t10ms, amp, attackMs, phase) {
  const tau = t10tau(t10ms);
  const att = Math.max(1e-5, (attackMs / 1000) / 3);
  for (let i = at; i < buf.length; i++) {
    const t = (i - at) / SR;
    buf[i] += amp * (1 - Math.exp(-t / att)) * Math.exp(-t / tau) * Math.sin(2 * Math.PI * freq * t + phase);
  }
}
/* One plate mode = a detuned pair, so the resonance beats slightly like real wood. */
function addMode(buf, at, f, t10, amp, rand, spread) {
  const d = spread * (0.6 + 0.8 * rand());
  addSine(buf, at, f * (1 - d), t10 * (0.98 + 0.04 * rand()), amp * 0.68, rand() * Math.PI * 2);
  addSine(buf, at, f * (1 + d), t10 * (1.02 + 0.02 * rand()), amp * 0.32, rand() * Math.PI * 2);
}
function addNoiseBurst(buf, at, lenMs, t10ms, amp, rand, shape) {
  const n = Math.max(2, Math.round(lenMs * SR / 1000));
  const seg = new Float64Array(n);
  const tau = t10tau(t10ms);
  for (let i = 0; i < n; i++) seg[i] = amp * (rand() * 2 - 1) * Math.exp(-(i / SR) / tau);
  if (shape) shape(seg);
  for (let i = 0; i < n && at + i < buf.length; i++) buf[at + i] += seg[i];
}

/* --------------------------------------------------------- instrument */
function woodKnock(buf, at, rand, o) {
  const spread = o.spread === undefined ? 0.006 : o.spread;
  for (let i = 0; i < o.modes.length; i++) addMode(buf, at, o.modes[i][0], o.modes[i][1], o.modes[i][2], rand, spread);
  for (let i = 0; i < o.thump.length; i++) addSine(buf, at, o.thump[i][0], o.thump[i][1], o.thump[i][2], rand() * Math.PI * 2);
  addNoiseBurst(buf, at, 1.7, 1.0, o.clickAmp, rand, function (seg) {
    filt(seg, biquad('hp', o.clickHp, 0.7));
    filt(seg, biquad('lp', o.clickLp, 0.7));
  });
  if (o.rattle) {
    addNoiseBurst(buf, at + o.rattle.at, o.rattle.len, o.rattle.t10, o.rattle.amp, rand, function (seg) {
      filt(seg, biquad('hp', 800, 0.7));
      filt(seg, biquad('lp', 3800, 0.7));
    });
  }
}
function thud(buf, at, rand, o) {
  addSine(buf, at, o.f, o.t10, o.amp, rand() * Math.PI * 2);
  addSine(buf, at, o.f * 1.5, o.t10 * 0.5, o.amp * 0.18, rand() * Math.PI * 2);
  addNoiseBurst(buf, at, 3, 2.5, o.noise, rand, function (seg) {
    filt(seg, biquad('lp', 600, 0.8));
  });
}
function malletNote(buf, at, freq, rand, o) {
  const parts = [[1, 1.0, 1.0], [2.0, 0.32, 0.55], [3.01, 0.11, 0.35]];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    addSineEnv(buf, at, freq * p[0] * jf(rand, 0.0015), o.t10 * p[2], o.amp * p[1], o.attackMs, rand() * Math.PI * 2);
  }
  addSineEnv(buf, at, freq * 0.5, o.t10 * 0.6, o.amp * 0.10, o.attackMs, 0);
}
function makeSet(rand, base, fJ, tJ, aJ) {
  const out = [];
  for (let i = 0; i < base.length; i++) out.push([base[i][0] * jf(rand, fJ), base[i][1] * jf(rand, tJ), base[i][2] * jf(rand, aJ)]);
  return out;
}
function scaleSet(set, s) { return set.map(function (m) { return [m[0] * s[0], m[1] * s[1], m[2] * s[2]]; }); }

/* -------------------------------------------------------- finalize/WAV */
function finalize(buf, opts) {
  const fadeInMs = opts.fadeInMs === undefined ? 1 : opts.fadeInMs;
  const fadeOutMs = opts.fadeOutMs === undefined ? 25 : opts.fadeOutMs;
  dcBlock(buf);
  const fi = Math.max(20, Math.round(fadeInMs * SR / 1000));
  for (let i = 0; i < fi && i < buf.length; i++) {
    if (i < 20) { buf[i] = 0; continue; }
    const g = (i - 19) / (fi - 19);
    buf[i] *= g * g * (3 - 2 * g);
  }
  const fo = Math.max(2, Math.round(fadeOutMs * SR / 1000));
  for (let i = 0; i < fo && i < buf.length; i++) {
    const j = buf.length - 1 - i;
    const g = i / (fo - 1);
    buf[j] *= g * g * (3 - 2 * g);
  }
  for (let i = 0; i < 20 && i < buf.length; i++) { buf[i] = 0; buf[buf.length - 1 - i] = 0; }
  let peak = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > peak) peak = a; }
  if (peak > 0) { const g = db2a(PEAK_DBFS) / peak; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}
function toPCM16(buf) {
  const out = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) {
    let s = Math.round(buf[i] * 32767);
    if (s > 32767) s = 32767;
    if (s < -32768) s = -32768;
    out.writeInt16LE(s, i * 2);
  }
  return out;
}
function wavFromPCM16(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/* ------------------------------------------------------------ recipes */
const MOVE_MODES = [[1780, 46, 0.95], [2380, 38, 0.78], [3120, 30, 0.60], [4180, 24, 0.42], [5260, 19, 0.30]];
const MOVE_THUMP = [[146, 95, 0.40], [196, 60, 0.30]];

function renderMove(rand) {
  const buf = buffer(130);
  woodKnock(buf, 0, rand, {
    modes: makeSet(rand, MOVE_MODES, 0.05, 0.18, 0.22),
    thump: makeSet(rand, MOVE_THUMP, 0.06, 0.22, 0.25),
    clickAmp: 0.9, clickHp: 1100, clickLp: 9500
  });
  return finalize(buf, { fadeOutMs: 26 });
}
function renderCapture(rand) {
  const buf = buffer(220);
  /* hit 1: the collision -- harder click, a touch more body, impact dirt that dies
     with the same knock instead of lingering. */
  woodKnock(buf, 0, rand, {
    modes: scaleSet(makeSet(rand, MOVE_MODES, 0.05, 0.20, 0.20), [0.92, 1.25, 1.10]),
    thump: scaleSet(makeSet(rand, MOVE_THUMP, 0.06, 0.20, 0.20), [0.95, 1.20, 1.10]),
    clickAmp: 1.30, clickHp: 900, clickLp: 11000,
    rattle: { at: Math.round(2 * 0.001 * SR), len: 26, t10: 16, amp: 0.13 }
  });
  /* hit 2: the captured piece meeting the table, later and softer, shorter decay. */
  const at2 = Math.round((84 + rand() * 10) * 0.001 * SR);
  woodKnock(buf, at2, rand, {
    modes: scaleSet(makeSet(rand, MOVE_MODES, 0.05, 0.18, 0.15), [0.80, 0.75, 0.55]),
    thump: scaleSet(makeSet(rand, MOVE_THUMP, 0.06, 0.18, 0.15), [0.84, 0.80, 0.55]),
    clickAmp: 0.60, clickHp: 1000, clickLp: 8500
  });
  /* then it slides off the square: low-level friction, no pitch motion. */
  addNoiseBurst(buf, Math.round(0.105 * SR), 72, 58, 0.11, rand, function (seg) {
    filt(seg, biquad('bp', 1400, 0.8)); filt(seg, biquad('lp', 4200, 0.7));
  });
  saturate(buf, 1.12);
  return finalize(buf, { fadeOutMs: 30 });
}
function renderCastle(rand) {
  const buf = buffer(220);
  woodKnock(buf, 0, rand, {
    modes: makeSet(rand, MOVE_MODES, 0.05, 0.15, 0.15),
    thump: makeSet(rand, MOVE_THUMP, 0.05, 0.20, 0.20),
    clickAmp: 0.85, clickHp: 1100, clickLp: 9500
  });
  const at2 = Math.round(0.092 * SR);
  woodKnock(buf, at2, rand, {
    modes: scaleSet(makeSet(rand, MOVE_MODES, 0.05, 0.15, 0.15), [0.78, 1.15, 0.95]),
    thump: scaleSet(makeSet(rand, MOVE_THUMP, 0.05, 0.15, 0.15), [0.80, 1.20, 0.90]),
    clickAmp: 0.8, clickHp: 900, clickLp: 8000
  });
  return finalize(buf, { fadeOutMs: 28 });
}
function renderCheck(rand) {
  const buf = buffer(260);
  const base = 1180 * jf(rand, 0.03);
  const parts = [[1.0, 215, 1.0], [1.343, 190, 0.62], [1.85, 170, 0.44], [2.10, 130, 0.30], [2.95, 80, 0.12]];
  for (let i = 0; i < parts.length; i++) {
    addSineEnv(buf, 0, base * parts[i][0], parts[i][1], parts[i][2], 1.2, rand() * Math.PI * 2);
  }
  addNoiseBurst(buf, 0, 1.4, 0.9, 0.55, rand, function (seg) {
    filt(seg, biquad('hp', 1800, 0.7)); filt(seg, biquad('lp', 9000, 0.7));
  });
  /* low swell: blooms fast and falls away under the ring (110/95/120 ms) so the
     alert does not wobble as two long low partials beat against the metal. */
  addSineEnv(buf, 0, 96, 110, 0.30, 4, rand() * Math.PI * 2);
  addSineEnv(buf, 0, 136, 95, 0.22, 4, rand() * Math.PI * 2);
  addSineEnv(buf, 0, 68, 120, 0.16, 5, rand() * Math.PI * 2);
  return finalize(buf, { fadeOutMs: 34 });
}
function malletSeq(rand, freqs, spacingMs, t10, ms, fadeOutMs, amp) {
  const buf = buffer(ms);
  for (let i = 0; i < freqs.length; i++) {
    malletNote(buf, Math.round(i * spacingMs * 0.001 * SR), freqs[i], rand, { t10: t10, amp: amp, attackMs: 2.2 });
  }
  return finalize(buf, { fadeOutMs: fadeOutMs });
}
function renderPromote(rand) { return malletSeq(rand, [523.25, 659.25, 783.99, 1046.5], 95, 115, 440, 38, 0.9); }
function renderWin(rand) { return malletSeq(rand, [392.0, 523.25, 659.25, 783.99, 1046.5], 72, 120, 440, 32, 0.85); }
function renderLoss(rand) { return malletSeq(rand, [659.25, 587.33, 523.25, 493.88, 440.0], 72, 145, 450, 38, 0.85); }
function renderIllegal(rand) {
  const buf = buffer(190);
  thud(buf, 0, rand, { f: 158, t10: 72, amp: 1.0, noise: 0.22 });
  thud(buf, Math.round(0.075 * SR), rand, { f: 124, t10: 70, amp: 0.85, noise: 0.18 });
  return finalize(buf, { fadeOutMs: 28 });
}
function renderTick(rand) {
  const buf = buffer(30);
  addMode(buf, 0, 2380, 14, 0.9, rand, 0.010);
  addMode(buf, 0, 3460, 11, 0.7, rand, 0.010);
  addMode(buf, 0, 4520, 8, 0.4, rand, 0.010);
  addSine(buf, 0, 520, 12, 0.25, rand() * Math.PI * 2);
  addNoiseBurst(buf, 0, 1.2, 0.9, 0.8, rand, function (seg) {
    filt(seg, biquad('hp', 1500, 0.7)); filt(seg, biquad('lp', 9000, 0.7));
  });
  return finalize(buf, { fadeOutMs: 15 });
}
function renderGameStart(rand) {
  const buf = buffer(240);
  woodKnock(buf, 0, rand, {
    modes: scaleSet(makeSet(rand, MOVE_MODES, 0.05, 0.15, 0.15), [0.90, 1.0, 0.9]),
    thump: scaleSet(makeSet(rand, MOVE_THUMP, 0.05, 0.15, 0.15), [0.95, 1.0, 0.9]),
    clickAmp: 0.45, clickHp: 1100, clickLp: 8000
  });
  woodKnock(buf, Math.round(0.150 * SR), rand, {
    modes: scaleSet(makeSet(rand, MOVE_MODES, 0.05, 0.15, 0.15), [1.15, 1.0, 0.85]),
    thump: scaleSet(makeSet(rand, MOVE_THUMP, 0.05, 0.15, 0.15), [1.1, 1.0, 0.85]),
    clickAmp: 0.42, clickHp: 1100, clickLp: 8000
  });
  return finalize(buf, { fadeOutMs: 30 });
}

const SPECS = [
  { id: 'move', label: 'Move', file: 'move.wav', ms: 130, kind: 'move', seed: 101, render: renderMove },
  { id: 'move-2', label: 'Move (alt 2)', file: 'move-2.wav', ms: 130, kind: 'move', seed: 202, render: renderMove },
  { id: 'move-3', label: 'Move (alt 3)', file: 'move-3.wav', ms: 130, kind: 'move', seed: 303, render: renderMove },
  { id: 'capture', label: 'Capture', file: 'capture.wav', ms: 220, kind: 'capture', seed: 404, render: renderCapture },
  { id: 'capture-2', label: 'Capture (alt 2)', file: 'capture-2.wav', ms: 220, kind: 'capture', seed: 505, render: renderCapture },
  { id: 'capture-3', label: 'Capture (alt 3)', file: 'capture-3.wav', ms: 220, kind: 'capture', seed: 606, render: renderCapture },
  { id: 'castle', label: 'Castle', file: 'castle.wav', ms: 220, kind: 'castle', seed: 707, render: renderCastle },
  { id: 'check', label: 'Check', file: 'check.wav', ms: 260, kind: 'check', seed: 808, render: renderCheck },
  { id: 'promote', label: 'Promote', file: 'promote.wav', ms: 440, kind: 'promote', seed: 909, render: renderPromote },
  { id: 'game-end-win', label: 'Game End (Win)', file: 'game-end-win.wav', ms: 440, kind: 'game-end-win', seed: 1010, render: renderWin },
  { id: 'game-end-loss', label: 'Game End (Loss)', file: 'game-end-loss.wav', ms: 450, kind: 'game-end-loss', seed: 1111, render: renderLoss },
  { id: 'illegal', label: 'Illegal Move', file: 'illegal.wav', ms: 190, kind: 'illegal', seed: 1212, render: renderIllegal },
  { id: 'low-time-tick', label: 'Low Time Tick', file: 'low-time-tick.wav', ms: 30, kind: 'tick', seed: 1313, render: renderTick },
  { id: 'game-start', label: 'Game Start', file: 'game-start.wav', ms: 240, kind: 'game-start', seed: 1414, render: renderGameStart }
];

/* ------------------------------------------------------------ generate */
function generate() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sounds = [];
  let total = 0;
  console.log('RENDERING bank -> ' + OUT_DIR);
  for (let i = 0; i < SPECS.length; i++) {
    const s = SPECS[i];
    const rand = mulberry32(s.seed);
    const buf = s.render(rand);
    const wav = wavFromPCM16(toPCM16(buf));
    fs.writeFileSync(path.join(OUT_DIR, s.file), wav);
    total += wav.length;
    sounds.push({ id: s.id, label: s.label, file: s.file, ms: s.ms, kind: s.kind });
    console.log('  ' + s.file.padEnd(22) + String(wav.length).padStart(7) + ' bytes  (' + s.ms + ' ms, ' + s.kind + ')');
  }
  const manifest = { version: 1, sounds: sounds };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log('  ' + 'manifest.json'.padEnd(22) + String(fs.statSync(MANIFEST_PATH).size).padStart(7) + ' bytes  (' + sounds.length + ' sounds)');
  console.log('BANK TOTAL: ' + total + ' bytes (' + (total / 1024).toFixed(1) + ' KiB) across ' + sounds.length + ' WAVs');
}

/* -------------------------------------------------------------- verify */
/* centroid/t10 windows follow the brief: a wooden knock sits ~1-6 kHz and decays to
 * 10% in 20-120 ms; a struck-metal ring lasts 200-600 ms. illegal is deliberately a
 * dull low thud, and the melodic cues sit lower still, so those two have their own
 * windows. "hits" is the number of envelope onsets >=25 ms apart (proves the second
 * click/knock really exists); null = informational only. */
const RANGES = {
  move: { centroid: [1000, 6500], t10: [20, 130], percussive: true, hits: [1, 1] },
  capture: { centroid: [700, 6500], t10: [80, 300], percussive: true, hits: [2, 2] },
  castle: { centroid: [900, 6500], t10: [100, 400], percussive: true, hits: [2, 2] },
  check: { centroid: [700, 4500], t10: [150, 620], percussive: true, hits: [1, 1] },
  promote: { centroid: [250, 3200], t10: [300, 800], percussive: false, hits: null },
  'game-end-win': { centroid: [250, 3200], t10: [300, 900], percussive: false, hits: null },
  'game-end-loss': { centroid: [250, 3200], t10: [300, 900], percussive: false, hits: null },
  illegal: { centroid: [80, 1600], t10: [80, 300], percussive: true, hits: [2, 2] },
  tick: { centroid: [1400, 7000], t10: [5, 45], percussive: true, hits: [1, 1] },
  'game-start': { centroid: [900, 6500], t10: [120, 500], percussive: true, hits: [2, 2] }
};

function parseWav(file, fail) {
  const b = fs.readFileSync(file);
  if (b.length < 44) { fail.push('too short for a WAV header'); return null; }
  if (b.toString('ascii', 0, 4) !== 'RIFF') fail.push('missing RIFF');
  if (b.readUInt32LE(4) !== b.length - 8) fail.push('RIFF size ' + b.readUInt32LE(4) + ' != file-8 ' + (b.length - 8));
  if (b.toString('ascii', 8, 12) !== 'WAVE') fail.push('missing WAVE');
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const sz = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = { audioFormat: b.readUInt16LE(body), channels: b.readUInt16LE(body + 2), sampleRate: b.readUInt32LE(body + 4), byteRate: b.readUInt32LE(body + 8), blockAlign: b.readUInt16LE(body + 12), bits: b.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      data = b.subarray(body, body + sz);
    }
    pos = body + sz + (sz % 2);
  }
  if (!fmt) { fail.push('no fmt chunk'); return null; }
  if (!data) { fail.push('no data chunk'); return null; }
  if (fmt.audioFormat !== 1) fail.push('format ' + fmt.audioFormat + ' != PCM(1)');
  if (fmt.channels !== 1) fail.push('channels ' + fmt.channels + ' != 1');
  if (fmt.sampleRate !== SR) fail.push('sampleRate ' + fmt.sampleRate + ' != ' + SR);
  if (fmt.bits !== 16) fail.push('bits ' + fmt.bits + ' != 16');
  if (fmt.byteRate !== SR * 2) fail.push('byteRate ' + fmt.byteRate + ' != ' + SR * 2);
  if (fmt.blockAlign !== 2) fail.push('blockAlign ' + fmt.blockAlign + ' != 2');
  if (data.length % 2 !== 0) fail.push('odd data length');
  const n = Math.floor(data.length / 2);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
  return { bytes: b.length, n: n, samples: samples };
}

/* Counts distinct envelope hits: local maxima above 35% of the envelope peak, at
 * least 60 ms apart (real knocks/clicks in this bank are 75-150 ms apart) and
 * separated by a valley below the detection threshold and the new peak must stand
 * at least 5 dB above that valley. This sees the second click of a capture and the
 * second knock of a castle while ignoring ripple inside one knock or one ring. */
function countOnsets(env, emax) {
  const thr = 0.35 * emax, prom = 1.8, sep = Math.round(0.060 * SR), n = env.length, cand = [];
  for (let i = 1; i < n - 1; i++) {
    if (env[i] < thr || env[i] < env[i - 1]) continue;
    let isMax = true;
    const b = Math.min(n - 1, i + sep);
    for (let j = i + 1; j <= b; j++) { if (env[j] > env[i]) { isMax = false; break; } }
    if (isMax) cand.push(i);
  }
  const hits = [];
  for (let k = 0; k < cand.length; k++) {
    const p = cand[k];
    if (!hits.length) { hits.push(p); continue; }
    const prev = hits[hits.length - 1];
    if (p - prev < sep) { if (env[p] > env[prev]) hits[hits.length - 1] = p; continue; }
    let mn = Infinity;
    for (let j = prev; j <= p; j++) if (env[j] < mn) mn = env[j];
    // a real gap AND at least ~5 dB of prominence above that gap, so the decaying
    // ripple of a long ring is never mistaken for a second hit
    if (mn < thr && env[p] >= prom * mn) hits.push(p);
  }
  return hits;
}
/* Pitch of the note that starts at a detected onset: direct-DFT spectral peak in the
 * 150-1400 Hz band. The mallet fundamental is the strongest partial (1.0 vs 0.32 vs
 * 0.11), so this is reliable where autocorrelation octave-halved notes. Informational:
 * proves the melodic cues really rise/fall and are not one static tone. */
function estF0(samples, start, len) {
  const n = Math.min(len, samples.length - start);
  if (n < 256) return 0;
  const buf = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    buf[i] = samples[start + i] * win;
  }
  let best = -1, bestF = 0;
  for (let f = 150; f <= 1400; f += 2) {
    const w = 2 * Math.PI * f / SR;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { re += buf[i] * Math.cos(w * i); im -= buf[i] * Math.sin(w * i); }
    const m = Math.hypot(re, im);
    if (m > best) { best = m; bestF = f; }
  }
  return bestF;
}
/* Direct-DFT peak picker (informational: shows the check alert's partials are
 * inharmonic, i.e. a struck metal ring rather than a harmonic beep). */
function peakFreqs(samples, fLo, fHi, nPeaks) {
  const n = Math.min(samples.length, Math.round(0.060 * SR));
  const found = [];
  for (let f = fLo; f <= fHi; f += 5) {
    const w = 2 * Math.PI * f / SR;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
      re += samples[i] * win * Math.cos(w * i); im -= samples[i] * win * Math.sin(w * i);
    }
    found.push([f, Math.hypot(re, im)]);
  }
  found.sort(function (a, b) { return b[1] - a[1]; });
  const out = [];
  for (let k = 0; k < found.length && out.length < nPeaks; k++) {
    let ok = true;
    for (let j = 0; j < out.length; j++) if (Math.abs(found[k][0] - out[j]) < 150) { ok = false; break; }
    if (ok) out.push(found[k][0]);
  }
  return out;
}
function metrics(samples) {
  let peak = 0, peakIdx = 0, absMax = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > absMax) absMax = a;
    if (a > peak) { peak = a; peakIdx = i; }
  }
  const W = Math.round(0.003 * SR);
  const env = new Float64Array(samples.length);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
    if (i >= W) sum -= samples[i - W] * samples[i - W];
    env[i] = Math.sqrt(sum / Math.min(i + 1, W));
  }
  let emax = 0, emaxIdx = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > emax) { emax = env[i]; emaxIdx = i; }
  let last = 0;
  for (let i = 0; i < env.length; i++) if (env[i] >= 0.1 * emax) last = i;
  // End of significant energy, measured from clip start: for a single knock this is
  // its decay time, for a multi-hit cue it is the end of the whole tail.
  const t10ms = last / SR * 1000;
  const onsets = countOnsets(env, emax);
  const n3 = Math.round(0.003 * SR);
  let onset = 0;
  for (let i = 0; i < Math.min(n3, samples.length); i++) { const a = Math.abs(samples[i]); if (a > onset) onset = a; }
  const onsetRatio = peak > 0 ? onset / peak : 0;
  const n = Math.min(samples.length, Math.round(0.030 * SR));
  const N = 2048;
  const win = new Float64Array(N);
  for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); win[i] = samples[i] * w; }
  let num = 0, den = 0;
  for (let k = 1; k <= N / 2; k++) {
    const w = 2 * Math.PI * k / N, cw = Math.cos(w), sw = Math.sin(w);
    let cr = 1, ci = 0, re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      re += win[i] * cr; im -= win[i] * ci;
      const nr = cr * cw - ci * sw; ci = cr * sw + ci * cw; cr = nr;
    }
    const mag = Math.sqrt(re * re + im * im);
    num += (k * SR / N) * mag; den += mag;
  }
  const centroid = den > 0 ? num / den : 0;
  return { peak: peak, absMax: absMax, peakMs: peakIdx / SR * 1000, t10ms: t10ms, centroid: centroid, onsetRatio: onsetRatio, onsets: onsets };
}

function verify() {
  const failures = [];
  const melodies = [];
  let checkPartials = null;
  if (!fs.existsSync(MANIFEST_PATH)) { console.log('FAIL: manifest.json missing'); process.exitCode = 1; return; }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (manifest.version !== 1) failures.push('manifest version ' + manifest.version + ' != 1');
  if (!Array.isArray(manifest.sounds) || manifest.sounds.length === 0) failures.push('manifest.sounds not a non-empty array');
  const declared = {};
  console.log('VERIFY ' + OUT_DIR);
  console.log('file                   bytes   ms  peakdB  centroidHz   t10ms  hit  onset   verdict');
  let bankBytes = 0;
  const rows = [];
  for (let i = 0; i < manifest.sounds.length; i++) {
    const s = manifest.sounds[i];
    const local = [];
    const row = { id: s.id, file: s.file, ms: s.ms };
    if (typeof s.id !== 'string' || typeof s.label !== 'string' || typeof s.file !== 'string' || typeof s.ms !== 'number') {
      failures.push(s.file + ': manifest entry missing id/label/file/ms'); continue;
    }
    if (declared[s.file]) failures.push('duplicate manifest entry for ' + s.file);
    declared[s.file] = true;
    const full = path.join(OUT_DIR, s.file);
    if (!fs.existsSync(full)) { failures.push(s.file + ': listed in manifest but missing on disk'); rows.push(row); continue; }
    const p = parseWav(full, local);
    if (!p) { failures.push(s.file + ': ' + local.join('; ')); rows.push(row); continue; }
    bankBytes += p.bytes;
    row.bytes = p.bytes;
    const m = metrics(p.samples);
    row.m = m;
    const expected = Math.round(s.ms / 1000 * SR);
    if (p.n !== expected) local.push('sample count ' + p.n + ' != declared ' + expected + ' (' + s.ms + ' ms)');
    const peakDb = 20 * Math.log10(m.peak);
    row.peakDb = peakDb;
    if (peakDb < -4 || peakDb > -3) local.push('peak ' + peakDb.toFixed(2) + ' dBFS outside -4..-3');
    if (m.absMax > 1) local.push('sample above full scale: ' + m.absMax);
    for (let k = 0; k < 20 && k < p.n; k++) {
      if (p.samples[k] !== 0) { local.push('first 20 samples not zero (index ' + k + ')'); break; }
    }
    for (let k = 0; k < 20 && k < p.n; k++) {
      if (p.samples[p.n - 1 - k] !== 0) { local.push('last 20 samples not zero (index ' + (p.n - 1 - k) + ')'); break; }
    }
    if (s.ms < 30 || s.ms > 1200) local.push('declared ms ' + s.ms + ' outside 30..1200');
    if (p.bytes >= SIZE_CAP) local.push('file ' + p.bytes + ' bytes >= 40 KiB cap');
    const kind = typeof s.kind === 'string' ? s.kind : s.id.replace(/-[0-9]+$/, '');
    const R = RANGES[kind];
    if (!R) local.push('no metric range for kind "' + kind + '"');
    else {
      if (m.centroid < R.centroid[0] || m.centroid > R.centroid[1]) local.push('centroid ' + m.centroid.toFixed(0) + ' Hz outside ' + R.centroid[0] + '..' + R.centroid[1]);
      if (m.t10ms < R.t10[0] || m.t10ms > R.t10[1]) local.push('t10 ' + m.t10ms.toFixed(1) + ' ms outside ' + R.t10[0] + '..' + R.t10[1]);
      const minOnset = R.percussive ? 0.15 : 0.05;
      if (m.onsetRatio < minOnset) local.push('onset ratio ' + m.onsetRatio.toFixed(3) + ' < ' + minOnset + ' (attack too slow)');
      if (R.hits && (m.onsets.length < R.hits[0] || m.onsets.length > R.hits[1])) {
        local.push('envelope hits ' + m.onsets.length + ' outside ' + R.hits[0] + '..' + R.hits[1]);
      }
    }
    if (kind === 'promote' || kind === 'game-end-win' || kind === 'game-end-loss') {
      const f0s = [];
      for (let k = 0; k < m.onsets.length; k++) f0s.push(estF0(p.samples, m.onsets[k], Math.round(0.030 * SR)));
      row.f0s = f0s;
      if (f0s.length >= 2) {
        const rising = f0s[f0s.length - 1] > f0s[0] * 1.05;
        const falling = f0s[f0s.length - 1] < f0s[0] * 0.95;
        if (kind === 'game-end-loss' && !falling) local.push('melody does not descend: ' + f0s.map(function (v) { return v.toFixed(0); }).join(' -> '));
        if (kind !== 'game-end-loss' && !rising) local.push('melody does not rise: ' + f0s.map(function (v) { return v.toFixed(0); }).join(' -> '));
      }
    }
    if (kind === 'check') checkPartials = peakFreqs(p.samples, 700, 4000, 4);
    row.local = local;
    rows.push(row);
    for (let k = 0; k < local.length; k++) failures.push(s.file + ': ' + local[k]);
  }
  // orphan check: any WAV in the bank dir not listed in the manifest
  const onDisk = fs.readdirSync(OUT_DIR).filter(function (f) { return /\.wav$/i.test(f); });
  for (let i = 0; i < onDisk.length; i++) if (!declared[onDisk[i]]) failures.push('orphan file not in manifest: ' + onDisk[i]);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    console.log(
      (r.file || r.id).padEnd(22) +
      String(r.bytes === undefined ? '-' : r.bytes).padStart(6) + '  ' +
      String(r.ms).padStart(4) + '  ' +
      (r.peakDb === undefined ? '   -  ' : r.peakDb.toFixed(2).padStart(6) + '  ') +
      (r.m === undefined ? '        -    ' : r.m.centroid.toFixed(0).padStart(8) + '  ') +
      (r.m === undefined ? '      - ' : r.m.t10ms.toFixed(1).padStart(7)) + '  ' +
      (r.m === undefined ? '  - ' : String(r.m.onsets.length).padStart(3)) + '  ' +
      (r.m === undefined ? '   -   ' : r.m.onsetRatio.toFixed(2).padStart(5)) + '   ' +
      ((r.local && r.local.length) ? 'FAIL' : 'ok')
    );
  }
  if (bankBytes >= BANK_CAP) failures.push('bank total ' + bankBytes + ' bytes >= 700 KiB cap');
  console.log('');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.f0s) continue;
    console.log('melody ' + r.file.padEnd(18) + r.f0s.map(function (v) { return v.toFixed(0); }).join(' -> ') + ' Hz' + (r.f0s.length && r.f0s[r.f0s.length - 1] > r.f0s[0] ? '  (rising)' : '  (falling)'));
  }
  if (checkPartials) {
    console.log('check partials    ' + checkPartials.join(' / ') + ' Hz   ratios ' + checkPartials.map(function (v) { return (v / checkPartials[0]).toFixed(2); }).join(' / '));
  }
  console.log('bank total: ' + bankBytes + ' bytes (' + (bankBytes / 1024).toFixed(1) + ' KiB)');
  console.log('checks: RIFF/WAVE/fmt/data, PCM16 mono ' + SR + ', sample count vs declared ms, peak -4..-3 dBFS,');
  console.log('        first/last 20 samples zero, no sample > full scale, 40 KiB/file cap, 700 KiB bank cap,');
  console.log('        manifest<->disk bijection, per-kind spectral centroid + decay-to-10% + envelope-hit count.');
  if (failures.length) {
    console.log('');
    console.log('FAILURES (' + failures.length + '):');
    for (let i = 0; i < failures.length; i++) console.log('  - ' + failures[i]);
    process.exitCode = 1;
  } else {
    console.log('');
    console.log('ALL CHECKS PASSED (' + manifest.sounds.length + ' files).');
  }
}

const mode = process.argv[2];
if (mode === 'verify') verify();
else generate();
