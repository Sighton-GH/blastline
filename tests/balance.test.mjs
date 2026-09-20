import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILD_ARCHETYPES, runBalanceMatrix, simulateRun } from '../src/balance.mjs';

test('balance simulation is deterministic', () => {
  assert.deepEqual(
    simulateRun({ seed: 77, difficulty: 'elite', build: 'piercing' }),
    simulateRun({ seed: 77, difficulty: 'elite', build: 'piercing' }),
  );
});

test('100-seed difficulty matrix separates approachable, intended, and punishing modes', () => {
  const matrix = runBalanceMatrix({ seeds: 100, maxWaves: 30 });
  assert.equal(matrix.recruit.balanced.seeds, 100);
  assert.ok(matrix.recruit.balanced.meanWaves > matrix.veteran.balanced.meanWaves);
  assert.ok(matrix.veteran.balanced.meanWaves > matrix.elite.balanced.meanWaves);
  assert.ok(matrix.recruit.weak.meanWaves > matrix.elite.weak.meanWaves);
  assert.ok(matrix.elite.weak.completed < .15, 'Elite should regularly defeat a weak build');
  // 2026-09-19 2x pressure curve (owner steering): recruit stays the approachable tier -
  // an unfocused sensible build reaches the teens, and a focused build can snowball on
  // the doubled kill economy. The crude sim pilot cannot survive 2x veteran/elite, so
  // veteran/elite bands assert ordering and punishment, not human-calibrated depths.
  assert.ok(matrix.recruit.balanced.medianWaves >= 12, 'Recruit should stay approachable with a sensible build');
  for (const build of ['damage', 'fireRate', 'piercing']) {
    assert.ok(matrix.recruit[build].reachedWave20 >= .5, `Recruit ${build} focus should be able to snowball`);
  }
  assert.ok(matrix.veteran.balanced.medianWaves >= 5, 'Veteran should not be instant-death for the sim pilot');
  for (const diff of ['recruit', 'veteran', 'elite']) {
    assert.ok(matrix[diff].weak.medianWaves <= 3, `${diff} should punish a weak build early`);
  }
});

test('specialized Veteran archetypes remain viable without one mandatory build', () => {
  const matrix = runBalanceMatrix({ seeds: 100, maxWaves: 20 });
  for (const build of Object.keys(BUILD_ARCHETYPES).filter(name => !['weak', 'balanced'].includes(name))) {
    // 2026-09-19 2x pressure curve: the sim pilot saturates on veteran (builds die
    // waves 5-7 regardless of focus), so the band guards total collapse, not depth.
    assert.ok(matrix.veteran[build].medianWaves >= 5, `${build} specialization collapsed too early`);
  }
});
