import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ACTIVE_STATES,
  DIFFICULTIES,
  GAME_STATE,
  GATE_LIBRARY,
  LANE_CENTERS,
  MAX_ACTIVE_ENEMIES,
  MAX_FIRE_RATE,
  MAX_LIVES,
  MAX_PROJECTILES,
  SHOP_CATALOG,
  applyBossReward,
  applyGate,
  applyTroopDamage,
  applyUpgrade,
  claimKillReward,
  createCleanRun,
  getWaveConfig,
  laneBounds,
  laneCenter,
  laneContains,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  pickBossRewards,
  purchaseUpgrade,
  buildLines,
  SHOP_BY_ID,
  squadRoleForSlot,
  MAX_BUILD_LINES,
  MAX_BUILD_ITEMS_BASE,
  ITEM_CAP_PER_BOSS,
  itemCapFor,
  buildItemCount,
  isItemCapped,
  isUpgradeCapped,
  upgradeTier,
  enemyHitPoints,
  GENERIC_HP_GROWTH,
  isLineLocked,
  exclusiveLockFor,
  enemyContactDamage,
  UTILITY_UPGRADES,
  resolveGateEncounter,
  reviveSession,
  shopPrice,
  stateAfterBossDefeat,
  stateAfterTroopDamage,
  visibleSquadCount,
} from '../src/core.mjs';

test('seeded RNG remains deterministic', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()]);
});

test('wave generation is endless, bounded, and numerically stable', () => {
  for (const difficulty of Object.keys(DIFFICULTIES)) {
    for (const wave of [1, 2, 10, 100, 10_000, 1_000_000, Infinity, NaN]) {
      const config = getWaveConfig(wave, difficulty);
      assert.ok(Number.isFinite(config.duration));
      assert.ok(Number.isFinite(config.activeTarget));
      assert.ok(Number.isFinite(config.bossHp));
      assert.ok(config.duration >= 26 && config.duration <= 38);
      assert.ok(config.activeTarget > 0 && config.activeTarget <= MAX_ACTIVE_ENEMIES);
      assert.ok(config.hordeSize > 0 && config.hordeSize <= 84); // 84 = 2x-pressure curve horde cap (2026-09-19)
      assert.ok(config.spawnInterval >= .5); // 2x-pressure curve spawn floor (2026-09-19)
      assert.ok(config.enemySpeed > 0 && config.enemySpeed < .1);
      const compositionTotal = Object.values(config.composition).reduce((sum, chance) => sum + chance, 0);
      assert.ok(Math.abs(compositionTotal - 1) < 1e-9);
    }
  }
  assert.equal(getWaveConfig(1_000_000).duration, 38);
  assert.equal(getWaveConfig(1_000_000).activeTarget, MAX_ACTIVE_ENEMIES);
  assert.ok(getWaveConfig(30).bossHp > getWaveConfig(1).bossHp);
});

test('difficulty changes density and pressure without changing wave duration', () => {
  for (const wave of [1, 8, 20]) {
    const recruit = getWaveConfig(wave, 'recruit');
    const veteran = getWaveConfig(wave, 'veteran');
    const elite = getWaveConfig(wave, 'elite');
    assert.ok(recruit.activeTarget < veteran.activeTarget);
    assert.ok(veteran.activeTarget < elite.activeTarget || elite.activeTarget === MAX_ACTIVE_ENEMIES);
    assert.ok(recruit.pressure < veteran.pressure && veteran.pressure < elite.pressure);
    assert.ok(recruit.spawnInterval > veteran.spawnInterval && veteran.spawnInterval > elite.spawnInterval);
    assert.equal(recruit.duration, veteran.duration);
    assert.equal(veteran.duration, elite.duration);
  }
});

test('canonical lanes are disjoint and all lane-bound objects fit their lane', () => {
  assert.deepEqual(LANE_CENTERS.map((_, lane) => laneCenter(lane)), [...LANE_CENTERS]);
  for (let lane = 0; lane < 3; lane += 1) {
    const bounds = laneBounds(lane);
    assert.ok(laneContains(lane, bounds.center));
    assert.ok(laneContains(lane, bounds.min));
    assert.ok(laneContains(lane, bounds.max));
    if (lane < 2) assert.ok(bounds.max < laneBounds(lane + 1).min);
  }
  for (let seed = 1; seed <= 100; seed += 1) {
    const encounter = makeGateEncounter(seed, makeGatePair(mulberry32(seed), 5), -.06, mulberry32(seed * 7));
    assert.equal(encounter.gates.length, 2);
    assert.equal(new Set(encounter.gates.map(gate => gate.lane)).size, 2);
    assert.ok(!encounter.gates.some(gate => gate.lane === encounter.neutralLane));
    assert.ok(encounter.gates.every(gate => laneContains(gate.lane, gate.x)));
  }
});

test('gate decisions resolve once with a true neutral lane', () => {
  const encounter = makeGateEncounter(1, [GATE_LIBRARY[2], GATE_LIBRARY[4]], .4, () => .4);
  const leftGate = encounter.gates[0];
  const first = resolveGateEncounter(encounter, leftGate.x);
  assert.equal(first.gate.id, leftGate.id);
  assert.equal(first.encounter.resolved, true);
  assert.equal(resolveGateEncounter(first.encounter, encounter.gates[1].x).gate, null);
  const neutral = resolveGateEncounter(makeGateEncounter(2, [GATE_LIBRARY[2], GATE_LIBRARY[4]], .4, () => .4), laneCenter(1));
  assert.equal(neutral.gate, null);
  assert.equal(neutral.encounter.selected, null);
});

test('Wave 1 teaches a positive/negative choice and later waves offer tradeoffs', () => {
  const tutorial = makeGatePair(mulberry32(1), 1);
  assert.equal(tutorial[0].tone, 'blue');
  assert.equal(tutorial[1].tone, 'red');
  assert.ok(tutorial[0].effects[0].value > 0);
  assert.ok(tutorial[1].effects[0].value < 0);
  for (let seed = 1; seed <= 100; seed += 1) {
    const choices = makeGatePair(mulberry32(seed), 8);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 2);
    assert.ok(choices.every(choice => choice.effects.length >= 2));
  }
});

test('gate effects apply all benefits and costs while preserving safety caps', () => {
  const start = { ...createCleanRun().player, troops: 6, armor: 1, fireRate: 5 };
  const ranks = applyGate(start, GATE_LIBRARY.find(gate => gate.id === 'rapid-ranks'));
  assert.equal(ranks.troops, 22);
  assert.equal(ranks.fireRate, 4.4);
  const harmful = applyGate(start, { effects: [{ stat: 'troops', mode: 'add', value: -100 }] });
  assert.equal(harmful.troops, 1);
  const past16 = applyGate({ ...start, fireRate: 15 }, { effects: [{ stat: 'fireRate', mode: 'multiply', value: 2 }] });
  assert.equal(past16.fireRate, 30); // v2: no hard utility cap below the safety rail
  const railed = applyGate({ ...start, fireRate: 25 }, { effects: [{ stat: 'fireRate', mode: 'multiply', value: 2 }] });
  assert.equal(railed.fireRate, MAX_FIRE_RATE);
});

test('shop prices rise, spending is atomic, and insufficient points do nothing', () => {
  for (const item of SHOP_CATALOG) {
    const prices = [0, 1, 2, 3].map(count => shopPrice(item.id, count));
    assert.ok(prices.every(Number.isFinite));
    assert.ok(prices[0] < prices[1] && prices[1] < prices[2] && prices[2] < prices[3]);
  }
  const poor = createCleanRun(1);
  const failed = purchaseUpgrade(poor, 'damage');
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'insufficient');
  assert.deepEqual(failed.session, poor);

  const funded = { ...createCleanRun(2), points: 2_000 };
  const bought = purchaseUpgrade(funded, 'damage');
  assert.equal(bought.ok, true);
  assert.equal(bought.session.player.power, 2);
  assert.equal(bought.session.points, 2_000 - shopPrice('damage', 0));
  assert.equal(bought.session.purchaseCounts.damage, 1);
  assert.equal(bought.session.upgradeTiers.damage, 1);
});

test('v2 shop: polynomial stats are uncapped, design caps hold for multishot/crit/lives', () => {
  // bossesDefeated simulates a long run: each boss raises the item cap by
  // ITEM_CAP_PER_BOSS, so a veteran run can hold this many items at all.
  let session = { ...createCleanRun(3), points: 100_000_000, bossesDefeated: 30 };
  // Build caps allow at most MAX_BUILD_LINES distinct build lines; utility lines
  // (reinforcements, extraLife) are exempt. Each armory visit grants
  // MAX_PICKS_PER_VISIT purchases, so the loop resets armoryPicks to simulate
  // successive visits.
  const buildItems = ['damage', 'fireRate', 'multishot', 'piercing'].map(id => SHOP_BY_ID[id]);
  const utilityItems = SHOP_CATALOG.filter(item => UTILITY_UPGRADES.includes(item.id));
  for (const item of [...buildItems, ...utilityItems]) {
    const limit = item.id === 'extraLife' ? MAX_LIVES : 12;
    for (let count = 0; count < limit; count += 1) {
      session.armoryPicks = 0;
      session = purchaseUpgrade(session, item.id).session;
    }
  }
  assert.equal(buildLines(session).length, MAX_BUILD_LINES);
  // A fifth distinct build line is line-capped until an existing line is dropped.
  const fifth = SHOP_CATALOG.find(item => !UTILITY_UPGRADES.includes(item.id) && !buildItems.some(owned => owned.id === item.id));
  session.armoryPicks = 0;
  const blocked = purchaseUpgrade(session, fifth.id);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'line-capped');
  // Per-visit pick cap: two purchases succeed, the third is visit-capped.
  let visit = { ...createCleanRun(3), points: 100_000_000 };
  assert.equal(purchaseUpgrade(visit, 'damage').ok, true);
  visit = purchaseUpgrade(visit, 'damage').session;
  visit = purchaseUpgrade(visit, 'damage').session;
  const third = purchaseUpgrade(visit, 'damage');
  assert.equal(third.ok, false);
  assert.equal(third.reason, 'visit-capped');
  assert.equal(session.player.projectiles, MAX_PROJECTILES);
  assert.ok(session.player.fireRate <= MAX_FIRE_RATE);
  // fireRate is uncapped in v2: all 12 purchases apply (+0.4 each)
  assert.equal(session.upgradeTiers.fireRate, 12);
  assert.equal(session.lives, MAX_LIVES);
  let critPlayer = createCleanRun().player;
  for (let i = 0; i < 20; i += 1) critPlayer = applyUpgrade(critPlayer, 'criticalChance');
  assert.ok(critPlayer.criticalChance > .35, 'crit exceeds the old v1 cap');
  assert.ok(critPlayer.criticalChance <= .5, 'crit respects the v2 cap');
  assert.ok(session.player.pierce > 4, 'pierce exceeds the old v1 cap');
  assert.equal(session.player.power, 13); // 12 uncapped purchases
  let powerPlayer = createCleanRun().player;
  for (let i = 0; i < 20; i += 1) powerPlayer = applyUpgrade(powerPlayer, 'damage');
  assert.equal(powerPlayer.power, 21); // v2: power grows past the old 16 cap
  let firePlayer = createCleanRun().player;
  for (let i = 0; i < 30; i += 1) firePlayer = applyUpgrade(firePlayer, 'fireRate');
  assert.ok(firePlayer.fireRate > 16, 'fireRate exceeds the old v1 cap');
  assert.ok(session.player.plates <= 40);
});

test('squad roles follow owned build lines, weighted by tier', () => {
  const clean = createCleanRun(2);
  assert.equal(squadRoleForSlot(clean, 0), 'rifleman');
  assert.equal(squadRoleForSlot(clean, 7), 'rifleman');
  const session = { ...clean, upgradeTiers: { damage: 3, fireRate: 1 } };
  // 4 total tier weight: heavy claims 3 slots, gunner 1, repeating.
  assert.equal(squadRoleForSlot(session, 0), 'heavy');
  assert.equal(squadRoleForSlot(session, 1), 'heavy');
  assert.equal(squadRoleForSlot(session, 2), 'heavy');
  assert.equal(squadRoleForSlot(session, 3), 'gunner');
  assert.equal(squadRoleForSlot(session, 4), 'heavy');
});

test('item cap: base six items, bosses raise it, utility and free boss tiers exempt', () => {
  const fresh = createCleanRun(4);
  assert.equal(itemCapFor(fresh), MAX_BUILD_ITEMS_BASE);
  assert.equal(itemCapFor({ ...fresh, bossesDefeated: 3 }), MAX_BUILD_ITEMS_BASE + 3 * ITEM_CAP_PER_BOSS);
  // Utility tiers never count toward the item cap.
  const stocked = { ...fresh, upgradeTiers: { reinforcements: 9, extraLife: 2, damage: 3, fireRate: 3 } };
  assert.equal(buildItemCount(stocked), 6);
  assert.equal(isItemCapped(stocked, 'damage'), true);
  assert.equal(isItemCapped(stocked, 'reinforcements'), false);
  // At the cap, shop purchases of build lines are item-capped...
  const full = { ...stocked, purchaseCounts: { damage: 3, fireRate: 3 }, points: 100_000, armoryPicks: 0 };
  const blocked = purchaseUpgrade(full, 'damage');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'item-capped');
  // ...but utility buys still go through.
  assert.equal(purchaseUpgrade(full, 'reinforcements').ok, true);
  // A boss kill reopens the build.
  const afterBoss = { ...full, bossesDefeated: 1 };
  assert.equal(purchaseUpgrade(afterBoss, 'damage').ok, true);
  // The free boss-reward tier is exempt from the item cap.
  const rewarded = applyBossReward(full, 'piercing');
  assert.equal(rewarded.upgradeTiers.piercing, 1);
});

test('vehicles join the wave table on schedule and scale like enemies', () => {
  const early = getWaveConfig(5, 'veteran');
  assert.equal(early.composition.technical, 0);
  assert.equal(early.composition.transport, 0);
  const mid = getWaveConfig(10, 'veteran');
  assert.ok(mid.composition.technical > 0, 'gun trucks appear from wave 6');
  assert.ok(mid.composition.transport > 0, 'carriers appear from wave 8');
  const sum = Object.values(mid.composition).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'composition stays normalized');
  assert.ok(enemyHitPoints('transport', 1) > enemyHitPoints('heavy', 1));
  assert.ok(enemyContactDamage('transport', 1) > enemyContactDamage('heavy', 1));
  assert.ok(enemyHitPoints('transport', 10) > enemyHitPoints('transport', 1));
});

test('heavy ordnance sidegrade: burst form of the damage line, mutually exclusive, no free-reward leak', () => {
  // The sidegrade applies its tradeoff: +2 power, -6% cadence per tier.
  let session = { ...createCleanRun(5), points: 100_000, armoryPicks: 0 };
  const rate0 = session.player.fireRate;
  const buy = purchaseUpgrade(session, 'heavyOrdnance');
  assert.equal(buy.ok, true);
  session = buy.session;
  assert.equal(session.player.power, 3);
  assert.ok(Math.abs(session.player.fireRate - rate0 * 0.94) < 1e-9, 'volleys slow 6% per tier');
  // Mutually exclusive both directions, through the purchase path.
  assert.equal(isLineLocked(session, 'damage'), true);
  assert.equal(exclusiveLockFor(session, 'damage'), 'heavyOrdnance');
  assert.equal(purchaseUpgrade(session, 'damage').ok, false, 'standard damage locked once ordnance is owned');
  const other = { ...createCleanRun(5), points: 100_000, armoryPicks: 0 };
  const otherBought = purchaseUpgrade(other, 'damage').session;
  assert.equal(isLineLocked(otherBought, 'heavyOrdnance'), true);
  // Free boss rewards never offer the locked partner (seeded rolls).
  for (let seed = 1; seed <= 25; seed += 1) {
    const picks = pickBossRewards(mulberry32(seed), otherBought);
    assert.ok(picks.every(p => p.id !== 'heavyOrdnance'), `seed ${seed} pool excludes ordnance`);
  }
  // Ordnance crews read as Heavies on the line (reused sprite).
  assert.equal(squadRoleForSlot(session, 0), 'heavy');
  // Tier cap holds.
  assert.equal(isUpgradeCapped({ ...session, upgradeTiers: { heavyOrdnance: 8 } }, 'heavyOrdnance'), true);
});

test('grunt curve: early waves stay readable, late grunts outgrow the generic slope (Bryan 2026-09-20)', () => {
  // Early game untouched: wave 1 one-hit, wave 2 two-hit, wave 3 light.
  assert.equal(enemyHitPoints('grunt', 1), 1);
  assert.equal(enemyHitPoints('grunt', 2), 2);
  assert.ok(enemyHitPoints('grunt', 3) <= 3, 'wave-3 grunt stays one-to-two hits');
  // Late game: the grunt curve runs steeper than the generic enemy slope.
  for (const wave of [6, 8, 10, 12]) {
    assert.ok(
      enemyHitPoints('grunt', wave) > enemyHitPoints('grunt', wave, GENERIC_HP_GROWTH),
      `wave ${wave} grunt tougher than generic slope`,
    );
  }
  // The generic slope is still available for callers pinned to it (elite HP).
  assert.equal(enemyHitPoints('heavy', 8), Math.round(4 * Math.pow(GENERIC_HP_GROWTH, 7)));
  // Grunts stay below heavies in absolute terms - tougher, not the new boss.
  assert.ok(enemyHitPoints('grunt', 12) < enemyHitPoints('heavy', 12));
});

test('elemental lines: shock and frost tier to three with real tradeoffs', () => {
  let session = { ...createCleanRun(5), points: 100_000, armoryPicks: 0 };
  for (const id of ['shock', 'frost']) {
    assert.equal(isUpgradeCapped(session, id), false);
    for (let i = 0; i < 3; i += 1) { session.armoryPicks = 0; session = purchaseUpgrade(session, id).session; }
    assert.equal(upgradeTier(session, id), 3);
    assert.equal(isUpgradeCapped(session, id), true);
    session.armoryPicks = 0;
    assert.equal(purchaseUpgrade(session, id).reason, 'capped');
  }
  // Both are build lines: they count toward the line cap and the item cap.
  assert.ok(buildLines(session).includes('shock') && buildLines(session).includes('frost'));
  assert.equal(buildItemCount(session), 6);
  // Boss reward pool can offer them while uncapped.
  const offers = pickBossRewards(mulberry32(7), { ...createCleanRun(5), upgradeTiers: {} });
  assert.equal(offers.length, 3);
});

test('veteranize converts two bodies into one double-fire veteran', () => {
  let session = { ...createCleanRun(2), points: 100_000 };
  const startTroops = session.player.troops;
  session.armoryPicks = 0;
  const result = purchaseUpgrade(session, 'veteranTraining');
  assert.equal(result.ok, true);
  assert.equal(result.session.player.troops, startTroops - 1);
  assert.equal(result.session.player.veterans, 1);
  // Veterans are the last bodies lost.
  const damaged = applyTroopDamage({ ...result.session.player, troops: 3, veterans: 2, plates: 0 }, 2);
  assert.equal(damaged.player.troops, 1);
  assert.equal(damaged.player.veterans, 1);
  // Never merge below viability.
  const thin = { ...createCleanRun(2), points: 100_000, armoryPicks: 0 };
  thin.player = { ...thin.player, troops: 5 };
  const blocked = purchaseUpgrade(thin, 'veteranTraining');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'capped');
});

test('boss reward choices are unique, tiered, and contain synergy information', () => {
  const session = createCleanRun(4);
  for (let seed = 1; seed <= 100; seed += 1) {
    const choices = pickBossRewards(mulberry32(seed), session);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    assert.ok(choices.every(choice => choice.tier === 1 && choice.tierLabel === 'TIER 1'));
    assert.ok(choices.every(choice => choice.synergy.length > 0));
  }
  const rewarded = applyBossReward(session, 'multishot');
  assert.equal(rewarded.player.projectiles, 2);
  assert.equal(rewarded.upgradeTiers.multishot, 1);
  assert.equal(rewarded.points, session.points, 'reward helpers do not alter points');
});

test('boss defeat always transitions to another endless reward, never Victory', () => {
  for (const wave of [1, 6, 20, 1_000_000]) assert.equal(stateAfterBossDefeat(wave), GAME_STATE.BOSS_REWARD);
  assert.ok(!Object.values(GAME_STATE).includes('victory'));
});

test('armor absorbs first; reserves revive with protection and retain the build', () => {
  const upgradedPlayer = applyUpgrade(applyUpgrade(createCleanRun().player, 'damage'), 'piercing');
  const damaged = applyTroopDamage({ ...upgradedPlayer, troops: 2, armor: 3, plates: 3 }, 4);
  assert.deepEqual({ troops: damaged.player.troops, plates: damaged.player.plates, absorbed: damaged.absorbed, lost: damaged.lost }, { troops: 2, plates: 2, absorbed: 4, lost: 0 });
  const fatal = applyTroopDamage({ ...damaged.player, plates: 0, armor: 0, troops: 1 }, 1);
  assert.equal(fatal.player.troops, 0);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.PLAYING, 1), GAME_STATE.RECOVERY);
  assert.equal(stateAfterTroopDamage(fatal.player, GAME_STATE.BOSS, 0), GAME_STATE.GAME_OVER);

  const session = { ...createCleanRun(8, 'elite'), lives: 2, score: 500, skillPoints: 6, player: { ...fatal.player, power: 2, pierce: 1, recovery: 2 } };
  const revived = reviveSession(session);
  assert.equal(revived.revived, true);
  assert.equal(revived.session.lives, 1);
  assert.equal(revived.session.player.troops, DIFFICULTIES.elite.recoveryTroops + 6);
  assert.equal(revived.session.player.protectedFor, 3);
  assert.equal(revived.session.player.power, 2);
  assert.equal(revived.session.player.pierce, 1);
  assert.equal(revived.session.score, 500);
  assert.equal(revived.session.skillPoints, 6);
});

test('kill rewards grant milestone and elite skill points only once', () => {
  const milestone = claimKillReward({ type: 'grunt', rewarded: false }, 20);
  assert.equal(milestone.reward.points, 53); // v2: 13 base + 40 streak
  const elite = claimKillReward({ type: 'heavy', rewarded: false }, 25);
  assert.equal(elite.reward.points, 39);
  assert.equal(claimKillReward(elite.enemy, 26).reward, null);
});

test('clean retry resets every session value and transient collection', () => {
  const dirty = createCleanRun(9, 'elite');
  dirty.wave = 30;
  dirty.score = 999;
  dirty.points = 1200;
  dirty.lives = 2;
  dirty.player = applyUpgrade(dirty.player, 'damage');
  dirty.purchaseCounts.damage = 1;
  dirty.upgradeTiers.damage = 1;
  for (const key of ['bullets', 'enemyBullets', 'enemies', 'gates', 'hazards', 'particles', 'floaters', 'muzzleFlashes', 'telegraphs']) dirty[key].push({});
  dirty.boss = {};

  const retry = createCleanRun(10, 'veteran');
  assert.equal(retry.wave, 1);
  assert.equal(retry.score, 0);
  assert.equal(retry.points, 0);
  assert.equal(retry.lives, 0);
  assert.deepEqual(retry.purchaseCounts, {});
  assert.deepEqual(retry.upgradeTiers, {});
  for (const key of ['bullets', 'enemyBullets', 'enemies', 'gates', 'hazards', 'particles', 'floaters', 'muzzleFlashes', 'telegraphs']) assert.deepEqual(retry[key], []);
  assert.equal(retry.boss, null);
});

test('visible squad sprites remain individual through stress scale', () => {
  assert.deepEqual([1, 14, 32, 60, 1000].map(value => visibleSquadCount(value)), [1, 14, 32, 48, 52]);
  assert.equal(visibleSquadCount(240, 6), 60);
});

test('the runtime only persists local personal records, never run progression', () => {
  const runtime = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(runtime.includes("const RECORDS_KEY = 'blastline-records-v1'"));
  assert.ok(!runtime.includes('indexed' + 'DB'));
  assert.ok(!runtime.includes('blastline-save'));
  assert.ok(!runtime.includes('session' + 'Storage'));
  assert.ok(!html.includes('LIFETIME'));
  assert.ok(!html.includes('VICTORY'));
  assert.ok(html.includes('<small>BEST COMBO</small><b id="homeBestCombo">×0</b>'));
  assert.ok(!html.includes('id="homeRuns"'));
  assert.deepEqual(ACTIVE_STATES, [GAME_STATE.PLAYING, GAME_STATE.BOSS, GAME_STATE.RECOVERY]);
});

test('fresh run initializes combo chase values without leaking records into combat state', () => {
  const run = createCleanRun(77, 'veteran');
  assert.equal(run.combo, 0);
  assert.equal(run.comboTimer, 0);
  assert.equal(run.bestCombo, 0);
  assert.equal('bestScore' in run, false);
});
