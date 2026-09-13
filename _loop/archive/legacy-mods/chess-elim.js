(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const st = document.createElement('style');
  st.textContent = '.cme-ko{position:absolute;pointer-events:none;z-index:26;transform:translate(-50%,-50%);line-height:1;}@keyframes cmeFly{20%{opacity:1}100%{transform:translate(var(--cmeTX),var(--cmeTY)) translate(-50%,-50%) rotate(720deg) scale(.2);opacity:0}}.cme-stamp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-12deg);border:4px solid #ef4444;color:#ef4444;font:900 26px system-ui;letter-spacing:.08em;padding:6px 18px;border-radius:8px;background:rgba(10,10,20,.75);z-index:40;animation:cmeStamp .35s cubic-bezier(.2,2,.4,1) forwards;pointer-events:none;text-shadow:0 0 12px rgba(239,68,68,.7);}.cme-stamp-out{animation:cmeStampOut .4s ease-in forwards;}@keyframes cmeStamp{0%{transform:translate(-50%,-50%) rotate(-12deg) scale(3);opacity:0}100%{transform:translate(-50%,-50%) rotate(-12deg) scale(1);opacity:1}}@keyframes cmeStampOut{to{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(1.1)}}@keyframes cmeSkull{0%{transform:translateY(-40px) rotate(0);opacity:1}100%{transform:translateY(420px) rotate(360deg);opacity:0}}.cme-vig{position:absolute;inset:0;border-radius:12px;pointer-events:none;z-index:24;animation:cmeVig .4s ease-out forwards;}@keyframes cmeVig{0%{box-shadow:inset 0 0 60px 30px rgba(239,68,68,.7)}100%{box-shadow:inset 0 0 60px 30px rgba(239,68,68,0)}}.cme-flash{position:absolute;inset:0;border-radius:12px;background:#fff;pointer-events:none;z-index:35;animation:cmeFlash .12s ease-out forwards;}@keyframes cmeFlash{to{opacity:0}}';
  document.head.appendChild(st);
  function cleanup(d) { d.addEventListener('animationend', () => d.remove()); }
  function launch(sq, piece) {
    const xy = api.sqXY(sq);
    const d = document.createElement('div');
    d.className = 'cme-ko';
    d.textContent = CH[piece] || '💥';
    d.style.left = xy.x + 'px'; d.style.top = xy.y + 'px';
    d.style.fontSize = (api.sqSize * 0.7) + 'px';
    d.style.color = pColor(piece) === CL.WHITE ? '#fff' : '#1a1a2e';
    d.style.textShadow = '0 2px 4px rgba(0,0,0,.6)';
    const tx = (xy.x < api.sqSize * 4 ? -1 : 1) * (api.sqSize * 3 + Math.random() * api.sqSize * 2);
    const ty = -(api.sqSize * 2 + Math.random() * api.sqSize * 2);
    d.style.setProperty('--cmeTX', tx + 'px');
    d.style.setProperty('--cmeTY', ty + 'px');
    d.style.animation = 'cmeFly .6s ease-in forwards';
    cleanup(d);
    wrap.appendChild(d);
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      if (m.captured) {
        launch(m.to, m.captured);
        const v = VAL[pType(m.captured)] || 1;
        api.textPop(api.sqXY(m.to).x, api.sqXY(m.to).y - api.sqSize * 0.5, v >= 5 ? 'K.O.!!' : 'K.O.!', '#ef4444', api.sqSize * (v >= 5 ? 0.42 : 0.3));
        if (v >= 5) {
          api.shake(2.5);
          api.textPop(api.sqXY(m.to).x, api.sqXY(m.to).y - api.sqSize, 'MEGA CAPTURE!', '#facc15', api.sqSize * 0.32);
          const f = document.createElement('div');
          f.className = 'cme-flash';
          cleanup(f);
          wrap.appendChild(f);
        } else api.shake(1.2);
      }
      if (m.check && !m.mate) {
        const v = document.createElement('div');
        v.className = 'cme-vig';
        cleanup(v);
        wrap.appendChild(v);
      }
      if (m.mate) {
        api.shake(3);
        const s = document.createElement('div');
        s.className = 'cme-stamp';
        s.textContent = 'ELIMINATED';
        wrap.appendChild(s);
        setTimeout(() => { s.classList.add('cme-stamp-out'); setTimeout(() => s.remove(), 450); }, 2000);
        for (let i = 0; i < 6; i++) {
          const sk = document.createElement('div');
          sk.className = 'cme-ko';
          sk.textContent = '💀';
          sk.style.left = (Math.random() * 100) + '%';
          sk.style.top = '-30px';
          sk.style.fontSize = (api.sqSize * 0.4) + 'px';
          sk.style.animation = 'cmeSkull 1.5s ' + (i * 0.12) + 's ease-in forwards';
          cleanup(sk);
          wrap.appendChild(sk);
        }
      }
    } catch (e) { console.warn('[chess-elim]', e); }
  });
  ChessMods.on('reset', function () {
    try {
      const olds = wrap.querySelectorAll('.cme-ko,.cme-stamp,.cme-vig,.cme-flash');
      for (let i = 0; i < olds.length; i++) olds[i].remove();
    } catch (e) { console.warn('[chess-elim]', e); }
  });
})();
