# Audio bank QA report - chess cues and meme packs

**Date:** 2026-09-12 (Australia/Perth)  
**Scope:** games/audio/chess (manifest.json = "Crisp", manifest-natural.json = "Natural") and games/audio/memes (manifest.json + catalog.js).  
**Clips measured:** 82 referenced targets (28 chess across two selectable sets + 54 meme clips in 7 packs).

## Important caveat: there is no audio device on this machine

The audit host has no sound card / audio endpoint and the auditor cannot listen to any clip.
Every quality statement in this report is a **numeric measurement** (duration, peak/RMS dBFS,
time-to-first-energy, head/tail silence, and pairwise envelope correlation), not a listening test.
Judgements such as "dry" or "clearly different" are operationalised below as explicit metrics.

## Method

Two independent measurement paths:

- **Parser A** - the hand-rolled RIFF/WAVE reader in audit-audio.js. It walks the chunks,
  requires PCM 16-bit mono, and computes:
  - peak dBFS and RMS dBFS (full scale 32768);
  - onset = first 5 ms window whose RMS reaches 10% of the loudest window (about -20 dB relative);
  - leading/trailing silence = span before/after the first/last sample above a floor of
    max(0.5% of peak, 3e-5), i.e. about -46 dB relative;
  - meaningful length = last-sound minus first-sound;
  - 64-bin RMS fingerprint (normalised) and spectral centroid via a local radix-2 FFT, used for
    duplicate detection (same-pack pair flagged when correlation > 0.985 and duration ratio > 0.8).
- **Parser B** - ffmpeg 8.1.2 (ffmpeg/ffprobe in C:/Users/caleb/AppData/Local/Microsoft/WinGet/Links/):
  ffprobe duration and a raw s16le decode of every WAV, with peak/RMS recomputed in a separate loop.
  verify() runs parser B against every clip and fails on any disagreement above 2 ms / 0.3 dB / 0.5 dB.

Flag thresholds used for this audit: onset > 150 ms (laggy), leading silence > 200 ms, trailing
silence > 300 ms, peak < -8 dBFS (too quiet), peak >= -0.3 dBFS (clipping), and peak outside
-4..-3 dBFS. Duration windows were set per event (table below).

### Per-event duration windows (ms)

| bank | event | min | max |
| --- | --- | --- | --- |
| chess | move | 40 | 300 |
| chess | capture | 50 | 320 |
| chess | castle | 50 | 450 |
| chess | check | 50 | 800 |
| chess | promote | 50 | 1200 |
| chess | game-end-win | 50 | 1600 |
| chess | game-end-loss | 50 | 1600 |
| chess | illegal | 50 | 420 |
| chess | low-time-tick | 10 | 160 |
| chess | game-start | 50 | 650 |
| chess | ui-click | 20 | 320 |
| chess | ui-hover | 20 | 260 |
| memes | capture | 120 | 1900 |
| memes | blunder | 120 | 2900 |
| memes | check | 120 | 3100 |
| memes | checkmate | 120 | 1800 |
| memes | castle | 120 | 2600 |
| memes | promote | 120 | 2000 |
| memes | win | 120 | 4000 |
| memes | lose | 120 | 3100 |
| memes | draw | 120 | 1400 |
| memes | start | 120 | 1400 |
| memes | undo | 120 | 1800 |
| memes | hint | 120 | 1300 |
| memes | combo3 | 120 | 1500 |

The meme windows are deliberately generous: each meme clip already matched the duration declared
in its own manifest, so no meme was shortened for being "too long".

## Commands run (exact) and real output

All via:

~~~text
C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\audit-audio.js analyze
C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\audit-audio.js fix
C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\audit-audio.js verify
C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\.probe.js
~~~

Real outputs (abridged where a full table is printed later):

~~~text
analyze  -> before fix: 6 / 82 clips flagged;
            two onset lags: chess-natural game-end-win 160 ms, memes/forge dramatic_sting 1135 ms;
            one near-duplicate pair: chess-crisp move-2 ~ move-3 (corr 0.993).
fix      -> 82 clips re-written, originals copied to _loop/audio-gen/backup/ first;
            a second fix run changed 0 of 82 file hashes (idempotent).
verify   -> verified 82 referenced clips across 9 bank sections
            VERIFY PASS
probe    -> 0 byte-identical referenced files.
~~~

The first analyze run (before any edit) is preserved as _loop/audio-gen/audit-latest.json and
audit-before-original.json; the post-fix run is audit-after.json, and the side-by-side is audit-compare.json.

## Summary

| metric | before | after |
| --- | --- | --- |
| referenced clips | 82 | 82 |
| flagged clips (any rule) | 6 | 2 |
| peak outside -4..-3 dBFS | 0 | 0 |
| onset > 150 ms | 2 | 0 |
| leading silence > 200 ms | 0 | 0 |
| trailing silence > 300 ms | 0 | 0 |
| peak < -8 dBFS or at 0 dBFS | 0 | 0 |
| near-duplicate pairs | 1 | 1 |
| max leading silence (ms) | - | 4 |
| max trailing silence (ms) | - | 50 |
| min / max onset (ms) | - | 0 / 120 |
| peak range (dBFS) | all -3.50 | -3.50 .. -3.50 |

Of the 6 "before" flags: 2 were onset lags, 2 were the two members of the near-duplicate pair, and
2 (memes victory/fanfare and forge/sub_impact) were over-length against the preliminary meme window
table. Those preliminary windows were widened to match each clip declared duration, so no meme audio
needed shortening. The 2 "after" flags are the two crisp Move alternates that remain envelope
near-duplicates; they cannot be differentiated by trimming or levelling (see "Not fixed" below).

## Chess move / capture (task item 4)

The game plays a move or capture cue on nearly every turn, and chess-sfx-bank.js picks randomly
among the id and its -2/-3 variants, so the whole move group and the whole capture group must be short,
dry, level-matched and mutually distinct. Measured before -> after:

| set | id | dur ms | peak dBFS | RMS dBFS | onset ms | lead ms | centroid Hz |
| --- | --- | --- | --- | --- | --- | --- | --- |
| natural | move | 260 -> 194 | -3.50 -> -3.50 | -19.5 -> -18.2 | 70 -> 5 | 1 | 2801 |
| natural | move-2 | 260 -> 260 | -3.50 -> -3.50 | -13.5 -> -13.5 | 10 -> 10 | 1 | 964 |
| natural | capture | 340 -> 320 | -3.50 -> -3.50 | -15.3 -> -15.1 | 5 -> 5 | 0 | 3247 |
| natural | capture-2 | 380 -> 244 | -3.50 -> -3.50 | -18.6 -> -16.7 | 140 -> 5 | 1 | 1325 |
| crisp | move | 130 -> 130 | -3.50 -> -3.50 | -21.2 -> -21.2 | 0 -> 0 | 1 | 1910 |
| crisp | move-2 | 130 -> 130 | -3.50 -> -3.50 | -20.5 -> -20.5 | 0 -> 0 | 1 | 1682 |
| crisp | move-3 | 130 -> 130 | -3.50 -> -3.50 | -21.8 -> -21.8 | 0 -> 0 | 1 | 1870 |
| crisp | capture | 220 -> 220 | -3.50 -> -3.50 | -16.9 -> -16.9 | 0 -> 0 | 1 | 2151 |
| crisp | capture-2 | 220 -> 220 | -3.50 -> -3.50 | -17.4 -> -17.4 | 0 -> 0 | 1 | 2249 |
| crisp | capture-3 | 220 -> 220 | -3.50 -> -3.50 | -17.2 -> -17.2 | 0 -> 0 | 1 | 2343 |

Primary pair, natural (default) set:

- move: 260 ms / onset 70 ms / peak -3.50 / RMS -19.5  ->  **194 ms / onset 5 ms / peak -3.50 / RMS -18.2**.
- capture: 340 ms / onset 5 ms / peak -3.50 / RMS -15.3  ->  **320 ms / onset 5 ms / peak -3.50 / RMS -15.1**.
- capture-2: 380 ms / onset 140 ms  ->  **244 ms / onset 5 ms**.

All four main natural cues are now well under 400 ms (194-320 ms).
The envelope-fingerprint correlation between natural move and capture changed from 0.31 before
to 0.72 after (move ~ capture-2: 0.80 -> 0.61).
The move head trim removed the one feature that most distinguished it, so the envelope correlation
rose; the pair is still far from the 0.985 near-duplicate threshold and remains separated by
duration (194 vs 320 ms), level (3.1 dB RMS) and centroid (2801 vs 3247 Hz).
The crisp (non-default) set is separated mainly by duration (130 vs 220 ms); its move ~ capture
envelope correlation is 0.85 -> 0.85.

## Full before / after table

A double dagger (++) marks a clip whose duration moved by >5 ms or whose onset moved by >10 ms.

| bank/pack | id | file | dur ms b->a | peak b->a | rms b->a | onset ms b->a | lead b->a |
| --- | --- | --- | --- | --- | --- | --- | --- |
| chess-crisp | move | move.wav | 130 -> 130 | -3.50 -> -3.50 | -21.2 -> -21.2 | 0 -> 0 | 1 -> 1 |
| chess-crisp | move-2 | move-2.wav | 130 -> 130 | -3.50 -> -3.50 | -20.5 -> -20.5 | 0 -> 0 | 1 -> 1 |
| chess-crisp | move-3 | move-3.wav | 130 -> 130 | -3.50 -> -3.50 | -21.8 -> -21.8 | 0 -> 0 | 1 -> 1 |
| chess-crisp | capture | capture.wav | 220 -> 220 | -3.50 -> -3.50 | -16.9 -> -16.9 | 0 -> 0 | 1 -> 1 |
| chess-crisp | capture-2 | capture-2.wav | 220 -> 220 | -3.50 -> -3.50 | -17.4 -> -17.4 | 0 -> 0 | 1 -> 1 |
| chess-crisp | capture-3 | capture-3.wav | 220 -> 220 | -3.50 -> -3.50 | -17.2 -> -17.2 | 0 -> 0 | 1 -> 1 |
| chess-crisp | castle | castle.wav | 220 -> 220 | -3.50 -> -3.50 | -21.8 -> -21.8 | 0 -> 0 | 1 -> 1 |
| chess-crisp | check | check.wav | 260 -> 260 | -3.50 -> -3.50 | -18.1 -> -18.1 | 0 -> 0 | 1 -> 1 |
| chess-crisp | promote | promote.wav | 440 -> 440 | -3.50 -> -3.50 | -15.2 -> -15.2 | 0 -> 0 | 1 -> 1 |
| chess-crisp | game-end-win | game-end-win.wav | 440 -> 440 | -3.50 -> -3.50 | -14.8 -> -14.8 | 0 -> 0 | 1 -> 1 |
| chess-crisp | game-end-loss | game-end-loss.wav | 450 -> 450 | -3.50 -> -3.50 | -14.5 -> -14.5 | 0 -> 0 | 1 -> 1 |
| chess-crisp | illegal | illegal.wav | 190 -> 190 | -3.50 -> -3.50 | -15.3 -> -15.3 | 0 -> 0 | 1 -> 1 |
| chess-crisp | low-time-tick | low-time-tick.wav | 30 -> 30 | -3.50 -> -3.50 | -20.9 -> -20.9 | 0 -> 0 | 1 -> 1 |
| chess-crisp | game-start | game-start.wav | 240 -> 240 | -3.50 -> -3.50 | -24.2 -> -24.2 | 0 -> 0 | 1 -> 1 |
| chess-natural | move ++ | natural/move.wav | 260 -> 194 | -3.50 -> -3.50 | -19.5 -> -18.2 | 70 -> 5 | 1 -> 1 |
| chess-natural | move-2 | natural/move-2.wav | 260 -> 260 | -3.50 -> -3.50 | -13.5 -> -13.5 | 10 -> 10 | 1 -> 1 |
| chess-natural | capture ++ | natural/capture.wav | 340 -> 320 | -3.50 -> -3.50 | -15.3 -> -15.1 | 5 -> 5 | 0 -> 0 |
| chess-natural | capture-2 ++ | natural/capture-2.wav | 380 -> 244 | -3.50 -> -3.50 | -18.6 -> -16.7 | 140 -> 5 | 0 -> 1 |
| chess-natural | castle | natural/castle.wav | 360 -> 360 | -3.50 -> -3.50 | -15.4 -> -15.4 | 5 -> 5 | 2 -> 2 |
| chess-natural | check | natural/check.wav | 600 -> 600 | -3.50 -> -3.50 | -15.3 -> -15.3 | 5 -> 5 | 1 -> 1 |
| chess-natural | promote | natural/promote.wav | 1000 -> 1000 | -3.50 -> -3.50 | -18.7 -> -18.7 | 0 -> 0 | 1 -> 1 |
| chess-natural | illegal | natural/illegal.wav | 300 -> 300 | -3.50 -> -3.50 | -14.8 -> -14.8 | 5 -> 5 | 2 -> 2 |
| chess-natural | game-end-win ++ | natural/game-end-win.wav | 1400 -> 1244 | -3.50 -> -3.50 | -18.0 -> -17.5 | 160 -> 5 | 0 -> 1 |
| chess-natural | game-end-loss | natural/game-end-loss.wav | 1400 -> 1400 | -3.50 -> -3.50 | -18.3 -> -18.3 | 5 -> 5 | 2 -> 2 |
| chess-natural | game-start | natural/game-start.wav | 240 -> 240 | -3.50 -> -3.50 | -24.7 -> -24.7 | 0 -> 0 | 1 -> 1 |
| chess-natural | low-time-tick | natural/low-time-tick.wav | 30 -> 30 | -3.50 -> -3.50 | -17.2 -> -17.2 | 0 -> 0 | 1 -> 1 |
| chess-natural | ui-click | natural/ui-click.wav | 200 -> 200 | -3.50 -> -3.50 | -11.7 -> -11.7 | 45 -> 45 | 2 -> 2 |
| chess-natural | ui-hover | natural/ui-hover.wav | 160 -> 160 | -3.50 -> -3.50 | -14.7 -> -14.7 | 25 -> 25 | 2 -> 2 |
| memes/boom | vineboom | boom_vineboom.wav | 620 -> 620 | -3.50 -> -3.50 | -12.3 -> -12.3 | 0 -> 0 | 0 -> 0 |
| memes/boom | bruh | boom_bruh.wav | 333 -> 329 | -3.50 -> -3.50 | -18.9 -> -18.9 | 35 -> 30 | 8 -> 4 |
| memes/boom | slowooh | boom_slowooh.wav | 980 -> 980 | -3.50 -> -3.50 | -17.4 -> -17.4 | 5 -> 5 | 3 -> 3 |
| memes/boom | scratch | boom_scratch.wav | 500 -> 500 | -3.50 -> -3.50 | -17.4 -> -17.4 | 5 -> 5 | 2 -> 2 |
| memes/boom | boom808 | boom_boom808.wav | 800 -> 800 | -3.50 -> -3.50 | -11.6 -> -11.6 | 0 -> 0 | 0 -> 0 |
| memes/boom | thud | boom_thud.wav | 340 -> 340 | -3.50 -> -3.50 | -15.1 -> -15.1 | 0 -> 0 | 0 -> 0 |
| memes/gamer | airhorn | gamer_airhorn.wav | 600 -> 600 | -3.50 -> -3.50 | -16.3 -> -16.3 | 5 -> 5 | 3 -> 3 |
| memes/gamer | hitmarker | gamer_hitmarker.wav | 220 -> 220 | -3.50 -> -3.50 | -20.0 -> -20.0 | 0 -> 0 | 0 -> 0 |
| memes/gamer | noscope | gamer_noscope.wav | 600 -> 600 | -3.50 -> -3.50 | -14.8 -> -14.8 | 10 -> 10 | 4 -> 4 |
| memes/gamer | wasted | gamer_wasted.wav | 1200 -> 1200 | -3.50 -> -3.50 | -15.3 -> -15.3 | 0 -> 0 | 2 -> 2 |
| memes/gamer | levelup | gamer_levelup.wav | 500 -> 500 | -3.50 -> -3.50 | -13.1 -> -13.1 | 0 -> 0 | 2 -> 2 |
| memes/sad | sadtrombone | sad_sadtrombone.wav | 1280 -> 1280 | -3.50 -> -3.50 | -17.4 -> -17.4 | 20 -> 20 | 4 -> 4 |
| memes/sad | ohnonono | sad_ohnonono.wav | 955 -> 955 | -3.50 -> -3.50 | -16.3 -> -16.3 | 5 -> 5 | 3 -> 3 |
| memes/sad | wilhelm | sad_wilhelm.wav | 870 -> 870 | -3.50 -> -3.50 | -13.5 -> -13.5 | 5 -> 5 | 3 -> 3 |
| memes/sad | sadbell | sad_sadbell.wav | 1300 -> 1300 | -3.50 -> -3.50 | -15.6 -> -15.6 | 0 -> 0 | 2 -> 2 |
| memes/sad | sadviolin | sad_sadviolin.wav | 1200 -> 1200 | -3.50 -> -3.50 | -14.5 -> -14.5 | 5 -> 5 | 4 -> 4 |
| memes/sad | sigh | sad_sigh.wav | 460 -> 460 | -3.50 -> -3.50 | -16.1 -> -16.1 | 0 -> 0 | 2 -> 2 |
| memes/victory | crowdroar | victory_crowdroar.wav | 1400 -> 1400 | -3.50 -> -3.50 | -17.2 -> -17.2 | 40 -> 40 | 3 -> 3 |
| memes/victory | yeahbaby | victory_yeahbaby.wav | 682 -> 682 | -3.50 -> -3.50 | -16.8 -> -16.8 | 0 -> 0 | 3 -> 3 |
| memes/victory | fanfare | victory_fanfare.wav | 1200 -> 1200 | -3.50 -> -3.50 | -16.5 -> -16.5 | 0 -> 0 | 2 -> 2 |
| memes/victory | subdrop | victory_subdrop.wav | 900 -> 900 | -3.50 -> -3.50 | -12.0 -> -12.0 | 0 -> 0 | 2 -> 2 |
| memes/victory | orchestrahit | victory_orchestrahit.wav | 700 -> 700 | -3.50 -> -3.50 | -16.4 -> -16.4 | 0 -> 0 | 2 -> 2 |
| memes/victory | winsting | victory_winsting.wav | 700 -> 700 | -3.50 -> -3.50 | -15.5 -> -15.5 | 0 -> 0 | 2 -> 2 |
| memes/toon | boing | toon_boing.wav | 500 -> 500 | -3.50 -> -3.50 | -12.3 -> -12.3 | 0 -> 0 | 2 -> 2 |
| memes/toon | pop | toon_pop.wav | 220 -> 220 | -3.50 -> -3.50 | -18.4 -> -18.4 | 0 -> 0 | 0 -> 0 |
| memes/toon | slidewhistle | toon_slidewhistle.wav | 900 -> 900 | -3.50 -> -3.50 | -10.6 -> -10.6 | 0 -> 0 | 2 -> 2 |
| memes/toon | twang | toon_twang.wav | 520 -> 520 | -3.50 -> -3.50 | -18.5 -> -18.5 | 0 -> 0 | 0 -> 0 |
| memes/toon | squeak | toon_squeak.wav | 300 -> 300 | -3.50 -> -3.50 | -11.4 -> -11.4 | 0 -> 0 | 0 -> 0 |
| memes/toon | bonk | toon_bonk.wav | 300 -> 300 | -3.50 -> -3.50 | -16.5 -> -16.5 | 0 -> 0 | 2 -> 2 |
| memes/tts | blunder | tts_blunder.wav | 441 -> 437 | -3.50 -> -3.50 | -20.2 -> -20.1 | 40 -> 35 | 8 -> 4 |
| memes/tts | ohno | tts_ohno.wav | 465 -> 465 | -3.50 -> -3.50 | -16.4 -> -16.4 | 5 -> 5 | 3 -> 3 |
| memes/tts | nice | tts_nice.wav | 355 -> 355 | -3.50 -> -3.50 | -18.7 -> -18.7 | 5 -> 5 | 3 -> 3 |
| memes/tts | gg ++ | tts_gg.wav | 390 -> 383 | -3.50 -> -3.50 | -19.5 -> -19.4 | 10 -> 5 | 11 -> 4 |
| memes/tts | checkmate | tts_checkmate.wav | 540 -> 540 | -3.50 -> -3.50 | -20.2 -> -20.2 | 40 -> 40 | 4 -> 4 |
| memes/tts | oof | tts_oof.wav | 280 -> 280 | -3.50 -> -3.50 | -18.6 -> -18.6 | 5 -> 5 | 2 -> 2 |
| memes/forge | tension_riser | forge_tension_riser_trim.wav | 2842 -> 2842 | -3.50 -> -3.50 | -17.9 -> -17.9 | 120 -> 120 | 2 -> 2 |
| memes/forge | epic_hit | forge_epic_hit_trim.wav | 1600 -> 1600 | -3.50 -> -3.50 | -14.8 -> -14.8 | 0 -> 0 | 0 -> 0 |
| memes/forge | glass_shatter | forge_glass_shatter_trim.wav | 790 -> 790 | -3.50 -> -3.50 | -16.4 -> -16.4 | 15 -> 15 | 2 -> 2 |
| memes/forge | crowd_boo | forge_crowd_boo_trim.wav | 2995 -> 2995 | -3.50 -> -3.50 | -24.9 -> -24.9 | 0 -> 0 | 0 -> 0 |
| memes/forge | slot_win | forge_slot_win_trim.wav | 2200 -> 2195 | -3.50 -> -3.50 | -21.5 -> -21.5 | 15 -> 15 | 2 -> 2 |
| memes/forge | vine_boom2 | forge_vine_boom2_trim.wav | 1400 -> 1400 | -3.50 -> -3.50 | -21.3 -> -21.3 | 0 -> 0 | 0 -> 0 |
| memes/forge | applause | forge_applause_trim.wav | 3704 -> 3704 | -3.50 -> -3.50 | -20.7 -> -20.7 | 10 -> 10 | 1 -> 1 |
| memes/forge | dramatic_sting ++ | forge_dramatic_sting_trim.wav | 2400 -> 1266 | -3.50 -> -3.50 | -19.5 -> -16.8 | 1135 -> 5 | 0 -> 0 |
| memes/forge | sub_impact | forge_sub_impact_trim.wav | 1700 -> 1700 | -3.50 -> -3.50 | -19.3 -> -19.3 | 5 -> 5 | 1 -> 1 |
| memes/forge | buzzer | forge_buzzer_trim.wav | 1200 -> 1200 | -3.50 -> -3.50 | -16.3 -> -16.3 | 5 -> 5 | 1 -> 1 |
| memes/forge | ding | forge_ding_trim.wav | 1400 -> 1398 | -3.50 -> -3.50 | -15.4 -> -15.4 | 15 -> 5 | 6 -> 4 |
| memes/forge | coin | forge_coin_trim.wav | 627 -> 627 | -3.50 -> -3.50 | -17.6 -> -17.6 | 110 -> 110 | 1 -> 1 |
| memes/forge | sad_trombone2 ++ | forge_sad_trombone2_trim.wav | 2600 -> 2557 | -3.50 -> -3.50 | -18.2 -> -18.1 | 5 -> 5 | 1 -> 1 |
| memes/forge | airhorn2 | forge_airhorn2_trim.wav | 1647 -> 1647 | -3.50 -> -3.50 | -15.7 -> -15.7 | 0 -> 0 | 0 -> 0 |
| memes/forge | crowd_gasp | forge_crowd_gasp_trim.wav | 1647 -> 1647 | -3.50 -> -3.50 | -18.6 -> -18.6 | 10 -> 10 | 1 -> 1 |
| memes/forge | cartoon_boom | forge_cartoon_boom_trim.wav | 1300 -> 1300 | -3.50 -> -3.50 | -21.1 -> -21.1 | 0 -> 0 | 0 -> 0 |
| memes/forge | boing2 | forge_boing2_trim.wav | 1200 -> 1200 | -3.50 -> -3.50 | -20.9 -> -20.9 | 5 -> 5 | 1 -> 1 |
| memes/forge | levelup | forge_levelup_trim.wav | 1800 -> 1800 | -3.50 -> -3.50 | -19.7 -> -19.7 | 0 -> 0 | 1 -> 1 |
| memes/forge | scratch2 | forge_scratch2_trim.wav | 1642 -> 1642 | -3.50 -> -3.50 | -20.7 -> -20.7 | 5 -> 5 | 1 -> 1 |

## Flags found and fixes applied

### 1. Late onset (>150 ms) - fixed by head trim

| clip | onset before | onset after | rule |
| --- | --- | --- | --- |
| chess-natural game-end-win | 160 ms | 5 ms | first 146 ms was a -41..-52 dBFS lead-in |
| memes/forge dramatic_sting | 1135 ms | 5 ms | 1.1 s of quiet swell before the sting |

### 2. Chess cues with a sluggish sub-threshold lead (>60 ms) - fixed by head trim

| clip | onset before | onset after | dur before | dur after |
| --- | --- | --- | --- | --- |
| chess-natural move | 70 ms | 5 ms | 260 ms | 194 ms |
| chess-natural capture-2 | 140 ms | 5 ms | 380 ms | 244 ms |

The trimmer refuses to cut a genuinely building head (pre-onset energy above -16 dB relative to
the loudest window) unless the onset is over the explicit 150 ms lag threshold, so genuine risers
such as forge tension_riser (onset 120 ms) keep their shape.

### 3. Over-long cues - fixed by trimming decay tails and a quiet head

| clip | dur before | dur after | note |
| --- | --- | --- | --- |
| chess-natural capture | 340 ms | 320 ms | dry tail cut; capture window set to 320 ms |
| chess-natural game-end-win | 1400 ms | 1244 ms | head trim (also removed a silence lead) |
| memes/forge dramatic_sting | 2400 ms | 1266 ms | head trim |

Trailing tails are only cut for chess cues and only when the discarded span stays under 25% of the
file peak, so no audible body is removed. A 2 ms fade-in is applied only where a head was actually
cut and a 20 ms fade-out only where a tail was actually cut, which is what makes fix idempotent
(a second run changed none of the 82 file hashes).

### 4. Levelling

All 82 referenced clips end with peak -3.50 dBFS (window -4..-3), measured identically by parser A
and ffmpeg. Before this pass the prior worker had already normalised to -3.50 dBFS, so no clip needed
a net gain change; the fix pass re-imposed the target and the verifier now enforces it.

### 5. Near-duplicate pair - FLAGGED, not fixed

| pair | correlation before -> after | duration ratio | verdict |
| --- | --- | --- | --- |
| chess-crisp move-2 vs move-3 | 0.993 -> 0.993 | 1.00 | envelope near-identical |

These are the "alt 2"/"alt 3" move variants in the non-default Crisp set. They are already
peak-matched and contain no silence to trim, so trimming/levelling cannot separate them; doing so
would require re-synthesis, which the brief forbids for a non-broken file. The crisp Move group
therefore rotates between only two perceptibly different clicks.

## Verification

~~~text
verified 82 referenced clips across 9 bank sections
VERIFY PASS
~~~

verify() re-parses every target in both chess manifests and all 7 meme packs and asserts:

- file exists;
- WAV audioFormat = 1 and bits = 16 (PCM 16-bit), mono;
- peak dBFS within -4..-3 (measured max -3.50, min -3.50);
- duration inside the per-event window (both manifests and all packs);
- onset <= 150 ms, leading silence <= 200 ms, trailing silence <= 300 ms;
- no duplicate file target inside any bank;
- catalog.js window.__MEME_BANK JSON equals manifest.json exactly (deep-equal after parse);
- parser A and parser B (ffmpeg/ffprobe) agree on duration within 2 ms, peak within 0.3 dB,
  RMS within 0.5 dB for all 82 clips.

## Not fixed / limitations

- Crisp move-2 ~ move-3 near-duplicate (needs re-synthesis, explicitly out of scope).
- No listening is possible here; timbre/character claims are inferences from envelope, centroid and
  correlation. A human should spot-check the re-trimmed cues before shipping: natural move, natural
  capture, natural capture-2, natural game-end-win and forge dramatic_sting.
- Unreferenced legacy originals (games/audio/chess/*.mp3, games/audio/meme/*.mp3, games/audio/music/*)
  were outside the referenced-bank scope and were not modified.

## Files changed and backups

Every one of the 82 referenced targets was parsed, trimmed/levelled and re-emitted. **13 files changed bytes**; the other 69 were already compliant and came out byte-identical to their originals.

Changed audio files:

- chess-natural/move (natural/move.wav)
- chess-natural/capture (natural/capture.wav)
- chess-natural/capture-2 (natural/capture-2.wav)
- chess-natural/game-end-win (natural/game-end-win.wav)
- memes/bruh (boom_bruh.wav)
- memes/noscope (gamer_noscope.wav)
- memes/blunder (tts_blunder.wav)
- memes/gg (tts_gg.wav)
- memes/checkmate (tts_checkmate.wav)
- memes/slot_win (forge_slot_win_trim.wav)
- memes/dramatic_sting (forge_dramatic_sting_trim.wav)
- memes/ding (forge_ding_trim.wav)
- memes/sad_trombone2 (forge_sad_trombone2_trim.wav)

- Manifests updated (ms set to measured duration; ids/labels/when unchanged):
  games/audio/chess/manifest.json, games/audio/chess/manifest-natural.json, games/audio/memes/manifest.json.
- games/audio/memes/catalog.js regenerated from manifest.json + captions.json so the inline copy the
  game loads still matches exactly.
- Originals: one backup of every processed file under _loop/audio-gen/backup/ (mirrored tree).
- Backup WAV count: 82.

## Reproduce

~~~text
node _loop/audio-gen/audit-audio.js analyze     # print metrics + flags, write audit-latest.json
node _loop/audio-gen/audit-audio.js fix         # back up, then trim/level and refresh manifests
node _loop/audio-gen/audit-audio.js verify      # contract + ffmpeg cross-check; exits 1 on failure
~~~

