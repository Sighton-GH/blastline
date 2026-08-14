# BLASTLINE — Full Production Asset Integration + Visual Convergence

You are continuing development of the BLASTLINE browser game in:

`Sighton-GH/webgame`

Work from the repository state that contains the BLASTLINE production-asset handoff. The handoff branch is:

`agent/blastline-production-assets`

There is an open draft PR for this handoff. Before changing code, inspect current branch ancestry, open PRs, and the newest complete visual-fidelity lineage. Do not blindly discard newer accepted work or blindly merge every historical `agent/*` branch.

## Source-of-truth visual references

Use the real reference image folder already in the repository:

`docs/blastline-codex-package/references/`

It contains:

1. `01-gameplay-lane-choice.webp`
2. `02-elite-wave.webp`
3. `03-boss-battle.webp`
4. `04-between-waves-upgrades.webp`
5. `05-victory-screen.webp`
6. `06-game-over.webp`
7. `07-endgame-chaos.webp`
8. `08-character-environment-style-guide.webp`
9. `09-static-web-game-concept-sheet.webp`
10. `10-before-after-visual-target.webp`

Actually inspect these image pixels. Do not treat filenames or descriptions as a substitute for looking at them.

The original high-resolution PNG references may also be available in the surrounding ChatGPT/Codex session. Prefer them when actually accessible, but the repository WebPs above are the guaranteed baseline.

## Approved production asset masters

The user has approved the current Batch 1–10 production art. The source-master mapping is documented in:

`docs/blastline-production-assets/APPROVED_SOURCE_MASTERS.md`

If the exact generated masters are present in your working environment/session, preserve them untouched under:

`assets/source/blastline/`

Do not regenerate approved masters merely because they are not yet organized. If a master is truly unavailable to your coding runtime, do not fabricate a substitute and claim it is the approved asset. Continue all independent work, use the repository references and existing game assets, and clearly identify that missing binary as a concrete blocker for that individual asset family.

Do not render full master atlas sheets directly in production. Crop/repack/resize/encode the useful pieces into the runtime tree documented at:

`docs/blastline-production-assets/ASSET_PATHS.md`

Runtime root:

`assets/blastline/`

## Asset-size discipline

Follow `docs/blastline-production-assets/FILE_SIZE_RULES.md`.

Preferred runtime budgets:

- ordinary individual image: under 500 KB;
- sprite/VFX/UI atlas: under 1.5 MB;
- major environment layer: under 2 MB;
- exceptional complex image: under 4 MB;
- no routine production asset should approach 10 MB.

Prefer cropped WebP. Split large source sheets into logical atlases. Do not sacrifice obvious visible quality before first tightening crops, removing duplicates, resizing to real maximum display size, and separating unrelated asset families.

## Absolutely no baked dynamic text

Dynamic game content must remain runtime-rendered.

Do not bake changing values/words into reusable production art, including:

- gate multipliers/operators;
- scores;
- troop counts;
- wave numbers;
- HUD values;
- upgrade titles/descriptions/stat values;
- victory/game-over scores;
- retry/continue/home labels;
- any other changing gameplay value.

Use HTML/CSS/Canvas for those values over the structural art.

## Bridge roadway — non-negotiable

The BLASTLINE bridge roadway must be:

FLAT
STRAIGHT
RIGID
PLANAR

Perspective convergence is correct. Vertical curvature is not.

The road must never:

- sag;
- hump;
- bow;
- arc vertically;
- undulate;
- twist;
- resemble a hill or roller coaster;
- follow the suspension-cable curve.

Only the suspension cables curve.

Prefer constructing the gameplay and home-screen roadway mathematically in Canvas, using a flat asphalt material and mathematically projected lane boundaries/markings. Do not use a baked road background to fake the geometry.

## Core evidence rule

Every claim about what the CURRENT game looks like must come from a genuine browser screenshot captured from the actual running repository code.

Never:

- generate a fake current screenshot;
- redraw the current website;
- use a reference render as an AFTER screenshot;
- Photoshop or AI-edit the real screenshot to make it look closer;
- use a planning infographic as evidence;
- self-certify visual success from code inspection alone.

References are TARGETS.
Real browser screenshots are EVIDENCE.

## Establish the baseline

Before major edits:

1. identify exact starting branch/SHA;
2. install dependencies if required;
3. run the game locally;
4. capture fresh real screenshots at:
   - mobile: 390×844, DPR 1;
   - desktop: 1365×768, DPR 1;
5. capture or deterministically force these real states where available:
   - home;
   - lane choice;
   - standard combat;
   - dense/elite wave;
   - multiplier gate;
   - boss;
   - upgrade screen;
   - victory;
   - game over;
   - late/endgame chaos.

Store new evidence under:

`docs/visual-audit/full-fidelity/`

Test hooks may force game state, but the pixels must still be produced by the real game renderer.

## Integration order

Work macro-first in this order:

1. camera/horizon/vanishing point;
2. flat road/deck projection;
3. bridge environment, towers, rails, cables, deck thickness;
4. ocean/sky/atmospheric depth;
5. blue player squad;
6. standard enemies;
7. elites;
8. boss;
9. red/blue gates;
10. combat VFX;
11. gameplay HUD;
12. upgrade UI;
13. victory;
14. game over;
15. home screen;
16. logo/branding;
17. final lighting/shadows/color/VFX polish.

Do not spend time polishing tiny particles while the camera, bridge geometry, scale relationships, or character direction are visibly wrong.

You are authorized to substantially reconstruct the renderer when the current implementation prevents a close match.

## Mandatory continual-improvement loop

For every major subsystem, repeat this loop:

1. run the real game;
2. capture a real screenshot at the target viewport/state;
3. place it next to the relevant reference without altering either image;
4. identify the 1–3 most visually damaging remaining differences;
5. record those differences;
6. make a targeted correction;
7. rerun the game;
8. capture the same state/viewport again;
9. compare again;
10. explicitly decide whether the change improved or regressed fidelity;
11. keep, revise, or revert based on the visual evidence;
12. repeat.

Do not stop after one implementation pass.

A large amount of code is not evidence of success. The resulting screenshot is what matters.

Maintain:

`docs/visual-audit/full-fidelity/iteration-log.md`

For each iteration record:

- state/reference;
- observed mismatch;
- change made;
- improved/regressed/neutral;
- remaining mismatch;
- next correction.

## Fidelity scorecard

Maintain:

`docs/visual-audit/full-fidelity/fidelity-scorecard.md`

Score each 0–5:

0 = fundamentally wrong
1 = major mismatch
2 = recognizably related but clearly poor
3 = moderately close with obvious differences
4 = close, refinement-level differences
5 = excellent practical match

Score at least:

- camera;
- horizon;
- vanishing point;
- road width;
- road flatness;
- bridge silhouette;
- tower proportions;
- structural thickness;
- cables;
- rails;
- ocean;
- sky;
- depth/haze;
- player design;
- player direction;
- player scale;
- squad footprint/density;
- enemy design/direction/scale;
- elite differentiation;
- boss silhouette/dominance;
- gate scale/construction/translucency;
- HUD hierarchy;
- typography;
- upgrade UI;
- victory UI;
- game-over UI;
- home screen;
- branding;
- lighting;
- shadows;
- muzzle flashes;
- projectiles;
- impacts;
- explosions;
- mobile composition;
- desktop composition;
- overall polish.

No critical category should remain below 4/5 at final acceptance.

Do not invent a fake global similarity percentage.

## Reference-specific targets

### 01 gameplay/lane choice
Prioritize the low forward-looking camera, strong red suspension bridge framing, correct road proportions, blue rear-facing squad, red enemies ahead, large simple translucent gates, compact HUD, ocean/horizon, readable lighting and depth.

### 02 elite wave
Match increased enemy density, materially larger/different elite silhouettes, formation readability and danger without visual collapse.

### 03 boss
The boss must dominate the encounter, have a unique silhouette rather than being a scaled grunt, and support a prominent boss-health presentation and stronger combat spectacle.

### 04 upgrades
Match the three-card modal hierarchy and spacing. Use approved empty structural card art with runtime text/icons/values layered correctly.

### 05 victory
Match stars/rewards/celebration and strong end-state hierarchy without baking dynamic runtime values into reusable art.

### 06 game over
Match the darker failure mood, stats/reward hierarchy and retry/home interaction structure, while keeping dynamic wording/runtime values code-rendered.

### 07 endgame
Increase density and spectacle without destroying depth ordering or readability.

### 08 style guide
Use it as the primary guide for character proportions, faction colors, bridge materials, gate simplicity, enemy tiers and overall soft 3D/mobile rendering.

### 09 static-web concept
Stay compatible with static hosting: HTML/CSS/Canvas, local compressed assets, no unnecessary backend.

### 10 polish benchmark
Use this as a broad quality/polish check, not as permission to fabricate a new current-state screenshot.

## Known failure modes to actively reject

- home road is curved;
- gameplay road sags or humps;
- bridge no longer reads immediately as a suspension bridge;
- horizon/camera is wrong;
- blue gameplay soldiers face the camera;
- red enemies face away from the player;
- white sticker outlines around characters;
- characters float because shadows/baselines are wrong;
- gates become tiny or flat HTML cards;
- gates become generic cyberpunk portals instead of simple BLASTLINE lane gates;
- elite is merely a scaled grunt;
- boss is merely a scaled grunt;
- generic debug/web HUD;
- generic HTML upgrade cards;
- dynamic words/numbers baked into reusable UI art;
- weak muzzle flashes/impacts/explosions;
- inconsistent lighting between assets;
- giant runtime source sheets;
- blurry sprite scaling;
- broken mobile composition.

## Functional validation

After meaningful changes, run the actual available project checks. At minimum where applicable:

`npm test`

`node --check src/game.js`

`node --check src/core.mjs`

Then verify in a real browser:

- load/start;
- keyboard control;
- pointer/touch steering;
- shooting;
- projectile origins;
- standard enemies;
- elites;
- gates and gate effects;
- damage/contact/death;
- boss;
- wave progression;
- upgrades;
- victory;
- game over;
- retry/restart;
- pause;
- resize/responsive behavior;
- asset loading;
- no console exceptions or missing asset requests.

Never claim a test ran when it did not.

## Performance

Keep the project Cloudflare/static friendly.

Watch for:

- giant textures;
- excessive texture swaps;
- giant transparent atlases;
- uncontrolled particle counts;
- expensive full-screen filters;
- unnecessary per-frame allocation;
- DOM explosion.

Optimize after measuring, but do not use performance as an excuse for obvious macro visual mismatch when a practical lightweight solution exists.

## Git workflow

Preserve repository history deliberately.

Before merging anything:

1. verify exact source branch and SHA;
2. verify ancestry;
3. verify tests;
4. verify final real screenshots;
5. verify the intended runtime assets are actually committed;
6. only then integrate into `main`;
7. delete obsolete branches only after confirming they contain no unique required work.

Do not blindly merge all historical branches.

## Final acceptance

At the end, put each untouched reference beside a fresh untouched real browser screenshot at normal viewing size.

Ask:

“Does this still immediately look like a noticeably different game?”

If yes, continue working unless a specific technical blocker has been documented.

Do not stop just because the game builds or because it is merely closer than before.

## Final report

Provide:

- exact final branch;
- exact final commit SHA;
- runtime asset manifest and measured file sizes;
- final genuine mobile screenshot;
- final genuine desktop screenshot;
- home comparison;
- lane-choice comparison;
- elite comparison;
- boss comparison;
- gate comparison;
- upgrade comparison;
- victory comparison;
- game-over comparison;
- final fidelity scorecard;
- iteration log;
- automated test results;
- browser validation results;
- performance notes;
- remaining visual differences/blockers.

Core rule:

REFERENCE → REAL RUNNING-GAME SCREENSHOT → MEASURED GAP ANALYSIS → IMPLEMENT → REAL SCREENSHOT → DIRECT COMPARISON → REPEAT UNTIL OBVIOUS MISMATCHES ARE GONE.
