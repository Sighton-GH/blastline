import { clamp, lerp, format, LEVELS, initialPlayer, makeGatePair, applyGate, gateText, pickUpgradeSet, applyUpgrade, mulberry32 } from './core.mjs';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const floatingStats = document.querySelector('#floatingStats');
const upgradePanel = document.querySelector('#upgradePanel');
const gameOverPanel = document.querySelector('#gameOverPanel');
const playBtn = document.querySelector('#playBtn');
const retryBtn = document.querySelector('#retryBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const waveLabel = document.querySelector('#waveLabel');
const troopsLabel = document.querySelector('#troopsLabel');
const powerLabel = document.querySelector('#powerLabel');
const bestLabel = document.querySelector('#bestLabel');
const coinLabel = document.querySelector('#coinLabel');
const gemLabel = document.querySelector('#gemLabel');
const finalScore = document.querySelector('#finalScore');
const finalWave = document.querySelector('#finalWave');
const finalBest = document.querySelector('#finalBest');
const upgradeCards = document.querySelector('#upgradeCards');
const portraitImg = document.querySelector('#portrait');

const IMAGES = {};
const ASSET_FILES = {
  hero: 'assets/hero.webp',
  grunt: 'assets/grunt.webp',
  elite: 'assets/grunt.webp',
  portrait: 'assets/portrait.webp'
};

let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2);
let state = 'menu';
let paused = false;
let last = 0;
let rng = Math.random;
let player = initialPlayer();
let bullets = [], enemies = [], gates = [], particles = [], floaters = [];
let wave = 0, waveTime = 0, spawnTimer = 0, gateTimer = 1.8, score = 0, best = +(localStorage.getItem('blastline-best') || 0), boss = null, frenzy = 0, frenzyTimer = 0;
let pointerX = 0, controlsActive = false;
let roadScroll = 0;
let runSeed = Date.now() >>> 0;

function loadAssets(){
  return Promise.all(Object.entries(ASSET_FILES).map(([key, src]) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { IMAGES[key] = img; resolve(); };
    img.onerror = reject;
    img.src = src;
  })));
}

function resize(){
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize, { passive: true }); resize();

function setState(next){
  state = next;
  canvas.dataset.state = next;
  menu.classList.toggle('visible', next === 'menu');
  upgradePanel.classList.toggle('visible', next === 'upgrade');
  gameOverPanel.classList.toggle('visible', next === 'over');
  hud.classList.toggle('hidden', next !== 'playing');
  floatingStats.classList.toggle('hidden', next !== 'playing');
}

function resetRun(seed = Date.now() >>> 0){
  runSeed = seed; rng = mulberry32(seed); player = initialPlayer(); bullets=[]; enemies=[]; gates=[]; particles=[]; floaters=[];
  score = 0; wave = 0; boss = null; frenzy = 0; frenzyTimer = 0; roadScroll = 0;
  startWave();
}

function startWave(){
  if(wave >= LEVELS.length) wave = 0;
  waveTime = 0; spawnTimer = 0.5; gateTimer = 1.4; enemies = []; gates = []; bullets = []; particles = []; boss = null; player.targetX = 0; player.x = 0;
  setState('playing');
  updateHud();
}

function spawnEnemy(type='grunt'){
  const level = LEVELS[wave];
  const lane = [-0.6,-0.3,0,0.3,0.6][Math.floor(rng()*5)];
  enemies.push({
    type, x: lane + (rng()-.5)*.07, y: -0.08 - rng()*0.05, hp: type==='elite' ? 5 + wave*2 : 1 + Math.floor(wave/2),
    speed: (type==='elite' ? .18 : .23) * level.speed * (0.9 + rng()*0.18), wobble: rng()*6.28, bob: rng()*1000
  });
}

function spawnGatePair(){
  const pair = makeGatePair(rng, wave);
  const leftX = -0.35, rightX = 0.35;
  gates.push({x:leftX, y:-0.06, w:0.44, h:0.14, kind:pair[0].kind, value:pair[0].value, label:pair[0].label, color: gateText(pair[0]).startsWith('-') ? 'red' : 'blue'});
  gates.push({x:rightX, y:-0.06, w:0.44, h:0.14, kind:pair[1].kind, value:pair[1].value, label:pair[1].label, color: gateText(pair[1]).startsWith('-') ? 'red' : 'blue'});
}

function spawnBoss(){
  const level = LEVELS[wave];
  boss = { x: 0, y: -0.12, hp: level.bossHp, maxHp: level.bossHp, speed: 0.12 * level.speed, type: 'boss' };
}

function updateHud(){
  waveLabel.textContent = `WAVE ${wave+1}/${LEVELS.length}`;
  troopsLabel.textContent = format(player.troops);
  powerLabel.textContent = format(player.power);
  bestLabel.textContent = format(best);
  coinLabel.textContent = format(player.coins + score);
  gemLabel.textContent = format(player.gems);
  canvas.dataset.playerX = player.x.toFixed(3);
  canvas.dataset.wave = String(wave + 1);
  canvas.dataset.troops = String(player.troops);
}

function addFloater(x,y,text,color='#fff',size=22){ floaters.push({x,y,text,color,size,life:1}); }
function burst(x,y,color,count=8){ for(let i=0;i<count;i++) particles.push({x,y,vx:(rng()-.5)*0.14,vy:(rng()-.5)*0.18,life:0.45+rng()*0.35,size:2+rng()*5,color}); }

function fireBurst(){
  const n = player.projectiles;
  const spread = n === 1 ? [0] : Array.from({length:n}, (_,i)=>lerp(-0.08,0.08, i/(n-1)));
  const boost = frenzyTimer > 0 ? 1.25 : 1;
  for(const off of spread){ bullets.push({x:player.x+off*.4,y:0.88,vx:off*0.28,vy:-0.95*boost,power:player.power}); }
}

function perspectiveY(y){ return H * (0.12 + y * 0.78); }
function laneHalfWidth(y){ return W * lerp(0.08, 0.44, y); }
function worldToScreen(x,y){ return { x: W/2 + x * laneHalfWidth(y), y: perspectiveY(y) }; }
function playerScreen(){ return worldToScreen(player.x, 0.88); }

function update(dt){
  if(state !== 'playing' || paused) return;
  const level = LEVELS[wave];
  waveTime += dt; roadScroll += dt * 220 * level.speed;
  if(frenzyTimer > 0) frenzyTimer -= dt;

  const moveByKeys = (keys.ArrowLeft||keys.a? -1:0) + (keys.ArrowRight||keys.d ? 1:0);
  if(moveByKeys) player.targetX = clamp(player.targetX + moveByKeys * dt * player.speed, -0.78, 0.78);
  player.x = lerp(player.x, player.targetX, Math.min(1, dt*8));

  player._shot = (player._shot || 0) - dt;
  const cadence = 1 / (player.fireRate * (frenzyTimer>0 ? 1.45 : 1));
  if(player._shot <= 0){ player._shot = cadence; fireBurst(); }

  spawnTimer -= dt;
  if(!boss && spawnTimer <= 0){
    spawnEnemy(rng() < 0.18 + wave*0.05 ? 'elite' : 'grunt');
    if(rng() < 0.3 + wave*0.04) spawnEnemy('grunt');
    spawnTimer = level.spawn * (0.8 + rng()*0.35);
  }

  gateTimer -= dt;
  if(!boss && gateTimer <= 0 && waveTime < level.length - 6){ spawnGatePair(); gateTimer = 5.2 - Math.min(1.5,wave*0.18) + rng()*1.0; }
  if(!boss && waveTime >= level.length) spawnBoss();

  for(const gate of gates){ gate.y += dt * 0.18 * level.speed; }
  for(const e of enemies){ e.y += dt * e.speed; e.x += Math.sin((waveTime*2)+e.wobble) * 0.0016; }
  if(boss){ boss.y += dt * boss.speed; boss.y = Math.min(0.22, boss.y); }

  for(const b of bullets){ b.x += b.vx * dt; b.y += b.vy * dt; }

  for(const gate of gates){
    if(!gate.hit && gate.y > 0.84){
      if(Math.abs(player.x - gate.x) < gate.w/2){ player = applyGate(player, gate); addFloater(gate.x, 0.82, gateText(gate), gate.color==='red' ? '#ff6f6f' : '#8fe8ff', 26); burst(gate.x, gate.y, gate.color==='red' ? '#ff4d57' : '#44d4ff', 16); }
      gate.hit = true;
      updateHud();
    }
  }

  for(const b of bullets){
    if(b.dead) continue;
    if(boss){
      const dx = b.x - boss.x, dy = b.y - boss.y;
      if(dx*dx + dy*dy < 0.03*0.03){ b.dead = true; boss.hp -= b.power; burst(boss.x,boss.y,'#ff9153',2); score += 3; if(boss.hp <= 0){ score += 1200 + wave*500; burst(boss.x,boss.y,'#ffc44d',30); boss = null; setState('upgrade'); showUpgrades(); updateHud(); return; } }
    }
    for(const e of enemies){
      if(e.dead || b.dead) continue;
      const dx=b.x-e.x, dy=b.y-e.y;
      if(dx*dx + dy*dy < (e.type==='elite'?0.018:0.014)**2){
        e.hp -= b.power; b.dead = true; burst(e.x,e.y,e.type==='elite' ? '#ffb35a' : '#ff6868', e.type==='elite' ? 5 : 3);
        if(e.hp <= 0){ e.dead = true; score += e.type==='elite' ? 55 : 18; player.coins += e.type==='elite' ? 12 : 4; frenzy += e.type==='elite'?3:1; if(frenzy >= 12){ frenzy = 0; frenzyTimer = 4.5; addFloater(0,0.5,'FRENZY!','#77ddff',32); } }
      }
    }
  }

  for(const e of enemies){
    if(!e.dead && e.y > 0.86){ e.dead = true; player.troops = Math.max(0, player.troops - (e.type==='elite' ? 4 : 1)); addFloater(e.x,0.83, e.type==='elite' ? '-4' : '-1', '#ff8d8d', 22); burst(e.x, e.y, '#ff5757', 8); if(player.troops <= 0){ gameOver(); return; } updateHud(); }
  }

  bullets = bullets.filter(b => !b.dead && b.y > -0.1);
  enemies = enemies.filter(e => !e.dead && e.y < 1.02);
  gates = gates.filter(g => g.y < 1.08 && !g.hit);
  for(const p of particles){ p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt; p.vx *= 0.98; p.vy *= 0.98; }
  particles = particles.filter(p => p.life > 0);
  for(const f of floaters){ f.y -= dt * 0.06; f.life -= dt; }
  floaters = floaters.filter(f => f.life > 0);

  updateHud();
}

function showUpgrades(){
  const upgrades = pickUpgradeSet(rng);
  upgradeCards.innerHTML = '';
  for(const item of upgrades){
    const btn = document.createElement('button');
    btn.className = 'upgrade-card';
    btn.innerHTML = `<strong>${item.icon}</strong><b>${item.title}</b><span>${item.desc}</span>`;
    btn.onclick = () => { player = applyUpgrade(player, item.id); wave = (wave + 1) % LEVELS.length; startWave(); updateHud(); };
    upgradeCards.append(btn);
  }
}

function gameOver(){
  best = Math.max(best, player.coins + score); localStorage.setItem('blastline-best', best);
  finalScore.textContent = format(player.coins + score);
  finalWave.textContent = `${wave+1}`;
  finalBest.textContent = format(best);
  setState('over');
}

function drawBackground(){
  const sky = ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#6bc9ff'); sky.addColorStop(.22,'#2fa9ea'); sky.addColorStop(1,'#046ca9');
  ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
  const shimmer = (roadScroll*0.02)%120;
  for(let side=0; side<2; side++){
    const dir = side===0 ? -1 : 1;
    const x0 = W/2 + dir*W*0.46;
    const water = ctx.createLinearGradient(0,0,0,H); water.addColorStop(0,'#54bbf0'); water.addColorStop(1,'#1186c3');
    ctx.fillStyle = water; ctx.beginPath(); ctx.moveTo(dir<0?0:W,0); ctx.lineTo(W/2+dir*W*0.11,H*0.12); ctx.lineTo(W/2+dir*W*0.46,H); ctx.lineTo(dir<0?0:W,H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=2;
    for(let i=0;i<12;i++){ const y=(i*80+shimmer)%H; ctx.beginPath(); ctx.moveTo(x0-dir*90, y); ctx.lineTo(x0-dir*30, y+16); ctx.stroke(); }
  }

  const topY = H*0.08, botY = H;
  const topHalf = W*0.13, botHalf = W*0.43;
  ctx.fillStyle = '#c7ccd2';
  ctx.beginPath(); ctx.moveTo(W/2-topHalf, topY); ctx.lineTo(W/2+topHalf, topY); ctx.lineTo(W/2+botHalf, botY); ctx.lineTo(W/2-botHalf, botY); ctx.closePath(); ctx.fill();

  const roadGrad = ctx.createLinearGradient(0,topY,0,botY); roadGrad.addColorStop(0,'#bfc4ca'); roadGrad.addColorStop(1,'#9ea5ad');
  ctx.fillStyle = roadGrad;
  ctx.beginPath(); ctx.moveTo(W/2-topHalf*0.78, topY); ctx.lineTo(W/2+topHalf*0.78, topY); ctx.lineTo(W/2+botHalf*0.72, botY); ctx.lineTo(W/2-botHalf*0.72, botY); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.setLineDash([26,22]);
  for(const f of [-0.33,0.33]){
    ctx.beginPath();
    for(let i=0;i<24;i++){
      const y = i/23; const pt = worldToScreen(f*(0.06+y*0.04), y);
      if(i===0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  function rail(side){
    const dir = side<0?-1:1; ctx.strokeStyle='#d8494f'; ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(W/2+dir*topHalf*1.05, topY); ctx.lineTo(W/2+dir*botHalf*1.02, botY); ctx.stroke();
    ctx.lineWidth=3; ctx.strokeStyle='#a90f20';
    for(let i=0;i<20;i++){ const y=i/19; const x = W/2 + dir*lerp(topHalf*1.05, botHalf*1.02, y); const yy=lerp(topY, botY, y); ctx.beginPath(); ctx.moveTo(x,yy); ctx.lineTo(x-dir*(28+y*26),yy); ctx.stroke(); }
    for(const t of [0.06,0.42]){
      const yy = lerp(topY, botY, t); const half = lerp(topHalf, botHalf, t); const x = W/2 + dir*half*1.18;
      ctx.fillStyle='#d53b40'; ctx.fillRect(x-12,yy-110,24,140);
      ctx.strokeStyle='#c23944'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(x,yy-110); ctx.lineTo(x+dir*70,yy+6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,yy-110); ctx.lineTo(x-dir*18, yy-170); ctx.stroke();
      ctx.strokeStyle='rgba(255,165,165,.85)'; ctx.lineWidth=2.4;
      ctx.beginPath(); ctx.moveTo(x,yy-110); ctx.bezierCurveTo(x+dir*45,yy-60,x+dir*100,yy+40, W/2+dir*botHalf*1.01,H*0.92); ctx.stroke();
    }
  }
  rail(-1); rail(1);
}

function drawSprite(img, x, y, h){
  const ratio = img.width / img.height; const w = h * ratio;
  ctx.drawImage(img, x - w/2, y - h, w, h);
}

function drawGates(){
  for(const gate of gates){
    const scr = worldToScreen(gate.x, gate.y);
    const scale = lerp(0.38, 1.15, gate.y);
    const w = Math.min(W * 0.34, 250) * scale;
    const h = Math.min(H * 0.075, 74) * scale;
    const isRed = gate.color === 'red';
    const main = isRed ? '#ef3f45' : '#169df4';
    const glow = isRed ? 'rgba(255,70,76,.33)' : 'rgba(42,201,255,.34)';
    const dark = isRed ? '#9e1c24' : '#07589c';
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 18 * scale;
    const grad = ctx.createLinearGradient(scr.x-w/2,scr.y,scr.x+w/2,scr.y);
    grad.addColorStop(0, isRed ? 'rgba(239,63,69,.72)' : 'rgba(18,151,244,.72)');
    grad.addColorStop(.5, isRed ? 'rgba(255,119,123,.55)' : 'rgba(72,213,255,.56)');
    grad.addColorStop(1, isRed ? 'rgba(239,63,69,.72)' : 'rgba(18,151,244,.72)');
    ctx.fillStyle = grad; ctx.strokeStyle = main; ctx.lineWidth = Math.max(2,4*scale);
    ctx.beginPath(); ctx.roundRect(scr.x-w/2,scr.y-h/2,w,h,8*scale); ctx.fill(); ctx.stroke();
    ctx.shadowBlur=0;
    const postW = Math.max(7, 12*scale), postH = h*1.32;
    for(const sign of [-1,1]){
      const px=scr.x+sign*(w/2-postW*.1);
      ctx.fillStyle=dark; ctx.beginPath(); ctx.roundRect(px-postW/2,scr.y-postH/2,postW,postH,3*scale);ctx.fill();
      ctx.fillStyle=main; ctx.fillRect(px-postW*.32,scr.y-postH*.43,postW*.64,postH*.72);
      ctx.fillStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.arc(px,scr.y-postH*.34,Math.max(1.5,2*scale),0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='#fff'; ctx.lineWidth=Math.max(3,5*scale); ctx.strokeStyle='rgba(26,35,44,.75)';
    ctx.font=`900 ${Math.max(16,h*.48)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    const text=gateText(gate);ctx.strokeText(text,scr.x,scr.y+1);ctx.fillText(text,scr.x,scr.y+1);
    ctx.restore();
  }
}
function drawEnemies(){
  enemies.sort((a,b)=>a.y-b.y);
  for(const e of enemies){
    const scr = worldToScreen(e.x, e.y); const h = lerp(30, 78, e.y) * (e.type==='elite' ? 1.22 : 1);
    drawSprite(e.type==='elite' ? IMAGES.elite : IMAGES.grunt, scr.x, scr.y+10, h);
    if(e.type==='elite'){
      ctx.fillStyle='rgba(255,177,77,.9)'; ctx.font=`900 ${Math.max(14, h*0.17)}px system-ui`; ctx.textAlign='center'; ctx.fillText(`${e.hp}`, scr.x, scr.y - h*0.9);
    }
  }
  if(boss){
    const scr = worldToScreen(boss.x, boss.y); const h = lerp(80, 150, boss.y) * 1.18;
    drawSprite(IMAGES.elite, scr.x, scr.y+20, h);
    const bw = Math.min(360, W*0.42), bh = 12;
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(W/2-bw/2, H*0.14, bw, bh);
    ctx.fillStyle='#ff5959'; ctx.fillRect(W/2-bw/2, H*0.14, bw * clamp(boss.hp / boss.maxHp,0,1), bh);
    ctx.fillStyle='#fff'; ctx.font='900 18px system-ui'; ctx.textAlign='center'; ctx.fillText('BOSS', W/2, H*0.14 - 8);
  }
}

function drawBullets(){
  for(const b of bullets){
    const scr = worldToScreen(b.x, b.y);
    const len = 24; ctx.strokeStyle = frenzyTimer>0 ? '#9ee6ff' : '#ffd06c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(scr.x, scr.y); ctx.lineTo(scr.x - b.vx*len, scr.y + 14); ctx.stroke();
    ctx.fillStyle = '#fff4ba'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 2.5, 0, Math.PI*2); ctx.fill();
  }
}

function drawPlayer(){
  const scr = playerScreen();
  const h = clamp(H*0.12, 86, 126);
  drawSprite(IMAGES.hero, scr.x, scr.y+12, h);
  if(player._shot > (1/(player.fireRate*(frenzyTimer>0?1.45:1))) - 0.08){ ctx.fillStyle='rgba(255,217,102,.95)'; ctx.beginPath(); ctx.arc(scr.x+26, scr.y-h*0.56, 10, 0, Math.PI*2); ctx.fill(); }
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(scr.x, scr.y+4, 38, 14, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.lineWidth=5; ctx.font=`900 ${Math.min(42, W*0.06)}px system-ui`; ctx.textAlign='center';
  const text = `${player.troops}`; ctx.strokeText(text, scr.x, scr.y + h*0.42); ctx.fillText(text, scr.x, scr.y + h*0.42);
}

function drawEffects(){
  for(const p of particles){
    const scr = worldToScreen(p.x,p.y); ctx.globalAlpha = clamp(p.life*2,0,1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(scr.x, scr.y, p.size, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for(const f of floaters){
    const scr = worldToScreen(f.x, f.y); ctx.globalAlpha = clamp(f.life,0,1); ctx.fillStyle = f.color; ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=4; ctx.font=`900 ${f.size}px system-ui`; ctx.textAlign='center'; ctx.strokeText(f.text, scr.x, scr.y); ctx.fillText(f.text, scr.x, scr.y);
  }
  ctx.globalAlpha = 1;
  if(frenzyTimer > 0){ ctx.fillStyle='rgba(104,209,255,.08)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#8de4ff'; ctx.font='900 28px system-ui'; ctx.textAlign='center'; ctx.fillText(`FRENZY ${frenzyTimer.toFixed(1)}s`, W/2, H*0.28); }
}

function draw(){
  drawBackground(); drawGates(); drawEnemies(); drawBullets(); drawPlayer(); drawEffects();
}

const keys = {};
addEventListener('keydown', e => { keys[e.key] = true; if((e.key === 'Enter' || e.key === ' ') && state === 'menu') resetRun(); if(e.key.toLowerCase()==='p') paused=!paused; });
addEventListener('keyup', e => { keys[e.key] = false; });
function pointerMove(clientX){ const nx = (clientX / W - 0.5) / 0.44; player.targetX = clamp(nx, -0.78, 0.78); }
canvas.addEventListener('pointerdown', e => { controlsActive = true; pointerMove(e.clientX); });
canvas.addEventListener('pointermove', e => { if(controlsActive || e.pointerType === 'mouse') pointerMove(e.clientX); });
addEventListener('pointerup', () => { controlsActive = false; });
playBtn.onclick = () => resetRun(); retryBtn.onclick = () => resetRun(); pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? '▶' : '❚❚'; };

function loop(ts){ const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }

await loadAssets();
updateHud();
setState('menu');
requestAnimationFrame(loop);
