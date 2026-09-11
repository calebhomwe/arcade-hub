# Chess — "finished game" checklist (round 6) — COMPLETE

Definition of done: a player can open the game, choose an opponent and time control, play a complete
game with every standard way to end it, share/export the result, review it, change how it looks and
sounds, and never hit a dead end or a rough edge on desktop or iPhone.

## A. Completing the games
- [x] A1. Draw offer: 2-player agrees immediately; the bot accepts unless it is up material
      (otherwise it declines on the tip line).
- [x] A2. Redo after undo, with a proper snapshot stack (a new move clears it).
- [x] A3. Premove while the bot thinks: pick a piece and destination, it plays the moment it is legal,
      and it is discarded with a warning if the reply makes it illegal. Blue highlight on both squares.
- [x] A4. Resign aborts cleanly (no result recorded) when no move has been made.

## B. Sharing and records
- [x] B1. PGN export with Event/Site/Date/White/Black/Result/TimeControl/Termination headers.
- [x] B2. Copy FEN of the live position (board, turn, castling, en passant, clocks).
- [x] B3. Clipboard buttons in Settings and Share PGN in the result dialog, with a fallback copy path
      and a visible confirmation.

## C. Board craft
- [x] C1. Right-drag arrows (yellow / shift red / alt blue), right-click square marks, long-press on
      touch, one click to clear.
- [x] C2. Piece style choice (3D renders / classic glyphs), persisted.
- [x] C3. Coordinate toggle and persisted board flip.
- [x] C4. Highlights all read from the theme palette (last move both squares, selection, check glow,
      premove, annotations).

## D. Polish that still read cheap
- [x] D1. The random mid-game tip line is opt-in and off by default.
- [x] D2. Result dialog: Rematch / Share PGN / Review / Close.
- [x] D3. Settings shows the current setup (time control, opponent, sound set, piece style).
- [x] D4. Emoji removed from the chess UI: 12 SVG line icons in the controls, SVG player avatars,
      the Party button swept too. Meme packs keep their emoji by design.

## E. Verification for every item
- [x] E1. window.__chessTest() is green: 29 cases / 161 checks locally, and on the deployed build.
- [x] E2. Zero Uncaught / ERROR:CONSOLE.
- [x] E3. Screenshots at phone and desktop read back and inspected (board at 2x, settings, start screen,
      puzzle sheet, contact sheet).
- [x] E4. Committed, pushed, and the live Pages build driven over CDP.

## Notes / limits
- Nobody has listened to the audio; quality is machine-verified only.
- No physical iPhone was tested; device evidence is headless Chromium at exact CSS viewports.
- The bot is a heuristic minimax, not a rated engine - deliberately out of scope.
