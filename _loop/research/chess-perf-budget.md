# Chess performance budget

Measured over CDP in headless Chrome on this machine, because the in-page suite runs under virtual
time where every duration reports 0 ms (see the loop guardrails). The table the driver enforces lives
in the game itself, as `PERF_BUDGET` in games/chess.html, so the budget is visible next to the code it
constrains and cannot drift away from it.

Reproduce:

    pwsh -File "_loop/tests/run-perf.ps1"     # or: node _loop/tests/cdp-perf.js <url>

## Measured (worst of three runs) and the enforced line

| what | measured | budget | headroom |
|---|---|---|---|
| easy bot move (depth 1, near-best window) | 0.87 ms | 5 ms | 5.7x |
| medium bot move (depth 2) | 9.2 ms | 30 ms | 3.3x |
| hard bot move (depth 3) | 94.0 ms | 250 ms | 2.7x |
| endgame move (few pieces, depth raised to 4) | 2.6 ms | 60 ms | 23x |
| one full board repaint (`draw()`) | 0.17 ms | 4 ms | 24x |
| review grading, per ply | 4.4 ms | 15 ms | 3.4x |
| page load transferred bytes | 1.22 MB / 49 requests | 2.5 MB | 2x |
| DOMContentLoaded | 366 ms | 2500 ms | 6.8x |

## Notes

- The endgame line is the interesting one: raising the search depth when few pieces remain costs
  almost nothing (2.6 ms) because the branching factor collapses, which is why the conversion term
  could be made reliable without a latency price.
- The hard level at 94 ms is the only number a player can feel. It is deliberate: a quarter second
  of thinking reads as thought rather than lag, and it is nowhere near the budget.
- Review grading is linear in plies: a 60-ply game costs roughly 265 ms in total, once, on demand.
- Load bytes are dominated by the piece art and the sound bank; the service worker precaches them
  after load rather than blocking first paint.
- The bot-move numbers are measured on a middlegame position; the opening is faster because the book
  answers immediately, and the endgame is faster still because the trees are small.

## What this budget does not cover

- No measurement on a real phone: all numbers are headless Chrome with `--disable-gpu` on a desktop
  CPU. A mid-range phone will be several times slower; the headroom above is the allowance for that,
  and it has not been verified on hardware.
- No memory ceiling: only time and bytes are budgeted.
