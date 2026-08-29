# Arcade Juice Grind — One-Cycle Contract (READ FULLY, THEN DO EXACTLY ONE CYCLE)

Repo: C:\Users\caleb\AppData\Local\arcade-hub (branch main). Windows PowerShell 5.1 shell.

## The kit (already built — games/kit/juicekit.js)
Global window.Kit after load. API:
- Kit.burst(clientX, clientY, color, n) — particle pop
- Kit.text(clientX, clientY, str, color, size) — floating pop text (use for +SCORE, COMBO!, NEAR MISS!)
- Kit.shake() — body shake
- Kit.flash(color) — full-screen flash
- Kit.hit(clientX, clientY, val) — captures + auto-combo (3x shows COMBO!, 5x shakes). Use on every score.
- Kit.click() — button blip
- Kit.win(title, sub) / Kit.lose(title, sub) — trophy/skull card + confetti + fanfare/sting
- Kit.confetti(n)
- Kit.center(el) -> {x,y} client coords — for effects anchored to elements

## Screenshot truth
This machine runs Windows at 125% display scale: headless --window-size=420 renders a 336-CSS-px viewport (clipping artifacts). For a true 390-CSS-px phone capture use --window-size=488,1055. When a screenshot looks wrong, MEASURE before believing: iframe probe reading getBoundingClientRect + innerWidth is ground truth.

## Cycle steps

## CONCURRENCY GUARD
Another agent may commit to this repo while you work. Before editing queue.jsonl, RE-READ it fresh from disk, change only your task's line, write, and commit immediately. If `git push` is rejected, run `git pull --rebase` (commit your staged work first) and push again. Never rewrite lines you did not touch.

## ANTI-HALLUCINATION (CRITICAL)
- NEVER write a commit hash into the ledger you have not obtained from `git log -1 --format=%h` AFTER your commit.
- The runner diffs HEAD before/after your session: no new commit = CYCLE-NOOP logged, your claims ignored. Do the work, do not narrate it.
- If you cannot finish, leave the task pending. Saying "done" without a commit is sabotage.
1. Read _loop/queue.jsonl. Take the LOWEST-id line with "status":"pending". That's the task.
   If none -> write _loop/DONE.txt, run: schtasks /Change /TN ArcadeJuiceLoop /Disable. Report. STOP.
2. Read games/<task.game> SURGICALLY (grep, then targeted line ranges). If it already has
   `kit/juicekit.js`, skip integration and do the task's theme as a DEEPENING pass.
3. Make the change per task.theme:
   - pass 1 (kit): add `<script src="kit/juicekit.js"></script>` right after the game's
     main script tag opening; wire Kit.hit into its score/capture events, Kit.win/lose
     into game-over, Kit.click into buttons. Keep diff < 60 lines.
   - later passes: audit and improve that theme in that game (see queue task text).
   HARD RULES: no comments; keep phone-first layout; effects event-driven, bounded DOM
   (remove on animationend); respect localStorage 'gamesMuted' (kit does this already);
   never break existing gameplay; never touch other games' files.
4. VERIFY (all must pass, fix up to 2 attempts):
   $p = "<abs path to game>" -replace '\\','/'
   $out = & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --enable-logging=stderr --v=0 --window-size=420,860 --virtual-time-budget=5000 --screenshot="$env:LOCALAPPDATA\arcade-hub\_loop\shots\last.png" --dump-dom "file:///$p" 2>&1 | Out-String
   - $out must contain ZERO "Uncaught" (console ERROR lines) — INFO AudioContext notices are OK.
   - View _loop/shots/last.png: must not be blank/black; game UI visible.
5. Update queue.jsonl (set that task status":"done"). Append one line to _loop/ledger.jsonl:
   {"cycle":N,"task_id":ID,"game":"x.html","pass":P,"theme":"...","status":"done","commit":"sha","tests":"ok"}
6. git add games/<file> _loop/queue.jsonl _loop/ledger.jsonl ; git commit -m "juice: <game> pass<P> — <theme>" ; git push.
   (If push fails, commit anyway; note it in ledger.)
7. STOP. Do one cycle per session invocation unless told otherwise.

## Revert protocol
If verification fails twice: git checkout -- games/<file>; mark task status":"blocked"
with reason in ledger; commit queue/ledger only; leave for human. 3 consecutive blocked
tasks in a row = stop and report to Caleb.
