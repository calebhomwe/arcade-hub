# Chess — correctness test & fix report

Method: test against external truth (published perft counts, brute-force rules proofs, engine
self-play invariants), fix only what a test proved broken, and require evidence before/after.
No new features, no filler.

## 1. Promotion move generation was wrong (rules bug) — FIXED
The generator emitted ONE promotion move (implicitly a queen) instead of four.
Evidence: perft against the published node counts for the six standard positions.

| position | depth | got | published |
|---|---|---|---|
| position 5 | 1 | 41 | 44 |
| position 4 | 2 | 228 | 264 |
| position 4 | 3 | 8087 | 9467 |

Position 5's root was exactly 3 short — the three missing underpromotions. startpos, Kiwipete,
position 3 and position 6 already passed, which is why the bug hid.
After the fix all six positions match at every depth tested: **518,468 nodes verified**.
The bot now keeps the promotion piece the search chose instead of always forcing a queen.

## 2. A puzzle rollback destroyed the whole game state (user-reachable) — FIXED
Answering a puzzle wrong scheduled `setTimeout(600)` doing `game = game.moveHistory.pop()`
with no guard. Start a new game inside that window and the pop returns undefined, so `game`
became undefined and every later updateUI / draw / showGameOver threw.

Reproduction, same test, before and after:
- deployed (pre-fix): `after the rollback window: game is MISSING, redraw ok=false`, 1 uncaught TypeError
  (the full suite run logged **18** of them)
- fixed: `game is present, redraw ok=true`, 0 console errors

The rollback is now tracked, cancelled on reset, and guarded against a missing game or empty history.

## 3. The engine shuffled into repetition draws — FIXED
`findBestMove` kept the first move of the best-scoring set; a shallow search scores many moves
identically, so engine-vs-engine play walked the same pieces back and forth.
Measured, same three self-play games:
- before: 75 plies total, **3/3 draws by threefold repetition** (about 25 plies each)
- after: 155-236 plies, **0 repetition draws**, ending in actual checkmates

Ties are now broken randomly inside a 12-centipawn window, preferring the move that repeats least.

## 4. Two draw rules tightened — FIXED / VERIFIED
- An en passant capture that would expose your own king is illegal (tested with and without the pin,
  and the blocked pawn can still advance).
- King+bishop vs king+bishop is only dead when the bishops are on the SAME colour. Opposite colours
  can still mate, so it now falls to the fifty-move and repetition rules instead of a wrong auto-draw.
- Threefold repetition verified to trigger on the move that creates it.

## Test suite growth
246 -> **262 checks**, all green, including new cases:
- `perft` — six standard positions with published counts (was startpos depth 3 only)
- `rules` — 24 checks: stalemate, checkmate, all four promotions, en passant present/absent/pinned,
  castling out of / through / without rights, castling rights lost on rook move and rook capture,
  four insufficient-material variants, repetition, fifty-move
- `promotion` — 14 checks: picker opens on tap and on drag, underpromotion, cancel, capture-promotion,
  the bot promoting, and PGN output
- `selfplay` — board invariants on every ply (one king each, no non-mover in check, no pawn on rank
  1 or 8, every proposed move legal, always terminates) plus a FEN round-trip

## Verification
- per-case suite: **0 failures** (38 cases)
- whole-suite-in-one-page: **262 checks, 0 failures**
- deployed build: **262 checks, 0 failures, 0 console errors**
- performance re-measured after the fix: frame 0.056ms, UI 0.006ms, move gen 0.045ms, bot depth 2 4ms

## Honest limits
- Perft was checked to depth 4 on startpos and position 3, depth 3 elsewhere; deeper runs were not
  attempted (a JS perft at depth 5+ is minutes of CPU).
- The self-play assertion allows at most one of three games to end by repetition (randomised ties),
  so it is a real signal, not a guarantee.
- No listening test for audio; no physical iPhone; the bot remains a heuristic minimax.
