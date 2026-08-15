# BLASTLINE — Implement the Authoritative Game Spec + Best-Practical Visual Match

You are continuing development of the BLASTLINE browser game in:

`Sighton-GH/webgame`

Use maximum reasoning.

## 0. Start from the cleaned repository

The repository has already been consolidated and cleaned up.

Use the **current `main` branch as the implementation base** unless the user explicitly tells you otherwise.

Do NOT resurrect, merge, or cherry-pick historical development branches merely because they contain older BLASTLINE work. Historical branches and old PRs are non-authoritative after cleanup unless a specific missing file must be recovered and you have verified that recovery is actually necessary.

Before editing:

1. record the current `main` SHA;
2. inspect the current repository tree;
3. inspect the current code/tests/docs on `main`;
4. work forward from that cleaned state.

Do not spend time reconstructing old branch history when the cleaned `main` already contains the accepted project state.

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
- Victory;
- Game Over;
- persistence;
- HUD behavior;
- VFX/audio expectations;
- balance baselines;
- edge cases;
- acceptance criteria;
- Definition of Done.

### Authority rule

When current implementation, old tests, README text, prototypes, screenshots, historical branches, or old behavior disagree with `docs/BLASTLINE_GAME_SPECIFICATION.md`, **the game specification wins** unless there is a newer explicit user instruction.

Update code and tests toward the specification rather than preserving accidental old behavior.

### Requirement-language rule

Interpret the specification carefully:

- **MUST / required / non-negotiable / Definition of Done** = mandatory for v1.
- **SHOULD / recommended / preferred / starting target** = strong design direction, but may be tuned when testing shows a better implementation.
- **MAY / optional / when supported / future** = non-blocking enhancement. Do not delay completion of the core game to implement an optional system.

For example, optional or recommended systems such as extra elite variants, armor, enemy ranged fire, audio, lifetime currency, or extra meta systems must not become blockers unless the specification explicitly marks them mandatory or the user separately requests them.

In particular, these outcomes ARE mandatory:

- BLASTLINE has six authored waves;
- every wave ends with a boss encounter;
- bosses on Waves 1–5 lead to an upgrade choice;
- the Wave 6 boss leads to **VICTORY**;
- do not loop directly from final boss back to Wave 1;
- squad reaching zero leads to **GAME OVER**;
- Retry starts a clean run;
- controls, auto-fire, gates, enemies, bosses, upgrades, pause, mobile play, and desktop play function correctly.

---

## 2. Visual references are aspirational, not an impossible pixel-perfect requirement

Inspect the real reference images under:

`docs/blastline-codex-package/references/`

Also inspect `docs/art-reference/` where useful.

Actually inspect the image pixels. Do not substitute filenames, prose descriptions, or memory for looking at the references.

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

However, BLASTLINE is a lightweight static HTML/CSS/Canvas browser game. A native/promo-quality 3D mobile render may contain lighting, modeling, materials, animation, and depth effects that are unreasonable to reproduce exactly in this stack.

The goal is **the closest practical polished browser interpretation**, not literal pixel parity.

Do not use “browser limitations” as an excuse for obvious composition, geometry, scale, silhouette, color, or UI mistakes. Those should still be corrected.

Conversely, do not waste large amounts of time chasing tiny material or 3D-surface differences after the browser game already strongly reads as the same BLASTLINE visual family.

Prioritize visual similarity in this order:

1. camera/composition;
2. flat road and bridge geometry;
3. suspension-bridge silhouette;
4. faction colors;
5. scale relationships;
6. player/enemy/elite/boss silhouettes and orientation;
7. gates;
8. UI hierarchy;
9. lighting/shadows/depth;
10. VFX density and impact;
11. fine surface/material detail.

Gameplay correctness, readability, responsiveness, stability, and performance are mandatory. Visual fidelity should be pushed as far as practical around those constraints.

---

## 3. Production assets

Read the current files under:

`docs/blastline-production-assets/`

including:

- `APPROVED_SOURCE_MASTERS.md`;
- `ASSET_PATHS.md`;
- `FILE_SIZE_RULES.md`;
- `ROAD_GEOMETRY.md`;
- `DO_NOT_FAKE_CURRENT_SCREENSHOTS.md`.

The user has approved the Batch 1–10 production-art direction.

Important: do not assume an approved source-master PNG exists as a local runtime file merely because its filename is documented. Verify actual repository/session availability before using it.

If an approved generated master is available in the coding environment:

- preserve the untouched source master under `assets/source/blastline/` when appropriate;
- crop/repack/resize/encode useful runtime pieces under `assets/blastline/`;
- do not render a giant source sheet directly in gameplay.

If a specific approved master binary is unavailable:

- do not fabricate a replacement and falsely label it as that approved master;
- do not block all game development on that one missing source sheet;
- continue with current repository assets, Canvas/CSS geometry, and all independent improvements;
- document the missing asset only if it materially limits the final result.

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

**FLAT — STRAIGHT — RIGID — PLANAR**

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
- follow the suspension-cable curve.

Only the suspension cables curve.

Prefer mathematical Canvas projection using a flat asphalt material and code-generated perspective lane lines.

This applies to gameplay and especially the home screen.

---

## 5. Dynamic text stays dynamic

Do not bake changing gameplay words or values into reusable art.

Runtime-render changing content such as:

- gate operators/values;
- troop count;
- score;
- coins;
- wave number;
- boss health values if shown;
- upgrade title/description/stat value;
- Victory/Game Over statistics;
- reusable button labels where an empty button shell is used.

---

## 6. Audit the current cleaned implementation against the spec

Before large visual work, audit the **current `main` code and tests** against `docs/BLASTLINE_GAME_SPECIFICATION.md`.

Create a concise implementation checklist containing at least:

- state machine;
- six-wave progression;
- final Victory transition;
- controls;
- auto-fire;
- squad logical/visible count;
- gate rules;
- enemy contact/damage;
- elites;
- boss phase;
- boss combat behavior;
- upgrade pool and three-choice flow;
- score/persistence;
- pause;
- retry reset;
- mobile/desktop behavior.

Classify each as:

- CORRECT;
- PARTIAL;
- INCORRECT;
- MISSING.

Then implement the fixes. Do not stop after producing the checklist.

Where code or tests conflict with mandatory behavior in the spec, fix them.

Where an optional feature is absent, do not automatically classify the game as incomplete.

---

## 7. Implementation order

Work in this order unless a dependency requires a small deviation.

### Phase A — mandatory gameplay correctness

1. normalize game states/state transitions;
2. make six-wave progression correct;
3. implement Victory after final boss;
4. make Game Over/Retry clean;
5. align mandatory player stats/upgrades/gates with the spec;
6. ensure grunt/elite/boss mechanics work;
7. ensure boss encounters are meaningful and readable;
8. ensure pause/input work;
9. update automated tests.

Only after mandatory behavior is reliable should optional systems be added when they clearly improve the game.

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
27. final bug/edge-case validation;
28. optional enhancements only if they materially improve the finished game.

---

## 8. Real-browser evidence rule

Every claim about what the CURRENT GAME looks like must come from a genuine screenshot captured from the actual running repository code.

Never:

- generate a fake current screenshot;
- redraw the current site;
- use a reference render as an AFTER image;
- AI-edit/Photoshop a current screenshot;
- use an old planning infographic as current-state proof.

**Reference = visual target.**

**Real browser screenshot = current implementation evidence.**

---

## 9. Visual iteration — practical convergence, not obsessive pixel chasing

Use fresh real screenshots at:

- mobile: 390×844, DPR 1;
- desktop: 1365×768, DPR 1.

Capture important states where implemented:

- home;
- lane/gate gameplay;
- normal combat;
- elite/dense combat;
- boss;
- upgrade screen;
- Victory;
- Game Over.

For each major visual pass:

1. capture a real screenshot;
2. compare with the relevant reference;
3. identify the most important 1–3 differences;
4. correct them;
5. recapture;
6. verify the result is genuinely closer and still performant/readable.

Do several meaningful iterations where the gap is large.

Do **not** require endless iterations for tiny differences intrinsic to lightweight browser rendering.

A visual area is good enough when:

- it clearly evokes the BLASTLINE reference;
- major composition/scale/color/silhouette differences are resolved;
- the game is readable and polished;
- remaining differences are mostly fine material/rendering details that are unreasonable to reproduce in this stack.

Maintain concise evidence/notes under:

`docs/visual-audit/full-fidelity/`

when useful, but prioritize improving the actual game over producing excessive audit prose.

---

## 10. Mandatory v1 outcomes

Use the full specification for details, but the completed core game must satisfy at least:

- Home -> Play starts a clean run.
- Forward motion is automatic.
- Touch, mouse/pointer, A/D, and arrow steering work.
- Shooting is automatic.
- Starting squad is approximately 12 troops unless playtesting justifies a documented tuning change.
- Troop count is the primary survival resource.
- Large logical squads use visible-count compression.
- A gate pair applies at most one effect.
- Gate arithmetic cannot reduce troops below 1 by itself.
- Enemy damage can reduce troops to zero and cause Game Over.
- Grunts and at least one elite class are mechanically distinct.
- Later waves are meaningfully harder/denser.
- Every wave ends with a boss encounter.
- Boss health is clearly communicated.
- Waves 1–5 boss defeat -> exactly three unique upgrade choices.
- Player chooses one upgrade and it persists for that run.
- Wave 6 boss defeat -> Victory.
- Retry clears transient state and starts cleanly.
- Best score persists locally.
- Pause freezes gameplay completely.
- Mobile and desktop are playable.
- Road geometry remains flat and planar.

Do not elevate optional systems beyond this mandatory set unless they are already implemented cleanly or materially improve the game.

---

## 11. Tests

Update/add tests so they enforce the mandatory specification.

At minimum cover, where the architecture permits clean automated testing:

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

Run:

```bash
npm test
node --check src/game.js
node --check src/core.mjs
```

Then real-browser validate the implemented core flow:

- load;
- Play;
- keyboard steering;
- pointer/touch steering;
- auto-fire;
- positive gate;
- negative gate;
- elite;
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

Do not trade away major visual identity unnecessarily, but do not turn the game into a huge fragile payload to chase promo-render parity either.

---

## 13. Final acceptance

Judge success on two separate axes.

### A. Behavioral correctness — mandatory

Does the real game satisfy the mandatory behavior in `docs/BLASTLINE_GAME_SPECIFICATION.md`?

Optional/recommended items are not blockers unless explicitly promoted to mandatory by the user/spec.

### B. Practical visual fidelity

Does the real running game clearly feel like the same BLASTLINE world/aesthetic as the references within reasonable HTML/CSS/Canvas constraints?

Push this as far as practical without sacrificing stability, performance, readability, or completion of the actual game.

The final result should feel like a polished browser adaptation of the premium mobile-game reference aesthetic, not a generic webpage and not a claim of impossible pixel-perfect native-3D parity.

---

## 14. Final deliverable

Provide:

- exact final branch and SHA;
- summary of mandatory gameplay-spec changes implemented;
- optional features added, if any;
- list of tests actually run and results;
- genuine mobile screenshot;
- genuine desktop screenshot;
- home screenshot;
- boss screenshot;
- upgrade screenshot;
- Victory screenshot;
- Game Over screenshot;
- runtime asset-size summary;
- performance notes;
- any remaining mandatory behavior deviations;
- any significant remaining visual differences;
- visual differences intentionally accepted as reasonable browser-rendering limitations.

Do the implementation, testing, browser validation, and practical visual refinement.

Do not merely produce another plan.
