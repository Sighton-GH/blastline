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
  const card = document.querySelector('.reward-card');
  const chain = [];
  let el = card;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    chain.push({ cls: (el.className || '').toString().slice(0, 40), oy: cs.overflowY, sh: el.scrollHeight, ch: el.clientHeight });
    el = el.parentElement;
  }
  return chain.filter(n => n.oy !== 'visible' || n.sh > n.ch + 10);
});
console.log(JSON.stringify(info, null, 1));
// try scrolling the panel to bottom and confirm last card reachable
const reached = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.reward-card')];
  const last = cards.at(-1);
  last.scrollIntoView({ block: 'center' });
  const r = last.getBoundingClientRect();
  return { lastCardCenterVisible: r.top >= 0 && r.bottom <= innerHeight, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight };
});
console.log('REACH', JSON.stringify(reached));
await page.screenshot({ path: '/home/sandbox/c6-evidence/armory-9cards-landscape-scrolled.png' });
await browser.close(); server.close();
