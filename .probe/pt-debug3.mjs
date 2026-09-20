import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(450);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
for (let i = 0; i < 9; i++) {
  await q.waitForTimeout(1500);
  const s = await q.evaluate(() => {
    const st = __blastlineTest.getState();
    const bs = st.sampleBullets || [];
    const bx = bs.map(b => +(b.x).toFixed(2));
    const by = bs.map(b => +(b.y).toFixed(2));
    const es = (st.sampleEnemies || []).slice(0, 30).map(e => ({ l: e.lane, x: +e.x.toFixed(2), y: +e.y.toFixed(2) }));
    return { wt: +st.waveTime.toFixed(1), score: st.score, troops: st.troops, px: +st.playerX.toFixed(2), nb: st.bullets, bx: bx.slice(0, 20), by: [Math.min(...by), Math.max(...by)], ne: st.activeEnemies, es: es.slice(0, 12) };
  });
  console.log(JSON.stringify(s));
}
await browser.close(); server.close(); process.exit(0);
