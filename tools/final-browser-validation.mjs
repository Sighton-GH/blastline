import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_NAME = 'production-redesign-2026-09-19';
const OUTPUT = path.join(ROOT, 'docs', 'visual-audit', OUTPUT_NAME);
const FULL_SOAK = process.env.BLASTLINE_FULL_SOAK === '1';
const PERF_ONLY = process.argv.includes('--perf-only');
const STRESS_DURATION_MS = FULL_SOAK ? 60_000 : 8_000;
const SOAK_DURATION_MS = FULL_SOAK ? 300_000 : 15_000;
const NORMAL_DURATION_MS = FULL_SOAK ? 8_000 : 3_000;
fs.mkdirSync(OUTPUT, { recursive: true });

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.md', 'text/markdown; charset=utf-8'],
  ['.png', 'image/png'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'],
]);

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = decodeURIComponent(requestPath === '/' ? '/index.html' : requestPath).replace(/^\/+/, '');
  const target = path.resolve(ROOT, relative);
  if (!target.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(target, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.message);
      return;
    }
    response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': MIME.get(path.extname(target)) || 'application/octet-stream' });
    response.end(data);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const baseURL = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
const failedRequests = [];
const requests = new Set();
const checks = {};
const failures = [];
const captures = {};
const performance = {};

function record(name, pass, details = null) {
  checks[name] = Boolean(pass);
  if (!pass) failures.push({ name, details });
}

function normalizeRefreshQuantization(value, expectedInterval) {
  return Math.abs(value - expectedInterval) <= .25 ? expectedInterval : value;
}

function observe(page, label) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`${label}:console:${message.text()}`); });
  page.on('pageerror', error => errors.push(`${label}:page:${error.message}`));
  page.on('request', request => requests.add(new URL(request.url()).pathname));
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText;
    if (errorText !== 'net::ERR_ABORTED') failedRequests.push(`${label}:${request.url()}:${errorText}`);
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => globalThis.__blastlineTest?.getState().assetsReady === 'true');
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function visualAudit(page) {
  return page.evaluate(() => {
    const visibleBoxes = [...document.querySelectorAll('#hud:not(.hidden) .hud-primary, #hud:not(.hidden) .hud-run, #floatingStats:not(.hidden), #frenzyBadge:not(.hidden), #comboBadge:not(.hidden), #bossHud:not(.hidden)')]
      .map((element, index) => ({ id: element.id || element.className || `cluster-${index}`, rect: element.getBoundingClientRect().toJSON() }));
    const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const overlaps = [];
    for (let a = 0; a < visibleBoxes.length; a += 1) for (let b = a + 1; b < visibleBoxes.length; b += 1) {
      const area = overlap(visibleBoxes[a].rect, visibleBoxes[b].rect);
      if (area > 4) overlaps.push([visibleBoxes[a].id, visibleBoxes[b].id, area]);
    }
    const safeArea = visibleBoxes.every(({ rect }) => rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1);
    // The environment is composited into the main #game canvas every frame (offscreen buffer), so read water pixels there.
    const canvas = document.querySelector('#game');
    const context = canvas.getContext('2d');
    const backingScale = canvas.width / innerWidth;
    const horizon = Math.round(__blastlineTest.projectionAudit().horizon);
    const xSamples = [2, Math.max(2, innerWidth - 26)];
    let maxWaterJump = 0;
    for (const x of xSamples) {
      let previous = null;
      const startY = Math.max(2, Math.min(innerHeight - 3, horizon + 55));
      const endY = Math.max(startY + 6, Math.min(innerHeight * .68, horizon + 340));
      for (let y = startY; y < endY; y += 6) {
        const pixels = context.getImageData(Math.round(x * backingScale), Math.round(y * backingScale), Math.max(1, Math.round(24 * backingScale)), Math.max(1, Math.round(3 * backingScale))).data;
        const mean = [0, 0, 0];
        for (let offset = 0; offset < pixels.length; offset += 4) { mean[0] += pixels[offset]; mean[1] += pixels[offset + 1]; mean[2] += pixels[offset + 2]; }
        const count = pixels.length / 4;
        mean[0] /= count; mean[1] /= count; mean[2] /= count;
        if (previous) maxWaterJump = Math.max(maxWaterJump, Math.abs(mean[0] - previous[0]) + Math.abs(mean[1] - previous[1]) + Math.abs(mean[2] - previous[2]));
        previous = mean;
      }
    }
    const pageText = document.body.innerText;
    return {
      visibleBoxes,
      overlaps,
      safeArea,
      maxWaterJump,
      projection: __blastlineTest.projectionAudit(),
      waterMask: __blastlineTest.waterMaskAudit(),
      frenzy: __blastlineTest.frenzyAudit(),
      frenzyBadge: {
        visible: Boolean(document.querySelector('#frenzyBadge:not(.hidden)')),
        text: document.querySelector('#frenzyBadge')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      },
      removedPresentation: {
        enemyPanelAbsent: !document.querySelector('#enemyCounter'),
        safeWordingAbsent: !pageText.includes('SAFE LANE') && !/(^|\s)SAFE($|\s)/m.test(pageText),
      },
    };
  });
}

async function captureState(context, viewportName, mode) {
  const page = await context.newPage();
  const label = `${viewportName}-${mode}`;
  observe(page, label);
  await page.goto(`${baseURL}/?capture=${mode}`, { waitUntil: 'networkidle' });
  await waitReady(page);
  const filename = `${label.replaceAll('boss-phase-', 'boss-p')}.png`;
  const state = await page.evaluate(() => __blastlineTest.getState());
  const audit = await visualAudit(page);
  const drawCostMs = await page.evaluate(() => __blastlineTest.benchmarkDraw(36));
  await page.screenshot({ path: path.join(OUTPUT, filename) });
  captures[label] = {
    filename,
    viewport: page.viewportSize(),
    deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
    seed: state.seed,
    wave: state.wave,
    difficulty: state.difficulty,
    phase: state.phase,
    entityCounts: {
      squad: state.visibleSquad, enemies: state.activeEnemies, playerBullets: state.bullets,
      enemyBullets: state.enemyBullets, particles: state.particles, telegraphs: state.telegraphs.length,
    },
    frameTimeSummary: { synchronousDrawMeanMs: drawCostMs },
    runtimeAssetCount: Number(await page.locator('#game').getAttribute('data-asset-count')),
    audit,
  };
  record(`${label}:safeArea`, audit.safeArea, audit.visibleBoxes);
  record(`${label}:hudOverlap`, audit.overlaps.length === 0, audit.overlaps);
  record(`${label}:planarDeck`, audit.projection.leftMaxDeviation < .1 && audit.projection.rightMaxDeviation < .1, audit.projection);
  // Renamed from wideRoad: the true-perspective camera (see docs/BLASTLINE_GAME_SPECIFICATION.md
  // §13) deliberately narrows the road to 60%/71% of the viewport (landscape/portrait) so the
  // foreground shows ocean at both corners, matching the concept art. .54 is a floor against a
  // regression toward the old near-full-width road, not the target itself.
  record(`${label}:roadCorridorWidth`, audit.projection.roadWidthRatio >= .54, audit.projection);
  record(`${label}:towerClearance`, audit.projection.towerClearance > 0, audit.projection);
  record(`${label}:vanishingPoint`, Math.abs(audit.projection.horizon / page.viewportSize().height - (viewportName === 'portrait' ? -.10 : -.16)) < .002, audit.projection);
  // Renamed from noBridgeEnd: worldY = 0 is now a real, finite-width reference plane below the
  // horizon (depthScale(0) = 1/depthRatio), not a zero-width vanishing point -- that finite far
  // plane is what fixed the cables drawing an X across the deck. Assert it stays comfortably
  // finite (roughly an eighth of the viewport width) rather than collapsing back to ~0.
  record(`${label}:finiteFarPlane`,
    audit.projection.vanishingRoadWidth / page.viewportSize().width > .08 &&
    audit.projection.vanishingBridgeWidth / page.viewportSize().width > .08,
    audit.projection);
  // Renamed from boundedProjectedSpeed: a true 1/Z camera has projected speed ratio ~= depthRatio^2
  // (25-31 for the locked profiles) by design -- the old < 1.4 ceiling enforced the near-linear,
  // "nothing accelerates" curve this overhaul replaced. Keep only a sanity band against a runaway
  // fisheye.
  record(`${label}:perspectiveSpeedRatio`, audit.projection.projectedSpeedRatio > 12 && audit.projection.projectedSpeedRatio < 45, audit.projection);
  record(`${label}:sharedProjectionScale`, audit.projection.sharedScaleError < 1e-8, audit.projection.sharedScaleSamples);
  record(`${label}:cableAndHangerAnchors`, audit.projection.cableAnchorError < 1 && audit.projection.hangerAnchorError < 1 && audit.projection.towerHeightScaleError < 1e-6, audit.projection);
  record(`${label}:entityGrounding`, audit.projection.entityGroundingError === 0, audit.projection);
  record(`${label}:waterExcludedFromDeck`, audit.waterMask.maxDeckAlpha === 0 && audit.waterMask.minWaterAlpha > 0, audit.waterMask);
  record(`${label}:removedPresentation`, audit.removedPresentation.enemyPanelAbsent && audit.removedPresentation.safeWordingAbsent, audit.removedPresentation);
  record(`${label}:waterContinuity`, audit.maxWaterJump < 210, audit.maxWaterJump);
  await page.close();
}

async function newPage(context, label, home = false) {
  const page = await context.newPage();
  observe(page, label);
  await page.addInitScript(() => { Date.now = () => 1760000000000; });
  await page.goto(`${baseURL}/?qa=1`, { waitUntil: 'networkidle' });
  await waitReady(page);
  if (!home) {
    await page.click('#playBtn');
    await page.waitForFunction(() => __blastlineTest.getState().state === 'playing');
  }
  return page;
}

async function measureRaf(page, durationMs) {
  return page.evaluate(duration => new Promise(resolve => {
    const values = [];
    let first = 0;
    let previous = 0;
    function frame(timestamp) {
      if (!first) first = timestamp;
      if (previous) values.push(timestamp - previous);
      previous = timestamp;
      if (timestamp - first < duration) requestAnimationFrame(frame);
      else {
        const sorted = values.slice(5).sort((a, b) => a - b);
        const percentile = value => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * value))] || 0;
        resolve({
          samples: sorted.length,
          p50: percentile(.5),
          p95: percentile(.95),
          max: sorted.at(-1) || 0,
          over50: sorted.length ? sorted.filter(value => value > 50).length / sorted.length : 0,
        });
      }
    }
    requestAnimationFrame(frame);
  }), durationMs);
}

async function heapUsage(session) {
  await session.send('HeapProfiler.collectGarbage');
  const usage = await session.send('Runtime.getHeapUsage');
  return usage.usedSize;
}

async function runInteractionValidation() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await newPage(context, 'natural-interaction', true);

  record('homeRecordLabels', (await page.locator('#homeBestCombo').textContent()).trim() === '×0' && !(await page.locator('#careerStrip').textContent()).includes('RUNS'));
  await page.click('[data-difficulty="elite"]');
  record('difficultySelectionVisual', await page.locator('[data-difficulty="elite"]').getAttribute('aria-checked') === 'true');
  await page.click('#playBtn');
  await page.waitForFunction(() => __blastlineTest.getState().state === 'playing');
  record('difficultySelectionRuntime', (await page.evaluate(() => __blastlineTest.getState())).difficulty === 'elite');

  await page.keyboard.down('a');
  await page.waitForTimeout(420);
  await page.keyboard.up('a');
  const keyboardLeft = (await page.evaluate(() => __blastlineTest.getState())).playerX;
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  const keyboardRight = (await page.evaluate(() => __blastlineTest.getState())).playerX;
  record('keyboardSteeringAcrossLanes', keyboardLeft < -.2 && keyboardRight > .2, { keyboardLeft, keyboardRight });

  await page.touchscreen.tap(28, 590);
  await page.waitForTimeout(370);
  const touchLeft = (await page.evaluate(() => __blastlineTest.getState())).playerX;
  await page.touchscreen.tap(360, 590);
  await page.waitForTimeout(470);
  const touchRight = (await page.evaluate(() => __blastlineTest.getState())).playerX;
  record('touchSteeringAcrossLanes', touchLeft < -.25 && touchRight > .25, { touchLeft, touchRight });

  await page.click('#pauseBtn');
  const pauseBefore = await page.evaluate(() => __blastlineTest.getState());
  await page.waitForTimeout(400);
  const paused = await page.evaluate(() => __blastlineTest.getState());
  record('pauseFreezesSimulation', paused.state === 'paused' && paused.waveTime === pauseBefore.waveTime && paused.bullets === pauseBefore.bullets, { pauseBefore, paused });
  record('pauseHasNoShop', (await page.locator('[data-shop]').count()) === 0 && (await page.locator('#shopGrid').count()) === 0);
  await page.click('#resumeBtn');
  record('resumeFromDashboard', (await page.evaluate(() => __blastlineTest.getState())).state === 'playing');
  await page.evaluate(() => { __blastlineTest.setPoints(2000); __blastlineTest.forceReward(); });
  await page.waitForFunction(() => __blastlineTest.getState().state === 'armory');
  const purchaseBefore = await page.evaluate(() => __blastlineTest.getState());
  await page.locator('.reward-card[data-upgrade="damage"]').click();
  const afterPurchase = await page.evaluate(() => __blastlineTest.getState());
  record('armoryPurchaseSpendsPoints', afterPurchase.power === purchaseBefore.power + 1 && afterPurchase.skillPoints < 2000 && afterPurchase.score === purchaseBefore.score, afterPurchase);
  await page.locator('.armory-continue').click();
  record('armoryContinuesRun', (await page.evaluate(() => __blastlineTest.getState())).state === 'playing');

  await page.evaluate(() => { __blastlineTest.reset(207, 'veteran'); __blastlineTest.setWave(3); __blastlineTest.forceBoss(); });
  await page.evaluate(() => __blastlineTest.defeatBoss());
  await page.waitForFunction(() => __blastlineTest.getState().state === 'armory');
  const freeCards = await page.locator('#rewardCards .reward-card').all();
  const freeTexts = [];
  for (const card of freeCards) freeTexts.push((await card.innerText()).replace(/\s+/g, ' '));
  const continueDisabled = await page.locator('.armory-continue').isDisabled();
  record('bossRewardOffersThreeFreeUniqueCards', freeCards.length === 3 && freeTexts.every(text => text.includes('FREE UPGRADE')) && new Set(freeTexts).size === 3 && continueDisabled, { freeTexts, continueDisabled });
  await freeCards[0].click();
  await page.waitForTimeout(250);
  const shopCount = await page.locator('#rewardCards .reward-card').count();
  const continueEnabled = await page.locator('.armory-continue').isEnabled();
  record('bossRewardPickUnlocksArmoryShop', shopCount === 9 && continueEnabled, { shopCount, continueEnabled });
  const waveBeforeRewardContinue = (await page.evaluate(() => __blastlineTest.getState())).wave;
  await page.locator('.armory-continue').click();
  const afterRewardContinue = await page.evaluate(() => __blastlineTest.getState());
  record('bossRewardContinueAdvancesWave', afterRewardContinue.state === 'playing' && afterRewardContinue.wave === waveBeforeRewardContinue + 1, afterRewardContinue);

  const gateSetup = await page.evaluate(() => {
    __blastlineTest.reset(201, 'veteran');
    __blastlineTest.setTroops(10);
    __blastlineTest.freeze(true);
    return __blastlineTest.setGateEncounter([
      { id: 'qa-ranks', text: '+5', tone: 'blue', effects: [{ stat: 'troops', mode: 'add', value: 5 }] },
      { id: 'qa-armor', text: '+4 / −2', tone: 'gold', effects: [{ stat: 'armor', mode: 'add', value: 4 }, { stat: 'troops', mode: 'add', value: -2 }] },
    ], .84, 1);
  });
  await page.evaluate(x => { __blastlineTest.setPlayerX(x); __blastlineTest.freeze(false); }, gateSetup[0].x);
  await page.waitForFunction(() => __blastlineTest.getState().troops === 15);
  const gateResult = await page.evaluate(() => __blastlineTest.getState());
  record('laneLockedTradeoffGate', gateResult.gates.every(gate => gate.hit) && gateResult.gates.every(gate => Math.abs(gate.x - [-.58, 0, .58][gate.lane]) < 1e-9), gateResult.gates);

  const formationBefore = await page.evaluate(() => {
    __blastlineTest.reset(202, 'veteran');
    __blastlineTest.freeze(true);
    __blastlineTest.spawnFormation('split-lane', 30);
    return __blastlineTest.getState();
  });
  await page.evaluate(() => __blastlineTest.freeze(false));
  await page.waitForTimeout(350);
  await page.evaluate(() => __blastlineTest.freeze(true));
  const formationAfter = await page.evaluate(() => __blastlineTest.getState());
  const beforeById = new Map(formationBefore.sampleEnemies.map(enemy => [enemy.id, enemy]));
  const retainedEnemies = formationAfter.sampleEnemies.filter(enemy => beforeById.has(enemy.id));
  const laneStable = retainedEnemies.length >= 20 && retainedEnemies.every(enemy => {
    const before = beforeById.get(enemy.id);
    const center = [-.58, 0, .58][enemy.lane];
    return before && enemy.lane === before.lane && enemy.x === enemy.lineX && Math.abs(enemy.x - center) <= .255 && enemy.y > before.y;
  });
  record('enemyFormationLaneOwnership', laneStable, retainedEnemies.slice(0, 8));

  await page.evaluate(() => { __blastlineTest.freeze(false); __blastlineTest.reset(203, 'veteran'); __blastlineTest.setWave(5); __blastlineTest.spawnEnemyAt('gunner', 2, .28, true); });
  await page.waitForFunction(() => { const state = __blastlineTest.getState(); return state.telegraphs.length > 0 || state.enemyBullets > 0; });
  const ranged = await page.evaluate(() => __blastlineTest.getState());
  record('laneTelegraphedEnemyFire', ranged.telegraphs.every(warning => warning.lane === 2 && Math.abs(warning.x - .58) < 1e-9), ranged.telegraphs);

  const comboResult = await page.evaluate(() => {
    __blastlineTest.reset(207, 'veteran');
    __blastlineTest.freeze(true);
    __blastlineTest.setPower(16);
    __blastlineTest.setTroops(24);
    for (let index = 0; index < 12; index += 1) __blastlineTest.spawnEnemyAt('grunt', 1, .32 + index * .003);
    __blastlineTest.fireNow(8);
    __blastlineTest.advance(2);
    return { state: __blastlineTest.getState(), badge: document.querySelector('#comboBadge')?.textContent?.replace(/\s+/g, ' ').trim() || '' };
  });
  record('comboScoringAndBadge', comboResult.state.bestCombo >= 10 && comboResult.state.score > comboResult.state.kills * 12 && comboResult.badge.includes('HOT STREAK'), comboResult);
  const expiredCombo = await page.evaluate(() => {
    __blastlineTest.freeze(true);
    __blastlineTest.setWaveTime(0);
    __blastlineTest.setBuild({ fireRate: .01, projectiles: 1 });
    // Stop automatic targets from refreshing the timer while still exercising the
    // production combo countdown through deterministic simulation steps.
    __blastlineTest.setPlayerX(-.86);
    __blastlineTest.advance(4);
    const state = __blastlineTest.getState();
    __blastlineTest.freeze(false);
    return state;
  });
  record('comboExpiresCleanly', expiredCombo.combo === 0 && expiredCombo.comboTimer === 0 && expiredCombo.bestCombo >= 10, expiredCombo);

  await page.evaluate(() => { __blastlineTest.reset(204, 'veteran'); __blastlineTest.setWave(8); __blastlineTest.forceBoss(); });
  const bossStart = await page.evaluate(() => __blastlineTest.getState());
  await page.waitForFunction(maxHp => { const state = __blastlineTest.getState(); return state.boss && state.boss.hp < maxHp; }, bossStart.boss.maxHp, { timeout: 5000 });
  await page.evaluate(() => __blastlineTest.setBossPhase(3));
  const bossPhase = await page.evaluate(() => __blastlineTest.getState());
  record('bossPhasesAndDamage', bossPhase.boss.phase === 3 && bossPhase.boss.hp < bossPhase.boss.maxHp, bossPhase.boss);
  await page.evaluate(() => { __blastlineTest.setPoints(2000); __blastlineTest.defeatBoss(); });
  await page.waitForFunction(() => __blastlineTest.getState().state === 'armory');
  const freeRewards = await page.locator('.reward-card').evaluateAll(cards => cards.map(card => card.dataset.upgrade));
  record('threeFreeBossRewards', freeRewards.length === 3 && new Set(freeRewards).size === 3, freeRewards);
  await page.locator('.reward-card:not(:disabled)').first().click();
  await page.waitForTimeout(200);
  const rewards = await page.locator('.reward-card').evaluateAll(cards => cards.map(card => card.dataset.upgrade));
  record('nineArmoryChoices', rewards.length === 9 && new Set(rewards).size === 9, rewards);
  await page.locator('.reward-card:not(:disabled)').first().click();
  await page.locator('.armory-continue').click();
  record('bossArmoryTransition', (await page.evaluate(() => __blastlineTest.getState())).wave === 9 && (await page.evaluate(() => __blastlineTest.getState())).state === 'playing');

  await page.evaluate(() => { __blastlineTest.reset(205, 'elite'); __blastlineTest.setLives(1); __blastlineTest.forceRevival(); });
  const recoveryStart = await page.evaluate(() => __blastlineTest.getState());
  record('extraLifeStartsProtectedRecovery', recoveryStart.state === 'recovery' && recoveryStart.lives === 0 && recoveryStart.protectedFor > 2.9 && recoveryStart.enemyBullets === 0, recoveryStart);
  await page.waitForFunction(() => __blastlineTest.getState().state === 'playing', null, { timeout: 4500 });
  record('recoveryReturnsToRun', (await page.evaluate(() => __blastlineTest.getState())).troops >= DIFFICULTY_RECOVERY.elite);

  await page.evaluate(() => { __blastlineTest.reset(206, 'veteran'); __blastlineTest.forceGameOver(); });
  record('gameOverOnlyWithoutReserve', (await page.evaluate(() => __blastlineTest.getState())).state === 'game-over');
  await page.click('#retryBtn');
  const retry = await page.evaluate(() => __blastlineTest.getState());
  record('cleanRetry', retry.state === 'playing' && retry.wave === 1 && retry.score === 0 && retry.skillPoints === 0 && retry.lives === 0 && retry.troops === 14 && Object.keys(retry.upgradeTiers).length === 0, retry);

  await context.close();
}

const DIFFICULTY_RECOVERY = { recruit: 16, veteran: 13, elite: 10 };

async function runEndlessProgression() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await newPage(context, 'twenty-wave-progression');
  const progression = [];
  for (let expected = 1; expected <= 20; expected += 1) {
    const bossState = await page.evaluate(() => { __blastlineTest.forceBoss(); return __blastlineTest.getState(); });
    progression.push({ wave: bossState.wave, boss: Boolean(bossState.boss) });
    await page.evaluate(() => __blastlineTest.defeatBoss());
    await page.waitForFunction(() => __blastlineTest.getState().state === 'armory');
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    await page.locator('#rewardCards .reward-card').first().click();
    await page.waitForFunction(() => { const button = document.querySelector('.armory-continue'); return button && !button.disabled; });
    await page.locator('.armory-continue').click();
    await page.waitForFunction(wave => __blastlineTest.getState().wave === wave && __blastlineTest.getState().state === 'playing', expected + 1);
  }
  const final = await page.evaluate(() => __blastlineTest.getState());
  record('twentyWaveEndlessProgression', progression.length === 20 && progression.every((item, index) => item.wave === index + 1 && item.boss) && final.wave === 21 && final.state === 'playing', { progression, finalWave: final.wave });
  record('noVictoryLoop', !progression.some(item => item.state === 'victory') && final.state !== 'victory');
  await page.evaluate(() => { window.localStorage.setItem('unrelated-sentinel', 'keep'); });
  await page.reload({ waitUntil: 'networkidle' });
  await waitReady(page);
  const storage = await page.evaluate(() => ({ keys: Object.keys(window.localStorage), state: __blastlineTest.getState() }));
  record('reloadStartsFresh', storage.state.state === 'home' && storage.state.wave === 1 && storage.state.score === 0 && storage.state.skillPoints === 0 && storage.state.troops === 14, storage);
  record('onlyPersonalRecordPersistence', storage.keys.filter(key => key.toLowerCase().includes('blastline')).every(key => key === 'blastline-records-v1'), storage.keys);
  record('recordsDoNotLeakIntoFreshRun', storage.state.records && storage.state.score === 0 && storage.state.wave === 1 && storage.state.purchaseCounts && Object.keys(storage.state.purchaseCounts).length === 0, storage.state);
  await context.close();
}

async function runPerformanceValidation() {
  for (const [name, viewport] of Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1365, height: 768 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await newPage(context, `performance-${name}`);
    await page.evaluate(() => { __blastlineTest.setWave(8); __blastlineTest.setTroops(42); __blastlineTest.spawnFormation('wall', 80); });
    await page.waitForTimeout(800);
    performance[name] = await measureRaf(page, NORMAL_DURATION_MS);
    performance[name].refreshNormalizedP95 = normalizeRefreshQuantization(performance[name].p95, 1000 / 60);
    const roundedP95 = Number(performance[name].refreshNormalizedP95.toFixed(1));
    record(`${name}P95AtMost16_7ms`, roundedP95 <= 16.7, performance[name]);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
  const page = await newPage(context, 'performance-stress');
  const cdp = await context.newCDPSession(page);
  const stressStart = await page.evaluate(() => __blastlineTest.stressScene());
  record('stressSceneEntityMinimums', stressStart.visibleSquad === 24 && stressStart.activeEnemies >= 180 && Boolean(stressStart.boss) && stressStart.telegraphs.length >= 3, stressStart);
  await page.waitForTimeout(2000);
  performance.stressBenchmarks1x = await page.evaluate(() => ({ drawMs: __blastlineTest.benchmarkDraw(20), updateMs: __blastlineTest.benchmarkUpdate(60) }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  performance.stressBenchmarks4x = await page.evaluate(() => ({
    drawMs: __blastlineTest.benchmarkDraw(12),
    updateMs: __blastlineTest.benchmarkUpdate(30),
    layers: __blastlineTest.benchmarkLayers(8),
  }));
  // Let synchronous diagnostics, JIT compilation, and any pending GC settle before
  // measuring animation cadence. Otherwise the diagnostic itself contaminates the
  // first seconds of the frame sample on slower hosts.
  await page.waitForTimeout(3500);
  performance.stress4x = await measureRaf(page, STRESS_DURATION_MS);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  performance.stress4x.refreshNormalizedP95 = normalizeRefreshQuantization(performance.stress4x.p95, 1000 / 30);
  const roundedStressP95 = Number(performance.stress4x.refreshNormalizedP95.toFixed(1));
  record('stress4xP95AtMost33_3ms', roundedStressP95 <= 33.3, performance.stress4x);
  record('stressFramesOver50Below1Percent', performance.stress4x.over50 < .01, performance.stress4x);

  await page.waitForTimeout(3500);
  const initialHeap = await heapUsage(cdp);
  const entitySamples = [];
  const soakStart = Date.now();
  while (Date.now() - soakStart < SOAK_DURATION_MS) {
    await page.waitForTimeout(Math.min(5000, SOAK_DURATION_MS - (Date.now() - soakStart)));
    const state = await page.evaluate(() => __blastlineTest.getState());
    entitySamples.push({ enemies: state.activeEnemies, bullets: state.bullets, enemyBullets: state.enemyBullets, particles: state.particles, created: state.pool });
  }
  const finalHeap = await heapUsage(cdp);
  const heapGrowth = initialHeap ? (finalHeap - initialHeap) / initialHeap : 0;
  performance.soak = { durationMs: SOAK_DURATION_MS, initialHeap, finalHeap, heapGrowth, entitySamples };
  record('soakHeapGrowthAtMost15Percent', heapGrowth <= .15, performance.soak);
  record('soakEntitiesRemainBounded', entitySamples.every(sample => sample.enemies >= 180 && sample.enemies <= 220 && sample.bullets <= 720 && sample.enemyBullets <= 150 && sample.particles <= 100), entitySamples);
  await context.close();
}

async function makeComparisonBoard(label, referenceRelative, captureKey) {
  const capture = captures[captureKey];
  if (!capture) return;
  const page = await browser.newPage({ viewport: { width: 1600, height: 980 }, deviceScaleFactor: 1 });
  const reference = `${baseURL}/${referenceRelative.split(path.sep).join('/')}`;
  const current = `${baseURL}/docs/visual-audit/${OUTPUT_NAME}/${capture.filename}`;
  await page.setContent(`<!doctype html><style>body{margin:0;background:#06131e;color:white;font:800 18px system-ui}.head{padding:18px 24px;font-size:25px;letter-spacing:.08em}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:0 18px 18px}figure{margin:0;padding:12px;background:#0b2638;border:1px solid #2877a0;border-radius:14px}figcaption{padding:0 0 9px;color:#70dfff}img{display:block;width:100%;height:820px;object-fit:contain;background:#04111a}</style><div class="head">BLASTLINE · ${label.toUpperCase()} · REFERENCE / CURRENT GAME</div><div class="grid"><figure><figcaption>VISUAL DIRECTION — NOT GAMEPLAY EVIDENCE</figcaption><img src="${reference}"></figure><figure><figcaption>CURRENT BROWSER CAPTURE</figcaption><img src="${current}"></figure></div>`);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  await page.screenshot({ path: path.join(OUTPUT, `comparison-${label}.png`), fullPage: true });
  await page.close();
}

async function makeDifferenceBoard(label, baselineRelative, captureKey) {
  const capture = captures[captureKey];
  const baselinePath = path.join(ROOT, baselineRelative);
  if (!capture || !fs.existsSync(baselinePath)) return;
  const page = await browser.newPage({ viewport: { width: 900, height: 950 }, deviceScaleFactor: 1 });
  const baseline = `${baseURL}/${baselineRelative.split(path.sep).join('/')}`;
  const current = `${baseURL}/docs/visual-audit/${OUTPUT_NAME}/${capture.filename}`;
  await page.setContent(`<!doctype html><style>body{margin:0;background:#07131d;color:white;font:800 17px system-ui}.head{padding:18px}.stack{position:relative;width:860px;height:850px;margin:0 20px;background:#000}.stack img{position:absolute;width:100%;height:100%;object-fit:contain}.new{mix-blend-mode:difference;opacity:.88}.legend{padding:10px 20px;color:#7ce5ff}</style><div class="head">${label.toUpperCase()} · CURRENT-vs-BASELINE DIFFERENCE</div><div class="stack"><img src="${baseline}"><img class="new" src="${current}"></div><div class="legend">Bright pixels indicate substantial visual change. Images are normalized to one frame.</div>`);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth));
  await page.screenshot({ path: path.join(OUTPUT, `diff-${label}.png`), fullPage: true });
  await page.close();
}

let unexpectedError = null;
try {
  if (PERF_ONLY) {
    await runPerformanceValidation();
  } else {
    const portrait = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    for (const mode of ['home', 'horde', 'gate', 'dense', 'frenzy', 'shop', 'reward', 'revive', 'boss-phase-1', 'boss-phase-3', 'chaos', 'gameover']) await captureState(portrait, 'portrait', mode);
  await portrait.close();

  const landscape = await browser.newContext({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
  for (const mode of ['home', 'horde', 'gate', 'dense', 'frenzy', 'shop', 'reward', 'revive', 'boss-phase-1', 'boss-phase-3', 'chaos', 'gameover']) await captureState(landscape, 'landscape', mode);
  await landscape.close();

  record('portraitDenseCrowd', captures['portrait-dense'].entityCounts.squad === 24 && captures['portrait-dense'].entityCounts.enemies >= 80, captures['portrait-dense'].entityCounts);
  record('landscapeDenseCrowd', captures['landscape-dense'].entityCounts.squad === 24 && captures['landscape-dense'].entityCounts.enemies >= 80, captures['landscape-dense'].entityCounts);
  record('portraitAndLandscapeProfiles', captures['portrait-horde'].audit.projection.profile === 'portrait' && captures['landscape-horde'].audit.projection.profile === 'landscape');
  for (const viewport of ['portrait', 'landscape']) {
    const frenzy = captures[`${viewport}-frenzy`];
    record(
      `${viewport}FrenzyPresentation`,
      frenzy.audit.frenzy.borderAlpha > 0 && frenzy.audit.frenzy.cornerAlpha > 0 && frenzy.audit.frenzy.centerAlpha === 0 && frenzy.audit.frenzyBadge.visible && frenzy.audit.frenzyBadge.text.includes('FRENZY'),
      { pixels: frenzy.audit.frenzy, badge: frenzy.audit.frenzyBadge },
    );
  }

  await runInteractionValidation();
  await runEndlessProgression();
  await runPerformanceValidation();

  await makeComparisonBoard('home', 'docs/art-reference/high-quality/01-home-screen.png', 'landscape-home');
  await makeComparisonBoard('gameplay', 'docs/art-reference/high-quality/02-gameplay-lane-choice.png', 'landscape-horde');
  await makeComparisonBoard('gate', 'docs/art-reference/high-quality/04-gameplay-stat-gates.png', 'landscape-gate');
  await makeComparisonBoard('dense-horde', 'docs/art-reference/high-quality/05-elite-wave.png', 'landscape-dense');
  await makeComparisonBoard('frenzy', 'docs/art-reference/high-quality/10-endgame-chaos.png', 'landscape-frenzy');
  await makeComparisonBoard('boss', 'docs/art-reference/high-quality/06-boss-battle.png', 'landscape-boss-phase-3');
  await makeComparisonBoard('shop', 'docs/art-reference/high-quality/07-between-waves-upgrades.png', 'landscape-shop');
  await makeComparisonBoard('armory', 'docs/art-reference/high-quality/07-between-waves-upgrades.png', 'landscape-reward');
  await makeComparisonBoard('chaos', 'docs/art-reference/high-quality/10-endgame-chaos.png', 'landscape-chaos');
  await makeComparisonBoard('game-over', 'docs/art-reference/high-quality/09-game-over.png', 'landscape-gameover');
  await makeDifferenceBoard('portrait-gameplay', 'docs/visual-audit/final-2026-08-15/mobile-gameplay.png', 'portrait-horde');
    await makeDifferenceBoard('landscape-gameplay', 'docs/visual-audit/final-2026-08-15/desktop-gameplay.png', 'landscape-horde');
  }
} catch (error) {
  unexpectedError = error;
  failures.push({ name: 'unexpectedException', details: error.stack || error.message });
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

record('noConsoleErrors', errors.length === 0, errors);
record('noFailedRequests', failedRequests.length === 0, failedRequests);
record('noSourceMastersAtRuntime', ![...requests].some(requestPath => requestPath.includes('/assets/source/')), [...requests]);
record('generatedOceanRuntimeAsset', [...requests].some(requestPath => requestPath.endsWith('/ocean-surface-v2.webp')), [...requests]);

const result = {
  generatedAt: new Date().toISOString(),
  fullSoak: FULL_SOAK,
  durations: { normalMs: NORMAL_DURATION_MS, stressMs: STRESS_DURATION_MS, soakMs: SOAK_DURATION_MS },
  thresholds: {
    normalP95Ms: 16.7,
    stress4xP95Ms: 33.3,
    framesOver50Fraction: .01,
    heapGrowthFraction: .15,
    entityCaps: { enemies: 220, playerBullets: 720, enemyBullets: 150, stressParticles: 100 },
  },
  targetViewports: {
    portrait: { width: 390, height: 844, deviceScaleFactor: 1, touch: true },
    landscape: { width: 1365, height: 768, deviceScaleFactor: 1 },
  },
  pass: failures.length === 0,
  checks,
  failures,
  performance,
  captures,
  runtimeRequests: [...requests].sort(),
  consoleErrors: errors,
  failedRequests,
  unexpectedError: unexpectedError?.message || null,
};

const report = `${JSON.stringify(result, null, 2)}\n`;
fs.writeFileSync(path.join(OUTPUT, 'validation.json'), report);
if (FULL_SOAK) fs.writeFileSync(path.join(OUTPUT, 'validation-full.json'), report);
fs.writeFileSync(path.join(OUTPUT, 'runtime-asset-manifest.md'), `# Runtime asset manifest\n\nGenerated by the real-browser validator. Source masters are forbidden at runtime.\n\n${result.runtimeRequests.map(requestPath => `- \`${requestPath}\``).join('\n')}\n`);
console.log(JSON.stringify({ pass: result.pass, failures: result.failures, performance: result.performance, output: OUTPUT }, null, 2));
if (!result.pass) process.exitCode = 1;
