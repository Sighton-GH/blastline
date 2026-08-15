import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'docs', 'visual-audit', 'final-2026-08-15');
fs.mkdirSync(OUTPUT, { recursive: true });

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
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
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': MIME.get(path.extname(target)) || 'application/octet-stream',
    });
    response.end(data);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
const baseURL = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
const requests = new Set();
const failedRequests = [];
const checks = {};
const captures = {};

function observe(page, label) {
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${label}:console:${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`${label}:page:${error.message}`));
  page.on('request', request => requests.add(new URL(request.url()).pathname));
  page.on('requestfailed', request => failedRequests.push(`${label}:${request.url()}:${request.failure()?.errorText}`));
}

async function waitUntilReady(page) {
  await page.waitForFunction(() => globalThis.__blastlineTest?.getState().assetsReady === 'true');
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function captureState(context, viewportName, mode) {
  const page = await context.newPage();
  const label = `${viewportName}-${mode}`;
  observe(page, label);
  await page.goto(`${baseURL}/?capture=${mode}`, { waitUntil: 'networkidle' });
  await waitUntilReady(page);
  const filename = `${viewportName}-${mode === 'gameover' ? 'game-over' : mode}.png`;
  await page.screenshot({ path: path.join(OUTPUT, filename) });
  captures[label] = {
    filename,
    viewport: page.viewportSize(),
    deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
    state: await page.evaluate(() => __blastlineTest.getState()),
  };
  await page.close();
}

async function newGameplayPage(context, label) {
  const page = await context.newPage();
  observe(page, label);
  await page.addInitScript(() => {
    const fixedNow = 1730000000000;
    Date.now = () => fixedNow;
  });
  await page.goto(`${baseURL}/?qa=1`, { waitUntil: 'networkidle' });
  await waitUntilReady(page);
  await page.click('#playBtn');
  await page.waitForFunction(() => __blastlineTest.getState().state === 'playing');
  return page;
}

try {
  const mobileCaptures = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  for (const mode of ['home', 'gameplay', 'gate', 'elite', 'dense', 'boss', 'upgrade', 'victory', 'gameover']) {
    await captureState(mobileCaptures, 'mobile', mode);
  }
  await mobileCaptures.close();

  const desktopCaptures = await browser.newContext({ viewport: { width: 1365, height: 768 }, deviceScaleFactor: 1 });
  for (const mode of ['home', 'gameplay', 'boss', 'upgrade', 'victory', 'gameover']) {
    await captureState(desktopCaptures, 'desktop', mode);
  }
  await desktopCaptures.close();

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const page = await newGameplayPage(context, 'interaction');

  const start = await page.evaluate(() => __blastlineTest.getState());
  await page.waitForTimeout(450);
  const advanced = await page.evaluate(() => __blastlineTest.getState());
  assert.ok(advanced.waveTime > start.waveTime + .25, 'automatic forward simulation did not advance');
  await page.waitForFunction(() => {
    const current = __blastlineTest.getState();
    return current.bullets > 0 || current.muzzleFlashes > 0;
  });
  checks.automaticTravel = true;
  checks.automaticShooting = true;

  await page.evaluate(() => __blastlineTest.reset(111));
  await page.waitForFunction(() => {
    const current = __blastlineTest.getState();
    return current.sampleBullets.length >= current.visibleSquad;
  });
  const volley = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(new Set(volley.sampleBullets.map(bullet => bullet.shooter)).size, volley.visibleSquad, 'a firing volley did not include every visible soldier');
  assert.equal(new Set(volley.sampleBullets.slice(0, volley.visibleSquad).map(bullet => `${bullet.originX}:${bullet.originY}`)).size, volley.visibleSquad, 'projectiles did not preserve individual soldier origins');
  const straightBefore = volley.sampleBullets[0];
  await page.evaluate(() => __blastlineTest.setPlayerX(.72));
  await page.waitForTimeout(100);
  const straightAfter = await page.evaluate(({ shooter, originY }) => __blastlineTest.getState().sampleBullets.find(bullet => bullet.shooter === shooter && bullet.originY === originY), straightBefore);
  assert.ok(straightAfter, 'test projectile disappeared before trajectory validation');
  assert.ok(Math.abs(straightAfter.x - straightBefore.x) < 1e-7, 'straight projectile curved after the player/target position changed');
  assert.ok(straightAfter.y < straightBefore.y, 'player projectile did not travel forward');
  checks.individualSoldierOrigins = true;
  checks.straightPlayerProjectiles = true;

  const saturatedVolleys = await page.evaluate(() => {
    __blastlineTest.freeze(true);
    __blastlineTest.reset(113);
    __blastlineTest.setTroops(999);
    const visibleSquad = __blastlineTest.getState().visibleSquad;
    return { visibleSquad, counts: __blastlineTest.fireNow(24) };
  });
  assert.ok(saturatedVolleys.counts.some(count => count === 0), 'projectile saturation setup did not reach the active-bullet cap');
  assert.ok(saturatedVolleys.counts.every(count => count === 0 || count === saturatedVolleys.visibleSquad), 'projectile cap produced a partial soldier volley');
  checks.completeSoldierVolleysAtCapacity = true;
  await page.evaluate(() => {
    __blastlineTest.reset(114);
    __blastlineTest.freeze(false);
  });

  const projection = await page.evaluate(() => __blastlineTest.projectionAudit());
  assert.ok(projection.leftMaxDeviation < .05 && projection.rightMaxDeviation < .05, `bridge deck edge bowed by ${JSON.stringify(projection)}`);
  checks.planarStraightBridgeDeck = true;

  await page.evaluate(() => __blastlineTest.setPlayerX(0));
  await page.keyboard.down('a');
  await page.waitForTimeout(260);
  await page.keyboard.up('a');
  const afterA = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterA < -.08, 'A steering did not move left');
  await page.keyboard.down('d');
  await page.waitForTimeout(360);
  await page.keyboard.up('d');
  const afterD = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterD > afterA + .12, 'D steering did not move right');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(220);
  await page.keyboard.up('ArrowLeft');
  const afterArrowLeft = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterArrowLeft < afterD - .05, 'left arrow steering did not move left');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(260);
  await page.keyboard.up('ArrowRight');
  const afterArrowRight = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterArrowRight > afterArrowLeft + .05, 'right arrow steering did not move right');
  checks.keyboardSteering = true;

  await page.mouse.move(35, 500);
  await page.waitForTimeout(240);
  const afterPointerLeft = await page.evaluate(() => __blastlineTest.getState().playerX);
  await page.mouse.move(355, 500);
  await page.waitForTimeout(300);
  const afterPointerRight = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterPointerRight > afterPointerLeft + .3, 'pointer steering did not cross the lane');
  checks.pointerSteering = true;

  await page.touchscreen.tap(42, 520);
  await page.waitForTimeout(300);
  const afterTouchLeft = await page.evaluate(() => __blastlineTest.getState().playerX);
  await page.touchscreen.tap(348, 520);
  await page.waitForTimeout(300);
  const afterTouchRight = await page.evaluate(() => __blastlineTest.getState().playerX);
  assert.ok(afterTouchRight > afterTouchLeft + .3, 'touch steering did not cross the lane');
  checks.touchSteering = true;

  await page.evaluate(() => {
    __blastlineTest.reset(101);
    __blastlineTest.setTroops(10);
    __blastlineTest.setPlayerX(-.39);
    __blastlineTest.setGatePair(
      { kind: 'troops', value: 5, text: '+5', color: 'blue' },
      { kind: 'troops', value: -9, text: '−9', color: 'red' },
      .835,
    );
  });
  await page.waitForFunction(() => __blastlineTest.getState().troops === 15);
  const once = await page.evaluate(() => __blastlineTest.getState().troops);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => __blastlineTest.getState().troops), once, 'gate applied more than once');
  checks.positiveGate = true;
  checks.singleGateTrigger = true;

  await page.evaluate(() => {
    __blastlineTest.reset(102);
    __blastlineTest.setTroops(2);
    __blastlineTest.setPlayerX(.39);
    __blastlineTest.setGatePair(
      { kind: 'troops', value: 4, text: '+4', color: 'blue' },
      { kind: 'troops', value: -20, text: '−20', color: 'red' },
      .835,
    );
  });
  await page.waitForFunction(() => __blastlineTest.getState().troops === 1);
  checks.harmfulGateMinimum = true;

  await page.evaluate(() => {
    __blastlineTest.reset(103);
    __blastlineTest.setTroops(10);
    __blastlineTest.setPlayerX(0);
    __blastlineTest.setGatePair(
      { kind: 'troops', value: 4, text: '+4', color: 'blue' },
      { kind: 'troops', value: -4, text: '−4', color: 'red' },
      .835,
    );
  });
  await page.waitForTimeout(160);
  const neutral = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(neutral.troops, 10, 'neutral gap unexpectedly applied a gate');
  assert.ok(neutral.gates.every(gate => gate.hit), 'neutral gate encounter did not resolve');
  checks.neutralGap = true;

  await page.evaluate(() => {
    __blastlineTest.reset(104);
    __blastlineTest.setTroops(8);
    __blastlineTest.setPlayerX(.2);
    __blastlineTest.spawnEnemyAt('elite', .2, .855);
  });
  await page.waitForFunction(() => __blastlineTest.getState().troops === 6, null, { timeout: 1500 });
  checks.enemyCollision = true;
  checks.eliteContactDamage = true;

  await page.evaluate(() => {
    __blastlineTest.reset(105);
    __blastlineTest.setWave(3);
    __blastlineTest.setPlayerX(-.72);
    __blastlineTest.spawnEnemyAt('shield', .68, .28, true);
  });
  await page.waitForFunction(() => __blastlineTest.getState().enemyBullets > 0, null, { timeout: 1200 });
  checks.ordinaryEnemyRangedAttack = true;

  const baseGrunt = await page.evaluate(() => {
    __blastlineTest.reset(106);
    __blastlineTest.setPower(1);
    return __blastlineTest.spawnEnemyAt('grunt', 0, .70);
  });
  assert.equal(baseGrunt.hp, 1, 'grunt was not configured for a one-hit defeat');
  await page.waitForFunction(() => __blastlineTest.getState().score >= 20, null, { timeout: 1800 });
  await page.evaluate(() => __blastlineTest.freeze(true));
  const killReward = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(killReward.score, 20);
  assert.equal(killReward.coins, 4);
  checks.killReward = true;
  checks.easyGruntDefeat = true;
  await page.evaluate(() => __blastlineTest.freeze(false));

  await page.evaluate(() => {
    __blastlineTest.reset(107);
  });
  await page.click('#pauseBtn');
  const pauseBefore = await page.evaluate(() => __blastlineTest.getState());
  await page.waitForTimeout(420);
  const paused = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(paused.state, 'paused');
  assert.equal(paused.waveTime, pauseBefore.waveTime, 'wave time advanced while paused');
  assert.equal(paused.bullets, pauseBefore.bullets, 'bullets advanced or spawned while paused');
  await page.click('#resumeBtn');
  await page.waitForFunction(() => __blastlineTest.getState().state === 'playing');
  checks.pauseFreeze = true;
  checks.pauseButton = true;
  checks.resume = true;
  await page.keyboard.press('p');
  assert.equal((await page.evaluate(() => __blastlineTest.getState())).state, 'paused');
  await page.keyboard.press('p');
  assert.equal((await page.evaluate(() => __blastlineTest.getState())).state, 'playing');
  checks.pauseKey = true;

  await page.keyboard.press('Space');
  const spacePaused = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(spacePaused.state, 'paused');
  await page.waitForTimeout(260);
  assert.equal((await page.evaluate(() => __blastlineTest.getState())).waveTime, spacePaused.waveTime, 'Space pause did not freeze simulation');
  await page.keyboard.press('Space');
  assert.equal((await page.evaluate(() => __blastlineTest.getState())).state, 'playing');
  checks.spacePauseKey = true;

  await page.evaluate(() => {
    __blastlineTest.reset(112);
    __blastlineTest.freeze(true);
    __blastlineTest.spawnHordeNow();
  });
  const hordeBefore = await page.evaluate(() => __blastlineTest.getState());
  assert.ok(hordeBefore.activeEnemies >= 12, `expected a large horde, received ${hordeBefore.activeEnemies}`);
  assert.equal(hordeBefore.hordes, 1);
  assert.equal(await page.locator('#enemyCounter').isVisible(), true);
  await page.evaluate(() => __blastlineTest.freeze(false));
  await page.waitForTimeout(320);
  await page.evaluate(() => __blastlineTest.freeze(true));
  const hordeAfter = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(hordeAfter.sampleEnemies.length, hordeBefore.sampleEnemies.length);
  const formationKey = enemy => `${enemy.hordeId}:${enemy.hordeRow}:${enemy.lineX}`;
  const hordeBeforeByFormation = new Map(hordeBefore.sampleEnemies.map(enemy => [formationKey(enemy), enemy]));
  for (const after of hordeAfter.sampleEnemies) {
    const before = hordeBeforeByFormation.get(formationKey(after));
    assert.ok(before, 'enemy formation member could not be matched after marching');
    assert.ok(Math.abs(after.x - after.lineX) < 1e-9, 'enemy left its straight march line');
    assert.ok(after.y > before.y && after.y - before.y < .03, 'enemy horde movement was not slow and forward');
  }
  assert.ok(hordeAfter.sampleEnemies.some(enemy => enemy.marchFrame !== hordeBeforeByFormation.get(formationKey(enemy))?.marchFrame), 'enemy march animation did not advance');
  checks.largeSlowHordes = true;
  checks.straightEnemyMarch = true;
  checks.enemyMarchAnimation = true;
  checks.hordeHud = true;
  await page.evaluate(() => __blastlineTest.freeze(false));

  await page.evaluate(() => {
    __blastlineTest.reset(108);
    __blastlineTest.forceBoss();
  });
  const bossStart = await page.evaluate(() => __blastlineTest.getState());
  await page.waitForFunction(maxHp => {
    const current = __blastlineTest.getState();
    return current.enemyBullets > 0 || current.troops < 12 || (current.boss && current.boss.hp < maxHp);
  }, bossStart.boss.maxHp, { timeout: 3500 });
  await page.waitForFunction(maxHp => {
    const current = __blastlineTest.getState();
    return current.boss && current.boss.hp < maxHp;
  }, bossStart.boss.maxHp, { timeout: 3500 });
  checks.bossAttacks = true;
  checks.bossTakesDamage = true;
  checks.bossHealthHud = await page.locator('#bossHud').isVisible();

  await page.evaluate(() => __blastlineTest.defeatBoss());
  await page.waitForFunction(() => __blastlineTest.getState().state === 'upgrade');
  const upgradeIds = await page.locator('.upgrade-card').evaluateAll(cards => cards.map(card => card.dataset.upgrade));
  assert.equal(upgradeIds.length, 3);
  assert.equal(new Set(upgradeIds).size, 3);
  const chosenUpgrade = upgradeIds[0];
  const beforeUpgrade = await page.evaluate(() => __blastlineTest.getState());
  await page.evaluate(() => __blastlineTest.freeze(true));
  await page.locator('.upgrade-card').first().click();
  const afterUpgrade = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(afterUpgrade.state, 'playing');
  assert.equal(afterUpgrade.wave, 2);
  const changedByUpgrade = {
    troops: afterUpgrade.troops > beforeUpgrade.troops,
    power: afterUpgrade.power > beforeUpgrade.power,
    rate: afterUpgrade.fireRate > beforeUpgrade.fireRate,
    spread: afterUpgrade.projectiles > beforeUpgrade.projectiles,
    velocity: afterUpgrade.bulletSpeed > beforeUpgrade.bulletSpeed,
    armor: afterUpgrade.armor > beforeUpgrade.armor,
  };
  assert.equal(changedByUpgrade[chosenUpgrade], true, `${chosenUpgrade} upgrade did not persist into Wave 2`);
  checks.threeUniqueUpgrades = true;
  checks.upgradePersists = true;
  checks.wave1BossToUpgrade = true;

  await page.evaluate(() => {
    __blastlineTest.freeze(false);
    __blastlineTest.reset(109);
    __blastlineTest.setWave(6);
    __blastlineTest.forceBoss();
    __blastlineTest.defeatBoss();
  });
  const finalBoss = await page.evaluate(() => __blastlineTest.getState());
  assert.equal(finalBoss.state, 'victory');
  assert.equal(finalBoss.wave, 6);
  assert.equal(await page.locator('#victoryPanel').isVisible(), true);
  checks.wave6BossToVictory = true;

  await page.evaluate(() => {
    __blastlineTest.reset(110);
    __blastlineTest.setWave(4);
    __blastlineTest.setTroops(24);
    __blastlineTest.setPower(3);
    __blastlineTest.forceBoss();
    __blastlineTest.freeze(true);
    __blastlineTest.damageTroops(999);
  });
  assert.equal((await page.evaluate(() => __blastlineTest.getState())).state, 'game-over');
  await page.click('#retryBtn');
  const retry = await page.evaluate(() => __blastlineTest.getState());
  assert.deepEqual({
    state: retry.state, wave: retry.wave, score: retry.score, coins: retry.coins, troops: retry.troops,
    armor: retry.armor, power: retry.power, projectiles: retry.projectiles, bullets: retry.bullets,
    enemyBullets: retry.enemyBullets, enemies: retry.enemies, gates: retry.gates.length, boss: retry.boss,
    particles: retry.particles, telegraphs: retry.telegraphs,
  }, {
    state: 'playing', wave: 1, score: 0, coins: 0, troops: 12,
    armor: 0, power: 1, projectiles: 1, bullets: 0,
    enemyBullets: 0, enemies: 0, gates: 0, boss: null,
    particles: 0, telegraphs: 0,
  });
  checks.gameOverAtZero = true;
  checks.cleanRetry = true;

  const progressionContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const progressionPage = await newGameplayPage(progressionContext, 'six-wave-progression');
  const progression = [];
  for (let expectedWave = 1; expectedWave <= 6; expectedWave += 1) {
    await progressionPage.evaluate(() => __blastlineTest.setWaveTime(999));
    await progressionPage.waitForFunction(waveNumber => {
      const current = __blastlineTest.getState();
      return current.state === 'boss' && current.wave === waveNumber;
    }, expectedWave, { timeout: 1200 });
    progression.push(`wave-${expectedWave}`, `boss-${expectedWave}`);
    await progressionPage.evaluate(() => __blastlineTest.defeatBoss());
    if (expectedWave < 6) {
      await progressionPage.waitForFunction(() => __blastlineTest.getState().state === 'upgrade');
      assert.equal(await progressionPage.locator('.upgrade-card').count(), 3);
      progression.push(`upgrade-${expectedWave}`);
      await progressionPage.locator('.upgrade-card').first().click();
      await progressionPage.waitForFunction(waveNumber => {
        const current = __blastlineTest.getState();
        return current.state === 'playing' && current.wave === waveNumber;
      }, expectedWave + 1);
    } else {
      await progressionPage.waitForFunction(() => __blastlineTest.getState().state === 'victory');
      progression.push('victory');
    }
  }
  assert.deepEqual(progression, [
    'wave-1', 'boss-1', 'upgrade-1',
    'wave-2', 'boss-2', 'upgrade-2',
    'wave-3', 'boss-3', 'upgrade-3',
    'wave-4', 'boss-4', 'upgrade-4',
    'wave-5', 'boss-5', 'upgrade-5',
    'wave-6', 'boss-6', 'victory',
  ]);
  const persisted = await progressionPage.evaluate(() => ({
    best: Number(localStorage.getItem('blastline-best-score')),
    lifetimeCoins: Number(localStorage.getItem('blastline-lifetime-coins')),
  }));
  assert.ok(persisted.best > 0);
  assert.ok(persisted.lifetimeCoins > 0);
  await progressionPage.goto(`${baseURL}/?qa=1`, { waitUntil: 'networkidle' });
  await waitUntilReady(progressionPage);
  assert.equal((await progressionPage.locator('#homeBest').textContent()).replaceAll(',', ''), String(persisted.best));
  assert.equal((await progressionPage.locator('#homeCoins').textContent()).replaceAll(',', ''), String(persisted.lifetimeCoins));
  checks.sixWaveProgression = true;
  checks.bestScorePersistence = true;
  checks.lifetimeCoinPersistence = true;
  await progressionContext.close();

  await page.evaluate(() => __blastlineTest.freeze(false));
  await page.setViewportSize({ width: 1365, height: 768 });
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => innerWidth), 1365);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => innerWidth), 390);
  checks.mobileDesktopResize = true;
  checks.averageDrawMsMobile = await page.evaluate(() => __blastlineTest.benchmarkDraw(240));
  await page.setViewportSize({ width: 1365, height: 768 });
  checks.averageDrawMsDesktop = await page.evaluate(() => __blastlineTest.benchmarkDraw(240));

  await context.close();

  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(failedRequests.length, 0, failedRequests.join('\n'));
  assert.ok(![...requests].some(requestPath => requestPath.includes('/assets/source/')), 'source master sheet loaded at runtime');
  checks.noConsoleErrors = true;
  checks.noFailedAssets = true;
  checks.noSourceMastersAtRuntime = true;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const result = {
  generatedAt: new Date().toISOString(),
  targetViewports: {
    mobile: { width: 390, height: 844, deviceScaleFactor: 1 },
    desktop: { width: 1365, height: 768, deviceScaleFactor: 1 },
  },
  pass: Object.entries(checks).filter(([name]) => !name.startsWith('averageDrawMs')).every(([, value]) => value === true),
  checks,
  captures,
  runtimeRequests: [...requests].sort(),
  consoleErrors: errors,
  failedRequests,
};

fs.writeFileSync(path.join(OUTPUT, 'validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
