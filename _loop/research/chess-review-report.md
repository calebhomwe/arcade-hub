# Chess — review / analysis validation report

Method unchanged: a fix lands only when a test proves the defect, with a before/after receipt.

## Defects found and fixed

### 1. The review replayed every promotion as a queen
Snapshots only store \`{from,to}\`, so reconstruction inferred the rest — and for a promotion it always
chose a queen. An underpromoted knight was replayed as a queen, so **every position analysed after that
ply was a different game**. The promoted piece is now read from the board after the move.
Test: play an underpromotion, rebuild the review entries, assert the replayed piece is a knight.

### 2. Grading was non-deterministic
The grader called \`findBestMove\`, which (since the shuffle fix) randomly breaks ties among near-equal
moves, so the same move could be graded differently on two runs. The grader is now a deterministic
two-ply search that never touches the engine's tie-break.

### 3. A point-of-view bug I introduced while fixing (2), caught by the mirror test
My new grader computed values in the mover's point of view and then applied an extra colour test on
top, double-flipping Black: Black's best move scored -445 while a move that missed a free rook scored
+450, so Black's blunders graded "best". The colour-mirror test failed with the numbers printed
(\`white blunder / black best\`); after the fix both sides report identical values —
\`played 450 vs best 945, delta -495\` for both.

## Also done
- **Faithful replay proven** for castling, en passant and underpromotion: replaying the reconstructed
  moves from the snapshot reproduces the real board at every square, ply by ply.
- **No live-game mutation**: analysing every entry leaves the board, history length and result unchanged.
- **Known-answer grading**: taking a free rook = best; missing it = blunder (delta -495); mate = best.
- **Coach path validated** (5 checks): silent while coaching is off, warns "Careful - that piece can be
  taken." when a knight is placed where a pawn can take it undefended, silent for a safe developing
  move, and no throw on an en passant position. This exercises the mod API fields that were missing.
- The review refuses a game with no moves, and every ply of a real game carries a documented tag.

## Verification
- per-case suite: **0 failures** (43 cases)
- whole-suite-in-one-page: **325 checks, 0 failures**
- deployed build: **325 checks, 0 failures, 0 console errors**

## Incident worth knowing: a concurrent writer is editing chess.html
During this round my point-of-view fix was applied, then the file on disk reverted to an older
revision that still had it absent (the code read back as the pre-fix version). I detected it by
reading the function rather than trusting the edit, re-applied the change, verified it by grep, and
committed immediately. Earlier warnings of the same kind: \`_bothsuites.ps1\` vanished, and the file's
mtime moved while no tool of mine was writing. Nothing is broken now — the committed revision is
correct — but **two writers on one file will keep causing this**, and any work of mine that is not
committed is at risk.

## Honest limits
- The grader is a two-ply static-evaluation search, not a real analyser: it will not find deep
  tactics, and its tags are only as good as material + piece-square tables.
- The colour-mirror test proves symmetry of the grader, not that its thresholds match chess.com's.
- The coach test asserts the warning appears for one constructed hanging piece; it does not enumerate
  every tactical pattern the mod might mis-classify.
- Timings were taken under headless virtual time in the suite (where performance.now does not advance);
  the honest numbers come from the separate CDP runs recorded in earlier reports.
