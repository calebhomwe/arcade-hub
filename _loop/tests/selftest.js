// selftest.js — runs window.__chessTest(case) inside the real page and reports
(function () {
  var caseId = (location.search.match(/case=([a-z0-9]+)/) || [])[1] || 'all';
  function out(obj) {
    var el = document.createElement('pre'); el.id = 'R';
    el.textContent = 'PROBERESULT ' + JSON.stringify(obj) + ' ENDRESULT';
    document.body.appendChild(el);
  }
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0';
  f.src = '/games/chess.html?selftest=' + Math.random();
  f.onload = function () {
    setTimeout(function () {
      try {
        var w = f.contentWindow;
        if (!w.__chessTest) { out({ error: 'no __chessTest' }); return; }
        var t0 = Date.now();
        var res = w.__chessTest(caseId);
        res.ms = Date.now() - t0;
        out(res);
      } catch (e) { out({ error: e.message, stack: (e.stack || '').split('\n').slice(0, 3).join(' | ') }); }
    }, 600);
  };
  document.body.appendChild(f);
})();
