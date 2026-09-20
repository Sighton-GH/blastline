import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.css','text/css'],['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port = server.address().port;
const DIFF = process.env.DIFF || 'veteran';
const MAXWAVE = Number(process.env.MAXWAVE || 14);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate((d) => { __blastlineTest.reset(42, d); }, DIFF);
const BUY_PRIORITY = ['damage','fireRate','piercing','criticalChance','reinforcements','armor','multishot','projectileSpeed','extraLife'];
let lastWave = 0;
let shot5 = false, shot9 = false;
const waveLog = [];
let guard = 0;
while (guard++ < 4000) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, waveTime: st.waveTime, troops: st.troops, lives: st.lives, activeEnemies: st.activeEnemies, hordes: st.hordes, points: st.skillPoints, score: st.score, kills: st.kills, gates: (st.gates||[]).filter(g=>!g.hit&&g.y>.2&&g.y<.95).map(g=>({x:g.x,tone:g.tone})) }; });
  if (s.state === 'game-over') { console.log('GAMEOVER', JSON.stringify(s)); await page.screenshot({ path: `/home/sandbox/c6-evidence/pressure-${DIFF}-gameover.png` }); break; }
  if (s.state === 'armory') {
    // boss reward pick first, then shop purchases by priority, then continue
    const picked = await page.evaluate(() => { try { const r = __blastlineTest.chooseReward(); return !!r; } catch { return false; } });
    for (const id of BUY_PRIORITY) {
      for (let i = 0; i < 12; i++) {
        const ok = await page.evaluate((pid) => { try { return !!__blastlineTest.purchase(pid); } catch { return false; } }, id);
        if (!ok) break;
      }
    }
    const cont = await page.$('.armory-continue');
    if (cont && await cont.isEnabled().catch(()=>false)) { await cont.tap().catch(()=>{}); }
    else { await page.evaluate(() => { const b = document.querySelector('.armory-continue'); if (b) b.click(); }); }
    await page.waitForTimeout(200);
    continue;
  }
  if (s.wave !== lastWave) {
    waveLog.push({ wave: s.wave, troops: s.troops, lives: s.lives, points: s.points, score: s.score, kills: s.kills });
    console.log('WAVE', JSON.stringify(waveLog[waveLog.length-1]));
    lastWave = s.wave;
    if (s.wave > MAXWAVE) break;
  }
  if (s.wave === 5 && !shot5 && s.waveTime > 8) { shot5 = true; const mid = await page.evaluate(() => __blastlineTest.getState().activeEnemies); await page.screenshot({ path: `/home/sandbox/c6-evidence/pressure-${DIFF}-wave5.png` }); console.log('SHOT wave5 activeEnemies=', mid); }
  if (s.wave === 9 && !shot9 && s.waveTime > 8) { shot9 = true; const mid = await page.evaluate(() => __blastlineTest.getState().activeEnemies); await page.screenshot({ path: `/home/sandbox/c6-evidence/pressure-${DIFF}-wave9.png` }); console.log('SHOT wave9 activeEnemies=', mid); }
  // steer: prefer non-red gate lane, else sine drift
  let target = Math.sin(Date.now()/2600) * .4;
  if (s.gates.length) { const good = s.gates.find(g => g.tone !== 'red'); if (good) target = good.x; }
  await page.evaluate((x) => __blastlineTest.setPlayerX(x), target);
  await page.evaluate(() => __blastlineTest.advance(0.5));
  // peak density sample
  const dens = await page.evaluate(() => __blastlineTest.getState().activeEnemies);
  if (waveLog.length) { const w = waveLog[waveLog.length-1]; w.peak = Math.max(w.peak || 0, dens); }
}
console.log('SUMMARY', JSON.stringify({ diff: DIFF, waves: waveLog }));
console.log('JS ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close();
server.close();
