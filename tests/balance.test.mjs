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
  assert.ok(matrix.recruit.balanced.reachedWave20 >= .5, 'Recruit should be approachable with a sensible build');
});

test('specialized Veteran archetypes remain viable without one mandatory build', () => {
  const matrix = runBalanceMatrix({ seeds: 100, maxWaves: 20 });
  for (const build of Object.keys(BUILD_ARCHETYPES).filter(name => !['weak', 'balanced'].includes(name))) {
    assert.ok(matrix.veteran[build].medianWaves >= 8, `${build} specialization collapsed too early`);
  }
});
