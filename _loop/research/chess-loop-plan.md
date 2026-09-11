# Chess loop plan — sound + memes + refinement

Objective (durable, matches the active goal):
Upgrade chess.html's audio, add a manifest-driven meme system with a user-facing selector,
and keep looping verified improvements until every acceptance box below is checked.

## A. Sound engine upgrade
- [ ] A1. Per-event sound design with musical pitch relationships (capture chord tones, check
      augmented tension, mate cadence in a minor key) instead of one-shot blips.
- [ ] A2. Layering: each chess event = body + transient + optional tail, mixed through the existing
      master gain/compressor, with per-play random detune so repeats never machine-gun.
- [ ] A3. Volume controls that do not fight the juice slider: SFX stays audible at juice 0, and a new
      SFX volume slider (persisted) is added.
- [ ] A4. Respect the global hub mute (localStorage 'gamesMuted') and never throw if AudioContext
      is unavailable.

## B. Meme system
- [ ] B1. games/audio/memes/manifest.json + WAV bank loaded lazily (never blocks the first paint).
- [ ] B2. Memes fire from chess events: blunder, capture, check, checkmate, castle, promote, win,
      lose, draw, start, undo, hint, combo3.
- [ ] B3. A "Memes" panel lists every pack with a checkbox and every meme inside it with its own
      checkbox, plus a preview button per meme and a master on/off.
- [ ] B4. The selection is persisted (localStorage) and restored on reload; malformed or missing
      manifest data degrades silently, never throws.
- [ ] B5. Meme playback is rate-limited (never more than one meme per N ms) so it stays funny.

## C. Verification (receipts required for every claim)
- [ ] C1. window.__chessTest() extended with audio + meme cases; full suite green in headless Chrome.
- [ ] C2. Zero Uncaught / ERROR:CONSOLE on the page after the change.
- [ ] C3. Screenshot of the selector panel at 390x844 read back and inspected.
- [ ] C4. Live GitHub Pages build fetched and contains the new features; suite re-run against it.

## D. Refinement backlog (loop until done, then re-evaluate)
- [ ] D1. Move-list polish: SAN quality, scroll-to-current, ply hover states.
- [ ] D2. Modal focus trap + scrim for every dialog; Escape closes the top-most only.
- [ ] D3. Clock UX: increment, low-time warning, clock state in the player strips.
- [ ] D4. Reduced-motion support that keeps the game playable.
- [ ] D5. Performance pass: decoded buffers capped, particle/DOM caps verified by measurement.
- [ ] D6. Content pass (queue task 300): more bot taunts/titles/funny subtitles.

## Rules
- One writer on games/chess.html (me). Subagents only produce files they own.
- Every cycle: verify in a real browser before commit; commit + push; verify the live build.
