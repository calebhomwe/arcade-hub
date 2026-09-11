# Chess loop plan — sound + memes + refinement (round 2 status)

Objective (active goal): upgrade chess.html's audio, add a manifest-driven meme system with a
user-facing selector, and keep looping verified improvements until every box below is checked.

## A. Sound engine upgrade — DONE
- [x] A1. Layered, pitch-related cue design: capture gets chord tones that scale with the captured
      piece, check is a rising tension pair plus sub, mate a descending cadence, promote a four-note
      ascent, castle a double knock with air.
- [x] A2. Per-play detune/velocity jitter so repeats never machine-gun; every layer is independently
      guarded so one failure cannot silence the rest of a cue.
- [x] A3. SFX volume slider (persisted, keyboard accessible) independent of the juice slider.
- [x] A4. Respects the hub mute; every node-building path no-ops without an AudioContext.

## B. Meme system — DONE
- [x] B1. 7 packs / 54 clips loaded from games/audio/memes/manifest.json, inlined as catalog.js so it
      also works from file://, with fetch as the fallback. Lazy decode on first use.
- [x] B2. Fires on blunder, capture, check, checkmate, castle, promote, win, lose, draw, start, undo,
      hint and combo3.
- [x] B3. Selector panel: master toggle, per-pack checkbox, per-meme checkbox, preview per meme,
      per-pack "solo", All on/All off, volume, and a Rare/Normal/Chaos firing-rate selector.
- [x] B4. Everything persists in localStorage and is restored on reload; malformed/missing data
      degrades to an empty panel instead of throwing.
- [x] B5. Rate limiting (250ms/900ms/2600ms depending on the chosen rate).

## B2. Reaction captions — DONE
- [x] Four caption packs (Hype Squad, Rage Quit, Chess Nerd, Wholesome) with their own checkboxes,
      shown as a short flag over the board on the matching event.

## C. Verification — DONE
- [x] C1. window.__chessTest() now runs 55 checks across 15 cases; all green locally.
- [x] C2. Zero Uncaught / ERROR:CONSOLE after every change.
- [x] C3. Panel screenshots captured and inspected at phone width.
- [x] C4. The deployed GitHub Pages build is driven directly over CDP and passes the full suite.

## D. Refinement backlog — DONE
- [x] D1. Move list: re-renders only on ply-count change, keeps scroll position, row hover, tooltips.
- [x] D2. Focus trap + focus restore + shared modal scrim for every dialog.
- [x] D3. Clock: +2s increment per move, low (<=20s) and critical (<=10s) states, audible tick.
- [x] D4. Reduced-motion mode (auto-detected, manual Motion/Calm toggle) with an animation kill-switch.
- [x] D5. Perf guards: particle pool cap, text-pop cap, move-list render cache, timed frame/UI checks.
- [x] D6. Content pass: expanded bot taunts for all four personalities + rotating header subtitles.

## Open / not claimed
- Subjective audio quality has not been judged by a human ear; only levels, envelopes and node graphs
  are machine-verified.
- Real-device (physical phone) testing is not done; all browser evidence is headless Chromium.
- Two-bishops / bishop+knight mate playouts remain unverified from the earlier engine audit.
