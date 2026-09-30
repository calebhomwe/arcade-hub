/* metakit.js: the "reason to come back tomorrow" layer for the hub's action games.
 * One small module, no dependencies, everything saved in ONE localStorage key per game ("hm-<id>").
 *
 *   const meta = HubMeta.create({
 *     id: 'flappy', title: 'Flappy Flight', coin: { icon: '🪶', name: 'Feathers' }, accent: '#facc15',
 *     skins: [{ id: 'sunny', name: 'Sunny', cost: 0 }, { id: 'rose', name: 'Rosie', cost: 40 }, { id: 'gold', name: 'Golden', req: { stat: 'best', v: 30, text: 'Score 30' } }],
 *     drawSkin(ctx, skin, cx, cy, size, t) { ... },          // used by the shop, the result card and the game itself
 *     medals: [{ name: 'Bronze', at: 10 }, { name: 'Silver', at: 20 }, { name: 'Gold', at: 35 }, { name: 'Platinum', at: 60 }],
 *     missions: [{ id: 'p10', text: 'Fly through 10 pipes in one run', stat: 'score', kind: 'max', target: 10, reward: 15, easy: true }, ...],
 *     daily: [{ id: 'd1', text: 'Fly through 25 pipes today', stat: 'pipes', kind: 'sum', target: 25 }, ...],   // the star challenge, 2x reward
 *   });
 *   meta.begin();  meta.add('pipes', 1);  meta.max('score', 12);                  // during a run
 *   const res = meta.finish({ score: 12, coins: 9, mode: 'classic' });             // at game over (returns what to show)
 *   meta.showResult({ res, onAgain() {}, onMenu() {} });                           // the "one more try" card
 *   meta.mountBar(document.getElementById('start'));                               // coins, week stamps, Skins, Missions on the title
 *
 * Rules kept on purpose (docs/playbook/PROGRESSION.md): cosmetics only, bought with coins at a fixed price (no chance boxes),
 * streaks forgive (a week of stamps, never an infinite counter), no timers, nothing to pay, a lost run still pays coins. */
(function (G) {
  'use strict';
  const D = G.document;
  const CSS = `
@font-face{font-family:'Nunito';src:url(assets/fonts/nunito.woff2) format('woff2');font-weight:200 1000;font-display:swap}
.hm,.hm *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.hm{--navy1:#22405a;--navy2:#132535;--line:rgba(150,196,228,.34);--gold1:#f7dc82;--gold2:#d29b2c;--gold3:#7b5211;--par1:#f5ecd4;--par2:#e4d3a9;--ink:#3a2915;--g1:#9bdc57;--g2:#4c9a29;--g3:#2b5f14;
  font-family:'Nunito',ui-rounded,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-weight:700;color:#f3ead2;-webkit-user-select:none;user-select:none}
.hm button{font-family:inherit;font-weight:800;cursor:pointer;border:0;color:inherit}
.hm-back{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));background:radial-gradient(120% 90% at 50% 30%,rgba(40,30,20,.5),rgba(4,8,14,.9));backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);overflow:auto;overscroll-behavior:contain;animation:hmFade .22s ease-out}
.hm-card{width:min(100%,384px);max-height:100%;overflow:auto;background:radial-gradient(120% 60% at 50% 0,rgba(120,180,225,.22),rgba(0,0,0,0) 60%),linear-gradient(180deg,var(--navy1) 0%,var(--navy2) 100%);border:2px solid var(--line);border-radius:22px;padding:16px 14px 14px;box-shadow:0 22px 56px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 0 3px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.6);animation:hmPop .36s cubic-bezier(.2,1.25,.4,1)}
.hm-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid transparent;border-image:linear-gradient(90deg,transparent,var(--gold2),transparent) 1}
.hm-h h2{font-family:'Iowan Old Style','Palatino Linotype',Palatino,'New York',Georgia,serif;font-size:25px;font-weight:800;letter-spacing:.3px;color:#fbf1d3;text-shadow:0 2px 0 rgba(0,0,0,.55),0 0 14px rgba(255,205,110,.25)}
.hm-x{width:46px;height:46px;border-radius:13px;background:linear-gradient(180deg,#2c4a63,#1a3145);border:2px solid var(--line);font-size:20px;line-height:1;color:#dfeaf3}
.hm-x:active{transform:scale(.92)}
.hm-btn{min-height:52px;padding:0 20px;border-radius:15px;font-size:19px;letter-spacing:.3px;color:#fff;text-shadow:0 2px 0 rgba(20,60,10,.7);background:linear-gradient(180deg,var(--g1),var(--g2) 62%,#3f8522);border:1px solid rgba(255,255,255,.35);border-bottom:4px solid var(--g3);box-shadow:0 6px 14px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.4),inset 0 -10px 16px rgba(20,70,10,.35);transition:transform .08s}
.hm-btn:active{transform:translateY(3px);border-bottom-width:2px;box-shadow:0 2px 6px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.3)}
.hm-btn.big{min-height:62px;font-size:25px;width:100%;border-radius:18px}
.hm-btn.sec{color:#3a2408;text-shadow:0 1px 0 rgba(255,240,190,.8);background:linear-gradient(180deg,var(--gold1),var(--gold2) 70%,#b57d1c);border-color:rgba(255,255,255,.45);border-bottom-color:var(--gold3);box-shadow:0 5px 12px rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.5),inset 0 -8px 14px rgba(120,70,0,.28)}
.hm-btn.ghost{color:#cfe0ee;text-shadow:none;background:linear-gradient(180deg,#2c4a63,#1a3145);border-color:var(--line);border-bottom-color:#0d1b28;box-shadow:none}
.hm-btn[disabled]{opacity:.5;filter:grayscale(.5);pointer-events:none}
.hm-btn:focus-visible,.hm-x:focus-visible,.hm-chip:focus-visible,.hm-sk:focus-visible{outline:3px solid #fff;outline-offset:2px}
.hm-row{display:flex;gap:8px;align-items:stretch}
.hm-row>*{flex:1;min-width:0}
.hm-row .hm-btn{padding:0 6px;font-size:17px;white-space:nowrap;min-height:50px}
.hm-score{text-align:center;margin:0 0 4px}
.hm-score .n{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;font-size:66px;font-weight:900;line-height:1.05;display:inline-block;color:#ffe9a0;background:linear-gradient(180deg,#fff6cf 10%,#f2c14e 55%,#c98a1e);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 3px 0 rgba(60,30,0,.7)) drop-shadow(0 0 14px rgba(255,190,80,.35))}
.hm-score .l{font-size:13px;letter-spacing:2px;color:#b9d0e2;font-weight:800;margin-top:-4px}
.hm-medal{display:flex;justify-content:center;margin:0}
.hm-medal.has{margin:2px 0 2px;min-height:64px}
.hm-medal svg{width:64px;height:64px;filter:drop-shadow(0 5px 6px rgba(0,0,0,.5));animation:hmPop .6s cubic-bezier(.2,1.5,.4,1) .2s both}
.hm-cta{position:sticky;bottom:-14px;margin:0 -14px -14px;padding:10px 14px 14px;background:linear-gradient(180deg,rgba(19,37,53,0),rgba(19,37,53,.97) 22%);border-radius:0 0 20px 20px}
.hm-stars{display:flex;justify-content:center;gap:6px;margin:0 0 6px}
.hm-star{width:56px;height:56px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45));animation:hmPop .5s cubic-bezier(.2,1.6,.4,1) both}
.hm-star:nth-child(2){margin-top:-8px}
.hm-best{text-align:center;font-size:17px;font-weight:800;margin-bottom:8px;color:#dbe7f1}
.hm-best b{color:var(--gold1)}
.hm-top{display:flex;gap:8px;justify-content:center;align-items:center;font-size:15px;color:#b9d0e2;margin:-2px 0 8px;font-weight:800}
.hm-top span{padding:1px 8px;border-radius:99px;background:rgba(0,0,0,.3)}
.hm-top span.me{background:linear-gradient(180deg,#f7dc82,#d29b2c);color:#3a2408}
.hm-new{display:inline-block;background:linear-gradient(180deg,#ff8a5c,#d9412c);color:#fff;font-weight:900;border-radius:999px;padding:3px 14px;font-size:15px;letter-spacing:1.5px;border:1px solid rgba(255,255,255,.4);text-shadow:0 1px 0 rgba(90,10,0,.7);box-shadow:0 3px 8px rgba(0,0,0,.4);animation:hmPulse 1s ease-in-out infinite}
.hm-earn{display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.22));border:1px solid var(--line);border-radius:14px;padding:8px 12px;margin-bottom:8px;font-size:22px;font-weight:900;box-shadow:inset 0 2px 6px rgba(0,0,0,.4)}
.hm-earn .plus{color:var(--gold1);text-shadow:0 2px 0 rgba(0,0,0,.5)}
.hm-earn small{font-size:14px;font-weight:700;color:#b9d0e2}
.hm-list{display:grid;gap:6px;margin-bottom:10px}
.hm-m{display:grid;grid-template-columns:1fr auto;gap:3px 8px;align-items:center;background:linear-gradient(180deg,var(--par1),var(--par2));border:1px solid #b79f6b;border-radius:12px;padding:6px 10px 7px;font-size:15px;line-height:1.2;color:var(--ink);box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.7)}
.hm-m .t{font-weight:800}
.hm-m .r{font-weight:900;color:#8a5a06;font-size:15px;white-space:nowrap}
.hm-m.done{background:linear-gradient(180deg,#e2f0c4,#c5dd93);border-color:#8fae55}
.hm-m.done .t::before{content:'\\2713  ';color:#2f7a12;font-weight:900}
.hm-m.done .r{color:#2f6a12}
.hm-m.star{background:linear-gradient(180deg,#fff0bf,#f1d27c);border-color:#c8942b}
.hm-m.fresh{animation:hmPulse .8s ease-in-out 2}
.hm-bar{grid-column:1/-1;height:8px;border-radius:99px;background:rgba(40,25,5,.55);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.6)}
.hm-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(180deg,#b6ee7a,#4c9a29);box-shadow:inset 0 1px 0 rgba(255,255,255,.55);width:0;transition:width .7s cubic-bezier(.2,.9,.3,1)}
.hm-next{display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,var(--par1),var(--par2));border:1px solid #b79f6b;border-radius:14px;padding:8px 10px;margin-bottom:12px;color:var(--ink);box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.7)}
.hm-next canvas{width:54px;height:54px;flex:none;border-radius:12px;background:radial-gradient(circle at 50% 40%,#fff8e4,#d9c592);box-shadow:inset 0 0 0 1px #b79f6b}
.hm-next .tx{flex:1;min-width:0;font-size:15px;line-height:1.25;font-weight:700}
.hm-next .tx b{font-weight:900;display:block;font-size:16px}
.hm-week{display:flex;gap:5px;justify-content:center;margin:4px 0}
.hm-week span{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;background:rgba(0,0,0,.35);color:#9db6c9;box-shadow:inset 0 2px 4px rgba(0,0,0,.5)}
.hm-week span.on{background:radial-gradient(circle at 35% 30%,#fff2b0,#e9b53c 60%,#a8710f);color:#4a2c00;box-shadow:0 0 12px rgba(250,190,60,.6),inset 0 1px 0 rgba(255,255,255,.7)}
.hm-week span.today{outline:2px solid #fff;outline-offset:1px}
.hm-bar-row{display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}
.hm-chip{min-height:46px;min-width:46px;padding:0 14px;border-radius:14px;background:linear-gradient(180deg,rgba(38,68,94,.94),rgba(15,30,44,.94));border:2px solid var(--line);font-size:17px;font-weight:900;display:inline-flex;align-items:center;gap:6px;color:#f3ead2;position:relative;box-shadow:0 3px 8px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18)}
.hm-chip:active{transform:scale(.95)}
.hm-chip .dot{position:absolute;top:-7px;right:-7px;min-width:23px;height:23px;border-radius:99px;background:linear-gradient(180deg,#ff7a5c,#d13a22);color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 5px;border:2px solid #132535}
.hm-coin{font-size:18px}
.hm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.hm-sk{background:linear-gradient(180deg,var(--par1),var(--par2));border:2px solid #b79f6b;border-radius:16px;padding:8px 8px 9px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:3px;min-height:158px;position:relative;color:var(--ink);box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.75)}
.hm-sk.eq{border-color:#e0a32c;background:linear-gradient(180deg,#fff2c4,#f0d58a);box-shadow:0 0 0 2px rgba(255,200,80,.6),0 3px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.8)}
.hm-sk canvas{width:84px;height:84px;border-radius:12px;background:radial-gradient(circle at 50% 42%,rgba(255,255,255,.75),rgba(200,180,130,.35) 70%,rgba(0,0,0,0))}
.hm-sk .nm{font-size:16px;font-weight:900;line-height:1.1}
.hm-sk .st{font-size:14px;font-weight:700;color:#6a5533;min-height:18px;line-height:1.15}
.hm-sk.eq .st{color:#8a5a06}
.hm-sk .hm-btn{min-height:44px;font-size:16px;padding:0 10px;width:100%;border-radius:12px}
.hm-sk.lock canvas{filter:brightness(.45) saturate(.5) contrast(.9)}
.hm-sk .lk{position:absolute;top:8px;right:10px;font-size:17px}
.hm-sk .hm-bar{width:100%}
.hm-wk{margin-top:10px;background:linear-gradient(180deg,rgba(0,0,0,.36),rgba(0,0,0,.2));border:1px solid var(--line);border-radius:14px;padding:10px;text-align:center;font-size:15px}
.hm-toast{position:fixed;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);z-index:70;background:linear-gradient(180deg,#2f5473,#17303f);border:2px solid var(--line);border-radius:14px;padding:8px 16px;font-family:'Nunito',system-ui,sans-serif;font-weight:900;font-size:16px;color:#fbf1d3;box-shadow:0 8px 24px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.2);pointer-events:none;animation:hmToast 2.6s ease-in-out forwards;max-width:92vw;text-align:center}
.hm-conf{position:fixed;z-index:80;width:9px;height:9px;pointer-events:none;border-radius:2px}
@keyframes hmFade{from{opacity:0}to{opacity:1}}
@keyframes hmPop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes hmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes hmToast{0%{transform:translate(-50%,-30px);opacity:0}10%,80%{transform:translate(-50%,0);opacity:1}100%{transform:translate(-50%,-20px);opacity:0}}
@media (prefers-reduced-motion:reduce){.hm-back,.hm-card,.hm-medal svg,.hm-new,.hm-m.fresh,.hm-toast{animation:none}.hm-bar i{transition:none}.hm-toast{opacity:1}}
@media (max-height:660px){.hm-score .n{font-size:50px}.hm-medal{min-height:48px}.hm-medal svg{width:48px;height:48px}.hm-btn.big{min-height:56px;font-size:22px}}
`;
  let cssDone = false;
  function css() { if (cssDone || !D) return; cssDone = true; const s = D.createElement('style'); s.id = 'hm-css'; s.textContent = CSS; D.head.appendChild(s); }

  // ---------- tiny helpers
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function el(tag, cls, html) { const e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function txt(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mondayOf(dateIso) { const t = parse(dateIso), dow = (t.getDay() + 6) % 7; return iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow)); }
  function weekStamps(days, today) {
    const t = parse(today), dow = (t.getDay() + 6) % 7, out = [];
    for (let i = 0; i < 7; i++) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow + i); out.push({ on: days.indexOf(iso(d)) >= 0, today: i === dow, ch: 'MTWTFSS'[i] }); }
    return out;
  }
  function todayIso() {
    try { const q = /[?&]hmday=(\d{4}-\d{2}-\d{2})/.exec(G.location.search); if (q) return q[1]; } catch (e) {}
    return iso(new Date());
  }
  function fmt(n) { n = Math.floor(n); return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n); }
  const sdk = () => G.ArcadeSDK || null;

  const MEDAL_COL = { Bronze: ['#f0b27a', '#b9692e', '#7a3f14'], Silver: ['#f4f6fa', '#b8c2d3', '#6b7690'], Gold: ['#fff1a8', '#f5b800', '#a86b00'], Platinum: ['#e6fbff', '#67e8f9', '#2563eb'] };
  function medalSVG(name) {
    const c = MEDAL_COL[name] || MEDAL_COL.Bronze, id = 'mg' + name;
    return `<svg viewBox="0 0 64 64" aria-label="${txt(name)} medal"><defs><radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></radialGradient></defs><path d="M18 2h11l4 20-9 3z" fill="#ef4444"/><path d="M46 2H35l-4 20 9 3z" fill="#3b82f6"/><circle cx="32" cy="40" r="20" fill="${c[2]}"/><circle cx="32" cy="39" r="18" fill="url(#${id})"/><circle cx="32" cy="39" r="12.5" fill="none" stroke="${c[2]}" stroke-opacity=".45" stroke-width="2"/><path d="M32 30l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="${c[0]}" stroke="${c[2]}" stroke-opacity=".5" stroke-width="1"/></svg>`;
  }

  function starSVG(on, i) {
    return '<svg viewBox="0 0 48 48" class="hm-star' + (on ? ' on' : '') + '" style="animation-delay:' + (0.25 + i * 0.18) + 's"><defs><linearGradient id="hs' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".55" stop-color="#f6bd2c"/><stop offset="1" stop-color="#b87208"/></linearGradient></defs><path d="M24 3l6.2 13.4 14.6 1.7-10.9 9.9 3 14.4L24 34.6 11.1 42.4l3-14.4L3.2 18.1l14.6-1.7z" fill="' + (on ? 'url(#hs' + i + ')' : 'rgba(0,0,0,.4)') + '" stroke="' + (on ? '#7a4a06' : 'rgba(255,255,255,.25)') + '" stroke-width="2" stroke-linejoin="round"/></svg>';
  }
  function create(cfg) {
    css();
    const KEY = 'hm-' + cfg.id;
    const coinIcon = (cfg.coin && cfg.coin.icon) || '⭐', coinName = (cfg.coin && cfg.coin.name) || 'Coins';
    const accent = cfg.accent || '#facc15';
    const skins = cfg.skins || [], byId = {}; skins.forEach(s => { byId[s.id] = s; });
    let mem = null;
    function blank() { return { v: 1, coins: 0, life: 0, owned: {}, skin: skins.length ? skins[0].id : '', runs: 0, best: 0, stats: {}, days: [], wk: '', day: null, medals: {}, top: [] }; }
    function load() {
      let o = null;
      try { o = JSON.parse(G.localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
      if (!o || typeof o !== 'object') o = mem || blank();
      const b = blank(); for (const k in b) if (o[k] == null) o[k] = b[k];
      if (skins.length) { o.owned[skins[0].id] = 1; if (!byId[o.skin] || !o.owned[o.skin]) o.skin = skins[0].id; }
      return o;
    }
    let S = load();
    function save() { mem = S; try { G.localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

    // ---------- the day: three missions and one star challenge, the same for everybody on a date
    function newDay(today) {
      const r = rng(hashStr(cfg.id + '|' + today)), pool = (cfg.missions || []).slice(), pick = [], used = {};
      // the very first day always opens with the easy mission, so the first reward lands inside a minute
      if (S.runs === 0) { const e = pool.filter(m => m.easy)[0]; if (e) { pick.push(e); used[e.stat] = 1; } }
      let guard = 0;
      while (pick.length < 3 && pool.length && guard++ < 60) {
        const m = pool[Math.floor(r() * pool.length)];
        if (pick.indexOf(m) >= 0) continue;
        if (used[m.stat] && guard < 40) continue;
        pick.push(m); used[m.stat] = 1;
      }
      const dp = cfg.daily && cfg.daily.length ? cfg.daily[Math.floor(r() * cfg.daily.length)] : null;
      const day = { d: today, m: pick.map(m => ({ id: m.id, p: 0, done: 0 })), star: dp ? { id: dp.id, p: 0, done: 0 } : null };
      return day;
    }
    function ensureDay() {
      const t = todayIso();
      if (!S.day || S.day.d !== t) { S.day = newDay(t); save(); }
      return S.day;
    }
    const defOf = (id, star) => ((star ? cfg.daily : cfg.missions) || []).filter(m => m.id === id)[0];
    function missionRows() {
      const day = ensureDay(), rows = [];
      day.m.forEach(x => { const d = defOf(x.id, false); if (d) rows.push({ def: d, st: x, star: false, reward: d.reward || 10 }); });
      if (day.star) { const d = defOf(day.star.id, true); if (d) rows.push({ def: d, st: day.star, star: true, reward: (d.reward || 20) * 2 }); }
      return rows;
    }

    // ---------- a run
    let run = { stats: {}, doneNow: [], gain: 0 }, cheatedRun = false;
    function isCheated() { const s = sdk(); return !!(s && s.cheated); }
    function begin() { ensureDay(); run = { stats: {}, doneNow: [], gain: 0 }; cheatedRun = isCheated(); }
    function bump(row, p) {
      if (row.st.done) return;
      row.st.p = Math.max(row.st.p, Math.min(row.def.target, p));
      if (row.st.p >= row.def.target) {
        row.st.done = 1; S.coins += row.reward; S.life += row.reward; run.gain += row.reward; run.doneNow.push({ text: row.def.text, reward: row.reward, star: row.star });
        toast((row.star ? '★ Daily done!  +' : 'Mission done!  +') + row.reward + ' ' + coinIcon); sound('win'); FXconf();
        const s = sdk(); try { if (s && s.profile && !s.cheated) { s.profile.award({ xp: row.star ? 10 : 5, reason: 'Mission: ' + row.def.text }); s.profile.quest('hm-' + cfg.id + '-' + row.def.id, 1, { title: row.def.text }); } } catch (e) {}
        save();
      }
    }
    function add(stat, n) {
      if (cheatedRun) return; n = n == null ? 1 : n; run.stats[stat] = (run.stats[stat] || 0) + n; S.stats[stat] = (S.stats[stat] || 0) + n;
      missionRows().forEach(r => { if (r.def.stat === stat && r.def.kind === 'sum') bump(r, r.st.p + n); else if (r.def.stat === stat && r.def.kind === 'max') bump(r, run.stats[stat]); });
    }
    function max(stat, v) {
      if (cheatedRun) return; if (v > (run.stats[stat] || 0)) run.stats[stat] = v;
      missionRows().forEach(r => { if (r.def.stat === stat && r.def.kind === 'max') bump(r, v); });
    }

    // ---------- skins
    function reqMet(s) {
      if (!s.req) return false; const r = s.req;
      const v = r.stat === 'best' ? S.best : r.stat === 'runs' ? S.runs : r.stat === 'medal' ? (S.medals[r.name] || 0) : (S.stats[r.stat] || 0);
      return v >= r.v;
    }
    function reqProgress(s) {
      const r = s.req, v = r.stat === 'best' ? S.best : r.stat === 'runs' ? S.runs : r.stat === 'medal' ? (S.medals[r.name] || 0) : (S.stats[r.stat] || 0);
      return clamp(v / r.v, 0, 1);
    }
    function nextGoal() {
      // the cheapest skin you can still buy with coins; when none are left, the milestone skin you are closest to
      let buyable = null, milestone = null;
      skins.forEach(s => {
        if (S.owned[s.id]) return;
        if (s.cost > 0) { if (!buyable || s.cost < buyable.cost) buyable = s; }
        else if (s.req) { if (!milestone || reqProgress(s) > reqProgress(milestone)) milestone = s; }
      });
      if (buyable) return { skin: buyable, kind: 'cost', p: clamp(S.coins / buyable.cost, 0, 1), have: S.coins, need: buyable.cost };
      if (milestone) return { skin: milestone, kind: 'req', p: reqProgress(milestone), text: milestone.req.text };
      return null;
    }
    function buy(id) {
      const s = byId[id]; if (!s || S.owned[id] || !(s.cost > 0) || S.coins < s.cost) return false;
      S.coins -= s.cost; S.owned[id] = 1; S.skin = id; save(); sound('unlock'); FXconf(); toast('Unlocked ' + s.name + '!');
      const p = sdk(); try { if (p && p.profile && !p.cheated) { p.profile.achievement('hm-' + cfg.id + '-skin', { title: cfg.title + ': first skin', desc: 'Buy a skin in ' + cfg.title, tier: 'bronze' }); if (skins.every(k => S.owned[k.id])) p.profile.achievement('hm-' + cfg.id + '-all', { title: cfg.title + ': collector', desc: 'Own every skin in ' + cfg.title, tier: 'gold' }); } } catch (e) {}
      if (cfg.onEquip) cfg.onEquip(s); return true;
    }
    function equip(id) { if (!S.owned[id] || !byId[id]) return; S.skin = id; save(); sound('tap'); if (cfg.onEquip) cfg.onEquip(byId[id]); }

    // ---------- end of a run
    function medalFor(score) { let m = null; (cfg.medals || []).forEach(x => { if (score >= x.at) m = x; }); return m; }
    function nextMedal(score) { const l = cfg.medals || []; for (let i = 0; i < l.length; i++) if (score < l[i].at) return l[i]; return null; }
    function checkUnlocks() {
      const out = []; skins.forEach(s => { if (!S.owned[s.id] && s.req && reqMet(s)) { S.owned[s.id] = 1; out.push(s); } });
      if (out.length) { save(); out.forEach(s => toast('New skin: ' + s.name + '!')); sound('unlock'); FXconf(); }
      return out;
    }
    function finish(o) {
      o = o || {}; const today = ensureDay().d, score = o.score || 0, before = S.best;
      const res = { score, mode: o.mode || '', coins: 0, total: S.coins, isBest: false, best: S.best, medal: null, missions: [], unlocked: [], next: null, cheated: cheatedRun || isCheated(), week: null, prevBest: before };
      if (res.cheated) { res.next = nextGoal(); res.week = weekStamps(S.days, today); return res; }
      const track = o.trackBest !== false;
      S.runs++; if (track && score > S.best) { S.best = score; res.isBest = before > 0 || score > 0; }
      res.best = S.best;
      if (track && score > 0) { const e = { s: score, m: o.mode || '', d: today }; S.top.push(e); S.top.sort((a, b) => b.s - a.s); S.top = S.top.slice(0, 5); res.topAt = S.top.indexOf(e); }
      res.top = S.top.slice();
      const firstToday = S.days.indexOf(today) < 0, gift = firstToday ? (cfg.dailyGift == null ? 5 : cfg.dailyGift) : 0, part = cfg.participation == null ? 1 : cfg.participation;
      res.gift = gift;
      const gain = Math.max(0, Math.floor(o.coins || 0)) + gift + part;
      S.coins += gain; S.life += gain; run.gain += gain; res.coins = run.gain; res.total = S.coins;
      res.medal = medalFor(score); if (res.medal) S.medals[res.medal.name] = (S.medals[res.medal.name] || 0) + 1;
      if (S.days.indexOf(today) < 0) { S.days.push(today); if (S.days.length > 90) S.days = S.days.slice(-90); }
      res.unlocked = checkUnlocks();
      res.missions = missionRows().map(r => ({ text: r.def.text, p: r.st.p, target: r.def.target, done: !!r.st.done, fresh: run.doneNow.some(d => d.text === r.def.text), reward: r.reward, star: r.star }));
      res.next = nextGoal(); res.week = weekStamps(S.days, today);
      res.toBeat = track && !res.isBest && S.best > 0 ? S.best - score + 1 : 0;
      save();
      const p = sdk(); try { if (p && p.profile && res.week && res.week.filter(x => x.on).length >= 5) p.profile.achievement('hm-' + cfg.id + '-week', { title: cfg.title + ': 5 days this week', desc: 'Play on 5 days in one week', tier: 'silver' }); } catch (e) {}
      run = { stats: {}, doneNow: [], gain: 0 };
      return res;
    }

    // ---------- weekly bonus (5 stamps in a Monday-first week; a fixed gift, claimed once)
    function weeklyReady() { const t = ensureDay().d, st = weekStamps(S.days, t); return st.filter(x => x.on).length >= 5 && S.wk !== mondayOf(t); }
    function claimWeekly() { if (!weeklyReady()) return 0; const n = cfg.weeklyBonus || 60; S.wk = mondayOf(ensureDay().d); S.coins += n; S.life += n; save(); toast('Weekly bonus  +' + n + ' ' + coinIcon); sound('win'); FXconf(); return n; }

    // ---------- feedback
    function sound(n) { try { if (cfg.sfx) cfg.sfx(n); else { const s = sdk(); if (s && s.sfx) s.sfx(n === 'unlock' ? 'levelup' : n === 'win' ? 'win' : 'tap'); } } catch (e) {} }
    function toast(msg) { if (!D.body) return; const old = D.querySelector('.hm-toast'); if (old) old.remove(); const t = el('div', 'hm hm-toast'); t.textContent = msg; t.setAttribute('role', 'status'); D.body.appendChild(t); setTimeout(() => t.remove(), 2700); }
    function FXconf() {
      if (!D.body || (G.FX && G.FX.rm())) return;
      const cols = ['#facc15', '#f472b6', '#38bdf8', '#4ade80', '#fb923c', '#a78bfa'], w = G.innerWidth, n = 22;
      for (let i = 0; i < n; i++) {
        const c = el('div', 'hm-conf'); c.style.left = (w / 2 + (Math.random() - 0.5) * 60) + 'px'; c.style.top = (G.innerHeight * 0.35) + 'px'; c.style.background = cols[i % cols.length];
        D.body.appendChild(c);
        const dx = (Math.random() - 0.5) * w * 0.9, dy = 120 + Math.random() * 260;
        const a = c.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + dx * 0.6 + 'px,-' + (60 + Math.random() * 80) + 'px) rotate(200deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(560deg)', opacity: 0 }], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.4,1)' });
        a.onfinish = () => c.remove();
      }
    }

    // ---------- UI: layers
    let layer = null, raf = 0, prevFocus = null;
    function closeLayer() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (layer) { layer.remove(); layer = null; }
      if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} } prevFocus = null;
    }
    function openLayer(cardCls) {
      closeLayer(); prevFocus = D.activeElement;
      const back = el('div', 'hm hm-back'); back.style.setProperty('--hm', accent); back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true');
      const card = el('div', 'hm-card ' + (cardCls || '')); back.appendChild(card);
      back.addEventListener('pointerdown', e => e.stopPropagation()); back.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      back.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeLayer(); if (layerClose) layerClose(); } });
      D.body.appendChild(back); layer = back; return card;
    }
    let layerClose = null;
    function press(node, fn) { node.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return node; }

    function skinCanvas(skin, size) {
      const c = D.createElement('canvas'), d = Math.min(G.devicePixelRatio || 1, 2); c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + 'px'; c.dataset.skin = skin.id;
      c._draw = t => { const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, size, size); if (cfg.drawSkin) cfg.drawSkin(x, skin, size / 2, size / 2, size * 0.72, t); };
      c._draw(0); return c;
    }
    function animateCanvases(root) {
      const list = [].slice.call(root.querySelectorAll('canvas[data-skin]')); if (!list.length) return;
      let last = 0; const rm = G.FX && G.FX.rm();
      (function f(now) {
        raf = requestAnimationFrame(f); if (rm || now - last < 66) return; last = now;
        for (let i = 0; i < list.length; i++) list[i]._draw(now / 1000);
      })(0);
    }

    // ---------- UI: the result card ("one more try")
    function showResult(o) {
      o = o || {}; const res = o.res || {}, card = openLayer('hm-result');
      layerClose = null;
      const title = o.title || 'Game over';
      card.innerHTML = '';
      const h = el('div', 'hm-h', '<h2>' + txt(title) + '</h2>'); card.appendChild(h);
      if (o.subtitle) h.querySelector('h2').insertAdjacentHTML('afterend', '<span style="font-size:15px;opacity:.85;font-weight:500">' + txt(o.subtitle) + '</span>');
      const sc = el('div', 'hm-score'); sc.innerHTML = '<span class="n">0</span><div class="l">' + txt(o.scoreLabel || 'SCORE') + '</div>'; card.appendChild(sc);
      if (o.stars != null) { const st = el('div', 'hm-stars'); for (let i = 0; i < 3; i++) st.innerHTML += starSVG(i < o.stars, i); card.appendChild(st); }
      const medal = el('div', 'hm-medal' + (res.medal && o.stars == null ? ' has' : '')); if (res.medal && o.stars == null) medal.innerHTML = medalSVG(res.medal.name); card.appendChild(medal);
      const best = el('div', 'hm-best');
      if (res.cheated) best.innerHTML = '<span style="opacity:.85">Codes on: this run does not count</span>';
      else if (res.isBest) best.innerHTML = '<span class="hm-new">NEW BEST!</span>';
      else if (res.toBeat > 0 && res.toBeat <= Math.max(6, res.best * 0.35)) best.innerHTML = '<b>' + res.toBeat + '</b> more to beat your best of ' + res.best;
      else best.innerHTML = 'Best <b>' + res.best + '</b>';
      card.appendChild(best);
      if (res.top && res.top.length > 1) { const tp = el('div', 'hm-top'); tp.innerHTML = '🏆 ' + res.top.map((e, i) => '<span' + (i === res.topAt ? ' class="me"' : '') + '>' + e.s + '</span>').join(''); card.appendChild(tp); }
      if (!res.cheated) {
        const nm = res.medal ? null : nextMedal(res.score);
        if (nm && res.score > 0) best.insertAdjacentHTML('beforeend', '<div style="font-size:14px;opacity:.8;margin-top:2px">' + (nm.at - res.score) + ' to the ' + txt(nm.name) + ' medal</div>');
        const earn = el('div', 'hm-earn'); earn.innerHTML = '<span class="hm-coin">' + coinIcon + '</span><span class="plus">+<span class="ec">0</span></span><small>' + txt(coinName) + '  ·  ' + fmt(res.total) + ' in total' + (res.gift ? '<br>includes +' + res.gift + ' first-game-of-the-day gift' : '') + '</small>'; card.appendChild(earn);
        if (res.missions && res.missions.length) {
          const list = el('div', 'hm-list');
          res.missions.forEach(m => {
            const row = el('div', 'hm-m' + (m.done ? ' done' : '') + (m.star ? ' star' : '') + (m.fresh ? ' fresh' : ''));
            row.innerHTML = '<span class="t">' + (m.star ? '★ ' : '') + txt(m.text) + '</span><span class="r">' + (m.done ? '+' + m.reward + ' ' + coinIcon : m.p + '/' + m.target) + '</span><div class="hm-bar"><i style="width:0" data-w="' + Math.round(100 * m.p / m.target) + '"></i></div>';
            list.appendChild(row);
          });
          card.appendChild(list);
        }
        if (res.next) {
          const n = res.next, box = el('div', 'hm-next'), cv = skinCanvas(n.skin, 52); box.appendChild(cv);
          const tx = el('div', 'tx');
          tx.innerHTML = '<b>Next: ' + txt(n.skin.name) + '</b>' + (n.kind === 'cost' ? (n.have >= n.need ? 'Ready! Open Skins to get it' : (n.need - n.have) + ' ' + coinIcon + ' to go') : txt(n.text)) + '<div class="hm-bar"><i style="width:0" data-w="' + Math.round(100 * n.p) + '"></i></div>';
          box.appendChild(tx); card.appendChild(box);
        }
        if (res.unlocked && res.unlocked.length) { FXconf(); }
      }
      const cta = el('div', 'hm-cta'); card.appendChild(cta);
      const again = el('button', 'hm-btn big', txt(o.againLabel || 'PLAY AGAIN')); again.type = 'button'; press(again, () => { closeLayer(); if (o.onAgain) o.onAgain(); }); cta.appendChild(again);
      const row = el('div', 'hm-row'); row.style.marginTop = '10px';
      const wkBtn = weeklyReady() ? '<span class="dot">!</span>' : '';
      const b1 = el('button', 'hm-btn sec', '🎨 Skins'); b1.type = 'button'; press(b1, () => openShop(() => showResult(o)));
      const b2 = el('button', 'hm-btn sec', '📋 Goals' + wkBtn); b2.type = 'button'; b2.style.position = 'relative'; press(b2, () => openMissions(() => showResult(o)));
      row.appendChild(b1); row.appendChild(b2);
      (o.extra || []).forEach(x => { const bx = el('button', 'hm-btn sec', txt(x.label)); bx.type = 'button'; press(bx, () => { closeLayer(); x.fn(); }); row.appendChild(bx); });
      if (o.onMenu) { const b3 = el('button', 'hm-btn sec', o.menuLabel || 'Menu'); b3.type = 'button'; press(b3, () => { closeLayer(); o.onMenu(); }); row.appendChild(b3); }
      cta.appendChild(row);
      // count-ups and bar fills, then focus the big button so Enter / Space runs it again
      const rm = G.FX && G.FX.rm(), nEl = sc.querySelector('.n'), eEl = card.querySelector('.ec');
      const tgtS = o.big != null ? o.big : (res.score || 0), tgtC = res.coins || 0;
      if (rm) { nEl.textContent = tgtS; if (eEl) eEl.textContent = tgtC; card.querySelectorAll('.hm-bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }); }
      else {
        const t0 = performance.now();
        (function f(now) {
          const k = clamp((now - t0) / 700, 0, 1), e = 1 - Math.pow(1 - k, 3);
          nEl.textContent = Math.round(tgtS * e); if (eEl) eEl.textContent = Math.round(tgtC * e);
          if (k < 1 && layer) requestAnimationFrame(f);
        })(t0);
        setTimeout(() => { card.querySelectorAll('.hm-bar i').forEach(i => { i.style.width = i.dataset.w + '%'; }); }, 60);
      }
      setTimeout(() => { try { again.focus({ preventScroll: true }); } catch (e) {} }, 30);
      if (res.medal) sound('win');
      return card;
    }

    // ---------- UI: shop
    function openShop(back) {
      const card = openLayer('hm-shopcard'); layerClose = back || null;
      card.innerHTML = '<div class="hm-h"><h2>Skins</h2><button class="hm-x" type="button" aria-label="Close">✕</button></div><div class="hm-earn" style="margin-bottom:10px"><span class="hm-coin">' + coinIcon + '</span><span class="plus"><span class="tc">' + fmt(S.coins) + '</span></span><small>' + txt(coinName) + '</small></div><div class="hm-grid"></div>';
      press(card.querySelector('.hm-x'), () => { closeLayer(); if (back) back(); });
      const grid = card.querySelector('.hm-grid');
      function render() {
        grid.innerHTML = ''; card.querySelector('.tc').textContent = fmt(S.coins);
        skins.forEach(s => {
          const owned = !!S.owned[s.id], eq = S.skin === s.id;
          const c = el('div', 'hm-sk' + (eq ? ' eq' : '') + (!owned ? ' lock' : '')); c.setAttribute('role', 'group'); c.setAttribute('aria-label', s.name);
          c.appendChild(skinCanvas(s, 84)); c.appendChild(el('div', 'nm', txt(s.name)));
          const st = el('div', 'st'); c.appendChild(st);
          if (!owned) c.appendChild(el('span', 'lk', '🔒'));
          if (eq) { st.textContent = 'In use'; st.style.color = accent; st.style.fontWeight = '600'; }
          else if (owned) { const b = el('button', 'hm-btn sec', 'Use'); b.type = 'button'; press(b, () => { equip(s.id); render(); }); c.appendChild(b); }
          else if (s.cost > 0) {
            const can = S.coins >= s.cost; const b = el('button', 'hm-btn', can ? 'Get ' + s.cost + ' ' + coinIcon : s.cost + ' ' + coinIcon); b.type = 'button';
            if (!can) { b.classList.add('ghost'); b.disabled = false; b.setAttribute('aria-disabled', 'true'); st.textContent = (s.cost - S.coins) + ' more to go'; }
            press(b, () => { if (can) { buy(s.id); render(); } else { sound('tap'); toast('Need ' + (s.cost - S.coins) + ' more ' + coinName.toLowerCase()); } }); c.appendChild(b);
          } else if (s.req) { st.textContent = s.req.text; const bar = el('div', 'hm-bar'); bar.style.width = '100%'; bar.innerHTML = '<i style="width:' + Math.round(100 * reqProgress(s)) + '%"></i>'; c.appendChild(bar); }
          grid.appendChild(c);
        });
        if (raf) { cancelAnimationFrame(raf); raf = 0; } animateCanvases(grid);
      }
      render(); setTimeout(() => { try { card.querySelector('.hm-x').focus({ preventScroll: true }); } catch (e) {} }, 30);
    }

    // ---------- UI: goals (missions + week)
    function openMissions(back) {
      const card = openLayer('hm-goals'); layerClose = back || null; const day = ensureDay();
      card.innerHTML = '<div class="hm-h"><h2>Today\'s goals</h2><button class="hm-x" type="button" aria-label="Close">✕</button></div>';
      press(card.querySelector('.hm-x'), () => { closeLayer(); if (back) back(); });
      const list = el('div', 'hm-list');
      missionRows().forEach(r => {
        const row = el('div', 'hm-m' + (r.st.done ? ' done' : '') + (r.star ? ' star' : ''));
        row.innerHTML = '<span class="t">' + (r.star ? '★ Daily: ' : '') + txt(r.def.text) + '</span><span class="r">' + (r.st.done ? 'Done' : '+' + r.reward + ' ' + coinIcon) + '</span><div class="hm-bar"><i style="width:' + Math.round(100 * r.st.p / r.def.target) + '%"></i></div>';
        list.appendChild(row);
      });
      card.appendChild(list);
      const wk = el('div', 'hm-wk'), st = weekStamps(S.days, day.d), n = st.filter(x => x.on).length;
      wk.innerHTML = '<div style="font-weight:600;margin-bottom:6px">This week: ' + n + ' of 5 days</div><div class="hm-week">' + st.map(x => '<span class="' + (x.on ? 'on ' : '') + (x.today ? 'today' : '') + '">' + x.ch + '</span>').join('') + '</div><div style="opacity:.8;margin-top:6px;font-size:14px">' + (weeklyReady() ? 'Your weekly gift is ready!' : n >= 5 ? 'Weekly gift collected. See you Monday!' : 'Play on 5 days for a gift. A missed day never costs you anything.') + '</div>';
      if (weeklyReady()) { const b = el('button', 'hm-btn', 'Collect +' + (cfg.weeklyBonus || 60) + ' ' + coinIcon); b.type = 'button'; b.style.marginTop = '8px'; b.style.width = '100%'; press(b, () => { claimWeekly(); openMissions(back); }); wk.appendChild(b); }
      card.appendChild(wk);
      const foot = el('div', null, '<div style="text-align:center;opacity:.75;font-size:14px;margin-top:10px">' + S.days.length + ' days played so far</div>'); card.appendChild(foot);
      setTimeout(() => { try { card.querySelector('.hm-x').focus({ preventScroll: true }); } catch (e) {} }, 30);
    }

    // ---------- UI: the strip on the title screen
    function mountBar(host) {
      const bar = el('div', 'hm hm-bar-row'); bar.style.setProperty('--hm', accent); bar.style.pointerEvents = 'auto';
      function paint() {
        const rows = missionRows(), open = rows.filter(r => !r.st.done).length, wkN = weekStamps(S.days, ensureDay().d).filter(x => x.on).length;
        bar.innerHTML = '';
        const coin = el('div', 'hm-chip', '<span class="hm-coin">' + coinIcon + '</span>' + fmt(S.coins)); coin.setAttribute('aria-label', S.coins + ' ' + coinName); bar.appendChild(coin);
        const sk = el('button', 'hm-chip', '🎨 Skins'); sk.type = 'button'; press(sk, () => openShop(paint)); bar.appendChild(sk);
        const gl = el('button', 'hm-chip', '📋 Goals' + (open ? '<span class="dot">' + open + '</span>' : (weeklyReady() ? '<span class="dot">!</span>' : ''))); gl.type = 'button'; press(gl, () => openMissions(paint)); bar.appendChild(gl);
        const wk = el('div', 'hm-chip', '🔥 ' + wkN + '/5'); wk.setAttribute('aria-label', wkN + ' of 5 days this week'); bar.appendChild(wk);
      }
      paint(); host.appendChild(bar); bar.refresh = paint; return bar;
    }

    const api = {
      cfg, get state() { return S; }, get coins() { return S.coins; }, get skin() { return byId[S.skin] || skins[0]; }, get skinId() { return S.skin; },
      begin, add, max, finish, checkUnlocks, showResult, closeLayer, openShop, openMissions, mountBar, toast, medalFor, nextMedal, nextGoal, buy, equip, weeklyReady, claimWeekly,
      missionRows, ensureDay, medalSVG, skinCanvas, weekStamps: () => weekStamps(S.days, ensureDay().d), reset() { S = blank(); if (skins.length) S.owned[skins[0].id] = 1; save(); },
      grant(n) { S.coins += n; save(); },
    };
    (G.HubMeta.instances = G.HubMeta.instances || {})[cfg.id] = api;
    return api;
  }

  G.HubMeta = G.HubMeta || {};
  G.HubMeta.create = create; G.HubMeta.medalSVG = medalSVG; G.HubMeta.starSVG = starSVG; G.HubMeta.util = { weekStamps, mondayOf, hashStr, rng, iso, parse, fmt };
})(window);
