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

// run a bit, then pause via the header button (real touch path)
await page.evaluate(() => { __blastlineTest.setPoints(800); __blastlineTest.advance(3); });
const prePause = await page.evaluate(() => __blastlineTest.getState());
await page.tap('#pauseBtn'); await page.waitForTimeout(250);
const pausedState = await page.evaluate(() => __blastlineTest.getState());
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-pauseshop-1-pause.png' });

// open the shop from pause (real button)
await page.tap('#pauseShopBtn'); await page.waitForTimeout(300);
const shopState = await page.evaluate(() => __blastlineTest.getState());
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-pauseshop-2-shop.png' });

// buy the first affordable card via real tap
const before = await page.evaluate(() => ({ points: __blastlineTest.getState().points }));
await page.evaluate(() => window.scrollTo(0, 0));
const card = page.locator('#rewardCards .reward-card:not([disabled])').first();
const cardName = await card.getAttribute('data-upgrade');
await card.tap(); await page.waitForTimeout(250);
const afterBuy = await page.evaluate(() => __blastlineTest.getState());
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-pauseshop-3-bought.png' });

// freeze check: nothing advances while in paused-shop
const freeze1 = await page.evaluate(() => ({ t: __blastlineTest.getState().waveTime, enemies: __blastlineTest.typeAudit('grunt').length }));
await page.waitForTimeout(800);
const freeze2 = await page.evaluate(() => ({ t: __blastlineTest.getState().waveTime, enemies: __blastlineTest.typeAudit('grunt').length }));

// close -> back to pause panel
await page.tap('.armory-continue'); await page.waitForTimeout(250);
const backState = await page.evaluate(() => __blastlineTest.getState());
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-pauseshop-4-back.png' });

// resume -> playing again
await page.tap('#resumeBtn'); await page.waitForTimeout(300);
const resumed = await page.evaluate(() => __blastlineTest.getState());

console.log(JSON.stringify({
  prePause: { state: prePause.state, waveTime: prePause.waveTime },
  pausedState: pausedState.state,
  shopState: shopState.state,
  cardName,
  pointsBeforeBuy: before.points, pointsAfterBuy: afterBuy.points, stateAfterBuy: afterBuy.state,
  powerAfterBuy: afterBuy.player?.power,
  freeze1, freeze2,
  backState: backState.state,
  resumed: resumed.state, waveTimeAfterResume: resumed.waveTime,
}, null, 1));

// landscape regression: shop from pause on desktop-ish layout
const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page2.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page2.waitForTimeout(500);
await page2.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page2.waitForTimeout(150);
await page2.click('#playBtn'); await page2.waitForTimeout(400);
await page2.evaluate(() => { __blastlineTest.setPoints(800); __blastlineTest.advance(2); __blastlineTest.pause(); __blastlineTest.openPauseShop(); });
await page2.waitForTimeout(300);
await page2.screenshot({ path: '/home/sandbox/c6-evidence/v2-pauseshop-5-landscape.png' });
const landState = await page2.evaluate(() => __blastlineTest.getState().state);
console.log('landscape paused-shop state:', landState);
await browser.close(); server.close(); process.exit(0);
