import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
const q = await browser.newPage();
await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
await q.waitForTimeout(400);
await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await q.click('#playBtn'); await q.waitForTimeout(300);
const out = await q.evaluate(() => {
  const T = __blastlineTest;
  const log = [];
  T.setPoints(9e9);
  log.push(['base', JSON.stringify({ p: T.getState().power, proj: T.getState().projectiles, troops: T.getState().troops })]);
  for (let i = 0; i < 3; i++) {
    T.pause();
    const ok = T.purchase('damage');
    const s = T.getState();
    log.push([`buy${i}`, ok, s.power, s.state, document.querySelector('#shopMessage')?.textContent || '']);
  }
  return log;
});
console.log(out);
await browser.close(); server.close(); process.exit(0);
