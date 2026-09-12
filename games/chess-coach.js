(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;

  // The coach is opt-in: it only speaks when the player turns on "Coaching tips" in
  // Settings. Language stays informative first, with a light touch - no arcade noise.
  const LINES = {
    bigCap: ['Big capture: that is real material off the board.', 'Traded up. Keep the initiative.', 'Material swings your way.'],
    check: ['Check - the king has to answer.', 'Check. Look for the follow-up.', 'That check forces a reply.'],
    promo: ['Promotion. A pawn just became a queen.', 'Queened. Now convert it.'],
    castle: ['Castled - the king is safe and the rook is active.', 'King tucked away. Good timing.'],
    blunder: ['Careful - that piece can be taken.', 'That loses material. Check the defenders first.', 'Hanging piece. Take it back if you can.'],
    win: ['That is the game - well played.', 'Mate. Clean finish.', 'Result. Take the win.'],
    draw: ['Drawn. Nothing left to convert.']
  };

  const st = document.createElement('style');
  st.textContent = '.cmc-note{position:absolute;top:10px;left:10px;right:10px;z-index:50;pointer-events:none;' +
    'background:rgba(24,23,21,.95);border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:7px 10px;' +
    'font:600 12px/1.35 system-ui;color:#e9e7e2;box-shadow:0 6px 18px rgba(0,0,0,.45);' +
    'animation:cmcFade .22s ease-out;transition:opacity .3s ease}' +
    '@keyframes cmcFade{from{opacity:0}to{opacity:1}}';
  document.head.appendChild(st);

  let note = null, hideTimer = null, lastAt = 0;

  function say(text) {
    const now = Date.now();
    if (now - lastAt < 2600) return;
    lastAt = now;
    if (!note) {
      note = document.createElement('div');
      note.className = 'cmc-note';
      wrap.appendChild(note);
    }
    note.textContent = text;
    note.style.opacity = '1';
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (note) note.style.opacity = '0'; }, 2400);
  }

  function stop() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    if (note) { note.remove(); note = null; }
  }

  const enabled = function () {
    if (window.chessCoachOn === false || window.chessCoachOn === undefined) return false;
    return api.juice !== 0;
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function isHanging(m) {
    try {
      const b = api.board;
      const piece = b[m.to];
      if (!piece || (VAL[pType(piece)] || 0) < 3) return false;
      const enemy = 1 - m.mover;
      const att = getAllLegalMoves(b, enemy, api.epTarget || null, api.castlingRights || { K: false, Q: false, k: false, q: false });
      if (!att.some(mv => mv.to === m.to)) return false;
      const own = getAllLegalMoves(b, m.mover, null, { K: false, Q: false, k: false, q: false });
      return !own.some(mv => mv.to === m.to && mv.from !== m.to);
    } catch (e) { return false; }
  }

  ChessMods.on('move', function (m) {
    try {
      if (!enabled()) return;
      if (m.mate || (m.win && !m.mate)) { say(pick(LINES.win)); return; }
      if (m.captured && (VAL[pType(m.captured)] || 0) >= 5) { say(pick(LINES.bigCap)); return; }
      if (m.promo) { say(pick(LINES.promo)); return; }
      if (m.check) { say(pick(LINES.check)); return; }
      if (m.castle) { say(pick(LINES.castle)); return; }
      if (isHanging(m)) say(pick(LINES.blunder));
    } catch (e) { console.warn('[chess-coach]', e); }
  });
  ChessMods.on('reset', stop);
  window.addEventListener('chessCoachChanged', function (e) { if (!e.detail) stop(); });
})();
