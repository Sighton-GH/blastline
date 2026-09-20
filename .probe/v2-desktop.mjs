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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: '+m.text()); });
await page.goto(`http://127.0.0.1:${port}/?qa&diff=veteran`, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
await page.waitForTimeout(150);
await page.click('#playBtn');
await page.waitForTimeout(500);
// mid-wave melt scene on desktop
await page.evaluate(() => {
  __blastlineTest.setBuild({ power: 2, fireRate: 6, projectiles: 2, pierce: 1, plating: 2, bulletSpeed: 1.1, criticalChance: .03 });
  __blastlineTest.setTroops(28);
  __blastlineTest.setWave(5);
  __blastlineTest.advance(6);
});
await page.waitForTimeout(250);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-desktop-melt.png' });
// boss fight with hint on desktop
const boss = await page.evaluate(() => {
  __blastlineTest.setWaveTime(__blastlineTest.getWaveConfig().duration + 1);
  __blastlineTest.advance(0.2); __blastlineTest.setWaveTime(0);
  __blastlineTest.advance(2.6);
  const st = __blastlineTest.getState();
  return { state: st.state, archetype: st.bossArchetype, gate: st.bossDmgGate, bossY: st.boss?.y, hp: st.boss?.hp };
});
console.log('DESKTOP-BOSS', JSON.stringify(boss));
await page.waitForTimeout(200);
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-desktop-boss.png' });
const kv = await page.evaluate(() => __blastlineTest.getState().killViz);
console.log('KILLVIZ', JSON.stringify(kv && { kills: kv.kills, onScreen: kv.onScreen }));
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
