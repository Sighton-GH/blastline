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
// Vehicles intact on the road.
await q.evaluate(() => {
  const T = __blastlineTest;
  T.spawnEnemyAt('transport', 1, .62);
  T.spawnEnemyAt('technical', 0, .7);
  T.spawnEnemyAt('technical', 2, .78);
  T.advance(.3);
});
await q.screenshot({ path: '/downloads/168-vehicles-intact.png' });
// Melt the carrier to damage states: smoke >50%, flame >75% damage.
const mid = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(99999); T.setUpgradeTiers({ damage: 4 });
  T.fireNow(3); T.advance(.8);
  const t = T.debugEnemies().find(e => e.type === 'transport');
  return t ? { hp: t.hp } : null;
});
console.log('transport mid:', JSON.stringify(mid));
await q.screenshot({ path: '/downloads/168-vehicles-melting.png' });
// Finish it: spill + wreck.
const done = await q.evaluate(() => {
  const T = __blastlineTest;
  T.fireNow(8); T.advance(1.2);
  const es = T.debugEnemies();
  return { transports: es.filter(e => e.type === 'transport').length, gruntsNearMid: es.filter(e => e.type === 'grunt').length, kills: T.getState().kills };
});
console.log('after melt:', JSON.stringify(done));
await q.screenshot({ path: '/downloads/168-vehicles-spill.png' });
await browser.close(); server.close(); process.exit(0);
