# Chess refinement plan (round 4)

Objective (active goal): compare against real chess.com, make ours better, and fix what the owner
called out - rough pawns, a hover sound that fires constantly, and missing refinement.

## A. Owner callouts
- [x] A1. Remove the hover sound (it fired while moving the mouse across the app).
- [x] A2. Stop the whole app dimming while the puzzle bottom-sheet is open (the scrim treated a sheet
      as a modal).
- [ ] A3. Re-render the Blender pieces so the pawns read as real Staunton pawns at board size, with
      clean (grain-free) shading - delegated, in flight.
- [ ] A4. Read the new contact sheet back and confirm the pawn no longer looks rough.

## B. Comparison-driven refinement (audit in flight)
- [ ] B1. Board: square colours, coordinate treatment, last-move/selection/check highlight colours.
- [ ] B2. Pieces: size relative to the square, shadow weight, contrast of black on dark squares.
- [ ] B3. Sidebar: information hierarchy (a chess app should lead with New Game and a few icon
      actions, not a wall of equal-weight buttons).
- [ ] B4. Player cards and clock: exactly what chess.com shows and in what order.
- [ ] B5. Move list: column widths, current-move emphasis, scroll behaviour.
- [ ] B6. Result dialog and start screen polish.
- [ ] B7. Remove any remaining arcade noise that breaks the illusion.

## C. Verification (every change)
- [ ] C1. window.__chessTest() stays green (currently 97 checks) plus any new cases.
- [ ] C2. Zero Uncaught / ERROR:CONSOLE.
- [ ] C3. Screenshots at 390x844 and 1280x900 read back and inspected.
- [ ] C4. Committed, pushed, and the live Pages build re-driven over CDP.

## Fixed already this round
- Hover sound removed.
- The puzzle sheet no longer triggers the modal scrim/dim.
