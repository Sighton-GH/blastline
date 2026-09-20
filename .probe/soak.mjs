import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
q.on('pageerror', e => errors.push(String(e).slice(0, 200)));
q.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=elite`, { waitUntil: 'load' });
await q.waitForTimeout(500);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[2]) b[2].click(); });
await q.click('#playBtn'); await q.waitForTimeout(400);
// Soak: wave 12 elite with a full elemental+vehicle build, 90 sim-seconds.
await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(999999); T.setWave(12);
  T.setUpgradeTiers({ shock: 3, frost: 3, damage: 3, multishot: 2 });
});
for (let i = 0; i < 30; i++) {
  await q.evaluate(() => { __blastlineTest.fireNow(3); __blastlineTest.advance(3); });
}
const end = await q.evaluate(() => {
  const s = __blastlineTest.getState();
  return { state: s.state, wave: s.wave, kills: s.kills, enemies: s.activeEnemies, bullets: s.bullets, troops: s.troops, score: s.score };
});
console.log('soak end:', JSON.stringify(end));
console.log('js errors:', errors.length ? JSON.stringify(errors.slice(0, 5)) : 'none');
const bad = await q.evaluate(() => __blastlineTest.debugEnemies().filter(e => !isFinite(e.hp) || !isFinite(e.y)).length);
console.log('non-finite enemies:', bad);
await browser.close(); server.close(); process.exit(0);
