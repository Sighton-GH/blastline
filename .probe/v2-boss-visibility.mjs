import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.css','text/css'],['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
for (const vp of [{ w: 1280, h: 720, name: 'desktop' }, { w: 390, h: 844, name: 'mobile' }]) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); const p = document.querySelector('#playBtn'); if (p) p.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    __blastlineTest.setTroops(6); __blastlineTest.setPower(1); // weak squad: boss survives the walk
    __blastlineTest.setWave(3);
    __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1);
    __blastlineTest.advance(0.2); __blastlineTest.setWaveTime(0);
  });
  for (const target of [0.22, 0.4, 0.55, 0.68]) {
    await page.evaluate((ty) => {
      const st = __blastlineTest.getState();
      const cur = st.boss ? st.boss.y : -0.12;
      const dt = Math.max(0, (ty - cur) / 0.19);
      __blastlineTest.advance(dt + 0.05);
    }, target);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `/home/sandbox/c6-evidence/v2-bossvis-${vp.name}-${String(target).replace('.','p')}.png` });
  }
  await browser.close();
}
server.close(); process.exit(0);
