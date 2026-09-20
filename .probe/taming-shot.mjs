import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.setWave(2); T.freeze(true);
  const cont = () => { if (T.getState().state === 'armory') document.querySelector('.armory-continue')?.click(); };
  T.purchase('taming'); T.purchase('damage'); cont();
  T.purchase('taming'); T.purchase('damage'); cont();
  T.purchase('taming'); cont();
  // stage: a few grunts mid-field, squad has something to shoot
  for (let i = 0; i < 5; i++) T.spawnEnemyAt('grunt', i % 3, .42 + i * .03, false);
  T.freeze(false);
});
let n = 0;
for (let i = 0; i < 80; i++) { n = await q.evaluate(() => __blastlineTest.charmedCount()); if (n > 0) break; await q.waitForTimeout(150); }
// let it act a moment (ally fires, muzzle flash), then freeze the frame
await q.waitForTimeout(900);
await q.evaluate(() => __blastlineTest.freeze(true));
await q.waitForTimeout(120);
const info = await q.evaluate(() => __blastlineTest.debugEnemies().filter(e => e.charmed).map(e => ({ y: e.y })));
console.log('charmed:', JSON.stringify(info));
await q.screenshot({ path: '/home/sandbox/c6-evidence/173-taming-ally.png' });
await browser.close(); server.close(); process.exit(0);
