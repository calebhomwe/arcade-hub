// livecase.js — run one in-page suite case against the DEPLOYED Pages build (?case=id)
(function () {
  var id = (location.search.match(/case=([a-z0-9]+)/) || [])[1] || 'all';
  function out(o) { window.__PROBE = JSON.stringify(o);
    var el = document.createElement('pre'); el.id = 'R'; document.body.appendChild(el);
    el.textContent = 'PROBERESULT ' + window.__PROBE + ' ENDRESULT'; }
  fetch('https://calebhomwe.github.io/arcade-hub/games/chess.html?cb=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0';
      f.src = url;
      f.onload = function () {
        setTimeout(function () {
          try {
            var w = f.contentWindow;
            var r = w.__chessTest ? w.__chessTest(id) : { error: 'no __chessTest in deployed build' };
            out({ deployed: true, bytes: html.length, result: r });
          } catch (e) { out({ error: e.message }); }
        }, 900);
      };
      document.body.appendChild(f);
    })
    .catch(function (e) { out({ error: 'fetch ' + e.message }); });
})();
