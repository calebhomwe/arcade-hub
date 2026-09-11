# Chess round 3 — sound, look, iPhone (final report)

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main) · Live: https://calebhomwe.github.io/arcade-hub/games/chess.html
Commits: 6f893a4 (pieces, sound bank, feel), a15e3b9 (iPhone pass)

## What you said
1. "these sounds suck so bad"  2. "the game needs to feel like the actual chess.com"
3. "for iPhone too"  4. "make the pawns better"  5. "use blender"  6. "improve this prompt"

## 1. The sound problem — two real bugs, both fixed
- A concurrent edit had swapped the audio mod for `chess-sfx-hd.js`, which fires **2-5 second** AI
  clips on every move. Removed from the loader.
- The other sound mod doubled every cue on top of the inline synth. Also removed.
- The new sample bank was **silently failing to decode**: it created its own AudioContext and then
  connected a node from it into the game's context, which throws (cross-context). It now shares the
  game's context — 14/14 clips decode and play.
- The bank itself: 14 short cues (move x2, capture x2, castle, check, promote, win, loss, illegal,
  low-time tick, game start, UI click/hover), trimmed from generated takes by onset detection with
  fades and -3.5 dBFS normalisation. A **Sound set** selector switches Natural / Crisp, remembered
  between visits, with a volume slider. The synth remains only as a fallback.
- Memes are now **opt-in** (they were firing by default, which meant an airhorn on every capture).

## 2. chess.com feel
- **Pieces are real 3D models**, built procedurally in Blender 5.2 and rendered to 12 transparent
  512px PNGs; the game alpha-crops them at runtime, baseline-aligns them and sizes them off the king
  so relative heights are right, each with a soft contact shadow.
- **Piece slide animation** (135ms ease-out), **capture fade**, and a **red radial glow** on a
  checked king.
- A **result dialog** in chess.com style: "You won / You lost / Draw", the result line, move count
  and opponent, with **Rematch / Review / Close**.
- Removed the arcade noise that broke the illusion: the XP bar, emoji piece faces, ghost trails,
  power-ups and eliminations are no longer loaded, and the juice default dropped from 50 to 15.

## 3. iPhone / mobile (measured, not assumed)
At 390x844, 430x932 and 844x390: no horizontal overflow; the landscape board was collapsing to
140px (a duplicate board-max variable ignored the breakpoints) — now 270px; 19 of 20 controls were
under the 44px touch target — now 1 (the juice slider, now 44px tall); the back link went from 16px
to 44px. Added `viewport-fit=cover`, safe-area padding, `dvh` sizing, and coarse-pointer sizing.

## 4. The pawns
The rendered pawn is a proper Staunton pawn — ball head, collar, stepped base — and the whole set is
taller in the square than before. Read the rendered PNGs and the in-game board screenshots back and
inspected them; the board image is in the commit.

## 5. Blender
`_loop/blender/build-pieces.py` builds six lathed profiles, lights them with a neutral studio rig,
renders both colours and can be re-run headlessly. The 12 PNGs ship in `games/assets/pieces/`.

## 6. The improved prompt
`_loop/research/chess-v3-brief.md` — the rewritten brief, including the non-negotiables and exactly
how each claim is proven.

## Verification
- Local suite: **83 checks, 0 failures**.
- Deployed build driven over CDP: **86 checks, 0 failures, 0 console errors**.
- Blender PNGs and in-game screenshots read back and inspected.
- Bank files HEAD-checked as served; generated audio re-parsed by its own verifier.

## Still open
- Nobody has listened to the bank with human ears — quality is machine-verified (onset, level,
  envelope, decoded playback) only.
- No physical iPhone was available; all device evidence is headless Chromium at exact CSS viewports.
