import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
q.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,200)));
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
// boss fight: healthy build, wave 3, play until boss engages
await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.freeze(true);
  const cont = () => { if (T.getState().state === 'armory') document.querySelector('.armory-continue')?.click(); };
  const buy = ['damage','fireRate','damage','fireRate','multishot','reinforcements','damage','reinforcements'];
  let n = 0;
  for (const id of buy) { T.purchase(id); n += 1; if (n % 2 === 0) cont(); }
  cont();
  T.setWave(3); T.setWaveTime(0); T.freeze(false);
});
let bossSeen = null;
for (let i = 0; i < 60; i++) {
  const s = await q.evaluate(() => { __blastlineTest.advance(1); const st = __blastlineTest.getState(); return { state: st.state, boss: st.bossArchetype, bt: st.bossTime, troops: st.troops }; });
  if (s.boss) { bossSeen = s; if (s.bt > 2.5) break; }
  if (s.state === 'game-over') break;
  await q.waitForTimeout(120);
}
console.log('boss:', JSON.stringify(bossSeen));
await q.evaluate(() => __blastlineTest.freeze(true));
await q.waitForTimeout(120);
await q.screenshot({ path: '/home/sandbox/c6-evidence/175-boss-fight.png' });
await q.evaluate(() => __blastlineTest.freeze(false));
// vehicle scene
await q.evaluate(() => { __blastlineTest.forceBoat(); __blastlineTest.advance(.5); });
await q.waitForTimeout(2500);
await q.evaluate(() => __blastlineTest.advance(.3));
await q.screenshot({ path: '/home/sandbox/c6-evidence/176-vehicle.png' });
console.log('shots taken');
await browser.close(); server.close(); process.exit(0);
