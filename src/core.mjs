export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, amount) => a + (b - a) * amount;
export const format = value => Math.round(value).toLocaleString();

export function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export const GAME_STATE = Object.freeze({
  HOME: 'home',
  PLAYING: 'playing',
  BOSS: 'boss',
  ARMORY: 'armory',
  BOSS_REWARD: 'armory',
  PAUSED: 'paused',
  PAUSED_SHOP: 'paused-shop',
  RECOVERY: 'recovery',
  GAME_OVER: 'game-over',
});

export const ACTIVE_STATES = Object.freeze([
  GAME_STATE.PLAYING,
  GAME_STATE.BOSS,
  GAME_STATE.RECOVERY,
]);

export const DIFFICULTIES = Object.freeze({
  recruit: Object.freeze({
    id: 'recruit', label: 'Recruit', tagline: 'Room to recover',
    density: 0.5, pressure: 0.78, cadence: 0.76, recoveryTroops: 16,
  }),
  veteran: Object.freeze({
    id: 'veteran', label: 'Veteran', tagline: 'The intended fight',
    density: 1, pressure: 1, cadence: 1, recoveryTroops: 13,
  }),
  elite: Object.freeze({
    id: 'elite', label: 'Elite', tagline: 'No wasted movement',
    density: 1.25, pressure: 1.25, cadence: 1.2, recoveryTroops: 10,
  }),
});

export function normalizeDifficulty(value) {
  return DIFFICULTIES[value] ? value : 'veteran';
}

export const LANE_CENTERS = Object.freeze([-0.58, 0, 0.58]);
export const LANE_HALF_WIDTH = 0.255;
export const LANE_LIMIT = 0.86;

export function laneCenter(lane) {
  return LANE_CENTERS[clamp(Math.round(Number(lane) || 0), 0, LANE_CENTERS.length - 1)];
}

export function laneBounds(lane, inset = 0) {
  const center = laneCenter(lane);
  const half = Math.max(0, LANE_HALF_WIDTH - Math.max(0, inset));
  return { min: center - half, max: center + half, center };
}

export function laneContains(lane, x, radius = 0) {
  const bounds = laneBounds(lane, radius);
  return x >= bounds.min && x <= bounds.max;
}

export function nearestLane(x) {
  let closest = 0;
  for (let lane = 1; lane < LANE_CENTERS.length; lane += 1) {
    if (Math.abs(x - LANE_CENTERS[lane]) < Math.abs(x - LANE_CENTERS[closest])) closest = lane;
  }
  return closest;
}

export function clampToLane(x, lane, padding = 0.02) {
  const bounds = laneBounds(lane, padding);
  return clamp(Number(x) || bounds.center, bounds.min, bounds.max);
}

export const MAX_TROOPS = 9_999; // safety rail, not a design cap (v2: polynomial growth)
export const MAX_VISIBLE_SQUAD = 24;
export const MAX_PROJECTILES = 6;
export const MAX_FIRE_RATE = 40; // safety rail, not a design cap (v2: +0.4/tier additive)
export const ENGAGEMENT_Y = 0.04; // horizon gate: enemies take no bullet damage until this far onto the visible field - kills must be seen (Bryan 2026-09-19)
export const BOSS_ENGAGEMENT_Y = 0.5; // bosses must be fully visible below the HUD (both viewports) before they can take damage
export const MAX_PIERCE = 4;
export const MAX_LIVES = 2;
export const MAX_ACTIVE_ENEMIES = 220;

export const ENEMY_BASE_STATS = Object.freeze({
  grunt: Object.freeze({ hp: 1, contact: 1 }),
  gunner: Object.freeze({ hp: 1, contact: 1 }),
  shield: Object.freeze({ hp: 3, contact: 2 }),
  heavy: Object.freeze({ hp: 4, contact: 3 }),
  demolition: Object.freeze({ hp: 2, contact: 2 }),
  sprinter: Object.freeze({ hp: 1, contact: 1 }),
  reflector: Object.freeze({ hp: 3, contact: 2 }),
  swarmer: Object.freeze({ hp: 2, contact: 1 }),
});

// v2: exponential enemy scaling (owner directive 2026-09-19) - enemies always
// outgrow polynomial player scaling; a well-played veteran run ends ~waves 11-14.
export function enemyHitPoints(type, wave = 1) {
  const base = (ENEMY_BASE_STATS[type] || ENEMY_BASE_STATS.grunt).hp;
  const w = clamp(Math.floor(Number.isFinite(wave) ? wave : 1), 1, 1_000_000);
  return Math.max(1, Math.round(base * Math.pow(1.5, w - 1)));
}

export function enemyContactDamage(type, wave = 1) {
  const base = (ENEMY_BASE_STATS[type] || ENEMY_BASE_STATS.grunt).contact;
  const w = clamp(Math.floor(Number.isFinite(wave) ? wave : 1), 1, 1_000_000);
  return Math.max(1, Math.round(base * Math.pow(1.16, w - 1)));
}

// v2: multishot adds coverage, not raw multiplication - each extra projectile
// reduces per-bullet damage.
export function projectileDamageFactor(projectiles = 1) {
  const count = clamp(Math.round(Number.isFinite(projectiles) ? projectiles : 1), 1, MAX_PROJECTILES);
  return Math.pow(0.88, count - 1);
}

// v2: plating - each plate absorbs up to PLATE_CAPACITY damage then breaks.
export const PLATE_CAPACITY = 4;
export const PLATE_REGEN_SECONDS = 20;
export const MAX_PLATES = 40;

export function getWaveConfig(waveIndex = 1, difficulty = 'veteran') {
  const wave = clamp(Math.floor(Number.isFinite(waveIndex) ? waveIndex : 1), 1, 1_000_000);
  const mode = DIFFICULTIES[normalizeDifficulty(difficulty)];
  const logScale = Math.log2(wave + 1);
  const duration = Math.min(38, 26 + (wave - 1) * 0.65);
  const activeTarget = Math.min(
    MAX_ACTIVE_ENEMIES,
    Math.round((64 + (wave - 1) * 17) * mode.density),
  );
  const hordeSize = Math.min(84, Math.max(36, Math.round((44 + wave * 2.2) * mode.density)));
  const spawnInterval = Math.max(0.5, (2.3 - logScale * 0.28) / mode.cadence);
  const enemySpeed = Math.min(0.085, 0.048 + logScale * 0.004) * (0.97 + (mode.pressure - 1) * 0.12);
  const bossIndex = Math.max(1, Math.round(wave / 3));
  const bossHp = Math.round(Math.min(1e12, (bossIndex === 1 ? 320 : 420) * Math.pow(1.55, Math.min(60, bossIndex - 1)) * (0.92 + mode.pressure * 0.08)));
  const composition = {
    grunt: Math.max(0.38, 0.82 - logScale * 0.055),
    gunner: Math.min(0.2, Math.max(0, (wave - 1) * 0.014)),
    shield: Math.min(0.18, Math.max(0, (wave - 2) * 0.012)),
    heavy: Math.min(0.16, Math.max(0, (wave - 3) * 0.011)),
    demolition: Math.min(0.12, Math.max(0, (wave - 4) * 0.009)),
    sprinter: Math.min(0.16, Math.max(0, (wave - 1) * 0.016)),
    reflector: Math.min(0.1, Math.max(0, (wave - 5) * 0.008)),
    swarmer: Math.min(0.12, Math.max(0, (wave - 7) * 0.01)),
  };
  const total = Object.values(composition).reduce((sum, value) => sum + value, 0);
  for (const key of Object.keys(composition)) composition[key] /= total;
  return Object.freeze({
    wave,
    difficulty: mode.id,
    duration,
    activeTarget,
    activeCap: MAX_ACTIVE_ENEMIES,
    hordeSize,
    spawnInterval,
    enemySpeed,
    bossHp,
    bossPhaseCount: 3,
    bossCadence: Math.max(0.62, 1.48 / mode.cadence - logScale * 0.035),
    pressure: mode.pressure,
    bossReward: 700 + wave * 90,
    composition: Object.freeze(composition),
  });
}

export const SHOP_CATALOG = Object.freeze([
  { id: 'reinforcements', title: 'Squad', short: '+8 squad', baseCost: 240, maxTier: 99, tone: 'cyan', asset: 'assets/blastline/ui/upgrade-troops.webp', synergy: 'More rifles on the line', info: "Adds 8 soldiers to the firing line. Every soldier fires every volley, so a bigger squad multiplies your total output. Scales: +8 squad per tier, no tier cap - the point cost rises with each purchase. Fallen soldiers only come back through this upgrade or squad gates." },
  { id: 'damage', title: 'Damage', short: '+1 power', baseCost: 320, maxTier: 98, tone: 'gold', asset: 'assets/blastline/ui/upgrade-power.webp', synergy: 'Breaks armored targets', info: "+1 power on every hit. Each round your squad fires lands harder - the most direct answer to armored enemies and bosses. Scales: +1 power per tier, no tier cap - the point cost rises with each purchase." },
  { id: 'fireRate', title: 'Fire Rate', short: '+0.4 cadence', baseCost: 300, maxTier: 9, tone: 'green', asset: 'assets/blastline/ui/upgrade-rate.webp', synergy: 'Builds pressure faster', info: "+0.4 volleys per second. Same bullets, delivered faster - and because you land more hits per second, Frenzy charges faster too. Scales: +0.4 cadence per tier, up to 9 tiers." },
  { id: 'multishot', title: 'Multishot', short: '+1 round, softer hits', baseCost: 720, maxTier: 5, tone: 'purple', asset: 'assets/blastline/ui/upgrade-spread.webp', synergy: 'Covers more lanes; each extra round trades 12% damage', info: "+1 round per soldier in every volley, but each round hits 12% softer. Covers more lanes at once and shreds crowds. Scales: +1 round per tier, up to 5 tiers. Tradeoff: total damage climbs, but single-target punch per bullet drops." },
  { id: 'armor', title: 'Plating', short: '+2 plates', baseCost: 260, maxTier: 19, tone: 'steel', asset: 'assets/blastline/ui/upgrade-armor.webp', synergy: 'Each plate absorbs one hit, then regenerates', info: "+2 armor plates. Each plate absorbs one enemy hit before a soldier falls, and broken plates regenerate one at a time during the run. Scales: +2 plates per tier, up to 19 tiers." },
  { id: 'extraLife', title: 'Reserve', short: '+1 reserve', baseCost: 950, maxTier: MAX_LIVES, tone: 'red', asset: 'assets/blastline/ui/upgrade-armor.webp', synergy: 'Redeploys the squad', info: "+1 reserve. When the squad wipes out, a reserve redeploys the line instead of ending the run. Scales: +1 reserve per tier, up to the reserves cap shown on the card." },
  { id: 'piercing', title: 'Pierce', short: '+1 pierce', baseCost: 540, maxTier: 24, tone: 'purple', asset: 'assets/blastline/ui/upgrade-spread.webp', synergy: 'Rounds carry through formations', info: "+1 pierce. Rounds punch through one more enemy before stopping, carving through packed formations instead of stopping at the front rank. Scales: +1 pierce per tier, no tier cap - the point cost rises with each purchase." },
  { id: 'criticalChance', title: 'Critical', short: '+3% crit', baseCost: 380, maxTier: 17, tone: 'gold', asset: 'assets/blastline/ui/upgrade-power.webp', synergy: 'Heavy hits land harder', info: "+3% chance for any hit to crit. Critical hits deal double damage. Scales: +3% per tier, up to 17 tiers - crit chance is capped at 50% overall." },
  { id: 'projectileSpeed', title: 'Velocity', short: '+15% velocity', baseCost: 300, maxTier: 7, tone: 'green', asset: 'assets/blastline/ui/upgrade-rate.webp', synergy: 'Rounds arrive sooner', info: "+15% bullet velocity. Rounds cross the bridge sooner, so less fire is wasted on enemies that are already dead and hits land earlier. Scales: +15% per tier, up to 7 tiers." },
  { id: 'ricochet', title: 'Ricochet', short: '+1 bounce', baseCost: 460, maxTier: 3, tone: 'cyan', asset: 'assets/blastline/ui/upgrade-spread.webp', synergy: 'Hits bounce to a nearby target at 60% damage - every multishot round bounces on its own', info: "+1 bounce. After a hit, the round jumps to a nearby enemy at 60% damage - and every Multishot round bounces on its own. Scales: +1 bounce per tier, up to 3 tiers." },
]);

export const UNCAPPED_UPGRADES = Object.freeze(['reinforcements', 'damage', 'fireRate', 'piercing', 'projectileSpeed']);

export const SHOP_BY_ID = Object.freeze(Object.fromEntries(SHOP_CATALOG.map(item => [item.id, item])));

export function initialPlayer() {
  return {
    x: 0,
    targetX: 0,
    troops: 14,
    power: 1,
    fireRate: 5.2,
    projectiles: 1,
    bulletSpeed: 1,
    pierce: 0,
    criticalChance: 0,
    armor: 0,
    plates: 2,
    platesMax: 2,
    ricochet: 0,
    formationDensity: 0,
    frenzyDuration: 4.2,
    recovery: 0,
    speed: 2.05,
    protectedFor: 0,
  };
}

export function upgradeTier(session, id) {
  return Math.max(0, Math.floor(session?.upgradeTiers?.[id] || session?.purchaseCounts?.[id] || 0));
}

export function isUpgradeCapped(session, id) {
  const item = SHOP_BY_ID[id];
  if (!item) return true;
  if (id === 'extraLife') return (session?.lives || 0) >= MAX_LIVES;
  if (id === 'multishot') return upgradeTier(session, id) >= MAX_PROJECTILES - 1;
  if (id === 'criticalChance') return upgradeTier(session, id) >= 17; // 0.03 x 17 = 0.51 > 0.5 cap
  if (id === 'armor') return (session?.player?.platesMax ?? 0) >= MAX_PLATES;
  if (id === 'ricochet') return upgradeTier(session, id) >= 3;
  return false; // v2: power, fireRate, troops, pierce, velocity grow polynomially, uncapped
}

export const SHOP_PRICE_EXPONENTS = Object.freeze({
  damage: 2, fireRate: 1.8, reinforcements: 1.35, piercing: 1.9,
});

export function shopPrice(id, purchaseCount = 0) {
  const item = SHOP_BY_ID[id];
  if (!item) return Infinity;
  const exponent = SHOP_PRICE_EXPONENTS[id] || 1.7;
  return Math.max(1, Math.round(item.baseCost * Math.pow(Math.max(0, purchaseCount) + 1, exponent)));
}

export function applyUpgrade(player, id) {
  const next = { ...player };
  if (id === 'reinforcements') next.troops = Math.min(MAX_TROOPS, next.troops + 8);
  else if (id === 'damage') next.power = Math.min(99, next.power + 1); // uncapped by design; rail only
  else if (id === 'fireRate') next.fireRate = Math.min(MAX_FIRE_RATE, next.fireRate + 0.4);
  else if (id === 'projectileSpeed') next.bulletSpeed = Math.min(2.4, next.bulletSpeed * 1.15);
  else if (id === 'multishot') next.projectiles = Math.min(MAX_PROJECTILES, next.projectiles + 1);
  else if (id === 'piercing') next.pierce = Math.min(24, next.pierce + 1); // rail only
  else if (id === 'criticalChance') next.criticalChance = Math.min(0.5, next.criticalChance + 0.03);
  else if (id === 'armor') {
    next.plates = Math.min(MAX_PLATES, (next.plates ?? next.armor ?? 0) + 2);
    next.platesMax = Math.min(MAX_PLATES, (next.platesMax ?? 2) + 2);
  }
  else if (id === 'ricochet') next.ricochet = Math.min(3, (next.ricochet || 0) + 1);
  else if (id === 'formationDensity') next.formationDensity = Math.min(6, next.formationDensity + 1);
  else if (id === 'frenzyDuration') next.frenzyDuration = Math.min(10, next.frenzyDuration + 0.8);
  else if (id === 'recovery') next.recovery = Math.min(6, next.recovery + 1);
  return next;
}

export function purchaseUpgrade(session, id) {
  const item = SHOP_BY_ID[id];
  if (!item) return { session, ok: false, reason: 'unknown' };
  if (isUpgradeCapped(session, id)) return { session, ok: false, reason: 'capped' };
  const count = Math.max(0, session.purchaseCounts?.[id] || 0);
  const availablePoints = Number.isFinite(session.points) ? session.points : (session.skillPoints || 0);
  const cost = shopPrice(id, count);
  if (availablePoints < cost) return { session, ok: false, reason: 'insufficient', cost };
  const purchaseCounts = { ...(session.purchaseCounts || {}), [id]: count + 1 };
  const upgradeTiers = { ...(session.upgradeTiers || {}), [id]: upgradeTier(session, id) + 1 };
  const next = {
    ...session,
    points: availablePoints - cost,
    purchaseCounts,
    upgradeTiers,
  };
  if (id === 'extraLife') next.lives = Math.min(MAX_LIVES, (session.lives || 0) + 1);
  else next.player = applyUpgrade(session.player, id);
  return { session: next, ok: true, reason: 'purchased', cost };
}

export const GATE_LIBRARY = Object.freeze([
  { id: 'ranks', title: '+10', subtitle: 'SQUAD', tone: 'blue', effects: [{ stat: 'troops', mode: 'add', value: 10 }] },
  { id: 'loss', title: '−6', subtitle: 'SQUAD', tone: 'red', effects: [{ stat: 'troops', mode: 'add', value: -6 }] },
  { id: 'rapid-ranks', title: '+16 / −12%', subtitle: 'SQUAD / RATE', tone: 'cyan', effects: [{ stat: 'troops', mode: 'add', value: 16 }, { stat: 'fireRate', mode: 'multiply', value: 0.88 }] },
  { id: 'glass-cannon', title: '+1 / WIDE', subtitle: 'POWER / FORM', tone: 'gold', effects: [{ stat: 'power', mode: 'add', value: 1 }, { stat: 'formationDensity', mode: 'add', value: -1 }] },
  { id: 'fortify', title: '+6 / −2', subtitle: 'ARMOR / SQUAD', tone: 'steel', effects: [{ stat: 'armor', mode: 'add', value: 6 }, { stat: 'troops', mode: 'add', value: -2 }] },
  { id: 'overclock', title: '+22% / −3', subtitle: 'RATE / ARMOR', tone: 'purple', effects: [{ stat: 'fireRate', mode: 'multiply', value: 1.22 }, { stat: 'armor', mode: 'add', value: -3 }] },
  { id: 'velocity-trade', title: '+25% / −4', subtitle: 'SPEED / SQUAD', tone: 'cyan', effects: [{ stat: 'bulletSpeed', mode: 'multiply', value: 1.25 }, { stat: 'troops', mode: 'add', value: -4 }] },
]);

export function applyGate(player, gate) {
  const next = { ...player };
  const effects = gate.effects || legacyGateEffects(gate);
  for (const effect of effects) {
    const current = Number(next[effect.stat]) || 0;
    next[effect.stat] = effect.mode === 'multiply' ? current * effect.value : current + effect.value;
  }
  next.troops = clamp(Math.round(next.troops), 1, MAX_TROOPS);
  next.power = clamp(next.power, 1, 99);
  next.fireRate = clamp(next.fireRate, 1.5, MAX_FIRE_RATE);
  next.bulletSpeed = clamp(next.bulletSpeed, 0.65, 2.4);
  next.armor = clamp(Math.round(next.armor), 0, MAX_PLATES);
  next.plates = clamp(Math.round(next.plates ?? next.armor), 0, MAX_PLATES);
  next.formationDensity = clamp(Math.round(next.formationDensity), 0, 6);
  return next;
}

function legacyGateEffects(gate) {
  if (gate.kind === 'troops') return [{ stat: 'troops', mode: 'add', value: gate.value }];
  if (gate.kind === 'troopsMul') return [{ stat: 'troops', mode: 'multiply', value: gate.value }];
  if (gate.kind === 'power') return [{ stat: 'power', mode: 'add', value: gate.value }];
  if (gate.kind === 'rate') return [{ stat: 'fireRate', mode: 'multiply', value: 1 + gate.value }];
  if (gate.kind === 'slow') return [{ stat: 'fireRate', mode: 'multiply', value: 1 - gate.value }];
  return [];
}

export function makeGatePair(rng, waveIndex = 1) {
  if (waveIndex <= 1) return [GATE_LIBRARY[0], GATE_LIBRARY[1]].map(item => ({ ...item, effects: item.effects.map(effect => ({ ...effect })) }));
  const tradeoffs = GATE_LIBRARY.slice(2);
  const first = Math.floor(rng() * tradeoffs.length);
  let second = Math.floor(rng() * (tradeoffs.length - 1));
  if (second >= first) second += 1;
  return [tradeoffs[first], tradeoffs[second]].map(item => ({ ...item, effects: item.effects.map(effect => ({ ...effect })) }));
}

export function makeGateEncounter(id, options, y = -0.06, rng = () => 0.5) {
  const neutralLane = clamp(Math.floor(rng() * 3), 0, 2);
  const occupied = [0, 1, 2].filter(lane => lane !== neutralLane);
  if (rng() < 0.5) occupied.reverse();
  return {
    id,
    y,
    resolved: false,
    selected: null,
    neutralLane,
    gates: options.slice(0, 2).map((gate, index) => ({
      ...gate,
      lane: occupied[index],
      x: laneCenter(occupied[index]),
      w: LANE_HALF_WIDTH * 2,
    })),
  };
}

export function resolveGateEncounter(encounter, playerX) {
  if (encounter.resolved) return { encounter, gate: null };
  const gate = encounter.gates.find(option => laneContains(option.lane, playerX)) || null;
  return {
    encounter: { ...encounter, resolved: true, selected: gate?.id || gate?.kind || null },
    gate,
  };
}

export function gateText(gate) {
  if (gate.title) return gate.title;
  if (typeof gate.label === 'function') return gate.label(gate.value);
  return String(gate.value ?? '');
}

export function pickBossRewards(rng, session) {
  const available = SHOP_CATALOG.filter(item => !isUpgradeCapped(session, item.id));
  const source = available.length >= 3 ? available : SHOP_CATALOG.filter(item => item.id !== 'extraLife' || (session?.lives || 0) < MAX_LIVES);
  const choices = [];
  const pool = [...source];
  while (choices.length < 3 && pool.length) {
    const item = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const tier = Math.min(item.maxTier, upgradeTier(session, item.id) + 1);
    choices.push({ ...item, tier, tierLabel: `TIER ${tier}`, description: item.short });
  }
  return choices;
}

export const pickUpgradeSet = (rng, session = createCleanRun(0)) => pickBossRewards(rng, session);

export function applyBossReward(session, id) {
  const item = SHOP_BY_ID[id];
  if (!item || isUpgradeCapped(session, id)) return session;
  const next = {
    ...session,
    upgradeTiers: { ...(session.upgradeTiers || {}), [id]: upgradeTier(session, id) + 1 },
  };
  if (id === 'extraLife') next.lives = Math.min(MAX_LIVES, (session.lives || 0) + 1);
  else next.player = applyUpgrade(session.player, id);
  return next;
}

export function visibleSquadCount(troops, formationDensity = 0) {
  const count = Math.max(1, Math.round(Number.isFinite(troops) ? troops : 1));
  const cap = Math.min(MAX_VISIBLE_SQUAD, 60 + Math.max(0, formationDensity) * 2);
  return Math.min(count, cap);
}

export function squadColumnCount(visibleCount, formationDensity = 0) {
  const count = Math.max(1, Math.round(visibleCount));
  const compactBonus = Math.max(0, Math.floor(formationDensity / 2));
  if (count <= 3) return count;
  if (count <= 8) return 4;
  if (count <= 18) return 6 + compactBonus;
  if (count <= 36) return 8 + compactBonus;
  return 10 + compactBonus;
}

export function applyTroopDamage(player, amount) {
  const next = { ...player };
  if (next.protectedFor > 0) return { player: next, absorbed: 0, lost: 0, protected: true };
  const incoming = Math.max(0, Math.round(amount));
  const platesAvailable = Math.max(0, Math.round(next.plates ?? next.armor ?? 0));
  const plateAbsorb = Math.min(incoming, platesAvailable * PLATE_CAPACITY);
  const platesUsed = Math.ceil(plateAbsorb / PLATE_CAPACITY);
  next.plates = platesAvailable - platesUsed;
  next.armor = next.plates; // legacy alias, removed with the render integration
  const remaining = incoming - plateAbsorb;
  next.troops = Math.max(0, next.troops - remaining);
  return { player: next, absorbed: plateAbsorb, lost: remaining, protected: false };
}

export function stateAfterTroopDamage(player, activeState, lives = 0) {
  if (player.troops > 0 || !ACTIVE_STATES.includes(activeState)) return activeState;
  return lives > 0 ? GAME_STATE.RECOVERY : GAME_STATE.GAME_OVER;
}

export function stateAfterBossDefeat() {
  return GAME_STATE.BOSS_REWARD;
}

export function enemyReward(type, killCount = 0, density = 1) {
  const table = {
    grunt: { points: 13, frenzy: 1 },
    gunner: { points: 19, frenzy: 1 },
    shield: { points: 26, frenzy: 2 },
    heavy: { points: 39, frenzy: 3 },
    demolition: { points: 49, frenzy: 3 },
    sprinter: { points: 15, frenzy: 1 },
    reflector: { points: 30, frenzy: 2 },
    swarmer: { points: 16, frenzy: 1 },
  };
  const reward = { ...(table[type] || table.grunt) };
  reward.points = Math.max(1, Math.round(reward.points / Math.max(0.25, density)));
  if (killCount > 0 && killCount % 20 === 0) reward.points += 40;
  return reward;
}

export function claimKillReward(enemy, killCount = 0, density = 1) {
  if (enemy.rewarded) return { enemy, reward: null };
  return { enemy: { ...enemy, rewarded: true }, reward: enemyReward(enemy.type, killCount, density) };
}

export function reviveSession(session) {
  if ((session.lives || 0) <= 0) return { session, revived: false };
  const mode = DIFFICULTIES[normalizeDifficulty(session.difficulty)];
  const troops = Math.min(MAX_TROOPS, mode.recoveryTroops + (session.player.recovery || 0) * 3);
  return {
    revived: true,
    session: {
      ...session,
      lives: session.lives - 1,
      phase: GAME_STATE.RECOVERY,
      player: { ...session.player, troops, protectedFor: 3 },
      recoveryTime: 3,
    },
  };
}

export function createCleanRun(seed = 0, difficulty = 'veteran') {
  const mode = normalizeDifficulty(difficulty);
  return {
    seed: seed >>> 0,
    difficulty: mode,
    wave: 1,
    waveIndex: 0,
    phase: GAME_STATE.PLAYING,
    state: GAME_STATE.PLAYING,
    resumeState: null,
    player: initialPlayer(),
    points: 0,
    score: 0,
    skillPoints: 0,
    bossesDefeated: 0,
    lives: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    purchaseCounts: {},
    upgradeTiers: {},
    recoveryTime: 0,
    frenzy: 0,
    frenzyTimer: 0,
    compact: 0,
    waveTime: 0,
    bossTime: 0,
    spawnTimer: 0.4,
    gateTimer: 3.2,
    enemiesSpawned: 0,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    gates: [],
    hazards: [],
    particles: [],
    floaters: [],
    muzzleFlashes: [],
    boss: null,
    telegraphs: [],
  };
}
