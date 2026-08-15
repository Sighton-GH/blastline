# BLASTLINE gameplay and visual fidelity plan

This checklist maps the August 2026 improvement pass to the supplied high-quality reference set. Gameplay behavior follows `BLASTLINE_GAME_SPECIFICATION.md`; visual comparisons use the real browser at 390×844 and 1365×768 DPR 1.

## Reference priorities

1. Keep the bridge deck mathematically flat, straight, and tied to one vanishing point.
2. Reproduce the references' red suspension-tower identity, layered deck construction, asphalt, bright ocean, and compact glossy HUD.
3. Make squad fire visibly originate from the rendered soldiers and travel on fixed trajectories.
4. Replace isolated fast enemies with slow, readable, easy-to-defeat hordes.
5. Preserve responsive steering, gate readability, six-wave progression, bosses, upgrades, and end states.

## Implementation checklist

- [x] Add Space as a pause/resume control while retaining the pause button and P.
- [x] Emit a base projectile and muzzle flash from every visible soldier in each volley.
- [x] Remove homing/retargeting; retain only fixed straight multishot offsets.
- [x] Replace single/pair spawning with authored horde sizes that scale from 12 to 28+ enemies.
- [x] Reduce enemy approach speed to roughly one quarter of the previous baseline.
- [x] Lock every enemy to its formation line with no lateral wobble.
- [x] Give grunts one-hit durability and reduce elite/shield durability and contact damage.
- [x] Extract and use four approved marching frames for grunt, elite, and shield enemies.
- [x] Make road/deck width use the same projection depth as screen Y so both edges remain straight.
- [x] Add detailed approved tower portals, deck thickness, under-deck trusses, guardrails, cables, hangers, lamps, sidewalk joints, and asphalt texture.
- [x] Rebuild water with a saturated depth gradient, approved painted surface detail, layered whitecaps, glints, horizon haze, and cloud banks.
- [x] Restyle currency, wave, stats, pause, boss, horde, upgrade, victory, and game-over UI toward the reference hierarchy and palette.
- [x] Add a live red-horde counter for enemy-density readability.
- [x] Run the final post-tuning unit, syntax, real-browser, interaction, geometry, animation, performance, asset, and screenshot validation pass.

## Acceptance checks

- Space pauses and freezes time/projectiles; Space resumes.
- One normal volley contains each visible soldier's shooter ID and unique origin.
- Moving the squad after firing cannot alter an existing projectile's line.
- A spawned horde contains at least 12 enemies, advances slowly, changes march frames, and preserves every X coordinate.
- Projected left/right road edges deviate by less than 0.05 CSS pixels from their straight endpoint lines.
- Grunts die from one base-power projectile.
- Reference states are captured from the real site at both required viewports.
- No console errors, failed runtime assets, or source-master network requests occur.
