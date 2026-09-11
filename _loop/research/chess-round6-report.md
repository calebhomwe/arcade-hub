# Chess round 6 — the game is finished

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main) · Live: https://calebhomwe.github.io/arcade-hub/games/chess.html
Commits: 9e162aa (draw/redo/abort/PGN/FEN/annotations/board options), 1ca27ee (premove), 7d02a36 (click
handling, SVG avatars, emoji sweep)

## What "finished" meant, and how each item was closed
- **Draw offer** - a Draw button; 2-player agrees at once, the bot accepts unless it is up material and
  otherwise declines on the tip line.
- **Redo** - a real snapshot stack behind Undo. The first implementation aliased the move array (pop()
  mutates in place) so redo restored nothing; the suite caught it and the snapshot is now copied.
- **Abort** - Resign with no moves played aborts instead of recording a loss, and the exported PGN
  shows Result "*".
- **PGN / FEN sharing** - PGN with full headers and the played moves; FEN built from the live board,
  turn, castling rights, en-passant square and clocks; Share PGN in the result dialog, Copy FEN / Copy
  PGN in Settings, with a clipboard fallback.
- **Board annotations** - right-drag draws arrows (shift red, alt blue), right-click marks a square,
  long-press does it on touch, and a single click clears everything.
- **Premove** - while the bot thinks you can queue one move; it plays the moment it is legal, is
  discarded with a warning if the reply makes it illegal, and is highlighted in blue.
- **Board options** - coordinates toggle, persisted flip, 3D/Classic piece style, opt-in coaching tips
  (off by default so no random tips appear mid-game), and a Settings line showing the current setup.
- **Emoji sweep** - 12 SVG line icons in the control rows, SVG player avatars, and the mod-injected
  Party button is swept too. Nothing in the chess UI uses emoji any more.

## A real bug the live suite caught
A click that cleared board annotations returned before it ended a move preview, so on the deployed
build two preview checks failed. The click handler now clears annotations and ends the preview in one
go. This is exactly why the suite is run against the live build and not just locally.

## Verification
- Local: **29 cases / 161 checks, 0 failures**.
- Live (deployed build, driven over CDP): 159 passes with the two preview failures above; after the
  fix the same run is green (see the final live check in the session).
- Browsers: headless Chromium at 390x844, 430x932, 844x390 and 1280x900; board inspected at 2x DPR.

## Limits (stated, not hidden)
- Nobody has listened to the audio; it is machine-verified (decode, level, envelope).
- The bot is a heuristic minimax, not a rated engine.
- No physical iPhone was used.
## The second live-only failure (found after the report above)
Running the whole suite in ONE page - which is how the live build is checked - exposed a real bug the
per-case runner had hidden: a right-click (or long-press) annotation was committed and then instantly
erased, because the document-level pointerup fallback (which exists so a tap always resolves) called
handleClick, whose first act is to clear annotations. The per-case runner masked it because a previous
case happened to leave dragState set, so endDrag ran instead. The fallback now ignores right-button
presses and any in-flight annotation gesture, and a new game clears annotations too. Verified in both
suite modes (163 checks each, 0 failures) and on the deployed build (163 passes, 0 console errors).
