'use strict';
/*
 * audit-audio.js - independent quality audit for the arcade-hub chess + meme audio banks.
 *
 * Subcommands:
 *   analyze [--out=FILE]   measure every clip referenced by the manifests, print table + flags
 *   fix                    trim/level clips in place, writing backups first, then refresh manifests
 *   verify                 re-parse everything the manifests reference and assert the contract,
 *                          cross-check numbers with an independent ffmpeg decoder
 *
 * There is NO audio device in this environment: every judgement here is a numeric
 * measurement (peak/RMS/onset/silence/duplicate correlation), never listening.
 *
 * Parser A is the hand-rolled RIFF/WAVE reader in this file. Parser B is ffmpeg
 * (raw s16le decode + ffprobe duration), used only by verify as a cross-check.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = 'C:\\Users\\caleb\\AppData\\Local\\arcade-hub';
const AUDIO = path.join(ROOT, 'games', 'audio');
const CHESS = path.join(AUDIO, 'chess');
const MEMES = path.join(AUDIO, 'memes');
const OUTDIR = path.join(ROOT, '_loop', 'audio-gen');
const BACKUP = path.join(OUTDIR, 'backup');
const FFMPEG = 'C:\\Users\\caleb\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffmpeg.exe';
const FFPROBE = 'C:\\Users\\caleb\\AppData\\Local\\Microsoft\\WinGet\\Links\\ffprobe.exe';

const FULL_SCALE = 32768.0;
const TARGET_PEAK_DB = -3.5;
const PEAK_MIN_DB = -4, PEAK_MAX_DB = -3;
const NEAR_ZERO_FRAC = 0.005;
const ABS_FLOOR = 3e-5;
const ONSET_REL = 0.10;
const ONSET_FLAG_MS = 150;
const LEAD_FLAG_MS = 200;
const TRAIL_FLAG_MS = 300;

// Per-event duration windows (ms) - the range set per event type.
const CHESS_RANGE = {
  move: [40, 300], capture: [50, 320], castle: [50, 450], check: [50, 800],
  promote: [50, 1200], 'game-end-win': [50, 1600], 'game-end-loss': [50, 1600],
  illegal: [50, 420], 'low-time-tick': [10, 160], 'game-start': [50, 650],
  'ui-click': [20, 320], 'ui-hover': [20, 260]
};
const MEME_RANGE = {
  capture: [120, 1900], blunder: [120, 2900], check: [120, 3100], checkmate: [120, 1800],
  castle: [120, 2600], promote: [120, 2000], win: [120, 4000], lose: [120, 3100],
  draw: [120, 1400], start: [120, 1400], undo: [120, 1800], hint: [120, 1300],
  combo3: [120, 1500]
};

// ---------------------------------------------------------------------------
// Parser A: hand-rolled RIFF/WAVE reader (PCM 16-bit)
// ---------------------------------------------------------------------------
function parseWav(buf) {
  if (buf.length < 44) throw new Error('too short');
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not RIFF');
  if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not WAVE');
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = buf.slice(pos + 8, pos + 8 + size);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: body.readUInt16LE(0), channels: body.readUInt16LE(2),
        rate: body.readUInt32LE(4), byteRate: body.readUInt32LE(8),
        blockAlign: body.readUInt16LE(12), bits: body.readUInt16LE(14)
      };
    } else if (id === 'data') { data = body; }
    pos += 8 + size + (size % 2);
  }
  if (!fmt) throw new Error('no fmt chunk');
  if (!data) throw new Error('no data chunk');
  const samples = new Int16Array(data.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2);
  return { fmt, samples, rate: fmt.rate };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
function metrics(w) {
  const s = w.samples, n = s.length, rate = w.rate;
  let peak = 0, sum2 = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(s[i]) / FULL_SCALE; if (v > peak) peak = v; sum2 += v * v; }
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
  const rmsDb = n > 0 && sum2 > 0 ? 20 * Math.log10(Math.sqrt(sum2 / n)) : -Infinity;

  const win = Math.max(1, Math.round(rate * 0.005));
  const wins = [];
  for (let i = 0; i + win <= n; i += win) {
    let a = 0;
    for (let j = 0; j < win; j++) { const v = s[i + j] / FULL_SCALE; a += v * v; }
    wins.push(Math.sqrt(a / win));
  }
  const peakWin = wins.length ? Math.max.apply(null, wins) : 0;
  const onsetThr = peakWin * ONSET_REL;
  let firstWin = -1, lastWin = -1;
  for (let i = 0; i < wins.length; i++) if (wins[i] >= onsetThr) { firstWin = i; break; }
  for (let i = wins.length - 1; i >= 0; i--) if (wins[i] >= onsetThr) { lastWin = i; break; }

  const floor = Math.max(peak * NEAR_ZERO_FRAC, ABS_FLOOR);
  let firstSound = 0, lastSound = Math.max(0, n - 1);
  for (let i = 0; i < n; i++) if (Math.abs(s[i]) / FULL_SCALE > floor) { firstSound = i; break; }
  for (let i = n - 1; i >= 0; i--) if (Math.abs(s[i]) / FULL_SCALE > floor) { lastSound = i; break; }
  const durMs = n / rate * 1000;
  return {
    samples: n, rate, durMs,
    peakDb, rmsDb,
    onsetMs: firstWin < 0 ? durMs : firstWin * 0.005 * 1000,
    activeEndMs: lastWin < 0 ? 0 : (lastWin + 1) * 0.005 * 1000,
    leadMs: firstSound / rate * 1000,
    trailMs: (n - 1 - lastSound) / rate * 1000,
    meaningfulMs: (lastSound - firstSound + 1) / rate * 1000,
    fingerprint: fingerprint(w)
  };
}
function fingerprint(w) {
  const s = w.samples, n = s.length, rate = w.rate;
  if (!n) return new Float64Array(64);
  let peak = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(s[i]); if (v > peak) peak = v; }
  const floor = Math.max(peak * NEAR_ZERO_FRAC, ABS_FLOOR);
  let a = 0, b = n - 1;
  for (let i = 0; i < n; i++) if (Math.abs(s[i]) > floor) { a = i; break; }
  for (let i = n - 1; i >= 0; i--) if (Math.abs(s[i]) > floor) { b = i; break; }
  const len = Math.max(1, b - a + 1);
  const win = Math.max(1, Math.round(rate * 0.005));
  const BINS = 64, out = new Float64Array(BINS);
  for (let k = 0; k < BINS; k++) {
    const lo = a + Math.floor(len * k / BINS), hi = a + Math.max(lo + 1, Math.floor(len * (k + 1) / BINS));
    let acc = 0, c = 0;
    for (let i = lo; i < hi && i < n; i += win) {
      let e = 0;
      for (let j = 0; j < win && i + j < n; j++) { const v = s[i + j] / FULL_SCALE; e += v * v; }
      acc += Math.sqrt(e / win); c++;
    }
    out[k] = c ? acc / c : 0;
  }
  let mean = 0; for (const v of out) mean += v; mean /= BINS;
  let norm = 0; for (const v of out) norm += (v - mean) * (v - mean);
  norm = Math.sqrt(norm) || 1;
  for (let k = 0; k < BINS; k++) out[k] = (out[k] - mean) / norm;
  return out;
}
function corr(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) c += a[i] * b[i];
  return c;
}
function centroidHz(w) {
  const s = w.samples, n = s.length, rate = w.rate;
  const N = 2048;
  if (n < 64) return 0;
  let bi = 0, bp = 0;
  for (let i = 0; i + N <= n; i += 256) {
    let p = 0; for (let j = 0; j < N; j++) { const v = Math.abs(s[i + j]); if (v > p) p = v; }
    if (p > bp) { bp = p; bi = i; }
  }
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (bi + i < n ? s[bi + i] / FULL_SCALE : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    const mag = Math.hypot(re[k], im[k]);
    num += mag * (k * rate / N); den += mag;
  }
  return den ? num / den : 0;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function chessBanks() {
  const crisp = readJson(path.join(CHESS, 'manifest.json'));
  const natural = readJson(path.join(CHESS, 'manifest-natural.json'));
  return [
    { bank: 'chess-crisp', kind: 'chess', manifestPath: path.join(CHESS, 'manifest.json'), dir: CHESS, json: crisp, sounds: crisp.sounds },
    { bank: 'chess-natural', kind: 'chess', manifestPath: path.join(CHESS, 'manifest-natural.json'), dir: CHESS, json: natural, sounds: natural.sounds }
  ];
}
function memeBanks() {
  const json = readJson(path.join(MEMES, 'manifest.json'));
  const out = [];
  for (const pack of json.packs) out.push({ bank: 'memes', kind: 'memes', pack: pack.id, manifestPath: path.join(MEMES, 'manifest.json'), dir: MEMES, json, sounds: pack.sounds });
  return out;
}
function allBanks() { return chessBanks().concat(memeBanks()); }

function eventKey(s) { return s.when || s.kind || s.id; }
function rangeFor(bank, s) {
  const R = bank.kind === 'chess' ? CHESS_RANGE : MEME_RANGE;
  const k = eventKey(s);
  if (R[k]) return R[k];
  const base = String(k).replace(/-\d+$/, '');
  if (R[base]) return R[base];
  if (R[s.id]) return R[s.id];
  return [0, 99999];
}
function loadClip(bank, s) {
  const abs = path.join(bank.dir, s.file);
  const buf = fs.readFileSync(abs);
  const w = parseWav(buf);
  return { abs, buf, w, m: metrics(w), centroid: centroidHz(w) };
}

// ---------------------------------------------------------------------------
// analyze
// ---------------------------------------------------------------------------
function flagsFor(c) {
  const m = c.m, f = [];
  if (m.onsetMs > ONSET_FLAG_MS) f.push('onset ' + m.onsetMs.toFixed(0) + 'ms');
  if (m.leadMs > LEAD_FLAG_MS) f.push('lead-silence ' + m.leadMs.toFixed(0) + 'ms');
  if (m.trailMs > TRAIL_FLAG_MS) f.push('trail-silence ' + m.trailMs.toFixed(0) + 'ms');
  if (m.peakDb < -8) f.push('too-quiet ' + m.peakDb.toFixed(1) + 'dB');
  if (m.peakDb >= -0.3) f.push('clipping ' + m.peakDb.toFixed(1) + 'dB');
  const [lo, hi] = rangeFor(c.bank, c.sound);
  if (m.durMs > hi) f.push('too-long ' + m.durMs.toFixed(0) + 'ms>' + hi);
  if (m.durMs < lo) f.push('too-short ' + m.durMs.toFixed(0) + 'ms<' + lo);
  if (m.peakDb > PEAK_MAX_DB || m.peakDb < PEAK_MIN_DB) f.push('level ' + m.peakDb.toFixed(1) + 'dB');
  return f;
}
function analyze() {
  const rows = [], dupFlags = [];
  for (const bank of allBanks()) {
    const clips = [];
    for (const s of bank.sounds) {
      const c = loadClip(bank, s);
      c.bank = bank; c.sound = s; c.id = s.id; c.label = s.label; c.file = s.file; c.event = eventKey(s);
      c.flags = flagsFor(c);
      rows.push(c); clips.push(c);
    }
    for (let i = 0; i < clips.length; i++) for (let j = i + 1; j < clips.length; j++) {
      const a = clips[i], b = clips[j];
      const sameTarget = a.file === b.file;
      const r = corr(a.m.fingerprint, b.m.fingerprint);
      const dr = Math.min(a.m.durMs, b.m.durMs) / Math.max(a.m.durMs, b.m.durMs);
      if (sameTarget || (r > 0.985 && dr > 0.8)) {
        const tag = bank.bank + (bank.pack ? '/' + bank.pack : '');
        a.flags.push('near-dup:' + b.id); b.flags.push('near-dup:' + a.id);
        dupFlags.push(tag + ': ' + a.id + ' ~ ' + b.id + ' (corr=' + r.toFixed(3) + ', durRatio=' + dr.toFixed(2) + (sameTarget ? ', same file' : '') + ')');
      }
    }
  }
  return { rows, dupFlags, ranAt: new Date().toISOString() };
}
function fmtRow(r) {
  return [
    r.bank.bank + (r.bank.pack ? '/' + r.bank.pack : ''), r.id, r.file,
    r.m.durMs.toFixed(0), r.m.peakDb.toFixed(2), r.m.rmsDb.toFixed(1),
    r.m.onsetMs.toFixed(0), r.m.leadMs.toFixed(0), r.m.trailMs.toFixed(0),
    r.m.meaningfulMs.toFixed(0), Math.round(r.centroid || 0), r.flags.join(' ')
  ];
}
function printAnalysis(A) {
  const H = ['bank', 'id', 'file', 'durMs', 'peak', 'rms', 'onset', 'lead', 'trail', 'meaning', 'cent', 'flags'];
  const pad = [16, 14, 30, 6, 7, 6, 6, 6, 6, 8, 6, 44];
  const line = (a) => a.map((v, i) => String(v).padEnd(pad[i])).join(' ');
  console.log(line(H));
  console.log('-'.repeat(180));
  for (const r of A.rows) console.log(line(fmtRow(r)));
  console.log('\n== duplicate findings ==');
  console.log(A.dupFlags.length ? A.dupFlags.join('\n') : '(none)');
  const flagged = A.rows.filter(r => r.flags.length);
  console.log('\nflagged clips: ' + flagged.length + ' / ' + A.rows.length);
}
function serialise(c) {
  return {
    bank: c.bank.bank, pack: c.bank.pack || null, id: c.id, label: c.label, file: c.file, event: c.event,
    durMs: +c.m.durMs.toFixed(2), peakDb: +c.m.peakDb.toFixed(2), rmsDb: +c.m.rmsDb.toFixed(2),
    onsetMs: +c.m.onsetMs.toFixed(1), leadMs: +c.m.leadMs.toFixed(1), trailMs: +c.m.trailMs.toFixed(1),
    meaningfulMs: +c.m.meaningfulMs.toFixed(1), centroidHz: Math.round(c.centroid || 0),
    samples: c.m.samples, rate: c.m.rate, flags: c.flags.slice()
  };
}

// ---------------------------------------------------------------------------
// fix
// ---------------------------------------------------------------------------
function backupFile(bank, file) {
  const rel = bank.kind === 'memes' ? path.join('memes', file) : path.join('chess', file);
  const dest = path.join(BACKUP, rel);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(bank.dir, file), dest);
  }
}
function writeWav(abs, samples, rate) {
  const n = samples.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let v = Math.round(samples[i] * 32767);
    if (v > 32767) v = 32767; else if (v < -32768) v = -32768;
    buf.writeInt16LE(v, 44 + i * 2);
  }
  fs.writeFileSync(abs, buf);
  return buf.length;
}
function toFloat(w) { const f = new Float64Array(w.samples.length); for (let i = 0; i < f.length; i++) f[i] = w.samples[i] / FULL_SCALE; return f; }
function firstLastAbove(f, frac) {
  let peak = 0; for (let i = 0; i < f.length; i++) { const v = Math.abs(f[i]); if (v > peak) peak = v; }
  const floor = Math.max(peak * frac, ABS_FLOOR);
  let a = 0, b = f.length - 1;
  for (let i = 0; i < f.length; i++) if (Math.abs(f[i]) > floor) { a = i; break; }
  for (let i = f.length - 1; i >= 0; i--) if (Math.abs(f[i]) > floor) { b = i; break; }
  return { a, b, peak, floor };
}
function fixClip(bank, s) {
  const abs = path.join(bank.dir, s.file);
  const w = parseWav(fs.readFileSync(abs));
  const before = metrics(w);
  const rate = w.rate;
  const f = toFloat(w);
  const { a, b } = firstLastAbove(f, NEAR_ZERO_FRAC);
  const pre = Math.round(rate * 0.004);
  const post = Math.round(rate * (bank.kind === 'chess' ? 0.035 : 0.05));
  let from = Math.max(0, a - pre);
  let to = Math.min(f.length, b + 1 + post);

  // Onset-based head trim: a quiet lead-up makes a cue feel laggy. Trigger for
  // chess cues with onset > 60 ms, and any clip with onset > 150 ms. A genuinely
  // building head (pre-onset energy above -26 dB relative to the loudest window)
  // is only cut when the onset is over the explicit 150 ms lag threshold.
  const trigger = (bank.kind === 'chess' && before.onsetMs > 60) || before.onsetMs > 150;
  let headTrimmed = false;
  if (trigger) {
    const win = Math.max(1, Math.round(rate * 0.005));
    const wins = [];
    let peakWin = 0;
    for (let i = 0; i + win <= f.length; i += win) {
      let acc = 0;
      for (let j = 0; j < win; j++) acc += f[i + j] * f[i + j];
      const rr = Math.sqrt(acc / win); wins.push(rr); if (rr > peakWin) peakWin = rr;
    }
    let first = -1;
    for (let i = 0; i < wins.length; i++) if (wins[i] >= peakWin * ONSET_REL) { first = i; break; }
    if (first > 0) {
      let headMax = 0;
      for (let i = 0; i < first; i++) if (wins[i] > headMax) headMax = wins[i];
      const quietHead = headMax <= peakWin * 0.16;
      if (quietHead || before.onsetMs > 150) {
        const cutSample = Math.max(0, first * win - pre);
        if (cutSample > from) { from = cutSample; headTrimmed = true; }
      }
    }
  }

  const [lo, hi] = rangeFor(bank, s);
  const capSamples = Math.round(rate * hi / 1000);
  let capped = false;
  if (to - from > capSamples) {
    // only truncate a decay tail: refuse if the discarded region still carries energy
    let tailPeak = 0;
    for (let i = from + capSamples; i < to; i++) { const v = Math.abs(f[i]); if (v > tailPeak) tailPeak = v; }
    const tailAllow = bank.kind === 'chess' ? 0.25 : 0.05;
    if (tailPeak <= tailAllow * (before.peakDb > -Infinity ? Math.pow(10, before.peakDb / 20) : 0)) { to = from + capSamples; capped = true; }
  }
  const out = f.slice(from, to);
  // Fades are only applied to a boundary we actually cut, otherwise repeated fix runs
  // would progressively smear a click attack (fix must be idempotent).
  if (from > 0) {
    const fi = Math.min(Math.round(rate * 0.002), out.length);
    for (let i = 0; i < fi; i++) out[i] *= i / fi;
  }
  if (to < f.length) {
    const fo = Math.min(Math.round(rate * 0.02), Math.floor(out.length / 2));
    for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo;
  }
  let p = 0; for (const v of out) { const av = Math.abs(v); if (av > p) p = av; }
  const gain = p > 0 ? Math.pow(10, TARGET_PEAK_DB / 20) / p : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  backupFile(bank, s.file);
  writeWav(abs, out, rate);
  const after = metrics(parseWav(fs.readFileSync(abs)));
  return { before, after, trimmedMs: before.durMs - after.durMs, gainDb: 20 * Math.log10(gain), capped };
}
function writeMemesCatalog() {
  const manifest = readJson(path.join(MEMES, 'manifest.json'));
  const captions = readJson(path.join(MEMES, 'captions.json'));
  const text = '/* generated from manifest.json + captions.json - do not hand edit */\n' +
    'window.__MEME_BANK = ' + JSON.stringify(manifest) + ';\n' +
    'window.__MEME_CAPTIONS = ' + JSON.stringify(captions) + ';\n';
  fs.writeFileSync(path.join(MEMES, 'catalog.js'), text);
}
function fix() {
  const A0 = analyze();
  fs.writeFileSync(path.join(OUTDIR, 'audit-before.json'), JSON.stringify({ ranAt: A0.ranAt, rows: A0.rows.map(serialise), dupFlags: A0.dupFlags }, null, 1));
  const changes = [];
  for (const bank of allBanks()) {
    for (const s of bank.sounds) {
      const r = fixClip(bank, s);
      changes.push({
        bank: bank.bank, pack: bank.pack || null, id: s.id, file: s.file, event: eventKey(s),
        beforeDurMs: +r.before.durMs.toFixed(1), afterDurMs: +r.after.durMs.toFixed(1),
        beforePeakDb: +r.before.peakDb.toFixed(2), afterPeakDb: +r.after.peakDb.toFixed(2),
        beforeRmsDb: +r.before.rmsDb.toFixed(2), afterRmsDb: +r.after.rmsDb.toFixed(2),
        beforeOnsetMs: +r.before.onsetMs.toFixed(1), afterOnsetMs: +r.after.onsetMs.toFixed(1),
        beforeLeadMs: +r.before.leadMs.toFixed(1), afterLeadMs: +r.after.leadMs.toFixed(1),
        beforeTrailMs: +r.before.trailMs.toFixed(1), afterTrailMs: +r.after.trailMs.toFixed(1),
        gainDb: +r.gainDb.toFixed(2), trimmedMs: +r.trimmedMs.toFixed(1), capped: r.capped
      });
    }
  }
  // refresh the declared ms in the manifests (and the generated catalog.js) to the measured result
  const measuredMs = {};
  for (const bank of allBanks()) {
    for (const s of bank.sounds) {
      const key = bank.bank + '::' + (bank.pack || '') + '::' + s.id;
      measuredMs[key] = metrics(parseWav(fs.readFileSync(path.join(bank.dir, s.file)))).durMs;
    }
  }
  const crisp = readJson(path.join(CHESS, 'manifest.json'));
  for (const s of crisp.sounds) s.ms = Math.round(measuredMs['chess-crisp::::' + s.id]);
  fs.writeFileSync(path.join(CHESS, 'manifest.json'), JSON.stringify(crisp, null, 2) + '\n');
  const nat = readJson(path.join(CHESS, 'manifest-natural.json'));
  for (const s of nat.sounds) s.ms = Math.round(measuredMs['chess-natural::::' + s.id]);
  fs.writeFileSync(path.join(CHESS, 'manifest-natural.json'), JSON.stringify(nat, null, 2) + '\n');
  const mem = readJson(path.join(MEMES, 'manifest.json'));
  for (const pack of mem.packs) for (const s of pack.sounds) s.ms = Math.round(measuredMs['memes::' + pack.id + '::' + s.id]);
  fs.writeFileSync(path.join(MEMES, 'manifest.json'), JSON.stringify(mem, null, 1) + '\n');
  writeMemesCatalog();
  fs.writeFileSync(path.join(OUTDIR, 'audit-fix.json'), JSON.stringify(changes, null, 1));
  const A1 = analyze();
  fs.writeFileSync(path.join(OUTDIR, 'audit-after.json'), JSON.stringify({ ranAt: A1.ranAt, rows: A1.rows.map(serialise), dupFlags: A1.dupFlags }, null, 1));
  console.log(JSON.stringify(changes, null, 1));
  console.log('\nfixed ' + changes.length + ' clips; backups in ' + BACKUP);
  printAnalysis(A1);
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------
function ffIndependent(abs) {
  const dur = parseFloat(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', abs], { encoding: 'utf8' }).trim());
  const tmp = path.join(OUTDIR, '.tmp-ff.raw');
  execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', abs, '-ac', '1', '-f', 's16le', tmp], { stdio: 'ignore' });
  const raw = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const n = Math.floor(raw.length / 2);
  let peak = 0, sum2 = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(raw.readInt16LE(i * 2)) / FULL_SCALE; if (v > peak) peak = v; sum2 += v * v; }
  return { durMs: dur * 1000, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, rmsDb: n && sum2 > 0 ? 20 * Math.log10(Math.sqrt(sum2 / n)) : -Infinity, samples: n };
}
function verify() {
  const fails = [];
  const seenTargets = new Map();
  const all = allBanks();
  let checked = 0;
  for (const bank of all) {
    for (const s of bank.sounds) {
      const abs = path.join(bank.dir, s.file);
      const tag = bank.bank + (bank.pack ? '/' + bank.pack : '') + ':' + s.id;
      if (!fs.existsSync(abs)) { fails.push(tag + ' missing ' + s.file); continue; }
      checked++;
      const rel = path.relative(bank.dir, abs).replace(/\\/g, '/');
      const key = bank.bank + '::' + rel;
      if (seenTargets.has(key)) fails.push(tag + ' duplicate file target ' + rel + ' (also ' + seenTargets.get(key) + ')');
      else seenTargets.set(key, tag);
      const w = parseWav(fs.readFileSync(abs));
      const m = metrics(w);
      const [lo, hi] = rangeFor(bank, s);
      const problems = [];
      if (!(w.fmt.audioFormat === 1 && w.fmt.bits === 16)) problems.push('not PCM16');
      if (w.fmt.channels !== 1) problems.push('not mono');
      if (m.peakDb < PEAK_MIN_DB || m.peakDb > PEAK_MAX_DB) problems.push('peak ' + m.peakDb.toFixed(2) + 'dB outside -4..-3');
      if (m.durMs < lo || m.durMs > hi) problems.push('dur ' + m.durMs.toFixed(0) + ' outside ' + lo + '..' + hi);
      if (m.onsetMs > ONSET_FLAG_MS) problems.push('onset ' + m.onsetMs.toFixed(0));
      if (m.leadMs > LEAD_FLAG_MS) problems.push('lead ' + m.leadMs.toFixed(0));
      if (m.trailMs > TRAIL_FLAG_MS) problems.push('trail ' + m.trailMs.toFixed(0));
      const ff = ffIndependent(abs);
      if (Math.abs(ff.durMs - m.durMs) > 2) problems.push('ffmpeg dur mismatch ' + ff.durMs.toFixed(1) + ' vs ' + m.durMs.toFixed(1));
      if (Math.abs(ff.peakDb - m.peakDb) > 0.3) problems.push('ffmpeg peak mismatch ' + ff.peakDb.toFixed(2) + ' vs ' + m.peakDb.toFixed(2));
      if (Math.abs(ff.rmsDb - m.rmsDb) > 0.5) problems.push('ffmpeg rms mismatch ' + ff.rmsDb.toFixed(2) + ' vs ' + m.rmsDb.toFixed(2));
      if (problems.length) fails.push(tag + ' [' + s.file + '] ' + problems.join('; '));
    }
  }
  try {
    const memManifest = readJson(path.join(MEMES, 'manifest.json'));
    const txt = fs.readFileSync(path.join(MEMES, 'catalog.js'), 'utf8');
    const m = txt.match(/window\.__MEME_BANK\s*=\s*(\{[\s\S]*?\});/);
    if (!m) fails.push('catalog.js: no __MEME_BANK assignment found');
    else {
      const inline = JSON.parse(m[1]);
      if (JSON.stringify(inline) !== JSON.stringify(memManifest)) fails.push('catalog.js __MEME_BANK does not match manifest.json');
    }
  } catch (e) { fails.push('catalog.js check error: ' + e.message); }
  console.log('verified ' + checked + ' referenced clips across ' + all.length + ' bank sections');
  if (fails.length) { console.log('VERIFY FAIL (' + fails.length + ')'); for (const f of fails) console.log('  FAIL ' + f); process.exitCode = 1; }
  else console.log('VERIFY PASS');
  return fails;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const cmd = (process.argv[2] || 'analyze').toLowerCase();
  const outArg = (process.argv.find(a => a.indexOf('--out=') === 0) || '').slice(6);
  if (cmd === 'analyze') {
    const A = analyze();
    printAnalysis(A);
    const dest = outArg || path.join(OUTDIR, 'audit-latest.json');
    fs.writeFileSync(dest, JSON.stringify({ ranAt: A.ranAt, rows: A.rows.map(serialise), dupFlags: A.dupFlags }, null, 1));
    console.log('wrote ' + dest);
  } else if (cmd === 'fix') {
    fix();
  } else if (cmd === 'verify') {
    verify();
  } else {
    console.log('usage: node audit-audio.js [analyze|fix|verify] [--out=FILE]');
    process.exitCode = 2;
  }
}

module.exports = {
  ROOT, AUDIO, CHESS, MEMES, OUTDIR, BACKUP,
  CHESS_RANGE, MEME_RANGE,
  parseWav, metrics, fingerprint, corr, centroidHz,
  readJson, chessBanks, memeBanks, allBanks, eventKey, rangeFor, loadClip,
  analyze, printAnalysis, serialise, fix, verify, ffIndependent, writeMemesCatalog
};
