# Goal: Arcade Juice Grind — 300 clean iterations

Iterate on EVERY game in the hub (38 games) for a total of 300 verified improvement
cycles. One cycle = one small, verified, committed improvement to one game.

Acceptance:
- After all 300: every game feels juicy (Kit-driven particles/SFX/combo/celebration),
  renders without console errors, plays on phone-first layout, persists best score.
- Every cycle: headless verify (zero console errors + non-blank screenshot) BEFORE commit.
- Failed verification => revert, mark blocked, next task. No broken game ships.

Queue: queue.jsonl (300 tasks: 37 games x 8 passes + 4 chess passes). Ledger: ledger.jsonl.
Runner contract: CONTRACT.md. Cron: scheduled task "ArcadeJuiceLoop". Kill-switch: _loop/PAUSE.
