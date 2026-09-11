CONTEXT - Windows PC. Blender 5.2.0 LTS at C:\Program Files\Blender Foundation\Blender 5.2\blender.exe (headless: blender.exe -b -P script.py). Node v24 at C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe. You cannot see the parent conversation.

PROJECT: C:\Users\caleb\AppData\Local\arcade-hub - static arcade site; games/chess.html draws a chessboard on a canvas and renders pieces from the PNGs you are about to improve.

EXISTING WORK (yours to improve, not to throw away):
- C:\Users\caleb\AppData\Local\arcade-hub\_loop\blender\build-pieces.py builds six lathed Staunton profiles with EEVEE, renders w_pawn.png ... b_king.png (512x512 RGBA) into games/assets/pieces/, plus pnglib.mjs (a stdlib PNG reader used for checks) and pieces.json.
- A previous agent produced these renders. The owner's verdict, verbatim: 'the new pawns look rough'. The whole set is being judged against chess.com's Neo/Classic piece set.

WHAT IS WRONG (the parent looked at the renders and the in-game board):
1. The pawn reads as a squat blob: the head is too large relative to the base, the collar is too subtle, and the stem has almost no taper, so it does not read as a pawn at a glance.
2. The renders are GRAINY - there is visible noise/speckle in the shading. Whatever sampling setting is in use is too low; the pieces must be clean at 512 px and when downscaled to about 45 px on a board.
3. Edges are soft/rounded where they should be crisp (base steps, collars, crown points), and the contact shadow is a hard grey blob rather than a soft ellipse.
4. Relative heights are inconsistent between pieces; the set looks assembled rather than designed as one family.

YOUR TASK - re-render the full set to a quality someone would call 'chess.com standard', with the pawn fixed first.

DELIVERABLES (same paths, overwritten)
1. C:\Users\caleb\AppData\Local\arcade-hub\_loop\blender\build-pieces.py - the improved, re-runnable, deterministic build.
2. C:\Users\caleb\AppData\Local\arcade-hub\games\assets\pieces\ with w_pawn.png, w_rook.png, w_knight.png, w_bishop.png, w_queen.png, w_king.png and the same six as b_*.png.
3. C:\Users\caleb\AppData\Local\arcade-hub\games\assets\pieces\_contact.png - one contact sheet with all 12 pieces on a labelled grid, at a size where a human can judge them.
4. C:\Users\caleb\AppData\Local\arcade-hub\_loop\blender\pieces.json - { 'cell': 512, 'pieces':[ {'id':'w_pawn','file':'w_pawn.png','bbox':[x,y,w,h]} ] } for all 12.
5. C:\Users\caleb\AppData\Local\arcade-hub\_loop\research\blender-pieces-v2-report.md - the report.

QUALITY BAR (this is the acceptance test, not a suggestion)
- 512x512 RGBA, transparent, nothing cropped, ONE camera and ONE scale for the whole set, all pieces sharing a baseline within a few pixels.
- The pawn must have: a spherical head whose diameter is about 45-50% of the base diameter, a clearly modelled collar/neck ring under the head, a stem that tapers from the collar to a flared base, and a base with at least two visible steps. Look at a real Staunton pawn and match the silhouette proportions.
- Silhouettes must be smooth: enough spin/subdivision steps that no facets are visible at 512 px, and use smooth shading with a small bevel on hard edges so they catch a highlight instead of aliasing.
- Clean shading: raise the samples until there is no visible grain (EEVEE with high temporal samples, or Cycles with enough samples and denoising). Inspect at 100% zoom and at board size (about 45 px) before you accept it.
- Lighting: neutral key + soft fill + gentle rim, no coloured tints, plus a SOFT elliptical contact shadow (not a hard grey shape). White pieces around 0.93 sRGB with low roughness; black pieces around 0.10 sRGB with a soft sheen so the silhouette still reads on a dark square.

VERIFY WITH RECEIPTS (and be honest)
- Run the build headlessly; print each file's size.
- Re-parse all 12 PNGs in Node (stdlib only): PNG signature, IHDR 512x512, colour type 6, alpha coverage between 4% and 70%, nothing touching the border, 12 distinct files.
- Print each piece's opaque bbox; assert the shared baseline is within 6 px and heights order pawn < bishop < knight < rook < queen < king.
- Add a grain check: sample a flat-lit region of the piece body and report the standard deviation of neighbouring pixels; it should be small (state your threshold) - this catches the noisy renders the owner complained about.
- LOOK AT YOUR OWN OUTPUT: read _contact.png back with your image tool and describe exactly what you see, including anything that still looks rough. Iterate until the pawn in particular looks right, then say so plainly in the report.

Report: what changed per piece, the render settings, the verification output, your honest read of the contact sheet, and what you could not verify.