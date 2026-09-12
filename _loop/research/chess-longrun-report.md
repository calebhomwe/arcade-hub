# Chess long run — final report

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main). Live: https://calebhomwe.github.io/arcade-hub/games/chess.html

## The owner's callout: the knight
The horse was a blob with one spike of an ear. It is now built by lofting a 20-point spine into 153
asymmetric elliptical sections: a blunt forward-and-down muzzle, a flat jaw, two swept-back ear wedges,
a six-scallop beaded mane welded down the crest, and a carved almond eye with a raised lens. The neck's
bend sits at the poll, which is what stops it reading as a swan. Base, camera, lights, materials and
samples are unchanged, so the family stays consistent:

    heights  pawn 288 < bishop 349 < knight 390 < rook 421 < queen 434 < king 467 px
    12/12 PNGs 512x512 type-6 RGBA, 12 distinct hashes, nothing on the border, baseline spread 0

I read the study sheet and the board strip back myself, then confirmed it on a real board at 2x DPR and
at shipping size: it reads as a horse head (muzzle, poll, ears, mane survive as silhouette at 50px).
Shipping copies regenerated at 256px: 1345 KB -> 262 KB.

## Also done this run
- **iPhone emulation harness** (`_loop/tests/cdp-iphone.js`): real Chrome emulating 393x852, DPR 3,
  touch on, mobile UA, driving start screen -> Play -> touch-to-move -> bot reply -> resign -> result
  dialog -> PGN/FEN -> Settings. Final run: every control >= 40px, no horizontal overflow, 0 console errors.
- Fixed what it found: a 21px-tall header button, an empty player-avatar box (emoji removed, SVG never
  added), ragged icon-row wrapping, and (later) move-nav buttons at 24px.
- Fixed a desktop regression: the 6-column icon grid squeezed buttons so narrow the SVG icons shrank to
  zero width, so desktop showed labels with no icons. Now 3 columns with protected icons.
- **Undo/redo state machine**: undo after a resignation reopens the game and closes the result dialog
  (it used to leave the dialog over a live game); redo restores it.
- **Move-list stepping**: previous/next controls with correct disabled states and 44px touch targets.
- **Puzzle mode bug**: the 1.5s "next puzzle" timer was never cancelled, so leaving a puzzle or starting
  a new game could still have a puzzle dropped on you. Tracked and cleared now.
- **Puzzle set proven**: a new `puzzlefacts` case brute-forces all 22 puzzles - every stated solution is
  legal (including the two castling ones), all 7 mate puzzles are forced mates, all 15 tactic puzzles
  win or threaten real material or give check.
- **Coach mod de-arcaded**: it dropped "SHEEESH" bubbles with a purple glow and an emoji head over the
  board by default. It is now opt-in via the Coaching tips switch, styled as a quiet neutral note, with
  informative lines.
- **Audio QA** (worker): all 82 referenced clips measured with two independent parsers, 13 re-trimmed.
- **Accessibility**: every control has an accessible name (icon-only buttons on phones included).
- **Performance measured for real** (no virtual clock): drawBoard 0.06 ms, updateUI 0.005 ms, move
  generation 0.048 ms, bot depth 2 5.3 ms.

## Verification
- Per-case suite: **0 failures**, 34 cases.
- Whole-suite-in-one-page: **217 checks, 0 failures, 0 console errors**.
- Deployed build over CDP: **217 checks, 0 failures, 0 console errors**.
- Emulated iPhone 393x852 DPR 3: full flow, no small targets, no overflow, 0 errors.
- Board inspected at 2x DPR and at shipping size; desktop at 1280x860; contact sheet + knight study read back.

## Honest limits
- Nobody has listened to the audio; it is machine-verified (duration, peak, RMS, onset, silence, correlation).
- The bot is a heuristic minimax, not a rated engine.
- No physical iPhone was used; device evidence is Chrome device emulation.
- The final CSS touch-target commit was verified locally (iPhone pass, preview case, desktop screenshot)
  and is in the last live check reported in the session.
