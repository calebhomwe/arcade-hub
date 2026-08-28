(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const Q = {
    balanced: {
      cap: ['A fair trade... for me.', 'I will take that, thank you.', 'Material is merely a number. My number.'],
      chk: ['Check. Nothing personal.', 'A balanced position requires pressure.'],
      lose: ['I meant to do that.', 'A planned sacrifice. Obviously.', 'You call that winning? I call it redistribution.'],
      nerv: ['Hmm. Recalculating.', 'That was... within expectations.'],
      win: ['Equilibrium achieved: I win, you lose.', 'A balanced outcome for me.'],
      salt: ['The balance was off. It happens.']
    },
    aggressive: {
      cap: ['YOUR PIECES ARE MINE 😈', 'I eat pieces for breakfast!', 'ATTACK IS THE BEST DEFENSE!'],
      chk: ['CHECK! FEEL THE PRESSURE!', 'NO MERCY!'],
      lose: ['A TRAP! I MEANT IT AS A TRAP!', 'I am not losing, I am reloading!'],
      nerv: ['You dare attack ME?', 'Grrr... fine. Take it.'],
      win: ['TOTAL DOMINATION! 💥', 'I warned you to fear the attack!'],
      salt: ['Impossible! I attack, therefore I am!']
    },
    defensive: {
      cap: ['Oops, you left that hanging.', 'I prefer defense... but free is free.', 'Turtling pays dividends.'],
      chk: ['A small poke. Nothing more.', 'Check, but my walls are thick.'],
      lose: ['It was overextended anyway.', 'My fortress remains intact. Mostly.'],
      nerv: ['Fortify. FORTIFY.', 'My shield... it tingles.'],
      win: ['The best defense is a won game.', 'Patience conquers all. 🐢'],
      salt: ['Even the best walls crack.']
    },
    tricky: {
      cap: ['Did you see it coming? 🎩', 'Now you see it, now you don\'t.', 'A little magic trick!'],
      chk: ['Surprise! 🎉', 'Where did THAT come from?'],
      lose: ['Part of the plan... probably.', 'I lose a piece, you lose your mind. Watch.'],
      nerv: ['Hehe... interesting. Interesting.', 'You found my trick. Rude.'],
      win: ['The trickster prevails! 🃏', 'Never play fair. It works.'],
      salt: ['My tricks... foiled?!']
    }
  };
  const st = document.createElement('style');
  st.textContent = '.cmp2-bub{position:absolute;bottom:6px;left:6px;z-index:50;max-width:75%;background:rgba(20,10,30,.94);border:2px solid #f472b6;border-radius:14px 14px 14px 4px;padding:6px 10px;font:700 11px system-ui;color:#fce7f3;pointer-events:none;display:flex;gap:6px;align-items:center;animation:cmp2In 2.2s cubic-bezier(.3,1.6,.4,1) forwards;box-shadow:0 4px 18px rgba(0,0,0,.5);}@keyframes cmp2In{0%{transform:translateY(14px) scale(.7);opacity:0}10%{transform:none;opacity:1}80%{opacity:1}100%{opacity:0}}';
  document.head.appendChild(st);
  let bub = null;
  let lastAt = 0;
  function talk(text) {
    if (Math.random() > 0.6) return;
    const now = Date.now();
    if (now - lastAt < 4000) return;
    lastAt = now;
    if (bub) bub.remove();
    bub = document.createElement('div');
    bub.className = 'cmp2-bub';
    bub.innerHTML = '<span>🤖</span><span></span>';
    bub.children[1].textContent = text;
    bub.addEventListener('animationend', () => { bub.remove(); bub = null; });
    wrap.appendChild(bub);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function table() { return Q[typeof botPersonality !== 'undefined' ? botPersonality : ''] || Q.balanced; }
  ChessMods.on('move', function (m) {
    try {
      if (api.juice === 0) return;
      if (typeof botEnabled === 'undefined' || !botEnabled) return;
      const T = table();
      const botMoved = m.mover === botColor;
      if (m.mate) { talk(botMoved ? pick(T.win) : pick(T.salt)); return; }
      if (m.captured) { talk(botMoved ? pick(T.cap) : pick(T.lose)); return; }
      if (m.check) { talk(botMoved ? pick(T.chk) : pick(T.nerv)); return; }
    } catch (e) { console.warn('[chess-personality]', e); }
  });
  ChessMods.on('reset', function () {
    try { if (bub) { bub.remove(); bub = null; } } catch (e) {}
  });
})();
