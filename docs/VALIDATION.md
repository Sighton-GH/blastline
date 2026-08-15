# BLASTLINE validation

No BLASTLINE change is complete without fresh evidence from the current working tree. Generated concepts and supplied references are visual direction only; they must never be labeled as current-game screenshots.

The accepted 2026-08-15 full run passed all checks: 60-second 4× stress p95 normalized to 33.3 ms, 0.084% frames above 50 ms, and 1.52% heap growth over the five-minute soak. See `validation-full.json` in the evidence directory.

## Commands

Run deterministic logic, balance, and syntax checks:

```bash
npm test
node --check src/game.js
node --check src/core.mjs
node --check tools/final-browser-validation.mjs
```

Run the normal development browser matrix:

```bash
npm run validate
```

Run only the browser performance subset while tuning:

```bash
npm run validate:perf
```

Run the acceptance-duration matrix before release:

```bash
npm run validate:full
```

`validate:full` measures the throttled stress scene for 60 seconds and the unthrottled soak for five minutes. The shorter default uses the same hard limits with 8-second stress and 15-second soak windows.

## Browser coverage

The matrix uses real headless Chromium at:

- 390 × 844, DPR 1;
- 1365 × 768, DPR 1;
- a touch-enabled 390 × 844 mobile context.

It follows natural input paths for difficulty selection, keyboard steering, pointer steering, touch steering, pause/resume, shop purchases, and reward selection. Deterministic QA controls are used only to make expensive late-run states reproducible.

The interaction checks cover:

- all three difficulty modes;
- continuous steering across all canonical lanes;
- lane-locked gate tradeoffs, safe lanes, enemy formations, and telegraphed fire;
- pause freezing simulation;
- successful and insufficient-point shop transactions;
- three unique boss rewards and endless boss-to-next-wave transitions;
- reserve-life protection and difficulty-scaled recovery;
- Game Over, clean retry, and a fresh page reload;
- 20 consecutive boss cycles without a Victory loop;
- no BLASTLINE `localStorage` keys or source-master runtime requests.

## Hard performance gates

The report retains raw `requestAnimationFrame` timestamps and also records refresh-normalized p95 values to remove 60 Hz/30 Hz timestamp quantization. Normalization never turns a missed refresh into a passing sample.

- Normal mobile and desktop: p95 ≤ 16.7 ms.
- Dense scene under 4× CPU throttling: p95 ≤ 33.3 ms.
- Frames strictly above 50 ms: less than 1%.
- Heap growth: no more than 15% over the soak window.
- Stress contents: at least 60 visible squad sprites, 180 active enemy sprites, a phase-three boss, hostile telegraphs, and practical maximum projectile pressure.
- Bounded runtime counts: no more than 220 enemies, 720 player projectiles, 150 hostile projectiles, or 100 stress particles.

A threshold miss is a process failure: do not edit the limit, round away a missed refresh, or cite a synchronous draw microbenchmark as a substitute. Inspect the relevant raw metric and optimize or identify an invalid fixture.

## Screenshot gates

Every full run captures genuine browser output for home, early horde, lane tradeoff, large horde, pause shop, boss reward, revive, boss phase one, boss phase three, late-wave chaos, and Game Over in portrait and landscape.

Automated screenshot checks fail on:

- HUD overlap or unsafe viewport placement;
- a non-planar projected deck;
- insufficient road width;
- tower intrusion into the combat corridor;
- abrupt ocean-band discontinuities;
- incorrect portrait/landscape camera routing;
- insufficient dense-scene squad or enemy counts.

Manual review scores camera, bridge silhouette, deck depth, water continuity, lighting, characters, horde scale, UI hierarchy, readability, and reference fidelity from 0–5. Acceptance requires every critical category to be at least 4 and the overall average to be at least 4.2, with no unresolved bridge, water, density, or performance defect.

## Artifacts and interpretation

The validator writes to `docs/visual-audit/endless-overhaul-2026-08-15/`:

- `validation.json`: viewports, seed, wave, difficulty, phase, entity counts, raw/normalized timing, checks, and failures;
- `validation-full.json`: the preserved 60-second stress and five-minute soak report from `validate:full`;
- `runtime-asset-manifest.md`: every path requested by the browser;
- `portrait-*.png` and `landscape-*.png`: current-game evidence;
- `comparison-*.png`: supplied visual direction beside a labeled current-game capture;
- `diff-*.png`: prior browser baseline versus current browser capture;
- `manual-scorecard.md`: the human visual review and unresolved-defect decision.

Interpret failures by name in `validation.json`. Interaction failures usually include the relevant state snapshot; visual failures include layout/projection measurements; performance failures include sample count, p50, p95, maximum, >50 ms fraction, heap, entity samples, and pool counts. A nonzero process exit means the evidence set is not accepted.
