# Runtime image manifest

The browser-ready BLASTLINE WebP set totals 306,622 bytes across 16 files. The game never requests the roughly 21 MB source-master library.

| Group | Files | Bytes |
|---|---:|---:|
| Branding | 1 | 114,902 |
| Characters and home hero | 9 | 131,486 |
| Upgrade icons | 6 | 60,234 |
| **Total** | **16** | **306,622** |

The runtime renderer uses Canvas/CSS for the bridge world, gates, projectiles, particles, shadows, HUD, boss bar, progress fills, and all dynamic text. Squad art is visibly compressed to at most 42 rendered soldiers while logical troops remain capped at 999.
