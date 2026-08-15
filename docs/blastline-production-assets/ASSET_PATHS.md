# BLASTLINE runtime asset paths

Approved source art should be cropped/optimized into the following runtime tree:

```text
assets/blastline/
├── environment/
│   ├── bridge-towers.webp
│   ├── bridge-structure.webp
│   ├── bridge-rails.webp
│   ├── bridge-cables.webp
│   ├── road-material.webp
│   ├── deck-side.webp
│   ├── sky.webp
│   ├── ocean.webp
│   ├── haze.webp
│   └── environment-shadows.webp
├── characters/
│   ├── player-run.webp
│   ├── player-fire.webp
│   ├── player-steer.webp
│   ├── player-special.webp
│   ├── player-shadows.webp
│   ├── enemy-grunt.webp
│   ├── enemy-elite.webp
│   ├── enemy-special.webp
│   ├── enemy-shadows.webp
│   └── boss.webp
├── gates/
│   ├── gates.webp
│   ├── gate-energy.webp
│   └── gate-particles.webp
├── vfx/
│   ├── vfx-muzzle.webp
│   ├── vfx-projectiles.webp
│   ├── vfx-impacts.webp
│   ├── vfx-explosions.webp
│   ├── vfx-smoke.webp
│   └── vfx-celebration.webp
├── ui/
│   ├── ui-hud-icons.webp
│   ├── ui-hud-decor.webp
│   ├── ui-hud-buttons.webp
│   ├── ui-upgrade-cards.webp
│   ├── ui-upgrade-icons.webp
│   ├── ui-upgrade-fx.webp
│   ├── ui-victory.webp
│   ├── ui-gameover.webp
│   └── ui-endstate-overlays.webp
├── branding/
│   ├── logo-primary.webp
│   ├── logo-compact.webp
│   ├── logo-light.webp
│   ├── logo-dark.webp
│   ├── logo-mono.webp
│   └── brand-emblem.webp
└── home/
    ├── home-sky.webp
    ├── home-ocean.webp
    ├── home-haze.webp
    ├── home-bridge-distance.webp
    ├── home-bridge-near.webp
    ├── home-hero.webp
    ├── home-hero-shadow.webp
    └── home-ambient.webp
```

The home/gameplay road perspective is procedural Canvas geometry, not a baked bitmap.
