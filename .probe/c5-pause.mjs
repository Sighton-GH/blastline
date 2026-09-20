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
for (const [name, view] of [['desktop', { width: 1365, height: 768 }], ['mobile', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: view, hasTouch: view.width < 500, isMobile: view.width < 500 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/?qa`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#playBtn');
  await page.waitForTimeout(1500);
  await page.click('#pauseBtn');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/shots/c5-pause-${name}.png` });
  console.log('PAUSE', name, 'errors:', errs.length ? errs : 'none');
  await page.close();
}
await browser.close();
