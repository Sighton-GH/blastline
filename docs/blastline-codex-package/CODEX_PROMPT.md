# BLASTLINE — Implement the Authoritative Game Spec + Best-Practical Visual Match

You are continuing development of the BLASTLINE browser game in:

`Sighton-GH/webgame`

Use maximum reasoning.

Work from the repository state that contains the BLASTLINE handoff branch:

`agent/blastline-production-assets`

Before changing code, inspect branch ancestry, open/merged PRs, and the newest complete visual implementation. Do not blindly discard newer accepted work and do not blindly merge every old `agent/*` branch.

---

## 1. Read the authoritative gameplay specification FIRST

The source of truth for how BLASTLINE is supposed to behave is:

`docs/BLASTLINE_GAME_SPECIFICATION.md`

Read it completely before implementing anything substantial.

It defines:

- complete run flow;
- state machine;
- controls;
- camera/world behavior;
- squad logic;
- auto-fire;
- enemies and elites;
- bosses;
- gates;
- waves;
- upgrades;
- scoring/currency;
- victory;
- game over;
- persistence;
- HUD behavior;
- VFX/audio expectations;
- balance baselines;
- edge cases;
- acceptance criteria;
- Definition of Done.

### Authority rule

When implementation, old tests, README text, prototypes, or historical behavior disagree with `docs/BLASTLINE_GAME_SPECIFICATION.md`, **the game specification wins** unless there is an explicit newer user instruction.

Update code and tests toward the specification rather than preserving accidental old behavior.

In particular:

- BLASTLINE has six authored waves;
- every wave ends in a boss;
- bosses on Waves 1–5 lead to an upgrade choice;
- the Wave 6 boss leads to **VICTORY**;
- do not loop directly from final boss back to Wave 1;
- squad reaching zero leads to **GAME OVER**;
- Retry must create a clean run.

---

## 2. Visual references are aspirational, not an impossible pixel-perfect requirement

Inspect the real reference images under:

`docs/blastline-codex-package/references/`

They are:

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

Actually inspect the pixels.

Use them to guide:

- camera/composition;
- suspension-bridge identity;
- road proportions;
- blue/red faction language;
- character orientation;
- squad/enemy/boss scale relationships;
- gate simplicity and readability;
- HUD hierarchy;
- upgrade/end-state presentation;
- lighting/shadows;
- combat density and VFX;
- overall polish.

However, this is a static HTML/CSS/Canvas browser game. It may not be possible or sensible to exactly reproduce a promo/native-mobile 3D render.

The goal is **the closest practical lightweight browser interpretation**, not literal pixel parity.

Do not waste large amounts of time chasing tiny material/3D differences after the game already strongly reads as the same visual family.

Prioritize visual similarity in this order:

1. camera/composition;
2. flat road and bridge geometry;
3. bridge silhouette;
4. faction colors;
5. scale relationships;
6. character/enemy/boss silhouettes;
7. gates;
8. UI hierarchy;
9. lighting/shadows/depth;
10. VFX density;
11. fine surface/material detail.

Gameplay correctness, readability, responsiveness, and performance are more important than impossible last-mile visual parity.

---

## 3. Production assets

Read:

`docs/blastline-production-assets/`

including:

- `APPROVED_SOURCE_MASTERS.md`
- `ASSET_PATHS.md`
- `FILE_SIZE_RULES.md`
- `ROAD_GEOMETRY.md`
- `DO_NOT_FAKE_CURRENT_SCREENSHOTS.md`

The user has approved the current Batch 1–10 production art.

If the approved generated master sheets are available in your coding/session environment:

- preserve originals under `assets/source/blastline/`;
- crop/repack/resize/encode useful runtime pieces under `assets/blastline/`;
- do not render giant master sheets directly in production.

If a specific approved binary is unavailable, do not fabricate a replacement and claim it is the approved asset. Continue all independent work and document that individual missing binary as a blocker.

Preferred runtime budgets:

- ordinary image: <500 KB;
- sprite/VFX/UI atlas: <1.5 MB;
- major environment layer: <2 MB;
- exceptional complex image: <4 MB;
- no routine asset should approach 10 MB.

Prefer cropped WebP and logical atlas splitting.

---

## 4. Road geometry is non-negotiable

The bridge roadway must be:

FLAT
STRAIGHT
RIGID
PLANAR

Perspective convergence is correct.

Vertical curvature is wrong.

Do not allow the deck to:

- sag;
- hump;
- bow;
- arc vertically;
- undulate;
- twist;
- resemble a hill/ramp/roller coaster;
- follow the suspension cable curve.

Only the suspension cables curve.

Prefer mathematical Canvas projection using a flat asphalt material and code-generated perspective lane lines.

This applies to gameplay and especially the home screen.

---

## 5. Dynamic text stays dynamic

Do not bake changing gameplay words/values into reusable assets.

Runtime-render:

- gate operators/values;
- troop count;
- score;
- coins;
- wave number;
- boss health values if shown;
- upgrade title/description/stat value;
- victory/game-over statistics;
- reusable button labels.

Use the empty structural UI/gate assets with runtime HTML/CSS/Canvas text.

---

## 6. Reconcile the current implementation against the spec

Before large visual work, audit the current code and tests against `docs/BLASTLINE_GAME_SPECIFICATION.md`.

Create a concise implementation checklist containing at least:

- state machine;
- six-wave progression;
- final victory transition;
- controls;
- auto-fire;
- squad logical/visible count;
- gate rules;
- enemy contact/damage;
- elites;
- boss phase;
- boss attack behavior;
- upgrade pool and 3-choice flow;
- score/persistence;
- pause;
- retry reset;
- mobile/desktop behavior.

Where old code/tests conflict with the spec, fix them.

Do not preserve a bug because it was already implemented.

---

## 7. Implementation order

Work in this order unless a dependency requires a small deviation:

### Phase A — gameplay correctness

1. normalize game states/state transitions;
2. make six-wave progression correct;
3. implement Victory after final boss;
4. make Game Over/Retry clean;
5. align player stats/upgrades/gates with the spec;
6. ensure enemy/elite/boss mechanics work;
7. add/repair boss attacks if missing;
8. ensure pause and input work;
9. update automated tests.

### Phase B — world/camera

10. camera/horizon;
11. flat road projection;
12. suspension-bridge environment;
13. ocean/sky/depth.

### Phase C — gameplay visuals

14. player squad;
15. enemies/elites;
16. boss;
17. gates;
18. projectiles/VFX.

### Phase D — UI/end states

19. HUD;
20. upgrade screen;
21. Victory;
22. Game Over;
23. home screen/branding.

### Phase E — refinement

24. responsive/mobile polish;
25. lighting/shadows;
26. performance;
27. final bug/edge-case validation.

---

## 8. Real-browser evidence rule

Every claim about what the CURRENT GAME looks like must come from a genuine screenshot captured from the actual running repository code.

Never:

- generate a fake current screenshot;
- redraw the current site;
- use a reference render as an AFTER image;
- AI-edit/Photoshop a current screenshot;
- use an old planning infographic as current-state proof.

Reference = visual target.

Real browser screenshot = current implementation evidence.

---

## 9. Visual iteration — practical convergence, not obsessive pixel chasing

Use fresh real screenshots at:

- mobile: 390×844, DPR 1;
- desktop: 1365×768, DPR 1.

Capture important states:

- home;
- lane/gate gameplay;
- normal combat;
- elite/dense combat;
- boss;
- upgrade screen;
- victory;
- game over.

For each major visual pass:

1. capture real screenshot;
2. compare with relevant reference;
3. identify the most important 1–3 differences;
4. correct them;
5. recapture;
6. verify the result is genuinely closer and still performant/readable.

Do several meaningful iterations where the gap is large.

Do **not** require endless iterations for tiny differences that are intrinsic to lightweight Canvas/browser rendering.

A visual area is good enough when:

- it clearly evokes the BLASTLINE reference;
- major composition/scale/color/silhouette differences are resolved;
- the game is readable and polished;
- remaining differences are mostly fine material/rendering details that are unreasonable to reproduce in this stack.

Maintain concise notes under:

`docs/visual-audit/full-fidelity/`

but spend more time improving the actual game than writing audit prose.

---

## 10. Required gameplay behavior from the spec

Treat the following as mandatory v1 outcomes:

- Home -> Play starts a clean run.
- Forward motion is automatic.
- Touch/mouse/A-D/arrow steering works.
- Shooting is automatic.
- Starting squad is approximately 12 troops.
- Troop count is the primary survival resource.
- Large logical squads render with visible-count compression.
- Gate pair applies at most one effect.
- Gate arithmetic cannot reduce troops below 1 by itself.
- Enemies can reduce troops to zero and cause Game Over.
- Grunts and elites are mechanically distinct.
- Later waves are harder/denser.
- Every wave ends in a boss.
- Boss has clear health and meaningful attacks.
- Waves 1–5 boss defeat -> 3-choice upgrade screen.
- One upgrade is selected and persists for the run.
- Wave 6 boss defeat -> Victory.
- Retry clears all transient state.
- Best score persists locally.
- Pause freezes gameplay completely.
- Mobile and desktop are playable.

Use the detailed rules and baseline values in `docs/BLASTLINE_GAME_SPECIFICATION.md` rather than re-inventing them here.

---

## 11. Tests

Update/add tests so they enforce the authoritative specification.

At minimum cover:

- deterministic RNG;
- gate effects/caps;
- unique upgrade choices;
- upgrade effects;
- six-wave escalation;
- final boss -> Victory;
- troop zero -> Game Over;
- only one gate can apply per pair;
- kill reward only once;
- Retry clears transient run state.

Run where applicable:

```bash
npm test
node --check src/game.js
node --check src/core.mjs
```

Then real-browser validate:

- load;
- Play;
- keyboard steering;
- pointer/touch steering;
- auto-fire;
- positive gate;
- negative gate;
- elites;
- damage/death;
- boss;
- upgrade;
- next wave;
- pause/resume;
- Game Over;
- Retry;
- final boss;
- Victory;
- resize;
- asset loading;
- console errors.

Never claim a test passed unless it actually ran.

---

## 12. Performance

Keep BLASTLINE practical for static Cloudflare hosting and normal mobile browsers.

Measure/inspect:

- asset sizes;
- texture use;
- particle count;
- per-frame allocation;
- Canvas draw cost;
- DOM count;
- resize behavior.

Do not trade away major visual identity unnecessarily, but do not turn the game into a huge fragile asset payload to chase promo-render parity either.

---

## 13. Final acceptance

Do not judge success solely by whether the reference and screenshot are pixel-identical.

Judge the project on two axes:

### A. Behavioral correctness

Does the real game satisfy `docs/BLASTLINE_GAME_SPECIFICATION.md`?

This is mandatory.

### B. Practical visual fidelity

Does the real running game clearly feel like the same BLASTLINE world/aesthetic as the references, within reasonable HTML/CSS/Canvas constraints?

This should be pushed as far as practical, but not at the expense of stability, performance, readability, or completing the actual game.

The final build should feel like a polished browser adaptation of the reference mobile-game aesthetic.

---

## 14. Final deliverable

Provide:

- exact final branch;
- exact final SHA;
- summary of gameplay-spec changes implemented;
- list of tests run and results;
- genuine mobile screenshot;
- genuine desktop screenshot;
- home screenshot;
- boss screenshot;
- upgrade screenshot;
- Victory screenshot;
- Game Over screenshot;
- runtime asset size summary;
- performance notes;
- any remaining behavior deviations from the game spec;
- any remaining visual differences that are substantial;
- any visual differences intentionally accepted as reasonable browser-rendering limitations.

Do the implementation, testing, browser validation, and practical visual refinement.

Do not merely produce another plan.
