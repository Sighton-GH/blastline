# Runtime image manifest

The browser-ready production library under `assets/blastline/` totals 517,470 bytes across 33 optimized WebP files. The validated game requests 30 of those files (492,664 bytes); the three single-frame enemy crops remain only as backward-compatible fallbacks. It never requests the 21,548,338-byte source-master library.

| Group | Files | Bytes |
|---|---:|---:|
| Branding | 1 | 114,902 |
| Characters and home hero | 21 | 238,026 |
| Environment | 5 | 104,308 |
| Upgrade icons | 6 | 60,234 |
| **Total** | **33** | **517,470** |

The runtime renderer uses Canvas/CSS to project and composite the straight bridge world, detailed tower/asphalt/ocean crops, gates, projectiles, particles, shadows, HUD, boss bar, progress fills, and all dynamic text. Squad art is visibly compressed to at most 42 rendered soldiers while logical troops remain capped at 999.
