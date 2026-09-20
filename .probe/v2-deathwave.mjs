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
const DIFF = process.env.DIFF || 'veteran';
await page.goto(`http://127.0.0.1:${port}/?qa&diff=${DIFF}`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.evaluate(() => { const want = (new URLSearchParams(location.search)).get('diff') || 'recruit'; const b = document.querySelectorAll('#difficultyPicker button'); const idx = { recruit: 0, veteran: 1, elite: 2 }[want]; if (b[idx]) b[idx].click(); });
await page.waitForTimeout(200); await page.tap('#playBtn'); await page.waitForTimeout(600);
const PRIO = ['reinforcements','damage','fireRate','multishot','ricochet','piercing','criticalChance','armor','projectileSpeed','extraLife'];
const t0 = Date.now();
let lastKey = '';
const armoryLog = [];
while ((Date.now()-t0)/1000 < 780) {
  const s = await page.evaluate(() => { const st = __blastlineTest.getState(); return { state: st.state, wave: st.wave, troops: st.troops, lives: st.lives, points: st.skillPoints, killViz: st.killViz, gates: (st.gates||[]).filter(g=>g.y>.3&&g.y<.9).map(g=>({x:g.x,tone:g.tone})) }; });
  const key = s.state + '-' + s.wave;
  if (key !== lastKey) { console.log('NAT', JSON.stringify({state:s.state,wave:s.wave,troops:s.troops,lives:s.lives,points:s.points})); lastKey = key; }
  if (s.state === 'game-over') { console.log('GAMEOVER wave', s.wave); break; }
  if (s.state === 'armory') {
    const visit = await page.evaluate((prio) => {
      const cards = [...document.querySelectorAll('#rewardCards .reward-card')].map(c => ({ id: c.dataset.upgrade, disabled: c.disabled, label: (c.querySelector('.synergy')||{}).textContent || '' }));
      const st = __blastlineTest.getState();
      const points = st.skillPoints;
      const affordable = cards.filter(c => !c.disabled);
      const bought = [];
      for (const id of prio) {
        if (bought.length >= 2) break;
        const card = cards.find(c => c.id === id && !c.disabled);
        if (!card) continue;
        const el = document.querySelector(`#rewardCards .reward-card[data-upgrade="${id}"]`);
        if (el && !el.disabled) { el.click(); bought.push(id); }
      }
      const after = __blastlineTest.getState().skillPoints;
      return { wave: st.wave, pointsBefore: points, affordable: affordable.length, total: cards.length, bought, pointsAfter: after };
    }, PRIO);
    armoryLog.push(visit);
    console.log('SHOP', JSON.stringify(visit));
    await page.waitForTimeout(300);
    const cont = await page.$('.armory-continue');
    if (cont && await cont.isEnabled()) await cont.tap();
    await page.waitForTimeout(300); continue;
  }
  let target = Math.sin(Date.now()/2800) * .35;
  if (s.gates.length) { const good = s.gates.find(g => g.tone !== 'red'); target = good ? good.x : 0; }
  const px = 195 + target * 390 * .32;
  await page.touchscreen.tap(px, 690).catch(()=>{});
  await page.mouse.move(px, 690, { steps: 2 });
  
  await page.waitForTimeout(350);
}
const fin = await page.evaluate(() => __blastlineTest.getState());
const kv = fin.killViz;
if (kv && kv.kills) {
  const mean = +(kv.visibleSum/kv.kills).toFixed(2);
  const sorted = [...kv.samples].sort((a,b)=>a-b);
  console.log('KILLVIZ-FINAL', JSON.stringify({ wave: fin.wave, kills: kv.kills, onScreen: kv.onScreen, mean, min: kv.visibleMin, max: kv.visibleMax, p10: sorted[Math.floor(sorted.length*.1)], p50: sorted[Math.floor(sorted.length*.5)], p90: sorted[Math.floor(sorted.length*.9)] }));
}
console.log('ARMORY-VISITS', armoryLog.length, 'deadends:', armoryLog.filter(v => v.affordable === 0).length);
console.log('JS ERRORS:', errors.length ? errors.slice(0,5) : 'none');
await browser.close(); server.close(); process.exit(0);
