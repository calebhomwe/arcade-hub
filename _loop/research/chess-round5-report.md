# Chess round 5 — quality pass and memes done properly

Repo: C:\Users\caleb\AppData\Local\arcade-hub (main) · Live: https://calebhomwe.github.io/arcade-hub/games/chess.html
Commits: bf639e3 (crisp rendering, icons, speech), 0126fcc (meme bank v2), 1a8d51f (white pieces, spacing)

## Why it read low quality, and what was actually wrong
1. **Pieces were resampled twice** - 256px art was drawn into a 2x sprite canvas and then blitted
   down again. Rewritten to draw 1:1 at device resolution with high-quality smoothing.
2. **The level pass never reached the canvas.** After the rewrite the sprite still blitted the *raw*
   image, so only the outline silhouette was processed. The sprite now draws the processed source, and
   white pieces are white with grey shading instead of grey blobs. This was a real bug, caught by
   hashing the rendered crop and noticing it did not change.
3. **Pieces were oversized** (king at 104%, then 93% of the square) so ranks nearly touched. Now 88%
   with the base 7% above the square line - every piece sits in its square with a visible gap.
4. **Emoji icons** in every control. Replaced with monochrome inline SVG line icons that inherit the
   button colour; the pass also sweeps buttons injected later by mods, so 0 emoji remain in the
   control row (verified live).
5. Coordinate labels now fall back to the chess.com palette colours if a theme variable is missing.

## Memes, done properly
A worker audited all 54 clips, then fixed them:
- The 19 "forge" clips were raw 2-4 s model outputs; several were **clipping above 0 dBFS**
  (boing2 +2.89, cartoon_boom +2.96, sub_impact +2.72, slot_win +1.88) and one was 10 dB too quiet.
  All are now trimmed to their meaningful part (0.63-3.70 s) with fades and peak-normalised to -3.5 dBFS.
- All 35 synth clips were levelled by a single gain; 8 weak ones were regenerated with modal/FM/noise
  DSP (no bare sine beeps).
- **Voice is no longer faked**: the panel has "Spoken voice lines" driving the browser's real speech
  synthesis (with a Test button), persisted, gated on the meme master switch. The synthetic vowel pack
  is off by default.
- `catalog.js` (the file the game actually loads) was regenerated, because chess-memes.js prefers the
  inline catalogue and would otherwise have kept serving the old files.
- Two independent verifiers pass: 54/54 clips, no duplicate targets, correct format/level/duration.
- Bank folder trimmed 6.47 MB -> 5.45 MB by removing duplicate .bak copies.

## Verification
- Local suite: **105 checks, 0 failures** (adds a polish case: 10 icons present, labels intact,
  currentColor, touch sizing, speech support, voice toggle, voice test).
- Deployed build driven over CDP: **129 checks, 0 failures, 0 console errors**; 12 SVG icons and
  0 emoji left in the control row; speech available.
- Piece quality judged by capturing the board at 2x device pixel ratio and cropping to native pixels
  (screenshots in _loop/shots/dpr2.png, _loop/shots/dpr2_crop.png).

## Still open / honest limits
- Nobody has listened to the meme bank; quality is measured (duration, peak, RMS, onset, envelope) only.
- The regenerated/trimmed clips are imitations in spirit, not copies - stated by the worker, no audio
  was downloaded.
- No physical iPhone was tested; device evidence is headless Chromium at exact CSS viewports.
