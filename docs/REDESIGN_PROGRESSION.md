# Blastline Progression Redesign (owner directive 2026-09-19 ~22:42)

Working design doc. Source: Bryan's gameplay critique after the 2x pressure ship.
This doc is the Phase A output: extracted current model, why the meta is solved,
and the target scaling architecture. Constants here are FIRST-PASS - the sim tunes them.

## 1. Current model (extracted from core.mjs / game.js @ 3cd931d)

Player DPS = troops x power x fireRate x projectiles x (1 + critFactor). Every factor is
multiplicative and hard-capped:
- troops: 14 start, +8/tier, cap 240 (shop maxTier 14 affordable + gates)
- power: 1 start, +1/tier, cap 16
- fireRate: 5.2 start, x1.12/tier, cap 16
- projectiles: 1, +1/tier, cap 4 (multishot maxTier 4)
- crit: +5%/tier, cap 35%; pierce cap 4; armor +4 flat, cap 60; lives cap 2
- shop price: baseCost x 1.75^tierCount (exponential cost)
- gates convert capped-surplus stats: rapid-ranks (+16 troops / -12% rate),
  overclock (+22% rate / -3 armor), velocity-trade, glass-cannon, fortify

Enemies:
- grunt 1hp, gunner 1hp, shield 1+2shield, heavy 4hp (cap 5, +1 per 3 log2(wave)),
  demolition 2hp. HP IS FLAT IN WAVE (except heavy's token log step).
- speed: per-type multiplier x min(0.071, 0.048 + log2(w+1)*0.0034). Log, capped.
- count: activeTarget 64 + 17(w-1), cap 220 (the 2x curve; preserved as baseline).
- contact damage: flat per type (1/1/2/3/2), absorbed by armor before troops.
- boss HP: min(14000, (210 + 48w + 85*log2(w+1)) * pressure * escalation) - LINEAR, capped.
- boss invulnTimer 1.1s on every phase change: bullets during the window deal 0.
  This is the "damage delay buffer": burst is capped, only sustained DPS matters,
  and sustained DPS = power x squad -> "max power, grind squad".
- player i-frames 0.35s after a hit.

## 2. Why the meta is solved (Bryan's repro, confirmed by the model)

1. All four DPS multipliers are capped -> a finite max build exists and the doubled
   2x economy reaches it around wave 10-12.
2. Enemy HP flat -> past power 2-3, grunts die in one hit; only enemy COUNT scales,
   and count caps at 220. Threat saturates while the player still grows.
3. Boss linear capped HP (<=14k) vs capped player DPS (~10^4-10^5/s) -> bosses are
   timing formalities; invuln gates only pad duration.
4. Capped stats make gate trades free: surplus rate/armor converts to troops/rate at
   no real cost (exactly the "trade rate for squad, armour for rate" loop).
5. Reserves are pointless: nothing outscales the capped build, so full squad wipe only
   happens early-run -> "if you need reserves, it's already over".

## 3. Target architecture (Bryan's spec, decomposed)

A. SCALING: polynomial player vs exponential enemy; enemies win a well-played run in
   5-10 minutes (waves ~9-18 at ~30-38s/wave). No hard utility maxima.
   - Income: kills scale with activeTarget (linear in wave) + wave bonuses.
     points(t) ~ polynomial.
   - Costs: shop price base x (n+1)^1.6 (polynomial, replacing 1.75^n exponential),
     so tier accumulation tracks income polynomially, not logarithmically.
   - Stat gains: additive or mildly superlinear per tier, uncapped:
     power +1/tier uncapped; troops +8/tier uncapped (render cap stays 24 visible);
     fireRate +0.45 shots/s per tier additive (no asymptote trick, no cap);
     multishot cap raised 4 -> 6 (expensive tiers); crit +4%/tier soft-stacking
     toward 60% asymptote; pierce +1/tier uncapped; armor reworked (see C).
   - Enemy unit HP: hp(w) = max(1, round(base_hp x 1.35^(w-1))): w1=1, w5~3, w9~7,
     w13~22, w17~75. Every stat point stays relevant; one-shotting expires naturally.
   - Enemy contact damage: base x 1.12^(w-1) (rounded). Squad attrition returns as the
     real clock; reserves become meaningful mid-run.
   - Enemy speed: keep per-type variance, add per-spawn jitter +/-18%, raise the wave
     cap slightly (0.048 -> min(0.085, 0.048 + log2(w+1)*0.004)).
   - Boss HP: exponential in boss index: 420 x 1.55^(b-1) x pressure, NO invuln
     windows (see D).

B. META-PROGRESSION (off-run) + OFFLINE RETURN:
   - Persistent profile in localStorage: { salvage, permanent tiers, stats, lastSeen }.
   - Salvage earned per run from score (score/500, floor 1, bonus per boss).
   - Permanent tracks (each polynomial cost, small effects, ~10-20 tiers):
     +1 starting power (every 4 tiers), +4 starting troops/tier, +2% salvage/tier,
     unlock synergy slot, +5% offline cache rate/tier.
   - Offline cache: accrues salvage while away at (base 10/hr x track), capped 8h;
     claimed on the home screen ("Supply cache full"). This is the log-back-in loop.

C. TRAIT REWORK:
   - armor: flat absorb -> "plating": each plate absorbs 1 contact hit then breaks,
     regenerates 1 plate per 20s; plates +2/tier. Turns armor into a pacing resource
     that matters all run instead of trade feedstock. (Sim validates vs flat.)
   - formationDensity ("wide"): make the trade real - tighter formation = fewer lanes
     covered but +6%/tier squad DPS focus; wider = more lane coverage, -4%/tier.
     Currently cosmetic; give it a combat identity or cut it. Sim first.
   - extraLife/reserves: unchanged mechanics, but exponential contact damage makes
     them a real mid-run purchase.

D. BOSS REDESIGN (remove damage-delay buffer; archetypes gate different stats):
   - Delete invulnTimer phase gates. Phase changes remain visual/attack-pattern shifts.
   - Archetypes rotate by boss index (b % 4):
     1. REDLINE JUGGERNAUT - armored hull: non-pierce/non-crit hits deal 40% damage.
        Gates on pierce + crit.
     2. BRIDGE REAPER - fast escorts (sprinter trait), boss strafes lanes; punishes
        low fireRate / low bullet velocity.
     3. IRON MARSHAL - reflect shield: reflects every 5th bullet back at the squad.
        Gates on multishot spread (saturate so reflected volume is survivable) or
        controlled fireRate. Implements Bryan's "reflect 1 bullet" gimmick at boss scale.
     4. SCARLET ENGINE - ranged barrage + demolition escorts; gates on mobility,
        plating, and lane reading.
   - Each boss telegraphs its gate on the intro banner so the build decision is
     informed, not gotcha.

E. ENEMY VARIETY (wave-gated composition additions):
   - sprinter: hp 1 (scales), speed 1.9x, contact 1. Appears w2+.
   - marksman: gunner rework - aimed shots, shot cadence scales with wave pressure.
   - reflector: shield-variant that reflects the FIRST bullet that hits it back at
     the squad, then dies normally. Appears w6+. Bryan's gimmick at field scale.
   - swarmer: splits into 2 grunts on death. Appears w8+.
   - Composition weights shift from grunt-heavy to mixed over waves (existing table
     extended, not replaced).

F. SYNERGIES (explicit, surfaced in armory copy):
   - Ricochet (new upgrade, +1 bounce/tier, cap 3): bullet bounces to nearest enemy
     within 0.35 lane-units at 60% damage. x multishot: each projectile bounces
     independently (Bryan's example). x pierce: pierce consumes before bounce.
     x crit: crit rolls per bounce.
   - Overclock synergy: fireRate tiers above 10 grant +2% crit per tier (cross-stat
     reason to keep pushing rate).
   - Synergy text derived from owned tiers in the armory UI.

## 4. Validation gates before ship

1. Sim v2 (extend tools/balance): strategy bots - BryansSolvedMeta, GlassCannon,
   SquadGrinder, CritPierce, Balanced, RandomX5. PASS = no bot beats the field by
   >15% median survival; >=3 archetypes within 20% band.
2. Sim median veteran run ends waves 9-18 (5-10 min); elite earlier, recruit later.
3. Dominant-strategy hunter: 200 random-policy runs; no single purchase order wins
   >30% of head-to-heads.
4. Human-rate touch playthrough: attrition curve felt; mid-run reserve use happens.
5. Perf: p95 <= 16.8ms at 220 enemies + bounces (projectile count ~doubles - watch
   MAX arrays), heap flat over 300s soak.
6. Full unit suite + npm run validate green; armory/gates/boss UI verified both
   viewports; localStorage migration from v1 saves handled (fresh key, no clash).

## 5. Implementation order (branch redesign/progression)

1. core scaling v2 + tests (enemy hp/contact exponential, price polynomial, uncaps)
2. sim v2 + strategy bots -> tune constants to gates 1-3
3. enemy archetypes + reflector projectile path
4. boss archetypes + remove invuln gates
5. ricochet + synergy layer
6. plating + formation-density rework
7. meta-progression store + offline cache + home UI
8. playtests, perf, validation, ship

## 6. Phase A sim results (2026-09-19, src/balance2.mjs)

v1-live reproduction (30 seeds x 3 difficulties): every sensible policy bot is
IMMORTAL (40/40 waves) on recruit and veteran; even the negligent weak bot
survives veteran. Bosses die in 3-8s for every build (no invuln gate needed to
see it - linear capped HP vs multiplicative DPS). This is the quantitative proof
of Bryan's diagnosis: the threat model saturates, the build caps, nothing ends runs.

v2 first-pass: attrition now ends low-offense builds (squadGrinder w19-21,
plated w24-31, weak w5) but pure-offense builds stay immortal. Root cause found:
the DPS formula multiplies FOUR independently-growing axes (troops x power x rate
x projectiles) so player damage grows ~w^2.5+ while income saturates at the 220
enemy cap - no moderate enemy exponent crosses it inside the 5-10 min window.

Tuning levers for Phase B (next):
1. Damp the multiplicative axes instead of capping them: multishot +1 projectile
   at -12% per-bullet damage (spread/coverage choice, not x6 damage); power cost
   (n+1)^2; rate +0.4/tier additive cost (n+1)^1.8; troops cost (n+1)^1.7.
   Player dps -> ~w^1.6-2.0 (polynomial, per the directive).
2. Enemy hp exponent ~1.42-1.5 (tune to crossover: veteran good-build death
   w12-18, weak w5-7, elite 2-3 waves earlier, recruit 2-3 later).
3. Contact damage 1.15^(w-1): even DPS-competitive builds get ground down once
   leaks begin - the collapse is fast once it starts (matches "enemies win").
4. Boss archetype gates must actually gate: bryansMeta ignored the Juggernaut
   gate (.4 multiplier on a huge DPS). Gates need teeth - e.g. Juggernaut takes
   15% from non-pierce/crit hits, plus boss contact pressure during long fights.

Sim anchors from real play (v1): human-rate touch run died ~wave 11 (neutral
build), superhuman probe reached 14 at the cap, Bryan's skilled play found the
game solved by wave 9. v2 targets: median veteran 12-16 for focused builds with
correct counters, 5-10 min wall-clock per run.

## 7. LOCKED v2 sim constants (Phase B baseline, 2026-09-19 ~22:48)

Sim matrix (30 seeds): veteran focused builds die median waves 11-14 (~6-8.5 min),
recruit 12-16, elite 10-14, weak 5. No immortals, no bot >25% over field median,
4+ archetypes viable. Difficulty ordering correct. This is the shape Bryan specified.
(Real variance will exceed sim variance - actual dodging, gate picks, boss counters.)

Locked constants for core v2 implementation:
- enemyHp(type, w) = max(1, round(base_hp x 1.5^(w-1))); base: grunt/gunner 1,
  shield 3 (1+2), heavy 4, demolition 2
- contact(type, w) = max(1, round(base x 1.16^(w-1)))
- bossHp(b) = (b==1 ? 320 : 420) x 1.55^(b-1) x (0.92 + pressure x 0.08); NO invuln windows
- boss gates: juggernaut min(1, .35 + pierce x .14 + crit x 1.4);
  reaper min(1, .3 + fireRate/45 + bulletSpeed/14);
  marshal min(1, .5 + projectiles x .09); engine min(1, .5 + plating x .04)
- shop price = baseCost x (n+1)^exp; exp: damage 2.0, fireRate 1.8,
  reinforcements 1.7, piercing 1.9, all others 1.7
- power +1/tier UNCAPPED; fireRate +0.4/tier additive UNCAPPED;
  troops +8/tier uncapped (visual cap unchanged)
- multishot: projectiles to 6; per-bullet damage x 0.88^(projectiles-1)
- crit +3%/tier, cap 50%, crit multiplier 1 + crit x 1.0
- pierce damage multiplier bounded at x2.0
- kill reward: 13/density points + streak bonus every 20 (density-normalized income)
- reserves: max 2 per run total (finite, meaningful mid-run)
- plating: each plate absorbs one hit's contact damage, breaks, regens 1 per 20s,
  +2 plates/tier, cap 40

Key sim bugs fixed during calibration (for the record): per-troop DPS divisor
(units), ranged chip scaling with total spawns instead of alive gunners, and a
perpetual-reserves loophole (rebuying lives every wave) that made any solvent
build immortal - the last one is worth a real-game audit: v1 shop also lets you
rebuy reserves as long as points allow, capped only by MAX_LIVES=2 concurrent.

## 8. Feel constraint: the melt must be seen (Bryan, 2026-09-19 23:06)

"Enjoyment comes from seeing your enemies get melted. You don't get that same enjoyment when the enemies melt before you can see them."

- ENGAGEMENT_Y = 0.04 (core.mjs): bullets cannot damage enemies or bosses below this world-y. Enemies crest the horizon, form a visible mass, then die on the field. Ricochet retargeting also skips unengaged enemies.
- Not solved by off-screen deaths, spawn deletion, or sponge hp: hp unchanged; the gate is a pipeline delay, modeled in the sim as a small DPS-uptime shadow (max 10%).
- Kill payoff: per-archetype death bursts, corpse life .18->.24 / .28->.36s.
- Runtime checks: run.killViz aggregates (kills, onScreen, visible-life min/mean/max, 240-sample buffer) exposed via getState; probes assert ~100% on-screen kills and readable visible lifetimes.
- Measured (veteran natural, 2026-09-19): 100% on-screen kills through wave 6+, mean visible life ~1.5s at wave 2 and ~2.7s at wave 6; screenshots show the horde cresting and thinning on the field.
