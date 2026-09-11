# Chess Juice — Meme Sound Bank (audio-gen) report

Generated: 2026-09-11 (Australia/Perth) · workspace: `C:\Users\caleb\AppData\Local\arcade-hub`
Node: `C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe` (v24.18.0)

## 0. Copyright position (non-negotiable)

**Every clip in this bank is original algorithmic synthesis.** No audio was downloaded,
recorded, decoded, resampled or copied from any website, game, film or clip. There are no
samples, no sample packs and no third-party assets. Each WAV is computed from oscillators
(sine/saw/square/triangle/noise), formant filters, envelopes and delays, then written to a
raw 44-byte PCM header. The meme references are *style descriptions only* (e.g. "sub-bass boom",
"airhorn", "sad trombone"); the waveforms themselves are new DSP. The TTS lines are formant
synthesis and deliberately robotic — they do not clone, imitate or sample any real person's voice.

## 1. Deliverables

| Path | What | Size |
|---|---|---|
| `_loop/audio-gen/gen-memes.js` | Node stdlib-only generator + `verify` subcommand | 38,098 B (41 KB) |
| `_loop/audio-gen/verify-bank.js` | independent second-opinion WAV/manifest checker (extra helper, not required) | — |
| `games/audio/memes/manifest.json` | pack/meme catalogue, schema below | 7,003 B |
| `games/audio/memes/*.wav` | 35 clips | 1,043,230 B total (1018.8 KB) |
| `_loop/research/audio-bank-report.md` | this report | — |

Not touched: `games/chess.html` and any `games/*.js`. The UI integration is a separate agent's job.
(While this ran, a sibling agent was concurrently writing `games/chess-memes.js`,
`games/chess-sfx-hd.js` and `games/audio/memes/captions.json`; see §7.)

## 2. Format contract

* 22050 Hz, mono, 16-bit signed PCM, plain 44-byte RIFF/WAVE header, no extra chunks, no trailing bytes.
* Every clip 0.180 s – 1.600 s. Actual range: **0.200 s – 1.350 s**.
* Loudness: peak-normalised **exactly to −3.00 dBFS** (inside the required −4…−2 dBFS window).
* De-click: **5 ms fade-in + 30 ms fade-out** implemented as power curves (fade-in `x^4` over
  110 samples, fade-out `x^3` over 662 samples) on top of an intrinsic 4 ms smoothstep attack
  baked into each sound. A linear 5 ms ramp is *not* near zero at sample 40 (36 % of full scale),
  so a power curve is used inside the same 5 ms / 30 ms windows; measured first-40-sample max is
  ≤ 0.00381 full scale and last-40 max ≤ 0.00009.
* Size: largest file **59,580 B** (< 61,440 B = 60 KB). Bank total **1,043,230 B** (< 1.5 MB).

## 3. Contents — 6 packs / 35 clips

| Pack | id | on | clips | Sound files |
|---|---|---|---|---|
| 💥 Boom & Bruh | boom | true | 6 | boom_vineboom, boom_bruh, boom_slowooh, boom_scratch, boom_boom808, boom_thud |
| 🎮 Gamer / MLG | gamer | true | 5 | gamer_airhorn, gamer_hitmarker, gamer_noscope, gamer_wasted, gamer_levelup |
| 😢 Sad & Tragic | sad | false | 6 | sad_sadtrombone, sad_ohnonono, sad_wilhelm, sad_sadbell, sad_sadviolin, sad_sigh |
| 🏆 Victory & Hype | victory | true | 6 | victory_crowdroar, victory_yeahbaby, victory_fanfare, victory_subdrop, victory_orchestrahit, victory_winsting |
| 🃏 Cartoon | toon | false | 6 | toon_boing, toon_pop, toon_slidewhistle, toon_twang, toon_squeak, toon_bonk |
| 🤖 Robo Voice | tts | true | 6 | tts_blunder, tts_ohno, tts_nice, tts_gg, tts_checkmate, tts_oof |

Longest label is 16 chars ("Record Scratch"); all ≤ 22.

### Event coverage (`when`)

```
capture:3  blunder:6  lose:4  undo:3  checkmate:3  check:3  promote:2
combo3:1   hint:2     draw:1  win:5   start:1      castle:1
```

All 13 allowed events (`blunder, capture, check, checkmate, castle, promote, win, lose, draw,
start, undo, hint, combo3`) are used at least once.

## 4. Synthesis approach per pack

Shared DSP: `mulberry32` seeded PRNG per clip (byte-identical regeneration), Chamberlin
state-variable filter (per-sample tunable centre frequency), RBJ biquads (lp/hp/bp), tanh
waveshaper, 4-tap comb reverb, pitch-envelope oscillators, Karplus-Strong pluck, FM bell,
and a 3-band parallel formant synthesiser with a differentiated-saw glottal source.

**boom (Boom & Bruh)** — `vineboom`: 34→80 Hz pitched sub-sine with ~3 s⁻¹ exponential decay,
layered with a 900 Hz-lowpassed noise transient and mild tanh saturation. `bruh`: formant voice
/b/ burst → /ɹ/ → /ʌ/ with f0 132→108 Hz. `slowooh`: long /uː/ formant glide 168→106 Hz through a
comb reverb (slow-motion feel). `scratch`: white noise through a 380–1880 Hz SVF whose centre
wobbles under a 2.2 Hz scratch motion plus a 7 Hz flutter, with an amplitude gate. `boom808`:
38→90 Hz sine boom, 2.4 s⁻¹ decay, click transient, saturation. `thud`: 96→66 Hz sine thump plus
a 1.4 kHz-lowpassed noise crack.

**gamer (Gamer / MLG)** — `airhorn`: six detuned saws (392/415/494/523/784/830 Hz) with a 27 Hz
tremolo, bandpass at 1.1 kHz and a late pitch lift, saturated. `hitmarker`: two sine dings
(1500→2020 Hz sweep + 3050 Hz partial) with a 9-sample click. `noscope`: bandpass noise sweeping
280→3880 Hz for the whoosh, then a 1400-sample noise crack. `wasted`: descending minor third
(E♭4→C4) on lowpassed saturated saws with 5.5 Hz vibrato and a 65 Hz sub. `levelup`: four square
blips (C5/E5/G5/C6) with octave sine sparkle.

**sad (Sad & Tragic)** — `sadtrombone`: saw sliding 330→233 Hz in four chromatic-ish steps through
a 480–900 Hz wah SVF at 3.4 Hz. `ohnonono`: four descending /oʊ/ formant syllables (196→150 Hz)
with nasal murmurs. `wilhelm`: generic distant yell — bandpassed 3-formant /ɑː/ 380→236 Hz, heavy
comb reverb. `sadbell`: FM bell (carrier 220 Hz, ratio 2.76, index 3.2) with a soft filtered-rain
bed and 26 random droplets. `sadviolin`: detuned saw pair with 6 Hz/1.2 % vibrato on a 440→392→349 Hz
descending phrase, reverb. `sigh`: breathy 210→160 Hz /ɑː/ with noise.

**victory (Victory & Hype)** — `crowdroar`: 1.2 kHz bandpassed noise swell with rise/hold/fall
envelope, a formant cheer layer and 46 randomly placed claps. `yeahbaby`: formant shout
"yeah baby" (f0 ≈ 226–246 Hz, /jɛ/→/eɪ/→/iː/ with closed-burst consonants). `fanfare`:
three-detune saw brass over a rising 392→1046 Hz five-note motif. `subdrop`: 180→30 Hz sine
sweep plus a 2 kHz-lowpassed impact and reverb. `orchestrahit`: six-voice stacked-saw chord
(C3 E♭3 G3 C4 E♭4 G4) with tanh drive and a 65.4 Hz timpani thump. `winsting`: four sine chimes
with inharmonic 2.01×/3.02× partials.

**toon (Cartoon)** — `boing`: sine bent 980→160 Hz with 21 Hz vibrato plus a triangle undertow.
`pop`: rising 300→1700 Hz sine in 50 ms with a click. `slidewhistle`: sine falling 1320→340 Hz,
6.5 Hz vibrato and a 2.4 kHz breath layer. `twang`: Karplus-Strong pluck (240 Hz, damp 0.994) plus
a springy 600→140 Hz sweep. `squeak`: rising 520→1820 Hz sine with 28 Hz vibrato. `bonk`:
180→110 Hz hollow saw/sine with a 900 Hz resonant click.

**tts (Robo Voice)** — a keyframe-driven 3-band formant synthesiser: bandpass filtered
differentiated-saw glottal source, interpolated vowel formants (ah/eh/ee/ih/oh/oo/uh/er/ay),
stop bursts and fricative noise, monotone (pitch held per keyframe), then a mild sample-rate
crush + 10-bit quantisation and 37 Hz ring mod for the robotic edge. Lines: "blunder", "oh no",
"nice", "gg", "checkmate", "oof". **No real voice is modelled or cloned.**

## 5. Manifest schema (as shipped)

```json
{
  "version": 1,
  "packs": [
    { "id": "boom", "name": "Boom & Bruh", "emoji": "💥", "desc": "Deep impacts, bruh formants and record-scratch wobble.", "on": true,
      "sounds": [ { "id": "vineboom", "label": "Vine Boom", "file": "boom_vineboom.wav", "ms": 720, "when": "capture" } ] }
  ]
}
```

`ms` is the true rendered duration (rounded from sample count), not an estimate. Exactly 6 packs,
5–8 sounds each, 35 sounds.

## 6. Verification — commands and real output

All commands run with cwd `C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen`
and `$NODE = C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe`.

### 6.1 Generate (`& $NODE gen-memes.js`)

```
generating C:\Users\caleb\AppData\Local\arcade-hub\games\audio\memes
file                            bytes     ms     sec
boom_vineboom.wav               31796    720   0.720
boom_bruh.wav                   14730    333   0.333
boom_slowooh.wav                43262    980   0.980
boom_scratch.wav                22094    500   0.500
boom_boom808.wav                40616    920   0.920
boom_thud.wav                   14156    320   0.320
gamer_airhorn.wav               26504    600   0.600
gamer_hitmarker.wav              8864    200   0.200
gamer_noscope.wav               26504    600   0.600
gamer_wasted.wav                52964   1200   1.200
gamer_levelup.wav               22094    500   0.500
sad_sadtrombone.wav             56492   1280   1.280
sad_ohnonono.wav                42160    955   0.955
sad_wilhelm.wav                 38412    870   0.870
sad_sadbell.wav                 57374   1300   1.300
sad_sadviolin.wav               52964   1200   1.200
sad_sigh.wav                    20330    460   0.460
victory_crowdroar.wav           59580   1350   1.350
victory_yeahbaby.wav            30120    682   0.682
victory_fanfare.wav             52964   1200   1.200
victory_subdrop.wav             39734    900   0.900
victory_orchestrahit.wav        30914    700   0.700
victory_winsting.wav            30914    700   0.700
toon_boing.wav                  22094    500   0.500
toon_pop.wav                     8864    200   0.200
toon_slidewhistle.wav           39734    900   0.900
toon_twang.wav                  22976    520   0.520
toon_squeak.wav                 11510    260   0.260
toon_bonk.wav                   13274    300   0.300
tts_blunder.wav                 19492    441   0.441
tts_ohno.wav                    20550    465   0.465
tts_nice.wav                    15700    355   0.355
tts_gg.wav                      17244    390   0.390
tts_checkmate.wav               23858    540   0.540
tts_oof.wav                     12392    280   0.280
----------------------------------------------------
files: 35   total bytes: 1043230 (1018.8 KB)
manifest: C:\Users\caleb\AppData\Local\arcade-hub\games\audio\memes\manifest.json
```
exit code 0.

### 6.2 Built-in contract check (`& $NODE gen-memes.js verify`)

597 assertions; first lines and the tail:

```
ok    manifest.version === 1  [1]
ok    packs count in 5..7  [6]
ok    pack id slug: boom
ok    sounds in pack boom 5..8  [6]
ok    when valid in boom_vineboom.wav  [capture]
ok    ms in 180..1600 in boom_vineboom.wav  [720]
ok    <60KB boom_vineboom.wav  [31796 bytes]
ok    PCM format boom_vineboom.wav  [1]
ok    mono boom_vineboom.wav  [1]
ok    22050 Hz boom_vineboom.wav  [22050]
ok    16-bit boom_vineboom.wav  [16]
ok    byteRate/blockAlign boom_vineboom.wav
ok    RIFF size field boom_vineboom.wav
ok    no trailing bytes boom_vineboom.wav
ok    sample count boom_vineboom.wav  [15876 vs ~15876]
ok    peak -4..-2 dBFS boom_vineboom.wav  [-3.00 dB]
ok    first/last 40 samples near zero boom_vineboom.wav  [head=0.0025 tail=0.0000]
...
ok    no unreferenced .wav files on disk  [none]
ok    manifest file count == wav count  [35 vs 35]
ok    total < 1.5 MB  [1018.8 KB]
VERIFY PASS: 0 failure(s), 35 clips, 35 wav on disk, total 1043230 bytes
```
exit code 0.

The checks cover, per clip: RIFF/WAVE/fmt /data tags, PCM format 1, mono, 22050 Hz, 16-bit,
byteRate 44100 + blockAlign 2, RIFF size field = 36+dataSize, no trailing bytes, sample count
matches manifest `ms`, peak in −4…−2 dBFS, first/last 40 samples < 0.02, file < 60 KB; and per
manifest: schema fields, pack count 5–7, sounds/pack 5–8, label ≤ 22 chars, `when` in the allowed
set, duration 180–1600 ms, every file exists, no orphan WAVs, total < 1.5 MB.

### 6.3 Independent check (`& $NODE verify-bank.js`)

Separate parser (does not import the generator) over all 35 files, "near zero" = |sample| ≤ 0.005:

```
boom_vineboom.wav           31796 B   15876 smp  0.720s  peak -3.00 dBFS  head 0.00250  tail 0.00000
boom_bruh.wav               14730 B    7343 smp  0.333s  peak -3.00 dBFS  head 0.00000  tail 0.00003
boom_slowooh.wav            43262 B   21609 smp  0.980s  peak -3.00 dBFS  head 0.00043  tail 0.00003
boom_scratch.wav            22094 B   11025 smp  0.500s  peak -3.00 dBFS  head 0.00031  tail 0.00003
boom_boom808.wav            40616 B   20286 smp  0.920s  peak -3.00 dBFS  head 0.00351  tail 0.00003
boom_thud.wav               14156 B    7056 smp  0.320s  peak -3.00 dBFS  head 0.00366  tail 0.00000
gamer_airhorn.wav           26504 B   13230 smp  0.600s  peak -3.00 dBFS  head 0.00015  tail 0.00000
gamer_hitmarker.wav          8864 B    4410 smp  0.200s  peak -3.00 dBFS  head 0.00302  tail 0.00000
gamer_noscope.wav           26504 B   13230 smp  0.600s  peak -3.00 dBFS  head 0.00000  tail 0.00003
gamer_wasted.wav            52964 B   26460 smp  1.200s  peak -3.00 dBFS  head 0.00089  tail 0.00000
gamer_levelup.wav           22094 B   11025 smp  0.500s  peak -3.00 dBFS  head 0.00064  tail 0.00003
sad_sadtrombone.wav         56492 B   28224 smp  1.280s  peak -3.00 dBFS  head 0.00037  tail 0.00003
sad_ohnonono.wav            42160 B   21058 smp  0.955s  peak -3.00 dBFS  head 0.00034  tail 0.00009
sad_wilhelm.wav             38412 B   19184 smp  0.870s  peak -3.00 dBFS  head 0.00009  tail 0.00003
sad_sadbell.wav             57374 B   28665 smp  1.300s  peak -3.00 dBFS  head 0.00305  tail 0.00000
sad_sadviolin.wav           52964 B   26460 smp  1.200s  peak -3.00 dBFS  head 0.00006  tail 0.00000
sad_sigh.wav                20330 B   10143 smp  0.460s  peak -3.00 dBFS  head 0.00058  tail 0.00000
victory_crowdroar.wav       59580 B   29768 smp  1.350s  peak -3.00 dBFS  head 0.00031  tail 0.00000
victory_yeahbaby.wav        30120 B   15038 smp  0.682s  peak -3.00 dBFS  head 0.00049  tail 0.00006
victory_fanfare.wav         52964 B   26460 smp  1.200s  peak -3.00 dBFS  head 0.00162  tail 0.00000
victory_subdrop.wav         39734 B   19845 smp  0.900s  peak -3.00 dBFS  head 0.00327  tail 0.00000
victory_orchestrahit.wav    30914 B   15435 smp  0.700s  peak -3.00 dBFS  head 0.00125  tail 0.00000
victory_winsting.wav        30914 B   15435 smp  0.700s  peak -3.00 dBFS  head 0.00238  tail 0.00000
toon_boing.wav              22094 B   11025 smp  0.500s  peak -3.00 dBFS  head 0.00381  tail 0.00003
toon_pop.wav                 8864 B    4410 smp  0.200s  peak -3.00 dBFS  head 0.00275  tail 0.00000
toon_slidewhistle.wav       39734 B   19845 smp  0.900s  peak -3.00 dBFS  head 0.00330  tail 0.00006
toon_twang.wav              22976 B   11466 smp  0.520s  peak -3.00 dBFS  head 0.00128  tail 0.00000
toon_squeak.wav             11510 B    5733 smp  0.260s  peak -3.00 dBFS  head 0.00198  tail 0.00003
toon_bonk.wav               13274 B    6615 smp  0.300s  peak -3.00 dBFS  head 0.00049  tail 0.00000
tts_blunder.wav             19492 B    9724 smp  0.441s  peak -3.00 dBFS  head 0.00000  tail 0.00006
tts_ohno.wav                20550 B   10253 smp  0.465s  peak -3.00 dBFS  head 0.00040  tail 0.00003
tts_nice.wav                15700 B    7828 smp  0.355s  peak -3.00 dBFS  head 0.00027  tail 0.00000
tts_gg.wav                  17244 B    8600 smp  0.390s  peak -3.00 dBFS  head 0.00000  tail 0.00000
tts_checkmate.wav           23858 B   11907 smp  0.540s  peak -3.00 dBFS  head 0.00003  tail 0.00000
tts_oof.wav                 12392 B    6174 smp  0.280s  peak -3.00 dBFS  head 0.00079  tail 0.00000
---
clips=35 wav_on_disk=35 total=1043230 bytes (1018.8 KB) packs=6
max head=0.00381  max tail=0.00009  max file=59580 bytes
INDEPENDENT CHECK PASS
```
exit code 0.

### 6.4 Directory listing

```
(Get-ChildItem ...\games\audio\memes -File | Measure-Object Length -Sum).Sum
1053011   # 1,043,230 B of WAVs + 7,003 B manifest.json + 2,778 B captions.json (sibling agent)
```

## 7. Integration notes for the UI agent

* The shipped catalogue is at **`audio/memes/manifest.json`** (relative to `games/chess.html`),
  and every WAV is at `audio/memes/<file>`. `file` is the field name; there is no `src` in the JSON.
* The concurrently-written `games/chess-memes.js` already matches this schema: it fetches
  `audio/memes/manifest.json`, reads `pack.on`, then sets `s.src = 'audio/memes/' + s.file`
  (line 389) and plays via fetch + `decodeAudioData` with an `<audio>` fallback. No change needed.
* **file:// caveat (important, not mine to fix):** `fetch('audio/memes/manifest.json')` is blocked
  by Chrome on `file://` pages ("URL scheme must be http or https"), so on a local double-click the
  UI's `.catch` sets `catalog = null` and the meme panel shows "Loading meme bank…" forever and
  fires nothing. The WAVs themselves load fine through `<audio>` from file://. To satisfy the
  "works from file://" requirement the integrator needs a non-fetch path for the catalogue — e.g.
  inline the JSON as a `window.__MEME_CATALOG` script block in `chess.html`, or embed the pack
  list in the UI JS. I did not create such a file because the brief restricts me to the four paths.
* Loading 1.0 MB of WAV in one go is fine, but the panel's per-sound preview lazy-loads each file,
  which is the right call.
* Random pick is already one clip per event per firing; multiple clips intentionally share events,
  so the UI will vary. Pack `on` flags ship as boom/gamer/victory/tts = on, sad/toon = off.

## 8. Not verified / limitations

* **Audibility and subjective quality were not verified.** This is a headless worker with no audio
  output and no browser session; I proved the bytes are correct PCM with the right levels and
  envelope, not that a human finds each imitation convincing or pleasant. A quick manual listen is
  recommended, especially the formant TTS lines and `victory_yeahbaby`.
* **Browser decode/playback from file:// and over https was not run.** Header maths, sample counts
  and level normalisation are verified; real `<audio>`/`decodeAudioData` behaviour is not.
* The generator's own `verify` shares the file with the writer (same PRNG/finish code), so
  §6.3 uses a genuinely independent parser as the second opinion. Both agree.
* `captions.json` and the modified `games/chess.html`, `games/chess-memes.js`, `games/chess-sfx-hd.js`
  belong to a concurrent sibling agent; I neither wrote nor validated them. The manifest's
  "no orphan WAV" check only inspects `.wav` files, so the extra JSON files do not affect it.
* Regeneration is deterministic: same seed per clip, so re-running `gen-memes.js` rewrites
  byte-identical WAVs and the manifest (timestamps aside).
