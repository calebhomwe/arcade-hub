# Chess audio — measured rather than heard

Nobody has listened to this bank by ear. These are the objective numbers, measured by decoding every
cue in the browser (the same decode path the game uses) and analysing the samples.

Reproduce: run the expression saved with this report through _loop/tests/cdp-eval.js against
games/chess.html, or open the game and run the same analysis in the console.

## Measured (natural set, 14 cues, all mono)

| cue | ms | peak dBFS | RMS dBFS | lead silence |
|---|---|---|---|---|
| move | 194 | -3.5 | -18.2 | 2 ms |
| move-2 | 260 | -3.5 | -13.5 | 4 ms |
| capture | 320 | -3.5 | -15.1 | 2 ms |
| capture-2 | 244 | -3.5 | -16.7 | 1 ms |
| castle | 360 | -3.5 | -15.4 | 3 ms |
| check | 600 | -3.5 | -15.3 | 2 ms |
| promote | 1000 | -3.5 | -18.7 | 1 ms |
| illegal | 300 | -3.5 | -14.8 | 3 ms |
| game-end-win | 1244 | -3.5 | -17.5 | 2 ms |
| game-end-loss | 1400 | -3.5 | -18.3 | 3 ms |
| game-start | 240 | -3.4 | **-24.7** | 1 ms |
| low-time-tick | 30 | -3.5 | -17.2 | 1 ms |
| ui-click | 200 | -3.5 | **-11.7** | 3 ms |
| ui-hover | 160 | -3.5 | -14.7 | 2 ms |

## What this establishes

- **No clipping and no quiet cues.** Every peak lands between -3.4 and -3.5 dBFS, so the bank is
  consistently peak-normalised with 3.5 dB of headroom.
- **No dead air.** Leading silence is 1-4 ms and trailing silence 1-25 ms; nothing starts late or
  ends with a tail of silence.
- **No duplicates.** All fourteen ids differ in duration or in RMS; there is no accidental copy.
- **All mono**, which is what a phone speaker wants.

## The one finding

Loudness (RMS) spans **13 dB**, from ui-click at -11.7 to game-start at -24.7. Peaks agree, so this
is about density rather than level: ui-click and move-2 are dense and will read as noticeably louder
than game-start and promote, which are spikier.

That may well be deliberate - a click should be crisp, a game-start cue should be soft - and it is
**not changed here**, because judging it needs ears and the user has never reported the levels as
wrong. If it should be levelled, the honest way is a per-cue gain field in the manifest applied in
the bank (which currently supports only a playback rate), with the target spread chosen by ear
somewhere around 6 dB.

## Still not verified by any of this

Whether the cues sound *good*: whether a capture sounds like a capture, whether the wood thock is
convincing, whether ui-hover is pleasant at the rate a player triggers it. That is what the Sound
check button in Settings exists for.
