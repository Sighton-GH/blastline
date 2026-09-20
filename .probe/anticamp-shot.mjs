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
  T.setWave(6); T.setPlayerX(0);
  T.spawnEnemyAt('gunner', 0, .3, true);
  T.spawnEnemyAt('gunner', 2, .34, true);
  T.advance(.3); // telegraphs live, not yet fired
});
await q.screenshot({ path: '/home/sandbox/c6-evidence/171-aimed-telegraph.png' });
await q.evaluate(() => { __blastlineTest.advance(.5); }); // bullets mid-flight, converging
await q.screenshot({ path: '/home/sandbox/c6-evidence/171-aimed-flight.png' });
await browser.close(); server.close(); process.exit(0);
