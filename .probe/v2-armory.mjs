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
const errors = [];
for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', e => errors.push(name+': '+e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(name+' CONSOLE: '+m.text()); });
  await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.click('#playBtn');
  await page.waitForTimeout(500);
  await page.evaluate(() => { __blastlineTest.setPoints(5000); __blastlineTest.setWaveTime(999); });
  await page.waitForFunction(() => __blastlineTest.getState().state === 'armory', null, { timeout: 8000 });
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#rewardCards .reward-card')];
    const grid = document.querySelector('#rewardCards').getBoundingClientRect();
    const panel = document.querySelector('#rewardPanel').getBoundingClientRect();
    const ids = cards.map(c => c.dataset.upgrade);
    const last = cards[cards.length-1]?.getBoundingClientRect();
    return { count: cards.length, ids, gridBottom: Math.round(grid.bottom), panelBottom: Math.round(panel.bottom), lastCardBottom: Math.round(last?.bottom||0), viewportH: innerHeight, overflow: Math.round((last?.bottom||0) - panel.bottom) };
  });
  console.log(name.toUpperCase(), JSON.stringify(info));
  await page.screenshot({ path: `/home/sandbox/c6-evidence/v2-armory-10-${name}.png` });
  await page.close();
}
console.log('JS ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
await new Promise(r=>server.close(r));
