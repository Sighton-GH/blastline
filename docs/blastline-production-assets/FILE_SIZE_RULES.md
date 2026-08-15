# BLASTLINE web asset budgets

Preferred runtime budgets:

- ordinary individual image: < 500 KB
- sprite / VFX / UI atlas: < 1.5 MB
- major environment layer: < 2 MB
- exceptional complex image: < 4 MB
- no routine production asset should approach 10 MB

Use cropped WebP assets and split large sheets into logical atlases. Prefer Canvas/CSS for flat road projection, lane-line perspective, progress fills, dimming overlays, basic gradients, and other cheap geometry.
