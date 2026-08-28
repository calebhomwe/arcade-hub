(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const LINES = {
    bigCap: ['SHEEESH! 🥶', 'That piece had a family!', 'Disrespectful. I love it.', 'Caught in 4K 📸', 'The board is a buffet today.'],
    check: ['OHHH CHECK!', 'The king feels unsafe!', 'Red alert! 🚨', 'Somebody protect the king!'],
    promo: ['A NEW QUEEN RISES', 'Pawn glow-up! ✨', 'From intern to CEO.', 'Promotion accepted!'],
    castle: ['Textbook! 📚', 'King goes to bed early.', 'Safe and sound.', 'Fortress mode: ON.'],
    blunder: ['Uhh... you sure about that?', 'Coach is sweating 😅', 'Bold strategy. Very bold.', 'That piece just volunteered...', 'I saw nothing. (I saw everything.)'],
    win: ["THAT'S HOW IT'S DONE!", 'Certificate incoming 🎓', 'Coach takes full credit.', 'Framed. On the wall. Now.']
  };
  const st = document.createElement('style');
  st.textContent = '.cmc-bub{position:absolute;top:6px;right:6px;z-index:50;max-width:75%;background:rgba(10,10,30,.92);border:2px solid #a78bfa;border-radius:14px 14px 4px 14px;padding:6px 10px;font:700 11px system-ui;color:#e5e7eb;pointer-events:none;display:flex;gap:6px;align-items:center;animation:cmcIn 2.5s ease forwards;box-shadow:0 4px 18px rgba(0,0,0,.5),0 0 12px rgba(167,139,250,.35);}@keyframes cmcIn{0%{transform:translateX(20px) scale(.8);opacity:0}8%{transform:none;opacity:1}80%{opacity:1}100%{opacity:0}}';
  document.head.appendChild(st);
  let bub = null;
  let lastAt = 0;
  function say(text) {
    const now = Date.now();
    if (now - lastAt < 3000) return;
    lastAt = now;
    if (bub) bub.remove();
    bub = document.createElement('div');
    bub.className = 'cmc-bub';
    bub.innerHTML = '<span>🧑‍🏫</span><span></span>';
    bub.children[1].textContent = text;
    bub.addEventListener('animationend', () => { bub.remove(); bub = null; });
    wrap.appendChild(bub);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function isBlunderish(m) {
    try {
      const b = api.board;
      const piece = b[m.to];
      if (!piece || (VAL[pType(piece)] || 0) < 3) return false;
      const enemy = 1 - m.mover;
      const att = getAllLegalMoves(b, enemy, null, { K: false, Q: false, k: false, q: false });
      let attacked = false, defended = false;
      for (const mv of att) if (mv.to === m.to) { attacked = true; break; }
      if (!attacked) return false;
      const own = getAllLegalMoves(b, m.mover, null, { K: false, Q: false, k: false, q: false });
      for (const mv of own) if (mv.to === m.to && mv.from !== m.to) { defended = true; break; }
      return !defended;
    } catch (e) { return false; }
  }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      if (m.mate || (m.win && !m.mate)) { say(pick(LINES.win)); return; }
      if (m.captured && (VAL[pType(m.captured)] || 0) >= 5) { say(pick(LINES.bigCap)); return; }
      if (m.promo) { say(pick(LINES.promo)); return; }
      if (m.check) { say(pick(LINES.check)); return; }
      if (m.castle) { say(pick(LINES.castle)); return; }
      if (isBlunderish(m)) say(pick(LINES.blunder));
    } catch (e) { console.warn('[chess-coach]', e); }
  });
  ChessMods.on('reset', function () {
    try { if (bub) { bub.remove(); bub = null; } } catch (e) {}
  });
})();
