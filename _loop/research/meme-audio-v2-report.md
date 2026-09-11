# Meme audio bank v2 - audit, trim, level, regenerate, verify

- Project: `C:\Users\caleb\AppData\Local\arcade-hub`
- Scope: `games/audio/memes/` (the chess meme bank) plus tooling under `_loop/audio-gen/`
- Date: 2026-09-12 (Australia/Perth)
- Authority: `games/chess.html`, `games/chess-memes.js` and `games/chess-*.js` were **not** edited.

## 1. Summary

The bank went from *un-trimmed, inconsistently loud and partly sine-based* to a levelled, trimmed, verified set.

- **Audited** all 54 clips: 35 synth WAVs and 19 `forge` MP3s. Baseline table below.
- **Trimmed + normalised all 19 forge MP3s.** Every MP3 is exactly 1.997 s, 2.995 s or 3.994 s long (2/3/4 s at the encoder); the manifest claimed 4.1-8.1 s, which was simply wrong. Each was cut to its meaningful part (0.63-3.70 s), 4 ms fade-in, 30-420 ms fade-out, peak-normalised to **-3.5 dBFS**, written as 44.1 kHz mono 16-bit `forge_<name>_trim.wav`. Originals are kept.
- **Levelled all 35 synth WAVs** to -3.5 dBFS peak with one pure gain each (all were exactly -3.00 dBFS, i.e. a -0.50 dB trim). Same sample rate, no re-synthesis, `.bak` copies written first.
- **Regenerated 8 weak synth clips** (3 boom, 3 toon, gamer hitmarker, crowd roar) with modal / FM / noise recipes. No bare sine beeps remain in the regenerated set.
- **Left the `tts` (Robo Voice) pack content untouched.** Those are formant-faked speech and the owner said not to fake voice; the parent is wiring real browser speech synthesis. They only got the level trim.
- **Updated `manifest.json`** (same schema, same ids/when/labels, accurate `ms`, forge points at the trimmed WAVs) and **regenerated `catalog.js`** - see the wiring note in section 8.
- **Two independent verifiers pass**: `level-memes.js verify` -> `VERIFY PASS`, `verify-memes2.js` -> `INDEPENDENT PASS` (54/54 clips, 0 duplicate targets, 0 failures).
- **No audio was downloaded.** Forge files were decoded and re-trimmed from files already in the repo; every regenerated clip is arithmetic DSP inside `level-memes.js`.

## 2. Deliverables

| deliverable | path |
|---|---|
| improved bank | `games/audio/memes/` (54 WAVs referenced + 19 original MP3s + backups) |
| improved manifest | `games/audio/memes/manifest.json` |
| regenerated live catalog | `games/audio/memes/catalog.js` |
| processing tool (re-runnable) | `_loop/audio-gen/level-memes.js` (`audit` / `inspect` / `apply` / `verify`) |
| independent second-opinion verifier | `_loop/audio-gen/verify-memes2.js` |
| this report | `_loop/research/meme-audio-v2-report.md` |
| raw captured outputs | `_loop/research/_tmp/meme-audit-before.txt`, `meme-audit-after.txt`, `meme-verify-level.txt`, `meme-verify-independent.txt`, `meme-apply-idempotent.txt` |

## 3. Environment and commands

```
> C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe -v
v24.18.0
> C:\Users\caleb\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe -version
ffmpeg version 8.1.2-full_build-www.gyan.dev
```

Commands actually run (all from the repo root):

```
node _loop/audio-gen/level-memes.js audit      # baseline measurement
node _loop/audio-gen/level-memes.js inspect    # 50 ms dB-envelope structure per clip
node _loop/audio-gen/level-memes.js apply      # trim forge + level synth + regen weak + rewrite manifest
node _loop/audio-gen/gen-catalog.js            # refresh the file the game actually loads
node _loop/audio-gen/level-memes.js verify     # contract check
node _loop/audio-gen/verify-memes2.js          # independent re-measurement
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 games/audio/memes/forge_tension_riser.mp3
# duration=3.993832
# size=129590
```

Measurement used for every clip (in `level-memes.js` and again independently in `verify-memes2.js`): peak dBFS, RMS dBFS, and a short-window RMS envelope for onset / meaningful-duration / leading / trailing silence. Forge MP3s are decoded once to mono 44.1 kHz float via ffmpeg before measuring.

## 4. Baseline audit (before, all 54 clips)

```
file                            rate  dur_ms  peakdB   rmsdB onset_ms mean_ms leadSil tailSil
---------------------------------------------------------------------------------------------
boom_vineboom.wav              22050     720  -3.00 -12.05        0     404       0     316
boom_bruh.wav                  22050     333  -3.00 -18.44       40     269      40      24
boom_slowooh.wav               22050     980  -3.00 -16.85        0     958       0      22
boom_scratch.wav               22050     500  -3.00 -16.92       15     379      15     106
boom_boom808.wav               22050     920  -3.00 -11.40        0     509       0     411
boom_thud.wav                  22050     320  -3.00 -15.02        0     200       0     120
gamer_airhorn.wav              22050     600  -3.00 -15.84        0     574       0      26
gamer_hitmarker.wav            22050     200  -3.00 -17.75        0     125       0      75
gamer_noscope.wav              22050     600  -3.00 -14.25       45     529      45      26
gamer_wasted.wav               22050    1200  -3.00 -14.77        5     768       5     427
gamer_levelup.wav              22050     500  -3.00 -12.61        0     409       0      91
sad_sadtrombone.wav            22050    1280  -3.00 -16.94       35    1202      35      43
sad_ohnonono.wav               22050     955  -3.00 -15.78        0     933       0      22
sad_wilhelm.wav                22050     870  -3.00 -12.97       55     793      55      22
sad_sadbell.wav                22050    1300  -3.00 -15.10        0     663       0     637
sad_sadviolin.wav              22050    1200  -3.00 -14.01       35    1003      35     162
sad_sigh.wav                   22050     460  -3.00 -15.57        0     439       0      21
victory_crowdroar.wav          22050    1350  -3.00 -16.04        0     279       0    1071
victory_yeahbaby.wav           22050     682  -3.00 -16.31        0     663       0      19
victory_fanfare.wav            22050    1200  -3.00 -16.02        0     878       0     322
victory_subdrop.wav            22050     900  -3.00 -11.46        0     614       0     286
victory_orchestrahit.wav       22050     700  -3.00 -15.94        0     289       0     411
victory_winsting.wav           22050     700  -3.00 -14.99        0     424       0     276
toon_boing.wav                 22050     500  -3.00 -11.83        0     319       0     181
toon_pop.wav                   22050     200  -3.00 -15.86        0     125       0      75
toon_slidewhistle.wav          22050     900  -3.00 -10.14        0     644       0     256
toon_twang.wav                 22050     520  -3.00 -20.28        0     254       0     266
toon_squeak.wav                22050     260  -3.00 -11.76        0     110       0     150
toon_bonk.wav                  22050     300  -3.00 -16.03        0     180       0     120
tts_blunder.wav                22050     441  -3.00 -19.67       35     394      35      12
tts_ohno.wav                   22050     465  -3.00 -15.90        0     444       0      21
tts_nice.wav                   22050     355  -3.00 -18.21        0     224       0     131
tts_gg.wav                     22050     390  -3.00 -18.97       15     364      15      11
tts_checkmate.wav              22050     540  -3.00 -19.72       25     504      25      11
tts_oof.wav                    22050     280  -3.00 -18.13        0     185       0      95
forge_tension_riser.mp3        44100    3994  -1.69 -17.55      536    3032     536     426
forge_epic_hit.mp3             44100    2995  -0.69 -13.08      511    1704     511     780
forge_glass_shatter.mp3        44100    1997 -10.44 -26.07       80    1917      80       0
forge_crowd_boo.mp3            44100    2995  -3.71 -24.97        0    2995       0       0
forge_slot_win.mp3             44100    2995   1.88 -15.61      246    2750     246       0
forge_vine_boom2.mp3           44100    1997  -3.25 -20.09       10    1684      10     303
forge_applause.mp3             44100    3994  -6.29 -23.54      286    3708     286       0
forge_dramatic_sting.mp3       44100    2995  -3.83 -24.96        0    2995       0       0
forge_sub_impact.mp3           44100    2995   2.72 -15.71      722    2265     722       9
forge_buzzer.mp3               44100    1997  -1.81 -15.93       65    1929      65       2
forge_ding.mp3                 44100    1997   0.46 -11.77       95    1902      95       0
forge_coin.mp3                 44100    1997  -0.49 -19.47      446    1551     446       0
forge_sad_trombone2.mp3        44100    2995   1.42 -13.32       40    2955      40       0
forge_airhorn2.mp3             44100    1997  -3.00 -15.59      336    1661     336       0
forge_crowd_gasp.mp3           44100    1997  -0.08 -15.79      351    1646     351       0
forge_cartoon_boom.mp3         44100    1997   2.96 -17.82        0    1997       0       0
forge_boing2.mp3               44100    1997   2.89 -15.91       40    1954      40       2
forge_levelup.mp3              44100    2995  -4.58 -21.79      536    2456     536       4
forge_scratch2.mp3             44100    1997  -0.16 -18.47      356    1641     356       0
---
files=54  wav=35  mp3=19
```

Notes on the baseline: every synth WAV was peak **-3.00 dBFS**; several forge MP3s were **hotter than 0 dBFS** (`slot_win` +1.88, `sub_impact` +2.72, `boing2` +2.89, `cartoon_boom` +2.96) and `glass_shatter` was very quiet (-10.44 peak). Manifest `ms` values for forge (4.1-8.1 s) did not match the real 2-4 s files.

## 5. Final audit (after, every manifest-referenced file)

Produced by `node level-memes.js verify` (same columns as the baseline plus format/rate/channel):

```
version=1  packs=7  clips=54
file                              fmt   rate ch  dur_ms  peakdB   rmsdB onset_ms mean_ms  lead  tail
----------------------------------------------------------------------------------------------------
boom_vineboom.wav               pcm16  22050  1     620  -3.50 -12.30        0     359     0   261
boom_bruh.wav                   pcm16  22050  1     333  -3.50 -18.94       40     269    40    24
boom_slowooh.wav                pcm16  22050  1     980  -3.50 -17.35        0     958     0    22
boom_scratch.wav                pcm16  22050  1     500  -3.50 -17.42       15     379    15   106
boom_boom808.wav                pcm16  22050  1     800  -3.50 -11.63        0     479     0   321
boom_thud.wav                   pcm16  22050  1     340  -3.50 -15.05        0     220     0   120
gamer_airhorn.wav               pcm16  22050  1     600  -3.50 -16.34        0     574     0    26
gamer_hitmarker.wav             pcm16  22050  1     220  -3.50 -20.00        0     145     0    75
gamer_noscope.wav               pcm16  22050  1     600  -3.50 -14.75       45     529    45    26
gamer_wasted.wav                pcm16  22050  1    1200  -3.50 -15.27        5     768     5   427
gamer_levelup.wav               pcm16  22050  1     500  -3.50 -13.11        0     409     0    91
sad_sadtrombone.wav             pcm16  22050  1    1280  -3.50 -17.44       35    1202    35    43
sad_ohnonono.wav                pcm16  22050  1     955  -3.50 -16.28        0     933     0    22
sad_wilhelm.wav                 pcm16  22050  1     870  -3.50 -13.47       55     793    55    22
sad_sadbell.wav                 pcm16  22050  1    1300  -3.50 -15.60        0     663     0   637
sad_sadviolin.wav               pcm16  22050  1    1200  -3.50 -14.51       35    1003    35   162
sad_sigh.wav                    pcm16  22050  1     460  -3.50 -16.07        0     439     0    21
victory_crowdroar.wav           pcm16  22050  1    1400  -3.50 -17.16      160     963   160   278
victory_yeahbaby.wav            pcm16  22050  1     682  -3.50 -16.81        0     663     0    19
victory_fanfare.wav             pcm16  22050  1    1200  -3.50 -16.52        0     878     0   322
victory_subdrop.wav             pcm16  22050  1     900  -3.50 -11.96        0     614     0   286
victory_orchestrahit.wav        pcm16  22050  1     700  -3.50 -16.44        0     289     0   411
victory_winsting.wav            pcm16  22050  1     700  -3.50 -15.49        0     424     0   276
toon_boing.wav                  pcm16  22050  1     500  -3.50 -12.33        0     319     0   181
toon_pop.wav                    pcm16  22050  1     220  -3.50 -18.36        0     140     0    80
toon_slidewhistle.wav           pcm16  22050  1     900  -3.50 -10.64        0     644     0   256
toon_twang.wav                  pcm16  22050  1     520  -3.50 -18.46        0     259     0   261
toon_squeak.wav                 pcm16  22050  1     300  -3.50 -11.44        0     234     0    66
toon_bonk.wav                   pcm16  22050  1     300  -3.50 -16.53        0     180     0   120
tts_blunder.wav                 pcm16  22050  1     441  -3.50 -20.16       35     394    35    12
tts_ohno.wav                    pcm16  22050  1     465  -3.50 -16.40        0     444     0    21
tts_nice.wav                    pcm16  22050  1     355  -3.50 -18.71        0     224     0   131
tts_gg.wav                      pcm16  22050  1     390  -3.50 -19.47       15     364    15    11
tts_checkmate.wav               pcm16  22050  1     540  -3.50 -20.22       25     504    25    11
tts_oof.wav                     pcm16  22050  1     280  -3.50 -18.63        0     185     0    95
forge_tension_riser_trim.wav    pcm16  44100  1    2842  -3.50 -17.90      426    1418   426   998
forge_epic_hit_trim.wav         pcm16  44100  1    1600  -3.50 -14.80        5     752     5   843
forge_glass_shatter_trim.wav    pcm16  44100  1     790  -3.50 -16.38      386     215   386   189
forge_crowd_boo_trim.wav        pcm16  44100  1    2995  -3.50 -24.86        0    2952     0    44
forge_slot_win_trim.wav         pcm16  44100  1    2200  -3.50 -21.47        0    2070     0   130
forge_vine_boom2_trim.wav       pcm16  44100  1    1400  -3.50 -21.27        0    1042     0   358
forge_applause_trim.wav         pcm16  44100  1    3704  -3.50 -20.66        0    3503     0   201
forge_dramatic_sting_trim.wav   pcm16  44100  1    2400  -3.50 -19.54        0    2350     0    50
forge_sub_impact_trim.wav       pcm16  44100  1    1700  -3.50 -19.31        0     747     0   953
forge_buzzer_trim.wav           pcm16  44100  1    1200  -3.50 -16.28        0    1082     0   118
forge_ding_trim.wav             pcm16  44100  1    1400  -3.50 -15.36        5    1313     5    82
forge_coin_trim.wav             pcm16  44100  1     627  -3.50 -17.61      130     366   130   131
forge_sad_trombone2_trim.wav    pcm16  44100  1    2600  -3.50 -18.20        0    2380     0   220
forge_airhorn2_trim.wav         pcm16  44100  1    1647  -3.50 -15.71       10    1564    10    74
forge_crowd_gasp_trim.wav       pcm16  44100  1    1647  -3.50 -18.56        5    1574     5    69
forge_cartoon_boom_trim.wav     pcm16  44100  1    1300  -3.50 -21.14        0     411     0   889
forge_boing2_trim.wav           pcm16  44100  1    1200  -3.50 -20.85       25     997    25   178
forge_levelup_trim.wav          pcm16  44100  1    1800  -3.50 -19.71        5    1594     5   201
forge_scratch2_trim.wav         pcm16  44100  1    1642  -3.50 -20.74      215    1383   215    43
---
VERIFY PASS
```

## 6. Forge pack: original -> trimmed

```
| original MP3 | orig dur ms | orig peak dB | orig RMS dB | onset ms | meaning ms | trimmed WAV | trim dur ms | trim peak dB | trim RMS dB |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|
| forge_tension_riser.mp3 | 3994 | -1.69 | -17.55 | 536 | 3032 | forge_tension_riser_trim.wav | 2842 | -3.50 | -17.90 |
| forge_epic_hit.mp3 | 2995 | -0.69 | -13.08 | 511 | 1704 | forge_epic_hit_trim.wav | 1600 | -3.50 | -14.80 |
| forge_glass_shatter.mp3 | 1997 | -10.44 | -26.07 | 80 | 1917 | forge_glass_shatter_trim.wav | 790 | -3.50 | -16.38 |
| forge_crowd_boo.mp3 | 2995 | -3.71 | -24.97 | 0 | 2995 | forge_crowd_boo_trim.wav | 2995 | -3.50 | -24.86 |
| forge_slot_win.mp3 | 2995 | 1.88 | -15.61 | 246 | 2750 | forge_slot_win_trim.wav | 2200 | -3.50 | -21.47 |
| forge_vine_boom2.mp3 | 1997 | -3.25 | -20.09 | 10 | 1684 | forge_vine_boom2_trim.wav | 1400 | -3.50 | -21.27 |
| forge_applause.mp3 | 3994 | -6.29 | -23.54 | 286 | 3708 | forge_applause_trim.wav | 3704 | -3.50 | -20.66 |
| forge_dramatic_sting.mp3 | 2995 | -3.83 | -24.96 | 0 | 2995 | forge_dramatic_sting_trim.wav | 2400 | -3.50 | -19.54 |
| forge_sub_impact.mp3 | 2995 | 2.72 | -15.71 | 722 | 2265 | forge_sub_impact_trim.wav | 1700 | -3.50 | -19.31 |
| forge_buzzer.mp3 | 1997 | -1.81 | -15.93 | 65 | 1929 | forge_buzzer_trim.wav | 1200 | -3.50 | -16.28 |
| forge_ding.mp3 | 1997 | 0.46 | -11.77 | 95 | 1902 | forge_ding_trim.wav | 1400 | -3.50 | -15.36 |
| forge_coin.mp3 | 1997 | -0.49 | -19.47 | 446 | 1551 | forge_coin_trim.wav | 627 | -3.50 | -17.61 |
| forge_sad_trombone2.mp3 | 2995 | 1.42 | -13.32 | 40 | 2955 | forge_sad_trombone2_trim.wav | 2600 | -3.50 | -18.20 |
| forge_airhorn2.mp3 | 1997 | -3.00 | -15.59 | 336 | 1661 | forge_airhorn2_trim.wav | 1647 | -3.50 | -15.71 |
| forge_crowd_gasp.mp3 | 1997 | -0.08 | -15.79 | 351 | 1646 | forge_crowd_gasp_trim.wav | 1647 | -3.50 | -18.56 |
| forge_cartoon_boom.mp3 | 1997 | 2.96 | -17.82 | 0 | 1997 | forge_cartoon_boom_trim.wav | 1300 | -3.50 | -21.14 |
| forge_boing2.mp3 | 1997 | 2.89 | -15.91 | 40 | 1954 | forge_boing2_trim.wav | 1200 | -3.50 | -20.85 |
| forge_levelup.mp3 | 2995 | -4.58 | -21.79 | 536 | 2456 | forge_levelup_trim.wav | 1800 | -3.50 | -19.71 |
| forge_scratch2.mp3 | 1997 | -0.16 | -18.47 | 356 | 1641 | forge_scratch2_trim.wav | 1642 | -3.50 | -20.74 |
```

Trimming rule (in `level-memes.js`, function `trimForge`): 5 ms envelope, loud-gate = peak-envelope - 30 dB (floor noise+10, absolute -55), end-gate = peak - 22 dB; start = first frame above the loud gate minus 6 ms; end = last frame above the end-gate plus 30 ms; `focusLoud` used for `glass_shatter` so the isolated late shatter burst is kept instead of the quiet pre-roll; per-file safety cap; then 4 ms fade-in, 30-420 ms fade-out, peak-normalise to -3.5 dBFS.

The longer survivors are the ones that genuinely need it: `applause` (3.70 s), `crowd_boo` (3.00 s), `tension_riser` (2.84 s), `sad_trombone2` (2.60 s), `dramatic_sting` (2.40 s). Everything else is 0.63-2.20 s.

## 7. Synth pack: levelling and regeneration

### 7a. Level only (27 of 35 synth WAVs)

All 35 synth WAVs were measured at peak -3.00 dBFS. Every file except the 8 regenerated below received exactly one gain (-0.50 dB) to bring it to -3.5 dBFS. This is a pure level change: no re-synthesis, no resampling, no trimming. Before overwriting, a `.bak` copy of each original was written (`games/audio/memes/<name>.wav.bak`, 35 files). File durations are unchanged.

Example (real output of `apply` on the first run):

```
LEVEL  boom_bruh.wav      -3.00 -> -3.50
LEVEL  gamer_airhorn.wav  -3.00 -> -3.50
LEVEL  sad_sadtrombone.wav -3.00 -> -3.50
... 27 level rows in total ...
REGEN  boom_vineboom.wav  -3.00 -> -3.50
```

### 7b. Regenerated because the baseline measured badly (8 clips)

| file | baseline symptom | new recipe | new dur ms |
|---|---|---|---:|
| `boom_vineboom.wav` | single sine sub-sweep (bare sine) | 2-op FM body with pitch drop + band-passed click + short reverb | 620 |
| `boom_boom808.wav` | single sine + click, 411 ms dead tail | FM body + tri harmonic + HP click | 800 |
| `boom_thud.wav` | single sine + noise | modal impact: sine + tri + 210 Hz mode + LP noise | 340 |
| `gamer_hitmarker.wav` | two bare sine beeps | 4-mode metallic click + noise tick | 220 |
| `toon_pop.wav` | single sine sweep | 3 damped modal partials + click | 220 |
| `toon_squeak.wav` | single sine, only 110 ms meaningful in 260 ms | reedy saw through a sweeping SVF + breath noise | 300 |
| `toon_twang.wav` | lowest RMS in the bank (-20.28) | dual Karplus-Strong pluck + body sine | 520 |
| `victory_crowdroar.wav` | only 279 ms meaningful in 1350 ms, crowd decayed instantly | sustained filtered crowd + saw cheer chord + 60 claps + reverb | 1400 |

These use the same generator style as `gen-memes.js` (oscillators, noise, biquad/SVF filters, reverb - no sample playback).

### 7c. `tts` / Robo Voice pack: deliberately not re-synthesised

All 6 `tts_*.wav` files are formant-faked speech and, as the owner predicted, sound cheap (RMS -18..-20 dBFS). They were **not** regenerated. The owner explicitly said not to fake voice, and the parent is wiring the browser's real speech synthesis for voice lines. Only the -0.5 dB level trim was applied to them.

## 8. Manifest and catalog wiring

`games/audio/memes/manifest.json` was rewritten with the exact existing schema (`version`, `packs[id,name,emoji,desc,on,sounds[id,label,file,ms,when]]`). Ids, labels, `when` and pack flags are unchanged; `ms` is the real measured duration; forge entries now point at `forge_<name>_trim.wav`.

**Important wiring fact:** `chess.html` loads `audio/memes/catalog.js` before `chess-memes.js`, and `chess-memes.js` (`loadInline()`) prefers `window.__MEME_BANK` over fetching `manifest.json`. So editing the manifest alone changes nothing in the running game. `catalog.js` is a generated artifact (`/* generated from manifest.json + captions.json - do not hand edit */`); I re-ran the sanctioned generator:

```
> node _loop/audio-gen/gen-catalog.js
wrote C:\Users\caleb\AppData\Local\arcade-hub\games\audio\memes\catalog.js 8009 bytes; packs=7 sounds=54
```

`catalog.js` now contains 0 references to `forge_*.mp3` and the trimmed WAV names are live. Backups in the memes dir: `manifest.json.bak-pre-level` (my pre-change copy) and the pre-existing `manifest.json.bak-prior-to-forge-pack`.

## 9. Verification (first pass - `level-memes.js verify`)

```
version=1  packs=7  clips=54
file                              fmt   rate ch  dur_ms  peakdB   rmsdB onset_ms mean_ms  lead  tail
----------------------------------------------------------------------------------------------------
boom_vineboom.wav               pcm16  22050  1     620  -3.50 -12.30        0     359     0   261
boom_bruh.wav                   pcm16  22050  1     333  -3.50 -18.94       40     269    40    24
boom_slowooh.wav                pcm16  22050  1     980  -3.50 -17.35        0     958     0    22
boom_scratch.wav                pcm16  22050  1     500  -3.50 -17.42       15     379    15   106
boom_boom808.wav                pcm16  22050  1     800  -3.50 -11.63        0     479     0   321
boom_thud.wav                   pcm16  22050  1     340  -3.50 -15.05        0     220     0   120
gamer_airhorn.wav               pcm16  22050  1     600  -3.50 -16.34        0     574     0    26
gamer_hitmarker.wav             pcm16  22050  1     220  -3.50 -20.00        0     145     0    75
gamer_noscope.wav               pcm16  22050  1     600  -3.50 -14.75       45     529    45    26
gamer_wasted.wav                pcm16  22050  1    1200  -3.50 -15.27        5     768     5   427
gamer_levelup.wav               pcm16  22050  1     500  -3.50 -13.11        0     409     0    91
sad_sadtrombone.wav             pcm16  22050  1    1280  -3.50 -17.44       35    1202    35    43
sad_ohnonono.wav                pcm16  22050  1     955  -3.50 -16.28        0     933     0    22
sad_wilhelm.wav                 pcm16  22050  1     870  -3.50 -13.47       55     793    55    22
sad_sadbell.wav                 pcm16  22050  1    1300  -3.50 -15.60        0     663     0   637
sad_sadviolin.wav               pcm16  22050  1    1200  -3.50 -14.51       35    1003    35   162
sad_sigh.wav                    pcm16  22050  1     460  -3.50 -16.07        0     439     0    21
victory_crowdroar.wav           pcm16  22050  1    1400  -3.50 -17.16      160     963   160   278
victory_yeahbaby.wav            pcm16  22050  1     682  -3.50 -16.81        0     663     0    19
victory_fanfare.wav             pcm16  22050  1    1200  -3.50 -16.52        0     878     0   322
victory_subdrop.wav             pcm16  22050  1     900  -3.50 -11.96        0     614     0   286
victory_orchestrahit.wav        pcm16  22050  1     700  -3.50 -16.44        0     289     0   411
victory_winsting.wav            pcm16  22050  1     700  -3.50 -15.49        0     424     0   276
toon_boing.wav                  pcm16  22050  1     500  -3.50 -12.33        0     319     0   181
toon_pop.wav                    pcm16  22050  1     220  -3.50 -18.36        0     140     0    80
toon_slidewhistle.wav           pcm16  22050  1     900  -3.50 -10.64        0     644     0   256
toon_twang.wav                  pcm16  22050  1     520  -3.50 -18.46        0     259     0   261
toon_squeak.wav                 pcm16  22050  1     300  -3.50 -11.44        0     234     0    66
toon_bonk.wav                   pcm16  22050  1     300  -3.50 -16.53        0     180     0   120
tts_blunder.wav                 pcm16  22050  1     441  -3.50 -20.16       35     394    35    12
tts_ohno.wav                    pcm16  22050  1     465  -3.50 -16.40        0     444     0    21
tts_nice.wav                    pcm16  22050  1     355  -3.50 -18.71        0     224     0   131
tts_gg.wav                      pcm16  22050  1     390  -3.50 -19.47       15     364    15    11
tts_checkmate.wav               pcm16  22050  1     540  -3.50 -20.22       25     504    25    11
tts_oof.wav                     pcm16  22050  1     280  -3.50 -18.63        0     185     0    95
forge_tension_riser_trim.wav    pcm16  44100  1    2842  -3.50 -17.90      426    1418   426   998
forge_epic_hit_trim.wav         pcm16  44100  1    1600  -3.50 -14.80        5     752     5   843
forge_glass_shatter_trim.wav    pcm16  44100  1     790  -3.50 -16.38      386     215   386   189
forge_crowd_boo_trim.wav        pcm16  44100  1    2995  -3.50 -24.86        0    2952     0    44
forge_slot_win_trim.wav         pcm16  44100  1    2200  -3.50 -21.47        0    2070     0   130
forge_vine_boom2_trim.wav       pcm16  44100  1    1400  -3.50 -21.27        0    1042     0   358
forge_applause_trim.wav         pcm16  44100  1    3704  -3.50 -20.66        0    3503     0   201
forge_dramatic_sting_trim.wav   pcm16  44100  1    2400  -3.50 -19.54        0    2350     0    50
forge_sub_impact_trim.wav       pcm16  44100  1    1700  -3.50 -19.31        0     747     0   953
forge_buzzer_trim.wav           pcm16  44100  1    1200  -3.50 -16.28        0    1082     0   118
forge_ding_trim.wav             pcm16  44100  1    1400  -3.50 -15.36        5    1313     5    82
forge_coin_trim.wav             pcm16  44100  1     627  -3.50 -17.61      130     366   130   131
forge_sad_trombone2_trim.wav    pcm16  44100  1    2600  -3.50 -18.20        0    2380     0   220
forge_airhorn2_trim.wav         pcm16  44100  1    1647  -3.50 -15.71       10    1564    10    74
forge_crowd_gasp_trim.wav       pcm16  44100  1    1647  -3.50 -18.56        5    1574     5    69
forge_cartoon_boom_trim.wav     pcm16  44100  1    1300  -3.50 -21.14        0     411     0   889
forge_boing2_trim.wav           pcm16  44100  1    1200  -3.50 -20.85       25     997    25   178
forge_levelup_trim.wav          pcm16  44100  1    1800  -3.50 -19.71        5    1594     5   201
forge_scratch2_trim.wav         pcm16  44100  1    1642  -3.50 -20.74      215    1383   215    43
---
VERIFY PASS
---
VERIFY PASS
```

Contract asserted per referenced file: exists; decodes as PCM WAV (`fmt`=1, 16-bit); duration in 30-4000 ms; peak in -4..-3 dBFS; manifest `ms` within 5 ms of measured; no two entries share a file. All 54 pass, 0 duplicate targets.

## 10. Independent verification (second pass - `verify-memes2.js`)

`verify-memes2.js` shares **no code** with `level-memes.js`: its own RIFF chunk walker, its own sample loop, its own 10 ms envelope and its own peak/RMS arithmetic; it shells out to ffmpeg itself for any MP3. Full output:

```
fmt   file                            rate  dur_ms  peakdB   rmsdB onset_ms mean_ms  lead  tail  checks
--------------------------------------------------------------------------------------------------------------
pcm   boom_vineboom.wav              22050     620   -3.50  -12.30        0     611     0     9  ok
pcm   boom_bruh.wav                  22050     333   -3.50  -18.94       30     291    30    12  ok
pcm   boom_slowooh.wav               22050     980   -3.50  -17.35        0     972     0     8  ok
pcm   boom_scratch.wav               22050     500   -3.50  -17.42        0     491     0     9  ok
pcm   boom_boom808.wav               22050     800   -3.50  -11.63        0     792     0     8  ok
pcm   boom_thud.wav                  22050     340   -3.50  -15.05        0     311     0    29  ok
pcm   gamer_airhorn.wav              22050     600   -3.50  -16.34        0     581     0    19  ok
pcm   gamer_hitmarker.wav            22050     220   -3.50  -20.00        0     140     0    80  ok
pcm   gamer_noscope.wav              22050     600   -3.50  -14.75       10     581    10     9  ok
pcm   gamer_wasted.wav               22050    1200   -3.50  -15.27        0    1183     0    17  ok
pcm   gamer_levelup.wav              22050     500   -3.50  -13.11        0     481     0    19  ok
pcm   sad_sadtrombone.wav            22050    1280   -3.50  -17.44        0    1263     0    17  ok
pcm   sad_ohnonono.wav               22050     955   -3.50  -16.28        0     942     0    13  ok
pcm   sad_wilhelm.wav                22050     870   -3.50  -13.47        0     862     0     8  ok
pcm   sad_sadbell.wav                22050    1300   -3.50  -15.60        0    1273     0    27  ok
pcm   sad_sadviolin.wav              22050    1200   -3.50  -14.51        0    1193     0     7  ok
pcm   sad_sigh.wav                   22050     460   -3.50  -16.07        0     451     0     9  ok
pcm   victory_crowdroar.wav          22050    1400   -3.50  -17.16       10    1363    10    27  ok
pcm   victory_yeahbaby.wav           22050     682   -3.50  -16.81        0     672     0    10  ok
pcm   victory_fanfare.wav            22050    1200   -3.50  -16.52        0    1183     0    17  ok
pcm   victory_subdrop.wav            22050     900   -3.50  -11.96        0     882     0    18  ok
pcm   victory_orchestrahit.wav       22050     700   -3.50  -16.44        0     672     0    28  ok
pcm   victory_winsting.wav           22050     700   -3.50  -15.49        0     682     0    18  ok
pcm   toon_boing.wav                 22050     500   -3.50  -12.33        0     491     0     9  ok
pcm   toon_pop.wav                   22050     220   -3.50  -18.36        0     140     0    80  ok
pcm   toon_slidewhistle.wav          22050     900   -3.50  -10.64        0     892     0     8  ok
pcm   toon_twang.wav                 22050     520   -3.50  -18.46        0     501     0    19  ok
pcm   toon_squeak.wav                22050     300   -3.50  -11.44        0     291     0     9  ok
pcm   toon_bonk.wav                  22050     300   -3.50  -16.53        0     271     0    29  ok
pcm   tts_blunder.wav                22050     441   -3.50  -20.16       40     391    40    10  ok
pcm   tts_ohno.wav                   22050     465   -3.50  -16.40        0     451     0    14  ok
pcm   tts_nice.wav                   22050     355   -3.50  -18.71        0     231     0   124  ok
pcm   tts_gg.wav                     22050     390   -3.50  -19.47       10     371    10     9  ok
pcm   tts_checkmate.wav              22050     540   -3.50  -20.22       30     501    30     9  ok
pcm   tts_oof.wav                    22050     280   -3.50  -18.63        0     180     0   100  ok
pcm   forge_tension_riser_trim.wav   44100    2842   -3.50  -17.90        0    2810     0    32  ok
pcm   forge_epic_hit_trim.wav        44100    1600   -3.50  -14.80        0    1590     0    10  ok
pcm   forge_glass_shatter_trim.wav   44100     790   -3.50  -16.38        0     770     0    20  ok
pcm   forge_crowd_boo_trim.wav       44100    2995   -3.50  -24.86        0    2640     0   355  ok
pcm   forge_slot_win_trim.wav        44100    2200   -3.50  -21.47        0    2000     0   200  ok
pcm   forge_vine_boom2_trim.wav      44100    1400   -3.50  -21.27        0    1390     0    10  ok
pcm   forge_applause_trim.wav        44100    3704   -3.50  -20.66        0    3670     0    34  ok
pcm   forge_dramatic_sting_trim.wav  44100    2400   -3.50  -19.54     1040    1310  1040    50  ok
pcm   forge_sub_impact_trim.wav      44100    1700   -3.50  -19.31        0    1640     0    60  ok
pcm   forge_buzzer_trim.wav          44100    1200   -3.50  -16.28        0    1180     0    20  ok
pcm   forge_ding_trim.wav            44100    1400   -3.50  -15.36        0    1360     0    40  ok
pcm   forge_coin_trim.wav            44100     627   -3.50  -17.61       10     550    10    67  ok
pcm   forge_sad_trombone2_trim.wav   44100    2600   -3.50  -18.20        0    2390     0   210  ok
pcm   forge_airhorn2_trim.wav        44100    1647   -3.50  -15.71        0    1640     0     7  ok
pcm   forge_crowd_gasp_trim.wav      44100    1647   -3.50  -18.56       10    1590    10    47  ok
pcm   forge_cartoon_boom_trim.wav    44100    1300   -3.50  -21.14        0     400     0   900  ok
pcm   forge_boing2_trim.wav          44100    1200   -3.50  -20.85        0    1120     0    80  ok
pcm   forge_levelup_trim.wav         44100    1800   -3.50  -19.71        0    1770     0    30  ok
pcm   forge_scratch2_trim.wav        44100    1642   -3.50  -20.74        0    1630     0    12  ok
---
clips=54 duplicate-targets=0 fails=0
INDEPENDENT PASS
```

Cross-check: duration, peak and RMS agree to the printed precision (peak is exactly -3.50 dBFS for all 54 clips; durations match the manifest). The onset / meaningful-duration columns differ in places **by design** - `level-memes.js` uses first/last 5 ms frame above a peak-30 dB gate (good for continuous crowds/risers) while `verify-memes2.js` uses first/last 10 ms frame above peak-29 dB. Where a sound has big internal dynamics (`crowd_boo`, `applause`, `slot_win`) the two onset rules legitimately disagree; where they matter (duration, peak, PCM, duplicate targets) they agree exactly.

## 11. Re-runnability

`apply` is idempotent: it always derives forge sources from the original `forge_*.mp3`, always normalises synth peaks to the target, and derives the trimmed name from the base name rather than appending. Proof:

```
manifest hash before re-run: 641CAEC6D2AD14CACCC2A5957D7762478CD7988547913BA50EBFA2496F2010BB
manifest hash after  re-run: 641CAEC6D2AD14CACCC2A5957D7762478CD7988547913BA50EBFA2496F2010BB
IDEMPOTENT: manifest unchanged
```

## 12. What I could not verify

- **I have no audio device and cannot listen.** Every judgement about cheap-sounding clips and meaningful parts is based on the measured envelope/peak/RMS and the known generator source of each clip, not on hearing. In particular I cannot certify that a regenerated recipe *sounds* better than the old one - only that it is no longer a bare sine, has a sane envelope and level, and is within contract.
- **No browser playback test.** I did not open `chess.html` or exercise `chess-memes.js`; I only re-read it to confirm how the catalog is loaded. The parent should load the page (and its HMR/rebuild path) to confirm the new files actually play.
- The MP3 decode step depends on the local ffmpeg 8.1.2; a different decoder could produce a millisecond or two of difference at the edges, which is inside the 30-4000 ms contract.
- I did not edit `chess-memes.js`, so I cannot verify that the game handles a 3.7 s WAV cue gracefully (overlap/interruption behaviour is the parent's call). The `ms` field the game uses for caption timing is now accurate.
- `catalog.js` is regenerated but the parent owns that file's wiring; if the parent prefers the manifest fetch path, `catalog.js` can simply be deleted or left to the generator.

## 13. No-download statement

Nothing was downloaded or copied from the internet or any external sample library. The 19 forge clips were decoded and re-trimmed from the MP3s already present in `games/audio/memes/`; the 8 regenerated clips are synthesised by arithmetic DSP written in `_loop/audio-gen/level-memes.js`; the other synth clips are the repo's own `gen-memes.js` output with a single gain applied. The only external process used is the local `ffmpeg`/`ffprobe` binary for decoding/measuring existing files.
