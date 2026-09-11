# Chess — "finished game" checklist (round 6)

Definition of done: a player can open the game, choose an opponent and time control, play a complete
game with every standard way to end it, share/export the result, review it, change how it looks and
sounds, and never hit a dead end or a rough edge on desktop or iPhone.

## A. Completing the games
- [ ] A1. Draw offer (2-player: offer/accept/decline; vs bot: bot accepts when it is not winning).
- [ ] A2. Redo after undo (chess.com's takeback is one-way; a redo stack makes undo safe to explore).
- [ ] A3. Premove while the bot thinks (queue a move, play it the moment it is your turn).
- [ ] A4. Abort/resign parity: resign exists; abort a game with no moves made.

## B. Sharing and records
- [ ] B1. PGN export of the finished game (with headers: players, result, date, time control).
- [ ] B2. Copy FEN of the current position.
- [ ] B3. Share/copy buttons wired to the clipboard with a visible confirmation.

## C. Board craft
- [ ] C1. Right-click (desktop) / long-press (touch) arrows and square highlights.
- [ ] C2. A piece-set choice (3D renders / classic glyphs) that persists.
- [ ] C3. Coordinate toggle and persisted board flip.
- [ ] C4. Last-move, selection, check and premove highlights share one palette source.

## D. Polish that still reads cheap
- [ ] D1. Quiet the mid-game tip line (ask-on-demand instead of random noise).
- [ ] D2. Result dialog gains Share (PGN), Copy FEN and Rematch parity with chess.com.
- [ ] D3. Settings shows the current game facts (time control, opponent, sound set) at a glance.
- [ ] D4. Any remaining emoji or arcade leftovers inside the chess UI removed.

## E. Verification for every item
- [ ] E1. window.__chessTest() stays green, with a new case per feature added.
- [ ] E2. Zero Uncaught / ERROR:CONSOLE.
- [ ] E3. Screenshots at 390x844 and desktop read back and inspected.
- [ ] E4. Committed, pushed, and the live Pages build driven over CDP.
