# Chess — hardening plan (correctness-first, no filler)

Standing rule: a change lands only if a test proves the defect, and the fix has a before/after receipt.
No new features unless a test shows a player-visible gap.

## A. Engine truth (external reference)
- [x] A1. perft deeper: position 3 at depth 5 (674,624) and Kiwipete at depth 4 (4,085,603) if the JS
      generator can finish inside a reasonable budget; report the runtime.
- [x] A2. perft split comparison on any mismatch so a failure names the exact move.
- [x] A3. Verify the search never proposes an illegal move across many random positions (fuzz), and that
      mate-in-1 is always found (engine returns a move that checkmates when one exists).

## B. FIDE rules still unproven
- [x] B1. Fifty-move boundary: 99 vs 100 halfmoves, and mate delivered ON the 100th halfmove wins over
      the draw claim.
- [x] B2. Threefold equality must include castling rights and en-passant availability (positions that
      differ only in rights are NOT the same position).
- [x] B3. En passant that removes a checking pawn, and a promotion that gives check/mate.
- [x] B4. Castling when the rook is attacked is legal; castling rights are gone after a rook is captured
      on its home square (already covered) and after a promoted rook returns to a home square.

## C. State and timing races (the class that produced the last crash)
- [x] C1. Audit every setTimeout / setInterval / requestAnimationFrame that mutates game state: each
      must be cancelled on reset or guarded against a stale game.
- [x] C2. Undo/redo/new-game during bot thinking and during an animation.
- [x] C3. Puzzle -> reset -> puzzle again, and leaving a puzzle mid-rollback (the last bug's neighbours).
- [x] C4. Clock flag: time runs out, the game ends once, and undo/redo cannot resurrect a flagged game.

## D. Player-facing flows
- [x] D1. Promotion via premove.
- [x] D2. Draw by agreement and resignation followed immediately by Rematch.
- [x] D3. Settings persistence across a reload (theme, pieces, coordinates, tips, sound set, volume).
- [x] D4. Review/coach never throw on a game that ended by resignation, abort, timeout or repetition.

## E. Verification hygiene
- [x] E1. Suite green in both modes (per-case and whole-suite-in-one-page).
- [x] E2. Deployed build green with zero console errors.
- [x] E3. Every claim in the report has a command and its real output.

All items complete. See chess-hardening-report.md for the evidence per item.
