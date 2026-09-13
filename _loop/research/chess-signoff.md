# Chess — sign-off

Written by the Chess Mastery Loop at the end of its backlog. Scope was games/chess.html and the
mods, assets and test tooling it uses.

## What the loop delivered

**Bot quality.** An opening book (40 positions, legal-filtered). An endgame conversion term so won
endings are actually won: king and queen mate in 11 plies, king and rook in 19, king and pawn
promotes and mates in 61 — all deterministic. The Easy level was uniform-random legal moves
(measured at 6431 centipawns of loss per move, worst blunder 100459); it now runs a depth-1 search
over near-best moves with a real miss chance, and the levels are separated by a measured blunder
rate rather than an assertion.

**Session integrity.** The game is saved and replayed after a reload (a real Page.reload proof, not
an in-page check), a PGN can be imported, and any position can be loaded from a FEN with eight
classes of invalid input refused before the board is touched.

**Analysis parity.** An evaluation bar, move-quality marks in the move list as you play, a review
with per-side accuracy and click-a-row-to-jump, and opening names in the review and the PGN.

**Accessibility.** Screen-reader move announcements ("White plays Qd5+. Check."), a controls panel
listing every shortcut, dialogs that trap focus, 40px+ targets, and a high-contrast board for
colour-blind players whose square contrast is measured at 4.76:1 against the classic 2.88:1.

**Mobile and installability.** A PWA with a manifest, icons and a service worker; offline play is
proven by cutting the network and reloading the real deployed site. Landscape phones get a 306px
board where they used to get 270px.

**Feel, audio, content.** Quiet by default: an audio spy installed before any page script shows
nothing is audible before a gesture, and memes, coaching and the evaluation bar are all off until
asked for. A sound-check button plays every cue in order so a human can judge them. The start screen
now offers the board and piece style with a live preview.

**Performance and robustness.** A published budget (nine lines, values and headroom beside each)
enforced over CDP: easy 0.67ms, medium 5.4ms, hard 59ms, rook ending 37ms, repaint 0.13ms, review
2.9ms per ply, 1.7MB over 49 requests, DCL 231ms. A chaos fuzz (1500 randomised interactions per
viewport) and a 120-ply stress test that found and fixed a real leak: 60 confetti nodes survived
every finished game because only the animation-finish event removed them.

**Hygiene.** Nine unreferenced debug pages removed, seven dead mods archived out of games/, and the
loop's own harness hardened (a throwing case used to abort the whole one-page run and hide
everything after it).

## Verification receipts

- In-page suite: 532 checks, both modes (per-case and all-cases-in-one-page), 0 failures.
- Deployed build: re-verified after every iteration; the final live run reports the same count as
  local with 0 console errors.
- Evidence per iteration is in chess-loop-ledger.md, one row each, including what was NOT verified.
- Reproducible tooling in _loop/tests/: run-fuzz.ps1, run-perf.ps1, run-swr.ps1, cdp-stress.js,
  cdp-offline.js, cdp-quiet.js, cdp-swr.js.

## Explicitly not verified (or abandoned, with the reason)

- **No physical device.** Every mobile claim is headless Chrome with device metrics emulation. No
  iPhone or Android hardware was used.
- **Performance numbers are desktop.** Headless Chrome with --disable-gpu on a desktop CPU; a
  mid-range phone will be several times slower, and only the headroom in the budget allows for it.
  No memory ceiling is budgeted.
- **Nobody has listened to the audio.** Machine tests prove each cue decodes, is levelled and is not
  silent; whether it sounds good is a human judgement, which is why the sound-check button exists.
- **One unreproduced race.** In one run out of many the memes mod had not exposed its API when a
  later check ran. It was seen once, never reproduced, and is now reported as a failed check instead
  of throwing.
- **The accuracy formula is mine**, not chess.com's, and the percentages are not comparable to it.
- **The engine is plain minimax** with hand-written heuristics: no quiescence search, no transposition
  table, and no comparison against a third-party engine.
- **Opening names are plain-English labels**, not ECO codes.
- **Contrast is computed from the CSS variables**, not sampled from rendered pixels; markers and
  arrows still use the theme accents and were not re-checked against the new squares.
- **A rule that refused moves leading to a third repetition was tried and removed**: it bought the
  rook ending by throwing a pawn away in a king-and-pawn ending.

## The hub queue

The four chess entries in _loop/queue.jsonl (ids 297-300) are all done. Nothing about chess blocks
the rest of the queue. _loop/PAUSE can be lifted by deleting that file when the other 36 games are
ready to resume.
