import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.env.BL_ROOT || '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
// REAL TIME, no advance: sample every 2 wall-seconds
for (let i = 0; i < 12; i++) {
  await q.waitForTimeout(2000);
  const s = await q.evaluate(() => {
    const st = __blastlineTest.getState();
    const en = __blastlineTest.debugEnemies();
    const byType = {};
    for (const e of en) byType[e.type] = (byType[e.type] || 0) + 1;
    return { state: st.state, wt: +(st.waveTime||0).toFixed(1), troops: st.troops, n: en.length, byType, ys: en.slice(0,8).map(e => +e.y.toFixed(2)), score: st.score, bullets: st.bullets };
  });
  console.log(JSON.stringify(s));
  if (s.state === 'game-over') break;
}
await browser.close(); server.close(); process.exit(0);
