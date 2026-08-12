# BLASTLINE validation

## Automated logic
- `npm test` passes.
- `node --check src/game.js` passes.
- `node --check src/core.mjs` passes.

## Chromium interaction validation
- 390x844 at DPR 2: canvas backing size 780x1688.
- 768x1024 tablet layout renders.
- 1365x768 desktop layout renders.
- Keyboard steering test: player X moved from 0.000 to 0.776.
- Pointer/touch-style steering moved player to the right lane.
- Accelerated boss test reached the upgrade screen with 3 upgrade choices.
- Selecting an upgrade advanced to Wave 2 and resumed play.
- Accelerated defeat test reached the game-over state.

## Visual pass
- Replaced primitive circle/rectangle soldiers with original generated 3D-styled character art.
- Added bright ocean, perspective bridge deck, suspension rails/cables, glossy number gates, tracer bullets, and a compact mobile HUD.
- Tuned mobile HUD and gate label sizing after screenshot review.
