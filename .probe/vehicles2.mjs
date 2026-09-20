import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(500);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(400);
const log = [];
let spilled = null, midShot = false, meltShot = false;
for (let i = 0; i < 30; i++) {
  const st = await q.evaluate(() => {
    const T = __blastlineTest;
    if (!T.debugEnemies().some(e => e.type === 'transport') && !window.__tDone) { T.spawnEnemyAt('transport', 1, .5); T.spawnEnemyAt('technical', 0, .6); }
    T.fireNow(1); T.advance(.22);
    const t = T.debugEnemies().find(e => e.type === 'transport');
    return { hp: t ? t.hp : -1, grunts: T.debugEnemies().filter(e => e.type === 'grunt').length, spills: T.spillCount() };
  });
  log.push(st);
  if (st.hp > 0 && st.hp <= 8 && !midShot) { await q.screenshot({ path: '/downloads/168-vehicles-melting.png' }); midShot = true; }
  if (st.hp === -1 && !spilled) { spilled = st; await q.evaluate(() => { window.__tDone = 1; }); await q.screenshot({ path: '/downloads/168-vehicles-spill.png' }); meltShot = true; break; }
}
console.log('hp trace:', log.map(l => l.hp).join(','));
console.log('grunts trace:', log.map(l => l.grunts).join(','));
console.log('spills trace:', log.map(l => l.spills).join(','));
console.log('midShot', midShot, 'spillShot', meltShot);
await browser.close(); server.close(); process.exit(0);
