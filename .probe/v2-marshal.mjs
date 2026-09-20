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
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150); await page.tap('#playBtn'); await page.waitForTimeout(400);
const out = await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 2, fireRate: 6, projectiles: 4, pierce: 0, plating: 0, bulletSpeed: 1, criticalChance: 0 });
  __blastlineTest.setTroops(30);
  __blastlineTest.setWave(9);
  __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1);
  __blastlineTest.advance(0.2);
  __blastlineTest.setWaveTime(0);
  const st0 = __blastlineTest.getState();
  __blastlineTest.advance(2.2); // march past BOSS_ENGAGEMENT_Y
  __blastlineTest.fireNow(8);
  __blastlineTest.advance(1.5);
  const st = __blastlineTest.getState();
  return { archetype: st.bossArchetype, gate: st.bossDmgGate, bossHp: st.boss && st.boss.hp,
    reflects: st.sampleEnemyBullets ? st.sampleEnemyBullets.filter(b => b.kind === 'reflect').length : 'n/a',
    enemyBullets: st.enemyBullets, state: st.state };
});
console.log('MARSHAL', JSON.stringify(out));
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
