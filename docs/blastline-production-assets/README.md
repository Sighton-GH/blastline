# BLASTLINE production asset handoff

This branch is reserved for the BLASTLINE production asset integration handoff.

The approved production masters were generated in ChatGPT File Library in Batches 1–10. The runtime should use cropped/optimized assets under `assets/blastline/`, following the Batch 11 export manifest.

Important rules:

- The bridge roadway must be constructed as a flat, straight, planar perspective surface. Only suspension cables curve.
- Do not bake dynamic gate values, HUD values, upgrade values, victory/game-over text, or other runtime-changing text into reusable artwork.
- Prefer WebP and modular atlases; keep ordinary files under ~500 KB, atlases under ~1.5 MB, major environment layers under ~2 MB, and exceptional files under ~4 MB where practical.
- Use real browser screenshots for visual validation against `docs/art-reference/`.

The binary production master sheets are not duplicated here yet because the File Library interface in this session exposes them as references but not transferable file bytes. Do not substitute fabricated or regenerated files without explicit approval.
