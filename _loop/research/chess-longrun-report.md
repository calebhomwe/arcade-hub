# Chess long run — progress report

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main). Live: https://calebhomwe.github.io/arcade-hub/games/chess.html

## Done so far (this run)
- **iPhone emulation harness** (`_loop/tests/cdp-iphone.js` + `iphone-session.txt`): real Chrome with
  Emulation.setDeviceMetricsOverride (393x852, DPR 3), touch on, mobile UA, then drives the whole flow:
  start screen, Play, touch-to-move on the canvas, bot reply, resign, result dialog, PGN/FEN export,
  Settings. Latest run: no horizontal overflow, every control >= 40px tall, zero console errors.
- Fixed what that pass found: header brand button was 21px tall; the human player avatar was an empty
  box (the emoji was removed but never replaced); the icon rows wrapped raggedly.
- Fixed a desktop-only regression: the 6-column icon grid squeezed each button so narrow that the SVG
  icons shrank to zero width, so the sidebar showed labels with no icons. Now a 3-column grid with
  `flex:0 0 auto` icons and ellipsised labels; verified by screenshot at 1280x860.
- **Undo/redo state machine hardened**: undo after a resignation now reopens the game and closes the
  result dialog (it used to leave the dialog hanging over a live game); redo restores it. New
  `statemachine` case (11 checks).
- **Keyboard playthrough** verified end to end (select, move, black's reply, escape, flip) — 9 checks.
- **Performance measured for real** (CDP, no virtual time): drawBoard 0.06 ms, updateUI 0.005 ms,
  move generation 0.048 ms, bot at depth 2 5.3 ms. The suite's perf case now reports honestly that
  headless virtual time freezes performance.now() instead of asserting meaningless zeros.
- **Audio QA** (worker): all 82 referenced clips measured with two independent parsers; 13 re-trimmed
  (a late game-end cue, a 1.1s-late forge sting, sluggish move/capture heads, a long capture tail).
  The one unfixable item (a near-duplicate pair in the non-default crisp set) is documented.
- Commits: 9ba2b95 (iPhone + control grid), f02350b (audio QA).

## In flight
- **Knight re-sculpt** (worker, highest priority): rebuilding the horse head as a lofted Staunton
  profile with muzzle, ears, mane ridge and eye, then re-rendering the whole set and a board-size strip.

## Waiting on a quiet window
- The per-case suite must be re-run when no worker is writing piece PNGs and no edit is in flight; the
  last two runs were both invalidated by concurrent writes (25 NO_RESULT, then 25 failures), not by
  real regressions. The one-page suite was green at 188 checks before that.

## Still to do
- Integrate the new knight, regenerate the 256px sprites, re-verify in game.
- Puzzle mode, clock edge cases, content verification, a11y sweep.
- Final: both suite modes green, live CDP check, report.
