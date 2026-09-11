# Chess game — improved brief (v3)

You asked me to improve the prompt. This is the rewritten brief I am building against; it is
written so that a stranger (or another agent) can execute it and check it.

## Goal
Make `games/chess.html` in the arcade-hub repo read and feel like a real chess app (chess.com class)
on desktop **and on iPhone**, with sound that a player would not turn off, and keep the arcade
personality behind opt-in switches.

## Non-negotiables
1. **Feel**: a tap or drag moves a piece with a short slide, the destination and origin highlight,
   the last move is marked, legality is always visible (dots for moves, rings for captures), the
   checked king glows red, and the game ends in a proper result dialog with Rematch / Review.
2. **Look**: real 3D-rendered Staunton pieces (built in Blender), correct relative sizes, sitting on
   their square with a soft shadow; a chess.com-green board with coordinate labels; no neon, no
   confetti on every capture, no XP bar, no power-ups in the default game.
3. **Sound**: short, dry, wood-on-wood samples for move and capture (with alternate takes so repeats
   differ), a distinct castle, a tense check, a rising promotion, win/loss cadences, a dry illegal
   thud, a low-time tick. Nothing longer than ~1.4 s; nothing fires twice; the player can pick the
   sound set and set its volume.
4. **iPhone**: works at 390x844 and 430x932 and landscape; uses `viewport-fit=cover`, safe-area
   insets and `dvh` so the iOS toolbars never clip the board; every control is at least 44x44 CSS px;
   no double-tap zoom, no accidental text selection, no page scroll while dragging; audio starts
   from a real touch.
5. **Start to finish**: new game -> play (bot or two-player) -> visible move list -> result dialog ->
   rematch, with settings (theme, sound set, volume, memes, motion) persisted between visits.
6. **Opt-in personality**: memes, party mode, celebratory effects and taunts stay available but
   default to off/quiet, and every one of them is switchable from inside the game.

## How each claim is proven
- `window.__chessTest()` ships inside the page and covers castling gestures, the engine, the move
  list, keyboard play, the clock, the results dialog, the sound bank (decode + play), the meme
  selector, motion preferences and performance guards.
- The deployed GitHub Pages build is driven directly over CDP and must pass the whole suite with
  zero console errors.
- Screenshots are read back and inspected at phone and desktop widths.
- Audio files are generated locally and re-parsed (format, level, envelope) by their own verifier.
- Blender renders are re-parsed (alpha coverage, baseline alignment, height order) and viewed.

## Explicitly out of scope
Copying chess.com assets, using their audio, or implementing engine-strength parity - this is a
look/feel and playability job, not a Fair-Play-rated engine.
