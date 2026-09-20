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
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn'); await page.waitForTimeout(600);
const px = async () => page.evaluate(() => { const s = __blastlineTest.getState(); return s.playerX ?? null; });
// real drag: left -> right over 300ms
await page.mouse.move(80, 700); await page.mouse.down();
await page.mouse.move(320, 700, { steps: 12 });
await page.waitForTimeout(350);
const afterRight = await page.evaluate(() => { const s = __blastlineTest.getState(); return { state: s.state }; });
const probe1 = await page.evaluate(() => __blastlineTest.getState());
await page.mouse.move(60, 700, { steps: 12 });
await page.waitForTimeout(350);
const probe2 = await page.evaluate(() => __blastlineTest.getState());
await page.mouse.up();
console.log('DRAG', JSON.stringify({ afterDragRight: { x: probe1.playerX, target: probe1.playerTargetX }, afterDragLeft: { x: probe2.playerX, target: probe2.playerTargetX } }));
// rapid redeploy loop: 3 runs back to back
const leaks = [];
for (let i = 0; i < 3; i++) {
  const r = await page.evaluate(() => {
    __blastlineTest.advance(6);
    const before = __blastlineTest.getState();
    document.getElementById('pauseBtn').click();
    document.getElementById('restartBtn').click();
    const after = __blastlineTest.getState();
    return { beforeWave: before.wave, afterWave: after.wave, afterPoints: after.skillPoints, afterKills: after.kills, afterState: after.state, afterEnemies: (after.enemies || []).length };
  });
  leaks.push(r);
  await page.waitForTimeout(250);
}
console.log('REDEPLOY', JSON.stringify(leaks));
await browser.close(); server.close(); process.exit(0);
