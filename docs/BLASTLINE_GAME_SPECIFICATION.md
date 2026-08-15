# BLASTLINE — Authoritative Endless-Session Specification

**Status:** Authoritative v2 gameplay and presentation contract<br>
**Platform:** Static HTML/CSS/Canvas browser game<br>
**Primary QA viewports:** 390 × 844 and 1365 × 768 at DPR 1

## 1. Authority and identity

This document is the source of truth for BLASTLINE rules, state transitions, progression, interactions, and acceptance. Visual references under `docs/art-reference/` direct composition and style but are not browser evidence. Tests must follow this specification; stale code and earlier fixed-campaign documents do not override it.

BLASTLINE is an endless, session-based bridge shooter. The player steers a blue squad freely across a wide suspension-bridge deck, automatically fires at slow red formations, makes lane decisions, defeats a boss after every wave, and specializes a build until the squad is defeated.

The run has no final wave, Victory state, account, backend, lifetime currency, or persistent progression.

## 2. Session contract

Each page load starts from a clean home screen. Starting, retrying, refreshing, or reopening creates a fresh in-memory session with:

- difficulty;
- wave and phase;
- score and kill count;
- skill points;
- reserve lives;
- purchase counts and upgrade tiers;
- player combat statistics;
- current pooled combat entities.

BLASTLINE must not read or write its progression through `localStorage`, cookies, IndexedDB, or a backend. An unrelated storage key owned by another page feature must not affect the run.

Score is unspendable performance feedback. Skill points are the only shop currency.

## 3. States and legal transitions

Canonical states:

- `home`
- `playing`
- `boss`
- `boss-reward`
- `paused`
- `recovery`
- `game-over`

Legal flow:

```text
HOME → PLAYING → BOSS → BOSS_REWARD → PLAYING → …
           ↘ PAUSED ↗       ↘ PAUSED ↗
PLAYING/BOSS → RECOVERY → previous combat phase
PLAYING/BOSS → GAME_OVER → fresh PLAYING or HOME
```

`paused`, `boss-reward`, and `game-over` freeze simulation. Recovery runs only its protected countdown/effects. Defeating a boss always increments the wave after reward selection. No transition may reach Victory or wrap to Wave 1.

Game Over occurs only when the squad reaches zero and no reserve life remains.

## 4. Difficulty

The home screen offers exactly three modes. Veteran is selected by default.

- **Recruit:** approximately 80% incoming pressure, slower hostile cadence, and a larger revival floor.
- **Veteran:** intended default pressure, timing, and recovery.
- **Elite:** 125% horde density, stronger/faster attack patterns, and a smaller revival floor.

Difficulty changes formation density, encounter pressure, hostile cadence, and recovery margins. It must not rely on extreme ordinary-enemy health or speed.

## 5. Endless waves

`getWaveConfig(waveIndex, difficulty)` is the sole wave-configuration interface. It must return finite, bounded, deterministic values for every integer wave from 1 through at least 1,000,000.

- Wave duration begins at 45 seconds and rises gradually to a 65-second cap.
- Every wave ends with a boss.
- Density, formations, composition, projectiles, and boss patterns carry most escalation.
- Early encounters are readable; mid-run encounters target roughly 80–120 enemies; late stress may render 180 simultaneous enemies.
- Active enemies are hard-capped at 220.
- Ordinary movement speed and health remain bounded at high waves.
- Boss health and cadence scale without numeric overflow.

Wave 1 teaches a clear positive-versus-negative gate. Later waves use real tradeoffs.

## 6. Lanes and steering

The game has three canonical logical lanes shared by spawning, rendering, movement, collisions, telegraphs, and QA:

```text
centers: -0.58, 0, +0.58
logical half-width: 0.255
```

The player steers continuously within the road limit; movement is not snapped to a lane. Every gate, pickup, hazard, enemy, formation member, and hostile telegraph receives a lane and remains inside that lane for its lifetime. Formations retain their assigned line and never laterally track the player.

Standard gate encounters occupy two lanes and leave one clearly readable neutral/safe lane. Gates may not drift, cross lane boundaries, overlap each other, or share their decision zone with unavoidable enemies.

## 7. Squad and projectiles

The visible squad grows with troop count and formation-density upgrades. Each visible soldier is an individual sprite with a stable logical slot. Auto-fire emits straight, non-homing projectiles from the visible muzzle slots. Moving after a shot does not alter its line.

Combat upgrades may change:

- troop count;
- damage;
- cadence;
- projectile speed;
- multishot;
- piercing;
- critical-hit chance;
- armor;
- formation density;
- frenzy duration;
- recovery strength;
- reserve lives.

Projectile saturation must skip a volley that cannot fit rather than emit a misleading partial-squad volley. Gameplay projectiles are pooled and bounded independently from VFX.

## 8. Enemies and formations

Canonical ordinary classes:

- **Grunt:** one hit, slow march.
- **Gunner:** one hit, infrequent lane-telegraphed shot.
- **Shield bearer:** low health plus a visible shield layer.
- **Heavy:** three to five hits, slowest march, larger contact damage.
- **Demolition unit:** delayed lane hazard with an explicit response window.

Canonical formation vocabulary:

- wall;
- wedge;
- column;
- staggered;
- protected-core;
- split-lane.

Composition should change with wave number while retaining readable silhouettes and lanes. Killing enemies awards score. Skill points come from kill milestones, elite-class kills, and bosses.

## 9. Gates

Each gate option declares its lane, tone, label, subtitle, and one or more stat effects. Encounters resolve once when the squad reaches the decision line.

Wave 1 pairs an obvious benefit with an obvious penalty. Later examples include:

- more troops for lower fire rate;
- damage for wider/less dense formation exposure;
- armor for a small troop loss;
- faster fire for reduced per-shot power.

The neutral lane applies no gate effect. Tradeoff text must expose both sides before contact.

## 10. Skill points and pause shop

The pause screen is a run dashboard with Resume, current build, controls, Restart Run, and the full shop. Purchases are allowed only while paused.

The shop contains:

- Reinforcements
- Damage
- Fire Rate
- Velocity
- Multishot
- Piercing
- Critical Hits
- Armor
- Formation
- Frenzy
- Recovery
- Extra Life

Each repeat purchase costs more than the prior one. Each upgrade has a defined cap. Insufficient points leave the entire session unchanged and show useful feedback. Extra lives cost skill points, are capped at two reserves, and cannot exceed that cap through rewards.

## 11. Bosses and rewards

Every boss uses deterministic patterns selected from:

- aimed straight volleys;
- spreads with a safe gap;
- lane suppression;
- summoned formations;
- cascading hazards.

Bosses have two phases early and three phases later. Phase thresholds alter cadence and available patterns; the final phase is visibly enraged. Telegraphs must appear before unavoidable damage.

Defeating a boss:

1. clears immediate combat threats;
2. awards score and skill points;
3. pauses at `boss-reward`;
4. presents exactly three unique, free upgrade cards;
5. shows each card’s next tier and synergy;
6. applies one selected reward;
7. increments the wave and resumes `playing`.

## 12. Reserve-life recovery

The session may hold at most two reserves. When lethal damage occurs with a reserve available:

1. consume one reserve;
2. clear hostile projectiles, contact threats, gates, hazards, and telegraphs near the player;
3. retain wave, score, points, purchases, and upgrades;
4. restore at least the difficulty-scaled squad floor plus Recovery bonuses;
5. enter a three-second protected countdown;
6. resume the interrupted combat phase.

Protection prevents troop loss for its full displayed duration.

## 13. Camera, bridge, and ocean

Portrait and landscape use separate camera profiles; neither is a stretched copy of the other.

- The planar road projects to straight deck edges and fills most of the foreground width.
- Tower bases, cables, trusses, rails, shoulders, anchors, and lamps frame the corridor without covering enemies or dividing the playable road.
- Landscape uses a lower, wider cinematic view.
- Portrait preserves side structure and ocean while keeping the full decision space visible.

The ocean is one coordinated system: continuous turquoise base, perspective-scaled texture, restrained animated glints/whitecaps, and horizon haze. It may not show rectangular bands, palette seams, or conflicting wave directions.

Lighting uses one coherent upper-left sun direction across environment, characters, shadows, and VFX.

## 14. HUD and overlays

The combat HUD exposes wave, difficulty, phase, score, skill points, reserves, squad size, damage, fire rate, armor, hostile count, and boss health when relevant. It must not show coins, lifetime totals, six-wave labels, or Victory messaging.

Required overlays:

- difficulty-driven home/deploy screen;
- pause dashboard and shop;
- three-card boss reward;
- protected revive countdown;
- dimensional boss-health treatment;
- Run Over summary with score, wave, kills, and mode.

Dynamic values remain live HTML/Canvas text and are not baked into artwork.

## 15. Runtime architecture

Canvas 2D remains the rendering platform. Required performance properties:

- cached static environment on its own canvas;
- transparent combat canvas for animated content;
- fixed 60 Hz simulation step with render interpolation, clamped suspension delta, and bounded catch-up;
- pooled enemies, player projectiles, hostile projectiles, particles, floaters, and telegraphs;
- three lane partitions with longitudinal collision buckets;
- offscreen culling and hard entity caps;
- pre-scaled sprite LOD and reduced distant/dense animation detail;
- adaptive gameplay backing scale while DOM UI and static environment remain sharp;
- cached text updates rather than per-frame DOM mutation.

All visible soldiers and enemies remain genuine individual sprites. Dense LOD may reduce shadows, distant animation frequency, or redundant projectile drawing, but not substitute a painted crowd image for gameplay entities.

## 16. Validation contract

Release acceptance requires:

- unit coverage for infinite formulas, high-wave stability, difficulty, lanes, gates, shop pricing/caps/spending, rewards, revival, reset, and no persistence;
- deterministic 100-seed simulations for all three difficulties and multiple build archetypes;
- a natural-input Chromium matrix including touch;
- at least 20 accelerated boss cycles with no Victory loop;
- hard rAF, >50 ms, heap, and entity-count assertions;
- genuine portrait and landscape browser captures for every required state;
- manual screenshot scores of at least 4/5 in every critical category and at least 4.2/5 overall;
- no unresolved bridge, water, density, or performance defect.

Exact commands, durations, artifacts, and failure interpretation are defined in `docs/VALIDATION.md`.
