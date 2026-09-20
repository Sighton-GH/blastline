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
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.tap('#playBtn'); await page.waitForTimeout(400);
// strong-but-plausible wave-16 survivor build, then play waves 17+ via advance
const out = await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 9, fireRate: 9.5, projectiles: 3, pierce: 3, plating: 12, bulletSpeed: 1.5, criticalChance: .3 });
  __blastlineTest.setTroops(120);
  __blastlineTest.setWave(17);
  __blastlineTest.setWaveTime(0);
  const log = [];
  for (let w = 17; w <= 22; w++) {
    const t0 = performance.now();
    let steps = 0;
    while (steps < 2400) { __blastlineTest.advance(0.1); steps++; const s = __blastlineTest.getState(); if (s.state === 'game-over') break; if (s.state === 'armory') { const c = document.querySelector('#rewardCards .reward-card:not([disabled])'); if (c) c.click(); const b = document.querySelector('.armory-continue'); if (b && !b.disabled) b.click(); } if (s.state === 'playing' && s.wave > w) break; }
    const ms = Math.round(performance.now() - t0);
    const s = __blastlineTest.getState();
    log.push({ wave: w, state: s.state, troops: s.troops, lives: s.lives, simMs: ms, enemies: (s.enemies || []).length, kills: s.kills });
    if (s.state === 'game-over') break;
    __blastlineTest.setWave(w + 1); __blastlineTest.setWaveTime(0);
  }
  return log;
});
console.log('LATE', JSON.stringify(out));
console.log('JS ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close(); server.close(); process.exit(0);
