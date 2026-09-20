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
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.evaluate(() => { __blastlineTest.reset(42, 'elite'); __blastlineTest.setWave(12); __blastlineTest.setTroops(6); __blastlineTest.setBuild({ power: 1, fireRate: 2 }); });
// sustain near-cap population for 8 real seconds, sampling live rAF frames
await page.evaluate(() => {
  window.__keeper = setInterval(() => { const n = __blastlineTest.getState().activeEnemies; if (n < 200) { __blastlineTest.spawnHordeNow(); } }, 250);
  __blastlineTest.frameMetrics(true);
});
await page.waitForTimeout(8000);
const r = await page.evaluate(() => { clearInterval(window.__keeper); const f = __blastlineTest.frameMetrics(); const s = __blastlineTest.getState(); return { enemies: s.activeEnemies, samples: f.samples, p50: f.p50, p95: f.p95, max: f.max, over50: f.over50 }; });
console.log('LIVEPERF', JSON.stringify(r));
await page.screenshot({ path: '/home/sandbox/c6-evidence/dense-200-mobile.png' });
await browser.close(); server.close();
