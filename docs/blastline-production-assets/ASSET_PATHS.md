# BLASTLINE runtime asset paths

The current optimized runtime tree is:

```text
assets/blastline/
├── branding/
│   └── logo-primary.webp
├── characters/
│   ├── boss.webp
│   ├── enemy-elite.webp
│   ├── enemy-grunt.webp
│   ├── enemy-special.webp
│   ├── home-hero.webp
│   ├── player-run-1.webp
│   ├── player-run-2.webp
│   ├── player-run-3.webp
│   └── player-run-4.webp
└── ui/
    ├── upgrade-armor.webp
    ├── upgrade-power.webp
    ├── upgrade-rate.webp
    ├── upgrade-spread.webp
    ├── upgrade-troops.webp
    └── upgrade-velocity.webp
```

The home/gameplay roadway, bridge, sky, ocean, haze, gates, projectiles, VFX, HUD values, boss-health values, and all other changing text remain procedural Canvas/CSS output. Full masters under `assets/source/blastline/` are production sources only and must not be requested at runtime.

Run `python3 tools/extract-production-assets.py` to reproduce these WebP crops from the approved masters.
