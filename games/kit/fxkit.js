/* fxkit.js: canvas game-feel helpers for the hub's action games (dependency-free, dt in SECONDS).
 *   FX.Shake      trauma-based screen shake (Eiserloh, GDC 2016): offset = maxOffset * trauma^2 * smooth noise
 *   FX.Spring     squash-and-stretch / camera kick spring, volume preserving through FX.squash()
 *   FX.Time       hit-stop (sim dt = 0 for a few ms) and slow-motion, feedback keeps real dt
 *   FX.Particles  ONE fixed pool (no growth ever): circles, stars, confetti squares, feathers, rings
 *   FX.Pops       floating outlined score numbers / words (fixed pool)
 *   FX.ease       outBack / outCubic / inCubic / outElastic / outQuad
 *   FX.haptic(ms) navigator.vibrate where it exists (never on iOS: pair it with sight and sound)
 * Nothing reads the clock, so everything freezes with the arcade SDK pause and steps the same at 30 or 60 fps. */
(function (G) {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  let rm = false; try { rm = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  const c1 = 1.70158, c3 = c1 + 1, c4 = (2 * Math.PI) / 3;
  const ease = {
    outQuad: t => 1 - (1 - t) * (1 - t),
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    outBack: t => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
    outElastic: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  };
  function noise1(x) {
    const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    const h = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
    return lerp(h(i), h(i + 1), s);
  }

  class Shake {
    constructor(o) {
      o = o || {}; this.trauma = 0; this.t = 0; this.decay = o.decay || 1.6; this.maxOffset = o.maxOffset || 14; this.maxAngle = o.maxAngle || 0.03;
      this.x = 0; this.y = 0; this.angle = 0;
    }
    add(a) { this.trauma = clamp(this.trauma + a, 0, 1); }
    update(dt) {
      this.t += dt; this.trauma = Math.max(0, this.trauma - this.decay * dt);
      const s = rm ? 0 : this.trauma * this.trauma, f = this.t * 24;
      this.x = this.maxOffset * s * noise1(f); this.y = this.maxOffset * s * noise1(f + 100); this.angle = this.maxAngle * s * noise1(f + 200);
      return this;
    }
    // Apply around the canvas centre; call ctx.save() before and ctx.restore() after drawing the world.
    apply(ctx, w, h) { if (this.trauma <= 0.001) return; ctx.translate(w / 2 + this.x, h / 2 + this.y); ctx.rotate(this.angle); ctx.translate(-w / 2, -h / 2); }
  }

  class Spring {
    constructor(k, d) { this.k = k || 280; this.d = d || 14; this.x = 0; this.v = 0; }
    punch(x) { this.x = x; }
    impulse(v) { this.v += v; }
    update(dt) {
      dt = Math.min(dt, 1 / 30); const n = 4, h = dt / n;
      for (let i = 0; i < n; i++) { this.v += (-this.k * this.x - this.d * this.v) * h; this.x += this.v * h; }
      return this.x;
    }
  }
  const squash = x => { const sy = Math.max(0.3, 1 + x); return { sx: 1 / sy, sy: sy }; };

  class Time {
    constructor() { this.freeze = 0; this.slow = 0; this.scale = 0.35; }
    hit(ms, slowMs, scale) { this.freeze = Math.max(this.freeze, ms / 1000); this.slow = (slowMs || 0) / 1000; this.scale = scale || 0.35; }
    step(dt) {
      if (this.freeze > 0) { this.freeze -= dt; return 0; }
      if (this.slow > 0) { this.slow -= dt; return dt * this.scale; }
      return dt;
    }
  }

  // ---- particles: a fixed pool. emit() past the cap silently drops, so a long run never grows memory.
  const SHAPES = { circle: 0, star: 1, square: 2, feather: 3, ring: 4 };
  class Particles {
    constructor(max) {
      this.max = max || 160; this.p = [];
      for (let i = 0; i < this.max; i++) this.p.push({ on: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 1, size: 4, c: '#fff', g: 0, shape: 0, rot: 0, vr: 0, drag: 0, grow: 0 });
      this.cursor = 0;
    }
    spawn() {
      for (let k = 0; k < this.max; k++) { const i = (this.cursor + k) % this.max, q = this.p[i]; if (!q.on) { this.cursor = (i + 1) % this.max; return q; } }
      return null;
    }
    // o: n, colors[], speed [min,max], angle [a0,a1] radians (default full circle), life, size [min,max], gravity, shape, drag, grow
    emit(x, y, o) {
      const n = rm ? Math.ceil((o.n || 8) / 3) : (o.n || 8), cols = o.colors || ['#fff'], sp = o.speed || [60, 200], an = o.angle || [0, Math.PI * 2], sz = o.size || [3, 6];
      for (let i = 0; i < n; i++) {
        const q = this.spawn(); if (!q) return;
        const a = an[0] + Math.random() * (an[1] - an[0]), s = sp[0] + Math.random() * (sp[1] - sp[0]);
        q.on = 1; q.x = x + (o.jx ? (Math.random() - 0.5) * o.jx : 0); q.y = y + (o.jy ? (Math.random() - 0.5) * o.jy : 0);
        q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s; q.ttl = (o.life || 0.7) * (0.7 + Math.random() * 0.6); q.life = q.ttl;
        q.size = sz[0] + Math.random() * (sz[1] - sz[0]); q.c = cols[(Math.random() * cols.length) | 0]; q.g = o.gravity == null ? 380 : o.gravity;
        q.shape = SHAPES[o.shape || 'circle'] | 0; q.rot = Math.random() * 6.28; q.vr = (Math.random() - 0.5) * 12; q.drag = o.drag || 0; q.grow = o.grow || 0;
      }
    }
    update(dt) {
      for (let i = 0; i < this.max; i++) {
        const q = this.p[i]; if (!q.on) continue;
        q.life -= dt; if (q.life <= 0) { q.on = 0; continue; }
        if (q.drag) { const k = Math.max(0, 1 - q.drag * dt); q.vx *= k; q.vy *= k; }
        q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.size += q.grow * dt;
      }
    }
    get alive() { for (let i = 0; i < this.max; i++) if (this.p[i].on) return true; return false; }
    clear() { for (let i = 0; i < this.max; i++) this.p[i].on = 0; }
    draw(ctx) {
      for (let i = 0; i < this.max; i++) {
        const q = this.p[i]; if (!q.on) continue;
        const k = q.life / q.ttl; ctx.globalAlpha = k < 0.35 ? k / 0.35 : 1; ctx.fillStyle = q.c; ctx.strokeStyle = q.c;
        if (q.shape === 0) { ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.size * (0.5 + 0.5 * k)), 0, 6.283); ctx.fill(); }
        else if (q.shape === 4) { ctx.lineWidth = 3 * k + 0.5; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, q.size), 0, 6.283); ctx.stroke(); }
        else {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          if (q.shape === 2) ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
          else if (q.shape === 3) { ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.4, 0, 0, 6.283); ctx.fill(); }
          else { ctx.beginPath(); for (let j = 0; j < 10; j++) { const a = -1.5708 + j * 0.62832, r = j % 2 ? q.size * 0.45 : q.size; ctx[j ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- floating words / numbers with a dark outline so they read on any background (fixed pool)
  class Pops {
    constructor(max) { this.max = max || 16; this.p = []; for (let i = 0; i < this.max; i++) this.p.push({ on: 0, x: 0, y: 0, t: 0, ttl: 1, s: '', c: '#fff', size: 22, rise: 46 }); }
    add(x, y, s, o) {
      o = o || {}; let q = null;
      for (let i = 0; i < this.max; i++) if (!this.p[i].on) { q = this.p[i]; break; }
      if (!q) { q = this.p[0]; for (let i = 1; i < this.max; i++) if (this.p[i].t > q.t) q = this.p[i]; }   // recycle the oldest, never grow
      q.on = 1; q.x = x; q.y = y; q.t = 0; q.ttl = o.life || 0.9; q.s = s; q.c = o.color || '#fff'; q.size = o.size || 22; q.rise = o.rise || 46;
    }
    update(dt) { for (let i = 0; i < this.max; i++) { const q = this.p[i]; if (q.on && (q.t += dt) >= q.ttl) q.on = 0; } }
    clear() { for (let i = 0; i < this.max; i++) this.p[i].on = 0; }
    draw(ctx) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (let i = 0; i < this.max; i++) {
        const q = this.p[i]; if (!q.on) continue;
        const k = q.t / q.ttl, pop = k < 0.18 ? ease.outBack(k / 0.18) : 1, a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.globalAlpha = a; ctx.font = '700 ' + Math.round(q.size * (0.5 + 0.5 * pop)) + 'px Fredoka,system-ui,sans-serif';
        const y = q.y - q.rise * ease.outCubic(k);
        ctx.lineWidth = Math.max(3, q.size * 0.22); ctx.strokeStyle = 'rgba(30,20,50,.85)'; ctx.strokeText(q.s, q.x, y);
        ctx.fillStyle = q.c; ctx.fillText(q.s, q.x, y);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  function haptic(ms) { try { if (rm) return; if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {} }

  // Shared drawing helpers so every hub game has the same soft, layered look.
  const art = {
    rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },
    // soft cloud: 5 lobes, a lit top and a cool underside so it has volume
    cloud(ctx, x, y, s, top, bottom, a) {
      const g = ctx.createLinearGradient(0, y - s * 0.6, 0, y + s * 0.5); g.addColorStop(0, top || '#fff'); g.addColorStop(1, bottom || '#dfeaff');
      ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = g; ctx.beginPath();
      ctx.arc(x, y, s * 0.5, 0, 6.283); ctx.arc(x - s * 0.55, y + s * 0.12, s * 0.38, 0, 6.283); ctx.arc(x + s * 0.55, y + s * 0.14, s * 0.4, 0, 6.283);
      ctx.arc(x - s * 0.15, y - s * 0.22, s * 0.36, 0, 6.283); ctx.arc(x + s * 0.28, y - s * 0.16, s * 0.34, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    },
    mix(c1, c2, t) {                                    // '#rrggbb' x '#rrggbb' -> 'rgb(...)'
      const p = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)], a = p(c1), b = p(c2);
      return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
    },
  };

  G.FX = { clamp, lerp, ease, noise1, Shake, Spring, squash, Time, Particles, Pops, haptic, art, rm: () => rm };
})(window);
