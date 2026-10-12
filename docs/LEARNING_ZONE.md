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
| Z5 | ✔ `loadLS('mathBlastBest')` in try/catch :115, :125; shown on the menu :427, :499 | ✔ `getLS('mathRunBest')` try/catch :104, :117; shown on the menu :79, :397, :543 (added) | ✔ `readLS('mathSnakeBest')` try/catch :128, :138; shown on the menu :95, :431, :556 (added) | ✔ try/catch read :176; shown on the menu :134, :519 |
| Z6 | ✔ XP level + unlock ladder "Next unlock: HARD at Lv 3" :83, :408–411 | ✔ same ladder :80–81, :410–413 | ✔ same ladder :96–97, :444–447 | ✔ player Lv + XP bar :102–104, bosses every 5 kills :306, tier unlocks :515–517 |
| Z7 | ✔ wrong pop circles the right bubble for 1.6 s :402–404, drawn :340–343; buzz + shake :398 | ✔ "It was N" :389 and the right gate is highlighted :390, :334–346 | ✔ "It was N" after a wrong bite :422 (added); after 2 misses the right number glows :421 | ✔ right button marked `good` on every answer :411, wrong one `bad` :414 |
| Z8 | ✔ + − × ÷ toggles :492 and 5 tiers with number ranges :106 | ✔ toggles :536, tiers :99 | ✔ toggles :547, tiers :121 | ~ 5 tiers :159 but the operation is always random :246 |
| Z9 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z10 | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper | ✔ via wrapper |
| Z11 | ✔ no ads, chat or outbound links; the only external script is the arcade SDK, optional: `SDK=window.ArcadeSDK\|\|null` :108 | ✔ same guard :100 | ✔ same guard :122 | ✔ same guard :160 |
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
| Z11 | ✔ SDK optional (`SDK = window.ArcadeSDK \|\| null` :73); pictures, textures and speech are local or built in | ✔ guard :165 | ✔ guard :148; runs with the SDK blocked (probe below) | ✔ guard :163; speech is the browser's own `speechSynthesis` | ✔ guard :328; "Load your beat" reads a local file, no upload :565–579 |
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
| Missing Letter | Z12 | `tick()` also returns while `document.hidden`, so the 60-second clock stops when the tab is hidden even without the arcade SDK | SDK blocked, tab hidden for 2.5 s: clock 59 → 57 before, 59 → 59 after |

Nothing else in the games changed: no rules, balance, art or copy.

## Gaps (for the owner to decide; not done here)

| Game | Line | Effort | Why |
| --- | --- | --- | --- |
| Math Battle | Z8 | S | `genProblem` always picks a random operation (math-battle.html:246); the other three maths games have + − × ÷ toggles. Adding the same `ops` row is ~15 lines but changes the title screen. |
| Word Scramble | Z5 | S | The title shows stars and the weekly stamps but not a best; `P.d.hi` / `ws_best` exist. Showing it means editing the shared `KK.ui.title` in `games/kit/kidskit.js`, which five other games use. |
| Word Scramble | Z7 | S | After a wrong whole-word check the tiles return with no spelling shown (:145–146); saying the word or glowing the first wrong slot is ~5 lines but is a copy/behaviour change to the kids' kit style. |
| Hangman, Missing Letter, Rhyme Time | Z6 | M | A difficulty pick exists but no visible stage ladder (named levels, stars or a map); a level map like Word Scramble's is a feature, not a line. |
| Math Blast, Missing Letter | Z13 | M | Fixed 60-second rounds are under the 2–5 minute target; longer or chained rounds is a balance decision. |
| All nine | Z13 | — | Run length for the lives-based games was not measured in this pass; needs a play session, not a code read. |
| All nine (zone) | Z11 | S | Every game's own "← Hub" link (`href="../index.html"`, e.g. math-blast.html:58) navigates inside the iframe when played from the zone, so the hub opens inside the game frame. Word Scramble hides it in a frame already (kidskit.js:396). Hiding it when `window.parent !== window` is one line per game. |
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
  saved, so no number may be shown).
- `zone/play.html?g=not-a-real-game` and `zone/play.html` with no `g` show the fallback section naming the id,
  listing every tile, and create no iframe.
- Phone viewport 390×844: the landing page and the first game page have no horizontal overflow (`scrollWidth`
  of the document and body, plus the bounding box of every tile, box, frame, heading and bar).

Fault modes prove the check can fail: `--fault missing-file` serves the catalog with the first entry's `file`
pointing at a page that does not exist; `--fault broken-json` serves invalid JSON. Both must exit 1.

CI: the `zone-check` job in `.github/workflows/smoke.yml` installs `playwright@1.58.2` and Chromium exactly like
the `smoke` job and runs `node tools/zone-check.mjs`.

## Check results (this build, shared 4-CPU box, load noted)

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

The CI step text, run locally as `bash --noprofile --norc -eo pipefail -c 'node tools/zone-check.mjs'`, started at
load 7.93, exit **0**, `15/15 checks passed`. In that run the frame-ready times were 492–1705 ms for eight games and
3140 ms for math-snake; the box's 1-minute load was 7.9–9.0 (eight agents share its 4 CPUs), so the one reading over
3 s is not evidence against Z1 and was not re-measured on a quiet box. The clean run above had math-snake at 1221 ms.
The job's other two steps (`npm install --no-save --no-package-lock playwright@1.58.2`, `npx playwright install
--with-deps chromium`) are the same text the existing `smoke` job already runs in CI and were not re-run here; the
local run used the box's Playwright 1.56.1 from `/opt/node-tools`.

## Things the zone does not do yet

- No shared XP or stars across the zone's games (benchmark plan step 3, an owner decision).
- No thumbnails: tiles use the hub's emoji. Screenshots would be generated output and are not committed.
- No Like / Favorite, ratings or dates: nothing to put there honestly without a backend.
- No Pause button on the zone page itself (see the gaps table).
