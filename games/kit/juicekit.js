(function () {
  'use strict';
  if (window.Kit) return;
  let layer = document.getElementById('kitLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'kitLayer';
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(layer);
  }
  const st = document.createElement('style');
  st.textContent = 'html{scrollbar-color:#334155 #0f0f23}::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:#0f0f23}::-webkit-scrollbar-thumb{background:#334155;border-radius:5px}@keyframes kitP{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + var(--kx)),calc(-50% + var(--ky))) scale(.2);opacity:0}}@keyframes kitT{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}20%{transform:translate(-50%,-50%) scale(1.2);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-160%) scale(1);opacity:0}}@keyframes kitCard{0%{transform:translate(-50%,-50%) scale(0);opacity:0}14%{transform:translate(-50%,-50%) scale(1.12);opacity:1}22%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1}100%{transform:translate(-50%,-70%);opacity:0}}@keyframes kitShake{0%,100%{transform:none}20%{transform:translate(6px,-4px)}40%{transform:translate(-6px,4px)}60%{transform:translate(4px,3px)}80%{transform:translate(-4px,-3px)}}@keyframes kitFlash{0%{opacity:.55}100%{opacity:0}}.kit-shake{animation:kitShake .3s linear;}';
  document.head.appendChild(st);
  let ctx = null;
  let combo = 0;
  let comboAt = 0;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function mutedNow() {
    try { if (typeof muted !== 'undefined' && muted) return true; } catch (e) {}
    try { return localStorage.getItem('gamesMuted') === '1'; } catch (e) { return false; }
  }
  window.addEventListener('load', function () {
    try { if (localStorage.getItem('gamesMuted') === '1' && typeof muted !== 'undefined' && !muted) muted = true; } catch (e) {}
    try { const mb = document.getElementById('muteBtn'); if (mb) mb.addEventListener('click', function () { try { localStorage.setItem('gamesMuted', (typeof muted !== 'undefined' && muted) ? '1' : '0'); } catch (e) {} }); } catch (e) {}
  });
  function tone(freq, dur, type, vol, slide) {
    if (mutedNow()) return;
    try {
      const c = ac(); const t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch (e) {}
  }
  const NEON = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
  function burst(x, y, color, n) {
    const count = Math.min(24, n || 10);
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div');
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 60;
      d.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;width:6px;height:6px;border-radius:50%;background:' + (color || NEON[i % NEON.length]) + ';--kx:' + Math.cos(a) * r + 'px;--ky:' + Math.sin(a) * r + 'px;animation:kitP .6s ease-out forwards;';
      d.addEventListener('animationend', () => d.remove());
      layer.appendChild(d);
    }
  }
  function text(x, y, str, color, size) {
    const d = document.createElement('div');
    d.textContent = str;
    d.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;font:900 ' + (size || 22) + 'px system-ui;color:' + (color || '#facc15') + ';text-shadow:0 2px 6px rgba(0,0,0,.7);animation:kitT 1s ease-out forwards;white-space:nowrap;';
    d.addEventListener('animationend', () => d.remove());
    layer.appendChild(d);
  }
  function shake() {
    document.body.classList.remove('kit-shake');
    void document.body.offsetWidth;
    document.body.classList.add('kit-shake');
  }
  function flash(color) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;background:' + (color || '#fff') + ';animation:kitFlash .25s ease-out forwards;';
    d.addEventListener('animationend', () => d.remove());
    layer.appendChild(d);
  }
  function card(emoji, title, sub, border) {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);background:rgba(10,10,25,.93);border:3px solid ' + (border || '#facc15') + ';border-radius:18px;padding:16px 26px;text-align:center;box-shadow:0 0 40px ' + (border || '#facc15') + '66;animation:kitCard 2.4s cubic-bezier(.2,1.6,.4,1) forwards;';
    d.innerHTML = '<div style="font-size:30px">' + emoji + '</div><div style="font:900 20px system-ui;color:' + (border || '#facc15') + ';letter-spacing:.04em">' + title + '</div>' + (sub ? '<div style="font:600 11px system-ui;color:#94a3b8;margin-top:3px">' + sub + '</div>' : '');
    d.addEventListener('animationend', () => d.remove());
    layer.appendChild(d);
  }
  function confetti(n) {
    for (let i = 0; i < (n || 50); i++) {
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;left:' + (Math.random() * 100) + '%;top:-10px;width:' + (4 + Math.random() * 5) + 'px;height:' + (6 + Math.random() * 6) + 'px;background:' + NEON[i % NEON.length] + ';border-radius:2px;';
      const fall = d.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(' + (window.innerHeight + 30) + 'px) rotate(' + (Math.random() * 720 - 360) + 'deg)' }], { duration: 1100 + Math.random() * 1200, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.4,.6,1)', fill: 'forwards' });
      fall.onfinish = () => d.remove();
      layer.appendChild(d);
    }
  }
  function win(title, sub) {
    card('🏆', title || 'YOU WIN!', sub || '', '#facc15');
    confetti(60);
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.12), i * 100));
  }
  function lose(title, sub) {
    card('💀', title || 'GAME OVER', sub || '', '#ef4444');
    shake();
    tone(220, 0.4, 'sawtooth', 0.12, 110);
    setTimeout(() => tone(180, 0.5, 'sawtooth', 0.12, 80), 180);
  }
  function hit(x, y, val) {
    combo = (Date.now() - comboAt < 1500) ? combo + 1 : 1;
    comboAt = Date.now();
    burst(x, y, null, 8 + Math.min(12, (val || 1) * 3));
    tone(300 + (val || 1) * 60, 0.12, 'square', 0.08, 700);
    if (combo >= 3) {
      text(x, y - 30, combo + 'x COMBO!', '#f472b6', 20 + combo);
      tone(500 + combo * 120, 0.15, 'sawtooth', 0.09, 1200);
      if (combo >= 5) shake();
    }
  }
  function click() { tone(700, 0.06, 'triangle', 0.06); }
  window.Kit = {
    burst: burst, text: text, shake: shake, flash: flash,
    win: win, lose: lose, hit: hit, click: click, confetti: confetti,
    center: el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    combo: () => combo
  };
})();
