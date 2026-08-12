# BLASTLINE validation notes

Validation performed before the initial repository publish.

## Automated game-logic tests

`npm test` passes 6/6 tests covering:

- deterministic seeded randomness
- troop multiplier limits
- all persistent upgrade effects
- distinct two-choice gate generation
- unique between-level upgrade choices
- monotonic authored difficulty progression

## Browser interaction checks

Validated in Chromium through the Chrome DevTools Protocol:

- Play button starts a run
- A/D keyboard steering changes squad position at gameplay speed
- pointer/mouse steering changes squad target position
- Level Clear opens exactly three upgrade choices
- choosing an upgrade starts Level 2
- Game Over panel renders and exposes retry flow
- DPR-2 mobile canvas uses a high-resolution backing buffer

## Responsive layout sweep

Start menu and gameplay canvas validated at:

- 320×568 @ DPR 2
- 390×844 @ DPR 2
- 768×1024
- 1024×768
- 1365×768
- 1920×1080

The start panel remains within the viewport at each size and the canvas backing dimensions match the requested viewport/DPR.

## Asset validation

`assets/logo.svg` and `assets/favicon.svg` were parsed successfully as XML/SVG. All deployable project files returned HTTP 200 from a local static server.

## Visual review changes made after screenshots

- moved gates below the HUD entry zone
- capped wide-screen gate size to the gameplay lane
- reduced squad sprite overlap
- centered persistent squad stats so they do not clip near screen edges
- labeled the Frenzy meter
- fixed keyboard steering after browser testing showed it was too slow
