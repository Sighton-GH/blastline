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
    density: 0.72, pressure: 0.78, cadence: 0.76, recoveryTroops: 16,
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

export const MAX_TROOPS = 240;
export const MAX_VISIBLE_SQUAD = 24;
export const MAX_PROJECTILES = 4;
export const MAX_FIRE_RATE = 16;
export const MAX_PIERCE = 4;
export const MAX_LIVES = 2;
export const MAX_ACTIVE_ENEMIES = 220;

export function getWaveConfig(waveIndex = 1, difficulty = 'veteran') {
  const wave = clamp(Math.floor(Number.isFinite(waveIndex) ? waveIndex : 1), 1, 1_000_000);
  const mode = DIFFICULTIES[normalizeDifficulty(difficulty)];
  const logScale = Math.log2(wave + 1);
  const duration = Math.min(38, 26 + (wave - 1) * 0.65);
  const activeTarget = Math.min(
    MAX_ACTIVE_ENEMIES,
    Math.round((38 + (wave - 1) * 9.5) * mode.density),
  );
  const hordeSize = Math.min(58, Math.max(26, Math.round((30 + wave * 1.45) * mode.density)));
  const spawnInterval = Math.max(0.65, (2.5 - logScale * 0.3) / mode.cadence);
  const enemySpeed = Math.min(0.071, 0.048 + logScale * 0.0034) * (0.97 + (mode.pressure - 1) * 0.12);
  const bossEscalation = wave >= 3 ? 1 + (wave - 3) * 0.08 : 1;
  const bossHp = Math.round(Math.min(14_000, (210 + wave * 48 + logScale * 85) * (0.92 + mode.pressure * 0.08) * bossEscalation));
  const composition = {
    grunt: Math.max(0.38, 0.82 - logScale * 0.055),
    gunner: Math.min(0.2, Math.max(0, (wave - 1) * 0.014)),
    shield: Math.min(0.18, Math.max(0, (wave - 2) * 0.012)),
    heavy: Math.min(0.16, Math.max(0, (wave - 3) * 0.011)),
    demolition: Math.min(0.12, Math.max(0, (wave - 4) * 0.009)),
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
  { id: 'reinforcements', title: 'Squad', short: '+8 squad', baseCost: 240, maxTier: 10, tone: 'cyan', asset: 'assets/blastline/ui/upgrade-troops.webp', synergy: 'More rifles on the line' },
  { id: 'damage', title: 'Damage', short: '+1 power', baseCost: 320, maxTier: 8, tone: 'gold', asset: 'assets/blastline/ui/upgrade-power.webp', synergy: 'Breaks armored targets' },
  { id: 'fireRate', title: 'Fire Rate', short: '+12% cadence', baseCost: 300, maxTier: 7, tone: 'green', asset: 'assets/blastline/ui/upgrade-rate.webp', synergy: 'Builds pressure faster' },
  { id: 'multishot', title: 'Multishot', short: '+1 round', baseCost: 720, maxTier: 3, tone: 'purple', asset: 'assets/blastline/ui/upgrade-spread.webp', synergy: 'Covers more lanes' },
  { id: 'armor', title: 'Armor', short: '+4 plates', baseCost: 260, maxTier: 10, tone: 'steel', asset: 'assets/blastline/ui/upgrade-armor.webp', synergy: 'Absorbs incoming fire' },
  { id: 'extraLife', title: 'Reserve', short: '+1 reserve', baseCost: 950, maxTier: MAX_LIVES, tone: 'red', asset: 'assets/blastline/ui/upgrade-armor.webp', synergy: 'Redeploys the squad' },
  { id: 'piercing', title: 'Pierce', short: '+1 pierce', baseCost: 540, maxTier: MAX_PIERCE, tone: 'purple', asset: 'assets/blastline/ui/upgrade-spread.webp', synergy: 'Rounds carry through formations' },
  { id: 'criticalChance', title: 'Critical', short: '+5% crit', baseCost: 380, maxTier: 6, tone: 'gold', asset: 'assets/blastline/ui/upgrade-power.webp', synergy: 'Heavy hits land harder' },
  { id: 'projectileSpeed', title: 'Velocity', short: '+15% velocity', baseCost: 300, maxTier: 5, tone: 'green', asset: 'assets/blastline/ui/upgrade-rate.webp', synergy: 'Rounds arrive sooner' },
]);

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
  return upgradeTier(session, id) >= item.maxTier;
}

export function shopPrice(id, purchaseCount = 0) {
  const item = SHOP_BY_ID[id];
  if (!item) return Infinity;
  return Math.max(1, Math.round(item.baseCost * Math.pow(1.75, Math.max(0, purchaseCount))));
}

export function applyUpgrade(player, id) {
  const next = { ...player };
  if (id === 'reinforcements') next.troops = Math.min(MAX_TROOPS, next.troops + 8);
  else if (id === 'damage') next.power = Math.min(16, next.power + 1);
  else if (id === 'fireRate') next.fireRate = Math.min(MAX_FIRE_RATE, next.fireRate * 1.12);
  else if (id === 'projectileSpeed') next.bulletSpeed = Math.min(2.4, next.bulletSpeed * 1.15);
  else if (id === 'multishot') next.projectiles = Math.min(MAX_PROJECTILES, next.projectiles + 1);
  else if (id === 'piercing') next.pierce = Math.min(MAX_PIERCE, next.pierce + 1);
  else if (id === 'criticalChance') next.criticalChance = Math.min(0.35, next.criticalChance + 0.05);
  else if (id === 'armor') next.armor = Math.min(60, next.armor + 4);
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
  next.power = clamp(next.power, 1, 16);
  next.fireRate = clamp(next.fireRate, 1.5, MAX_FIRE_RATE);
  next.bulletSpeed = clamp(next.bulletSpeed, 0.65, 2.4);
  next.armor = clamp(Math.round(next.armor), 0, 60);
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
  const absorbed = Math.min(next.armor, incoming);
  next.armor -= absorbed;
  next.troops = Math.max(0, next.troops - (incoming - absorbed));
  return { player: next, absorbed, lost: incoming - absorbed, protected: false };
}

export function stateAfterTroopDamage(player, activeState, lives = 0) {
  if (player.troops > 0 || !ACTIVE_STATES.includes(activeState)) return activeState;
  return lives > 0 ? GAME_STATE.RECOVERY : GAME_STATE.GAME_OVER;
}

export function stateAfterBossDefeat() {
  return GAME_STATE.BOSS_REWARD;
}

export function enemyReward(type, killCount = 0) {
  const table = {
    grunt: { points: 18, frenzy: 1 },
    gunner: { points: 26, frenzy: 1 },
    shield: { points: 36, frenzy: 2 },
    heavy: { points: 54, frenzy: 3 },
    demolition: { points: 68, frenzy: 3 },
  };
  const reward = { ...(table[type] || table.grunt) };
  if (killCount > 0 && killCount % 20 === 0) reward.points += 40;
  return reward;
}

export function claimKillReward(enemy, killCount = 0) {
  if (enemy.rewarded) return { enemy, reward: null };
  return { enemy: { ...enemy, rewarded: true }, reward: enemyReward(enemy.type, killCount) };
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
