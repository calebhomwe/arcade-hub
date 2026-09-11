# Learning-content verification — games/chess.html (Academy: Combos / Openings / Endgames / Quiz / Tips / Traps)

Author: learning-content subagent. Date: 2026-09-11. Source under test: `games/chess.html` @ git main, never edited by me (read-only).

**Revision note.** The parent wrote to `games/chess.html` at 19:08 while I was working (183,269 → 186,322 bytes: engine fixes, not learning data). I re-extracted and re-ran every check against the 19:08 revision and the learning datasets are byte-identical there, so every finding below is reproduced on the current file (`node _loop/research/lc-verify.js` still prints the same 5 `ILLEGAL` lines and the same `FLAG` for puzzle #8). `lc-learning-fixes.diff` and `lc-chess-corrected.html` were regenerated from that 19:08 revision, and the browser verification in (c) was re-run against it.

## (a) Summary

I extracted every learning dataset from the shipped HTML with a Node script, replayed every move line through a perft-validated Node chess engine AND through the page's own engine in real headless Chrome, and drove the puzzle UI with real PointerEvent/TouchEvent taps.

Counts (printed by `_loop/research/lc-extract.js`):

| dataset | line | entries |
|---|---|---|
| PUZZLES | 1215 | 22 |
| TIPS | 1222 | 175 |
| ACADEMY | 1224 | openings 20, tactics 12, mates 8, endgame 8, strategy 8, resources 12, traps 12, drills 10, exercises 8, mistakes 10 |
| COMBOS | 1226 | 12 |
| ROUTES | 1228 | 3 branches / 13 lines |
| ENDGAME2 | 1230 | 10 |
| QUIZ | 1232 | 12 |
| TRAPS | 1233 | 14 |

Headline results:

* All 14 `TRAPS` lines (parent's table) are legal, and every mate claim in them is a real checkmate — verified in Node AND in the page engine (`window.__trapCheck()` → 14/14 `played === total`). **No errors found in TRAPS.**
* All 20 `ACADEMY.openings` lines and all 13 `ROUTES` lines are legal chess (Node engine; also replayed through the page engine). **No errors found.**
* **1 broken puzzle**: `PUZZLES[8]` is labelled "Find the checkmate in 1" but the position has **no mate in 1**; the stored answer `g1g7` is met by `Kxg7` and the game still flashes "✅ Correct! Great move!". Real-browser proof below.
* **5 of 12 `ACADEMY.traps` lines are illegal** (6 wrong move tokens: `e8e6`, `c8d7`, `c7c4`, `c1e2`, `g4d4`, `c1d2`). The page engine refuses them at exactly those tokens. This dataset is currently **never rendered** (dead data) — see gap G1.
* **1 wrong endgame instruction visible in the UI**: `ENDGAME2[8]` pawn-breakthrough line `b6 axb6 a6 bxa6 c6` does not work — the surviving c-pawn is blocked by Black's c7 pawn and Black queens first (engine-verified). Correct order is `1.b6! axb6 2.c6!`.
* 1 wrong puzzle hint, 1 impossible quiz pin, 1 garbled visible endgame text, 1 incomplete combo pattern, 76 entries of dead Academy data.
* Verified copy with all fixes applied loads with **CONSOLE_ERRORS=0** and behaves as intended (see (c)).

## (b) Findings, with evidence

### F1 (HIGH) — PUZZLES[8]: "checkmate in 1" has no mate in 1; the accepted answer loses the queen

Evidence — data (`games/chess.html:1215`): `{"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1", ..., "desc":"Find the checkmate in 1.", "hint":"The queen delivers the final blow.", "solution":"g1g7"}`.

Command: `node _loop/research/lc-verify.js`
```
FLAG   | # 8 -          Qg7+      | Find the checkmate in 1.   << CLAIMS_MATE1_BUT_CHECK_ONLY
        fen=7k/8/8/8/8/8/8/6QK w - - 0 1
```
Command: `node _loop/research/lc-deep.js` (section B)
```
  mate-in-1 moves: NONE
  after solution g1g7: white queen on g7 defended by? attackers-of-g7-by-white count = 0
  black replies after g1g7: Kxg7
```
Real browser (page's own engine + real touch taps), shipped file, `_loop/shots/lcprobe.js` via `_loop/shots/lccdp.js`:
```
"p8": { "fenShipped": "7k/8/8/8/8/8/8/6QK w - - 0 1", "turn": 0,
        "tipAfterMove": "✅ Correct! Great move!",   <-- the game rewards the blunder
        "overAfterMove": false,                      <-- it is not mate
        "blackCanCaptureQueen": true, "overAfterCapture": true }  <-- Kxg7 then bare kings = draw
```
(The page reports `matesPage: 0` for this position and `matesPage: 1` for every other `type:"mate1"` puzzle, so the page engine and my engine agree.)

### F2 (HIGH, latent) — ACADEMY.traps: 5 illegal lines / 6 wrong tokens

`ACADEMY.traps` lives on `games/chess.html:1224`. Replay output from `node _loop/research/lc-verify.js`:
```
ILLEGAL | Fried Liver Setup     | FAILED at e8e6 (#13) fen=r1bq1b1r/ppp2kpp/... b KQ - 1 7
ILLEGAL | Noah's Ark Trap       | FAILED at c8d7 (#19) fen=r2qkbnr/5ppp/p1Qpb3/1pp5/... b KQkq - 3 10
ILLEGAL | Kostic Trap           | FAILED at c1e2 (#12) fen=r1b1kbnr/pppp1Npp/8/8/2Bnq3/... w Qkq - 0 7
ILLEGAL | Siberian Trap         | FAILED at g4d4 (#17) fen=.../2B1P1n1/2N2N1P/... b kq - 0 9
ILLEGAL | Englund Gambit Trap   | FAILED at c1d2 (#8)  fen=.../1q3B2/5N2/... w KQkq - 5 5
```
Cause is always the same: the token names a square the piece has already left (bishop c8→e6 then "c8d7"; bishop c1→f4 then "c1d2"; bishop f1→c4 then "c1e2"; knight c6→g4 then "g4d4"; king e8→f7 then "e8e6"; pawn c7→c5 then "c7c4").
The page engine rejects them identically — `_loop/shots/lcprobe.js` replay through `ChessMods.api.playMove` stopped at plies 13/19/12/17/8 for those five lines while every other line played to full length.

### F3 (HIGH, visible) — ENDGAME2[8] "Pawn breakthrough" line is wrong

`games/chess.html:1230` (rendered in the Endgames tab by `LEARN_CATS.endgames`, `games/chess.html:1347`):
`"v-formation 3-vs-3: sacrifice the outer pawns to queen the middle one first (b6!? axb6 a6! bxa6 c6!)."`

Command: `node _loop/research/lc-deep2.js` (section F), position `7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1`:
```
b6 axb6 a6 bxa6 c6 -> fen=7k/2p5/ppP5/8/8/8/8/7K b - - 0 3
white c6 pawn legal moves: 0                       <-- blocked by Black's c7 pawn, it never queens
search depth 8 after 3.c6: {"v":200}               <-- Black (to move) is better: the b6 pawn runs to b1
CORRECTED A: b6 axb6 c6! bxc6 a6 -> white a6 pawn CLEAR (a6-a7-a8=Q); eval {"v":-700} (Black lost)
CORRECTED B: b6 cxb6 a6! bxa6 c6 -> eval {"v":-700} (Black lost)
```
The same wrong line and the same wrong explanation ("...and the c-pawn reaches home first") is duplicated in `ACADEMY.endgame[6]` (`games/chess.html:1224`) — that copy is currently dead data (gap G1).

### F4 (MEDIUM) — PUZZLES[2] hint is factually wrong

`games/chess.html:1215` (entry 3): `hint:"The knight on e4 is attacked twice."`, FEN `r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1`.
Command: `node _loop/research/lc-deep.js` (section A):
```
white attackers of e4: NONE
black defenders of e4: NONE        <-- the knight is loose, not "attacked twice"
after 1...d5 white legal replies: Bb5 Ba6 Bxd5 Bb3 Bd3 Be2 Nxe5 Ng5 Nd4 Nh4 Ne1 ...
```
The solution `d7d5` itself is fine (it defends the loose knight and hits the c4 bishop); only the hint is wrong. The move is legal in both engines and does not end the game — no other problem.

### F5 (MEDIUM, visible) — ENDGAME2[0] Lucena text is garbled draft text

`games/chess.html:1230`, rendered verbatim in the Endgames tab:
`"King in front of your pawn, rook cutting the enemy king one file away; build the bridge: Rook to rook-file's 4th?? exact: park rook on the file NEXT to yours? Canonical steps: 1. push pawn to 7th ..."`
It literally contains "??" and "exact:" — an unfinished self-correction shipped to players. (The clean version of the same rule exists at `ACADEMY.endgame[3]`.)

### F6 (MEDIUM) — QUIZ[1] asks about a pin that is geometrically impossible

`games/chess.html:1232`: `{"q":"Knight on c3, enemy queen just arrived on b5. First question you ask?","a":"Am I pinned? What's behind it — my king, queen, or material?"}`.
Command: `node _loop/research/lc-deep5.js`:
```
  a1=dark h1=light c3=dark b5=light -> same diagonal possible? false
  does Qb5 attack c3? false
```
A queen on b5 and a knight on c3 are on opposite-colour squares, so no pin (and no attack) is possible regardless of where the kings stand; the "am I pinned" reflex does not apply to the printed position. Changing the question's square to **b4** makes the answer correct: b4–c3–d2–e1 is one diagonal, so Qb4 really does pin Nc3 against Ke1.

### F7 (LOW) — COMBOS[10] Anastasia pattern omits the condition that makes it mate

`games/chess.html:1226`: `"...Ne7 seals g8, then Rxh7+! Kxh7 Qh5#"`. Command `node _loop/research/lc-deep2.js` (section E2):
```
  Anastasia WITH black pawn on g7  8/4N1pk/8/7Q/8/8/8/K7 b  -> Qh5 mate? true
  Anastasia WITHOUT the g7 pawn    8/4N2k/8/7Q/8/8/8/K7 b  -> Qh5 mate? false   (Kg7 escapes)
```
`ACADEMY.mates[3]` states the condition correctly ("with the enemy g7 pawn stuck at home"), so this is an internal inconsistency in shipped text, not a rules error.

### F8 (LOW) — COMBOS[7] typo

`games/chess.html:1226`: `"moral":"Criss-crossed bishops plus a forced king-walk equalmate."` — "equalmate" is not a word (Boden's mate is simply mate).

### F9 (LOW) — ACADEMY.openings[10] mixes SAN into a UCI move list

`games/chess.html:1224`: Vienna Gambit `"moves":"e2e4 e7e5 b1c3 g8f6 f2f4 exf4 g1f3 d7d5 e4d5 f6d5 f1c4"` — one SAN token (`exf4`) inside an otherwise coordinate list. Harmless today (the `moves` field is never displayed or played — see G1) but it would break any future "play it out" feature that parses coordinates like `playTrap` does (`games/chess.html:1254-1256`). Chess-wise the move is correct (e5xf4); I changed it to `e5f4` for format consistency.

### G1 (GAP) — 76 Academy entries are dead data (never rendered)

`LEARN_CATS` (`games/chess.html:1344-1351`) only renders `COMBOS`, `ROUTES`, `ENDGAME2` (tab "endgames"), `QUIZ`, `TIPS`, `TRAPS`. Grepping the whole file for ACADEMY usage outside its definition gives exactly two hits:
```
2150: ... const t = rnd(ACADEMY.tactics); text = '⚔️ Motif: ' + t.name + ' — ' + t.how;
2151: ... const o = rnd(ACADEMY.openings); text = '♟️ Lesson: ' + o.name + ' — ' + o.idea;
```
So `ACADEMY.mates` (8), `.endgame` (8), `.strategy` (8), `.resources` (12), `.traps` (12), `.drills` (10), `.exercises` (8), `.mistakes` (10) = **76 authored entries are unreachable in the UI**, and `ACADEMY.openings[].moves` (20 full opening lines) is never shown either — only `name` + `idea` in a random-lesson popup. This is the biggest *content* gap: the file contains a large academy that players cannot see.

### Non-issues I checked (so nobody re-checks them)

* **TRAPS (14/14)** legal; every `#` claim verified as checkmate by both engines; `__trapCheck()` returns `played === total` for all 14, with `over:true` exactly for the mate-ending lines (Scholar's Mate, Legal's Mate, Blackburne, Stafford, Englund, Kieninger, Napoleon's).
* **Punish texts** of the mate traps were matched against replay SAN: `Qxf7#`, `Nd5#`, `Nf3#`, `Bg4#`, `Qc1#`, `Nd3#` all appear as the final mate move; Elephant Trap `...Nxd5 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8` replays exactly as written; Lasker Trap's `7...fxg1=N+` is available (knight promotion is generated) after the printed `7.Ke2`.
* **TRAPS Siberian** punish says "...Nd4 forks the queen on e2; White loses her to stop mate on h2". I checked the literal threat: after the trap line and a neutral `10.a3`, `...Qh2+` is **met by `Nxh2`** (not mate) because White's f3 knight defends h2 — the text itself gives `...Nxf3+` first as the mechanism, so the text is accurate-but-compressed. No change proposed.
* **Smothered mate** `Qg8+ Rxg8 Nf7#` (TIPS[31] and the tail of COMBOS[9]/ACADEMY.mates[1]) is a genuine finish. The longer printed prefix `Nf7+ Kg8 Nh6+ Kh8` is not forced in a rook-on-f8 setting (engine: after `1.Nf7+` Black also has `Rxf7`), so it is an idealised textbook order rather than a forced line — noted, not patched (no FEN is given, so it is not falsifiable as printed).
* **Hook mate** sample (`ACADEMY.mates[5]`: "White Pg6, Nf6, Rh7# versus Kh8") verified mate by engine.
* **Fool's Mate / Scholar's Mate / Back-rank / Ladder / Boden** text verified correct.
* **COMBOS replays** (engine, from the initial position): Legal 1750 → mate after `Nd5#`; Opera Game 1858 full 33 plies → `17.Rd8#` mate; Immortal Game 1851 full 45 plies → `Be7#` mate; Evergreen 1852 full 47 plies → `Bxe7#` mate. The quoted fragments are consistent with those games.
* **Puzzle side-to-move**: for all 22 puzzles the FEN side to move equals the side named in `desc` (`turnMatchesDesc` true everywhere); every solution is legal; every `type:"mate1"` puzzle except #8 is a real checkmate (page: `matesPage>=1`, `over:true`, `"White wins by checkmate!"`).
* **TIPS**: 175 entries, no duplicates, no testable claim found wrong other than the wording notes below. (I checked the concrete ones: Tarrasch rule, Philidor, Lucena bridge, opposition, key squares, rule of the square, wrong-coloured bishop, underpromotion, castling/en-passant/50-move/threefold rules, knight-on-the-rim geometry — all standard and correctly stated.)
* **QUIZ**: 12 entries, no empty answers; only Q1 (pin, F6) is wrong.

## (c) Proposed patch and how it was verified

Files:
* `_loop/research/lc-learning-fixes.diff` — unified diff (33 lines, 5 changed source lines; generated with `git diff --no-index -- games/chess.html _loop/research/lc-chess-corrected.html`).
* `_loop/research/lc-chess-corrected.html` — the patched copy the diff was generated from.
* `_loop/research/lc-patch.js` — idempotent applier: it asserts each source string occurs exactly once, then rewrites the file. Run `node _loop/research/lc-patch.js` (writes `lc-chess-corrected.html`) — this is the safest way to re-apply after any other edit to the file.
* `_loop/research/lc-corrected-data.md` — the same 13 corrections as drop-in replacement snippets.

Change list (13 edits, 5 source lines):

| # | where | change |
|---|---|---|
| 1 | PUZZLES[8] | `"7k/8/8/8/8/8/8/6QK w - - 0 1"` → `"7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"` (Kf6 guards g7, so the stored answer becomes a real mate) |
| 2 | PUZZLES[2].hint | "The knight on e4 is attacked twice." → "The knight on e4 is loose and undefended - ...d5 both defends it and hits the c4 bishop." |
| 3 | ACADEMY.traps Fried Liver | `d1f3 e8e6 b1c3` → `d1f3 f7e6 b1c3` |
| 4 | ACADEMY.traps Noah's Ark | `d5c6 c8d7 c6d5 c7c4` → `d5c6 e6d7 c6d5 c5c4` |
| 5 | ACADEMY.traps Kostic | `g2e4 c1e2 d4f3` → `g2e4 c4e2 d4f3` |
| 6 | ACADEMY.traps Siberian | `h2h3 g4d4` → `h2h3 c6d4` |
| 7 | ACADEMY.traps Englund | `e7b4 c1d2 b4b2` → `e7b4 f4d2 b4b2` |
| 8 | ENDGAME2[8] | rule text → "sacrifice the MIDDLE pawn first, then push the pawn on the far side … 1.b6! axb6 2.c6! bxc6 3.a6 queens (1...cxb6 2.a6! bxa6 3.c6 queens too). The line b6 a6 c6 does NOT work…" |
| 9 | ACADEMY.endgame[6] | same corrected breakthrough text |
| 10 | ENDGAME2[0] | garbled Lucena text → clean one-sentence version |
| 11 | QUIZ[1].q | queen on `b5` → queen on `b4` (makes the printed answer true) |
| 12 | COMBOS[10].combo | add ", the g7 pawn blocks its own king," |
| 13 | ACADEMY.openings[10].moves | `exf4` → `e5f4` |

Verification of the proposal (all in real Chrome, `_loop/shots/lccdp.js` = copy of the parent harness on ephemeral ports, serving the repo over http; re-run on the regenerated copy of the 19:08 revision):
* Corrected copy loaded in a 390x844 iframe → **CONSOLE_ERRORS=0**.
* Puzzle regression: all 22 corrected puzzles load with the same board as the FEN and the same legal-move counts as my engine (only #20 differs — page 2 vs true 5 — because the page generates a single promotion move; benign, the promo overlay lets the player pick the piece, `games/chess.html:1983-2006`).
* Puzzle #8 after the fix (real taps): `p8fen = "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"`, `p8mates = 1`, tap g1→g7 → `tip = "✅ Correct! Great move!"`, `over = true`, `result = "White wins by checkmate!"`.
* Trap regression: `__trapCheck()` on the corrected copy still returns 14/14 full-length, identical `over` flags; `trapRegression.failing = 0`.
* ACADEMY.traps after the fix: **12/12 lines replay to full length** (`failedAt = -1`), with mate confirmed for Legal's Mate, Kostic ("Black wins by checkmate!") and Budapest — up from 7/12.
* The ACADEMY.traps fixes were additionally pre-checked in Node (`node _loop/research/lc-deep4.js`, section J): each corrected line ends with exactly the SAN its `punish` text describes (…Qf3+ Ke6 Nc3; …Be6 Qc6+ Bd7; …Qxe4+ Be2 Nf3#; …Ng4 h3 Nd4; …Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#).

Evidence commands (all run from `C:\Users\caleb\AppData\Local\arcade-hub`):
```
node _loop/research/lc-extract.js      # dataset counts + per-section dumps
node _loop/research/lc-perft.js        # 5 standard perft suites - engine validation
node _loop/research/lc-verify.js       # traps/openings/routes/puzzles legality table
node _loop/research/lc-deep.js         # puzzle #2/#3/#8, combos replays, mate patterns
node _loop/research/lc-deep2.js        # Anastasia, breakthrough, KQ/KR playouts
node _loop/research/lc-deep4.js        # proposed trap fixes + TRAPS punish texts
node _loop/research/lc-mkprobe.js ; node _loop/research/lc-mkprobe2.js ; node _loop/research/lc-mkprobe3.js
cd _loop/shots ; node lccdp.js "_loop/shots/lcprobe.html"    # page engine: traps/academy/puzzles (CONSOLE_ERRORS=0)
cd _loop/shots ; node lccdp.js "_loop/shots/lcprobe2.html"   # shipped puzzle #8 accepted the blunder
cd _loop/shots ; node lccdp.js "_loop/shots/lcprobe3.html"   # corrected copy: 0 errors, fix behaves
```
My Node engine (`_loop/research/lc-chess.js`) passes all 5 standard perft suites (`lc-perft.js`: startpos 20/400/8902/197281, Kiwipete 48/2039/97862, position 3 14/191/2812/43238, position 4 6/264/9467, position 5 44/1486/62379), and its FEN parsing/legal-move counts agree with the page engine on every puzzle position except the underpromotion count noted above.

## (d) What I could NOT verify

1. **Historical move numbers / attributions inside COMBOS** (e.g. "Levitsky vs Marshall … 19...Qg3!!!", year columns, "Capablanca converted in 32 moves"). I replayed the four combos that include a reconstructable full game and confirmed the tactics and mate, but the move *numbers* and the year/attribution columns were not checked against a primary source. Specifically `COMBOS[5]` gives "19...Qg3!!!" for Levitsky–Marshall 1912; the widely quoted number for that move is 23, so it is worth a source check — I did not confirm it and it is not in the patch.
2. **ENDGAME2[3] "Two Bishops Mate" and [4] "Bishop + Knight Mate"**: I could not build a driver that provably mates from a random position inside the 50-move rule (my naive KX-vs-K search loops and my hand-written KRK line was wrong), so these two entries and the general "K+Q/K+R are wins" claims are **unverified by playout**; they are standard theory and I found no evidence of error. What I did verify is the concrete mate patterns: `Qg7#` (K+Q corner mate) and `Ra8#` (R+K mate) are produced by the engine, and `KR vs K`/`KQ vs K` evaluation is not contradicted anywhere in the data.
3. **TRAPS[?] "Noah's Ark … Capablanca converted in 32 moves"** and other historical colour text — not verified.
4. **`ACADEMY.resources` link liveness** (12 book/YouTube/lichess entries on `games/chess.html:1224`) — no network check was performed; and the dataset is not rendered anyway (G1).
5. **Whether the parent intends `ACADEMY.traps`/`mates`/`endgame`/… to be wired into the UI** — I only report that they are unreachable today; making them visible is a product decision, so my patch fixes their chess content but does not add UI.
