// Encounter-lane validation: behavioral checks + screenshots for the enemy
// diversity / events / elites / breach-pressure lane. Run:
//   node tools/encounter-lane-validation.mjs
// Requires playwright (dev-only) and serves the game via the static preview.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4199;
const baseURL = `http://127.0.0.1:${PORT}`;
const shots = '/tmp/encounter-shots';
mkdirSync(shots, { recursive: true });

const server = spawn('node', ['tools/static-preview-server.mjs', '--host', '127.0.0.1', '--port', String(PORT)], { stdio: 'ignore' });
for (let attempt = 0; attempt < 40; attempt += 1) {
  const up = await fetch(`${baseURL}/index.html`).then(r => r.ok).catch(() => false);
  if (up) break;
  await new Promise(resolve => setTimeout(resolve, 250));
}

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => record(`pageerror: ${error.message}`, false));
  await page.goto(`${baseURL}/?qa=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => globalThis.__blastlineTest?.getState().assetsReady === 'true');
  const T = (fn, arg) => page.evaluate(([f, a]) => __blastlineTest[f](a), [fn, arg]);

  // --- Bulwark per-hit cap: one power-10 bullet takes exactly the cap ---
  await page.evaluate(() => {
    __blastlineTest.reset(101, 'veteran');
    __blastlineTest.setWave(6);
    __blastlineTest.setBuild({ troops: 1, power: 7, projectiles: 1, fireRate: 1.5, criticalChance: 0, pierce: 0, ricochet: 0 });
    __blastlineTest.setPlayerX(0);
    __blastlineTest.spawnEnemyAt('bulwark', 1, .5);
  });
  const bulwarkBefore = (await page.evaluate(() => __blastlineTest.typeAudit('bulwark')))[0];
  await page.evaluate(() => __blastlineTest.advance(1.6)); // a few volleys land
  const bulwarkAfter = (await page.evaluate(() => __blastlineTest.typeAudit('bulwark')))[0];
  const bulwarkLost = bulwarkBefore && bulwarkAfter ? bulwarkBefore.hp - bulwarkAfter.hp : 0;
  // Every hit must be exactly the cap (2): total damage is a multiple of 2
  // with at least one hit, and never a multiple of the 7-power uncapped hit.
  record('bulwark caps every hit at 2 damage', bulwarkLost > 0 && bulwarkLost % 2 === 0 && bulwarkLost % 7 !== 0,
    `hp ${bulwarkBefore?.hp} -> ${bulwarkAfter?.hp} (lost ${bulwarkLost})`);

  // --- Warden aura: protected grunt takes 65%; the warden itself full ---
  await page.evaluate(() => {
    __blastlineTest.reset(102, 'veteran');
    __blastlineTest.setWave(6);
    __blastlineTest.setBuild({ troops: 1, power: 10, projectiles: 1, fireRate: 1.5, criticalChance: 0, pierce: 0, ricochet: 0 });
    __blastlineTest.setPlayerX(0);
    __blastlineTest.spawnEnemyAt('warden', 1, .44);
    __blastlineTest.spawnEnemyAt('heavy', 1, .47); // inside the aura, in front of the warden
  });
  const auraBefore = await page.evaluate(() => ({ warden: __blastlineTest.typeAudit('warden')[0], heavy: __blastlineTest.typeAudit('heavy')[0] }));
  await page.evaluate(() => { __blastlineTest.fireNow(1); __blastlineTest.advance(1.6); });
  const auraAfter = await page.evaluate(() => ({ warden: __blastlineTest.typeAudit('warden')[0], heavy: __blastlineTest.typeAudit('heavy')[0] }));
  const heavyLost = auraBefore.heavy && auraAfter.heavy ? auraBefore.heavy.hp - auraAfter.heavy.hp : null;
  const auraHits = heavyLost !== null ? heavyLost / 6.5 : 0;
  record('warden aura reduces ally damage to 65% per hit', heavyLost !== null && Number.isInteger(auraHits) && auraHits >= 1,
    `heavy lost ${heavyLost} hp = ${auraHits} hits x 6.5`);

  // --- Sapper blast chains into nearby enemies ---
  await page.evaluate(() => {
    __blastlineTest.reset(103, 'veteran');
    __blastlineTest.setWave(6);
    __blastlineTest.setBuild({ troops: 1, power: 10, projectiles: 1, fireRate: 1.5, criticalChance: 0, pierce: 0, ricochet: 0 });
    __blastlineTest.setPlayerX(0);
    __blastlineTest.spawnEnemyAt('sapper', 1, .5);
    __blastlineTest.spawnEnemyAt('grunt', 1, .53);
    __blastlineTest.spawnEnemyAt('grunt', 1, .56);
  });
  await page.evaluate(() => { __blastlineTest.fireNow(1); __blastlineTest.advance(2.2); });
  const blastAudit = await page.evaluate(() => ({ grunts: __blastlineTest.typeAudit('grunt').length, kills: __blastlineTest.pointsAudit().kills }));
  record('sapper detonation chains into nearby enemies', blastAudit.kills >= 2, `kills ${blastAudit.kills}, grunts left ${blastAudit.grunts}`);

  // --- Breach: a leak past the line now costs troops ---
  await page.evaluate(() => {
    __blastlineTest.reset(104, 'veteran');
    __blastlineTest.setWave(1);
    __blastlineTest.setBuild({ troops: 14, power: 1, projectiles: 1, fireRate: 1.5, plates: 0, platesMax: 0 });
    __blastlineTest.setPlayerX(-0.58); // player in lane 0; leak comes down lane 2
    __blastlineTest.spawnEnemyAt('grunt', 2, .84);
  });
  const troopsBefore = (await page.evaluate(() => __blastlineTest.pointsAudit())).troops;
  await page.evaluate(() => __blastlineTest.advance(1.1));
  const troopsAfter = (await page.evaluate(() => __blastlineTest.pointsAudit())).troops;
  record('non-overlapping breach deals half contact (never free)', troopsBefore - troopsAfter === 1, `troops ${troopsBefore} -> ${troopsAfter}`);

  // --- Events: wave 4 plans an elite; forcing it spawns a named elite ---
  const plan = await page.evaluate(() => { __blastlineTest.reset(105, 'veteran'); return __blastlineTest.eventPlan(4).map(e => `${e.kind}@${e.at}`); });
  record('wave 4 schedule includes the elite intro', plan.some(entry => entry.startsWith('elite@')), JSON.stringify(plan));
  const elite = await page.evaluate(() => __blastlineTest.spawnEliteNow(4, .4));
  record('elite spawns with name and scaled hp', elite?.name === 'WARDEN PRIME' && elite.hp >= 60, JSON.stringify(elite));
  const eliteBar = await page.evaluate(() => __blastlineTest.eventAudit().elites);
  record('elite audit tracks the live elite', eliteBar.length === 1, JSON.stringify(eliteBar));

  // Elite bounty: killing it pays out
  await page.evaluate(() => {
    __blastlineTest.setBuild({ troops: 1, power: 10, projectiles: 1, fireRate: 1.5, criticalChance: 0, pierce: 0, ricochet: 0 });
    __blastlineTest.setPlayerX(0);
    const e = __blastlineTest.eventAudit().elites[0];
    if (e) __blastlineTest.setEnemyHp(0, e.y, 1); // elite is pinned to lane 1 (x 0)
  });
  const pointsBefore = (await page.evaluate(() => __blastlineTest.pointsAudit())).points;
  await page.evaluate(() => { __blastlineTest.fireNow(1); __blastlineTest.advance(1.8); });
  const bounty = (await page.evaluate(() => __blastlineTest.pointsAudit())).points - pointsBefore;
  record('elite kill pays its bounty', bounty >= 300, `+${bounty} points`);

  // --- Strafe event fires telegraphed lanes over time ---
  await page.evaluate(() => { __blastlineTest.reset(106, 'veteran'); __blastlineTest.setWave(5); __blastlineTest.forceEvent('strafe'); });
  const strafe = await page.evaluate(() => ({ strikes: __blastlineTest.eventAudit().strikes, state: __blastlineTest.getState().state }));
  record('strafe event queues the delayed third lane', strafe.strikes === 1, JSON.stringify(strafe));

  // --- Screenshots: new-type markers, elite plate, strafe telegraphs ---
  await page.evaluate(() => {
    __blastlineTest.reset(107, 'veteran');
    __blastlineTest.setWave(8);
    __blastlineTest.setBuild({ troops: 30, power: 3, projectiles: 2, fireRate: 3 });
    __blastlineTest.setPlayerX(0);
    __blastlineTest.spawnEnemyAt('warden', 0, .34);
    __blastlineTest.spawnEnemyAt('bulwark', 1, .3);
    __blastlineTest.spawnEnemyAt('sapper', 2, .36);
    __blastlineTest.spawnEnemyAt('grunt', 0, .38);
    __blastlineTest.spawnEnemyAt('grunt', 1, .34);
    __blastlineTest.advance(.4);
    __blastlineTest.fireNow(1);
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${shots}/new-types.png` });

  await page.evaluate(() => { __blastlineTest.spawnEliteNow(8, .3); __blastlineTest.advance(.3); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${shots}/elite.png` });

  await page.evaluate(() => { __blastlineTest.forceEvent('strafe'); __blastlineTest.advance(.5); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${shots}/strafe.png` });

  // --- Perf: update + draw stay in budget with the lane active ---
  const perf = await page.evaluate(() => ({ update: __blastlineTest.benchmarkUpdate(120), draw: __blastlineTest.benchmarkDraw(60) }));
  record('perf budget with elites + events on field', perf.update < 4 && perf.draw < 12, `update ${perf.update.toFixed(2)}ms draw ${perf.draw.toFixed(2)}ms`);

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${shots}`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser?.close();
  server.kill();
}
