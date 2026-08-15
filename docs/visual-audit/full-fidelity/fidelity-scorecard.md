# BLASTLINE full-fidelity scorecard

Status: **NOT AT FINAL ACCEPTANCE**

Scoring: 0 fundamentally wrong, 1 major mismatch, 2 recognizably related but poor, 3 moderately close, 4 close, 5 excellent practical match.

Evidence rule: scores below are based on the untouched repository reference previews in `docs/art-reference/` and the genuine Chromium captures in `docs/visual-audit/full-fidelity/final/`. Reference previews are targets, never implementation evidence.

| Category | Score | Critical | Current evidence / gap |
|---|---:|:---:|---|
| camera | 3 | yes | Coherent runner perspective, but still taller/more top-down than the target presentation. |
| horizon | 4 | yes | Stable bright horizon with bridge convergence. |
| vanishing point | 4 | yes | Centered and consistent. |
| road width | 3 | yes | Readable, but corridor still feels narrower/longer than the strongest reference compositions. |
| road flatness | 5 | yes | Straight planar deck; no vertical bow/sag/hump. |
| bridge silhouette | 4 | yes | Immediately reads as a red suspension bridge. |
| tower proportions | 3 | no | Dimensional but still procedural/schematic. |
| girder depth | 3 | no | Thickness exists; structural language is less rich than reference art. |
| cables | 4 | no | Suspension curves are clear and separated from the flat deck. |
| rails | 3 | no | Functional and dimensional, but simplified. |
| deck thickness | 4 | yes | Slab side faces and edge structure prevent a paper-polygon read. |
| ocean | 4 | no | Cyan stylized water with broad highlights. |
| sky | 4 | no | Pale blue atmospheric gradient. |
| atmospheric depth | 3 | no | Haze exists but is less layered than the render target. |
| player character | 3 | yes | More dimensional soft-3D procedural model; still below generated production-sprite quality. |
| player direction | 5 | yes | Rear-facing / away from camera. |
| player scale | 4 | yes | Readable at gameplay size. |
| squad formation | 4 | no | Clear compact multi-row formation. |
| squad density | 4 | no | Scales to large groups while staying readable. |
| enemy appearance | 3 | yes | Improved dimensional red faction; still procedural. |
| enemy direction | 4 | yes | Front-facing / approaching player is readable. |
| enemy scale | 4 | no | Appropriate relative scale. |
| elite differentiation | 4 | yes | Broader shoulder armor, darker materials, larger weapon. |
| boss silhouette | 4 | yes | Unique heavy armored proportions, no longer an enlarged grunt. |
| boss dominance | 5 | yes | Strong visual mass without needing UI to explain scale. |
| gate geometry | 3 | yes | Physical posts, feet, translucent centers and depth; still too sign-like. |
| gate scale | 2 | yes | Main remaining major mismatch: gates are materially smaller than reference portals. |
| gate glow | 3 | no | Controlled color glow but weaker than target. |
| gate material | 3 | no | Dimensional/translucent but still Canvas-simple. |
| HUD | 3 | yes | More compact arcade styling; still not as game-native as target HUD art. |
| typography | 3 | no | Readable and bold; still system-font driven. |
| upgrade UI | 3 | yes | Three-card game panel is present; icon/card art remains generic/procedural. |
| victory UI | 4 | yes | Dedicated production state now exists with gold/blue hierarchy. |
| game-over UI | 4 | yes | Dedicated red/charcoal end-state reads clearly. |
| home screen | 3 | yes | Stronger branding over real bridge scene; still reads partly as an overlay card. |
| logo | 3 | no | Existing vector is readable but simpler than target branding. |
| lighting | 3 | yes | Consistent gradients/highlights; lacks true rendered asset lighting richness. |
| shadows | 4 | no | Player/enemy/boss contact shadows are clear and restrained. |
| muzzle flashes | 3 | no | Compact and readable, but limited variation. |
| projectiles | 4 | no | Cyan-white player tracers are clearer and faction-specific. |
| impacts | 3 | no | Readable but simple particle circles/sparks. |
| explosions | 3 | no | Functional but below reference spectacle. |
| depth ordering | 4 | yes | Gates, rails, troops and enemies layer coherently. |
| mobile composition | 4 | yes | 390×844 is stable and readable. |
| desktop composition | 3 | no | Stable 1365×768 layout, but reference fidelity is weaker than mobile. |
| overall polish | 3 | yes | Material improvement over baseline, but production sprite/atlas integration is still blocked. |

## Acceptance decision

Final acceptance is **withheld** because critical categories remain below 4/5, especially gate scale/geometry, player/enemy production-art fidelity, camera/composition, HUD/home treatment, lighting, and overall polish.

The hard blocker is source availability: the generated Batch 1–10 master image sheets are not retrievable as images in the current File Library view and are not present in the repository. The Batch 11 manifest independently records the same source-specific audit blocker. Without those masters, this pass can improve the real game procedurally, but it cannot honestly claim full production-asset integration or a 4–5/5 visual match.
