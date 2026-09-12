# Chess hardening — report

Method unchanged: a fix only lands when a test proves the defect, and every claim below has the
command and the real output behind it.

## Defects found and fixed (this round)

### 1. Losing on time showed no result dialog
The clock-flag path set the result and redrew but never called showGameOver. Proof first: the
hardening case asserted the dialog was open after a flag and **failed**; it passes after the fix.
Badge unlocking was also missing on that path.

### 2. The engine could not see mate at the horizon (real strength bug)
`minimax` returned the static evaluation at depth 0 **before** checking for mate, so a mate delivered
on the last ply scored as material. In a position with a brute-force-proven forced mate in two, the
depth-3 search preferred grabbing a rook. Terminal detection now happens first, but only when the side
to move is actually in check, so the extra move generation is paid on very few leaves.
Measured: depth 2 = 8.6 ms, depth 3 = 34 ms (before: 4 ms / 30 ms; the naive reorder cost 30 ms at
depth 2 alone). After the fix the depth-3 search plays the proven mating move, the hint returns a mate
in one, and the bot takes mate in one.

### 3. Seven state leaks found by an independent callback audit
All seven were real; each now has a test that failed before and passes after (the `leaks` case, 15 checks):
- A move-list preview **survived a reset**, so the next board tap resurrected the abandoned game.
- A Learn-trap playback interval **kept playing into the new game** after a reset.
- A queued **premove fired into a new game**; the timer is now tracked and cancelled, and the move is
  re-derived from the live position before it plays (executeMove does not validate).
- **Previewing a move permanently killed the clock** (a preview sets gameOver on its copy).
- Achievement flags leaked between games.
- A mid-drag reset left dragState armed.
- The puzzle **Skip** timer was uncancellable and could re-enter puzzle mode after you left.

### 4. Two mod defects
- `chess-sfx-bank.useSet` never reassigned the catalogue URL, so switching to the crisp set re-fetched
  the natural one.
- `ChessMods.api` did not expose epTarget/castlingRights, so the coach silently analysed with undefined.

## Verified this round
- **Deep perft**: position 3 depth 5 = 674,624 and Kiwipete depth 4 = 4,085,603, both exact
  (4.7 M nodes). An independent worker reproduced perft 20/20 exact on the six standard positions
  (518,468 nodes) with its own parser and counter.
- **FIDE rules (rules2)**: mate on the hundredth halfmove beats the fifty-move draw; the repetition key
  includes castling rights and — correctly, per FIDE 9.2.2 — only counts an en passant target a pawn can
  actually take; en passant removes a checking pawn; a promotion can mate; castling is legal when only
  the rook is attacked.
- **Engine verification (independent worker, pinned to sha256 c4ef93e6)**: page minimax == full-width
  minimax == alpha-beta at depths 1-4 (32/32), mate in one found in 40/40 positions, 310-position
  legality fuzz with 0 illegal moves and 0 throws, evaluation symmetric to the bit (24 positions),
  the new leaf-mate rule scores 99699/99799/99899 at depths 1/2/3.
- **Race and flow hardening (hardening, 14 checks)**: undo during bot thinking, new game during bot
  thinking, premove promotion, rematch after resignation, review safety after all four kinds of ending.
- **Settings persistence across a real reload** (cdp-persist.js): theme, piece style, coordinates,
  coaching tips, flip, volume and sound set all survived Page.reload with zero console errors.
- **Self-play (selfplay)**: 243 plies across three games, all decided by checkmate, no repetition
  inside the opening, board invariants asserted on every ply and a FEN round-trip.

## Verification
- per-case suite: **0 failures** (41 cases)
- whole-suite-in-one-page: **305 checks, 0 failures**
- deployed build: **305 checks, 0 failures, 0 console errors**
- tooling: the suite runner now takes a lock file, clears stray headless browsers and writes a
  timestamped log, after two concurrent runs collided on the port and the log.

## Honest limits
- Perft goes to depth 4 on startpos/Kiwipete and depth 5 on position 3; deeper is minutes of CPU in JS.
- The search is still a plain minimax with material+PST evaluation: no quiescence, no transposition
  table, no third-party engine comparison. It is a game bot, not a rated engine.
- The callback audit did not reproduce in a browser; each fix was then proven by a test here.
- No listening test for audio; no physical iPhone; personality modifiers and the 'tricky' random branch
  are not covered by the engine fuzz.
