(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const st = document.createElement('style');
  st.textContent = '.cmp-beam{position:absolute;width:26%;height:130%;bottom:0;transform:translateX(-50%);background:linear-gradient(to top,rgba(250,204,21,.9),rgba(250,204,21,0));pointer-events:none;z-index:22;animation:cmpBeam .7s ease-out forwards;}@keyframes cmpBeam{0%{opacity:0;transform:translateX(-50%) scaleY(.2)}25%{opacity:1;transform:translateX(-50%) scaleY(1)}100%{opacity:0}}.cmp-ring{position:absolute;border:3px solid #facc15;border-radius:50%;pointer-events:none;z-index:23;transform:translate(-50%,-50%);animation:cmpRing .6s ease-out forwards;}@keyframes cmpRing{0%{width:10%;height:10%;opacity:1}100%{width:150%;height:150%;opacity:0}}.cmp-aura{position:absolute;border-radius:50%;pointer-events:none;z-index:21;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(250,204,21,.55),rgba(250,204,21,0) 70%);animation:cmpAura 5s ease-out forwards;}@keyframes cmpAura{0%{opacity:0;width:30%;height:30%}15%{opacity:1}50%{opacity:.8;width:90%;height:90%}100%{opacity:0;width:110%;height:110%}}.cmp-emo{position:absolute;pointer-events:none;z-index:30;transform:translate(-50%,-50%);animation:cmpEmo 1s ease-out forwards;}@keyframes cmpEmo{0%{transform:translate(-50%,-50%) scale(0);opacity:0}25%{transform:translate(-50%,-50%) scale(1.3);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-90%) scale(1);opacity:0}}.cmp-fire{position:absolute;pointer-events:none;z-index:27;transform:translate(-50%,-50%);animation:cmpFire 2s ease-out forwards;}@keyframes cmpFire{0%,100%{opacity:.9}50%{opacity:.5}}';
  document.head.appendChild(st);
  let moveCount = 0;
  function ac() {
    if (!window.cmpAc) window.cmpAc = new (window.AudioContext || window.webkitAudioContext)();
    if (window.cmpAc.state === 'suspended') window.cmpAc.resume();
    return window.cmpAc;
  }
  function stinger(notes, vol) {
    if (typeof muted !== 'undefined' && muted) return;
    try {
      const c = ac(); const t = c.currentTime;
      notes.forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(vol || 0.08, t + i * 0.07 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.18);
        o.connect(g); g.connect(c.destination);
        o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2);
      });
    } catch (e) {}
  }
  function emoAt(sq, e, scale) {
    const xy = api.sqXY(sq);
    const d = document.createElement('div');
    d.className = 'cmp-emo';
    d.textContent = e;
    d.style.left = xy.x + 'px'; d.style.top = xy.y + 'px';
    d.style.fontSize = (api.sqSize * 0.5 * (scale || 1)) + 'px';
    d.addEventListener('animationend', () => d.remove());
    wrap.appendChild(d);
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      moveCount++;
      const xy = api.sqXY(m.to);
      if (moveCount === 1) {
        api.textPop(api.sqXY(27).x + api.sqSize, api.sqXY(27).y, 'FIGHT!', '#facc15', api.sqSize * 0.55);
        api.shake(1);
        stinger([262, 330, 392], 0.1);
      }
      if (m.promo) {
        const beam = document.createElement('div');
        beam.className = 'cmp-beam';
        beam.style.left = xy.x + 'px';
        beam.addEventListener('animationend', () => beam.remove());
        wrap.appendChild(beam);
        const ring = document.createElement('div');
        ring.className = 'cmp-ring';
        ring.style.left = xy.x + 'px'; ring.style.top = xy.y + 'px';
        ring.addEventListener('animationend', () => ring.remove());
        wrap.appendChild(ring);
        const aura = document.createElement('div');
        aura.className = 'cmp-aura';
        aura.style.left = xy.x + 'px'; aura.style.top = xy.y + 'px';
        aura.addEventListener('animationend', () => aura.remove());
        wrap.appendChild(aura);
        api.particles(xy.x, xy.y, 20, '#facc15');
        api.textPop(xy.x, xy.y - api.sqSize * 0.6, 'POWER UP!', '#facc15', api.sqSize * 0.4);
        stinger([392, 494, 587, 784], 0.1);
      }
      if (m.castle) {
        emoAt(m.to, '🛡️', 1);
        api.textPop(xy.x, xy.y - api.sqSize * 0.5, 'FORTIFY!', '#38bdf8', api.sqSize * 0.3);
        const rSq = m.to - m.from > 0 ? m.to - 1 : m.to + 1;
        api.flash(rSq);
        stinger([196, 247], 0.09);
      }
      if (m.combo >= 3) emoAt(m.to, '🔥', 1.1);
    } catch (e) { console.warn('[chess-powerups]', e); }
  });
  ChessMods.on('reset', function () {
    try {
      moveCount = 0;
      const olds = wrap.querySelectorAll('.cmp-beam,.cmp-ring,.cmp-aura,.cmp-emo,.cmp-fire');
      for (let i = 0; i < olds.length; i++) olds[i].remove();
    } catch (e) { console.warn('[chess-powerups]', e); }
  });
})();
