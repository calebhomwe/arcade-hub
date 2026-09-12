# Independent engine verification - games/chess.html

- Date: 2026-09-12 (Australia/Perth)
- Verifier: delegated subagent (parent `session-5f3ee146-9c4e-498b-ab0d-925493bb9291`)
- Target: `C:\Users\caleb\AppData\Local\arcade-hub\games\chess.html` (read-only; **not modified by this task**)
- Revision verified (SHA-256): `c4ef93e602fbc103ac685bf3331c31b37586003d38ae092f5ca5ec914e080e3f` (stable across the run)
- Current file SHA-256 at report time: `C4EF93E602FBC103AC685BF3331C31B37586003D38AE092F5CA5EC914E080E3F` (unchanged)
- Verdict: **ALL CHECKS PASSED** on the verified revision. No engine bug found in perft, search, mate finding, move legality, or evaluation symmetry.

> `chess.html` is owned by the parent and was being edited while this task ran (see
> **Revisions and concurrent edits**). Every result below is pinned to the SHA-256 above; the
> harness records the file's hash immediately before and after evaluation and they matched.
> **If the file is edited again, re-run the repro command** to re-pin.

## What was verified, and how

The only external truth used was:

1. the six published standard Perft node counts, and
2. the rules of chess (mate = no legal reply + king attacked, symmetry = colour flip).

Everything else was my own code: my own FEN parser/formatter, my own recursive perft counter,
my own full-width minimax, my own alpha-beta, and my own RNG-driven position generators.
The page's generator/search/eval functions were driven **through the live page** in headless
Chrome via CDP. `games/chess.html` and the mods were not touched.

### Artifacts written

Under `_loop/tests/`:

- `engine-verify.js` - self-contained CDP harness: starts its own static server for the repo,
  launches headless Chrome, loads `/games/chess.html`, injects the in-page suite, records the
  chess.html SHA-256 before/after, writes `_loop/research/engine-verify-output.json`.
- `engine-verify-inpage.js` - the independent verification suite that runs inside the page.

Under `_loop/research/`:

- `engine-verify-output.json` - full raw machine-readable results.
- `engine-verification.md` - this report.

### Repro command

```
& 'C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe' ^
  'C:\Users\caleb\AppData\Local\arcade-hub\_loop\tests\engine-verify.js'
```

Real output (verified run):

```
URL=http://127.0.0.1:8470/games/chess.html
WALL_MS=5587
CHESS_SHA256=c4ef93e602fbc103ac685bf3331c31b37586003d38ae092f5ca5ec914e080e3f (stable)
ALL_PASS=true
OUTFILE=C:\Users\caleb\AppData\Local\arcade-hub\_loop\research\engine-verify-output.json
CONSOLE_ERRORS=0
```

Corroborating page self-test (the page ships its own perft case), run with the repo's
`serve8137.js` + `cdp-eval.js`:

```
& '...\node.exe' '...\_loop\tests\cdp-eval.js' 'http://127.0.0.1:8137/games/chess.html' \
  "JSON.stringify(window.__chessTest('perft'))" "" 4000
```

```
{"case":"perft","checks":[{"name":"perft matches the published counts for all six standard positions","ok":true,"detail":"518468 nodes in 1097ms"}],"pass":1,"fail":0,"ok":true}
CONSOLE_ERRORS=0
```

Note on the page's evaluation environment: contrary to the brief's warning, the page's
top-level `const` bindings **are** visible to `Runtime.evaluate` here
(`typeof PT/CL/PST/VAL === "object"`); function declarations are visible too. I did not rely
on that - the suite re-derives the numeric piece encoding and constants - so the result is
robust either way.

## 1. Perft (own FEN parser, own counter, page's generator)

My parser, my recursive counter, the page's `getAllLegalMoves` + `makeMove`.
**All 20 position/depth combinations matched the published counts exactly.**

| position | depth | got | published | ok |
|---|---:|---:|---:|:--:|
| startpos | 1 | 20 | 20 | PASS |
| startpos | 2 | 400 | 400 | PASS |
| startpos | 3 | 8902 | 8902 | PASS |
| startpos | 4 | 197281 | 197281 | PASS |
| kiwipete | 1 | 48 | 48 | PASS |
| kiwipete | 2 | 2039 | 2039 | PASS |
| kiwipete | 3 | 97862 | 97862 | PASS |
| position 3 | 1 | 14 | 14 | PASS |
| position 3 | 2 | 191 | 191 | PASS |
| position 3 | 3 | 2812 | 2812 | PASS |
| position 3 | 4 | 43238 | 43238 | PASS |
| position 4 | 1 | 6 | 6 | PASS |
| position 4 | 2 | 264 | 264 | PASS |
| position 4 | 3 | 9467 | 9467 | PASS |
| position 5 | 1 | 44 | 44 | PASS |
| position 5 | 2 | 1486 | 1486 | PASS |
| position 5 | 3 | 62379 | 62379 | PASS |
| position 6 | 1 | 46 | 46 | PASS |
| position 6 | 2 | 2079 | 2079 | PASS |
| position 6 | 3 | 89890 | 89890 | PASS |

Total nodes: **518468** (the page self-test reports the identical total). Runtime 1063 ms.
This confirms the promotion fix at the branching-factor level: position 5 depth 1 is 44
(four promotion moves, not one) and all six standard positions match.

## 2. Search soundness (alpha-beta vs full-width)

For each position/depth: the page's `minimax(board, d, -Inf, +Inf, ...)`, my independent
full-width minimax, and my independent alpha-beta were all computed. `findBestMove` was then
called at the same depth and its returned move re-scored with full-width.

My full-width/alpha-beta mirror the page's **current** terminal rule, including the depth-0
leaf checkmate test the parent added (a leaf whose side to move is in check and has no legal
reply scores as mate, not as material). Mirroring the terminal rule rather than assuming the
old one matters: an intermediate re-run flagged a false mismatch until the mirror was updated
(see **Revisions**).

**All 32/32 cases: page minimax == own full-width == own alpha-beta.**
`findBestMove`'s chosen move re-scored within the documented EPS=12 near-best tie margin in
32/32 cases. The non-zero diffs are
`findBestMove`'s intentional random tie-break among near-equal moves, not a search error.
Distribution of `|root - chosen|`: {"0":27,"10":5}.

| position | depth | page minimax | own full-width | own alpha-beta | all equal | findBestMove | child score | diff | <= EPS 12 |
|---|---:|---:|---:|---:|:--:|---|---:|---:|:--:|
| startpos | 1 | 50 | 50 | 50 | yes | `51-35` (d2d4) | 40 | 10 | yes |
| startpos | 2 | 0 | 0 | 0 | yes | `52-36` (e2e4) | -10 | 10 | yes |
| startpos | 3 | 50 | 50 | 50 | yes | `52-36` (e2e4) | 40 | 10 | yes |
| startpos | 4 | 0 | 0 | 0 | yes | `62-45` (g1f3) | 0 | 0 | yes |
| kiwipete | 1 | 415 | 415 | 415 | yes | `45-21` (f3f6) | 415 | 0 | yes |
| kiwipete | 2 | 60 | 60 | 60 | yes | `52-16` (e2a6) | 60 | 0 | yes |
| kiwipete | 3 | 370 | 370 | 370 | yes | `52-16` (e2a6) | 370 | 0 | yes |
| position 3 | 1 | 90 | 90 | 90 | yes | `33-37` (b4f4) | 90 | 0 | yes |
| position 3 | 2 | 90 | 90 | 90 | yes | `33-37` (b4f4) | 90 | 0 | yes |
| position 3 | 3 | 130 | 130 | 130 | yes | `33-37` (b4f4) | 130 | 0 | yes |
| position 3 | 4 | 10 | 10 | 10 | yes | `52-44` (e2e3) | 0 | 10 | yes |
| position 5 | 1 | 1095 | 1095 | 1095 | yes | `11-2=2` (d7c8=Q) | 1095 | 0 | yes |
| position 5 | 2 | 210 | 210 | 210 | yes | `11-2=2` (d7c8=Q) | 210 | 0 | yes |
| position 5 | 3 | 510 | 510 | 510 | yes | `11-2=3` (d7c8=R) | 510 | 0 | yes |
| position 6 | 1 | 310 | 310 | 310 | yes | `30-21` (g5f6) | 310 | 0 | yes |
| position 6 | 2 | 0 | 0 | 0 | yes | `30-21` (g5f6) | 0 | 0 | yes |
| position 6 | 3 | 210 | 210 | 210 | yes | `42-27` (c3d5) | 210 | 0 | yes |
| promotion | 1 | 880 | 880 | 880 | yes | `8-0=2` (a7a8=Q) | 880 | 0 | yes |
| promotion | 2 | 880 | 880 | 880 | yes | `8-0=2` (a7a8=Q) | 880 | 0 | yes |
| promotion | 3 | 905 | 905 | 905 | yes | `8-0=2` (a7a8=Q) | 905 | 0 | yes |
| endgame KPK | 1 | 160 | 160 | 160 | yes | `52-36` (e2e4) | 160 | 0 | yes |
| endgame KPK | 2 | 120 | 120 | 120 | yes | `52-44` (e2e3) | 120 | 0 | yes |
| endgame KPK | 3 | 150 | 150 | 150 | yes | `60-51` (e1d2) | 140 | 10 | yes |
| in check | 1 | 0 | 0 | 0 | yes | `60-52` (e1e2) | 0 | 0 | yes |
| in check | 2 | -10 | -10 | -10 | yes | `60-52` (e1e2) | -10 | 0 | yes |
| in check | 3 | 0 | 0 | 0 | yes | `60-52` (e1e2) | 0 | 0 | yes |
| mate in 1 | 1 | 99699 | 99699 | 99699 | yes | `56-0` (a1a8) | 99699 | 0 | yes |
| mate in 1 | 2 | 99799 | 99799 | 99799 | yes | `56-0` (a1a8) | 99799 | 0 | yes |
| mate in 1 | 3 | 99899 | 99899 | 99899 | yes | `56-0` (a1a8) | 99899 | 0 | yes |
| black to move | 1 | -100 | -100 | -100 | yes | `45-46` (f3g3) | -100 | 0 | yes |
| black to move | 2 | -110 | -110 | -110 | yes | `45-46` (f3g3) | -110 | 0 | yes |
| black to move | 3 | -850 | -850 | -850 | yes | `45-46` (f3g3) | -850 | 0 | yes |


Rows with a non-zero tie-break gap (all <= the engine's own EPS=12, so all still "near best"):

| FEN | depth | root score | chosen move | child score | diff |
|---|---:|---:|---|---:|---:|
| `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 1 | 50 | `51-35` (d2d4) | 40 | 10 |
| `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 2 | 0 | `52-36` (e2e4) | -10 | 10 |
| `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 3 | 50 | `52-36` (e2e4) | 40 | 10 |
| `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 4 | 10 | `52-44` (e2e3) | 0 | 10 |
| `8/8/8/4k3/8/8/4P3/4K3 w - - 0 1` | 3 | 150 | `60-51` (e1d2) | 140 | 10 |


Depth 4 was included for startpos and position 3; in both, page minimax == full-width ==
alpha-beta exactly (findBestMove could still pick a near-best move within EPS, as the table
shows for position 3 depth 4).

The mate-in-1 position now shows the leaf-mate rule doing its job: at depth 1 the page minimax
returns 99699 (mate value at the depth-0 leaf), exactly matching my full-width
and my alpha-beta, and `findBestMove` picks the mating rook move.

## 3. Mate finding

Mate-in-1 positions were **brute-forced with the page's own generator**: a position qualifies
only if some legal move leaves the opponent with zero legal moves *and* in check. 4 curated
known mates (Ra8#, Qxf7#, and two KQ mates) plus random biased sparse positions were combined
to 40 total. `findBestMove` was called at depth 2.

**All 40 mate-in-1 positions: `findBestMove` returned a mating move. 0 failures.**
Every returned move is in the brute-forced mating set (and therefore in `getAllLegalMoves`).

Selected rows:

| FEN | chosen move | # mating moves | result |
|---|---|---:|---|
| `6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1` | `56-0` (a1a8) | 1 | PASS |
| `7k/6Q1/6K1/8/8/8/8/8 w - - 0 1` | `14-7` (g7h8) | 6 | PASS |
| `6k1/8/6K1/8/8/8/8/7Q w - - 0 1` | `63-0` (h1a8) | 1 | PASS |
| `r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1` | `31-13` (h5f7) | 1 | PASS |
| `8/8/8/2K5/8/Q7/R7/1k6 w - - - -` | `40-49` (a3b2) | 1 | PASS |
| `8/p5P1/8/8/8/4K3/7Q/5k2 w - - - -` | `55-53` (h2f2) | 2 | PASS |
| `8/8/8/8/1K3p2/2Q5/R7/1k6 w - - - -` | `42-56` (c3a1) | 4 | PASS |
| `8/8/8/8/8/6Q1/6R1/1K5k w - - - -` | `54-62` (g2g1) | 4 | PASS |

All 40 tested positions (first four are the curated known mates; the rest were found by the
biased random generator, 2037 sparse-position attempts):

```
 1. `6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1` -> `56-0` a1a8 (mate moves: a1a8)
 2. `7k/6Q1/6K1/8/8/8/8/8 w - - 0 1` -> `14-7` g7h8 (mate moves: g7f8, g7h8, g7h7, g6f7, g6f6, g6h6)
 3. `6k1/8/6K1/8/8/8/8/7Q w - - 0 1` -> `63-0` h1a8 (mate moves: h1a8)
 4. `r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1` -> `31-13` h5f7 (mate moves: h5f7)
 5. `8/8/8/2K5/8/Q7/R7/1k6 w - - - -` -> `40-49` a3b2 (mate moves: a3b2)
 6. `8/p5P1/8/8/8/4K3/7Q/5k2 w - - - -` -> `55-53` h2f2 (mate moves: h2h1, h2f2)
 7. `8/8/8/8/1K3p2/2Q5/R7/1k6 w - - - -` -> `42-56` c3a1 (mate moves: c3b2, c3a1, c3c2, a2a1)
 8. `8/8/8/8/8/6Q1/6R1/1K5k w - - - -` -> `54-62` g2g1 (mate moves: g3h2, g3h3, g2g1, g2h2)
 9. `8/8/8/5K2/7k/7p/6Q1/8 w - - - -` -> `54-38` g2g4 (mate moves: g2g4, g2g5)
10. `6Q1/8/7k/5K2/8/8/8/8 w - - - -` -> `6-22` g8g6 (mate moves: g8g6, g8h8)
11. `k7/8/1QR5/4K3/8/8/8/8 w - - - -` -> `18-2` c6c8 (mate moves: c6c8)
12. `8/1K6/8/8/8/2R1Q3/8/3k4 w - - - -` -> `42-58` c3c1 (mate moves: c3c1)
13. `1k6/8/R1Q4K/8/5p2/8/3P4/8 w - - - -` -> `16-0` a6a8 (mate moves: a6a8)
14. `8/8/8/R7/2k1p3/4Q3/1K4P1/8 w - - - -` -> `44-42` e3c3 (mate moves: e3e4, e3c3)
15. `3k4/1Q2R3/K7/8/8/8/8/8 w - - - -` -> `9-10` b7c7 (mate moves: b7c7, b7d7)
16. `4k3/2Q3R1/1p6/8/8/1K6/8/8 w - - - -` -> `10-1` c7b8 (mate moves: c7b8, c7c8, c7e7, g7g8)
17. `4Q2R/P5k1/8/4K3/8/8/8/8 w - - - -` -> `4-6` e8g8 (mate moves: e8g8)
18. `5Q2/pK1kP3/8/8/8/8/8/8 w - - - -` -> `12-4=2` e7e8=Q (mate moves: e7e8=Q)
19. `8/8/8/7Q/8/4K1k1/3P3R/8 w - - - -` -> `31-47` h5h3 (mate moves: h5h4, h5h3)
20. `5Q2/2Pk4/4R3/8/2K5/8/8/8 w - - - -` -> `10-2=2` c7c8=Q (mate moves: c7c8=Q)
21. `8/8/5K2/7R/6k1/4P3/5Q2/8 w - - - -` -> `31-39` h5h4 (mate moves: h5h4)
22. `8/8/8/8/4p3/Q1K5/1R6/2k5 w - - - -` -> `40-56` a3a1 (mate moves: a3a1)
23. `8/P7/1k6/R2Q4/8/3p4/3K4/8 w - - - -` -> `8-0=5` a7a8=N (mate moves: a7a8=N)
24. `8/1Q2R3/3k3P/8/2K5/8/8/8 w - - - -` -> `9-10` b7c7 (mate moves: b7c7, b7d7)
25. `4k1K1/5R2/3Q4/8/8/8/8/8 w - - - -` -> `19-5` d6f8 (mate moves: f7f8, f7e7, d6b8, d6e7, d6f8, d6d7)
26. `8/1R6/2k3p1/Q7/4K3/8/8/8 w - - - -` -> `24-10` a5c7 (mate moves: a5b6, a5c7, a5d5)
27. `8/6K1/5Q2/6R1/7k/8/8/8 w - - - -` -> `21-23` f6h6 (mate moves: f6h6)
28. `8/4K3/1Q6/2R5/k7/8/8/8 w - - - -` -> `26-24` c5a5 (mate moves: c5a5)
29. `3R4/1k6/8/Q1K5/4p3/8/8/8 w - - - -` -> `24-17` a5b6 (mate moves: a5b6)
30. `1RQ5/k7/8/2p3K1/8/8/8/8 w - - - -` -> `2-9` c8b7 (mate moves: c8b7)
31. `8/8/8/5p2/8/K7/2k5/3RQ3 w - - - -` -> `60-51` e1d2 (mate moves: e1d2)
32. `5k2/1P1Q4/8/8/4K3/8/8/8 w - - - -` -> `9-1=3` b7b8=R (mate moves: b7b8=Q, b7b8=R)
33. `5K2/P7/8/8/8/2Q5/p3R3/3k4 w - - - -` -> `42-51` c3d2 (mate moves: c3d2, c3e1, c3c2, e2e1)
34. `8/2Q5/k7/1R4K1/8/8/8/8 w - - - -` -> `10-24` c7a5 (mate moves: c7b6, c7a5, c7b7, b5a5)
35. `8/8/8/3K4/2Q5/8/2Pk4/1R6 w - - - -` -> `34-43` c4d3 (mate moves: c4d3)
36. `8/8/8/P7/4K3/8/3RQ3/2k5 w - - - -` -> `52-60` e2e1 (mate moves: d2d1, e2d1, e2e1)
37. `8/8/8/8/Q7/2k5/K7/3R4 w - - - -` -> `32-41` a4b3 (mate moves: a4b3)
38. `8/8/8/8/8/5Q2/3K2R1/7k w - - - -` -> `45-47` f3h3 (mate moves: f3f1, f3h3)
39. `7Q/6R1/5k2/8/4K3/8/6p1/8 w - - - -` -> `7-23` h8h6 (mate moves: h8h6)
40. `8/8/8/4p3/8/2Pk1K2/1Q6/2R5 w - - - -` -> `49-52` b2e2 (mate moves: b2e2)
```

The search sees mate as mate: on the pure mate-in-1 position, page minimax scores depth 1: 99699, depth 2: 99799, depth 3: 99899.

## 4. Legality fuzz over random legal play

Random legal playouts (1-50 plies, page generator) produced 310 test positions.
At each, `findBestMove` was called and its move checked against `getAllLegalMoves`.

- depth 1: 250 positions, 0 illegal moves, 0 throws
- depth 2: 60 positions, 0 illegal moves, 0 throws
- Runtime: 745 ms

Failure lists are empty in both.

## 5. Evaluation sanity

- **Symmetry**: for 24 positions (startpos, Kiwipete, position 3, a promotion
  position, plus 20 random playout positions), `evaluate(b) + evaluate(mirror(b))` was exactly 0,
  where mirror flips the board 180 degrees and swaps every piece colour. 0 failures.
- **Material sign**: startpos evaluates to **0** (exactly balanced);
  white extra queen -> **895** (positive for White);
  black extra queen -> **-895** (negative for White).
  The two are exact negatives of each other, confirming sign handling.

## Revisions and concurrent edits

The parent owns and was actively editing `games/chess.html` during this task; the file hash
changed at least four times. Timeline observed:

1. First full pass (all green) was against hash
   `DDF7DDC3060E4AA194FFFEE91D33AF109D8D26DBC8F81D8F012B93CCA09FCF6A`, whose `minimax`
   returned `evaluate()` at depth 0 unconditionally.
2. The parent then added the depth-0 leaf checkmate test in `minimax` (comment around
   lines 1494-1504). My harness initially kept the old terminal assumption, so a re-run flagged
   one false mismatch: on `6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1` at depth 1 the page returned
   `99699` (= mate at the depth-0 leaf) while my stale full-width returned `180`. This was
   **not** an engine bug; the page's value is the correct mate score.
3. I updated my full-width/alpha-beta to mirror the new leaf rule, then re-ran. The file changed
   again during checks; the verified revision is `c4ef93e602fbc103ac685bf3331c31b37586003d38ae092f5ca5ec914e080e3f`, stable before/after evaluation.
4. At report time the file is `C4EF93E602FBC103AC685BF3331C31B37586003D38AE092F5CA5EC914E080E3F` (same revision).

Because of the concurrent edits, this report is authoritative only for `c4ef93e602fbc103ac685bf3331c31b37586003d38ae092f5ca5ec914e080e3f`.


## Independence / anti-circularity notes

- The FEN parser/formatter, the perft counter, the full-width minimax, the alpha-beta search,
  the mate detector, the random-position generators, and the symmetry mirror were all written
  from scratch in `engine-verify-inpage.js`; none call the page's perft/self-test code.
- The page's `getAllLegalMoves`/`makeMove` are necessarily shared - they are the object under
  test - but perft validates them against published node counts independently of search.
- No engine test uses an external engine. The external truths are the six published perft
  counts, the curated mate puzzles already present in the file, and chess rules.
- The page self-test's perft total (518468) equals this harness's independent total (518468).

## What was NOT tested

- No independent third-party engine (e.g. Stockfish) comparison; only published perft counts.
- Perft only to depth 4 (startpos / position 3) and depth 3 elsewhere; not depth 5-6.
- `findBestMove` search depth only up to 4, and only on 10 positions
  (32 position/depth cases). No quiescence exists in the engine, so
  horizon effects and quiet-move stand-pat are out of scope.
- The repeated-position / threefold-repetition tie-break logic in `findBestMove`
  (the `game.positionCounts` branch) was not exercised; the live game state may or may not have
  been visible in that scope. Only the score/legality behaviour was verified.
- Personality modifiers in `evaluate` (aggressive/defensive/tricky) were not tested for
  correctness or symmetry - only `personality === undefined`.
- The `tricky` 15% random non-capture branch of `findBestMove` was not exercised (personality
  was `undefined` throughout), so its legality was not asserted.
- The new leaf checkmate test's search cost was not benchmarked; correctness only.
- No UI, clock, puzzle, mod, audio, or rendering behaviour was tested.
- Castling-rights edge cases are covered statistically by Kiwipete/position-4 perft but not
  exhaustively; no test of a castling-rights update bug independent of perft.
- Promotions are covered by position 5 perft and a promotion search position; underpromotion
  correctness is only implied by perft, not directly asserted move-by-move.

## Raw result file

Full machine-readable results incl. every row above: `_loop/research/engine-verify-output.json`.
Top-level `all_pass`: **true**, `chessSha256Before`: `c4ef93e602fbc103ac685bf3331c31b37586003d38ae092f5ca5ec914e080e3f`, `hashStable`: true, `consoleErrors`: [], `total_ms`: 5573.
