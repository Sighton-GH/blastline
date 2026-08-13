# Section 01 — Pre-change Visual Audit

Baseline source: `Sighton-GH/webgame` `main` at `87f468bb6274da72410b1562d57e888675d6b6af`.

Evidence inspected before code changes:

- `before-mobile.png` — real Chromium capture, 390×844, DPR 1
- `before-desktop.png` — real Chromium capture, 1365×768, DPR 1
- `docs/art-reference/01-gameplay-lane-choice.webp`
- `docs/art-reference/08-character-environment-style-guide.webp`
- `docs/art-reference/09-static-web-game-concept-sheet.webp`
- `docs/art-reference/10-before-after-visual-target.webp`
- supporting bridge views `02-elite-wave.webp`, `03-boss-battle.webp`, `07-endgame-chaos.webp`

## Camera / composition

- Baseline projection begins the deck around 8–12% of viewport height and expands almost linearly to the foreground. This makes the camera read high/top-down and runway-like rather than looking forward along a suspended span.
- Mobile baseline outer deck is roughly 90% of viewport width at the bottom (about x=20…369) and roughly 25–30% near the distant top. The foreground is therefore too dominant.
- Desktop baseline outer deck is roughly 88% of viewport width at the bottom and about 28% at its distant top. The very large foreground pavement overwhelms ocean and bridge structure.
- The reference views reserve a clearer distant horizon/sky band, compress far geometry more strongly, and use large bridge structure to frame the road rather than letting pavement be the dominant silhouette.
- Player vertical position in the baseline is around 80% of mobile viewport height and around 76–82% on desktop, broadly usable; the major mismatch is the camera/deck projection around it.

## Road / deck

- Baseline is essentially two flat trapezoids: a light grey outer slab and darker grey road. There is almost no visible deck thickness.
- The roadway has little shoulder/edge hierarchy. The outer light strip reads as another flat pavement band rather than a structural slab.
- Dashed lane markings use screen-space line dashes, so their cadence does not provide convincing perspective depth.
- Reference bridge views show a narrower road corridor, visible side mass, red structural framing, and stronger value separation between driving surface, shoulders, and side structure.

## Bridge structure

- Towers are 24 px-wide red rectangles with no paired-leg/cross-beam portal silhouette. The far tower is clipped by the top edge in both baseline captures.
- The near and far tower pieces do not form a single bridge frame spanning the deck. They look like isolated vertical props positioned beside the road.
- Rail details are 20 repeated horizontal strokes per side. In the screenshots these point outward from the deck like ladder ticks instead of reading as guardrail posts/hangers.
- Cable lines are disconnected diagonals/beziers attached to individual rectangles. They do not produce the unmistakable continuous suspension curve visible in references 01/02/03/07.
- The baseline would not remain immediately recognizable as a suspension bridge if the red colour cue were removed.

## Ocean / sky / horizon

- The baseline fills the entire background with one blue sky gradient, then overlays side water wedges from the top of frame. This effectively removes a readable sky/water horizon.
- Repeating straight white water strokes are obvious and evenly patterned.
- Reference views have a clearly separated bright sky/distant haze region and darker water below, which makes the bridge feel elevated over a real surrounding body of water.

## Lighting / depth

- Baseline road and towers are mostly flat fills. There are no strong lit/shaded tower faces, deck side shadows, rail shadows, or atmospheric fade.
- Foreground, midground, and background values are too similar, especially on the bridge deck.
- Reference imagery uses brighter sunlit deck faces, darker side faces, red tower face variation, and lower contrast/desaturation in the distance.

## Highest-priority corrections

1. Rebuild projection around a deliberate horizon/vanishing region and stronger non-linear depth compression.
2. Narrow the foreground bridge and introduce visible deck slab thickness.
3. Replace rectangle towers with paired structural portal towers and cross-members.
4. Build one coherent main suspension cable per side with perspective-spaced vertical hangers.
5. Replace outward ladder ticks with longitudinal side beams/guardrails plus vertical posts.
6. Separate sky and ocean with a visible hazy horizon and less repetitive water detail.
7. Add simple directional shading and atmospheric depth only after the macro silhouette is correct.
