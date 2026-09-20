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
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(700);
// seed a profile: salvage + tiers + an old lastSeen to trigger the cache banner
await page.evaluate(() => {
  localStorage.setItem('blastline.profile.v1', JSON.stringify({ salvage: 200, tiers: { startingTroops: 3, startingPower: 8 }, earned: 0, best: { wave: 5, score: 9000 }, lastSeen: Date.now() - 3*3600e3, runs: 4 }));
  location.reload();
});
await page.waitForTimeout(900);
const home = await page.evaluate(() => ({
  metaCards: document.querySelectorAll('#metaPanel .meta-card').length,
  headText: document.querySelector('#metaPanel .meta-head')?.textContent?.replace(/\s+/g,' ').trim(),
  cacheBanner: document.querySelector('#cacheBanner')?.textContent,
  cacheVisible: !document.querySelector('#cacheBanner')?.hidden,
}));
console.log('HOME', JSON.stringify(home, null, 1));
// buy a meta upgrade (first affordable)
await page.locator('#metaPanel .meta-card:not([disabled])').first().click();
await page.waitForTimeout(300);
const afterBuy = await page.evaluate(() => JSON.parse(localStorage.getItem('blastline.profile.v1')));
console.log('AFTER BUY salvage', afterBuy.salvage, 'tiers', JSON.stringify(afterBuy.tiers));
// start a run: starting bonuses should apply (troops 14+12+4=30? startingTroops now 4 tiers -> +16, power 8->+2)
await page.click('#playBtn');
await page.waitForTimeout(800);
const st = await page.evaluate(() => { const s = __blastlineTest.getState(); return { state: s.state, troops: s.troops, power: s.power }; });
console.log('RUN START', JSON.stringify(st));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-home-meta.png' });
// force game over: salvage line should appear
await page.evaluate(() => __blastlineTest.forceGameOver());
await page.waitForTimeout(600);
const over = await page.evaluate(() => ({
  state: __blastlineTest.getState().state,
  salvageText: document.querySelector('#finalSalvage')?.textContent,
  salvageVisible: !document.querySelector('#finalSalvage')?.hidden,
  stored: JSON.parse(localStorage.getItem('blastline.profile.v1')).salvage,
}));
console.log('GAME OVER', JSON.stringify(over, null, 1));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-gameover-salvage.png' });
console.log('JS ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
await new Promise(r=>server.close(r));
