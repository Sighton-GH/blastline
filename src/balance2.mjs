// Blastline balance sim v2 - policy-bot economy/combat harness.
// Unlike balance.mjs (aggregate heuristics), this sim tracks points, real shop
// prices, per-tier purchases, DPS vs enemy EHP, and squad attrition per wave.
// v1 mechanics = live game (reproduces the solved meta). v2 mechanics = the
// REDESIGN_PROGRESSION.md proposal (polynomial player vs exponential enemy).
import { DIFFICULTIES, SHOP_CATALOG, SHOP_BY_ID, getWaveConfig, mulberry32 } from './core.mjs';

export const ENEMY_BASE = Object.freeze({
  grunt: { hp: 1, contact: 1, reward: 18 },
  gunner: { hp: 1, contact: 1, reward: 26 },
  shield: { hp: 3, contact: 2, reward: 36 },   // 1hp + 2 shield folded in
  heavy: { hp: 4, contact: 3, reward: 54 },
  demolition: { hp: 2, contact: 2, reward: 68 },
});

export const MECHANICS_V1 = Object.freeze({
  id: 'v1-live',
  enemyHp: (type, wave) => ENEMY_BASE[type].hp + (type === 'heavy' ? Math.min(1, Math.floor(Math.log2(wave + 1) / 3)) : 0),
  contact: (type) => ENEMY_BASE[type].contact,
  bossHp: (bossIndex, wave, pressure) => {
    // pinned v1-live formula (pre-redesign core): linear in wave, capped 14k
    const logScale = Math.log2(wave + 1);
    const escalation = wave >= 3 ? 1 + (wave - 3) * 0.08 : 1;
    return Math.round(Math.min(14_000, (210 + wave * 48 + logScale * 85) * (0.92 + pressure * 0.08) * escalation));
  },
  bossGate: () => 1, // no archetype gates
  price: (item, count) => Math.max(1, Math.round(item.baseCost * Math.pow(1.75, count))),
  caps: { power: 16, fireRate: 16, projectiles: 4, troops: 240, crit: .35, pierce: 4, armor: 60 },
});

export const MECHANICS_V2 = Object.freeze({
  id: 'v2-redesign',
  enemyHp: (type, wave) => Math.max(1, Math.round(ENEMY_BASE[type].hp * Math.pow(1.5, wave - 1))),
  contact: (type, wave) => Math.max(1, Math.round(ENEMY_BASE[type].contact * Math.pow(1.16, wave - 1))),
  bossHp: (bossIndex, wave, pressure) => Math.round((bossIndex === 1 ? 320 : 420) * Math.pow(1.55, bossIndex - 1) * (0.92 + pressure * 0.08)),
  bossGate: (bossIndex, player) => {
    // archetype gates: 0=juggernaut(pierce/crit), 1=reaper(rate/velocity),
    // 2=marshal(multishot spread), 3=engine(plating/mobility)
    const kind = (bossIndex - 1) % 4;
    if (kind === 0) return Math.min(1, .35 + player.pierce * .14 + player.crit * 1.4);
    if (kind === 1) return Math.min(1, .3 + (player.fireRate / 45) + (player.bulletSpeed / 14));
    if (kind === 2) return Math.min(1, .5 + player.projectiles * .09);
    return Math.min(1, .5 + player.plating * .04);
  },
  price: (item, count) => {
    const exp = { damage: 2, fireRate: 1.8, reinforcements: 1.7, piercing: 1.9 }[item.id] || 1.7;
    return Math.max(1, Math.round(item.baseCost * Math.pow(count + 1, exp)));
  },
  caps: { power: Infinity, fireRate: Infinity, projectiles: 6, troops: Infinity, crit: .5, pierce: Infinity, armor: Infinity },
});

export const BOTS = Object.freeze({
  // Bryan's solved strategy: multishot max -> power -> rate to cap -> then squad,
  // taking every rate/armor-for-squad trade.
  bryansMeta: Object.freeze({ priority: ['multishot', 'multishot', 'multishot', 'damage', 'damage', 'fireRate', 'damage', 'fireRate', 'damage', 'fireRate', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements', 'damage', 'fireRate', 'reinforcements'], fallback: 'reinforcements' }),
  glassCannon: Object.freeze({ priority: ['damage', 'multishot', 'damage', 'criticalChance', 'damage', 'piercing', 'damage', 'criticalChance', 'multishot', 'damage', 'criticalChance', 'piercing', 'damage', 'criticalChance'], fallback: 'damage' }),
  squadGrinder: Object.freeze({ priority: ['reinforcements', 'fireRate', 'reinforcements', 'fireRate', 'reinforcements', 'armor', 'reinforcements', 'fireRate'], fallback: 'reinforcements' }),
  critPierce: Object.freeze({ priority: ['criticalChance', 'piercing', 'damage', 'criticalChance', 'piercing', 'damage', 'criticalChance', 'piercing', 'fireRate'], fallback: 'criticalChance' }),
  plated: Object.freeze({ priority: ['armor', 'damage', 'armor', 'reinforcements', 'damage', 'armor', 'fireRate', 'reinforcements'], fallback: 'armor' }),
  weak: Object.freeze({ priority: ['projectileSpeed', 'projectileSpeed', 'armor', 'projectileSpeed', 'projectileSpeed', 'armor'], fallback: 'projectileSpeed' }),
  balanced: Object.freeze({ priority: ['damage', 'reinforcements', 'fireRate', 'damage', 'armor', 'reinforcements', 'fireRate', 'multishot', 'damage', 'criticalChance'], fallback: 'damage' }),
});

export function initialSimPlayer() {
  return { troops: 14, power: 1, fireRate: 5.2, projectiles: 1, bulletSpeed: 1, pierce: 0, crit: 0, armor: 0, plating: 2 };
}

function applyTier(player, id, mech) {
  const p = { ...player };
  const caps = mech.caps;
  if (id === 'reinforcements') p.troops = Math.min(caps.troops, p.troops + 8);
  else if (id === 'damage') p.power = Math.min(caps.power, p.power + 1);
  else if (id === 'fireRate') p.fireRate = mech.id === 'v2-redesign' ? p.fireRate + .4 : Math.min(caps.fireRate, p.fireRate * 1.12);
  else if (id === 'multishot') p.projectiles = Math.min(caps.projectiles, p.projectiles + 1);
  else if (id === 'piercing') p.pierce = Math.min(caps.pierce, p.pierce + 1);
  else if (id === 'criticalChance') p.crit = Math.min(caps.crit, p.crit + (mech.id === 'v2-redesign' ? .03 : .05));
  else if (id === 'armor') { if (mech.id === 'v2-redesign') p.plating += 2; else p.armor = Math.min(caps.armor, p.armor + 4); }
  else if (id === 'projectileSpeed') p.bulletSpeed = Math.min(2.4, p.bulletSpeed * 1.15);
  return p;
}

function capped(player, id, counts, mech) {
  const item = SHOP_BY_ID[id];
  if (!item) return true;
  if (mech.id === 'v2-redesign') return false; // uncapped except multishot handled in applyTier
  return counts[id] >= item.maxTier;
}

export function simulatePolicyRun({ seed = 1, difficulty = 'veteran', bot = 'balanced', mechanics = MECHANICS_V1, maxWaves = 40, control = .8 } = {}) {
  const rng = mulberry32((seed >>> 0) ^ 0x9e3779b9);
  const mode = DIFFICULTIES[difficulty] || DIFFICULTIES.veteran;
  const policy = BOTS[bot] || BOTS.balanced;
  let player = initialSimPlayer();
  let points = 0, score = 0, kills = 0, lives = 0, completed = 0, bossIndex = 0, reservesBought = 0;
  const counts = {};
  const purchases = [];
  for (let wave = 1; wave <= maxWaves; wave += 1) {
    const config = getWaveConfig(wave, difficulty);
    // --- combat: effective wave damage vs wave EHP ---
    const avgHp = Object.entries(config.composition).reduce((s, [t, w]) => s + w * mechanics.enemyHp(t, wave), 0);
    const avgContact = Object.entries(config.composition).reduce((s, [t, w]) => s + w * mechanics.contact(t, wave), 0);
    const shots = player.fireRate * config.duration * player.projectiles;
    const hitEff = .55 + control * .45; // lane coverage / dodging skill
    const pierceMult = mechanics.id === 'v2-redesign'
      ? Math.min(2, 1 + player.pierce * .5 * Math.min(.9, config.activeTarget / 200))
      : 1 + player.pierce * Math.min(1.2, config.activeTarget / 160);
    const critMult = 1 + player.crit * (mechanics.id === 'v2-redesign' ? 1 : 1.5);
    const projMult = mechanics.id === 'v2-redesign'
      ? player.projectiles * Math.pow(.88, player.projectiles - 1)
      : player.projectiles;
    const dps = player.troops * player.power * player.fireRate * projMult * hitEff * pierceMult * critMult;
    const waveEhp = config.activeTarget * avgHp * mode.pressure;
    const clearRatio = dps * config.duration / Math.max(1, waveEhp);
    const killsThis = Math.min(config.activeTarget, Math.round(config.activeTarget * Math.min(1.15, clearRatio)));
    kills += killsThis;
    points += Math.round(killsThis * (mechanics.id === 'v2-redesign' ? 13 / mode.density : 20) + (killsThis / 20) * 40);
    score += killsThis * 12;
    // --- attrition: march-leak (kill throughput vs spawn rate) + ranged chip ---
    const killRate = dps / Math.max(1, avgHp); // enemies/s
    const spawnRate = config.activeTarget / config.duration;
    const marchWindow = Math.max(6, 16 - wave * .3); // s an enemy survives on the road
    const leaked = Math.max(0, (spawnRate - killRate) * marchWindow) + Math.max(0, config.activeTarget - killsThis) * .1;
    const touchEvents = Math.min(config.duration * 2.8, leaked);
    const contactDmg = touchEvents * avgContact;
    const gunnersAlive = Math.min(config.activeTarget * (config.composition.gunner || 0), config.activeTarget * .06);
    const rangedChip = Math.max(0, wave - 2) * .55 * mode.cadence * (1 - control * .7) * (1 + gunnersAlive * .04);
    let incoming = contactDmg + rangedChip;
    if (mechanics.id === 'v2-redesign') {
      const plateHits = Math.min(player.plating, touchEvents + Math.max(0, wave - 2) * .4);
      incoming = Math.max(0, incoming - plateHits * avgContact);
      player.plating = Math.max(0, player.plating - plateHits);
      player.plating = Math.min(40, player.plating + config.duration / 20); // regen 1 per 20s
    } else {
      const absorbed = Math.min(player.armor, incoming);
      player.armor -= absorbed; incoming -= absorbed;
    }
    player.troops -= Math.max(0, Math.round(incoming + (rng() - .5) * 2));
    // --- boss every 3rd wave ---
    if (wave % 3 === 0) {
      bossIndex += 1;
      const bossEhp = mechanics.bossHp ? mechanics.bossHp(bossIndex, wave, mode.pressure) : config.bossHp;
      const gate = mechanics.bossGate(bossIndex, player);
      const bossDps = dps * gate;
      const killTime = bossEhp / Math.max(1, bossDps);
      const window = 30; // enrage window seconds
      if (killTime <= window) {
        points += 700 + wave * 90; score += Math.round(bossEhp * .5);
        player.troops -= Math.round(killTime * mode.pressure * (1.6 - control) * .35 + rng() * 2); // chip during fight
      } else {
        player.troops -= Math.round((killTime - window) * (1.2 + wave * .12) * mode.pressure + 6 + wave * .8); // enrage punishes hard
      }
    }
    if (player.troops <= 0 && lives > 0) { lives -= 1; player.troops = mode.recoveryTroops; }
    if (player.troops <= 0) break;
    completed = wave;
    // --- shopping between waves ---
    let guard = 24;
    while (guard-- > 0) {
      const want = policy.priority[Math.min(purchases.length, policy.priority.length - 1)] || policy.fallback;
      const id = (!capped(player, want, counts, mechanics)) ? want : policy.fallback;
      if (capped(player, id, counts, mechanics)) break;
      const cost = mechanics.price(SHOP_BY_ID[id], counts[id] || 0);
      if (points < cost) break;
      points -= cost; counts[id] = (counts[id] || 0) + 1;
      player = applyTier(player, id, mechanics);
      purchases.push(id);
    }
    // reserves purchase heuristic: buy one when rich and threatened
    if (lives < 2 && wave >= 6) {
      const reserveCost = mechanics.id === 'v2-redesign'
        ? Math.round(950 * Math.pow(reservesBought + 1, 1.7))
        : Math.round(950 * Math.pow(1.75, reservesBought));
      if (points > reserveCost * 1.4) { points -= reserveCost; lives += 1; reservesBought += 1; }
    }
  }
  return { seed, difficulty, bot, mechanics: mechanics.id, wavesCompleted: completed, kills, score, finalDps: Math.round(Math.max(0, player.troops) * player.power * player.fireRate * player.projectiles * Math.pow(.88, Math.max(0, player.projectiles - 1))), troopsLeft: Math.max(0, Math.round(player.troops)), purchaseCount: purchases.length, firstPurchases: purchases.slice(0, 8) };
}

export function runPolicyMatrix({ seeds = 30, mechanics = MECHANICS_V1, maxWaves = 40 } = {}) {
  const out = {};
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    out[difficulty] = {};
    for (const bot of Object.keys(BOTS)) {
      const runs = [];
      for (let seed = 1; seed <= seeds; seed += 1) runs.push(simulatePolicyRun({ seed, difficulty, bot, mechanics, maxWaves }));
      const waves = runs.map(r => r.wavesCompleted).sort((a, b) => a - b);
      out[difficulty][bot] = {
        medianWaves: waves[Math.floor(waves.length / 2)],
        meanWaves: Math.round(waves.reduce((s, v) => s + v, 0) / waves.length * 10) / 10,
        maxWaves: waves[waves.length - 1],
        medianDps: runs.map(r => r.finalDps).sort((a, b) => a - b)[Math.floor(runs.length / 2)],
      };
    }
  }
  return out;
}

// CLI: node src/balance2.mjs [v1|v2] [seeds]
if (import.meta.url === `file://${process.argv[1]}`) {
  const mech = process.argv[2] === 'v2' ? MECHANICS_V2 : MECHANICS_V1;
  const seeds = Number(process.argv[3]) || 30;
  const matrix = runPolicyMatrix({ seeds, mechanics: mech });
  for (const [diff, bots] of Object.entries(matrix)) {
    console.log(`\n== ${diff} (${mech.id}) ==`);
    for (const [bot, s] of Object.entries(bots)) {
      console.log(`  ${bot.padEnd(12)} median ${String(s.medianWaves).padStart(2)} waves | mean ${String(s.meanWaves).padStart(5)} | max ${String(s.maxWaves).padStart(2)} | median final dps ${s.medianDps}`);
    }
  }
}
