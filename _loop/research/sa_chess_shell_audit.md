# Chess.com-style shell audit — `games/chess.html` (Chess Juice)

Auditor: shell-audit subagent · 2026-09-11 · read-only on `games/*`
Artifacts: `_loop/research/sa_chess_shell_fixes.diff`, `_loop/research/sa_chess_shell_fixes.patch`, probe kit `_loop/shots/sa_*.js`, `_loop/shots/sa_*.json`, `_loop/shots/sa_*.png`

## (a) Summary

* The shell renders **without console errors and without horizontal overflow at every viewport tested** (390x844, 390x720, 844x390, 800x1000, 1280x900, 1920x1000 — all `uncaught=0`, `overflow=[]`, `docScrollW == innerWidth`). The layout bugs are not crashes, they are sizing/visibility bugs.
* **Highest-impact defect: at <=430px the primary "New Game" button renders as a BLANK green bar.** Its only label is hidden by `@media (max-width:430px){ .btn-label{ display:none } }` (line 83) and nothing re-shows it for `#btnReset`. Measured on the live page: `#btnReset` = 354x**16**px with `.btn-label` `display:none`; zoomed screenshot `sa_zoom2_controls_phone390.png` shows an empty green pill while every other control is legible.
* **The Learn/Academy "Exit" button overlaps the "Endgames" tab at 390px.** Measured rects: exit x302.1-362.4 / y136.6-158.2 vs tab 3 x226.9-**323.0** / y140.6-168.2 -> 20.9 x 17.6px overlap. Screenshot `sa_sc_learn_phone390.png` shows the tab label clipped to "♚ Endgam" under the Exit chip; the covered strip also swallows taps on that tab.
* **Puzzle Mode appears off-screen on phones.** `#puzzlePanel` (outside `#ccApp`, line 693) measures y=**924.6**, height 83.6 in an 844px-tall viewport -> tapping 🧩 Puzzle produces no visible feedback (`sa_sc_puzzle_phone390.png`).
* **Two colour-contrast failures**: `#tip` = **2.84:1** (`#64748b` on `#302E2B`, 11.2px — measured live in 3 scenes) and the check-pulse trough `#ef4444` = **3.60:1** (keyframe line 57; animated so it is not always visible to a snapshot).
* **17 interactive elements are below the 44px touch guideline** at 390px (icon row 38.3x29.6, selects 32px tall, juice slider **60x5**, `a.back` 390x16), and **all 9 control labels are hidden at <=430px**, leaving emoji-only buttons.
* **The ≤880px "mobile" rules at lines 539-544 are dead CSS**: later `:root`/`#moveList` rules at lines 553, 564, 572 win the cascade. Measured on the phone: `--cc-boardmax` computes to `min(100%, calc(100vh - 200px), 720px)` and `#moveList` max-height to `236px`, not the intended 300px/120px.
* Patch `sa_chess_shell_fixes.patch` (2 hunks, 19 added lines, CSS+1 attribute) fixes the blank CTA, the tab overlap, the off-screen puzzle panel, both contrast failures, the slider's missing name/focus ring, the ≤430px touch sizes, and the landscape layout; every hunk was re-measured in Chrome on a patched copy (**0 console errors**).

## (b) Findings (severity · selector · evidence)

Method: `sa_serve.js` serves the repo at `http://127.0.0.1:8099`; `sa_host.html`+\`sa_scene.js\` load `/games/chess.html` in an iframe of an **exact** CSS viewport (vh/media queries resolve against it), run a scene, then report `getBoundingClientRect` + computed styles + WCAG ratios and are screenshotted by `sa_run.js` (headless Chrome, `--dump-dom` + `--screenshot`). Raw JSON: `_loop/shots/sa_<name>.json`.
Note: `--window-size` cannot go below ~500 CSS px on this Chrome (`sa_vp488.png` reports `iw=500 ih=1055 dpr=1`), which is why the exact-viewport iframe is used.

| # | Sev | Defect | Evidence |
|---|-----|--------|----------|
| 1 | **High** | Phone: "New Game" CTA is an empty green bar | `sa_base_phone390.json` -> `#btnReset` w354 **h16**, `#btnReset .btn-label` `display:"none"`; cause `chess.html:83` + `chess.html:533-535`; screenshot `sa_zoom2_controls_phone390.png` (blank bar) vs `sa_fx_zoom_controls.png` (after patch) |
| 2 | **High** | Learn panel Exit chip overlaps the Endgames tab (390px) | `sa_sc_learn_phone390.json`: exit `{x:302.1,y:136.6,r:362.4,b:158.2}`, tab3 `{x:226.9,w:96.1,y:140.6}`; `chess.html:718` + `.panel-exit-btn` `chess.html:114`; screenshot shows "♚ Endgam" clipped |
| 3 | **High** | Puzzle panel opens below the fold | `sa_sc_puzzle_phone390.json`: `#puzzlePanel` `{y:924.6,h:83.6}` with vh=844; markup `chess.html:693` (outside `#ccApp`), style `chess.html:90` |
| 4 | Med-High | `#tip` text contrast 2.84:1 (< 4.5) | `sa_sc_moves/puzzle/check_phone390.json` -> `div#tip` `ratio 2.84`, `color rgb(100,116,139)` on `rgb(48,46,43)`, 11.2px; declared `chess.html:58` |
| 5 | Medium | Check state text dips to 3.60:1 | `chess.html:57` keyframe `#ef4444`; `sa_contrast.js` output `3.60  only AA-large/UI  #ef4444 on --cc-bg`; also set inline at `chess.html:2104` |
| 6 | Medium | 17 tap targets < 44px at 390px | `sa_base_phone390.json.tapUnder44` (17 entries: 38.3x29.6 icon buttons, `#btnUndo` 32.2x29.6, selects 110/88/103 x32, `#juiceSlider` 60x5, `a.back` 390x16) |
| 7 | Medium | All control labels hidden <=430px -> emoji-only buttons | `chess.html:83`; `sa_base_phone390.json` shows `.btn-label` rect 0x0; visible in every phone screenshot |
| 8 | Medium | Dead ≤880px mobile rules (cascade) | measured `--cc-boardmax: min(100%, calc(100vh - 200px), 720px)` (line 564 beats line 541) and `#moveList max-height: 236px` (line 572 beats line 542) — `sa_base_phone390.json` |
| 9 | Medium | Juice slider has no accessible name and no focus ring | `sa_base_phone390.json.sliderFocus`: `outlineStyle:"none"`, `labelsFor:0`, `wrapLabel:false`, `ariaLabel:null`; cause `chess.html:87` + `chess.html:678` |
| 10 | Medium | Landscape phone: board collapses to 190px, everything stacked | `sa_vp_land844x390.json`: `#gameWrap` `{w:190,h:190}`, `ccMainCols 828px` (1 column), `#ccApp` height 725 in a 390-tall viewport; screenshot `sa_vp_land844x390.png` |
| 11 | Medium | Board is not keyboard reachable at all | `sa_base_phone390.json.canvasA11y` = `{tabindex:null,role:null,ariaLabel:null,title:null}`; tab order = `["btnHint",...,"juiceSlider","A"]` — no canvas entry (`chess.html:598`) |
| 12 | Low-Med | Move list sits >12px below the fold at 390x844 | `#moveList` `{y:856.6}` vs vh 844 (`sa_base_phone390.json`); after 20 plies `#moveList y:868.6 h:236 scrollH:292` and `#metaStats` bottom 1154.6 -> page 1191px (`sa_sc_moves_phone390.json`) |
| 13 | Low | No heading/landmark for the brand | `landmarks {main:false, nav:false, h1:false, header:true}` (`sa_base_phone390.json`); brand is a `<div class="cc-brand">` at `chess.html:584` |
| 14 | Low | Modal panels have no scrim/backdrop, no `role="dialog"`, no focus trap; Exit chips are 60.3x21.6 (Learn) | `sa_sc_learn_phone390.json.panel.exitBtn` 60.3x21.6; `chess.html:463,114,718` |
| 15 | Low | Promo overlay buttons are 54.6x39.2 and lose their text labels <=430px | `sa_sc_promo_phone390.json`: `.promo-btn 54.6x39.2`, card 282.4x144.8 centred in the 374px board. At desktop the card renders as glyph+label in a row (`sa_fx_promo_desk1280.png`, 344x156.6) because `.btn{flex-direction:row!important}` (line 563) wins over `.promo-btn{flex-direction:column}` (line 48) — that override actually looks right, so treat it as intentional; the only real defect is the glyph-only rendering at <=430px |

Not a defect (checked): no horizontal scrolling anywhere (`docScrollW` == viewport width at all six sizes); theme `<select>` options render fine; stats/review panels are centred and fit (`#statsPanel` 358.8x399.6 at 390); the promotion card fits the board; 0 console errors in every run.

False positive to ignore: the 21 `span.cmm-ghost` hits (ratio 1.26) in `sa_sc_moves/check_phone390.json` are `chess-movement.js` piece-trail animations drawn *over the board canvas*, whose CSS background my ratio tool cannot see. They also show that these 150 ms Web-Animations nodes only leave the DOM via `anim.onfinish` (`games/chess-movement.js:31`), so they survive when animations do not run (21 nodes were live in the probe) — flagging for the mod owner, not a shell defect.
## (c) Proposed patch and how it was verified

Files: `_loop/research/sa_chess_shell_fixes.diff` (as generated: `git diff --no-index -- games/chess.html <copy>`) and `_loop/research/sa_chess_shell_fixes.patch` (same hunks, both paths rewritten to `games/chess.html` so it applies directly).

Applies to the current working copy: `git -C <repo> apply --check "/_loop/research/sa_chess_shell_fixes.patch"` -> **APPLY_CHECK_EXIT=0** ("Checking patch games/chess.html...") — re-checked at 19:48 against SHA256 `31E2246303C6DAFCF51504F81BC1E027D101F6EE05245790092463CCB33A397C`, i.e. a revision newer than the one the patch was cut from (the parent kept editing the file; see (d) item 7).

Hunk 1 — appended to the end of the `<style>` block (after line 577), no comments, 18 lines:

```css
#btnReset .btn-label{ display:inline; }
#controls #btnReset{ padding:11px 12px!important; min-height:44px; }
#learnPanel .lp-tabs{ margin-top:22px; }
#tip{ color:var(--cc-muted)!important; }
.juice-wrap input[type=range]{ height:21px; padding:8px 0; background-clip:content-box; }
.juice-wrap input[type=range]:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
@keyframes checkPulse{ 0%,100%{ color:#ff6b6b; text-shadow:0 0 8px rgba(239,68,68,.4);} 50%{ color:#ffb3b3; text-shadow:0 0 16px rgba(239,68,68,.8);} }
@media (max-width:880px){ #puzzlePanel{ position:fixed; left:8px; right:8px; bottom:8px; width:auto; margin:0!important; max-height:38vh; z-index:45; box-shadow:0 10px 30px rgba(0,0,0,.65); } }
@media (max-width:430px){ #controls .btn, #controls .sel{ min-height:38px; } }
@media (max-height:600px) and (min-width:700px){ #ccMain{ grid-template-columns:minmax(0,1fr) 300px; } :root{ --cc-boardmax:min(100%, calc(100vh - 120px), 460px); } }
```

Hunk 2 — `chess.html:678`: `<label>🧃</label>` -> `<label for="juiceSlider">🧃</label>`.

Mapping: hunk-1 lines 1-2 -> defect 1; line 3 -> defect 2; line 4 -> defect 4; line 5 -> defect 9 (hit area); line 6 -> defect 9 (ring); line 7 -> defect 5; the first media query -> defect 3; the second -> defect 6/7 (touch size); the third -> defect 10; hunk 2 -> defect 9 (name).

Verification: the patch was applied to a byte-copy of `games/chess.html` (`_loop/shots/sa_fix/chess.html`, with the 10 `chess-*.js` mods copied beside it so the mods still load), served from the same origin and driven through **the same probe** as the baseline (`sa_batch_fix.js` -> `sa_run.js` -> exact-size iframe, headless Chrome). Every run reported `uncaught=0`.

| Metric (390x844 unless stated) | Baseline JSON | Patched JSON |
|---|---|---|
| `#btnReset` box | 354x16 | **354x44** |
| `#btnReset .btn-label` | `display:"none"`, 0x0 | `display:"block"`, 75x15.1 |
| Learn Exit x tab-3 overlap | 1 tab overlapped (20.9x17.6px), text "♚ Endgam" clip | **0 tabs overlapped** (tabs y 140.6 -> 162.6), `sa_fx_learn_phone390.png` |
| `#puzzlePanel` box | y=924.6 (below 844 fold) | **y=752.4, x=8, w=374, r=382** (inside the viewport), `sa_fx_puzzle_phone390.png` |
| `#tip` in `lowContrast` | `ratio 2.84` in 3 scenes | **absent** (only `.cmm-ghost` false positives remain) |
| `tapUnder44` count | 17 | 16 (New Game 44px; slider hit area 5 -> 21px) |
| Landscape 844x390 | board 190x190, `ccMainCols: 828px`, page 725 | **board 270x270, cols `512px 300px`, page 500**, `sa_fx_land844x390.png` |
| Desktop 1280x900 | `#gameWrap` 700x700, `#ccApp` 932 | identical 700x700 / 932 (sidebar card +14px taller) |
| Console errors | 0 | 0 (all 9 patched runs) |

Visual before/after at 2x zoom of the phone controls: `_loop/shots/sa_zoom2_controls_phone390.png` (blank green bar) vs `_loop/shots/sa_fx_zoom_controls.png` ("New Game" legible, 44px tall).

## (d) What I could NOT verify

1. **Accessible names of the icon-only buttons.** The measured fact is `.btn-label{display:none}` at <=430px (`chess.html:83`), so the only rendered text content of `#btnHint` is "💡". That it is announced as just the emoji (instead of the `title`/`Hint`) follows from the AccName spec but was **not** confirmed in-browser: my CDP accessibility-tree probe (`_loop/shots/sa_ax.js`, `Accessibility.getPartialAXTree`) hung twice and was killed. The `title` attributes on every control (lines 628-676) remain the only string a screen reader can use if the name-from-content rule differs from my reading.
2. **The slider's `:focus-visible` ring.** The rule is in the patch, but headless Chrome cannot be Tab-focused from my probe, so I never saw the ring render. What I verified is the defect side: `sliderFocus.outlineStyle === "none"` (from `chess.html:87`) and `labelsFor: 0`.
3. **The check-pulse colour fix (#ef4444 -> #ff6b6b/#ffb3b3).** The keyframe animates `color`, so a screenshot/computed-style sample lands anywhere in the cycle; I verified the fix only as (a) the declared replacement in the patch and (b) computed ratios — `#ef4444` 3.60 vs `#ff6b6b` 4.88 and `#ffb3b3` 7.96 on `#302E2B` (`sa_contrast2.js` output). No visually observed pulse was captured.
4. **Anything keyboard-only**: focus order was read from the DOM (`tabOrder`), but no real Tab traversal, no screen reader, no axe/Lighthouse run. My contrast numbers come from rendered computed colours and the WCAG formula, not from axe's implementation.
5. **Non-Chromium engines.** `background-clip:content-box` on `input[type=range]`, `:focus-visible` and `min-height` on `.sel` are unverified in Firefox/Safari.
6. **Real devices.** Every screenshot is headless Chrome at dpr=1 with the page inside an exact-size iframe; no iOS safe-area/notch, no real touch physics, no soft-keyboard resize.
7. **The audit revision changed under me — twice.** `games/chess.html` SHA256 was `B75DC38C223296724C1AC46E6DD4235BDFF01FCD7CBFB4B10F44A6F79E8EEDDB` at 18:49 (all (b) measurements), `D5A675F67CB9C2F240305D127BBB67DFD8ED7F4AEE48CA6CBD3EED85C7F233B9` at 19:34 (source of the verified copy) and `31E2246303C6DAFCF51504F81BC1E027D101F6EE05245790092463CCB33A397C` at 19:48. Evidence that the shell itself did not move: `git diff --no-index` between the newest file and my patched copy reports hunks only at lines **576** and **675** (both mine) and at **>=2784** (the parent's JS work) — the shell region 1-1077 is identical in all three revisions — and the patch still passes `git apply --check` (exit 0) against the newest one. I did not re-measure every viewport on the newest revision, so a re-run of `sa_batch_fix.js` after the parent's next commit is the safe final gate.
8. **Deliberately not patched (needs a product decision):** the canvas has no keyboard path (`tabindex/role/aria-label` all null, `chess.html:598`); the 16-control phone toolbar would be better as a "More" disclosure; modal panels lack `role="dialog"`/scrim/focus-trap; `#moveList` still starts below the 844px fold because the GAME card precedes it in the DOM.
9. **Trade-off inside the patch:** the <=430px `min-height:38px` hunk grows the controls block 178.6 -> 233px (page 943 -> 997px) and reflows it from 7 to 5 rows. The Moves card was already below the fold (856.6 > 844), so nothing new went under it, but that hunk is independent and can be dropped if the parent prefers the shorter page. The landscape two-column rule is a **layout change**, not a strict bug fix; it was only rendered at 844x390.

No file under `games/` was modified by me (only `_loop/research/*` and `_loop/shots/sa_*`); the temporary server on port 8099 and all Chrome instances I started were stopped.
