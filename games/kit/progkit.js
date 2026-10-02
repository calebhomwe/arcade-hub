/* progkit.js: the "reason to come back tomorrow" layer for hub games that do not use metakit or kidskit.
 * One localStorage key per game, everything try/catch guarded, no timers, no dependencies.
 *
 *   const prog = ProgKit.create({
 *     key: 'tower_prog_v1', accent: '#a78bfa', sfx: n => snd(n), toast: t => floats.push(...),
 *     skins: [{id:'sunset', name:'Sunset', cost:30, sw:['#f97316','#facc15'], hue:{base:8,step:18}}, ...],
 *     goals: [{id:'h15', txt:'Reach height 15 in one run', stat:'maxH', kind:'max', target:15, rw:15}],
 *     dailies: [{id:'d1', txt:'Reach height 15 today', stat:'maxH', kind:'max', target:15, rw:25}],
 *     achievements: [{id:'h25', icon:'🗼', txt:'Stack 25 high', test: d => d.stats.maxH >= 25}],
 *     onSkin(skin) {}, xp0: 0, levelOf: null, cheated: () => false,
 *   });
 *   prog.beginRun();  prog.event('blocks', 1);  prog.stat('maxH', 17);
 *   prog.addCoins(4); prog.addXp(8);
 *   prog.awardRun({ coins: 12, xp: 24, best: 30 });   // at game over: pays out, checks goals
 *   prog.mount(titleEl);  prog.mountHud(hudEl);       // visible progress, no menus needed
 *
 * Saved blob fields are named so progress tools can read them: best, coins, xp, level, stars,
 * streak, daily, unlocked, skin, achievements. A cheated run never writes the blob.
 */
(function (G) {
  'use strict';
  var D = G.document;
  function todayStr(off) {
    var x = new Date(Date.now() + (off || 0));
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function dayHash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var CSS = [
    '.pk{--pk-accent:#a78bfa;--pk-ink:#e2e8f0;font-family:inherit;-webkit-tap-highlight-color:transparent;text-align:center}',
    '.pk *{box-sizing:border-box}',
    '.pk button{font-family:inherit;cursor:pointer;border:0}',
    '.pk-strip{width:min(96%,360px);margin:0 auto;display:flex;flex-direction:column;gap:7px;align-items:stretch;font-size:13px;font-weight:800;color:var(--pk-ink)}',
    '.pk-lvrow{display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap}',
    '.pk-lv{min-width:56px;padding:6px 10px;border-radius:11px;background:rgba(255,255,255,.12);letter-spacing:.5px}',
    '.pk-xp{flex:1 1 120px;max-width:170px;height:12px;border-radius:99px;background:rgba(0,0,0,.45);overflow:hidden;border:1px solid rgba(255,255,255,.18)}',
    '.pk-xp i{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--pk-accent),#fff8);transition:width .5s ease}',
    '.pk-xp small{display:none}',
    '.pk-chips{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}',
    '.pk-chips span{padding:5px 11px;border-radius:99px;background:rgba(255,255,255,.12);min-height:28px;display:inline-flex;align-items:center;gap:4px}',
    '.pk-daily{padding:7px 12px;border-radius:13px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);display:flex;gap:8px;align-items:center;justify-content:space-between;font-size:12.5px;line-height:1.25;text-align:left}',
    '.pk-daily b{font-weight:900;color:#fde68a}',
    '.pk-dbar{flex:1 1 60px;max-width:90px;height:9px;border-radius:99px;background:rgba(0,0,0,.5);overflow:hidden}',
    '.pk-dbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#fbbf24,#fde68a);transition:width .4s}',
    '.pk-row{display:flex;gap:8px;justify-content:center}',
    '.pk-row button{flex:1 1 0;min-height:46px;border-radius:13px;background:rgba(255,255,255,.14);color:var(--pk-ink);font-size:14px;font-weight:900;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}',
    '.pk-row button:active{transform:scale(.96)}',
    '.pk-row button:focus-visible{outline:3px solid #facc15;outline-offset:2px}',
    '.pk-panel{width:min(96%,360px);margin:0 auto;max-height:44vh;overflow:auto;text-align:left;background:rgba(4,8,16,.86);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:700;color:var(--pk-ink)}',
    '.pk-ph{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.pk-ph b{font-size:16px;font-weight:900;letter-spacing:.4px}',
    '.pk-x{min-width:46px;min-height:42px;border-radius:11px;background:rgba(255,255,255,.16);color:var(--pk-ink);font-size:15px;font-weight:900}',
    '.pk-item{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:13px;padding:8px 10px}',
    '.pk-sw{width:46px;height:46px;border-radius:12px;flex:none;display:flex;gap:2px;overflow:hidden;border:1px solid rgba(255,255,255,.25)}',
    '.pk-sw i{flex:1}',
    '.pk-itx{flex:1;min-width:0}',
    '.pk-itx b{display:block;font-size:14px;font-weight:900}',
    '.pk-itx small{display:block;font-size:12px;opacity:.8;line-height:1.25}',
    '.pk-act{flex:none;min-height:42px;min-width:74px;padding:0 12px;border-radius:11px;background:linear-gradient(90deg,#4ade80,#38bdf8);color:#0c1226;font-size:13px;font-weight:900}',
    '.pk-act[disabled]{opacity:.55;filter:grayscale(.4)}',
    '.pk-act.eq{background:rgba(255,255,255,.2);color:var(--pk-ink)}',
    '.pk-gbar{height:9px;border-radius:99px;background:rgba(0,0,0,.5);overflow:hidden;margin-top:4px}',
    '.pk-gbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--pk-accent),#fff7);transition:width .4s}',
    '.pk-done{color:#4ade80}',
    '.pk-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;background:rgba(250,204,21,.16);border:1px solid rgba(250,204,21,.4);font-size:12.5px;margin:2px}',
    '.pk-badge.off{opacity:.45;border-style:dashed}',
    '.pk-note{font-size:12px;opacity:.85;line-height:1.35}',
    '.pk-hudchip{font-size:12.5px;font-weight:900;letter-spacing:.6px;opacity:.92;text-shadow:0 1px 4px rgba(0,0,0,.6);pointer-events:none}',
    '.pk-pop{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:60;padding:10px 18px;border-radius:14px;background:linear-gradient(90deg,#fbbf24,#f59e0b);color:#1c1024;font-weight:900;font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.45);animation:pkPop .5s cubic-bezier(.2,1.4,.4,1)}',
    '@keyframes pkPop{0%{opacity:0;transform:translateX(-50%) scale(.6)}60%{transform:translateX(-50%) scale(1.08)}100%{opacity:1;transform:translateX(-50%) scale(1)}}',
    '@media (prefers-reduced-motion:reduce){.pk-pop{animation:none}}'
  ].join('\n');
  if (!D.getElementById('pk-style')) {
    var st = D.createElement('style'); st.id = 'pk-style'; st.textContent = CSS; D.head.appendChild(st);
  }
  function h(tag, cls, txt) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  G.ProgKit = {
    create: function (cfg) {
      var KEY = cfg.key, SKINS = cfg.skins || [], GOALS = cfg.goals || [], DAILIES = cfg.dailies || [], ACHS = cfg.achievements || [];
      var DFLT = cfg.defaultSkin || (SKINS[0] && SKINS[0].id) || '';
      var d = { best: 0, coins: 0, xp: +cfg.xp0 || 0, level: 1, stars: 0, streak: 0, lastDay: '', daily: { d: '', n: 0, paid: 0 }, today: { d: '', s: {} }, unlocked: [], skin: DFLT, achievements: [], runs: 0, stats: {} };
      try { var raw = G.localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') for (var k in d) if (o[k] !== undefined) d[k] = o[k]; } } catch (e) {}
      if (!d.today || typeof d.today !== 'object') d.today = { d: '', s: {} };
      if (!d.daily || typeof d.daily !== 'object') d.daily = { d: '', n: 0, paid: 0 };
      function cheated() { try { return !!(cfg.cheated && cfg.cheated()); } catch (e) { return false; } }
      function save() { if (cheated()) return; try { G.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
      function need(n) { if (cfg.need) { try { return cfg.need(n); } catch (e) {} } return 40 + (n - 1) * 30; }
      function lvOf(x) { if (cfg.levelOf) { try { return cfg.levelOf(x); } catch (e) {} } var n = d.level; while (x >= need(n)) { x -= need(n); n++; } return n; }
      function lvFloor(x) { var n = 1, rem = x; while (rem >= need(n) && n < 999) { rem -= need(n); n++; } return { n: n, rem: rem, nd: need(n) }; }
      function levelNow() { return cfg.levelOf ? lvOf(d.xp) : lvFloor(d.xp).n; }
      function sfx(n) { try { if (cfg.sfx && !cheated()) cfg.sfx(n); } catch (e) {} }
      function toast(t) { try { if (cfg.toast && !cheated()) cfg.toast(t); } catch (e) {} }
      function pop(t) {
        if (cheated()) return;
        try {
          var old = D.querySelector('.pk-pop'); if (old && old.parentNode) old.parentNode.removeChild(old);
          var e = h('div', 'pk-pop', t); D.body.appendChild(e);
          G.setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1900);
        } catch (x) {}
        toast(t);
      }
      /* ---- day + daily challenge (seeded by the date, same for everyone) ---- */
      function activeDaily() { var t = todayStr(); if (d.daily.d !== t) { d.daily = { d: t, n: 0, paid: 0 }; } return DAILIES.length ? DAILIES[dayHash(t) % DAILIES.length] : null; }
      function touchDay() {
        var t = todayStr();
        if (d.today.d !== t) d.today = { d: t, s: {} };
        if (d.lastDay !== t) {
          d.streak = (d.lastDay === todayStr(-86400000)) ? (d.streak || 0) + 1 : 1;
          d.lastDay = t;
          if (d.streak > 1) pop('🔥 Day ' + d.streak + ' streak!');
        }
        activeDaily();
      }
      function checkDaily(kind, k) {
        var dl = activeDaily(); if (!dl || d.daily.paid || dl.stat !== k) return;
        var v = dl.kind === 'max' ? Math.max(d.daily.n, run[k] || 0) : ((d.today.s[k] || 0));
        d.daily.n = v;
        if (v >= dl.target) { d.daily.paid = 1; d.coins += dl.rw; d.stars += 1; pop('★ Daily done! +' + dl.rw + ' coins'); sfx('levelup'); }
        save(); paint();
      }
      function checkGoals(kind, k) {
        for (var i = 0; i < GOALS.length; i++) {
          var g = GOALS[i];
          if (g.done) continue;
          if (kind === 'sum') { if (g.kind !== 'sum' || g.stat !== k) continue; }
          else { if (g.kind !== 'max') continue; if (k != null && g.stat !== k) continue; }
          var st = k != null ? k : g.stat;
          var v = g.kind === 'max' ? Math.max(d.stats[st] || 0, run[st] || 0) : (d.stats[st] || 0);
          if (v >= g.target) { g.done = 1; d.coins += g.rw; d.stars += 1; pop('📋 Goal done: +' + g.rw + ' coins'); sfx('coin'); }
        }
        save(); paint();
      }
      function checkAchs() {
        for (var i = 0; i < ACHS.length; i++) {
          var a = ACHS[i];
          if (d.achievements.indexOf(a.id) >= 0) continue;
          var ok = false; try { ok = !!a.test(d, run); } catch (e) {}
          if (ok) { d.achievements.push(a.id); d.stars += 1; pop(a.icon + ' ' + a.txt); sfx('levelup'); }
        }
        save(); paint();
      }
      /* ---- run stats ---- */
      var run = {};
      function beginRun() { run = {}; touchDay(); save(); paint(); }
      function event(k, n) { if (cheated()) return; n = n == null ? 1 : n; run[k] = (run[k] || 0) + n; touchDay(); d.today.s[k] = (d.today.s[k] || 0) + n; d.stats[k] = (d.stats[k] || 0) + n; checkDaily('sum', k); checkGoals('sum', k); checkAchs(); save(); paint(); }
      function stat(k, v) { if (cheated()) return; touchDay(); if (v > (d.stats[k] || 0)) d.stats[k] = v; if (v > (run[k] || 0)) { run[k] = v; checkDaily('max', k); checkGoals('max', k); checkAchs(); save(); paint(); } }
      function addCoins(n) { if (cheated() || !n) return; d.coins += n; save(); paint(); }
      function addXp(n) {
        if (cheated() || !n) return;
        d.xp += n;
        var before = levelNow(), f = lvFloor(d.xp);
        d.level = f.n;
        if (f.n > before) { d.stars += 2 * (f.n - before); pop('⭐ Level ' + f.n + '! +2 stars'); sfx('levelup'); }
        save(); paint();
      }
      function awardRun(o) {
        if (cheated()) return { coins: 0, xp: 0 };
        o = o || {};
        touchDay();
        d.runs = (d.runs || 0) + 1;
        if (o.best != null && o.best > (d.best || 0)) d.best = o.best;
        var f = lvFloor(d.xp);
        var res = { coins: 0, xp: 0, levelUp: 0 };
        if (o.coins) { d.coins += o.coins; res.coins = o.coins; }
        if (o.xp) {
          d.xp += o.xp; res.xp = o.xp;
          var f2 = lvFloor(d.xp);
          if (f2.n > f.n) { d.stars += 2 * (f2.n - f.n); res.levelUp = f2.n; pop('⭐ Level ' + f2.n + '! +2 stars'); sfx('levelup'); }
        }
        checkGoals('max'); checkAchs();
        // skins that unlock at a milestone
        for (var i = 0; i < SKINS.length; i++) {
          var s = SKINS[i];
          if (s.req && d.unlocked.indexOf(s.id) < 0 && (d.stats[s.req.stat] || 0) >= s.req.v) {
            d.unlocked.push(s.id); pop('🔓 New skin: ' + s.name); sfx('levelup');
          }
        }
        save(); paint();
        return res;
      }
      /* ---- skins ---- */
      function owned(id) { return id === DFLT || d.unlocked.indexOf(id) >= 0; }
      function buy(id) {
        var s = null; for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) s = SKINS[i];
        if (!s || owned(id) || cheated()) return false;
        if (d.coins < s.cost) { pop('Need ' + (s.cost - d.coins) + ' more coins'); sfx('buzz'); return false; }
        d.coins -= s.cost; d.unlocked.push(id); equip(id); pop('🎨 ' + s.name + ' unlocked!'); sfx('win'); checkAchs();
        return true;
      }
      function equip(id) { if (!owned(id)) return false; d.skin = id; save(); applySkin(); paint(); return true; }
      function applySkin() {
        var s = null; for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === d.skin) s = SKINS[i];
        try { if (s && cfg.onSkin) cfg.onSkin(s); } catch (e) {}
      }
      /* ---- UI ---- */
      var strip = null, hudEl = null, panel = null, panelKind = '';
      function swatch(s) {
        var w = h('span', 'pk-sw');
        var cols = s.sw || ['#888', '#aaa', '#ccc'];
        for (var i = 0; i < 3; i++) { var b = h('i'); b.style.background = cols[i % cols.length]; w.appendChild(b); }
        return w;
      }
      function openPanel(kind) {
        panelKind = (panel && panelKind === kind) ? '' : kind;
        paint();
        sfx('tap');
      }
      function buildPanel() {
        panel = h('div', 'pk-panel');
        panel.setAttribute('role', 'region');
        return panel;
      }
      function paintPanel() {
        if (!panel) return;
        panel.textContent = '';
        if (!panelKind) { panel.style.display = 'none'; return; }
        panel.style.display = '';
        var close = h('button', 'pk-x', '✕'); close.setAttribute('aria-label', 'Close');
        close.addEventListener('click', function (e) { e.stopPropagation(); panelKind = ''; paint(); });
        if (panelKind === 'skins') {
          var hd = h('div', 'pk-ph'); var t = h('b', '', '🎨 Skins — buy with coins'); hd.appendChild(t); hd.appendChild(close); panel.appendChild(hd);
          panel.appendChild(h('div', 'pk-note', 'Coins come from runs, goals and the daily challenge. Tap a skin to buy or wear it.'));
          for (var i = 0; i < SKINS.length; i++) {
            (function (s) {
              var it = h('div', 'pk-item');
              it.appendChild(swatch(s));
              var tx = h('div', 'pk-itx'); tx.appendChild(h('b', '', s.name));
              var sub = owned(s.id) ? (d.skin === s.id ? 'Equipped' : 'Owned — tap to wear') : (s.req ? ('Unlock: ' + s.req.text) : ('Buy for ' + s.cost + ' coins'));
              tx.appendChild(h('small', '', sub));
              it.appendChild(tx);
              var b = h('button', 'pk-act' + (d.skin === s.id ? ' eq' : ''), d.skin === s.id ? '✓ On' : owned(s.id) ? 'Wear' : s.req ? '🔒' : 'Buy');
              if (s.req && !owned(s.id)) b.setAttribute('disabled', '');
              b.addEventListener('click', function (e) { e.stopPropagation(); if (owned(s.id)) { equip(s.id); sfx('tap'); } else if (!s.req) buy(s.id); paint(); });
              it.appendChild(b);
              panel.appendChild(it);
            })(SKINS[i]);
          }
        } else {
          var hd2 = h('div', 'pk-ph'); hd2.appendChild(h('b', '', '📋 Goals & badges')); hd2.appendChild(close.cloneNode(true));
          hd2.lastChild.addEventListener('click', function (e) { e.stopPropagation(); panelKind = ''; paint(); });
          panel.appendChild(hd2);
          for (var j = 0; j < GOALS.length; j++) {
            var g = GOALS[j];
            var have = g.kind === 'max' ? Math.max(d.stats[g.stat] || 0, run[g.stat] || 0) : (d.stats[g.stat] || 0);
            var it2 = h('div', 'pk-item' + (g.done ? '' : ''));
            var tx2 = h('div', 'pk-itx');
            var nm = h('b', '', g.txt); if (g.done) nm.className = 'pk-done';
            tx2.appendChild(nm);
            tx2.appendChild(h('small', '', (g.done ? 'Done! +' : 'Reward ') + g.rw + ' coins · ' + Math.min(have, g.target) + '/' + g.target));
            var bar = h('div', 'pk-gbar'); var fi = h('i'); fi.style.width = Math.min(100, Math.round(100 * Math.min(have, g.target) / g.target)) + '%'; bar.appendChild(fi);
            tx2.appendChild(bar);
            it2.appendChild(tx2);
            it2.appendChild(h('span', g.done ? 'pk-done' : '', g.done ? '✓' : ''));
            panel.appendChild(it2);
          }
          var brow = h('div');
          brow.appendChild(h('div', 'pk-note', 'Badges earned:'));
          var wraps = h('div'); wraps.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px';
          for (var m = 0; m < ACHS.length; m++) {
            var a = ACHS[m], got = d.achievements.indexOf(a.id) >= 0;
            wraps.appendChild(h('span', 'pk-badge' + (got ? '' : ' off'), (got ? a.icon : '·') + ' ' + a.txt));
          }
          brow.appendChild(wraps);
          panel.appendChild(brow);
        }
      }
      function paint() {
        if (strip) {
          var f = lvFloor(d.xp);
          var lvb = strip.querySelector('.pk-lv'); if (lvb) lvb.textContent = 'Level ' + levelNow();
          var bar = strip.querySelector('.pk-xp i'); if (bar) bar.style.width = Math.min(100, Math.round(100 * f.rem / f.nd)) + '%';
          var ch = strip.querySelector('.pk-chips'); if (ch) ch.textContent = '';
          if (ch) {
            var c1 = h('span', '', '🪙 ' + d.coins + ' coins'); ch.appendChild(c1);
            ch.appendChild(h('span', '', '★ ' + d.stars + ' stars'));
            ch.appendChild(h('span', '', '🔥 ' + (d.streak || 0) + ' day streak'));
          }
          var dl = activeDaily();
          var dv = strip.querySelector('.pk-daily');
          if (dv && dl) {
            var dn = dl.kind === 'max' ? Math.max(d.daily.n, run[dl.stat] || 0) : (d.today.s[dl.stat] || 0);
            dv.querySelector('b').textContent = dl.txt;
            dv.querySelector('.pk-dbar i').style.width = Math.min(100, Math.round(100 * Math.min(dn, dl.target) / dl.target)) + '%';
            dv.querySelector('small').textContent = d.daily.paid ? '★ done! +' + dl.rw + ' coins' : Math.min(dn, dl.target) + '/' + dl.target + ' · +' + dl.rw + ' coins';
          }
          paintPanel();
        }
        if (hudEl) hudEl.textContent = 'Level ' + levelNow() + ' · 🪙 ' + d.coins + ' coins · ★ ' + d.stars;
      }
      function mount(el) {
        if (!el) return;
        strip = h('div', 'pk pk-strip');
        var lvrow = h('div', 'pk-lvrow');
        lvrow.appendChild(h('div', 'pk-lv', 'Level 1'));
        var xp = h('div', 'pk-xp'); xp.setAttribute('aria-label', 'XP progress to the next level'); xp.appendChild(h('i')); lvrow.appendChild(xp);
        strip.appendChild(lvrow);
        strip.appendChild(h('div', 'pk-chips'));
        var dv = h('div', 'pk-daily');
        dv.appendChild(h('span', '', 'Daily: '));
        dv.appendChild(h('b', '', ''));
        var db = h('div', 'pk-dbar'); db.appendChild(h('i')); dv.appendChild(db);
        dv.appendChild(h('small', '', ''));
        strip.appendChild(dv);
        var row = h('div', 'pk-row');
        var b1 = h('button', '', '🎨 Skins'); b1.type = 'button'; b1.addEventListener('click', function (e) { e.stopPropagation(); openPanel('skins'); });
        var b2 = h('button', '', '📋 Goals'); b2.type = 'button'; b2.addEventListener('click', function (e) { e.stopPropagation(); openPanel('goals'); });
        row.appendChild(b1); row.appendChild(b2);
        strip.appendChild(row);
        panel = buildPanel(); panel.style.display = 'none';
        strip.appendChild(panel);
        el.appendChild(strip);
        applySkin(); touchDay(); paint();
      }
      function mountHud(el) { hudEl = el; if (el) { el.className = ((el.className || '') + ' pk-hudchip').trim(); paint(); } }
      var api = {
        mount: mount, mountHud: mountHud, paint: paint, beginRun: beginRun, event: event, stat: stat,
        addCoins: addCoins, addXp: addXp, awardRun: awardRun, buy: buy, equip: equip, owned: owned,
        lv: levelNow, stars: function () { return d.stars; }, coins: function () { return d.coins; },
        skinId: function () { return d.skin; }, blob: d
      };
      try { G.__PROG = api; } catch (e) {}
      return api;
    }
  };
})(window);
