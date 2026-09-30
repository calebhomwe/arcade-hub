/* Mat: canvas helpers for real-looking materials (wood, stone, enamel, glass, metal) using the CC0 textures in assets/tex.
 *   Mat.load(names, onLoad)        load textures (once), call onLoad each time one arrives
 *   Mat.texBox(c, name, x,y,w,h, seed, frac)   draw a crop of a texture into a box
 *   Mat.paint(c, m, x,y,w,h, path, seed)       fill `path(c)` with material m: {kind, base, tex}, with shadow, bevel, gloss
 *   Mat.disc(r, m, seed) -> canvas             a round game disc with a rim ridge, cached by the caller
 *   Mat.shade / Mat.rr                         colour shading and rounded-rect path */
(function (G) {
  'use strict';
  const TEX = {}; let base = 'assets/tex/';
  function load(names, onLoad) { names.forEach(n => { if (TEX[n] !== undefined) return; TEX[n] = null; const im = new Image(); im.decoding = 'async'; im.onload = () => { TEX[n] = im; onLoad && onLoad(n); }; im.src = base + n + '.jpg'; }); }
  function texBox(c, name, x, y, w, h, seed, frac) {
    const im = TEX[name]; if (!im) return false; const sw = im.width * (frac || 0.4), sh = Math.min(im.height, sw * (h / w));
    c.drawImage(im, ((seed * 97) % Math.max(1, im.width - sw)) | 0, ((seed * 57) % Math.max(1, im.height - sh)) | 0, sw, sh, x, y, w, h); return true;
  }
  function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = amt < 0 ? 0 : 255, p = Math.abs(amt); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fillKind(c, m, x, y, w, h, seed) {
    const base2 = m.base;
    if (m.kind === 'lacquer') {
      c.fillStyle = base2; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.9; texBox(c, m.tex, x, y, w, h, seed, 0.35); c.globalAlpha = 0.25; c.globalCompositeOperation = 'multiply'; texBox(c, m.tex, x, y, w, h, seed + 4, 0.35); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } else if (m.kind === 'metal') {
      const g = c.createLinearGradient(x, y, x + w, y + h * 1.2); [[0, '#fff6c8'], [0.18, shade(base2, 0.25)], [0.38, shade(base2, -0.35)], [0.55, shade(base2, 0.35)], [0.75, base2], [1, shade(base2, -0.5)]].forEach(s => g.addColorStop(s[0], s[1])); c.fillStyle = g; c.fillRect(x, y, w, h);
    } else if (m.kind === 'stone') {
      if (!texBox(c, m.tex, x, y, w, h, seed, 0.5)) { c.fillStyle = base2; c.fillRect(x, y, w, h); }
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.85; c.fillStyle = base2; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.4; texBox(c, m.tex, x, y, w, h, seed + 5, 0.5); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    } else if (m.kind === 'enamel') {
      const g = c.createLinearGradient(x, y, x + w * 0.4, y + h); g.addColorStop(0, shade(base2, 0.22)); g.addColorStop(0.55, base2); g.addColorStop(1, shade(base2, -0.3)); c.fillStyle = g; c.fillRect(x, y, w, h);
    } else if (m.kind === 'gem') {
      const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, shade(base2, 0.35)); g.addColorStop(0.5, base2); g.addColorStop(1, shade(base2, -0.4)); c.fillStyle = g; c.fillRect(x, y, w, h);
    } else { // glass
      c.fillStyle = 'rgba(8,12,40,.9)'; c.fillRect(x, y, w, h); const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, shade(base2, 0.3)); g.addColorStop(1, shade(base2, -0.2)); c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(x, y, w, h); c.globalAlpha = 1;
    }
  }
  function paint(c, m, x, y, w, h, path, seed) {
    const u = Math.max(w, h);
    c.save(); c.shadowColor = m.kind === 'glass' ? m.base : 'rgba(0,0,0,.55)'; c.shadowBlur = m.kind === 'glass' ? u * 0.28 : u * 0.09; c.shadowOffsetY = m.kind === 'glass' ? 0 : u * 0.06; path(c); c.fillStyle = shade(m.base, -0.3); c.fill(); c.restore();
    c.save(); path(c); c.clip(); fillKind(c, m, x, y, w, h, seed || 1);
    const sh = c.createLinearGradient(x, y, x + w * 0.3, y + h); sh.addColorStop(0, 'rgba(255,255,255,.32)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.32)'); c.fillStyle = sh; c.fillRect(x, y, w, h);
    const bv = c.createLinearGradient(x, y, x + w, y + h); bv.addColorStop(0, 'rgba(255,255,255,.75)'); bv.addColorStop(0.5, 'rgba(255,255,255,0)'); bv.addColorStop(1, 'rgba(0,0,0,.55)'); path(c); c.strokeStyle = bv; c.lineWidth = u * 0.06; c.stroke();
    c.restore();
  }
  /* a game disc: outer rim, a recessed ring, a raised centre, gloss. Returns a canvas of side 2r+pad (shadow included). */
  function disc(r, m, seed) {
    const pad = Math.ceil(r * 0.3), z = Math.ceil(2 * r + 2 * pad), cv = document.createElement('canvas'); cv.width = cv.height = z; const c = cv.getContext('2d'), cx = z / 2, cy = z / 2 - r * 0.02;
    const circle = (rad) => cc => { cc.beginPath(); cc.arc(cx, cy, rad, 0, 6.283); cc.closePath(); };
    paint(c, m, cx - r, cy - r, 2 * r, 2 * r, circle(r), seed);
    // recessed ring
    c.save(); circle(r * 0.66)(c); c.lineWidth = r * 0.09; c.strokeStyle = 'rgba(0,0,0,.34)'; c.stroke(); circle(r * 0.66 + r * 0.075)(c); c.lineWidth = r * 0.04; c.strokeStyle = 'rgba(255,255,255,.32)'; c.stroke(); c.restore();
    // raised centre
    c.save(); circle(r * 0.58)(c); c.clip(); const g = c.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r * 0.6); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g; c.fillRect(cx - r, cy - r, 2 * r, 2 * r); c.restore();
    // gloss arc
    c.save(); circle(r * 0.94)(c); c.clip(); const gl = c.createLinearGradient(0, cy - r, 0, cy - r * 0.1); gl.addColorStop(0, 'rgba(255,255,255,.5)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.beginPath(); c.ellipse(cx - r * 0.1, cy - r * 0.52, r * 0.62, r * 0.32, -0.25, 0, 6.283); c.fill(); c.restore();
    cv._pad = pad; return cv;
  }
  G.Mat = { TEX, load, texBox, shade, rr, paint, disc, fillKind, setBase: b => { base = b; } };
})(window);
