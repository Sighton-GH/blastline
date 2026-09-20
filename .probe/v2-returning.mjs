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
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(500);
// returning player: 3h10m away, 120 salvage banked
await page.evaluate(() => { localStorage.setItem('blastline.profile.v1', JSON.stringify({ salvage: 120, tiers: { salvageRate: 2 }, earned: 300, best: { wave: 9, score: 40211 }, lastSeen: Date.now() - (3*3600+600)*1000, runs: 7 })); location.reload(); });
await page.waitForTimeout(800);
const home = await page.evaluate(() => {
  const banner = document.getElementById('cacheBanner');
  const p = JSON.parse(localStorage.getItem('blastline.profile.v1'));
  return { bannerText: banner ? banner.textContent.trim() : null, bannerHidden: banner ? banner.classList.contains('hidden') : null, salvageNow: p.salvage, lastSeenReset: Date.now() - p.lastSeen < 60000 };
});
console.log('RETURNING', JSON.stringify(home));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-returning-home.png' });
// quick run to game over: wave 5, weak build, no reserves
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn');
await page.waitForTimeout(400);
const go = await page.evaluate(() => {
  __blastlineTest.setWave(9); __blastlineTest.setWaveTime(0); __blastlineTest.setTroops(3);
  let steps = 0;
  while (steps++ < 1500) { __blastlineTest.advance(0.1); const s = __blastlineTest.getState(); if (s.state === 'game-over') break; }
  const t = (id) => (document.getElementById(id) || {}).textContent;
  return { finalScore: t('finalScore'), finalWave: t('finalWave'), finalSalvage: t('finalSalvage'), salvageHidden: (document.getElementById('finalSalvage')||{}).hidden, bestCallouts: [...document.querySelectorAll('.record-callout, #recordCallout')].map(e => e.textContent.trim()).filter(Boolean) };
});
console.log('GAMEOVER', JSON.stringify(go));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-gameover.png' });
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
