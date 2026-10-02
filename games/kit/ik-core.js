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
    var w = W.innerWidth, h = W.innerHeight;
    if (w === fx.w && h === fx.h) return;                                 // scrollbar toggles fire resize with the same pixels: keep the backing store
    fx.dpr = Math.min(W.devicePixelRatio || 1, 2);
    fx.w = w; fx.h = h;
    fx.cv.width = Math.round(fx.w * fx.dpr); fx.cv.height = Math.round(fx.h * fx.dpr);
    fx.cv.style.width = fx.w + 'px'; fx.cv.style.height = fx.h + 'px';
    fx.cx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  };
  function getP() { if (fx.free.length) return fx.free.pop(); if (fx.P.length < fx.MAX) return {}; return null; }
  var COLS = ['#ffe9a0', '#ffd15a', '#ffb02e', '#fff6dc'];
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
      p.c = cols[(Math.random() * cols.length) | 0]; p.shape = o.shape || 'spark'; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 8;
      p.tx = null; fx.P.push(p);
    }
    fx.start();
  };
  fx.confetti = function (n) {
    if (RM || !fx.cx || fx.P.length > 90) return;
    var cols = ['#f4c54e', '#f08a3c', '#f5ecd0', '#8ec5f0', '#e46d5c', '#9ad06a'];
    for (var k = 0; k < Math.min(n || 34, 26); k++) {
      var p = getP(); if (!p) break;
      p.x = Math.random() * fx.w; p.y = -10 - Math.random() * 40; p.vx = (Math.random() - 0.5) * 120; p.vy = 80 + Math.random() * 160; p.g = 260;
      p.life = 1.3 + Math.random() * 0.9; p.t = 0; p.s = 4 + Math.random() * 4; p.c = cols[(Math.random() * cols.length) | 0]; p.shape = 'conf'; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12; p.tx = null;
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
      else if (p.shape === 'coin') {
        var sq = Math.abs(Math.cos(p.t * 9 + p.s)) * 0.7 + 0.3;
        cx.fillStyle = '#8a5a12'; cx.beginPath(); cx.ellipse(p.x, p.y + 1, s * sq, s, 0, 0, 6.2832); cx.fill();
        cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(p.x, p.y, s * sq, s, 0, 0, 6.2832); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.65)'; cx.beginPath(); cx.ellipse(p.x - s * sq * 0.3, p.y - s * 0.35, s * sq * 0.35, s * 0.28, 0, 0, 6.2832); cx.fill();
      }
      else if (p.shape === 'star') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalCompositeOperation = 'lighter'; cx.beginPath(); for (var j = 0; j < 8; j++) { var rr = j % 2 ? s * 0.32 : s * 1.5, an = j * Math.PI / 4; cx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } cx.closePath(); cx.fill(); cx.restore(); }
      else if (p.shape === 'conf') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-s, -s * 0.5, s * 2, s); cx.restore(); }
      else if (p.shape === 'leaf') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.beginPath(); cx.ellipse(0, 0, s * 1.4, s * 0.6, 0, 0, 6.2832); cx.fill(); cx.restore(); }
      else { cx.globalCompositeOperation = 'lighter'; var q = Math.max(1.5, s * (1 - f * 0.5)); var gr = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, q * 2.2); gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(255,200,80,0)'); cx.fillStyle = gr; cx.beginPath(); cx.arc(p.x, p.y, q * 2.2, 0, 6.2832); cx.fill(); cx.globalCompositeOperation = 'source-over'; }
      cx.globalCompositeOperation = 'source-over';
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
    while (toasts.length >= 2) { var old = toasts.shift(); if (old.el.parentNode) old.el.parentNode.removeChild(old.el); }
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

  /* ---------- stage: a HiDPI canvas that fills its parent; the game draws in CSS pixels ---------- */
  IK.Stage = function (canvas, draw, maxDpr) {
    this.cv = canvas; this.cx = canvas.getContext('2d'); this.draw = draw; this.maxDpr = maxDpr || 2; this.w = 0; this.h = 0; this.dpr = 1; this.t = 0; this.last = 0; this.every = 1; this.fc = 0;
    var self = this;
    W.addEventListener('resize', function () { self.resize(); });
    if (W.ResizeObserver && canvas.parentNode) { try { new W.ResizeObserver(function () { self.resize(); }).observe(canvas.parentNode); } catch (e) {} }
    this.resize();
  };
  IK.Stage.prototype.resize = function () {
    var p = this.cv.parentNode, w = p.clientWidth, h = p.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(W.devicePixelRatio || 1, this.maxDpr);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cx.imageSmoothingEnabled = true; try { this.cx.imageSmoothingQuality = 'high'; } catch (e) {}
    this.dirty = true;
    if (this.onResize) this.onResize(w, h);
  };
  IK.Stage.prototype.toLocal = function (clientX, clientY) { var r = this.cv.getBoundingClientRect(); return { x: (clientX - r.left) * (this.w / r.width), y: (clientY - r.top) * (this.h / r.height) }; };
  IK.Stage.prototype.toClient = function (x, y) { var r = this.cv.getBoundingClientRect(); return { x: r.left + x / this.w * r.width, y: r.top + y / this.h * r.height }; };
  IK.Stage.prototype.frame = function (ts) {
    if (!this.w) { this.resize(); if (!this.w) return; }
    if (!this.last) this.last = ts;
    var dt = Math.min((ts - this.last) / 1000, 0.05); this.last = ts;
    this.t += dt;
    if (this.every > 1 && (++this.fc % this.every)) { this.acc = (this.acc || 0) + dt; return; }
    dt += this.acc || 0; this.acc = 0;
    var cx = this.cx; cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw(cx, dt, this.t, this.w, this.h);
  };

  /* ---------- images and sprite atlases (rendered from 3D models, packed by games/assets/idle/pack_atlas.py) ---------- */
  var imgs = IK.imgs = {};
  IK.img = function (url, cb) {
    var rec = imgs[url];
    if (!rec) { rec = imgs[url] = { img: new W.Image(), ok: false, err: false, cbs: [] }; rec.img.onload = function () { rec.ok = true; rec.cbs.forEach(function (f) { try { f(); } catch (e) {} }); rec.cbs = []; }; rec.img.onerror = function () { rec.err = true; }; rec.img.decoding = 'async'; rec.img.src = url; }
    if (cb) { if (rec.ok) cb(); else rec.cbs.push(cb); }
    return rec;
  };
  /* an atlas: {name: [x, y, w, h, ax, ay]} plus the image. draw() puts the anchor (ground centre) at (x, y). */
  IK.Atlas = function (imgUrl, map, ready) {
    this.rec = IK.img(imgUrl, ready); this.url = imgUrl; this.map = map;
    var mx = 0, my = 0; for (var k in map) { mx = Math.max(mx, map[k][0] + map[k][2]); my = Math.max(my, map[k][1] + map[k][3]); }
    this.aw = map.__size ? map.__size[0] : mx; this.ah = map.__size ? map.__size[1] : my;
  };
  IK.Atlas.prototype.has = function (n) { return !!this.map[n]; };
  IK.Atlas.prototype.size = function (n) { var m = this.map[n]; return m ? { w: m[2], h: m[3], ax: m[4], ay: m[5] } : null; };
  IK.Atlas.prototype.draw = function (cx, n, x, y, s, alpha, flip) {
    var m = this.map[n]; if (!m || !this.rec.ok) return false;
    s = s || 1;
    if (alpha != null && alpha < 1) cx.globalAlpha = alpha;
    if (flip) { cx.save(); cx.translate(x, y); cx.scale(-s, s); cx.drawImage(this.rec.img, m[0], m[1], m[2], m[3], -m[4], -m[5], m[2], m[3]); cx.restore(); }
    else cx.drawImage(this.rec.img, m[0], m[1], m[2], m[3], x - m[4] * s, y - m[5] * s, m[2] * s, m[3] * s);
    if (alpha != null && alpha < 1) cx.globalAlpha = 1;
    return true;
  };
  /* html for an icon: the sprite fitted inside a box (px) */
  IK.Atlas.prototype.icon = function (n, box, pad) {
    var m = this.map[n]; if (!m) return '';
    var k = Math.min((box - (pad || 0)) / m[2], (box - (pad || 0)) / m[3]);
    return '<span class="spr" role="img" aria-label="' + esc(n) + '" style="width:' + Math.round(m[2] * k) + 'px;height:' + Math.round(m[3] * k) + 'px;background-image:url(' + this.url + ');background-size:' + (this.aw * k).toFixed(2) + 'px ' + (this.ah * k).toFixed(2) + 'px;background-position:-' + (m[0] * k).toFixed(2) + 'px -' + (m[1] * k).toFixed(2) + 'px"></span>';
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
    ensure: function (S, gameId, pool, ctx) {
      var today = IK.today();
      var d = S.daily || (S.daily = { date: '', quests: [], days: [], streak: 0, best: 0, weekChest: '', lastDay: '' });
      if (!(d.days instanceof Array)) d.days = [];
      if (d.date === today && d.quests && d.quests.length) return d;
      var r = IK.rng(IK.hash(gameId + '|' + today)), picks = [], bag = pool.slice();
      while (picks.length < 3 && bag.length) { var i = Math.floor(r() * bag.length); picks.push(bag.splice(i, 1)[0]); }
      d.date = today;
      d.quests = picks.map(function (q, n) {
        var gl = typeof q.goals === 'function' ? q.goals(ctx) : q.goals;
        var g = gl[Math.min(gl.length - 1, n)];                                   // quest 1 easy, 2 medium, 3 harder
        g = Math.max(1, Math.round(g));
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

  /* ---------- inline SVG icons: glossy gold, so the UI needs no emoji font ---------- */
  var defsDone = false;
  IK.defs = function () {
    if (defsDone) return; defsDone = true;
    var d = D.createElement('div');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0" aria-hidden="true"><defs>' +
      '<radialGradient id="ikCoin" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#f2c14e"/><stop offset="1" stop-color="#b8791d"/></radialGradient>' +
      '<linearGradient id="ikGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#eebb46"/><stop offset="1" stop-color="#b8791d"/></linearGradient>' +
      '<linearGradient id="ikGem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4f4ff"/><stop offset=".5" stop-color="#4bb4f0"/><stop offset="1" stop-color="#1b5fa8"/></linearGradient>' +
      '<linearGradient id="ikViolet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eadcff"/><stop offset=".5" stop-color="#a473ee"/><stop offset="1" stop-color="#5e35b0"/></linearGradient>' +
      '<linearGradient id="ikGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2f5a0"/><stop offset=".5" stop-color="#56b83a"/><stop offset="1" stop-color="#2a7a1f"/></linearGradient>' +
      '</defs></svg>';
    D.body.appendChild(d);
  };
  function svg(px, body, vb) { return '<svg class="ic" viewBox="' + (vb || '0 0 32 32') + '" width="' + px + '" height="' + px + '" aria-hidden="true">' + body + '</svg>'; }
  var ST = 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  IK.ico = {
    coin: function (px) { return svg(px, '<circle cx="16" cy="17" r="13" fill="#8a5a12"/><circle cx="16" cy="15" r="13" fill="url(#ikCoin)" stroke="#9a6414" stroke-width="1.2"/><circle cx="16" cy="15" r="9.4" fill="none" stroke="#fff3b0" stroke-opacity=".75" stroke-width="1.4"/><path d="M16 8.6l1.9 4 4.4.5-3.3 3 .9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.3-3 4.4-.5z" fill="#b8791d" opacity=".85"/><ellipse cx="11.5" cy="8.2" rx="4.5" ry="2.2" fill="#fff" opacity=".35" transform="rotate(-30 11.5 8.2)"/>'); },
    crown: function (px) { return svg(px, '<path d="M4 25l-1.5-14 7.2 5.3L16 6l6.3 10.3 7.2-5.3L28 25z" fill="url(#ikViolet)" stroke="#3f1f80" stroke-width="1.6" stroke-linejoin="round"/><rect x="4" y="25" width="24" height="3.6" rx="1.4" fill="url(#ikGold)" stroke="#8a5a12" stroke-width="1.2"/><circle cx="16" cy="12.5" r="1.9" fill="#fff3b0"/><circle cx="9.8" cy="17.6" r="1.4" fill="#fff3b0"/><circle cx="22.2" cy="17.6" r="1.4" fill="#fff3b0"/>'); },
    gem: function (px) { return svg(px, '<path d="M8 6h16l5 7-13 15L3 13z" fill="url(#ikGem)" stroke="#0f3d7a" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 13h26M12 6l-3 7 7 15 7-15-3-7" fill="none" stroke="#e8f8ff" stroke-opacity=".7" stroke-width="1.2"/>'); },
    star: function (px) { return svg(px, '<path d="M16 3l3.9 8.2 9 1.1-6.6 6.2 1.7 8.9L16 22.9 8 27.4l1.7-8.9L3.1 12.3l9-1.1z" fill="url(#ikGold)" stroke="#8a5a12" stroke-width="1.5" stroke-linejoin="round"/>'); },
    hammer: function (px) { return svg(px, '<path d="M6 26l11-11" ' + ST + '/><path d="M13 7l6-3 8 8-3 6-3-1-9-9z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'); },
    up: function (px) { return svg(px, '<path d="M8 17l8-8 8 8M8 26l8-8 8 8" ' + ST + '/>'); },
    scroll: function (px) { return svg(px, '<path d="M9 5h14a3 3 0 013 3v18H12a3 3 0 01-3-3V5zM9 5a3 3 0 00-3 3v2h3M13 12h9M13 17h9M13 22h6" ' + ST + '/>'); },
    trophy: function (px) { return svg(px, '<path d="M9 5h14v8a7 7 0 01-14 0zM9 8H4c0 5 2 7 5 7M23 8h5c0 5-2 7-5 7M16 20v4M11 27h10" ' + ST + '/>'); },
    gift: function (px) { return svg(px, '<rect x="5" y="12" width="22" height="16" rx="2" fill="url(#ikGreen)" stroke="#1f5f17" stroke-width="1.5"/><rect x="3" y="8" width="26" height="6" rx="2" fill="url(#ikGold)" stroke="#8a5a12" stroke-width="1.5"/><path d="M16 8v20" stroke="#8a5a12" stroke-width="3"/><path d="M16 8c-5-5-9 0-5 1zM16 8c5-5 9 0 5 1z" fill="#f2c14e" stroke="#8a5a12" stroke-width="1.3"/>'); },
    speaker: function (px) { return svg(px, '<path d="M4 12v8h5l7 5V7l-7 5H4z" fill="currentColor"/><path d="M20 11a6 6 0 010 10M23 8a10 10 0 010 16" ' + ST + '/>'); },
    muted: function (px) { return svg(px, '<path d="M4 12v8h5l7 5V7l-7 5H4z" fill="currentColor"/><path d="M21 12l7 8M28 12l-7 8" ' + ST + '/>'); },
    back: function (px) { return svg(px, '<path d="M19 6l-9 10 9 10" ' + ST + '/>'); },
    lock: function (px) { return svg(px, '<rect x="7" y="14" width="18" height="14" rx="3" fill="currentColor"/><path d="M11 14v-3a5 5 0 0110 0v3" ' + ST + '/>'); },
    check: function (px) { return svg(px, '<path d="M6 17l7 7L26 9" ' + ST.replace('2.6', '4') + '/>'); },
    plus: function (px) { return svg(px, '<path d="M16 7v18M7 16h18" ' + ST.replace('2.6', '4') + '/>'); },
    hand: function (px) { return svg(px, '<path d="M12 4a2 2 0 014 0v9l1-1a2 2 0 013 1v-1a2 2 0 013 2v-.5a2 2 0 014 1V21c0 5-3 9-8 9h-3c-3 0-5-2-6.5-4.5L4 19c-1-2 1-3.500 3-2l3 2.500z" transform="scale(.8) translate(1 0)" fill="#fff8e6" stroke="#4a2c08" stroke-width="1.8" stroke-linejoin="round"/>'); },
    cart: function (px) { return svg(px, '<path d="M3 8h4l3 13h14l3-10H9" ' + ST + '/><circle cx="12" cy="26" r="2.4" fill="currentColor"/><circle cx="23" cy="26" r="2.4" fill="currentColor"/>'); }
  };
})(window);
