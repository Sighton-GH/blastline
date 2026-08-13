import { clamp, lerp, format, LEVELS, initialPlayer, makeGatePair, applyGate, gateText, pickUpgradeSet, applyUpgrade, mulberry32, visibleSquadCount, squadColumnCount } from './core.mjs';

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
let bullets = [], enemies = [], gates = [], particles = [], floaters = [], muzzleFlashes = [];
let shotSerial = 0;
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
  score = 0; wave = 0; boss = null; frenzy = 0; frenzyTimer = 0; roadScroll = 0; muzzleFlashes = []; shotSerial = 0;
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
  canvas.dataset.visibleSquad = String(visibleSquadCount(player.troops));
}

function addFloater(x,y,text,color='#fff',size=22){ floaters.push({x,y,text,color,size,life:1}); }
function burst(x,y,color,count=8){ for(let i=0;i<count;i++) particles.push({x,y,vx:(rng()-.5)*0.14,vy:(rng()-.5)*0.18,life:0.45+rng()*0.35,size:2+rng()*5,color}); }

function fireBurst(){
  const n=player.projectiles;
  const spread=n===1?[0]:Array.from({length:n},(_,i)=>lerp(-0.08,0.08,i/(n-1)));
  const boost=frenzyTimer>0?1.25:1;
  const slots=squadLogicalSlots();
  const frontRow=slots.filter(slot=>slot.row===0);
  const shooterCount=Math.min(frontRow.length,Math.max(n,slots.length>=18?3:slots.length>=6?2:1));
  const shooters=[];
  for(let i=0;i<shooterCount;i++) shooters.push(frontRow[(shotSerial+i)%frontRow.length]);
  for(let i=0;i<spread.length;i++){
    const off=spread[i],slot=shooters[i%shooters.length],world=squadSlotWorld(slot);
    const targetX=player.x+off*.4;
    bullets.push({x:world.x+off*.08,y:world.y-0.052,targetX,vx:off*0.28,vy:-0.95*boost,power:player.power,shooter:slot.index});
  }
  for(const slot of shooters) muzzleFlashes.push({slot:slot.index,life:.085});
  shotSerial=(shotSerial+1)%Math.max(1,frontRow.length);
}

function sceneHorizon(){ return H * (W < H ? 0.18 : 0.16); }
function depthCurve(y){
  if(y <= 0) return y * 0.30;
  return Math.pow(Math.min(y, 1.08), 1.28);
}
function perspectiveY(y){
  const horizon = sceneHorizon();
  return horizon + (H * 0.82) * depthCurve(y);
}
function laneHalfWidth(y){
  const t = Math.pow(clamp(y, 0, 1), 0.88);
  return W * lerp(0.105, 0.32, t);
}
function bridgeHalfWidth(y){ return laneHalfWidth(y) * 1.18; }
function roadHalfWidth(y){ return bridgeHalfWidth(y) * 0.79; }
function worldToScreen(x,y){ return { x: W/2 + x * laneHalfWidth(y), y: perspectiveY(y) }; }
function playerScreen(){ return worldToScreen(player.x, 0.88); }

const squadLayoutCache = new Map();
function squadLogicalSlots(troops=player.troops){
  const visible=visibleSquadCount(troops);
  if(squadLayoutCache.has(visible)) return squadLayoutCache.get(visible);
  const cols=squadColumnCount(visible);
  const rows=Math.ceil(visible/cols);
  const rowGap=0.045;
  const nearY=0.915;
  const frontY=nearY-(rows-1)*rowGap;
  const slots=[];
  const basePerRow=Math.floor(visible/rows), extraRows=visible%rows;
  for(let row=0,index=0;row<rows;row++){
    const rowCount=basePerRow+(row<extraRows?1:0);
    for(let col=0;col<rowCount;col++,index++){
      const stagger=rows>1?(row%2?0.18:-0.18):0;
      slots.push({index,row,y:frontY+row*rowGap,colOffset:col-(rowCount-1)/2+stagger,phase:index*1.71+row*.43});
    }
  }
  squadLayoutCache.set(visible,slots);
  return slots;
}
function soldierHeightAt(y){
  const near=clamp(Math.min(H*0.09,W*0.14),46,70);
  const depth=clamp((y-0.64)/0.31,0,1);
  return near*lerp(.76,1.04,depth);
}
function squadSlotWorldX(slot){
  const h=soldierHeightAt(slot.y);
  const aspectBoost=clamp(.84+(W/H)*.35,1,1.28);
  const stepPx=h*.58*aspectBoost;
  const stepWorld=stepPx/Math.max(1,laneHalfWidth(slot.y));
  return clamp(player.x+slot.colOffset*stepWorld,-.88,.88);
}
function squadSlotWorld(slot){ return {x:squadSlotWorldX(slot),y:slot.y}; }

function update(dt){
  if(state !== 'playing' || paused) return;
  const level = LEVELS[wave];
  waveTime += dt; roadScroll += dt * 220 * level.speed;
  if(frenzyTimer > 0) frenzyTimer -= dt;

  const moveByKeys = (keys.ArrowLeft||keys.a? -1:0) + (keys.ArrowRight||keys.d ? 1:0);
  if(moveByKeys) player.targetX = clamp(player.targetX + moveByKeys * dt * player.speed, -0.78, 0.78);
  const previousX=player.x;
  player.x = lerp(player.x, player.targetX, Math.min(1, dt*8));
  const visualVx=dt>0?(player.x-previousX)/dt:0;
  player._visualLean=lerp(player._visualLean||0,clamp(visualVx*.045,-.08,.08),Math.min(1,dt*12));

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

  for(const b of bullets){
    if(Number.isFinite(b.targetX)) b.x=lerp(b.x,b.targetX,Math.min(1,dt*11));
    b.x += b.vx * dt; b.y += b.vy * dt;
  }

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
  for(const flash of muzzleFlashes) flash.life -= dt;
  muzzleFlashes = muzzleFlashes.filter(flash => flash.life > 0);

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
  const horizon = sceneHorizon();
  const deckBottom = Math.min(H * 1.02, perspectiveY(1));
  const bridgeRed = '#d94a43';
  const bridgeRedDark = '#9f282b';
  const bridgeRedDeep = '#762127';
  const bridgeRedLight = '#ee6a58';

  function sidePoint(side, y, factor=1){
    return { x: W/2 + side * bridgeHalfWidth(y) * factor, y: perspectiveY(y) };
  }
  function roadPoint(side, y){
    return { x: W/2 + side * roadHalfWidth(y), y: perspectiveY(y) };
  }
  function railHeight(y){
    const t = Math.pow(clamp(y,0,1), 0.82);
    return lerp(Math.max(5,H*0.008), Math.min(H*0.055,44), t);
  }
  function railTop(side,y){
    const p = sidePoint(side,y,1.035);
    p.y -= railHeight(y);
    return p;
  }
  function towerHeight(y){
    const t = Math.pow(clamp(y,0,1),0.72);
    return lerp(H*0.105, Math.min(H*0.255,210), t);
  }
  function towerX(side,y){ return sidePoint(side,y,1.045).x; }

  // Sky: bright, slightly hazy toward the water line.
  const sky = ctx.createLinearGradient(0,0,0,horizon + H*0.08);
  sky.addColorStop(0,'#67c9f7');
  sky.addColorStop(.56,'#8ad8f6');
  sky.addColorStop(1,'#d0edf4');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,W,horizon + H*0.08);

  // Ocean: one continuous body of water, with a real horizon instead of blue wedges to the top edge.
  const water = ctx.createLinearGradient(0,horizon,0,H);
  water.addColorStop(0,'#55b9d9');
  water.addColorStop(.28,'#2fa7d3');
  water.addColorStop(1,'#0b79ad');
  ctx.fillStyle = water;
  ctx.fillRect(0,horizon,W,H-horizon);

  // Atmospheric horizon haze.
  const haze = ctx.createLinearGradient(0,horizon-H*.035,0,horizon+H*.075);
  haze.addColorStop(0,'rgba(224,247,250,0)');
  haze.addColorStop(.42,'rgba(226,246,247,.62)');
  haze.addColorStop(1,'rgba(154,220,231,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0,horizon-H*.04,W,H*.12);
  ctx.strokeStyle='rgba(238,251,252,.68)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,horizon+.5);ctx.lineTo(W,horizon+.5);ctx.stroke();

  // Broad, irregular water highlights. The deck will cover the center, so these remain peripheral.
  const shimmer = roadScroll * 0.055;
  for(let i=0;i<14;i++){
    const base = (i*67 + shimmer) % Math.max(90,H-horizon);
    const y = horizon + base;
    const depth = clamp((y-horizon)/(H-horizon),0,1);
    const alpha = lerp(.10,.22,depth);
    const span = lerp(18,70,depth) * (W/390 > 1 ? 1.25 : 1);
    for(const side of [-1,1]){
      const cx = W/2 + side * lerp(W*.28,W*.43,depth);
      const wobble = Math.sin(i*1.77 + roadScroll*.004) * span*.28;
      ctx.strokeStyle=`rgba(218,248,255,${alpha})`;
      ctx.lineWidth=lerp(.8,2.2,depth);
      ctx.beginPath();
      ctx.moveTo(cx-side*span*.52,y);
      ctx.bezierCurveTo(cx-side*span*.20,y-3-wobble*.05,cx+side*span*.18,y+3+wobble*.04,cx+side*span*.55,y-1);
      ctx.stroke();
    }
  }

  // Soft bridge shadow on the water establishes elevation before the deck is drawn.
  ctx.fillStyle='rgba(21,71,92,.18)';
  ctx.beginPath();
  const shadowFar=sidePoint(-1,0,1.12), shadowFarR=sidePoint(1,0,1.12);
  const shadowNear=sidePoint(-1,1,1.14), shadowNearR=sidePoint(1,1,1.14);
  ctx.moveTo(shadowFar.x,shadowFar.y+H*.018);ctx.lineTo(shadowFarR.x,shadowFarR.y+H*.018);
  ctx.lineTo(shadowNearR.x,deckBottom+H*.025);ctx.lineTo(shadowNear.x,deckBottom+H*.025);ctx.closePath();ctx.fill();

  // Visible slab side faces: separate surface from structural depth.
  for(const side of [-1,1]){
    ctx.beginPath();
    for(let i=0;i<=28;i++){
      const y=i/28, p=sidePoint(side,y,1.01);
      if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
    }
    for(let i=28;i>=0;i--){
      const y=i/28, p=sidePoint(side,y,1.01);
      const depth=lerp(4,Math.min(28,H*.035),Math.pow(y,.9));
      ctx.lineTo(p.x-side*lerp(1,6,y),p.y+depth);
    }
    ctx.closePath();
    const sideGrad=ctx.createLinearGradient(0,horizon,0,H);
    sideGrad.addColorStop(0,side<0?'#8a9194':'#737b80');
    sideGrad.addColorStop(1,side<0?'#6f767a':'#555e63');
    ctx.fillStyle=sideGrad;ctx.fill();
  }

  // Shoulder / deck top.
  ctx.beginPath();
  for(let i=0;i<=28;i++){
    const y=i/28,p=sidePoint(-1,y);
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  }
  for(let i=28;i>=0;i--){const y=i/28,p=sidePoint(1,y);ctx.lineTo(p.x,p.y);}
  ctx.closePath();
  const shoulderGrad=ctx.createLinearGradient(0,horizon,0,H);
  shoulderGrad.addColorStop(0,'#c7c7c1');
  shoulderGrad.addColorStop(1,'#a6a7a7');
  ctx.fillStyle=shoulderGrad;ctx.fill();

  // Road surface with one coherent sun direction and subtle foreground darkening.
  ctx.beginPath();
  for(let i=0;i<=28;i++){
    const y=i/28,p=roadPoint(-1,y);
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  }
  for(let i=28;i>=0;i--){const y=i/28,p=roadPoint(1,y);ctx.lineTo(p.x,p.y);}
  ctx.closePath();
  const roadGrad=ctx.createLinearGradient(W*.30,horizon,W*.72,H);
  roadGrad.addColorStop(0,'#a8aaa8');
  roadGrad.addColorStop(.52,'#909391');
  roadGrad.addColorStop(1,'#7d8282');
  ctx.fillStyle=roadGrad;ctx.fill();

  // Shoulder-edge value breaks make the deck read as layered rather than one trapezoid.
  for(const side of [-1,1]){
    ctx.strokeStyle=side<0?'rgba(255,255,255,.22)':'rgba(52,56,58,.25)';
    ctx.lineWidth=Math.max(1.5,W*.0025);
    ctx.beginPath();
    for(let i=0;i<=28;i++){
      const y=i/28,p=roadPoint(side,y);
      if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }

  // Perspective-correct dashed lane separators using world-space segments instead of screen-space dash patterns.
  const scrollPhase=(roadScroll/760)%0.12;
  for(const lane of [-0.32,0.32]){
    for(let i=-1;i<11;i++){
      const y0=i*.12+scrollPhase;
      const y1=y0+.052;
      if(y1<=0||y0>=1)continue;
      const a=clamp(y0,0,1),b=clamp(y1,0,1);
      const p0=worldToScreen(lane,a),p1=worldToScreen(lane,b);
      const w0=lerp(1.2,3.8,Math.pow(a,.85)),w1=lerp(1.2,4.5,Math.pow(b,.85));
      ctx.fillStyle='rgba(248,248,239,.92)';
      ctx.beginPath();ctx.moveTo(p0.x-w0,p0.y);ctx.lineTo(p0.x+w0,p0.y);ctx.lineTo(p1.x+w1,p1.y);ctx.lineTo(p1.x-w1,p1.y);ctx.closePath();ctx.fill();
    }
  }

  // Side structural girder strips, projected along the deck.
  for(const side of [-1,1]){
    ctx.beginPath();
    for(let i=0;i<=30;i++){
      const y=i/30,p=sidePoint(side,y,1.015);
      if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
    }
    for(let i=30;i>=0;i--){
      const y=i/30,p=sidePoint(side,y,.965);
      ctx.lineTo(p.x,p.y+lerp(1,7,y));
    }
    ctx.closePath();ctx.fillStyle=bridgeRedDark;ctx.fill();
    ctx.strokeStyle=bridgeRedLight;ctx.lineWidth=1;ctx.globalAlpha=.55;
    ctx.beginPath();for(let i=0;i<=30;i++){const y=i/30,p=sidePoint(side,y,1.005);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.globalAlpha=1;
  }

  const towers=[0.10,0.39];
  function cableY(y){
    const far=towers[0],near=towers[1];
    const railY=railTop(1,y).y;
    if(y<=far){
      const u=clamp(y/far,0,1);
      const topFar=perspectiveY(far)-towerHeight(far);
      return lerp(horizon-H*.002,topFar,u)-Math.sin(Math.PI*u)*H*.018;
    }
    if(y<=near){
      const u=(y-far)/(near-far);
      const a=perspectiveY(far)-towerHeight(far),b=perspectiveY(near)-towerHeight(near);
      return lerp(a,b,u)+Math.sin(Math.PI*u)*H*.068;
    }
    const u=clamp((y-near)/(1-near),0,1);
    const a=perspectiveY(near)-towerHeight(near),b=railTop(1,1).y-H*.012;
    return lerp(a,b,u)+Math.sin(Math.PI*u)*H*.046;
  }

  // Suspension hangers first, so towers/rails sit cleanly in front of their attachment points.
  for(const side of [-1,1]){
    for(let i=1;i<21;i++){
      const y=i/21;
      if(towers.some(t=>Math.abs(t-y)<.025))continue;
      const top=railTop(side,y);
      const cy=cableY(y);
      if(cy>=top.y-2)continue;
      const fade=lerp(.42,.9,Math.pow(y,.7));
      ctx.strokeStyle=`rgba(159,40,43,${fade})`;
      ctx.lineWidth=lerp(.8,2.2,Math.pow(y,.8));
      ctx.beginPath();ctx.moveTo(top.x,cy);ctx.lineTo(top.x,top.y);ctx.stroke();
    }
  }

  // Continuous main suspension cable with a darker underside for weight.
  for(const side of [-1,1]){
    for(const pass of [0,1]){
      ctx.beginPath();
      for(let i=0;i<=72;i++){
        const y=i/72,p=railTop(side,y),cy=cableY(y);
        if(i===0)ctx.moveTo(p.x,cy);else ctx.lineTo(p.x,cy);
      }
      ctx.strokeStyle=pass===0?bridgeRedDeep:bridgeRedLight;
      ctx.lineWidth=pass===0?Math.max(3,W*.0042):Math.max(1.4,W*.0018);
      ctx.globalAlpha=pass===0?.92:.82;ctx.stroke();ctx.globalAlpha=1;
    }
  }

  // Tower portals: paired pylons, shaded thickness and cross-members spanning the deck.
  function drawTower(y){
    const baseY=perspectiveY(y),height=towerHeight(y),topY=baseY-height;
    const depth=Math.pow(y,.72);
    const pillarW=lerp(Math.max(10,W*.012),Math.min(34,W*.035),depth);
    const beamH=lerp(9,19,depth);
    const xs=[towerX(-1,y),towerX(1,y)];
    for(let idx=0;idx<2;idx++){
      const side=idx===0?-1:1,x=xs[idx];
      const lean=side*lerp(1,5,depth);
      ctx.fillStyle=bridgeRedDeep;
      ctx.beginPath();ctx.moveTo(x-pillarW*.58,baseY+5);ctx.lineTo(x+pillarW*.58,baseY+5);ctx.lineTo(x+pillarW*.46+lean,topY);ctx.lineTo(x-pillarW*.46+lean,topY);ctx.closePath();ctx.fill();
      ctx.fillStyle=bridgeRed;
      ctx.beginPath();ctx.moveTo(x-pillarW*.42,baseY);ctx.lineTo(x+pillarW*.36,baseY);ctx.lineTo(x+pillarW*.28+lean,topY);ctx.lineTo(x-pillarW*.34+lean,topY);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,150,122,.26)';
      ctx.beginPath();ctx.moveTo(x-pillarW*.30,baseY-4);ctx.lineTo(x-pillarW*.10,baseY-4);ctx.lineTo(x-pillarW*.05+lean,topY+3);ctx.lineTo(x-pillarW*.24+lean,topY+3);ctx.closePath();ctx.fill();
    }
    const leftTop=xs[0]+lerp(-1,-5,depth),rightTop=xs[1]+lerp(1,5,depth);
    ctx.fillStyle=bridgeRedDeep;ctx.fillRect(leftTop-pillarW*.15,topY-beamH*.15,rightTop-leftTop+pillarW*.3,beamH*1.25);
    ctx.fillStyle=bridgeRed;ctx.fillRect(leftTop,topY,rightTop-leftTop,beamH*.72);
    const lowerY=topY+height*.27;
    ctx.fillStyle=bridgeRedDark;ctx.fillRect(leftTop+pillarW*.15,lowerY,rightTop-leftTop-pillarW*.3,beamH*.46);
    ctx.fillStyle='rgba(246,112,89,.38)';ctx.fillRect(leftTop+pillarW*.2,lowerY,rightTop-leftTop-pillarW*.4,Math.max(2,beamH*.11));
    // Base collars visually connect each tower leg to the deck side girder.
    for(const x of xs){
      ctx.fillStyle=bridgeRedDeep;ctx.fillRect(x-pillarW*.68,baseY-3,pillarW*1.36,Math.max(6,beamH*.4));
    }
  }
  drawTower(towers[0]);
  drawTower(towers[1]);

  // Guardrails: longitudinal top/mid rails plus vertical posts. No outward ladder ticks.
  for(const side of [-1,1]){
    for(const level of [1,.48]){
      ctx.beginPath();
      for(let i=0;i<=36;i++){
        const y=i/36,p=sidePoint(side,y,1.035),rh=railHeight(y)*level;
        const yy=p.y-rh;
        if(i===0)ctx.moveTo(p.x,yy);else ctx.lineTo(p.x,yy);
      }
      ctx.strokeStyle=level===1?bridgeRed:bridgeRedDark;
      ctx.lineWidth=level===1?Math.max(3,W*.004):Math.max(2,W*.0025);
      ctx.stroke();
    }
    for(let i=1;i<24;i++){
      const y=i/24,p=sidePoint(side,y,1.035),rh=railHeight(y);
      ctx.strokeStyle=bridgeRedDark;ctx.lineWidth=lerp(1,3,Math.pow(y,.8));
      ctx.beginPath();ctx.moveTo(p.x,p.y+2);ctx.lineTo(p.x,p.y-rh);ctx.stroke();
      if(i%3===0){
        const foot=sidePoint(side,y,.985);
        ctx.strokeStyle='rgba(109,32,37,.55)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(p.x,p.y-rh*.42);ctx.lineTo(foot.x,foot.y+4);ctx.stroke();
      }
    }
  }

  // Subtle foreground vignette and deck-side ambient shadow add separation without an expensive filter.
  const vignette=ctx.createLinearGradient(0,H*.62,0,H);
  vignette.addColorStop(0,'rgba(15,45,57,0)');vignette.addColorStop(1,'rgba(10,31,41,.10)');
  ctx.fillStyle=vignette;ctx.fillRect(0,H*.62,W,H*.38);
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

function drawForwardSoldier(scr, h, phase=0, shooting=false, lean=0){
  const u=h/60;
  const bob=Math.sin(waveTime*11+phase)*1.4*u;
  ctx.save();
  ctx.translate(scr.x, scr.y+bob);
  ctx.rotate(lean);
  // Compact contact shadow first.
  ctx.fillStyle='rgba(18,35,42,.24)';
  ctx.beginPath();ctx.ellipse(0,2,10*u,3.5*u,0,0,Math.PI*2);ctx.fill();
  const stride=Math.sin(waveTime*11+phase)*5.2*u;
  // Legs / boots, seen from behind.
  ctx.strokeStyle='#163448';ctx.lineWidth=5.2*u;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-4*u,-15*u);ctx.lineTo(-5*u+stride*.32,-4*u);ctx.stroke();
  ctx.beginPath();ctx.moveTo(4*u,-15*u);ctx.lineTo(5*u-stride*.32,-4*u);ctx.stroke();
  ctx.fillStyle='#102938';
  ctx.fillRect((-8+stride*.12)*u,-5*u,6*u,4*u);ctx.fillRect((2-stride*.12)*u,-5*u,6*u,4*u);
  // Torso/backpack makes the away-from-camera orientation unambiguous.
  ctx.fillStyle='#0b4772';ctx.beginPath();ctx.roundRect(-9*u,-31*u,18*u,19*u,4*u);ctx.fill();
  ctx.fillStyle='#1689d1';ctx.beginPath();ctx.roundRect(-7*u,-32*u,14*u,17*u,3*u);ctx.fill();
  ctx.fillStyle='#073554';ctx.beginPath();ctx.roundRect(-5.5*u,-27*u,11*u,10*u,2.5*u);ctx.fill();
  ctx.strokeStyle='#082b42';ctx.lineWidth=2*u;ctx.beginPath();ctx.moveTo(0,-30*u);ctx.lineTo(0,-18*u);ctx.stroke();
  // Head and helmet from behind.
  ctx.fillStyle='#c98455';ctx.beginPath();ctx.arc(0,-37*u,5.5*u,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1179bd';ctx.beginPath();ctx.arc(0,-39*u,7.3*u,Math.PI,Math.PI*2);ctx.lineTo(7.3*u,-37*u);ctx.lineTo(-7.3*u,-37*u);ctx.closePath();ctx.fill();
  ctx.fillStyle='#095487';ctx.fillRect(-8*u,-38*u,16*u,2.2*u);
  // Arms and rifle both point toward the horizon/up-bridge.
  ctx.strokeStyle='#b8774f';ctx.lineWidth=3.4*u;ctx.beginPath();ctx.moveTo(-7*u,-28*u);ctx.lineTo(-2*u,-35*u);ctx.stroke();ctx.beginPath();ctx.moveTo(7*u,-28*u);ctx.lineTo(3*u,-35*u);ctx.stroke();
  const recoil=shooting?2.2*u:0;
  ctx.strokeStyle='#17242b';ctx.lineWidth=3*u;ctx.beginPath();ctx.moveTo(2*u,-24*u+recoil);ctx.lineTo(4.5*u,-48*u+recoil);ctx.stroke();
  ctx.strokeStyle='#51616a';ctx.lineWidth=1.2*u;ctx.beginPath();ctx.moveTo(3.5*u,-33*u+recoil);ctx.lineTo(5*u,-50*u+recoil);ctx.stroke();
  if(shooting){ctx.fillStyle='rgba(255,207,82,.95)';ctx.beginPath();ctx.arc(5.2*u,-51*u+recoil,4.6*u,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawPlayer(){
  const slots=squadLogicalSlots();
  const activeFlashes=new Set(muzzleFlashes.map(flash=>flash.slot));
  for(const slot of slots){
    const world=squadSlotWorld(slot);
    const scr=worldToScreen(world.x,world.y);
    drawForwardSoldier(scr,soldierHeightAt(slot.y),slot.phase,activeFlashes.has(slot.index),player._visualLean||0);
  }
  const label=worldToScreen(player.x,.957);
  ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=4;ctx.font=`900 ${Math.min(34,Math.max(21,W*0.04))}px system-ui`;ctx.textAlign='center';
  const text=`${player.troops}`;ctx.strokeText(text,label.x,label.y);ctx.fillText(text,label.x,label.y);
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
function pointerMove(clientX){ const laneFrac = laneHalfWidth(0.88) / W; const nx = (clientX / W - 0.5) / laneFrac; player.targetX = clamp(nx, -0.78, 0.78); }
canvas.addEventListener('pointerdown', e => { controlsActive = true; pointerMove(e.clientX); });
canvas.addEventListener('pointermove', e => { if(controlsActive || e.pointerType === 'mouse') pointerMove(e.clientX); });
addEventListener('pointerup', () => { controlsActive = false; });
playBtn.onclick = () => resetRun(); retryBtn.onclick = () => resetRun(); pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? '▶' : '❚❚'; };

if(navigator.webdriver){
  globalThis.__blastlineTest={
    setTroops(value){player.troops=clamp(Math.round(value),1,999);updateHud();return visibleSquadCount(player.troops);},
    setPower(value){player.power=Math.max(1,Number(value)||1);updateHud();},
    applyGate(kind,value){player=applyGate(player,{kind,value});updateHud();return player.troops;},
    benchmarkDraw(iterations=120){const n=clamp(Math.round(iterations),1,1000),start=performance.now();for(let i=0;i<n;i++)draw();return (performance.now()-start)/n;},
    getState(){return {state,paused,wave:wave+1,troops:player.troops,visibleSquad:visibleSquadCount(player.troops),playerX:player.x,bullets:bullets.length,sampleBullet:bullets[0]?{x:bullets[0].x,y:bullets[0].y,targetX:bullets[0].targetX,shooter:bullets[0].shooter}:null,enemies:enemies.length,gates:gates.map(g=>({x:g.x,y:g.y,kind:g.kind,value:g.value,hit:!!g.hit})),muzzleFlashes:muzzleFlashes.length,boss:boss?{x:boss.x,y:boss.y,hp:boss.hp}:null};}
  };
}

function loop(ts){ const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; update(dt); draw(); requestAnimationFrame(loop); }

await loadAssets();
updateHud();
setState('menu');
requestAnimationFrame(loop);
