import {
  ACTIVE_STATES,
  GAME_STATE,
  LEVELS,
  applyGate,
  applyTroopDamage,
  applyUpgrade,
  claimKillReward,
  clamp,
  createCleanRun,
  format,
  gateText,
  initialPlayer,
  lerp,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  pickUpgradeSet,
  resolveGateEncounter,
  squadColumnCount,
  stateAfterBossDefeat,
  stateAfterTroopDamage,
  visibleSquadCount,
} from './core.mjs';
import { drawEnemyCombatant } from './enemy-render.mjs';
import { drawBlueSoldier, drawBossCombatant } from './production-render.mjs';

const RUNTIME_ASSET_PATHS = Object.freeze({
  homeHero: 'assets/blastline/characters/home-hero.webp',
  playerRun1: 'assets/blastline/characters/player-run-1.webp',
  playerRun2: 'assets/blastline/characters/player-run-2.webp',
  playerRun3: 'assets/blastline/characters/player-run-3.webp',
  playerRun4: 'assets/blastline/characters/player-run-4.webp',
  enemyGrunt: 'assets/blastline/characters/enemy-grunt.webp',
  enemyElite: 'assets/blastline/characters/enemy-elite.webp',
  enemySpecial: 'assets/blastline/characters/enemy-special.webp',
  boss: 'assets/blastline/characters/boss.webp',
});

const runtimeAssets = Object.create(null);

function loadImage(path) {
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

async function loadRuntimeAssets() {
  const entries = await Promise.all(Object.entries(RUNTIME_ASSET_PATHS).map(async ([name, path]) => [name, await loadImage(path)]));
  for (const [name, image] of entries) runtimeAssets[name] = image;
  const missing = entries.filter(([, image]) => !image).map(([name]) => name);
  canvas.dataset.assetsReady = missing.length ? 'partial' : 'true';
  if (missing.length) console.warn(`BLASTLINE runtime art unavailable: ${missing.join(', ')}`);
}

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const floatingStats = document.querySelector('#floatingStats');
const bossHud = document.querySelector('#bossHud');
const upgradePanel = document.querySelector('#upgradePanel');
const gameOverPanel = document.querySelector('#gameOverPanel');
const victoryPanel = document.querySelector('#victoryPanel');
const pausePanel = document.querySelector('#pausePanel');
const continueBtn = document.querySelector('#continueBtn');
const victoryHomeBtn = document.querySelector('#victoryHomeBtn');
const victoryScore = document.querySelector('#victoryScore');
const victoryBest = document.querySelector('#victoryBest');
const victoryCoins = document.querySelector('#victoryCoins');
const playBtn = document.querySelector('#playBtn');
const retryBtn = document.querySelector('#retryBtn');
const gameOverHomeBtn = document.querySelector('#gameOverHomeBtn');
const pauseBtn = document.querySelector('#pauseBtn');
const resumeBtn = document.querySelector('#resumeBtn');
const pauseHomeBtn = document.querySelector('#pauseHomeBtn');
const waveLabel = document.querySelector('#waveLabel');
const waveName = document.querySelector('#waveName');
const waveProgress = document.querySelector('#waveProgress');
const troopsLabel = document.querySelector('#troopsLabel');
const powerLabel = document.querySelector('#powerLabel');
const armorLabel = document.querySelector('#armorLabel');
const coinLabel = document.querySelector('#coinLabel');
const scoreLabel = document.querySelector('#scoreLabel');
const homeBest = document.querySelector('#homeBest');
const homeCoins = document.querySelector('#homeCoins');
const finalScore = document.querySelector('#finalScore');
const finalWave = document.querySelector('#finalWave');
const finalBest = document.querySelector('#finalBest');
const finalCoins = document.querySelector('#finalCoins');
const bossName = document.querySelector('#bossName');
const bossHealthText = document.querySelector('#bossHealthText');
const bossHealthFill = document.querySelector('#bossHealthFill');
const upgradeCards = document.querySelector('#upgradeCards');

let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2);
let state = GAME_STATE.HOME;
let resumeState = null;
let last = 0;
let rng = Math.random;
let player = initialPlayer();
let bullets = [], enemyBullets = [], enemies = [], gates = [], particles = [], floaters = [], muzzleFlashes = [], telegraphs = [];
let shotSerial = 0;
let gateSerial = 0;
let wave = 0, waveTime = 0, bossTime = 0, spawnTimer = 0, gateTimer = 1.8, enemiesSpawned = 0;
let score = 0;
let best = +(localStorage.getItem('blastline-best-score') || localStorage.getItem('blastline-best') || 0);
let lifetimeCoins = +(localStorage.getItem('blastline-lifetime-coins') || 0);
let boss = null, frenzy = 0, frenzyTimer = 0;
let controlsActive = false;
let roadScroll = 0;
let runSeed = Date.now() >>> 0;
let runFinalized = false;

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
  const hudVisible = ACTIVE_STATES.includes(next) || next === GAME_STATE.PAUSED;
  const bossVisible = next === GAME_STATE.BOSS || (next === GAME_STATE.PAUSED && resumeState === GAME_STATE.BOSS);
  menu.classList.toggle('visible', next === GAME_STATE.HOME);
  pausePanel.classList.toggle('visible', next === GAME_STATE.PAUSED);
  upgradePanel.classList.toggle('visible', next === GAME_STATE.UPGRADE);
  gameOverPanel.classList.toggle('visible', next === GAME_STATE.GAME_OVER);
  victoryPanel.classList.toggle('visible', next === GAME_STATE.VICTORY);
  hud.classList.toggle('hidden', !hudVisible);
  floatingStats.classList.toggle('hidden', !hudVisible);
  bossHud.classList.toggle('hidden', !bossVisible || !boss);
  pauseBtn.textContent = next === GAME_STATE.PAUSED ? '▶' : '❚❚';
  pauseBtn.setAttribute('aria-label', next === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
}

function resetRun(seed = Date.now() >>> 0){
  const fresh = createCleanRun(seed);
  runSeed = fresh.seed;
  rng = mulberry32(runSeed);
  player = fresh.player;
  bullets = fresh.bullets;
  enemyBullets = fresh.enemyBullets;
  enemies = fresh.enemies;
  gates = fresh.gates;
  particles = fresh.particles;
  floaters = fresh.floaters;
  muzzleFlashes = fresh.muzzleFlashes;
  telegraphs = fresh.telegraphs;
  score = fresh.score;
  wave = fresh.waveIndex;
  waveTime = fresh.waveTime;
  bossTime = fresh.bossTime;
  spawnTimer = fresh.spawnTimer;
  gateTimer = fresh.gateTimer;
  enemiesSpawned = fresh.enemiesSpawned;
  boss = fresh.boss;
  frenzy = fresh.frenzy;
  frenzyTimer = fresh.frenzyTimer;
  resumeState = null;
  roadScroll = 0;
  gateSerial = 0;
  shotSerial = 0;
  runFinalized = false;
  controlsActive = false;
  for (const key of Object.keys(keys)) keys[key] = false;
  startWave();
}

function startWave(){
  if (wave < 0 || wave >= LEVELS.length) return;
  waveTime = 0;
  bossTime = 0;
  spawnTimer = 0.5;
  gateTimer = 2.1;
  enemiesSpawned = 0;
  enemies = [];
  gates = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  floaters = [];
  muzzleFlashes = [];
  telegraphs = [];
  boss = null;
  player.targetX = 0;
  player.x = 0;
  player._shot = 0.08;
  setState(GAME_STATE.PLAYING);
  updateHud();
}

function spawnEnemy(type='grunt'){
  const level = LEVELS[wave];
  const lane = [-0.6,-0.3,0,0.3,0.6][Math.floor(rng()*5)];
  const hp = type === 'elite' ? 5 + wave * 2 : type === 'shield' ? 4 + wave * 2 : 1 + Math.floor(wave / 2);
  enemies.push({
    type,
    x: lane + (rng()-.5)*.07,
    y: -0.08 - rng()*0.05,
    hp,
    maxHp: hp,
    shield: type === 'shield' ? 3 + wave : 0,
    speed: (type === 'elite' ? .18 : type === 'shield' ? .19 : .23) * level.speed * (0.9 + rng()*0.18),
    wobble: rng()*6.28,
    bob: rng()*1000,
    shotTimer: 0.9 + rng()*1.8,
    rewarded: false,
  });
  enemiesSpawned += 1;
}

function spawnGatePair(){
  const encounter = makeGateEncounter(++gateSerial, makeGatePair(rng, wave));
  encounter.gates = encounter.gates.map(gate => ({
    ...gate,
    color: gate.kind === 'slow' || (gate.kind === 'troops' && gate.value < 0) ? 'red' : 'blue',
  }));
  for (const gate of encounter.gates) gate.encounter = encounter;
  gates.push(encounter);
}

function spawnBoss(){
  const level = LEVELS[wave];
  enemies = [];
  gates = [];
  bullets = [];
  enemyBullets = [];
  telegraphs = [];
  bossTime = 0;
  boss = {
    x: 0,
    y: -0.14,
    hp: level.bossHp,
    maxHp: level.bossHp,
    speed: 0.12 * level.speed,
    type: 'boss',
    attackTimer: 1.25,
    attackSerial: 0,
    rewarded: false,
  };
  setState(GAME_STATE.BOSS);
  addFloater(0, 0.34, wave === LEVELS.length - 1 ? 'FINAL BOSS' : 'BOSS INBOUND', '#ffd166', 30);
  updateHud();
}

function updateHud(){
  const level = LEVELS[wave] ?? LEVELS[0];
  waveLabel.textContent = `WAVE ${wave+1}/${LEVELS.length}`;
  waveName.textContent = level.name.toUpperCase();
  const progress = state === GAME_STATE.BOSS ? 1 : clamp(waveTime / level.length, 0, 1);
  waveProgress.style.width = `${progress * 100}%`;
  troopsLabel.textContent = format(player.troops);
  powerLabel.textContent = format(player.power);
  armorLabel.textContent = format(player.armor);
  coinLabel.textContent = format(player.coins);
  scoreLabel.textContent = format(score);
  homeBest.textContent = format(best);
  homeCoins.textContent = format(lifetimeCoins);
  if (boss) {
    const hp = Math.max(0, boss.hp);
    bossName.textContent = wave === LEVELS.length - 1 ? 'REDLINE WARLORD' : 'REDLINE COMMANDER';
    bossHealthText.textContent = `${format(hp)} / ${format(boss.maxHp)}`;
    bossHealthFill.style.width = `${clamp(hp / boss.maxHp, 0, 1) * 100}%`;
  }
  canvas.dataset.playerX = player.x.toFixed(3);
  canvas.dataset.wave = String(wave + 1);
  canvas.dataset.troops = String(player.troops);
  canvas.dataset.visibleSquad = String(visibleSquadCount(player.troops));
}

function addFloater(x,y,text,color='#fff',size=22){ floaters.push({x,y,text,color,size,life:1}); }
function burst(x,y,color,count=8){
  const room = Math.max(0, 190 - particles.length);
  for(let i=0;i<Math.min(count, room);i++) particles.push({x,y,vx:(rng()-.5)*0.14,vy:(rng()-.5)*0.18,life:0.45+rng()*0.35,size:2+rng()*5,color});
}

function fireBurst(){
  const n=player.projectiles;
  const spread=n===1?[0]:Array.from({length:n},(_,i)=>lerp(-0.08,0.08,i/(n-1)));
  const boost=frenzyTimer>0?1.25:1;
  const target = boss ?? [...enemies].filter(enemy => !enemy.dead && enemy.y < .84).sort((a,b) => b.y-a.y)[0] ?? null;
  const slots=squadLogicalSlots();
  const frontRow=slots.filter(slot=>slot.row===0);
  const shooterCount=Math.min(frontRow.length,Math.max(n,slots.length>=18?3:slots.length>=6?2:1));
  const shooters=[];
  for(let i=0;i<shooterCount;i++) shooters.push(frontRow[(shotSerial+i)%frontRow.length]);
  for(let i=0;i<spread.length;i++){
    const off=spread[i],slot=shooters[i%shooters.length],world=squadSlotWorld(slot);
    const targetX=(target ? target.x : player.x)+off*.35;
    bullets.push({x:world.x+off*.08,y:world.y-0.052,targetX,vx:off*0.18,vy:-0.95*boost*player.bulletSpeed,power:player.power,shooter:slot.index});
  }
  for(const slot of shooters) muzzleFlashes.push({slot:slot.index,life:.085});
  shotSerial=(shotSerial+1)%Math.max(1,frontRow.length);
}

function sceneHorizon(){ return H * (W < H ? 0.205 : 0.18); }
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

function spawnEnemyProjectile(enemy, targetOffset = 0, options = {}) {
  const speed = options.speed ?? (0.36 + wave * 0.018);
  const startY = enemy.y + (options.startOffset ?? 0.025);
  const travelTime = Math.max(0.35, (0.88 - startY) / speed);
  const targetX = clamp(player.x + targetOffset, -0.84, 0.84);
  enemyBullets.push({
    kind: options.kind ?? 'enemy',
    x: enemy.x,
    y: startY,
    vx: (targetX - enemy.x) / travelTime,
    vy: speed,
    radius: options.radius ?? 0.055,
    damage: options.damage ?? 1,
    color: options.color ?? '#ff6a48',
  });
  enemy.shotFlash = 0.12;
}

function spawnBossAttack() {
  if (!boss) return;
  const pattern = boss.attackSerial % 3;
  boss.attackSerial += 1;
  if (pattern === 0) {
    spawnEnemyProjectile(boss, -0.055, { kind: 'boss-aimed', speed: 0.43 + wave * 0.015, radius: 0.06, color: '#ff8a3d' });
    spawnEnemyProjectile(boss, 0.055, { kind: 'boss-aimed', speed: 0.43 + wave * 0.015, radius: 0.06, color: '#ff8a3d' });
  } else if (pattern === 1) {
    const speed = 0.40 + wave * 0.015;
    for (const vx of [-0.34, -0.17, 0, 0.17, 0.34]) {
      enemyBullets.push({ kind: 'boss-spread', x: boss.x, y: boss.y + 0.035, vx, vy: speed, radius: 0.052, damage: 1, color: '#ff4f4f' });
    }
    boss.shotFlash = 0.14;
  } else {
    const lanes = [-0.54, 0, 0.54];
    telegraphs.push({ x: lanes[Math.floor(rng() * lanes.length)], time: 0.78, maxTime: 0.78 });
  }
}

function damageSquad(amount, x, y = 0.84) {
  const result = applyTroopDamage(player, amount);
  player = result.player;
  if (result.absorbed) addFloater(x, y, result.lost ? `ARMOR −${result.absorbed}` : 'BLOCKED', '#aeeaff', 18);
  if (result.lost) addFloater(x, y - 0.025, `−${result.lost}`, '#ff8d8d', 24);
  burst(x, y, result.lost ? '#ff5757' : '#71d9ff', result.lost ? 10 : 6);
  updateHud();
  if (stateAfterTroopDamage(player, state) === GAME_STATE.GAME_OVER) {
    gameOver();
    return true;
  }
  return false;
}

function defeatEnemy(enemy) {
  enemy.dead = true;
  enemy.deathMax = enemy.type === 'grunt' ? 0.22 : 0.3;
  enemy.deathLife = enemy.deathMax;
  const claim = claimKillReward(enemy);
  Object.assign(enemy, claim.enemy);
  if (!claim.reward) return;
  score += claim.reward.score;
  player.coins += claim.reward.coins;
  frenzy += claim.reward.frenzy;
  if (frenzy >= 12) {
    frenzy = 0;
    frenzyTimer = 4.5;
    addFloater(0, 0.5, 'FRENZY!', '#77ddff', 32);
  }
}

function finishBoss() {
  if (!boss || boss.rewarded) return;
  boss.rewarded = true;
  score += 1200 + wave * 500;
  player.coins += 50 + wave * 20;
  burst(boss.x, boss.y, '#ffc44d', 46);
  addFloater(boss.x, boss.y + 0.08, 'BOSS DOWN', '#ffe08a', 34);
  bullets = [];
  enemyBullets = [];
  telegraphs = [];
  enemies = [];
  gates = [];
  const next = stateAfterBossDefeat(wave);
  boss = null;
  if (next === GAME_STATE.VICTORY) victory();
  else {
    setState(GAME_STATE.UPGRADE);
    showUpgrades();
  }
  updateHud();
}

function update(dt){
  if (!ACTIVE_STATES.includes(state)) return;
  const level = LEVELS[wave];
  roadScroll += dt * 220 * level.speed;
  if (state === GAME_STATE.PLAYING) waveTime += dt;
  else bossTime += dt;
  if (frenzyTimer > 0) frenzyTimer = Math.max(0, frenzyTimer - dt);

  const moveByKeys = (keys.ArrowLeft || keys.a || keys.A ? -1 : 0) + (keys.ArrowRight || keys.d || keys.D ? 1 : 0);
  if (moveByKeys) player.targetX = clamp(player.targetX + moveByKeys * dt * player.speed, -0.78, 0.78);
  const previousX = player.x;
  player.x = lerp(player.x, player.targetX, Math.min(1, dt * 8));
  const visualVx = dt > 0 ? (player.x - previousX) / dt : 0;
  player._visualLean = lerp(player._visualLean || 0, clamp(visualVx * 0.045, -0.08, 0.08), Math.min(1, dt * 12));

  player._shot = (player._shot || 0) - dt;
  const cadence = 1 / (player.fireRate * (frenzyTimer > 0 ? 1.45 : 1));
  if (player._shot <= 0) {
    player._shot = cadence;
    fireBurst();
  }

  if (state === GAME_STATE.PLAYING) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && enemiesSpawned < level.enemies && gates.length === 0) {
      const roll = rng();
      const shieldChance = wave >= 2 ? 0.055 + wave * 0.012 : 0;
      const eliteChance = 0.18 + wave * 0.05;
      spawnEnemy(roll < shieldChance ? 'shield' : roll < shieldChance + eliteChance ? 'elite' : 'grunt');
      if (enemiesSpawned < level.enemies && rng() < 0.3 + wave * 0.04) spawnEnemy('grunt');
      spawnTimer = level.spawn * (0.8 + rng() * 0.35);
    }

    gateTimer -= dt;
    const gateSpaceClear = gates.length === 0 && !enemies.some(enemy => !enemy.dead && enemy.y < 0.28);
    if (gateTimer <= 0 && waveTime < level.length - 6 && gateSpaceClear) {
      spawnGatePair();
      gateTimer = 5.2 - Math.min(1.5, wave * 0.18) + rng() * 1.0;
    }
    if (waveTime >= level.length) {
      spawnBoss();
      return;
    }
  }

  for (const encounter of gates) encounter.y += dt * 0.19 * level.speed;
  for (const enemy of enemies) {
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (enemy.shotFlash > 0) enemy.shotFlash = Math.max(0, enemy.shotFlash - dt);
    if (enemy.dead) {
      enemy.deathLife = Math.max(0, (enemy.deathLife || 0) - dt);
      enemy.y -= dt * 0.018;
      continue;
    }
    enemy.y += dt * enemy.speed;
    enemy.x += Math.sin((waveTime * 2) + enemy.wobble) * 0.0016;
    if (wave >= 2 && enemy.y > 0.1 && enemy.y < 0.62 && enemyBullets.length < 9 + wave) {
      enemy.shotTimer -= dt;
      if (enemy.shotTimer <= 0) {
        spawnEnemyProjectile(enemy, (rng() - 0.5) * 0.08, { speed: enemy.type === 'grunt' ? 0.34 + wave * 0.012 : 0.39 + wave * 0.014 });
        enemy.shotTimer = (enemy.type === 'grunt' ? 2.7 : 1.9) + rng() * 1.4;
      }
    }
  }

  if (boss) {
    boss.y = Math.min(0.45, boss.y + dt * boss.speed);
    if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    if (boss.shotFlash > 0) boss.shotFlash = Math.max(0, boss.shotFlash - dt);
    if (boss.y >= 0.445) {
      boss.attackTimer -= dt;
      if (boss.attackTimer <= 0) {
        spawnBossAttack();
        boss.attackTimer = Math.max(0.86, 1.65 - wave * 0.1) + rng() * 0.24;
      }
    }
  }

  for (const warning of telegraphs) {
    warning.time -= dt;
    if (warning.time <= 0 && !warning.fired) {
      warning.fired = true;
      enemyBullets.push({
        kind: 'lane', x: warning.x, y: boss ? boss.y + 0.04 : 0.26, vx: 0, vy: 0.5 + wave * 0.015,
        radius: 0.13, damage: wave >= 4 ? 2 : 1, color: '#ffb13b',
      });
    }
  }

  for (const bullet of bullets) {
    if (Number.isFinite(bullet.targetX)) bullet.x = lerp(bullet.x, bullet.targetX, Math.min(1, dt * 11));
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  for (const bullet of enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }

  for (const encounter of gates) {
    if (!encounter.resolved && encounter.y > 0.84) {
      const result = resolveGateEncounter(encounter, player.x);
      Object.assign(encounter, result.encounter);
      if (result.gate) {
        player = applyGate(player, result.gate);
        const good = result.gate.color !== 'red';
        addFloater(result.gate.x, 0.82, gateText(result.gate), good ? '#8fe8ff' : '#ff8080', 27);
        burst(result.gate.x, encounter.y, good ? '#44d4ff' : '#ff4d57', 18);
      } else {
        addFloater(0, 0.82, 'NO GATE', '#d7e6ed', 17);
      }
      updateHud();
    }
  }

  for (const bullet of bullets) {
    if (bullet.dead) continue;
    if (boss) {
      const dx = bullet.x - boss.x;
      const dy = bullet.y - boss.y;
      if (Math.abs(dx) < 0.115 && Math.abs(dy) < 0.095) {
        bullet.dead = true;
        boss.hp -= bullet.power;
        boss.hitFlash = 0.1;
        burst(boss.x + dx * 0.4, boss.y + dy * 0.4, '#ffb052', 3);
        score += 2;
        if (boss.hp <= 0) {
          finishBoss();
          return;
        }
      }
    }
    for (const enemy of enemies) {
      if (enemy.dead || bullet.dead) continue;
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const hitRadius = enemy.type === 'grunt' ? 0.018 : 0.03;
      if (dx * dx + dy * dy < hitRadius * hitRadius) {
        let damage = bullet.power;
        if (enemy.shield > 0) {
          const absorbed = Math.min(enemy.shield, damage);
          enemy.shield -= absorbed;
          damage -= absorbed;
          burst(enemy.x, enemy.y, '#6fe6ff', 5);
        }
        enemy.hp -= damage;
        enemy.hitFlash = 0.09;
        bullet.dead = true;
        burst(enemy.x, enemy.y, enemy.type === 'grunt' ? '#ff6868' : '#ffb35a', enemy.type === 'grunt' ? 3 : 6);
        if (enemy.hp <= 0) defeatEnemy(enemy);
      }
    }
  }

  for (const enemy of enemies) {
    if (!enemy.dead && enemy.y > 0.86) {
      enemy.dead = true;
      enemy.deathMax = 0.18;
      enemy.deathLife = enemy.deathMax;
      const contactRadius = enemy.type === 'elite' ? 0.3 : enemy.type === 'shield' ? 0.27 : 0.22;
      if (Math.abs(enemy.x - player.x) < contactRadius) {
        const loss = enemy.type === 'elite' ? 4 : enemy.type === 'shield' ? 3 : 1;
        if (damageSquad(loss, enemy.x)) return;
      }
    }
  }

  for (const bullet of enemyBullets) {
    if (bullet.dead || bullet.y < 0.82) continue;
    if (Math.abs(bullet.x - player.x) < bullet.radius) {
      bullet.dead = true;
      if (damageSquad(bullet.damage, bullet.x)) return;
    } else if (bullet.y > 1.02) bullet.dead = true;
  }

  bullets = bullets.filter(bullet => !bullet.dead && bullet.y > -0.12);
  enemyBullets = enemyBullets.filter(bullet => !bullet.dead && bullet.y < 1.06 && Math.abs(bullet.x) < 1.25);
  enemies = enemies.filter(enemy => enemy.dead ? (enemy.deathLife || 0) > 0 : enemy.y < 1.02);
  gates = gates.filter(encounter => encounter.y < 1.03);
  telegraphs = telegraphs.filter(warning => !warning.fired);
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
  }
  particles = particles.filter(particle => particle.life > 0);
  for (const floater of floaters) {
    floater.y -= dt * 0.06;
    floater.life -= dt;
  }
  floaters = floaters.filter(floater => floater.life > 0);
  for (const flash of muzzleFlashes) flash.life -= dt;
  muzzleFlashes = muzzleFlashes.filter(flash => flash.life > 0);

  updateHud();
}

function showUpgrades(){
  const upgrades = pickUpgradeSet(rng);
  upgradeCards.innerHTML = '';
  for(const item of upgrades){
    const btn = document.createElement('button');
    btn.className = `upgrade-card tone-${item.tone}`;
    btn.type = 'button';
    btn.dataset.upgrade = item.id;
    const icon = document.createElement('img');
    icon.className = 'upgrade-icon';
    icon.src = item.asset;
    icon.alt = '';
    const title = document.createElement('b');
    title.textContent = item.title;
    const description = document.createElement('span');
    description.textContent = item.desc;
    btn.append(icon, title, description);
    btn.onclick = () => {
      if (state !== GAME_STATE.UPGRADE) return;
      player = applyUpgrade(player, item.id);
      wave += 1;
      startWave();
      updateHud();
    };
    upgradeCards.append(btn);
  }
}

function finalizeRun(){
  if (runFinalized) return;
  runFinalized = true;
  best = Math.max(best, score);
  lifetimeCoins += player.coins;
  localStorage.setItem('blastline-best-score', String(best));
  localStorage.setItem('blastline-lifetime-coins', String(lifetimeCoins));
}

function victory(){
  enemyBullets = [];
  telegraphs = [];
  finalizeRun();
  victoryScore.textContent = format(score);
  victoryCoins.textContent = format(player.coins);
  victoryBest.textContent = format(best);
  setState(GAME_STATE.VICTORY);
  updateHud();
}

function gameOver(){
  player.troops = 0;
  finalizeRun();
  finalScore.textContent = format(score);
  finalWave.textContent = `${wave+1}/${LEVELS.length}`;
  finalCoins.textContent = format(player.coins);
  finalBest.textContent = format(best);
  setState(GAME_STATE.GAME_OVER);
  updateHud();
}

function returnHome(){
  player = initialPlayer();
  wave = 0;
  waveTime = 0;
  bossTime = 0;
  boss = null;
  bullets = [];
  enemyBullets = [];
  enemies = [];
  gates = [];
  particles = [];
  floaters = [];
  muzzleFlashes = [];
  telegraphs = [];
  resumeState = null;
  controlsActive = false;
  roadScroll = 0;
  setState(GAME_STATE.HOME);
  updateHud();
}

function pauseGame(){
  if (!ACTIVE_STATES.includes(state)) return;
  resumeState = state;
  setState(GAME_STATE.PAUSED);
}

function resumeGame(){
  if (state !== GAME_STATE.PAUSED || !ACTIVE_STATES.includes(resumeState)) return;
  const next = resumeState;
  resumeState = null;
  setState(next);
  last = performance.now();
}

function drawBackground(){
  const horizon = sceneHorizon();
  const deckBottom = Math.min(H * 1.02, perspectiveY(1));
  const bridgeRed = '#e34a40';
  const bridgeRedDark = '#a52b2c';
  const bridgeRedDeep = '#711f25';
  const bridgeRedLight = '#f47a61';

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
    return lerp(H*0.115, Math.min(H*0.285,224), t);
  }
  function towerX(side,y){ return sidePoint(side,y,1.045).x; }

  // Sky: bright, slightly hazy toward the water line.
  const sky = ctx.createLinearGradient(0,0,0,horizon + H*0.08);
  sky.addColorStop(0,'#70c9ee');
  sky.addColorStop(.56,'#9edcf1');
  sky.addColorStop(1,'#d9eef1');
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,W,horizon + H*0.08);

  // Ocean: one continuous body of water, with a real horizon instead of blue wedges to the top edge.
  const water = ctx.createLinearGradient(0,horizon,0,H);
  water.addColorStop(0,'#55c1dd');
  water.addColorStop(.28,'#28acd2');
  water.addColorStop(1,'#087da9');
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
  shoulderGrad.addColorStop(0,'#b9c0bf');
  shoulderGrad.addColorStop(1,'#8e999b');
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
  roadGrad.addColorStop(0,'#616a6e');
  roadGrad.addColorStop(.52,'#4d565b');
  roadGrad.addColorStop(1,'#343d43');
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

  const towers=[0.09,0.405];
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

function drawHomeHero(){
  const image = runtimeAssets.homeHero;
  if (!image) return;
  const portrait = W < H;
  const h = portrait ? Math.min(H * .28, 260) : Math.min(H * .73, 575);
  const x = portrait ? W * .22 : W * .235;
  const y = portrait ? H * .99 : H * .995;
  const w = h * image.width / image.height;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 40, 52, .24)';
  ctx.beginPath();ctx.ellipse(x, y - h * .005, w * .38, h * .035, 0, 0, Math.PI * 2);ctx.fill();
  drawSprite(image, x, y, h);
  ctx.restore();
}

function gateVisual(gate){
  const y = gate.encounter?.y ?? gate.y;
  const resolved = gate.encounter?.resolved ?? gate.hit;
  const center=worldToScreen(gate.x,y);
  const left=worldToScreen(gate.x-gate.w/2,y);
  const right=worldToScreen(gate.x+gate.w/2,y);
  const panelW=Math.max(18,right.x-left.x);
  const depth=clamp((y+.04)/1.04,0,1);
  const panelH=Math.min(H*.105,Math.max(21,panelW*.72));
  const frameH=panelH*1.42;
  const deckY=center.y;
  const topY=deckY-frameH;
  const panelTop=topY+frameH*.13;
  const panelBottom=deckY-frameH*.12;
  const postW=clamp(panelW*.085,6,17);
  const railH=clamp(panelH*.125,4,11);
  const extrusion=clamp(lerp(1.4,6.5,Math.pow(depth,.8)),1.4,7);
  const fade=resolved?clamp((1.03-y)/.18,0,1):1;
  return {center,left,right,panelW,panelH,frameH,deckY,topY,panelTop,panelBottom,postW,railH,extrusion,depth,fade};
}

function drawGateBody(gate){
  const g=gateVisual(gate);
  if(g.fade<=0)return;
  const isRed=gate.color==='red';
  const main=isRed?'#f14549':'#168ee8';
  const bright=isRed?'#ff6d68':'#37c7ff';
  const dark=isRed?'#921d27':'#07538f';
  const deep=isRed?'#651620':'#06365e';
  const fillA=isRed?'rgba(241,54,63,.72)':'rgba(15,151,235,.72)';
  const fillB=isRed?'rgba(255,112,104,.48)':'rgba(62,207,255,.46)';
  const glow=isRed?'rgba(255,67,72,.38)':'rgba(37,196,255,.40)';
  const x0=g.left.x,x1=g.right.x;
  const panelY=g.panelTop,panelH=g.panelBottom-g.panelTop;
  ctx.save();ctx.globalAlpha=g.fade;

  for(const x of [x0,x1]){
    ctx.fillStyle='rgba(36,43,48,.34)';
    ctx.beginPath();ctx.ellipse(x,g.deckY+g.railH*.46,g.postW*.86,g.railH*.52,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=deep;
    ctx.beginPath();ctx.roundRect(x-g.postW*.78,g.deckY-g.railH*.12,g.postW*1.56,g.railH*.72,g.railH*.18);ctx.fill();
  }
  ctx.fillStyle=deep;
  ctx.beginPath();ctx.moveTo(x0-g.postW*.55,g.topY+g.extrusion);ctx.lineTo(x0+g.postW*.55,g.topY);ctx.lineTo(x0+g.postW*.55,g.deckY);ctx.lineTo(x0-g.postW*.55,g.deckY+g.extrusion);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(x1-g.postW*.55,g.topY);ctx.lineTo(x1+g.postW*.55,g.topY+g.extrusion);ctx.lineTo(x1+g.postW*.55,g.deckY+g.extrusion);ctx.lineTo(x1-g.postW*.55,g.deckY);ctx.closePath();ctx.fill();
  ctx.shadowColor=glow;ctx.shadowBlur=Math.min(12,lerp(3,10,g.depth));
  const fill=ctx.createLinearGradient(0,panelY,0,g.panelBottom);
  fill.addColorStop(0,fillA);fill.addColorStop(.48,fillB);fill.addColorStop(1,fillA);
  ctx.fillStyle=fill;ctx.fillRect(x0+g.postW*.48,panelY,x1-x0-g.postW*.96,panelH);ctx.shadowBlur=0;
  const shine=ctx.createLinearGradient(x0,0,x1,0);
  shine.addColorStop(0,'rgba(255,255,255,.10)');shine.addColorStop(.48,'rgba(255,255,255,.25)');shine.addColorStop(1,'rgba(255,255,255,.08)');
  ctx.fillStyle=shine;ctx.fillRect(x0+g.postW*.8,panelY+g.railH*.65,x1-x0-g.postW*1.6,Math.max(1.2,g.railH*.18));
  for(const x of [x0,x1]){
    const pg=ctx.createLinearGradient(x-g.postW/2,0,x+g.postW/2,0);
    pg.addColorStop(0,dark);pg.addColorStop(.38,main);pg.addColorStop(.68,bright);pg.addColorStop(1,dark);
    ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(x-g.postW/2,g.topY,g.postW,g.frameH,g.postW*.22);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.46)';ctx.fillRect(x-g.postW*.20,g.topY+g.railH*.55,Math.max(1,g.postW*.14),g.frameH*.67);
  }
  ctx.fillStyle=dark;ctx.fillRect(x0-g.postW*.22,g.topY,x1-x0+g.postW*.44,g.railH);
  ctx.fillStyle=main;ctx.fillRect(x0,g.topY,x1-x0,g.railH*.62);
  ctx.fillStyle=dark;ctx.fillRect(x0+g.postW*.15,g.panelBottom-g.railH*.42,x1-x0-g.postW*.30,g.railH*.78);
  ctx.fillStyle=bright;ctx.globalAlpha=g.fade*.72;ctx.fillRect(x0+g.postW*.32,g.topY+g.railH*.16,x1-x0-g.postW*.64,Math.max(1,g.railH*.16));ctx.globalAlpha=g.fade;
  const text=gateText(gate);
  let fontSize=clamp(panelH*.48,11,38);
  const textWidthLimit=Math.max(24,g.panelW-g.postW*2.35);
  ctx.font=`950 ${fontSize}px system-ui`;
  while(fontSize>10&&ctx.measureText(text).width>textWidthLimit){fontSize-=1;ctx.font=`950 ${fontSize}px system-ui`;}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=clamp(fontSize*.15,2,5);ctx.strokeStyle='rgba(22,28,35,.72)';ctx.fillStyle='#fff';
  const textY=panelY+panelH*.53;ctx.strokeText(text,g.center.x,textY);ctx.fillText(text,g.center.x,textY);ctx.restore();
}

function drawGateForeground(){
  for(const encounter of gates){
    if(encounter.y<.77||encounter.y>.98)continue;
    for (const gate of encounter.gates) {
      const g=gateVisual(gate);if(g.fade<=0)continue;
      const isRed=gate.color==='red',main=isRed?'#f14549':'#168ee8',dark=isRed?'#921d27':'#07538f';
      ctx.save();ctx.globalAlpha=g.fade*.94;
      for(const x of [g.left.x,g.right.x]){ctx.fillStyle=dark;ctx.beginPath();ctx.roundRect(x-g.postW/2,g.topY,g.postW,g.frameH,g.postW*.22);ctx.fill();ctx.fillStyle=main;ctx.fillRect(x-g.postW*.23,g.topY+g.railH*.6,g.postW*.46,g.frameH*.63);}
      ctx.fillStyle=dark;ctx.fillRect(g.left.x-g.postW*.22,g.topY,g.right.x-g.left.x+g.postW*.44,g.railH);
      ctx.fillStyle=main;ctx.fillRect(g.left.x,g.topY,g.right.x-g.left.x,g.railH*.58);ctx.restore();
    }
  }
}

function drawGates(){
  const ordered=[...gates].sort((a,b)=>a.y-b.y);
  for(const encounter of ordered) for (const gate of encounter.gates) drawGateBody(gate);
}
function enemyHeightAt(y,type='grunt'){
  const y0=clamp(y,-.02,.98);
  const y1=clamp(y0+.078,0,1.04);
  const projected=Math.abs(perspectiveY(y1)-perspectiveY(y0));
  const base=clamp(projected,18,80);
  return base*(type==='elite'?1.45:type==='shield'?1.36:1.08);
}
function bossHeightAt(y){return clamp(enemyHeightAt(y,'elite')*4.8,150,Math.min(280,H*.35,W*.62));}

function enemySprite(type){
  if(type==='elite') return runtimeAssets.enemyElite;
  if(type==='shield') return runtimeAssets.enemySpecial;
  return runtimeAssets.enemyGrunt;
}

function drawEnemySprite(enemy, scr, h, fade, drift){
  const image=enemySprite(enemy.type);
  if(!image){
    ctx.save();ctx.globalAlpha=fade;drawEnemyCombatant(ctx,enemy,{x:scr.x+(enemy.x>=0?drift:-drift),y:scr.y+drift*.28},h,waveTime);ctx.restore();
    return;
  }
  const run=Math.sin(waveTime*(enemy.type==='grunt'?10:8)+(enemy.bob||0)*.017);
  const x=scr.x+(enemy.x>=0?drift:-drift), y=scr.y+run*h*.012+drift*.28;
  ctx.save();ctx.translate(x,y);ctx.rotate((1-fade)*(enemy.x>=0?.16:-.16));ctx.globalAlpha=fade;
  ctx.fillStyle='rgba(28,22,26,.28)';ctx.beginPath();ctx.ellipse(0,2,h*.24,h*.055,0,0,Math.PI*2);ctx.fill();
  drawSprite(image,0,0,h);
  if(enemy.hitFlash>0){ctx.globalAlpha=fade*clamp(enemy.hitFlash/.09,0,1)*.42;ctx.globalCompositeOperation='screen';ctx.filter='brightness(2.1) saturate(.35)';drawSprite(image,0,0,h);}
  ctx.restore();
  if(enemy.shotFlash>0){
    const alpha=clamp(enemy.shotFlash/.12,0,1),mx=x+h*(enemy.type==='grunt'?.23:.30),my=y-h*.42;
    ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor='#ff9b37';ctx.shadowBlur=h*.15;ctx.fillStyle='#fff0a5';ctx.beginPath();ctx.arc(mx,my,h*.045,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

function drawBossSprite(scr,h){
  const image=runtimeAssets.boss;
  if(!image){drawBossCombatant(ctx,scr,h,boss.hitFlash||0,bossTime);return;}
  const bob=Math.sin(bossTime*3.4)*h*.008;
  ctx.save();ctx.translate(scr.x,scr.y+bob);
  ctx.fillStyle='rgba(25,22,27,.34)';ctx.beginPath();ctx.ellipse(0,4,h*.34,h*.075,0,0,Math.PI*2);ctx.fill();
  drawSprite(image,0,0,h);
  if(boss.hitFlash>0){ctx.globalAlpha=clamp(boss.hitFlash/.1,0,1)*.48;ctx.globalCompositeOperation='screen';ctx.filter='brightness(2.2) saturate(.45)';drawSprite(image,0,0,h);}
  ctx.restore();
}

function drawEnemies(){
  enemies.sort((a,b)=>a.y-b.y);
  for(const e of enemies){
    const scr=worldToScreen(e.x,e.y),h=enemyHeightAt(e.y,e.type);const fade=e.dead?clamp((e.deathLife||0)/(e.deathMax||.22),0,1):1,drift=e.dead?(1-fade)*h*.12:0;
    drawEnemySprite(e,scr,h,fade,drift);
    if(!e.dead && e.type!=='grunt' && (e.hp<e.maxHp || e.shield>0)){
      const bw=Math.max(18,h*.58),bh=Math.max(2.5,h*.055),x=scr.x-bw/2,y=scr.y-h*1.04;
      ctx.fillStyle='rgba(19,20,25,.72)';ctx.fillRect(x,y,bw,bh);
      ctx.fillStyle=e.type==='shield'&&e.shield>0?'#55dfff':'#ff6a55';ctx.fillRect(x,y,bw*clamp((e.hp+(e.shield||0))/(e.maxHp+(e.type==='shield'?3+wave:0)),0,1),bh);
    }
  }
  if(boss){
    const scr=worldToScreen(boss.x,boss.y),h=bossHeightAt(boss.y);drawBossSprite(scr,h);
    if(boss.shotFlash>0){
      const alpha=clamp(boss.shotFlash/.14,0,1),mx=scr.x+h*.31,my=scr.y-h*.47;
      ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor='#ffb53f';ctx.shadowBlur=h*.12;ctx.fillStyle='#fff2a8';ctx.beginPath();ctx.arc(mx,my,h*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff7b2f';ctx.beginPath();ctx.moveTo(mx,my-h*.09);ctx.lineTo(mx+h*.14,my);ctx.lineTo(mx,my+h*.07);ctx.closePath();ctx.fill();ctx.restore();
    }
  }
}

function drawTelegraphs(){
  for(const warning of telegraphs){
    const pulse=.35+.35*Math.sin((warning.time||0)*24),half=.13;
    const farL=worldToScreen(warning.x-half,boss?.y??.24),farR=worldToScreen(warning.x+half,boss?.y??.24);
    const nearL=worldToScreen(warning.x-half,.98),nearR=worldToScreen(warning.x+half,.98);
    ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#ff3b35';ctx.beginPath();ctx.moveTo(farL.x,farL.y);ctx.lineTo(farR.x,farR.y);ctx.lineTo(nearR.x,nearR.y);ctx.lineTo(nearL.x,nearL.y);ctx.closePath();ctx.fill();
    ctx.globalAlpha=.78;ctx.strokeStyle='#ffd15a';ctx.lineWidth=2;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo((farL.x+farR.x)/2,farL.y);ctx.lineTo((nearL.x+nearR.x)/2,nearL.y);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
}

function drawEnemyBullets(){
  for(const bullet of enemyBullets){
    const scr=worldToScreen(bullet.x,bullet.y),depth=clamp(bullet.y,0,1),size=lerp(2.2,6.2,depth)*(bullet.kind==='lane'?1.3:1);
    ctx.save();ctx.shadowColor=bullet.color;ctx.shadowBlur=size*2.2;ctx.strokeStyle=bullet.color;ctx.lineWidth=Math.max(2,size*.62);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(scr.x,scr.y);ctx.lineTo(scr.x-bullet.vx*38,scr.y-size*3.8);ctx.stroke();ctx.fillStyle='#fff1c7';ctx.beginPath();ctx.arc(scr.x,scr.y,size*.45,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

function drawBullets(){
  for(const b of bullets){
    const scr = worldToScreen(b.x, b.y);
    const len = 28; ctx.save(); ctx.shadowColor='#55d9ff'; ctx.shadowBlur=7; ctx.strokeStyle = frenzyTimer>0 ? '#d9f8ff' : '#69ddff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(scr.x, scr.y); ctx.lineTo(scr.x - b.vx*len, scr.y + 14); ctx.stroke();
    ctx.fillStyle = '#f2fdff'; ctx.beginPath(); ctx.arc(scr.x, scr.y, 2.7, 0, Math.PI*2); ctx.fill(); ctx.restore();
  }
}

function drawPlayer(){
  if(player.troops<=0)return;
  const slots=squadLogicalSlots();
  const activeFlashes=new Set(muzzleFlashes.map(flash=>flash.slot));
  for(const slot of slots){
    const world=squadSlotWorld(slot);
    const scr=worldToScreen(world.x,world.y);
    const h=soldierHeightAt(slot.y);
    const frameIndex=((Math.floor(waveTime*10.8+slot.phase)%4)+4)%4;
    const image=runtimeAssets[`playerRun${frameIndex+1}`];
    if(image){
      const bob=Math.sin(waveTime*10.8+slot.phase)*h*.018;
      const shooting=activeFlashes.has(slot.index);
      ctx.save();ctx.translate(scr.x,scr.y+bob+(shooting?h*.014:0));ctx.rotate(player._visualLean||0);
      ctx.fillStyle='rgba(15,35,43,.25)';ctx.beginPath();ctx.ellipse(0,2,h*.20,h*.052,0,0,Math.PI*2);ctx.fill();
      drawSprite(image,0,0,h);
      if(shooting){
        const mx=-h*.26,my=-h*.56;ctx.shadowColor='#56dcff';ctx.shadowBlur=h*.18;ctx.fillStyle='#fff3aa';ctx.beginPath();ctx.arc(mx,my,h*.055,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffbf38';ctx.beginPath();ctx.moveTo(mx-h*.10,my);ctx.lineTo(mx,my-h*.045);ctx.lineTo(mx+h*.055,my);ctx.lineTo(mx,my+h*.045);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }else{
      drawBlueSoldier(ctx,scr,h,waveTime,slot.phase,activeFlashes.has(slot.index),player._visualLean||0);
    }
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
  drawBackground();
  if(state===GAME_STATE.HOME)drawHomeHero();
  else{drawTelegraphs();drawGates();drawEnemies();drawEnemyBullets();drawBullets();drawPlayer();drawGateForeground();drawEffects();}
}

const keys = {};
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight',' ','p','P'].includes(e.key)) e.preventDefault();
  if ((e.key === 'Enter' || e.key === ' ') && state === GAME_STATE.HOME) resetRun();
  if (e.key.toLowerCase() === 'p') state === GAME_STATE.PAUSED ? resumeGame() : pauseGame();
});
addEventListener('keyup', e => { keys[e.key] = false; });
function pointerMove(clientX){
  if (!ACTIVE_STATES.includes(state)) return;
  const laneFrac = laneHalfWidth(0.88) / W;
  const nx = (clientX / W - 0.5) / laneFrac;
  player.targetX = clamp(nx, -0.78, 0.78);
}
canvas.addEventListener('pointerdown', e => { if(ACTIVE_STATES.includes(state)){controlsActive = true;canvas.setPointerCapture?.(e.pointerId);pointerMove(e.clientX);} });
canvas.addEventListener('pointermove', e => { if(controlsActive || (e.pointerType === 'mouse' && ACTIVE_STATES.includes(state))) pointerMove(e.clientX); });
addEventListener('pointerup', () => { controlsActive = false; });
addEventListener('pointercancel', () => { controlsActive = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && ACTIVE_STATES.includes(state)) pauseGame(); });

playBtn.onclick = () => resetRun();
retryBtn.onclick = () => resetRun();
continueBtn.onclick = () => resetRun();
victoryHomeBtn.onclick = returnHome;
gameOverHomeBtn.onclick = returnHome;
pauseHomeBtn.onclick = returnHome;
resumeBtn.onclick = resumeGame;
pauseBtn.onclick = () => state === GAME_STATE.PAUSED ? resumeGame() : pauseGame();

const query = new URLSearchParams(location.search);
const captureMode = query.get('capture');
const qaMode = navigator.webdriver || query.has('qa') || Boolean(captureMode);
let qaFrozen = false;

function setDebugGatePair(left,right,y=.52){
  const specs=[left,right];
  const raw=specs.map(spec=>({kind:spec.kind,value:spec.value,label:()=>spec.text}));
  const encounter=makeGateEncounter(++gateSerial,raw,y);
  encounter.gates=encounter.gates.map((gate,index)=>({...gate,color:specs[index].color||(String(specs[index].text).startsWith('-')||String(specs[index].text).startsWith('−')?'red':'blue')}));
  for(const gate of encounter.gates)gate.encounter=encounter;
  gates=[encounter];
  return encounter;
}

if(qaMode){
  globalThis.__blastlineTest={
    reset(seed=42){resetRun(seed);return this.getState();},
    setTroops(value){player.troops=clamp(Math.round(value),0,999);updateHud();return visibleSquadCount(Math.max(1,player.troops));},
    setPower(value){player.power=Math.max(1,Number(value)||1);updateHud();},
    setPlayerX(value){player.x=player.targetX=clamp(Number(value)||0,-.78,.78);updateHud();return player.x;},
    setWaveTime(value){waveTime=Math.max(0,Number(value)||0);return waveTime;},
    setWave(value){wave=clamp(Math.round(Number(value)||1)-1,0,LEVELS.length-1);updateHud();return wave+1;},
    spawnEnemyAt(type='grunt',x=player.x,y=.82,readyToFire=false){spawnEnemy(type);const enemy=enemies.at(-1);enemy.x=clamp(Number(x)||0,-.8,.8);enemy.y=clamp(Number(y)||0,-.08,1);if(readyToFire)enemy.shotTimer=0;return {type:enemy.type,x:enemy.x,y:enemy.y,hp:enemy.hp,shield:enemy.shield};},
    setBossHp(value){if(boss){boss.hp=clamp(Number(value)||0,0,boss.maxHp);updateHud();}return boss?.hp??null;},
    forceBoss(){if(!ACTIVE_STATES.includes(state))setState(GAME_STATE.PLAYING);spawnBoss();boss.y=.45;return this.getState();},
    defeatBoss(){if(!boss)this.forceBoss();boss.hp=0;finishBoss();return state;},
    forceUpgrade(){setState(GAME_STATE.UPGRADE);showUpgrades();return state;},
    forceVictory(){victory();return state;},
    forceGameOver(){player.troops=0;gameOver();return state;},
    setGatePair(left,right,y=.52){const encounter=setDebugGatePair(left,right,y);return encounter.gates.map(g=>({kind:g.kind,value:g.value,text:gateText(g),color:g.color}));},
    applyGate(kind,value){player=applyGate(player,{kind,value});updateHud();return player.troops;},
    damageTroops(value){damageSquad(value,player.x);return player.troops;},
    pause(){pauseGame();return state;},
    resume(){resumeGame();return state;},
    freeze(value=true){qaFrozen=Boolean(value);return qaFrozen;},
    benchmarkDraw(iterations=120){const n=clamp(Math.round(iterations),1,1000),start=performance.now();for(let i=0;i<n;i++)draw();return (performance.now()-start)/n;},
    getState(){return {
      state,paused:state===GAME_STATE.PAUSED,resumeState,wave:wave+1,waveTime,bossTime,score,coins:player.coins,troops:player.troops,armor:player.armor,power:player.power,fireRate:player.fireRate,bulletSpeed:player.bulletSpeed,projectiles:player.projectiles,visibleSquad:visibleSquadCount(Math.max(1,player.troops)),playerX:player.x,assetsReady:canvas.dataset.assetsReady,
      bullets:bullets.length,enemyBullets:enemyBullets.length,sampleBullet:bullets[0]?{x:bullets[0].x,y:bullets[0].y,targetX:bullets[0].targetX,shooter:bullets[0].shooter}:null,enemies:enemies.length,
      gates:gates.flatMap(encounter=>encounter.gates.map(g=>({pairId:encounter.id,x:g.x,y:encounter.y,w:g.w,kind:g.kind,value:g.value,text:gateText(g),color:g.color,hit:encounter.resolved,selected:encounter.selected}))),
      muzzleFlashes:muzzleFlashes.length,particles:particles.length,floaters:floaters.length,telegraphs:telegraphs.length,boss:boss?{x:boss.x,y:boss.y,hp:boss.hp,maxHp:boss.maxHp}:null,
    };}
  };
}

function loop(ts){ const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts; if(!qaFrozen)update(dt); draw(); requestAnimationFrame(loop); }

function prepareCapture(mode){
  if(!mode){returnHome();return;}
  if(mode==='home'){returnHome();qaFrozen=true;return;}
  resetRun(7);
  if(mode==='gameplay'){
    player.troops=18;spawnEnemy('grunt');spawnEnemy('grunt');spawnEnemy('elite');enemies.forEach((enemy,index)=>{enemy.y=.28+index*.09;enemy.x=[-.42,.12,.46][index];});fireBurst();qaFrozen=true;
  }else if(mode==='lane'||mode==='gate'){
    player.troops=16;setDebugGatePair({kind:'troops',value:-10,text:'−10',color:'red'},{kind:'troops',value:9,text:'+9',color:'blue'},.52);spawnEnemy('grunt');spawnEnemy('grunt');enemies[0].y=.19;enemies[1].y=.25;enemies[0].x=-.18;enemies[1].x=.25;fireBurst();qaFrozen=true;
  }else if(mode==='dense'){
    wave=4;player.troops=42;for(let i=0;i<14;i++){spawnEnemy(i%6===0?'elite':i%9===0?'shield':'grunt');enemies[i].x=[-.6,-.3,0,.3,.6][i%5]+((i%3)-1)*.025;enemies[i].y=.08+Math.floor(i/5)*.11;}fireBurst();fireBurst();qaFrozen=true;updateHud();
  }else if(mode==='elite'){
    wave=4;player.troops=24;for(const type of ['grunt','elite','shield','grunt','elite'])spawnEnemy(type);enemies.forEach((enemy,index)=>{enemy.x=[-.58,-.3,0,.32,.58][index];enemy.y=.18+(index%2)*.1;});fireBurst();qaFrozen=true;updateHud();
  }else if(mode==='boss'){
    wave=5;player.troops=28;spawnBoss();boss.y=.45;boss.hp=128;boss.attackSerial=1;spawnBossAttack();fireBurst();fireBurst();qaFrozen=true;updateHud();
  }else if(mode==='upgrade'){
    wave=2;setState(GAME_STATE.UPGRADE);showUpgrades();qaFrozen=true;updateHud();
  }else if(mode==='victory'){
    wave=5;score=6840;player.coins=326;player.troops=38;victory();qaFrozen=true;
  }else if(mode==='gameover'){
    wave=3;score=2410;player.coins=148;player.troops=0;gameOver();qaFrozen=true;
  }
}

async function boot(){
  await loadRuntimeAssets();
  prepareCapture(captureMode);
  updateHud();
  requestAnimationFrame(loop);
}

boot();
