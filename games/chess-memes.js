(function () {
  'use strict';
  if (!window.ChessMods) return;
  var CATALOG_URL = 'audio/memes/manifest.json';
  var CAPTIONS_URL = 'audio/memes/captions.json';
  var KEY_MASTER = 'cmm-on';
  var KEY_PACK = 'cmm-packs';
  var KEY_SOUND = 'cmm-sounds';
  var KEY_VOL = 'cmm-vol';
  var KEY_CAP = 'cmm-caps';
  var KEY_RATE = 'cmm-rate';
  var KEY_SPEECH = 'cmm-speech';
  var RATES = { rare: 2600, normal: 900, chaos: 250 };
  var RATE_MS = 900;
  // Memes are opt-in. This initialiser used to say on:true while load() read the
  // stored value defaulting to false, so whether memes fired in a normal game
  // came down to load order.
  var state = { on: false, packs: {}, sounds: {}, caps: {}, vol: 0.9, catalog: null, captions: {}, last: 0, speech: true };
  var buffers = {};
  var element = null;
  var audioCtx = null;

  function read(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return fallback;
      return JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function ctx() {
    if (audioCtx) { if (audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} } return audioCtx; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      return audioCtx;
    } catch (e) { return null; }
  }

  function out() {
    var c = ctx();
    if (!c) return null;
    if (typeof window._sfxOut === 'function') { try { var m = window._sfxOut(); if (m && m.out) return { node: m.out, ctx: m.ctx }; } catch (e) {} }
    return { node: c.destination, ctx: c };
  }

  function muted() {
    try { if (localStorage.getItem('gamesMuted') === '1') return true; } catch (e) {}
    return typeof window.muted !== 'undefined' && window.muted === true;
  }

  function loadBuffer(id, file) {
    if (buffers[id] === 'pending' || buffers[id]) return;
    buffers[id] = 'pending';
    var c = ctx();
    if (!c) return;
    try {
      fetch(file, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.arrayBuffer(); })
        .then(function (buf) { return new Promise(function (res, rej) { c.decodeAudioData(buf, res, rej); }); })
        .then(function (decoded) { buffers[id] = decoded; })
        .catch(function () { buffers[id] = null; });
    } catch (e) { buffers[id] = null; }
  }

  function playSound(meme) {
    var c = ctx();
    if (!c) return false;
    var buf = buffers[meme.id];
    if (!buf || buf === 'pending') { loadBuffer(meme.id, meme.src); return false; }
    try {
      var src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.98 + Math.random() * 0.06;
      var g = c.createGain();
      g.gain.value = state.vol;
      var dest = out();
      src.connect(g);
      g.connect(dest ? dest.node : c.destination);
      src.start();
      return true;
    } catch (e) { return false; }
  }

  function playFallback(meme) {
    try {
      if (!element) { element = new Audio(); element.preload = 'none'; }
      element.src = meme.src;
      element.volume = Math.max(0.05, Math.min(1, state.vol));
      var p = element.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  function soundsFor(event) {
    var cat = state.catalog;
    if (!cat) return [];
    var out2 = [];
    for (var i = 0; i < cat.packs.length; i++) {
      var pack = cat.packs[i];
      if (state.packs[pack.id] === false) continue;
      for (var j = 0; j < pack.sounds.length; j++) {
        var s = pack.sounds[j];
        if (s.when !== event) continue;
        if (state.sounds[s.id] === false) continue;
        out2.push(s);
      }
    }
    return out2;
  }

  function captionsFor(event) {
    var out2 = [];
    for (var key in state.captions) {
      if (state.caps[key] === false) continue;
      var arr = state.captions[key];
      if (!arr || !arr.byEvent) continue;
      var mine = arr.byEvent[event];
      if (mine && mine.length) out2.push(mine[Math.floor(Math.random() * mine.length)]);
    }
    return out2;
  }

  var API = {
    ready: function () { return !!state.catalog; },
    catalog: function () { return state.catalog; },
    state: function () { return state; },
    soundVolume: function () { return state.vol; },
    setSoundVolume: function (v) {
      state.vol = Math.max(0, Math.min(1, Number(v) || 0));
      write(KEY_VOL, state.vol);
      dispatch();
    },
    setMeme: function (id, on) { state.sounds[id] = !!on; write(KEY_SOUND, state.sounds); dispatch(); },
    setCaption: function (id, on) { state.caps[id] = !!on; write(KEY_CAP, state.caps); dispatch(); },
    captionPacks: function () { return state.captions; },
    speechAvailable: function () { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'; },
    speechOn: function () { return state.speech !== false; },
    setSpeech: function (on) {
      state.speech = !!on;
      write(KEY_SPEECH, state.speech);
      if (!state.speech) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      dispatch();
    },
    speak: function (text) { return speakText(text); },
    setRate: function (name) {
      if (!RATES[name]) return;
      state.rate = name;
      RATE_MS = RATES[name];
      write(KEY_RATE, name);
      render(false);
    },
    rate: function () { return state.rate; },
    previewAll: function () {
      var cat = state.catalog;
      if (!cat) return 0;
      var list = [];
      for (var i = 0; i < cat.packs.length; i++) {
        var p = cat.packs[i];
        if (state.packs[p.id] === false) continue;
        for (var j = 0; j < p.sounds.length; j++) if (state.sounds[p.sounds[j].id] !== false) list.push(p.sounds[j]);
      }
      list.forEach(function (s, k) {
        var run = function () { flag(s.emoji ? s.emoji + ' ' + s.label : s.label); playSound(s) || playFallback(s); };
        if (k === 0) run(); else setTimeout(run, k * 650);
      });
      return list.length;
    },
    setPack: function (id, on) {
      state.packs[id] = !!on;
      var cat = state.catalog;
      if (cat) for (var i = 0; i < cat.packs.length; i++) if (cat.packs[i].id === id) {
        for (var j = 0; j < cat.packs[i].sounds.length; j++) state.sounds[cat.packs[i].sounds[j].id] = !!on;
      }
      write(KEY_PACK, state.packs); write(KEY_SOUND, state.sounds); dispatch();
    },
    setPackOnly: function (id) {
      var cat = state.catalog;
      if (!cat) return;
      for (var i = 0; i < cat.packs.length; i++) API.setPack(cat.packs[i].id, cat.packs[i].id === id);
      dispatch();
    },
    setAll: function (on) {
      var cat = state.catalog;
      if (!cat) return;
      for (var i = 0; i < cat.packs.length; i++) {
        state.packs[cat.packs[i].id] = !!on;
        for (var j = 0; j < cat.packs[i].sounds.length; j++) state.sounds[cat.packs[i].sounds[j].id] = !!on;
      }
      write(KEY_PACK, state.packs); write(KEY_SOUND, state.sounds); dispatch();
    },
    preview: function (id) {
      var cat = state.catalog;
      if (!cat) return false;
      for (var i = 0; i < cat.packs.length; i++) for (var j = 0; j < cat.packs[i].sounds.length; j++) {
        if (cat.packs[i].sounds[j].id === id) {
          var s = cat.packs[i].sounds[j];
          return playSound(s) || playFallback(s);
        }
      }
      return false;
    },
    fire: function (event, opts) {
      var o = opts || {};
      if (!state.on || muted()) return false;
      var now = Date.now();
      if (!o.force && now - state.last < RATE_MS) return false;
      var list = soundsFor(event);
      var caps = captionsFor(event);
      var fired = false;
      if (list.length) {
        var pick = list[Math.floor(Math.random() * list.length)];
        fired = playSound(pick) || playFallback(pick);
        state.last = now;
      }
      var reaction = null;
      if (caps.length) reaction = caps[Math.floor(Math.random() * caps.length)];
      if ((fired || reaction) && !o.silent && typeof window.speakReaction === 'function') {
        try { window.speakReaction(reaction || '', o); } catch (e) {}
      }
      if (fired || reaction) dispatch();
      return fired;
    },
    isOn: function () { return !!state.on; },
    open: function () { render(true); },
    close: function () { hide(); },
    toggle: function () { var p = ensure(); if (!p) return; var open = p.classList.contains('show'); if (open) hide(); else render(true); },
    load: load
  };
  window.ChessMemes = API;

  function dispatch() {
    try { ChessMods.emit('memes', { on: state.on, vol: state.vol }); } catch (e) {}
    var fill = document.getElementById('memeVolFill');
    if (fill) fill.style.width = Math.round(state.vol * 100) + '%';
    refreshCount();
  }

  function refreshCount() {
    var cat = state.catalog;
    var label = document.getElementById('memeCount');
    if (!label || !cat) return;
    var total = 0, on = 0;
    for (var i = 0; i < cat.packs.length; i++) for (var j = 0; j < cat.packs[i].sounds.length; j++) {
      total++;
      if (state.packs[cat.packs[i].id] !== false && state.sounds[cat.packs[i].sounds[j].id] !== false) on++;
    }
    label.textContent = on + ' of ' + total + ' memes active';
    var master = document.getElementById('memeMaster');
    if (master) master.checked = state.on !== false;
  }

  function ensure() {
    var panel = document.getElementById('memePanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'memePanel';
    panel.className = 'modal-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Meme settings');
    panel.innerHTML =
      '<button class="btn panel-exit-btn" id="btnMemeClose" title="Close meme settings">\uD83D\uDEAA Exit</button>' +
      '<h3>\uD83D\uDE02 Memes</h3>' +
      '<div class="meme-master">' +
      '<label for="memeMaster">Memes on</label>' +
      '<input type="checkbox" id="memeMaster" checked>' +
      '<span class="meme-count" id="memeCount"></span>' +
      '</div>' +
      '<div class="meme-vol"><span>\uD83D\uDD08</span>' +
      '<div class="meme-vol-track" id="memeVolTrack" role="slider" tabindex="0" aria-label="Meme sound volume" aria-valuemin="0" aria-valuemax="100">' +
      '<div class="meme-vol-fill" id="memeVolFill"></div></div>' +
      '<span class="meme-vol-val" id="memeVolVal">90%</span></div>' +
      '<div class="meme-voice">' +
      '<label for="memeSpeech"><span>\uD83D\uDDE3\uFE0F Spoken voice lines</span></label>' +
      '<input type="checkbox" id="memeSpeech" checked>' +
      '<button class="btn" id="memeSpeechTest" title="Hear a sample">\u25B6 Test</button>' +
      '</div>' +
      '<div class="meme-tools">' +
      '<button class="btn" id="memeAllOn">\u2705 All on</button>' +
      '<button class="btn" id="memeAllOff">\u274C All off</button>' +
      '<button class="btn" id="memePreviewAll">\u25B6 Preview all</button>' +
      '</div>' +
      '<div class="meme-rate" id="memeRate" role="group" aria-label="How often memes fire">' +
      '<button class="btn" data-rate="rare">\uD83D\uDC22 Rare</button>' +
      '<button class="btn" data-rate="normal">\uD83D\uDE42 Normal</button>' +
      '<button class="btn" data-rate="chaos">\uD83D\uDD25 Chaos</button>' +
      '</div>' +
      '<div class="meme-list" id="memeList"></div>' +
      '<div class="meme-foot" id="memeFoot">Every meme is an original synthesised sound generated for this game.</div>';
    document.body.appendChild(panel);
    var st = document.createElement('style');
    st.textContent =
      '#memePanel{width:min(94vw,470px);max-height:86vh;overflow-y:auto;padding-bottom:10px}' +
      '.meme-master{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);font-weight:700;font-size:.85rem}' +
      '.meme-master input{width:20px;height:20px;accent-color:var(--accent)}' +
      '.meme-count{margin-left:auto;color:var(--cc-muted);font-weight:600;font-size:.72rem}' +
      '.meme-vol{display:flex;align-items:center;gap:8px;margin:8px 0 4px;font-size:.8rem}' +
      '.meme-vol-track{position:relative;flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.12);cursor:pointer}' +
      '.meme-vol-fill{position:absolute;left:0;top:0;bottom:0;width:90%;border-radius:6px;background:var(--accent)}' +
      '.meme-vol-track:focus-visible{outline:2px solid var(--accent);outline-offset:3px}' +
      '.meme-vol-val{min-width:38px;text-align:right;color:var(--cc-muted);font-weight:700}' +
      '.meme-voice{display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);font-size:.8rem;font-weight:700}' +
      '.meme-voice input{width:18px;height:18px;accent-color:var(--accent)}' +
      '.meme-voice button{margin-left:auto;font-size:.68rem;padding:4px 10px}' +
      '.meme-tools{display:flex;gap:6px;margin:8px 0}' +
      '.meme-tools .btn{flex:1;justify-content:center}' +
      '.meme-rate{display:flex;gap:6px;margin:0 0 8px}' +
      '.meme-rate .btn{flex:1;justify-content:center;font-size:.72rem}' +
      '.meme-rate .btn.active{background:var(--accent);color:#0b0b12;border-color:var(--accent)}' +
      '.meme-pack{margin:8px 0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;background:rgba(255,255,255,.03)}' +
      '.meme-pack-head{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,.05);font-weight:700;font-size:.82rem}' +
      '.meme-pack-head input{width:18px;height:18px;accent-color:var(--accent)}' +
      '.meme-pack-desc{color:var(--cc-muted);font-weight:500;font-size:.68rem;display:block;margin-top:2px}' +
      '.meme-pack-solo{margin-left:auto;font-size:.62rem;padding:3px 8px}' +
      '.meme-rows{display:grid;gap:2px;padding:6px}' +
      '.meme-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px;font-size:.76rem}' +
      '.meme-row:hover{background:rgba(255,255,255,.05)}' +
      '.meme-row input{width:17px;height:17px;accent-color:var(--accent)}' +
      '.meme-row .meme-when{margin-left:auto;font-size:.62rem;color:var(--cc-muted);background:rgba(255,255,255,.07);padding:2px 6px;border-radius:6px}' +
      '.meme-play{border:0;background:rgba(255,255,255,.1);color:inherit;border-radius:7px;padding:3px 7px;cursor:pointer;font-size:.75rem}' +
      '.meme-play:hover{background:var(--accent);color:#0b0b12}' +
      '.meme-section{margin:12px 0 4px;font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--cc-muted)}' +
      '.meme-cap-row .meme-when{max-width:46%;text-align:right}' +
      '.meme-foot{margin-top:8px;font-size:.64rem;color:var(--cc-muted);text-align:center}' +
      '.meme-flag{position:absolute;left:50%;bottom:8%;transform:translateX(-50%);padding:8px 16px;border-radius:14px;background:rgba(8,8,18,.86);border:2px solid var(--accent);color:#fff;font-weight:800;font-size:clamp(.8rem,3.4vw,1.05rem);z-index:24;pointer-events:none;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:memeFlag 2.4s ease forwards}' +
      '@keyframes memeFlag{0%{opacity:0;transform:translateX(-50%) translateY(14px) scale(.8)}12%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.04)}20%{transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-10px)}}';
    document.head.appendChild(st);
    wire(panel);
    return panel;
  }

  function wire(panel) {
    var close = panel.querySelector('#btnMemeClose');
    if (close) close.addEventListener('click', hide);
    panel.addEventListener('click', function (e) { if (e.target === panel) hide(); });
    panel.addEventListener('change', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var sound = t.getAttribute('data-sound');
      var pack = t.getAttribute('data-pack-toggle');
      var cap = t.getAttribute('data-caption');
      if (sound) API.setMeme(sound, t.checked);
      else if (pack) { API.setPack(pack, t.checked); render(false); }
      else if (cap) API.setCaption(cap, t.checked);
    });
    panel.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var play = t.getAttribute('data-play');
      var solo = t.getAttribute('data-pack-solo');
      var rate = t.getAttribute('data-rate');
      if (play) { API.preview(play); e.preventDefault(); }
      else if (solo) { API.setPackOnly(solo); render(false); e.preventDefault(); }
      else if (rate) { API.setRate(rate); e.preventDefault(); }
    });
    var master = panel.querySelector('#memeMaster');
    if (master) master.addEventListener('change', function () { state.on = !!this.checked; write(KEY_MASTER, state.on); refreshCount(); });
    var speech = panel.querySelector('#memeSpeech');
    if (speech) speech.addEventListener('change', function () { API.setSpeech(!!this.checked); });
    var speechTest = panel.querySelector('#memeSpeechTest');
    if (speechTest) speechTest.addEventListener('click', function () { API.speak('Nice move. But can you keep it up?'); });
    var allOn = panel.querySelector('#memeAllOn');
    if (allOn) allOn.addEventListener('click', function () { API.setAll(true); render(false); });
    var allOff = panel.querySelector('#memeAllOff');
    if (allOff) allOff.addEventListener('click', function () { API.setAll(false); render(false); });
    var prevAll = panel.querySelector('#memePreviewAll');
    if (prevAll) prevAll.addEventListener('click', function () { API.previewAll(); });
    var track = panel.querySelector('#memeVolTrack');
    if (track) {
      var setFromEvent = function (e) {
        var r = track.getBoundingClientRect();
        var v = (e.clientX - r.left) / Math.max(1, r.width);
        API.setSoundVolume(v);
        var val = panel.querySelector('#memeVolVal');
        if (val) val.textContent = Math.round(state.vol * 100) + '%';
      };
      track.addEventListener('pointerdown', setFromEvent);
      track.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { API.setSoundVolume(state.vol - 0.1); e.preventDefault(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { API.setSoundVolume(state.vol + 0.1); e.preventDefault(); }
        var val = panel.querySelector('#memeVolVal');
        if (val) val.textContent = Math.round(state.vol * 100) + '%';
      });
    }
  }

  var WHEN_LABEL = {
    blunder: 'blunder', capture: 'capture', check: 'check', checkmate: 'mate', castle: 'castle',
    promote: 'promote', win: 'you win', lose: 'you lose', draw: 'draw', start: 'new game',
    undo: 'undo', hint: 'hint', combo3: 'combo'
  };

  function render(show) {
    var panel = ensure();
    var list = panel.querySelector('#memeList');
    var cat = state.catalog;
    if (!cat) {
      list.innerHTML = '<div class="meme-row">Loading meme bank\u2026</div>';
    } else {
      var html = '';
      for (var i = 0; i < cat.packs.length; i++) {
        var p = cat.packs[i];
        var packOn = state.packs[p.id] !== false;
        html += '<div class="meme-pack" data-pack="' + p.id + '">';
        html += '<div class="meme-pack-head"><input type="checkbox" data-pack-toggle="' + p.id + '"' + (packOn ? ' checked' : '') + '>' +
          '<span>' + (p.emoji || '') + ' ' + esc(p.name) + '<span class="meme-pack-desc">' + esc(p.desc || '') + '</span></span>' +
          '<button class="btn meme-pack-solo" data-pack-solo="' + p.id + '" title="Only this pack">solo</button></div>';
        html += '<div class="meme-rows">';
        for (var j = 0; j < p.sounds.length; j++) {
          var s = p.sounds[j];
          var on = state.sounds[s.id] !== false;
          html += '<label class="meme-row">' +
            '<input type="checkbox" data-sound="' + s.id + '"' + (on ? ' checked' : '') + '>' +
            '<span>' + esc(s.label) + '</span>' +
            '<button class="meme-play" data-play="' + s.id + '" title="Preview">\u25B6</button>' +
            '<span class="meme-when">' + (WHEN_LABEL[s.when] || s.when) + '</span></label>';
        }
        html += '</div></div>';
      }
      html += '<div class="meme-section">Reaction captions</div>';
      var caps = state.captions;
      var capIds = [];
      for (var cid in caps) capIds.push(cid);
      if (!capIds.length) html += '<div class="meme-row">No caption packs loaded</div>';
      for (var ci = 0; ci < capIds.length; ci++) {
        var cp = caps[capIds[ci]];
        var capOn = state.caps[capIds[ci]] !== false;
        html += '<label class="meme-row meme-cap-row">' +
          '<input type="checkbox" data-caption="' + capIds[ci] + '"' + (capOn ? ' checked' : '') + '>' +
          '<span>' + (cp.emoji || '💬') + ' ' + esc(cp.name || capIds[ci]) + '</span>' +
          '<span class="meme-when">' + esc(cp.desc || '') + '</span></label>';
      }
      list.innerHTML = html;
    }
    var val = panel.querySelector('#memeVolVal');
    if (val) val.textContent = Math.round(state.vol * 100) + '%';
    var sp = panel.querySelector('#memeSpeech');
    if (sp) { sp.checked = state.speech !== false; sp.disabled = !API.speechAvailable(); }
    var spTest = panel.querySelector('#memeSpeechTest');
    if (spTest) spTest.disabled = !API.speechAvailable();
    var rateWrap = panel.querySelector('#memeRate');
    if (rateWrap) Array.prototype.forEach.call(rateWrap.querySelectorAll('[data-rate]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-rate') === state.rate);
    });
    refreshCount();
    if (show) panel.classList.add('show');
    if (show && typeof window.syncModalState === 'function') window.syncModalState();
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hide() {
    var panel = document.getElementById('memePanel');
    if (panel) panel.classList.remove('show');
    if (typeof window.syncModalState === 'function') window.syncModalState();
  }

  // Real speech instead of formant synthesis: the browser's own voice reads the
  // line, which sounds like a person and needs no audio files at all.
  function speakText(text) {
    if (!text || state.speech === false) return false;
    if (typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance === 'undefined') return false;
    try {
      var clean = String(text).replace(/[^A-Za-z0-9\s'!?.,-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!clean) return false;
      var u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.08; u.pitch = 1.0;
      u.volume = Math.max(0.2, Math.min(1, state.vol));
      var voices = window.speechSynthesis.getVoices() || [];
      var pick = null;
      for (var i = 0; i < voices.length; i++) {
        var v = voices[i];
        if (!v || !v.lang || !/^en/i.test(v.lang)) continue;
        if (!pick) pick = v;
        if (!v.localService) { pick = v; break; }
      }
      if (pick) u.voice = pick;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function flag(text) {
    if (!text) return;
    var wrap = document.getElementById('gameWrap');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'meme-flag';
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2400);
  }
  window.speakReaction = function (text) {
    if (!text) return;
    flag(text);
    speakText(text);
  };
  window.memeCaption = flag;

  function adoptCatalog(json) {
    state.catalog = json;
    for (var i = 0; i < json.packs.length; i++) {
      if (state.packs[json.packs[i].id] === undefined) state.packs[json.packs[i].id] = json.packs[i].on === true;
      for (var j = 0; j < json.packs[i].sounds.length; j++) {
        var s = json.packs[i].sounds[j];
        if (state.sounds[s.id] === undefined) state.sounds[s.id] = true;
        s.src = 'audio/memes/' + s.file;
      }
    }
    dispatch();
    render(false);
  }
  function adoptCaptions(json) {
    state.captions = json || {};
    state.caps = read(KEY_CAP, {}) || {};
    for (var id in state.captions) if (state.caps[id] === undefined) state.caps[id] = false;
  }
  function loadInline() {
    if (window.__MEME_BANK && window.__MEME_BANK.packs) { adoptCatalog(window.__MEME_BANK); return true; }
    return false;
  }
  function load() {
    state.on = read(KEY_MASTER, false);
    state.packs = read(KEY_PACK, {}) || {};
    state.sounds = read(KEY_SOUND, {}) || {};
    state.vol = read(KEY_VOL, 0.9);
    state.speech = read(KEY_SPEECH, true);
    state.rate = read(KEY_RATE, 'normal');
    RATE_MS = RATES[state.rate] || 900;
    if (window.__MEME_CAPTIONS) adoptCaptions(window.__MEME_CAPTIONS);
    const inline = loadInline();
    if (!inline) {
      fetch(CATALOG_URL, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (json) { adoptCatalog(json); })
        .catch(function () { state.catalog = null; render(false); });
    }
    if (!window.__MEME_CAPTIONS) {
      fetch(CAPTIONS_URL, { cache: 'force-cache' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (json) { adoptCaptions(json); })
        .catch(function () { state.captions = {}; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
