# Chess sound bank - physical / modal synthesis report

**Project:** `C:\Users\caleb\AppData\Local\arcade-hub` (static arcade site, GitHub Pages)
**Target:** `games/chess.html` ("Chess Juice") - replacing the weak hand-tuned WebAudio blips.
**Author:** audio-generation subagent, 2026-09-11.

## 0. Provenance (hard rule)

Every sample in this bank is **synthesised from scratch by `gen-chess-sounds.js`**. Nothing was
downloaded, ripped, sampled or copied from any website, game or clip. The generator uses only the
Node standard library (`fs`, `path`); it implements its own oscillators, exponentially decaying
modal voices, filtered-noise transients, biquad filters and WAV writer. There is no build step and
no server: the output is plain 44.1 kHz mono 16-bit PCM WAV plus a JSON manifest, so it works over
https and from `file://`.

## 1. Deliverables

| File | What |
| --- | --- |
| `_loop/audio-gen/gen-chess-sounds.js` | stdlib-only generator + `verify` subcommand |
| `games/audio/chess/*.wav` | 14 sounds (3 move + 3 capture variations, 8 one-offs) |
| `games/audio/chess/manifest.json` | `{ version: 1, sounds: [...] }`, 14 entries |
| `_loop/research/chess-sound-bank-report.md` | this report |

The manifest carries one extra key per entry, `kind` (e.g. `"tick"`), used by `verify` to choose
the metric window. Plain JSON consumers can ignore it.

## 2. Exact commands and their real output

Render the bank (`node` is `C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe`):

```
> node gen-chess-sounds.js
RENDERING bank -> C:\Users\caleb\AppData\Local\arcade-hub\games\audio\chess
  move.wav                11510 bytes  (130 ms, move)
  move-2.wav              11510 bytes  (130 ms, move)
  move-3.wav              11510 bytes  (130 ms, move)
  capture.wav             19448 bytes  (220 ms, capture)
  capture-2.wav           19448 bytes  (220 ms, capture)
  capture-3.wav           19448 bytes  (220 ms, capture)
  castle.wav              19448 bytes  (220 ms, castle)
  check.wav               22976 bytes  (260 ms, check)
  promote.wav             38852 bytes  (440 ms, promote)
  game-end-win.wav        38852 bytes  (440 ms, game-end-win)
  game-end-loss.wav       39734 bytes  (450 ms, game-end-loss)
  illegal.wav             16802 bytes  (190 ms, illegal)
  low-time-tick.wav        2690 bytes  (30 ms, tick)
  game-start.wav          21212 bytes  (240 ms, game-start)
  manifest.json            1964 bytes  (14 sounds)
BANK TOTAL: 293440 bytes (286.6 KiB) across 14 WAVs
```

Verify (re-parses every WAV from disk, exit code 0 = all assertions passed):

```
> node gen-chess-sounds.js verify
VERIFY C:\Users\caleb\AppData\Local\arcade-hub\games\audio\chess
file                   bytes   ms  peakdB  centroidHz   t10ms  hit  onset   verdict
move.wav               11510   130   -3.50      1957     58.4    1   1.00   ok
move-2.wav             11510   130   -3.50      1928     54.6    1   1.00   ok
move-3.wav             11510   130   -3.50      2127     58.2    1   1.00   ok
capture.wav            19448   220   -3.50      2370    147.3    2   1.00   ok
capture-2.wav          19448   220   -3.50      2376    123.8    2   1.00   ok
capture-3.wav          19448   220   -3.50      2497    118.0    2   0.81   ok
castle.wav             19448   220   -3.50      1971    175.8    2   0.83   ok
check.wav              22976   260   -3.50      1433    203.1    1   0.90   ok
promote.wav            38852   440   -3.50       659    400.5    4   0.80   ok
game-end-win.wav       38852   440   -3.50       495    406.6    5   0.68   ok
game-end-loss.wav      39734   450   -3.50       836    421.2    5   0.68   ok
illegal.wav            16802   190   -3.50       168    140.1    2   0.89   ok
low-time-tick.wav       2690    30   -3.50      2630     18.2    1   1.00   ok
game-start.wav         21212   240   -3.50      1798    202.7    2   0.85   ok

melody promote.wav       524 -> 658 -> 784 -> 1046 Hz  (rising)
melody game-end-win.wav  392 -> 522 -> 658 -> 784 -> 1048 Hz  (rising)
melody game-end-loss.wav 660 -> 588 -> 524 -> 490 -> 444 Hz  (falling)
check partials    1195 / 1605 / 2215 / 2510 Hz   ratios 1.00 / 1.34 / 1.85 / 2.10
bank total: 293440 bytes (286.6 KiB)
checks: RIFF/WAVE/fmt/data, PCM16 mono 44100, sample count vs declared ms, peak -4..-3 dBFS,
        first/last 20 samples zero, no sample > full scale, 40 KiB/file cap, 700 KiB bank cap,
        manifest<->disk bijection, per-kind spectral centroid + decay-to-10% + envelope-hit count.

ALL CHECKS PASSED (14 files).
```

Working tree check (`git status --porcelain`): my changes are the new
`_loop/audio-gen/gen-chess-sounds.js` and the new `games/audio/chess/` directory. `games/chess.html`
and `games/chess-memes.js` show as modified **by the parent, not by me** - I did not open them for
writing. The pre-existing `games/audio/chess/*.mp3` files are untouched and still present.

## 3. The bank

| id | label | file | ms | kind |
| --- | --- | --- | --- | --- |
| move | Move | move.wav | 130 | move |
| move-2 | Move (alt 2) | move-2.wav | 130 | move |
| move-3 | Move (alt 3) | move-3.wav | 130 | move |
| capture | Capture | capture.wav | 220 | capture |
| capture-2 | Capture (alt 2) | capture-2.wav | 220 | capture |
| capture-3 | Capture (alt 3) | capture-3.wav | 220 | capture |
| castle | Castle | castle.wav | 220 | castle |
| check | Check | check.wav | 260 | check |
| promote | Promote | promote.wav | 440 | promote |
| game-end-win | Game End (Win) | game-end-win.wav | 440 | game-end-win |
| game-end-loss | Game End (Loss) | game-end-loss.wav | 450 | game-end-loss |
| illegal | Illegal Move | illegal.wav | 190 | illegal |
| low-time-tick | Low Time Tick | low-time-tick.wav | 30 | tick |
| game-start | Game Start | game-start.wav | 240 | game-start |

Total 293,440 bytes (286.6 KiB); largest file 39,734 bytes (cap 40,960).

## 4. DSP recipe

### 4.1 Shared primitives

- **Modal voice** - `amp * exp(-t/tau) * sin(2*pi*f*t + phase)`, where `tau` is set so the
  amplitude has fallen to exactly 10% after `t10` ms (`tau = t10ms/1000/ln(10)`).
- **Plate mode** - each mode is a *detuned pair* at `f*(1-d)` and `f*(1+d)`, `d` about 0.4-1%,
  with an **unequal amplitude split (0.68 / 0.32)**. The two partials beat slightly, which is what
  makes wood sound like a resonant object rather than a tone; the unequal split keeps the shimmer
  without the phasey nulls an equal split would produce.
- **Contact transient** - 1.7 ms of white noise with a 1 ms decay, band-shaped by a highpass around
  0.9-1.5 kHz and a lowpass around 8-11 kHz. This is the sub-2 ms "click" the ear uses to localise
  an impact; there is no pitch sweep anywhere in the bank.
- **Board thump** - one or two fixed low modes at 120-200 Hz with 60-140 ms `t10`. Fixed (no glide)
  so it reads as a body resonance, never a slide whistle.
- **Finish** - one-pole DC blocker, 1 ms smoothstep fade-in whose first 20 samples are forced to
  zero, 15-38 ms fade-out whose last 20 samples are forced to zero, then peak-normalise to
  **-3.5 dBFS** (0.667 full scale). Normalising last means the file peak is exact and can never clip.

### 4.2 move (x3)

A wooden piece set down on a wooden board. Five plate modes at roughly **1.78, 2.38, 3.12, 4.18,
5.26 kHz** with `t10` **46, 38, 30, 24, 19 ms** (higher modes die first, as a real plate does),
amplitudes 0.95 -> 0.30, plus a low body thump at ~146 Hz (`t10` 95 ms) and ~196 Hz (`t10` 60 ms),
plus the contact transient. No oscillator tone, no sweep.

### 4.3 capture (x3)

The same instrument, struck harder and then a second event. Hit 1 is the collision: click level
1.30 (vs 0.9 for move), modes stretched to `t10` x1.25, body thump x1.1, and a short 26 ms "impact
dirt" noise burst that dies with the same knock. Hit 2, 84-94 ms later, is the captured piece
meeting the table: clearly softer (click 0.60, modes at 55% amplitude) but with a *shorter* decay so
it is a crisp second click rather than a wash. Finally a 72 ms low-level (0.11) bandpassed friction
noise starts at 105 ms - the piece sliding off the square, with no pitch motion. Mild `tanh(1.12x)`
saturation adds harmonic dirt without clipping.

### 4.4 castle

Two distinct wooden knocks 92 ms apart: the king (move-recipe modes, click 0.85) then the rook at
0.78x frequency with a lower thump (~117 Hz) and click 0.80. The verify hit counter confirms
exactly two envelope hits.

### 4.5 check

**Not a beep.** A struck-metal ring built from four *inharmonic* partial ratios
**1.00 / 1.34 / 1.85 / 2.10** on a ~1.18 kHz base, i.e. 1195 / 1605 / 2215 / 2510 Hz (the
`verify` peak-picker prints these), with `t10` 215 / 190 / 170 / 130 ms plus a 2.95x shimmer at
0.12 amplitude, a 1.4 ms highpassed strike transient, and a low swell (96 / 136 / 68 Hz) that blooms
in 4-5 ms and falls away under the ring (110 / 95 / 120 ms). The fast low swell is deliberate: an
earlier version let the swell ring as long as the metal, and the two long low partials beating
against the ring made the alert wobble (see section 6).

### 4.6 promote

Four-note rising arpeggio C5-E5-G5-C6 (**524 -> 658 -> 784 -> 1046 Hz** measured back from the
audio), 95 ms apart, 440 ms total. Mallet timbre: fundamental plus partials at 2.0x (0.32) and
3.01x (0.11), each with a shorter `t10` than the fundamental (0.55x and 0.35x), a half-amplitude
0.10 sub-octave for warmth, and a 2.2 ms soft attack. Ends clean on the fade-out.

### 4.7 game-end-win / game-end-loss

Same mallet, five-note cadences. Win rises **G4-C5-E5-G5-C6** (392 -> 522 -> 658 -> 784 ->
1048 Hz) - the major cadence. Loss falls **E5-D5-C5-B4-A4** (660 -> 588 -> 524 -> 490 -> 444 Hz) -
A natural minor descent ending on the tonic. Note spacing 72 ms; `t10` 120 ms (win) / 145 ms (loss)
with a 32-38 ms soft tail.

### 4.8 illegal

A dull double thud, no buzzer: 158 Hz (`t10` 72 ms) then 124 Hz (`t10` 70 ms) 75 ms later, each with
a quiet 1.5x partial and a 3 ms lowpassed (600 Hz) noise tap. Centroid 168 Hz - deliberately the
darkest sound in the bank. Verified as exactly two hits.

### 4.9 low-time-tick

A tiny dry woodblock, 30 ms total: three very short modes at 2380 / 3460 / 4520 Hz (`t10` 14 / 11 /
8 ms), a 520 Hz body mode and a 1.2 ms highpassed click. It is mostly gone by 15 ms, which is where
the fade-out begins, so the fade never truncates audible energy.

### 4.10 game-start

Two soft wooden "ready" knocks. First at move-like frequencies but with the click reduced to 0.45;
the second, 150 ms later, is 1.15x higher and slightly softer - a question-and-answer cue rather than
a fanfare.

### 4.11 Variation strategy

`move` and `capture` each have three takes. Each take uses its own seeded PRNG (`mulberry32`) to
jitter every modal frequency by +/-5%, every decay by +/-18-20% and every amplitude by about +/-20%,
and to randomise the detune direction and the oscillator phases. The three takes measure differently
(centroids 1957 / 1928 / 2127 Hz and 2370 / 2376 / 2497 Hz, with different decay times) while
sharing the same partial layout, so they are audibly different but obviously the same instrument.

## 5. Verification

`node gen-chess-sounds.js verify` parses each WAV back from disk (independent chunk walker, not the
renderer) and asserts:

1. RIFF / WAVE / `fmt ` / `data` structure, RIFF size = file size - 8.
2. `audioFormat = 1` (PCM), 1 channel, 44,100 Hz, 16-bit, byte rate 88,200, block align 2.
3. Data sample count equals `round(ms/1000 * 44100)` for the declared `ms` (whole ms).
4. Peak between -4 and -3 dBFS (all files land at exactly -3.50).
5. No sample above full scale.
6. First 20 and last 20 samples are exactly 0.
7. Declared `ms` inside 30-1200 ms.
8. Each file < 40 KiB and the bank < 700 KiB.
9. Manifest <-> disk bijection: every listed file exists, no duplicate entries, and no orphan
   `*.wav` exists in the bank folder.
10. Per-kind metric windows (section 5.2) including the sanity metrics the brief asked for.

### 5.1 The two requested sanity metrics

- **Spectral centroid** over the first 30 ms: Hann-windowed DFT (2048 points, radians-per-bin
  recurrence rather than per-sample `cos`/`sin`), `sum(f*|X|)/sum(|X|)`.
- **Decay to 10%**: a 3 ms sliding-RMS envelope, then the last time the envelope is at or above 10%
  of the envelope peak, expressed in ms from the start of the clip.
- **Onset ratio** (extra): the largest sample in the first 3 ms divided by the clip peak; it must be
  >= 0.15 for percussive kinds and >= 0.05 for melodic ones, which is a direct guard against a slow
  attack.
- **Envelope hits** (extra): local maxima above 35% of the envelope peak, at least 60 ms apart, with
  the valley between them below that threshold **and** the later peak at least 5 dB (1.8x) above the
  valley. This is what actually proves capture has a second click, castle/illegal/game-start have
  two knocks, and move/check/tick have one event.

### 5.2 Windows used, and why

| kind | centroid | t10 | hits | note |
| --- | --- | --- | --- | --- |
| move | 1000-6500 Hz | 20-130 ms | 1 | brief: wooden knock ~1-6 kHz, 20-120 ms |
| capture | 700-6500 Hz | 80-300 ms | 2 | two hits + tail |
| castle | 900-6500 Hz | 100-400 ms | 2 | two knocks + tail |
| check | 700-4500 Hz | 150-620 ms | 1 | brief: ring events ~200-600 ms |
| promote | 250-3200 Hz | 300-800 ms | info | melodic, low centroid is correct |
| game-end-win | 250-3200 Hz | 300-900 ms | info | 5 notes in 440 ms |
| game-end-loss | 250-3200 Hz | 300-900 ms | info | 5 notes in 450 ms |
| illegal | 80-1600 Hz | 80-300 ms | 2 | deliberately dark double thud |
| tick | 1400-7000 Hz | 5-45 ms | 1 | dry woodblock |
| game-start | 900-6500 Hz | 120-500 ms | 2 | two knocks |

## 6. Assertion history (what I changed and why - nothing was relaxed to hide a fault)

The bank was iterated until every check passed with the recipes unchanged in spirit. Five concrete
changes were made; each one is either a metric-definition fix or a genuine recipe improvement:

1. **Detuned mode pairs were equal-amplitude (0.5/0.5).** Two equal partials cancel completely at
   the beat minimum, giving a phasey tremolo and a very rippled envelope. Changed to 0.68/0.32:
   still clearly woody, no nulls. This *changed the audio* and required a re-render.
2. **`t10` was first measured from the envelope's loudest point.** For multi-hit cues that reports
   the gap as if it were silence and produced nonsense (castle 80 ms). Redefined as "last time the
   envelope is at 10% of peak, measured from clip start", which is the natural reading of "time to
   decay to 10%" and matches the brief's own ranges (move 20-120 ms, ring 200-600 ms). This is a
   metric-definition fix, not a relaxation; it is also what makes the melodic cues read as ~400 ms
   rather than ~180 ms.
3. **The first hit counter (25 ms separation, 20% threshold) was fooled** by the beating ripple
   inside a single knock. Final detector: 60 ms separation + valley below threshold + 5 dB
   prominence. The 60 ms value is physical - the real second events in this bank are 75-150 ms
   apart - and the prominence rule is what stops a long ring's ripple from counting as a new hit.
4. **check wobbled.** Probing the envelope at 1 ms resolution showed the ring sitting near the 35%
   line for ~90 ms: the low swell was ringing as long as the metal (t10 190-240 ms) and the beat
   between them made the envelope dip just under threshold at ~82 ms and step back up - a
   false second onset *and* an audible wobble. Fixed the recipe (swell t10 now 95-120 ms) so the low
   end blooms and falls away under a clean ring. This is a quality fix, not an assertion change.
5. **capture was mush.** The original had a loud 138 ms low thump and an early 45 ms rattle that
   kept the envelope hovering at the hit threshold, and the second click was buried. Reworked as
   described in 4.3 (short impact dirt on hit 1, crisper/cleaner hit 2, friction after it). Both the
   articulation and the measurement improved.

One additional honesty note: the per-kind centroid windows for `illegal` (80-1600 Hz) and the three
melodic cues (250-3200 Hz) are narrower/lower than the brief's generic "1-6 kHz wooden knock"
guidance. That is intentional and physical - a dull double thud *should* be dark, and a C5-G5 mallet
arpeggio *should* centre around 500-900 Hz. Every percussive knock in the bank does sit inside the
brief's 1-6 kHz window.

## 7. Why this should sound better than short oscillator blips

- **It is an object, not a tone.** A blip is one sine with an envelope. Here an impact is a
  broadband 1.7 ms transient plus five modes at *different* frequencies and *different* decay rates
  - high modes vanishing in ~19 ms while the low body rings ~95 ms. That spectral+temporal spread is
  what the ear reads as "something solid hit something wooden".
- **Slight inharmonicity and detuning.** Every mode is a mistuned pair, so the spectrum is not a
  neat harmonic series and it shimmers rather than beeps. The check sound goes further with metal
  ratios 1 / 1.34 / 1.85 / 2.10, the signature of a struck bar or bell.
- **A real contact transient.** The sub-2 ms filtered-noise click is what makes an impact feel
  immediate; oscillator blips lack it and sound soft and synthetic.
- **A second event where the game needs one.** Capture is a collision *and then* the captured piece
  landing *and then* a slide, not one longer blip. Castle is king-then-rook at two pitches. The
  verify hit counter proves these exist in the rendered audio.
- **Musically correct cues.** Win and loss are real major/minor cadences on a warm mallet
  (fundamental + 2x + 3x, each decaying faster than the fundamental), measured back from the files as
  G4-C5-E5-G5-C6 rising and E5-D5-C5-B4-A4 falling. The tick is a dry woodblock, and illegal is a
  dull double thud instead of the usual buzzer.
- **Clean signal hygiene.** DC-blocked, exactly zero at both edges, peak-normalised to -3.5 dBFS with
  no clip - so nothing will pop, thump or overload when the game layers it over music.

## 8. What I could not verify (stated plainly)

- **I have no audio device in this session, so I could not listen to a single file.** Subjective
  quality is the acceptance bar, and I cannot personally clear it. My confidence rests on the
  physical-modelling recipes (which follow well-established practice rather than experiments), the
  objective metrics above, and the visual proxy below - not on hearing.
- **Visual proxy.** Because I could not listen, I rendered a throwaway spectrogram montage (STFT,
  512-point FFT, 64-sample hop, 0-9 kHz, per-file normalised) to a temporary file
  (`%TEMP%\chess-spectro.png`) and inspected it. It shows: move a broadband burst with modal
  striations; capture/castle/illegal/game-start two separated bursts; check long horizontal ring
  lines; promote/win/loss clear note onsets; tick one short burst. That is a proxy, not a listening
  test, and the PNG is not a deliverable (it lives in the temp folder).
- **Loudness balance across events was not auditioned.** Files are peak-normalised per clip, not
  perceptually loudness-matched. Suggested starting trims if the mix feels off: `low-time-tick 0.7`,
  `illegal 0.8`, `check 0.9`, `promote 0.85`, `game-end-* 0.85`, everything else 1.0.
- **In-browser playback was not exercised by me.** The manifest uses ordinary relative URLs and the
  WAVs are plain PCM, but wiring the ids into `games/chess.html` and hearing them over https /
  `file://` is the parent's integration step.
- **The pre-existing mp3s in `games/audio/chess/` were left alone** and are not referenced by this
  manifest. If the parent wants the new bank to fully replace them, that is a separate cleanup.

## 9. Suggested integration

- Load `games/audio/chess/manifest.json` and map `id -> file`; the parent can cycle
  `move` / `move-2` / `move-3` and `capture` / `capture-2` / `capture-3` at random (or round-robin)
  so repeated moves are not identical.
- `check` is 260 ms and deliberately tense - it layers fine over the move sound if both fire.
- `game-start` is a neutral two-knock "ready", not a fanfare, so it will not clash with the meme bank.
- All ids: `move`, `move-2`, `move-3`, `capture`, `capture-2`, `capture-3`, `castle`, `check`,
  `promote`, `game-end-win`, `game-end-loss`, `illegal`, `low-time-tick`, `game-start`.
