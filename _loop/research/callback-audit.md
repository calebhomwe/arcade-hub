# chess.html callback / stale-state audit

**Scope:** every deferred and event-driven callback in `games/chess.html`, plus the six mods it actually loads (`chess-celebration.js`, `chess-coach.js`, `chess-personality.js`, `chess-modes.js`, `chess-sfx-bank.js`, `chess-memes.js`). Read-only audit; no source file was modified.

## Revision caveat (read this first)

`games/chess.html` was **being edited by another writer while this audit ran**: it grew from 5666 -> 5957 lines between 14:43 and 14:47. Line numbers below are pinned to the revision **sha256 B027B3199E059D1C2124591DAA2437B77F5056AF41C8A2AA56441A2D29A9CAFA (5957 lines)**. Because it is a moving target, every finding also quotes the exact code and names the function; re-locate by grep if the hash no longer matches. The six mods were unchanged during the window (hashes at the end).

---

## Ranked findings

| # | file:line (live rev) | Trigger (plain steps) | Impact | Smallest safe guard |
|---|---|---|---|---|
| 1 | `chess.html:3333` `resetGame`, interplay with `chess.html:3117` `endPreview` / `chess.html:3136` `previewChessPly` / `chess.html:3205` `loadPuzzle` / `chess.html:3370` `undo` | Play a few moves, click a move in the move list (preview), then click **Reset** (or Rematch / Play a new mode / Puzzle). Then the next board tap or drag. | `liveGame` still points at the abandoned game; `handleClick` runs `if (previewing()) endPreview()` which does `game = liveGame`. The reset is silently undone and the old (possibly finished) game is resurrected. | Give `resetGame`/`loadPuzzle`/`undo` a `cancelPreview()` that does `liveGame = null; previewPlyIndex = -1; mlCache.n = -1;` **without** restoring `game`; or at minimum add `liveGame = null; previewPlyIndex = -1;` to `resetGame`. |
| 2 | `chess.html:1608` `trapTimer = setInterval(...)`; `chess.html:3333` `resetGame` never calls `stopTrap` | Open **Learn -> Traps**, tap a trap play button, then immediately tap **Reset** / Play / switch mode. | The 720 ms interval keeps firing and calls `ChessMods.api.playMove` on the *new* game. Most trap openings are ordinary moves that are legal from the start position, so the trap line is auto-played into the fresh game and can reach mate. | Call `stopTrap()` (and hide `#trapCaption`) at the top of `resetGame`, or stop on the `reset` event. |
| 3 | `chess.html:2042` `run` + `chess.html:2048` `setTimeout(run, premoveDelay)` | While it is the bot turn queue a premove by clicking; the bot moves and 140 ms later the premove auto-fires. Hit Undo / Reset / a mode change inside that window. | The closure captured `match` from the old position. Its only guard is `if (game.gameOver || game.turn === botColor) return;` (line 2043) - no game-identity and no legality re-check. `executeMove` does not validate, so a stale move is applied to the new board (can move an empty square / capture a king). | Keep the timeout id in `premoveTimer`, clear it in `resetGame`/`undo`/`redo`, and re-derive `match` from `getAllLegalMoves` for the current `game` inside `run` before executing. |
| 4 | `chess.html:1974` `if (game.gameOver) { clockStop(); return; }` in `clockTickFn` | Enable the clock (start screen time > 0), play, then click a move in the move list to preview. | `previewChessPly` (3136) builds the preview with `gameOver: true`. On the next tick the clock sees a finished game and calls `clockStop()`. Leaving the preview never restarts it, so the timed game loses its clock permanently. | `if (previewing()) return;` before the `game.gameOver` check, or stop marking the preview object `gameOver: true`. |
| 5 | `chess.html:1880` `let ACH_FLAGS = { combo3:false, castleWin:false }`; assignments in `executeMove` (`ACH_FLAGS.combo3 = true`, `ACH_FLAGS.castleWin = true`); no reset in `resetGame:3333` | Get 3 captures in a row in game A (or castle-and-mate), finish/leave; then in game B call `unlockBadges` (end of any game / puzzle). | Flags are never cleared, so badges "Fury Road" / "Castled Winner" can unlock in a later game without the feat. Persisted to localStorage. | Reset `ACH_FLAGS = { combo3:false, castleWin:false }` in `resetGame` (keep `castleUsedThisGame` as-is). |
| 6 | `chess.html:3615` `dragState`; `endDrag` uses `dragState.legal` then `executeMove(direct)`; `resetGame:3333` never nulls `dragState` | Start dragging a piece, then trigger a reset before pointerup (second finger on Reset on touch, or a programmatic/mode-change reset). Then release. | `endDrag` finds a stale move in the captured `legal` array and executes it unvalidated on the new board. Same corruption class as #3, harder to hit with one pointer. | `dragState = null;` (and `lastPress = -1;`) in `resetGame`/`loadPuzzle`. |
| 7 | `chess.html:4143` `setTimeout(() => loadPuzzle(puzzleIndex + 1), 1200);` in `btnPuzzleSkip` | In a puzzle click **Skip**, then within 1.2 s click **Puzzle Exit** (or Reset / Play). | The timeout is never stored, so `resetGame` cannot clear it. When it fires `puzzleIndex` is now `-1` (a fresh game), so it calls `loadPuzzle(0)`: `puzzleMode` becomes true again, the panel reopens and the new game is replaced by puzzle 1. | Store the id (e.g. `puzzleSkipTimer`) and clear it in `clearPuzzleTimer()`, and/or capture `const target = puzzleIndex + 1` plus `if (!puzzleMode) return;` in the callback. |
| 8 | `chess.html:2935` (8 chained `setTimeout` for the checkmate king flash); `chess.html:2959` `setTimeout(showGameOver, 900)` | Reach checkmate, then Reset / start a new game / enter a puzzle inside ~0.9 s. | Both read the live global `game`. The flash loop finds the *new* game king (harmless), and `showGameOver` returns unless `game.gameOver && !puzzleMode` (harmless). No crash, but they are unguarded, uncancelled deferred callbacks. | Optional: gate on a monotonic `gameEpoch` counter. |
| 9 | `chess.html:3176` `botThinkTimeout = setTimeout(...)` | Bot thinking (200-600 ms), then Undo / Redo / Reset / botSel change. | Guarded by `game.gameOver || !botEnabled` and cancelled by `clearBotTimers` from reset/undo/redo, so no stale mutation observed. Residual: it never checks `game.turn === botColor`, but `doBotMove` handles a null move. | Optional: add the turn check. |
| 10 | `chess.html:3695` `timer: setTimeout(...)` for annotation long-press | Long-press an empty square (touch), Reset within 420 ms. | `resetGame` nulls `annotLongPress` but does not clear its timer; the callback only sets the annotation drag and calls `draw()` - no game mutation. | Optional: `clearTimeout(annotLongPress.timer)` in `resetGame`. |
| 11 | `chess.html:3536`/`3539` `reviewTimer = setTimeout(step, ...)` | Open Review while a reset/undo happens during the chained analysis. | `step` works off captured snapshot entries; `finishReview` reads global `game` only at the end. `resetGame`/`undo`/`redo` all call `closeReview()` -> `clearReviewTimer()`. `executeMove` does not close Review, but the panel is a modal over the board. Low. | Optional: call `closeReview()` from `executeMove`. |

---

## Checked and clean (no stale-state mutation found)

Main file:
- `window resize` (`chess.html:2072`) and `resize()` - synchronous, reads only `#gameWrap`, invalidates `pieceSpriteCache`.
- `requestAnimationFrame` chain (`draw`/`animLoop`/`startMoveAnim`, live ~2614/2619/2908/3163): `drawBoard` always reads the current global `game`; `moveAnim` self-clears when `t >= 1` (line ~2540). There is **no cancelAnimationFrame anywhere**, but the loop only reschedules while `animActive()` is true, so it terminates.
- All canvas/document pointer + keyboard listeners (`chess.html:3678` onward): synchronous; `startDrag`/`handleClick` guard `previewing()`, `game.gameOver`, `pendingPromo`, `botThinking`, and re-read the current `game`.
- All button listeners (undo/redo/reset/hint/teach/flip/clock/resign/draw/review/learn/stats/settings/theme/botSel/personality/sfx volume/juice): synchronous; no deferred mutation. The `promoOverlay`/`.promo-btn` listeners guard `pendingPromo`.
- `botTimer` interval (live ~3172): clears itself when `botThinking` is false.
- `clockStart`/`clockStop` interval: stopped/restarted by reset/undo/redo/start screen (the only defect is finding #4).
- `clearPuzzleTimer()` (live ~1574) clears both `puzzleTimer` and `puzzleRollbackTimer`; `exitPuzzleMode` -> `resetGame` -> `clearPuzzleTimer`. The **already-fixed** wrong-answer rollback now has `if (!game || game.gameOver || !game.moveHistory.length) return;` (live ~3321) before `game = game.moveHistory.pop()` - the original crash cannot recur through that path. (Stricter identity check still absent; see limitations.)
- Modal focus `setTimeout(...,0)` (~3554/3559): wrapped in try/catch, safe on removed nodes.
- `flashTip` (3903), `showRandomTip` (3107), badge-tip (1902) timeouts: compare current text before clearing, cosmetic only.
- icon `sweep` timeouts (4272/4273), subtitle `setInterval` (5782), `MutationObserver`+late interval (5791-5797): DOM/class only, never touch `game`.
- `navigator.clipboard.writeText(...).then(done, fallback)` (copyText ~3922): updates a tip only.
- No `visibilitychange`, `pagehide`, `onresize`-property, `ResizeObserver`, `IntersectionObserver`, or `queueMicrotask` handlers exist (grep-confirmed).

Mods (all six + catalog):
- `chess-celebration.js` (sha A2C01BEE...): `ChessMods.on('move'/'reset')` + `animationend` removals. Reset removes `.cmv-card,.cmv-banner`; confetti divs are only removed on `a.onfinish`, so a reset mid-confetti leaves up to 60 divs animating ~1.7 s (DOM only). No game-state mutation.
- `chess-coach.js` (5ABC5DDF...): one `hideTimer` setTimeout captures `note`, cleared by `stop()` on reset; reads `api.board` synchronously inside the move handler. Note: `api.epTarget`/`api.castlingRights` are not exported by `ChessMods.api`, so `isHanging` silently falls back to `null`/all-false - a coaching-hint accuracy issue, not a crash.
- `chess-personality.js` (CBD52D5C...): no timers; `animationend`; reset removes the bubble. Reads bot globals synchronously.
- `chess-modes.js` (57145976...): click toggle + `move` handler + `animationend`; no game state.
- `chess-sfx-bank.js` (A26E9CEE...): two `fetch().then()` chains populate buffers/catalog only; no timers, no game state. Functional (not crash-class) observations: `useSet()` never reassigns `CATALOG` (set once at line 10), so switching sets re-downloads the initial set; `mutedNow()` checks `window.muted`, but `muted` is a script-scope `let`, not a window property.
- `chess-memes.js` (F7F5EE2B...): `previewAll` staggered `setTimeout(run, k*650)` captures catalog objects (fires after the panel closes, harmless); `flag()` removes its element only if it still has a parent; all panel listeners are synchronous/localStorage. No game-state mutation.
- `audio/memes/catalog.js` (841FC4EA...): pure data (`window.__MEME_BANK`), no callbacks.

---

## Inverse check: state `resetGame` does NOT clear

What `resetGame()` (live `3333`) *does* clear: the `game` object; records position; restarts clocks; `selectedSquare/legalMoves/castleSelect/hintArrow`; `premove`; both puzzle timers (via `clearPuzzleTimer`); `redoStack`; annotations (`annotArrows/annotSquares/annotDrag/annotLongPress`); `mlCache`; `pendingPromo`+`hidePromoUI`; `particles/flashSquares/textPops/clickRings`; `shakeAmount`; `comboCount`; `castleUsedThisGame`; `puzzleMode/puzzleIndex`; emits `ChessMods.emit('reset')`; defers a memes `'start'`; restores `prevBotEnabled`; hides `#puzzlePanel`; clears `#tip`; `closeReview`; `clearBotTimers`; redraws and reschedules the bot.

It **misses** (leak candidates, most already in the ranked table):

1. `liveGame`, `previewPlyIndex` (and therefore `previewing()`) -> finding #1.
2. `ACH_FLAGS` (`combo3`, `castleWin`) -> finding #5.
3. `dragState`, `lastPress`, `lastReleaseTs`, `lastTouchTs` -> finding #6.
4. `trapTimer` and the `#trapCaption` panel (never hidden after a trap) -> finding #2.
5. `moveAnim`, `captureAnims`, `checkGlowUntil` - cosmetic; a slide started in the old game can draw for ~135 ms over the new board.
6. `kbSquare` - cosmetic; valid square index, cleared on canvas blur, but persists across reset if the canvas stays focused.
7. `teachThreatCache` - safe by design: it is keyed on `teachThreatCache.board !== game.board` and reset installs a new board array, forcing a recompute.
8. `RUSH.cur` (puzzle-rush streak) - carries across games and puzzle sessions; only cleared on a wrong answer / Skip. May be intentional.
9. `lastFocused` (modal focus bookkeeping) - may reference a detached node; guarded by try/catch in `syncModalState`.
10. Per-module throttles: coach `lastAt`, personality `lastAt`, memes `state.last` - carry across reset; rate-limiting only, harmless.
11. `window.chessCoachOn` - preference, intended to persist.

---

## What I could not determine / limitations

- **Moving target.** The file changed under me (5666 -> 5957 lines; three different hashes). All line numbers are anchored to sha `B027B319...`; the quoted code is authoritative for locating. I cannot guarantee the parent edits the identical revision.
- **No runtime reproduction.** Per instructions I did not start a server or browser, so trigger windows (the 140 ms premove window, multitouch drag reset, 1.2 s Skip window) are from static reading only and untested. `_loop/tests/puzzle-reset-race.txt` exists and may be the harness for the original bug.
- **Preview + Undo path not fully resolved.** `undo()` (live ~3370) does not call `endPreview()`, so with a preview active it snapshots the preview object into `redoStack` and pops the live history while `liveGame` remains set; the next click restores the pre-undo live game. I could not determine a clean recovery path - it needs the same `cancelPreview()` fix as #1.
- **Modal pointer-blocking.** I did not verify that the Review panel fully prevents pointer/keyboard access to the canvas, which decides whether finding #11 (`executeMove` while Review runs) is reachable.
- **Identity of the concurrent editor.** The edits could be the parent applying another audit findings; if a patch for finding #1/#2/#3 landed after sha B027B3, some of this may already be fixed - re-grep the quoted strings.
- **Self-test region excluded.** `window.__chessTest` and its `CASES` (roughly lines 4395-5720) contain many timers/`game =` reassignments but only run under explicit automation; I spot-checked rather than fully audited them.
