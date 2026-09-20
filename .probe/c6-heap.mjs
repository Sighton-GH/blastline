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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(400);
const heap = async () => page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : -1);
await page.evaluate(() => { __blastlineTest.reset(42, 'elite'); __blastlineTest.setWave(10); __blastlineTest.setTroops(60); __blastlineTest.setBuild({ power: 6, fireRate: 8, projectiles: 2, pierce: 1 }); });
const samples = [];
samples.push({ t: 0, mb: +(await heap()).toFixed(1) });
// 5 minutes of accelerated elite wave-10 combat with armory churn
const t0 = Date.now();
let armChurn = 0;
while ((Date.now() - t0) / 1000 < 300) {
  await page.evaluate(() => { const s = __blastlineTest.getState(); if (s.state === 'armory') { __blastlineTest.chooseReward(); const b = document.querySelector('.armory-continue'); if (b) b.click(); } else if (s.state === 'game-over') { __blastlineTest.reset(42, 'elite'); __blastlineTest.setWave(10); __blastlineTest.setTroops(60); } __blastlineTest.advance(5); });
  armChurn++;
  const t = Math.round((Date.now() - t0) / 1000);
  if (t % 30 < 6) samples.push({ t, mb: +(await heap()).toFixed(1), state: (await page.evaluate(() => __blastlineTest.getState().state)) });
}
console.log('HEAP', JSON.stringify(samples));
console.log('churn iterations', armChurn, 'JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close();
