CONTEXT - Windows PC. Node v24 at C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe. ffmpeg at C:\Users\caleb\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe (also ffprobe). You cannot see the parent conversation.

PROJECT: C:\Users\caleb\AppData\Local\arcade-hub - static arcade site; games/chess.html is a chess game whose meme sounds come from games/audio/memes/ (manifest.json + *.wav + *.mp3) and are played by games/chess-memes.js (do NOT edit that file; the parent owns it).

OWNER FEEDBACK (verbatim): 'make sure you do the memes properly too please'. Concretely, the meme sounds are the weak part: they are raw, un-trimmed and inconsistently loud, and several are cheap-sounding imitations.

WHAT EXISTS
- games/audio/memes/manifest.json - 7 packs / 54 sounds. Packs: boom, gamer, sad, victory, toon, tts (all 35 *.wav, synthesised by _loop/audio-gen/gen-memes.js) and 'forge' (19 *.mp3 that were generated elsewhere and dropped in - these are the highest-potential ones but have never been trimmed, levelled or vetted).
- The synth generator _loop/audio-gen/gen-memes.js has a verify subcommand.
- Useful precedent: _loop/audio-gen/trim-natural.js shows the trimming approach the parent used successfully for the chess move sounds (onset detection, slice, 4ms/45ms fades, peak-normalise to -3.5 dBFS).

YOUR TASK - make the meme bank actually good, then prove it.

1. AUDIT every clip in games/audio/memes/ and report, per file: duration, peak dBFS, RMS dBFS, the time from start to the first energy (onset), how long the meaningful sound lasts, and whether there is leading/trailing silence. Use your own Node WAV parser for the .wav files and ffmpeg/ffprobe for the .mp3 files (convert to WAV first so you can measure them the same way).
2. TRIM and NORMALISE the 'forge' pack (19 MP3s). These are 2-5 second model outputs with dead air; cut each to its meaningful part (usually 0.2-1.6 s, longer only if the sound genuinely needs it, e.g. a crowd or a sting), fade the edges (4 ms in, 30-60 ms out), and peak-normalise each to -3.5 dBFS. Write the results as 44.1 kHz mono 16-bit WAVs next to the originals (e.g. forge_<name>_trim.wav) so the parent can point the manifest at them, and keep the originals.
3. LEVEL the existing 35 synth WAVs into a consistent set: report their current peaks/RMS and apply a single safe gain per file (peak-normalise to -3.5 dBFS) WITHOUT changing their character. Overwrite them in place only if the change is a pure level change (no re-synthesis); write .bak copies first.
4. REWRITE the weakest synth clips: the owner is most likely to notice the voice/'tts' pack and the boom pack. For the voice pack, do NOT try to fake speech with formants - instead leave those files alone and say so in the report, because the game will use the browser's real speech synthesis for voice lines (the parent is wiring that). For everything else, if a clip measures badly (very short, very quiet, mostly silence, or a single sine beep), regenerate it with a better recipe in the same generator style (modal/noise-based, no bare sine beeps).
5. UPDATE games/audio/memes/manifest.json so every entry points at the best available file, keeps its existing id/when/label, and gets an accurate 'ms'. Keep the schema exactly as it is (version/packs[id,name,emoji,desc,on,sounds[id,label,file,ms,when]]).
6. VERIFY: re-parse every file the manifest references and assert they exist, decode as PCM WAV (except any mp3 you deliberately keep), are within 30 ms - 4 s, peak between -4 and -3 dBFS, and that no two entries point at the same file. Print the full table. Then run a second, independent pass (a separate small script) that re-measures the same files and prints the same columns, so the numbers are cross-checked rather than self-reported.

DELIVERABLES
1. The improved bank under games/audio/memes/ (audio files + manifest.json).
2. C:\Users\caleb\AppData\Local\arcade-hub\_loop\audio-gen\level-memes.js - the tool you wrote (re-runnable, with a verify subcommand).
3. C:\Users\caleb\AppData\Local\arcade-hub\_loop\research\meme-audio-v2-report.md - the report.

RULES
- Do NOT edit games/chess.html, games/chess-memes.js or games/chess-*.js.
- Never download audio from anywhere: trimming/levelling existing locally generated files is fine, new sounds must be synthesised by your own code. State this in the report.
- Every claim needs the command you ran and its real output. State explicitly what you could not verify (you have no audio device - say so).
- Report format: summary, the per-file audit table before and after, what you changed and why, the verification output, and what you could not verify.