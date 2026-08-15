# BLASTLINE production asset handoff

The approved production masters were generated in Batches 1–10 and are now stored under `assets/source/blastline/`. The running game uses cropped, optimized derivatives under `assets/blastline/`.

Important rules:

- The bridge roadway must be constructed as a flat, straight, planar perspective surface. Only suspension cables curve.
- Do not bake dynamic gate values, HUD values, upgrade values, victory/game-over text, or other runtime-changing text into reusable artwork.
- Prefer WebP and modular atlases; keep ordinary files under ~500 KB, atlases under ~1.5 MB, major environment layers under ~2 MB, and exceptional files under ~4 MB where practical.
- Use real browser screenshots for visual validation against `docs/art-reference/`.

Runtime derivatives are deterministic crops made by `tools/extract-production-assets.py`; no source sheet is loaded wholesale. The high-resolution visual targets remain separate under `docs/art-reference/high-quality/`.
