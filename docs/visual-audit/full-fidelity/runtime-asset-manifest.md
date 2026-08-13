# BLASTLINE Batch 12 runtime asset manifest

## Current shipping raster/vector files

| Runtime file | Bytes | Format | Alpha | Current purpose | Status |
|---|---:|---|:---:|---|---|
| `assets/hero.webp` | 11,866 | WebP | yes | legacy loaded character asset | Retain for compatibility; gameplay renderer is procedural in this pass. |
| `assets/grunt.webp` | 8,734 | WebP | yes | legacy loaded enemy asset | Retain for compatibility; gameplay enemy renderer is procedural in this pass. |
| `assets/portrait.webp` | 4,968 | WebP | yes | HUD commander portrait | Active. |
| `assets/logo.svg` | 565 | SVG | yes | BLASTLINE title/logo | Active on menu after Batch 12 transform. |
| `assets/favicon.svg` | small | SVG | yes | browser favicon | Active/unchanged. |

No routine raster asset approaches the Batch 12 file-size ceilings.

## Procedural runtime layers

The following remain mathematical Canvas/CSS rather than large bitmaps:

- flat road/deck projection;
- straight perspective lane markings;
- deck side thickness;
- bridge towers, girders, rails, hangers and suspension cables;
- sky/ocean/horizon haze;
- blue gameplay soldiers;
- red grunts and elites;
- boss;
- gates and gate values;
- player projectiles and most VFX;
- HUD panels, progress bars, upgrade/end-state panels.

This preserves the critical rule that road perspective remains mathematical and planar rather than baked into a giant background image.

## Production atlas integration status

The requested Batch 1–10 master sheets are **not present in the repository** and were **not retrievable as image files from the current File Library search**. Therefore none of the following are falsely listed as integrated:

- `player-run.webp`
- `player-fire.webp`
- `player-steer.webp`
- `enemy-grunt.webp`
- `enemy-elite.webp`
- `boss.webp`
- `gates.webp`
- `vfx-muzzle.webp`
- `vfx-projectiles.webp`
- `vfx-impacts.webp`
- `vfx-explosions.webp`
- `ui-hud.webp`
- `ui-upgrades.webp`
- `ui-endstates.webp`
- modular bridge/sky/ocean/home production layers.

Those filenames remain the intended Batch 11 architecture once real source masters become accessible. They must be cropped/validated from the real generation sheets rather than invented from reference thumbnails.

## Runtime budgets retained for future exports

- ordinary standalone: preferred < 500 KB;
- character/VFX/UI atlas: preferred < 1.5 MB;
- major environment layer: preferred < 2 MB;
- exceptional complex layer: < 4 MB;
- no routine asset near 10 MB.
