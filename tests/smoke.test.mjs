import assert from 'node:assert/strict';
import { initialPlayer, makeGatePair, applyGate, pickUpgradeSet, mulberry32, visibleSquadCount, squadColumnCount } from '../src/core.mjs';

const rng = mulberry32(42);
const player = initialPlayer();
assert.equal(player.troops, 12);
const [a,b] = makeGatePair(rng, 1);
assert.ok(a && b && a.kind && b.kind);
const updated = applyGate(player, {kind:'troops', value:5});
assert.equal(updated.troops, 17);
const set = pickUpgradeSet(rng);
assert.equal(set.length, 3);
assert.deepEqual([1,5,10,20,50,100,999].map(visibleSquadCount), [1,5,10,20,28,36,42]);
assert.equal(squadColumnCount(12), 6);
assert.equal(squadColumnCount(42), 7);
console.log('smoke ok');
