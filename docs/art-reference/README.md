# BLASTLINE Art References

These are generated **visual targets** for BLASTLINE. They are not screenshots from the live game and they are not production/runtime textures.

The repository copies are lightweight WebP previews so this reference library stays friendly to a static Cloudflare Pages deployment. Use the composition, proportions, UI hierarchy, palette, effects, and overall art direction as implementation guidance; production game assets belong under `/assets`.

## Reference set

1. **Gameplay / lane choice** — bridge camera, player scale, red/blue gates, enemy staging, compact HUD.
2. **Elite wave** — higher enemy density, larger elite silhouettes, stronger danger/readability.
3. **Boss battle** — boss scale, formation composition, muzzle flashes, boss-health presentation.
4. **Between-waves upgrades** — three-card upgrade choice and readable overlay hierarchy.
5. **Victory screen** — reward presentation, celebratory characters, clear next-level CTA.
6. **Game over** — failure state, score hierarchy, retry CTA.
7. **Endgame chaos** — upper bound for troop density, multipliers and visual spectacle.
8. **Character/environment style guide** — soldier shapes, enemy tiers, gate construction, bridge language, palette and combat VFX.
9. **Static-web game concept sheet** — end-to-end reference designed around an HTML5 Canvas/CSS/static-asset implementation.
10. **Before/after visual target** — quality benchmark for perspective, density, scale, effects and polish.

## High-quality source set

Full-resolution visual targets are stored under `high-quality/` with stable, content-based names. The approved production master sheets are stored separately under `assets/source/blastline/`; they are source material for optimized runtime crops, not images to load wholesale in the game.

1. `01-home-screen.png`
2. `02-gameplay-lane-choice.png`
3. `03-gameplay-squad-growth.png`
4. `04-gameplay-stat-gates.png`
5. `05-elite-wave.png`
6. `06-boss-battle.png`
7. `07-between-waves-upgrades.png`
8. `08-victory-screen.png`
9. `09-game-over.png`
10. `10-endgame-chaos.png`

These files are visual targets, not screenshots of the running repository. Genuine current-state screenshots are stored under `docs/visual-audit/final-2026-08-15/`.

## Gallery

![Gameplay lane choice](01-gameplay-lane-choice.webp)
![Elite wave](02-elite-wave.webp)
![Boss battle](03-boss-battle.webp)
![Between-waves upgrades](04-between-waves-upgrades.webp)
![Victory](05-victory-screen.webp)
![Game over](06-game-over.webp)
![Endgame chaos](07-endgame-chaos.webp)
![Character and environment style guide](08-character-environment-style-guide.webp)
![Static-web concept sheet](09-static-web-game-concept-sheet.webp)
![Before/after visual target](10-before-after-visual-target.webp)

## Implementation constraint

The art direction should be reproduced with static-friendly techniques: HTML5 Canvas/WebGL rendering, CSS UI, compressed PNG/WebP sprites, procedural particles, screen shake, gradients, shadows and a small number of reusable environment assets. Do not require a game server or heavyweight backend just to match these visuals.
