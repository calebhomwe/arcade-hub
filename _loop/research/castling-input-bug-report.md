# Castling bug — end-to-end reproduction, root cause, patch proposal

Author: castle-bug subagent (read-only on `games/`; single-writer rule respected — I never edited `games/chess.html` or `games/*.js`).
Date: 2026-09-11, ~19:25 Australia/Perth.

Files I own / produced:

| File | What it is |
|---|---|
| `_loop/research/castling-input-bug-report.md` | this report |
| `_loop/research/castle-rook-tap.diff` | **the patch proposal** (4 hunks, git-generated, applies clean to the current `games/chess.html`) |
| `_loop/research/chess-castle-fix.html` | the patched copy that was verified in a real browser |
| `_loop/research/castle-rook-first-optional.diff` | OPTIONAL extra hunk for the "tap rook first" gesture — **not recommended**, see (c2) |
| `_loop/shots/myprobe3.js` / `myprobe3.html` | the 23-check gesture matrix probe (before/after evidence) |
| `_loop/shots/myprobe4.js` / `myprobe4.html` | selection-state probe (what a rook tap selects) |
| `_loop/shots/mycdp.js` | CDP runner (ephemeral ports; cdp.js is broken, see F5) |
| `_loop/shots/myprobe.png`, `myprobe3-*.png`, `myprobe4-*.png` | screenshots each run wrote |

---

## (a) Summary

1. **The reported bug reproduces, and it is one specific gesture: tap your king, then tap your own rook** (the chess.com alternate castling gesture). Result: **nothing happens at all** — board unchanged, side to move unchanged, the rook merely becomes selected. Verified on both the 19:08:41 revision and the current 19:19:35 revision of `games/chess.html`.
2. Castling itself is **not** broken: tap-king→tap-destination, drag-king→destination, drag-king→rook, white/black, kingside/queenside, normal and flipped board, mouse and touch, bot and 2-player all work **before and after** my patch. The move generator, `makeMove` and `executeMove` are correct: `ChessMods.api.playMove(e1,g1)` returns `true` and produces the right board on exactly the positions where the taps do nothing.
3. **Root cause is in the input layer**: on a real touch tap the browser fires `pointerdown` → `touchstart` → `pointerup`. `startDrag` (line 2583) runs first and, because the tapped square holds your own rook, it overwrites `selectedSquare`/`legalMoves` with the **rook's** move list (2588-2589). When `handleClick` then runs from `touchstart` (2647) the king selection that carried the castle move is already gone, and `handleClick` only ever matches a move by its **destination** square (1969) — a castle move's destination is g1/c1, never the rook square.
4. The three WIP helpers that were meant to cover this are all **dead code** — evidence in F4.
5. Fix = 4 hunks, **+15/−2 lines** (`git diff --no-index --numstat` = `15  2`), confined to `startDrag`/`endDrag` plus one new pure helper. Verified in headless Chrome: **23/23 checks pass (baseline 17/23, the 6 failures are all the king→rook tap), 0 console errors**, and every previously-working case produces byte-identical board changes.

---

## (b) Findings with evidence

### Harness used (all commands reproducible)

Runner (CDP + ephemeral ports + unique Chrome profile + watchdog): `_loop/shots/mycdp.js` (a fixed copy of `cdp.js`, see F5).

```
cd "C:\Users\caleb\AppData\Local\arcade-hub\_loop\shots"
& "C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe" mycdp.js "_loop/shots/myprobe3.html?src=/games/chess.html" myprobe3-base-final.png
& "C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe" mycdp.js "_loop/shots/myprobe3.html?src=/_loop/research/chess-castle-fix.html" myprobe3-fixed-final.png
```

The probe loads `/games/chess.html` in a **390×844 iframe** and drives it through the real DOM input path: `PointerEvent('pointerdown', {pointerType:'touch'})` on `document.elementFromPoint(rect-mapped sqXY(sq))`, then `TouchEvent('touchstart')`, `pointerup`, `touchend`, `click` — the real browser order. A `MOUSE` variant dispatches pointerdown/pointerup/click with `pointerType:'mouse'`. Board state is read through `ChessMods.api.board` and internal state through `iframe.contentWindow.eval('selectedSquare')` / `eval('legalMoves')`.

**Revisions tested** (hash printed by the same command that ran the probe):

| revision | SHA256 |
|---|---|
| `games/chess.html` at 19:08:41 (parent WIP) | `E4F221075F26CAD666AFE046EF91BB78B9D0316B34200287374BCD8D6C621302` |
| `games/chess.html` current, 19:19:35 (engine fixes landed) | `5421E1568F8DEF04D207985946CB5A05C08A32A20BEC035674AC3698B31DB190` |
| `_loop/research/chess-castle-fix.html` (patch applied, verified) | `F9149165A2379E926500F7F94F8328F9620F90C8E2C1D5D9E8DE66CAF480CC2E` |

The input-layer behaviour is identical on both revisions (same 6 failures, same 17 passes).

### F1 — "tap king, then tap rook" does nothing (THE reported bug)

Probe output, current revision `5421E156…` (verbatim lines from the runner):

```
G1 tapK-e1 tapG1 PASS changes=e1:1>0,f1:0>3,g1:0>1,h1:3>0,turn:0>1
G2 tapK-e1 tapROOK-h1 **FAIL** expect=castle-k changes=no-change
G4 dragK e1->h1 PASS changes=e1:1>0,f1:0>3,g1:0>1,h1:3>0,turn:0>1
G6 tapK-e1 tapC1 PASS changes=a1:3>0,c1:0>1,d1:0>3,e1:1>0,turn:0>1
G8 FLIP tapK-e1 tapG1 PASS changes=e1:1>0,f1:0>3,g1:0>1,h1:3>0,turn:0>1
G9 FLIP tapK-e1 tapROOK-h1 **FAIL** expect=castle-k changes=no-change
G10 black tapK-e8 tapG8 PASS changes=e8:9>0,f8:0>11,g8:0>9,h8:11>0,turn:1>0
G11 black tapK-e8 tapROOK-h8 **FAIL** expect=castle-kb changes=no-change
M1 MOUSE tapK-e1 tapROOK-h1 **FAIL** expect=castle-k changes=no-change
M2 MOUSE tapK-e1 tapG1 PASS changes=e1:1>0,f1:0>3,g1:0>1,h1:3>0,turn:0>1
B1 BOT-ON tapK-e1 tapROOK-h1 **FAIL** expect=castle-k changes=no-change
TOTALS pass=17 fail=6 observed-only=3
CONSOLE_ERRORS=0
```

("no-change" = all 64 squares and the side-to-move are identical before and after the two taps.)

Step-by-step state, `myprobe4.js` case S3 (baseline `/games/chess.html`):

```
S3 tapKING-e1 then tapH1 before: e1=1 f1=0 g1=0 h1=3 d1=2 turn=0
  after tap1(e1): sel=e1 castleSelect=false legals=["60>52","60>61","60>62(kingside)"]
  after tap2(h1): sel=h1 castleSelect=false legals=["63>62","63>61"] board: e1=1 f1=0 g1=0 h1=3 d1=2 turn=0
```

Mechanism, with current line numbers in `games/chess.html`:

* Event wiring: `pointerdown` → `startDrag` (2638-2642), `pointerup` → `endDrag` (2644), `touchstart` → `handleClick` (2647). Real order for one finger tap: pointerdown, touchstart, pointerup.
* Tap 1 on e1 works: `startDrag` sets `selectedSquare=60`, `handleClick` re-affirms it, and `legalMoves` contains `60>62(kingside)`.
* Tap 2 on h1: `startDrag` (2583-2599) runs first. `sq=63`, `game.board[63]` is our own rook, so it does **not** return early; it overwrites `selectedSquare = sq` (2588) and `legalMoves = getLegalMoves(rook)` (2589). The king selection and its castle move are now gone.
* `handleClick` (1962-1992) then runs with `selectedSquare=63`: line 1969 `legalMoves.find(m => m.to === sq)` searches for a move whose destination is h1 — a castle move's destination is g1/c1, so there is no match; line 1979 falls through and line 1980 simply re-selects the rook.
* Nothing anywhere maps "tap the rook" → "the castle move to g1/c1" on the `handleClick` path. `endDrag` (2644) cannot save it either, because after tap 2 `dragState.from` is the **rook** square (63), not the king square, so `rookCastleFrom(from)` (2611, helper 1889-1895) returns −1 for it.

### F2 — "tap rook first, then tap the destination" silently plays a plain rook move

```
G3 tapROOK-h1 tapG1 [observed] changes=g1:0>3,h1:3>0,turn:0>1        (rook slides h1→g1, king stays on e1)
G7 tapROOK-a1 tapC1 [observed] changes=a1:3>0,c1:0>3,turn:0>1        (rook slides a1→c1, king stays on e1)
```

Same root cause as F4: `kingCastleFrom` never returns a king square, so `castleSelect` is never set and the second tap is resolved as an ordinary rook move. A user attempting to castle this way gets a **wrong move played silently**. (This is unchanged before and after my patch — with my patch it is still a plain rook move, exactly as today, so I did not change unrelated behaviour.)

### F3 — the engine is fine (isolates the bug to input)

`ChessMods.api.playMove(from,to)` — which goes through `getAllLegalMoves` → `executeMove`/`makeMove` — succeeded on every position where the taps failed:

```
C1 tapK-e1 tapG1   ... ENGINE playMove(e1g1)=true  after={"K":0,"R1":0,"F":3,"G":1,...,"turn":1}
C2 tapK-e1 tapROOK-h1 ... ENGINE playMove(e1g1)=true  after={... same castled board ...}
C3 queenside taps  ... ENGINE playMove(e1c1)=true  after={"K":0,"R2":0,"C":1,"D":3,...,"turn":1}
C4 black taps      ... ENGINE playMove(e8g8)=true  after={"k":0,"r1":0,"f":11,"g8":9,"turn":0}
```

Also confirmed by the refusal cases below (`getLegalMoves` correctly withholds the castling move when it is illegal).

### F4 — the three WIP castling helpers are dead code

* `kingCastleFrom(rookSq)` (1896-1903) asks `castleMoveFor(kingSq,target)` (1886-1888), which searches the **module-global `legalMoves`**. Every caller has already overwritten `legalMoves` with the **rook's** moves before calling it: `handleClick` 1981 then 1983, `startDrag` 2589 then 2593, `endDrag` 2627 then 2629. A rook's move list never contains `m.from === kingSq && m.castle`, so it always returns −1. Probe proof: `sel=h1 castleSelect=false` after tapping h1 in every baseline run (F1/F2 logs).
* `castlingRookDrag(move)` (1904-1913) returns `null` unless `dragState` is set (1905). `endDrag` clears `dragState = null` at **2612 before** calling it at 2614 — so on the drag path it is unreachable; on the `handleClick` path (1969) it additionally requires `game.board[move.to]` (i.e. g1) to hold our own rook, which it never does.
* `castleSelect` is only ever set inside those two dead branches (1984, 2594, 2630), so the guard at 1979 `if (castleSelect) { draw(); return; }` is unreachable too.

**The WIP was the right gesture in the wrong place**: `startDrag` has to remember what was selected *before* the tap clobbers it; that information (and the rook square the user pressed) is what the patch adds.

### F5 — harness bug: `_loop/shots/cdp.js` hangs forever (separate from the castling bug)

`cdp.js:39` does `new MiniWS(url)` and never calls `ws.connect()`; `minws.js` does not auto-connect, so `await ws.on('open')` never resolves. Observed: my `mycdp.js` (a byte-identical copy of `cdp.js` with only ports/profile/screenshot-name changed) printed `target=http://…` then `ws connecting` and produced **no further output, no screenshot, no exit** until the watchdog killed it (180 s). Siblings' `engcdp.js:57` and `lccdp.js:37` both call `ws.connect()` and work. Fix: add `ws.connect();` after the `ws.on('message', …)` handler.
Second harness hazard observed while working: Chrome with a fixed `--remote-debugging-port` and a fixed `--user-data-dir` silently hands off to an existing instance, so `/json/list` returned **another agent's** page (I briefly attached to `engprobe.html` on port 8155). Use ephemeral ports + a per-run profile (that is what `mycdp.js` now does) and assert the target URL.

---

## (c) Proposed patch and how it was verified

### The patch — `_loop/research/castle-rook-tap.diff`

Generated with
`git -C <repo> diff --no-index -- games/chess.html _loop/research/chess-castle-fix.html`
and the two `b/…` header lines rewritten to `b/games/chess.html`; nothing else was touched. Applies to `games/chess.html` = `5421E156…` (current) with `git apply` (exit 0) and reproduces the verified copy byte-for-byte.

Hunk 1 — new helper next to the other castling helpers (after `kingCastleFrom`):

```js
function castleByRookTap(kingSq, sq) {
  if (kingSq < 0 || sq < 0) return null;
  if (game.board[kingSq] !== P(PT.KING, game.turn)) return null;
  if (game.board[sq] !== P(PT.ROOK, game.turn)) return null;
  if (row(sq) !== row(kingSq)) return null;
  const target = col(sq) === 7 ? idx(row(kingSq), 6) : col(sq) === 0 ? idx(row(kingSq), 2) : -1;
  if (target < 0) return null;
  return getLegalMoves(game.board, kingSq, game.epTarget, game.castlingRights).find(m => m.castle && m.from === kingSq && m.to === target) || null;
}
```

It only produces a move when **all** of these hold: a king of the side to move was selected, the tapped square holds a **rook of the side to move on the same rank**, and `getLegalMoves` (i.e. the engine, including the check/path/rights rules) actually offers the corresponding castle move. Otherwise it returns `null` and every existing path behaves exactly as before. `getPseudoMoves` returns `[]` for an empty square (chess.html:1007), so calling it on a square without a king is safe.

Hunk 2 — `startDrag` remembers the pre-tap selection and the pressed square:

```js
   const sq = getSquareFromEvent(e);
   if (sq < 0 || !game.board[sq] || pColor(game.board[sq]) !== game.turn) return;
+  const tapCastle = castleByRookTap(selectedSquare, sq);
   selectedSquare = sq;
```
```js
-  dragState = { from: dragFrom, x: e.clientX, y: e.clientY };
+  dragState = { from: dragFrom, press: sq, tapCastle, x: e.clientX, y: e.clientY };
```

Hunk 3 — `endDrag` consumes it (pointerup fires for touch *and* mouse, so this is the single execution point; a second execution point would risk a double move):

```js
   const from = dragState.from;
+  const press = dragState.press;
+  const tapCastle = dragState.tapCastle;
   const rookSq = rookCastleFrom(from);
   dragState = null;
   if (sq >= 0) {
     let move = legalMoves.find(m => m.to === sq) || castlingRookDrag(legalMoves.find(m => m.castle));
-    if (!move && sq === rookSq) move = legalMoves.find(m => m.castle) || null;
+    if (!move && sq === rookSq && press === from) move = legalMoves.find(m => m.castle) || null;
+    if (!move && tapCastle && sq === press) move = tapCastle;
```

Why the `press === from` term: it preserves the existing "press the king and release it on the rook" drag (`press === from === kingSq`, proven by G4 which still passes, identical `changes` string) while making the fallback **impossible** for a press that started on the rook. Without that term, a future repair of `kingCastleFrom` would make a *single* tap on the rook castle instantly (press-on-rook ⇒ `dragState.from` = king ⇒ `sq === rookSq`). With the current file the term is a no-op (today `dragState.from` is always the pressed square), so it changes nothing now and blocks that trap later.

### Verification (real browser, zero console errors)

Both runs below used the same 23-check probe and the same command; only the `src=` differs.

| case | gesture | baseline `/games/chess.html` (5421E156…) | patched `…/chess-castle-fix.html` (F9149165…) |
|---|---|---|---|
| G1 | tap K e1 → tap g1 | PASS castled | PASS castled |
| **G2** | **tap K e1 → tap ROOK h1** | **FAIL, no-change** | **PASS castled** |
| G4 | drag K e1→h1 | PASS castled | PASS castled |
| G5 | drag K e1→g1 | PASS castled | PASS castled |
| G6 | tap K e1 → tap c1 (queenside) | PASS castled | PASS castled |
| G8 | flipped board, tap K e1 → tap g1 | PASS castled | PASS castled |
| **G9** | **flipped board, tap K e1 → tap ROOK h1** | **FAIL, no-change** | **PASS castled** |
| G10 | black, tap K e8 → tap g8 | PASS castled | PASS castled |
| **G11** | **black, tap K e8 → tap ROOK h8** | **FAIL, no-change** | **PASS castled** |
| **M1** | **mouse: tap K e1 → tap ROOK h1** | **FAIL, no-change** | **PASS castled** |
| M2 | mouse: tap K e1 → tap g1 | PASS castled | PASS castled |
| **B1** | **bot game on: tap K e1 → tap ROOK h1** | **FAIL, no-change** | **PASS castled** |
| **R8** | **tap K e1 → tap ROOK h1 → tap g1** | **FAIL (rook moved to g1)** | **PASS castled on the 2nd tap** |
| R1 | tap ROOK h1 alone | PASS no-change | PASS no-change |
| R3 | tap pawn e2 → e4 | PASS e2→e4 | PASS e2→e4 |
| R4 | tap K e1 → f1 | PASS king e1→f1 | PASS king e1→f1 |
| R5 | tap K e1 twice | PASS no-change | PASS no-change |
| R6 | tap Q d2 → d3 | PASS queen moved | PASS queen moved |
| R7 | tap ROOK h1 twice | PASS no-change | PASS no-change |
| X1 | **in check** (Nd3), tap K e1 → tap ROOK h1 | PASS refused | PASS refused |
| X2 | **through check** (f1 attacked by Ne3), tap K e1 → tap ROOK h1 | PASS refused | PASS refused |
| X3 | rights gone (rook shuffled h1→g1→h1), tap K e1 → tap ROOK h1 | PASS refused | PASS refused |
| X4 | king moved e1→e2→e1, tap K e1 → tap ROOK h1 | PASS refused | PASS refused |
| **TOTALS** | | **pass=17 fail=6** | **pass=23 fail=0** |
| CONSOLE_ERRORS | | **0** | **0** |

`G3`/`G7`/`R2` are recorded as observations, not pass/fail; their `changes` strings are **identical before and after the patch** (`g1:0>3,h1:3>0,turn:0>1`, `a1:3>0,c1:0>3,turn:0>1`, `no-change`), i.e. the patch does not alter the rook-first gesture, plain rook moves, king moves or refusals.

Selection-state cross-check (`myprobe4.js`, baseline vs patched — identical):

```
S1 tapROOK-h1 then tapF1   baseline: after tap1 sel=h1 legals=["63>62","63>61"]; tap2 → rook h1→f1
                           patched : after tap1 sel=h1 legals=["63>62","63>61"]; tap2 → rook h1→f1
S3 tapKING-e1 then tapH1   baseline: after tap2 sel=h1, board unchanged (BUG)
                           patched : after tap2 board e1=0 f1=3 g1=1 (castled)
```

Patch application check (scratch git repo in %TEMP%, never touches `games/chess.html`):

```
git apply --check _loop/research/castle-rook-tap.diff   -> exit 0
git apply       _loop/research/castle-rook-tap.diff     -> exit 0
applied-hash = F9149165A2379E926500F7F94F8328F9620F90C8E2C1D5D9E8DE66CAF480CC2E
copy-hash    = F9149165A2379E926500F7F94F8328F9620F90C8E2C1D5D9E8DE66CAF480CC2E   (identical)
```

### (c2) OPTIONAL, NOT RECOMMENDED — repairing the rook-first gesture

`_loop/research/castle-rook-first-optional.diff` makes `kingCastleFrom` compute the king's own legal moves instead of the stale global `legalMoves`:

```js
-  const target = c === 7 ? idx(r, 6) : idx(r, 2);
-  if (castleMoveFor(kingSq, target)) return kingSq;
+  if (game.board[kingSq] !== P(PT.KING, game.turn)) return -1;
+  const target = c === 7 ? idx(r, 6) : idx(r, 2);
+  if (getLegalMoves(game.board, kingSq, game.epTarget, game.castlingRights).some(m => m.castle && m.from === kingSq && m.to === target)) return kingSq;
```

That variant (probe run, 0 console errors) turns G3/G7 into real castles — **but** it makes the tapped rook select the **king** (`after tap1(h1): sel=e1 castleSelect=true`), and the next tap is then interpreted as a king move:

```
S1 tapROOK-h1 then tapF1  -> after tap1(h1): sel=e1 castleSelect=true legals=["60>52","60>61","60>62(kingside)"]
                             after tap2(f1): board e1=0 f1=1 g1=0 h1=3  == the KING moved e1→f1
S2 tapROOK-h1 then tapH1  -> castles (double-tap on the rook now castles)
G3 tapROOK-h1 tapG1       -> castles
```

So a user who taps their rook intending to move it, then taps f1, would move the **king**. My recommendation: ship `castle-rook-tap.diff` only; the reported gesture is fixed without touching `kingCastleFrom`/`castleSelect` semantics. If you do want rook-first, the optional hunk is safe **only together with** the `press === from` gate in hunk 3 (otherwise a single rook tap would castle immediately), and you should accept the S1 behaviour above.

---

## (d) What I could NOT verify

1. **A real finger on a real device.** All input was synthetic `PointerEvent`/`TouchEvent`/`MouseEvent` dispatched at `elementFromPoint(rect-mapped sqXY(sq))` inside a 390×844 iframe in headless Chrome 152. I did not run on a physical phone, and not on iOS Safari. (The order pointerdown→touchstart→pointerup is the browser-specified order and is what the existing drag code already depends on — but that is reasoning, not a measurement.)
2. **Whether `pointerup` is guaranteed after `touchstart`'s `preventDefault()`.** `canvas.setPointerCapture` is attempted in the pointerdown handler (2639-2641) and throws inside my synthetic probe (caught by the game's `try/catch`), so pointer capture was never actually exercised.
3. **No regression suite beyond the 23 checks.** I did not play a full game end-to-end, did not exercise promotion/undo/review/puzzle/hint paths, and did not test the `chess-*.js` mods beyond confirming they load (my probe server remaps their relative URLs for the copy under `_loop/research/`; the mods' own behaviour is unchanged by the patch, which touches only `startDrag`/`endDrag`).
4. **The optional rook-first hunk's full consequences** (item (c2)) — I verified S1/S2/S3 only; I did not enumerate every interaction of an always-on `castleSelect`.
5. **Engine-level castling correctness** (castling with a missing rook, the review/replay reconstruction at 2430+, perft) — that is the other agent's area; I only verified that `getLegalMoves` refuses castling in check / through check / without rights (X1-X4) and that the API path plays it.
6. **The patch under a different revision** than `5421E156…`. `games/chess.html` changed twice while I worked (19:08:41 → 19:19:35). The diff is regenerated against 19:19:35 and applies cleanly to it; if you land more edits in `startDrag`/`endDrag` first, re-apply by hand (the four insertion points are quoted above).
