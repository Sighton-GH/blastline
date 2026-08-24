import assert from 'node:assert/strict';
import {
  GAME_STATE,
  createCleanRun,
  getWaveConfig,
  laneContains,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  pickBossRewards,
  purchaseUpgrade,
} from '../src/core.mjs';

const rng = mulberry32(42);
const run = createCleanRun(42, 'veteran');
assert.equal(run.phase, GAME_STATE.PLAYING);
assert.equal(run.wave, 1);
assert.equal(run.player.troops, 14);
assert.equal(getWaveConfig(500).duration, 48);
const encounter = makeGateEncounter(1, makeGatePair(rng, 4), -.06, rng);
assert.equal(encounter.gates.length, 2);
assert.ok(encounter.gates.every(gate => laneContains(gate.lane, gate.x)));
assert.equal(pickBossRewards(rng, run).length, 3);
const funded = { ...run, skillPoints: 20 };
assert.equal(purchaseUpgrade(funded, 'reinforcements').session.player.troops, 24);
