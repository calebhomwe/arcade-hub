(function () {
  'use strict';
  if (!window.ChessMods) return;
  var SETS = {
    natural: { label: 'Natural', url: 'audio/chess/manifest-natural.json' },
    crisp: { label: 'Crisp', url: 'audio/chess/manifest.json' }
  };
  var KEY_SET = 'chessSfxSet';
  var currentSet = (function () { try { var v = localStorage.getItem(KEY_SET); return SETS[v] ? v : 'natural'; } catch (e) { return 'natural'; } })();
  var CATALOG = SETS[currentSet].url;
  var buffers = {};
  var catalog = null;
  var ctx = null;
  var gain = null;
  var failed = {};

  // Share the game's AudioContext: nodes from different contexts cannot be
  // connected to each other, and one context is also cheaper on phones.
  function ac() {
    var c = null, dest = null;
    try {
      var m = window._sfxOut && window._sfxOut();
      if (m && m.ctx && m.out) { c = m.ctx; dest = m.out; }
    } catch (e) {}
    if (!c) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        c = new AC();
        dest = c.destination;
      } catch (e) { return null; }
    }
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    if (ctx !== c || !gain) {
      ctx = c; dest = dest;
      try { gain = c.createGain(); gain.gain.value = 1; } catch (e) { return null; }
    }
    if (dest && gain && gain.__dest !== dest) {
      try { gain.disconnect(); } catch (e) {}
      try { gain.connect(dest); gain.__dest = dest; } catch (e) {}
    }
    return ctx;
  }

  function mutedNow() {
    try { if (localStorage.getItem('gamesMuted') === '1') return true; } catch (e) {}
    return typeof window.muted !== 'undefined' && window.muted === true;
  }

  function adopt(json) {
    if (!json || !json.sounds || !json.sounds.length) return false;
    for (var i = 0; i < json.sounds.length; i++) {
      var s = json.sounds[i];
      if (s && s.file) s.src = 'audio/chess/' + s.file;
    }
    catalog = json;
    var c = ac();
    if (!c) return true;
    json.sounds.forEach(function (s) { decode(s); });
    try { window.dispatchEvent(new CustomEvent('sfxbank', { detail: { set: currentSet, count: json.sounds.length } })); } catch (e) {}
    return true;
  }

  function decode(s) {
    if (!s || !s.src || buffers[s.id] === 'pending' || buffers[s.id]) return;
    buffers[s.id] = 'pending';
    var c = ac();
    if (!c) return;
    try {
      fetch(s.src, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then(function (buf) { return new Promise(function (res, rej) { c.decodeAudioData(buf, res, rej); }); })
        .then(function (dec) { buffers[s.id] = dec; })
        .catch(function (err) { buffers[s.id] = null; failed[s.id] = String(err && err.message || err); });
    } catch (e) { buffers[s.id] = null; failed[s.id] = String(e && e.message || e); }
  }

  function candidates(name) {
    if (!catalog) return [];
    var key = ALIAS[name] || name;
    var exact = [], prefix = [];
    for (var i = 0; i < catalog.sounds.length; i++) {
      var s = catalog.sounds[i];
      if (s.id === key) exact.push(s);
      else if (s.id.indexOf(key + '_') === 0 || s.id.indexOf(key + '-') === 0) prefix.push(s);
    }
    return exact.concat(prefix);
  }

  var ALIAS = {
    checkmate: 'game-end-loss', gameLose: 'game-end-loss', gameWin: 'game-end-win',
    gameStart: 'game-start', lowTime: 'low-time-tick', uiClick: 'ui-click', uiHover: 'ui-hover'
  };

  window.SfxBank = {
    ready: function () { return !!catalog; },
    set: function () { return currentSet; },
    setNames: function () { return Object.keys(SETS); },
    useSet: function (name) {
      if (!SETS[name] || name === currentSet) return false;
      currentSet = name;
      try { localStorage.setItem(KEY_SET, name); } catch (e) {}
      // keep the previous catalogue playable until the new one arrives, so
      // switching sets never leaves the game silent
      buffers = {};
      load();
      return true;
    },
    catalog: function () { return catalog; },
    errors: function () { return failed; },
    ctxState: function () { var c = ac(); return c ? c.state : 'none'; },
    raw: function () { var o = {}; for (var k in buffers) o[k] = (typeof buffers[k] === 'string') ? buffers[k] : (buffers[k] ? 'buffer' : 'null'); return o; },
    loaded: function () {
      if (!catalog) return { total: 0, decoded: 0 };
      var total = catalog.sounds.length, ok = 0;
      catalog.sounds.forEach(function (s) { if (buffers[s.id] && buffers[s.id] !== 'pending') ok++; });
      return { total: total, decoded: ok };
    },
    play: function (name) {
      if (!catalog || mutedNow()) return false;
      var list = candidates(name);
      if (!list.length) return false;
      var pickable = list.filter(function (s) { return buffers[s.id] && buffers[s.id] !== 'pending'; });
      if (!pickable.length) { list.forEach(decode); return false; }
      var s = pickable[Math.floor(Math.random() * pickable.length)];
      var c = ac();
      if (!c) return false;
      try {
        var src = c.createBufferSource();
        src.buffer = buffers[s.id];
        if (s.rate) src.playbackRate.value = s.rate;
        else src.playbackRate.value = 0.985 + Math.random() * 0.03;
        var g = c.createGain();
        g.gain.value = 1;
        src.connect(g);
        g.connect(gain || c.destination);
        src.start();
        return true;
      } catch (e) { return false; }
    }
  };

  function load() {
    if (window.__CHESS_SFX_BANK && adopt(window.__CHESS_SFX_BANK)) return;
    try {
      fetch(CATALOG, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(adopt)
        .catch(function () { catalog = null; });
    } catch (e) { catalog = null; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
