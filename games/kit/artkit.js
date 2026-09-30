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
        const ty = py / H, v = n.fbm(px * 0.11, py * 0.045 + 3, 4) * (1 - ty) + n.fbm(px * 0.11, (py - H) * 0.045 + 3, 4) * ty,      // blended with itself one tile up, so the texture repeats without a seam
          streak = n2(px * 0.6, py * 0.02) * (1 - ty) + n2(px * 0.6, (py - H) * 0.02) * ty;
        let pv = clamp((v - 0.5) * 2.4 + (streak - 0.5) * 0.7 + (o.wear == null ? 0.12 : o.wear), 0, 1);
        pv *= 0.55 + 0.45 * Math.abs(u - 0.5) * 2;
        col = mixc(col, mixc(patinaDk, patina, clamp(lit * 1.3, 0, 1)), pv * 0.7);
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

  // ---- mountains / hills: a silhouette from fbm, lit on the slopes that face the low sun (right), shaded on the others,
  // snow along the tops, and a haze that thickens toward the bottom edge. Column-based lighting = no streaks.
  function ridge(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, m = make(w, h, dpr), x = m.x, n = noise(o.seed || 3), rr = rng((o.seed || 3) + 1);
    const amp = o.amp || h * 0.6, base = o.base == null ? h * 0.75 : o.base, sc = o.scale || 0.012, jag = o.jag == null ? 1 : o.jag;
    const top = hex(o.top || '#7d86a8'), bot = hex(o.bot || '#c9a9a0'), lit = hex(o.lit || '#ffd2a0'), shade = hex(o.shade || '#3a2c5a');
    const ys = [], step = 1;
    for (let px = 0; px <= w; px += step) {
      const t = px / w, a = n.fbm(px * sc, 1.3, 5), b = n.fbm((px - w) * sc, 1.3, 5), v = a * (1 - t) + b * t;
      const ridgeV = 1 - Math.abs(v * 2 - 1) * jag;
      ys.push(base - (o.peaky ? ridgeV : v) * amp);
    }
    const fill = x.createLinearGradient(0, base - amp, 0, h); fill.addColorStop(0, 'rgb(' + top.map(Math.round) + ')'); fill.addColorStop(1, 'rgb(' + bot.map(Math.round) + ')');
    x.fillStyle = fill; x.beginPath(); x.moveTo(0, h); ys.forEach((y, i) => x.lineTo(i * step, y)); x.lineTo(w, h); x.closePath(); x.fill();
    x.save(); x.clip();
    const depth = o.litDepth || 70;
    for (let i = 2; i < ys.length - 2; i++) {
      const slope = (ys[i + 2] - ys[i - 2]) / 4;              // > 0: falling to the right = faces the sun
      const k = clamp(slope / 1.6, -1, 1), y0 = ys[i];
      const rgb = k > 0 ? lit : shade, al = Math.abs(k) * (k > 0 ? 0.55 : 0.4);
      if (al < 0.02) continue;
      const g = x.createLinearGradient(0, y0, 0, y0 + depth); g.addColorStop(0, 'rgba(' + rgb.map(Math.round) + ',' + al + ')'); g.addColorStop(1, 'rgba(' + rgb.map(Math.round) + ',0)');
      x.fillStyle = g; x.fillRect(i * step, y0, step + 0.5, depth);
    }
    if (o.snow) {
      const line = base - amp * 0.62;
      x.beginPath(); x.moveTo(0, h); for (let i = 0; i < ys.length; i++) x.lineTo(i * step, ys[i]);
      for (let i = ys.length - 1; i >= 0; i--) { const y = ys[i], d = Math.max(0, line - y) * 0.55 + (y < line ? 5 + 6 * n(i * 0.08, 9) : 0); x.lineTo(i * step, y < line ? y + d : y); }
      x.closePath(); x.fillStyle = 'rgba(255,246,236,.9)'; x.fill();
      x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(' + lit.map(Math.round) + ',.22)'; x.fillRect(0, 0, w, h);
    }
    const hz = x.createLinearGradient(0, base - amp * 0.2, 0, h); hz.addColorStop(0, 'rgba(255,214,170,0)'); hz.addColorStop(1, 'rgba(' + (o.haze || '255,205,160') + ',' + (o.hazeA == null ? 0.55 : o.hazeA) + ')');
    x.globalCompositeOperation = 'source-over'; x.fillStyle = hz; x.fillRect(0, 0, w, h);
    x.restore(); void rr; return m.c;
  }

  // ---- a soft cumulus: many small radial puffs that fade to nothing (no hard circle edges), warm on top, rosy and shaded underneath
  function cloud(w, h, o) {
    o = o || {}; const dpr = o.dpr || 1, m = make(w, h, dpr), x = m.x, r = rng(o.seed || 1), n = o.puffs || 26;
    const litC = o.lit || '255,246,232', midC = o.mid || '255,214,190', shC = o.shade || '196,140,150';
    const puff = (cx, cy, R, ax) => {
      const g = x.createRadialGradient(cx + R * 0.2, cy - R * 0.3, R * 0.05, cx, cy, R);
      g.addColorStop(0, 'rgba(' + litC + ',' + ax + ')'); g.addColorStop(0.45, 'rgba(' + midC + ',' + ax * 0.85 + ')'); g.addColorStop(1, 'rgba(' + shC + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, 6.283); x.fill();
    };
    for (let i = 0; i < n; i++) { const t = i / n, cx = w * 0.12 + r() * w * 0.76, dome = 1 - Math.pow((cx / w - 0.5) * 2, 2), cy = h * 0.72 - dome * h * 0.34 * (0.4 + r() * 0.7), R = h * (0.18 + r() * 0.2) * (0.7 + dome * 0.6); puff(cx, cy, R, 0.9); void t; }
    // flat-ish base: a wide soft ellipse of shade
    x.globalCompositeOperation = 'source-atop'; const g = x.createLinearGradient(0, h * 0.35, 0, h * 0.85); g.addColorStop(0, 'rgba(' + shC + ',0)'); g.addColorStop(1, 'rgba(' + shC + ',' + (o.under == null ? 0.5 : o.under) + ')'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    return m.c;
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


  // ---- time of day: golden hour -> dusk -> night -> dawn, cross-faded from one number (score / distance / level).
  // The sun sits low on the RIGHT, so every lit surface in every game faces right. Cheap: four 4x256 gradient strips,
  // one sun bloom, one moon, two star sheets, all drawn with drawImage.
  const PHASES = [
    { top: '#3a5b94', mid: '#d69a86', bot: '#ffcf8c', tint: null, star: 0, sun: 1, sunY: 0.16, moon: 0 },
    { top: '#232a5c', mid: '#8b4a7c', bot: '#f2825c', tint: '#c7a2c0', star: 0.15, sun: 0.85, sunY: 0.04, moon: 0 },
    { top: '#080e2c', mid: '#1c2a5c', bot: '#3f4d86', tint: '#7a8ec6', star: 1, sun: 0, sunY: 0, moon: 1 },
    { top: '#3a6096', mid: '#eaa4a4', bot: '#ffdcb4', tint: '#ffe6d8', star: 0.1, sun: 0.7, sunY: 0.02, moon: 0 },
  ];
  function Sky(phases) {
    phases = phases || PHASES; const S = { phases, strips: [], sun: null, moon: null, stars: null, tintCache: {} };
    S.build = function (W) {
      S.strips = phases.map(p => { const c = D.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, p.top); g.addColorStop(0.55, p.mid); g.addColorStop(1, p.bot); x.fillStyle = g; x.fillRect(0, 0, 4, 256); return c; });
      const sun = make(320, 320, 1); let g = sun.x.createRadialGradient(160, 160, 0, 160, 160, 160);
      g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.08, 'rgba(255,238,190,.95)'); g.addColorStop(0.2, 'rgba(255,200,120,.5)'); g.addColorStop(0.5, 'rgba(255,150,80,.16)'); g.addColorStop(1, 'rgba(255,120,60,0)');
      sun.x.fillStyle = g; sun.x.fillRect(0, 0, 320, 320); S.sun = sun.c;
      const moon = make(120, 120, 1); g = moon.x.createRadialGradient(60, 60, 8, 60, 60, 60); g.addColorStop(0, 'rgba(210,225,255,.5)'); g.addColorStop(1, 'rgba(120,150,255,0)'); moon.x.fillStyle = g; moon.x.fillRect(0, 0, 120, 120);
      g = moon.x.createRadialGradient(54, 54, 2, 60, 60, 20); g.addColorStop(0, '#fffef2'); g.addColorStop(1, '#c9d3ea'); moon.x.fillStyle = g; moon.x.beginPath(); moon.x.arc(60, 60, 19, 0, 6.283); moon.x.fill();
      moon.x.fillStyle = 'rgba(120,130,170,.28)'; [[52, 54, 4.5], [67, 62, 3.4], [58, 70, 2.6]].forEach(k => { moon.x.beginPath(); moon.x.arc(k[0], k[1], k[2], 0, 6.283); moon.x.fill(); }); S.moon = moon.c;
      const st = make(W, 520, 1), r = rng(9); for (let i = 0; i < 90; i++) { const a = 0.35 + r() * 0.65, sz = r() < 0.12 ? 1.8 : 0.9; st.x.fillStyle = 'rgba(255,250,235,' + a + ')'; st.x.beginPath(); st.x.arc(r() * W, r() * 470, sz, 0, 6.283); st.x.fill(); } S.stars = st.c;
      S.W = W; return S;
    };
    S.phase = function (p) { const i = Math.floor(p) % phases.length, f = p - Math.floor(p), k = f < 0.7 ? 0 : (f - 0.7) / 0.3; return { a: i, b: (i + 1) % phases.length, k: k * k * (3 - 2 * k) }; };
    // Draws sky, stars, sun/moon into [0..groundY]. p = look value (score / pipes-per-phase).
    S.draw = function (ctx, W, groundY, p, t) {
      const ph = S.phase(p), A = phases[ph.a], B = phases[ph.b], k = ph.k;
      ctx.drawImage(S.strips[ph.a], 0, 0, W, groundY); if (k > 0) { ctx.globalAlpha = k; ctx.drawImage(S.strips[ph.b], 0, 0, W, groundY); ctx.globalAlpha = 1; }
      const star = lerp(A.star, B.star, k);
      if (star > 0.02) { ctx.globalAlpha = star * (0.75 + 0.25 * Math.sin(t * 2.2)); ctx.drawImage(S.stars, 0, 0, W, 520); ctx.globalAlpha = star * 0.5 * (0.5 + 0.5 * Math.sin(t * 3.1 + 1)); ctx.drawImage(S.stars, 30, 20, W, 520); ctx.globalAlpha = 1; }
      const sunA = lerp(A.sun, B.sun, k), sunY = groundY - 90 - lerp(A.sunY, B.sunY, k) * 900 - 20;
      if (sunA > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sunA; ctx.drawImage(S.sun, W * 0.8 - 130, sunY - 130, 260, 260); ctx.restore(); }
      const moonA = lerp(A.moon, B.moon, k); if (moonA > 0.02) { ctx.globalAlpha = moonA; ctx.drawImage(S.moon, W - 150, 110, 100, 100); ctx.globalAlpha = 1; }
      ph.star = star; ph.sunY = sunY; return ph;
    };
    // multiply colour for everything on the land (null = no grade, i.e. golden hour)
    S.tint = function (ph) {
      const A = phases[ph.a], B = phases[ph.b]; if (!A.tint && !B.tint) return null;
      const wh = '#ffffff', a = A.tint || wh, b = B.tint || wh, key = a + b + Math.round(ph.k * 20);
      return S.tintCache[key] || (S.tintCache[key] = 'rgb(' + mixc(hex(a), hex(b), ph.k).map(Math.round) + ')');
    };
    return S;
  }

  G.Art = { Sky, PHASES, cloud, rng, noise, make, pipe, pipeCap, ridge, foliage, grass, glow, vignette, grain, hex, mixc, clamp, lerp };
})(window);
