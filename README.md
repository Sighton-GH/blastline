# BLASTLINE

A zero-login, instant-play browser arcade game: multiply your blue squad, shoot upgrade gates, build a ridiculous firing line, trigger FRENZY, and survive escalating red waves and bosses.

## Play locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

No build step is required. Deploy the repository root directly to Cloudflare Pages.

## Controls

- Mouse: move left/right
- Keyboard: A / D or ← / →
- Touch / tablet: drag anywhere horizontally
- Shooting is automatic

## Game structure

Six authored difficulty tiers lead into increasingly hard runs. Each level mixes normal/elite enemies, two-choice shootable gates, a frenzy meter, and a boss. Clearing a boss gives a three-card meta upgrade before the next level.

The game intentionally represents large squad sizes visually with a capped number of rendered soldiers while preserving the full troop count mechanically. This keeps performance stable on mobile devices.

## Tests

```bash
npm test
```

Core deterministic tests cover seeded randomness, upgrades, gate generation, troop caps, unique choices, and level difficulty progression.

For deterministic browser capture, use `?demo=1&seed=42`.
