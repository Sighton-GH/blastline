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
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
// purchases via real path while frozen
const setup = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.setWave(2); T.freeze(true);
  const cont = () => { if (T.getState().state === 'armory') document.querySelector('.armory-continue')?.click(); };
  T.purchase('taming'); T.purchase('damage');
  cont();
  T.purchase('taming'); T.purchase('damage');
  cont();
  T.purchase('taming'); T.purchase('damage');
  cont();
  for (let i = 0; i < 6; i++) T.spawnEnemyAt('grunt', i % 3, .28 + i * .02, false);
  const tier = T.getState().upgradeTiers?.taming ?? 0;
  T.freeze(false);
  return { tier, damage: T.getState().upgradeTiers?.damage ?? 0 };
});
console.log('setup', JSON.stringify(setup));
// wall-clock run: wait for conversion (up to 12s)
let converted = 0;
for (let i = 0; i < 60; i++) { converted = await q.evaluate(() => __blastlineTest.charmedCount()); if (converted > 0) break; await q.waitForTimeout(200); }
console.log('converted allies:', converted);
console.log('ambient at conversion:', await q.evaluate(() => __blastlineTest.ambient()));
// sample charmed y stability over 1.5s
const s1 = await q.evaluate(() => __blastlineTest.debugEnemies().filter(e => e.charmed).map(e => e.y));
await q.waitForTimeout(1500);
const s2 = await q.evaluate(() => __blastlineTest.debugEnemies().filter(e => e.charmed).map(e => e.y));
console.log('charmed y stability:', JSON.stringify({ s1, s2 }));
// screenshot with charmed ally visible (while still playing)
await q.screenshot({ path: '/home/sandbox/c6-evidence/173-taming-ally.png' });
console.log('shot state:', await q.evaluate(() => __blastlineTest.getState().state));
// wait for burnout (charmedUntil = conversion + 8s); allow 30s wall, tracing ambient vs charmedUntil
let after = -1;
for (let i = 0; i < 100; i++) {
  const snap = await q.evaluate(() => { const st = __blastlineTest.getState(); return { n: __blastlineTest.charmedCount(), t: +__blastlineTest.ambient().toFixed(1), wt: +(st.waveTime ?? -1).toFixed(1), state: st.state, en: st.enemies, us: __blastlineTest.debugEnemies().filter(e => e.charmed).map(e => e.charmedUntil) }; });
  if (i % 10 === 0 || snap.n === 0) console.log('trace', JSON.stringify(snap));
  after = snap.n;
  if (after === 0) break;
  await q.waitForTimeout(300);
}
console.log('charmed after burnout window:', after);
await browser.close(); server.close(); process.exit(0);
