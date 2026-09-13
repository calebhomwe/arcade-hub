(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const st = document.createElement('style');
  st.textContent = '.cmf-face{position:absolute;pointer-events:none;z-index:30;transform:translate(-50%,-50%);animation:cmfPop 1.2s ease-out forwards;user-select:none;text-shadow:0 2px 4px rgba(0,0,0,.5);}@keyframes cmfPop{0%{transform:translate(-50%,-50%) scale(0) rotate(0deg);opacity:0}15%{transform:translate(-50%,-50%) scale(1.25) rotate(var(--cmfR));opacity:1}35%{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}75%{opacity:1}100%{transform:translate(-50%,-130%) scale(.9);opacity:0}}';
  document.head.appendChild(st);
  let live = 0;
  function face(sq, emo, scale) {
    if (!emo || api.juice === 0) return;
    if (live >= 20) return;
    const xy = api.sqXY(sq);
    const d = document.createElement('div');
    d.className = 'cmf-face';
    d.textContent = emo;
    d.style.left = xy.x + 'px';
    d.style.top = xy.y + 'px';
    d.style.fontSize = (api.sqSize * 0.4 * (scale || 1)) + 'px';
    d.style.setProperty('--cmfR', (Math.random() * 30 - 15).toFixed(0) + 'deg');
    d.addEventListener('animationend', () => { d.remove(); live--; });
    wrap.appendChild(d);
    live++;
  }
  function kingSq(color, board) {
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && pType(p) === PT.KING && pColor(p) === color) return i;
    }
    return -1;
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      if (m.captured) { face(m.to, '😈', 1); face(m.to, '💀', 0.8); }
      else if (Math.random() < 0.1) face(m.to, '🙂', 0.7);
      if (m.check || m.mate) {
        const k = kingSq(1 - m.mover, api.board);
        if (k >= 0) face(k, m.mate ? '🤯' : '😱', m.mate ? 1.2 : 1);
        if (m.mate) face(m.to, '😎', 1.1);
      }
      if (m.promo) face(m.to, '🤩', 1.1);
      if (m.castle) face(m.to, '😮‍💨', 0.9);
    } catch (e) { console.warn('[chess-faces]', e); }
  });
  ChessMods.on('reset', function () {
    try {
      const olds = wrap.querySelectorAll('.cmf-face');
      for (let i = 0; i < olds.length; i++) olds[i].remove();
      live = 0;
    } catch (e) { console.warn('[chess-faces]', e); }
  });
})();
