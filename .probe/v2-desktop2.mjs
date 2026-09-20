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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150); await page.click('#playBtn'); await page.waitForTimeout(400);
// reach the wave-3 armory naturally, screenshot the 10-card shop on desktop
await page.evaluate(() => { __blastlineTest.setTroops(30); __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1); __blastlineTest.advance(0.3); });
await page.waitForTimeout(300);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-desktop-armory.png' });
const arm = await page.evaluate(() => ({ cards: document.querySelectorAll('#rewardCards .reward-card').length, state: __blastlineTest.getState().state }));
console.log('DESKTOP-ARMORY', JSON.stringify(arm));
// buy first affordable, continue, then wave-3 boss
await page.evaluate(() => { const c = document.querySelector('#rewardCards .reward-card:not([disabled])'); if (c) c.click(); const b = document.querySelector('.armory-continue'); if (b && !b.disabled) b.click(); });
await page.waitForTimeout(300);
const boss = await page.evaluate(() => {
  __blastlineTest.setWave(3);
  __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1);
  __blastlineTest.advance(0.2); __blastlineTest.setWaveTime(0);
  __blastlineTest.advance(2.6);
  const st = __blastlineTest.getState();
  return { state: st.state, archetype: st.bossArchetype, gate: st.bossDmgGate != null ? +st.bossDmgGate.toFixed(3) : null, bossY: st.boss && +st.boss.y.toFixed(3) };
});
console.log('DESKTOP-BOSS', JSON.stringify(boss));
await page.waitForTimeout(200);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-desktop-boss.png' });
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
