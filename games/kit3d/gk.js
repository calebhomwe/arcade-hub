/* gk.js: "Game Kit" behaviour for the 3D arcade games (see gk.css for the look).
 * No dependencies. Everything here is safe to call when storage, vibration or animations are missing.
 *
 *   import { GK } from './kit3d/gk.js';
 *   GK.icon('star', 28)                          SVG string (star coin gem lock pause play replay home snd sndOff trophy crown flame
 *                                                 shield magnet check chevL chevR clock bolt gift flag cog bag heart hand)
 *   const P = GK.progress('helix-smash', {perWorld:10, worlds:[{name, ...}], skins:[{id,name,css,cost:0|{coins}|{stars}|{level}|{streak}|{days}}],
 *                                          daily:[{id, icon, text:n=>'Collect '+n+' gems', targets:[15,25,40]}]})
 *   P.d                                          the saved data {coins, level, stars:{lvl:n}, skin, owned:[], days:[], daily:{...}}
 *   P.finishLevel(level, stars, coins)           -> {prev, best, gained, newSkins:[...], nextLevel}
 *   P.addDaily('gems', 3)                        -> true the moment today's goal completes (coins are paid)
 *   GK.stars(el, n, {animate})  GK.countUp(el, to)  GK.pop(x,y,'+5',{color})  GK.confetti(x,y,n)  GK.fly(from,toEl,n)  GK.toast(html)
 *   GK.shop({prog, preview, onEquip})            skins sheet;  GK.levelPicker(el, prog, opts);  GK.dailyStrip(prog);  GK.levelBar(el)
 * Saves live under one key per game: '<id>-prog-v1' (declare it in the game's meta "saves"). */
const INK = '#211447';
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const hooks = { sfx: () => {} };
const p2 = n => (n < 10 ? '0' : '') + n;
const iso = (d = new Date()) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- icons: cartoon SVG, 24x24, ink outline ---------- */
function starPts(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2); }
  return d + 'Z';
}
const S = 'stroke="' + INK + '" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"';
const STAR = starPts(12, 12.8, 10, 4.5);
const ICONS = {
  star: '<path d="' + STAR + '" fill="#ffd23f" ' + S + '/><path d="M8.3 9.2l1.6-3" stroke="#fff8c9" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  starOff: '<path d="' + STAR + '" fill="#8a7bc0" ' + S + '/>',
  coin: '<circle cx="12" cy="12" r="10" fill="#ffd23f" ' + S + '/><circle cx="12" cy="12" r="6.4" fill="#ffb31f" stroke="#c77600" stroke-width="1.2"/><path d="' + starPts(12, 12.2, 3.9, 1.7) + '" fill="#fff2a8"/><path d="M5.6 8.4a7.6 7.6 0 013.2-3.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  gem: '<path d="M12 22L2.4 9.6 6.4 3h11.2l4 6.6z" fill="#3fdcff" ' + S + '/><path d="M2.4 9.6h19.2M9.2 3L7.6 9.6 12 22M14.8 3l1.6 6.6L12 22" stroke="#bff6ff" stroke-width="1.2" fill="none" stroke-linejoin="round"/><path d="M6.2 9.6L9.2 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  lock: '<path d="M7.6 10.5V7.6a4.4 4.4 0 018.8 0v2.9" fill="none" stroke="' + INK + '" stroke-width="4.4" stroke-linecap="round"/><path d="M7.6 10.5V7.6a4.4 4.4 0 018.8 0v2.9" fill="none" stroke="#dcd4f5" stroke-width="2" stroke-linecap="round"/><rect x="4.6" y="10.2" width="14.8" height="11.2" rx="3" fill="#ffc12e" ' + S + '/><circle cx="12" cy="15" r="1.8" fill="' + INK + '"/><rect x="11.2" y="15.5" width="1.6" height="3.2" rx=".8" fill="' + INK + '"/>',
  pause: '<rect x="5.2" y="4.2" width="5" height="15.6" rx="1.8" fill="#fff" ' + S + '/><rect x="13.8" y="4.2" width="5" height="15.6" rx="1.8" fill="#fff" ' + S + '/>',
  play: '<path d="M7 3.8v16.4a1 1 0 001.5.9l13-8.2a1 1 0 000-1.7l-13-8.2A1 1 0 007 3.8z" fill="#fff" ' + S + '/>',
  replay: '<path d="M19.5 12a7.5 7.5 0 11-2.4-5.5" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M19.5 12a7.5 7.5 0 11-2.4-5.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M20.6 2.6v6.6h-6.6z" fill="#fff" ' + S + '/>',
  home: '<path d="M3.2 12L12 3.6 20.8 12" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.4 11.2V20a1 1 0 001 1h3.9v-6h3.4v6h3.9a1 1 0 001-1v-8.8L12 5z" fill="#fff" ' + S + '/><path d="M3.2 12L12 3.6 20.8 12" fill="none" stroke="#ff6b6b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  snd: '<path d="M3.5 9.4h3.6L12 5v14l-4.9-4.4H3.5z" fill="#fff" ' + S + '/><path d="M15.4 8.6a4.8 4.8 0 010 6.8M18 5.8a8.6 8.6 0 010 12.4" fill="none" stroke="' + INK + '" stroke-width="4.6" stroke-linecap="round"/><path d="M15.4 8.6a4.8 4.8 0 010 6.8M18 5.8a8.6 8.6 0 010 12.4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  sndOff: '<path d="M3.5 9.4h3.6L12 5v14l-4.9-4.4H3.5z" fill="#fff" ' + S + '/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="' + INK + '" stroke-width="4.6" stroke-linecap="round"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>',
  trophy: '<path d="M7 4h10v6.2a5 5 0 01-10 0z" fill="#ffd23f" ' + S + '/><path d="M7 6H3.6c0 3.2 1.4 5 3.9 5.4M17 6h3.4c0 3.2-1.4 5-3.9 5.4" fill="none" ' + S + '/><rect x="10.4" y="14.8" width="3.2" height="3.4" fill="#ffb31f" ' + S + '/><rect x="7" y="18.2" width="10" height="3.2" rx="1.4" fill="#ffc12e" ' + S + '/><path d="M9.4 6.2v3.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  crown: '<path d="M3 8l4.6 4.4L12 5l4.4 7.4L21 8l-1.8 11H4.8z" fill="#ffd23f" ' + S + '/><circle cx="3" cy="7.6" r="1.5" fill="#ff6b6b" ' + S + '/><circle cx="12" cy="4.6" r="1.5" fill="#6cc4ff" ' + S + '/><circle cx="21" cy="7.6" r="1.5" fill="#5cec8c" ' + S + '/>',
  flame: '<path d="M12 2.4c.6 3.4 4.8 5.4 4.8 10.4A4.8 4.8 0 0112 17.6a4.8 4.8 0 01-4.8-4.8c0-1.8.8-3 1.6-4 .2 1.6 1 2.2 1.8 2.4C10.2 8 11 5 12 2.4z" fill="#ff8a1c" ' + S + '/><path d="M12 22c-3.4 0-5.6-2.2-5.6-5 0-1.4.8-2.6 1.6-3.4.2 1.6 1.4 2.4 2.4 2.6-.4-1.4.2-3 1.6-4.4 0 2 2.2 3.2 3.6 5 .2 2.8-1.8 5.2-3.6 5.2z" fill="#ffd23f" ' + S + '/>',
  shield: '<path d="M12 2.6l8 2.8v6.2c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V5.4z" fill="#3fdcff" ' + S + '/><path d="M12 5.4v14.4c3-1.2 5.4-3.6 5.4-8.2V7.2z" fill="#1aa6cf" opacity=".5"/><path d="M7.4 7.4l2.6-1" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  magnet: '<path d="M4.4 20.6V11a7.6 7.6 0 0115.2 0v9.6h-4.8V11a2.8 2.8 0 00-5.6 0v9.6z" fill="#ff5a6e" ' + S + '/><rect x="4.4" y="16.4" width="4.8" height="4.2" fill="#e8f0ff" ' + S + '/><rect x="14.8" y="16.4" width="4.8" height="4.2" fill="#e8f0ff" ' + S + '/>',
  check: '<path d="M4.6 12.8l4.8 4.8 10-11" fill="none" stroke="' + INK + '" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.6 12.8l4.8 4.8 10-11" fill="none" stroke="#5cec8c" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevL: '<path d="M15 4.6L7.4 12 15 19.4" fill="none" stroke="' + INK + '" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 4.6L7.4 12 15 19.4" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  chevR: '<path d="M9 4.6l7.6 7.4L9 19.4" fill="none" stroke="' + INK + '" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 4.6l7.6 7.4L9 19.4" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12.6" r="9" fill="#fff" ' + S + '/><path d="M12 7v6l3.8 2.2" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="1.6" width="4" height="2.4" rx="1" fill="#ff6b6b" ' + S + '/>',
  bolt: '<path d="M13.6 2L4.6 13.4h6L9.4 22l9-11.6h-6z" fill="#ffd23f" ' + S + '/>',
  gift: '<rect x="3.4" y="9.4" width="17.2" height="11.6" rx="2" fill="#ff6b6b" ' + S + '/><rect x="2.4" y="6.4" width="19.2" height="4.6" rx="1.6" fill="#ff8f8f" ' + S + '/><path d="M12 6.4V21" stroke="' + INK + '" stroke-width="1.7"/><rect x="10.6" y="6.4" width="2.8" height="14.6" fill="#ffd23f"/><path d="M12 6.4C9.4 6.4 7 5 7.6 3.4 8.6 1.6 11.2 3.4 12 6.4zM12 6.4c2.6 0 5-1.4 4.4-3-1-1.8-3.6 0-4.4 3z" fill="#ffd23f" ' + S + '/>',
  flag: '<path d="M5.4 21.6V3.2" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/><path d="M5.4 21.6V3.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M6.4 4.2h13l-3.2 4 3.2 4h-13z" fill="#ff5a6e" ' + S + '/>',
  cog: '<path d="M10.2 2.6h3.6l.6 2.6 1.9.8 2.3-1.4 2.5 2.5-1.4 2.3.8 1.9 2.6.6v3.6l-2.6.6-.8 1.9 1.4 2.3-2.5 2.5-2.3-1.4-1.9.8-.6 2.6h-3.6l-.6-2.6-1.9-.8-2.3 1.4-2.5-2.5 1.4-2.3-.8-1.9-2.6-.6v-3.6l2.6-.6.8-1.9-1.4-2.3 2.5-2.5 2.3 1.4 1.9-.8z" fill="#c9bdf3" ' + S + ' transform="translate(0 -.4) scale(.98)"/><circle cx="12" cy="12.2" r="3.4" fill="#5c4ea3" ' + S + '/>',
  bag: '<path d="M6.6 8.6h10.8l1.6 12.4a1 1 0 01-1 1.1H6a1 1 0 01-1-1.1z" fill="#ff8a1c" ' + S + '/><path d="M8.8 10.4V7.2a3.2 3.2 0 016.4 0v3.2" fill="none" ' + S + '/><path d="M8 12.4l.4 6" stroke="#ffd9a0" stroke-width="1.8" stroke-linecap="round"/>',
  heart: '<path d="M12 21C5 15.6 2.6 12 2.6 8.4A4.8 4.8 0 0112 6.4a4.8 4.8 0 019.4 2c0 3.6-2.4 7.2-9.4 12.6z" fill="#ff5a6e" ' + S + '/><path d="M6 8.4a3 3 0 012.4-2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  hand: '<path d="M9.2 12.6V4.6a1.9 1.9 0 013.8 0v6.2l5.4 1.2a2.2 2.2 0 011.7 2.6l-.9 5.2A3.4 3.4 0 0116 22.4H12a3.6 3.6 0 01-2.9-1.5L5.6 16a1.7 1.7 0 012.6-2.1z" fill="#fff" ' + S + '/><path d="M13 10.8v2.6M15.6 11.6v2M18.2 12.4v1.4" stroke="' + INK + '" stroke-width="1.3" stroke-linecap="round" fill="none" opacity=".55"/>',
  ball: '<circle cx="12" cy="12" r="9.6" fill="#ffc12e" ' + S + '/><path d="M6.2 8.4a6.8 6.8 0 013.4-3" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>',
};
function icon(name, px) {
  const b = ICONS[name] || ICONS.star;
  const s = px ? ' width="' + px + '" height="' + px + '"' : '';
  return '<svg viewBox="0 0 24 24"' + s + ' aria-hidden="true" focusable="false">' + b + '</svg>';
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

/* ---------- small helpers ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
let hapticLabel = null;
function haptic(ms) {
  try {
    if (RM) return;
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(ms || 10); return; }
    if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      if (!hapticLabel) {   // a native <input switch> click from a gesture taps the Taptic Engine on iOS 17.4+
        hapticLabel = el('label'); hapticLabel.setAttribute('aria-hidden', 'true');
        hapticLabel.style.cssText = 'position:fixed;left:-99px;top:-99px;width:1px;height:1px;opacity:.01;overflow:hidden;pointer-events:none';
        const i = el('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; hapticLabel.appendChild(i); document.body.appendChild(hapticLabel);
      }
      hapticLabel.click();
    }
  } catch (e) {}
}
function countUp(node, to, ms = 700, fmt) {
  const f = fmt || (v => String(v));
  if (RM || !node || ms <= 0) { if (node) node.textContent = f(to); return; }
  const from = 0, t0 = performance.now();
  (function step(now) {
    const k = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
    node.textContent = f(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
function pop(x, y, text, o = {}) {
  const root = document.body; if (!root) return;
  const e = el('div', 'gk-pop gk-out'); e.textContent = text;
  e.style.color = o.color || '#fff'; if (o.size) e.style.fontSize = o.size + 'px';
  e.style.left = x + 'px'; e.style.top = y + 'px';
  root.appendChild(e);
  const kill = () => e.remove();
  if (!e.animate || RM) { e.style.transform = 'translate(-50%,-90%)'; setTimeout(kill, o.ms || 700); return; }
  const a = e.animate([
    { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%,-90%) scale(1.25)', opacity: 1, offset: .22 },
    { transform: 'translate(-50%,-140%) scale(1)', opacity: 1, offset: .6 },
    { transform: 'translate(-50%,-230%) scale(.95)', opacity: 0 },
  ], { duration: o.ms || 800, easing: 'cubic-bezier(.2,.8,.3,1)' });
  a.onfinish = kill; a.oncancel = kill;
}

/* confetti and star bursts on one lazily created canvas; it stops drawing when nothing is left */
let fx = null, fxParts = [], fxRun = false;
function fxEnsure() {
  if (fx) return fx;
  const c = el('canvas', 'gk-fx'); document.body.appendChild(c);
  fx = { c, g: c.getContext('2d'), w: 0, h: 0, dpr: 1 };
  return fx;
}
function fxSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  if (fx.w !== w || fx.h !== h) { fx.w = w; fx.h = h; fx.dpr = dpr; fx.c.width = Math.round(w * dpr); fx.c.height = Math.round(h * dpr); }
}
function confetti(x, y, n = 40, o = {}) {
  if (RM) return;
  fxEnsure(); fxSize();
  const cols = o.colors || ['#ffd23f', '#ff5a6e', '#5cec8c', '#6cc4ff', '#b48bff', '#ff8a1c'];
  const cap = o.cap || 150;
  for (let i = 0; i < n && fxParts.length < cap; i++) {
    const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 1.4), s = (o.speed || 520) * (0.4 + Math.random() * 0.7);
    fxParts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], t: 0, life: 1.1 + Math.random() * 0.9 });
  }
  if (!fxRun) { fxRun = true; let last = performance.now(); requestAnimationFrame(function loop(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; fxStep(dt); if (fxParts.length) requestAnimationFrame(loop); else fxRun = false; }); }
}
function fxStep(dt) {
  fxSize(); const g = fx.g; g.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0); g.clearRect(0, 0, fx.w, fx.h);
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i]; p.t += dt;
    if (p.t > p.life || p.y > fx.h + 40) { fxParts[i] = fxParts[fxParts.length - 1]; fxParts.pop(); continue; }
    p.vy += 980 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = clamp((p.life - p.t) * 2.5, 0, 1);
    g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
  }
}
/* coins (or any icon) that arc from a point to a counter */
function fly(from, toEl, n = 6, name = 'coin', onLand) {
  if (!toEl) return;
  const tr = toEl.getBoundingClientRect(), p1 = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  const p0 = from && from.getBoundingClientRect ? (r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }))(from.getBoundingClientRect()) : from;
  n = Math.min(n, 12);
  for (let i = 0; i < n; i++) {
    const e = el('div', 'gk-coinfly', icon(name)); document.body.appendChild(e);
    const sx = p0.x + (Math.random() - 0.5) * 60, sy = p0.y + (Math.random() - 0.5) * 30;
    const done = () => { e.remove(); if (onLand) onLand(i, n); };
    if (!e.animate || RM) { setTimeout(done, 200 + i * 40); e.style.transform = 'translate(' + p1.x + 'px,' + p1.y + 'px)'; continue; }
    const mx = (sx + p1.x) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, p1.y) - 70 - Math.random() * 40;
    const a = e.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(.3)', opacity: 0 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1.1)', opacity: 1, offset: .4 },
      { transform: 'translate(' + p1.x + 'px,' + p1.y + 'px) scale(.7)', opacity: 1 },
    ], { duration: 650 + Math.random() * 150, delay: i * 55, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'backwards' });
    a.onfinish = done; a.oncancel = done;
  }
}
function toast(html, o = {}) {
  let host = document.querySelector('.gk-toasts');
  if (!host) { host = el('div', 'gk-toasts gk'); document.body.appendChild(host); }
  const t = el('div', 'gk-toast', (o.icon ? icon(o.icon) : '') + '<div>' + html + '</div>');
  while (host.children.length > 2) host.firstChild.remove();
  host.appendChild(t); setTimeout(() => t.remove(), o.ms || 3300);
  hooks.sfx('levelup'); haptic(20);
}

/* three stars; `animate` pops the earned ones in one after another */
function stars(node, n, o = {}) {
  node.innerHTML = '';
  for (let i = 0; i < 3; i++) node.insertAdjacentHTML('beforeend', icon(i < n ? 'star' : 'starOff'));
  const kids = node.querySelectorAll('svg');
  if (!o.animate) return;
  kids.forEach((s, i) => { if (i < n) { s.style.opacity = '0'; } else s.classList.add('off'); });
  for (let i = 0; i < n; i++) {
    setTimeout(() => { kids[i].style.opacity = ''; kids[i].classList.add('pop'); hooks.sfx('coin'); haptic(12); if (o.onStar) o.onStar(i, kids[i]); }, (o.delay || 350) + i * 420);
  }
}

/* level bar: [n] ====== [n+1]; marks([f1,f2,1]) puts stars on the track that light up as the bar passes them */
function levelBar(host, o = {}) {
  host.innerHTML = '<div class="gk-lvl"><div class="bub cur"></div><div class="trkw"><div class="trk"><div class="fil"></div></div><div class="mk"></div></div><div class="bub nx"></div></div>';
  const q = s => host.querySelector(s), cur = q('.cur'), nx = q('.nx'), fil = q('.fil'), trk = q('.trk'), mk = q('.mk');
  let last = 0;
  const api = {
    set(f) {
      f = clamp(f, 0, 1); fil.style.width = (f * 100).toFixed(1) + '%';
      for (const i of mk.children) {
        const on = f >= +i.dataset.f - 1e-6;
        if (on !== i.classList.contains('on')) { i.classList.toggle('on', on); i.innerHTML = icon(on ? 'star' : 'starOff'); if (on && f >= last) { i.classList.add('pop'); if (api.onMark) api.onMark(+i.dataset.f); } }
      }
      last = f;
    },
    levels(a, b) { cur.textContent = a; nx.textContent = b == null ? a + 1 : b; },
    end(html) { nx.innerHTML = html; },
    marks(fr) { mk.innerHTML = ''; last = 0; for (const f of fr) { const i = el('i', 'm', icon('starOff')); i.style.left = (f * 100) + '%'; i.dataset.f = f; mk.appendChild(i); } },
    ticks(fr) { trk.querySelectorAll('.tick').forEach(t => t.remove()); for (const f of fr) { const t = el('i', 'tick'); t.style.left = (f * 100) + '%'; trk.appendChild(t); } },
    done(v) { cur.classList.toggle('done', !!v); },
    onMark: null,
  };
  return api;
}

/* ---------- progression ---------- */
const mul = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hstr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

class Progress {
  constructor(id, cfg) {
    this.id = id; this.cfg = cfg; this.key = id + '-prog-v1';
    const first = cfg.skins && cfg.skins[0] ? cfg.skins[0].id : '';
    const def = { coins: 0, level: 1, stars: {}, skin: first, owned: first ? [first] : [], days: [], daily: { date: '', id: '', target: 0, val: 0, done: false }, totals: {}, seen: {} };
    const got = store.get(this.key, null);
    this.d = Object.assign(def, got && typeof got === 'object' ? got : {});
    if (!this.d.daily) this.d.daily = def.daily;
    this.newSkins = [];
    this.touchDay();
    this.refreshUnlocks();
    this.pickDaily();
  }
  save() { if (!(window.ArcadeSDK && window.ArcadeSDK.cheated)) store.set(this.key, this.d); }
  get cheated() { return !!(window.ArcadeSDK && window.ArcadeSDK.cheated); }
  totalStars() { let n = 0; for (const k in this.d.stars) n += this.d.stars[k] | 0; return n; }
  starsFor(l) { return this.d.stars[l] | 0; }
  maxLevel() { return this.d.level; }
  worldIndex(level) { return Math.floor((level - 1) / (this.cfg.perWorld || 10)); }
  world(level) { const w = this.cfg.worlds || [{ name: 'World' }]; const i = this.worldIndex(level); return Object.assign({ index: i, num: i + 1 }, w[i % w.length]); }
  /* days and streaks: playing at all today counts */
  touchDay() {
    const t = iso();
    if (!this.d.days.includes(t)) { this.d.days.push(t); if (this.d.days.length > 90) this.d.days.shift(); this.save(); }
  }
  streak() {
    const set = new Set(this.d.days); let n = 0; const d = new Date();
    if (!set.has(iso(d))) d.setDate(d.getDate() - 1);
    while (set.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  bestStreak() {
    const a = [...new Set(this.d.days)].sort(); let best = 0, run = 0, prev = null;
    for (const s of a) { run = prev && dayDiff(prev, s) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = s; }
    return best;
  }
  week() {   // Monday-first stamps for this week, and no shame: a missed day just stays empty
    const t = new Date(), dow = (t.getDay() + 6) % 7, set = new Set(this.d.days), out = [];
    for (let i = 0; i < 7; i++) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow + i); out.push({ on: set.has(iso(d)), today: i === dow }); }
    return out;
  }
  /* skins */
  skin(id) { return (this.cfg.skins || []).find(s => s.id === id); }
  current() { return this.skin(this.d.skin) || (this.cfg.skins || [])[0]; }
  req(s) {
    const c = s.cost;
    if (!c) return { free: true, text: 'Free' };
    if (c.stars) return { free: this.totalStars() >= c.stars, text: c.stars + ' stars', icon: 'star', have: this.totalStars(), need: c.stars };
    if (c.level) return { free: this.d.level >= c.level, text: 'Reach level ' + c.level, icon: 'flag' };
    if (c.streak) return { free: this.bestStreak() >= c.streak, text: 'Play ' + c.streak + ' days in a row', icon: 'flame' };
    if (c.days) return { free: new Set(this.d.days).size >= c.days, text: 'Play on ' + c.days + ' days', icon: 'flame' };
    if (c.coins) return { free: false, coins: c.coins, text: String(c.coins), icon: 'coin' };
    return { free: true, text: 'Free' };
  }
  refreshUnlocks() {
    const fresh = [];
    for (const s of this.cfg.skins || []) {
      if (this.d.owned.includes(s.id)) continue;
      const r = this.req(s);
      if (r.free && !r.coins) { this.d.owned.push(s.id); fresh.push(s); }
    }
    if (fresh.length) { this.newSkins.push(...fresh); this.save(); }
    return fresh;
  }
  owns(id) { return this.d.owned.includes(id); }
  canBuy(s) { const r = this.req(s); return !!r.coins && this.d.coins >= r.coins && !this.owns(s.id); }
  buy(id) {
    const s = this.skin(id); if (!s || this.owns(id)) return false;
    const r = this.req(s); if (!r.coins || this.d.coins < r.coins) return false;
    this.d.coins -= r.coins; this.d.owned.push(id); this.d.skin = id; this.save(); return true;
  }
  equip(id) { if (this.owns(id)) { this.d.skin = id; this.save(); return true; } return false; }
  takeNewSkins() { const a = this.newSkins; this.newSkins = []; return a; }
  /* levels */
  finishLevel(level, nStars, coins) {
    const prev = this.starsFor(level);
    if (!this.cheated) {
      this.d.stars[level] = Math.max(prev, nStars);
      if (level >= this.d.level) this.d.level = level + 1;
      this.d.coins += coins | 0;
      this.d.totals.levels = (this.d.totals.levels | 0) + 1;
      this.save();
    }
    const fresh = this.cheated ? [] : this.refreshUnlocks();
    return { prev, best: this.starsFor(level), gained: Math.max(0, nStars - prev), newSkins: fresh, nextLevel: level + 1 };
  }
  addCoins(n) { if (this.cheated || !n) return; this.d.coins += n | 0; this.save(); }
  bump(k, n = 1) { if (this.cheated) return; this.d.totals[k] = (this.d.totals[k] | 0) + n; }
  /* daily goal: same for everyone on a given date, no server */
  pickDaily() {
    const list = this.cfg.daily; if (!list || !list.length) return null;
    const t = iso(); if (this.d.daily.date === t) return this.d.daily;
    const r = mul(hstr(this.id + '|' + t)), g = list[Math.floor(r() * list.length)], target = g.targets[Math.floor(r() * g.targets.length)];
    this.d.daily = { date: t, id: g.id, target, val: 0, done: false }; this.save(); return this.d.daily;
  }
  dailyInfo() {
    const list = this.cfg.daily; if (!list) return null;
    const d = this.pickDaily(), g = list.find(x => x.id === d.id) || list[0];
    return { id: d.id, text: g.text(d.target), icon: g.icon || 'star', val: Math.min(d.val, d.target), target: d.target, done: d.done, reward: this.cfg.dailyReward || 60 };
  }
  addDaily(id, n = 1) {
    if (this.cheated) return false;
    const d = this.pickDaily(); if (!d || d.done || d.id !== id) return false;
    d.val += n;
    if (d.val >= d.target) { d.done = true; d.val = d.target; this.d.coins += this.cfg.dailyReward || 60; this.save(); return true; }
    this.save(); return false;
  }
}

/* ---------- ready-made pieces ---------- */
function stripHTML(P) {
  const i = P.dailyInfo(); if (!i) return '';
  return '<div class="gk-daily' + (i.done ? ' done' : '') + '">' + icon(i.done ? 'check' : i.icon) + '<div class="tx"><b>' + (i.done ? 'Daily goal done!' : 'Daily goal') + '</b>' + i.text + '<div class="pb"><i style="width:' + Math.round(i.val / i.target * 100) + '%"></i></div></div>' +
    '<div class="rw">' + (i.done ? '' : '+' + i.reward + icon('coin')) + '</div></div>';
}
function dailyStrip(P) { const d = el('div'); d.innerHTML = stripHTML(P); return d.firstElementChild || d; }
function weekRow(P) {
  const w = el('div', 'gk-week'); w.setAttribute('aria-label', 'This week');
  w.innerHTML = P.week().map(x => '<i class="' + (x.on ? 'on' : '') + '">' + (x.on ? icon('check') : '') + '</i>').join('');
  return w;
}
/* level picker: < LEVEL 7 > with the world name underneath */
function levelPicker(host, P, o = {}) {
  host.classList.add('gk-pick'); host.innerHTML = '<button type="button" class="gk-ib" aria-label="Previous level">' + icon('chevL') + '</button><div class="mid"><div class="lv gk-out"></div><div class="gk-stars mini"></div><div class="wn"></div></div><button type="button" class="gk-ib" aria-label="Next level">' + icon('chevR') + '</button>';
  const [pv, , nx] = [host.children[0], host.children[1], host.children[2]], lv = host.querySelector('.lv'), st = host.querySelector('.gk-stars'), wn = host.querySelector('.wn');
  const S = { level: Math.min(P.d.level, o.start || P.d.level) };
  function paint() {
    S.level = clamp(S.level, 1, P.d.level);
    lv.textContent = 'Level ' + S.level; stars(st, P.starsFor(S.level)); wn.textContent = 'World ' + P.world(S.level).num + ' · ' + P.world(S.level).name;
    pv.disabled = S.level <= 1; nx.disabled = S.level >= P.d.level;
    if (o.onChange) o.onChange(S.level);
  }
  pv.addEventListener('click', () => { S.level--; hooks.sfx('tap'); paint(); });
  nx.addEventListener('click', () => { S.level++; hooks.sfx('tap'); paint(); });
  S.set = n => { S.level = n; paint(); }; S.paint = paint; paint();
  return S;
}
/* skins sheet */
function shop(o) {
  const P = o.prog, sheet = el('div', 'gk-sheet gk'), pan = el('div', 'pan');
  sheet.appendChild(pan);
  pan.innerHTML = '<div class="top"><h3>' + (o.title || 'Skins') + '</h3><div style="display:flex;gap:8px;align-items:center"><span class="gk-chip"></span><button type="button" class="gk-ib" aria-label="Close">' + icon('chevR').replace('chevR', 'x') + '</button></div></div><div class="grid"></div>';
  const grid = pan.querySelector('.grid'), chip = pan.querySelector('.gk-chip'), close = pan.querySelector('button.gk-ib');
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="' + INK + '" stroke-width="5.4" stroke-linecap="round"/><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
  function paint() {
    chip.innerHTML = icon('coin') + '<b>' + P.d.coins + '</b>';
    grid.innerHTML = '';
    for (const s of P.cfg.skins) {
      const owned = P.owns(s.id), on = P.d.skin === s.id, r = P.req(s), can = !owned && P.canBuy(s);
      const t = el('button', 'gk-tile' + (on ? ' on' : owned ? '' : can ? ' can lock' : ' lock'));
      t.type = 'button';
      const sw = o.preview ? o.preview(s) : '<div class="sw" style="background:' + (s.css || '#ffc12e') + '"></div>';
      let st;
      if (on) st = icon('check') + 'In use';
      else if (owned) st = 'Tap to use';
      else if (r.coins) st = icon('coin') + r.coins;
      else st = icon(r.icon || 'lock') + r.text;
      t.innerHTML = sw + (owned ? '' : '<svg class="lk" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.lock + '</svg>') + '<div class="nm">' + s.name + '</div><div class="st">' + st + '</div>';
      t.addEventListener('click', () => {
        if (owned) { P.equip(s.id); hooks.sfx('tap'); haptic(8); if (o.onEquip) o.onEquip(s); paint(); }
        else if (can) { if (P.buy(s.id)) { hooks.sfx('levelup'); haptic(25); confetti(innerWidth / 2, innerHeight * 0.4, 40); if (o.onEquip) o.onEquip(s); if (o.onBuy) o.onBuy(s); paint(); } }
        else { hooks.sfx('buzz'); t.animate && t.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 }); }
      });
      grid.appendChild(t);
    }
  }
  const shut = () => { sheet.remove(); if (o.onClose) o.onClose(); };
  close.addEventListener('click', () => { hooks.sfx('tap'); shut(); });
  sheet.addEventListener('click', e => { if (e.target === sheet) shut(); });
  paint(); document.body.appendChild(sheet);
  return { close: shut, paint };
}
function coach(html, o = {}) {
  const c = el('div', 'gk gk-coach' + (o.drag ? ' drag' : ''), '<div class="hand">' + icon('hand') + '</div><div class="tx">' + html + '</div>');
  document.body.appendChild(c); return { el: c, remove() { c.remove(); } };
}

export const GK = { icon, el, store, haptic, countUp, pop, confetti, fly, toast, stars, levelBar, levelPicker, dailyStrip, weekRow, shop, coach, hooks, iso, clamp, RM, ICONS, progress: (id, cfg) => new Progress(id, cfg) };
if (typeof window !== 'undefined') window.GK = GK;
