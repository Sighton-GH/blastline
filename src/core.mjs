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
  PAUSED: 'paused',
  UPGRADE: 'upgrade',
  VICTORY: 'victory',
  GAME_OVER: 'game-over',
});

export const ACTIVE_STATES = Object.freeze([GAME_STATE.PLAYING, GAME_STATE.BOSS]);
export const MAX_TROOPS = 999;
export const MAX_PROJECTILES = 4;
export const MAX_FIRE_RATE = 18;

export const LEVELS = Object.freeze([
  { name: 'First Contact', length: 34, spawn: 4.30, enemies: 72, horde: 12, bossHp: 45, speed: 1.00 },
  { name: 'Crossfire', length: 38, spawn: 4.05, enemies: 96, horde: 15, bossHp: 60, speed: 1.04 },
  { name: 'Red Tide', length: 42, spawn: 3.82, enemies: 126, horde: 18, bossHp: 75, speed: 1.08 },
  { name: 'No Man\'s Land', length: 46, spawn: 3.62, enemies: 156, horde: 21, bossHp: 90, speed: 1.12 },
  { name: 'Overdrive', length: 50, spawn: 3.43, enemies: 192, horde: 25, bossHp: 110, speed: 1.16 },
  { name: 'The Last Line', length: 54, spawn: 3.25, enemies: 228, horde: 28, bossHp: 135, speed: 1.20 },
]);

export const UPGRADES = Object.freeze([
  { id: 'troops', asset: 'assets/blastline/ui/upgrade-troops.webp', tone: 'blue', title: '+12 Troops', desc: 'Add 12 soldiers to the squad.' },
  { id: 'power', asset: 'assets/blastline/ui/upgrade-power.webp', tone: 'gold', title: '+1 Power', desc: 'Every projectile deals 1 more damage.' },
  { id: 'rate', asset: 'assets/blastline/ui/upgrade-rate.webp', tone: 'green', title: '+20% Fire Rate', desc: 'Fire bursts 20% more often.' },
  { id: 'spread', asset: 'assets/blastline/ui/upgrade-spread.webp', tone: 'purple', title: '+1 Projectile', desc: 'Add a projectile to every burst (max 4).' },
  { id: 'velocity', asset: 'assets/blastline/ui/upgrade-velocity.webp', tone: 'cyan', title: '+20% Velocity', desc: 'Projectiles reach targets 20% faster.' },
  { id: 'armor', asset: 'assets/blastline/ui/upgrade-armor.webp', tone: 'steel', title: '+3 Armor', desc: 'Absorb the next 3 points of damage.' },
]);

export function initialPlayer() {
  return {
    x: 0,
    targetX: 0,
    troops: 12,
    power: 1,
    fireRate: 5.5,
    projectiles: 1,
    bulletSpeed: 1,
    armor: 0,
    coins: 0,
    speed: 1.9,
  };
}

export function applyUpgrade(player, id) {
  const next = { ...player };
  if (id === 'troops') next.troops = Math.min(MAX_TROOPS, next.troops + 12);
  else if (id === 'power') next.power += 1;
  else if (id === 'rate') next.fireRate = Math.min(MAX_FIRE_RATE, next.fireRate * 1.2);
  else if (id === 'spread') next.projectiles = Math.min(MAX_PROJECTILES, next.projectiles + 1);
  else if (id === 'velocity') next.bulletSpeed *= 1.2;
  else if (id === 'armor') next.armor += 3;
  return next;
}

export function makeGatePair(rng, levelIndex) {
  const positive = [
    { kind: 'troops', value: 6 + Math.floor(rng() * 6) + levelIndex * 2, label: value => `+${value}` },
    { kind: 'troopsMul', value: 2, label: value => `×${value}` },
    { kind: 'power', value: 1, label: () => '+1 DMG' },
    { kind: 'rate', value: 0.2, label: () => '+20%' },
  ];
  const negative = [
    { kind: 'troops', value: -(4 + Math.floor(rng() * 6) + levelIndex), label: value => `−${Math.abs(value)}` },
    { kind: 'slow', value: 0.15, label: () => '−15%' },
  ];
  const good = positive[Math.floor(rng() * positive.length)];
  const bad = negative[Math.floor(rng() * negative.length)];
  return rng() < 0.5 ? [bad, good] : [good, bad];
}

export function applyGate(player, gate) {
  const next = { ...player };
  if (gate.kind === 'troops') next.troops = clamp(next.troops + gate.value, 1, MAX_TROOPS);
  else if (gate.kind === 'troopsMul') next.troops = clamp(Math.round(next.troops * gate.value), 1, MAX_TROOPS);
  else if (gate.kind === 'power') next.power += gate.value;
  else if (gate.kind === 'rate') next.fireRate = Math.min(MAX_FIRE_RATE, next.fireRate * (1 + gate.value));
  else if (gate.kind === 'slow') next.fireRate = Math.max(1, next.fireRate * (1 - gate.value));
  return next;
}

export function gateText(gate) {
  return gate.label(gate.value);
}

export function makeGateEncounter(id, gates, y = -0.06) {
  const laneWidth = 0.68;
  return {
    id,
    y,
    resolved: false,
    selected: null,
    gates: gates.map((gate, index) => ({
      ...gate,
      x: index === 0 ? -0.39 : 0.39,
      w: laneWidth,
    })),
  };
}

export function resolveGateEncounter(encounter, playerX) {
  if (encounter.resolved) return { encounter, gate: null };
  const gate = encounter.gates.find(option => Math.abs(playerX - option.x) < option.w / 2) ?? null;
  return {
    encounter: { ...encounter, resolved: true, selected: gate ? gate.kind : null },
    gate,
  };
}

export function pickUpgradeSet(rng) {
  const available = [...UPGRADES];
  const choices = [];
  while (choices.length < 3 && available.length) {
    choices.push(available.splice(Math.floor(rng() * available.length), 1)[0]);
  }
  return choices;
}

export function visibleSquadCount(troops) {
  const count = Math.max(1, Math.round(Number.isFinite(troops) ? troops : 1));
  if (count <= 20) return count;
  if (count <= 50) return Math.min(28, 20 + Math.ceil((count - 20) * 0.25));
  if (count <= 100) return Math.min(36, 28 + Math.ceil((count - 50) * 0.16));
  return Math.min(42, 36 + Math.ceil((count - 100) * 0.025));
}

export function squadColumnCount(visibleCount) {
  const count = Math.max(1, Math.round(visibleCount));
  if (count <= 3) return count;
  if (count <= 6) return 3;
  if (count <= 10) return 4;
  if (count <= 18) return 6;
  if (count <= 25) return 5;
  return 7;
}

export function applyTroopDamage(player, amount) {
  const next = { ...player };
  const incoming = Math.max(0, Math.round(amount));
  const absorbed = Math.min(next.armor, incoming);
  next.armor -= absorbed;
  next.troops = Math.max(0, next.troops - (incoming - absorbed));
  return { player: next, absorbed, lost: incoming - absorbed };
}

export function stateAfterTroopDamage(player, activeState) {
  return player.troops <= 0 && ACTIVE_STATES.includes(activeState)
    ? GAME_STATE.GAME_OVER
    : activeState;
}

export function stateAfterBossDefeat(waveIndex) {
  return waveIndex >= LEVELS.length - 1 ? GAME_STATE.VICTORY : GAME_STATE.UPGRADE;
}

export function enemyReward(type) {
  if (type === 'elite') return { score: 58, coins: 12, frenzy: 3 };
  if (type === 'shield') return { score: 64, coins: 14, frenzy: 3 };
  return { score: 20, coins: 4, frenzy: 1 };
}

export function claimKillReward(enemy) {
  if (enemy.rewarded) return { enemy, reward: null };
  return { enemy: { ...enemy, rewarded: true }, reward: enemyReward(enemy.type) };
}

export function createCleanRun(seed = 0) {
  return {
    seed: seed >>> 0,
    state: GAME_STATE.PLAYING,
    resumeState: null,
    waveIndex: 0,
    player: initialPlayer(),
    score: 0,
    frenzy: 0,
    frenzyTimer: 0,
    waveTime: 0,
    bossTime: 0,
    spawnTimer: 0.5,
    gateTimer: 1.4,
    enemiesSpawned: 0,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    gates: [],
    particles: [],
    floaters: [],
    muzzleFlashes: [],
    boss: null,
    telegraphs: [],
  };
}
