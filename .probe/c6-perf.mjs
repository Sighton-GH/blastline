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
for (const vp of [{ width: 390, height: 844, tag: 'mobile' }]) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.evaluate(() => { __blastlineTest.reset(42, 'veteran'); __blastlineTest.setWave(9); __blastlineTest.setTroops(80); __blastlineTest.setBuild({ power: 5, fireRate: 7, projectiles: 2, pierce: 1 }); });
  for (const target of [132, 200, 220]) {
    const r = await page.evaluate(async (n) => {
      const st = __blastlineTest.getState();
      for (let g = 0; g < 60 && __blastlineTest.getState().activeEnemies < n; g++) { __blastlineTest.spawnHordeNow(); __blastlineTest.advance(0.05); }
      __blastlineTest.advance(1);
      const m = __blastlineTest.frameMetrics(true);
      for (let i = 0; i < 150; i++) __blastlineTest.advance(1/60);
      const f = __blastlineTest.frameMetrics();
      const draw = __blastlineTest.benchmarkDraw(60);
      const upd = __blastlineTest.benchmarkUpdate(60);
      return { enemies: __blastlineTest.getState().activeEnemies, p50: f.p50, p95: f.p95, max: f.max, drawMs: +draw.toFixed(2), updateMs: +upd.toFixed(2) };
    }, target);
    console.log('PERF', vp.tag, JSON.stringify(r));
  }
  await page.close();
}
await browser.close(); server.close();
