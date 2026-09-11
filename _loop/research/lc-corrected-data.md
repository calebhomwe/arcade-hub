# Drop-in corrected learning data for games/chess.html

Every block below is an exact literal string replacement (old → new). All are asserted to occur exactly once in the
shipped file by `_loop/research/lc-patch.js`, which applies them all and writes `_loop/research/lc-chess-corrected.html`.
Unified diff: `_loop/research/lc-learning-fixes.diff`.

---

## 1. PUZZLES[8] — broken "mate in 1" (line 1215)

OLD (FEN part):
```
"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1"
```
NEW:
```
"fen":"7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"
```
Why: 1.Qg7 is mate only if g7 is guarded; with the king on f6 the stored solution `g1g7` becomes `Qg7#` (unique mate in 1).
Verified: page engine finds exactly 1 mate-in-1, real tap of g1→g7 returns "✅ Correct!" + `over:true` + "White wins by checkmate!".

## 2. PUZZLES[2].hint — wrong claim (line 1215)

OLD:
```
"hint":"The knight on e4 is attacked twice."
```
NEW:
```
"hint":"The knight on e4 is loose and undefended - ...d5 both defends it and hits the c4 bishop."
```
Why: engine shows zero White attackers (and zero Black defenders) of e4 in that FEN.

## 3-7. ACADEMY.traps — 5 illegal lines, 6 tokens (line 1224)

| entry | OLD token(s) | NEW token(s) |
|---|---|---|
| Fried Liver Setup | `d1f3 e8e6 b1c3` | `d1f3 f7e6 b1c3` |
| Noah's Ark Trap | `d5c6 c8d7 c6d5 c7c4` | `d5c6 e6d7 c6d5 c5c4` |
| Kostic Trap | `g2e4 c1e2 d4f3` | `g2e4 c4e2 d4f3` |
| Siberian Trap | `h2h3 g4d4` | `h2h3 c6d4` |
| Englund Gambit Trap | `e7b4 c1d2 b4b2` | `e7b4 f4d2 b4b2` |

Corrected full `moves` strings:
```
Fried Liver Setup     : e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5 g5f7 e8f7 d1f3 f7e6 b1c3
Noah's Ark Trap       : e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6 d2d4 b7b5 a4b3 c6d4 f3d4 e5d4 d1d4 c7c5 d4d5 c8e6 d5c6 e6d7 c6d5 c5c4
Kostic Trap           : e2e4 e7e5 g1f3 b8c6 f1c4 c6d4 f3e5 d8g5 e5f7 g5g2 h1f1 g2e4 c4e2 d4f3
Siberian Trap         : e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3 b8c6 g1f3 e7e6 f1c4 d8c7 e1g1 g8f6 d1e2 f6g4 h2h3 c6d4
Englund Gambit Trap   : d2d4 e7e5 d4e5 b8c6 g1f3 d8e7 c1f4 e7b4 f4d2 b4b2 d2c3 f8b4
```
Verified: all 12 ACADEMY.traps lines replay to full length through the page engine after the fix (was 7/12);
Kostic and Englund reach "Black wins by checkmate!" exactly as their `punish` text describes.

## 8. ENDGAME2[8] — wrong breakthrough line (line 1230, VISIBLE in the Endgames tab)

OLD:
```
"rule":"v-formation 3-vs-3: sacrifice the outer pawns to queen the middle one first (b6!? axb6 a6! bxa6 c6!)."
```
NEW:
```
"rule":"v-formation 3-vs-3: sacrifice the MIDDLE pawn first, then push the pawn on the far side of whichever capture Black chooses - 1.b6! axb6 2.c6! bxc6 3.a6 queens (1...cxb6 2.a6! bxa6 3.c6 queens too). The line b6 a6 c6 does NOT work: ...axb6, ...bxa6 leave the c-pawn blocked by the c7 pawn."
```
Why: after `b6 axb6 a6 bxa6 c6` White's c6 pawn has 0 legal moves (blocked by the black c7 pawn) and Black's b6 pawn queens (depth-8 search: Black +2). Both corrected orders are winning for White (search: Black -7).

## 9. ACADEMY.endgame[6] — same wrong line (line 1224, currently unrendered)

OLD:
```
"rule":"Three-versus-three wall trick: sacrifice the outer pawns to queen the survivor - b6!? axb6 a6! bxa6 c6 and the c-pawn reaches home first."
```
NEW:
```
"rule":"Three-versus-three wall trick: sacrifice the middle pawn, then push the pawn on the far side - 1.b6! axb6 2.c6! bxc6 3.a6 queens (1...cxb6 2.a6! bxa6 3.c6 also queens)."
```

## 10. ENDGAME2[0] — garbled Lucena text (line 1230, VISIBLE)

OLD:
```
"rule":"King in front of your pawn, rook cutting the enemy king one file away; build the bridge: Rook to rook-file's 4th?? exact: park rook on the file NEXT to yours? Canonical steps: 1. push pawn to 7th 2. shelter king on promotion file 3. swing rook over as the shield (the 'bridge') 4. promote."
```
NEW:
```
"rule":"King in front of your pawn on the promotion file, pawn on the 7th, rook cutting the enemy king off by a file; against the checks swing the rook to the 4th rank (Rb4) so it can shield the king - the bridge - then promote."
```

## 11. QUIZ[1] — impossible pin (line 1232)

OLD:
```
"q":"Knight on c3, enemy queen just arrived on b5. First question you ask?"
```
NEW:
```
"q":"Knight on c3, enemy queen just arrived on b4. First question you ask?"
```
Why: b5 and c3 are opposite-colour squares, so Qb5 can never pin (or even attack) the c3 knight; b4–c3–d2–e1 is a real diagonal, so Qb4 does pin Nc3 to Ke1 and the printed answer becomes correct.

## 12. COMBOS[10] — Anastasia pattern missing its condition (line 1226)

OLD:
```
...Ne7 seals g8, then Rxh7+! Kxh7 Qh5#
```
NEW:
```
...Ne7 seals g8, the g7 pawn blocks its own king, then Rxh7+! Kxh7 Qh5#
```
Why: engine - with the black g7 pawn present Qh5 is mate; without it the king escapes with Kg7.

## 13. ACADEMY.openings[10] Vienna Gambit — SAN token inside a UCI list (line 1224)

OLD:
```
f2f4 exf4 g1f3
```
NEW:
```
f2f4 e5f4 g1f3
```
Why: format consistency only (the move itself, e5xf4, is legal); protects any future "play this line" feature.

---

## Not patched (report only)

* `COMBOS[7]` typo "equalmate" (line 1226).
* `COMBOS[5]` says "19...Qg3!!!" for Levitsky–Marshall 1912; commonly cited as move 23 — needs a source before changing (unverified).
* 76 ACADEMY entries (mates/endgame/strategy/resources/traps/drills/exercises/mistakes) are unreachable in the UI (see report gap G1) — a wiring decision, not a data fix.
