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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[0]) b[0].click(); }); await page.waitForTimeout(200); await page.tap('#playBtn');
await page.waitForTimeout(600);
// natural play: drag steering via touch
const t0 = Date.now();
let lastState = '';
let events = 0;
while ((Date.now()-t0)/1000 < 420) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, troops: st.troops, lives: st.lives, gates: (st.gates||[]).filter(g=>g.y>.3&&g.y<.9).map(g=>({x:g.x,tone:g.tone})) }; });
  const key = s.state + '-' + s.wave;
  if (key !== lastState) { console.log('NAT', JSON.stringify(s)); lastState = key; events++; }
  if (s.state === 'game-over') { await page.screenshot({ path: '/home/sandbox/c6-evidence/natural-recruit-gameover.png' }); break; }
  if (s.state === 'armory') {
    const first = await page.$('#rewardCards .reward-card:not([disabled])');
    if (first) { await first.tap(); await page.waitForTimeout(250); }
    const cont = await page.$('.armory-continue');
    if (cont && await cont.isEnabled()) await cont.tap();
    await page.waitForTimeout(300); continue;
  }
  // steer: avoid red gates, else drift
  let target = Math.sin(Date.now()/2800) * .35;
  if (s.gates.length) { const good = s.gates.find(g => g.tone !== 'red'); target = good ? good.x : 0; }
  const px = 195 + target * 390 * .32;
  await page.touchscreen.tap(px, 690).catch(()=>{});
  await page.mouse.move(px, 690, { steps: 2 });
  if (s.wave >= 11 || events > 90) break;
  await page.waitForTimeout(350);
}
console.log('JS ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close();
