import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.css','text/css'],['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
console.log('STEP launch'); await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(600); console.log('STEP loaded');
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn'); console.log('STEP tapped');
await page.waitForTimeout(500);
// realistic wave-3 build, then fast-forward to the wave-3 boss
const r = await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 3, fireRate: 7, projectiles: 2, pierce: 1, plating: 3, bulletSpeed: 1.15, criticalChance: .06 });
  __blastlineTest.setTroops(36);
  __blastlineTest.setWave(3);
  __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1); __blastlineTest.advance(0.2); __blastlineTest.setWaveTime(0); __blastlineTest.fireNow(4); __blastlineTest.advance(0.9); __blastlineTest.fireNow(4); __blastlineTest.advance(0.1);     // boss enters at y=-0.12 and marches in
  const st = __blastlineTest.getState();
  return { state: st.state, boss: st.boss || null, archetype: st.bossArchetype, dmgGate: st.bossDmgGate, floaters: st.sampleFloaters || null };
});
console.log('BOSS-INTRO', JSON.stringify(r));
await page.evaluate(() => { __blastlineTest.setWaveTime(0); });
await page.waitForTimeout(120);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-boss-intro.png' });
await page.waitForTimeout(300);
// boss mid-fight: advance sim, confirm gate blocks pre-crest damage
const g = await page.evaluate(() => {
  const before = __blastlineTest.getState().boss;
  __blastlineTest.fireNow(6);
  __blastlineTest.advance(0.5);
  const st = __blastlineTest.getState();
  return { y0: before && before.y, hp0: before && before.hp, y1: st.boss && st.boss.y, hp1: st.boss && st.boss.hp, state: st.state, archetype: st.bossArchetype, dmgGate: st.bossDmgGate };
});
console.log('BOSS-GATE', JSON.stringify(g));
const m = await page.evaluate(() => { __blastlineTest.advance(4); const st = __blastlineTest.getState(); return { y: st.boss && st.boss.y, hp: st.boss && st.boss.hp, maxHp: st.boss && st.boss.maxHp, phase: st.boss && st.boss.phase }; });
console.log('BOSS-MID', JSON.stringify(m));
await page.waitForTimeout(400);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-boss-mid.png' });
const d = await page.evaluate(() => { __blastlineTest.defeatBoss(); __blastlineTest.advance(1); const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, score: st.score }; });
console.log('BOSS-DEFEAT', JSON.stringify(d));
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-boss-reward.png' });
console.log('JS ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close(); server.close(); process.exit(0);
