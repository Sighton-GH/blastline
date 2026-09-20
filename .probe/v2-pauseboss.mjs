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
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn'); await page.waitForTimeout(500);
// wave-12 engine boss on mobile landscape, mid-fight with telegraphs live
const r = await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 3, fireRate: 6, projectiles: 2, pierce: 1, plating: 4, bulletSpeed: 1.1, criticalChance: .06 });
  __blastlineTest.setTroops(36);
  __blastlineTest.setWave(12); __blastlineTest.setWaveTime(0);
  __blastlineTest.forceBoss();
  __blastlineTest.advance(6); // boss settled, attacks underway
  const s = __blastlineTest.getState();
  return { state: s.state, archetype: s.bossArchetype, bossHp: s.boss && s.boss.hp, bossY: s.boss && s.boss.y, telegraphs: (s.telegraphs || []).length };
});
console.log('ENGINE', JSON.stringify(r));
await page.waitForTimeout(200);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-engine-land.png' });
// pause mid-fight, advance — everything must freeze; resume — continues
const p = await page.evaluate(() => {
  document.getElementById('pauseBtn').click();
  const s1 = __blastlineTest.getState();
  const hp1 = s1.boss && s1.boss.hp, t1 = (s1.telegraphs || []).length;
  __blastlineTest.advance(3);
  const s2 = __blastlineTest.getState();
  document.getElementById('resumeBtn').click();
  __blastlineTest.advance(2);
  const s3 = __blastlineTest.getState();
  return { pausedState: s1.state, hpFrozen: (s2.boss && s2.boss.hp) === hp1, stateDuringAdvance: s2.state, resumedState: s3.state, hpAfter: s3.boss && s3.boss.hp };
});
console.log('PAUSE', JSON.stringify(p));
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
