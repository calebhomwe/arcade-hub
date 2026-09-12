# Chess — long autonomous run plan (4 hours)

Priority order, highest first. Every item needs browser evidence + a commit.

## P0 — the owner's callout
- [ ] P0a. Re-sculpt the knight: a real Staunton horse head (muzzle, ears, mane ridge, eye, curved
      neck) lofted from cross-sections, not a blob. Same camera/scale/baseline as the set.
- [ ] P0b. Read the new contact sheet back myself and confirm the knight reads as a horse head at
      board size (about 45-60 px) as well as at 512 px.
- [ ] P0c. Regenerate the 256px sprites from the new render and re-verify in game.

## P1 — piece set quality
- [ ] P1a. Proportion audit of all 12 pieces against Staunton references (heights, base widths, head
      sizes) with a second pair of eyes on a board-size strip.
- [ ] P1b. Consistent lighting/shadow across the set; no piece clipping its own base.
- [ ] P1c. Black pieces legible on dark squares (contrast measured, not eyeballed).

## P2 — audio QA
- [ ] P2a. Independent audit of the 14 chess cues and 54 meme clips: durations, peaks, onsets,
      silences, and any that would sound wrong (too long, too quiet, clicky, or silent).
- [ ] P2b. Fix whatever the audit flags; re-verify with two independent parsers.

## P3 — mobile / iPhone
- [ ] P3a. Emulated iPhone profile (touch, DPR 3, safe areas) end-to-end run: start screen -> play ->
      premove -> result dialog -> sharing, with no console errors.
- [ ] P3b. Every control >= 44px, no horizontal overflow, no iOS-specific trap left.

## P4 — UI polish
- [ ] P4a. Board-size screenshot audit at 390x844 and 1280x900: spacing, alignment, contrast.
- [ ] P4b. Any remaining arcade leftovers or inconsistent styling removed.

## P5 — gameplay gaps
- [ ] P5a. Clock UX: pause during the start screen, increment edge cases, "opponent thinking" state.
- [ ] P5b. Undo/redo across a bot move, undo after game over, redo cleared correctly.
- [ ] P5c. Puzzle mode: streak/history, no clock interference, exit restores a normal game.

## P6 — performance and accessibility
- [ ] P6a. Measure frame time while dragging and while the bot thinks at phone size.
- [ ] P6b. Keyboard-only playthrough of a whole game.
- [ ] P6c. Screen-reader sanity: labelled controls, live regions, focus order.

## P7 — content
- [ ] P7a. Verify every puzzle solution and every tip/quiz answer still checks out.
- [ ] P7b. Add worthwhile content only if a gap is identified (no filler).

## Rules
- One writer: me. Subagents own their own files.
- Verify locally in BOTH suite modes (per-case and whole-suite-in-one-page) and on the live build.
- Commit + push each batch; keep _loop/research/chess-longrun-report.md current.
