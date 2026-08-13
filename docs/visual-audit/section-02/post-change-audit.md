# Section 02 — Post-change visual audit

## Baseline and evidence

Repository: `Sighton-GH/webgame`.

Section 2 was based on `section-01-environment-camera` at `87fd7bc66796dba51abe1624e6fff581623ae5a5` because PR #2 remains open and Section 1 is not yet merged into `main`.

Fresh browser evidence at DPR 1:

- `before-mobile.png` — 390 × 844, committed Section 1 baseline
- `before-desktop.png` — 1365 × 768, committed Section 1 baseline
- `after-mobile.png` — 390 × 844, final Section 2 candidate
- `after-desktop.png` — 1365 × 768, final Section 2 candidate
- `troops-001-mobile.png`, `troops-005-mobile.png`, `troops-010-mobile.png`, `troops-020-mobile.png`, `troops-050-mobile.png`, `troops-120-mobile.png` — real Chromium growth checks
- `run-frame-a-mobile.png`, `run-frame-b-mobile.png` — sequential real Chromium run frames while steering
- `shooting-mobile.png` — real Chromium capture during front-row muzzle flashes

The committed evidence above was produced by a one-shot GitHub Actions capture on the actual repository branch. The job checked out full history, served the exact Section 1 baseline commit `87fd7bc66796dba51abe1624e6fff581623ae5a5` and the Section 2 branch over localhost, launched real Playwright Chromium at DPR 1, interacted with the actual Play button/game runtime, captured the images, re-ran the required Node validation, committed the PNGs, and removed its temporary workflow. The job completed successfully. Earlier implementation iterations were also inspected as genuine sandbox Chromium captures. No screenshot was generated, redrawn, composited or synthesized.

Reference targets were inspected directly from the repository, especially gameplay/squad views 01, 02, 03 and 07 and character/style views 08 and 09. The repository identifies these as generated visual targets, not live-site evidence. Reference 10 was also retrieved; because its locally reconstructed binary did not match the repository blob hash, it was not used for pixel measurements or as current-state evidence.

## What changed

- Replaced the single camera-facing `hero.webp` gameplay rendering with a lightweight procedural Canvas soldier designed from the back/forward-running view.
- Removed the player-facing white/gray halo problem at its cause by no longer using the halo-baked source sprite for gameplay soldiers.
- Added deterministic world-space squad rows with perspective projection, staggering, back-to-front ordering and responsive spacing.
- Added a troop-to-visible-soldier mapping: 1:1 through 20 troops, then gradually compressed to a maximum of 42 visible soldiers.
- Added per-soldier contact shadows before the body, projected feet placement, run bob, alternating leg stride, phase variation and steering lean.
- Added front-row shooter selection, brief muzzle flash/recoil and projectile starts from real visible squad positions.
- Added rapid lateral convergence of projectiles back toward the original gameplay firing lane so visual shooter origins do not break the existing collision model.
- Added WebDriver-only QA hooks for deterministic troop-count capture, state inspection and high-count draw-cost measurement; production play is unchanged when not automated.

## Acceptance questions

### Squad recognition

**Yes.** The BEFORE images show one blue character plus a number even when troop count is 12. The AFTER images show twelve separate blue soldiers in a clearly readable formation. The 20/50/120 growth captures make the relationship between troop value and road occupancy immediately visible.

### Formation

**Yes.** The 12-troop state uses two staggered rows rather than random scattering. Larger groups distribute soldiers across balanced rows rather than leaving a tiny partial tail row. Formation slots are defined in world depth/lane coordinates and projected through the Section 1 camera.

### Troop growth

**Yes.** Verified mappings are 1→1, 5→5, 10→10, 20→20, 50→28, 100→36, 120→37 and 999→42 visible soldiers. The 120-troop screenshot reads as a dense compact block similar in intent to the endgame reference, without drawing hundreds of units.

### Scale

**Yes, materially improved.** The old single player used a nominal height of 12% of viewport height on both aspect ratios, which made it enormous relative to the mobile road and inconsistent relative to the desktop road. Near-row procedural soldiers are roughly 6–7% of mobile viewport height and roughly 8–9% nominal height on desktop, with the squad footprint—not one oversized sprite—providing visual mass.

### Direction

**Yes.** The gameplay soldiers have no forward-facing face/eyes toward the camera. Helmet/backpack/torso and rifle orientation clearly point toward the horizon/up-bridge. This fixes the source hero's front/three-quarter orientation.

### Running

**Yes.** Sequential real frames while steering show changing leg stride, bob, individual phase offsets and group lean rather than a static sprite sliding laterally. The formation remains coherent while those poses change.

### Shooting

**Yes.** Bursts select visible front-row soldiers, show short muzzle flash/recoil at the rifle tip and create bullets from those soldiers' world positions. Browser state inspection confirmed bullets carry a real shooter slot; their x-position then converges toward the pre-existing gameplay firing lane so collision behaviour remains viable.

### Grounding

**Yes.** Each soldier's feet are anchored to its projected world point. Characters no longer share one generic player shadow.

### Shadows

**Yes.** Small low-alpha ellipses are drawn before each soldier and scale with the character. They create contact without forming one large distracting blob.

### Perspective

**Yes.** Row y positions, character scale and lateral x spacing all run through the Section 1 `worldToScreen`/lane projection. High-count rows visibly compress toward the bridge distance.

### Fidelity

**Yes.** The AFTER player presentation is substantially closer to the reference squad language than the BEFORE images: it is now a forward-facing multi-row firing group whose visible density grows with troop count, rather than one oversized camera-facing portrait.

## Functional validation

Commands actually run after final changes:

- `npm test` — PASS (`smoke ok`)
- `node --check src/game.js` — PASS
- `node --check src/core.mjs` — PASS

The one-shot GitHub Actions screenshot job re-ran those same three commands against the exact branch used for the committed AFTER screenshots and passed all three.

Real Chromium validation:

- game load/start — PASS
- automatic shooting — PASS; live state contained bullets with a visible squad shooter index
- enemies spawn — PASS
- keyboard steering — PASS; player x moved from 0.000 to about +0.637 under ArrowRight
- pointer steering — PASS; player x moved from about +0.637 to -0.637
- squad steering — PASS by direct sequential screenshot inspection; formation stayed coherent while moving laterally
- real gate collision — PASS; an actual `x2` troop gate changed 18→36 troops in the live game
- visible squad gate update — PASS; the same collision changed visible representation 18→24
- pause — PASS; paused state held player position
- player/enemy collisions — PASS during the long wave run; troop count decreased while play continued and did not throw
- wave/boss progression — PASS; an accelerated high-power/high-troop live run reached the real upgrade state after about 28.1 s, then selecting an upgrade started Wave 2
- mobile viewport — PASS at 390×844 DPR 1
- desktop viewport — PASS at 1365×768 DPR 1
- browser console/page errors — none observed in final control/gate or progression runs
- missing runtime assets — none observed
- severe clipping — none in centered final captures; at extreme steering the formation compresses toward the road edge but remains usable

## Performance

At 999 numerical troops the renderer caps at 42 visible soldiers. A WebDriver-only in-browser benchmark of 180 complete Canvas draws at that high-count state averaged about **4.65 ms per draw** in the sandbox Chromium environment. Formation templates are cached by visible count; no DOM nodes or image allocations are created per soldier.

## Clearly improved

- One character has become a visually unmistakable squad.
- Troop count now changes road occupancy in a deterministic, readable way.
- Individual soldier scale is reduced while formation mass matches the reference intent more closely.
- Player soldiers now face the gameplay direction.
- The baked light edge on the old hero asset is absent from gameplay soldiers.
- Rows are deliberate, staggered and perspective-aware.
- High troop counts create a dense formation without unbounded draw cost.
- Run stride/bob/lean and phase offsets remove the static sliding presentation.
- Muzzle flashes and bullets originate from visible front-row shooters.
- Per-member contact shadows improve deck grounding.

## Still noticeably wrong

- The new procedural soldiers are intentionally lightweight and flatter/simpler than the softly modeled 3D characters in the generated reference renders. Their silhouettes are now correct for gameplay direction, but the character art itself is not yet reference-quality 3D.
- The legacy numerical troop label remains on the road and is visually more utilitarian than the target presentation.
- At extreme lateral steering, the formation has to compress near the road edge; it remains coherent but is less elegant than the centered formation.
- Enemy, gate, HUD and broader VFX fidelity are still visibly behind the target and were deliberately left outside Section 2.
- Of those out-of-scope systems, the flat/schematic gate presentation is now the most conspicuous mismatch in the normal lane-choice AFTER screenshot.

## Verdict

SECTION 2: PASS
