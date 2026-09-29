/* IdleKit core (ik-core.js): the small, dependency-free parts that the idle and farm games in this folder share.
 *
 *   IK.fmt(n)                big numbers: 12.5K, 3.4M ... Dc, then 1.2e39
 *   IK.sfx(name, {rate, volume})   sounds from the arcade's shared kit through ArcadeSDK.sfx (silent, never an error, without it)
 *   IK.fx                    particles on one overlay canvas, pooled floating numbers, coin fly-to-wallet, shake, pop, flash
 *   IK.toast / IK.sheet      queued toasts and a bottom sheet (welcome back, level up, prestige ...)
 *   IK.pix                   pixel-art helpers: load an atlas, slice 16 px tiles, draw crisp at any integer scale, crisp text
 *   IK.Level / IK.Daily      XP curve; a daily-goal set that is the same for everyone on a given date, plus a week of stamps
 *
 * Nothing here reads the clock on its own except IK.now (the real clock, which keeps running while the arcade pause menu is open).
 * Pool sizes are capped so a long session cannot grow the DOM or the particle list.
 */
(function (W) {
  'use strict';
  var D = W.document, IK = W.IK = W.IK || {};
  var RM = false; try { RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  IK.RM = RM;

  /* ---------- tiny helpers ---------- */
  IK.$ = function (id) { return D.getElementById(id); };
  IK.h = function (tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  IK.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  IK.lerp = function (a, b, t) { return a + (b - a) * t; };
  IK.now = function () { return new Date().getTime(); };          // real clock (Date.now() is frozen while the SDK pause menu is open)
  IK.p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  IK.today = function () { var d = new Date(); return d.getFullYear() + '-' + IK.p2(d.getMonth() + 1) + '-' + IK.p2(d.getDate()); };
  IK.dayNum = function () { var d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
  IK.hash = function (s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  IK.rng = function (a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  IK.num = function (v, d) { v = Number(v); return isFinite(v) ? v : d; };
  IK.ls = {
    get: function (k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { W.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: function (k) { try { W.localStorage.removeItem(k); } catch (e) {} }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  IK.esc = esc;

  /* ---------- big numbers ---------- */
  var UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  function trim(s) { return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
  IK.fmt = function (n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + IK.fmt(-n);
    if (n < 1000) {
      if (n >= 100) return String(Math.floor(n));
      if (n >= 10) return trim(n.toFixed(1));
      if (n >= 0.995 || n === 0) return trim(n.toFixed(2));
      return trim(n.toFixed(2)) || '0';
    }
    var i = 0, v = n;
    while (v >= 999.5 && i < UNITS.length - 1) { v /= 1000; i++; }
    if (v >= 999.5) return trim(n.toExponential(2).replace('e+', 'e'));
    return trim(v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[i];
  };
  IK.fmtInt = function (n) { return Math.floor(n).toLocaleString ? Math.floor(n).toLocaleString('en-US') : String(Math.floor(n)); };
  IK.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + (sec % 60) + 's';
    return sec + 's';
  };

  /* ---------- sound: the arcade's shared kit through the SDK, with pitch steps ---------- */
  IK.muted = false;
  var warmed = {}, sfxLast = {};
  var ALIAS = { buy: 'button', ok: 'button', up: 'levelup', level: 'levelup', boom: 'explode', crit: 'combo', kill: 'hit', gold: 'reward', open: 'reward', dig: 'hit', chop: 'hit', plant: 'place', water: 'splash', harvest: 'collect', sell: 'coin' };
  IK.sfx = function (name, o) {
    if (IK.muted) return;
    o = o || {};
    var S = W.ArcadeSDK;
    if (!S || !S.sfx) return;
    var t = IK.now(), gap = o.gap == null ? 40 : o.gap;
    if (sfxLast[name] && t - sfxLast[name] < gap) return;       // never machine-gun the same sound
    sfxLast[name] = t;
    try { S.sfx(ALIAS[name] || name, { volume: o.volume == null ? 0.7 : o.volume, rate: o.rate || 1 }); } catch (e) {}
  };
  IK.warm = function (names) {                                    // after the first tap: fetch and decode, silently, so the first real play is not lost
    var S = W.ArcadeSDK; if (!S || !S.sfx) return;
    names.forEach(function (n) { n = ALIAS[n] || n; if (warmed[n]) return; warmed[n] = 1; try { S.sfx(n, { volume: 0 }); } catch (e) {} });
  };
  IK.vibrate = function (p) { try { if (!RM && W.navigator.vibrate) W.navigator.vibrate(p); } catch (e) {} };

  /* ---------- fx: one overlay canvas of pooled particles, plus pooled DOM floaters ---------- */
  var fx = IK.fx = { cv: null, cx: null, P: [], free: [], MAX: 260, w: 0, h: 0, dpr: 1, running: false, last: 0 };
  fx.init = function (canvas) {
    fx.cv = canvas; fx.cx = canvas.getContext('2d');
    fx.resize();
    W.addEventListener('resize', fx.resize);
  };
  fx.resize = function () {
    if (!fx.cv) return;
    fx.dpr = Math.min(W.devicePixelRatio || 1, 2);
    fx.w = W.innerWidth; fx.h = W.innerHeight;
    fx.cv.width = Math.round(fx.w * fx.dpr); fx.cv.height = Math.round(fx.h * fx.dpr);
    fx.cv.style.width = fx.w + 'px'; fx.cv.style.height = fx.h + 'px';
    fx.cx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  };
  function getP() { if (fx.free.length) return fx.free.pop(); if (fx.P.length < fx.MAX) return {}; return null; }
  var COLS = ['#ffe27a', '#ffc83d', '#ff9f1c', '#fff4dc'];
  /* shapes: 'sq' pixel squares (default, matches the pixel art), 'star', 'coin', 'ring' */
  fx.burst = function (x, y, o) {
    if (RM || !fx.cx) return;
    o = o || {};
    var n = o.n || 10, cols = o.colors || COLS, sp = o.speed || 160, g = o.grav == null ? 320 : o.grav, life = o.life || 0.7, sz = o.size || 4;
    for (var k = 0; k < n; k++) {
      var p = getP(); if (!p) break;
      var a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread == null ? 1 : o.spread) : Math.random() * 6.2832;
      var v = sp * (0.35 + Math.random() * 0.65);
      p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - (o.lift == null ? sp * 0.3 : o.lift); p.g = g;
      p.life = life * (0.6 + Math.random() * 0.6); p.t = 0; p.s = sz * (0.7 + Math.random() * 0.8);
      p.c = cols[(Math.random() * cols.length) | 0]; p.shape = o.shape || 'sq'; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 8;
      p.tx = null; fx.P.push(p);
    }
    fx.start();
  };
  fx.confetti = function (n) {
    if (RM || !fx.cx) return;
    var cols = ['#ff5a5f', '#ffc83d', '#57d05b', '#4cc9f0', '#b085ff', '#fff4dc'];
    for (var k = 0; k < (n || 34); k++) {
      var p = getP(); if (!p) break;
      p.x = Math.random() * fx.w; p.y = -10 - Math.random() * 40; p.vx = (Math.random() - 0.5) * 120; p.vy = 80 + Math.random() * 160; p.g = 260;
      p.life = 1.3 + Math.random() * 0.9; p.t = 0; p.s = 4 + Math.random() * 4; p.c = cols[(Math.random() * cols.length) | 0]; p.shape = 'sq'; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12; p.tx = null;
      fx.P.push(p);
    }
    fx.start();
  };
  fx.ring = function (x, y, color, size) {
    if (RM || !fx.cx) return;
    var p = getP(); if (!p) return;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.g = 0; p.life = 0.45; p.t = 0; p.s = size || 44; p.c = color || '#ffe27a'; p.shape = 'ring'; p.rot = 0; p.vr = 0; p.tx = null;
    fx.P.push(p); fx.start();
  };
  /* coins that curve from (x,y) to an element (the wallet), so the number that goes up has a visible cause */
  fx.flyTo = function (x, y, el, o) {
    if (RM || !fx.cx || !el) return;
    o = o || {};
    var r = el.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    for (var k = 0; k < (o.n || 6); k++) {
      var p = getP(); if (!p) break;
      p.x = x + (Math.random() - 0.5) * 24; p.y = y + (Math.random() - 0.5) * 24;
      p.vx = (Math.random() - 0.5) * 220; p.vy = -60 - Math.random() * 160; p.g = 0;
      p.life = 0.75 + Math.random() * 0.25; p.t = -k * 0.045; p.s = o.size || 5; p.c = o.color || '#ffc83d'; p.shape = o.shape || 'coin'; p.rot = 0; p.vr = 0;
      p.tx = tx; p.ty = ty; p.arrive = o.onArrive || null; fx.P.push(p);
    }
    fx.start();
  };
  fx.start = function () {
    if (fx.running) return;
    fx.running = true; fx.last = 0;
    W.requestAnimationFrame(fx.tick);
  };
  fx.tick = function (ts) {
    var cx = fx.cx; if (!cx) { fx.running = false; return; }
    if (!fx.last) fx.last = ts;
    var dt = Math.min((ts - fx.last) / 1000, 0.05); fx.last = ts;
    cx.clearRect(0, 0, fx.w, fx.h);
    var P = fx.P;
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.t += dt;
      if (p.t < 0) continue;
      var f = p.t / p.life;
      if (f >= 1) { if (p.arrive) { try { p.arrive(); } catch (e) {} p.arrive = null; } P[i] = P[P.length - 1]; P.pop(); fx.free.push(p); continue; }
      if (p.tx != null) {                                         // fly-to: ease from the launch spread into the wallet
        var e = f * f * (3 - 2 * f);
        p.vx *= 0.94; p.vy *= 0.94;
        p.x += p.vx * dt * (1 - e) + (p.tx - p.x) * Math.min(1, e * 0.28 + dt * 6 * f);
        p.y += p.vy * dt * (1 - e) + (p.ty - p.y) * Math.min(1, e * 0.28 + dt * 6 * f);
      } else { p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
      var a = p.shape === 'ring' ? 1 - f : (f < 0.7 ? 1 : (1 - f) / 0.3);
      cx.globalAlpha = a < 0 ? 0 : a; cx.fillStyle = p.c; cx.strokeStyle = p.c;
      var s = p.s;
      if (p.shape === 'ring') { cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x, p.y, s * (0.3 + f * 1.2), 0, 6.2832); cx.stroke(); }
      else if (p.shape === 'coin') { cx.fillStyle = '#5a3210'; cx.fillRect(Math.round(p.x - s - 1), Math.round(p.y - s - 1), s * 2 + 2, s * 2 + 2); cx.fillStyle = p.c; cx.fillRect(Math.round(p.x - s), Math.round(p.y - s), s * 2, s * 2); cx.fillStyle = 'rgba(255,255,255,.7)'; cx.fillRect(Math.round(p.x - s), Math.round(p.y - s), s * 2, 2); }
      else if (p.shape === 'star') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath(); for (var j = 0; j < 8; j++) { var rr = j % 2 ? s * 0.45 : s * 1.3, an = j * Math.PI / 4; cx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } cx.closePath(); cx.fill(); cx.restore(); }
      else { var q = Math.max(2, Math.round(s * (1 - f * 0.4))); cx.fillRect(Math.round(p.x - q / 2), Math.round(p.y - q / 2), q, q); }
    }
    cx.globalAlpha = 1;
    if (P.length) W.requestAnimationFrame(fx.tick); else { cx.clearRect(0, 0, fx.w, fx.h); fx.running = false; }
  };
  /* floating numbers: a fixed pool of DOM nodes, re-used round-robin */
  var FP = [], FPi = 0;
  fx.float = function (x, y, text, cls) {
    var f;
    if (FP.length < 18) { f = IK.h('div', 'ik-float'); D.body.appendChild(f); FP.push(f); }
    else { f = FP[FPi]; FPi = (FPi + 1) % FP.length; }
    f.className = 'ik-float' + (cls ? ' ' + cls : '');
    f.textContent = text;
    var w = Math.min(W.innerWidth - 12, 200);
    f.style.left = Math.max(6, Math.min(W.innerWidth - 6 - 60, x - 30 + (Math.random() - 0.5) * 24)) + 'px';
    f.style.top = (y - 24) + 'px';
    f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
  };
  /* squash-and-stretch and shake use the Web Animations API (falls back to nothing) */
  fx.pop = function (el, amt) {
    if (RM || !el || !el.animate) return;
    amt = amt || 0.12;
    try { el.animate([{ transform: 'scale(1,1)' }, { transform: 'scale(' + (1 + amt) + ',' + (1 - amt * 0.8) + ')', offset: 0.25 }, { transform: 'scale(' + (1 - amt * 0.5) + ',' + (1 + amt) + ')', offset: 0.6 }, { transform: 'scale(1,1)' }], { duration: 260, easing: 'ease-out' }); } catch (e) {}
  };
  fx.shake = function (el, px, ms) {
    if (RM || !el || !el.animate) return;
    px = px || 6; ms = ms || 320;
    try { el.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(' + (-px) + 'px,' + (px * 0.4) + 'px)', offset: 0.15 }, { transform: 'translate(' + px + 'px,' + (-px * 0.4) + 'px)', offset: 0.35 }, { transform: 'translate(' + (-px * 0.6) + 'px,0)', offset: 0.55 }, { transform: 'translate(' + (px * 0.3) + 'px,0)', offset: 0.75 }, { transform: 'translate(0,0)' }], { duration: ms, easing: 'ease-out' }); } catch (e) {}
  };
  fx.flash = function (color, ms) {
    if (RM) return;
    var f = IK.h('div', 'ik-flash'); f.style.background = color || '#fff'; D.body.appendChild(f);
    try { f.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: ms || 260, easing: 'ease-out' }).onfinish = function () { if (f.parentNode) f.parentNode.removeChild(f); }; }
    catch (e) { if (f.parentNode) f.parentNode.removeChild(f); }
  };
  /* a value that rolls toward its target (the wallet); call step(dt) each frame */
  IK.Roll = function (fmt) { this.v = 0; this.t = 0; this.fmt = fmt || IK.fmt; this.txt = ''; };
  IK.Roll.prototype.set = function (t, snap) { this.t = t; if (snap) this.v = t; };
  IK.Roll.prototype.step = function (dt, el) {
    var d = this.t - this.v;
    if (Math.abs(d) < Math.max(0.5, Math.abs(this.t) * 1e-6)) this.v = this.t; else this.v += d * Math.min(1, dt * 9);
    var s = this.fmt(this.v);
    if (s !== this.txt && el) { this.txt = s; el.textContent = s; }
  };

  /* ---------- toast queue and bottom sheet ---------- */
  var toastBox = null, toasts = [];
  IK.toast = function (msg, o) {
    o = o || {};
    if (!toastBox) { toastBox = IK.h('div', 'ik-toasts'); toastBox.setAttribute('role', 'status'); toastBox.setAttribute('aria-live', 'polite'); D.body.appendChild(toastBox); }
    while (toasts.length >= 3) { var old = toasts.shift(); if (old.el.parentNode) old.el.parentNode.removeChild(old.el); }
    var el = IK.h('div', 'ik-toast' + (o.kind ? ' ' + o.kind : ''));
    el.innerHTML = (o.icon ? '<span class="ik-toast-ico">' + o.icon + '</span>' : '') + '<span>' + esc(msg) + '</span>';
    toastBox.appendChild(el);
    var rec = { el: el };
    toasts.push(rec);
    var ms = o.ms || 2600;
    W.setTimeout(function () {
      el.classList.add('out');
      W.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); var i = toasts.indexOf(rec); if (i >= 0) toasts.splice(i, 1); }, 280);
    }, ms);
  };
  var sheetEl = null, sheetClose = null;
  IK.sheet = function (o) {
    IK.closeSheet(true);
    var bg = IK.h('div', 'ik-sheet-bg'); bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true');
    var box = IK.h('div', 'ik-sheet' + (o.cls ? ' ' + o.cls : ''));
    var html = '';
    if (o.art) html += '<div class="ik-sheet-art">' + o.art + '</div>';
    if (o.title) html += '<h2>' + o.title + '</h2>';
    if (o.sub) html += '<p class="ik-sheet-sub">' + o.sub + '</p>';
    if (o.body) html += '<div class="ik-sheet-body">' + o.body + '</div>';
    box.innerHTML = html;
    var row = IK.h('div', 'ik-sheet-actions');
    (o.actions || [{ label: 'OK' }]).forEach(function (a, i) {
      var b = IK.h('button', 'ik-btn ' + (a.cls || (i === 0 ? 'go' : 'ghost')), a.label);
      b.type = 'button';
      if (a.id) b.id = a.id;
      b.addEventListener('click', function () { IK.sfx(a.sound || 'button'); var keep = a.onClick && a.onClick() === false; if (!keep) IK.closeSheet(); });
      row.appendChild(b);
    });
    box.appendChild(row);
    bg.appendChild(box);
    D.body.appendChild(bg);
    sheetEl = bg; sheetClose = o.onClose || null;
    W.requestAnimationFrame(function () { bg.classList.add('in'); var f = box.querySelector('button'); if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} } });
    return box;
  };
  IK.closeSheet = function (silent) {
    if (!sheetEl) return;
    var el = sheetEl, cb = sheetClose; sheetEl = null; sheetClose = null;
    if (el.parentNode) el.parentNode.removeChild(el);
    if (!silent && cb) { try { cb(); } catch (e) {} }
  };
  IK.sheetOpen = function () { return !!sheetEl; };

  /* ---------- pixel art helpers ---------- */
  var pix = IK.pix = { imgs: {} };
  pix.load = function (url) {                                     // returns {img, ok}; ok flips true on load
    if (pix.imgs[url]) return pix.imgs[url];
    var rec = { img: new W.Image(), ok: false, cbs: [] };
    rec.img.onload = function () { rec.ok = true; rec.cbs.forEach(function (f) { try { f(); } catch (e) {} }); rec.cbs = []; };
    rec.img.onerror = function () { rec.err = true; };
    rec.img.src = url;
    pix.imgs[url] = rec;
    return rec;
  };
  pix.whenReady = function (recs, fn) {
    var left = recs.filter(function (r) { return !r.ok && !r.err; }).length;
    if (!left) { fn(); return; }
    recs.forEach(function (r) { if (!r.ok && !r.err) r.cbs.push(function () { if (--left === 0) fn(); }); });
  };
  /* draw tile n of a 16 px atlas (cols across) at logical (x,y); the context should already be scaled by an integer */
  pix.tile = function (cx, rec, n, x, y, cols, flip, tw) {
    if (!rec || !rec.ok) return;
    tw = tw || 16; cols = cols || 12;
    var sx = (n % cols) * tw, sy = Math.floor(n / cols) * tw;
    if (flip) { cx.save(); cx.translate(Math.round(x) + tw, Math.round(y)); cx.scale(-1, 1); cx.drawImage(rec.img, sx, sy, tw, tw, 0, 0, tw, tw); cx.restore(); }
    else cx.drawImage(rec.img, sx, sy, tw, tw, Math.round(x), Math.round(y), tw, tw);
  };
  pix.spr = function (cx, rec, sx, sy, sw, sh, dx, dy, flip) {
    if (!rec || !rec.ok) return;
    if (flip) { cx.save(); cx.translate(Math.round(dx) + sw, Math.round(dy)); cx.scale(-1, 1); cx.drawImage(rec.img, sx, sy, sw, sh, 0, 0, sw, sh); cx.restore(); }
    else cx.drawImage(rec.img, sx, sy, sw, sh, Math.round(dx), Math.round(dy), sw, sh);
  };
  /* A pixel canvas: logical size LW x LH, drawn at an integer scale k so every art pixel is a whole number of device pixels.
   * The canvas is centred in its wrapper (letterboxed with the wrapper's background). draw(cx, dt, t) is called each frame. */
  pix.Canvas = function (canvas, LW, LH, draw) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.LW = LW; this.LH = LH; this.draw = draw; this.k = 1; this.dpr = 1; this.last = 0; this.t = 0; this.on = true; this.every = 1; this.fc = 0;
    this.cw = 0; this.ch = 0;
    var self = this;
    this.rs = function () { self.resize(); };
    W.addEventListener('resize', this.rs);
    if (W.ResizeObserver && canvas.parentNode) { try { new W.ResizeObserver(function () { self.resize(); }).observe(canvas.parentNode); } catch (e) {} }
    this.resize();
  };
  pix.Canvas.prototype.resize = function () {
    var p = this.cv.parentNode, cw = p.clientWidth, ch = p.clientHeight;
    if (!cw || !ch) return;
    if (cw === this.cw && ch === this.ch && this.dpr === Math.min(W.devicePixelRatio || 1, 3)) return;
    this.cw = cw; this.ch = ch;
    this.dpr = Math.min(W.devicePixelRatio || 1, 3);
    var kk = Math.max(1, Math.floor(Math.min(cw * this.dpr / this.LW, ch * this.dpr / this.LH)));
    this.k = kk;
    this.cv.width = this.LW * kk; this.cv.height = this.LH * kk;
    this.cv.style.width = (this.LW * kk / this.dpr) + 'px'; this.cv.style.height = (this.LH * kk / this.dpr) + 'px';
    this.cx.imageSmoothingEnabled = false;
    this.dirty = true;
  };
  /* client (pointer) coordinates -> logical coordinates */
  pix.Canvas.prototype.toLogical = function (clientX, clientY) {
    var r = this.cv.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * this.LW, y: (clientY - r.top) / r.height * this.LH };
  };
  pix.Canvas.prototype.toClient = function (lx, ly) {
    var r = this.cv.getBoundingClientRect();
    return { x: r.left + lx / this.LW * r.width, y: r.top + ly / this.LH * r.height };
  };
  pix.Canvas.prototype.frame = function (ts) {
    if (!this.last) this.last = ts;
    var dt = Math.min((ts - this.last) / 1000, 0.05); this.last = ts;
    this.t += dt;
    if (this.every > 1 && (++this.fc % this.every)) return;
    var cx = this.cx; cx.setTransform(this.k, 0, 0, this.k, 0, 0); cx.imageSmoothingEnabled = false;
    this.draw(cx, dt * (this.every > 1 ? this.every : 1), this.t);
  };
  /* crisp text on a pixel canvas: measured and drawn in device pixels so it is never blurry or blocky */
  pix.text = function (cx, k, str, lx, ly, o) {
    o = o || {};
    cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0);
    var size = (o.size || 14) * (o.dpr || 1);
    cx.font = (o.weight || '700') + ' ' + size + 'px ' + (o.font || '"Pixelify Sans","Fredoka",system-ui,sans-serif');
    cx.textAlign = o.align || 'center'; cx.textBaseline = o.base || 'alphabetic';
    var x = lx * k, y = ly * k;
    if (o.stroke !== false) { cx.lineWidth = Math.max(2, size * 0.22); cx.strokeStyle = o.strokeColor || '#2a1b2e'; cx.lineJoin = 'round'; cx.strokeText(str, x, y); }
    cx.fillStyle = o.color || '#fff4dc'; cx.fillText(str, x, y);
    cx.restore();
  };

  /* ---------- level / XP ---------- */
  IK.Level = {
    need: function (n, base, p) { return Math.round((base || 24) * Math.pow(n, p || 1.65)); },     // XP from level n to n+1
    info: function (xp, base, p) {
      var lvl = 1, left = xp, need = IK.Level.need(1, base, p);
      while (left >= need && lvl < 99) { left -= need; lvl++; need = IK.Level.need(lvl, base, p); }
      return { lvl: lvl, into: left, need: need, pct: left / need };
    },
    total: function (lvl, base, p) { var s = 0; for (var n = 1; n < lvl; n++) s += IK.Level.need(n, base, p); return s; }
  };

  /* ---------- daily goals, streak, week stamps ----------
   * pool: [{id, text(goal), kind (event name), goals:[easy, mid, hard], reward:{xp, chest}}]
   * state lives in the game's own save under S.daily; this object only reads and writes what it is handed. */
  IK.Daily = {
    monday: function (dateStr) {
      var p = dateStr.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]);
      var dow = (d.getDay() + 6) % 7; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
      return d.getFullYear() + '-' + IK.p2(d.getMonth() + 1) + '-' + IK.p2(d.getDate());
    },
    addDays: function (dateStr, n) {
      var p = dateStr.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + n);
      return d.getFullYear() + '-' + IK.p2(d.getMonth() + 1) + '-' + IK.p2(d.getDate());
    },
    /* make sure S.daily is for today; three quests, same for everyone on this date, scaled to how far the player is (scale >= 1) */
    ensure: function (S, gameId, pool, scale) {
      var today = IK.today();
      var d = S.daily || (S.daily = { date: '', quests: [], days: [], streak: 0, best: 0, weekChest: '', lastDay: '' });
      if (!(d.days instanceof Array)) d.days = [];
      if (d.date === today && d.quests && d.quests.length) return d;
      var r = IK.rng(IK.hash(gameId + '|' + today)), picks = [], bag = pool.slice();
      while (picks.length < 3 && bag.length) { var i = Math.floor(r() * bag.length); picks.push(bag.splice(i, 1)[0]); }
      d.date = today;
      d.quests = picks.map(function (q, n) {
        var g = q.goals[Math.min(q.goals.length - 1, n)];                         // quest 1 easy, 2 medium, 3 harder
        g = Math.max(1, Math.round(g * (q.scaled ? Math.max(1, scale || 1) : 1)));
        return { id: q.id, goal: g, prog: 0, done: false, claimed: false };
      });
      d.allClaimed = false;
      return d;
    },
    /* streak: called when the player does any goal-relevant thing today; counts a day once */
    touch: function (S) {
      var d = S.daily, today = IK.today(); if (!d) return false;
      if (d.days.indexOf(today) >= 0) return false;
      d.days.push(today); if (d.days.length > 60) d.days = d.days.slice(-60);
      var yest = IK.Daily.addDays(today, -1);
      d.streak = d.lastDay === yest ? (d.streak || 0) + 1 : 1;
      d.lastDay = today; d.best = Math.max(d.best || 0, d.streak);
      return true;
    },
    week: function (S) {                                                      // Monday-first stamps for this week + lifetime days played
      var d = S.daily || { days: [] }, today = IK.today(), mon = IK.Daily.monday(today), st = [];
      for (var i = 0; i < 7; i++) st.push(d.days.indexOf(IK.Daily.addDays(mon, i)) >= 0);
      var uniq = {}; d.days.forEach(function (x) { uniq[x] = 1; });
      return { stamps: st, count: st.filter(Boolean).length, mon: mon, todayIdx: (new Date().getDay() + 6) % 7, lifetime: Object.keys(uniq).length };
    }
  };

  /* ---------- small inline icons (SVG, so the UI needs no emoji font) ---------- */
  IK.ico = {
    speaker: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg>',
    muted: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7 10V8a5 5 0 0110 0v2h1a1 1 0 011 1v9a1 1 0 01-1 1H6a1 1 0 01-1-1v-9a1 1 0 011-1h1zm2 0h6V8a3 3 0 00-6 0v2z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>'
  };
})(window);
