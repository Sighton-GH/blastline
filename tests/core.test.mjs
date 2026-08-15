import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_STATE,
  LEVELS,
  MAX_FIRE_RATE,
  MAX_PROJECTILES,
  UPGRADES,
  applyGate,
  applyTroopDamage,
  applyUpgrade,
  claimKillReward,
  createCleanRun,
  gateText,
  initialPlayer,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  pickUpgradeSet,
  resolveGateEncounter,
  stateAfterBossDefeat,
  stateAfterTroopDamage,
  visibleSquadCount,
} from '../src/core.mjs';

test('seeded RNG is deterministic', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('gate effects obey troop caps and a harmful gate cannot empty the squad', () => {
  assert.equal(applyGate({ ...initialPlayer(), troops: 600 }, { kind: 'troopsMul', value: 2 }).troops, 999);
  assert.equal(applyGate({ ...initialPlayer(), troops: 998 }, { kind: 'troops', value: 20 }).troops, 999);
  assert.equal(applyGate({ ...initialPlayer(), troops: 2 }, { kind: 'troops', value: -10 }).troops, 1);
});

test('a gate encounter resolves at most one option and preserves a true neutral gap', () => {
  const gates = [
    { kind: 'troops', value: 8, label: value => `+${value}` },
    { kind: 'troops', value: -5, label: value => `${value}` },
  ];
  const encounter = makeGateEncounter(1, gates);
  const first = resolveGateEncounter(encounter, -0.36);
  assert.equal(first.gate.value, 8);
  assert.equal(first.encounter.resolved, true);
  assert.equal(resolveGateEncounter(first.encounter, 0.36).gate, null);

  const neutral = resolveGateEncounter(makeGateEncounter(2, gates), 0);
  assert.equal(neutral.gate, null);
  assert.equal(neutral.encounter.resolved, true);
});

test('generated pairs contain one reward and one penalty with runtime text', () => {
  for (let seed = 1; seed < 100; seed += 1) {
    const gates = makeGatePair(mulberry32(seed), seed % LEVELS.length);
    const penalties = gates.filter(gate => gate.kind === 'slow' || (gate.kind === 'troops' && gate.value < 0));
    assert.equal(gates.length, 2);
    assert.equal(penalties.length, 1);
    assert.ok(gates.every(gate => gateText(gate).length > 0));
  }
});

test('three upgrade choices are unique and do not mutate the catalog', () => {
  const originalIds = UPGRADES.map(({ id }) => id);
  for (let seed = 1; seed < 20; seed += 1) {
    const picked = pickUpgradeSet(mulberry32(seed));
    assert.equal(picked.length, 3);
    assert.equal(new Set(picked.map(({ id }) => id)).size, 3);
  }
  assert.deepEqual(UPGRADES.map(({ id }) => id), originalIds);
});

test('every canonical upgrade applies and run upgrades stack', () => {
  const start = initialPlayer();
  assert.equal(applyUpgrade(start, 'troops').troops, 24);
  assert.equal(applyUpgrade(start, 'power').power, 2);
  assert.equal(applyUpgrade(start, 'rate').fireRate, start.fireRate * 1.2);
  assert.equal(applyUpgrade(start, 'spread').projectiles, 2);
  assert.equal(applyUpgrade(start, 'velocity').bulletSpeed, 1.2);
  assert.equal(applyUpgrade(start, 'armor').armor, 3);

  let stacked = start;
  for (let index = 0; index < 8; index += 1) stacked = applyUpgrade(stacked, 'spread');
  assert.equal(stacked.projectiles, MAX_PROJECTILES);
  stacked = applyUpgrade(applyUpgrade(stacked, 'power'), 'power');
  assert.equal(stacked.power, 3);
  for (let index = 0; index < 20; index += 1) stacked = applyUpgrade(stacked, 'rate');
  assert.equal(stacked.fireRate, MAX_FIRE_RATE);
});

test('difficulty escalates across exactly six authored horde waves', () => {
  assert.equal(LEVELS.length, 6);
  assert.ok(LEVELS.every(level => level.enemies >= 72));
  assert.ok(LEVELS.every(level => level.horde >= 12));
  assert.ok(LEVELS.every(level => level.spawn >= 3), 'spawn cadence should represent horde intervals, not single-enemy spam');
  for (let index = 1; index < LEVELS.length; index += 1) {
    const previous = LEVELS[index - 1];
    const current = LEVELS[index];
    assert.ok(current.length > previous.length);
    assert.ok(current.enemies > previous.enemies);
    assert.ok(current.horde > previous.horde);
    assert.ok(current.bossHp > previous.bossHp);
    assert.ok(current.speed >= previous.speed);
    assert.ok(current.spawn < previous.spawn);
  }
});

test('armor absorbs damage first and combat can reduce troops to zero', () => {
  const armored = { ...initialPlayer(), troops: 2, armor: 3 };
  const first = applyTroopDamage(armored, 4);
  assert.deepEqual({ troops: first.player.troops, armor: first.player.armor, absorbed: first.absorbed, lost: first.lost }, { troops: 1, armor: 0, absorbed: 3, lost: 1 });
  const fatal = applyTroopDamage(first.player, 1);
  assert.equal(fatal.player.troops, 0);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.PLAYING), GAME_STATE.GAME_OVER);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.BOSS), GAME_STATE.GAME_OVER);
});

test('bosses on waves 1–5 lead to upgrade and wave 6 leads to Victory', () => {
  for (let waveIndex = 0; waveIndex < LEVELS.length - 1; waveIndex += 1) {
    assert.equal(stateAfterBossDefeat(waveIndex), GAME_STATE.UPGRADE);
  }
  assert.equal(stateAfterBossDefeat(LEVELS.length - 1), GAME_STATE.VICTORY);
});

test('an enemy kill reward can be claimed only once', () => {
  const first = claimKillReward({ type: 'elite', rewarded: false });
  assert.deepEqual(first.reward, { score: 58, coins: 12, frenzy: 3 });
  const duplicate = claimKillReward(first.enemy);
  assert.equal(duplicate.reward, null);
});

test('Retry/new run creates clean base stats and clears every transient collection', () => {
  const dirty = createCleanRun(7);
  dirty.player = applyUpgrade(applyUpgrade(dirty.player, 'power'), 'armor');
  dirty.score = 999;
  dirty.waveIndex = 5;
  dirty.bullets.push({});
  dirty.enemyBullets.push({});
  dirty.enemies.push({});
  dirty.gates.push({});
  dirty.particles.push({});
  dirty.floaters.push({});
  dirty.muzzleFlashes.push({});
  dirty.telegraphs.push({});
  dirty.boss = {};

  const retry = createCleanRun(8);
  assert.equal(retry.state, GAME_STATE.PLAYING);
  assert.equal(retry.waveIndex, 0);
  assert.equal(retry.score, 0);
  assert.deepEqual(retry.player, initialPlayer());
  for (const key of ['bullets','enemyBullets','enemies','gates','particles','floaters','muzzleFlashes','telegraphs']) {
    assert.deepEqual(retry[key], []);
  }
  assert.equal(retry.boss, null);
});

test('visible squad count compresses large logical squads', () => {
  assert.deepEqual([1, 5, 20, 50, 100, 999].map(visibleSquadCount), [1, 5, 20, 28, 36, 42]);
});
