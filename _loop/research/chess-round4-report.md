# Chess round 4 — refinement report

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main) · Live: https://calebhomwe.github.io/arcade-hub/games/chess.html
Commits: 3154a38, a95b7f5, be4463e

## What you called out, and what changed
1. "makes a meme sound each time i hover over something" - the pointerenter cue is GONE. Only clicks
   produce a UI sound now (there was never a meme on hover; it was the UI hover cue firing on every
   button the cursor crossed).
2. "the new pawns look rough" - the whole set was re-rendered in Blender at 512 TAA samples. The pawn
   is now a proper Staunton pawn: ball head about 50% of the base, a modelled collar, a tapered stem
   and a stepped base. Renders are grain-free, all pieces share one camera and one scale, and heights
   run pawn 288 < bishop 349 < knight 382 < rook 420 < queen 434 < king 466 px. The contact sheet was
   read back and inspected. Piece payload also dropped 1345 KB -> 260 KB (256px sprites).
3. "more refinement ... comparing to the real game" - the list below.

## Refinements shipped
- Sidebar rebuilt around a chess app's hierarchy: full-width New Game, an in-game action row (Hint,
  Coach, Flip, Undo, Clock), a panel row (Puzzle, Review, Stats, Settings, Resign), then the move list.
  Theme, opponent, style, sound set, volume, motion, memes and effects all moved into a Settings dialog.
- Every move in the list is clickable to replay that position. The full list stays visible, the
  previewed move is highlighted, and any board interaction returns to the live game.
- Resign added: ends the game through the result dialog ("You lost by resignation"), feeds the record
  and stats, and clears on the next game.
- Both squares of the last move are highlighted (chess.com does both; we only did the destination).
- Captured pieces render with the 3D art instead of Unicode glyphs; the move list has an empty state;
  the board chrome is neutral instead of a purple ring.
- Bug fix you reported: opening a puzzle dimmed the whole board, because the bottom sheet was treated
  as a modal. Sheets now have their own list - measured dimmed=false with the puzzle sheet open.

## Verification
- Local suite: **121 checks, 0 failures**.
- Deployed build driven over CDP: **121 checks, 0 failures, 0 console errors**, start screen present,
  settings host present, pawn sprite 18.2 KB (was 112.5 KB).
- Screenshots read back and inspected: board with the new pieces, start screen at 390x844, settings
  dialog, puzzle sheet, and the Blender contact sheet.

## Still open / honest notes
- The comparison-audit subagent died before writing its report, so the chess.com comparison was my own
  review of our screenshots against chess.com's patterns rather than an independent audit.
- No human ear has verified the audio; it stays machine-verified (decode, level, envelope).
- No physical iPhone was available; device evidence is headless Chromium at exact CSS viewports.
