import {
  ACTIVE_STATES,
  DIFFICULTIES,
  GAME_STATE,
  LANE_CENTERS,
  LANE_HALF_WIDTH,
  LANE_LIMIT,
  MAX_ACTIVE_ENEMIES,
  MAX_TROOPS,
  SHOP_CATALOG,
  applyBossReward,
  applyGate,
  applyTroopDamage,
  clamp,
  claimKillReward,
  createCleanRun,
  format,
  gateText,
  getWaveConfig,
  laneBounds,
  laneCenter,
  laneContains,
  lerp,
  makeGateEncounter,
  makeGatePair,
  mulberry32,
  nearestLane,
  normalizeDifficulty,
  pickBossRewards,
  purchaseUpgrade,
  resolveGateEncounter,
  reviveSession,
  shopPrice,
  squadColumnCount,
  stateAfterBossDefeat,
  stateAfterTroopDamage,
  upgradeTier,
  visibleSquadCount,
} from './core.mjs';
import { drawBlueSoldier, drawBossCombatant } from './production-render.mjs';
import { drawEnemyCombatant } from './enemy-render.mjs';

const RUNTIME_ASSET_PATHS = Object.freeze({
  homeHero: 'assets/blastline/characters/home-hero.webp',
  oceanSurface: 'assets/blastline/environment/ocean-surface-v2.webp',
  oceanWhitecaps: 'assets/blastline/environment/ocean-whitecaps.webp',
  asphalt: 'assets/blastline/environment/asphalt.webp',
  playerRun1: 'assets/blastline/characters/player-run-1.webp',
  playerRun2: 'assets/blastline/characters/player-run-2.webp',
  playerRun3: 'assets/blastline/characters/player-run-3.webp',
  playerRun4: 'assets/blastline/characters/player-run-4.webp',
  enemyGrunt1: 'assets/blastline/characters/enemy-grunt-1.webp',
  enemyGrunt2: 'assets/blastline/characters/enemy-grunt-2.webp',
  enemyGrunt3: 'assets/blastline/characters/enemy-grunt-3.webp',
  enemyGrunt4: 'assets/blastline/characters/enemy-grunt-4.webp',
  enemyElite1: 'assets/blastline/characters/enemy-elite-1.webp',
  enemyElite2: 'assets/blastline/characters/enemy-elite-2.webp',
  enemyElite3: 'assets/blastline/characters/enemy-elite-3.webp',
  enemyElite4: 'assets/blastline/characters/enemy-elite-4.webp',
  enemySpecial1: 'assets/blastline/characters/enemy-special-1.webp',
  enemySpecial2: 'assets/blastline/characters/enemy-special-2.webp',
  enemySpecial3: 'assets/blastline/characters/enemy-special-3.webp',
  enemySpecial4: 'assets/blastline/characters/enemy-special-4.webp',
  boss: 'assets/blastline/characters/boss.webp',
});

const canvas = document.querySelector('#game');
const environmentSurface = document.querySelector('#environment');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const dom = Object.fromEntries([
  'menu', 'hud', 'floatingStats', 'enemyCounter', 'enemyCountLabel', 'bossHud', 'bossName',
  'bossPhaseText', 'bossHealthText', 'bossHealthFill', 'pausePanel', 'rewardPanel', 'rewardCards',
  'rewardWave', 'recoveryPanel', 'recoveryCount', 'gameOverPanel', 'playBtn', 'playDifficulty',
  'pauseBtn', 'resumeBtn', 'restartBtn', 'retryBtn', 'gameOverHomeBtn', 'difficultyPicker',
  'waveLabel', 'difficultyLabel', 'phaseLabel', 'waveProgress', 'troopsLabel', 'powerLabel',
  'rateLabel', 'armorLabel', 'scoreLabel', 'pointsLabel', 'livesLabel', 'livesHud', 'pausePoints',
  'buildSummary', 'shopGrid', 'shopMessage', 'finalScore', 'finalWave', 'finalKills',
  'finalDifficulty',
].map(id => [id, document.querySelector(`#${id}`)]));

const runtimeAssets = Object.create(null);
const lodAssets = Object.create(null);
const textCache = new WeakMap();
const styleCache = new WeakMap();
const keys = Object.create(null);
const SIM_STEP = 1 / 60;
const MAX_PLAYER_BULLETS = 720;
const MAX_ENEMY_BULLETS = 150;
const Y_BUCKETS = 32;
const PORTRAIT_CAMERA = Object.freeze({ horizon: .195, farHalf: .145, nearHalf: .485, exponent: 1.12, towerNear: .34, towerFar: .095 });
const LANDSCAPE_CAMERA = Object.freeze({ horizon: .205, farHalf: .125, nearHalf: .455, exponent: 1.015, towerNear: .37, towerFar: .085 });
const DEPTH_LUT_SIZE = 1024;
const makeDepthLut = profile => Float32Array.from(
  { length: DEPTH_LUT_SIZE + 1 },
  (_, index) => Math.pow(index / DEPTH_LUT_SIZE * 1.08, profile.exponent),
);
const PORTRAIT_DEPTH_LUT = makeDepthLut(PORTRAIT_CAMERA);
const LANDSCAPE_DEPTH_LUT = makeDepthLut(LANDSCAPE_CAMERA);
const FORMATIONS = Object.freeze(['wall', 'wedge', 'column', 'staggered', 'protected-core', 'split-lane']);
const TYPE_STATS = Object.freeze({
  grunt: { hp: 1, speed: 1, scale: 1, contact: 1 },
  gunner: { hp: 1, speed: .9, scale: 1.04, contact: 1 },
  shield: { hp: 1, shield: 2, speed: .78, scale: 1.18, contact: 2 },
  heavy: { hp: 4, speed: .62, scale: 1.34, contact: 3 },
  demolition: { hp: 2, speed: .72, scale: 1.2, contact: 2 },
});

class Pool {
  constructor(limit) { this.limit = limit; this.free = []; this.created = 0; }
  take(values) {
    const object = this.free.pop() || (this.created += 1, {});
    return Object.assign(object, values);
  }
  release(object) {
    if (!object || this.free.length >= this.limit) return;
    object.dead = true;
    this.free.push(object);
  }
}

const pools = {
  enemies: new Pool(MAX_ACTIVE_ENEMIES + 40),
  bullets: new Pool(MAX_PLAYER_BULLETS),
  enemyBullets: new Pool(MAX_ENEMY_BULLETS),
  particles: new Pool(260),
  floaters: new Pool(40),
  telegraphs: new Pool(30),
};

const enemyBuckets = Array.from({ length: 3 * Y_BUCKETS }, () => []);
let W = innerWidth;
let H = innerHeight;
let DPR = 1;
let state = GAME_STATE.HOME;
let resumeState = null;
let recoveryReturnState = GAME_STATE.PLAYING;
let selectedDifficulty = 'veteran';
let run = createCleanRun(0, selectedDifficulty);
let config = getWaveConfig(1, selectedDifficulty);
let rng = mulberry32(1);
let renderAlpha = 1;
let accumulator = 0;
let lastTimestamp = 0;
let ambientTime = 0;
let roadScroll = 0;
let pointerActive = false;
let enemySerial = 0;
let hordeSerial = 0;
let gateSerial = 0;
let qaFrozen = false;
let environmentCanvas = environmentSurface;
let environmentDirty = true;
let backgroundDpr = 1;
let frameSamples = [];
let stressMode = false;
let hudUpdateTimer = 0;
let renderQualityScale = 1;

function setText(element, value) {
  if (!element) return;
  const text = String(value);
  if (textCache.get(element) === text) return;
  textCache.set(element, text);
  element.textContent = text;
}

function setWidth(element, value) {
  if (!element || styleCache.get(element) === value) return;
  styleCache.set(element, value);
  element.style.width = value;
}

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
  canvas.dataset.assetCount = String(entries.length - missing.length);
  if (missing.length) console.warn(`BLASTLINE runtime art unavailable: ${missing.join(', ')}`);
  for (const [name, image] of entries) {
    if (!image) continue;
    const targetHeight = name.startsWith('enemy') ? 72 : name.startsWith('playerRun') ? 84 : name === 'boss' ? 256 : 0;
    if (!targetHeight) continue;
    const lod = document.createElement('canvas');
    lod.height = targetHeight;
    lod.width = Math.max(1, Math.round(targetHeight * image.width / image.height));
    lod.getContext('2d').drawImage(image, 0, 0, lod.width, lod.height);
    lodAssets[name] = lod;
  }
  environmentDirty = true;
}

function configureRenderSurface() {
  const requested = devicePixelRatio || 1;
  const adaptiveCap = W * H > 1_500_000 ? 1.15 : 1.5;
  backgroundDpr = Math.min(requested, adaptiveCap);
  DPR = backgroundDpr * renderQualityScale;
  canvas.width = Math.max(1, Math.round(W * DPR));
  canvas.height = Math.max(1, Math.round(H * DPR));
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  environmentCanvas.width = Math.max(1, Math.round(W * backgroundDpr));
  environmentCanvas.height = Math.max(1, Math.round(H * backgroundDpr));
  environmentCanvas.style.width = `${W}px`;
  environmentCanvas.style.height = `${H}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  canvas.dataset.renderScale = DPR.toFixed(2);
  environmentDirty = true;
}

function setRenderQuality(scale) {
  const next = clamp(scale, .7, 1);
  if (Math.abs(next - renderQualityScale) < .01) return;
  renderQualityScale = next;
  configureRenderSurface();
}

function resize() {
  W = innerWidth;
  H = innerHeight;
  configureRenderSurface();
}

addEventListener('resize', resize, { passive: true });
resize();

function cameraProfile() {
  return W < H ? PORTRAIT_CAMERA : LANDSCAPE_CAMERA;
}

function sceneHorizon() { return H * cameraProfile().horizon; }
function depthCurve(y) {
  if (y <= 0) return y * .28;
  const position = Math.min(y, 1.08) / 1.08 * DEPTH_LUT_SIZE;
  const index = Math.min(DEPTH_LUT_SIZE - 1, Math.floor(position));
  const fraction = position - index;
  const values = W < H ? PORTRAIT_DEPTH_LUT : LANDSCAPE_DEPTH_LUT;
  return values[index] + (values[index + 1] - values[index]) * fraction;
}
function perspectiveY(y) {
  const horizon = sceneHorizon();
  return horizon + (H * 1.025 - horizon) * depthCurve(y);
}
function laneHalfWidth(y) {
  const profile = cameraProfile();
  return W * lerp(profile.farHalf, profile.nearHalf, clamp(depthCurve(y), 0, 1));
}
function roadHalfWidth(y) { return laneHalfWidth(y) * .98; }
function bridgeHalfWidth(y) { return laneHalfWidth(y) * 1.12; }
function projectToScreen(x, y, result) {
  const profile = cameraProfile();
  const depth = depthCurve(y);
  const horizon = H * profile.horizon;
  result.x = W / 2 + x * W * lerp(profile.farHalf, profile.nearHalf, clamp(depth, 0, 1));
  result.y = horizon + (H * 1.025 - horizon) * depth;
  return result;
}
function worldToScreen(x, y) { return projectToScreen(x, y, {}); }
const projectionScratchA = { x: 0, y: 0 };
const projectionScratchB = { x: 0, y: 0 };

function bridgeProjectionAudit() {
  const profile = cameraProfile();
  const points = Array.from({ length: 25 }, (_, index) => {
    const y = index / 24;
    return { y: perspectiveY(y), left: W / 2 - roadHalfWidth(y), right: W / 2 + roadHalfWidth(y) };
  });
  const deviation = side => {
    const first = points[0];
    const last = points.at(-1);
    return Math.max(...points.map(point => Math.abs(point[side] - lerp(first[side], last[side], (point.y - first.y) / (last.y - first.y || 1)))));
  };
  const towerClearance = Math.min(...[profile.towerFar, profile.towerNear].map(y => {
    const depth = clamp(depthCurve(y), 0, 1);
    const pillarWidth = lerp(Math.max(8, W * .009), Math.min(34, W * .027), Math.pow(depth, .5));
    return bridgeHalfWidth(y) * 1.055 - pillarWidth * .6 - roadHalfWidth(y);
  }));
  return {
    leftMaxDeviation: deviation('left'),
    rightMaxDeviation: deviation('right'),
    horizon: sceneHorizon(),
    deckBottom: perspectiveY(1),
    roadWidthRatio: roadHalfWidth(1) * 2 / W,
    towerClearance,
    profile: W < H ? 'portrait' : 'landscape',
  };
}

function releaseAll(array, pool) {
  if (pool) for (const object of array) pool.release(object);
  array.length = 0;
}

function clearTransient({ keepBoss = false } = {}) {
  releaseAll(run.bullets, pools.bullets);
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.enemies, pools.enemies);
  releaseAll(run.particles, pools.particles);
  releaseAll(run.floaters, pools.floaters);
  releaseAll(run.telegraphs, pools.telegraphs);
  run.gates.length = 0;
  run.hazards.length = 0;
  run.muzzleFlashes.length = 0;
  if (!keepBoss) run.boss = null;
}

function startRun(seed = Date.now() >>> 0, difficulty = selectedDifficulty) {
  clearTransient();
  selectedDifficulty = normalizeDifficulty(difficulty);
  run = createCleanRun(seed, selectedDifficulty);
  rng = mulberry32(run.seed);
  enemySerial = 0;
  hordeSerial = 0;
  gateSerial = 0;
  roadScroll = 0;
  stressMode = false;
  startWave();
}

function startWave() {
  clearTransient();
  config = getWaveConfig(run.wave, run.difficulty);
  run.waveIndex = run.wave - 1;
  run.waveTime = 0;
  run.bossTime = 0;
  run.spawnTimer = .35;
  run.gateTimer = run.wave === 1 ? 4.8 : 6.4;
  run.enemiesSpawned = 0;
  run.player.x = 0;
  run.player.targetX = 0;
  run.player._shot = .08;
  run.player.protectedFor = Math.max(0, run.player.protectedFor || 0);
  setState(GAME_STATE.PLAYING);
  updateHud(true);
}

function setState(next) {
  state = next;
  run.phase = next;
  run.state = next;
  canvas.dataset.state = next;
  const hudVisible = ACTIVE_STATES.includes(next) || next === GAME_STATE.PAUSED;
  const bossVisible = Boolean(run.boss) && (
    next === GAME_STATE.BOSS || next === GAME_STATE.RECOVERY ||
    (next === GAME_STATE.PAUSED && resumeState === GAME_STATE.BOSS)
  );
  dom.menu.classList.toggle('visible', next === GAME_STATE.HOME);
  dom.pausePanel.classList.toggle('visible', next === GAME_STATE.PAUSED);
  dom.rewardPanel.classList.toggle('visible', next === GAME_STATE.BOSS_REWARD);
  dom.gameOverPanel.classList.toggle('visible', next === GAME_STATE.GAME_OVER);
  dom.recoveryPanel.classList.toggle('hidden', next !== GAME_STATE.RECOVERY);
  dom.hud.classList.toggle('hidden', !hudVisible);
  dom.floatingStats.classList.toggle('hidden', !hudVisible);
  dom.enemyCounter.classList.toggle('hidden', !ACTIVE_STATES.includes(next) || next === GAME_STATE.BOSS || next === GAME_STATE.RECOVERY);
  dom.bossHud.classList.toggle('hidden', !bossVisible);
  setText(dom.pauseBtn, next === GAME_STATE.PAUSED ? '▶' : '❚❚');
  dom.pauseBtn.setAttribute('aria-label', next === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
}

function updateHud(force = false) {
  const activeEnemies = run.enemies.reduce((total, enemy) => total + (!enemy.dead ? 1 : 0), 0);
  const visibleSquad = visibleSquadCount(Math.max(1, run.player.troops), run.player.formationDensity);
  if (renderQualityScale === 1 && activeEnemies >= 155 && visibleSquad >= 55) setRenderQuality(.72);
  else if (renderQualityScale < 1 && (activeEnemies < 115 || visibleSquad < 44)) setRenderQuality(1);
  setText(dom.waveLabel, `WAVE ${format(run.wave)}`);
  setText(dom.difficultyLabel, DIFFICULTIES[run.difficulty].label.toUpperCase());
  setText(dom.phaseLabel, state === GAME_STATE.BOSS ? 'BOSS' : state === GAME_STATE.RECOVERY ? 'RECOVERY' : 'HORDE');
  const progress = state === GAME_STATE.BOSS ? 1 : clamp(run.waveTime / config.duration, 0, 1);
  setWidth(dom.waveProgress, `${(progress * 100).toFixed(1)}%`);
  setText(dom.troopsLabel, format(run.player.troops));
  setText(dom.powerLabel, format(run.player.power));
  setText(dom.rateLabel, run.player.fireRate.toFixed(1));
  setText(dom.armorLabel, format(run.player.armor));
  setText(dom.scoreLabel, format(run.score));
  setText(dom.pointsLabel, format(run.skillPoints));
  setText(dom.livesLabel, format(run.lives));
  setText(dom.enemyCountLabel, format(activeEnemies));
  dom.enemyCounter.classList.toggle('hidden', state !== GAME_STATE.PLAYING || activeEnemies === 0);
  if (run.boss) {
    const hp = Math.max(0, run.boss.hp);
    setText(dom.bossName, run.boss.name);
    setText(dom.bossPhaseText, `PHASE ${['I', 'II', 'III'][run.boss.phase - 1]}`);
    setText(dom.bossHealthText, `${format(hp)} / ${format(run.boss.maxHp)}`);
    setWidth(dom.bossHealthFill, `${(clamp(hp / run.boss.maxHp, 0, 1) * 100).toFixed(1)}%`);
  }
  canvas.dataset.wave = String(run.wave);
  canvas.dataset.difficulty = run.difficulty;
  canvas.dataset.playerX = run.player.x.toFixed(3);
  canvas.dataset.troops = String(run.player.troops);
  canvas.dataset.visibleSquad = String(visibleSquad);
  canvas.dataset.activeEnemies = String(activeEnemies);
  if (force && state === GAME_STATE.PAUSED) renderPauseDashboard();
  hudUpdateTimer = .1;
}

function addFloater(x, y, text, color = '#fff', size = 22) {
  if (run.floaters.length >= 35) return;
  run.floaters.push(pools.floaters.take({ x, y, text, color, size, life: 1, dead: false }));
}

function burst(x, y, color, count = 8) {
  const room = Math.max(0, (stressMode ? 100 : 210) - run.particles.length);
  for (let index = 0; index < Math.min(count, room); index += 1) {
    run.particles.push(pools.particles.take({
      x, y, previousX: x, previousY: y,
      vx: (rng() - .5) * .14, vy: (rng() - .5) * .18,
      life: .38 + rng() * .32, size: 2 + rng() * 4, color, dead: false,
    }));
  }
}

const squadLayoutCache = new Map();
function squadLogicalSlots(troops = run.player.troops) {
  const visible = visibleSquadCount(troops, run.player.formationDensity);
  const key = `${visible}:${run.player.formationDensity}`;
  if (squadLayoutCache.has(key)) return squadLayoutCache.get(key);
  const columns = squadColumnCount(visible, run.player.formationDensity);
  const rows = Math.ceil(visible / columns);
  const rowGap = lerp(.042, .034, run.player.formationDensity / 6);
  const nearY = .925;
  const frontY = nearY - (rows - 1) * rowGap;
  const slots = [];
  const basePerRow = Math.floor(visible / rows);
  const extraRows = visible % rows;
  for (let row = 0, index = 0; row < rows; row += 1) {
    const rowCount = basePerRow + (row < extraRows ? 1 : 0);
    for (let column = 0; column < rowCount; column += 1, index += 1) {
      slots.push({
        index, row, y: frontY + row * rowGap,
        colOffset: column - (rowCount - 1) / 2 + (rows > 1 && row % 2 ? .16 : -.16),
        phase: index * 1.71 + row * .43,
      });
    }
  }
  squadLayoutCache.set(key, slots);
  return slots;
}

function soldierHeightAt(y) {
  const visible = visibleSquadCount(run.player.troops, run.player.formationDensity);
  const crowdScale = lerp(1.06, .71, clamp((visible - 12) / 60, 0, 1));
  const near = clamp(Math.min(H * .092, W * .155), 43, 78) * crowdScale;
  return near * lerp(.75, 1.04, clamp((y - .62) / .34, 0, 1));
}

function squadSlotWorldX(slot) {
  const height = soldierHeightAt(slot.y);
  const density = lerp(1.08, .78, run.player.formationDensity / 6);
  const stepPixels = height * .57 * density * clamp(.87 + W / H * .24, .96, 1.24);
  return clamp(run.player.x + slot.colOffset * stepPixels / Math.max(1, laneHalfWidth(slot.y)), -LANE_LIMIT, LANE_LIMIT);
}

function fireBurst() {
  const slots = squadLogicalSlots();
  const remaining = MAX_PLAYER_BULLETS - run.bullets.length;
  if (remaining < slots.length) return 0;
  const origins = slots.map(slot => {
    const height = soldierHeightAt(slot.y);
    const halfWidth = laneHalfWidth(slot.y);
    return {
      slot: slot.index,
      x: clamp(squadSlotWorldX(slot) - height * .22 / Math.max(1, halfWidth), -1, 1),
      y: slot.y - .05,
    };
  });
  const spreadCount = run.player.projectiles;
  const spread = spreadCount === 1 ? [0] : Array.from({ length: spreadCount }, (_, index) => lerp(-.062, .062, index / (spreadCount - 1)));
  const middle = Math.floor(spread.length / 2);
  const offsets = [spread[middle] ?? 0, ...spread.filter((_, index) => index !== middle)];
  let emitted = 0;
  for (const offset of offsets) {
    for (const origin of origins) {
      if (run.bullets.length >= MAX_PLAYER_BULLETS) break;
      const critical = rng() < run.player.criticalChance;
      run.bullets.push(pools.bullets.take({
        x: origin.x, y: origin.y, previousX: origin.x, previousY: origin.y, originX: origin.x, originY: origin.y,
        vx: offset * .72, vy: -1.02 * run.player.bulletSpeed * (run.frenzyTimer > 0 ? 1.18 : 1),
        power: run.player.power * (critical ? 2 : 1), critical,
        hitsLeft: 1 + run.player.pierce, lastHitId: -1, shooter: origin.slot, dead: false,
      }));
      emitted += 1;
    }
  }
  run.muzzleFlashes.length = 0;
  for (const slot of slots) run.muzzleFlashes.push({ slot: slot.index, life: .075 });
  return emitted;
}

function chooseEnemyType() {
  const roll = rng();
  let cursor = 0;
  for (const [type, chance] of Object.entries(config.composition)) {
    cursor += chance;
    if (roll <= cursor) return type;
  }
  return 'grunt';
}

function spawnEnemy(type = 'grunt', options = {}) {
  if (run.enemies.length >= MAX_ACTIVE_ENEMIES) return null;
  const stats = TYPE_STATS[type] || TYPE_STATS.grunt;
  const lane = clamp(Math.round(options.lane ?? Math.floor(rng() * 3)), 0, 2);
  const lineX = clamp(options.x ?? laneCenter(lane), laneBounds(lane, .018).min, laneBounds(lane, .018).max);
  const highWaveHp = type === 'heavy' ? Math.min(5, stats.hp + Math.floor(Math.log2(run.wave + 1) / 3)) : stats.hp;
  const enemy = pools.enemies.take({
    id: ++enemySerial, type, lane, x: lineX, lineX,
    y: options.y ?? (-.04 - rng() * .04), previousY: options.y ?? -.04,
    hp: highWaveHp, maxHp: highWaveHp,
    shield: type === 'shield' ? Math.min(3, (stats.shield || 0) + Math.floor(run.wave / 14)) : 0,
    maxShield: type === 'shield' ? Math.min(3, (stats.shield || 0) + Math.floor(run.wave / 14)) : 0,
    speed: options.speed ?? config.enemySpeed * stats.speed * (.97 + rng() * .06),
    scale: stats.scale, contact: stats.contact,
    bob: options.marchPhase ?? rng() * 1000,
    hordeId: options.hordeId ?? null, hordeRow: options.hordeRow ?? 0,
    formation: options.formation ?? 'wall', shotTimer: options.shotTimer ?? (.9 + rng() * 1.5),
    canShoot: type === 'gunner' || type === 'demolition',
    rewarded: false, dead: false, deathLife: 0, hitFlash: 0, shotFlash: 0,
  });
  run.enemies.push(enemy);
  run.enemiesSpawned += 1;
  return enemy;
}

function formationLanes(type) {
  if (type === 'column') return [Math.floor(rng() * 3)];
  if (type === 'split-lane') {
    const safe = Math.floor(rng() * 3);
    return [0, 1, 2].filter(lane => lane !== safe);
  }
  return [0, 1, 2];
}

function spawnFormation(forcedType, forcedCount) {
  const active = run.enemies.reduce((total, enemy) => total + (!enemy.dead ? 1 : 0), 0);
  const capacity = Math.min(config.activeCap - active, MAX_ACTIVE_ENEMIES - run.enemies.length);
  if (capacity <= 0) return 0;
  const formation = forcedType || FORMATIONS[Math.floor(rng() * FORMATIONS.length)];
  const desired = forcedCount ?? Math.min(config.hordeSize, Math.max(0, config.activeTarget - active));
  const count = Math.min(capacity, Math.max(0, desired));
  if (!count) return 0;
  const lanes = formationLanes(formation);
  const hordeId = ++hordeSerial;
  const perLane = Math.ceil(count / lanes.length);
  const columnsPerLane = formation === 'column' ? 2 : formation === 'wedge' ? 3 : 4;
  const rowGap = formation === 'column' ? .042 : .047;
  let spawned = 0;
  for (let laneIndex = 0; laneIndex < lanes.length && spawned < count; laneIndex += 1) {
    const lane = lanes[laneIndex];
    const laneCount = Math.min(perLane, count - spawned);
    for (let local = 0; local < laneCount; local += 1) {
      const row = Math.floor(local / columnsPerLane);
      const column = local % columnsPerLane;
      const rowCount = Math.min(columnsPerLane, laneCount - row * columnsPerLane);
      const bounds = laneBounds(lane, .028);
      const spread = (bounds.max - bounds.min) * .82;
      let offset = rowCount === 1 ? 0 : lerp(-spread / 2, spread / 2, column / (rowCount - 1));
      if (formation === 'wedge') offset *= 1 - Math.min(.65, row * .09);
      if (formation === 'staggered') offset += (row % 2 ? .025 : -.025);
      let type = chooseEnemyType();
      if (formation === 'protected-core' && local % columnsPerLane === Math.floor(columnsPerLane / 2) && run.wave >= 3) type = 'shield';
      const y = -.015 - row * rowGap - laneIndex * .012;
      spawnEnemy(type, {
        lane, x: clampToLaneLocal(laneCenter(lane) + offset, lane), y,
        hordeId, hordeRow: row, formation,
        marchPhase: hordeId * .71 + row * .32 + column * .19,
      });
      spawned += 1;
    }
  }
  return spawned;
}

function clampToLaneLocal(x, lane) {
  const bounds = laneBounds(lane, .025);
  return clamp(x, bounds.min, bounds.max);
}

function spawnGateEncounter(options = makeGatePair(rng, run.wave), forcedY = -.04, forcedNeutralLane = null) {
  const laneRng = forcedNeutralLane == null ? rng : () => (forcedNeutralLane + .01) / 3;
  const encounter = makeGateEncounter(++gateSerial, options, forcedY, laneRng);
  for (const gate of encounter.gates) gate.encounter = encounter;
  run.gates.push(encounter);
  return encounter;
}

function spawnEnemyProjectile(enemy, options = {}) {
  if (run.enemyBullets.length >= MAX_ENEMY_BULLETS) return null;
  const lane = clamp(options.lane ?? enemy.lane ?? nearestLane(enemy.x), 0, 2);
  const startY = options.y ?? enemy.y + .025;
  const x = options.x ?? enemy.x;
  const bullet = pools.enemyBullets.take({
    kind: options.kind ?? 'enemy', lane, x, y: startY, previousX: x, previousY: startY,
    vx: options.vx ?? 0, vy: options.vy ?? (.35 + Math.log2(run.wave + 1) * .012) * config.pressure,
    radius: options.radius ?? .06, damage: options.damage ?? 1,
    color: options.color ?? '#ff6948', dead: false,
  });
  run.enemyBullets.push(bullet);
  enemy.shotFlash = .12;
  return bullet;
}

function addTelegraph(lane, time, kind, source = null, options = {}) {
  if (run.telegraphs.length >= 24) return null;
  const warning = pools.telegraphs.take({
    lane, x: laneCenter(lane), time, maxTime: time, kind, source,
    damage: options.damage ?? 1, speed: options.speed ?? .48,
    fired: false, dead: false,
  });
  run.telegraphs.push(warning);
  return warning;
}

function spawnBoss() {
  releaseAll(run.enemies, pools.enemies);
  releaseAll(run.bullets, pools.bullets);
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.telegraphs, pools.telegraphs);
  run.gates.length = 0;
  run.hazards.length = 0;
  run.bossTime = 0;
  run.boss = {
    id: ++enemySerial, type: 'boss', name: bossNameForWave(run.wave),
    lane: 1, x: 0, y: -.12, previousY: -.12,
    hp: config.bossHp, maxHp: config.bossHp,
    phase: 1, attackTimer: 1.05, attackSerial: 0, hitFlash: 0, shotFlash: 0,
    rewarded: false,
  };
  setState(GAME_STATE.BOSS);
  addFloater(0, .39, `WAVE ${run.wave} BOSS`, '#ffd56a', 28);
  updateHud(true);
}

function bossNameForWave(wave) {
  return ['REDLINE JUGGERNAUT', 'BRIDGE REAPER', 'IRON MARSHAL', 'SCARLET ENGINE'][wave % 4];
}

function updateBossPhase() {
  if (!run.boss) return;
  const fraction = run.boss.hp / run.boss.maxHp;
  const phase = config.bossPhaseCount === 2 ? (fraction <= .48 ? 2 : 1) : (fraction <= .28 ? 3 : fraction <= .64 ? 2 : 1);
  if (phase > run.boss.phase) {
    run.boss.phase = phase;
    run.boss.attackTimer = .42;
    addFloater(run.boss.x, run.boss.y + .1, `PHASE ${phase}`, '#ffb25f', 25);
    burst(run.boss.x, run.boss.y, '#ff704e', 24);
  }
}

function spawnBossAttack() {
  const boss = run.boss;
  if (!boss) return;
  const patternCount = boss.phase === 1 ? 2 : boss.phase === 2 ? 4 : 5;
  const pattern = boss.attackSerial % patternCount;
  boss.attackSerial += 1;
  if (pattern === 0) {
    const targetX = run.player.x;
    const speed = .47 * config.pressure;
    const travel = Math.max(.45, (.9 - boss.y) / speed);
    for (const offset of [-.045, .045]) {
      spawnEnemyProjectile(boss, { kind: 'boss-aimed', lane: nearestLane(targetX), x: boss.x + offset, vx: (targetX - boss.x) / travel, vy: speed, radius: .065, color: '#ff9b3e' });
    }
  } else if (pattern === 1) {
    const safeLane = (boss.attackSerial + run.wave) % 3;
    for (let lane = 0; lane < 3; lane += 1) {
      if (lane !== safeLane) spawnEnemyProjectile(boss, { kind: 'safe-gap', lane, x: laneCenter(lane), vx: 0, vy: .43 * config.pressure, radius: .1, color: '#ff4f4f' });
    }
    addFloater(laneCenter(safeLane), .61, 'SAFE', '#8cf3ff', 16);
  } else if (pattern === 2) {
    const safeLane = (boss.attackSerial * 2 + run.wave) % 3;
    for (let lane = 0; lane < 3; lane += 1) if (lane !== safeLane) addTelegraph(lane, .78, 'suppression', boss, { damage: boss.phase >= 3 ? 2 : 1, speed: .56 });
  } else if (pattern === 3 && !stressMode) {
    spawnFormation(boss.phase >= 3 ? 'protected-core' : 'split-lane', Math.min(24, 10 + run.wave));
  } else {
    for (let lane = 0; lane < 3; lane += 1) addTelegraph(lane, .64 + lane * .1, 'cascade', boss, { damage: 1, speed: .6 });
  }
  boss.shotFlash = .14;
}

function finishBoss() {
  const boss = run.boss;
  if (!boss || boss.rewarded) return;
  boss.rewarded = true;
  run.score += 900 + run.wave * 175;
  run.skillPoints += config.skillReward;
  burst(boss.x, boss.y, '#ffc54a', 48);
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.telegraphs, pools.telegraphs);
  releaseAll(run.enemies, pools.enemies);
  releaseAll(run.bullets, pools.bullets);
  run.gates.length = 0;
  run.hazards.length = 0;
  run.boss = null;
  setState(stateAfterBossDefeat());
  showBossRewards();
  updateHud(true);
}

function showBossRewards() {
  const rewards = pickBossRewards(rng, run);
  setText(dom.rewardWave, run.wave);
  dom.rewardCards.replaceChildren();
  for (const item of rewards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `reward-card tone-${item.tone}`;
    button.dataset.upgrade = item.id;
    const image = document.createElement('img');
    image.src = item.asset;
    image.alt = '';
    const title = document.createElement('b');
    title.textContent = item.title;
    const tier = document.createElement('span');
    tier.className = 'tier';
    tier.textContent = item.tierLabel;
    const description = document.createElement('span');
    description.className = 'description';
    description.textContent = item.description;
    const synergy = document.createElement('span');
    synergy.className = 'synergy';
    synergy.textContent = item.synergy;
    button.append(image, title, tier, description, synergy);
    button.onclick = () => chooseBossReward(item.id);
    dom.rewardCards.append(button);
  }
}

function chooseBossReward(id) {
  if (state !== GAME_STATE.BOSS_REWARD) return false;
  run = applyBossReward(run, id);
  run.wave += 1;
  startWave();
  return true;
}

function defeatEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.deathLife = stressMode ? 0 : enemy.type === 'grunt' || enemy.type === 'gunner' ? .18 : .28;
  run.kills += 1;
  const claim = claimKillReward(enemy, run.kills);
  enemy.rewarded = claim.enemy.rewarded;
  if (!claim.reward) return;
  run.score += claim.reward.score;
  run.skillPoints += claim.reward.skillPoints;
  run.frenzy += claim.reward.frenzy;
  if (claim.reward.skillPoints) addFloater(enemy.x, enemy.y, `+${claim.reward.skillPoints} SKILL`, '#ffe06b', 15);
  if (run.frenzy >= 18) {
    run.frenzy = 0;
    run.frenzyTimer = run.player.frenzyDuration;
    addFloater(0, .53, 'FRENZY!', '#79e5ff', 31);
  }
}

function damageSquad(amount, x, y = .86) {
  const result = applyTroopDamage(run.player, amount);
  run.player = result.player;
  if (result.protected) {
    addFloater(x, y, 'PROTECTED', '#9df0ff', 15);
    return false;
  }
  if (result.absorbed) addFloater(x, y, result.lost ? `ARMOR −${result.absorbed}` : 'BLOCKED', '#aeeaff', 16);
  if (result.lost) addFloater(x, y - .025, `−${result.lost}`, '#ff8d8d', 22);
  burst(x, y, result.lost ? '#ff5757' : '#71d9ff', result.lost ? 9 : 5);
  const next = stateAfterTroopDamage(run.player, state, run.lives);
  if (next === GAME_STATE.RECOVERY) {
    triggerRevival();
    return true;
  }
  if (next === GAME_STATE.GAME_OVER) {
    gameOver();
    return true;
  }
  return false;
}

function triggerRevival() {
  recoveryReturnState = run.boss ? GAME_STATE.BOSS : GAME_STATE.PLAYING;
  const result = reviveSession(run);
  if (!result.revived) {
    gameOver();
    return;
  }
  run = result.session;
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.telegraphs, pools.telegraphs);
  run.hazards.length = 0;
  for (const enemy of run.enemies) if (!enemy.dead && enemy.y > .52) enemy.dead = true;
  compactEntities(run.enemies, pools.enemies, enemy => !enemy.dead || enemy.deathLife > 0);
  setState(GAME_STATE.RECOVERY);
  setText(dom.recoveryCount, '3');
  updateHud(true);
}

function gameOver() {
  run.player.troops = 0;
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.telegraphs, pools.telegraphs);
  setText(dom.finalScore, format(run.score));
  setText(dom.finalWave, format(run.wave));
  setText(dom.finalKills, format(run.kills));
  setText(dom.finalDifficulty, DIFFICULTIES[run.difficulty].label);
  setState(GAME_STATE.GAME_OVER);
  updateHud(true);
}

function rebuildBuckets() {
  for (const bucket of enemyBuckets) bucket.length = 0;
  for (const enemy of run.enemies) {
    if (enemy.dead) continue;
    const cell = clamp(Math.floor(enemy.y * Y_BUCKETS), 0, Y_BUCKETS - 1);
    enemyBuckets[enemy.lane * Y_BUCKETS + cell].push(enemy);
  }
}

function collidePlayerBullets() {
  rebuildBuckets();
  for (const bullet of run.bullets) {
    if (bullet.dead) continue;
    const lane = nearestLane(bullet.x);
    const cell = clamp(Math.floor(bullet.y * Y_BUCKETS), 0, Y_BUCKETS - 1);
    for (let offset = -1; offset <= 1 && !bullet.dead; offset += 1) {
      const bucketIndex = cell + offset;
      if (bucketIndex < 0 || bucketIndex >= Y_BUCKETS) continue;
      const bucket = enemyBuckets[lane * Y_BUCKETS + bucketIndex];
      for (const enemy of bucket) {
        if (enemy.dead || enemy.id === bullet.lastHitId) continue;
        const hitRadius = .029 * enemy.scale;
        const crossed = bullet.previousY >= enemy.y && bullet.y <= enemy.y;
        if (!crossed && (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2 >= hitRadius ** 2) continue;
        if (crossed && Math.min(Math.abs(bullet.previousX - enemy.x), Math.abs(bullet.x - enemy.x)) >= hitRadius) continue;
        let damage = bullet.power;
        if (enemy.shield > 0) {
          const absorbed = Math.min(enemy.shield, damage);
          enemy.shield -= absorbed;
          damage -= absorbed;
          if (!stressMode) burst(enemy.x, enemy.y, '#6fe6ff', 3);
        }
        enemy.hp -= damage;
        enemy.hitFlash = .08;
        bullet.lastHitId = enemy.id;
        bullet.hitsLeft -= 1;
        if (bullet.hitsLeft <= 0) bullet.dead = true;
        if (!stressMode) burst(enemy.x, enemy.y, bullet.critical ? '#ffe75d' : '#ff685e', bullet.critical ? 5 : 2);
        if (enemy.hp <= 0) defeatEnemy(enemy);
        if (bullet.dead) break;
      }
    }
    if (!bullet.dead && run.boss) {
      const boss = run.boss;
      const crossed = bullet.previousY >= boss.y && bullet.y <= boss.y;
      if (crossed && Math.abs(bullet.x - boss.x) < .13) {
        bullet.dead = true;
        boss.hp -= bullet.power;
        boss.hitFlash = .085;
        run.score += bullet.critical ? 4 : 2;
        if (!stressMode) burst(bullet.x, boss.y, bullet.critical ? '#fff076' : '#ffad4a', bullet.critical ? 5 : 2);
        updateBossPhase();
        if (boss.hp <= 0) {
          finishBoss();
          return true;
        }
      }
    }
  }
  return false;
}

function updateTelegraphs(dt) {
  for (const warning of run.telegraphs) {
    warning.time -= dt;
    if (warning.time > 0 || warning.fired) continue;
    warning.fired = true;
    const source = warning.source || run.boss || { x: warning.x, y: .18, lane: warning.lane, shotFlash: 0 };
    spawnEnemyProjectile(source, {
      kind: warning.kind === 'demolition' ? 'hazard' : 'lane', lane: warning.lane,
      x: laneCenter(warning.lane), y: Math.max(.14, source.y + .03), vx: 0,
      vy: warning.speed, radius: warning.kind === 'demolition' ? .13 : .105,
      damage: warning.damage, color: warning.kind === 'demolition' ? '#ffb02f' : '#ff543f',
    });
  }
}

function updateEnemyAttacks(enemy, dt) {
  if (!enemy.canShoot || enemy.y < .1 || enemy.y > .61 || run.enemyBullets.length >= MAX_ENEMY_BULLETS) return;
  enemy.shotTimer -= dt;
  if (enemy.shotTimer > 0) return;
  if (enemy.type === 'gunner') addTelegraph(enemy.lane, .46, 'gunner', enemy, { speed: .4 * config.pressure, damage: 1 });
  else addTelegraph(enemy.lane, .85, 'demolition', enemy, { speed: .31 * config.pressure, damage: run.wave >= 10 ? 2 : 1 });
  enemy.shotTimer = (enemy.type === 'gunner' ? 3.6 : 5.1) / config.pressure + rng() * 1.2;
}

function updateRecovery(dt) {
  roadScroll += dt * 90;
  run.recoveryTime = Math.max(0, run.recoveryTime - dt);
  run.player.protectedFor = Math.max(0, run.player.protectedFor - dt);
  setText(dom.recoveryCount, Math.max(1, Math.ceil(run.recoveryTime)));
  if (run.recoveryTime <= 0) {
    run.player.protectedFor = .35;
    setState(recoveryReturnState);
  }
  updateEffects(dt);
  hudUpdateTimer -= dt;
  if (hudUpdateTimer <= 0) updateHud();
}

function update(dt) {
  if (!ACTIVE_STATES.includes(state)) return;
  if (state === GAME_STATE.RECOVERY) {
    updateRecovery(dt);
    return;
  }
  roadScroll += dt * (102 + Math.log2(run.wave + 1) * 8);
  if (state === GAME_STATE.PLAYING) run.waveTime += dt;
  else run.bossTime += dt;
  if (run.frenzyTimer > 0) run.frenzyTimer = Math.max(0, run.frenzyTimer - dt);
  if (run.player.protectedFor > 0) run.player.protectedFor = Math.max(0, run.player.protectedFor - dt);

  const direction = (keys.ArrowLeft || keys.a || keys.A ? -1 : 0) + (keys.ArrowRight || keys.d || keys.D ? 1 : 0);
  if (direction) run.player.targetX = clamp(run.player.targetX + direction * dt * run.player.speed, -LANE_LIMIT, LANE_LIMIT);
  const previousX = run.player.x;
  run.player.x = lerp(run.player.x, run.player.targetX, Math.min(1, dt * 9));
  const velocity = dt ? (run.player.x - previousX) / dt : 0;
  run.player._visualLean = lerp(run.player._visualLean || 0, clamp(velocity * .04, -.075, .075), Math.min(1, dt * 12));

  run.player._shot = (run.player._shot || 0) - dt;
  const cadence = 1 / (run.player.fireRate * (run.frenzyTimer > 0 ? 1.42 : 1));
  if (run.player._shot <= 0) {
    run.player._shot = cadence;
    fireBurst();
  }

  if (state === GAME_STATE.PLAYING) {
    run.gateTimer -= dt;
    run.spawnTimer -= dt;
    const gatePending = run.gateTimer <= 0;
    const active = run.enemies.reduce((total, enemy) => total + (!enemy.dead ? 1 : 0), 0);
    if (!gatePending && run.gates.length === 0 && run.spawnTimer <= 0 && active < config.activeTarget && run.waveTime < config.duration - 5) {
      spawnFormation();
      run.spawnTimer = config.spawnInterval * (.88 + rng() * .2);
    }
    const decisionZoneClear = !run.enemies.some(enemy => !enemy.dead && enemy.y > -.02 && enemy.y < .38);
    if (gatePending && run.gates.length === 0 && decisionZoneClear && run.waveTime < config.duration - 5) {
      spawnGateEncounter();
      run.gateTimer = 10.2 + rng() * 1.8;
      run.spawnTimer = 2.8;
    }
    if (run.waveTime >= config.duration) {
      spawnBoss();
      return;
    }
  }

  for (const encounter of run.gates) encounter.y += dt * .205;
  for (const enemy of run.enemies) {
    enemy.previousY = enemy.y;
    if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    if (enemy.shotFlash > 0) enemy.shotFlash = Math.max(0, enemy.shotFlash - dt);
    if (enemy.dead) {
      enemy.deathLife -= dt;
      enemy.y -= dt * .012;
      continue;
    }
    enemy.y += dt * enemy.speed;
    enemy.x = enemy.lineX;
    updateEnemyAttacks(enemy, dt);
  }

  if (run.boss) {
    run.boss.previousY = run.boss.y;
    run.boss.y = Math.min(.41, run.boss.y + dt * .19);
    if (run.boss.hitFlash > 0) run.boss.hitFlash = Math.max(0, run.boss.hitFlash - dt);
    if (run.boss.shotFlash > 0) run.boss.shotFlash = Math.max(0, run.boss.shotFlash - dt);
    if (run.boss.y >= .405) {
      run.boss.attackTimer -= dt;
      if (run.boss.attackTimer <= 0) {
        spawnBossAttack();
        const enrage = run.boss.phase === 3 ? .72 : run.boss.phase === 2 ? .86 : 1;
        run.boss.attackTimer = config.bossCadence * enrage + (run.boss.attackSerial % 3) * .07;
      }
    }
  }

  updateTelegraphs(dt);
  for (const bullet of run.bullets) {
    bullet.previousX = bullet.x;
    bullet.previousY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }
  for (const bullet of run.enemyBullets) {
    bullet.previousX = bullet.x;
    bullet.previousY = bullet.y;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
  }

  for (const encounter of run.gates) {
    if (encounter.resolved || encounter.y <= .855) continue;
    const result = resolveGateEncounter(encounter, run.player.x);
    Object.assign(encounter, result.encounter);
    if (result.gate) {
      run.player = applyGate(run.player, result.gate);
      addFloater(result.gate.x, .83, gateText(result.gate), result.gate.tone === 'red' ? '#ff8780' : '#91ebff', 23);
      burst(result.gate.x, encounter.y, result.gate.tone === 'red' ? '#ff5158' : '#43d6ff', 15);
    } else addFloater(laneCenter(encounter.neutralLane), .83, 'SAFE LANE', '#d8f6ff', 15);
  }

  if (collidePlayerBullets()) return;
  for (const enemy of run.enemies) {
    if (enemy.dead || enemy.y <= .875) continue;
    enemy.dead = true;
    enemy.deathLife = .12;
    const radius = .16 + enemy.scale * .035;
    if (Math.abs(enemy.x - run.player.x) < radius && damageSquad(enemy.contact, enemy.x)) return;
  }
  for (const bullet of run.enemyBullets) {
    if (bullet.dead || bullet.y < .835) continue;
    if (Math.abs(bullet.x - run.player.x) < bullet.radius) {
      bullet.dead = true;
      if (damageSquad(bullet.damage, bullet.x)) return;
    } else if (bullet.y > 1.04) bullet.dead = true;
  }

  compactEntities(run.bullets, pools.bullets, bullet => !bullet.dead && bullet.y > -.14 && Math.abs(bullet.x) < 1.1);
  compactEntities(run.enemyBullets, pools.enemyBullets, bullet => !bullet.dead && bullet.y < 1.07 && Math.abs(bullet.x) < 1.25);
  compactEntities(run.enemies, pools.enemies, enemy => enemy.dead ? enemy.deathLife > 0 : enemy.y < 1.03);
  compactPlain(run.gates, encounter => encounter.y < 1.04);
  compactEntities(run.telegraphs, pools.telegraphs, warning => !warning.fired);
  if (stressMode) maintainStressPressure();
  updateEffects(dt);
  hudUpdateTimer -= dt;
  if (hudUpdateTimer <= 0) updateHud();
}

function maintainStressPressure() {
  let active = run.enemies.reduce((total, enemy) => total + (!enemy.dead ? 1 : 0), 0);
  while (active < 180 && run.enemies.length < MAX_ACTIVE_ENEMIES) {
    const index = enemySerial % 180;
    const lane = index % 3;
    const local = Math.floor(index / 3);
    const column = local % 4;
    const row = Math.floor(local / 4);
    const bounds = laneBounds(lane, .025);
    const type = index % 23 === 0 ? 'demolition' : index % 17 === 0 ? 'heavy' : index % 13 === 0 ? 'shield' : index % 11 === 0 ? 'gunner' : 'grunt';
    spawnEnemy(type, {
      lane,
      x: lerp(bounds.min, bounds.max, column / 3),
      y: .02 + row * .034,
      hordeId: 1000 + Math.floor(index / 45),
      hordeRow: row,
      formation: 'stress',
    });
    active += 1;
  }
}

function updateEffects(dt) {
  for (const particle of run.particles) {
    particle.previousX = particle.x;
    particle.previousY = particle.y;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    particle.vx *= .975;
    particle.vy *= .975;
  }
  compactEntities(run.particles, pools.particles, particle => particle.life > 0);
  for (const floater of run.floaters) { floater.y -= dt * .055; floater.life -= dt; }
  compactEntities(run.floaters, pools.floaters, floater => floater.life > 0);
  for (const flash of run.muzzleFlashes) flash.life -= dt;
  compactPlain(run.muzzleFlashes, flash => flash.life > 0);
}

function compactEntities(array, pool, keep) {
  let write = 0;
  for (let read = 0; read < array.length; read += 1) {
    const object = array[read];
    if (keep(object)) array[write++] = object;
    else pool.release(object);
  }
  array.length = write;
}

function compactPlain(array, keep) {
  let write = 0;
  for (const object of array) if (keep(object)) array[write++] = object;
  array.length = write;
}

function pauseGame() {
  if (!ACTIVE_STATES.includes(state)) return;
  resumeState = state;
  setState(GAME_STATE.PAUSED);
  renderPauseDashboard();
}

function resumeGame() {
  if (state !== GAME_STATE.PAUSED || !ACTIVE_STATES.includes(resumeState)) return;
  const next = resumeState;
  resumeState = null;
  setState(next);
  lastTimestamp = performance.now();
}

function returnHome() {
  clearTransient();
  run = createCleanRun(0, selectedDifficulty);
  config = getWaveConfig(1, selectedDifficulty);
  resumeState = null;
  pointerActive = false;
  roadScroll = 0;
  setState(GAME_STATE.HOME);
  updateDifficultyPicker();
  updateHud(true);
}

function renderPauseDashboard() {
  setText(dom.pausePoints, format(run.skillPoints));
  const build = [
    ['SQUAD', format(run.player.troops)], ['POWER', format(run.player.power)],
    ['RATE', run.player.fireRate.toFixed(1)], ['MULTI', `×${run.player.projectiles}`],
    ['PIERCE', format(run.player.pierce)], ['CRIT', `${Math.round(run.player.criticalChance * 100)}%`],
    ['ARMOR', format(run.player.armor)], ['RESERVES', `${run.lives}/2`],
  ];
  dom.buildSummary.replaceChildren(...build.map(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'build-chip';
    const small = document.createElement('small');
    small.textContent = label;
    const bold = document.createElement('b');
    bold.textContent = value;
    item.append(small, bold);
    return item;
  }));
  renderShop();
}

function renderShop() {
  dom.shopGrid.replaceChildren();
  for (const item of SHOP_CATALOG) {
    const count = run.purchaseCounts[item.id] || 0;
    const tier = upgradeTier(run, item.id);
    const capped = item.id === 'extraLife' ? run.lives >= 2 : tier >= item.maxTier;
    const cost = shopPrice(item.id, count);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `shop-item tone-${item.tone}${capped ? ' capped' : ''}`;
    button.dataset.shop = item.id;
    button.disabled = capped;
    const image = document.createElement('img');
    image.src = item.asset;
    image.alt = '';
    const copy = document.createElement('span');
    copy.className = 'shop-copy';
    const title = document.createElement('b');
    title.textContent = item.title;
    const detail = document.createElement('span');
    detail.textContent = item.short;
    const rank = document.createElement('small');
    rank.textContent = capped ? 'MAXIMUM' : `TIER ${tier}/${item.maxTier}`;
    copy.append(title, detail, rank);
    const price = document.createElement('span');
    price.className = 'shop-cost';
    price.textContent = capped ? 'MAX' : `◆${cost}`;
    button.append(image, copy, price);
    button.onclick = () => buyFromShop(item.id);
    dom.shopGrid.append(button);
  }
}

function buyFromShop(id) {
  if (state !== GAME_STATE.PAUSED) return false;
  const result = purchaseUpgrade(run, id);
  if (!result.ok) {
    setText(dom.shopMessage, result.reason === 'insufficient' ? `Need ${result.cost} skill points` : 'Upgrade is at maximum');
    return false;
  }
  run = result.session;
  setText(dom.shopMessage, `${SHOP_CATALOG.find(item => item.id === id).title} acquired`);
  updateHud(true);
  return true;
}

function updateDifficultyPicker() {
  for (const option of dom.difficultyPicker.querySelectorAll('[data-difficulty]')) {
    const selected = option.dataset.difficulty === selectedDifficulty;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', String(selected));
  }
  setText(dom.playDifficulty, `${DIFFICULTIES[selectedDifficulty].label.toUpperCase()} RUN`);
}

function selectDifficulty(value) {
  selectedDifficulty = normalizeDifficulty(value);
  updateDifficultyPicker();
}

function drawStaticEnvironment(target) {
  const horizon = sceneHorizon();
  const profile = cameraProfile();
  target.clearRect(0, 0, W, H);
  const sky = target.createLinearGradient(0, 0, 0, horizon + H * .12);
  sky.addColorStop(0, '#159bd6');
  sky.addColorStop(.48, '#66c8ec');
  sky.addColorStop(1, '#d8f2f3');
  target.fillStyle = sky;
  target.fillRect(0, 0, W, horizon + H * .13);

  target.save();
  target.globalAlpha = .55;
  target.fillStyle = '#f8fdff';
  for (const side of [-1, 1]) {
    const cx = W / 2 + side * W * .34;
    const cy = horizon - H * .028;
    for (const [dx, dy, rx, ry] of [[-45, 5, 42, 12], [-15, -3, 35, 18], [19, 2, 44, 14], [52, 7, 28, 10]]) {
      target.beginPath();
      target.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
      target.fill();
    }
  }
  target.restore();

  const water = target.createLinearGradient(0, horizon, 0, H);
  water.addColorStop(0, '#20bddf');
  water.addColorStop(.28, '#079fc9');
  water.addColorStop(.68, '#057fae');
  water.addColorStop(1, '#05638d');
  target.fillStyle = water;
  target.fillRect(0, horizon, W, H - horizon);
  const ocean = runtimeAssets.oceanSurface;
  if (ocean) {
    const pattern = target.createPattern(ocean, 'repeat');
    if (pattern) {
      target.save();
      target.globalAlpha = .22;
      target.globalCompositeOperation = 'screen';
      target.scale(1.35, 1.35);
      target.fillStyle = pattern;
      target.fillRect(0, horizon / 1.35, W / 1.35, (H - horizon) / 1.35);
      target.restore();
    }
  }
  const haze = target.createLinearGradient(0, horizon - H * .035, 0, horizon + H * .085);
  haze.addColorStop(0, 'rgba(234,250,251,0)');
  haze.addColorStop(.46, 'rgba(234,250,251,.68)');
  haze.addColorStop(1, 'rgba(164,223,232,0)');
  target.fillStyle = haze;
  target.fillRect(0, horizon - H * .04, W, H * .13);

  const bridgePoint = (side, y, scale = 1) => ({ x: W / 2 + side * bridgeHalfWidth(y) * scale, y: perspectiveY(y) });
  const roadPoint = (side, y) => ({ x: W / 2 + side * roadHalfWidth(y), y: perspectiveY(y) });
  const poly = (leftScale, rightScale, fill) => {
    target.beginPath();
    for (let index = 0; index <= 24; index += 1) {
      const y = index / 24;
      const point = bridgePoint(-1, y, leftScale);
      index ? target.lineTo(point.x, point.y) : target.moveTo(point.x, point.y);
    }
    for (let index = 24; index >= 0; index -= 1) {
      const y = index / 24;
      const point = bridgePoint(1, y, rightScale);
      target.lineTo(point.x, point.y);
    }
    target.closePath();
    target.fillStyle = fill;
    target.fill();
  };

  target.fillStyle = 'rgba(15,61,79,.21)';
  target.beginPath();
  const shadowFarL = bridgePoint(-1, 0, 1.12);
  const shadowFarR = bridgePoint(1, 0, 1.12);
  const shadowNearR = bridgePoint(1, 1, 1.12);
  const shadowNearL = bridgePoint(-1, 1, 1.12);
  target.moveTo(shadowFarL.x + 18, shadowFarL.y + 9);
  target.lineTo(shadowFarR.x + 18, shadowFarR.y + 9);
  target.lineTo(shadowNearR.x + 35, shadowNearR.y + 30);
  target.lineTo(shadowNearL.x + 35, shadowNearL.y + 30);
  target.closePath();
  target.fill();

  poly(1.035, 1.035, '#6d7477');
  target.save();
  target.translate(0, -lerp(4, 20, profile.exponent - .9));
  poly(1, 1, '#c3c0b8');
  target.restore();

  target.beginPath();
  for (let index = 0; index <= 24; index += 1) {
    const y = index / 24;
    const point = roadPoint(-1, y);
    index ? target.lineTo(point.x, point.y) : target.moveTo(point.x, point.y);
  }
  for (let index = 24; index >= 0; index -= 1) {
    const point = roadPoint(1, index / 24);
    target.lineTo(point.x, point.y);
  }
  target.closePath();
  const road = target.createLinearGradient(W * .28, horizon, W * .7, H);
  road.addColorStop(0, '#6c7070');
  road.addColorStop(.55, '#53595a');
  road.addColorStop(1, '#3d4446');
  target.fillStyle = road;
  target.fill();
  const asphalt = runtimeAssets.asphalt;
  if (asphalt) {
    target.save();
    target.clip();
    target.globalAlpha = .26;
    target.globalCompositeOperation = 'multiply';
    const pattern = target.createPattern(asphalt, 'repeat');
    if (pattern) { target.fillStyle = pattern; target.fillRect(0, horizon, W, H - horizon); }
    target.restore();
  }

  for (const side of [-1, 1]) {
    target.strokeStyle = 'rgba(250,248,234,.9)';
    target.lineWidth = Math.max(1.5, W * .0022);
    target.beginPath();
    for (let index = 0; index <= 24; index += 1) {
      const point = roadPoint(side, index / 24);
      index ? target.lineTo(point.x, point.y) : target.moveTo(point.x, point.y);
    }
    target.stroke();
  }

  drawBridgeStructure(target, bridgePoint, profile);
}

function drawBridgeStructure(target, bridgePoint, profile) {
  const red = '#db433c';
  const dark = '#8e272c';
  const deep = '#661d24';
  const light = '#f2765d';
  const towers = [profile.towerFar, profile.towerNear];
  const railHeight = y => lerp(5, Math.min(43, H * .055), Math.pow(clamp(y, 0, 1), .78));
  const railTop = (side, y) => {
    const point = bridgePoint(side, y, 1.035);
    return { x: point.x, y: point.y - railHeight(y) };
  };
  const towerHeight = y => Math.min(H * (y === profile.towerNear ? .55 : .34), bridgeHalfWidth(y) * (y === profile.towerNear ? 1.42 : 1.58));
  const cableY = y => {
    const far = towers[0];
    const near = towers[1];
    if (y <= far) {
      const t = clamp(y / far, 0, 1);
      return lerp(sceneHorizon(), perspectiveY(far) - towerHeight(far), t) - Math.sin(Math.PI * t) * H * .014;
    }
    if (y <= near) {
      const t = (y - far) / (near - far);
      return lerp(perspectiveY(far) - towerHeight(far), perspectiveY(near) - towerHeight(near), t) + Math.sin(Math.PI * t) * H * .062;
    }
    const t = (y - near) / (1 - near);
    return lerp(perspectiveY(near) - towerHeight(near), railTop(1, 1).y, t) + Math.sin(Math.PI * t) * H * .045;
  };

  for (const side of [-1, 1]) {
    target.fillStyle = dark;
    target.beginPath();
    for (let index = 0; index <= 28; index += 1) {
      const y = index / 28;
      const point = bridgePoint(side, y, 1.02);
      index ? target.lineTo(point.x, point.y + lerp(1, 9, y)) : target.moveTo(point.x, point.y);
    }
    for (let index = 28; index >= 0; index -= 1) {
      const y = index / 28;
      const point = bridgePoint(side, y, .975);
      target.lineTo(point.x, point.y + lerp(2, 14, y));
    }
    target.closePath();
    target.fill();
    for (let index = 0; index < 14; index += 1) {
      const y0 = index / 14;
      const y1 = (index + 1) / 14;
      const a = bridgePoint(side, y0, 1.02);
      const b = bridgePoint(side, y1, 1.02);
      target.strokeStyle = index % 2 ? deep : red;
      target.lineWidth = lerp(1, 4, y1);
      target.beginPath();
      target.moveTo(a.x, a.y + lerp(2, 15, y0));
      target.lineTo(b.x, b.y + 2);
      target.stroke();
    }
  }

  for (const side of [-1, 1]) {
    for (let index = 1; index < 22; index += 1) {
      const y = index / 22;
      const top = railTop(side, y);
      const cable = cableY(y);
      if (cable >= top.y) continue;
      target.strokeStyle = `rgba(127,31,36,${lerp(.5,.92,y)})`;
      target.lineWidth = lerp(.7, 2.2, y);
      target.beginPath();
      target.moveTo(top.x, cable);
      target.lineTo(top.x, top.y);
      target.stroke();
    }
    target.beginPath();
    for (let index = 0; index <= 70; index += 1) {
      const y = index / 70;
      const point = railTop(side, y);
      index ? target.lineTo(point.x, cableY(y)) : target.moveTo(point.x, cableY(y));
    }
    target.strokeStyle = deep;
    target.lineWidth = Math.max(3, W * .0034);
    target.stroke();
    target.strokeStyle = light;
    target.lineWidth = Math.max(1, W * .0012);
    target.stroke();
  }

  for (const y of towers) {
    const baseY = perspectiveY(y);
    const height = towerHeight(y);
    const topY = baseY - height;
    const depth = clamp(depthCurve(y), 0, 1);
    const pillarW = lerp(Math.max(8, W * .009), Math.min(34, W * .027), Math.pow(depth, .5));
    const beamH = lerp(7, 18, Math.pow(depth, .6));
    const xs = [-1, 1].map(side => bridgePoint(side, y, 1.055).x);
    for (const [index, x] of xs.entries()) {
      const side = index ? 1 : -1;
      const outer = side * pillarW * .13;
      const gradient = target.createLinearGradient(x - pillarW, 0, x + pillarW, 0);
      gradient.addColorStop(0, deep);
      gradient.addColorStop(.35, red);
      gradient.addColorStop(.72, light);
      gradient.addColorStop(1, dark);
      target.fillStyle = gradient;
      target.beginPath();
      target.moveTo(x - pillarW * .6, baseY + 5);
      target.lineTo(x + pillarW * .6, baseY + 5);
      target.lineTo(x + pillarW * .43 + outer, topY);
      target.lineTo(x - pillarW * .43 + outer, topY);
      target.closePath();
      target.fill();
      target.fillStyle = '#707779';
      target.fillRect(x - pillarW * .82, baseY - 2, pillarW * 1.64, beamH * .55);
      target.fillStyle = dark;
      target.fillRect(x - pillarW * .62, baseY - beamH * .38, pillarW * 1.24, beamH * .48);
    }
    target.fillStyle = deep;
    target.fillRect(xs[0] - pillarW * .16, topY - beamH * .12, xs[1] - xs[0] + pillarW * .32, beamH * 1.2);
    target.fillStyle = red;
    target.fillRect(xs[0], topY, xs[1] - xs[0], beamH * .7);
    target.fillStyle = light;
    target.globalAlpha = .55;
    target.fillRect(xs[0] + pillarW * .15, topY + beamH * .08, xs[1] - xs[0] - pillarW * .3, Math.max(1, beamH * .12));
    target.globalAlpha = 1;
  }

  for (const side of [-1, 1]) {
    for (const level of [1, .48]) {
      target.beginPath();
      for (let index = 0; index <= 36; index += 1) {
        const y = index / 36;
        const point = bridgePoint(side, y, 1.035);
        const yy = point.y - railHeight(y) * level;
        index ? target.lineTo(point.x, yy) : target.moveTo(point.x, yy);
      }
      target.strokeStyle = level === 1 ? red : dark;
      target.lineWidth = level === 1 ? Math.max(2.5, W * .0031) : Math.max(1.5, W * .002);
      target.stroke();
    }
    for (let index = 1; index < 25; index += 1) {
      const y = index / 25;
      const point = bridgePoint(side, y, 1.035);
      target.strokeStyle = dark;
      target.lineWidth = lerp(.8, 2.6, y);
      target.beginPath();
      target.moveTo(point.x, point.y + 2);
      target.lineTo(point.x, point.y - railHeight(y));
      target.stroke();
    }
  }

  for (const side of [-1, 1]) {
    for (const y of [.2, .58, .85]) {
      const base = bridgePoint(side, y, 1.075);
      const depth = clamp(depthCurve(y), 0, 1);
      const postHeight = lerp(12, 53, Math.pow(depth, .62));
      const arm = lerp(4, 14, Math.pow(depth, .62));
      target.strokeStyle = '#23343b';
      target.lineWidth = lerp(1, 3.6, depth);
      target.lineCap = 'round';
      target.beginPath();
      target.moveTo(base.x, base.y);
      target.lineTo(base.x, base.y - postHeight);
      target.quadraticCurveTo(base.x, base.y - postHeight - arm * .35, base.x - side * arm, base.y - postHeight - arm * .35);
      target.stroke();
      target.fillStyle = '#ffe5a1';
      target.beginPath();
      target.ellipse(base.x - side * arm, base.y - postHeight, arm * .45, arm * .25, 0, 0, Math.PI * 2);
      target.fill();
    }
  }
}

function ensureEnvironment() {
  if (!environmentDirty) return;
  const target = environmentCanvas.getContext('2d', { alpha: false });
  target.setTransform(backgroundDpr, 0, 0, backgroundDpr, 0, 0);
  drawStaticEnvironment(target);
  environmentDirty = false;
}

function drawDynamicEnvironment() {
  const horizon = sceneHorizon();
  const waterClock = ambientTime * 18;
  ctx.save();
  ctx.lineCap = 'round';
  const glintCount = stressMode ? 16 : 34;
  for (let index = 0; index < glintCount; index += 1) {
    const depth = ((index * 37 + waterClock * (1 + index % 3) * .1) % 100) / 100;
    const y = horizon + depth * (H - horizon);
    const side = index % 2 ? -1 : 1;
    const center = W / 2 + side * lerp(W * .19, W * .47, ((index * 53) % 97) / 97);
    const width = lerp(5, 34, depth) * (.75 + (index % 5) * .09);
    ctx.strokeStyle = `rgba(225,251,255,${lerp(.14,.44,depth)})`;
    ctx.lineWidth = lerp(.6, 1.8, depth);
    ctx.beginPath();
    ctx.moveTo(center - width / 2, y);
    ctx.quadraticCurveTo(center, y - lerp(.5, 3, depth), center + width / 2, y);
    ctx.stroke();
  }
  ctx.restore();

  const phase = (roadScroll / 720) % .12;
  for (const separator of [-.29, .29]) {
    for (let index = -1; index < 11; index += 1) {
      const y0 = index * .12 + phase;
      const y1 = y0 + .05;
      if (y1 <= 0 || y0 >= 1) continue;
      const a = clamp(y0, 0, 1);
      const b = clamp(y1, 0, 1);
      const start = worldToScreen(separator, a);
      const end = worldToScreen(separator, b);
      const w0 = lerp(1, 3.3, a);
      const w1 = lerp(1, 4, b);
      ctx.fillStyle = 'rgba(247,248,239,.9)';
      ctx.beginPath();
      ctx.moveTo(start.x - w0, start.y);
      ctx.lineTo(start.x + w0, start.y);
      ctx.lineTo(end.x + w1, end.y);
      ctx.lineTo(end.x - w1, end.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawHomeHero() {
  const image = runtimeAssets.homeHero;
  if (!image) return;
  const portrait = W < H;
  const height = portrait ? Math.min(H * .34, 300) : Math.min(H * .76, 585);
  const x = portrait ? W * .23 : W * .22;
  const y = portrait ? H * 1.01 : H * 1.005;
  const width = height * image.width / image.height;
  ctx.fillStyle = 'rgba(7,33,43,.24)';
  ctx.beginPath();
  ctx.ellipse(x, y, width * .34, height * .032, 0, 0, Math.PI * 2);
  ctx.fill();
  drawSprite(image, x, y, height);
}

function drawSprite(image, x, y, height) {
  const width = height * image.width / image.height;
  ctx.drawImage(image, x - width / 2, y - height, width, height);
}

function gateVisual(gate) {
  const y = gate.encounter.y;
  const center = worldToScreen(gate.x, y);
  const left = worldToScreen(laneBounds(gate.lane, .016).min, y);
  const right = worldToScreen(laneBounds(gate.lane, .016).max, y);
  const width = Math.max(22, right.x - left.x);
  const panelHeight = clamp(width * .54, 21, H * .1);
  const frameHeight = panelHeight * 1.42;
  const fade = gate.encounter.resolved ? clamp((1.04 - y) / .16, 0, 1) : 1;
  return { y, center, left, right, width, panelHeight, frameHeight, deckY: center.y, topY: center.y - frameHeight, fade };
}

function gatePalette(tone) {
  if (tone === 'red') return ['#f34f4d', '#ff7b65', '#911d27', '#60151d'];
  if (tone === 'gold') return ['#f3b52d', '#ffe069', '#a96208', '#6d3c05'];
  if (tone === 'purple') return ['#a65ae5', '#d69aff', '#643092', '#3d1b61'];
  if (tone === 'steel') return ['#699bb4', '#b7d8e6', '#385c70', '#233e4e'];
  return ['#168fe8', '#42d5ff', '#07538f', '#06345b'];
}

function drawGate(gate, foreground = false) {
  const visual = gateVisual(gate);
  if (visual.fade <= 0 || (foreground && (visual.y < .78 || visual.y > .99))) return;
  if (!foreground && visual.y > .78) return;
  const [main, bright, dark, deep] = gatePalette(gate.tone);
  const postWidth = clamp(visual.width * .085, 5, 16);
  const railHeight = clamp(visual.panelHeight * .14, 4, 11);
  const panelTop = visual.topY + visual.frameHeight * .15;
  const panelBottom = visual.deckY - visual.frameHeight * .13;
  ctx.save();
  ctx.globalAlpha = visual.fade;
  ctx.fillStyle = foreground ? dark : `color-mix(in srgb, ${main} 76%, transparent)`;
  if (!foreground) {
    const fill = ctx.createLinearGradient(0, panelTop, 0, panelBottom);
    fill.addColorStop(0, main);
    fill.addColorStop(.5, bright);
    fill.addColorStop(1, main);
    ctx.globalAlpha = visual.fade * .82;
    ctx.fillStyle = fill;
    ctx.fillRect(visual.left.x + postWidth * .45, panelTop, visual.right.x - visual.left.x - postWidth * .9, panelBottom - panelTop);
    ctx.globalAlpha = visual.fade;
  }
  for (const x of [visual.left.x, visual.right.x]) {
    ctx.fillStyle = deep;
    ctx.beginPath();
    ctx.roundRect(x - postWidth * .66, visual.deckY - railHeight * .08, postWidth * 1.32, railHeight * .72, railHeight * .18);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.roundRect(x - postWidth / 2, visual.topY, postWidth, visual.frameHeight, postWidth * .2);
    ctx.fill();
    ctx.fillStyle = main;
    ctx.fillRect(x - postWidth * .22, visual.topY + railHeight * .48, postWidth * .44, visual.frameHeight * .68);
  }
  ctx.fillStyle = dark;
  ctx.fillRect(visual.left.x - postWidth * .2, visual.topY, visual.right.x - visual.left.x + postWidth * .4, railHeight);
  ctx.fillStyle = main;
  ctx.fillRect(visual.left.x, visual.topY, visual.right.x - visual.left.x, railHeight * .57);
  if (!foreground) {
    let fontSize = clamp(visual.panelHeight * .43, 10, 31);
    ctx.font = `1000 ${fontSize}px system-ui`;
    const limit = visual.width - postWidth * 2.3;
    while (fontSize > 9 && ctx.measureText(gateText(gate)).width > limit) {
      fontSize -= 1;
      ctx.font = `1000 ${fontSize}px system-ui`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = clamp(fontSize * .14, 2, 5);
    ctx.strokeStyle = 'rgba(20,23,28,.78)';
    ctx.fillStyle = '#fff';
    const textY = lerp(panelTop, panelBottom, .47);
    ctx.strokeText(gateText(gate), visual.center.x, textY);
    ctx.fillText(gateText(gate), visual.center.x, textY);
    ctx.font = `950 ${Math.max(6, fontSize * .28)}px system-ui`;
    ctx.fillStyle = '#eaf9ff';
    ctx.fillText(gate.subtitle || 'TRADEOFF', visual.center.x, textY + fontSize * .55);
  }
  ctx.restore();
}

function drawGates() {
  for (const encounter of run.gates) {
    if (!encounter.resolved) {
      const center = worldToScreen(laneCenter(encounter.neutralLane), encounter.y);
      const size = clamp(laneHalfWidth(encounter.y) * .08, 6, 18);
      ctx.save();
      ctx.globalAlpha = clamp((encounter.y + .1) * 1.8, .25, .75);
      ctx.fillStyle = '#9deeff';
      ctx.font = `950 ${size}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('SAFE', center.x, center.y - size * .5);
      ctx.restore();
    }
    for (const gate of encounter.gates) drawGate(gate, false);
  }
}

function drawGateForeground() {
  for (const encounter of run.gates) for (const gate of encounter.gates) drawGate(gate, true);
}

function enemyHeightAt(y, type = 'grunt') {
  const y0 = clamp(y, -.02, .98);
  const projected = Math.abs(perspectiveY(clamp(y0 + .072, 0, 1.04)) - perspectiveY(y0));
  const base = clamp(projected, 15, 69);
  return base * (TYPE_STATS[type]?.scale || 1);
}

function enemyMarchFrame(enemy) {
  const clock = state === GAME_STATE.BOSS ? run.bossTime : run.waveTime;
  return ((Math.floor(clock * (enemy.type === 'heavy' ? 6 : 8) + enemy.bob) % 4) + 4) % 4;
}

function enemySpriteName(enemy) {
  const frame = enemyMarchFrame(enemy) + 1;
  if (enemy.type === 'heavy') return `enemyElite${frame}`;
  if (enemy.type === 'shield' || enemy.type === 'demolition') return `enemySpecial${frame}`;
  return `enemyGrunt${frame}`;
}

function drawEnemy(enemy) {
  const y = lerp(enemy.previousY ?? enemy.y, enemy.y, renderAlpha);
  const screen = projectToScreen(enemy.x, y, projectionScratchA);
  const height = enemyHeightAt(y, enemy.type);
  const fade = enemy.dead ? clamp(enemy.deathLife / .28, 0, 1) : 1;
  const imageName = enemySpriteName(enemy);
  const fullImage = runtimeAssets[imageName];
  const image = height < 76 ? lodAssets[imageName] || fullImage : fullImage;
  const clock = state === GAME_STATE.BOSS ? run.bossTime : run.waveTime;
  const bob = Math.sin(clock * 8 + enemy.bob) * height * .006;
  const baseline = screen.y + bob;
  if (!enemy.dead && image) {
    if (!stressMode && height > 23) {
      ctx.fillStyle = 'rgba(22,25,28,.24)';
      ctx.beginPath();
      ctx.ellipse(screen.x, baseline + 2, height * .21, height * .048, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(image, screen.x, baseline, height);
    if (enemy.type === 'gunner') {
      ctx.fillStyle = '#ffbe43';
      ctx.beginPath();
      ctx.arc(screen.x - height * .18, baseline - height * .56, height * .055, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.type === 'demolition') {
      ctx.strokeStyle = '#ffbc39';
      ctx.lineWidth = Math.max(1.5, height * .025);
      ctx.beginPath();
      ctx.arc(screen.x, baseline - height * .42, height * .1, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(enemy.hitFlash / .08, 0, 1) * .42;
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(screen.x, baseline - height * .44, height * .22, height * .42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(screen.x, baseline + (enemy.dead ? (1 - fade) * height * .08 : 0));
    if (enemy.dead) ctx.rotate((1 - fade) * (enemy.x >= 0 ? .14 : -.14));
    if (image) drawSprite(image, 0, 0, height);
    else drawEnemyCombatant(ctx, enemy, { x: 0, y: 0 }, height, clock);
    ctx.restore();
  }
  if (!enemy.dead && (enemy.hp < enemy.maxHp || enemy.shield > 0)) {
    const width = Math.max(14, height * .52);
    const barY = screen.y - height * 1.02;
    ctx.fillStyle = 'rgba(17,18,22,.7)';
    ctx.fillRect(screen.x - width / 2, barY, width, Math.max(2, height * .045));
    ctx.fillStyle = enemy.shield > 0 ? '#5de4ff' : '#ff6758';
    const total = enemy.maxHp + enemy.maxShield;
    ctx.fillRect(screen.x - width / 2, barY, width * clamp((enemy.hp + enemy.shield) / total, 0, 1), Math.max(2, height * .045));
  }
  if (enemy.shotFlash > 0) {
    ctx.fillStyle = '#fff0a1';
    ctx.beginPath();
    ctx.arc(screen.x + height * .22, screen.y - height * .44, height * .04, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBoss() {
  const boss = run.boss;
  if (!boss) return;
  const y = lerp(boss.previousY, boss.y, renderAlpha);
  const screen = projectToScreen(boss.x, y, projectionScratchA);
  const height = clamp(enemyHeightAt(y, 'heavy') * 3.55, 112, Math.min(245, H * .34, W * .43));
  const bob = Math.sin(run.bossTime * 3.3) * height * .008;
  const bossImage = height < 270 ? lodAssets.boss || runtimeAssets.boss : runtimeAssets.boss;
  if (bossImage) {
    ctx.save();
    ctx.translate(screen.x, screen.y + bob);
    ctx.fillStyle = 'rgba(20,22,25,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, height * .31, height * .065, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(bossImage, 0, 0, height);
    if (boss.phase >= 2) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = boss.phase === 3 ? .2 + .08 * Math.sin(run.bossTime * 9) : .11;
      ctx.fillStyle = boss.phase === 3 ? '#ff4b33' : '#ff9b45';
      ctx.beginPath();
      ctx.ellipse(0, -height * .44, height * .33, height * .46, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (boss.hitFlash > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = clamp(boss.hitFlash / .085, 0, 1) * .42;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, -height * .45, height * .3, height * .43, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else drawBossCombatant(ctx, screen, height, boss.hitFlash, run.bossTime);
  if (boss.shotFlash > 0) {
    ctx.fillStyle = '#fff0a8';
    ctx.beginPath();
    ctx.arc(screen.x + height * .29, screen.y - height * .46, height * .05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of run.enemies) drawEnemy(enemy);
  drawBoss();
}

function drawTelegraphs() {
  for (const warning of run.telegraphs) {
    const bounds = laneBounds(warning.lane, .012);
    const farLeft = worldToScreen(bounds.min, Math.max(.1, warning.source?.y || .17));
    const farRight = worldToScreen(bounds.max, Math.max(.1, warning.source?.y || .17));
    const nearLeft = worldToScreen(bounds.min, .99);
    const nearRight = worldToScreen(bounds.max, .99);
    const urgency = 1 - warning.time / warning.maxTime;
    ctx.save();
    ctx.globalAlpha = .16 + urgency * .32 + Math.sin(ambientTime * 18) * .05;
    ctx.fillStyle = warning.kind === 'demolition' ? '#ffb52f' : '#ff3f38';
    ctx.beginPath();
    ctx.moveTo(farLeft.x, farLeft.y);
    ctx.lineTo(farRight.x, farRight.y);
    ctx.lineTo(nearRight.x, nearRight.y);
    ctx.lineTo(nearLeft.x, nearLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = .82;
    ctx.strokeStyle = '#ffe16a';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo((farLeft.x + farRight.x) / 2, farLeft.y);
    ctx.lineTo((nearLeft.x + nearRight.x) / 2, nearLeft.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemyBullets() {
  ctx.save();
  ctx.lineCap = 'round';
  for (const bullet of run.enemyBullets) {
    const x = lerp(bullet.previousX, bullet.x, renderAlpha);
    const y = lerp(bullet.previousY, bullet.y, renderAlpha);
    const screen = projectToScreen(x, y, projectionScratchA);
    const previous = projectToScreen(bullet.previousX, bullet.previousY, projectionScratchB);
    const size = lerp(2, 5.5, clamp(y, 0, 1)) * (bullet.kind === 'hazard' ? 1.5 : 1);
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = Math.max(2, size * .7);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(screen.x, screen.y);
    ctx.stroke();
    ctx.fillStyle = '#fff0c1';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * .42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayerBullets() {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = run.frenzyTimer > 0 ? '#fff2a4' : '#ffc33f';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  const stride = stressMode && run.bullets.length > 540 ? 2 : 1;
  for (let index = 0; index < run.bullets.length; index += stride) {
    const bullet = run.bullets[index];
    const x = lerp(bullet.previousX, bullet.x, renderAlpha);
    const y = lerp(bullet.previousY, bullet.y, renderAlpha);
    const head = projectToScreen(x, y, projectionScratchA);
    const tail = projectToScreen(lerp(bullet.previousX, x, .1), lerp(bullet.previousY, y, .1), projectionScratchB);
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  if (run.player.troops <= 0) return;
  const slots = squadLogicalSlots();
  const activeFlashes = new Set(run.muzzleFlashes.map(flash => flash.slot));
  for (const slot of slots) {
    const worldX = squadSlotWorldX(slot);
    const screen = projectToScreen(worldX, slot.y, projectionScratchA);
    const height = soldierHeightAt(slot.y);
    const frame = ((Math.floor((run.waveTime + run.bossTime + ambientTime * .1) * 10.5 + slot.phase) % 4) + 4) % 4;
    const imageName = `playerRun${frame + 1}`;
    const image = height < 90 ? lodAssets[imageName] || runtimeAssets[imageName] : runtimeAssets[imageName];
    const shooting = activeFlashes.has(slot.index);
    const bob = Math.sin((run.waveTime + run.bossTime) * 10.5 + slot.phase) * height * .016;
    if (image) {
      const baseline = screen.y + bob + (shooting ? height * .012 : 0);
      const lean = run.player._visualLean || 0;
      if (Math.abs(lean) < .001) {
        if (!stressMode && height > 24) {
          ctx.fillStyle = 'rgba(12,31,39,.23)';
          ctx.beginPath();
          ctx.ellipse(screen.x, baseline + 2, height * .18, height * .043, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        drawSprite(image, screen.x, baseline, height);
        if (shooting) {
          ctx.fillStyle = '#fff3a8';
          ctx.beginPath();
          ctx.arc(screen.x - height * .25, baseline - height * .55, height * .045, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.save();
        ctx.translate(screen.x, baseline);
        ctx.rotate(lean);
        drawSprite(image, 0, 0, height);
        ctx.restore();
      }
    } else drawBlueSoldier(ctx, screen, height, run.waveTime + run.bossTime, slot.phase, shooting, run.player._visualLean || 0);
  }
  const label = worldToScreen(run.player.x, .965);
  ctx.font = `1000 ${clamp(W * .035, 19, 31)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,.58)';
  ctx.fillStyle = '#fff';
  ctx.strokeText(String(run.player.troops), label.x, label.y);
  ctx.fillText(String(run.player.troops), label.x, label.y);
  if (run.player.protectedFor > 0) {
    const radius = clamp(W * .08, 34, 82) * (1 + Math.sin(ambientTime * 8) * .04);
    ctx.strokeStyle = 'rgba(105,229,255,.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(label.x, label.y - radius * .45, radius, radius * .42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEffects() {
  for (const particle of run.particles) {
    const x = lerp(particle.previousX, particle.x, renderAlpha);
    const y = lerp(particle.previousY, particle.y, renderAlpha);
    const screen = projectToScreen(x, y, projectionScratchA);
    ctx.globalAlpha = clamp(particle.life * 2.2, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const floater of run.floaters) {
    const screen = projectToScreen(floater.x, floater.y, projectionScratchA);
    ctx.globalAlpha = clamp(floater.life, 0, 1);
    ctx.font = `1000 ${floater.size}px system-ui`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,.48)';
    ctx.fillStyle = floater.color;
    ctx.strokeText(floater.text, screen.x, screen.y);
    ctx.fillText(floater.text, screen.x, screen.y);
  }
  ctx.globalAlpha = 1;
  if (run.frenzyTimer > 0) {
    ctx.fillStyle = 'rgba(84,219,255,.07)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `1000 ${clamp(W * .026, 19, 28)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#91ecff';
    ctx.fillText(`FRENZY ${run.frenzyTimer.toFixed(1)}s`, W / 2, H * .29);
  }
}

function draw() {
  ensureEnvironment();
  ctx.clearRect(0, 0, W, H);
  drawDynamicEnvironment();
  if (state === GAME_STATE.HOME) {
    drawHomeHero();
    return;
  }
  drawTelegraphs();
  drawGates();
  drawEnemies();
  drawEnemyBullets();
  drawPlayerBullets();
  drawPlayer();
  drawGateForeground();
  drawEffects();
}

function pointerMove(clientX) {
  if (!ACTIVE_STATES.includes(state)) return;
  run.player.targetX = clamp((clientX - W / 2) / Math.max(1, laneHalfWidth(.9)), -LANE_LIMIT, LANE_LIMIT);
}

addEventListener('keydown', event => {
  keys[event.key] = true;
  const isSpace = event.code === 'Space' || event.key === ' ';
  if (['ArrowLeft', 'ArrowRight', ' ', 'p', 'P'].includes(event.key) || isSpace) event.preventDefault();
  if (isSpace && !event.repeat) {
    if (state === GAME_STATE.HOME) startRun();
    else if (state === GAME_STATE.PAUSED) resumeGame();
    else if (ACTIVE_STATES.includes(state)) pauseGame();
  } else if (event.key === 'Enter' && state === GAME_STATE.HOME) startRun();
  else if (event.key.toLowerCase() === 'p' && !event.repeat) state === GAME_STATE.PAUSED ? resumeGame() : pauseGame();
});
addEventListener('keyup', event => { keys[event.key] = false; });
canvas.addEventListener('pointerdown', event => {
  if (!ACTIVE_STATES.includes(state)) return;
  pointerActive = true;
  canvas.setPointerCapture?.(event.pointerId);
  pointerMove(event.clientX);
});
canvas.addEventListener('pointermove', event => {
  if (pointerActive || (event.pointerType === 'mouse' && ACTIVE_STATES.includes(state))) pointerMove(event.clientX);
});
addEventListener('pointerup', () => { pointerActive = false; });
addEventListener('pointercancel', () => { pointerActive = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && ACTIVE_STATES.includes(state)) pauseGame(); });

dom.difficultyPicker.addEventListener('click', event => {
  const option = event.target.closest('[data-difficulty]');
  if (option) selectDifficulty(option.dataset.difficulty);
});
dom.playBtn.onclick = () => startRun(Date.now() >>> 0, selectedDifficulty);
dom.pauseBtn.onclick = () => state === GAME_STATE.PAUSED ? resumeGame() : pauseGame();
dom.resumeBtn.onclick = resumeGame;
dom.restartBtn.onclick = () => startRun(Date.now() >>> 0, run.difficulty);
dom.retryBtn.onclick = () => startRun(Date.now() >>> 0, run.difficulty);
dom.gameOverHomeBtn.onclick = returnHome;

function getStateSnapshot() {
  const activeEnemies = run.enemies.filter(enemy => !enemy.dead);
  return {
    state, phase: state, paused: state === GAME_STATE.PAUSED, resumeState,
    seed: run.seed, difficulty: run.difficulty, wave: run.wave,
    waveTime: run.waveTime, waveDuration: config.duration, bossTime: run.bossTime,
    score: run.score, skillPoints: run.skillPoints, lives: run.lives, kills: run.kills,
    troops: run.player.troops, armor: run.player.armor, power: run.player.power,
    fireRate: run.player.fireRate, bulletSpeed: run.player.bulletSpeed,
    projectiles: run.player.projectiles, pierce: run.player.pierce,
    criticalChance: run.player.criticalChance, formationDensity: run.player.formationDensity,
    recovery: run.player.recovery, protectedFor: run.player.protectedFor,
    visibleSquad: visibleSquadCount(Math.max(1, run.player.troops), run.player.formationDensity),
    playerX: run.player.x, assetsReady: canvas.dataset.assetsReady,
    renderScale: DPR, bullets: run.bullets.length, enemyBullets: run.enemyBullets.length,
    enemies: run.enemies.length, activeEnemies: activeEnemies.length,
    hordes: new Set(activeEnemies.filter(enemy => enemy.hordeId != null).map(enemy => enemy.hordeId)).size,
    formations: [...new Set(activeEnemies.map(enemy => enemy.formation))],
    sampleBullet: run.bullets[0] ? sampleBullet(run.bullets[0]) : null,
    sampleBullets: run.bullets.slice(0, 90).map(sampleBullet),
    sampleEnemies: activeEnemies.slice(0, 220).map(enemy => ({
      id: enemy.id, type: enemy.type, lane: enemy.lane, x: enemy.x, lineX: enemy.lineX,
      y: enemy.y, speed: enemy.speed, hordeId: enemy.hordeId, hordeRow: enemy.hordeRow,
      formation: enemy.formation, marchFrame: enemyMarchFrame(enemy), hp: enemy.hp, shield: enemy.shield,
    })),
    gates: run.gates.flatMap(encounter => encounter.gates.map(gate => ({
      pairId: encounter.id, lane: gate.lane, neutralLane: encounter.neutralLane,
      x: gate.x, y: encounter.y, w: gate.w, id: gate.id, text: gateText(gate),
      tone: gate.tone, hit: encounter.resolved, selected: encounter.selected,
    }))),
    telegraphs: run.telegraphs.map(warning => ({ lane: warning.lane, x: warning.x, kind: warning.kind, time: warning.time })),
    particles: run.particles.length, floaters: run.floaters.length, muzzleFlashes: run.muzzleFlashes.length,
    boss: run.boss ? { x: run.boss.x, y: run.boss.y, hp: run.boss.hp, maxHp: run.boss.maxHp, phase: run.boss.phase, attackSerial: run.boss.attackSerial } : null,
    purchaseCounts: { ...run.purchaseCounts }, upgradeTiers: { ...run.upgradeTiers },
    pool: Object.fromEntries(Object.entries(pools).map(([name, pool]) => [name, { created: pool.created, free: pool.free.length }])),
  };
}

function sampleBullet(bullet) {
  return {
    x: bullet.x, y: bullet.y, originX: bullet.originX, originY: bullet.originY,
    vx: bullet.vx, vy: bullet.vy, shooter: bullet.shooter, homing: false,
    hitsLeft: bullet.hitsLeft, critical: bullet.critical,
  };
}

function setDebugGateEncounter(options, y = .52, neutralLane = 1) {
  run.gates.length = 0;
  const normalized = options.map((option, index) => ({
    id: option.id || `qa-${index}`, title: option.text || String(option.value), subtitle: option.subtitle || 'QA',
    tone: option.tone || option.color || (String(option.text).startsWith('-') || String(option.text).startsWith('−') ? 'red' : 'blue'),
    effects: option.effects || [{ stat: option.kind === 'power' ? 'power' : 'troops', mode: 'add', value: option.value }],
  }));
  return spawnGateEncounter(normalized, y, neutralLane);
}

function setupStressScene() {
  startRun(909, 'elite');
  run.wave = 24;
  config = getWaveConfig(run.wave, run.difficulty);
  run.player.troops = 60;
  run.player.power = 4;
  run.player.fireRate = 11;
  run.player.projectiles = 3;
  run.player.pierce = 2;
  run.player.protectedFor = 1_000_000;
  releaseAll(run.enemies, pools.enemies);
  for (let index = 0; index < 180; index += 1) {
    const lane = index % 3;
    const local = Math.floor(index / 3);
    const column = local % 4;
    const row = Math.floor(local / 4);
    const bounds = laneBounds(lane, .025);
    const x = lerp(bounds.min, bounds.max, column / 3);
    const type = index % 23 === 0 ? 'demolition' : index % 17 === 0 ? 'heavy' : index % 13 === 0 ? 'shield' : index % 11 === 0 ? 'gunner' : 'grunt';
    spawnEnemy(type, { lane, x, y: .04 + row * .034, hordeId: 1 + Math.floor(index / 45), hordeRow: row, formation: 'stress' });
  }
  run.boss = {
    id: ++enemySerial, type: 'boss', name: 'SCARLET ENGINE', lane: 1, x: 0, y: .29, previousY: .29,
    hp: 1_000_000_000, maxHp: 1_000_000_000, phase: 3, attackTimer: .1, attackSerial: 7, hitFlash: 0, shotFlash: .1, rewarded: false,
  };
  setState(GAME_STATE.BOSS);
  for (let index = 0; index < 5; index += 1) fireBurst();
  for (let lane = 0; lane < 3; lane += 1) addTelegraph(lane, .7 + lane * .12, 'suppression', run.boss, { damage: 2, speed: .56 });
  for (let index = 0; index < 80; index += 1) burst((index % 10 - 5) * .12, .2 + Math.floor(index / 10) * .05, index % 2 ? '#ff604f' : '#ffd04c', 1);
  stressMode = true;
  updateHud(true);
  return getStateSnapshot();
}

const query = new URLSearchParams(location.search);
const captureMode = query.get('capture');
const qaMode = navigator.webdriver || query.has('qa') || Boolean(captureMode);

if (qaMode) {
  globalThis.__blastlineTest = {
    reset(seed = 42, difficulty = selectedDifficulty) { startRun(seed, difficulty); return this.getState(); },
    setDifficulty(value) { run.difficulty = normalizeDifficulty(value); selectedDifficulty = run.difficulty; config = getWaveConfig(run.wave, run.difficulty); updateDifficultyPicker(); updateHud(true); return run.difficulty; },
    setWave(value) { run.wave = clamp(Math.round(Number(value) || 1), 1, 1_000_000); config = getWaveConfig(run.wave, run.difficulty); updateHud(true); return run.wave; },
    setWaveTime(value) { run.waveTime = Math.max(0, Number(value) || 0); return run.waveTime; },
    advance(seconds) { const steps = clamp(Math.ceil((Number(seconds) || 0) / SIM_STEP), 0, 120_000); for (let index = 0; index < steps && ACTIVE_STATES.includes(state); index += 1) update(SIM_STEP); return this.getState(); },
    setTroops(value) { run.player.troops = clamp(Math.round(value), 0, MAX_TROOPS); updateHud(true); return visibleSquadCount(Math.max(1, run.player.troops), run.player.formationDensity); },
    setPower(value) { run.player.power = clamp(Number(value) || 1, 1, 16); updateHud(true); return run.player.power; },
    setPoints(value) { run.skillPoints = Math.max(0, Math.round(Number(value) || 0)); updateHud(true); return run.skillPoints; },
    setLives(value) { run.lives = clamp(Math.round(Number(value) || 0), 0, 2); updateHud(true); return run.lives; },
    setBuild(build = {}) { Object.assign(run.player, build); updateHud(true); return this.getState(); },
    setPlayerX(value) { run.player.x = run.player.targetX = clamp(Number(value) || 0, -LANE_LIMIT, LANE_LIMIT); updateHud(); return run.player.x; },
    fireNow(times = 1) { const counts = []; for (let index = 0; index < clamp(Math.round(times), 1, 100); index += 1) counts.push(fireBurst()); return counts; },
    spawnEnemyAt(type = 'grunt', lane = 1, y = .82, ready = false) { const enemy = spawnEnemy(type, { lane, x: laneCenter(lane), y }); if (enemy && ready) enemy.shotTimer = 0; return enemy ? { type: enemy.type, lane: enemy.lane, x: enemy.x, y: enemy.y, hp: enemy.hp, shield: enemy.shield } : null; },
    spawnFormation(type = 'wall', count) { return spawnFormation(type, count); },
    spawnHordeNow() { return spawnFormation(); },
    setGateEncounter(options, y = .52, neutralLane = 1) { const encounter = setDebugGateEncounter(options, y, neutralLane); return encounter.gates.map(gate => ({ id: gate.id, lane: gate.lane, x: gate.x, text: gateText(gate), tone: gate.tone })); },
    setGatePair(left, right, y = .52) { return this.setGateEncounter([left, right], y, 1); },
    forceBoss() { if (!ACTIVE_STATES.includes(state)) setState(GAME_STATE.PLAYING); spawnBoss(); run.boss.y = run.boss.previousY = .41; updateHud(true); return this.getState(); },
    setBossPhase(value) { if (!run.boss) this.forceBoss(); const phase = clamp(Math.round(value), 1, 3); run.boss.hp = run.boss.maxHp * (phase === 1 ? .9 : phase === 2 ? .55 : .2); updateBossPhase(); updateHud(true); return run.boss.phase; },
    setBossHp(value) { if (run.boss) { run.boss.hp = clamp(Number(value) || 0, 0, run.boss.maxHp); updateBossPhase(); updateHud(true); } return run.boss?.hp ?? null; },
    defeatBoss() { if (!run.boss) this.forceBoss(); run.boss.hp = 0; finishBoss(); return state; },
    chooseReward(id) { return chooseBossReward(id || dom.rewardCards.firstElementChild?.dataset.upgrade); },
    forceReward() { setState(GAME_STATE.BOSS_REWARD); showBossRewards(); return state; },
    purchase(id) { if (state !== GAME_STATE.PAUSED) pauseGame(); return buyFromShop(id); },
    damageTroops(value) { damageSquad(value, run.player.x); return run.player.troops; },
    forceRevival() { run.lives = Math.max(1, run.lives); run.player.troops = 1; damageSquad(99, run.player.x); return this.getState(); },
    forceGameOver() { run.lives = 0; run.player.troops = 1; damageSquad(99, run.player.x); return state; },
    stressScene() { return setupStressScene(); },
    pause() { pauseGame(); return state; },
    resume() { resumeGame(); return state; },
    freeze(value = true) { qaFrozen = Boolean(value); return qaFrozen; },
    projectionAudit() { return bridgeProjectionAudit(); },
    frameMetrics(reset = false) { const sorted = [...frameSamples].sort((a, b) => a - b); const result = { samples: sorted.length, p50: percentile(sorted, .5), p95: percentile(sorted, .95), over50: sorted.length ? sorted.filter(value => value > 50).length / sorted.length : 0, max: sorted.at(-1) || 0 }; if (reset) frameSamples = []; return result; },
    benchmarkDraw(iterations = 120) { const count = clamp(Math.round(iterations), 1, 1000); const start = performance.now(); for (let index = 0; index < count; index += 1) draw(); return (performance.now() - start) / count; },
    benchmarkUpdate(iterations = 120) { const count = clamp(Math.round(iterations), 1, 1000); const start = performance.now(); for (let index = 0; index < count; index += 1) update(SIM_STEP); return (performance.now() - start) / count; },
    benchmarkLayers(iterations = 8) {
      const count = clamp(Math.round(iterations), 1, 40);
      ensureEnvironment();
      const measure = callback => { const start = performance.now(); for (let index = 0; index < count; index += 1) callback(); return (performance.now() - start) / count; };
      return {
        foregroundClear: measure(() => ctx.clearRect(0, 0, W, H)),
        environmentMotion: measure(drawDynamicEnvironment),
        telegraphs: measure(drawTelegraphs),
        enemiesAndBoss: measure(drawEnemies),
        hostileProjectiles: measure(drawEnemyBullets),
        squadProjectiles: measure(drawPlayerBullets),
        squad: measure(drawPlayer),
        effects: measure(drawEffects),
      };
    },
    getWaveConfig(wave = run.wave, difficulty = run.difficulty) { return getWaveConfig(wave, difficulty); },
    getState() { return getStateSnapshot(); },
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
}

function prepareCapture(mode) {
  if (!mode) { returnHome(); return; }
  if (mode === 'home') { returnHome(); qaFrozen = true; return; }
  startRun(700 + mode.length, mode === 'chaos' ? 'elite' : 'veteran');
  if (mode === 'gameplay' || mode === 'horde') {
    run.player.troops = 24;
    spawnFormation('wall', 36);
    for (const enemy of run.enemies) { enemy.y += .17; enemy.previousY = enemy.y; }
    fireBurst();
  } else if (mode === 'gate' || mode === 'lane') {
    run.player.troops = 20;
    setDebugGateEncounter([
      { id: 'rapid-ranks', text: '+16 / −12%', subtitle: 'SQUAD / RATE', tone: 'cyan', effects: [{ stat: 'troops', mode: 'add', value: 16 }, { stat: 'fireRate', mode: 'multiply', value: .88 }] },
      { id: 'fortify', text: '+6 / −2', subtitle: 'ARMOR / SQUAD', tone: 'gold', effects: [{ stat: 'armor', mode: 'add', value: 6 }, { stat: 'troops', mode: 'add', value: -2 }] },
    ], .55, 1);
    spawnFormation('split-lane', 18);
    for (const enemy of run.enemies) { enemy.y += .08; enemy.previousY = enemy.y; }
  } else if (mode === 'dense' || mode === 'large') {
    run.wave = 12;
    config = getWaveConfig(run.wave, run.difficulty);
    run.player.troops = 60;
    spawnFormation('wall', 96);
    for (const enemy of run.enemies) { enemy.y += .09; enemy.previousY = enemy.y; }
    fireBurst();
  } else if (mode === 'boss' || mode === 'boss-phase-1') {
    run.wave = 8;
    config = getWaveConfig(run.wave, run.difficulty);
    run.player.troops = 36;
    spawnBoss();
    run.boss.y = run.boss.previousY = .41;
    fireBurst();
  } else if (mode === 'boss-phase-3') {
    run.wave = 15;
    config = getWaveConfig(run.wave, run.difficulty);
    run.player.troops = 48;
    spawnBoss();
    run.boss.y = run.boss.previousY = .41;
    run.boss.hp = run.boss.maxHp * .2;
    updateBossPhase();
    spawnBossAttack();
    fireBurst();
  } else if (mode === 'reward' || mode === 'upgrade') {
    run.wave = 5;
    run.skillPoints = 8;
    setState(GAME_STATE.BOSS_REWARD);
    showBossRewards();
  } else if (mode === 'shop' || mode === 'pause') {
    run.wave = 7;
    run.skillPoints = 24;
    run.player.troops = 38;
    pauseGame();
  } else if (mode === 'revive') {
    run.wave = 9;
    run.lives = 1;
    run.player.troops = 1;
    damageSquad(9, 0);
    run.recoveryTime = 2.2;
  } else if (mode === 'chaos') {
    setupStressScene();
  } else if (mode === 'gameover' || mode === 'game-over') {
    run.wave = 11;
    run.score = 18420;
    run.kills = 734;
    run.player.troops = 0;
    gameOver();
  }
  qaFrozen = true;
  updateHud(true);
}

function loop(timestamp) {
  const elapsedMs = lastTimestamp ? Math.min(100, timestamp - lastTimestamp) : 0;
  lastTimestamp = timestamp;
  ambientTime += elapsedMs / 1000;
  if (ACTIVE_STATES.includes(state) && !qaFrozen && elapsedMs > 0) {
    frameSamples.push(elapsedMs);
    if (frameSamples.length > 3600) frameSamples.shift();
    accumulator = Math.min(.1, accumulator + elapsedMs / 1000);
    let steps = 0;
    while (accumulator >= SIM_STEP && steps < 2) {
      update(SIM_STEP);
      accumulator -= SIM_STEP;
      steps += 1;
    }
    if (steps === 2 && accumulator >= SIM_STEP) accumulator = 0;
    renderAlpha = accumulator / SIM_STEP;
  } else renderAlpha = 1;
  draw();
  requestAnimationFrame(loop);
}

async function boot() {
  await loadRuntimeAssets();
  updateDifficultyPicker();
  prepareCapture(captureMode);
  updateHud(true);
  requestAnimationFrame(loop);
}

boot();
