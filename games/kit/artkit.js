/* artkit.js: procedural painted art for the hub's canvas games, so nothing is a flat vector shape.
 * Everything is drawn ONCE into small offscreen canvases (textured, lit from a low golden sun on the right) and then only blitted,
 * so it costs nothing per frame. Direction (from Caleb's key art): golden-hour light, layered depth, haze toward the horizon,
 * natural colours with warm accents, materials with wear (verdigris, rust, moss, grain), UI in navy glass, parchment and gold.
 *   Art.rng(seed)                     small seeded random
 *   Art.noise(seed)                   smooth value noise: f(x, y) in 0..1, and f.fbm(x, y, octaves)
 *   Art.make(w, h, dpr)               offscreen canvas + 2d context already scaled to dpr
 *   Art.pipe(w, h, opt)               weathered copper pipe body (cylinder shading, verdigris, streaks, rivets)
 *   Art.pipeCap(w, h, opt)            its flared rim
 *   Art.ridge(w, h, opt)              mountain / hill silhouette strip with lit slopes and haze (tileable in x)
 *   Art.foliage(w, h, opt)            tree line strip with lit canopies (tileable in x)
 *   Art.grass(w, h, opt)              ground tile: grass blades over soil with pebbles (tileable in x)
 *   Art.glow(ctx, x, y, r, color, a)  additive glow
 *   Art.vignette(ctx, w, h, a)        soft dark corners
 *   Art.grain(w, h, a)                film grain tile (canvas) to drape over the frame */
(function (G) {
  'use strict';
  const D = G.document;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) { let a = seed >>> 0 || 1; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noise(seed) {
    const perm = new Uint8Array(512), r = rng(seed); for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const val = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
    const f = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return lerp(lerp(val(xi, yi), val(xi + 1, yi), u), lerp(val(xi, yi + 1), val(xi + 1, yi + 1), u), v);
    };
    f.fbm = (x, y, o) => { let s = 0, a = 0.5, fr = 1, n = 0; for (let i = 0; i < (o || 4); i++) { s += a * f(x * fr, y * fr); n += a; a *= 0.5; fr *= 2; } return s / n; };
    return f;
  }
  function make(w, h, dpr) {
    const c = D.createElement('canvas'); dpr = dpr || 1; c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const x = c.getContext('2d'); x.scale(dpr, dpr); return { c, x, w, h, dpr };
  }
  const hex = c => { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; };
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // ---- weathered copper pipe: cylinder light across x, verdigris blotches by noise, drip streaks, rivet bands
  function pipe(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, W = Math.round(w * dpr), H = Math.round(h * dpr);
    const c = D.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    const n = noise(o.seed || 7), n2 = noise((o.seed || 7) + 99);
    const copper = hex(o.copper || '#a8622f'), dark = hex(o.dark || '#4a2a16'), patina = hex(o.patina || '#4f9a86'), patinaDk = hex(o.patinaDark || '#2f6558'), hi = hex(o.hi || '#ffd9a0');
    const bands = o.bands || [0.18, 0.5, 0.82];
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        let u = px / (W - 1); if (o.flip !== false) u = 1 - u;       // the low sun is on the right, so the lit side of every pipe faces right
        // cylinder: dark edge -> lit left-centre (sun on the left of the pipe) -> mid -> shadowed right
        let lit = 0.18 + 0.82 * Math.pow(Math.sin(clamp((u * 1.1 - 0.02), 0, 1) * Math.PI), 0.7);
        lit *= 1 - 0.55 * Math.pow(clamp((u - 0.55) / 0.45, 0, 1), 1.6);
        let col = mixc(dark, copper, clamp(lit * 1.15, 0, 1));
        col = mixc(col, hi, clamp((lit - 0.82) * 4, 0, 0.55) * (0.6 + 0.4 * n(px * 0.15, py * 0.05)));
        // verdigris: blotches denser near the bottom of each segment and near the edges
        const v = n.fbm(px * 0.11, py * 0.045 + 3, 4), streak = n2(px * 0.6, py * 0.02);
        let pv = clamp((v - 0.5) * 3.2 + (streak - 0.5) * 0.9 + (o.wear == null ? 0.25 : o.wear), 0, 1);
        pv *= 0.55 + 0.45 * Math.abs(u - 0.5) * 2;
        col = mixc(col, mixc(patinaDk, patina, clamp(lit * 1.3, 0, 1)), pv * 0.85);
        // fine grain and pits
        const g = (n(px * 0.9, py * 0.9) - 0.5) * 22; col = [col[0] + g, col[1] + g, col[2] + g];
        const i = (py * W + px) * 4; d[i] = clamp(col[0], 0, 255); d[i + 1] = clamp(col[1], 0, 255); d[i + 2] = clamp(col[2], 0, 255); d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // rivet bands (raised strip with tiny rivets), drawn in device pixels
    x.save(); x.scale(dpr, dpr);
    bands.forEach(b => {
      const by = b * h - 4;
      const g = x.createLinearGradient(0, by, 0, by + 9); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(0.18, 'rgba(255,220,170,.55)'); g.addColorStop(0.5, 'rgba(120,70,30,.45)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      x.fillStyle = g; x.fillRect(0, by, w, 9);
      for (let k = 0; k < 4; k++) { const rx = 8 + k * ((w - 16) / 3); x.fillStyle = 'rgba(40,20,8,.55)'; x.beginPath(); x.arc(rx + 0.8, by + 5.2, 2.1, 0, 6.283); x.fill(); const rg = x.createRadialGradient(rx - 0.6, by + 3.6, 0.2, rx, by + 4.5, 2.2); rg.addColorStop(0, '#ffe7be'); rg.addColorStop(1, '#8a5324'); x.fillStyle = rg; x.beginPath(); x.arc(rx, by + 4.4, 1.8, 0, 6.283); x.fill(); }
    });
    // edge darkening so the pipe sits in the scene
    const eg = x.createLinearGradient(0, 0, w, 0); eg.addColorStop(0, 'rgba(0,0,0,.42)'); eg.addColorStop(0.1, 'rgba(0,0,0,0)'); eg.addColorStop(0.92, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.22)'); x.fillStyle = eg; x.fillRect(0, 0, w, h);
    x.restore();
    return c;
  }
  // flared rim: wider, with a bevel, a shadow line under it, verdigris crust
  function pipeCap(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, body = pipe(w, h, Object.assign({}, o, { bands: [], seed: (o.seed || 7) + 5, wear: 0.15, dpr })), c = D.createElement('canvas');
    c.width = body.width; c.height = body.height; const x = c.getContext('2d'); x.drawImage(body, 0, 0); x.save(); x.scale(dpr, dpr);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,230,180,.6)'); g.addColorStop(0.12, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(30,14,4,.7)'; x.lineWidth = 1.6; x.strokeRect(0.8, 0.8, w - 1.6, h - 1.6);
    x.restore(); return c;
  }

  // ---- mountains / hills: a silhouette from fbm, banded by lit and shaded slopes, faded into haze at the bottom
  function ridge(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, m = make(w, h, dpr), x = m.x, n = noise(o.seed || 3), rr = rng((o.seed || 3) + 1);
    const amp = o.amp || h * 0.6, base = o.base == null ? h * 0.75 : o.base, sc = o.scale || 0.012, jag = o.jag == null ? 1 : o.jag;
    const top = hex(o.top || '#7d86a8'), bot = hex(o.bot || '#c9a9a0'), lit = hex(o.lit || '#ffd2a0');
    const pts = []; const step = 3;
    for (let px = 0; px <= w; px += step) {
      // wrap so the strip tiles: blend the noise with itself shifted by w
      const t = px / w, a = n.fbm(px * sc, 1.3, 5), b = n.fbm((px - w) * sc, 1.3, 5), v = a * (1 - t) + b * t;
      const ridgeV = 1 - Math.abs(v * 2 - 1) * jag;               // sharp peaks
      pts.push([px, base - (o.peaky ? ridgeV : v) * amp]);
    }
    const fill = x.createLinearGradient(0, base - amp, 0, h); fill.addColorStop(0, 'rgb(' + top.map(Math.round) + ')'); fill.addColorStop(1, 'rgb(' + bot.map(Math.round) + ')');
    x.fillStyle = fill; x.beginPath(); x.moveTo(0, h); pts.forEach(p => x.lineTo(p[0], p[1])); x.lineTo(w, h); x.closePath(); x.fill();
    // sun-facing slopes catch warm light (sun sits to the right, low)
    x.save(); x.clip();
    for (let i = 1; i < pts.length; i++) {
      const dy = pts[i][1] - pts[i - 1][1];
      if (dy < 0.2) continue;                                       // sloping down towards the right = faces the sun
      const k = clamp(dy / 3.2, 0, 1);
      x.fillStyle = 'rgba(' + lit.map(Math.round) + ',' + (0.10 + 0.35 * k) + ')';
      x.beginPath(); x.moveTo(pts[i - 1][0], pts[i - 1][1]); x.lineTo(pts[i][0], pts[i][1]); x.lineTo(pts[i][0] - 9, pts[i][1] + 26 + 40 * rr()); x.lineTo(pts[i - 1][0] - 9, pts[i - 1][1] + 26 + 40 * rr()); x.closePath(); x.fill();
    }
    if (o.snow) { x.fillStyle = 'rgba(255,246,235,.85)'; for (let i = 1; i < pts.length; i++) if (pts[i][1] < base - amp * 0.72) { x.beginPath(); x.moveTo(pts[i - 1][0], pts[i - 1][1]); x.lineTo(pts[i][0], pts[i][1]); x.lineTo(pts[i][0], pts[i][1] + 8 + 10 * rr()); x.lineTo(pts[i - 1][0], pts[i - 1][1] + 8 + 10 * rr()); x.closePath(); x.fill(); } }
    // haze toward the bottom edge
    const hz = x.createLinearGradient(0, base - amp * 0.2, 0, h); hz.addColorStop(0, 'rgba(255,214,170,0)'); hz.addColorStop(1, 'rgba(' + (o.haze || '255,205,160') + ',' + (o.hazeA == null ? 0.55 : o.hazeA) + ')');
    x.fillStyle = hz; x.fillRect(0, 0, w, h);
    x.restore(); return m.c;
  }

  // ---- foliage strip: many overlapping canopies, each a dark base + a sun-lit top-right crescent, trunks between
  function foliage(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, m = make(w, h, dpr), x = m.x, r = rng(o.seed || 11);
    const dark = hex(o.dark || '#1f4a2b'), mid = hex(o.mid || '#3f7a35'), lit = hex(o.lit || '#d8e07a'), n = o.count || Math.round(w / 26);
    const blobs = [];
    for (let i = 0; i < n; i++) blobs.push({ x: (i + r() * 0.8) * (w / n), s: (o.min || 20) + r() * (o.max || 34), y: h - (o.lift || 0) - r() * (o.spread || 26), t: r() });
    blobs.sort((a, b) => a.y - b.y);
    blobs.forEach(b => {
      [0, w, -w].forEach(off => {
        const bx = b.x + off; if (bx < -b.s * 1.5 || bx > w + b.s * 1.5) return;
        const cm = mixc(dark, mid, b.t * 0.7);
        x.fillStyle = 'rgba(20,30,18,.35)'; x.beginPath(); x.ellipse(bx + 3, b.y + b.s * 0.35, b.s * 0.95, b.s * 0.32, 0, 0, 6.283); x.fill();      // trunk-shadow / undergrowth
        x.fillStyle = 'rgb(' + cm.map(Math.round) + ')'; x.beginPath(); x.arc(bx, b.y, b.s, 0, 6.283); x.fill();
        for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.5 + r() * 0.3, rr2 = b.s * (0.35 + r() * 0.3); x.fillStyle = 'rgba(' + mixc(cm, lit, 0.35 + 0.15 * k).map(Math.round) + ',.95)'; x.beginPath(); x.arc(bx + Math.cos(a) * b.s * 0.5, b.y + Math.sin(a) * b.s * 0.5, rr2, 0, 6.283); x.fill(); }
        const g = x.createRadialGradient(bx + b.s * 0.35, b.y - b.s * 0.4, 1, bx + b.s * 0.3, b.y - b.s * 0.3, b.s * 1.05); g.addColorStop(0, 'rgba(' + lit.map(Math.round) + ',.55)'); g.addColorStop(0.5, 'rgba(' + lit.map(Math.round) + ',.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(bx, b.y, b.s, 0, 6.283); x.fill();
      });
    });
    const fade = x.createLinearGradient(0, h * 0.55, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(12,24,14,.55)'); x.fillStyle = fade; x.fillRect(0, 0, w, h);
    return m.c;
  }

  // ---- ground: sunlit grass blades over dark soil, pebbles and roots; tiles in x
  function grass(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, m = make(w, h, dpr), x = m.x, r = rng(o.seed || 21), n = noise((o.seed || 21) + 4);
    const soilTop = hex(o.soilTop || '#7a4f2a'), soilBot = hex(o.soilBot || '#3b2312'), gTop = hex(o.grass || '#7fb23a'), gDark = hex(o.grassDark || '#3f7a26'), gLit = hex(o.grassLit || '#e6ec8a');
    const gh = o.grassH || 16;
    const sg = x.createLinearGradient(0, gh - 4, 0, h); sg.addColorStop(0, 'rgb(' + soilTop.map(Math.round) + ')'); sg.addColorStop(1, 'rgb(' + soilBot.map(Math.round) + ')'); x.fillStyle = sg; x.fillRect(0, gh - 4, w, h);
    // soil strata + pebbles
    for (let i = 0; i < w * 0.9; i++) { const px = r() * w, py = gh + r() * (h - gh), v = n(px * 0.2, py * 0.2); x.fillStyle = v > 0.55 ? 'rgba(255,220,170,' + (0.05 + 0.1 * v) + ')' : 'rgba(0,0,0,' + (0.08 + 0.12 * (1 - v)) + ')'; x.fillRect(px, py, 1 + r() * 2.5, 1 + r() * 1.6); }
    for (let i = 0; i < w / 14; i++) { const px = r() * w, py = gh + 4 + r() * (h - gh - 6), s = 1.5 + r() * 3.2; x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(px + 0.6, py + 1, s, s * 0.7, 0, 0, 6.283); x.fill(); const pg = x.createRadialGradient(px - s * 0.3, py - s * 0.3, 0.3, px, py, s); pg.addColorStop(0, '#d9c6a4'); pg.addColorStop(1, '#6b5638'); x.fillStyle = pg; x.beginPath(); x.ellipse(px, py, s, s * 0.75, 0, 0, 6.283); x.fill(); }
    // grass band: dense blades, lit tips
    const band = x.createLinearGradient(0, 0, 0, gh + 2); band.addColorStop(0, 'rgb(' + mixc(gTop, gLit, 0.35).map(Math.round) + ')'); band.addColorStop(1, 'rgb(' + gDark.map(Math.round) + ')'); x.fillStyle = band; x.fillRect(0, 2, w, gh);
    for (let i = 0; i < w * 1.6; i++) {
      const px = r() * w, hh = 5 + r() * (gh + 4), lean = (r() - 0.5) * 4, t = r();
      x.strokeStyle = 'rgb(' + mixc(gDark, gLit, t * t).map(Math.round) + ')'; x.lineWidth = 1 + r() * 1.2; x.beginPath(); x.moveTo(px, gh + 2); x.quadraticCurveTo(px + lean * 0.4, gh - hh * 0.5, px + lean, gh - hh + 2); x.stroke();
    }
    // dark line where soil meets grass
    x.fillStyle = 'rgba(20,10,0,.35)'; x.fillRect(0, gh + 1, w, 3);
    // tile seam: blend right edge back to left
    return m.c;
  }

  function glow(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
  }
  function vignette(ctx, w, h, a) {
    const g = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75); g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,' + (a == null ? 0.42 : a) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function grain(w, h, a) {
    const c = D.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), img = x.createImageData(w, h), r = rng(5);
    for (let i = 0; i < w * h; i++) { const v = r() * 255; img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = (a == null ? 14 : a); }
    x.putImageData(img, 0, 0); return c;
  }

  G.Art = { rng, noise, make, pipe, pipeCap, ridge, foliage, grass, glow, vignette, grain, hex, mixc, clamp, lerp };
})(window);
