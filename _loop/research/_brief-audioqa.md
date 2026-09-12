CONTEXT - Windows PC. Node v24 at C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe. ffmpeg/ffprobe at C:\Users\caleb\AppData\Local\Microsoft\WinGet\Links\. You cannot see the parent conversation.

PROJECT: C:\Users\caleb\AppData\Local\arcade-hub - static arcade site; games/chess.html is a chess game.
AUDIO INVENTORY:
- games/audio/chess/ - 14 short chess cues (move x2, capture x2, castle, check, promote, game-end-win, game-end-loss, illegal, low-time-tick, game-start, plus mp3 originals that are unreferenced). manifest.json + manifest-natural.json describe two selectable sets; the game loads manifest-natural.json by default.
- games/audio/memes/ - 54 meme clips in 7 packs (manifest.json + catalog.js, which is what the game actually loads). A previous worker trimmed and levelled these.

YOUR TASK - an independent quality audit of BOTH banks, and fix what is genuinely wrong.

1. Measure every referenced clip: duration, peak dBFS, RMS dBFS, time to first energy (onset), the length of the meaningful sound, leading and trailing silence. Use your own Node WAV parser; decode any mp3 with ffmpeg first.
2. Flag anything a player would notice as wrong: clips longer than they should be for the event (a chess move should be a short click, not a second of rumble), several seconds of silence at the head or tail, peaks below -8 dBFS (too quiet) or at 0 dBFS (clipping), a clip whose onset is later than 150 ms (feels laggy), or two clips in the same pack that are near-duplicates.
3. Fix the flagged items by trimming/levelling only (no re-synthesis unless a file is broken); keep the manifest schema and keep every id/when/label stable so the game keeps working. Write backups of anything you overwrite.
4. For the chess cues specifically: the game plays move/capture on almost every turn, so those two must be SHORT (well under 400 ms), dry, consistent in level, and clearly different from each other. Report their measured numbers before and after.
5. VERIFY: re-parse everything the manifests reference and assert existence, WAV PCM 16-bit, peak in -4..-3 dBFS, durations inside the range you set per event type, no duplicate file targets, and that catalog.js (the inline copy the game loads) still matches manifest.json exactly. Run a second independent parser to cross-check the numbers.

DELIVERABLES
1. The improved audio files and manifests under games/audio/.
2. C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\audit-audio.js (re-runnable, with a verify subcommand).
3. C:\Users\caleb\AppData\Local\arcade-hub\_loop\research\audio-qa-report.md - the report with the before/after tables.

RULES: do NOT edit games/chess.html, games/chess-memes.js or games/chess-*.js. Never download audio. State every command you ran and its real output, and be explicit that you have no audio device so quality judgements are measurements, not listening.