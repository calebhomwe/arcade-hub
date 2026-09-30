/* KidsKit: shared parts for the young players' games (Whack-a-Mole, Memory Match, Bubble Pop, Simon Says,
 * Word Scramble, Math Snake). Load AFTER the arcade SDK and kit/kidskit.css. Everything is guarded, nothing here needs the SDK.
 *
 *   KK.h(tag, props, kids)                 tiny DOM builder
 *   KK.img(name)                           <img> of a Fluent Emoji 3D picture (assets/kids/fx/<name>.webp)
 *   KK.profile(key, {album})               progression saved in localStorage[key]: stars per level, star total, unlocks,
 *                                          equipped items, days played this week, a daily goal (all try/catch guarded)
 *   KK.ui.title / map / album / result / help / toast / banner       the shared screens
 *   KK.audio.unlock()  KK.sfx(name, n)  KK.note(freq, dur, type, vol)   synthesised sound, starts after the first tap
 *   KK.fx.burst(x, y, kind, n)             particles on ONE canvas, hard cap, no loop while idle
 *   KK.float(x, y, text, colour)           floating "+1" numbers (pooled)
 *   KK.shake(el, px)  KK.haptic(ms)  KK.say(text)  KK.rm (reduced motion)
 */
(function () {
  'use strict';
  if (window.KK) return;
  var W = window, D = document, SDK = W.ArcadeSDK || null;
  var RM = false; try { RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  var inFrame = false; try { inFrame = W.parent && W.parent !== W; } catch (e) { inFrame = true; }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  var shuffle = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  var BASE = (function () { try { var s = D.currentScript && D.currentScript.src; if (s) return s.replace(/kit\/kidskit\.js.*$/, ''); } catch (e) {} return ''; })();

  function h(tag, props, kids) {
    var e = D.createElement(tag);
    if (props) for (var k in props) {
      var v = props[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') for (var s in v) e.style.setProperty(s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }), v[s]);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? D.createTextNode(c) : c); });
    return e;
  }
  var imgUrl = function (n) { return BASE + 'assets/kids/fx/' + n + '.webp'; };
  function img(n, cls, alt) { var e = h('img', { src: imgUrl(n), alt: alt || '', draggable: 'false', decoding: 'async' }); if (cls) e.className = cls; return e; }
  // a tap on a button: 'click' works for a finger, a mouse and Enter; games use pointerdown themselves for fast targets
  function press(el, fn) { el.addEventListener('click', function (e) { e.preventDefault(); unlock(); try { fn(e); } catch (x) { if (W.console) console.error(x); } }); return el; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------------- audio: synthesised, created on the first tap ---------------- */
  var A = { ctx: null, voices: 0, ok: true };
  function unlock() {
    if (!A.ok) return null;
    try {
      if (!A.ctx) {
        var C = W.AudioContext || W.webkitAudioContext; if (!C) { A.ok = false; return null; }
        A.ctx = new C();
        var b = A.ctx.createBuffer(1, 1, 22050), s = A.ctx.createBufferSource(); s.buffer = b; s.connect(A.ctx.destination); s.start(0);   // iOS unlock
      }
      if (A.ctx.state === 'suspended') A.ctx.resume();
    } catch (e) { A.ok = false; }
    return A.ctx;
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (n) { try { W.addEventListener(n, unlock, { passive: true, capture: true }); } catch (e) {} });
  function muted() { try { return !!(SDK && SDK.muted); } catch (e) { return false; } }
  function voice(fn) {   // at most 10 sounds at once: an iPhone drops the audio thread when flooded
    var c = A.ctx; if (!c || c.state !== 'running' || A.voices > 10) return;
    A.voices++; var t = c.currentTime;
    try { fn(c, t); } catch (e) {}
    W.setTimeout(function () { A.voices = Math.max(0, A.voices - 1); }, 700);
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    voice(function (c, t0) {
      var t = t0 + (when || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
    });
  }
  function noise(dur, vol, hp) {
    voice(function (c, t) {
      var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1200; g.gain.value = vol || 0.12;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
    });
  }
  var PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
  var SFX = {
    tap: function () { tone(620, 0.07, 'sine', 0.14); },
    pop: function () { tone(500, 0.09, 'sine', 0.2, 0, 1100); noise(0.06, 0.08, 2500); },
    bloop: function () { tone(300, 0.14, 'sine', 0.22, 0, 640); },
    good: function () { tone(659, 0.1, 'triangle', 0.2); tone(880, 0.18, 'triangle', 0.2, 0.09); },
    oops: function () { tone(330, 0.22, 'triangle', 0.16, 0, 200); },   // soft and short, never a buzzer
    boing: function () { tone(260, 0.24, 'sine', 0.24, 0, 620); tone(520, 0.16, 'sine', 0.1, 0.08, 300); },
    whack: function () { tone(180, 0.1, 'square', 0.12, 0, 90); noise(0.09, 0.16, 800); },
    star: function () { [0, 1, 2, 3].forEach(function (i) { tone(PENTA[3 + i], 0.22, 'sine', 0.14, i * 0.07); }); },
    win: function () { [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach(function (f, i) { tone(f, i > 3 ? 0.36 : 0.16, 'triangle', 0.2, i * 0.1); }); },
    level: function () { [392, 523.25, 659.25, 784, 1046.5].forEach(function (f, i) { tone(f, 0.18, 'sine', 0.18, i * 0.075); }); },
    whoosh: function () { noise(0.22, 0.09, 700); },
    flip: function () { tone(420, 0.06, 'sine', 0.12, 0, 640); },
    match: function () { tone(784, 0.11, 'triangle', 0.2); tone(1046.5, 0.22, 'triangle', 0.2, 0.09); },
    tick: function () { tone(1000, 0.03, 'square', 0.05); },
    coin: function () { tone(988, 0.07, 'square', 0.1); tone(1319, 0.28, 'square', 0.1, 0.07); }
  };
  SFX.ding = function (n) { var f = PENTA[clamp(n | 0, 0, PENTA.length - 1)]; tone(f, 0.5, 'sine', 0.2); tone(f * 2, 0.3, 'sine', 0.05); };
  function sfx(name, n) { if (muted() || !A.ctx) return; var f = SFX[name]; if (f) try { f(n); } catch (e) {} }
  function note(freq, dur, type, vol) { if (muted() || !A.ctx) return; tone(freq, dur || 0.3, type || 'sine', vol || 0.22); }

  /* ---------------- voice: browser speech, only on a tap, guarded (iOS is fussy) ---------------- */
  var voiceOn = true; try { voiceOn = W.localStorage.getItem('kk_voice') !== '0'; } catch (e) {}
  function say(text, rate) {
    if (!voiceOn || muted()) return;
    try {
      var S = W.speechSynthesis; if (!S || !W.SpeechSynthesisUtterance) return;
      S.cancel();
      var u = new W.SpeechSynthesisUtterance(String(text)); u.rate = rate || 0.85; u.pitch = 1.15; u.volume = 1; u.lang = 'en-US';
      var vs = S.getVoices ? S.getVoices() : [], v = null;
      for (var i = 0; i < vs.length; i++) if (/^en[-_]/i.test(vs[i].lang) && /samantha|karen|daniel|female|google us|moira|tessa/i.test(vs[i].name)) { v = vs[i]; break; }
      if (v) u.voice = v;
      S.speak(u);
    } catch (e) {}
  }
  function setVoice(on) { voiceOn = !!on; try { W.localStorage.setItem('kk_voice', on ? '1' : '0'); } catch (e) {} if (!on) try { W.speechSynthesis.cancel(); } catch (e) {} }

  function haptic(ms) { try { if (!RM && W.navigator.vibrate) W.navigator.vibrate(ms || 12); } catch (e) {} }
  function shake(el, px) {
    if (RM || !el) return;
    el.style.setProperty('--a', (px || 6) + 'px'); el.classList.remove('kk-shake'); void el.offsetWidth; el.classList.add('kk-shake');
    W.setTimeout(function () { el.classList.remove('kk-shake'); }, 360);
  }

  /* ---------------- particles: one canvas, capped, no loop while nothing is alive ---------------- */
  var fx = { cv: null, cx: null, list: [], run: 0, last: 0, w: 0, h: 0, dpr: 1 };
  var COLS = ['#ff6b6b', '#ffd23f', '#5bdc63', '#4cbcff', '#a97bff', '#ff7bb0', '#ffa040'];
  function fxInit() {
    if (fx.cv) return true;
    try {
      fx.cv = h('canvas', { id: 'kk-fx', 'aria-hidden': 'true' }); D.body.appendChild(fx.cv); fx.cx = fx.cv.getContext('2d'); fxSize();
      W.addEventListener('resize', function () { W.clearTimeout(fxInit.t); fxInit.t = W.setTimeout(fxSize, 150); });
      return !!fx.cx;
    } catch (e) { return false; }
  }
  function fxSize() {
    fx.dpr = Math.min(W.devicePixelRatio || 1, 2); fx.w = W.innerWidth; fx.h = W.innerHeight;
    fx.cv.width = Math.round(fx.w * fx.dpr); fx.cv.height = Math.round(fx.h * fx.dpr);
  }
  function burst(x, y, kind, n) {
    if (RM || !fxInit()) return;
    n = n || 14; var L = fx.list;
    for (var i = 0; i < n && L.length < 260; i++) {
      var a = rand(0, 6.283), sp, p = { x: x, y: y, r: rand(3, 7), c: pick(COLS), life: 0, ttl: rand(0.6, 1.1), rot: rand(0, 6.28), vr: rand(-8, 8), k: kind || 'spark', g: 600 };
      if (kind === 'confetti') { sp = rand(200, 620); a = rand(-2.5, -0.6); p.w = rand(6, 12); p.hh = rand(10, 18); p.ttl = rand(1.3, 2.2); p.g = 520; }
      else if (kind === 'star') { sp = rand(160, 420); p.r = rand(9, 16); p.ttl = rand(0.7, 1.2); p.g = 380; p.c = pick(['#ffd23f', '#fff1a8', '#ffb400']); }
      else if (kind === 'drop') { sp = rand(120, 360); p.r = rand(3, 6); p.c = pick(['#bfeaff', '#ffffff', '#8fd8ff']); p.g = 900; }
      else if (kind === 'dust') { sp = rand(60, 220); p.r = rand(6, 12); p.c = pick(['#c9a37a', '#b78c5f', '#deb887']); p.g = 120; p.ttl = rand(0.4, 0.8); }
      else if (kind === 'ring') { sp = 0; p.r = 10; p.ttl = 0.45; n = 1; p.c = '#ffffff'; }
      else { sp = rand(140, 400); }
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; L.push(p);
    }
    if (!fx.run) { fx.run = 1; fx.last = 0; W.requestAnimationFrame(fxLoop); }
  }
  function star5(c, x, y, r, rot) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r, a = rot + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  function fxLoop(ts) {
    var c = fx.cx, L = fx.list; if (!c) { fx.run = 0; return; }
    var dt = fx.last ? Math.min((ts - fx.last) / 1000, 0.05) : 0.016; fx.last = ts;
    c.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0); c.clearRect(0, 0, fx.w, fx.h);
    for (var i = L.length - 1; i >= 0; i--) {
      var p = L[i]; p.life += dt;
      if (p.life >= p.ttl || p.y > fx.h + 40) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vx *= (1 - Math.min(1, dt * 1.6));
      var f = 1 - p.life / p.ttl; c.globalAlpha = Math.min(1, f * 1.6); c.fillStyle = p.c;
      if (p.k === 'confetti') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.w / 2, -p.hh / 2 * Math.abs(Math.cos(p.rot * 1.3)), p.w, p.hh * Math.abs(Math.cos(p.rot * 1.3)) + 1); c.restore(); }
      else if (p.k === 'star') star5(c, p.x, p.y, p.r * (0.5 + f * 0.7), p.rot);
      else if (p.k === 'ring') { c.strokeStyle = '#fff'; c.lineWidth = 5 * f; c.beginPath(); c.arc(p.x, p.y, 10 + (1 - f) * 70, 0, 6.283); c.stroke(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.r * (p.k === 'dust' ? (1.3 - f * 0.5) : (0.4 + f * 0.6)), 0, 6.283); c.fill(); }
    }
    c.globalAlpha = 1;
    if (L.length) W.requestAnimationFrame(fxLoop); else { c.clearRect(0, 0, fx.w, fx.h); fx.run = 0; }
  }
  var floatPool = 0;
  function floatText(x, y, text, col) {
    if (floatPool > 10) return; floatPool++;
    var e = h('div', { class: 'kk-float', text: String(text), style: { left: x + 'px', top: y + 'px', '--fc': col || '#e0651a' } });
    D.body.appendChild(e);
    W.setTimeout(function () { floatPool--; if (e.parentNode) e.parentNode.removeChild(e); }, 1050);
  }
  function toast(text, pic) {
    var old = D.querySelector('.kk-toast'); if (old) old.remove();
    var e = h('div', { class: 'kk-toast', role: 'status' }, [pic ? img(pic) : null, h('span', { text: text })]); D.body.appendChild(e);
    W.setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 2500);
  }
  function banner(text) {
    var e = h('div', { class: 'kk-banner-big', text: text }); D.body.appendChild(e);
    W.setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1350);
  }

  /* ---------------- progression saved on the device ---------------- */
  function profile(key, opt) {
    opt = opt || {};
    var d = { v: 1, lv: {}, own: {}, eq: {}, days: [], daily: { d: '', n: 0, paid: 0 }, bonus: 0, seen: {}, st: {}, hi: 0 };
    try { var raw = W.localStorage.getItem(key); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') for (var k in o) d[k] = o[k]; } } catch (e) {}
    var album = opt.album || [];
    var P = {
      d: d, album: album,
      save: function () { try { W.localStorage.setItem(key, JSON.stringify(d)); } catch (e) {} },
      stars: function (n) { return d.lv[n] ? d.lv[n].s || 0 : 0; },
      total: function () { var t = d.bonus || 0; for (var k in d.lv) t += d.lv[k].s || 0; return t; },
      cleared: function () { var m = 0; for (var k in d.lv) if ((d.lv[k].s || 0) > 0) m = Math.max(m, +k); return m; },
      playable: function (n) { return n <= P.cleared() + 1; },
      next: function (max) { return Math.min(max || 999, P.cleared() + 1); },
      unlocked: function (it, tot) { return (tot == null ? P.total() : tot) >= (it.need || 0); },
      unlockedIds: function (tot) { return album.filter(function (it) { return P.unlocked(it, tot); }).map(function (it) { return it.id; }); },
      finish: function (n, stars, score) {
        var before = P.total(), prev = d.lv[n] || { s: 0, b: 0 }, first = !(prev.s > 0);
        var rec = { s: Math.max(prev.s || 0, stars), b: Math.max(prev.b || 0, score || 0) };
        d.lv[n] = rec; if (score > (d.hi || 0)) d.hi = score;
        var after = P.total(), oldIds = P.unlockedIds(before), newly = album.filter(function (it) { return P.unlocked(it, after) && oldIds.indexOf(it.id) < 0; });
        P.save();
        return { gained: after - before, first: first, newBest: (score || 0) > (prev.b || 0), unlocked: newly, total: after };
      },
      eqp: function (slot, dflt) { return d.eq[slot] || dflt; },
      equip: function (slot, id) { d.eq[slot] = id; P.save(); },
      flag: function (k, v) { if (v === undefined) return !!d.seen[k]; d.seen[k] = v ? 1 : 0; P.save(); return !!v; },
      stat: function (k, add) { if (add === undefined) return d.st[k] || 0; d.st[k] = (d.st[k] || 0) + add; P.save(); return d.st[k]; },
      // days played, kept for the last 60 days; the week row resets on Monday and only ever adds
      touchDay: function () { var t = today(); if (d.days.indexOf(t) < 0) { d.days.push(t); if (d.days.length > 60) d.days.shift(); P.save(); } },
      week: function () {
        var now = new Date(), dow = (now.getDay() + 6) % 7, st = [], n = 0;
        for (var i = 0; i < 7; i++) { var x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + i), s = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); var on = d.days.indexOf(s) >= 0; st.push(on); if (on) n++; }
        return { stamps: st, count: n, today: dow, lifetime: d.days.length };
      },
      // the daily goal: win N levels today; finishing it pays a small star bonus once
      dailyGoal: function () { return opt.dailyGoal || 3; },
      daily: function () { var t = today(); if (d.daily.d !== t) d.daily = { d: t, n: 0, paid: 0 }; return d.daily; },
      dailyWin: function () {
        var dl = P.daily(), before = dl.n; dl.n++; var just = false;
        if (dl.n >= P.dailyGoal() && !dl.paid) { dl.paid = 1; d.bonus = (d.bonus || 0) + (opt.dailyBonus || 3); just = true; }
        P.save(); return { n: dl.n, goal: P.dailyGoal(), just: just, before: before };
      }
    };
    return P;
  }

  /* ---------------- shared screens ---------------- */
  function starsRow(n, max, big, animate) {
    var r = h('div', { class: 'kk-stars' + (big ? ' kk-lgst' : '') }); max = max || 3;
    for (var i = 0; i < max; i++) { var s = img('star', i < n ? (animate ? 'kk-pl' : '') : 'kk-off'); if (animate && i < n) s.style.animationDelay = (0.25 + i * 0.22) + 's'; r.appendChild(s); }
    return r;
  }
  function overlay(panel, opts) {
    opts = opts || {};
    var sc = h('div', { class: 'kk-scrim', role: 'dialog', 'aria-modal': 'true' }, [panel]);
    D.body.appendChild(sc);
    if (opts.dismiss) sc.addEventListener('click', function (e) { if (e.target === sc) close(); });
    function close() { if (sc.parentNode) sc.parentNode.removeChild(sc); if (opts.onClose) opts.onClose(); }
    sc.close = close; return sc;
  }
  function weekRow(P) {
    var w = P.week(), names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], row = h('div', { class: 'kk-week', 'aria-label': w.count + ' days played this week' });
    row.appendChild(h('div', { class: 'kk-fl' }, [img('fire'), h('span', { text: String(w.count) })]));
    for (var i = 0; i < 7; i++) row.appendChild(h('div', { class: 'kk-d' + (w.stamps[i] ? ' on' : '') + (i === w.today ? ' today' : ''), text: w.stamps[i] ? '' : names[i] }, w.stamps[i] ? [img('star')] : []));
    row.querySelectorAll('.kk-d.on img').forEach(function (e) { e.style.cssText = 'width:22px;height:22px'; });
    return row;
  }
  function dailyChip(P) {
    var dl = P.daily(), goal = P.dailyGoal(), done = dl.n >= goal;
    return h('div', { class: 'kk-daily' + (done ? ' done' : '') }, [img(done ? 'check-mark-button' : 'sparkles'), h('span', { text: done ? 'Daily goal done!' : 'Today: win ' + goal + ' levels  ' + Math.min(dl.n, goal) + '/' + goal })]);
  }
  // opts: {title, tagline, hero:[names], onPlay, playLabel, onMap, onAlbum, onHelp, profile, extra, dot}
  function title(root, o) {
    var P = o.profile;
    var hero = o.heroEl || h('div', { class: 'kk-hero' });
    if (!o.heroEl) (o.hero || []).forEach(function (n, i, a) {
      var im = img(n), off = (i - (a.length - 1) / 2), r = (off * 9);
      im.style.marginLeft = (-59 + off * 92) + 'px'; im.style.marginTop = (-59 + Math.abs(off) * 20) + 'px'; im.style.setProperty('--r', r + 'deg');
      im.style.animationDelay = (i * 0.35) + 's'; if (i === Math.floor(a.length / 2)) { im.style.width = im.style.height = '148px'; im.style.marginLeft = '-74px'; im.style.marginTop = '-80px'; }
      hero.appendChild(im);
    });
    var play = h('button', { class: 'kk-btn kk-go kk-big', id: 'playBtn', type: 'button' }, [h('span', { text: '▶' }), h('span', { text: o.playLabel || 'Play' })]);
    press(play, o.onPlay);
    var menu = h('div', { class: 'kk-menu' });
    function ic(cls, pic, label, fn, badge) { var b = h('button', { class: 'kk-icon kk-lg ' + cls, type: 'button', 'aria-label': label }, [img(pic), h('span', { class: 'kk-cap', text: label }), badge ? h('span', { class: 'kk-dot', text: badge }) : null]); press(b, fn); return b; }
    if (o.onMap) menu.appendChild(ic('kk-blue', 'world-map', 'Levels', o.onMap, ''));
    if (o.onAlbum) menu.appendChild(ic('kk-pink', o.albumPic || 'sparkles', o.albumLabel || 'Stickers', o.onAlbum, o.dot));
    (o.extraIcons || []).forEach(function (x) { menu.appendChild(ic(x.cls || 'kk-blue', x.pic, x.label, x.fn, x.badge)); });
    if (o.onHelp) menu.appendChild(ic('kk-purple', 'thinking-face', 'Help', o.onHelp, ''));
    var leafA = img('herb'), leafB = img('herb'); leafA.style.cssText = 'position:absolute;width:52px;height:52px;left:-16px;bottom:-14px;transform:rotate(-24deg)'; leafB.style.cssText = 'position:absolute;width:52px;height:52px;right:-16px;bottom:-14px;transform:scaleX(-1) rotate(-24deg)';
    var sign = h('div', { class: 'kk-sign' }, [h('h1', { class: 'kk-logo', text: o.title }), leafA, leafB]);
    var el = h('div', { class: 'kk-title', id: 'kkTitle' }, [sign, o.tagline ? h('p', { class: 'kk-tag', text: o.tagline }) : null, hero, play, menu, P ? weekRow(P) : null, P ? dailyChip(P) : null, o.extra || null]);
    root.appendChild(el); return el;
  }
  // levels: [{n, name?, boss?, banner?}] ; banner text is drawn above the node that has it
  function map(root, o) {
    var P = o.profile, levels = o.levels, GAP = 118, top = 70, xs = [0.5, 0.74, 0.5, 0.26];
    var el = h('div', { class: 'kk-map', id: 'kkMap' });
    var head = h('div', { class: 'kk-map-head' });
    head.appendChild(press(h('button', { class: 'kk-icon kk-back', type: 'button', 'aria-label': 'Back', text: '←' }), function () { close(); }));
    head.appendChild(h('h2', { text: o.title || 'Pick a level' }));
    head.appendChild(h('div', { class: 'kk-chip' }, [img('star'), h('b', { text: String(P.total()) })]));
    var sc = h('div', { class: 'kk-map-scroll' }), inner = h('div', { class: 'kk-map-inner' });
    var H = top + levels.length * GAP + 40; inner.style.height = H + 'px';
    var pts = levels.map(function (l, i) { return { x: xs[i % 4], y: top + i * GAP }; });
    var svgNS = 'http://www.w3.org/2000/svg', svg = D.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 100 ' + H); svg.setAttribute('preserveAspectRatio', 'none');
    var pathD = pts.map(function (p, i) { return (i ? 'L' : 'M') + (p.x * 100).toFixed(1) + ' ' + p.y; }).join(' ');
    var path = D.createElementNS(svgNS, 'path'); path.setAttribute('d', pathD); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'rgba(255,255,255,.85)'); path.setAttribute('stroke-width', '14'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('vector-effect', 'non-scaling-stroke'); path.setAttribute('stroke-dasharray', '2 22');
    svg.appendChild(path); inner.appendChild(svg);
    var cur = P.next(levels.length), curEl = null;
    levels.forEach(function (l, i) {
      var p = pts[i], ok = P.playable(l.n), s = P.stars(l.n);
      if (l.banner) inner.appendChild(h('div', { class: 'kk-banner', style: { top: (p.y - 84) + 'px' } }, [h('span', { text: l.banner })]));
      var b = h('button', { class: 'kk-node' + (ok ? '' : ' lock') + (l.n === cur ? ' cur' : '') + (l.boss ? ' boss' : ''), type: 'button', 'aria-label': 'Level ' + l.n + (ok ? '' : ', locked'), style: { left: (p.x * 100) + '%', top: p.y + 'px' } });
      if (ok) { b.appendChild(h('span', { text: String(l.n) })); var ns = h('div', { class: 'kk-ns' }); for (var k = 0; k < 3; k++) ns.appendChild(img('star', k < s ? '' : 'kk-off')); b.appendChild(ns); }
      else b.appendChild(img('locked'));
      if (l.n === cur) curEl = b;
      press(b, function () { if (!ok) { sfx('oops'); shake(b, 5); return; } close(); o.onPick(l.n); });
      inner.appendChild(b);
    });
    sc.appendChild(inner); el.appendChild(head); el.appendChild(sc); root.appendChild(el);
    if (curEl) W.setTimeout(function () { try { sc.scrollTop = Math.max(0, curEl.offsetTop - sc.clientHeight * 0.55); } catch (e) {} }, 30);
    function close() { if (el.parentNode) el.parentNode.removeChild(el); if (o.onClose) o.onClose(); }
    el.close = close; return el;
  }
  // items: [{id, img, name, need, slot?}] ; sections: [{title, slot?, items}] ; equipping calls o.onEquip(slot,id)
  function album(root, o) {
    var P = o.profile, tot = P.total(), el = h('div', { class: 'kk-album', id: 'kkAlbum' });
    var head = h('div', { class: 'kk-map-head' });
    head.appendChild(press(h('button', { class: 'kk-icon kk-back', type: 'button', 'aria-label': 'Back', text: '←' }), function () { close(); }));
    head.appendChild(h('h2', { text: o.title || 'Stickers' }));
    head.appendChild(h('div', { class: 'kk-chip' }, [img('star'), h('b', { text: String(tot) })]));
    var body = h('div', { class: 'kk-album-body' });
    (o.sections || []).forEach(function (sec) {
      var isOpen = sec.isOpen || function (it) { return P.unlocked(it, tot); };
      var have = sec.items.filter(isOpen).length, nextIt = sec.isOpen ? null : sec.items.filter(function (it) { return !isOpen(it); }).sort(function (a, b) { return a.need - b.need; })[0];
      var bar = h('div', { class: 'kk-bar' }, [h('i', { style: { width: Math.round(have / sec.items.length * 100) + '%' } })]);
      body.appendChild(h('div', { class: 'kk-sechd' }, [h('span', { text: sec.title }), bar, h('span', { text: have + '/' + sec.items.length })]));
      if (nextIt) body.appendChild(h('p', { style: { maxWidth: '420px', margin: '0 auto 8px', fontSize: '16px', color: 'var(--kk-gold1)', fontWeight: '600' }, text: 'Next: ' + (nextIt.need - tot) + ' more stars' }));
      var g = h('div', { class: 'kk-grid' });
      sec.items.forEach(function (it) {
        var un = isOpen(it), eq = sec.slot && P.eqp(sec.slot, sec.def) === it.id;
        var b = h('button', { class: 'kk-slot' + (un ? '' : ' lock') + (eq ? ' sel' : ''), type: 'button', 'aria-label': (un ? it.name : 'Locked') }, [img(it.img), un ? (sec.caption ? h('small', { text: it.name, style: { color: 'var(--kk-ink2)', textShadow: 'none' } }) : null) : h('small', { text: sec.isOpen ? '?' : it.need + ' \u2605' }), eq ? h('span', { class: 'kk-tick', text: '\u2713' }) : null]);
        press(b, function () {
          if (!un) { sfx('oops'); shake(b, 5); toast(sec.isOpen ? (sec.lockHint || 'Not found yet') : (it.need - tot) + ' more stars to unlock', 'star'); return; }
          sfx('good'); if (sec.slot) { P.equip(sec.slot, it.id); if (o.onEquip) o.onEquip(sec.slot, it.id); el.remove(); album(root, o); } else { toast(it.name, it.img); say(it.name); }
        });
        g.appendChild(b);
      });
      body.appendChild(g);
    });
    el.appendChild(head); el.appendChild(body); root.appendChild(el);
    function close() { if (el.parentNode) el.parentNode.removeChild(el); if (o.onClose) o.onClose(); }
    el.close = close; return el;
  }
  // o: {title, stars, max, lines:[text], newItems:[items], buttons:[{label, cls, fn}], sub}
  function result(o) {
    var panel = h('div', { class: 'kk-panel', id: 'kkResult' });
    if (o.ribbon) panel.appendChild(h('div', { class: 'kk-ribbon', text: o.ribbon }));
    panel.appendChild(h('h2', { text: o.title, style: { marginTop: o.ribbon ? '10px' : '0' } }));
    if (o.stars != null) panel.appendChild(starsRow(o.stars, o.max || 3, true, true));
    (o.lines || []).forEach(function (t) { panel.appendChild(h('p', { text: t })); });
    (o.newItems || []).forEach(function (it) { panel.appendChild(h('div', { class: 'kk-new' }, [img(it.img), h('span', { text: 'New: ' + it.name + '!' })])); });
    var row = h('div', { class: 'kk-col', style: { marginTop: '14px' } });
    (o.buttons || []).forEach(function (b) { var bt = h('button', { class: 'kk-btn ' + (b.cls || 'kk-go') + (b.big ? ' kk-big' : ''), type: 'button' }, [b.pic ? img(b.pic) : null, h('span', { text: b.label })]); press(bt, function () { sc.close(); b.fn && b.fn(); }); row.appendChild(bt); });
    panel.appendChild(row);
    var sc = overlay(panel); return sc;
  }
  // steps: [{pic, text}]
  function help(o) {
    var panel = h('div', { class: 'kk-panel' }, [h('h2', { text: o.title || 'How to play' })]);
    var st = h('div', { class: 'kk-steps' });
    (o.steps || []).forEach(function (s, i) { st.appendChild(h('div', { class: 'kk-step' }, [h('span', { class: 'kk-n', text: String(i + 1) }), img(s.pic), h('span', { text: s.text })])); });
    panel.appendChild(st);
    var b = h('button', { class: 'kk-btn kk-go', type: 'button' }, [h('span', { text: o.button || 'Got it!' })]); press(b, function () { sc.close(); });
    panel.appendChild(b);
    var sc = overlay(panel, { onClose: o.onClose, dismiss: true }); return sc;
  }
  // a speech bubble that teaches by doing: coach(text, {skip: fn, y: '18%'}) -> element with .close()
  function coach(text, o) {
    o = o || {}; var old = D.querySelector('.kk-coach'); if (old) old.remove();
    var e = h('div', { class: 'kk-coach', role: 'status', style: { top: o.top || 'calc(var(--kk-top) + 64px)' } }, [img(o.pic || 'pointer-down'), h('span', { class: 'kk-ct', text: text })]);
    if (o.skip) { var sk = h('button', { class: 'kk-skip', type: 'button', text: o.skipLabel || 'Skip' }); press(sk, function () { e.close(); o.skip(); }); e.appendChild(sk); }
    e.close = function () { if (e.parentNode) e.parentNode.removeChild(e); };
    D.body.appendChild(e); return e;
  }
  function confetti() { var w = W.innerWidth; for (var i = 0; i < 3; i++) burst(w * (0.2 + i * 0.3), W.innerHeight * 0.75, 'confetti', 22); }

  /* an ArcadeSDK-aware sound button: one place to mute */
  function muteButton() {
    var b = h('button', { class: 'kk-icon kk-blue', type: 'button', 'aria-label': 'Sound', style: { width: '48px', height: '48px' } });
    function paint() { b.textContent = ''; b.appendChild(img(muted() ? 'muted-speaker' : 'speaker-high-volume')); b.firstChild.style.cssText = 'width:30px;height:30px'; b.setAttribute('aria-pressed', String(!muted())); }
    press(b, function () { try { if (SDK && SDK.setMuted) SDK.setMuted(!SDK.muted); } catch (e) {} paint(); if (!muted()) sfx('tap'); });
    paint(); return b;
  }
  function topbar(o) {
    o = o || {}; var bar = h('div', { class: 'kk-top kk-sp' });
    if (o.back && !inFrame) bar.appendChild(press(h('a', { class: 'kk-icon kk-blue', href: '../index.html', 'aria-label': 'Back to the game hub', style: { width: '48px', height: '48px', textDecoration: 'none' }, text: '←' }), function () { W.location.href = '../index.html'; }));
    (o.left || []).forEach(function (n) { bar.appendChild(n); });
    bar.appendChild(h('div', { class: 'kk-grow' }));
    (o.right || []).forEach(function (n) { bar.appendChild(n); });
    if (o.mute !== false) bar.appendChild(muteButton());
    D.body.appendChild(bar); return bar;
  }
  function chip(pic, value, id) { var b = h('b', { text: String(value), id: id || null }); return { el: h('div', { class: 'kk-chip' }, [img(pic), b]), set: function (v) { if (String(v) !== b.textContent) { b.textContent = String(v); var c = b.parentNode; c.classList.remove('kk-pop'); void c.offsetWidth; c.classList.add('kk-pop'); } } }; }
  function preload(names) { names.forEach(function (n) { var i = new Image(); i.src = imgUrl(n); }); }
  function sprite(name) {   // an Image for canvas drawing, ready() when decoded
    var i = new Image(); i.decoding = 'async'; var o = { img: i, ok: false }; i.onload = function () { o.ok = true; }; i.src = imgUrl(name); return o;
  }

  W.KK = { h: h, img: img, imgUrl: imgUrl, press: press, RM: RM, inFrame: inFrame, clamp: clamp, rand: rand, pick: pick, shuffle: shuffle, today: today,
    profile: profile, audio: { unlock: unlock, ctx: function () { return A.ctx; } }, sfx: sfx, note: note, say: say, setVoice: setVoice, voiceOn: function () { return voiceOn; }, muted: muted,
    fx: { burst: burst }, float: floatText, shake: shake, haptic: haptic, confetti: confetti,
    ui: { coach: coach, title: title, map: map, album: album, result: result, help: help, toast: toast, banner: banner, stars: starsRow, overlay: overlay, topbar: topbar, chip: chip, week: weekRow, daily: dailyChip, mute: muteButton },
    banner: banner, toast: toast, preload: preload, sprite: sprite };
})();
