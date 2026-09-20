import test from 'node:test';
import assert from 'node:assert/strict';
import { BOTS, MECHANICS_V1, MECHANICS_V2, runPolicyMatrix, simulatePolicyRun } from '../src/balance2.mjs';

test('v2 policy sim is deterministic', () => {
  assert.deepEqual(
    simulatePolicyRun({ seed: 42, difficulty: 'veteran', bot: 'glassCannon', mechanics: MECHANICS_V2 }),
    simulatePolicyRun({ seed: 42, difficulty: 'veteran', bot: 'glassCannon', mechanics: MECHANICS_V2 }),
  );
});

test('v1 live mechanics show the saturated threat curve (regression witness)', () => {
  // Owner critique 2026-09-19: on the live curve the threat saturates while the
  // player keeps growing, so focused builds survive far beyond the v2 window.
  // Relative guardrail (the sim is not human-calibrated): v1 focused builds must
  // dramatically outlast their v2 counterparts.
  const v1 = runPolicyMatrix({ seeds: 12, mechanics: MECHANICS_V1, maxWaves: 40 });
  const v2 = runPolicyMatrix({ seeds: 12, mechanics: MECHANICS_V2, maxWaves: 40 });
  assert.ok(v1.veteran.bryansMeta.medianWaves >= v2.veteran.bryansMeta.medianWaves + 8,
    `v1 meta build (${v1.veteran.bryansMeta.medianWaves}) should far outlast v2 (${v2.veteran.bryansMeta.medianWaves})`);
  assert.ok(v1.veteran.balanced.medianWaves >= v2.veteran.balanced.medianWaves + 8,
    `v1 balanced (${v1.veteran.balanced.medianWaves}) should far outlast v2 (${v2.veteran.balanced.medianWaves})`);
});

test('v2 ends veteran runs inside the 5-10 minute window with no dominant strategy', () => {
  const matrix = runPolicyMatrix({ seeds: 30, mechanics: MECHANICS_V2, maxWaves: 40 });
  const focused = Object.keys(BOTS).filter(name => name !== 'weak');
  const medians = focused.map(name => matrix.veteran[name].medianWaves);
  for (const name of focused) {
    const median = matrix.veteran[name].medianWaves;
    assert.ok(median >= 8 && median <= 20, `${name} median ${median} outside the 5-10 min window (waves 8-20)`);
  }
  const best = Math.max(...medians);
  const worst = Math.min(...medians);
  assert.ok(best - worst <= 6, `build spread too wide (${worst}-${best}): a dominant strategy is emerging`);
  assert.ok(matrix.veteran.weak.medianWaves <= 7, 'negligent play must be punished early');
  assert.ok(matrix.recruit.balanced.medianWaves >= matrix.veteran.balanced.medianWaves, 'recruit must not be harder than veteran');
  assert.ok(matrix.elite.balanced.medianWaves <= matrix.veteran.balanced.medianWaves, 'elite must not be easier than veteran');
});
