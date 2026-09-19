# BLASTLINE

BLASTLINE is an instant-play, endless bridge shooter. Steer a growing blue squad across three lanes, auto-fire through dense red formations, choose gate tradeoffs, defeat a boss after every wave, and specialize a build until the line finally breaks.

Every deployment is a fresh run. Reloading or retrying resets score, skill points, reserves, purchases, and upgrades. Personal best score, best wave, best combo, and run count stay on the player's device so there is always a record to chase.

## Play

- Choose Recruit, Veteran, or Elite. Veteran is the default.
- Drag, touch, use A/D, or use Left/Right to steer freely.
- Shooting and forward travel are automatic.
- Use the top-right control, Space, or P to pause and open the run dashboard.
- Spend skill points in the pause shop. Boss victories also pause the run for one free three-card reward.
- Up to two reserve lives can restore a protected, difficulty-scaled squad after defeat.

There is no final wave or Victory state. Each boss reward advances directly into the next, harder wave.

## Architecture

- Static HTML, CSS, Canvas 2D, and JavaScript modules; no backend or install flow.
- Separate cached environment and transparent combat canvases.
- Fixed-step simulation with clamped catch-up and render interpolation.
- Pooled combat entities, 32 lane-specific collision buckets, sprite LOD, and an adaptive dense-scene render scale.
- Runtime WebP assets under `assets/blastline/`; source masters are never requested by the game.

## Verify

```bash
npm test
node --check src/game.js
node --check src/core.mjs
npm run validate
```

The complete acceptance-duration stress and soak run is:

```bash
npm run validate:full
```

Fresh browser screenshots, comparison boards, runtime metadata, and the machine-readable report are written to `docs/visual-audit/endless-overhaul-2026-08-15/`. See `docs/VALIDATION.md` for thresholds and failure interpretation.
