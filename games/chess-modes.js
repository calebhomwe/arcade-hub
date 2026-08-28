(function () {
  'use strict';
  if (!window.ChessMods) return;
  const api = ChessMods.api;
  const wrap = document.getElementById('gameWrap');
  const resetBtn = document.getElementById('btnReset');
  if (!wrap || !resetBtn) return;
  const NEON = ['#0ff', '#f0f', '#ff0', '#0f0', '#f60'];
  let on = false;
  try { on = localStorage.getItem('cmd-party') === '1'; } catch (e) {}
  const st = document.createElement('style');
  st.textContent = '.cmd-party #board{animation:cmdHue 6s linear infinite;}@keyframes cmdHue{0%{filter:hue-rotate(0)}25%{filter:hue-rotate(30deg)}50%{filter:hue-rotate(0)}75%{filter:hue-rotate(-30deg)}100%{filter:hue-rotate(0)}}.cmd-party{animation:cmdGlow 1.2s ease-in-out infinite;}@keyframes cmdGlow{0%,100%{box-shadow:0 0 18px 2px rgba(255,0,255,.45)}50%{box-shadow:0 0 26px 6px rgba(0,255,255,.5)}}.cmd-disco{position:absolute;pointer-events:none;z-index:31;transform:translate(-50%,-50%);animation:cmdSpin 1s linear forwards;}@keyframes cmdSpin{0%{transform:translate(-50%,-50%) rotate(0) scale(0);opacity:0}25%{transform:translate(-50%,-50%) rotate(180deg) scale(1.2);opacity:1}100%{transform:translate(-50%,-50%) rotate(720deg) scale(.4);opacity:0}}.cmd-led{width:6px;height:6px;border-radius:50%;background:#333;display:inline-block;margin-left:2px;vertical-align:middle;}.cmd-led.on{background:#0f0;box-shadow:0 0 8px #0f0;animation:cmdGlow 1s infinite;}';
  document.head.appendChild(st);
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.title = 'Toggle Party Mode';
  btn.innerHTML = '🪩<span class="btn-label">Party</span><span class="cmd-led"></span>';
  resetBtn.insertAdjacentElement('afterend', btn);
  const led = btn.querySelector('.cmd-led');
  function apply() {
    wrap.classList.toggle('cmd-party', on);
    led.classList.toggle('on', on);
    try { localStorage.setItem('cmd-party', on ? '1' : '0'); } catch (e) {}
  }
  btn.addEventListener('click', () => { on = !on; apply(); });
  apply();
  ChessMods.on('move', function (m) {
    try {
      if (!on || api.juice === 0) return;
      const xy = api.sqXY(m.to);
      api.particles(xy.x, xy.y, 6, NEON[Math.floor(Math.random() * NEON.length)]);
      if (m.captured) {
        const d = document.createElement('div');
        d.className = 'cmd-disco';
        d.textContent = '🪩';
        d.style.left = xy.x + 'px';
        d.style.top = xy.y + 'px';
        d.style.fontSize = (api.sqSize * 0.5) + 'px';
        d.addEventListener('animationend', () => d.remove());
        wrap.appendChild(d);
      }
    } catch (e) { console.warn('[chess-modes]', e); }
  });
})();
