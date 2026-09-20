import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });

const scenarios = [
  { wave: 2,  buys: {} },
  { wave: 5,  buys: { multishot: 2, damage: 1, reinforcements: 1 } },
  { wave: 8,  buys: { multishot: 3, damage: 3, reinforcements: 2, fireRate: 1 } },
  { wave: 12, buys: { multishot: 4, damage: 6, reinforcements: 3, fireRate: 2 } },
];
for (const sc of scenarios) {
  const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  q.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,160)));
  await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await q.waitForTimeout(450);
  await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await q.click('#playBtn'); await q.waitForTimeout(300);
  const r = await q.evaluate((sc) => {
    const T = __blastlineTest;
    T.setPoints(9e9); T.setWave(sc.wave);
    for (const [id, n] of Object.entries(sc.buys)) for (let i = 0; i < n; i++) { T.pause(); T.purchase(id); }
    const s0 = T.getState();
    const kills0 = s0.kills;
    const spawned = T.spawnEnemyAt('grunt', 1, .6);
    const hp0 = spawned.hp;
    let t = 0, alive = true;
    while (t < 10) {
      T.advance(.1); t += .1;
      const lane = T.debugEnemies().filter(e => e.type === 'grunt' && e.y >= .55);
      if (lane.length === 0) { alive = false; break; }
    }
    return { wave: sc.wave, power: s0.power, proj: s0.projectiles, troops: s0.troops, rate: +s0.fireRate.toFixed(1), gruntHp: Math.round(hp0), ttk: alive ? '>10' : +t.toFixed(1), kills: T.getState().kills - kills0 };
  }, sc);
  console.log(JSON.stringify(r));
  await q.close();
}
// Spill inheritance at wave 10 with a strong build.
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
const spill = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.setWave(10);
  for (let i = 0; i < 6; i++) { T.pause(); T.purchase('damage'); }
  for (let i = 0; i < 4; i++) { T.pause(); T.purchase('multishot'); }
  T.pause(); T.purchase('reinforcements'); T.pause(); T.purchase('reinforcements');
  const tr = T.spawnEnemyAt('transport', 0, .4);
  let t = 0;
  while (t < 15) { T.fireNow(3); T.advance(.4); t += .4; if (!T.debugEnemies().some(e => e.type === 'transport')) break; }
  const near = T.debugEnemies().filter(e => e.type === 'grunt' && e.y >= .35 && e.y <= .65);
  return { transportHp: Math.round(tr.hp), meltT: +t.toFixed(1), spills: T.spillCount(), spillGruntHps: near.slice(0, 6).map(g => g.hp) };
});
console.log('spill:', JSON.stringify(spill));
await q.close();
await browser.close(); server.close(); process.exit(0);
