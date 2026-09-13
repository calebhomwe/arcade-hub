# Chess — review / analysis validation plan

Standing rule: a fix lands only when a test proves the defect, with a before/after receipt.

## A. Faithful replay (the analysis must see the same game the player played)
- [x] A1. Replay a game containing castling, en passant and a promotion through the review path and
      assert every reconstructed position matches the real one ply by ply.
- [x] A2. The review must not mutate the live game (board, history, result, clocks) — compare before/after.
- [x] A3. Every ply gets a tag from the documented set, and no ply is missing a tag.

## B. Grading correctness against independent truth
- [x] B1. A position with only one good move (the rest lose material) must be graded best for the good
      move and inaccuracy-or-worse for a bad one.
- [x] B2. A move that hangs a queen must grade mistake or blunder, not good.
- [x] B3. A move that delivers mate must grade best.
- [x] B4. The grading must be independent of the player's colour (White's blunder and the mirrored
      Black blunder grade the same).

## C. Robustness and cost
- [x] C1. Review opens and closes after every ending (mate, stalemate, resignation, abort, timeout,
      repetition, insufficient material) without throwing.
- [x] C2. Review of a long game (60+ plies) completes inside a sane budget and reports its cost.
- [x] C3. Review with no moves, one move, and a game that ended before any move.

## D. Coach path
- [x] D1. The coach's stray-piece check uses the real en passant and castling state (the mod API now
      exposes them) and never throws.
- [x] D2. Coach advice never contradicts the board (assert the checked condition actually holds).

## E. Verification
- [x] E1. Both suite modes green; deployed build green with zero console errors; report written.

All items complete. Evidence per item in chess-review-report.md.
