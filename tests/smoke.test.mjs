import assert from 'node:assert/strict';
import { initialPlayer, makeGatePair, applyGate, pickUpgradeSet, mulberry32 } from '../src/core.mjs';

const rng = mulberry32(42);
const player = initialPlayer();
assert.equal(player.troops, 12);
const [a,b] = makeGatePair(rng, 1);
assert.ok(a && b && a.kind && b.kind);
const updated = applyGate(player, {kind:'troops', value:5});
assert.equal(updated.troops, 17);
const set = pickUpgradeSet(rng);
assert.equal(set.length, 3);
console.log('smoke ok');
