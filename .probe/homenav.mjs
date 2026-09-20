import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
for (const [name, vp] of [['desktop',{width:1280,height:800}],['phone',{width:390,height:844}]]) {
  const q = await browser.newPage({ viewport: vp });
  await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await q.waitForTimeout(500);
  await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await q.click('#playBtn'); await q.waitForTimeout(400);
  await q.evaluate(() => __blastlineTest.advance(1));
  await q.keyboard.press('p'); await q.waitForTimeout(250);
  const paused = await q.evaluate(() => __blastlineTest.getState().state);
  const btns = await q.evaluate(() => [...document.querySelectorAll('#pausePanel .button-row button')].map(b => b.textContent));
  await q.screenshot({ path: `/downloads/169-pause-home-${name}.png` });
  await q.click('#pauseHomeBtn'); await q.waitForTimeout(300);
  const after = await q.evaluate(() => __blastlineTest.getState().state);
  console.log(name, 'paused:', paused, 'buttons:', JSON.stringify(btns), 'after HOME:', after);
  await q.close();
}
await browser.close(); server.close(); process.exit(0);
