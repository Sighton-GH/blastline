# Section 02 — Pre-change visual audit

Baseline repository: `Sighton-GH/webgame`.

Baseline branch: `section-01-environment-camera` at `87fd7bc66796dba51abe1624e6fff581623ae5a5` (PR #2 is open and Section 1 is not yet on `main`). The local mirror used for visual QA was verified file-by-file against the Git blob SHAs for the committed Section 1 runtime source and character assets before this audit.

## Evidence

Fresh real Chromium renders of the exact committed Section 1 HTML/CSS/Canvas game were captured at DPR 1:

- `before-mobile.png` — 390 × 844
- `before-desktop.png` — 1365 × 768

The sandbox Chromium policy blocks URL navigation, including localhost. To avoid substituting a reproduction, the exact committed HTML/CSS/JS and byte-verified WebP assets were loaded into Chromium directly; only module/asset transport URLs were converted to in-memory data URLs. The game logic/rendering code itself was executed in Chromium. No image-generation or screenshot synthesis was used.

Reference targets inspected directly from `docs/art-reference/` include `01-gameplay-lane-choice.webp`, `02-elite-wave.webp`, `03-boss-battle.webp`, `07-endgame-chaos.webp`, `08-character-environment-style-guide.webp`, `09-static-web-game-concept-sheet.webp`, and `10-before-after-visual-target.webp`. These are generated target renders, not live-site evidence.

## A. Character scale

- Mobile baseline renders one player at a nominal 101 px height (12.0% of viewport height). At player depth the paved road is about 216 px wide, so the one sprite is almost half the road width in height. It reads oversized for an individual member of a squad.
- Desktop baseline renders one player at a nominal 92 px height (also 12.0% of viewport height) while the road is about 756 px wide at that depth. The same rule therefore reads much smaller relative to the roadway on desktop. Character scale is not tied coherently to the world projection/aspect ratio.
- Reference combat views show individually smaller blue soldiers whose collective formation creates the visual mass. The target character size should therefore decrease while the group footprint increases.

## B. Squad representation

- Baseline troop value is 12 but only one blue soldier is visible, with `12` painted over the deck. The number has no physical relationship to the road occupancy.
- Reference `02-elite-wave` shows a deliberate multi-soldier blue group with roughly a dozen readable bodies across multiple rows. `07-endgame-chaos` shows a much denser mass but not a literal rendering of every implied troop at extreme counts.
- Use one visible soldier per troop at low counts, then compress/cap the representation at larger counts. A cap around 40-ish visible soldiers is enough to produce the dense reference silhouette without hundreds of Canvas draws.

## C. Formation

- Baseline has no formation.
- Reference squads are centered, wide enough to read immediately, and arranged in compact rows with slight staggering. Dense squads expand both laterally and in depth rather than becoming a random cloud.
- Formation must be built in world x/y coordinates so rows compress naturally with the Section 1 perspective. It must remain within the paved road under steering.

## D. Facing direction / source asset quality

- Direct inspection of `assets/hero.webp` confirms the soldier is a front/three-quarter portrait looking toward the camera, while gameplay direction is toward the horizon. The enemy asset has the same camera-facing construction.
- Direct alpha-edge inspection shows the light/white-gray rim is baked into the source art; it is not created by Canvas shadow or CSS.
- Mirroring cannot convert a front-facing sprite into a back/forward-running view. No alternate forward-facing player asset exists in the repository. A lightweight procedural Canvas player is therefore preferred over image generation for Section 2.

## E. Running presentation

- Baseline is a static image translated across the deck, so movement reads as sliding.
- Reference character silhouettes imply an active run: separated legs, body movement and small pose variation. A lightweight procedural stride/bob with deterministic phase offsets is sufficient.

## F. Shooting presentation

- Baseline bullets originate from the numerical player center (`player.x`, y=0.88), not from a visible gun in a visible formation.
- The current muzzle flash is a generic circle offset from the camera-facing sprite and does not convincingly align with forward fire.
- Final bursts should choose plausible front-row squad shooters, start projectiles near their weapon muzzle/world position, and show brief aligned muzzle flashes/recoil.

## G. Grounding / shadows

- Baseline uses one large ellipse and draws it after the sprite, allowing the shadow to visually overlap the feet/body. The character remains readable, but contact is schematic.
- Each squad member should receive a small perspective-scaled contact shadow drawn before its body, with feet landing on its projected world point and back-to-front depth ordering.

## H. Perspective integration

- The Section 1 bridge projection is now coherent and must remain unchanged.
- Squad row depth, lateral spacing, scale and ordering must all use `worldToScreen`, not a screen-space grid. The group should narrow visually toward the horizon automatically.

## Highest-priority corrections

1. Replace the inappropriate camera-facing player sprite with a lightweight forward-facing procedural soldier at a smaller individual scale.
2. Build a centered world-space squad formation with deterministic rows/staggering and perspective-aware ordering.
3. Map troop count to visible soldier count with one-to-one low counts and a capped dense representation at high counts.
4. Add per-member grounding shadows and coherent feet/deck contact.
5. Add procedural run motion and front-row shooter selection with plausible muzzle/projectile origins.
6. Validate growth at 1, 5, 10, 20, 50 and 100+ troops and check high-count frame timing.
