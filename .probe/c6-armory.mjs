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
for (const vp of [{ width: 390, height: 844, tag: 'portrait' }, { width: 844, height: 390, tag: 'landscape' }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { __blastlineTest.reset(42, 'veteran'); __blastlineTest.setPoints(5000); });
  await page.evaluate(() => { __blastlineTest.purchase('__noop__'); }); // opens armory via purchase path
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#rewardCards .reward-card, .reward-card')];
    const panel = document.querySelector('.armory-panel') || document.querySelector('#armory') || cards[0]?.closest('div');
    const titles = cards.map(c => (c.querySelector('.reward-title, h3, .card-title')?.textContent || c.textContent || '').trim().slice(0, 22));
    const overflow = cards.some(c => { const r = c.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1; });
    return { state: __blastlineTest.getState().state, cardCount: cards.length, titles, overflow, vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight };
  });
  console.log('ARMORY', vp.tag, JSON.stringify(info));
  await page.screenshot({ path: `/home/sandbox/c6-evidence/armory-9cards-${vp.tag}.png` });
  console.log('JS ERRORS', vp.tag, errors.length ? errors : 'none');
  await page.close();
}
await browser.close();
server.close();
