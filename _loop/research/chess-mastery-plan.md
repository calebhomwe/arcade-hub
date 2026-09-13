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
- [ ] D3. Colour-blind board variant (contrast measured).

## E. Mobile / installability
- [x] E1. PWA: webmanifest + service worker + offline CDP proof.
- [x] E2. Landscape phone layout verified (844x390, 932x430).

## F. Feel, audio, content
- [ ] F1. Start-screen theme/piece preview.
- [x] F2. Settings sound-check button that plays every cue in order.
- [x] F3. Quiet-default audit (no bubble/meme/shake without opt-in).

## G. Performance & robustness
- [ ] G1. Budget recorded and enforced (frame, bot move, review, load bytes).
- [ ] G2. 120-ply stress: no unbounded timers/listeners/DOM growth.
- [x] G3. Chaos fuzz: random input, zero uncaught errors.

## H. Hygiene
- [x] H1. Remove root z*.html debug scratch once unreferenced.
- [x] H2. Archive dead legacy mods; keep the not-loaded assertion.
- [ ] H3. Sign-off note so the hub's 240 paused queue tasks can resume.