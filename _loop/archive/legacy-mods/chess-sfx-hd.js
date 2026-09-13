/* chess-sfx-hd.js - REAL recorded/synthesised sound bank for the chess game.
 *
 * Replaces the oscillator+noise synth in chess-sfx.js (bandpassed noise bursts
 * and square-wave beeps) with actual generated samples produced by the local
 * ComfyUI MOSS-SoundEffect v2 model.
 *
 * Design notes:
 *  - Uses HTMLAudioElement voice pools, NOT WebAudio decodeAudioData, because
 *    fetch()/XHR is blocked for file:// pages. <audio src> works over file://,
 *    so the game stays double-clickable and fully offline.
 *  - Every sound has several voices so rapid moves do not cut each other off.
 *  - Slight random playbackRate/volume per play so repeated moves never sound
 *    machine-gunned.
 *  - Degrades silently if a sample is missing - it never throws into the game.
 */
(function () {
  'use strict';
  if (!window.ChessMods) return;

  var BASE = 'audio/';           // relative to games/chess.html
  var VOICES = 4;

  // name -> relative file. Keep names stable; the generator writes these paths.
  var BANK = {
    move_pawn:      'chess/move_pawn.mp3',
    move_piece:     'chess/move_piece.mp3',
    capture_light:  'chess/capture_light.mp3',
    capture_heavy:  'chess/capture_heavy.mp3',
    check:          'chess/check.mp3',
    castle:         'chess/castle.mp3',
    promote:        'chess/promote.mp3',
    mate_win:       'chess/mate_win.mp3',
    mate_lose:      'chess/mate_lose.mp3',
    illegal:        'chess/illegal.mp3',
    ui_click:       'chess/ui_click.mp3',
    ui_hover:       'chess/ui_hover.mp3',
    vine_boom:      'meme/vine_boom.mp3',
    airhorn:        'meme/airhorn.mp3',
    sad_trombone:   'meme/sad_trombone.mp3',
    record_scratch: 'meme/record_scratch.mp3',
    crowd_gasp:     'meme/crowd_gasp.mp3',
    applause:       'meme/applause.mp3',
    dramatic_sting: 'meme/dramatic_sting.mp3',
    sub_impact:     'meme/sub_impact.mp3',
    cartoon_explosion: 'meme/cartoon_explosion.mp3',
    boing:          'meme/boing.mp3',
    ding:           'meme/ding.mp3',
    buzzer:         'meme/buzzer.mp3',
    levelup:        'meme/levelup.mp3',
    coin:           'meme/coin.mp3'
  };

  var pools = {};      // name -> {els: [], i: 0, ready: bool, failed: bool}
  var unlocked = false;

  function build() {
    Object.keys(BANK).forEach(function (name) {
      var els = [];
      for (var i = 0; i < VOICES; i++) {
        var a = new Audio();
        a.preload = 'auto';
        a.src = BASE + BANK[name];
        a.volume = 0.001;
        els.push(a);
      }
      pools[name] = { els: els, i: 0, failed: false };
    });
  }

  function gain() {
    // Respect the game's own mute + juice slider exactly like chess-sfx.js did.
    if (typeof muted !== 'undefined' && muted) return 0;
    var j = (typeof juiceLevel !== 'undefined') ? juiceLevel : 50;
    if (j === 0) return 0;
    return 0.35 + (j / 100) * 0.65;   // 0.35 .. 1.0
  }

  /** Play one bank entry. opts: {vol, rate, jitter} */
  function play(name, opts) {
    opts = opts || {};
    var p = pools[name];
    if (!p || p.failed) return;
    var g = gain();
    if (g <= 0) return;
    var a = p.els[p.i];
    p.i = (p.i + 1) % p.els.length;
    try {
      a.pause();
      a.currentTime = 0;
      var jitter = (opts.jitter === undefined) ? 0.06 : opts.jitter;
      a.playbackRate = (opts.rate || 1) * (1 + (Math.random() * 2 - 1) * jitter);
      a.volume = Math.min(1, (opts.vol === undefined ? 0.8 : opts.vol) * g);
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) { /* never break the game for audio */ }
  }

  function pieceClass(p) {
    // VAL is the game's piece-value table; 1 pawn .. 9+ queen.
    try {
      if (typeof VAL !== 'undefined' && p && typeof pType === 'function') {
        return VAL[pType(p)] || 1;
      }
    } catch (e) {}
    return 1;
  }

  // ---- unlock audio on the first real gesture (browser autoplay policy) ----
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    Object.keys(pools).forEach(function (n) {
      pools[n].els.forEach(function (a) {
        try {
          a.volume = 0.001;
          var pr = a.play();
          if (pr && pr.then) pr.then(function () { a.pause(); a.currentTime = 0; },
                                     function () {});
        } catch (e) {}
      });
    });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: false, passive: true });
  });

  // ---------------------------- events ----------------------------
  ChessMods.on('move', function (m) {
    try {
      var captured = m.captured ? pieceClass(m.captured) : 0;
      var mover = m.piece ? pieceClass(m.piece) : 1;

      // Placement: pawns are a soft click, officers are a firmer thud.
      if (mover <= 1) play('move_pawn', { vol: 0.75 });
      else play('move_piece', { vol: 0.8, rate: 0.97 + mover * 0.012 });

      if (captured) {
        if (captured >= 5) {
          play('capture_heavy', { vol: 0.95 });
          play('sub_impact', { vol: 0.5, at: 0 });      // weight under the hit
          play('vine_boom', { vol: 0.45 });             // meme payoff on a big take
        } else {
          play('capture_light', { vol: 0.85 });
        }
        if (captured >= 9) play('crowd_gasp', { vol: 0.5 });   // queen taken
      }

      if (m.check) {
        play('check', { vol: 0.85 });
        play('dramatic_sting', { vol: 0.55 });
      }
      if (m.castle) play('castle', { vol: 0.85 });
      if (m.promo) {
        play('promote', { vol: 0.9 });
        play('levelup', { vol: 0.6 });
        play('coin', { vol: 0.4 });
      }

      // Combo escalation: rising pitch, so a streak sounds like a melody.
      if (m.combo >= 3) {
        var n = Math.min(m.combo, 9);
        play('ding', { vol: 0.5, rate: 0.85 + n * 0.09, jitter: 0.01 });
      }

      if (m.mate) {
        if (m.won === false) {
          play('mate_lose', { vol: 0.95 });
          play('sad_trombone', { vol: 0.7 });
        } else {
          play('mate_win', { vol: 1.0 });
          play('applause', { vol: 0.75 });
          play('airhorn', { vol: 0.6 });
        }
      }
    } catch (e) { console.warn('[chess-sfx-hd]', e); }
  });

  ChessMods.on('illegal', function () { play('illegal', { vol: 0.7 }); play('buzzer', { vol: 0.5 }); });
  ChessMods.on('ui', function () { play('ui_click', { vol: 0.5 }); });
  ChessMods.on('reset', function () { play('record_scratch', { vol: 0.5 }); });

  // Optional music bed. Off by default; toggle with the M key or window.chessMusic(true).
  var music = null;
  window.chessMusic = function (on) {
    try {
      if (!on) { if (music) { music.pause(); } return false; }
      if (!music) { music = new Audio(BASE + 'music/chess_theme.mp3'); music.loop = true; music.volume = 0.3; }
      var pr = music.play(); if (pr && pr.catch) pr.catch(function () {});
      return true;
    } catch (e) { return false; }
  };

  build();
  console.log('[chess-sfx-hd] bank loaded (' + Object.keys(BANK).length + ' sounds)');
})();
