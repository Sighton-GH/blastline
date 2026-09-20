import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
q.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,160)));
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(500);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(400);

// Representative builds per wave (rough solved-strategy: multishot first, then power/rate/squad).
const scenarios = [
  { wave: 2,  buys: {} },
  { wave: 5,  buys: { multishot: 2, damage: 1, reinforcements: 1 } },
  { wave: 8,  buys: { multishot: 3, damage: 3, reinforcements: 2, fireRate: 1 } },
  { wave: 12, buys: { multishot: 4, damage: 6, reinforcements: 3, fireRate: 2 } },
];
for (const sc of scenarios) {
  const r = await q.evaluate(async (sc) => {
    const T = __blastlineTest;
    T.setPoints(9e9); T.setWave(sc.wave);
    for (const [id, n] of Object.entries(sc.buys)) for (let i = 0; i < n; i++) T.purchase(id);
    const s0 = T.getState();
    // Clear the field, then spawn one grunt mid-field and time its melt.
    const before = T.debugEnemies().length;
    const spawned = T.spawnEnemyAt('grunt', 1, .45);
    let t = 0, hp0 = spawned.hp;
    while (t < 12) { T.advance(.1); t += .1; const g = T.debugEnemies().find(e => e.type === 'grunt' && Math.abs(e.y - spawned.y) < .4); if (!g) break; }
    return { wave: sc.wave, power: s0.power, proj: s0.projectiles, troops: s0.troops, rate: s0.fireRate, hp0: Math.round(hp0), ttk: +t.toFixed(1) };
  }, sc);
  console.log(JSON.stringify(r));
}
// Spill grunts inherit the curve: spawn a transport at wave 10, melt it, check spilled grunt hp.
const spill = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.setWave(10);
  const tr = T.spawnEnemyAt('transport', 0, .45);
  const hp0 = tr.hp;
  // Focus fire until it dies
  let t = 0;
  while (t < 20) { T.fireNow(2); T.advance(.5); t += .5; if (!T.debugEnemies().some(e => e.type === 'transport')) break; }
  const grunts = T.debugEnemies().filter(e => e.type === 'grunt');
  return { transportHp0: Math.round(hp0), meltT: +t.toFixed(1), spilled: grunts.length, gruntHps: grunts.slice(0,4).map(g => g.hp), spillCount: T.spillCount() };
});
console.log('spill:', JSON.stringify(spill));
await browser.close(); server.close(); process.exit(0);
