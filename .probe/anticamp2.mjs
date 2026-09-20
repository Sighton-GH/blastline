import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });
async function fresh() {
  const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  q.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,160)));
  await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await q.waitForTimeout(450);
  await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await q.click('#playBtn'); await q.waitForTimeout(300);
  return q;
}
async function parkDodge(dodge) {
  const p = await fresh();
  const out = await p.evaluate((dodge) => {
    const T = __blastlineTest;
    T.setWave(6); T.freeze(true); T.setPlayerX(0);
    T.spawnEnemyAt('gunner', 0, .3, true);
    T.spawnEnemyAt('gunner', 2, .3, true);
    T.spawnEnemyAt('gunner', 0, .42, true);
    T.spawnEnemyAt('gunner', 2, .42, true);
    const s0 = T.getState();
    let pos = 0;
    for (let i = 0; i < 80; i++) {
      T.advance(.1);
      if (dodge) {
        const tel = T.getState().telegraphs.find(t => t.time > .3);
        if (tel && Math.abs(pos - [-.58, 0, .58][tel.lane]) < .01) { pos = pos === 0 ? -.58 : 0; T.setPlayerX(pos); }
      }
    }
    const s1 = T.getState();
    return { dodge, troops0: s0.troops, troops1: s1.troops, lives0: s0.lives, lives1: s1.lives, state: s1.state };
  }, dodge);
  await p.close();
  return out;
}
console.log('parked:', JSON.stringify(await parkDodge(false)));
console.log('dodged:', JSON.stringify(await parkDodge(true)));
await browser.close(); server.close(); process.exit(0);
