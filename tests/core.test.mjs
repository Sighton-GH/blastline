import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  UPGRADES,
  applyGate,
  applyUpgrade,
  gateText,
  initialPlayer,
  makeGatePair,
  mulberry32,
  pickUpgradeSet,
} from '../src/core.mjs';

test('seeded RNG is deterministic', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('troop multiplier is capped and troop loss cannot empty the squad', () => {
  assert.equal(applyGate({ ...initialPlayer(), troops: 600 }, { kind: 'troopsMul', value: 2 }).troops, 999);
  assert.equal(applyGate({ ...initialPlayer(), troops: 2 }, { kind: 'troops', value: -10 }).troops, 1);
});

test('each upgrade changes its intended player property', () => {
  const player = initialPlayer();
  assert.equal(applyUpgrade(player, 'troops').troops, player.troops + 12);
  assert.equal(applyUpgrade(player, 'power').power, player.power + 1);
  assert.ok(applyUpgrade(player, 'rate').fireRate > player.fireRate);
  assert.equal(applyUpgrade(player, 'spread').projectiles, player.projectiles + 1);
  assert.equal(applyUpgrade(player, 'coins').coins, player.coins + 600);
});

test('gate pairs contain one reward and one penalty with display text', () => {
  for (let seed = 1; seed < 100; seed += 1) {
    const gates = makeGatePair(mulberry32(seed), seed % LEVELS.length);
    const penalties = gates.filter(gate => gate.kind === 'slow' || (gate.kind === 'troops' && gate.value < 0));
    assert.equal(gates.length, 2);
    assert.equal(penalties.length, 1);
    assert.ok(gates.every(gate => gateText(gate).length > 0));
  }
});

test('upgrade choices are unique without mutating the catalog', () => {
  const originalIds = UPGRADES.map(({ id }) => id);
  const picked = pickUpgradeSet(mulberry32(7));
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map(({ id }) => id)).size, 3);
  assert.deepEqual(UPGRADES.map(({ id }) => id), originalIds);
});

test('difficulty escalates across authored levels', () => {
  for (let index = 1; index < LEVELS.length; index += 1) {
    const previous = LEVELS[index - 1];
    const current = LEVELS[index];
    assert.ok(current.length > previous.length);
    assert.ok(current.enemies > previous.enemies);
    assert.ok(current.bossHp > previous.bossHp);
    assert.ok(current.speed >= previous.speed);
    assert.ok(current.spawn < previous.spawn);
  }
});
