/* IdleKit iso (ik-iso.js): the golden-hour island that the town and farm games draw their sprites on.
 *
 *   var iso = new IK.Iso(stage, { N: 4, M: 4, atlas: A, tex: {...}, theme: 'meadow' });
 *   iso.layout(w, h)              call on resize
 *   iso.backdrop(cx, dt, t)       sky, sun, hills, sea, clouds, sparkle (the still part is cached)
 *   iso.ground(cx, fn)            cliff and grass; fn(cx) draws fields, pads, plaza in tile space (1 tile = 256 units)
 *   iso.cellXY(i, j)              screen position of the centre of tile (i, j); sprites are anchored there
 *   iso.light(cx, dt, t)          sun rays and birds over everything
 *   iso.chip(cx, text, x, y, gold) small label; iso.rr(cx, x, y, w, h, r) rounded rect path
 * The sprites are rendered at 84 px per metre; iso.sprS scales them for the screen (about 0.4 on a phone).
 */
(function (W) {
  'use strict';
  var IK = W.IK, D = W.document;
  IK.Iso = function (stage, o) {
    var I = this;
    I.st = stage; I.o = o || {}; I.N = I.o.N || 4; I.M = I.o.M || 4; I.HW = 50; I.HH = 25;
    I.sc = 1; I.ox = 0; I.oy = 0; I.w = 0; I.h = 0; I.bgc = null; I.sprS = I.o.sprS || 0.4; I.pat = {};
    I.tex = {}; (I.o.tex || []).forEach(function (n) { I.tex[n] = IK.img('assets/idle/tex/' + n + '.jpg'); });
    I.th = I.o.th || 'meadow';
    I.clouds = []; I.birds = [];
    for (var k = 0; k < 4; k++) I.clouds.push({ x: Math.random(), y: 0.07 + Math.random() * 0.16, s: 0.7 + Math.random() * 0.7, v: 0.004 + Math.random() * 0.006 });
    for (k = 0; k < 3; k++) I.birds.push({ x: Math.random(), y: 0.16 + Math.random() * 0.1, p: Math.random() * 6 });
  };
  var P = IK.Iso.prototype;
  P.cellXY = function (i, j) { return { x: this.ox + (i - j) * this.HW * this.sc, y: this.oy + (i + j + 1) * this.HH * this.sc }; };
  P.layout = function (W2, H2) {
    var I = this;
    I.w = W2; I.h = H2;
    var span = (I.N + I.M) * I.HW;                                         // island width at scale 1
    I.sc = Math.min(W2 / (span + 30), (H2 - 96) / ((I.N + I.M) * I.HH + 46));
    I.ox = W2 / 2 + ((I.o.shiftX || 0) * I.sc); I.oy = Math.max(84, H2 * 0.5 - 40 * I.sc);
    I.bgc = null;
  };
  P.rr = function (cx, x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  P.pattern = function (cx, name) { var r = this.tex[name]; if (!r || !r.ok) return null; return this.pat[name] || (this.pat[name] = cx.createPattern(r.img, 'repeat')); };
  P.chip = function (cx, txt, x, y, gold) {
    cx.font = '800 14px "DM Sans", system-ui, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    var tw = cx.measureText(txt).width + 14, hh = 20;
    cx.fillStyle = gold ? 'rgba(242,193,78,.96)' : 'rgba(10,24,48,.88)'; this.rr(cx, x - tw / 2, y - hh / 2, tw, hh, 10); cx.fill();
    cx.strokeStyle = gold ? '#8a5a12' : 'rgba(240,200,110,.85)'; cx.lineWidth = 1.2; cx.stroke();
    cx.fillStyle = gold ? '#3a2508' : '#ffe9a8'; cx.fillText(txt, x, y + 1);
  };
  P.tint = function (atlas, name, color) {                                  // the sprite's silhouette filled with a colour (blueprints, hit flashes)
    var I = this; I.gh = I.gh || {};
    var key = name + '|' + color;
    if (I.gh[key]) return I.gh[key];
    var m = atlas.map[name]; if (!m || !atlas.rec.ok) return null;
    var c = D.createElement('canvas'); c.width = m[2]; c.height = m[3];
    var g = c.getContext('2d'); g.drawImage(atlas.rec.img, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return I.gh[key] = c;
  };
  P.drawTint = function (cx, atlas, name, color, x, y, s, alpha, flip) {
    var c = this.tint(atlas, name, color); if (!c) return; var m = atlas.map[name];
    cx.globalAlpha = alpha;
    if (flip) { cx.save(); cx.translate(x, y); cx.scale(-s, s); cx.drawImage(c, -m[4], -m[5]); cx.restore(); }
    else cx.drawImage(c, x - m[4] * s, y - m[5] * s, m[2] * s, m[3] * s);
    cx.globalAlpha = 1;
  };
  P.drawGhost = function (cx, atlas, name, x, y, s, alpha) { this.drawTint(cx, atlas, name, 'rgba(190,225,255,.9)', x, y, s, alpha); };
  P.diamond = function (cx, x, y, k) { var I = this; cx.beginPath(); cx.moveTo(x, y - I.HH * I.sc * k); cx.lineTo(x + I.HW * I.sc * k, y); cx.lineTo(x, y + I.HH * I.sc * k); cx.lineTo(x - I.HW * I.sc * k, y); cx.closePath(); };

  /* the sky and sea; the still part is drawn once per size */
  var THEMES = {
    meadow: { top: '#4f86c2', mid: '#9cc4e4', hor: '#f7dcae', far: '#8da7c9', mid2: '#7e9bb4', near: '#5f8a52', sea: ['#9cc8d8', '#4b93b8', '#1f5b86'] },
    dusk: { top: '#2b3f7a', mid: '#8b6fa8', hor: '#f0a878', far: '#5d5f92', mid2: '#4a4d7a', near: '#3d5a4a', sea: ['#7a8fb8', '#3a5a8e', '#152a55'] }
  };
  P.background = function () {
    var I = this, w = I.w, h = I.h, th = THEMES[I.th] || THEMES.meadow, dpr = I.st.dpr;
    var c = D.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var hor = h * 0.42;
    var sky = g.createLinearGradient(0, 0, 0, hor); sky.addColorStop(0, th.top); sky.addColorStop(0.55, th.mid); sky.addColorStop(1, th.hor);
    g.fillStyle = sky; g.fillRect(0, 0, w, hor + 2);
    var sun = g.createRadialGradient(w * 0.22, hor * 0.7, 0, w * 0.22, hor * 0.7, w * 0.7); sun.addColorStop(0, 'rgba(255,238,190,.95)'); sun.addColorStop(0.15, 'rgba(255,214,140,.5)'); sun.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, hor + 2);
    function ridge(base, amp, col, seed, step) { g.fillStyle = col; g.beginPath(); g.moveTo(0, hor + 2); for (var x = 0; x <= w + step; x += step) { var y = base - amp * (0.55 + 0.45 * Math.sin(x * 0.011 + seed) * Math.cos(x * 0.0043 + seed * 2)) * (0.7 + 0.3 * Math.sin(x * 0.03 + seed * 5)); g.lineTo(x, y); } g.lineTo(w, hor + 2); g.closePath(); g.fill(); }
    ridge(hor - 6, 46, th.far, 1.3, 6); ridge(hor - 1, 30, th.mid2, 4.1, 6);
    var haze = g.createLinearGradient(0, hor - 60, 0, hor + 4); haze.addColorStop(0, 'rgba(255,225,180,0)'); haze.addColorStop(1, 'rgba(255,225,180,.55)'); g.fillStyle = haze; g.fillRect(0, hor - 60, w, 64);
    ridge(hor + 4, 16, th.near, 7.7, 5);
    var sea = g.createLinearGradient(0, hor, 0, h); sea.addColorStop(0, th.sea[0]); sea.addColorStop(0.35, th.sea[1]); sea.addColorStop(1, th.sea[2]); g.fillStyle = sea; g.fillRect(0, hor + 2, w, h - hor);
    var glint = g.createLinearGradient(0, hor, 0, hor + h * 0.3); glint.addColorStop(0, 'rgba(255,236,190,.55)'); glint.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = glint; g.beginPath(); g.moveTo(w * 0.05, hor + 2); g.lineTo(w * 0.42, hor + 2); g.lineTo(w * 0.62, hor + h * 0.3); g.lineTo(w * 0.05, hor + h * 0.3); g.fill();
    I.bgc = c;
  };
  P.backdrop = function (cx, dt, t) {
    var I = this, W2 = I.w, H2 = I.h;
    if (!I.bgc) I.background();
    cx.drawImage(I.bgc, 0, 0, W2, H2);
    cx.save(); cx.globalAlpha = 0.85;
    I.clouds.forEach(function (c) {
      c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3;
      var x = c.x * W2, y = c.y * H2, s = 26 * c.s;
      for (var q = 0; q < 5; q++) { var gx = x + (q - 2) * s * 0.75, gy = y + Math.sin(q * 1.7) * s * 0.18, r = s * (0.7 + 0.3 * Math.sin(q * 2.3)); var g = cx.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, 'rgba(255,250,240,.95)'); g.addColorStop(1, 'rgba(255,240,215,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(gx, gy, r, 0, 6.2832); cx.fill(); }
    });
    cx.restore();
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,236,190,.5)';
    for (var q = 0; q < 14; q++) { var sx = ((q * 97) % 100) / 100 * W2, sy = H2 * 0.46 + ((q * 53) % 100) / 100 * H2 * 0.5, ph = Math.sin(t * 1.6 + q * 2.1); if (ph > 0.3) cx.fillRect(sx, sy, 8 * I.sc * ph, 1.3); }
    cx.restore();
  };
  /* the island: cliff faces under the grass, then whatever fn draws in tile space */
  P.ground = function (cx, fn) {
    var I = this, sc = I.sc, N = I.N, M = I.M, HW = I.HW, HH = I.HH, ox = I.ox, oy = I.oy;
    var a = HW * sc / 256, b = HH * sc / 256;
    var right = { x: ox + N * HW * sc, y: oy + N * HH * sc }, bot = { x: ox + (N - M) * HW * sc, y: oy + (N + M) * HH * sc }, left = { x: ox - M * HW * sc, y: oy + M * HH * sc };
    var th = 30 * sc;
    function face(p, q, dark) {
      var g = cx.createLinearGradient(0, Math.min(p.y, q.y), 0, Math.max(p.y, q.y) + th); g.addColorStop(0, dark ? '#6a4a2b' : '#87603a'); g.addColorStop(1, dark ? '#2f2214' : '#3e2c1a');
      cx.fillStyle = g; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.lineTo(q.x, q.y + th); cx.lineTo(p.x, p.y + th); cx.closePath(); cx.fill();
      var rk = I.pattern(cx, 'rock'); if (rk) { cx.globalAlpha = 0.35; cx.fillStyle = rk; cx.fill(); cx.globalAlpha = 1; }
      cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1.5; cx.stroke();
    }
    cx.save(); cx.fillStyle = 'rgba(8,40,70,.28)'; cx.beginPath(); cx.moveTo(left.x - 8 * sc, left.y + th); cx.lineTo(bot.x, bot.y + th + 10 * sc); cx.lineTo(right.x + 8 * sc, right.y + th); cx.lineTo(bot.x, bot.y + th + 24 * sc); cx.closePath(); cx.fill(); cx.restore();
    face(left, bot, true); face(bot, right, false);
    cx.save(); cx.transform(a, b, -a, b, ox, oy);
    var gr = I.pattern(cx, I.o.ground || 'mountain_grass');
    cx.fillStyle = gr || '#5b8f3c'; cx.fillRect(0, 0, N * 256, M * 256);
    var sunl = cx.createLinearGradient(0, 0, N * 256, M * 256); sunl.addColorStop(0, 'rgba(255,230,160,.30)'); sunl.addColorStop(0.5, 'rgba(255,220,140,0)'); sunl.addColorStop(1, 'rgba(20,40,10,.22)'); cx.fillStyle = sunl; cx.fillRect(0, 0, N * 256, M * 256);
    if (fn) fn(cx);
    cx.restore();
    cx.strokeStyle = 'rgba(255,240,200,.55)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(left.x, left.y); cx.lineTo(bot.x, bot.y); cx.lineTo(right.x, right.y); cx.stroke();
  };
  /* rounded pad in tile space: tile (i, j), inset in tile units */
  P.pad = function (cx, i, j, fill, edge, inset, w, h) {
    inset = inset == null ? 0.1 : inset; w = w || 1; h = h || 1;
    cx.fillStyle = fill; this.rr(cx, i * 256 + inset * 256, j * 256 + inset * 256, (w - 2 * inset) * 256, (h - 2 * inset) * 256, 22); cx.fill();
    if (edge) { cx.strokeStyle = edge; cx.lineWidth = 6; cx.stroke(); }
  };
  P.light = function (cx, dt, t) {
    var I = this, w = I.w, h = I.h;
    cx.save(); cx.globalCompositeOperation = 'lighter';
    var ray = cx.createLinearGradient(0, 0, w * 0.6, h * 0.8); ray.addColorStop(0, 'rgba(255,225,160,.20)'); ray.addColorStop(0.5, 'rgba(255,220,150,.04)'); ray.addColorStop(1, 'rgba(255,220,150,0)');
    cx.fillStyle = ray; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(w * 0.42, 0); cx.lineTo(w * 0.95, h); cx.lineTo(w * 0.35, h); cx.closePath(); cx.fill();
    cx.restore();
    cx.strokeStyle = 'rgba(40,50,70,.7)'; cx.lineWidth = 1.5;
    I.birds.forEach(function (b) { b.x += 0.02 * dt; if (b.x > 1.1) b.x = -0.1; var x = b.x * w, y = b.y * h + Math.sin(t * 0.7 + b.p) * 6, fl = Math.sin(t * 9 + b.p) * 3; cx.beginPath(); cx.moveTo(x - 6, y - fl); cx.quadraticCurveTo(x - 3, y - 3, x, y); cx.quadraticCurveTo(x + 3, y - 3, x + 6, y - fl); cx.stroke(); });
  };
})(window);
