# BLASTLINE

BLASTLINE is an instant-play browser gate-runner squad shooter. Steer a blue squad, auto-fire through six escalating waves, choose arithmetic/stat gates, defeat a boss after every wave, and break the final line to win.

## Controls

- Mouse, pointer drag, or touch: steer horizontally.
- A/D or Left/Right: steer horizontally.
- Shooting and forward travel: automatic.
- Pause/resume: top-right button, Space, or P.

## Stack
- Plain HTML/CSS/Canvas
- Optimized WebP crops from the approved BLASTLINE production masters
- No backend required
- Static Cloudflare Pages deployment

Run progress, combat upgrades, score, and coins are kept for the current run. Best score and lifetime coins persist locally in the browser.

## Test
```bash
npm test
node --check src/game.js
node --check src/core.mjs
```

Real-browser regression and screenshot capture use:

```bash
node tools/final-browser-validation.mjs
```
