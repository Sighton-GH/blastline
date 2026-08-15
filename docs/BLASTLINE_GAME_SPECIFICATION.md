# BLASTLINE — Authoritative Game Design & Gameplay Specification

**Document status:** Authoritative v1 gameplay contract<br>
**Repository:** `Sighton-GH/webgame`<br>
**Primary implementation target:** static HTML/CSS/Canvas browser game<br>
**Primary viewport:** mobile portrait, with responsive desktop support

---

## 0. Purpose and authority

This document defines **what BLASTLINE is, how it should behave, how a run progresses, how its systems interact, and what counts as correct gameplay**.

It exists so implementation agents do not have to infer intended behavior from scattered code, old prototypes, screenshots, or visual references.

### 0.1 Source-of-truth order

When sources disagree, use this priority:

1. **This document** — authoritative for gameplay behavior, game rules, state transitions, progression, interaction logic, and intended player experience.
2. **`docs/blastline-codex-package/references/`** — authoritative visual direction/reference, but aspirational rather than a requirement for impossible pixel-perfect reproduction.
3. **`docs/blastline-production-assets/`** — authoritative asset organization, size, runtime text, and road-geometry rules.
4. **Tests** — should be updated to enforce this specification.
5. **Current code** — implementation may be refactored or corrected when it conflicts with this specification.

If current code and this document disagree, **the specification wins** unless the user explicitly changes the design.

### 0.2 Visual-reference philosophy

BLASTLINE is inspired by a polished premium mobile arcade-game aesthetic. The reference renders establish the desired composition, palette, silhouettes, scale relationships, UI hierarchy, bridge identity, and overall feel.

However, this is a **static browser game**, not a native 3D mobile title. The implementation is not required to reproduce every reference pixel or every 3D material effect exactly.

The correct goal is:

- match the references **as closely as practical**;
- preserve the same visual language and game identity;
- prioritize readability, responsiveness, performance, and gameplay correctness;
- use Canvas, CSS, sprites, gradients, shadows, particles, and lightweight 2.5D techniques intelligently;
- do not make the game fragile or excessively heavy merely to chase an imperceptible visual difference.

Visual references are **targets**, not literal screenshots the browser must reproduce pixel-for-pixel.

---

# 1. Game identity

BLASTLINE is a fast, approachable **gate-runner squad shooter** set on a red suspension bridge over bright blue water.

The player controls a blue squad advancing automatically along the bridge. The player steers horizontally, automatically fires at enemies ahead, chooses between arithmetic/stat gates, grows or loses squad strength, clears increasingly difficult waves, defeats a boss at the end of each wave, chooses an upgrade, and ultimately defeats the final boss to win the run.

### 1.1 Core fantasy

The player should feel like they are:

- leading a growing blue strike team;
- making rapid lane/gate decisions;
- mowing through increasingly dense red enemy formations;
- visibly becoming more powerful over the course of a run;
- surviving escalating bridge battles;
- finishing with a large, satisfying boss confrontation.

### 1.2 Design pillars

1. **Immediate readability** — player blue, enemies/red danger red, rewards/good choices blue/cyan/gold.
2. **One-finger simplicity** — steering is the main continuous input; shooting is automatic.
3. **Visible growth** — troop count, formation size, fire density, and combat spectacle should noticeably increase.
4. **Short tactical decisions** — gates and upgrades should matter without interrupting the arcade flow excessively.
5. **Escalation** — each wave should be harder, denser, and more spectacular than the previous one.
6. **Strong boss punctuation** — every wave ends with a boss; the final boss ends the run in victory.
7. **Browser practicality** — fast loading, responsive controls, static hosting, no backend dependency.

---

# 2. Platform and technical constraints

## 2.1 Required platform

BLASTLINE must run as a static browser game using local assets and client-side code.

Preferred stack:

- HTML;
- CSS;
- HTML5 Canvas;
- JavaScript/ES modules;
- compressed WebP/PNG assets where needed.

No backend is required for the core game.

## 2.2 Primary viewport

Primary design/QA viewport:

- **390 × 844 CSS pixels**;
- DPR 1 for reproducible visual testing.

Also support:

- tablets;
- landscape/desktop;
- reference desktop QA at **1365 × 768**.

## 2.3 Performance target

The game should feel smooth on a normal modern mobile browser and desktop browser.

Implementation should avoid:

- giant textures;
- uncontrolled particles;
- excessive DOM nodes;
- expensive full-screen filters every frame;
- unnecessary per-frame allocations;
- huge transparent sprite atlases.

Runtime asset guidance is defined in `docs/blastline-production-assets/FILE_SIZE_RULES.md`.

---

# 3. Complete player journey

A normal run follows this sequence:

1. **HOME / MENU**
2. Player presses Play.
3. **WAVE 1 PLAYING**
4. Player runs, auto-fires, encounters enemies and gate pairs.
5. Wave timer/encounter budget completes.
6. **WAVE 1 BOSS** appears.
7. Boss is defeated.
8. **UPGRADE SELECTION** appears.
9. Player chooses one of three upgrades.
10. **WAVE 2 PLAYING** begins.
11. Repeat through Waves 2–5.
12. Wave 6 begins.
13. **FINAL BOSS** appears.
14. Final boss is defeated.
15. **VICTORY** screen appears.
16. Player may start a new run or return home.

At any point during active combat, if the player squad is reduced to zero effective troops, transition to **GAME OVER**.

The final wave must **not loop back to Wave 1**.

---

# 4. Game states and legal transitions

The canonical high-level state machine is:

- `HOME`
- `PLAYING`
- `BOSS`
- `PAUSED`
- `UPGRADE`
- `VICTORY`
- `GAME_OVER`

### 4.1 Legal transitions

`HOME -> PLAYING`<br>
Start a new run.

`PLAYING -> BOSS`<br>
Wave combat phase completes and boss spawns.

`PLAYING -> PAUSED`<br>
Player pauses.

`BOSS -> PAUSED`<br>
Player pauses during boss fight.

`PAUSED -> PLAYING` or `PAUSED -> BOSS`<br>
Resume the state that was active before pause.

`PLAYING -> GAME_OVER`<br>
Squad reaches zero.

`BOSS -> GAME_OVER`<br>
Squad reaches zero during boss battle.

`BOSS -> UPGRADE`<br>
Boss defeated on Waves 1–5.

`BOSS -> VICTORY`<br>
Boss defeated on Wave 6.

`UPGRADE -> PLAYING`<br>
Upgrade selected; next wave begins.

`GAME_OVER -> PLAYING`<br>
Retry starts a clean new run.

`GAME_OVER -> HOME`<br>
Return home.

`VICTORY -> PLAYING`<br>
Play again starts a clean run.

`VICTORY -> HOME`<br>
Return home.

No enemies, bullets, gates, timers, or gameplay simulation should advance while in `HOME`, `UPGRADE`, `VICTORY`, `GAME_OVER`, or `PAUSED`.

---

# 5. Home screen

The home screen introduces the game quickly and should not require account setup.

Required elements:

- BLASTLINE branding;
- bridge/world presentation;
- clear Play button;
- concise controls/help;
- optional best score / lifetime currency;
- settings/pause-style audio control if audio exists.

### 5.1 Home bridge rule

The bridge deck is a **straight, rigid, flat planar deck**.

It may narrow with perspective, but may not visibly sag, hump, bow, twist, undulate, or follow the suspension cable curve.

Only the suspension cables curve.

Prefer code-generated perspective for the deck rather than a baked road image.

---

# 6. Controls

## 6.1 Forward movement

Forward travel is automatic. The player does not control forward speed directly.

The illusion of forward motion is created by:

- enemies/gates moving toward the player;
- road markings scrolling;
- bridge/world depth movement;
- VFX and animation.

## 6.2 Horizontal steering

Supported controls:

- drag/touch horizontal steering;
- mouse/pointer steering;
- `A` / `D`;
- Left / Right arrow keys.

The player moves only within safe road bounds.

Recommended normalized horizontal range:

- approximately `-0.78` to `+0.78` for the squad center.

Steering should be responsive but smoothed rather than teleporting between positions.

## 6.3 Shooting

Shooting is automatic.

The player should never need to hold a fire button during normal play.

## 6.4 Pause

Pause must be available through:

- visible pause button;
- `P` key on keyboard.

Pause freezes all gameplay simulation.

---

# 7. Camera and world projection

## 7.1 Camera

The camera follows from behind/above the blue squad, looking forward along the bridge toward the horizon.

The camera should feel like a mobile runner/shooter camera rather than a top-down strategy camera.

The squad belongs in the lower portion of the screen while enemies, gates, and bosses enter from the horizon/depth direction.

## 7.2 Horizon

Target horizon is approximately:

- portrait: around 18% of viewport height from top;
- desktop: around 16%.

These are tuning starting points, not immutable pixel values.

## 7.3 Bridge deck

Non-negotiable geometry:

- straight;
- rigid;
- planar;
- flat;
- consistent vanishing point.

The visual deck surface can have texture and shading, but geometry must remain planar.

## 7.4 Suspension bridge identity

The environment must read immediately as a red suspension bridge through:

- red towers;
- red structural beams/girders;
- red guardrail/edge structure;
- curved main suspension cables;
- vertical hangers;
- visible deck thickness;
- ocean on both sides;
- bright horizon/sky.

---

# 8. Player squad

## 8.1 Canonical starting values

A new run starts approximately at:

- troops: **12**;
- damage/power: **1.0**;
- fire rate: **5.5 shots/bursts per second**;
- projectile count: **1**;
- bullet speed: baseline **1.0×**;
- armor: **0**;
- run coins: **0**.

These are balance constants and may be tuned after playtesting, but their relationships should remain recognizable.

## 8.2 Troops are the primary survival resource

Troop count represents both squad strength and primary health.

If troop count reaches `0`, the run ends in Game Over.

Gate arithmetic may not create a negative troop count.

A negative troop gate may reduce the squad to a minimum of **1 troop**, so entering a red arithmetic gate is painful but does not produce a confusing instant loss before combat resolves.

Enemy damage can reduce the final troop to zero and cause defeat.

## 8.3 Visible squad compression

Large logical troop counts should not require rendering hundreds of soldiers.

The game may compress logical troop count into a smaller visible formation.

Recommended behavior based on the existing implementation:

- 1–20 troops: show roughly every troop;
- 21–50: gradually compress to ~28 visible soldiers;
- 51–100: gradually compress to ~36;
- 100+: cap visible soldiers around ~42.

The HUD always shows the real logical troop count.

## 8.4 Formation

Squad forms rows centered around player horizontal position.

Rules:

- keep formation readable;
- front row is closest to the action/horizon direction;
- rear rows fill behind;
- slight row staggering is acceptable;
- formation must remain within road bounds;
- soldier feet must visually contact the road;
- soldiers must face away from the viewer / toward the horizon during gameplay.

## 8.5 Shooter selection

Not every visible soldier needs to fire every frame.

For visual clarity:

- small squads: 1 active shooter at a time;
- medium squads: 2;
- large squads: up to 3 or more if performance/readability allow.

Muzzle flashes should originate from the corresponding visible shooter positions.

---

# 9. Player combat

## 9.1 Auto targeting

Shots travel forward toward enemies ahead.

Preferred target logic:

1. boss when boss phase is active;
2. nearest/highest-threat enemy in the forward corridor;
3. otherwise straight ahead.

Do not make bullets visibly curve unnaturally across the entire screen. Small aiming correction is acceptable.

## 9.2 Damage

Each projectile deals player `damage`/`power`.

Default: 1 damage per projectile.

Damage upgrades increase projectile damage.

## 9.3 Fire rate

Default approximately 5.5 bursts/sec.

Fire-rate upgrades stack multiplicatively unless balance tuning requires a soft cap.

Recommended practical cap: enough to feel powerful without producing unreadable continuous laser-like output or performance issues.

## 9.4 Projectile count / spread

Default: 1 projectile per burst.

Upgrade may add projectiles.

Recommended maximum: **4 simultaneous projectiles per burst** for v1.

Spread should remain tight enough to feel like squad gunfire, not a wide shotgun cone.

## 9.5 Bullet speed

Bullet speed should be fast enough that auto-fire feels immediate.

Bullet-speed upgrades improve responsiveness and late-game effectiveness.

## 9.6 Frenzy

BLASTLINE may use the existing Frenzy mechanic as a secondary arcade reward.

Recommended canonical behavior:

- grunt kill: +1 Frenzy charge;
- elite kill: +3;
- threshold: 12;
- activation duration: ~4.5 seconds;
- during Frenzy: ~45% faster fire cadence and modest projectile-speed boost;
- reset charge when activated.

Frenzy presentation should be visual and compact. Any word/value is runtime-rendered, not baked into artwork.

---

# 10. Enemy system

Enemies belong to the red faction and approach from ahead.

Primary gameplay orientation:

- enemies face toward the player/camera;
- blue soldiers face away from camera.

## 10.1 Grunt

Role: basic pressure unit.

Behavior:

- spawns ahead in one of several lanes;
- advances toward player;
- small lateral wobble/variation is acceptable;
- dies quickly early in run;
- contact removes **1 troop** by default.

Suggested HP by wave index `w` starting at 0:

`1 + floor(w / 2)`

This yields approximately:

- Waves 1–2: 1 HP;
- Waves 3–4: 2 HP;
- Waves 5–6: 3 HP.

## 10.2 Heavy elite

Role: durable high-priority enemy.

Must be visually distinct, not a scaled grunt.

Behavior:

- larger silhouette;
- slower than or similar speed to grunt;
- substantially more HP;
- higher reward;
- contact removes **4 troops** by default.

Suggested HP:

`5 + 2 * waveIndex`

## 10.3 Special / shielded elite

A second elite class should exist when assets/implementation support it.

Possible behavior:

- shield absorbs first several damage points;
- or frontal armor reduces damage;
- or short defensive window.

It must remain readable and should not introduce complicated RPG mechanics.

## 10.4 Enemy ranged attacks

Ranged enemy fire is allowed and encouraged in later waves to improve spectacle and make enemy VFX useful.

Recommended introduction:

- Waves 1–2: mostly contact pressure;
- Wave 3+: some enemies fire telegraphed red/orange shots;
- elites shoot more frequently or in small bursts;
- boss has dedicated patterns.

Enemy projectiles should be visually distinguishable from player fire.

A normal enemy projectile should usually cost **1 troop** unless armor absorbs it.

Avoid unavoidable bullet spam; horizontal steering must provide meaningful evasion.

---

# 11. Enemy spawning and formations

Enemies spawn ahead near the horizon/depth start and advance toward the player.

Use several lane centers, roughly equivalent to:

- far left;
- left;
- center;
- right;
- far right.

Add slight random offset so formations do not appear mechanically identical.

Enemies may spawn as:

- singles;
- pairs;
- loose rows;
- staggered formations;
- mixed grunt/elite groups.

Do not spawn enemies directly inside an active gate pair in a way that makes the gate choice unreadable or unfair.

---

# 12. Gate system

Gate choice is one of BLASTLINE's central mechanics.

## 12.1 Gate pair

A gate encounter contains exactly two mutually exclusive lane choices.

Typical visual convention:

- blue/cyan = beneficial;
- red = harmful.

Left/right placement is randomized so the positive gate is not always on the same side.

There must be a small neutral gap so the player cannot accidentally trigger both gates.

A gate encounter can apply **at most one gate effect**.

## 12.2 Gate categories

### Positive troop addition

Example range early game:

`+6` to `+11`

Later waves can increase the addition by roughly `+2` per wave index.

### Troop multiplier

Canonical v1 multiplier:

`×2`

Logical troop count is capped at **999**.

### Damage gate

Example:

`+1 DMG`

Increases projectile damage.

### Fire-rate gate

Example:

`+20%`

Multiplies fire rate by `1.20`.

### Negative troop gate

Example range:

approximately `-4` to `-9` early, increasing modestly with wave.

Cannot reduce troop count below 1 by gate arithmetic alone.

### Slow/fire-rate penalty

Example:

`-15%`

Multiplies fire rate by `0.85`.

## 12.3 Gate presentation

Gate values/operators are always runtime text.

Never bake changing values into reusable gate art.

Gate must:

- have visible physical thickness;
- stand perpendicular to flat road;
- be large enough to read before crossing;
- use clean translucent center panel;
- remain simpler than a cyberpunk portal.

## 12.4 Gate collision

A gate applies when its crossing plane reaches the squad.

Determine selection from squad/player center position relative to gate lane bounds.

Rules:

- only one gate can apply;
- after application, mark the pair resolved;
- show immediate visual burst/floater;
- update HUD instantly.

---

# 13. Wave structure

BLASTLINE v1 contains **6 authored waves**.

Canonical names and starting tuning:

| Wave | Name | Combat duration target | Spawn interval | Enemy budget target | Boss HP | Speed scalar |
|---|---|---:|---:|---:|---:|---:|
| 1 | First Contact | 28s | 1.00s | 18 | 60 | 1.00× |
| 2 | Crossfire | 30s | 0.92s | 22 | 80 | 1.08× |
| 3 | Red Tide | 32s | 0.84s | 26 | 100 | 1.16× |
| 4 | No Man's Land | 34s | 0.80s | 30 | 120 | 1.24× |
| 5 | Overdrive | 36s | 0.74s | 34 | 145 | 1.34× |
| 6 | The Last Line | 38s | 0.68s | 38 | 175 | 1.45× |

These are **baseline tuning values**, not sacred constants. Codex may adjust them during playtesting to improve pacing, fairness, or difficulty while preserving the six-wave escalation structure.

## 13.1 Normal wave pacing

A normal wave should feel like:

1. short opening combat;
2. first gate choice;
3. mixed combat;
4. additional gate/combat sequences;
5. denser late-wave enemy pressure;
6. gates stop spawning shortly before boss;
7. boss arrival;
8. boss fight;
9. upgrade or victory.

## 13.2 Gate frequency

Starting target: roughly one gate pair every ~5 seconds, with modestly increased frequency later.

Do not spawn a new gate pair if the previous pair is still occupying the decision space.

## 13.3 Elite frequency

Suggested baseline elite spawn probability:

- Wave 1: ~18%;
- add roughly 5 percentage points per wave;
- cap at a sensible readable level.

Late waves may include extra grunts in the same spawn event.

---

# 14. Boss system

Every wave ends with a boss.

## 14.1 Boss arrival

When normal wave duration/encounter budget completes:

- stop new gate spawns;
- reduce/finish ordinary enemy spawning;
- boss enters from ahead;
- boss health UI becomes prominent;
- game state becomes `BOSS`.

## 14.2 Boss visual role

Boss must be:

- dramatically larger than grunts/elites;
- unique silhouette;
- visually dominant;
- clearly centered or intentionally positioned;
- not merely an enlarged normal enemy.

## 14.3 Boss movement

Boss may advance from horizon and settle at a combat depth around the upper-middle gameplay region.

Boss must not overlap the player formation.

## 14.4 Boss attacks

A v1 boss should use 2–3 easy-to-read patterns, for example:

1. **Aimed burst** — red projectiles aimed near current player position.
2. **Spread volley** — several lanes of shots with safe gaps.
3. **Lane pressure** — boss shifts horizontally or telegraphs a dangerous lane.

Patterns should become faster or denser in later waves.

Avoid bullet-hell complexity that conflicts with simple one-finger steering.

## 14.5 Boss defeat

On boss HP <= 0:

- stop boss attacks immediately;
- play large defeat VFX;
- award score/coins;
- clear hostile projectiles after short visual grace or immediately if safer;
- Waves 1–5 -> `UPGRADE`;
- Wave 6 -> `VICTORY`.

---

# 15. Damage, armor, and defeat

## 15.1 Contact damage

Default troop losses:

- grunt contact: `-1` troop;
- heavy elite contact: `-4` troops;
- special elite: tune around `-2` to `-5` depending on type;
- boss should not instantly overlap/contact the squad during normal intended play.

## 15.2 Armor

Armor is an optional but supported run stat.

Recommended behavior:

- armor points absorb troop losses before troop count;
- 1 armor point absorbs 1 troop-loss point;
- elite hit of 4 consumes up to 4 armor, then remainder hits troops;
- armor persists until consumed or run ends.

## 15.3 Invulnerability / duplicate collision protection

A single enemy/contact event must not apply damage multiple times due to overlapping frames.

Enemy is removed/marked resolved immediately after contact.

## 15.4 Game over condition

If effective troops reach `0`:

- stop gameplay simulation;
- transition to `GAME_OVER`;
- record run results;
- update best score if appropriate.

---

# 16. Between-wave upgrades

After defeating bosses on Waves 1–5, show a three-card upgrade choice.

## 16.1 Choice rules

- exactly 3 choices;
- choices are unique within that selection;
- player selects exactly 1;
- choice applies immediately;
- next wave begins only after selection.

## 16.2 Canonical upgrade pool

### Reinforcements

`+12 troops`

### Damage

Increase damage by `+1` or an equivalent meaningful increment.

### Fire rate

`+20% fire rate`

### Multi-shot

`+1 projectile`, maximum 4.

### Bullet velocity

Approximately `+20% bullet speed`.

### Armor

`+3 armor`.

### Coin bonus

Optional economy choice if coins have a meaningful persistent use. If no persistent coin system exists yet, prioritize combat upgrades instead.

## 16.3 Upgrade stacking

Upgrades stack for the duration of the current run.

Run upgrades reset on Retry/New Run.

## 16.4 Upgrade UI

Upgrade card artwork must remain reusable and text-free.

Runtime renders:

- icon;
- title;
- description;
- stat value;
- button label.

Background gameplay is dimmed and frozen.

---

# 17. Scoring and currency

The game should keep score and currency conceptually separate.

## 17.1 Score

Score measures run performance.

Suggested baseline:

- grunt kill: ~18–20 points;
- elite kill: ~55–60 points;
- boss: large wave-scaled bonus, approximately `1200 + 500 × waveIndex` as a starting point.

Best score persists in `localStorage`.

## 17.2 Coins

Coins are a soft reward currency.

Suggested baseline:

- grunt: ~4 coins;
- elite: ~12 coins;
- boss: meaningful bonus.

If no store/meta economy is implemented, coins may still be displayed as run rewards, but avoid implying purchasable functionality that does not exist.

## 17.3 Gems

Gems are **not required for core v1 gameplay** unless there is a real persistent system that uses them.

Do not show a meaningless large placeholder gem balance merely because an old prototype did.

If gems are retained, document their actual use before exposing them prominently.

---

# 18. Persistent progression

Core BLASTLINE must work without login or backend.

Minimum persistence through `localStorage`:

- best score;
- optional lifetime coins;
- audio/settings preferences.

Run-specific stats reset on a new run.

Future unlocks/upgrades may be added later, but are outside mandatory v1 unless separately specified.

---

# 19. HUD and runtime UI

During active gameplay the HUD should communicate only the information needed for decisions.

Required/strongly recommended:

- troop count;
- wave number/progress;
- pause;
- boss health during boss phase;
- score and/or coins in compact form;
- key combat stat if visually useful.

Avoid cluttering the mobile viewport.

All changing text and numbers are runtime-rendered.

Do not bake them into UI assets.

## 19.1 Boss health

Boss phase should clearly show:

- boss health track;
- current fill;
- boss identity/icon if available.

The health bar must update immediately with damage.

---

# 20. Victory

Victory occurs only after defeating the Wave 6 final boss.

Victory screen should:

- freeze gameplay;
- celebrate with stars/gold/VFX;
- display run score;
- display wave completion;
- display rewards/coins if used;
- display best score when useful;
- provide Play Again and Home/continue-style navigation.

The player must never be sent directly back to Wave 1 after defeating the final boss without a Victory state.

---

# 21. Game Over

Game Over occurs when the squad reaches zero troops.

Game Over screen should:

- freeze gameplay;
- use darker red/charcoal presentation;
- display run score;
- display wave reached;
- display best score;
- show rewards if appropriate;
- provide Retry;
- provide Home.

Retry creates a genuinely clean run state.

No enemies, particles, bosses, gates, bullets, or timers should leak from the previous run.

---

# 22. VFX and gameplay feedback

Important actions need immediate visual feedback.

## 22.1 Shooting

- muzzle flash at actual shooter;
- bright projectile/tracer;
- restrained recoil animation.

## 22.2 Hit

- enemy hit flash;
- impact spark;
- optional small damage particle.

## 22.3 Enemy defeat

- quick defeat animation/fade;
- particles/debris;
- coin/score feedback where appropriate.

## 22.4 Gate crossing

- gate-specific blue/red burst;
- runtime floating value/effect text;
- immediate formation/stat update.

## 22.5 Boss

- stronger hit feedback;
- larger explosion/defeat burst;
- optional restrained screen shake.

## 22.6 Victory

- gold sparkles;
- confetti;
- stars/reward glow.

VFX must reinforce play and should not obscure gate values, enemies, or player steering space.

---

# 23. Audio behavior

Audio is strongly recommended but not mandatory for the first visual integration pass.

When implemented, use lightweight web-friendly audio for:

- player gunfire;
- enemy gunfire;
- impact;
- enemy defeat;
- gate positive;
- gate negative;
- upgrade selected;
- boss arrival;
- boss hit/defeat;
- victory;
- game over;
- UI button actions.

Music may shift intensity for boss phase.

Respect browser autoplay restrictions and provide mute control.

---

# 24. Difficulty philosophy

Difficulty should increase through a combination of:

- shorter spawn intervals;
- more enemies per event;
- higher elite frequency;
- more enemy HP;
- faster enemy approach;
- ranged attacks in later waves;
- stronger bosses;
- denser boss attack patterns.

Avoid scaling every variable so aggressively that upgrades become meaningless.

The player should feel stronger over the run even while the game becomes harder.

A good run should remain winnable through sensible gate choices, steering, and upgrade choices rather than requiring luck-only gate sequences.

---

# 25. Fairness rules

The game must avoid unavoidable punishment.

Do not:

- spawn a red projectile directly on the squad;
- overlap a gate with an unavoidable enemy wall;
- spawn both gate options outside reachable steering range;
- allow both gate triggers at once;
- spawn a boss attack with no visible safe response;
- create unreadable enemy/gate overlap near the player;
- hide important targets behind HUD.

Gate choice should be readable early enough for a reasonable player to steer into the desired side.

---

# 26. Responsive behavior

## 26.1 Mobile

Mobile is the primary experience.

Priorities:

- one-finger steering;
- large touch-safe Play/Pause/Retry controls;
- readable gate values;
- compact HUD;
- no clipping around safe areas;
- squad remains visible above bottom UI/browser chrome.

## 26.2 Desktop

Desktop should preserve the same game rather than becoming a different layout.

Allow:

- keyboard steering;
- pointer steering;
- larger side margins;
- proportionally sized HUD.

Do not stretch mobile art until characters/gates become grotesquely oversized.

---

# 27. Visual gameplay rules

These are identity/readability rules rather than exact pixel demands.

- player faction: blue/navy/cyan accents;
- enemy/danger faction: red/charcoal;
- rewards/special success: gold;
- player characters face forward/up-road, away from viewer;
- enemies face toward player when direction is visible;
- bosses dominate scale;
- gates are large/simple/readable;
- bridge towers and cables remain a major environmental silhouette;
- characters must appear grounded through contact shadows;
- avoid white sticker outlines unless explicitly approved;
- avoid generic cyberpunk portal styling;
- avoid generic web-dashboard UI styling.

The target is the **same aesthetic family** as the reference renders, not impossible literal 3D parity.

---

# 28. Asset/runtime text separation

Reusable production art must not contain dynamic values.

Runtime-render all changing content, including:

- scores;
- troop counts;
- wave numbers;
- gate values/operators;
- boss HP values if shown;
- upgrade titles/descriptions/stats;
- victory/game-over statistics;
- button wording where reusable button shells are used.

This allows the game to remain dynamic and localized/refactorable.

---

# 29. Deterministic test/debug hooks

The game should support deterministic QA without changing normal player behavior.

Recommended debug/test capabilities:

- seed RNG;
- force wave number;
- force gate pair;
- force elite spawn;
- force boss phase;
- set boss HP;
- set troop count;
- force upgrade screen;
- force victory;
- force game over;
- accelerate wave timing.

These hooks are for automated/browser testing and screenshot capture.

They must not visibly appear in normal production UI.

---

# 30. Important edge cases

Implementation must define and test:

### 30.1 Player centered between gates

If player is in neutral gap, no gate applies unless design intentionally snaps to nearest gate. Preferred v1 behavior: no gate effect in true neutral gap.

### 30.2 Gate crossing while enemies overlap

Gate applies once. Enemy contacts resolve independently. Avoid encounter generation that makes the choice visually impossible.

### 30.3 Huge troop counts

Logical troops cap at 999. Visible squad remains compressed to a practical number.

### 30.4 Negative gate

Gate arithmetic cannot reduce below 1 troop.

### 30.5 Multiple bullets hitting same dying enemy

Enemy defeat reward must be granted only once.

### 30.6 Boss death with hostile bullets active

Clear or safely expire boss projectiles before showing upgrade/victory so player cannot die after the boss is already defeated.

### 30.7 Resize during run

Canvas and UI resize without resetting the run or moving player outside bounds.

### 30.8 Pause during boss/projectiles

Everything freezes consistently and resumes from same state.

### 30.9 Retry

Retry resets all transient arrays/timers/status effects and creates a clean seed/run.

### 30.10 Final boss

Final boss defeat always leads to Victory, never upgrade -> Wave 1 loop.

---

# 31. Baseline balancing constants

The following are recommended starting constants. They are tunable after real playtesting.

| System | Baseline |
|---|---:|
| Starting troops | 12 |
| Starting damage | 1 |
| Starting fire rate | 5.5 bursts/sec |
| Starting projectiles | 1 |
| Projectile cap | 4 |
| Logical troop cap | 999 |
| Grunt contact loss | 1 |
| Elite contact loss | 4 |
| Reinforcement upgrade | +12 troops |
| Damage upgrade | +1 damage |
| Fire-rate upgrade | +20% |
| Spread upgrade | +1 projectile |
| Armor upgrade | +3 armor |
| Bullet-speed upgrade | ~+20% |
| Frenzy threshold | 12 charge |
| Frenzy duration | ~4.5 sec |
| Gate positive rate | paired with one harmful choice by default |
| Gate neutral gap | must prevent double trigger |
| Number of waves | 6 |

Codex may tune numeric constants to improve feel, but should document material balance changes in the implementation notes/tests.

---

# 32. Testing requirements

At minimum maintain automated checks for:

- deterministic seeded RNG;
- gate effects and caps;
- unique upgrade selection;
- upgrade effects;
- wave escalation;
- final-wave Victory transition;
- troop-zero Game Over;
- gate cannot double-apply;
- no double kill reward;
- Retry resets transient state.

Also run syntax/tests where available:

```bash
npm test
node --check src/game.js
node --check src/core.mjs
```

Browser validation should cover:

- Home -> Play;
- keyboard steering;
- mouse steering;
- touch/pointer steering;
- auto-fire;
- positive gate;
- negative gate;
- elite encounter;
- enemy damage;
- boss spawn;
- boss defeat;
- upgrade selection;
- next wave;
- pause/resume;
- Game Over;
- Retry;
- final boss;
- Victory;
- mobile resize;
- desktop resize;
- no console errors;
- no missing assets.

---

# 33. Visual validation requirements

The mobile-game reference art is aspirational. Visual QA should ask:

- Does this clearly feel like BLASTLINE?
- Is the suspension bridge identity strong?
- Is the road visibly flat?
- Are blue squad/red enemy roles immediately clear?
- Are gate decisions readable?
- Does the squad feel like it grows?
- Do elites and bosses have obvious hierarchy?
- Is the HUD compact and game-like rather than webpage-like?
- Does combat have enough depth, shadow, light, and VFX to feel polished?
- Does the game remain performant and readable?

Use the reference renders for continuous comparison, but do **not** block completion solely because a lightweight browser renderer cannot perfectly duplicate a native/promo-quality 3D render.

Instead, prioritize the highest-impact similarities:

1. composition/camera;
2. bridge geometry;
3. faction colors;
4. scale relationships;
5. silhouettes;
6. UI hierarchy;
7. lighting/shadows;
8. VFX density;
9. fine surface/material details.

---

# 34. Non-goals for v1

Unless separately requested, BLASTLINE v1 does not require:

- multiplayer;
- accounts/login;
- backend/database;
- real-money purchases;
- online leaderboard;
- large open world;
- complex inventory;
- equipment management;
- deep RPG skill trees;
- 3D engine dependency;
- perfect reproduction of reference-render geometry/materials.

Keep the game focused on the bridge-runner squad-shooter loop.

---

# 35. Definition of Done

BLASTLINE v1 is behaviorally complete when all of the following are true:

- Home screen starts a run reliably.
- Horizontal controls work on touch, mouse, and keyboard.
- Player moves automatically forward through the world illusion.
- Player auto-fires.
- Blue squad grows/shrinks correctly.
- Visible squad compression works for large troop counts.
- Red enemies spawn and approach correctly.
- Elites are mechanically and visually distinct.
- Gate pairs appear, remain readable, and apply exactly one effect.
- Positive/negative gate rules work.
- Waves escalate across six authored stages.
- Boss appears at end of every wave.
- Boss has meaningful combat behavior and boss health UI.
- Waves 1–5 lead to a 3-choice upgrade screen after boss defeat.
- Upgrades persist for the rest of the current run.
- Wave 6 boss defeat leads to Victory.
- Squad reaching zero leads to Game Over.
- Retry starts a clean run.
- Best score persists locally.
- Pause freezes gameplay correctly.
- Mobile and desktop remain playable.
- Road/deck is visibly flat and planar.
- Dynamic values are rendered at runtime, not baked into reusable art.
- Actual browser screenshots are used for current-state visual QA.
- No critical console errors or missing runtime assets remain.

---

# 36. Implementation rule for Codex and future contributors

Before changing a major gameplay system:

1. read this specification;
2. inspect the current implementation;
3. identify where implementation differs from intended behavior;
4. change code/tests toward this specification;
5. run automated tests;
6. run the real game;
7. validate the affected state in browser;
8. update this document only when the **design itself** changes, not merely because implementation was previously different.

Do not silently redefine BLASTLINE by changing code without updating the authoritative specification.
