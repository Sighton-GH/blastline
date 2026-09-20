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
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { __blastlineTest.reset(42, 'veteran'); __blastlineTest.setPoints(5000); try { __blastlineTest.purchase('__noop__'); } catch {} });
await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.reward-card')];
  let scroller = cards[0];
  while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) scroller = scroller.parentElement;
  const cont = document.querySelector('.armory-continue');
  const cr = cont?.getBoundingClientRect();
  return {
    scrollable: !!scroller && scroller !== document.body,
    scrollerClass: scroller?.className,
    scrollableRange: scroller ? scroller.scrollHeight - scroller.clientHeight : 0,
    continueVisible: cr ? cr.top >= 0 && cr.bottom <= innerHeight && cr.left >= 0 && cr.right <= innerWidth : false,
    lastCardBottom: cards.length ? cards.at(-1).getBoundingClientRect().bottom : 0,
    vh: innerHeight,
  };
});
console.log(JSON.stringify(info));
await browser.close(); server.close();
