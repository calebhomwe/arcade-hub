# Chess refinement plan (round 4) — COMPLETE

Objective: compare against real chess.com, make ours better, and fix what the owner called out
(rough pawns, a hover sound that fired constantly, missing refinement).

## A. Owner callouts
- [x] A1. Hover sound removed (the pointerenter cue is gone; only clicks make a UI sound).
- [x] A2. The puzzle bottom sheet no longer dims the app (sheets have their own list; verified
      dimmed=false while the puzzle sheet is open).
- [x] A3. Blender pieces re-rendered: clean 512-TAA renders, a proper Staunton pawn (ball head,
      collar, tapered stem, stepped base), one camera/one scale, heights pawn 288 < bishop 349 <
      knight 382 < rook 420 < queen 434 < king 466 px.
- [x] A4. Contact sheet read back and inspected; the pawn is no longer rough.
- [x] A5. Piece payload cut 1345 KB -> 260 KB (256px sprites; 512 sources kept in
      _loop/blender/renders-512).

## B. Comparison-driven refinement
- [x] B1. Last move now highlights BOTH squares; board chrome neutral (was a purple ring).
- [x] B2. Pieces: baseline-aligned, sized off the king, soft contact shadow; captured pieces drawn
      with the 3D art instead of Unicode glyphs.
- [x] B3. Sidebar hierarchy: full-width New Game first, then an in-game action row (Hint, Coach,
      Flip, Undo, Clock) and a panel row (Puzzle, Review, Stats, Settings, Resign); theme, opponent,
      style, sound and effects all moved into a Settings dialog.
- [x] B4. Clocks keep low/critical states; the result dialog explains time losses and resignations.
- [x] B5. Move list: every move is clickable to replay that position (the full list stays visible, the
      previewed move is highlighted, any board interaction returns to the live game); empty state added.
- [x] B6. Start screen (opponents, time controls, Play/Resume) and a Resign action feeding the result
      dialog with Rematch / Review / Close.
- [x] B7. Arcade noise removed earlier (XP bar, faces, ghost trail, power-ups, eliminations).

## C. Verification
- [x] C1. window.__chessTest() is green at 121 checks locally and on the deployed build.
- [x] C2. Zero Uncaught / ERROR:CONSOLE on both.
- [x] C3. Screenshots at phone and desktop read back and inspected (board, start screen, settings,
      puzzle sheet, contact sheet).
- [x] C4. Committed and pushed; the live Pages build re-driven over CDP.

## Notes / not verified
- The comparison-audit subagent died before writing its report, so the comparison in B1-B7 is my own
  review of our screenshots against chess.com's known patterns, not that audit's findings.
- Nobody has listened to the audio; quality remains machine-verified only.
- No physical iPhone was tested; device evidence is headless Chromium at exact CSS viewports.
