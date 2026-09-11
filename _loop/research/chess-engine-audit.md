# Chess engine audit - games/chess.html ("Chess Juice")

Revision audited (frozen byte copy kept at `_loop/shots/engfix-snapshot.html`):

    games/chess.html  185803 bytes  mtime 2026-09-11 18:54:15
    sha256 C28DEDD0CAEA06BC90A8B546A43C226AA7C793E5E4FC203A3AD7724DD3D97E8F

Revision drift while I worked: the live file at 19:11 is sha256 E4F221075F26CAD666AFE046EF91BB78B9D0316B34200287374BCD8D6C621302 (186322 bytes, mtime 19:08:41). That edit touches only input/UI code (getSquareFromEvent, handleClick, hidePromoUI, promo buttons, doBotMove, loadPuzzle, resetGame, undo, startDrag/endDrag, canvas pointerdown). All 8 diffs were re-checked against that newer file at 19:11 and still apply cleanly (git apply --check exit 0), and no edited hunk lands in an engine function - so every finding below still applies to the live file as of 19:11.

All 8 patch files were re-checked with `git apply --check` against the live games/chess.html at 19:05 and all
still apply cleanly (exit 0). Nothing here required editing games/chess.html or games/*.js - every test ran on copies.

## (a) Summary

**The move generator is correct.** The page's own engine reproduces every standard perft value I could run,
including the two classic divergences (castling and en passant):

| position | perft(1) | perft(2) | perft(3) | perft(4) | perft(5) |
|---|---|---|---|---|---|
| startpos | 20 | 400 | 8902 | 197281 | 4865609 |
| Kiwipete r3k2r/p1ppqpb1/... | 48 | 2039 | 97862 | 4085603 | not run |
| CPW pos3 (ep pins) 8/2p5/3p4/KP5r/... | 14 | 191 | 2812 | 43238 | 674624 |
| CPW pos4 (promo+castle) r3k2r/Pppp1ppp/... | 6 | 264 | 9467 | 422333 | 15833292 |
| CPW pos5 (promo pins) rnbq1k1r/pp1Pbppp/... | 44 | 1486 | 62379 | 2103487 | not run |
| CPW pos6 (quiet) r4rk1/1pp1qppp/... | 46 | 2079 | 89890 | 3894594 | not run |

Every row came back `ok [true,true,true,true,true]` (node engine-extract.js --perft-max=5, output kept in
`perft5-snap.txt`). Because perft(4)/perft(5) are exact - including Kiwipete depth 4, the standard castling +
en-passant torture test - **castling, en passant, promotion, check evasion and pinned-piece legality are all
correct at the move-generator level.**

Everything that is *not* the move generator has real defects. Six findings, none fatal to play:

| # | severity | finding |
|---|---|---|
| F1 | Medium | `reconstructReviewMove` mis-tags an ordinary king move to g1/c1/g8/c8 as castling, so Review analyses a corrupted board (rook teleports h1->f1 / a1->d1) |
| F2 | Medium (content) | `PUZZLES[8]` says "Find the checkmate in 1" but **no legal move mates**; its solution g1g7 is answered by Kxg7 |
| F3 | Low (content) | `PUZZLES[19]` has an unreachable en-passant square (ep d6 while the d7 pawn is still there) |
| F4 | Low | castling is generated from FEN castling rights even when no rook stands on the corner |
| F5 | Low | threefold repetition misses positions that differ only by an unusable en-passant square |
| F6 | Low | `hasInsufficientMaterial` misses dead positions with same-coloured bishops |

Verified correct and NOT bugs: fifty-move counter, checkmate-vs-stalemate classification, SAN generation
(158/158 legal moves over 8 positions round-trip through an independent SAN parser, with correct
disambiguation Nbd2/Nfd2, R1a3/R5a3, Q1a3/Q5a3/Qca3, en-passant exd6+, O-O/O-O-O), hint/findBestMove legality,
and the FEN reader (22/22 puzzles parse to exactly the position they claim).

## (b) Findings with evidence

### Method (both paths used)

1. **Node extraction of the page's own source** - `_loop/research/engine-extract.js` slices each function out of
   games/chess.html with a brace/string/comment-aware scanner and `new Function(...)`s it, so the tested code is the
   shipped text, not a hand copy. It also slices the inline FEN reader out of `loadPuzzle` (source lines 2253-2271)
   into `parseFenPage`, so the page's own parser is what gets audited. Line map printed for this revision:
   initBoard:988, getPseudoMoves:1006, isInCheck:1053, getLegalMoves:1067, getAllLegalMoves:1095, makeMove:1101,
   evaluate:1141, minimax:1163, findBestMove:1194, moveToSAN:1286, positionKey:1451, recordPosition:1459,
   hasInsufficientMaterial:1497, executeMove:2011, PUZZLES:1215, loadPuzzle FEN parser:2253, showHint:2401,
   reconstructReviewMove:2414, analyzeReviewEntry:2429, runReview:2497.
2. **Real browser** - `_loop/shots/engprobe.js` (driven by my own CDP copy `_loop/shots/engcdp.js` on private ports,
   because the shared 8137/9222 pair is busy with your runs) loads the page in a 390x844 iframe and calls the
   **live** functions: getAllLegalMoves, makeMove, moveToSAN, reconstructReviewMove, loadPuzzle, runReview,
   executeMove, ChessMods.api.playMove, hasInsufficientMaterial, showHint, positionKey.

Reproduce with:

    cd C:\Users\caleb\AppData\Local\arcade-hub\_loop\research
    node engine-extract.js --perft-max=5        # perft + puzzle FENs + game-end classification
    node engine-sanity.js                        # SAN, puzzle claims, review reconstruction, stress
    cd C:\Users\caleb\AppData\Local\arcade-hub
    node _loop/shots/engcdp.js "_loop/shots/engprobe.html?src=/_loop/shots/engprobe-snapshot.html"
    node _loop/shots/engcdp.js "_loop/shots/engprobe.html?src=/_loop/shots/engprobe-all.html"

---

### F1 - Review/analysis mis-tags normal king moves as castling  (Medium)

**Where:** games/chess.html:2414-2427 (`reconstructReviewMove`), king branch at 2419-2421:

    2419    if (t === PT.KING) {
    2420      if (raw.to === 62 || raw.to === 6) m.castle = 'kingside';
    2421      else if (raw.to === 58 || raw.to === 2) m.castle = 'queenside';

`raw.to` is a bare destination square, so ANY king move ending on g1(62)/g8(6)/c1(58)/c8(2) becomes a castling
move. `makeMove` (1101-1112) then executes the rook swing unconditionally and teleports a rook that never moved.
`analyzeReviewEntry` (2429) evaluates that corrupted board, so the star/?! /?? badge for that move (and the
swing numbers that follow) is wrong.

**Reproduction (browser, live page):** white Kf1 + Rh1 vs black Kf3; Kf1-g1 is a legal, non-castling move.

    reviewRecon = {"kg1Legal":true,"realIsCastle":false,
                   "rec":{"from":61,"to":62,"castle":"kingside"},
                   "afterReview":{"f1":3,"g1":1,"h1":0},   <- white rook teleported h1->f1
                   "afterReal":  {"f1":0,"g1":1,"h1":3},
                   "sans":"Kg1"}

End-to-end through the real runReview() (I wrapped window.reconstructReviewMove and played Kg1 with executeMove):

    reviewE2Eafter = {"captured":[{"from":61,"to":62,"piece":1,"castle":"kingside"}, ...],
                      "rows":2,"score":"White 5.5 - star1 check1 ?!0 ??0 fire0"}

Node: `node engine-sanity.js` prints `-- REVIEW bogus castle flags: 4 --`, e.g.

    {"fen":"8/8/8/8/8/5k2/8/5K1R w - - 0 1","move":"f1g1","realMoveIsCastle":false,
     "reviewFlags":{"from":61,"to":62,"castle":"kingside"},
     "afterReview":"8/8/8/8/8/5k2/8/5RK1 b - -","afterReal":"8/8/8/8/8/5k2/8/6KR b - -"}

Same for black (Kf8-g8, Kd8-c8) and queenside (Kd1-c1). Related, read from source but not exercised end-to-end:
an under-promotion is always rebuilt as a queen (2423 sets `m.promoPiece = PT.QUEEN`) because snapshots only keep
`{from,to}`.

**Patch:** `_loop/research/review-castle-flag.diff`

    -    if (raw.to === 62 || raw.to === 6) m.castle = 'kingside';
    -    else if (raw.to === 58 || raw.to === 2) m.castle = 'queenside';
    +    const dc = col(raw.to) - col(raw.from);
    +    if (dc === 2) m.castle = 'kingside';
    +    else if (dc === -2) m.castle = 'queenside';

**Verified:** applied to the snapshot -> in-browser reviewRecon becomes
`{"rec":{"from":61,"to":62},"afterReview":{"f1":0,"g1":1,"h1":3},"afterReal":{"f1":0,"g1":1,"h1":3}}` (identical
boards), reviewE2Eafter.captured[0].castle === null, CONSOLE_ERRORS=0, iframeErrors=[], and genuine castling is
still reconstructed (the r3k2r/.../R3K2R e1g1/e1c1 rows are unchanged).

---

### F2 - PUZZLES[8] is unsolvable: "checkmate in 1" with no mate  (Medium, content)

**Where:** games/chess.html:1215 (PUZZLES array), entry

    {"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1","desc":"Find the checkmate in 1.",
     "hint":"The queen delivers the final blow.","solution":"g1g7"}

**Evidence (browser, live page: loadPuzzle(8), then enumerate every legal move):**

    i=8 desc="Find the checkmate in 1." solution="g1g7"
        info={"legal":true,"isMate":false,"mates":0,"san":"Qg7+"}    <- mates:0 = NO legal move mates
    puzzleMatePlay={"played":true,"over":false,"result":"","check":false,"oppMoves":["h8g7"],"before":22}

Black just plays Kxg7 (the queen is undefended; the white king is on h1). So checkPuzzleSolution (2313+) can only
take the wrong branch, which reverts the move after 600 ms - the puzzle can never be solved and the
"All puzzles completed" path is unreachable for it.

**Patch:** `_loop/research/puzzle8-fen.diff` - move the white king h1->f7 so Qg7 is defended and covers g8/h7:

    -{"fen":"7k/8/8/8/8/8/8/6QK w - - 0 1", ...
    +{"fen":"7k/5K2/8/8/8/8/8/6Q1 w - - 0 1", ...   (same desc/hint/solution g1g7)

**Verified:** patched copy in-browser -> i=8 info={"legal":true,"isMate":true,"mates":4,"san":"Qg7#"} and playing the
solution through the real API gives {"played":true,"over":true,"result":"White wins by checkmate!"} with
CONSOLE_ERRORS=0. Node agrees (mate-claim #8 sol=g1g7 isMate=true san=Qg7#).

---

### F3 - PUZZLES[19] uses an impossible en-passant square  (Low, content)

**Where:** games/chess.html:1215, entry

    {"fen":"4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 1","solution":"e5d6", ...}

Rank 7 holds a black pawn on d7 AND rank 5 holds one on d5, yet the ep field claims the last move was d7-d5.
A double push empties d7, so the position is unreachable. The puzzle still functions (e5xd6 e.p. is legal for the
engine), but the FEN is not a legal chess position.

**Evidence:** `node engine-sanity.js` ->

    ISSUE #19 ... "issues":["ep d6 unreachable: the double-push origin d7 is still occupied"]
    sol={"form":"fromto","legal":true,...,"san":"exd6"}

**Patch:** `_loop/research/puzzle19-fen.diff` - delete the d7 pawn so the ep square becomes consistent:

    -{"fen":"4k3/3p4/8/3pP3/8/8/8/4K3 w - d6 0 1","solution":"e5d6"
    +{"fen":"4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1","solution":"e5d6"

**Verified:** patched copy -> puzzle #19 boardOk/turnOk/crOk/epOk all true, the ep square is now reachable, exd6
still legal, CONSOLE_ERRORS=0, and the 22-puzzle FEN audit stays clean.

---

### F4 - Castling generated with no rook on the corner  (Low)

**Where:** games/chess.html:1077-1091; conditions at 1081 (kingside) and 1086 (queenside). Neither checks
`b[idx(r,7)]` / `b[idx(r,0)]`, so FEN-supplied rights alone enable O-O/O-O-O.

**Reproduction (browser, two bare kings, rights KQkq):**

    phantomCastle = {"castles":["e1g1","e1c1"],"afterG1":1,"afterH1":0,"crAfter":{"K":false,"Q":false,...}}

The king jumps two squares and makeMove clears the (already empty) corner. Not reachable in normal play: rights
are revoked on king/rook moves and on captures onto the corners (1119-1125), and all 22 puzzle FENs' rights match
their piece placement (verified). This is hardening for malformed FEN input.

**Patch:** `castle-rook-present.diff` and `castle-rook-present-q.diff` (add `b[idx(r,7)] === P(PT.ROOK,color)`
and `b[idx(r,0)] === P(PT.ROOK,color)` to the two conditions).

**Verified:** in-browser castles:[]; genuine castling in Kiwipete and r3k2r/8/8/8/8/8/8/R3K2R is untouched, and the
patched copy reproduces every perft number in the table above (perft4-all.txt, perft5-fixed.txt) - the move
generator's node counts do not change.

---

### F5 - Threefold repetition misses an unusable en-passant square  (Low)

**Where:** games/chess.html:1451-1457 (`positionKey`; ep component on line 1454), used by `recordPosition` (1459)
and tested at 2101 (`recordPosition(game) >= 3`).

The key always contains the raw ep square, even when no pawn can capture on it. FIDE counts two positions as the
same when the possible moves are the same, so a position occurring once right after a double push and twice later
is three times the same position - the page counts 1 + 2 and never declares the draw.

**Reproduction (browser, real game, real ChessMods.api.playMove): 1.e4 Nf6 2.Nf3 Ng8 3.Ng1 Nf6 4.Nf3 Ng8 5.Ng1**

    threefoldFide = {"over":false,"result":"","ep":null,"keyCount":2,
                     "keys":["1x<board>|ep=44", "2x<same board>|ep=-", ...]}

(the same board after plies 1, 5 and 9; the engine splits it into ep=44 once and ep=- twice, so no draw).
Control that the mechanism itself works - pure knight shuffle 1.Nf3 Nf6 2.Ng1 Ng8 twice:
`threefoldControl = {"over":true,"result":"Draw - threefold repetition!"}`

**Patch:** `rep-ep-key.diff` - keep the ep square only when a legal ep capture exists:

    +  let epk = '-';
    +  if (epTarget !== null && epTarget !== undefined) {
    +    const capRow = turn === CL.WHITE ? row(epTarget) + 1 : row(epTarget) - 1;
    +    for (const dc of [-1, 1]) {
    +      const c = col(epTarget) + dc;
    +      if (c < 0 || c > 7) continue;
    +      const i = idx(capRow, c);
    +      if (pType(board[i]) === PT.PAWN && pColor(board[i]) === turn &&
    +          getLegalMoves(board, i, epTarget, castlingRights).some(m => m.ep)) { epk = epTarget; break; }
    +    }
    +  }
    +  s += '|' + epk;

(it calls getLegalMoves for at most two pawns, so pins are respected, and only when an ep square exists).

**Verified:** patched copy in-browser -> the same line now reports
`{"over":true,"result":"Draw - threefold repetition!","keyCount":3}`, the control still draws, perft unchanged,
CONSOLE_ERRORS=0.

---

### F6 - Insufficient material misses same-coloured bishops  (Low)

**Where:** games/chess.html:1497-1513, 4-piece branch 1505-1511, condition at 1509:

    1509      if (cols[0].light !== cols[1].light && cols[0].w !== cols[1].w) return true;

Two bishops on the SAME colour complex can never mate, whoever owns them - K+B vs K+B (same colour) and
K+B+B (same colour) vs K are dead positions and should end the game.

**Reproduction (browser, live page):**

    material = {"kBvk":true, "kbB_same":false, "kbB_opp":true,
                "kBB_same_side_same_color":false, "knvkn":false}
    //            ^ K+B vs K+B both light = false (BUG)      ^ K+BB both light = false (BUG)

Node (engine-extract.js): `FAIL kb-b-same-colour got open expect insufficient-gap`,
`FAIL kbb-same-side-same-colour got open expect insufficient-gap`.
Correctly NOT flagged (verified): K+N vs K+N and K+NN vs K (open - helpmates exist), K+B+B opposite colours.

**Patch:** `insufficient-samecolor-bishops.diff`

    -      if (cols[0].light !== cols[1].light && cols[0].w !== cols[1].w) return true;
    +      if (cols[0].light === cols[1].light) return true;   // same-coloured bishops can never mate
    +      if (cols[0].w !== cols[1].w) return true;          // one bishop each, opposite colours

**Verified:** in-browser the patched copy returns kbB_same:true, kBB_same_side_same_color:true, kbB_opp:true,
knvkn:false, knnvk:false, CONSOLE_ERRORS=0.

---

### Checked and correct (no patch needed)

* **perft** - the whole table above, in Node AND in the live page
  (perft = {"start":[20,400,8902],"kiwipete":[48,2039],"pos3":[14,191,2812],"pos5":[44,1486]}).
* **Fifty-move rule** - reset on capture/pawn move (2063), draw at >= 100 (2098). Live test: set
  game.halfmoveClock = 99, play Nb1-c3 -> {"clock":100,"over":true,"result":"Draw - fifty-move rule!"}.
  Counter semantics also pass a direct test: clocks [1,2,3,0,0,1,2].
* **Checkmate vs stalemate** - fools-mate -> checkmate, back-rank 4R1k1/5ppp/8/8/8/8/8/6K1 b -> checkmate,
  classic-stalemate 7k/5Q2/6K1 -> stalemate, k7/8/1Q6/8/8/8/8/6K1 b -> stalemate, startpos -> open; and a mate
  delivered through the real executeMove in-browser reports "White wins by checkmate!".
* **SAN** (1286-1320) - for all 158 legal moves of 8 positions (two-rook, three-queen and two-knight
  disambiguation, e.p. with discovered check, promotion, both castles) the SAN is unique within the position and
  round-trips through a SAN parser written from the spec back to the exact same move: Q1a3/Q5a3/Qca3, Nbd2/Nfd2,
  R1a3/R5a3, exd6+, O-O/O-O-O, a8=Q. (One row in sanity.txt shows wantOk:false for a8=Q vs my expectation a8=Q+ -
  my expectation was wrong, a8 does not check a king on h7; the engine's output is right.)
* **Hint / depth-2 search** (2401) - 8 live plies in-browser and 9 node positions: the returned move was always
  legal (illegalHint: []), no crash, sensible SAN (Nc3 Nc6 Nf3 Nf6 d3 d6 e3 Be6).
* **Search/apply stress** - 12 games x 120 plies through the page's findBestMove(depth 1) + makeMove + moveToSAN:
  {"crashes":0,"illegal":0,"sanCrash":0}.
* **Puzzle FENs** - 22/22 parse to exactly the claimed position (board vs an independent FEN reader, side to move,
  castling rights, ep square), both through the sliced parser and through live loadPuzzle in the browser; no pawns
  on rank 1/8, no side "not to move" in check, every position has legal moves. loadPuzzle ignores FEN fields 5/6
  (halfmove clock / move number); harmless for the shipped data (all 22 are 0) but worth knowing if new puzzles
  arrive with a non-zero clock.

## (c) Patch files and how they were verified

Unified diffs with headers retargeted to games/chess.html, so from the repo root:

    git -C C:\Users\caleb\AppData\Local\arcade-hub apply _loop\research\<name>.diff

| file | finding |
|---|---|
| _loop/research/review-castle-flag.diff | F1 |
| _loop/research/puzzle8-fen.diff | F2 |
| _loop/research/puzzle19-fen.diff | F3 |
| _loop/research/castle-rook-present.diff | F4 (kingside) |
| _loop/research/castle-rook-present-q.diff | F4 (queenside) |
| _loop/research/rep-ep-key.diff | F5 |
| _loop/research/insufficient-samecolor-bishops.diff | F6 |
| _loop/research/all.diff | all seven together |

Verification performed:

1. **Applies cleanly:** `git apply --check <file>` for each of the 8 diffs against the live games/chess.html ->
   exit=0 for all eight.
2. **Round trip:** copied the frozen snapshot to _loop/shots/engverify/games/chess.html, ran
   `git apply --directory=_loop/shots/engverify _loop/research/all.diff` -> exit 0, and the result is byte-identical to
   the generated patched copy once the CRLF that core.autocrlf=true introduces is normalised
   (normalised identical: true, sha a923d30a174d6113 on both sides).
3. **Behaviour changed as intended, in a real browser, zero console errors:** the same probe page was run against
   engprobe-snapshot.html and engprobe-all.html; every assertion flipped exactly as listed above and both runs
   ended with CONSOLE_ERRORS=0 and iframeErrors: [].
4. **No move-generator regression:** node engine-extract.js --perft-max=4 against the patched copy reproduces all
   six suite rows exactly (perft4-all.txt); depth 5 still gives 4865609 / 674624 / 15833292.

Artefacts (all under _loop/, nothing in games/): research/engine-extract.js, research/engine-sanity.js,
research/make-patches.js, research/gen-diffs.js, research/sanity-base.txt, research/sanity-fixed.txt,
research/perft4.json, research/perft5-snap.txt, research/perft4-all.txt, shots/engprobe.html, shots/engprobe.js,
shots/engcdp.js, shots/engfix-snapshot.html, shots/engfix-*.html (clean patched copies),
shots/engprobe-*.html (copies with <base href="/games/"> so the mod scripts resolve from any path),
shots/engverify/, shots/engprobe-snap.png, shots/engprobe-all.png.

## (d) What I could NOT verify

* **Kiwipete perft(5) = 193690690** and pos5/pos6 depth 5 - not run. This engine needs ~10-30 s per million
  nodes (Kiwipete perft(4) 18-30 s), so those are 15-30 minute jobs. Depth 4 plus the five other positions
  already cover the classic castling / en-passant divergences.
* **Under-promotion through the review path** - I read that reconstructReviewMove always rebuilds a promotion as a
  queen (2423) and that snapshots only keep {from,to}, but I did not play a real under-promotion (e.g. b8=N) and
  inspect the resulting review badge. Treat that sub-claim as unverified; the F1 castle bug is fully reproduced.
* **Mod scripts** - the 10 chess-*.js mods load without errors in the probe, but I exercised no mod-specific code
  path, so beyond "they do not error on load" I can say nothing about them.
* **Bot at Hard (depth 3)** - I ran findBestMove at depth 1/2 only (hint uses depth 2). A depth-3 bot move was
  neither timed nor validated in-page.
* **Performance of the F5 patch in a full game** - it adds one or two getLegalMoves calls per recorded position,
  only when an ep square exists; I did not benchmark it inside a long timed game.
* **_loop/shots/cdp.js never calls ws.connect()** while minws.js requires it (lccdp.js:37 does call it); my first
  probe hung until I added it to my own copy. I did not run their file end to end (its port 8137 is held by their
  serve8137.js), so whether it currently works for them is unverified - but if a probe ever hangs with no output,
  that missing line is the first thing to check. My engcdp.js is the fixed copy.
