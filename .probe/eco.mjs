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
  T.setPoints(9e9);
  T.purchase('logistics'); T.purchase('logistics'); // 2 tiers = 8%
  const buyState = T.getState();
  const cards = [...document.querySelectorAll('.reward-card')].map(c => c.dataset.upgrade);
  document.querySelector('.armory-continue')?.click();
  // Bank exactly 5000 and clear the wave instantly (field empty, time past duration)
  T.setPoints(5000); T.setWave(1); T.freeze(true);
  T.setWaveTime(999);
  T.advance(.2);
  const s1 = T.getState();
  return { cardCount: cards.length, hasLogistics: cards.includes('logistics'),
    pointsAfter: s1.points, state: s1.state, ecoTotal: T.ecoTotal() };
});
console.log(JSON.stringify(r));
await q.screenshot({ path: '/home/sandbox/c6-evidence/172-eco-payout.png' });
// No-tier control: no logistics -> no payout
const q2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q2.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q2.waitForTimeout(450);
await q2.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q2.click('#playBtn'); await q2.waitForTimeout(300);
const c = await q2.evaluate(() => {
  const T = __blastlineTest;
  T.setPoints(5000); T.setWave(1); T.freeze(true);
  T.setWaveTime(999); T.advance(.2);
  return { pointsAfter: T.getState().points, ecoTotal: T.ecoTotal() };
});
console.log('control:', JSON.stringify(c));
await browser.close(); server.close(); process.exit(0);
