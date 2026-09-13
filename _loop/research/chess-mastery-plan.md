# Chess Mastery Loop — backlog

Approved plan. Iterate one item at a time: prove the gap → smallest correct fix → deterministic
suite case → verify locally (both modes) and on the deployed build → commit + ledger line.

Scope: games/chess.html + the mods/assets it loads + _loop test tooling.
State: this file (checkboxes) and chess-loop-ledger.md (append-only evidence).

## Protocol guardrails
- Prove the gap before fixing it (failing case, CDP number, or read-back screenshot).
- Never edit chess.html while a suite run is in flight (runner holds _loop/shots/suite.lock).
- Re-read the edit anchor, then read the code back after editing (a fix was silently reverted once).
- Measure performance only over CDP; virtual time reports 0 ms.
- Read-only subagents for audits; one writer (me) for the game.

## A. Bot quality
- [ ] A2b. KR vs K mating technique (drives to the edge but does not mate inside 80 plies).
- [x] A1. Opening book (prefix table per difficulty, legal-filtered, bot colour only).
- [x] A2. Endgame conversion term (KQ/KR/K+P vs K; mate within 60 plies at depth 2).
- [x] A3 Level separation measured. Easy was uniform-random (6431cp average loss, worst blunder 100459):
      it now runs a depth-1 search over near-best moves with a real miss chance. Measured over 24 sampled
      positions across three runs: easy gives away material on some moves, medium almost never does.
      NOTE: the metric separates easy from the other two but not medium from hard - extra depth shows
      over a game, not in an average loss against a depth-3 reference, so only the easy gap is claimed.

## B. Session integrity
- [x] B1. Save/resume: persist {version, moves[], mode, minutes, clocks, halfmove}, replay on load,
      wire the inert Resume button, clear on game end; real Page.reload proof.
- [x] B2. PGN import (paste box, header + SAN/coordinate parse, replay, then review).
- [x] B3. FEN load (validate, set position, clear error for garbage).

## C. Analysis parity
- [x] C1. Eval bar (clamped, driven by the deterministic grader, optional during play).
- [x] C2. Live move-quality tags reusing the same grader when coaching is on.
- [x] C3. Review accuracy % per side + click a row to jump to that position.
- [x] C4. Opening name table shown in the review.
- [x] C5. Puzzle quality screen: legality, solution quality (mover-POV), a tactic worth finding, and
      descriptions that tell the truth about what the position delivers. The screen is itself tested
      against five deliberately broken puzzles. All 22 bank puzzles pass; the one whose solution mated
      had a description that never said so, now fixed, and the bank's own type field (mate1/fork/pin/
      endgame/promotion) is finally shown to the player in the puzzle panel.

## D. Accessibility
- [x] D1. aria-live move/check/mate announcements + labelled board grid.
- [x] D2. Help overlay with shortcuts; focus never escapes dialogs; 40px+ targets.
- [x] D3. Colour-blind board variant: a blue/near-white pair with its own derived highlight colours,
      persisted in Settings. Measured in-page WCAG ratios: classic squares 2.88:1 -> high-contrast
      4.76:1 (bar 4.5), light pieces on the dark square 5.24:1, dark pieces on the light square 9.66:1,
      dark square blue-dominant so it survives deuteranopia and protanopia. Screenshot read back.

## E. Mobile / installability
- [x] E1. PWA: webmanifest + service worker + offline CDP proof.
- [x] E2. Landscape phone layout verified (844x390, 932x430).

## F. Feel, audio, content
- [ ] F1. Start-screen theme/piece preview.
- [x] F2. Settings sound-check button that plays every cue in order.
- [x] F3. Quiet-default audit (no bubble/meme/shake without opt-in).

## G. Performance & robustness
- [x] G1. Budget recorded and enforced: PERF_BUDGET lives in chess.html (8 lines with the measured
      value and headroom beside each), _loop/tests/cdp-perf.js measures them over CDP and fails when a
      line is exceeded, and _loop/research/chess-perf-budget.md records how to reproduce it. Measured:
      easy 0.87ms, medium 9.2ms, hard 94ms, endgame 2.6ms, frame 0.17ms, review 4.4ms/ply, 1.22MB over
      49 requests, DCL 366ms - all within budget. No phone hardware and no memory ceiling: unverified.
- [x] G2. 120-ply stress: no unbounded timers/listeners/DOM growth. The harness found the one real
      leak - 60 confetti divs surviving every finished game, because they were removed only by the
      animation finish event, which never fires for a cancelled animation. Fixed with a marker class,
      a per-particle backstop timeout, a sweep before each celebration and particles included in the
      reset cleanup. Node count after each reset: 849/909/969/994 -> flat 849/849/849/849, final count
      back at the 789 baseline. Listeners and timers were already clean and the heap shrinks.
      (The earlier pinpoint at the memes panel was an artifact of my own walker: repeated class-only
      paths collided. A collision-free histogram of the tree named the 60 bare divs instead.)
- [x] G3. Chaos fuzz: random input, zero uncaught errors.

## H. Hygiene
- [x] H1. Remove root z*.html debug scratch once unreferenced.
- [x] H2. Archive dead legacy mods; keep the not-loaded assertion.
- [ ] H3. Sign-off note so the hub's 240 paused queue tasks can resume.