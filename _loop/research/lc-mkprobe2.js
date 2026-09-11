'use strict';
const fs = require('fs');
const C = require('./lc-chess.js');
const D = require('./lc-data.json');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function pairs(moves) {
  let st = C.parseFEN(START); const out = [];
  for (const tok of String(moves).split(/\s+/).filter(Boolean)) {
    const t = tok.replace(/[!?]+$/, '');
    let m = null;
    if (/^[a-h][1-8][a-h][1-8]/.test(t)) { const f = C.nameSq(t.slice(0,2)), to = C.nameSq(t.slice(2)); m = C.allLegal(st, st.turn).find(x => x.from === f && x.to === to); }
    else { const p = C.parseSAN(st, t); m = (p && !p.ambiguous) ? p : null; }
    if (!m) { out.push(null); break; }
    out.push([m.from, m.to]); st = C.doMove(st, m);
  }
  return out;
}
const fixed = {
  'Fried Liver Setup': 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5 g5f7 e8f7 d1f3 f7e6 b1c3',
  "Noah's Ark Trap": 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6 d2d4 b7b5 a4b3 c6d4 f3d4 e5d4 d1d4 c7c5 d4d5 c8e6 d5c6 e6d7 c6d5 c5c4',
  'Kostic Trap': 'e2e4 e7e5 g1f3 b8c6 f1c4 c6d4 f3e5 d8g5 e5f7 g5g2 h1f1 g2e4 c4e2 d4f3',
  'Siberian Trap': 'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3 b8c6 g1f3 e7e6 f1c4 d8c7 e1g1 g8f6 d1e2 f6g4 h2h3 c6d4',
  'Englund Gambit Trap': 'd2d4 e7e5 d4e5 b8c6 g1f3 d8e7 c1f4 e7b4 f4d2 b4b2 d2c3 f8b4 d1d2 b4c3 d2c3 b2c1'
};
const P = { fixedTraps: {} };
for (const k of Object.keys(fixed)) P.fixedTraps[k] = pairs(fixed[k]);
P.correctedFen = '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1';
fs.writeFileSync(__dirname + '/../shots/lcpayload2.json', JSON.stringify(P));

const probe = `// lcprobe2.js (generated) - real-browser checks for the proposed learning-content fixes
(function () {
  var P = __P__;
  var R = { stage: 'start' };
  function pub() { window.__PROBE_PARTIAL = JSON.stringify(R); if (R.stage === 'done' || R.stage === 'exception') window.__PROBE = JSON.stringify(R); }
  function loadFrame(cb) { var f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:99999'; f.src = '/games/chess.html'; f.onload = function () { setTimeout(function () { cb(f); }, 700); }; document.body.appendChild(f); }
  function tap(w, sq) {
    var doc = w.document, cv = doc.querySelector('canvas'), rect = cv.getBoundingClientRect(), api = w.ChessMods.api, p = api.sqXY(sq), k = rect.width / cv.width;
    var x = rect.left + p.x * k, y = rect.top + p.y * k, el = doc.elementFromPoint(x, y) || cv;
    var o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
    try { el.dispatchEvent(new w.PointerEvent('pointerdown', o)); } catch (e) {}
    try { el.dispatchEvent(new w.PointerEvent('pointerup', o)); } catch (e) {}
    try { var tt = new w.Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new w.TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [tt], changedTouches: [tt] })); } catch (e) { R.touchFail = String(e); }
  }
  function sqOf(s) { return (8 - parseInt(s[1], 10)) * 8 + (s.charCodeAt(0) - 97); }
  function tip(w) { return w.document.getElementById('tip').textContent; }
  loadFrame(function (f) {
    var w = f.contentWindow;
    try {
      w.ChessMods.api.setBot(false);
      // --- Test A: puzzle 8 as shipped: does the game accept Qg7 as "Correct!"? ---
      w.loadPuzzle(8);
      R.p8 = { fenShipped: w.eval('PUZZLES[8].fen'), turn: w.ChessMods.api.turn };
      tap(w, sqOf('g1'));
      tap(w, sqOf('g7'));
      R.p8.tipAfterMove = tip(w);
      R.p8.overAfterMove = w.ChessMods.api.isOver();
      R.p8.blackCanCaptureQueen = w.ChessMods.api.playMove(sqOf('h8'), sqOf('g7'));
      R.p8.overAfterCapture = w.ChessMods.api.isOver();
      R.stage = 'A'; pub();
      setTimeout(function () {
        // --- Test B: corrected FEN through the page's own FEN parser + engine ---
        w.loadPuzzle(9);
        w.eval('PUZZLES[8].fen = ' + JSON.stringify(P.correctedFen));
        w.loadPuzzle(8);
        var st = JSON.parse(w.eval('JSON.stringify({turn:game.turn,ep:game.epTarget,cr:game.castlingRights})'));
        var board = Array.prototype.slice.call(w.ChessMods.api.board);
        var legal = w.getAllLegalMoves(board, st.turn, st.ep, st.cr);
        var mates = [];
        for (var i = 0; i < legal.length; i++) {
          var res = w.makeMove(board, legal[i], { castlingRights: st.cr });
          var replies = w.getAllLegalMoves(res.board, 1 - st.turn, res.ep, res.castling);
          if (replies.length === 0 && w.isInCheck(res.board, 1 - st.turn)) mates.push(w.sqName ? '' : (String.fromCharCode(97 + (legal[i].from % 8)) + (8 - Math.floor(legal[i].from / 8)) + String.fromCharCode(97 + (legal[i].to % 8)) + (8 - Math.floor(legal[i].to / 8))));
        }
        R.corrected = { fen: P.correctedFen, legalCount: legal.length, mates: mates };
        tap(w, sqOf('g1'));
        tap(w, sqOf('g7'));
        R.corrected.tipAfterMove = tip(w);
        R.corrected.overAfterMove = w.ChessMods.api.isOver();
        R.corrected.result = w.eval('game.result');
        R.stage = 'B'; pub();
        setTimeout(function () {
          // --- Test C: corrected ACADEMY.traps lines through the page engine ---
          w.resetGame(); w.ChessMods.api.setBot(false);
          R.fixedTraps = [];
          var keys = Object.keys(P.fixedTraps);
          for (var k = 0; k < keys.length; k++) {
            var name = keys[k], seq = P.fixedTraps[name], bad = -1;
            w.resetGame(); w.ChessMods.api.setBot(false);
            for (var j = 0; j < seq.length; j++) { if (!seq[j] || !w.ChessMods.api.playMove(seq[j][0], seq[j][1])) { bad = j; break; } }
            R.fixedTraps.push({ name: name, plies: seq.length, failedAt: bad, over: w.ChessMods.api.isOver(), result: w.eval('game.result') });
          }
          R.stage = 'done'; pub();
        }, 2000);
      }, 2000);
    } catch (e) { R.error = String(e && e.stack || e); R.stage = 'exception'; pub(); }
  });
})();
`;
fs.writeFileSync(__dirname + '/../shots/lcprobe2.js', probe.replace('__P__', JSON.stringify(P)));
fs.writeFileSync(__dirname + '/../shots/lcprobe2.html', ['<!DOCTYPE html>','<html><head><meta charset="utf-8"><title>lc fix probe</title></head>','<body style="margin:0;background:#111"><script src="lcprobe2.js"></script></body></html>',''].join(String.fromCharCode(10)));
console.log('wrote lcprobe2.js/html ; fixed trap lines: ' + Object.keys(P.fixedTraps).map(k => k + '=' + P.fixedTraps[k].filter(Boolean).length).join(', '));