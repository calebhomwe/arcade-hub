# Chess loop ledger

Append-only. One line per iteration: date | item | change | evidence | commit | not verified.

| date | item | change | evidence | commit | not verified |
|---|---|---|---|---|---|
| 2026-09-13 | B1 save/resume | persisted snapshot (base FEN + flagged move list + clocks), boot replay through executeMove with effects suppressed, Resume wired, cleared on game end | suite saveresume 17/17; per-case 0 fails; one-page 342 checks 0 fails; real Page.reload probe cdp-resume.js: 4 plies + identical FEN before/after, button "Resume", 0 console errors | 77b949f | live build verified: 342 checks, 0 failures, 0 console errors. Not stored: opponent mode/time (a resumed game uses the current settings) |
| 2026-09-13 | B2 PGN import | paste a PGN / move list in the review panel: headers, comments, NAGs, variations, results, SAN, coordinate notation, FEN header base, underpromotion; refused imports leave the game untouched, partial imports keep the readable prefix | suite pgpimport 14/14 | 69fcaf8 | live build verified: 356 checks, 0 failures, 0 console errors |