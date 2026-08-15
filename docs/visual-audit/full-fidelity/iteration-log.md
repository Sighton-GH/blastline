# BLASTLINE Batch 12 iteration log

## Baseline selection

- Starting branch: `main`
- Starting SHA: `0e2885f35a6737c71b65d4c888242bb8d912d0c6`
- Reason: branch/commit inspection showed this was the newest merged Section 1–4 visual-fidelity superset; stale agent branches were not resurrected.
- Working branch: `batch-12-full-fidelity`

## Reference inspection

The high-resolution File Library PNG names requested by the brief did not resolve as image files through the available File Library search. The repository fallback set `docs/art-reference/01..10` was therefore visually inspected. These files are compressed 120 px-wide previews and were used only for composition/style guidance, not as crop sources.

The most recent File Library Batch 11 export manifest also states that the generated Batch 1–10 production master sheets were not retrievable as images. No pixel crop rectangles or runtime sprite atlases were fabricated.

## Iteration 0 — genuine baseline

A GitHub Actions Chromium run captured the unmodified starting build at 390×844 and 1365×768. Evidence was committed under `docs/visual-audit/full-fidelity/baseline/`.

Largest observed gaps from genuine screenshots:

1. light/schematic road and bridge materials;
2. primitive procedural player/enemy/boss silhouettes;
3. generic web-like UI treatment and missing Victory state.

The road was already straight/planar; that behavior was explicitly preserved.

## Iteration 1 — implementation

Implemented:

- darker planar asphalt and stronger deck material separation;
- adjusted horizon/tower proportions while keeping road geometry flat;
- richer red bridge palette and cyan atmospheric palette;
- new procedural rear-facing blue soldier renderer with layered armor, helmet, backpack, weapon, contact shadow and compact muzzle flash;
- redesigned red grunt/elite renderer with clearer faction direction and elite silhouette differentiation;
- redesigned boss renderer with unique heavy proportions, shoulder/weapon mass, armor recesses and contact shadow;
- cyan-white player projectile treatment;
- more compact arcade HUD/card styling;
- stronger upgrade/end-state styling;
- actual final Victory state and final-boss progression logic;
- deterministic webdriver-only capture modes for home/lane/upgrade/victory/game-over evidence.

Validation run `31730769507` completed successfully. Required tests, Chromium evidence capture, controls validation, progression validation, performance gate and artifact upload all completed successfully.

Fresh genuine screenshots were committed under `docs/visual-audit/full-fidelity/final/`.

## Iteration 1 comparison judgment

Kept:

- dark planar deck: materially closer and road remains flat;
- player/enemy renderers: clearer dimensional silhouettes and correct facing;
- elite: now visibly different from grunt;
- boss: unique heavy silhouette instead of enlarged grunt;
- Victory state: fills a real missing end-state and visually matches the gold/blue target direction;
- compact HUD: closer to mobile-arcade hierarchy.

Still not accepted:

1. gate portals remain too small/sign-like compared with reference gates;
2. player/enemy art remains procedural and therefore below production sprite-sheet quality;
3. camera/home/HUD/upgrade treatment is only moderately close, not a 4–5/5 match;
4. lighting/VFX lack the richness of the generated render targets.

## Iteration 2 target

A targeted gate/boss-HUD correction transform was prepared (`tools/batch12-pass2.mjs`) to increase gate portal height/visual width and separate the boss health bar from the boss silhouette. It is **not counted as implemented evidence** in this scorecard because the connector would not permit the follow-up runner edit needed to execute and recapture it in this session. It must not be described as present in the running build until a fresh real-browser run proves it.

## Final decision for this session

Do not merge or declare final visual acceptance yet. The current branch is a substantial real-game improvement with validated behavior, but the source production art required for true Batch 12 asset integration remains unavailable, and several critical fidelity scores remain below 4/5.
