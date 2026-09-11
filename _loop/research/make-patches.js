#!/usr/bin/env node
// make-patches.js - writes patched COPIES of a FROZEN chess.html snapshot under _loop/shots/.
// Never touches games/chess.html. Each patch must match exactly once.
//   ENG_SRC   : source html (defaults to the frozen snapshot)
// Emits: engfix-<id>.html  (clean copy, used for the diffs)
//        engprobe-<id>.html (same + <base href="/games/"> so the mod scripts load from any path)
'use strict';
const fs = require('fs'), crypto = require('crypto');
const ROOT = 'C:/Users/caleb/AppData/Local/arcade-hub';
const SRC = process.env.ENG_SRC || ROOT + '/_loop/shots/engfix-snapshot.html';
const OUT = ROOT + '/_loop/shots';
const src = fs.readFileSync(SRC, 'utf8');

const PATCHES = [
  { id: 'review-castle-flag', title: 'reconstructReviewMove: only flag real castling moves',
    old: "  if (t === PT.KING) {\n    if (raw.to === 62 || raw.to === 6) m.castle = 'kingside';\n    else if (raw.to === 58 || raw.to === 2) m.castle = 'queenside';\n  } else if (t === PT.PAWN) {",
    neu: "  if (t === PT.KING) {\n    const dc = col(raw.to) - col(raw.from);\n    if (dc === 2) m.castle = 'kingside';\n    else if (dc === -2) m.castle = 'queenside';\n  } else if (t === PT.PAWN) {" },
  { id: 'puzzle8-fen', title: 'PUZZLES[8]: FEN now really is mate in 1 (Qg7#)',
    old: '{"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1","desc":"Find the checkmate in 1.","hint":"The queen delivers the final blow.","solution":"g1g7"}',
    neu: '{"fen":"7k/5K2/8/8/8/8/8/6Q1 w - - 0 1","desc":"Find the checkmate in 1.","hint":"The queen delivers the final blow.","solution":"g1g7"}' },
  { id: 'puzzle19-fen', title: 'PUZZLES[19]: drop unreachable d7 pawn so the ep square is legal',
    old: '{"fen":"4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 1","solution":"e5d6"',
    neu: '{"fen":"4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1","solution":"e5d6"' },
  { id: 'castle-rook-present', title: 'getLegalMoves: kingside castling requires the h-rook',
    old: '      if (castlingRights[ks] && !b[idx(r,5)] && !b[idx(r,6)] &&',
    neu: '      if (castlingRights[ks] && b[idx(r,7)] === P(PT.ROOK,color) && !b[idx(r,5)] && !b[idx(r,6)] &&' },
  { id: 'castle-rook-present-q', title: 'getLegalMoves: queenside castling requires the a-rook',
    old: '      if (castlingRights[qs] && !b[idx(r,3)] && !b[idx(r,2)] && !b[idx(r,1)] &&',
    neu: '      if (castlingRights[qs] && b[idx(r,0)] === P(PT.ROOK,color) && !b[idx(r,3)] && !b[idx(r,2)] && !b[idx(r,1)] &&' },
  { id: 'rep-ep-key', title: 'positionKey: ignore an en-passant square no pawn can actually use',
    old: "  s += '|' + (epTarget === null || epTarget === undefined ? '-' : epTarget);",
    neu: "  let epk = '-';\n  if (epTarget !== null && epTarget !== undefined) {\n    const capRow = turn === CL.WHITE ? row(epTarget) + 1 : row(epTarget) - 1;\n    for (const dc of [-1, 1]) {\n      const c = col(epTarget) + dc;\n      if (c < 0 || c > 7) continue;\n      const i = idx(capRow, c);\n      if (pType(board[i]) === PT.PAWN && pColor(board[i]) === turn && getLegalMoves(board, i, epTarget, castlingRights).some(m => m.ep)) { epk = epTarget; break; }\n    }\n  }\n  s += '|' + epk;" },
  { id: 'insufficient-samecolor-bishops', title: 'hasInsufficientMaterial: same-coloured bishops cannot mate',
    old: "      const cols = bish.map(b => ({ light: (row(b.i) + col(b.i)) % 2 === 0, w: pColor(b.p) }));\n      if (cols[0].light !== cols[1].light && cols[0].w !== cols[1].w) return true;",
    neu: "      const cols = bish.map(b => ({ light: (row(b.i) + col(b.i)) % 2 === 0, w: pColor(b.p) }));\n      if (cols[0].light === cols[1].light) return true;\n      if (cols[0].w !== cols[1].w) return true;" },
];
function apply(text, p) {
  const n = text.split(p.old).length - 1;
  if (n !== 1) throw new Error('patch ' + p.id + ': matched ' + n + ' times');
  return text.replace(p.old, p.neu);
}
function withBase(html) {
  const i = html.indexOf('<head>');
  if (i < 0) throw new Error('no <head>');
  return html.slice(0, i + 6) + '\n<base href="/games/">' + html.slice(i + 6);
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const report = { source: SRC, sourceSha: sha(src), bytes: src.length, patches: [] };
fs.writeFileSync(OUT + '/engprobe-snapshot.html', withBase(src));
for (const p of PATCHES) {
  const out = apply(src, p);
  fs.writeFileSync(OUT + '/engfix-' + p.id + '.html', out);
  fs.writeFileSync(OUT + '/engprobe-' + p.id + '.html', withBase(out));
  report.patches.push({ id: p.id, title: p.title, clean: 'engfix-' + p.id + '.html', probe: 'engprobe-' + p.id + '.html', sha: sha(out) });
}
let all = src;
for (const p of PATCHES) all = apply(all, p);
fs.writeFileSync(OUT + '/engfix-all.html', all);
fs.writeFileSync(OUT + '/engprobe-all.html', withBase(all));
report.all = { clean: 'engfix-all.html', probe: 'engprobe-all.html', sha: sha(all) };
console.log(JSON.stringify(report, null, 1));
