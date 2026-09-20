import test from 'node:test';
import assert from 'node:assert/strict';
import {
  META_TRACKS, defaultProfile, loadProfile, saveProfile, purchaseMeta,
  salvageForRun, offlineAccrual, startingBonuses, recordRunEnd, metaCost, META_KEY,
} from '../src/meta.mjs';

function fakeStorage() {
  const map = new Map();
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
}

test('profile round-trips through storage', () => {
  const storage = fakeStorage();
  const profile = { ...defaultProfile(), salvage: 77, tiers: { startingTroops: 3 }, runs: 2 };
  saveProfile(profile, storage);
  assert.equal(storage.getItem(META_KEY) !== null, true);
  const loaded = loadProfile(storage);
  assert.equal(loaded.salvage, 77);
  assert.equal(loaded.tiers.startingTroops, 3);
  assert.equal(loaded.runs, 2);
});

test('corrupt or missing storage falls back to a default profile', () => {
  const storage = fakeStorage();
  storage.setItem(META_KEY, '{not json');
  assert.deepEqual(loadProfile(storage), defaultProfile());
  assert.deepEqual(loadProfile(fakeStorage()), defaultProfile());
});

test('meta purchases spend salvage, apply tiers, and respect caps and funds', () => {
  let profile = { ...defaultProfile(), salvage: metaCost('startingTroops', 0) };
  const bought = purchaseMeta(profile, 'startingTroops');
  assert.equal(bought.ok, true);
  assert.equal(bought.profile.salvage, 0);
  assert.equal(bought.profile.tiers.startingTroops, 1);
  assert.equal(purchaseMeta(bought.profile, 'startingTroops').ok, false);
  const capped = { ...defaultProfile(), salvage: 1e9, tiers: { startingTroops: META_TRACKS.find(t => t.id === 'startingTroops').maxTier } };
  assert.equal(purchaseMeta(capped, 'startingTroops').reason, 'capped');
});

test('starting bonuses scale with tiers', () => {
  const profile = { ...defaultProfile(), tiers: { startingPower: 8, startingTroops: 5 } };
  assert.deepEqual(startingBonuses(profile), { power: 2, troops: 20 });
});

test('salvage rewards deeper runs and scavenger tiers multiply it', () => {
  const base = salvageForRun({ score: 5000, wave: 10, bossesDefeated: 3 }, defaultProfile());
  const boosted = salvageForRun({ score: 5000, wave: 10, bossesDefeated: 3 }, { ...defaultProfile(), tiers: { salvageRate: 10 } });
  assert.ok(base >= 1);
  assert.ok(boosted > base);
});

test('offline cache accrues with supply-line scaling and an 8h cap', () => {
  const now = Date.now();
  const fourHours = offlineAccrual({ ...defaultProfile(), lastSeen: now - 4 * 3600e3 }, now);
  assert.equal(fourHours.salvage, 40);
  const boosted = offlineAccrual({ ...defaultProfile(), tiers: { offlineRate: 10 }, lastSeen: now - 4 * 3600e3 }, now);
  assert.equal(boosted.salvage, 64);
  const week = offlineAccrual({ ...defaultProfile(), lastSeen: now - 7 * 24 * 3600e3 }, now);
  assert.equal(week.salvage, 80);
  assert.equal(week.capped, true);
});

test('recordRunEnd banks salvage, records bests, and stamps lastSeen', () => {
  const now = Date.now();
  const { profile, earned } = recordRunEnd(defaultProfile(), { score: 4200, wave: 9, bossesDefeated: 3 }, now);
  assert.ok(earned > 0);
  assert.equal(profile.salvage, earned);
  assert.deepEqual(profile.best, { wave: 9, score: 4200 });
  assert.equal(profile.lastSeen, now);
  assert.equal(profile.runs, 1);
  const second = recordRunEnd(profile, { score: 100, wave: 2, bossesDefeated: 0 }, now + 1000);
  assert.deepEqual(second.profile.best, { wave: 9, score: 4200 });
});
