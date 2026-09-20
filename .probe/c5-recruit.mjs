import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.css','text/css'],['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(400);
const picker = await page.$$('#difficultyPicker button');
if (picker && picker[0]) await picker[0].click();
await page.click('#playBtn');
await page.waitForTimeout(600);
await page.mouse.move(682, 630); await page.mouse.down();
const t0 = Date.now();
let last = '';
while ((Date.now()-t0)/1000 < 180) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, troops: st.troops, lives: st.lives, m: __blastlineTest.frameMetrics() }; });
  const key = s.state + s.wave;
  if (key !== last) { console.log('REC', JSON.stringify({ st: s.state, w: s.wave, tr: s.troops, lv: s.lives, p95: Math.round(s.m.p95||0) })); last = key; }
  if (s.state === 'armory') {
    const first = await page.$('#rewardCards .reward-card:not([disabled])');
    if (first) { await first.click(); await page.waitForTimeout(200); }
    const cont = await page.$('.armory-continue');
    if (cont && await cont.isEnabled()) await cont.click();
    await page.waitForTimeout(250); continue;
  }
  if (s.state === 'game-over') { console.log('REC GAME OVER wave', s.wave); await page.screenshot({ path: '/tmp/shots/c5-recruit-gameover.png' }); break; }
  const px = 682 + Math.sin(Date.now()/2900) * 150;
  await page.mouse.move(px, 630, { steps: 2 });
  if (s.wave >= 7) break;
  await page.waitForTimeout(400);
}
await page.mouse.up().catch(()=>{});
console.log('JS ERRORS:', errors.length ? errors : 'none');
await browser.close();
