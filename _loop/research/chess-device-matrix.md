# Chess device matrix — measured

Every row is a real headless Chrome session at that viewport with DPR 3 and touch enabled, driven
through the same flow: load, start screen, make a move by touch, resign, open Settings. Board size is
the rendered canvas in CSS pixels.

Reproduce: `_loop/tests/cdp-iphone.js <url> <shot> <width> <height>` (width and height were added to
the driver for this sweep).

| device | viewport | board | horizontal overflow | controls under 40px | console errors |
|---|---|---|---|---|---|
| iPhone SE (1st) | 320x568 | 268x268 | none | none | 0 |
| small Android | 360x640 | 340x340 | none | none | 0 |
| iPhone 8 | 375x667 | 359x359 | none | none | 0 |
| iPhone 14 | 390x844 | 374x374 | none | none | 0 |
| iPhone 11 Pro Max | 414x896 | 398x398 | none | none | 0 |
| iPad portrait | 768x1024 | 620x620 | none | none | 0 |
| iPad landscape | 1024x768 | 568x568 | none | none | 0 |

Landscape phones are covered separately (844x390 gives a 306px board, 932x430 gives 338px) and were
fixed in this loop: the board used to be 270px at 844x390 because the vertical chrome ate the height.

## Notes

- One sweep row (iPad portrait) failed to report and passed when re-run alone: seven sequential
  Chrome launches in one loop, one of them returned nothing parseable. Transient, not a defect.
- The board is widest on iPad portrait (620px) and narrowest on the oldest phone (268px), where it is
  still comfortably playable: 8 squares of 33.5px with 40px+ touch targets maintained for controls.
- **No physical device was used for any of this.** These are emulated metrics in headless Chrome; a
  real iPhone can differ in ways emulation does not capture (safe-area insets on notched models in
  landscape, Safari's own keyboard behaviour, actual GPU compositing). Safe-area support is present in
  the CSS and reported as active by the driver, but that is a claim about CSS, not about a handset.
