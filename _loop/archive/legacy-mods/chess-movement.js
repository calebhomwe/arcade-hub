(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const st = document.createElement('style');
  st.textContent = '.cmm-ghost{position:absolute;pointer-events:none;z-index:25;transform:translate(-50%,-50%);line-height:1;user-select:none;}';
  document.head.appendChild(st);
  function ghost(sqFrom, sqTo, piece, dur) {
    const ch = CH[piece];
    if (!ch) return;
    const a = api.sqXY(sqFrom), b = api.sqXY(sqTo);
    const white = pColor(piece) === CL.WHITE;
    for (let t = 0; t < 4; t++) {
      const d = document.createElement('span');
      d.className = 'cmm-ghost';
      d.textContent = ch;
      d.style.left = a.x + 'px';
      d.style.top = a.y + 'px';
      d.style.fontSize = (api.sqSize * 0.72) + 'px';
      d.style.color = white ? '#fff' : '#1a1a2e';
      d.style.textShadow = white ? '0 0 3px #1a1a2e,0 2px 3px rgba(0,0,0,.6)' : '0 0 3px #fff,0 2px 3px rgba(0,0,0,.6)';
      const delay = t * 28;
      const shrink = t === 0 ? 1 : 1 - t * 0.18;
      d.style.fontSize = (api.sqSize * 0.72 * shrink) + 'px';
      const anim = d.animate([
        { left: a.x + 'px', top: a.y + 'px', opacity: t === 0 ? 0.95 : 0.4 },
        { left: b.x + 'px', top: b.y + 'px', opacity: t === 0 ? 1 : 0 }
      ], { duration: dur || 150, delay: delay, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      anim.onfinish = () => d.remove();
      wrap.appendChild(d);
    }
  }
  function ring(sq) {
    const xy = api.sqXY(sq);
    const d = document.createElement('div');
    d.className = 'cmm-ghost';
    d.style.left = xy.x + 'px';
    d.style.top = xy.y + 'px';
    d.style.width = (api.sqSize * 0.6) + 'px';
    d.style.height = (api.sqSize * 0.6) + 'px';
    d.style.border = '3px solid #ef4444';
    d.style.borderRadius = '50%';
    const a = d.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }
    ], { duration: 500, easing: 'ease-out' });
    a.onfinish = () => d.remove();
    wrap.appendChild(d);
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      const piece = api.board[m.to];
      if (piece) ghost(m.from, m.to, piece, 150);
      if (m.castle) {
        const r = m.to - m.from > 0 ? m.to - 1 : m.to + 1;
        const rf = m.to - m.from > 0 ? m.from + 3 : m.from - 4;
        const rp = api.board[r];
        if (rp) ghost(rf, r, rp, 150);
      }
      if (m.captured) ring(m.to);
    } catch (e) { console.warn('[chess-movement]', e); }
  });
  ChessMods.on('reset', function () {
    try {
      const olds = wrap.querySelectorAll('.cmm-ghost');
      for (let i = 0; i < olds.length; i++) olds[i].remove();
    } catch (e) { console.warn('[chess-movement]', e); }
  });
})();
