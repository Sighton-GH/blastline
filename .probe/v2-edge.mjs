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
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn'); await page.waitForTimeout(400);

// Scenario A: squad parked hard RIGHT, brutes marching on BOTH extreme edges
const setupA = await page.evaluate(() => {
  const T = __blastlineTest;
  T.setBuild({ power: 3, fireRate: 6, projectiles: 1, pierce: 0, ricochet: 0, plating: 9 });
  T.setTroops(24);
  for (const [lane, y] of [[0,.45],[0,.62],[0,.78],[2,.48],[2,.65],[2,.80]]) T.spawnEnemyAt('brute', lane, y);
  const shoved = T.shoveEnemiesToEdge('brute');
  T.setPlayerX(0.86);
  T.setWaveTime(0);
  return { shoved, before: T.typeAudit('brute') };
});
console.log('A setup', JSON.stringify(setupA));
await page.waitForTimeout(120);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-edge-A-before.png' });
const afterA = await page.evaluate(() => { __blastlineTest.advance(9); return __blastlineTest.typeAudit('brute'); });
console.log('A after 9s (surviving brutes):', JSON.stringify(afterA));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-edge-A-after.png' });

// Scenario B: squad hard LEFT, fresh brutes on both edges
const setupB = await page.evaluate(() => {
  const T = __blastlineTest;
  for (const e of (T.typeAudit('brute'), [])) {}
  for (const [lane, y] of [[0,.42],[0,.60],[2,.44],[2,.63]]) T.spawnEnemyAt('brute', lane, y);
  const shoved = T.shoveEnemiesToEdge('brute');
  T.setPlayerX(-0.86);
  return { shoved };
});
console.log('B setup', JSON.stringify(setupB));
const afterB = await page.evaluate(() => { __blastlineTest.advance(9); return __blastlineTest.typeAudit('brute'); });
console.log('B after 9s (surviving brutes):', JSON.stringify(afterB));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-edge-B-after.png' });

// Sizing evidence: portrait squads at near/mid/far with a full wave field
await page.evaluate(() => { const T = __blastlineTest; T.setPlayerX(0); T.setWave(4); T.setWaveTime(1.5); T.advance(4); });
await page.waitForTimeout(150);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-size-portrait-mid.png' });
await page.evaluate(() => { __blastlineTest.advance(6); });
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-size-portrait-near.png' });
await browser.close(); server.close(); process.exit(0);
