// livesuite.js — run the FULL in-page suite against the deployed Pages build
(function () {
  var log = [];
  function out(status) { window.__PROBE = JSON.stringify({ status: status, log: log });
    var el = document.createElement('pre'); el.id = 'R'; document.body.appendChild(el);
    el.textContent = 'PROBERESULT ' + window.__PROBE + ' ENDRESULT'; }
  var LIVE = 'https://calebhomwe.github.io/arcade-hub/games/chess.html';
  var CASES = ['kingrook','kingside','queenside','rooktap','blackcastle','refuse','puzzle8','traps','acad','keyboard','perft'];
  fetch(LIVE + '?cb=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (html) {
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    var i = 0;
    function next() {
      if (i >= CASES.length) { out('DONE'); return; }
      var id = CASES[i++];
      var f = document.createElement('iframe');
      f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0';
      f.src = url;
      f.onload = function () {
        setTimeout(function () {
          try {
            var w = f.contentWindow;
            var r = w.__chessTest ? w.__chessTest(id) : null;
            if (!r) log.push(id + ': MISSING');
            else log.push(id + ': ' + r.pass + 'P/' + r.fail + 'F' + (r.fail ? ' :: ' + JSON.stringify(r.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.name + ' | ' + c.detail; })) : ''));
          } catch (e) { log.push(id + ': THROW ' + e.message); }
          f.remove();
          setTimeout(next, 100);
        }, 800);
      };
      document.body.appendChild(f);
    }
    next();
  }).catch(function (e) { log.push('fetch ' + e.message); out('FAIL'); });
})();
