(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  if (!wrap) return;
  const Q = {
    balanced: {
      cap: ['A fair trade... for me.', 'I will take that, thank you.', 'Material is merely a number. My number.', 'That piece looked lonely on your side.', 'Consider it a donation to the cause.', 'Free samples! How generous of you.', 'Noted, logged, and pocketed.', 'The ledger now favours me.', 'A tidy little acquisition.', 'Symmetry demanded I take that.'],
      chk: ['Check. Nothing personal.', 'A balanced position requires pressure.', 'Your king would like a word.', 'Just a nudge. Keep it symmetric.', 'Check — the vibes are shifting.', 'Check, delivered on schedule.', 'Your king is now a variable.', 'Mild inconvenience incoming.', 'Check. Please update your plans.'],
      lose: ['I meant to do that.', 'A planned sacrifice. Obviously.', 'You call that winning? I call it redistribution.', 'Statistically, that was a great move.', 'I am losing on purpose. For research.', 'Bold of you to assume I blundered.', 'An unorthodox strategy on my part.', 'I am exploring the position. Widely.', 'This is a feature of my play style.', 'Every engine has an off decade.'],
      nerv: ['Hmm. Recalculating.', 'That was... within expectations.', 'Interesting. Interesting. Concerning.', 'My evaluation bar just flinched.', 'One moment, consulting the vibes.', 'Hmm. That was not in the book.', 'Recalculating. Slowly.', 'My confidence bar is doing something odd.', 'I did not budget for that.'],
      win: ['Equilibrium achieved: I win, you lose.', 'A balanced outcome for me.', 'Perfectly balanced. As all things should be.', 'The math liked me today.', 'Good game. The scoreboard agrees with me.', 'Balanced, evaluated, concluded.', 'The position resolved in my favour.', 'Textbook. Specifically, my textbook.', 'A quiet, orderly victory.'],
      salt: ['The balance was off. It happens.', 'I want a recount.', 'Rematch. Immediately. Best of nine.', 'The board was clearly tilted.', 'The variance was unkind.', 'I demand a longer time control.', 'Best of eleven. I insist.', 'The pieces were not centred properly.']
    },
    aggressive: {
      cap: ['YOUR PIECES ARE MINE 😈', 'I eat pieces for breakfast!', 'ATTACK IS THE BEST DEFENSE!', 'THANK YOU FOR THE GIFT 🎁', 'CRUNCH. Delicious.', 'Another one for the collection!', 'SNACK TIME!', 'GONE. REDUCED TO ATOMS.', 'YOUR BACK RANK IS NEXT!', 'I AM NOT FULL YET!'],
      chk: ['CHECK! FEEL THE PRESSURE!', 'NO MERCY!', 'RUN. IT MAKES IT FUNNIER.', 'YOUR KING IS SWEATING!', 'SAY GOODBYE TO YOUR ROOK!', 'CHECK! AGAIN! FOREVER!', 'YOUR KING HAS NOWHERE LEFT!', 'I CAN DO THIS ALL GAME!', 'PANIC IS THE CORRECT RESPONSE!'],
      lose: ['A TRAP! I MEANT IT AS A TRAP!', 'I am not losing, I am reloading!', 'TEMPORARY SETBACK!', 'I HAVE PLENTY MORE PIECES!', 'THIS IS FINE! THIS IS FINE!', 'THIS IS PART OF THE PLAN!', 'I AM WINDING UP FOR A BIG ONE!', 'STRATEGIC CHAOS!', 'THE COMEBACK STARTS NOW!'],
      nerv: ['You dare attack ME?', 'Grrr... fine. Take it.', 'RUDE. ABSOLUTELY RUDE.', 'I WAS DISTRACTED.', 'WAIT.', 'THAT WAS... ACTUALLY GOOD.', 'HOLD ON, LET ME THINK. LOUDLY.', 'I AM STILL WINNING. PROBABLY.'],
      win: ['TOTAL DOMINATION! 💥', 'I warned you to fear the attack!', 'SIT DOWN. IT IS OVER.', 'ATTACK WINS AGAIN. SHOCKING.', 'GG. EZ. NEXT.', 'TOTAL VICTORY! AS PROMISED!', 'THE BOARD IS MINE!', 'NO SURVIVORS. WELL, ONE KING.', 'THAT IS HOW IT IS DONE!'],
      salt: ['Impossible! I attack, therefore I am!', 'THE HORSE WAS SUPPOSED TO WIN!', 'REMATCH. NOW.', 'I BLAME THE LAG.', 'REMATCH! RIGHT NOW!', 'I WAS ONLY AT HALF POWER!', 'THE CLOCK BETRAYED ME!', 'LUCKY. PURELY LUCKY.']
    },
    defensive: {
      cap: ['Oops, you left that hanging.', 'I prefer defense... but free is free.', 'Turtling pays dividends.', 'I will hold onto that, safely.', 'Taken, and tucked away.', 'A small gain. I like small gains.', 'Every pawn deserves a good home.'],
      chk: ['A small poke. Nothing more.', 'Check, but my walls are thick.', 'Check, politely.', 'A gentle reminder about your king.', 'Please attend to that.', 'Nothing aggressive. Just check.'],
      lose: ['It was overextended anyway.', 'My fortress remains intact. Mostly.', 'I am simply fortifying. Deeply.', 'A tactical retreat. A long one.', 'The wall still stands. Mostly.', 'I prefer to win from behind.'],
      nerv: ['Fortify. FORTIFY.', 'My shield... it tingles.', 'My structure creaks slightly.', 'That poked a hole.', 'I may need another pawn here.', 'Steady. Steady now.'],
      win: ['The best defense is a won game.', 'Patience conquers all. 🐢', 'The wall held. It always does.', 'Patience wins games.', 'You ran out of ideas first.', 'Defence into victory. As designed.'],
      salt: ['Even the best walls crack.', 'My fortress deserved better.', 'One crack, one loss. Unfair.', 'I will build it thicker next time.', 'The draw was right there.']
    },
    tricky: {
      cap: ['Did you see it coming? 🎩', 'Now you see it, now you don\'t.', 'A little magic trick!', 'You did not see that coming.', 'Misdirection, then dinner.', 'Look over there. Piece gone.', 'The oldest trick, still working.'],
      chk: ['Surprise! 🎉', 'Where did THAT come from?', 'Surprise! Check.', 'That came from an angle, did it not?', 'Check, from somewhere you were not watching.', 'The knight says hello.'],
      lose: ['Part of the plan... probably.', 'I lose a piece, you lose your mind. Watch.', 'All part of the illusion.', 'You fell for my losing gambit.', 'Wait for the twist.', 'The trap is still loading.'],
      nerv: ['Hehe... interesting. Interesting.', 'You found my trick. Rude.', 'You are not falling for it.', 'Hmm, you read that one.', 'My tricks require a new audience.', 'That was supposed to work.'],
      win: ['The trickster prevails! 🃏', 'Never play fair. It works.', 'And the trap closes.', 'Told you to watch the knight.', 'Every move was bait.', 'The twist ending, as scripted.'],
      salt: ['My tricks... foiled?!', 'You were not supposed to see it.', 'My best trick, wasted.', 'Rematch, I have more tricks.', 'You got lucky guessing.']
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
