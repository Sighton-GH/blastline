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
await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
await page.waitForTimeout(600);
const r = await page.evaluate(() => {
  localStorage.setItem('blastline.profile.v1', JSON.stringify({ salvage: 500, tiers: {}, earned: 0, best: { wave: 0, score: 0 }, lastSeen: Date.now(), runs: 0 }));
  location.reload();
  return true;
});
await page.waitForTimeout(800);
const before = await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('blastline.profile.v1')); return p.salvage; });
// open the meta panel and click the first purchasable track
const opened = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => /FIELD UPGRADE|UPGRADE|META/i.test(b.textContent));
  if (btns[0]) { btns[0].click(); return btns[0].textContent.trim(); }
  return null;
});
await page.waitForTimeout(400);
const buy = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('button')].filter(b => /SALVAGE|TIER|Scavengers|Veteran Rifles|Standing Reserve|Supply Lines/i.test(b.textContent) && !b.disabled);
  const panel = document.querySelector('#metaPanel, .meta-panel, [class*="meta"]');
  const enabled = [...document.querySelectorAll('button:not([disabled])')].map(b => b.textContent.trim().slice(0, 40));
  return { opened: !!panel && !panel.classList.contains('hidden'), enabledCount: enabled.length, sample: enabled.slice(0, 12) };
});
console.log('META-UI', JSON.stringify({ before, opened, buy }));
await page.screenshot({ path: '/home/sandbox/c6-evidence/v2-meta-panel.png' });
console.log('JS ERRORS:', errors.length ? errors.slice(0,3) : 'none');
await browser.close(); server.close(); process.exit(0);
