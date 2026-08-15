# BLASTLINE runtime asset paths

The current optimized runtime tree is:

```text
assets/blastline/
├── branding/
│   └── logo-primary.webp
├── characters/
│   ├── boss.webp
│   ├── enemy-elite-1.webp … enemy-elite-4.webp
│   ├── enemy-elite.webp (compatibility fallback)
│   ├── enemy-grunt-1.webp … enemy-grunt-4.webp
│   ├── enemy-grunt.webp (compatibility fallback)
│   ├── enemy-special-1.webp … enemy-special-4.webp
│   ├── enemy-special.webp (compatibility fallback)
│   ├── home-hero.webp
│   ├── player-run-1.webp
│   ├── player-run-2.webp
│   ├── player-run-3.webp
│   └── player-run-4.webp
├── environment/
│   ├── asphalt.webp
│   ├── bridge-tower-far.webp
│   ├── bridge-tower-near.webp
│   ├── ocean-surface.webp
│   └── ocean-whitecaps.webp
└── ui/
    ├── upgrade-armor.webp
    ├── upgrade-power.webp
    ├── upgrade-rate.webp
    ├── upgrade-spread.webp
    ├── upgrade-troops.webp
    └── upgrade-velocity.webp
```

The roadway geometry, sky, ocean base, bridge cables/rails, gates, projectiles, VFX, HUD values, boss-health values, and all changing text remain procedural Canvas/CSS output. Small approved crops add asphalt/ocean material detail, detailed tower portals, and real enemy march frames. Full masters under `assets/source/blastline/` are production sources only and must not be requested at runtime.

Run `python3 tools/extract-production-assets.py` to reproduce these WebP crops from the approved masters.
