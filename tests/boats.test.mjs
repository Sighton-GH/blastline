import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOAT_TUNING,
  boatReinforcementSize,
  createBoatFleet,
  spawnBoat,
  updateBoatFleet,
} from '../src/boats.mjs';

test('reinforcement size scales with wave and caps, robust to bad input', () => {
  assert.equal(boatReinforcementSize(1), 3);
  assert.equal(boatReinforcementSize(5), 3);
  assert.equal(boatReinforcementSize(6), 4);
  assert.equal(boatReinforcementSize(26), 8);
  assert.equal(boatReinforcementSize(10_000), 8);
  assert.equal(boatReinforcementSize(NaN), 3);
  assert.equal(boatReinforcementSize(Infinity), 3);
  assert.equal(boatReinforcementSize(-4), 3);
  // Always below the squad upgrade track's +8/tier and gates' +10/+16.
  assert.ok(boatReinforcementSize(500) < 10);
});

test('first boat launches after the opening delay, not before', () => {
  const fleet = createBoatFleet();
  const steps = seconds => { for (let i = 0; i < Math.round(seconds * 60); i += 1) updateBoatFleet(fleet, 1 / 60, { wave: 1 }); };
  steps(BOAT_TUNING.firstSpawnDelay - 0.1);
  assert.equal(fleet.boats.length, 0);
  steps(0.2);
  assert.equal(fleet.boats.length, 1);
  assert.equal(fleet.boats[0].phase, 'inbound');
  // Spawned at the channel entrance and only a few ticks into its approach.
  assert.ok(fleet.boats[0].y >= BOAT_TUNING.spawnY);
  assert.ok(fleet.boats[0].y < BOAT_TUNING.spawnY + 0.02);
});

test('launches alternate water channels', () => {
  const fleet = createBoatFleet();
  const first = spawnBoat(fleet, 1);
  const second = spawnBoat(fleet, 1);
  const third = spawnBoat(fleet, 1);
  assert.equal(first.side, 1);
  assert.equal(second.side, -1);
  assert.equal(third.side, 1);
});

test('explicit side override does not disturb the alternation', () => {
  const fleet = createBoatFleet();
  spawnBoat(fleet, 1, { side: -1 });
  assert.equal(spawnBoat(fleet, 1).side, 1);
});

test('boat docks, delivers exactly once, unloads, departs, despawns', () => {
  const fleet = createBoatFleet();
  const deliveries = [];
  const context = { wave: 6, worldScroll: 0.15, onDeliver: boat => deliveries.push({ ...boat }) };
  const boat = spawnBoat(fleet, 6);
  fleet.spawnTimer = 10_000; // isolate this lifecycle from automatic launches
  assert.equal(boat.troops, 4); // 3 + floor((6-1)/5)

  // Sail until docked.
  for (let i = 0; i < 400 && boat.phase === 'inbound'; i += 1) updateBoatFleet(fleet, 1 / 60, context);
  assert.equal(boat.phase, 'unloading');
  assert.equal(boat.y, BOAT_TUNING.dockY);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].troops, 4);
  assert.equal(fleet.delivered, 1);
  assert.equal(fleet.deliveredTroops, 4);

  // Holds station at dockY while unloading even though the world scrolls.
  updateBoatFleet(fleet, 1, context);
  assert.equal(boat.y, BOAT_TUNING.dockY);
  assert.equal(deliveries.length, 1);

  // Departs and eventually despawns past the near edge.
  for (let i = 0; i < 600 && fleet.boats.length; i += 1) updateBoatFleet(fleet, 1 / 60, context);
  assert.equal(fleet.boats.length, 0);
  assert.equal(deliveries.length, 1);
});

test('no second launch until the interval elapses; fleet cap defers spawns', () => {
  const fleet = createBoatFleet();
  spawnBoat(fleet, 1);
  spawnBoat(fleet, 1); // both channels busy
  fleet.spawnTimer = 0.01;
  updateBoatFleet(fleet, 0.02, { wave: 1 });
  assert.equal(fleet.boats.length, BOAT_TUNING.maxActive);
  assert.equal(fleet.spawnTimer, BOAT_TUNING.retryDelay);
});

test('zero and oversized dt are safe; simulation stays deterministic', () => {
  const runSim = () => {
    const fleet = createBoatFleet();
    const context = { wave: 9, worldScroll: 0.16, onDeliver: () => {} };
    for (let i = 0; i < 60 * 90; i += 1) updateBoatFleet(fleet, 1 / 60, context);
    return { boats: fleet.boats.map(b => ({ side: b.side, y: +b.y.toFixed(6), phase: b.phase, troops: b.troops })), delivered: fleet.delivered };
  };
  const a = runSim();
  const b = runSim();
  assert.deepEqual(a, b);

  const idle = createBoatFleet();
  updateBoatFleet(idle, 0, { wave: 1 });
  updateBoatFleet(idle, NaN, { wave: 1 });
  assert.equal(idle.boats.length, 0);
  updateBoatFleet(idle, 999, { wave: 1 }); // clamped, single bounded step
  assert.ok(idle.boats.length <= 1);
});

test('troop size at spawn snapshots the wave; later waves do not retcon it', () => {
  const fleet = createBoatFleet();
  const boat = spawnBoat(fleet, 1);
  assert.equal(boat.troops, 3);
  const late = spawnBoat(fleet, 30);
  assert.equal(late.troops, 8);
});
