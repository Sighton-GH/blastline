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
const r = await q.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(9e9); T.setWave(9);
  T.purchase('heavyOrdnance'); T.purchase('heavyOrdnance'); // 2 picks fill the visit
  const s = T.getState();
  const cards = [...document.querySelectorAll('.reward-card')].map(c => ({ id: c.dataset.upgrade, disabled: c.disabled, note: c.querySelector('.synergy')?.textContent || '' }));
  const dmg = cards.find(c => c.id === 'damage');
  const ord = cards.find(c => c.id === 'heavyOrdnance');
  return { state: s.state, power: s.power, rate: +s.fireRate.toFixed(2), cardCount: cards.length, damageCard: dmg, ordnanceCard: ord };
});
console.log(JSON.stringify(r, null, 1));
await q.screenshot({ path: '/home/sandbox/c6-evidence/170-ordnance-armory.png' });
// TTK vs a wave-10 heavy: ordnance build vs standard-damage build at similar spend.
async function ttk(buildId) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await p.waitForTimeout(450);
  await p.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await p.click('#playBtn'); await p.waitForTimeout(300);
  const out = await p.evaluate((buildId) => {
    const T = __blastlineTest;
    T.setPoints(9e9); T.setWave(10);
    const cont = () => { if (T.getState().state === 'armory') document.querySelector('.armory-continue')?.click(); };
    const buys = buildId === 'heavyOrdnance' ? [['heavyOrdnance', 5], ['multishot', 3], ['reinforcements', 2]] : [['damage', 5], ['multishot', 3], ['reinforcements', 2]];
    let bought = 0;
    for (const [id, n] of buys) for (let i = 0; i < n; i++) { if (bought && bought % 2 === 0) cont(); T.purchase(id); bought += 1; }
    cont(); T.setWave(10);
    const s0 = T.getState();
    const h = T.spawnEnemyAt('heavy', 1, .5);
    let t = 0, alive = true;
    while (t < 12) { T.advance(.1); t += .1; if (!T.debugEnemies().some(e => e.type === 'heavy' && e.y >= .45)) { alive = false; break; } }
    return { build: buildId, power: s0.power, rate: +s0.fireRate.toFixed(2), heavyHp: Math.round(h.hp), ttk: alive ? '>12' : +t.toFixed(1) };
  }, buildId);
  await p.close();
  return out;
}
console.log(JSON.stringify(await ttk('damage')));
console.log(JSON.stringify(await ttk('heavyOrdnance')));
await browser.close(); server.close(); process.exit(0);
