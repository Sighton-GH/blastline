import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENEMY_BASE_STATS,
  enemyHitPoints,
  enemyReward,
  getWaveConfig,
  mulberry32,
} from '../src/core.mjs';
import {
  BULWARK_HIT_CAP,
  ELITE_ROSTER,
  SAPPER_BLAST,
  WARDEN_AURA,
  WAVE_EVENT_KINDS,
  breachDamageFor,
  cappedHitDamage,
  eliteForWave,
  eliteRewardPoints,
  isWarden,
  planWaveEvents,
  sapperBlastDamage,
  wardenAuraFactor,
} from '../src/encounters.mjs';

test('new enemy types have base stats, rewards, and exponential HP scaling', () => {
  for (const type of ['warden', 'bulwark', 'sapper']) {
    assert.ok(ENEMY_BASE_STATS[type], `missing base stats for ${type}`);
    assert.ok(enemyHitPoints(type, 1) >= 1);
    assert.ok(enemyHitPoints(type, 6) > enemyHitPoints(type, 5));
    const reward = enemyReward(type, 0, 1);
    assert.ok(reward.points > 0 && reward.frenzy > 0, `missing reward for ${type}`);
  }
});

test('new types join the wave composition only after their intro waves, normalized', () => {
  const early = getWaveConfig(1, 'veteran');
  assert.equal(early.composition.warden, 0);
  assert.equal(early.composition.bulwark, 0);
  assert.equal(early.composition.sapper, 0);
  const late = getWaveConfig(10, 'veteran');
  for (const type of ['warden', 'bulwark', 'sapper']) {
    assert.ok(late.composition[type] > 0, `${type} should appear by wave 10`);
    assert.ok(late.composition[type] <= 0.15, `${type} share stays bounded`);
  }
  const sum = Object.values(late.composition).reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'composition stays normalized');
});

test('bulwark hit cap limits per-hit damage; other types are untouched', () => {
  assert.equal(cappedHitDamage({ type: 'bulwark' }, 9), BULWARK_HIT_CAP);
  assert.equal(cappedHitDamage({ type: 'bulwark' }, 1), 1);
  assert.equal(cappedHitDamage({ type: 'grunt' }, 9), 9);
  assert.equal(cappedHitDamage({ type: 'bulwark', hitCap: 3 }, 9), 3, 'elite hitCap overrides');
});

test('warden aura reduces damage to nearby allies, never to wardens', () => {
  const warden = { type: 'warden', x: 0, y: .3, dead: false };
  assert.ok(isWarden(warden));
  const near = { type: 'grunt', x: WARDEN_AURA.radiusX * .9, y: .3 };
  const far = { type: 'grunt', x: WARDEN_AURA.radiusX * 2, y: .3 };
  assert.equal(wardenAuraFactor(near, [warden]), WARDEN_AURA.factor);
  assert.equal(wardenAuraFactor(far, [warden]), 1);
  assert.equal(wardenAuraFactor({ type: 'warden', x: 0, y: .3 }, [warden]), 1, 'wardens never shield each other');
  assert.equal(wardenAuraFactor(near, [{ ...warden, dead: true }]), 1, 'dead wardens project nothing');
  const eliteWarden = { ...warden, auraRadiusX: .42, auraRadiusY: .16, auraFactor: .5 };
  assert.equal(wardenAuraFactor(near, [eliteWarden]), .5, 'elite aura overrides defaults');
  assert.equal(wardenAuraFactor(near, [warden, eliteWarden]), .5, 'strongest aura wins');
});

test('breach damage: leaks cost half contact, sappers and elites full, never free', () => {
  assert.equal(breachDamageFor({ type: 'grunt', contact: 1 }), 1);
  assert.equal(breachDamageFor({ type: 'heavy', contact: 5 }), 2);
  assert.equal(breachDamageFor({ type: 'sapper', contact: 4 }), 4);
  assert.equal(breachDamageFor({ type: 'grunt', contact: 3, elite: 'x' }), 3);
  assert.ok(breachDamageFor({ type: 'grunt', contact: 0 }) >= 1, 'a leak is never free');
});

test('sapper blast scales with contact and respects the floor', () => {
  assert.equal(sapperBlastDamage({ contact: 1 }), SAPPER_BLAST.minDamage);
  assert.equal(sapperBlastDamage({ contact: 4 }), 4 * SAPPER_BLAST.damageFactor);
});

test('elite roster rotates by wave and every entry is spawnable', () => {
  assert.equal(eliteForWave(4), ELITE_ROSTER[0]);
  assert.equal(eliteForWave(5), ELITE_ROSTER[0]);
  assert.equal(eliteForWave(6), ELITE_ROSTER[1]);
  assert.equal(eliteForWave(8), ELITE_ROSTER[2]);
  assert.equal(eliteForWave(10), ELITE_ROSTER[0]);
  for (const elite of ELITE_ROSTER) {
    assert.ok(ENEMY_BASE_STATS[elite.baseType], `elite ${elite.id} needs a spawnable baseType`);
    assert.ok(elite.hpFactor > 0 && elite.scale > 1 && elite.reward > 0);
    assert.ok(eliteRewardPoints(elite, 8) > eliteRewardPoints(elite, 4), 'bounty grows with wave');
  }
});

test('wave events: none before wave 4, wave 4 always elite, boss waves never elite', () => {
  assert.deepEqual(planWaveEvents(mulberry32(7), 1, 30), []);
  assert.deepEqual(planWaveEvents(mulberry32(7), 3, 30), []);
  const intro = planWaveEvents(mulberry32(7), 4, 28);
  assert.equal(intro.length, 1);
  assert.equal(intro[0].kind, 'elite');
  for (let wave = 4; wave <= 30; wave += 1) {
    const config = getWaveConfig(wave, 'veteran');
    const events = planWaveEvents(mulberry32(1000 + wave), wave, config.duration);
    assert.ok(events.length >= 1 && events.length <= 2, `wave ${wave} event count sane`);
    for (const event of events) {
      assert.ok(WAVE_EVENT_KINDS.includes(event.kind), `wave ${wave} kind valid`);
      assert.ok(event.at >= 5 && event.at <= config.duration - 5.9, `wave ${wave} timing inside the wave`);
    }
    if (wave % 3 === 0) assert.ok(!events.some(event => event.kind === 'elite'), `boss wave ${wave} has no elite`);
    const kinds = events.map(event => event.kind);
    assert.equal(new Set(kinds).size, kinds.length, `wave ${wave} has no duplicate kinds`);
  }
});

test('wave event schedule is deterministic for a given seed stream', () => {
  const a = planWaveEvents(mulberry32(42), 9, getWaveConfig(9, 'veteran').duration);
  const b = planWaveEvents(mulberry32(42), 9, getWaveConfig(9, 'veteran').duration);
  assert.deepEqual(a, b);
});
