/* IdleKit engine (ik-idle.js): one idle/tycoon runtime for Idle Empire, Farm Idle Tycoon, Tap Monsters and Idle Miner.
 *
 * The game file gives it a config (see the four games): the generators, the currency, a prestige currency, upgrade and
 * achievement lists and a pixel-art scene. The engine does the rest, the same way for every game:
 *   economy     cost = base * growth^owned (bulk in closed form), x2 milestones, generated upgrade chains, global and tap upgrades,
 *               prestige with a crown shop (permanent perks), offline earnings with a cap and a haircut
 *   progression XP and levels that unlock tabs and building tiers, daily goals with a streak, week stamps and a chest, achievements
 *               with a permanent bonus, a "next goal" chip that always says what to do now
 *   moments     wandering critters to tap, chests, festivals (x2), caravans, level-up / unlock / prestige sheets, welcome back
 *   feel        wallet roll-up, floating numbers, coins that fly to the wallet, pop and shake, sounds from the arcade kit
 *   safety      pooled particles, capped DOM, 10 Hz UI refresh, real-clock offline maths, no save while cheat codes are on
 */
(function (W) {
  'use strict';
  var D = W.document, IK = W.IK;
  var $ = IK.$, h = IK.h, fmt = IK.fmt, esc = IK.esc;

  /* ---------- the coach: hints that point at what to do and never cover it ---------- */
  IK.coach = function (o) {
    var steps = o.steps, i = 0, card = null, ring = null, hand = null, done = false, tm = 0;
    function clear() { [card, ring, hand].forEach(function (e) { if (e && e.parentNode) e.parentNode.removeChild(e); }); card = ring = hand = null; }
    function targetEl(s) { var t = typeof s.target === 'function' ? s.target() : s.target; if (!t) return null; return typeof t === 'string' ? D.querySelector(t) : t; }
    function place() {
      if (done) return;
      var s = steps[i]; if (!s) return;
      if (IK.sheetOpen && IK.sheetOpen()) { if (card) card.style.display = 'none'; if (ring) ring.style.display = 'none'; if (hand) hand.style.display = 'none'; return; }
      var t = targetEl(s), r = t && t.getBoundingClientRect();
      var vh = W.innerHeight, top = false;
      if (r && r.width) {
        if (ring) { ring.style.display = ''; ring.style.left = (r.left - 5) + 'px'; ring.style.top = (r.top - 5) + 'px'; ring.style.width = (r.width + 10) + 'px'; ring.style.height = (r.height + 10) + 'px'; }
        if (hand) { hand.style.display = ''; hand.style.left = (r.left + r.width / 2 - 8) + 'px'; hand.style.top = (r.top + r.height - 14) + 'px'; }
        top = (r.top + r.height / 2) > vh * 0.55;                   // target low on screen -> card goes on top
      } else { if (ring) ring.style.display = 'none'; if (hand) hand.style.display = 'none'; }
      if (card) { card.style.display = ''; card.style.top = top ? ('calc(var(--ik-sat) + 64px)') : 'auto'; card.style.bottom = top ? 'auto' : ('calc(var(--ik-sab) + 74px)'); }
    }
    function show() {
      clear();
      var s = steps[i]; if (!s) return finish(true);
      card = h('div', 'ik-coach'); card.setAttribute('role', 'status');
      card.innerHTML = '<span class="n">' + (i + 1) + '/' + steps.length + '</span><span class="tx">' + s.text + '</span>';
      var sk = h('button', '', s.on ? 'Skip' : 'Next'); sk.type = 'button';
      sk.addEventListener('click', function () { if (s.on) finish(false); else { i++; show(); } });
      card.appendChild(sk); D.body.appendChild(card);
      if (s.target) { ring = h('div', 'ik-ring'); hand = h('div', 'ik-hand', IK.ico.hand(44)); D.body.appendChild(ring); D.body.appendChild(hand); }
      place();
    }
    function finish(completed) { if (done) return; done = true; clear(); W.clearInterval(tm); if (o.key) IK.ls.set('ik_coach_' + o.key, '1'); if (o.onDone) o.onDone(completed); }
    var api = {
      did: function (ev) { if (done) return; var s = steps[i]; if (s && s.on === ev) { i++; show(); } },
      stop: function () { finish(false); },
      place: place,
      get active() { return !done; }
    };
    tm = W.setInterval(place, 400);
    show();
    return api;
  };
  IK.coachSeen = function (key) { return IK.ls.get('ik_coach_' + key) === '1'; };

  /* ================= the engine ================= */
  IK.Idle = function (cfg) {
    var E = this;
    E.cfg = cfg; E.gens = cfg.gens; E.n = cfg.gens.length;
    E.growth = cfg.growth || 1.15;
    E.ms = cfg.ms || [[25, 2], [50, 2], [100, 2], [200, 2], [300, 2], [400, 2], [500, 2], [700, 2], [1000, 2]];
    E.S = E.blank();
    E.ups = [];              // every upgrade, generated and custom
    E.upById = {};
    E.rush = 0; E.frenzy = 0; E.frenzyMul = 2; E.carEnd = 0; E.carStake = 0; E.carDue = 0;
    E.inGame = false; E.cheated = false; E.coach = null;
    E.mul = { all: 1, tapAdd: 0, tapMul: 1, tapPct: 0, auto: 0, capH: 8, eff: 0.5, disc: 1, luck: 1, gen: [] };
    E.rows = []; E.upRows = {}; E.txt = new Map ? new Map() : null;
    E.sheetQ = []; E.evNext = 0; E.lastTapAt = 0; E.uiAcc = 0; E.hiddenAt = 0; E.sdkT = 0; E.saveT = 0; E.achT = 0;
    E.roll = new IK.Roll(); E.rollPrem = new IK.Roll(function (v) { return String(Math.floor(v)); });
    E.buildUpgrades();
    E.load();
  };
  var P = IK.Idle.prototype;

  P.blank = function () {
    var c = this.cfg, o = [], i;
    for (i = 0; i < this.n; i++) o.push(0);
    var S = { v: 2, coins: c.startCoins || 0, lifetime: 0, alltime: 0, owned: o, ups: {}, prem: 0, spent: 0, perks: {}, runs: 0, buy: 1, xp: 0, lvl: 1,
      stats: { taps: 0, buys: 0, chests: 0, critters: 0, trades: 0, rushes: 0, quests: 0, best: 0 }, ach: {}, daily: null, chests: 0, gift: '', theme: c.themes ? c.themes[0].id : '', last: IK.now(), seen: {}, x: {} };
    return S;
  };

  /* ---------- upgrades: generated chains per generator + the game's own ---------- */
  P.buildUpgrades = function () {
    var E = this, c = E.cfg, list = [], g = c.genUps || { at: [10, 40, 75, 150, 250], mul: [2, 2, 2, 3, 3], costMul: 6, names: ['Better Tools', 'Trained Hands', 'Master Guild', 'Royal Charter', 'Golden Age'] };
    E.gens.forEach(function (gen, i) {
      g.at.forEach(function (at, k) {
        list.push({ id: 'g' + i + '_' + k, gen: i, at: at, name: gen.name + ': ' + g.names[k], desc: gen.name + ' output ×' + g.mul[k], cost: Math.ceil(gen.cost * g.costMul * Math.pow(gen.growth || E.growth, at)), eff: { gen: i, mul: g.mul[k] }, ico: gen.ico, kind: 'gen',
          req: function (S) { return S.owned[i] >= at; }, reqText: 'Own ' + at + ' ' + gen.name });
      });
    });
    (c.ups || []).forEach(function (u) { u.kind = u.kind || 'misc'; list.push(u); });
    list.forEach(function (u) { E.upById[u.id] = u; });
    E.ups = list;
  };

  /* ---------- derived multipliers, recomputed when anything bought changes ---------- */
  P.recalc = function () {
    var E = this, S = E.S, c = E.cfg, m = E.mul, i;
    m.all = 1; m.gold = 1; m.tapAdd = 0; m.tapMul = 1; m.tapPct = 0; m.auto = 0; m.capH = c.offlineCapH || 8; m.eff = c.offlineEff || 0.5; m.disc = 1; m.luck = 1;
    for (i = 0; i < E.n; i++) m.gen[i] = 1;
    var allAdd = 0;
    E.ups.forEach(function (u) {
      if (!S.ups[u.id]) return;
      var e = u.eff || {};
      if (e.gen != null) m.gen[e.gen] *= e.mul;
      if (e.all) m.all *= e.all;
      if (e.gold) m.gold *= e.gold;
      if (e.tapAdd) m.tapAdd += e.tapAdd;
      if (e.tapMul) m.tapMul *= e.tapMul;
      if (e.tapPct) m.tapPct += e.tapPct;
      if (e.auto) m.auto += e.auto;
      if (e.capH) m.capH += e.capH;
      if (e.eff) m.eff += e.eff;
      if (e.disc) m.disc *= e.disc;
      if (e.luck) m.luck *= e.luck;
    });
    (c.perks || []).forEach(function (p) {
      var lv = S.perks[p.id] | 0; if (!lv) return;
      var e = p.eff || {};
      if (e.all) m.all *= Math.pow(e.all, lv);
      if (e.gold) m.gold *= Math.pow(e.gold, lv);
      if (e.tapMul) m.tapMul *= Math.pow(e.tapMul, lv);
      if (e.capH) m.capH += e.capH * lv;
      if (e.eff) m.eff += e.eff * lv;
      if (e.disc) m.disc *= Math.pow(e.disc, lv);
      if (e.luck) m.luck *= Math.pow(e.luck, lv);
      if (e.auto) m.auto += e.auto * lv;
    });
    m.eff = Math.min(m.eff, 1);
    var ach = E.achCount();
    E.permanent = 1 + (c.prestige ? c.prestige.per * S.prem : 0) + 0.02 * ach + 0.02 * (S.lvl - 1);   // crowns +10% each, deeds +2%, levels +2%
    E.dirty = false;
  };
  P.msMul = function (n) { var m = 1; for (var k = 0; k < this.ms.length; k++) { if (n >= this.ms[k][0]) m *= this.ms[k][1]; else break; } return m; };
  P.nextMs = function (n) { for (var k = 0; k < this.ms.length; k++) if (n < this.ms[k][0]) return this.ms[k]; return null; };
  P.globalMul = function () { if (this.dirty !== false) this.recalc(); return this.mul.all * this.permanent * (this.frenzy > 0 ? this.frenzyMul : 1) * (this.cfg.extraMul ? this.cfg.extraMul(this) : 1); };
  P.genRate = function (i) { var S = this.S; if (this.dirty !== false) this.recalc(); return this.gens[i].inc * S.owned[i] * this.msMul(S.owned[i]) * this.mul.gen[i]; };   // before the global multiplier
  P.income = function () {
    var E = this, t = 0, i;
    if (E.dirty !== false) E.recalc();
    for (i = 0; i < E.n; i++) t += E.genRate(i);
    if (E.cfg.income) t = E.cfg.income(E, t);
    return t * E.globalMul();
  };
  P.tapPower = function () {
    var E = this, c = E.cfg;
    if (E.dirty !== false) E.recalc();
    var base = ((c.tapBase || 1) + E.mul.tapAdd) * E.mul.tapMul;
    if (c.tapBonus) base += c.tapBonus(E);
    var v = base * E.permanent * (E.rush > 0 ? 3 : 1) * (E.frenzy > 0 ? E.frenzyMul : 1) * (E.codes && E.codes.MIDAS ? 10 : 1);
    if (E.mul.tapPct) v += E.income() * E.mul.tapPct;
    return v;
  };
  P.cost = function (i, n) {
    var g = this.gens[i], o = this.S.owned[i], r = g.growth || this.growth;
    return g.cost * Math.pow(r, o) * (Math.pow(r, n) - 1) / (r - 1) * this.mul.disc;
  };
  P.maxN = function (i) {
    var g = this.gens[i], o = this.S.owned[i], r = g.growth || this.growth, c0 = g.cost * Math.pow(r, o) * this.mul.disc, coins = this.S.coins;
    if (coins < c0) return 0;
    var n = Math.floor(Math.log(coins * (r - 1) / c0 + 1) / Math.log(r));
    while (n > 0 && this.cost(i, n) > coins) n--;
    while (this.cost(i, n + 1) <= coins) n++;
    return n;
  };
  P.highest = function () { var S = this.S, i; for (i = this.n - 1; i >= 0; i--) if (S.owned[i] > 0) return i; return -1; };
  P.unlocked = function (i) { var g = this.gens[i]; return !(g.lvl && this.S.lvl < g.lvl); };
  P.canBuy = function (i) { return i <= this.highest() + 1 && this.unlocked(i); };
  P.achCount = function () { var n = 0, a = this.S.ach; for (var k in a) if (a[k]) n++; return n; };
  P.totalOwned = function () { var t = 0; for (var i = 0; i < this.n; i++) t += this.S.owned[i]; return t; };
  P.prestigeGain = function () {
    var p = this.cfg.prestige; if (!p) return 0;
    return Math.max(0, Math.floor(p.coef * Math.sqrt(Math.max(0, this.S.lifetime) / p.unit)));
  };

  /* ---------- save / load ---------- */
  P.load = function () {
    var E = this, S = E.S, raw = IK.ls.get(E.cfg.saveKey), d = null, i;
    if (raw) { try { d = JSON.parse(raw); } catch (e) { d = null; } }
    if (d && E.cfg.migrate && !d.v) d = E.cfg.migrate(d, E) || d;
    if (d) {
      S.coins = Math.max(0, IK.num(d.coins, S.coins)); S.lifetime = Math.max(0, IK.num(d.lifetime, 0)); S.alltime = Math.max(S.lifetime, IK.num(d.alltime, 0));
      for (i = 0; i < E.n; i++) S.owned[i] = Math.max(0, Math.floor(IK.num(d.owned && d.owned[i], 0)));
      if (d.ups && typeof d.ups === 'object') for (var k in d.ups) if (E.upById[k] && d.ups[k]) S.ups[k] = 1;
      S.prem = Math.max(0, Math.floor(IK.num(d.prem, 0))); S.spent = Math.max(0, Math.floor(IK.num(d.spent, 0)));
      if (d.perks && typeof d.perks === 'object') for (var pk in d.perks) S.perks[pk] = Math.max(0, Math.floor(IK.num(d.perks[pk], 0)));
      S.runs = Math.max(0, Math.floor(IK.num(d.runs, 0)));
      S.buy = (d.buy === 1 || d.buy === 10 || d.buy === 25 || d.buy === -1) ? d.buy : 1;
      S.xp = Math.max(0, IK.num(d.xp, 0));
      if (d.stats) for (var sk in S.stats) S.stats[sk] = Math.max(0, Math.floor(IK.num(d.stats[sk], 0)));
      if (d.ach && typeof d.ach === 'object') for (var ak in d.ach) S.ach[ak] = d.ach[ak] ? 1 : 0;
      if (d.daily && typeof d.daily === 'object') S.daily = d.daily;
      S.chests = Math.max(0, Math.floor(IK.num(d.chests, 0))); S.gift = typeof d.gift === 'string' ? d.gift : '';
      if (typeof d.theme === 'string') S.theme = d.theme;
      S.last = IK.num(d.last, IK.now());
      if (d.seen && typeof d.seen === 'object') S.seen = d.seen;
      if (d.x && typeof d.x === 'object') S.x = d.x;
      if (E.cfg.afterLoad) E.cfg.afterLoad(E, d);
    }
    S.lvl = IK.Level.info(S.xp, E.cfg.lvlBase || 8, E.cfg.lvlPow || 1.7).lvl;
    E.hadSave = !!d; E.dirty = true; E.recalc();
  };
  P.save = function () {
    var E = this;
    if (E.cheated || (W.ArcadeSDK && W.ArcadeSDK.cheated)) return;
    E.S.last = IK.now();
    IK.ls.set(E.cfg.saveKey, JSON.stringify(E.S));
  };

  /* ---------- xp, levels ---------- */
  P.addXp = function (n, why) {
    var E = this, S = E.S, before = S.lvl;
    if (!(n > 0)) return;
    S.xp += n;
    var inf = IK.Level.info(S.xp, E.cfg.lvlBase || 8, E.cfg.lvlPow || 1.7);
    while (S.lvl < inf.lvl) {
      S.lvl++;
      E.dirty = true; E.recalc();
      E.onLevelUp(S.lvl);
    }
  };
  P.levelInfo = function () { return IK.Level.info(this.S.xp, this.cfg.lvlBase || 8, this.cfg.lvlPow || 1.7); };
  P.tabLevel = function (tab) { var t = this.cfg.tabLevels && this.cfg.tabLevels[tab]; return t || 1; };
  P.tabOpen = function (tab) { return this.S.lvl >= this.tabLevel(tab); };
  P.onLevelUp = function (lvl) {
    var E = this, S = E.S, c = E.cfg, reward = c.levelReward ? c.levelReward(E, lvl) : Math.max(50, Math.floor(E.income() * 90));
    var line = '', art = '';
    var unlockTab = null;
    for (var t in (c.tabLevels || {})) if (c.tabLevels[t] === lvl) unlockTab = t;
    var info = c.levelInfo && c.levelInfo[lvl];
    if (unlockTab) line += '<div class="ik-kv"><span>New</span><b>' + esc(E.tabLabel(unlockTab)) + ' tab</b></div>';
    if (info) line += '<div class="ik-kv"><span>' + esc(info.kind || 'Unlocked') + '</span><b>' + esc(info.text) + '</b></div>';
    E.gens.forEach(function (g) { if (g.lvl === lvl) line += '<div class="ik-kv"><span>New building</span><b>' + esc(g.name) + '</b></div>'; });
    if (c.themes) c.themes.forEach(function (th) { if (th.lvl === lvl) { line += '<div class="ik-kv"><span>New look</span><b>' + esc(th.name) + '</b></div>'; } });
    line += '<div class="ik-kv"><span>Reward</span><b>+' + fmt(reward) + ' ' + esc(c.cur.name) + '</b></div><div class="ik-kv"><span>Kingdom bonus</span><b>+2% income</b></div>';
    E.gain(reward, false);
    IK.sfx('levelup'); IK.vibrate([15, 40, 15]);
    IK.fx.confetti(30);
    if (E.scene && E.scene.onLevel) E.scene.onLevel(lvl);
    if (W.ArcadeSDK && W.ArcadeSDK.profile && !E.cheated) { try { W.ArcadeSDK.profile.award({ xp: 3, reason: 'Level ' + lvl }); } catch (e) {} }
    E.queueSheet(function () {
      IK.sheet({ art: c.levelArt ? c.levelArt(lvl) : '', title: 'LEVEL ' + lvl + '!', sub: c.levelSub || 'Your kingdom grows.', body: line, actions: [{ label: 'Nice!', sound: 'unlock' }] });
    });
    E.refreshTabs();
    E.report();
  };

  /* ---------- earning ---------- */
  P.gain = function (amt, countLife) {
    var S = this.S;
    if (!(amt > 0)) return;
    S.coins += amt;
    if (countLife !== false) { S.lifetime += amt; S.alltime += amt; this.earnAcc = (this.earnAcc || 0) + amt; }
  };
  P.event = function (kind, n) {                                   // daily quests and achievements listen here
    var E = this, S = E.S, d = S.daily; n = n == null ? 1 : n;
    if (!d) return;
    var changed = false;
    d.quests.forEach(function (q) {
      if (q.done) return;
      var def = E.questDef(q.id); if (!def || def.kind !== kind) return;
      q.prog = def.absolute ? Math.max(q.prog, n) : q.prog + n;
      if (q.prog >= q.goal) { q.prog = q.goal; q.done = true; IK.toast('Goal done: ' + E.questText(q), { icon: '&#10004;', kind: 'good' }); IK.sfx('unlock'); }
      changed = true;
    });
    if (changed) E.dirtyUI = true;
    if (IK.Daily.touch(S)) { E.dirtyUI = true; }
  };
  P.questDef = function (id) { var p = this.cfg.dailyPool; for (var i = 0; i < p.length; i++) if (p[i].id === id) return p[i]; return null; };
  P.questText = function (q) { var d = this.questDef(q.id); return d ? d.text.replace('{n}', fmt(q.goal)) : q.id; };

  /* the main tap. x,y are client coordinates (or null for an auto-tap). */
  P.tapMain = function (x, y, auto) {
    var E = this, S = E.S, v = E.tapPower();
    if (E.cfg.tapAction) E.cfg.tapAction(E, v, x, y, auto); else E.gain(v);
    S.stats.taps++;
    E.event('tap', 1);
    if (!auto) { E.lastTapAt = IK.now(); E.coachDid('tap'); if (!E.cfg.tapAction) IK.sfx('coin', { rate: 0.9 + Math.min(0.5, (E.combo || 0) * 0.02), volume: 0.5, gap: 60 }); IK.vibrate(6); }
    if (x != null && !E.cfg.tapAction) { IK.fx.float(x, y - 10, '+' + fmt(v), v > E.income() * 4 && v > 10 ? 'big' : 'gold'); IK.fx.burst(x, y, { n: 6, speed: 150, size: 3 }); IK.fx.pop(E.el.wallet, 0.05); }
    if (E.cfg.onTap) E.cfg.onTap(E, v, auto);
    E.dirtyUI = true;
    return v;
  };

  /* ---------- buying ---------- */
  P.buy = function (i, qty) {
    var E = this, S = E.S;
    if (!E.canBuy(i)) { IK.sfx('error'); return false; }
    var n = qty == null ? S.buy : qty;
    if (n === -1) n = E.maxN(i);
    if (n < 1) { if (E.maxN(i) < 1) { IK.sfx('error', { volume: 0.4 }); IK.vibrate(20); IK.fx.shake(E.rows[i] && E.rows[i].row, 4, 220); return false; } n = 1; }
    var c = E.cost(i, n);
    if (S.coins < c) { IK.sfx('error', { volume: 0.4 }); IK.vibrate(20); IK.fx.shake(E.rows[i] && E.rows[i].row, 4, 220); return false; }
    var before = S.owned[i], first = before === 0;
    S.coins -= c; S.owned[i] += n; S.stats.buys += n;
    E.dirty = true; E.recalc();
    E.event('buy', n); E.coachDid('buy');
    var xp = Math.ceil((2 + 3 * i) * (1 + Math.log10(n)));
    IK.sfx('buy', { rate: 0.95 + Math.min(0.25, n * 0.01) }); IK.vibrate(10);
    var r = E.rows[i];
    if (r) { r.row.classList.remove('flash'); void r.row.offsetWidth; r.row.classList.add('flash'); }
    var pt = r ? r.row.getBoundingClientRect() : null;
    if (pt) IK.fx.burst(pt.left + 34, pt.top + pt.height / 2, { n: 12, speed: 170, size: 4, colors: E.cfg.burstColors });
    if (E.scene && E.scene.onBuy) E.scene.onBuy(i, n, first, S.owned[i]);
    var crossed = 0;
    for (var k = 0; k < E.ms.length; k++) if (before < E.ms[k][0] && S.owned[i] >= E.ms[k][0]) crossed++;
    if (crossed) {
      IK.toast(E.gens[i].name + ' ×' + E.ms[0][1] + ' output!', { icon: '&#9733;', kind: 'gold' }); IK.sfx('powerup'); IK.fx.confetti(20); IK.fx.flash('#ffe27a', 200);
      xp += 10 * crossed; S.stats.best = Math.max(S.stats.best, 0);
    }
    if (first) {
      IK.toast('New: ' + E.gens[i].name + '!', { icon: E.gens[i].ico(22), kind: 'gold' }); IK.sfx('unlock');
      xp += 6 + 2 * i;
      if (i === E.n - 1) IK.fx.confetti(60);
    }
    if (Math.random() < 0.06 && E.tabOpen('goals') && !E.cfg.noEvents) { S.chests++; IK.toast('A treasure chest dropped!', { icon: '&#127873;' }); IK.sfx('collect'); E.dirtyUI = true; }
    E.addXp(xp, 'buy');
    if (E.cfg.onBuy) E.cfg.onBuy(E, i, n);
    E.dirtyUI = true; E.refreshNow();
    return true;
  };
  P.upAvailable = function (u) { return !this.S.ups[u.id] && (!u.req || u.req(this.S, this)) && (!u.lvl || this.S.lvl >= u.lvl); };
  P.buyUp = function (id) {
    var E = this, S = E.S, u = E.upById[id];
    if (!u || S.ups[id] || !E.upAvailable(u)) return false;
    if (S.coins < u.cost) { IK.sfx('error', { volume: 0.4 }); IK.vibrate(20); IK.fx.shake(E.upRows[id] && E.upRows[id].row, 4, 220); return false; }
    S.coins -= u.cost; S.ups[id] = 1; E.dirty = true; E.recalc();
    IK.sfx('powerup'); IK.vibrate(12); IK.fx.confetti(14);
    var r = E.upRows[id]; if (r) { var b = r.row.getBoundingClientRect(); IK.fx.burst(b.left + 34, b.top + b.height / 2, { n: 16, speed: 200, shape: 'star', size: 5 }); IK.fx.float(b.left + b.width / 2, b.top, u.desc, 'gold'); }
    E.event('upgrade', 1); E.coachDid('upgrade');
    E.addXp(10 + (u.gen != null ? 5 * u.gen : 8), 'up');
    if (E.cfg.onUpgrade) E.cfg.onUpgrade(E, u);
    E.dirtyUI = true; E.upSig = ''; E.refreshNow();
    return true;
  };
  P.buyAllUps = function () {
    var E = this, n = 0, list = E.ups.filter(function (u) { return E.upAvailable(u) && E.S.coins >= u.cost; }).sort(function (a, b) { return a.cost - b.cost; });
    list.forEach(function (u) { if (E.S.coins >= u.cost && E.buyUp(u.id)) n++; });
    if (!n) IK.sfx('error', { volume: 0.4 });
    return n;
  };

  /* ---------- chests, critters, festivals, caravans ---------- */
  P.openChest = function (x, y) {
    var E = this, S = E.S;
    if (!S.chests) { IK.sfx('error', { volume: 0.4 }); return; }
    S.chests--; S.stats.chests++;
    var loot = E.cfg.chestLoot ? E.cfg.chestLoot(E) : Math.max(20 * E.tapPower(), Math.floor(E.income() * 30 * (0.6 + Math.random() * 1.6)));
    E.gain(loot); E.addXp(12, 'chest');
    IK.sfx('reward'); IK.vibrate(18);
    if (x == null && E.el.chest) { var b = E.el.chest.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top; }
    if (x != null) { IK.fx.float(x, y, '+' + fmt(loot), 'big'); IK.fx.burst(x, y, { n: 20, speed: 220, shape: 'star', size: 5 }); IK.fx.flyTo(x, y, E.el.wallet, { n: 8 }); }
    E.event('chest', 1);
    E.dirtyUI = true; E.refreshNow();
  };
  P.critterTapped = function (kind, x, y) {
    var E = this, S = E.S, r = Math.random(), inc = E.income();
    S.stats.critters++; E.event('critter', 1); E.coachDid('critter');
    IK.fx.ring(x, y, '#fff4dc', 50);
    if (r < 0.55) {
      var amt = Math.max(30 * E.tapPower(), inc * (40 + Math.random() * 80));
      E.gain(amt); IK.fx.float(x, y, '+' + fmt(amt), 'big'); IK.fx.flyTo(x, y, E.el.wallet, { n: 9 });
      IK.toast((E.cfg.critterName || 'Visitor') + ' paid you ' + fmt(amt) + '!', { icon: E.cfg.cur.ico(22), kind: 'gold' });
    } else if (r < 0.82) {
      E.frenzy = 30; E.frenzyMul = 2; IK.toast('Festival! Income ×2 for 30s', { icon: '&#127881;', kind: 'gold' }); IK.fx.confetti(40);
    } else {
      S.chests++; IK.toast('You got a treasure chest!', { icon: '&#127873;', kind: 'gold' });
    }
    IK.sfx('collect'); IK.sfx('coin', { rate: 1.3, gap: 0 }); IK.vibrate([10, 30, 10]);
    E.addXp(8, 'critter');
    E.evNext = IK.now() + (50 + Math.random() * 50) * 1000 / E.mul.luck;
    E.dirtyUI = true; E.refreshNow();
  };
  P.startCaravan = function () {
    var E = this, S = E.S;
    if (E.carEnd || S.coins < 1000) { IK.sfx('error', { volume: 0.4 }); return; }
    var stake = Math.min(S.coins, Math.max(1000, Math.floor(S.coins * 0.25)));
    S.coins -= stake; E.carStake = stake; E.carEnd = IK.now() + 60000; S.stats.trades++;
    IK.sfx('whoosh'); IK.toast('Caravan left with ' + fmt(stake) + '. Back in 60s!', { icon: '&#128667;' });
    if (E.scene && E.scene.onCaravan) E.scene.onCaravan('go');
    E.dirtyUI = true; E.refreshNow();
  };
  P.claimGift = function () {
    var E = this, S = E.S, today = IK.today();
    if (S.gift === today) return;
    S.gift = today;
    IK.Daily.touch(S);
    var st = (S.daily && S.daily.streak) || 1;
    var amt = E.cfg.giftAmt ? E.cfg.giftAmt(E, st) : Math.max(100, E.income() * 60 * Math.min(7, st));
    E.gain(amt); E.addXp(15, 'gift');
    IK.sfx('reward'); IK.fx.confetti(40); IK.fx.float(W.innerWidth / 2, W.innerHeight * 0.3, '+' + fmt(amt), 'big'); IK.fx.flyTo(W.innerWidth / 2, W.innerHeight * 0.3, E.el.wallet, { n: 10 });
    IK.toast('Daily gift: +' + fmt(amt) + ' (day ' + st + ' streak)', { icon: '&#127873;', kind: 'gold' });
    E.dirtyUI = true; E.refreshNow(); E.save();
  };
  P.claimQuest = function (idx) {
    var E = this, S = E.S, q = S.daily && S.daily.quests[idx];
    if (!q || !q.done || q.claimed) return;
    q.claimed = true; S.stats.quests++;
    var amt = E.cfg.questAmt ? E.cfg.questAmt(E, idx) : Math.max(200, E.income() * 120), xp = 30 + 10 * idx;
    E.gain(amt); E.addXp(xp, 'quest');
    IK.sfx('reward'); IK.fx.confetti(24);
    IK.toast('+' + fmt(amt) + ' and ' + xp + ' XP!', { icon: '&#127942;', kind: 'gold' });
    if (W.ArcadeSDK && W.ArcadeSDK.profile && !E.cheated) { try { W.ArcadeSDK.profile.award({ xp: 5, reason: 'Daily goal' }); W.ArcadeSDK.profile.quest('daily-' + idx, 1, { title: E.questText(q) }); } catch (e) {} }
    var all = S.daily.quests.every(function (x) { return x.claimed; });
    if (all && !S.daily.allClaimed) {
      S.daily.allClaimed = true; S.chests++; E.addXp(40, 'quests');
      IK.toast('All goals done! Bonus chest!', { icon: '&#127873;', kind: 'gold' }); IK.fx.confetti(50); IK.sfx('cheer');
    }
    E.checkAch(true);
    E.dirtyUI = true; E.refreshNow(); E.save();
  };
  P.claimWeek = function () {
    var E = this, S = E.S, w = IK.Daily.week(S), d = S.daily;
    if (w.count < 5 || d.weekChest === w.mon) return;
    d.weekChest = w.mon; S.chests += 2; E.addXp(60, 'week');
    IK.toast('Weekly reward: 2 treasure chests!', { icon: '&#127873;', kind: 'gold' }); IK.sfx('cheer'); IK.fx.confetti(60);
    E.dirtyUI = true; E.refreshNow(); E.save();
  };

  /* ---------- achievements ---------- */
  P.checkAch = function (quiet) {
    var E = this, S = E.S, got = [];
    E.cfg.ach.forEach(function (a) { if (!S.ach[a.id] && a.test(S, E)) { S.ach[a.id] = 1; got.push(a); } });
    if (!got.length) return;
    E.dirty = true; E.recalc();
    got.forEach(function (a) {
      IK.toast('Deed: ' + a.name + ' (+2% income)', { icon: '&#127941;', kind: 'gold' });
      E.addXp(a.xp || 40, 'ach');
      if (W.ArcadeSDK && W.ArcadeSDK.profile && !E.cheated) { try { W.ArcadeSDK.profile.achievement(E.cfg.id + '-' + a.id, { title: a.name, desc: a.desc, tier: a.tier || 'bronze' }); } catch (e) {} }
    });
    IK.sfx('unlock'); IK.vibrate([12, 30, 12]);
    E.dirtyUI = true;
  };

  /* ---------- prestige ---------- */
  P.prestige = function () {
    var E = this, S = E.S, p = E.cfg.prestige, g = E.prestigeGain();
    if (g < 1) { IK.sfx('error', { volume: 0.4 }); return; }
    var run = S.lifetime, all = S.alltime, pm = 1 + p.per * (S.prem + g);
    S.prem += g; S.runs++;
    S.coins = E.startCoins(); S.lifetime = 0;
    var keep = 0; (E.cfg.perks || []).forEach(function (pk) { if (pk.eff && pk.eff.keep) keep += (S.perks[pk.id] | 0) * pk.eff.keep; });
    for (var i = 0; i < E.n; i++) S.owned[i] = (i === 0 ? keep : 0);
    S.ups = {}; E.carEnd = 0; E.carStake = 0; E.frenzy = 0; E.rush = 0;
    E.dirty = true; E.recalc();
    if (E.cfg.onPrestige) E.cfg.onPrestige(E);
    E.upSig = ''; E.refreshNow();
    IK.sfx('cheer'); IK.vibrate([20, 50, 20, 50, 40]); IK.fx.confetti(90); IK.fx.flash('#fff4dc', 400); IK.fx.shake(E.el.app, 8, 500);
    E.event('prestige', 1);
    E.addXp(60 + 20 * S.runs, 'prestige');
    E.checkAch(true);
    E.save();
    var self = E;
    E.inGame = false; E.report('over', g);
    IK.sheet({ art: E.cfg.prestige.art ? E.cfg.prestige.art(64) : '', title: p.label.toUpperCase() + '!', sub: 'A new age begins.',
      body: '<div class="ik-kv"><span>Earned this age</span><b>' + fmt(run) + '</b></div><div class="ik-kv"><span>All-time</span><b>' + fmt(all) + '</b></div><div class="ik-kv"><span>' + esc(p.plural) + ' gained</span><b>+' + g + '</b></div><div class="ik-kv"><span>Income bonus now</span><b>×' + pm.toFixed(2) + '</b></div><div class="ik-kv"><span>Spend ' + esc(p.plural) + '</span><b>in the ' + esc(p.tab || 'Crown') + ' tab</b></div>',
      actions: [{ label: 'Build again!', sound: 'unlock', onClick: function () { self.inGame = true; self.report('play'); self.switchTab('crown'); } }] });
  };
  P.startCoins = function () { var s = 0; (this.cfg.perks || []).forEach(function (pk) { if (pk.eff && pk.eff.start) s += (this.S.perks[pk.id] | 0) * pk.eff.start; }, this); return s * (this.S.runs > 0 ? 1 : 0) + (this.cfg.startCoins || 0); };
  P.buyPerk = function (id) {
    var E = this, S = E.S, pk = null;
    (E.cfg.perks || []).forEach(function (p) { if (p.id === id) pk = p; });
    if (!pk) return;
    var lv = S.perks[id] | 0;
    if (lv >= pk.max) return;
    var c = pk.cost(lv);
    if (S.prem - S.spent < c) { IK.sfx('error', { volume: 0.4 }); IK.toast('Not enough ' + E.cfg.prestige.plural, { kind: '' }); return; }
    S.spent += c; S.perks[id] = lv + 1; E.dirty = true; E.recalc();
    IK.sfx('powerup'); IK.fx.confetti(20); IK.toast(pk.name + ' ' + (lv + 1) + '/' + pk.max, { icon: pk.ico(22), kind: 'gold' });
    E.dirtyUI = true; E.crownSig = ''; E.refreshNow(); E.save();
  };

  /* ---------- offline ---------- */
  P.offline = function (awaySec, fromLoad) {
    var E = this;
    if (awaySec < 60 || E.cheated) return;
    if (E.dirty !== false) E.recalc();
    var cap = E.mul.capH * 3600, used = Math.min(awaySec, cap), rate = E.income(), gain = Math.floor(rate * used * E.mul.eff);
    if (E.cfg.offlineGain) gain = E.cfg.offlineGain(E, used, gain);
    if (!(gain > 0)) return;
    E.gain(gain);
    E.save();
    E.queueSheet(function () {
      IK.sheet({ art: E.cfg.welcomeArt ? E.cfg.welcomeArt(64) : '', title: 'WELCOME BACK!', sub: 'Your ' + esc(E.cfg.workers || 'workers') + ' kept busy while you were away.',
        body: '<div class="ik-kv"><span>Away for</span><b>' + IK.fmtTime(awaySec) + (awaySec > cap ? ' (cap ' + Math.round(E.mul.capH) + 'h)' : '') + '</b></div><div class="ik-kv"><span>Rate while away</span><b>' + Math.round(E.mul.eff * 100) + '% of ' + fmt(rate) + '/s</b></div><div class="ik-kv"><span>You earned</span><b>+' + fmt(gain) + '</b></div>',
        actions: [{ label: 'Collect ' + fmt(gain), cls: 'acc', sound: 'reward', onClick: function () { IK.fx.confetti(30); IK.fx.flyTo(W.innerWidth / 2, W.innerHeight * 0.5, E.el.wallet, { n: 10 }); E.roll.set(E.S.coins, false); } }] });
    });
  };

  /* ---------- sheets (one at a time, and never over the title) ---------- */
  P.queueSheet = function (fn) { this.sheetQ.push(fn); this.pumpSheets(); };
  P.pumpSheets = function () {
    var E = this;
    if (IK.sheetOpen() || !E.sheetQ.length || !E.inGame) return;
    var fn = E.sheetQ.shift(); fn();
  };

  /* ================= UI ================= */
  P.hasTab = function (id) { var t = this.cfg.tabs; for (var i = 0; i < t.length; i++) if (t[i].id === id) return true; return false; };
  P.tabLabel = function (id) { var t = this.cfg.tabs; for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i].label; return id; };
  P.build = function (root) {
    var E = this, c = E.cfg, S = E.S;
    root.innerHTML = '';
    var app = h('div', 'ik-app'); root.appendChild(app);
    E.el = { app: app };
    IK.defs();
    app.innerHTML =
      '<section class="ik-scene" id="sceneWrap" aria-label="' + esc(c.name) + ' scene"><canvas id="scene"></canvas>' +
      '<div class="ik-hud">' +
        '<a class="ik-glassbtn" id="btnBack" href="../index.html" aria-label="Back to the arcade hub">' + IK.ico.back(24) + '</a>' +
        '<div class="ik-hudcol">' +
          '<div class="ik-player"><span class="ik-lvbadge" id="lvN">1</span><div class="ik-lvbox"><div class="n">Level <small id="lvT">0/8 XP</small></div><div class="ik-bar"><i id="lvBar"></i></div></div></div>' +
          '<div class="ik-pills">' +
            '<div class="ik-pill" id="wallet"><span class="ik-cur">' + c.cur.ico(30) + '</span><div class="v"><b id="cur">0</b><small id="rate">0/s</small></div></div>' +
            '<div class="ik-pill prem click" id="premW" role="button" tabindex="0" hidden aria-label="' + esc(c.prestige.plural) + '">' + c.prestige.ico(28) + '<div class="v"><b id="prem">0</b></div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="ik-sidebtns"><button class="ik-glassbtn" id="btnMute" type="button" aria-label="Sound on or off"></button></div>' +
      '<div class="ik-chips" id="chips"></div>' +
      '<button class="ik-goal" id="quest" type="button"><span class="q"><b id="qT">Next goal</b><small id="qS"></small><div class="ik-bar good"><i id="qBar"></i></div></span><span class="rw" id="qR"></span></button>' +
      '</section>' +
      '<main class="ik-panels" id="panels"></main>' +
      '<nav class="ik-tabs" id="tabs" role="tablist"></nav>';
    ['wallet', 'cur', 'rate', 'premW', 'prem', 'btnMute', 'lvN', 'lvBar', 'lvT', 'sceneWrap', 'scene', 'chips', 'quest', 'qT', 'qS', 'qBar', 'qR', 'panels', 'tabs'].forEach(function (id) { E.el[id] = $(id); });
    E.el.pills = app.querySelector('.ik-pills');
    // tabs and panels
    c.tabs.forEach(function (t) {
      var b = h('button', 'ik-tab', '<span class="ti">' + t.ico(22) + '</span><span class="tl">' + esc(t.label) + '</span><span class="dot" id="dot_' + t.id + '"></span>');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id; b.id = 'tab_' + t.id;
      b.addEventListener('click', function () { E.switchTab(t.id, true); });
      E.el.tabs.appendChild(b);
      var p = h('section', 'ik-panel'); p.id = 'panel_' + t.id; p.setAttribute('role', 'tabpanel'); E.el.panels.appendChild(p);
      E.el['p_' + t.id] = p;
    });
    if (E.hasTab('build') && !c.noBuild) E.buildBuildPanel();
    if (E.hasTab('ups')) E.buildUpPanel();
    if (E.hasTab('goals')) E.buildGoalsPanel();
    if (E.hasTab('crown')) E.buildCrownPanel();
    if (c.panels) c.tabs.forEach(function (t) { if (c.panels[t.id]) c.panels[t.id].build(E, E.el['p_' + t.id]); });
    if (c.hudPills) c.hudPills.forEach(function (p) { var d = h('div', 'ik-pill click', p.ico(28) + '<div class="v"><b id="' + p.id + '">0</b></div>'); d.id = p.id + 'W'; if (p.tab) d.addEventListener('click', function () { E.switchTab(p.tab, true); }); E.el.pills.appendChild(d); E.el[p.id] = d.querySelector('b'); E.el[p.id + 'W'] = d; });
    // scene
    E.scene = c.makeScene(E);
    var wrap = E.el.sceneWrap;
    wrap.addEventListener('pointerdown', function (ev) { if (!E.inGame) return; if (ev.button > 0) return; if (ev.target.closest && ev.target.closest('.ik-goal,.ik-glassbtn,.ik-pill')) return; E.scene.pointer(ev.clientX, ev.clientY, ev); }, { passive: true });
    // events
    E.el.btnMute.addEventListener('click', function () { IK.muted = !IK.muted; IK.ls.set(c.muteKey, IK.muted ? '1' : '0'); E.el.btnMute.innerHTML = IK.muted ? IK.ico.muted(22) : IK.ico.speaker(22); if (!IK.muted) IK.sfx('button'); });
    E.el.btnMute.innerHTML = IK.muted ? IK.ico.muted(22) : IK.ico.speaker(22);
    E.el.quest.addEventListener('click', function () { IK.sfx('tap'); if (E.goalTab) E.switchTab(E.goalTab, true); if (E.goalAct) E.goalAct(); });
    E.el.premW.addEventListener('click', function () { E.switchTab('crown', true); });
    // title
    E.buildTitle(root);
    E.switchTab(c.tabs[0].id);
    E.refreshTabs();
  };

  P.buildBuildPanel = function () {
    var E = this, c = E.cfg, p = E.el.p_build;
    p.innerHTML = '<div class="ik-strip" id="strip"></div><div class="ik-qty" id="qty" role="group" aria-label="How many to buy"></div><div id="genList"></div>';
    E.el.strip = $('strip'); E.el.genList = $('genList'); E.el.qty = $('qty');
    [[1, '×1'], [10, '×10'], [25, '×25'], [-1, 'MAX']].forEach(function (q) {
      var b = h('button', '', q[1]); b.type = 'button'; b.dataset.q = q[0];
      b.addEventListener('click', function () { E.S.buy = q[0]; IK.sfx('tap'); E.updateQty(); E.updateGenRows(true); });
      E.el.qty.appendChild(b);
    });
    E.gens.forEach(function (g, i) {
      var row = h('div', 'ik-row');
      row.innerHTML = '<div class="ik-ico">' + g.ico(44) + '</div><div class="ik-mid"><div class="ik-nm"><span class="t">' + esc(g.name) + '</span><span class="ik-own">0</span></div><div class="ik-sub"></div><div class="ik-bar blue"><i></i></div></div><button class="ik-buy" type="button"><small></small><b></b></button>';
      var btn = row.querySelector('.ik-buy');
      btn.addEventListener('click', function () { E.buy(i); });
      // tap the icon to see what the tier does in the scene
      E.el.genList.appendChild(row);
      E.rows.push({ row: row, ico: row.querySelector('.ik-ico'), nm: row.querySelector('.t'), own: row.querySelector('.ik-own'), sub: row.querySelector('.ik-sub'), bar: row.querySelector('.ik-bar i'), btn: btn, bs: btn.querySelector('small'), bb: btn.querySelector('b'), last: {} });
    });
  };
  P.buildUpPanel = function () {
    var p = this.el.p_ups, E = this;
    p.innerHTML = '<div class="ik-card" style="display:flex;gap:10px;align-items:center"><div style="flex:1"><h3 id="upH">Upgrades</h3><div class="ik-sub" id="upS"></div></div><button class="ik-btn acc" id="upAll" type="button" style="min-width:110px">Buy all</button></div><div id="upList"></div><div class="ik-sec">Coming soon</div><div id="upNext"></div>';
    E.el.upList = $('upList'); E.el.upNext = $('upNext'); E.el.upH = $('upH'); E.el.upS = $('upS'); E.el.upAll = $('upAll');
    E.el.upAll.addEventListener('click', function () { E.buyAllUps(); });
  };
  P.buildGoalsPanel = function () { this.el.p_goals.innerHTML = '<div id="goalsBody"></div>'; this.el.goalsBody = $('goalsBody'); };
  P.buildCrownPanel = function () { this.el.p_crown.innerHTML = '<div id="crownBody"></div>'; this.el.crownBody = $('crownBody'); };

  P.buildTitle = function (root) {
    var E = this, c = E.cfg, t = h('div', 'ik-title'); t.id = 'title'; E.el.title = t;
    t.innerHTML = '<div class="ik-plaque"><h1 class="ik-logo">' + c.logo + '</h1></div><p class="ik-tag">' + c.tagline + '</p><div class="ik-stats" id="tStats"></div><button class="ik-btn acc big" id="btnPlay" type="button">Play</button><div class="row"><button class="ik-btn ghost" id="btnHow" type="button" style="min-width:150px">How to play</button><button class="ik-btn ghost" id="btnMore" type="button" style="min-width:110px">Options</button></div>';
    root.appendChild(t);
    $('btnPlay').addEventListener('click', function () { E.start(false); });
    $('btnHow').addEventListener('click', function () { E.showHow(); });
    $('btnMore').addEventListener('click', function () { E.showOptions(); });
  };
  P.refreshTitle = function () {
    var E = this, S = E.S, c = E.cfg;
    $('btnPlay').textContent = S.alltime > 0 || S.xp > 0 ? 'Continue' : 'Play';
    var h1 = '<span class="ik-stat">Level <b>' + S.lvl + '</b></span>';
    if (S.prem) h1 += '<span class="ik-stat">' + esc(c.prestige.plural) + ' <b>' + S.prem + '</b></span>';
    if (S.alltime) h1 += '<span class="ik-stat">All-time <b>' + fmt(S.alltime) + '</b></span>';
    var st = (S.daily && S.daily.streak) || 0; if (st > 1) h1 += '<span class="ik-stat">Streak <b>' + st + ' days</b></span>';
    if (!h1) h1 = '<span class="ik-stat">' + esc(c.pitch || '') + '</span>';
    $('tStats').innerHTML = h1;
  };
  P.showHow = function () {
    var c = this.cfg, E = this;
    IK.sheet({ title: 'HOW TO PLAY', body: '<ol style="text-align:left;margin:0;padding-left:22px;line-height:1.5">' + c.howto.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>',
      actions: [{ label: 'Got it', cls: 'go' }, { label: 'Show me in the game', cls: 'ghost', onClick: function () { E.start(true); } }] });
  };
  P.showOptions = function () {
    var E = this;
    IK.sheet({ title: 'OPTIONS', sub: 'Sound is ' + (IK.muted ? 'off' : 'on') + '. Progress saves on this device.',
      actions: [{ label: IK.muted ? 'Turn sound on' : 'Turn sound off', cls: 'ghost', onClick: function () { E.el.btnMute.click(); } },
        { label: 'Erase my progress', cls: 'bad', onClick: function () { E.confirmReset(); } }, { label: 'Close', cls: 'go' }] });
  };
  P.confirmReset = function () {
    var E = this;
    setTimeout(function () {
      IK.sheet({ title: 'ERASE EVERYTHING?', sub: 'Your ' + esc(E.cfg.prestige.plural.toLowerCase()) + ', level and deeds will be gone for good.',
        actions: [{ label: 'Keep my game', cls: 'go' }, { label: 'Yes, erase it', cls: 'bad', onClick: function () { E.cheated = true; IK.ls.del(E.cfg.saveKey); W.location.reload(); } }] });
    }, 30);
  };

  /* ---------- tabs ---------- */
  P.switchTab = function (id, click) {
    var E = this;
    if (!E.tabOpen(id)) { IK.sfx('error', { volume: 0.4 }); IK.toast(E.tabLabel(id) + ' opens at level ' + E.tabLevel(id), { icon: IK.ico.lock(18) }); return; }
    E.tab = id;
    E.cfg.tabs.forEach(function (t) {
      var on = t.id === id, b = $('tab_' + t.id);
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
      E.el['p_' + t.id].classList.toggle('on', on);
    });
    if (click) IK.sfx('tap');
    E.dirtyUI = true; E.upSig = ''; E.crownSig = ''; E.goalSig = '';
    E.refreshNow();
    if (id === 'ups') E.coachDid('tab-ups');
  };
  P.refreshTabs = function () {
    var E = this;
    E.cfg.tabs.forEach(function (t) {
      var b = $('tab_' + t.id); if (!b) return;
      b.classList.toggle('lock', !E.tabOpen(t.id));
      b.querySelector('.tl').textContent = E.tabOpen(t.id) ? t.label : 'Lv ' + E.tabLevel(t.id);
    });
  };
  P.updateQty = function () {
    var q = this.S.buy;
    Array.prototype.forEach.call(this.el.qty.children, function (b) { b.classList.toggle('on', +b.dataset.q === q); b.setAttribute('aria-pressed', +b.dataset.q === q ? 'true' : 'false'); });
  };
  function setText(el, s, cache, key) { if (cache[key] !== s) { cache[key] = s; el.textContent = s; } }
  function setHTML(el, s, cache, key) { if (cache[key] !== s) { cache[key] = s; el.innerHTML = s; } }

  P.updateGenRows = function (force) {
    var E = this, S = E.S, hi = E.highest(), i, nrow = 0;
    if (E.dirty !== false) E.recalc();
    for (i = 0; i < E.n; i++) {
      var r = E.rows[i], g = E.gens[i], L = r.last;
      var show = i <= hi + 2 && (E.unlocked(i) || i <= hi + 1);
      if (i > hi + 1 && E.unlocked(i) && i > hi + 2) show = false;
      if (L.show !== show) { L.show = show; r.row.style.display = show ? '' : 'none'; }
      if (!show) continue;
      nrow++;
      var can = E.canBuy(i), lockLvl = !E.unlocked(i);
      var q = S.buy === -1 ? Math.max(1, E.maxN(i)) : S.buy;
      var cost = E.cost(i, q), ok = can && S.coins >= cost && (S.buy !== -1 || E.maxN(i) > 0);
      if (!can) {
        r.row.classList.add('locked');
        r.ico.classList.add('dark');
        setText(r.nm, '???', L, 'nm');
        setText(r.own, '', L, 'own'); r.own.style.display = 'none';
        setText(r.sub, lockLvl ? 'Reach level ' + g.lvl : 'Build a ' + E.gens[i - 1].name + ' first', L, 'sub');
        r.bar.style.width = '0%';
        setText(r.bs, lockLvl ? 'Level ' + g.lvl : 'Locked', L, 'bs');
        setHTML(r.bb, IK.ico.lock(18), L, 'bb');
        r.btn.className = 'ik-buy lockd'; r.btn.disabled = true;
        continue;
      }
      r.row.classList.remove('locked'); r.ico.classList.remove('dark'); r.own.style.display = ''; r.btn.disabled = false;
      setText(r.nm, g.name, L, 'nm');
      setText(r.own, '×' + S.owned[i], L, 'own');
      var mm = E.msMul(S.owned[i]), each = g.inc * mm * E.mul.gen[i] * E.globalMul();
      var ru = E.cfg.rateUnit || '/s';
      var sub = g.sub ? g.sub(E, i, each) : S.owned[i] ? '<b>' + fmt(each * S.owned[i]) + ru + '</b> · ' + fmt(each) + ' each' : (g.desc || fmt(each) + ru + ' each');
      setHTML(r.sub, sub, L, 'sub');
      var nx = E.nextMs(S.owned[i]);
      var prev = 0; for (var k = 0; k < E.ms.length; k++) if (E.ms[k][0] <= S.owned[i]) prev = E.ms[k][0];
      var w = nx ? Math.round((S.owned[i] - prev) / (nx[0] - prev) * 100) : 100;
      if (L.w !== w) { L.w = w; r.bar.style.width = w + '%'; }
      r.bar.parentNode.title = nx ? 'Next ×' + nx[1] + ' at ' + nx[0] : '';
      setText(r.bs, (g.verb || 'Buy') + ' ×' + q, L, 'bs');
      setHTML(r.bb, E.cfg.cur.ico(16) + fmt(cost), L, 'bb');
      var cls = 'ik-buy' + (ok ? '' : ' no');
      if (L.cls !== cls) { if (ok && L.cls && L.cls.indexOf('no') >= 0) { cls += ' aff'; } L.cls = cls; r.btn.className = cls; }
    }
  };

  P.updateUpgrades = function () {
    var E = this, S = E.S;
    if (E.tab !== 'ups' && !E.dirtyUp) { E.upBadge(); return; }
    var avail = E.ups.filter(function (u) { return E.upAvailable(u); }).sort(function (a, b) { return a.cost - b.cost; });
    var sig = avail.map(function (u) { return u.id; }).join(',');
    if (sig !== E.upSig) {
      E.upSig = sig; E.upRows = {}; E.el.upList.innerHTML = '';
      avail.slice(0, 12).forEach(function (u) {
        var row = h('div', 'ik-row');
        row.innerHTML = '<div class="ik-ico">' + (u.ico ? u.ico(44) : '') + '</div><div><div class="ik-nm"><span class="t">' + esc(u.name) + '</span></div><div class="ik-sub">' + esc(u.desc) + '</div></div><button class="ik-buy" type="button"><small>Buy</small><b>' + E.cfg.cur.ico(16) + fmt(u.cost) + '</b></button>';
        var btn = row.querySelector('.ik-buy'); btn.addEventListener('click', function () { E.buyUp(u.id); });
        E.el.upList.appendChild(row); E.upRows[u.id] = { row: row, btn: btn };
      });
      if (!avail.length) E.el.upList.innerHTML = '<div class="ik-empty">Nothing to buy right now.<br>Build more and new upgrades appear here.</div>';
      // next locked previews
      var locked = E.ups.filter(function (u) { return !S.ups[u.id] && !E.upAvailable(u) && (u.kind !== 'gen' || S.owned[u.gen] > 0 || (u.gen > 0 && S.owned[u.gen - 1] > 0)); }).sort(function (a, b) { return a.cost - b.cost; }).slice(0, 4);
      E.el.upNext.innerHTML = '';
      locked.forEach(function (u) {
        var row = h('div', 'ik-row locked');
        row.innerHTML = '<div class="ik-ico dark">' + (u.ico ? u.ico(44) : '') + '</div><div><div class="ik-nm"><span class="t">' + esc(u.name) + '</span></div><div class="ik-sub">' + esc(u.reqText || (u.lvl ? 'Reach level ' + u.lvl : 'Locked')) + '</div></div><div class="ik-buy lockd" style="pointer-events:none"><small>' + fmt(u.cost) + '</small><b>' + IK.ico.lock(18) + '</b></div>';
        E.el.upNext.appendChild(row);
      });
    }
    var afford = 0;
    avail.forEach(function (u) {
      var ok = S.coins >= u.cost; if (ok) afford++;
      var r = E.upRows[u.id]; if (r) { var cls = 'ik-buy' + (ok ? '' : ' no'); if (r.btn.className !== cls) r.btn.className = cls; }
    });
    var t = E.el.upS, txt = avail.length ? afford + ' of ' + avail.length + ' you can afford now' : 'Keep building to unlock more';
    if (t.textContent !== txt) t.textContent = txt;
    E.el.upAll.disabled = !afford;
    E.upBadge(afford);
    E.dirtyUp = false;
  };
  P.upBadge = function (afford) {
    var E = this;
    if (afford == null) { afford = 0; E.ups.forEach(function (u) { if (E.upAvailable(u) && E.S.coins >= u.cost) afford++; }); }
    var d = $('dot_ups'); if (!d) return;
    var on = E.tabOpen('ups') && afford > 0 && E.tab !== 'ups';
    d.classList.toggle('on', on); if (on) d.textContent = String(Math.min(afford, 99));
  };

  P.updateGoals = function () {
    var E = this, S = E.S, d = S.daily;
    var sig = E.tab === 'goals' ? JSON.stringify([d && d.quests, d && d.days.length, S.gift === IK.today(), E.achCount(), S.chests, d && d.weekChest, E.cfg.goalsSig ? E.cfg.goalsSig(E) : 0]) : '';
    // badge on the tab
    var claimables = 0; if (d) d.quests.forEach(function (q) { if (q.done && !q.claimed) claimables++; }); if (S.gift !== IK.today() && E.tabOpen('goals')) claimables++;
    var dot = $('dot_goals'), on = E.tabOpen('goals') && claimables > 0 && E.tab !== 'goals'; if (dot) { dot.classList.toggle('on', on); if (on) dot.textContent = String(claimables); }
    if (E.tab !== 'goals' || sig === E.goalSig) return;
    E.goalSig = sig;
    var html = '';
    var today = IK.today(), w = IK.Daily.week(S);
    html += '<div class="ik-card"><h3>Daily gift</h3><div class="ik-sub">' + (S.gift === today ? 'Claimed. Come back tomorrow for a bigger one.' : 'A free present every day. A longer streak means a bigger gift.') + '</div>' +
      '<button class="ik-btn acc wide" id="btnGift" style="margin-top:8px"' + (S.gift === today ? ' disabled' : '') + '>' + (S.gift === today ? 'Claimed today' : 'Claim gift') + '</button></div>';
    html += '<div class="ik-sec">Today\'s goals</div>';
    if (d) d.quests.forEach(function (q, i) {
      var pct = Math.min(100, Math.round(q.prog / q.goal * 100));
      html += '<div class="ik-row" style="grid-template-columns:1fr auto"><div><div class="ik-nm"><span class="t" style="white-space:normal">' + esc(E.questText(q)) + '</span></div><div class="ik-sub">' + fmt(q.prog) + ' / ' + fmt(q.goal) + ' · reward XP + ' + E.cfg.cur.name + '</div><div class="ik-bar good"><i style="width:' + pct + '%"></i></div></div>' +
        '<button class="ik-btn ' + (q.claimed ? 'ghost' : q.done ? 'acc' : 'ghost') + '" data-q="' + i + '" style="min-width:86px"' + (q.done && !q.claimed ? '' : ' disabled') + '>' + (q.claimed ? IK.ico.check(18) : q.done ? 'Claim' : pct + '%') + '</button></div>';
    });
    var names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    html += '<div class="ik-card"><h3>This week</h3><div class="ik-stamps">' + w.stamps.map(function (on, i) { return '<div class="ik-stamp' + (on ? ' on' : '') + (i === w.todayIdx ? ' today' : '') + '">' + names[i].charAt(0) + '</div>'; }).join('') + '</div>' +
      '<div class="ik-sub">Play on 5 days for a reward: <b>' + w.count + '/5</b> · streak <b>' + ((d && d.streak) || 0) + '</b> · ' + w.lifetime + ' days played in all</div>' +
      '<button class="ik-btn acc wide" id="btnWeek" style="margin-top:8px"' + (w.count >= 5 && d.weekChest !== w.mon ? '' : ' disabled') + '>' + (d && d.weekChest === w.mon ? 'Weekly chests claimed' : w.count >= 5 ? 'Claim 2 chests' : 'Play ' + (5 - w.count) + ' more day' + (5 - w.count === 1 ? '' : 's')) + '</button></div>';
    html += '<div class="ik-sec">Deeds · ' + E.achCount() + '/' + E.cfg.ach.length + ' (+' + (E.achCount() * 2) + '% income)</div>';
    E.cfg.ach.forEach(function (a) {
      var got = S.ach[a.id], pr = a.prog ? a.prog(S, E) : null, pct = got ? 100 : pr ? Math.min(100, Math.round(pr[0] / pr[1] * 100)) : 0;
      html += '<div class="ik-row' + (got ? '' : ' locked') + '" style="grid-template-columns:44px 1fr"><div class="ik-ico' + (got ? '' : ' dark') + '" style="width:44px;height:44px">' + (a.ico ? a.ico(32) : '') + '</div><div><div class="ik-nm"><span class="t">' + esc(a.name) + '</span>' + (got ? '<span class="ik-own">+2%</span>' : '') + '</div><div class="ik-sub">' + esc(a.desc) + (pr && !got ? ' · ' + fmt(pr[0]) + '/' + fmt(pr[1]) : '') + '</div>' + (got ? '' : '<div class="ik-bar"><i style="width:' + pct + '%"></i></div>') + '</div></div>';
    });
    if (E.cfg.goalsExtra) html += E.cfg.goalsExtra(E);
    E.el.goalsBody.innerHTML = html;
    var g = $('btnGift'); if (g) g.addEventListener('click', function () { E.claimGift(); });
    var wk = $('btnWeek'); if (wk) wk.addEventListener('click', function () { E.claimWeek(); });
    Array.prototype.forEach.call(E.el.goalsBody.querySelectorAll('button[data-q]'), function (b) { b.addEventListener('click', function () { E.claimQuest(+b.dataset.q); }); });
  };

  P.updateCrown = function () {
    var E = this, S = E.S, p = E.cfg.prestige, g = E.prestigeGain();
    var dot = $('dot_crown'); if (dot) { var on = E.tabOpen('crown') && g >= 1 && E.tab !== 'crown'; dot.classList.toggle('on', on); if (on) dot.textContent = '!'; }
    E.el.premW.hidden = !(S.prem > 0 || g >= 1);
    var pv = String(S.prem - S.spent); if (E.txt.get('prem') !== pv) { E.txt.set('prem', pv); E.el.prem.textContent = pv; }
    if (E.tab !== 'crown') return;
    var nextAt = Math.pow((g + 1) / p.coef, 2) * p.unit, prevAt = Math.pow(g / p.coef, 2) * p.unit, pct = Math.max(0, Math.min(100, (S.lifetime - prevAt) / (nextAt - prevAt) * 100));
    var sig = [g, S.prem, S.spent, Object.keys(S.perks).map(function (k) { return k + S.perks[k]; }).join(','), Math.floor(pct / 4)].join('|') + '|' + Math.floor(S.lifetime > 0 ? Math.log10(S.lifetime + 1) * 4 : 0);
    if (sig === E.crownSig) return;
    E.crownSig = sig;
    var html = '<div class="ik-card" style="text-align:center"><div class="ik-sheet-art">' + p.ico(56) + '</div><h3>' + esc(p.label) + '</h3>' +
      '<div class="ik-sub">' + esc(p.lore) + '</div>' +
      '<div class="ik-kv"><span>' + esc(p.plural) + ' you have</span><b>' + (S.prem - S.spent) + ' / ' + S.prem + '</b></div>' +
      '<div class="ik-kv"><span>Income bonus</span><b>+' + Math.round(p.per * S.prem * 100) + '%</b></div>' +
      '<div class="ik-kv"><span>You would gain now</span><b>+' + g + '</b></div>' +
      '<div class="ik-bar tall good" style="margin:8px 0 2px"><i style="width:' + pct.toFixed(0) + '%"></i></div><div class="ik-sub">Next ' + esc(p.name.toLowerCase()) + ' at <b>' + fmt(nextAt) + '</b> earned this age (' + fmt(S.lifetime) + ' so far)</div>' +
      '<button class="ik-btn royal wide big" id="btnDecree" style="margin-top:10px"' + (g >= 1 ? '' : ' disabled') + '>' + (g >= 1 ? esc(p.label) + ' +' + g : esc(p.label) + ' (needs ' + fmt(p.unit / (p.coef * p.coef)) + ')') + '</button>' +
      '<div class="ik-sub" style="margin-top:6px">Restarts your buildings and coins. You keep level, deeds, ' + esc(p.plural.toLowerCase()) + ' and perks.</div></div>';
    html += '<div class="ik-sec">' + esc(p.plural) + ' shop</div>';
    (E.cfg.perks || []).forEach(function (pk) {
      var lv = S.perks[pk.id] | 0, maxed = lv >= pk.max, cst = maxed ? 0 : pk.cost(lv), can = !maxed && (S.prem - S.spent) >= cst;
      html += '<div class="ik-row"><div class="ik-ico dark">' + pk.ico(44) + '</div><div><div class="ik-nm"><span class="t">' + esc(pk.name) + '</span><span class="ik-own">' + lv + '/' + pk.max + '</span></div><div class="ik-sub">' + esc(pk.desc) + '</div></div>' +
        '<button class="ik-buy' + (can ? '' : ' no') + '" data-perk="' + pk.id + '"' + (maxed ? ' disabled' : '') + '><small>' + (maxed ? 'Maxed' : 'Buy') + '</small><b>' + (maxed ? IK.ico.check(18) : p.ico(16) + cst) + '</b></button></div>';
    });
    E.el.crownBody.innerHTML = html;
    var d = $('btnDecree'); if (d) d.addEventListener('click', function () { E.confirmPrestige(); });
    Array.prototype.forEach.call(E.el.crownBody.querySelectorAll('button[data-perk]'), function (b) { b.addEventListener('click', function () { E.buyPerk(b.dataset.perk); }); });
  };
  P.confirmPrestige = function () {
    var E = this, p = E.cfg.prestige, g = E.prestigeGain();
    IK.sheet({ art: p.ico(64), title: p.label.toUpperCase() + '?', sub: 'You will gain <b>+' + g + ' ' + esc(p.plural.toLowerCase()) + '</b> (+' + Math.round(g * p.per * 100) + '% income).',
      body: 'Your buildings and coins start over. Level, deeds, ' + esc(p.plural.toLowerCase()) + ' and perks stay.',
      actions: [{ label: p.label + ' now', cls: 'royal', onClick: function () { setTimeout(function () { E.prestige(); }, 30); } }, { label: 'Not yet', cls: 'ghost' }] });
  };

  /* the "next goal" chip: the one thing worth doing right now */
  P.updateGoalChip = function () {
    var E = this, S = E.S, c = E.cfg, hi = E.highest(), g = null, i;
    if (c.goalChip) { g = c.goalChip(E); if (g) { E.goalTab = g.tab || 'build'; E.goalAct = null; E.paintGoal(g); return; } }
    var claim = 0; if (S.daily) S.daily.quests.forEach(function (q) { if (q.done && !q.claimed) claim++; });
    E.goalTab = 'build'; E.goalAct = null;
    if (E.prestigeGain() >= 1 && E.tabOpen('crown') && S.lifetime > c.prestige.unit * 4) {
      var pg = E.prestigeGain(); g = { t: c.prestige.label + ' is ready', s: 'Gain +' + pg + ' ' + c.prestige.plural.toLowerCase(), p: 1, r: '+' + pg, ready: true }; E.goalTab = 'crown';
    } else if (claim) { g = { t: claim + ' goal' + (claim > 1 ? 's' : '') + ' ready', s: 'Tap to collect your reward', p: 1, r: 'XP', ready: true }; E.goalTab = 'goals'; }
    else if (S.gift !== IK.today() && E.tabOpen('goals')) { g = { t: 'Your daily gift is waiting', s: 'Free coins, every day', p: 1, r: '', ready: true }; E.goalTab = 'goals'; }
    else if (hi < 0) { g = { t: 'Build your first ' + E.gens[0].name, s: fmt(E.cost(0, 1)) + ' ' + c.cur.name + ' · tap the ' + (c.tapName || 'coin') + ' to earn', p: Math.min(1, S.coins / E.cost(0, 1)), r: '+XP', ready: S.coins >= E.cost(0, 1) }; }
    else {
      // cheapest of: next tier, next milestone, next upgrade
      var best = null;
      function cand(t, s, need, r) { var p = Math.min(1, S.coins / Math.max(1, need)); if (!best || need < best.need) best = { t: t, s: s, need: need, p: p, r: r, ready: S.coins >= need }; }
      var nx = hi + 1; if (nx < E.n && E.canBuy(nx)) cand('Build a ' + E.gens[nx].name, fmt(E.cost(nx, 1)) + ' ' + c.cur.name, E.cost(nx, 1), 'New tier');
      else if (nx < E.n && !E.unlocked(nx)) { g = g || null; }
      for (i = 0; i <= hi; i++) { var m = E.nextMs(S.owned[i]); if (m && m[0] - S.owned[i] <= 12) cand(E.gens[i].name + ' ×' + m[0], 'Own ' + m[0] + ' for ×' + m[1] + ' output (' + (m[0] - S.owned[i]) + ' more)', E.cost(i, m[0] - S.owned[i]), '×' + m[1]); }
      if (E.tabOpen('ups')) { E.ups.forEach(function (u) { if (E.upAvailable(u)) cand(u.name, u.desc, u.cost, 'Upgrade'); }); }
      if (best) { g = { t: best.t, s: best.s, p: best.p, r: best.r, ready: best.ready }; if (best.r === 'Upgrade') E.goalTab = 'ups'; }
      else { var lv = E.levelInfo(); g = { t: 'Reach level ' + (lv.lvl + 1), s: (lv.need - Math.floor(lv.into)) + ' XP to go: buy and build', p: lv.pct, r: 'Unlock' }; }
    }
    if (!g) g = { t: 'Keep building', s: '', p: 0, r: '' };
    E.paintGoal(g);
  };
  P.paintGoal = function (g) {
    var E = this;
    var q = E.el, L = E.txt;
    if (L.get('qT') !== g.t) { L.set('qT', g.t); q.qT.textContent = g.t; }
    if (L.get('qS') !== g.s) { L.set('qS', g.s); q.qS.textContent = g.s; }
    if (L.get('qR') !== g.r) { L.set('qR', g.r); q.qR.textContent = g.r; }
    var w = Math.round(g.p * 100) + '%'; if (L.get('qB') !== w) { L.set('qB', w); q.qBar.style.width = w; }
    q.quest.classList.toggle('ready', !!g.ready);
    E.goalReady = !!g.ready;
  };

  P.updateHud = function () {
    var E = this, S = E.S, L = E.txt, inc = E.income();
    E.roll.set(S.coins);
    var r = E.cfg.rateFn ? E.cfg.rateFn(E) : fmt(inc) + (E.cfg.rateUnit || '/s') + (E.frenzy > 0 ? '  ×' + E.frenzyMul : ''); if (L.get('rate') !== r) { L.set('rate', r); E.el.rate.textContent = r; }
    var li = E.levelInfo();
    var ln = String(li.lvl); if (L.get('lvN') !== ln) { L.set('lvN', ln); E.el.lvN.textContent = ln; }
    var lt = Math.floor(li.into) + '/' + li.need + ' XP'; if (L.get('lvT') !== lt) { L.set('lvT', lt); E.el.lvT.textContent = lt; }
    var lw = (li.pct * 100).toFixed(1) + '%'; if (L.get('lvBar') !== lw) { L.set('lvBar', lw); E.el.lvBar.style.width = lw; }
    // chips in the scene: events with timers
    var chips = [];
    if (E.rush > 0) chips.push('<span class="ik-chip hot">RUSH ×3 taps · ' + Math.ceil(E.rush) + 's</span>');
    if (E.frenzy > 0) chips.push('<span class="ik-chip cool">FESTIVAL ×' + E.frenzyMul + ' · ' + Math.ceil(E.frenzy) + 's</span>');
    if (E.carEnd) chips.push('<span class="ik-chip">CARAVAN · ' + Math.max(0, Math.ceil((E.carEnd - IK.now()) / 1000)) + 's</span>');
    var cs = chips.join(''); if (L.get('chips') !== cs) { L.set('chips', cs); E.el.chips.innerHTML = cs; }
  };
  P.updateStrip = function () {
    var E = this, S = E.S, L = E.txt, s = '';
    if (S.chests > 0 && E.tabOpen('goals')) s += '<button class="ik-btn acc" id="stChest" type="button" style="min-width:0;flex:1">Open chest ×' + S.chests + '</button>';
    if (E.tabOpen('goals')) {
      if (E.carEnd) s += '<button class="ik-btn ghost" disabled style="min-width:0;flex:1">Caravan back in ' + Math.max(0, Math.ceil((E.carEnd - IK.now()) / 1000)) + 's</button>';
      else if (S.coins >= 1000 && E.carDue === 0) s += '<button class="ik-btn go" id="stCar" type="button" style="min-width:0;flex:1">Send caravan (25%)</button>';
    }
    if (L.get('strip') !== s) {
      L.set('strip', s); E.el.strip.innerHTML = s; E.el.strip.style.cssText = s ? 'display:flex;gap:8px;margin-bottom:8px' : 'display:none';
      var a = $('stChest'); if (a) { E.el.chest = a; a.addEventListener('click', function () { E.openChest(); }); }
      var b = $('stCar'); if (b) b.addEventListener('click', function () { E.startCaravan(); });
    }
  };

  P.refreshAll = function () {
    var E = this, c = E.cfg;
    E.updateHud();
    if (E.hasTab('build') && !c.noBuild) { E.updateGenRows(); E.updateStrip(); }
    if (E.hasTab('ups')) E.updateUpgrades();
    if (E.hasTab('goals')) E.updateGoals();
    if (E.hasTab('crown')) E.updateCrown();
    if (c.panels) c.tabs.forEach(function (t) { if (c.panels[t.id] && c.panels[t.id].update) c.panels[t.id].update(E, E.el['p_' + t.id], E.tab === t.id); });
    if (c.updateHud) c.updateHud(E, E.el);
    E.updateGoalChip();
  };
  P.refreshNow = function () { this.dirtyUI = false; this.refreshAll(); };

  /* ================= run loop ================= */
  P.start = function (teach) {
    var E = this, S = E.S;
    E.el.title.hidden = true;
    E.inGame = true;
    IK.warm(['button', 'coin', 'tap', 'powerup', 'levelup', 'collect', 'unlock', 'reward', 'error', 'whoosh', 'cheer']);
    E.carDue = IK.now() + (150 + Math.random() * 120) * 1000;
    E.evNext = IK.now() + (25 + Math.random() * 25) * 1000;
    E.rushNext = IK.now() + (60 + Math.random() * 50) * 1000;
    E.refreshTabs(); if (E.el.qty) E.updateQty(); E.refreshNow();
    E.roll.set(S.coins, true);
    E.report('play');
    if (E.coach) { E.coach.stop(); E.coach = null; }
    if (E.cfg.coach && (teach === true || !IK.coachSeen(E.cfg.id))) {
      E.switchTab('build');
      E.coach = IK.coach({ key: E.cfg.id, steps: E.cfg.coach(E), onDone: function () { E.coach = null; } });
    }
    E.pumpSheets();
  };
  P.toTitle = function () {
    var E = this;
    E.save(); E.inGame = false;
    if (E.coach) { E.coach.stop(); E.coach = null; }
    IK.closeSheet(true);
    E.refreshTitle(); E.el.title.hidden = false;
    E.report('title');
  };
  P.coachDid = function (ev) { if (this.coach) this.coach.did(ev); };
  P.report = function (sc, score) {
    var E = this, S = E.S;
    if (!W.ArcadeSDK) return;
    try { W.ArcadeSDK.state({ scene: sc || (E.inGame ? 'play' : 'title'), score: score != null ? score : Math.floor(S.alltime), level: S.lvl }); } catch (e) {}
  };
  P.hint = function () {
    var E = this, S = E.S;
    if (!E.inGame) return 'Press Play, tap to earn your first ' + E.gens[0].name + ', then keep buying.';
    if (E.el.qT) return E.el.qT.textContent + '. ' + E.el.qS.textContent;
    return 'Buy the next building.';
  };

  P.tick = function (dt) {
    var E = this, S = E.S, now = IK.now();
    if (!E.inGame) return;
    if (E.dirty !== false) E.recalc();
    var inc = E.cfg.noPassive ? 0 : E.income() * dt;
    if (inc > 0) { S.coins += inc; S.lifetime += inc; S.alltime += inc; E.earnAcc = (E.earnAcc || 0) + inc; }
    if (E.cfg.onTick) E.cfg.onTick(E, dt);
    if (E.rush > 0) E.rush = Math.max(0, E.rush - dt);
    if (E.frenzy > 0) E.frenzy = Math.max(0, E.frenzy - dt);
    if (E.mul.auto > 0) { E.autoAcc = (E.autoAcc || 0) + dt * E.mul.auto; while (E.autoAcc >= 1) { E.autoAcc -= 1; E.tapMain(null, null, true); } }
    // rush: only when the player has been tapping lately
    if (!E.cfg.noEvents && E.rush === 0 && now > E.rushNext && now - E.lastTapAt < 15000 && E.tabOpen('goals')) { E.rush = 12; S.stats.rushes++; E.rushNext = now + (70 + Math.random() * 60) * 1000 / E.mul.luck; IK.toast('GOLDEN RUSH! Taps ×3 for 12s', { icon: '&#9889;', kind: 'gold' }); IK.sfx('powerup'); IK.fx.flash('#ffe27a', 220); }
    // critters
    if (!E.cfg.noEvents && now > E.evNext && E.tabOpen('goals') && !E.critterOut && !IK.sheetOpen()) { E.evNext = now + 40000; if (E.scene.spawnCritter && E.scene.spawnCritter()) E.critterOut = true; }
    // caravan
    if (E.carEnd && now >= E.carEnd) {
      var pay = Math.floor(E.carStake * (1.5 + Math.random() * 0.9)); E.gain(pay); E.carEnd = 0; E.carStake = 0; E.carDue = now + (150 + Math.random() * 150) * 1000;
      IK.toast('Caravan delivered +' + fmt(pay) + '!', { icon: '&#128667;', kind: 'gold' }); IK.sfx('cheer'); IK.fx.confetti(30); IK.fx.flyTo(W.innerWidth / 2, W.innerHeight * 0.4, E.el.wallet, { n: 10 });
      E.event('caravan', 1); E.dirtyUI = true;
      if (E.scene.onCaravan) E.scene.onCaravan('back');
    }
    if (!E.cfg.noEvents && !E.carEnd && E.carDue && now >= E.carDue && S.coins >= 1000) { E.carDue = 0; IK.toast('A caravan is ready to trade!', { icon: '&#128667;' }); IK.sfx('whoosh'); E.dirtyUI = true; }
    E.achT += dt; if (E.achT > 1) { E.achT = 0; E.checkAch(); if (E.earnAcc) { E.event('earn', E.earnAcc); E.earnAcc = 0; } }
    E.saveT += dt; if (E.saveT > 6) { E.saveT = 0; E.save(); }
    E.sdkT += dt; if (E.sdkT > 8) { E.sdkT = 0; E.report(); }
  };

  P.loop = function (ts) {
    var E = this;
    if (!E.lastTs) E.lastTs = ts;
    var dt = Math.min((ts - E.lastTs) / 1000, 0.25); E.lastTs = ts;
    E.tick(dt);
    E.roll.step(dt, E.el.cur);
    E.uiAcc += dt;
    if (E.uiAcc >= 0.1 || E.dirtyUI) { E.uiAcc = 0; E.dirtyUI = false; if (E.inGame) E.refreshAll(); }
    if (E.scene) { if (E.scene.update) E.scene.update(dt); if (E.scene.stage) E.scene.stage.frame(ts); }
    E.pumpSheets();
    W.requestAnimationFrame(E.loopB);
  };

  P.code = function (raw) {
    var E = this, c = E.cfg, code = String(raw || '').toUpperCase(), S = E.S;
    if (!E.codes) E.codes = {};
    var r = c.cheats && c.cheats[code];
    if (!r) return { ok: false };
    var msg = r(E);
    E.cheated = true;
    E.dirty = true; E.recalc(); E.dirtyUI = true;
    return { ok: true, message: msg + ' Codes on: this session is not saved.' };
  };

  /* boot: build the UI, load, offer offline earnings, start the loop */
  P.boot = function (root) {
    var E = this, c = E.cfg, S = E.S;
    IK.muted = IK.ls.get(c.muteKey) === '1';
    IK.fx.init($('fx'));
    E.build(root);
    IK.Daily.ensure(S, c.id, c.dailyPool, E);
    E.dirty = true; E.recalc();
    E.roll.set(S.coins, true);
    E.refreshTitle();
    E.loopB = function (ts) { E.loop(ts); };
    var away = (IK.now() - S.last) / 1000;
    E.offline(away, true);
    E.report('title');
    W.requestAnimationFrame(E.loopB);
    // real-clock away time when the tab was hidden or the phone slept
    D.addEventListener('visibilitychange', function () {
      if (D.hidden) { E.hiddenAt = IK.now(); E.save(); }
      else if (E.hiddenAt && E.inGame) { var away2 = (IK.now() - E.hiddenAt) / 1000; E.hiddenAt = 0; if (away2 > 90) { E.offline(away2); } }
    });
    W.addEventListener('pagehide', function () { E.save(); });
    W.addEventListener('beforeunload', function () { E.save(); });
    if (W.ArcadeSDK) {
      W.ArcadeSDK.init({ pauseButton: 'tr',
        onRestart: function () { E.toTitle(); E.start(false); },
        onExit: function () { E.toTitle(); },
        onTutorial: function () { if (E.el.title.hidden === false) E.start(true); else { IK.ls.del('ik_coach_' + c.id); E.start(true); } },
        onHint: function () { return E.hint(); },
        onCheat: function (code) { return E.code(code); } });
    }
    return E;
  };
})(window);
