(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const SUBS = ['The king has left the building.', 'Skill issue detected (theirs).', 'GG EZ (be nice).', 'Absolute cinema.', 'Someone call an ambulance... but not for you.', 'The crown stays in the family.', 'Frostbite? No — CHECKMATE.', 'Board = solved.'];
  const COLORS = ['#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'];
  const st = document.createElement('style');
  st.textContent = '.cmv-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:45;background:rgba(10,10,25,.92);border:2px solid #facc15;border-radius:16px;padding:14px 22px;text-align:center;pointer-events:none;box-shadow:0 0 40px rgba(250,204,21,.4);animation:cmvCard 2.5s cubic-bezier(.2,1.6,.4,1) forwards;}@keyframes cmvCard{0%{transform:translate(-50%,-50%) scale(0);opacity:0}12%{transform:translate(-50%,-50%) scale(1.1);opacity:1}18%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-70%) scale(.95)}}.cmv-title{font:900 22px system-ui;color:#facc15;letter-spacing:.04em;text-shadow:0 0 14px rgba(250,204,21,.8);}.cmv-sub{font:600 11px system-ui;color:#94a3b8;margin-top:4px;}.cmv-banner{position:absolute;left:50%;top:12%;transform:translateX(-50%);z-index:44;background:rgba(60,60,70,.85);border-radius:99px;padding:4px 14px;font:700 12px system-ui;color:#cbd5e1;pointer-events:none;animation:cmvCard 2s ease forwards;}';
  document.head.appendChild(st);
  function confetti() {
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('div');
      d.style.position = 'absolute';
      d.style.left = (Math.random() * 100) + '%';
      d.style.top = '-12px';
      d.style.width = (4 + Math.random() * 5) + 'px';
      d.style.height = (7 + Math.random() * 6) + 'px';
      d.style.background = COLORS[i % COLORS.length];
      d.style.borderRadius = '2px';
      d.style.zIndex = 44;
      d.style.pointerEvents = 'none';
      const a = d.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: 'translateY(' + (wrap.clientHeight + 30) + 'px) rotate(' + (Math.random() * 720 - 360) + 'deg)', opacity: 0.9 }
      ], { duration: 1200 + Math.random() * 1200, delay: Math.random() * 500, easing: 'cubic-bezier(.3,.4,.6,1)', fill: 'forwards' });
      a.onfinish = () => d.remove();
      wrap.appendChild(d);
    }
  }
  function fanfare() {
    if (typeof muted !== 'undefined' && muted) return;
    try {
      if (!window.cmvAc) window.cmvAc = new (window.AudioContext || window.webkitAudioContext)();
      const c = window.cmvAc; if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.13, t + i * 0.11 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.5);
        o.connect(g); g.connect(c.destination);
        o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.55);
      });
    } catch (e) {}
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      if (m.mate || m.win) {
        confetti();
        const card = document.createElement('div');
        card.className = 'cmv-card';
        card.innerHTML = '<div class="cmv-title">🏆 ' + (m.mate ? 'CHECKMATE!' : 'VICTORY!') + '</div><div class="cmv-sub">' + SUBS[Math.floor(Math.random() * SUBS.length)] + '</div>';
        wrap.appendChild(card);
        card.addEventListener('animationend', () => card.remove());
        fanfare();
      } else if (m.draw) {
        const b = document.createElement('div');
        b.className = 'cmv-banner';
        b.textContent = '🤝 DRAW';
        wrap.appendChild(b);
        b.addEventListener('animationend', () => b.remove());
      }
    } catch (e) { console.warn('[chess-celebration]', e); }
  });
  ChessMods.on('reset', function () {
    try {
      const olds = wrap.querySelectorAll('.cmv-card,.cmv-banner');
      for (let i = 0; i < olds.length; i++) olds[i].remove();
    } catch (e) { console.warn('[chess-celebration]', e); }
  });
})();
