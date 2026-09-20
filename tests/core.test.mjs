import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIVE_STATES,
  DIFFICULTIES,
  GAME_STATE,
  GATE_LIBRARY,
  LANE_CENTERS,
  MAX_ACTIVE_ENEMIES,
  MAX_FIRE_RATE,
  MAX_LIVES,
  MAX_PROJECTILES,
  SHOP_CATALOG,
  applyBossReward,
  applyGate,
  applyTroopDamage,
  applyUpgrade,
  claimKillReward,
  createCleanRun,
  getWaveConfig,
  laneBounds,
  laneCenter,
  laneContains,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  pickBossRewards,
  purchaseUpgrade,
  resolveGateEncounter,
  reviveSession,
  shopPrice,
  stateAfterBossDefeat,
  stateAfterTroopDamage,
  visibleSquadCount,
} from '../src/core.mjs';

test('seeded RNG remains deterministic', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('wave generation is endless, bounded, and numerically stable', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (const wave of [1, 2, 10, 100, 10_000, 1_000_000, Infinity, NaN]) {
      const config = getWaveConfig(wave, difficulty);
      assert.ok(Number.isFinite(config.duration));
      assert.ok(Number.isFinite(config.activeTarget));
      assert.ok(Number.isFinite(config.bossHp));
      assert.ok(config.duration >= 26 && config.duration <= 38);
      assert.ok(config.activeTarget > 0 && config.activeTarget <= MAX_ACTIVE_ENEMIES);
      assert.ok(config.hordeSize > 0 && config.hordeSize <= 84); // 84 = 2x-pressure curve horde cap (2026-09-19)
      assert.ok(config.spawnInterval >= .5); // 2x-pressure curve spawn floor (2026-09-19)
      assert.ok(config.enemySpeed > 0 && config.enemySpeed < .1);
      const compositionTotal = Object.values(config.composition).reduce((sum, chance) => sum + chance, 0);
      assert.ok(Math.abs(compositionTotal - 1) < 1e-9);
    }
  }
  assert.equal(getWaveConfig(1_000_000).duration, 38);
  assert.equal(getWaveConfig(1_000_000).activeTarget, MAX_ACTIVE_ENEMIES);
  assert.ok(getWaveConfig(30).bossHp > getWaveConfig(1).bossHp);
});

test('difficulty changes density and pressure without changing wave duration', () => {
  for (const wave of [1, 8, 20]) {
    const recruit = getWaveConfig(wave, 'recruit');
    const veteran = getWaveConfig(wave, 'veteran');
    const elite = getWaveConfig(wave, 'elite');
    assert.ok(recruit.activeTarget < veteran.activeTarget);
    assert.ok(veteran.activeTarget < elite.activeTarget || elite.activeTarget === MAX_ACTIVE_ENEMIES);
    assert.ok(recruit.pressure < veteran.pressure && veteran.pressure < elite.pressure);
    assert.ok(recruit.spawnInterval > veteran.spawnInterval && veteran.spawnInterval > elite.spawnInterval);
    assert.equal(recruit.duration, veteran.duration);
    assert.equal(veteran.duration, elite.duration);
  }
});

test('canonical lanes are disjoint and all lane-bound objects fit their lane', () => {
  assert.deepEqual(LANE_CENTERS.map((_, lane) => laneCenter(lane)), [...LANE_CENTERS]);
  for (let lane = 0; lane < 3; lane += 1) {
    const bounds = laneBounds(lane);
    assert.ok(laneContains(lane, bounds.center));
    assert.ok(laneContains(lane, bounds.min));
    assert.ok(laneContains(lane, bounds.max));
    if (lane < 2) assert.ok(bounds.max < laneBounds(lane + 1).min);
  }
  for (let seed = 1; seed <= 100; seed += 1) {
    const encounter = makeGateEncounter(seed, makeGatePair(mulberry32(seed), 5), -.06, mulberry32(seed * 7));
    assert.equal(encounter.gates.length, 2);
    assert.equal(new Set(encounter.gates.map(gate => gate.lane)).size, 2);
    assert.ok(!encounter.gates.some(gate => gate.lane === encounter.neutralLane));
    assert.ok(encounter.gates.every(gate => laneContains(gate.lane, gate.x)));
  }
});

test('gate decisions resolve once with a true neutral lane', () => {
  const encounter = makeGateEncounter(1, [GATE_LIBRARY[2], GATE_LIBRARY[4]], .4, () => .4);
  const leftGate = encounter.gates[0];
  const first = resolveGateEncounter(encounter, leftGate.x);
  assert.equal(first.gate.id, leftGate.id);
  assert.equal(first.encounter.resolved, true);
  assert.equal(resolveGateEncounter(first.encounter, encounter.gates[1].x).gate, null);
  const neutral = resolveGateEncounter(makeGateEncounter(2, [GATE_LIBRARY[2], GATE_LIBRARY[4]], .4, () => .4), laneCenter(1));
  assert.equal(neutral.gate, null);
  assert.equal(neutral.encounter.selected, null);
});

test('Wave 1 teaches a positive/negative choice and later waves offer tradeoffs', () => {
  const tutorial = makeGatePair(mulberry32(1), 1);
  assert.equal(tutorial[0].tone, 'blue');
  assert.equal(tutorial[1].tone, 'red');
  assert.ok(tutorial[0].effects[0].value > 0);
  assert.ok(tutorial[1].effects[0].value < 0);
  for (let seed = 1; seed <= 100; seed += 1) {
    const choices = makeGatePair(mulberry32(seed), 8);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 2);
    assert.ok(choices.every(choice => choice.effects.length >= 2));
  }
});

test('gate effects apply all benefits and costs while preserving safety caps', () => {
  const start = { ...createCleanRun().player, troops: 6, armor: 1, fireRate: 5 };
  const ranks = applyGate(start, GATE_LIBRARY.find(gate => gate.id === 'rapid-ranks'));
  assert.equal(ranks.troops, 22);
  assert.equal(ranks.fireRate, 4.4);
  const harmful = applyGate(start, { effects: [{ stat: 'troops', mode: 'add', value: -100 }] });
  assert.equal(harmful.troops, 1);
  const past16 = applyGate({ ...start, fireRate: 15 }, { effects: [{ stat: 'fireRate', mode: 'multiply', value: 2 }] });
  assert.equal(past16.fireRate, 30); // v2: no hard utility cap below the safety rail
  const railed = applyGate({ ...start, fireRate: 25 }, { effects: [{ stat: 'fireRate', mode: 'multiply', value: 2 }] });
  assert.equal(railed.fireRate, MAX_FIRE_RATE);
});

test('shop prices rise, spending is atomic, and insufficient points do nothing', () => {
  for (const item of SHOP_CATALOG) {
    const prices = [0, 1, 2, 3].map(count => shopPrice(item.id, count));
    assert.ok(prices.every(Number.isFinite));
    assert.ok(prices[0] < prices[1] && prices[1] < prices[2] && prices[2] < prices[3]);
  }
  const poor = createCleanRun(1);
  const failed = purchaseUpgrade(poor, 'damage');
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'insufficient');
  assert.deepEqual(failed.session, poor);

  const funded = { ...createCleanRun(2), points: 2_000 };
  const bought = purchaseUpgrade(funded, 'damage');
  assert.equal(bought.ok, true);
  assert.equal(bought.session.player.power, 2);
  assert.equal(bought.session.points, 2_000 - shopPrice('damage', 0));
  assert.equal(bought.session.purchaseCounts.damage, 1);
  assert.equal(bought.session.upgradeTiers.damage, 1);
});

test('v2 shop: polynomial stats are uncapped, design caps hold for multishot/crit/lives', () => {
  let session = { ...createCleanRun(3), points: 100_000_000 };
  for (const item of SHOP_CATALOG) {
    const limit = item.id === 'extraLife' ? MAX_LIVES : item.maxTier + 2;
    for (let count = 0; count < limit; count += 1) session = purchaseUpgrade(session, item.id).session;
  }
  assert.equal(session.player.projectiles, MAX_PROJECTILES);
  assert.ok(session.player.fireRate <= MAX_FIRE_RATE);
  // fireRate is uncapped in v2: all maxTier + 2 purchases apply (+0.4 each)
  assert.equal(session.upgradeTiers.fireRate, SHOP_CATALOG.find(item => item.id === 'fireRate').maxTier + 2);
  assert.equal(session.lives, MAX_LIVES);
  assert.ok(session.player.criticalChance <= .5);
  assert.equal(Math.round(session.player.criticalChance * 100), 30); // 10 tiers x +0.03
  let critPlayer = createCleanRun().player;
  for (let i = 0; i < 20; i += 1) critPlayer = applyUpgrade(critPlayer, 'criticalChance');
  assert.ok(critPlayer.criticalChance > .35, 'crit exceeds the old v1 cap');
  assert.ok(critPlayer.criticalChance <= .5, 'crit respects the v2 cap');
  assert.ok(session.player.pierce > 4, 'pierce exceeds the old v1 cap');
  assert.equal(session.player.power, 15); // 14 uncapped purchases
  let powerPlayer = createCleanRun().player;
  for (let i = 0; i < 20; i += 1) powerPlayer = applyUpgrade(powerPlayer, 'damage');
  assert.equal(powerPlayer.power, 21); // v2: power grows past the old 16 cap
  let firePlayer = createCleanRun().player;
  for (let i = 0; i < 30; i += 1) firePlayer = applyUpgrade(firePlayer, 'fireRate');
  assert.ok(firePlayer.fireRate > 16, 'fireRate exceeds the old v1 cap');
  assert.ok(session.player.plates <= 40);
});

test('boss reward choices are unique, tiered, and contain synergy information', () => {
  const session = createCleanRun(4);
  for (let seed = 1; seed <= 100; seed += 1) {
    const choices = pickBossRewards(mulberry32(seed), session);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    assert.ok(choices.every(choice => choice.tier === 1 && choice.tierLabel === 'TIER 1'));
    assert.ok(choices.every(choice => choice.synergy.length > 0));
  }
  const rewarded = applyBossReward(session, 'multishot');
  assert.equal(rewarded.player.projectiles, 2);
  assert.equal(rewarded.upgradeTiers.multishot, 1);
  assert.equal(rewarded.points, session.points, 'reward helpers do not alter points');
});

test('boss defeat always transitions to another endless reward, never Victory', () => {
  for (const wave of [1, 6, 20, 1_000_000]) assert.equal(stateAfterBossDefeat(wave), GAME_STATE.BOSS_REWARD);
  assert.ok(!Object.values(GAME_STATE).includes('victory'));
});

test('armor absorbs first; reserves revive with protection and retain the build', () => {
  const upgradedPlayer = applyUpgrade(applyUpgrade(createCleanRun().player, 'damage'), 'piercing');
  const damaged = applyTroopDamage({ ...upgradedPlayer, troops: 2, armor: 3, plates: 3 }, 4);
  assert.deepEqual({ troops: damaged.player.troops, plates: damaged.player.plates, absorbed: damaged.absorbed, lost: damaged.lost }, { troops: 2, plates: 2, absorbed: 4, lost: 0 });
  const fatal = applyTroopDamage({ ...damaged.player, plates: 0, armor: 0, troops: 1 }, 1);
  assert.equal(fatal.player.troops, 0);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.PLAYING, 1), GAME_STATE.RECOVERY);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.BOSS, 0), GAME_STATE.GAME_OVER);

  const session = { ...createCleanRun(8, 'elite'), lives: 2, score: 500, skillPoints: 6, player: { ...fatal.player, power: 2, pierce: 1, recovery: 2 } };
  const revived = reviveSession(session);
  assert.equal(revived.revived, true);
  assert.equal(revived.session.lives, 1);
  assert.equal(revived.session.player.troops, DIFFICULTIES.elite.recoveryTroops + 6);
  assert.equal(revived.session.player.protectedFor, 3);
  assert.equal(revived.session.player.power, 2);
  assert.equal(revived.session.player.pierce, 1);
  assert.equal(revived.session.score, 500);
  assert.equal(revived.session.skillPoints, 6);
});

test('kill rewards grant milestone and elite skill points only once', () => {
  const milestone = claimKillReward({ type: 'grunt', rewarded: false }, 20);
  assert.equal(milestone.reward.points, 53); // v2: 13 base + 40 streak
  const elite = claimKillReward({ type: 'heavy', rewarded: false }, 25);
  assert.equal(elite.reward.points, 39);
  assert.equal(claimKillReward(elite.enemy, 26).reward, null);
});

test('clean retry resets every session value and transient collection', () => {
  const dirty = createCleanRun(9, 'elite');
  dirty.wave = 30;
  dirty.score = 999;
  dirty.points = 1200;
  dirty.lives = 2;
  dirty.player = applyUpgrade(dirty.player, 'damage');
  dirty.purchaseCounts.damage = 1;
  dirty.upgradeTiers.damage = 1;
  for (const key of ['bullets', 'enemyBullets', 'enemies', 'gates', 'hazards', 'particles', 'floaters', 'muzzleFlashes', 'telegraphs']) dirty[key].push({});
  dirty.boss = {};

  const retry = createCleanRun(10, 'veteran');
  assert.equal(retry.wave, 1);
  assert.equal(retry.score, 0);
  assert.equal(retry.points, 0);
  assert.equal(retry.lives, 0);
  assert.deepEqual(retry.purchaseCounts, {});
  assert.deepEqual(retry.upgradeTiers, {});
  for (const key of ['bullets', 'enemyBullets', 'enemies', 'gates', 'hazards', 'particles', 'floaters', 'muzzleFlashes', 'telegraphs']) assert.deepEqual(retry[key], []);
  assert.equal(retry.boss, null);
});

test('visible squad sprites remain individual through stress scale', () => {
  assert.deepEqual([1, 14, 32, 60, 1000].map(value => visibleSquadCount(value)), [1, 14, 24, 24, 24]);
  assert.equal(visibleSquadCount(240, 6), 24);
});

test('the runtime only persists local personal records, never run progression', () => {
  const runtime = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(runtime.includes("const RECORDS_KEY = 'blastline-records-v1'"));
  assert.ok(!runtime.includes('indexed' + 'DB'));
  assert.ok(!runtime.includes('blastline-save'));
  assert.ok(!runtime.includes('session' + 'Storage'));
  assert.ok(!html.includes('LIFETIME'));
  assert.ok(!html.includes('VICTORY'));
  assert.ok(html.includes('<small>BEST COMBO</small><b id="homeBestCombo">×0</b>'));
  assert.ok(!html.includes('id="homeRuns"'));
  assert.deepEqual(ACTIVE_STATES, [GAME_STATE.PLAYING, GAME_STATE.BOSS, GAME_STATE.RECOVERY]);
});

test('fresh run initializes combo chase values without leaking records into combat state', () => {
  const run = createCleanRun(77, 'veteran');
  assert.equal(run.combo, 0);
  assert.equal(run.comboTimer, 0);
  assert.equal(run.bestCombo, 0);
  assert.equal('bestScore' in run, false);
});
