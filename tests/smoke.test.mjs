import assert from 'node:assert/strict';
import {
  GAME_STATE,
  applyGate,
  createCleanRun,
  initialPlayer,
  makeGatePair,
  mulberry32,
  pickUpgradeSet,
  squadColumnCount,
  visibleSquadCount,
} from '../src/core.mjs';

const rng = mulberry32(42);
const player = initialPlayer();
assert.equal(player.troops, 12);
assert.equal(player.armor, 0);
assert.equal(player.bulletSpeed, 1);
const [left, right] = makeGatePair(rng, 1);
assert.ok(left?.kind && right?.kind);
assert.equal(applyGate(player, { kind: 'troops', value: 5 }).troops, 17);
assert.equal(pickUpgradeSet(rng).length, 3);
assert.deepEqual([1,5,10,20,50,100,999].map(visibleSquadCount), [1,5,10,20,28,36,42]);
assert.equal(squadColumnCount(12), 6);
assert.equal(squadColumnCount(42), 7);
assert.equal(createCleanRun(42).state, GAME_STATE.PLAYING);
