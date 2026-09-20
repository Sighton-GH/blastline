import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/home/sandbox/blastline';
const MIME = new Map([['.html','text/html'],['.js','text/javascript'],['.mjs','text/javascript'],['.webp','image/webp'],['.png','image/png'],['.svg','image/svg+xml'],['.css','text/css']]);
const server = http.createServer((req,res)=>{ const p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''); const f=path.resolve(ROOT,p===''?'index.html':p); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);return res.end();} res.writeHead(200,{'Cache-Control':'no-store','Content-Type':MIME.get(path.extname(f))||'application/octet-stream'}); res.end(d); }); });
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({ headless: true });

async function playRun(name, priority, maxWave = Number(process.env.MAXWAVE || 9)) {
  const q = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  q.on('pageerror', e => console.log(name, 'PAGEERROR', String(e).slice(0,200)));
  await q.goto(`http://127.0.0.1:${server.address().port}/?qa&diff=veteran`, { waitUntil: 'load' });
  await q.waitForTimeout(450);
  await q.evaluate(() => { const b = document.querySelectorAll('#difficultyPicker button'); if (b[1]) b[1].click(); });
  await q.click('#playBtn'); await q.waitForTimeout(300);
  const log = [];
  let lastWave = 0, guard = 0, lastSt = null, prevKey = '', frozen = 0;
  const t0 = Date.now();
  let end = null;
  while (guard++ < 20000 && Date.now() - t0 < 600000) {
    const st = await Promise.race([
      q.evaluate(() => { const s = __blastlineTest.getState(); return { state: s.state, wave: s.wave, wt: +(s.waveTime||0).toFixed(1), boss: s.bossArchetype||null, bossX: s.bossX??null, gate: s.bossDmgGate===null||s.bossDmgGate===undefined?null:+s.bossDmgGate.toFixed(2), troops: s.troops, points: Math.round(s.skillPoints), score: s.score, eco: __blastlineTest.ecoTotal(), charmed: __blastlineTest.charmedCount(), tiers: s.upgradeTiers }; }),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('PAGE-UNRESPONSIVE')),15000))
    ]).catch(e=>{ console.log(name, String(e.message||e), JSON.stringify(lastSt||{})); process.exit(4); });
    lastSt = st;
    { const key = st.state+'|'+st.wave+'|'+st.wt+'|'+st.score;
      frozen = (key===prevKey && (st.state==='playing'||st.state==='boss')) ? frozen+1 : 0; prevKey = key;
      if (guard%4===0 || st.state!=='playing') console.log(name, 'tick', JSON.stringify({g:guard,st:st.state,w:st.wave,wt:st.wt,boss:st.boss,gate:st.gate,troops:st.troops,score:st.score,frozen}));
      if (frozen>=12) { console.log(name, 'FREEZE-SUSPECT', JSON.stringify(st)); process.exit(3); } }
    if (st.state === 'game-over') { end = { end: 'game-over', ...st }; break; }
    if (st.state === 'armory') {
      const bought = await q.evaluate((prio) => {
        const T = __blastlineTest;
        const picks = [];
        for (const want of prio) {
          const r = T.purchase(want);
          if (r === true) picks.push(want);
          if (picks.length >= 2) break;
        }
        document.querySelector('.armory-continue')?.click();
        return picks;
      }, priority);
      log.push({ armory: true, wave: st.wave, points: st.points, bought: bought });
      console.log(name, 'armory@w' + st.wave, 'pts', st.points, 'bought', JSON.stringify(bought));
      await q.waitForTimeout(120);
      // boss-reward overlays may need a card pick instead of continue
      const stuck = await q.evaluate(() => __blastlineTest.getState().state === 'armory');
      if (stuck) {
        await q.evaluate(() => {
          const card = document.querySelector('.armory-card, .shop-card, [data-upgrade]');
          card?.click();
          document.querySelector('.armory-continue')?.click();
        });
        await q.waitForTimeout(120);
        const still = await q.evaluate(() => __blastlineTest.getState().state);
        if (still === 'armory') { console.log(name, 'STUCK-IN-ARMORY'); break; }
      }
      continue;
    }
    if (st.wave !== lastWave) { log.push({ ...st }); console.log(name, 'wave', st.wave, st.state, 'troops', st.troops, 'pts', st.points, 'score', st.score); lastWave = st.wave; }
    if (st.wave > maxWave) { end = { end: 'completed-wave-' + maxWave, ...st }; break; }
    // human-like steering: intercept the lane whose on-field enemies are
    // closest to breaching (sum of y per lane), aiming at that lane's mean x
    await q.evaluate(() => {
      const st = __blastlineTest.getState();
      const es = (st.sampleEnemies || []).filter(e => e.y > .12 && e.y < .88);
      if (st.bossX != null) { __blastlineTest.setPlayerX(st.bossX); }
      else if (es.length) {
        const lanes = [0, 1, 2].map(l => es.filter(e => e.lane === l));
        const score = lanes.map(list => list.reduce((a, e) => a + e.y, 0));
        const best = score.indexOf(Math.max(...score));
        if (score[best] > 0) {
          const mean = lanes[best].reduce((a, e) => a + e.x, 0) / lanes[best].length;
          __blastlineTest.setPlayerX(mean);
        }
      }
      __blastlineTest.advance(.5);
    });
    await q.waitForTimeout(15);
  }
  if (!end) end = { end: 'guard-hit', ...(log[log.length-1] || {}) };
  console.log('=== ' + name + ' ===');
  console.log(JSON.stringify({ end, log }, null, 0));
  await q.close();
  return { name, end, log };
}

const runs = [];
const ONLY = process.env.ONLY;
if (!ONLY || ONLY === 'baseline') runs.push(await playRun('baseline', ['damage','fireRate','multishot','damage','piercing','criticalChance','fireRate','damage','reinforcements']));
if (!ONLY || ONLY === 'taming') runs.push(await playRun('taming-rush', ['taming','taming','taming','damage','fireRate','damage','reinforcements','multishot']));
if (ONLY === 'control') runs.push(await playRun('control-stack', ['shock','shock','shock','frost','frost','frost','damage','fireRate','damage','fireRate','reinforcements','damage']));
if (ONLY === 'shock') runs.push(await playRun('shock-only', ['shock','shock','shock','damage','fireRate','damage','fireRate','reinforcements','damage','multishot']));
if (ONLY === 'frost') runs.push(await playRun('frost-only', ['frost','frost','frost','damage','fireRate','damage','fireRate','reinforcements','damage','multishot']));
if (!ONLY || ONLY === 'eco') runs.push(await playRun('eco-logistics', ['logistics','logistics','damage','fireRate','logistics','damage','logistics','damage','logistics','damage','damage','fireRate','reinforcements','damage','piercing','damage','multishot','damage']));
await browser.close(); server.close(); process.exit(0);
