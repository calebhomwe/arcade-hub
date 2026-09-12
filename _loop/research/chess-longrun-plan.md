# Chess — long autonomous run plan (4 hours) — COMPLETE

## P0 — the owner's callout
- [x] P0a. Knight re-sculpted: a lofted Staunton horse head (muzzle, jaw, two ears, six-scallop mane,
      carved almond eye) with the bend at the poll. Base/camera/lights untouched.
- [x] P0b. Contact sheet, knight study and board-size strip read back and inspected by me, on a real
      board at 2x DPR and at shipping size.
- [x] P0c. 256px shipping sprites regenerated (1345 KB -> 262 KB) and verified in game: 12 images ready.

## P1 — piece set quality
- [x] P1a. Heights pawn 288 < bishop 349 < knight 390 < rook 421 < queen 434 < king 467 px, baseline
      spread 0, 12/12 distinct 512x512 type-6 PNGs, nothing touching the border.
- [x] P1b. One camera, one lighting rig, contact shadow; no piece clips its base.
- [x] P1c. Dark pieces carry a faint light rim and light pieces a dark outline, and the sprite level
      pass now actually reaches the canvas (it previously only reached the outline).

## P2 — audio QA
- [x] P2a. All 82 referenced clips measured with two independent parsers (hand-rolled RIFF + ffmpeg);
      6 flagged before, 2 after, all reported.
- [x] P2b. 13 clips re-trimmed (late onsets, sluggish heads, long tail); manifests + catalog refreshed;
      verified idempotent. The one unfixable near-duplicate pair (non-default crisp set) is documented.

## P3 — mobile / iPhone
- [x] P3a. Emulated iPhone 393x852 DPR 3 with touch: start screen -> Play -> touch-to-move -> bot reply
      -> resign -> result dialog -> PGN/FEN -> Settings, zero console errors.
- [x] P3b. Every control >= 40px, no horizontal overflow, safe-area support detected.

## P4 — UI polish
- [x] P4a. Board inspected at 2x DPR; desktop at 1280x860; icon rows no longer collapse or wrap raggedly.
- [x] P4b. The coach's arcade speech bubbles are gone (opt-in, neutral note, informative lines); no
      duplicate ids; no debug leftovers.

## P5 — gameplay
- [x] P5a. Clock does not refund on undo; clock state respected on undo/redo.
- [x] P5b. Undo/redo across a bot move, across a resignation (dialog now follows the game state), redo
      cleared by a new move.
- [x] P5c. Puzzle mode: streak, rejection rollback, and the stray "next puzzle" timer bug fixed.

## P6 — performance and accessibility
- [x] P6a. Real measurements (no virtual clock): drawBoard 0.06 ms, updateUI 0.005 ms, move gen 0.048 ms,
      bot depth 2 5.3 ms.
- [x] P6b. Keyboard-only playthrough: select, move, black's reply, escape, flip.
- [x] P6c. Every control has an accessible name; dialogs trap focus and mark the page modal.

## P7 — content
- [x] P7a. All 22 shipped puzzles brute-force proven: solutions legal, 7 mate puzzles forced, 15 tactic
      puzzles win or threaten material or check.
- [x] P7b. No filler added: randomly generated puzzles were rejected as scrappy rather than shipped.

## Verification
- [x] 34-case per-case suite: 0 failures.
- [x] Whole-suite-in-one-page: 217 checks, 0 failures, 0 console errors.
- [x] Deployed build: 217 checks, 0 failures, 0 console errors.
- [x] iPhone emulation pass clean.

## Limits
- No listening test was possible for the audio; no physical iPhone; the bot is a heuristic minimax.
