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
// eco build via real purchase path: logistics x5, damage x3, reinforcements x3, fireRate x1
await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.freeze(true);
  const cont = () => { if (T.getState().state === 'armory') document.querySelector('.armory-continue')?.click(); };
  const buy = ['logistics','logistics','damage','damage','logistics','logistics','damage','reinforcements','logistics','reinforcements','reinforcements','fireRate'];
  let n = 0;
  for (const id of buy) { T.purchase(id); n += 1; if (n % 2 === 0) cont(); }
  cont();
  T.setWave(12); T.setWaveTime(0);
  T.freeze(false);
  console.log('tiers', JSON.stringify(T.getState().upgradeTiers));
});
const t0 = Date.now();
while (Date.now() - t0 < 230000) {
  await q.evaluate(() => {
    const st = __blastlineTest.getState();
    const es = (st.sampleEnemies || []).filter(e => e.y > .12 && e.y < .88);
    if (es.length) {
      const lanes = [0, 1, 2].map(l => es.filter(e => e.lane === l));
      const sc = lanes.map(list => list.reduce((a, e) => a + e.y, 0));
      const best = sc.indexOf(Math.max(...sc));
      if (sc[best] > 0) __blastlineTest.setPlayerX(lanes[best].reduce((a, e) => a + e.x, 0) / lanes[best].length);
    }
    __blastlineTest.advance(1);
  });
  const s = await q.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wt: +(st.waveTime||0).toFixed(1), bt: +(st.bossTime||0).toFixed(1), troops: st.troops, en: st.activeEnemies, boss: st.bossArchetype, gate: st.bossDmgGate, score: st.score }; });
  console.log(JSON.stringify(s));
  if (s.state === 'game-over' || s.state === 'armory') break;
  await q.waitForTimeout(2000);
}
await browser.close(); server.close(); process.exit(0);
