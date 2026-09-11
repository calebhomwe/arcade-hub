'use strict';
const fs = require('fs');
const ROOT = 'C:/Users/caleb/AppData/Local/arcade-hub';
const src = fs.readFileSync(ROOT + '/games/chess.html', 'utf8');
let out = src;
const edits = [
  ['PUZZLES[8].fen  (broken mate-in-1 position)', '"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1"', '"fen":"7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"'],
  ['PUZZLES[1].hint (knight on e4 "attacked twice")', '"hint":"The knight on e4 is attacked twice."', '"hint":"The knight on e4 is loose and undefended - ...d5 both defends it and hits the c4 bishop."'],
  ['ACADEMY.traps[1] Fried Liver token', 'd1f3 e8e6 b1c3', 'd1f3 f7e6 b1c3'],
  ['ACADEMY.traps Noah\'s Ark tokens', 'd5c6 c8d7 c6d5 c7c4', 'd5c6 e6d7 c6d5 c5c4'],
  ['ACADEMY.traps Kostic token', 'g2e4 c1e2 d4f3', 'g2e4 c4e2 d4f3'],
  ['ACADEMY.traps Siberian token', 'h2h3 g4d4', 'h2h3 c6d4'],
  ['ACADEMY.traps Englund token', 'e7b4 c1d2 b4b2', 'e7b4 f4d2 b4b2'],
  ['ENDGAME2[8] pawn breakthrough line', 'v-formation 3-vs-3: sacrifice the outer pawns to queen the middle one first (b6!? axb6 a6! bxa6 c6!).',
   'v-formation 3-vs-3: sacrifice the MIDDLE pawn first, then push the pawn on the far side of whichever capture Black chooses - 1.b6! axb6 2.c6! bxc6 3.a6 queens (1...cxb6 2.a6! bxa6 3.c6 queens too). The line b6 a6 c6 does NOT work: ...axb6, ...bxa6 leave the c-pawn blocked by the c7 pawn.'],
  ['ACADEMY.endgame[6] pawn breakthrough line', 'sacrifice the outer pawns to queen the survivor - b6!? axb6 a6! bxa6 c6 and the c-pawn reaches home first.',
   'sacrifice the middle pawn, then push the pawn on the far side - 1.b6! axb6 2.c6! bxc6 3.a6 queens (1...cxb6 2.a6! bxa6 3.c6 also queens).'],
  ['ENDGAME2[0] garbled Lucena text', 'King in front of your pawn, rook cutting the enemy king one file away; build the bridge: Rook to rook-file\'s 4th?? exact: park rook on the file NEXT to yours? Canonical steps: 1. push pawn to 7th 2. shelter king on promotion file 3. swing rook over as the shield (the \'bridge\') 4. promote.',
   'King in front of your pawn on the promotion file, pawn on the 7th, rook cutting the enemy king off by a file; against the checks swing the rook to the 4th rank (Rb4) so it can shield the king - the bridge - then promote.'],
  ['QUIZ[1] impossible pin', '"q":"Knight on c3, enemy queen just arrived on b5. First question you ask?"', '"q":"Knight on c3, enemy queen just arrived on b4. First question you ask?"'],
  ['COMBOS[10] Anastasia missing g7-pawn condition', '...Ne7 seals g8, then Rxh7+! Kxh7 Qh5#', '...Ne7 seals g8, the g7 pawn blocks its own king, then Rxh7+! Kxh7 Qh5#'],
  ['ACADEMY.openings[10] Vienna Gambit SAN token in a UCI list', 'f2f4 exf4 g1f3', 'f2f4 e5f4 g1f3']
];
const report = [];
for (const [what, from, to] of edits) {
  const n = out.split(from).length - 1;
  report.push({ what, occurrences: n, applied: n === 1 });
  if (n === 1) out = out.replace(from, to);
}
fs.writeFileSync(ROOT + '/_loop/research/lc-chess-corrected.html', out);
console.log('edits applied:');
for (const r of report) console.log('  ' + (r.applied ? 'OK   ' : 'SKIP ') + 'x' + r.occurrences + '  ' + r.what);
console.log('bytes: ' + src.length + ' -> ' + out.length);
