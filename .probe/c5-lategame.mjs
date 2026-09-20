import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.css','text/css'],['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.json','application/json']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const DIFF = process.env.DIFF || 'veteran';
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(400);
const picker = await page.$$('#difficultyPicker button');
const idx = { recruit: 0, veteran: 1, elite: 2 }[DIFF];
if (picker && picker[idx]) await picker[idx].click();
await page.click('#playBtn');
await page.waitForTimeout(600);
await page.evaluate(() => {
  __blastlineTest.setWave(8);
  __blastlineTest.setBuild({ power: 5, fireRate: 7.5, armor: 12, projectiles: 2, pierce: 1, bulletSpeed: 1.4 });
  __blastlineTest.setTroops(30);
});
await page.mouse.move(682, 630); await page.mouse.down();
const t0 = Date.now();
const shotDone = {};
while ((Date.now()-t0)/1000 < 220) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, troops: st.troops, enemies: st.enemies, lives: st.lives, boss: st.boss ? Math.round(st.boss.hp) : null, m: __blastlineTest.frameMetrics() }; });
  if (s.state === 'armory') {
    const first = await page.$('#rewardCards .reward-card:not([disabled])');
    if (first) { await first.click(); await page.waitForTimeout(200); }
    const cont = await page.$('.armory-continue');
    if (cont && await cont.isEnabled()) await cont.click();
    await page.waitForTimeout(300); continue;
  }
  if (s.state === 'game-over') { console.log('LATE GAME OVER at wave', s.wave); break; }
  console.log('LATE', DIFF, JSON.stringify({ w: s.wave, troops: s.troops, en: s.enemies, lives: s.lives, boss: s.boss, p95: Math.round(s.m.p95||0) }));
  if ((s.enemies > 20 || s.boss) && !shotDone[s.wave]) { shotDone[s.wave] = 1; await page.screenshot({ path: `/tmp/shots/c5-late-${DIFF}-w${s.wave}${s.boss?'-boss':''}.png` }); }
  if (s.wave >= 14) break;
  await page.waitForTimeout(1500);
}
await page.mouse.up().catch(()=>{});
console.log('JS ERRORS:', errors.length ? errors : 'none');
await browser.close();
