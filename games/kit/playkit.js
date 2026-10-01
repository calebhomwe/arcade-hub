/* PlayKit: small shared helpers for the Pocket Arcade games.
 *
 *   PlayKit.rm                      true when the player asked for reduced motion
 *   PlayKit.coach({key, steps, theme, onDone})
 *       A step-by-step coach card that teaches by doing. Each step is {text, target, on}:
 *       `target` (a CSS selector) gets a glowing ring, and a step with `on` waits until the game
 *       calls coach.did(on); a step without it shows a Next button. Skip ends it at any time.
 *       Finishing or skipping stores `key` in localStorage, so PlayKit.seen(key) is true afterwards.
 *   PlayKit.progress({key, title, bands, unit, theme})
 *       Learning records for grown-ups: p.record(band, ok, item), p.session(), p.open() shows the
 *       report (accuracy per level band, practice days, the items missed most, a suggested next step),
 *       p.button(parent, className) adds a "Grown-ups" button, p.suggest() returns the next-step text.
 *   PlayKit.codes(on, parent)       show or hide a small "CODES ON" pill
 *   PlayKit.mathHint('7 × 8')       a strategy for a sum (make a ten, split and double...), never the answer
 *
 * Styling follows the game: pass theme {panel, fg, accent, font}. Nothing here needs the arcade SDK.
 */
(function () {
  'use strict';
  if (window.PlayKit) return;
  var D = document, W = window;
  var rm = false; try { rm = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  function ls(k, v) { try { if (v === undefined) return W.localStorage.getItem(k); W.localStorage.setItem(k, v); } catch (e) {} return null; }
  function el(tag, cls, text) { var e = D.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = el('style');
    s.textContent =
      '.pk-card{position:fixed;left:50%;transform:translateX(-50%);z-index:9000;width:min(420px,calc(100vw - 24px));box-sizing:border-box;' +
      'background:var(--pk-panel,#101a33);color:var(--pk-fg,#e9edff);border:2px solid var(--pk-accent,#22d3ee);border-radius:18px;padding:12px 14px;' +
      'box-shadow:0 14px 40px rgba(0,0,0,.5);font:600 15px/1.4 var(--pk-font,system-ui,-apple-system,sans-serif);text-align:center}' +
      '.pk-card.top{top:64px}.pk-card.bot{bottom:14px}' +
      '.pk-card .pk-n{font-size:12px;font-weight:900;letter-spacing:2px;color:var(--pk-accent,#22d3ee);margin-bottom:4px}' +
      '.pk-card .pk-row{display:flex;gap:8px;justify-content:center;margin-top:10px}' +
      '.pk-card button,.pk-rep button{min-height:44px;min-width:44px;padding:0 16px;border-radius:12px;border:2px solid var(--pk-accent,#22d3ee);' +
      'background:transparent;color:var(--pk-fg,#e9edff);font:800 15px var(--pk-font,system-ui,sans-serif);cursor:pointer}' +
      '.pk-card button.pk-go,.pk-rep button.pk-go{background:var(--pk-accent,#22d3ee);color:var(--pk-panel,#101a33)}' +
      '.pk-card button:focus-visible,.pk-rep button:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
      '.pk-focus{outline:3px solid var(--pk-accent,#22d3ee)!important;outline-offset:4px;border-radius:12px;animation:pkRing 1.1s ease-in-out infinite}' +
      '@keyframes pkRing{50%{outline-offset:9px}}' +
      '.pk-rep-bg{position:fixed;inset:0;z-index:9100;background:rgba(3,6,16,.72);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '.pk-rep{width:min(460px,100%);max-height:calc(100dvh - 24px);overflow:auto;box-sizing:border-box;background:var(--pk-panel,#101a33);color:var(--pk-fg,#e9edff);' +
      'border:2px solid var(--pk-accent,#22d3ee);border-radius:20px;padding:16px;font:500 14px/1.45 var(--pk-font,system-ui,sans-serif);text-align:left}' +
      '.pk-rep h2{margin:0 0 2px;font-size:20px}.pk-rep .pk-sub{opacity:.8;font-size:13px;margin:0 0 10px}' +
      '.pk-rep .pk-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;text-align:center}' +
      '.pk-rep .pk-stats div{background:rgba(255,255,255,.07);border-radius:12px;padding:6px 4px;font-size:12px}.pk-rep .pk-stats b{display:block;font-size:18px}' +
      '.pk-rep table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:10px}.pk-rep td,.pk-rep th{padding:5px 4px;border-bottom:1px solid rgba(255,255,255,.1)}' +
      '.pk-rep th{text-align:left;font-size:12px;opacity:.8}.pk-rep .pk-bar{height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;min-width:50px}' +
      '.pk-rep .pk-bar i{display:block;height:100%;background:var(--pk-accent,#22d3ee)}.pk-rep h3{font-size:14px;margin:8px 0 4px}' +
      '.pk-rep .pk-next{background:rgba(255,255,255,.07);border-left:4px solid var(--pk-accent,#22d3ee);border-radius:10px;padding:8px 10px;margin:8px 0}' +
      '.pk-rep .pk-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap}' +
      '.pk-codes{position:fixed;left:50%;transform:translateX(-50%);top:12px;z-index:60;background:rgba(7,7,15,.78);color:#facc15;font:900 12px system-ui,sans-serif;' +
      'letter-spacing:2px;padding:6px 12px;border-radius:999px;pointer-events:none}' +
      '@media (prefers-reduced-motion:reduce){.pk-focus{animation:none}}';
    (D.head || D.documentElement).appendChild(s);
  }
  function theme(node, t) {
    t = t || {};
    if (t.panel) node.style.setProperty('--pk-panel', t.panel);
    if (t.fg) node.style.setProperty('--pk-fg', t.fg);
    if (t.accent) node.style.setProperty('--pk-accent', t.accent);
    if (t.font) node.style.setProperty('--pk-font', t.font);
  }

  /* ---------- coach marks ---------- */
  var live = null;
  function coach(o) {
    style();
    if (live) live.stop(true);
    var i = -1, card = el('div', 'pk-card bot'), ringed = null, done = false;
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'polite');
    theme(D.documentElement, o.theme);
    var num = el('div', 'pk-n'), txt = el('div'), row = el('div', 'pk-row');
    var skip = el('button', '', 'Skip'), next = el('button', 'pk-go', 'Next');
    skip.type = next.type = 'button';
    card.appendChild(num); card.appendChild(txt); card.appendChild(row); row.appendChild(skip); row.appendChild(next);
    function stop(silent) {
      if (done) return; done = true;
      if (ringed) ringed.classList.remove('pk-focus');
      if (card.parentNode) card.parentNode.removeChild(card);
      if (live === api) live = null;
      if (o.key) ls(o.key, '1');
      if (!silent && o.onDone) try { o.onDone(); } catch (e) {}
    }
    function show(n) {
      i = n;
      if (ringed) { ringed.classList.remove('pk-focus'); ringed = null; }
      if (i >= o.steps.length) { stop(); return; }
      var s = o.steps[i];
      num.textContent = (o.title ? o.title + ' · ' : '') + 'STEP ' + (i + 1) + ' OF ' + o.steps.length;
      txt.textContent = s.text;
      next.style.display = s.on ? 'none' : '';
      next.textContent = i === o.steps.length - 1 ? 'Got it' : 'Next';
      var t = s.target ? D.querySelector(s.target) : null;
      if (t) {
        ringed = t; t.classList.add('pk-focus');
        var r = t.getBoundingClientRect();
        if (s.place) card.className = 'pk-card ' + s.place;
        else {
          // Put the card on the side that covers the least of the target.
          var cover = function (side) { card.className = 'pk-card ' + side; var c = card.getBoundingClientRect(); return Math.max(0, Math.min(c.bottom, r.bottom) - Math.max(c.top, r.top)); };
          var first = r.top + r.height / 2 > innerHeight * 0.55 ? 'top' : 'bot', other = first === 'top' ? 'bot' : 'top';
          var a1 = cover(first); if (a1 > 0 && cover(other) >= a1) cover(first);
        }
      }
      else card.className = 'pk-card ' + (s.place || 'bot');
    }
    skip.addEventListener('click', function (e) { e.stopPropagation(); stop(); });
    next.addEventListener('click', function (e) { e.stopPropagation(); show(i + 1); });
    card.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    D.body.appendChild(card);
    var api = {
      did: function (name) { if (!done && i >= 0 && o.steps[i] && o.steps[i].on === name) show(i + 1); },
      stop: stop,
      get active() { return !done; },
      get step() { return i; }
    };
    live = api;
    show(0);
    return api;
  }

  /* ---------- learning progress for grown-ups ---------- */
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function progress(o) {
    style();
    var data;
    function load() { try { data = JSON.parse(ls(o.key) || 'null'); } catch (e) { data = null; } if (!data || typeof data !== 'object') data = { bands: {}, miss: {}, days: [], sessions: 0 }; data.bands = data.bands || {}; data.miss = data.miss || {}; data.days = data.days || []; }
    function save() { ls(o.key, JSON.stringify(data)); }
    load();
    function mark() { var t = today(); if (data.days.indexOf(t) === -1) { data.days.push(t); if (data.days.length > 60) data.days.shift(); } }
    function label(b) { return (o.bands && o.bands[b]) || String(b); }
    function suggest() {
      var keys = Object.keys(o.bands || {}), best = null;
      for (var k = 0; k < keys.length; k++) {
        var r = data.bands[keys[k]]; if (!r || r.n < 8) continue;
        var acc = r.ok / r.n;
        if (acc < 0.6) return 'Stay with ' + label(keys[k]) + ' for now: ' + Math.round(acc * 100) + '% right. Use the hints and practise the words below together.';
        if (acc >= 0.85) best = k;
      }
      if (best != null && best + 1 < keys.length) return 'Ready to move up: ' + Math.round(data.bands[keys[best]].ok / data.bands[keys[best]].n * 100) + '% right at ' + label(keys[best]) + '. Try ' + label(keys[best + 1]) + ' next.';
      if (best != null) return 'Top level mastered. Keep it fresh with a short game a few times a week.';
      return 'Play a few rounds (about 8 answers per level) and a suggestion will appear here.';
    }
    var api = {
      record: function (band, ok, item) {
        var r = data.bands[band] || (data.bands[band] = { n: 0, ok: 0 });
        r.n++; if (ok) r.ok++;
        if (item != null && item !== '') { var m = data.miss[item]; if (!ok) data.miss[item] = (m || 0) + 1; else if (m) { data.miss[item] = m - 1; if (data.miss[item] <= 0) delete data.miss[item]; } }
        var ks = Object.keys(data.miss); if (ks.length > 40) { ks.sort(function (a, b) { return data.miss[a] - data.miss[b]; }); delete data.miss[ks[0]]; }
        mark(); save();
      },
      session: function () { data.sessions = (data.sessions || 0) + 1; mark(); save(); },
      suggest: suggest,
      data: function () { return data; },
      open: function () {
        load();
        var bg = el('div', 'pk-rep-bg'), box = el('div', 'pk-rep'); theme(bg, o.theme);
        box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Progress report for grown-ups');
        box.appendChild(el('h2', '', '👪 For grown-ups'));
        box.appendChild(el('p', 'pk-sub', o.title + ': what your learner has practised on this device.'));
        var n = 0, ok = 0, keys = Object.keys(o.bands || {});
        Object.keys(data.bands).forEach(function (b) { n += data.bands[b].n; ok += data.bands[b].ok; });
        var wk = 0, now = Date.now();
        data.days.forEach(function (d) { var p = d.split('-'); var t = new Date(+p[0], +p[1] - 1, +p[2]).getTime(); if (now - t < 7 * 864e5) wk++; });
        var st = el('div', 'pk-stats');
        [[n, (o.unit || 'answers')], [n ? Math.round(ok / n * 100) + '%' : '—', 'right'], [wk, 'days this week']].forEach(function (x) { var c = el('div'); c.appendChild(el('b', '', String(x[0]))); c.appendChild(D.createTextNode(x[1])); st.appendChild(c); });
        box.appendChild(st);
        var tb = el('table'), hr = el('tr');
        ['Level', 'Tried', 'Right', ''].forEach(function (h) { hr.appendChild(el('th', '', h)); }); tb.appendChild(hr);
        keys.forEach(function (b) {
          var r = data.bands[b] || { n: 0, ok: 0 }, tr = el('tr'), pct = r.n ? Math.round(r.ok / r.n * 100) : 0;
          tr.appendChild(el('td', '', label(b))); tr.appendChild(el('td', '', String(r.n))); tr.appendChild(el('td', '', r.n ? pct + '%' : '—'));
          var td = el('td'), bar = el('div', 'pk-bar'), fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); td.appendChild(bar); tr.appendChild(td);
          tb.appendChild(tr);
        });
        box.appendChild(tb);
        box.appendChild(el('h3', '', 'Suggested next step'));
        box.appendChild(el('div', 'pk-next', suggest()));
        var miss = Object.keys(data.miss).sort(function (a, b) { return data.miss[b] - data.miss[a]; }).slice(0, 10);
        box.appendChild(el('h3', '', 'Worth practising together'));
        box.appendChild(el('p', '', miss.length ? miss.map(function (m) { return m + (data.miss[m] > 1 ? ' (×' + data.miss[m] + ')' : ''); }).join(' · ') : 'Nothing yet: items that are missed show up here, and drop off once they are answered right.'));
        box.appendChild(el('p', 'pk-sub', (data.sessions || 0) + ((data.sessions || 0) === 1 ? ' game' : ' games') + ' played · ' + data.days.length + (data.days.length === 1 ? ' practice day' : ' practice days') + ' in all. Stored only on this device.'));
        var row = el('div', 'pk-row'), reset = el('button', '', 'Reset progress'), close = el('button', 'pk-go', 'Close');
        reset.type = close.type = 'button';
        var armed = false;
        reset.addEventListener('click', function () { if (!armed) { armed = true; reset.textContent = 'Tap again to reset'; return; } data = { bands: {}, miss: {}, days: [], sessions: 0 }; save(); shut(); api.open(); });
        function shut() { if (bg.parentNode) bg.parentNode.removeChild(bg); if (o.onClose) try { o.onClose(); } catch (e) {} }
        close.addEventListener('click', shut);
        bg.addEventListener('click', function (e) { if (e.target === bg) shut(); });
        row.appendChild(reset); row.appendChild(close); box.appendChild(row);
        bg.appendChild(box); D.body.appendChild(bg);
        close.focus();
      },
      button: function (parent, cls) {
        var b = el('button', cls || '', '👪 Grown-ups'); b.type = 'button';
        b.addEventListener('click', function (e) { e.stopPropagation(); api.open(); });
        if (parent) parent.appendChild(b);
        return b;
      }
    };
    return api;
  }

  /* ---------- "CODES ON" pill ---------- */
  var pill = null;
  function codes(on, parent) {
    style();
    if (!pill) { pill = el('div', 'pk-codes', 'CODES ON'); pill.setAttribute('aria-live', 'polite'); }
    if (on) { if (!pill.parentNode) (parent || D.body).appendChild(pill); }
    else if (pill.parentNode) pill.parentNode.removeChild(pill);
  }

  /* ---------- a strategy hint for a sum such as "7 × 8" (never just the answer) ---------- */
  function mathHint(text) {
    var m = String(text).replace(/\s+/g, ' ').match(/(-?\d+)\s*([+\-−×x*÷\/])\s*(-?\d+)/);
    if (!m) return '';
    var a = +m[1], op = m[2], b = +m[3];
    if (op === '+') {
      var big = Math.max(a, b), small = Math.min(a, b);
      if (small <= 5) return 'Start at ' + big + ' and count on ' + small + ' more.';
      if (big % 10 && small % 10 && big > 9) { var t = Math.ceil(big / 10) * 10, need = t - big; if (need < small) return 'Make a ten: ' + big + ' + ' + need + ' = ' + t + ', then add the ' + (small - need) + ' left over.'; }
      return 'Add the tens first, then the ones: ' + a + ' + ' + b + '.';
    }
    if (op === '-' || op === '−') {
      if (b <= 5) return 'Start at ' + a + ' and count back ' + b + '.';
      return 'Count up from ' + b + ' to ' + a + ': how many steps is that?';
    }
    if (op === '×' || op === 'x' || op === '*') {
      if (a === 0 || b === 0) return 'Anything times 0 is 0.';
      if (a === 1 || b === 1) return 'Anything times 1 stays the same.';
      var s1 = Math.min(a, b), l1 = Math.max(a, b);
      if (s1 === 2) return 'Times 2 is doubling: double ' + l1 + '.';
      if (s1 === 5) return 'Count in fives, ' + l1 + ' times: 5, 10, 15...';
      if (a === 10 || b === 10) return 'Times 10: put a 0 on the end of ' + (a === 10 ? b : a) + '.';
      if (s1 % 2 === 0) return 'Split it: ' + (s1 / 2) + ' × ' + l1 + ' = ' + (s1 / 2 * l1) + ', then double that.';
      return 'Break it up: ' + (s1 - 1) + ' × ' + l1 + ' = ' + ((s1 - 1) * l1) + ', then add one more ' + l1 + '.';
    }
    if (op === '÷' || op === '/') return 'Think of the ' + b + ' times table: what times ' + b + ' makes ' + a + '?';
    return '';
  }

  W.PlayKit = { rm: rm, mathHint: mathHint, coach: coach, progress: progress, codes: codes, seen: function (k) { return ls(k) === '1'; } };
})();
