'use strict';
const fs = require('fs');
const C = require('./lc-chess.js');
const ROOT = 'C:/Users/caleb/AppData/Local/arcade-hub';
const html = fs.readFileSync(ROOT + '/_loop/research/lc-chess-corrected.html', 'utf8');
const lines = html.split(/\r?\n/);
function grab(name) { const re = new RegExp('^const ' + name + ' = (.*);\\s*$'); for (const l of lines) { const m = l.match(re); if (m) return JSON.parse(m[1]); } return null; }
const ACADEMY = grab('ACADEMY'), PUZZLES = grab('PUZZLES'), TRAPS = grab('TRAPS');
function pairs(moves) {
  let st = C.parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); const out = [];
  for (const tok of String(moves).split(/\s+/).filter(Boolean)) {
    const t = tok.replace(/[!?]+$/, ''); let m = null;
    if (/^[a-h][1-8][a-h][1-8]/.test(t)) { const f = C.nameSq(t.slice(0,2)), to = C.nameSq(t.slice(2)); m = C.allLegal(st, st.turn).find(x => x.from === f && x.to === to); }
    else { const p = C.parseSAN(st, t); m = (p && !p.ambiguous) ? p : null; }
    if (!m) { out.push(null); break; }
    out.push([m.from, m.to]); st = C.doMove(st, m);
  }
  return out;
}
const P = { acadTraps: ACADEMY.traps.map(t => ({ name: t.name, pairs: pairs(t.moves) })), puzzles: [] };
PUZZLES.forEach((p, i) => {
  const st = C.parseFEN(p.fen);
  P.puzzles.push({ i, board: st.board, turn: st.turn, ep: st.ep, cr: st.castling, legal: C.allLegal(st, st.turn).length, fen: p.fen, hint: p.hint || '' });
});
fs.writeFileSync(__dirname + '/../shots/lcpayload3.json', JSON.stringify(P));
const probe = `(function () {
  var P = __P__; var R = { stage: 'start' };
  function pub() { window.__PROBE_PARTIAL = JSON.stringify(R); if (R.stage === 'done' || R.stage === 'exception') window.__PROBE = JSON.stringify(R); }
  function loadFrame(cb) { var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:99999'; f.src = '/_loop/research/lc-chess-corrected.html'; f.onload = function () { setTimeout(function () { cb(f); }, 700); }; document.body.appendChild(f); }
  function sqOf(s) { return (8 - parseInt(s[1], 10)) * 8 + (s.charCodeAt(0) - 97); }
  function tap(w, sq) {
    var doc = w.document, cv = doc.querySelector('canvas'), rect = cv.getBoundingClientRect(), api = w.ChessMods.api, p = api.sqXY(sq), k = rect.width / cv.width;
    var x = rect.left + p.x * k, y = rect.top + p.y * k, el = doc.elementFromPoint(x, y) || cv;
    var o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
    try { el.dispatchEvent(new w.PointerEvent('pointerdown', o)); } catch (e) {}
    try { el.dispatchEvent(new w.PointerEvent('pointerup', o)); } catch (e) {}
    try { var tt = new w.Touch({ identifier: 1, target: el, clientX: x, clientY: y }); el.dispatchEvent(new w.TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [tt], changedTouches: [tt] })); } catch (e) { R.touchFail = String(e); }
  }
  loadFrame(function (f) {
    var w = f.contentWindow;
    try {
      w.ChessMods.api.setBot(false);
      R.trapCheck = w.__trapCheck();
      var bad = R.trapCheck.filter(function (t) { return t.bad || t.played !== t.total; });
      R.trapRegression = { total: R.trapCheck.length, failing: bad.length, names: bad.map(function (t) { return t.name + '@' + t.bad; }) };
      R.acadTraps = [];
      for (var i = 0; i < P.acadTraps.length; i++) {
        var e = P.acadTraps[i], fail = -1;
        w.resetGame(); w.ChessMods.api.setBot(false);
        for (var j = 0; j < e.pairs.length; j++) { if (!e.pairs[j] || !w.ChessMods.api.playMove(e.pairs[j][0], e.pairs[j][1])) { fail = j; break; } }
        R.acadTraps.push({ name: e.name, plies: e.pairs.filter(Boolean).length, failedAt: fail, over: w.ChessMods.api.isOver(), result: w.eval('game.result') });
      }
      R.stage = 'traps'; pub();
      R.puzzlesMismatch = [];
      for (var k = 0; k < P.puzzles.length; k++) {
        var pz = P.puzzles[k];
        w.loadPuzzle(k);
        var b = Array.prototype.slice.call(w.ChessMods.api.board);
        var st = JSON.parse(w.eval('JSON.stringify({turn:game.turn,ep:game.epTarget,cr:game.castlingRights})'));
        var lg = w.getAllLegalMoves(b, st.turn, st.ep, st.cr);
        if (JSON.stringify(b) !== JSON.stringify(pz.board) || st.turn !== pz.turn || lg.length !== pz.legal) R.puzzlesMismatch.push({ i: k, boardSame: JSON.stringify(b) === JSON.stringify(pz.board), turn: st.turn, pageLegal: lg.length, nodeLegal: pz.legal });
      }
      w.loadPuzzle(8);
      R.p8fen = w.eval('PUZZLES[8].fen'); R.p8hint = w.document.getElementById('tip').textContent;
      var mates = 0;
      var b8 = Array.prototype.slice.call(w.ChessMods.api.board);
      var stt = JSON.parse(w.eval('JSON.stringify({turn:game.turn,ep:game.epTarget,cr:game.castlingRights})'));
      var lg8 = w.getAllLegalMoves(b8, stt.turn, stt.ep, stt.cr);
      for (var q = 0; q < lg8.length; q++) { var rs = w.makeMove(b8, lg8[q], { castlingRights: stt.cr }); var rp = w.getAllLegalMoves(rs.board, 1 - stt.turn, rs.ep, rs.castling); if (rp.length === 0 && w.isInCheck(rs.board, 1 - stt.turn)) mates++; }
      R.p8mates = mates;
      tap(w, sqOf('g1')); tap(w, sqOf('g7'));
      R.p8 = { tip: w.document.getElementById('tip').textContent, over: w.ChessMods.api.isOver(), result: w.eval('game.result') };
      w.loadPuzzle(1);
      R.p1hint = w.document.getElementById('tip').textContent;
      R.stage = 'done'; pub();
    } catch (e) { R.error = String(e && e.stack || e); R.stage = 'exception'; pub(); }
  });
})();
`;
fs.writeFileSync(__dirname + '/../shots/lcprobe3.js', probe.replace('__P__', JSON.stringify(P)));
fs.writeFileSync(__dirname + '/../shots/lcprobe3.html', ['<!DOCTYPE html>','<html><head><meta charset="utf-8"><title>lc corrected-copy probe</title></head>','<body style="margin:0;background:#111"><script src="lcprobe3.js"></script></body></html>',''].join(String.fromCharCode(10)));
console.log('wrote lcprobe3 (acadTraps=' + P.acadTraps.length + ', puzzles=' + P.puzzles.length + ')');
