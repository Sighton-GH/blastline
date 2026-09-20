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
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150); await page.tap('#playBtn'); await page.waitForTimeout(400);
const info = await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 2, fireRate: 6, projectiles: 2, pierce: 1, plating: 2 });
  __blastlineTest.setTroops(28); __blastlineTest.setWave(5);
  let st = __blastlineTest.advance(14);
  const kv = st.killViz;
  return { wave: st.wave, state: st.state,
    engaged: st.sampleEnemies.filter(e => e.y >= .15).length, total: st.sampleEnemies.length,
    kv: kv && { kills: kv.kills, onScreen: kv.onScreen, mean: +(kv.visibleSum/Math.max(1,kv.kills)).toFixed(2) } };
});
console.log('LAND2', JSON.stringify(info));
await page.waitForTimeout(200);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-land2-a.png' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-land2-b.png' });
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
