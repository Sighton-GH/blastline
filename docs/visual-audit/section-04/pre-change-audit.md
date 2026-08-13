# BLASTLINE Section 4 — Pre-change enemy/combat audit

## Evidence inspected

All implementation observations below come from fresh real Chromium screenshots captured from the recovered Section 3 baseline at DPR 1:

- `before-mobile.png` — 390×844
- `before-desktop.png` — 1365×768
- `before-combat-close-mobile.png` — 390×844
- `before-dense-mobile.png` — 390×844
- `recovery-section03-mobile.png` — 390×844, proving the recovered portal-gate baseline

Reference pixels inspected directly:

- `docs/art-reference/01-gameplay-lane-choice.webp`
- `02-elite-wave.webp`
- `03-boss-battle.webp`
- `07-endgame-chaos.webp`
- `08-character-environment-style-guide.webp`
- `09-static-web-game-concept-sheet.webp`
- `10-before-after-visual-target.webp`

The repository reference files are very small concept renders (mostly 120×68), so they are used for silhouette, relative scale, value/colour language, formation and hierarchy rather than invented micro-detail.

## Baseline integrity

The recovered real screenshot shows the accepted nonlinear suspension-bridge projection, forward-facing multi-soldier squad, troop-count-driven squad growth, and standing `.68`-world-unit portal gates with visible posts/feet, blue/red material distinction and physical foreground frame layering. Enemy work can therefore use the passed bridge, squad and gates as fixed visual coordinate systems.

## A. Enemy scale

Current enemy height is driven by a screen-space `lerp(30,78,e.y)`, not the accepted nonlinear bridge projection. In the real screenshots this produces a recognizable near/far size change, but it does not track road convergence as tightly as the squad/gates. Close grunts become roughly player-soldier sized while distant enemies remain comparatively legible/large for their deck depth. Elites are only a fixed 1.22 scale multiplier.

## B. Silhouette and visual language

The current opponent is a detailed raster red-helmet soldier while the accepted player squad is now a clean procedural blue silhouette. The mismatch is conspicuous. The raster has baked detail/highlights and light edge pixels that can read as a cut-out, especially at small projected sizes. More importantly, every enemy role is visually derived from the same `grunt.webp` image, so there is no coherent family of standard/elite/boss silhouettes.

The style-guide reference establishes a clearer family: a compact red standard combatant and a substantially wider, heavier armoured elite. The boss-battle reference pushes that hierarchy much further for the boss.

## C. Facing direction

The static raster pose does not communicate an enemy force deliberately advancing toward the squad. It reads as a fixed three-quarter character image sliding down-screen. There is no movement-driven orientation or pose change.

## D. Standard versus elite distinction

This is one of the largest baseline failures. `ASSET_FILES.elite` points to the same `grunt.webp` as the standard enemy. In the real close screenshot an elite is identifiable mainly because it is about 22% larger and has a floating orange HP number. The reference style guide instead gives the elite a dramatically broader torso/shoulder silhouette, heavier armour and stronger value separation. Elite recognition should not depend on text.

## E. Perspective and grounding

Enemy centre positions use `worldToScreen`, but body height does not derive from the same nonlinear projection. The sprite is also drawn with a constant `+10` screen-pixel vertical offset. That weakens deck contact at far depths and means body/ground relationships vary by viewport. The reference enemies read as planted on the roadway with a compact contact shadow and stronger near/far hierarchy.

## F. Formation and roadway placement

Spawns already use five road lanes with small lateral jitter, which is a sound semantic base and does not need balancing changes. However, because every sprite has the same visual footprint and there is no presentation-aware staggering, nearby enemies can overlap into one ambiguous red mass while other moments look excessively sparse. The references favour a readable advancing line/group with clear individual bodies even under heavier density.

## G. Motion and animation

Current enemies only advance in world Y and receive a tiny sinusoidal X wobble. The raster body itself does not animate. In the real screenshots this reads as sprites sliding toward the player rather than walking/running. A lightweight procedural gait, vertical body motion and opposing leg/arm motion would improve motion without changing speed or spawn balance.

## H. Projectile relationship

The accepted Section 2 squad correctly supplies bullet origins. The baseline tracers are readable, but their tail is a fixed screen-space 14 px vertical segment and their body relationship is only loosely tied to the enemy silhouette. The real close screenshot shows bullets travelling down the lane coherently, but impact position can look like a dot near the character rather than a deliberate body hit. Projection-aware tracer length/width and body-centred hit feedback should improve this without changing weapon progression.

## I. Hit feedback

Existing red/orange particle bursts are lightweight and visible, but there is no short body reaction or hit flash. At normal gameplay speed the particle cue alone is easy to miss against red enemies and red bridge structure.

## J. Death/removal

Defeated enemies are marked `dead` and then filtered out in the same update pass. They therefore disappear instantly. The references communicate combat through more substantial silhouettes and flashes; the baseline disappearance is a conspicuous readability weakness. A very short fade/collapse/knockback state is justified without adding physics.

## K. Grounding and depth ordering

The recovered Section 3 gate layering is correct and must remain untouched. Enemy ordering is currently sorted by world Y, which is a useful base. Ground contact is the weaker part: the raster/baked shadow and constant vertical offset do not scale from the same projection, while bullet ordering is globally above enemies. The Section 4 pass should keep Y ordering but give each procedural body its own projected contact shadow and align tracer/hit rendering to the body.

## L. Boss presentation

The baseline boss uses the same elite/grunt raster again, only at a larger screen-space height. That is far below the boss reference, where the boss is a massive, broad armoured threat occupying a large fraction of the roadway and clearly dominating the squad. Boss gameplay/HP should remain unchanged, but the visual silhouette should be rebuilt as part of the same procedural enemy family.

## Highest-priority corrections

1. Replace the imported-looking common enemy raster presentation with lightweight procedural BLASTLINE opponents while retaining existing gameplay objects and stats.
2. Tie enemy body dimensions and deck contact to the accepted Section 1 projection rather than linear screen-space interpolation.
3. Give standard, elite and boss immediately different silhouettes; make the elite broader/heavier rather than merely 1.22× the same image.
4. Make enemies visibly face/advance toward the player and add restrained gait/bob animation.
5. Add projection-aware contact shadows and preserve coherent Y-depth ordering with the recovered gates.
6. Align tracers and hit flashes with rendered bodies, keeping the accepted squad origins and weapon semantics.
7. Add a sub-quarter-second lightweight death state so kills read rather than pop out of existence.
8. Preserve existing spawn rates, HP, contact damage, boss progression, squad, bridge, gate and HUD semantics.
