# In That Zone: the learning zone

The nine learning games in this hub (four maths, five spelling and English) live together in `zone/`, shaped like
a Cool Math Games section: a landing page with shelves and skill filters, and one game page per title with a
Controls box, a goal line, How to play, Tips, Skills tags, two "You'll also like" tiles, the saved best and a
Play Big Screen button. The games themselves are untouched apart from the small lines listed under
"Changes inside the games"; the zone wraps them in an `<iframe>`.

- Live: https://calebhomwe.github.io/arcade-hub/zone/ (GitHub Pages, from `main`)
- Local: `python3 -m http.server 8080` in the repo root, then http://localhost:8080/zone/
- Check: `node tools/zone-check.mjs` (the `zone-check` job in `.github/workflows/smoke.yml` runs it on every push and PR)

## Files

| Path | What it is |
| --- | --- |
| `zone/games.json` | The catalog. `zone.name` ("In That Zone") and `zone.tagline` live here and nowhere else in the zone pages; `shelves` names the two rows; `games` has one entry per learning game. |
| `zone/index.html` | Landing page: zone name and tagline, All / Maths / Spelling & English filter, one row per shelf with a game count, tiles (emoji, title, tagline, skill tags), 🎲 Random game, Back to the arcade. |
| `zone/play.html?g=<id>` | Game page: breadcrumb (zone › shelf › title), title, the game in an iframe, ⛶ Play Big Screen, Controls, How to play (goal line first), Tips, Skills, You'll also like, Best so far. An unknown or missing `g` shows a message plus every tile. |
| `zone/zone.css`, `zone/zone.js` | Shared styles and the catalog loader / tile renderer. Plain ES2018, no build step, no scripts, fonts or analytics from outside the repo. |
| `tools/zone-check.mjs` | The Playwright check described below. |
| `index.html` | The hub gained one banner at the top of `<main>` linking to `zone/`; the existing categories and cards are unchanged. |

The static `<title>` of `zone/index.html` and `zone/play.html` is `Arcade Hub`, the hub's own, until the catalog loads
(`zone/index.html` then sets `document.title = d.zone.name`, `zone/play.html` sets the game title and the zone name), so
the zone's name is written in `games.json` only.

## How to add a game

Edit `zone/games.json` only. Append one entry to `games`:

| Field | Rule |
| --- | --- |
| `id` | URL slug, used as `play.html?g=<id>` and in `alsoLike`. |
| `file` | The page under `games/`, for example `math-blast.html`. The check fetches it and fails on anything but HTTP 200. |
| `title`, `icon`, `shelf` | Display name, the emoji used on the hub card, `maths` or `spelling`. |
| `tagline` | One line about this game only: what you do and what counts. Read it from the game's win / lose code, not from the genre. |
| `skills` | 2 or 3 tags in Cool Math Games vocabulary (Addition / Subtraction, Multiplication / Division, Mental Maths, Spelling, Vocabulary, Phonics, Reaction Time, Problem Solving, Memory). The check fails on any other count. |
| `controls` | Short lines with the exact keys and taps, copied from the game's `keydown` / pointer handlers. |
| `howToPlay` | The goal line first ("what counts as winning this run"), then 2–4 steps. |
| `tips` | 2 or 3 specific tips with the numbers from the code. |
| `bestKey` | The `localStorage` key the game writes its best to, or `null` when it has none. Never invent one: the page only shows "Best so far" when that key holds a value. |
| `alsoLike` | Two sibling ids; the default is the next two on the same shelf. |

Then run `node tools/zone-check.mjs`. Nothing else needs editing: the landing page, the filter, the shelf counts
and the random button all come from the catalog.

## The catalog

| id | Shelf | Title | Skills | bestKey | Also like |
| --- | --- | --- | --- | --- | --- |
| `math-blast` | Maths | Math Blast | Addition / Subtraction · Multiplication / Division · Reaction Time | `mathBlastBest` | math-run, math-snake |
| `math-run` | Maths | Math Run | Addition / Subtraction · Multiplication / Division · Reaction Time | `mathRunBest` | math-snake, math-battle |
| `math-snake` | Maths | Math Snake | Addition / Subtraction · Multiplication / Division · Problem Solving | `mathSnakeBest` | math-battle, math-blast |
| `math-battle` | Maths | Math Battle | Mental Maths · Multiplication / Division · Problem Solving | `mathBattleBest` (kills) | math-blast, math-run |
| `word-scramble` | Spelling & English | Word Scramble | Spelling · Phonics · Vocabulary | `ws_best` | hangman, missing-letter |
| `hangman` | Spelling & English | Hangman | Spelling · Vocabulary · Problem Solving | `hg_best` | missing-letter, spell-and-say |
| `missing-letter` | Spelling & English | Missing Letter | Spelling · Phonics · Reaction Time | `ml_best` | spell-and-say, rhyme-time |
| `spell-and-say` | Spelling & English | Spell & Say | Spelling · Phonics · Vocabulary | `ss_best` | rhyme-time, word-scramble |
| `rhyme-time` | Spelling & English | Rhyme Time | Phonics · Vocabulary · Reaction Time | `rt_best` | word-scramble, hangman |

Every `bestKey` is the key the game's own code writes: `saveLS('mathBlastBest',best)` (math-blast.html:415),
`saveLS('mathRunBest',best)` (math-run.html:396), `saveLS('mathSnakeBest',best)` (math-snake.html:430),
`saveLS('mathBattleBest',bestKills)` (math-battle.html:397), `localStorage.setItem('ws_best', …)` (word-scramble.html:178),
`localStorage.setItem('hg_best', …)` (hangman.html:183), `lsSet('ml_best', …)` (missing-letter.html:182),
`lsSet('ss_best', …)` (spell-and-say.html:204), `localStorage.setItem('rt_best', …)` (rhyme-time.html:457).

## The zone standard, game by game

The 14 lines are from `docs/LEARNING_ZONE_BENCHMARK.md` in the programme repo. ✔ met, ~ partly, ✘ missing. Each cell
is one piece of evidence: a `file:line` in the game, a line in the wrapper, or a check result quoted below. "via
wrapper" means `zone/play.html` supplies it for every game (Z2 Controls + How to play, Z9 Skills, Z10 Play Big
Screen, Z14 tile with tagline, tags and also-like); "via SDK" means the optional arcade SDK every game loads
first (`<script src="https://calebhomwe.github.io/arcade/assets/arcade-sdk.js">`, line 5 or 6 of each game) supplies it:
it pauses on `visibilitychange` and freezes timers (arcade-sdk.js:330, 217) and draws a pause button after
`SDK.init` (arcade-sdk.js:534, 366–374). Line numbers are for the files as committed here.

Legend for the short cells: **ctl** = controls handlers, **goal** = first-screen goal line, **again/menu** = end-screen
buttons, **best** = where the saved best is read and shown, **lvl** = visible ladder, **miss** = what a miss shows.

### Maths

| # | Math Blast | Math Run | Math Snake | Math Battle |
| --- | --- | --- | --- | --- |
| Z1 | ✔ check: frame ready, see results; ctl pointerdown :474, keys 1–4 :485 | ✔ check; tap/swipe :507, ← → A D :523 | ✔ check; swipe :520–529, d-pad :111–116 + :542, arrows/WASD :533 | ✔ check; tap :265, keys 1–4 :514 |
| Z2 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z3 | ✔ goal :78 "Pop the bubble with the correct answer before it floats away" + "▶ Start (60s)" :84 | ✔ goal :76 "run through the correct answer gate! Wrong gate = lose a ❤️. You have 3!" | ✔ goal :92 "Eat the number that matches the answer. Wrong number = lose a ❤️" | ✔ goal :133 "Answer right to attack! … defeat bosses every 5 kills" |
| Z4 | ✔ Play Again :97; 🏠 Menu :98 → `toTitle()` :491 (added here) | ✔ Play Again :92; 🏠 Menu :93 → `toTitle()` :534 (added) | ✔ Play Again :108; 🏠 Menu :109 → `toTitle()` :545 (added) | ✔ Revive :151, New Run :152; 🏠 Menu :153 → `load();toTitle()` :496 (added) |
| Z5 | ✔ `loadLS('mathBlastBest')` in try/catch :115, :125; shown on the menu :427, :499 | ✔ `getLS('mathRunBest')` try/catch :104, :117; shown on the menu :79, :397, :543 (added) | ✔ `readLS('mathSnakeBest')` try/catch :128, :138; shown on the menu :95, :431, :556 (added) | ✔ try/catch read :176; shown on the menu :134, set in `toTitle()` :456 and at load :521 |
| Z6 | ✔ XP level + unlock ladder "Next unlock: HARD at Lv 3" :83, :408–411 | ✔ same ladder :80–81, :410–413 | ✔ same ladder :96–97, :444–447 | ✔ player Lv + XP bar :102–104, bosses every 5 kills :306, tier unlocks :515–517 |
| Z7 | ✔ wrong pop circles the right bubble for 1.6 s :402–404, drawn :340–343; buzz + shake :398 | ✔ "It was N" :389 and the right gate is highlighted :390, :334–346 | ✔ "It was N" after a wrong bite :422 (added); after 2 misses the right number glows :421 | ✔ right button marked `good` on every answer :411, wrong one `bad` :414 |
| Z8 | ✔ + − × ÷ toggles :492 and 5 tiers with number ranges :106 | ✔ toggles :536, tiers :99 | ✔ toggles :547, tiers :121 | ~ 5 tiers :159 but the operation is always random :246 |
| Z9 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z10 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z11 | ✔ no ads or chat; the only external script is the arcade SDK, optional: `SDK=window.ArcadeSDK\|\|null` :108. Its own "← Hub" link :58 (`position:fixed`, z-index 40 :12) opened the whole arcade inside the zone's frame (critic's probe, see "Fixed after review"); `zone/play.html:108–115` now hides it when framed and the check asserts it | ✔ same guard :100; "← Hub" :54 hidden by the zone page likewise | ✔ same guard :122; "← Hub" :69 hidden likewise | ✔ same guard :160; "← Hub" :95 hidden likewise |
| Z12 | ✔ via SDK; own fallback pauses on hidden :497, Resume button :100 | ✔ via SDK; fallback :541 | ✔ via SDK; fallback :551 and its own ⏸ button :552 | ✔ via SDK; fallback :527 |
| Z13 | ~ a run is a fixed 60 s (`ROUND=60` :104), under the 2-minute floor; replay reason: best, XP, gold rank | ~ not verified: 3 hearts, no clock; replay reason: medals every 10 gates :436, gem bank | ~ not verified: 3 hearts, no clock; replay reason: trophies :142, XP | ~ not verified: HP-based run; replay reason: saved level/gold/gear :418–434 |
| Z14 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |

### Spelling & English

| # | Word Scramble | Hangman | Missing Letter | Spell & Say | Rhyme Time |
| --- | --- | --- | --- | --- | --- |
| Z1 | ✔ check; tap :124, letters + Backspace :217–218 | ✔ check; keyboard click :283, typed letters :519 | ✔ check; click :256, keys 1–4 or the letter :434–438 | ✔ check; click :300, typed :513–515 | ✔ check; DROP :593, Enter :599, text input :134 |
| Z2 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z3 | ✔ title tagline "Spell the picture!" :237; Help panel :249 | ✔ :88 "Guess the hidden word letter by letter. 7 wrong guesses and the hangman is complete!" | ✔ :88 "Pick the right one from 4 options before the 60-second clock hits zero" | ✔ :106 "spell it with the on-screen keyboard. 3 mistakes and it's game over!" | ✔ :96 "type a word that RHYMES with it before the bar empties" |
| Z4 | ✔ result panel: Next level / Play again / Levels :187–188 | ✔ Play Again :146, Change Category :147 → `toTitle()` | ✔ Play Again :136, Menu :137 | ✔ Play Again :150, Menu :151 | ✔ RUN IT BACK :149, Change Beat :150 → `toTitle()` |
| Z5 | ~ stars per level and `ws_best` saved in try/catch (:177–178, kidskit.js:206) but shown on the Levels map header (kidskit.js:300), not on the title | ✔ `hg_best` read :182, shown :102, :498; blocked storage is shimmed to memory :5 | ✔ `lsGet('ml_best')` try/catch :160, :181; shown :89, :421 | ✔ `lsGet('ss_best')` try/catch :193, :201; shown :107, :473 | ✔ `rt_best` read :354, shown :111, :587; storage shim :5 |
| Z6 | ✔ 15-level map with stars :87–88, :241 | ~ word-length pick :98–100 and words lengthen over the 5 rounds :290–297; achievements :191–202; no named stages or map | ~ Climb steps 3 → 5 → 6 letters every 6 correct :199; medals :170; no visible stage name | ✔ LV + XP bar and tier unlocks :109, :179, :187 | ~ Starter / Climb / Pro :113–115 and Climb widens the pool at rounds 5 and 12 :413; only a round counter |
| Z7 | ~ a wrong letter wobbles back (strict levels) :141 and a wrong word is returned :145–146, but the spelling is not shown; the next letter glows after 9 s idle :209 | ✔ the word is revealed on the 7th miss :354–355 | ✔ the right option is marked and the gap is filled :308–309, :324–325 | ✔ "Almost! It's WORD" and wrong boxes marked :373–375 | ✔ "✘ no rhyme — e.g. HAT" :476; timeout shows an example too :485 |
| Z8 | ✔ levels by word length, 3 to 7–9 letters :85, :88 | ✔ 4 categories :91–94 and 3 word lengths :98–100 | ✔ 3 / 5 / 6 letters or Climb :97–100 | ✔ 5 tiers by length, 3–4 up to 7–9 :114–118 | ✔ Starter / Climb / Pro pools :413 |
| Z9 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z10 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z11 | ✔ SDK optional (`SDK = window.ArcadeSDK \|\| null` :73); pictures, textures and speech are local or built in; the kit drops its own hub link when framed (kidskit.js:19, :396) | ✔ guard :165; "← Hub" :82 (z-index 50 :15) opened the arcade inside the zone's frame (critic's probe); hidden by `zone/play.html:108–115` when framed, see "Fixed after review" | ✔ guard :148; runs with the SDK blocked (probe below); "← Hub" :82 hidden likewise | ✔ guard :163; speech is the browser's own `speechSynthesis`; "← Hub" :100 hidden likewise | ✔ guard :328; "Load your beat" reads a local file, no upload :565–579; "← Hub" :90 hidden likewise |
| Z12 | ✔ via SDK (pause button + hidden-tab pause); no timer of its own, so a tab switch loses nothing without it | ✔ via SDK; no timer of its own | ✔ via SDK; own clock now also stops while the tab is hidden :349 (added) | ✔ via SDK; own handler cancels speech on hide and resumes on return :517 | ✔ via SDK; own handler pauses the bar and the beat :602–606 |
| Z13 | ~ not verified: 5 words a level, no clock; replay reason: next level, stars, tiles | ~ not verified: 5 rounds; replay reason: streak, achievements | ~ a run is a fixed 60 s (`DURATION=60` :158); replay reason: medals, emoji book | ~ not verified: 3 hearts; replay reason: XP tiers, badges, weekly goal | ~ not verified: 3 hearts; replay reason: best chain, deepest round |
| Z14 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |

Totals (✔ / ~ / ✘ of 14): Math Blast 13/1/0 · Math Run 13/1/0 · Math Snake 13/1/0 · Math Battle 12/2/0 ·
Word Scramble 11/3/0 · Hangman 12/2/0 · Missing Letter 12/2/0 · Spell & Say 13/1/0 · Rhyme Time 12/2/0.

## Changes inside the games

One commit per game, each with the before/after probe in its message. The probe script drove each game directly in
headless Chromium (`games/<file>`, not through the zone) and read the DOM.

| Game | Line | Change | Before → after |
| --- | --- | --- | --- |
| Math Blast | Z4 | 🏠 Menu button on the Time's Up screen, calls the game's own `toTitle()` | end-screen buttons `["Play Again"]` → `["Play Again","🏠 Menu"]`, Menu shows `#start` |
| Math Run | Z4, Z5 | 🏠 Menu button on the Crashed screen; `#startBest` line on the title, set at load and at game over | buttons `["Play Again"]` → `["Play Again","🏠 Menu"]`; with `mathRunBest=42` saved the title showed nothing → "🏆 Best: 42" |
| Math Snake | Z4, Z5, Z7 | 🏠 Menu button; `#startBest` on the title; after a wrong bite the message line says "It was N · …" (same wording as Math Run :389) | buttons `["Play Again"]` → `["Play Again","🏠 Menu"]`; title best missing → "🏆 Best: 42"; wrong bite (answer 7, ate 5) message "You can do it! 🌈" → "It was 7 · …" |
| Math Battle | Z4 | 🏠 Menu button on the Defeated screen: `load()` (the last save, exactly what a page reload restores) then `toTitle()` | buttons `["❤️ Revive (-25g)","🔄 New Run"]` → `[…,"🏠 Menu"]`, Menu shows `#start` |
| Missing Letter | Z12 | `tick()` also returns while `document.hidden` (:349), so the 60-second clock stops when the tab is hidden even without the arcade SDK | Replayed by the finisher on the pre-change page (git 0ee3993) and the committed one, SDK host aborted (`window.ArcadeSDK` undefined), first-run coach already seen (`ml_tut=1`, no `.pk-card` on screen), `document.hidden` forced true for 2.5 s: before, HUD clock 59 → 57 (time bar 58.7 → 56.7 s); after, 59 → 59 (58.8 → 58.8 s). In a fresh profile the clock reads 60 both ways because the coach holds `tick()` (`coachOn()`), which is why the critic's replay was inconclusive. |

Nothing else in the games changed: no rules, balance, art or copy.

## Fixed after review (zone side, no game edits)

| Where | Defect | Fix | Before → after |
| --- | --- | --- | --- |
| `zone/play.html`, `tools/zone-check.mjs` | Eight games' own "← Hub" link (`href="../index.html"`: math-blast.html:58, math-run.html:54, math-snake.html:69, math-battle.html:95, hangman.html:82, missing-letter.html:82, spell-and-say.html:100, rhyme-time.html:90; `position:fixed`, z-index 40–50) navigates inside the iframe, so the whole arcade opened inside the game frame while the page still named the game. Word Scramble's kit already hides its link when framed (kidskit.js:19, :396). Found by the critic. | `play.html:108–115`: on the iframe's `load` event, inside try/catch, every `a[href="../index.html"]` in the frame document gets `display:none !important` (a `hidden` attribute would lose to the games' own `display:inline-flex` rule). The check asserts that the frame document shows no visible link to `../index.html`. | Check with the assertion added and `play.html` unfixed (shared box, load 23.3): **6/15, exit 1**, "the game document shows a link to the arcade (../index.html) inside the frame: ← Hub" on the eight games and the phone run; Word Scramble passed. Fix applied (load 17.5): **15/15, exit 0**. Probe on `zone/play.html?g=math-blast` and `?g=hangman` at 1280×800: before, the link had computed `display: flex`, 68×44 / 81×44 px, and a click left the frame at `/index.html` with h1 "ARCADE HUB" and 38 `a.card`; after, `display: none`, 0×0, nothing to click, frame still at `/games/<game>.html`. |

## Gaps (for the owner to decide; not done here)

| Game | Line | Effort | Why |
| --- | --- | --- | --- |
| Math Battle | Z8 | S | `genProblem` always picks a random operation (math-battle.html:246); the other three maths games have + − × ÷ toggles. Adding the same `ops` row is ~15 lines but changes the title screen. |
| Word Scramble | Z5 | S | The title shows stars and the weekly stamps but not a best; `P.d.hi` / `ws_best` exist. Showing it means editing the shared `KK.ui.title` in `games/kit/kidskit.js`, which five other games use. |
| Word Scramble | Z7 | S | After a wrong whole-word check the tiles return with no spelling shown (:145–146); saying the word or glowing the first wrong slot is ~5 lines but is a copy/behaviour change to the kids' kit style. |
| Hangman, Missing Letter, Rhyme Time | Z6 | M | A difficulty pick exists but no visible stage ladder (named levels, stars or a map); a level map like Word Scramble's is a feature, not a line. |
| Math Blast, Missing Letter | Z13 | M | Fixed 60-second rounds are under the 2–5 minute target; longer or chained rounds is a balance decision. |
| All nine | Z13 | — | Run length for the lives-based games was not measured in this pass; needs a play session, not a code read. |
| Math Battle | Z4 | S | 🏠 Menu on the Defeated screen is a free continue: its handler (:496) calls `load()`, which restores the save written at the last kill (:375), and `startGame` (:436) never resets `kills` or `P`; only `resetRun` (:486) does. The critic reproduced it driving `games/math-battle.html` with a save of level 3, hp 30, gold 100, 7 kills: `onDeath()` → Menu → Start gave state `play` with kills 7, hp 30, gold 100, beside the 25-gold Revive. Identical to F5 (`load()` at :520), so not a new rule, but one tap. Honouring the rule means Menu = `resetRun` without a save, or a confirm: a rule change for the owner. |
| All nine (zone) | Z2 | — | Left as is: keys reach the game only once the frame is clicked or tabbed into. Critic's probe on `zone/play.html?g=math-blast`: `1` pressed right after load went to the parent document (activeElement `BODY`, no keydown in the frame); after clicking Start inside the frame `2` reached the game, and after Play Big Screen `3` did (`play.html` calls `frame.focus()` on entering). Tab order reaches the frame (zone crumb › shelf crumb › All games › iframe). Cool Math Games pages behave the same, and auto-focusing the frame on load would scroll the page for every visitor, so nothing was changed. The Controls copy could add "click the game first" (nine catalog edits). |
| All nine (check) | — | S | `tools/zone-check.mjs` needs https://calebhomwe.github.io/arcade/assets/arcade-sdk.js to be reachable: every game loads it (line 5 or 6) and a blocked fetch logs `Failed to load resource: net::ERR_FAILED`, which the check counts as a console error on all nine game pages even though the games run without the SDK (critic's probe with that host aborted: start button present, canvas drawn, `window.ArcadeSDK` undefined). A hermetic mode (route that URL to an empty `text/javascript` body) is a few lines; the live-SDK run would stay as a separate mode. |
| All nine (zone) | Z12 | S | The zone page has no Pause button of its own; the SDK's pause button inside the frame covers it, but when `arcade-sdk.js` is unreachable only the games' own fallbacks remain. `play.html` could post `{type:'pause'}` to the frame (arcade-sdk.js:458). |

## The check: `tools/zone-check.mjs`

The script serves the repo root on a random port and opens the zone in headless Chromium (Playwright). Every
failure is printed and the exit code is 1; there is no tolerance list and no `continue-on-error`.

What it asserts:

- `zone/games.json` as served parses and has at least one game.
- `zone/index.html` renders exactly one tile per catalog entry (and one for each id), the zone name on the page equals
  `zone.name`, every shelf row's count matches its tiles and the catalog, the Random game button and the
  "Back to the arcade" link exist, every tile `href` fetches with HTTP 200, and every catalog `file` fetches from
  `games/` with HTTP 200.
- For every id, `zone/play.html?g=<id>`: zero page errors, zero console errors and no same-origin 4xx/5xx while
  loading; the iframe's document reaches `readyState complete` with a canvas or a non-empty body; the title and
  breadcrumb show the game and zone names; Controls has at least one line; How to play has a goal line and at
  least two steps; Tips is non-empty; Skills shows 2 or 3 tags; You'll also like has exactly two links to valid,
  different ids; the Play Big Screen button exists; the Best line stays hidden in a fresh browser profile (nothing
  saved, so no number may be shown); the game document shows no visible link to `../index.html` (the games' own
  "← Hub" link, which the zone page hides on the frame's load event).
- `zone/play.html?g=not-a-real-game` and `zone/play.html` with no `g` show the fallback section naming the id,
  listing every tile, and create no iframe.
- Phone viewport 390×844: the landing page and the first game page have no horizontal overflow (`scrollWidth`
  of the document and body, plus the bounding box of every tile, box, frame, heading and bar).

Fault modes prove the check can fail: `--fault missing-file` serves the catalog with the first entry's `file`
pointing at a page that does not exist; `--fault broken-json` serves invalid JSON. Both must exit 1.

CI: the `zone-check` job in `.github/workflows/smoke.yml` installs `playwright@1.58.2` and Chromium exactly like
the `smoke` job and runs `node tools/zone-check.mjs`. The workflow runs on pull requests, on pushes to `main` and by
hand (`workflow_dispatch`). First run on GitHub: run 38318856705 (`pull_request` on PR #6, head b0a27fe, started
2026-10-12 22:49 UTC), job `zone-check` **success**,
https://github.com/calebhomwe/arcade-hub/actions/runs/38318856705/job/115041885778 (read with
`gh run view 38318856705 --json jobs` while the `smoke` job of the same run was still in progress). The run on the
finished branch tip is recorded below under "Check results".

## Check results (shared 4-CPU box, load noted)

Final code (commit 5d17dc2: the frame-link assertion in the check and the hide in `play.html`), run by the finisher.
The box's 1-minute load stayed between 12 and 25 through these runs (eight agents share its 4 CPUs; it did not drop
under 8 in a 25-minute wait), so every frame-ready time below is an upper bound under load, not evidence for or
against Z1:

- `node tools/zone-check.mjs`, load 17.5: exit **0**, `15/15 checks passed`, frame ready 572–2457 ms.
- `node tools/zone-check.mjs --fault missing-file`, load 12.1: exit **1**, `11/15 checks passed`. The four failures:
  the landing page, desktop and phone (`math-blast: games/this-file-does-not-exist.html -> HTTP 404`), and the
  math-blast game page, desktop and phone (`404 /games/this-file-does-not-exist.html` plus the console error).
- `node tools/zone-check.mjs --fault broken-json`, load 22.7: exit **1**, `0/15 checks passed` (15 FAIL lines), first
  failure `served games.json is not valid JSON: Expected ',' or '}' after property value in JSON at position 60`.
- The CI step text, `bash --noprofile --norc -eo pipefail -c 'node tools/zone-check.mjs'`, load 24.8: exit **0**,
  `15/15 checks passed`, frame ready 813–7078 ms. The 7078 ms is math-blast at load 25; the same page took 2457 ms at
  load 17.5 and 1794 ms at load 7.24 (the builder's run below).

The builder's runs on the first build (b0a27fe, before the frame-link assertion) at a quieter load, kept for reference:

Clean run, `node tools/zone-check.mjs`, started at load average 7.24 (`uptime` 22:35:02), exit **0**:

```
ok   zone/games.json  (9 entries)
ok   zone/index.html
ok   zone/play.html?g=math-blast  (frame ready in 1794 ms)
ok   zone/play.html?g=math-run  (frame ready in 1094 ms)
ok   zone/play.html?g=math-snake  (frame ready in 1221 ms)
ok   zone/play.html?g=math-battle  (frame ready in 1244 ms)
ok   zone/play.html?g=word-scramble  (frame ready in 1167 ms)
ok   zone/play.html?g=hangman  (frame ready in 557 ms)
ok   zone/play.html?g=missing-letter  (frame ready in 525 ms)
ok   zone/play.html?g=spell-and-say  (frame ready in 1930 ms)
ok   zone/play.html?g=rhyme-time  (frame ready in 738 ms)
ok   zone/play.html?g=not-a-real-game
ok   zone/play.html (no ?g=)
ok   zone/index.html  [phone 390x844]
ok   zone/play.html?g=math-blast  [phone 390x844]  (frame ready in 645 ms)
15/15 checks passed
```

"frame ready" is the time from navigating to the zone page until the game's document inside the iframe was
`complete` with a canvas or text: 525–1930 ms for all nine, under the 3-second line of Z1. These times were taken
on the shared box with the real arcade SDK fetched from github.io; they are an upper bound, not a benchmark.

Fault `--fault missing-file` (the first catalog entry's `file` served as `this-file-does-not-exist.html`), started at
load 7.80, exit **1**, `11/15 checks passed`. The four failures:

```
FAIL zone/index.html
     math-blast: games/this-file-does-not-exist.html -> HTTP 404
FAIL zone/play.html?g=math-blast  (frame ready in 279 ms)
     404 /games/this-file-does-not-exist.html
     console error: Failed to load resource: the server responded with a status of 404 (Not Found)
FAIL zone/play.html?g=math-blast  [phone 390x844]  (frame ready in 160 ms)
     404 /games/this-file-does-not-exist.html
     console error: Failed to load resource: the server responded with a status of 404 (Not Found)
11/15 checks passed  (fault: missing-file; this run is expected to fail)
```

(the fourth failed line is the landing page at phone width, same 404.)

Fault `--fault broken-json` (games.json served as invalid JSON), started at load 7.58, exit **1**,
`0/15 checks passed`. First lines:

```
FAIL zone/games.json
     served games.json is not valid JSON: Expected ',' or '}' after property value in JSON at position 60 (line 1 column 61)
FAIL zone/index.html
     landing shows an error: Could not load the game list (zone/games.json): games.json is not valid JSON (...)
     landing renders 0 tiles, the catalog has 9
     ...
FAIL zone/play.html?g=math-blast  (frame ready in 131 ms)
     no game iframe on the page
     Controls box is empty
     How to play has no goal line
     ...
FAIL zone/play.html?g=not-a-real-game
     the fallback section is not shown
0/15 checks passed  (fault: broken-json; this run is expected to fail)
```

The builder's run of the CI step text, `bash --noprofile --norc -eo pipefail -c 'node tools/zone-check.mjs'`, started
at load 7.93: exit **0**, `15/15 checks passed`, frame ready 492–1705 ms for eight games and 3140 ms for math-snake at
load 7.9–9.0 (not evidence against Z1; the clean run above had math-snake at 1221 ms). The finisher's run of the same
text on the final code is the last bullet at the top of this section. The job's other two steps (`npm install
--no-save --no-package-lock playwright@1.58.2`, `npx playwright install --with-deps chromium`) were not run on the box
(local runs use Playwright 1.56.1 from `/opt/node-tools`); they ran on GitHub in the workflow runs below.

### Runs on GitHub (`gh run view <id> --json jobs`)

- Run 38318856705, `pull_request` on PR #6, head b0a27fe (the builder's tip, before the frame-link assertion),
  started 2026-10-12 22:49 UTC: job `zone-check` **success**, job `smoke` **success**.
  https://github.com/calebhomwe/arcade-hub/actions/runs/38318856705
- Run 38322718829, `pull_request` on PR #6, head 5d17dc2 (the final code), started 2026-10-12 23:33 UTC: job
  `zone-check` **success** (https://github.com/calebhomwe/arcade-hub/actions/runs/38322718829/job/115054269922);
  the `smoke` job was still in progress when this was written.
- This docs commit starts one more run on its own head; it changes no code and its result was not read here.

## Things the zone does not do yet

- No shared XP or stars across the zone's games (benchmark plan step 3, an owner decision).
- No thumbnails: tiles use the hub's emoji. Screenshots would be generated output and are not committed.
- No Like / Favorite, ratings or dates: nothing to put there honestly without a backend.
- No Pause button on the zone page itself (see the gaps table).
