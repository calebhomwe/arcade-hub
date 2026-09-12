# Knight v3 — Staunton horse head rebuild

**Task:** owner feedback *"the horse look ugly btw, fix that"* — rebuild the knight
sculpture only, re-render the whole set with identical settings.
**Date:** 2026-09-12
**Status:** done; all machine checks pass.

---

## 1. What was wrong (v2)

From the inherited render (`_loop/blender/_old_w_knight.png`): the head was a rounded
blob with **one** tiny pointed ear, **no muzzle**, **no mane ridge** and **no eye**; the
neck was a fat, featureless stump. It read as "a pawn with a hat", not a horse.

## 2. What changed

Only the knight sculpture. The base profile (`knight_base_profile`) is untouched, so the
footprint and baseline are byte-for-byte the same family base.

`_loop/blender/build-pieces.py`

* Replaced the old `KNIGHT_SPINE` / `KNIGHT_MANE` / `ellipse_ring` code with:
  * `KNIGHT_KEYS` — 20 control points `(x, z, a, b, hw, pinch)`. The spine is the
    horse centreline in the side view; `a` is the in-plane reach toward the
    throat/jaw/chin, `b` toward the crest/mane/nose-bridge, `hw` the half-depth in Y.
    Because a lofted section reaches exactly `centre ± a|b` along the frame normal,
    **the key list is the horse outline** (length in x, height in z).
  * `spline_nd()` — clamped Catmull-Rom over the 6-tuples (8 samples/key → 153 sections).
  * `horse_section()` — asymmetric egg section with the crest pinched into a ridge.
  * `add_mane()` — a beaded tube whose centreline dives in and out of the crest, so it
    welds onto the neck as **one scalloped ridge** (6 scallops) instead of a separate fin.
  * `add_ear()` — two rounded wedge ears (base r 0.031, h 0.089), leaned back and splayed.
  * `carve_eye_sockets()` + `add_eyes()` — a shallow almond socket carved into the
    lofted head with a raised almond lens (0.030 × 0.017 × 0.015) on each flank.
* Knee of the design: the neck is **near-vertical** (tangent 76–88°) up to the throat and
  the whole bend happens at the poll, so the head sits horizontally on the neck — that
  kink is what reads as "horse" and not "swan".
* Added an `--outdir DIR` flag (fast iteration without touching the shipping dir).
* Disabled Blender's per-run stamp metadata (`use_stamp_*`) so two builds write
  **byte-identical PNGs** where the renderer is stable (see §6).

Camera, lights, materials, contact shadow, resolution and samples are **unchanged**.

## 3. Acceptance checklist

| # | requirement | how it reads in the render |
|---|---|---|
| 1 | muzzle forward (+X), slightly down, defined nose + jaw | blunt, bulbous muzzle at x≈0.48 pointing ~25° down; flat jaw line at z≈0.60 |
| 2 | curved neck, thick at the base, tapering into the head | neck spans 0.22 wide at the collar → 0.15 at the throatlatch |
| 3 | two ears, angled back, cones/wedges not spikes | two offset wedges at the poll (x 0.196 / 0.248), tips z≈0.82 |
| 4 | mane ridge with serrated/scalloped edge | 6 welded scallops down the crest from the poll to the collar |
| 5 | eye (indentation or raised almond) on the side of the head | carved socket + raised almond lens at (0.238, ±, 0.678) |
| 6 | standard lathed base, same footprint/baseline | unchanged `knight_base_profile`; baseline spread 0 px (§5) |

## 4. Deliverables

| path | what |
|---|---|
| `_loop/blender/build-pieces.py` | the knight rebuild + `--outdir` + deterministic metadata |
| `games/assets/pieces/{w,b}_{pawn,rook,knight,bishop,queen,king}.png` | 12 × 512×512 RGBA masters |
| `games/assets/pieces/_contact.png` | 1662×1010 contact sheet (V3) |
| `games/assets/pieces/_knight_study.png` | 1180×720 V2-old vs V3-new, plus a 2× head and the 50 px board-size pair |
| `_loop/blender/pieces.json` | cell 512 + bbox of all 12 |
| `_loop/blender/_boardstrip.png` | 624×368 pieces at board size on chess.com green + a 50/75/112/168 px knight ladder |
| `_loop/blender/renders-512/` | refreshed 512 masters (same bytes as the assets) |
| `_loop/blender/renders-256/` | 12 × 256 px copies (my own; **not** written into the game dir) |
| `_loop/blender/verify.log` | the verification transcript |
| `_loop/blender/make-study.mjs` | tool that builds the study, the board strip and the 256 px copies |
| `_loop/blender/_archive/assets-256-before-v3/` | the parent's previous 256 px assets, backed up |

### Knight bbox

```
v2 stored  [133,107,278,383]   383 px tall
v3 new     [115,100,317,390]   390 px tall   (spec: between bishop 349 and rook 421, ~380-400)
```

## 5. Verification receipts

Build (headless, default 512 EEVEE samples):

```
"…\Blender 5.2\blender.exe" -b -P build-pieces.py        # EXIT=0, 17.6 s
[pieces] camera frame: ortho_scale=1.1245  content 0.769 x 1.022 world units
[pieces] rendered w_pawn      1.65s     96056 bytes  coverage= 11.8%  bbox=[115, 202, 208, 288]
[pieces] rendered w_bishop    0.63s    106080 bytes  coverage= 14.1%  bbox=[115, 141, 208, 349]
[pieces] rendered w_knight    0.65s    124430 bytes  coverage= 20.3%  bbox=[115, 100, 317, 390]
[pieces] rendered w_rook      …       120705 bytes  coverage= 20.4%  bbox=[115,  69, 208, 421]
[pieces] rendered w_queen     …       123312 bytes  coverage= 19.7%  bbox=[115,  56, 208, 434]
[pieces] rendered w_king      …       125614 bytes  coverage= 21.6%  bbox=[115,  23, 208, 467]
… (b_* identical bboxes) …
[pieces] wrote …/_loop/blender/pieces.json
```

```
node verify-pieces.mjs games/assets/pieces          # VERIFY_EXIT=0
distinct files (sha256)   : 12 / 12
shared baseline spread    : 0 px  (limit 6)
white heights (px)        : pawn=288 < bishop=349 < knight=390 < rook=421 < queen=434 < king=467  -> increasing=true
flat-region grain (max)   : 0.546  (limit 1.2)
ERRORS   : none
```

The verifier checks PNG signature, IHDR 512×512, colour type 6, bit depth 8, alpha
coverage 4–70 % (**actual 11.8–21.6 %**), nothing touching the border
(**borderMax = 0** on all 12), 12 distinct sha256, shared baseline and the height order.

## 6. Determinism

```
two consecutive full builds, sha256 over the 12 files
byte-identical files: 10 / 12
pixel diff run-to-run:  w_rook   1 channel-value of Δ1 (1 pixel)
                        b_knight 1 channel-value of Δ1 (1 pixel)
                        all others: 0 differing bytes
```

So the build is **pixel-deterministic except for a single 1-LSB TAA sample** on the two
longest renders, and byte-deterministic once the PNG timestamp metadata is stripped
(that was the only reason two earlier runs differed).

## 7. What it looks like (honest read of the images)

* **512 px** (`w_knight.png`, `b_knight.png`): a horse head in profile on the family
  base — neck rising near-vertically, a kink at the poll, blunt muzzle forward and down,
  flat jaw line, a carved almond socket with a raised eye, two swept-back ears, and a
  row of six mane scallops down the back edge. The black piece carries the same read
  with a sheen highlight on the mane.
* **168 px / 112 px** (board strip): unmistakably a horse-headed knight; mane and ears
  are legible as shape, not noise.
* **50 px** (the size actually drawn): it reads as a horse-headed knight. The muzzle,
  poll and mane survive as silhouette; the individual scallops and the eye are ~1–2 px
  and merge into the edge. This is a large improvement over v2, whose head at 50 px was
  an undifferentiated hook.
* Residual imperfections I did **not** model: no nostrils, no mouth line, the mane
  lobes are uniform beads rather than individually carved locks, and the muzzle
  underside is fairly flat. None of them affects the silhouette read at board size.

## 8. Important: 512 vs 256 asset files

`games/assets/pieces/*.png` are **256×256** on disk (the parent down-scaled them at
01:46, after the 00:47 renders). `build-pieces.py` writes 512×512 straight into that
directory, so this task **replaced the 256 px files with fresh 512×512 masters** (the
originals are backed up in `_loop/blender/_archive/assets-256-before-v3/`). I did not
create any 256 px files in the game directory, per the brief — the parent's down-scale
step needs to run to regenerate them. I also refreshed `_loop/blender/renders-512/`, in
case the down-scale reads its masters from there.

## 9. Findings / caveats

1. **The inherited script does not reproduce the stored renders.** Running the
   unmodified `build-pieces.py` I received over the old knight gives
   `w_knight bbox [121,116,302,374]`; the stored/parent-verified PNG is
   `[133,107,278,383]`. The other five piece types match the stored set within 1 px of
   height. So the stored knight PNG predates the script revision I was handed. I
   re-rendered **all 12** pieces from the current script, so the shipped set is
   self-consistent; the non-knight pieces are visually unchanged.
2. **Family framing shifted 6 px.** Because the camera auto-frames the union of all
   pieces, widening the knight moved every sprite 6 px left in the 512 canvas
   (pawn x0 121 → 115). Heights, widths and the baseline are unchanged
   (pawn=288, bishop=349, rook=421, queen=434, king=467). Since the game draws the full
   512 canvas per piece, this is invisible in play.
3. **Could not verify in-browser.** I may not touch `games/chess.html` or
   `games/chess-*.js`, so I did not render the live board; board-size judgement was
   done from the saved sprites in `_boardstrip.png`. The parent should confirm the live
   board after down-scaling to 256.
4. The 256 px copies in `renders-256/` are mine (2× box downscale); they are **not** the
   parent's pipeline output and should be treated as previews only.

## 10. Re-run

```
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b -P _loop/blender/build-pieces.py
node _loop/blender/compose-contact.mjs  games/assets/pieces
node _loop/blender/make-study.mjs       games/assets/pieces _loop/blender/_old_w_knight.png _loop/blender/_old_b_knight.png
node _loop/blender/verify-pieces.mjs    games/assets/pieces
```

Fast iteration on the knight only (writes to `_loop/blender/iter/`):
```
blender.exe -b -P build-pieces.py -- --only w_knight,b_knight --samples 64 --outdir _loop/blender/iter
```
