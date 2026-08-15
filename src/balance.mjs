import { DIFFICULTIES, clamp, getWaveConfig, mulberry32 } from './core.mjs';

export const BUILD_ARCHETYPES = Object.freeze({
  balanced: Object.freeze({ squad: 1.08, damage: 1.08, rate: 1.08, pierce: .12, defense: 1.08, control: .82, recovery: .12 }),
  growth: Object.freeze({ squad: 1.44, damage: .94, rate: 1, pierce: .08, defense: 1.02, control: .8, recovery: .16 }),
  damage: Object.freeze({ squad: 1.02, damage: 1.62, rate: .96, pierce: .1, defense: .92, control: .8, recovery: .08 }),
  fireRate: Object.freeze({ squad: 1.02, damage: .98, rate: 1.55, pierce: .16, defense: .94, control: .82, recovery: .08 }),
  piercing: Object.freeze({ squad: 1.04, damage: 1.08, rate: 1.04, pierce: .72, defense: .94, control: .81, recovery: .08 }),
  defense: Object.freeze({ squad: 1.08, damage: .92, rate: .98, pierce: .08, defense: 1.62, control: .84, recovery: .28 }),
  weak: Object.freeze({ squad: .88, damage: .82, rate: .8, pierce: 0, defense: .72, control: .38, recovery: 0 }),
});

export function simulateRun({ seed = 1, difficulty = 'veteran', build = 'balanced', maxWaves = 30 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const mode = DIFFICULTIES[difficulty] || DIFFICULTIES.veteran;
  const archetype = typeof build === 'string' ? BUILD_ARCHETYPES[build] : build;
  let squad = 14 * archetype.squad;
  let armor = 1.5 * archetype.defense;
  let reserves = archetype.recovery > .3 ? 1 : 0;
  let score = 0;
  let completed = 0;
  for (let wave = 1; wave <= maxWaves; wave += 1) {
    const config = getWaveConfig(wave, difficulty);
    const experience = 1 + Math.log2(wave + 1) * .055;
    const specialization = Math.max(0, archetype.damage - 1) * .038
      + Math.max(0, archetype.rate - 1) * .038
      + archetype.pierce * .03;
    const upgradeCurve = 1 + (wave - 1) * (.018 * (.45 + archetype.control) + specialization);
    const offense = squad * archetype.damage * archetype.rate * experience * upgradeCurve * (1 + archetype.pierce * Math.min(1.15, config.activeTarget / 145));
    const hordeLoad = config.activeTarget * mode.pressure * (.83 + rng() * .34);
    const clearRatio = offense / Math.max(1, hordeLoad);
    const steeringExposure = (1 - archetype.control) * mode.pressure * (1.1 + rng() * .8);
    const formationExposure = Math.max(0, .9 - clearRatio) * (4.3 + wave * .09);
    const rangedExposure = Math.max(0, wave - 2) * .055 * mode.cadence * (1 - archetype.control * .68);
    const defenseFactor = .65 + archetype.defense * .35;
    const rawLoss = (steeringExposure + formationExposure + rangedExposure) / defenseFactor;
    let losses = Math.max(0, Math.round(rawLoss - armor * .12 + (rng() - .5) * 1.5));
    armor = Math.max(0, armor - losses * .72);
    squad -= losses;

    const bossPressure = (config.bossHp / (210 + offense * 5.3)) * mode.pressure;
    const bossLoss = Math.max(0, Math.round(bossPressure * (1.45 - archetype.control * .55) / defenseFactor + (rng() - .5) * 1.2));
    squad -= bossLoss;
    if (squad <= 0 && reserves > 0) {
      reserves -= 1;
      squad = mode.recoveryTroops + archetype.recovery * 9;
      armor = 2 * archetype.defense;
    }
    if (squad <= 0) break;

    completed = wave;
    score += Math.round(config.activeTarget * 12 + config.bossHp * .5);
    const growth = 2.15 + archetype.squad * 1.15 + archetype.recovery * .55;
    squad = clamp(squad + growth, 1, 120);
    armor = Math.min(6, armor + .25 * archetype.defense);
    if (wave % 8 === 0 && archetype.recovery > .25) reserves = Math.min(2, reserves + 1);
  }
  return { seed, difficulty, build: typeof build === 'string' ? build : 'custom', wavesCompleted: completed, squad: Math.max(0, squad), score };
}

export function runBalanceMatrix({ seeds = 100, maxWaves = 30 } = {}) {
  const matrix = {};
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    matrix[difficulty] = {};
    for (const build of Object.keys(BUILD_ARCHETYPES)) {
      const results = [];
      for (let seed = 1; seed <= seeds; seed += 1) results.push(simulateRun({ seed, difficulty, build, maxWaves }));
      const waves = results.map(result => result.wavesCompleted).sort((a, b) => a - b);
      matrix[difficulty][build] = {
        seeds,
        meanWaves: waves.reduce((sum, value) => sum + value, 0) / waves.length,
        medianWaves: waves[Math.floor(waves.length / 2)],
        reachedWave20: waves.filter(value => value >= 20).length / waves.length,
        completed: waves.filter(value => value >= maxWaves).length / waves.length,
      };
    }
  }
  return matrix;
}
