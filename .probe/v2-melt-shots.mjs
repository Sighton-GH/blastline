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
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(200); await page.tap('#playBtn');
// wait until mid wave 3 with plenty of enemies on the visible field
for (let i = 0; i < 240; i++) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, engaged: (st.sampleEnemies||[]).filter(e=>e.y>0.04).length }; });
  if (s.state === 'armory') { const c = await page.$('.armory-continue'); if (c && await c.isEnabled()) await c.tap(); await page.waitForTimeout(300); continue; }
  if (s.wave >= 3 && s.engaged >= 8) break;
  await page.waitForTimeout(300);
}
for (let k = 0; k < 4; k++) {
  await page.screenshot({ path: `/home/sandbox/c6-evidence/v2-melt-${k}.png` });
  await page.waitForTimeout(700);
}
const kv = await page.evaluate(() => __blastlineTest.getState().killViz);
console.log('KILLVIZ', JSON.stringify(kv && { kills: kv.kills, onScreen: kv.onScreen, mean: +(kv.visibleSum/Math.max(1,kv.kills)).toFixed(2), max: kv.visibleMax }));
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close();
