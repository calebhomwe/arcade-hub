(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const KEY = 'cmx-prog';
  const TITLES = [[1, 'Pawn'], [2, 'Knight'], [3, 'Bishop'], [4, 'Rook'], [5, 'Queen'], [6, 'King'], [7, 'Expert'], [8, 'Master'], [10, 'Grandmaster'], [12, 'CHESS GOD']];
  let prog = { xp: 0, level: 1 };
  try { const s = localStorage.getItem(KEY); if (s) prog = JSON.parse(s); } catch (e) {}
  const hud = document.createElement('div');
  hud.id = 'cmx-hud';
  const st = document.createElement('style');
  st.textContent = '#cmx-hud{display:flex;align-items:center;gap:8px;width:min(92vw,calc(92vh - 180px),480px);margin:0 auto 4px;}#cmx-pill{font:900 10px system-ui;color:#0f0f23;background:linear-gradient(90deg,#a78bfa,#f472b6);padding:2px 8px;border-radius:99px;white-space:nowrap;letter-spacing:.03em;box-shadow:0 0 10px rgba(167,139,250,.5);}#cmx-bar{flex:1;height:4px;background:rgba(255,255,255,.12);border-radius:99px;overflow:hidden;}#cmx-fill{height:100%;width:0%;background:linear-gradient(90deg,#a78bfa,#f472b6,#facc15);border-radius:99px;transition:width .4s cubic-bezier(.2,.8,.3,1);box-shadow:0 0 8px #f472b6;}';
  document.head.appendChild(st);
  hud.innerHTML = '<span id="cmx-pill">LV 1 · Pawn</span><div id="cmx-bar"><div id="cmx-fill"></div></div>';
  const wrap = document.getElementById('gameWrap');
  if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(hud, wrap);
  function titleFor(lv) {
    let t = 'Pawn';
    for (const pair of TITLES) if (lv >= pair[0]) t = pair[1];
    return t;
  }
  function render() {
    hud.querySelector('#cmx-pill').textContent = 'LV ' + prog.level + ' · ' + titleFor(prog.level);
    const need = 100 * prog.level;
    hud.querySelector('#cmx-fill').style.width = Math.min(100, (prog.xp / need) * 100) + '%';
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) {} }
  function ac() {
    if (!window.cmxAc) window.cmxAc = new (window.AudioContext || window.webkitAudioContext)();
    if (window.cmxAc.state === 'suspended') window.cmxAc.resume();
    return window.cmxAc;
  }
  function arpeggio() {
    if (typeof muted !== 'undefined' && muted) return;
    try {
      const c = ac(); const t = c.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.25);
        o.connect(g); g.connect(c.destination);
        o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.3);
      });
    } catch (e) {}
  }
  function gain(xp) {
    if (api.juice === 0) return;
    const before = titleFor(prog.level);
    prog.xp += xp;
    while (prog.xp >= 100 * prog.level) {
      prog.xp -= 100 * prog.level;
      prog.level++;
      api.textPop(api.sqXY(31).x, api.sqXY(31).y, 'LEVEL UP!', '#facc15', api.sqSize * 0.45);
      api.shake(2);
      arpeggio();
      for (let i = 0; i < 5; i++) {
        const sq = Math.floor(Math.random() * 64);
        const xy = api.sqXY(sq);
        api.particles(xy.x, xy.y, 10, ['#f472b6', '#facc15', '#a78bfa', '#4ade80', '#38bdf8'][i]);
      }
      const after = titleFor(prog.level);
      if (after !== before) api.textPop(api.sqXY(28).x, api.sqXY(28).y - api.sqSize, 'NEW TITLE: ' + after.toUpperCase() + '!', '#f472b6', api.sqSize * 0.3);
    }
    save(); render();
  }
  ChessMods.on('move', function (m) {
    try {
      const mult = Math.max(1, m.combo);
      if (m.mate && m.win) gain(100 * mult);
      else if (m.draw) gain(20);
      else if (m.captured) gain(10 * (VAL[pType(m.captured)] || 1) * mult);
      else if (m.promo) gain(25 * mult);
      else if (m.castle) gain(8);
      else if (m.check) gain(5);
      else gain(1);
    } catch (e) { console.warn('[chess-combo]', e); }
  });
  render();
})();
