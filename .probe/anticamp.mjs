import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
async function fresh() {
  const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  q.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,160)));
  await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await q.waitForTimeout(450);
  await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await q.click('#playBtn'); await q.waitForTimeout(300);
  return q;
}
// 1: aim follows the squad's lane; bullet leaves the gunner and lands on the warned lane center
const q = await fresh();
const aim = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setWave(5); T.freeze(true);
  const out = {};
  T.setPlayerX(0);
  const g = T.spawnEnemyAt('gunner', 0, .3, true);
  T.advance(.12);
  out.midAim = T.getState().telegraphs.map(t => ({ lane: t.lane, kind: t.kind }));
  // track the bullet from fire to the line
  T.advance(.5);
  const path = [];
  for (let i = 0; i < 25; i++) { T.advance(.1); const b = T.enemyBulletList()[0]; if (b) path.push([b.x, b.y]); }
  out.pathStart = path[0]; out.pathEnd = path[path.length - 1];
  // now move left, wait out cadence, check new aim
  T.setPlayerX(-.58);
  T.advance(4.2);
  out.leftAim = T.getState().telegraphs.map(t => ({ lane: t.lane, kind: t.kind }));
  return out;
});
console.log('aim+path:', JSON.stringify(aim));
await q.screenshot({ path: '/home/sandbox/c6-evidence/171-aimed-fire.png' });
await q.close();
// 2: park vs dodge - squad damage difference
const q2 = await fresh();
const dd = await q2.evaluate(() => {
  const T = __blastlineTest;
  T.setWave(6); T.freeze(true);
  const run1 = (dodge) => {
    T.reset ? null : null;
    return null;
  };
  return null;
});
// reset hook availability differs; do park/dodge as two fresh pages instead
await q2.close();
async function parkDodge(dodge) {
  const p = await fresh();
  const out = await p.evaluate((dodge) => {
    const T = __blastlineTest;
    T.setWave(6); T.freeze(true); T.setPlayerX(0);
    T.spawnEnemyAt('gunner', 0, .3, true);
    T.spawnEnemyAt('gunner', 2, .32, true);
    const s0 = T.getState();
    let moved = false;
    for (let i = 0; i < 40; i++) {
      T.advance(.1);
      if (dodge && !moved && T.getState().telegraphs.length > 0) { T.setPlayerX(-.58); moved = true; }
    }
    const s1 = T.getState();
    return { dodge, plates0: s0.plates, troops0: s0.troops, plates1: s1.plates, troops1: s1.troops };
  }, dodge);
  await p.close();
  return out;
}
console.log('parked:', JSON.stringify(await parkDodge(false)));
console.log('dodged:', JSON.stringify(await parkDodge(true)));
await browser.close(); server.close(); process.exit(0);
