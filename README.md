# BLASTLINE

BLASTLINE is an instant-play, endless bridge shooter. Steer a growing blue squad across three lanes, auto-fire through dense red formations, choose gate tradeoffs, defeat a boss every third wave, and specialize a build until the line finally breaks.

Every deployment is a fresh run. Reloading or retrying resets score, skill points, reserves, purchases, and upgrades. Personal best score, best wave, best combo, and run count stay on the player's device so there is always a record to chase.

## Play

- Choose Recruit, Veteran, or Elite. Veteran is the default.
- Drag, touch, use A/D, or use Left/Right to steer freely.
- Shooting and forward travel are automatic.
- Use the top-right control, Space, or P to pause and open the run dashboard.
- Spend skill points in the armory offered after each cleared wave. Boss victories also grant one free three-card reward before the shop. Pausing shows the current build and records, not the shop.
- Up to two reserve lives can restore a protected, difficulty-scaled squad after defeat.

There is no final wave or Victory state. Each boss reward advances directly into the next, harder wave.

## Architecture

- Static HTML, CSS, Canvas 2D, and JavaScript modules; no backend or install flow.
- Static environment prerendered to an offscreen canvas and composited into the combat canvas every frame, with context-loss, visibility, and bfcache recovery so the background can never stick black.
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

Fresh browser screenshots, comparison boards, runtime metadata, and the machine-readable report are written to `docs/visual-audit/production-redesign-2026-09-19/`. See `docs/VALIDATION.md` for thresholds and failure interpretation.

## Deployment

Pushing to `main` on GitHub triggers the Cloudflare Pages auto-deploy (about a minute to live at https://blastline.sighton.ca). ES module assets can sit in cache for a few minutes after deploy; verify with a fresh page load or cache-buster and a source grep before judging the live build. `npm run deploy` (wrangler) exists for a manual deploy but is not the normal path.
