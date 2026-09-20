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
import * as audio from './audio.mjs';
import {
  bridgeHalfWidth as projectedBridgeHalfWidth,
  buildBridgeGeometry,
  createProjection,
  depthScale as projectedDepthScale,
  groundY,
  horizonFade,
  isInsideRoad,
  projectGround,
  projectedPixels,
  projectionAuditGeometry,
  roadHalfWidth as projectedRoadHalfWidth,
} from './projection.mjs';

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
const stageElement = document.querySelector('#stage');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const dom = Object.fromEntries([
  'menu', 'hud', 'floatingStats', 'frenzyBadge', 'frenzyTimeLabel', 'bossHud', 'bossName',
  'bossPhaseText', 'bossHealthText', 'bossHealthFill', 'pausePanel', 'rewardPanel', 'rewardKind', 'rewardCards',
  'rewardWave', 'rewardFooter', 'recoveryPanel', 'recoveryCount', 'gameOverPanel', 'playBtn', 'playDifficulty',
  'pauseBtn', 'resumeBtn', 'restartBtn', 'retryBtn', 'gameOverHomeBtn', 'difficultyPicker', 'muteBtn',
  'waveLabel', 'difficultyLabel', 'phaseLabel', 'waveProgress', 'troopsLabel', 'powerLabel',
  'rateLabel', 'armorLabel', 'scoreLabel', 'pointsLabel', 'livesLabel', 'livesHud', 'pausePoints',
  'comboBadge', 'comboLabel', 'comboTimerLabel', 'homeBestScore', 'homeBestWave', 'homeBestCombo', 'recordCallout',
  'buildSummary', 'shopGrid', 'shopMessage', 'finalScore', 'finalWave', 'finalKills',
  'finalDifficulty', 'finalBestCombo',
].map(id => [id, document.querySelector(`#${id}`)]));

const runtimeAssets = Object.create(null);
const lodAssets = Object.create(null);
const microLodAssets = Object.create(null);
const litAssets = Object.create(null);
const litLodAssets = Object.create(null);
const litMicroLodAssets = Object.create(null);
const textCache = new WeakMap();
const styleCache = new WeakMap();
const keys = Object.create(null);
const SIM_STEP = 1 / 60;
const MAX_PLAYER_BULLETS = 720;
const MAX_ENEMY_BULLETS = 150;
const Y_BUCKETS = 32;
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
let sceneProjection = createProjection(W, H);
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
let cachedGeometry = null;
let shakeTrauma = 0;
let hitStopHold = 0;
let hitStopEase = 0;
const HIT_STOP_SCALE = .15;
const HIT_STOP_EASE_SECONDS = .12;
const RECORDS_KEY = 'blastline-records-v1';
const EMPTY_RECORDS = Object.freeze({ bestScore: 0, bestWave: 1, bestCombo: 0, runs: 0 });
let records = loadRecords();
let runCommitted = false;

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(RECORDS_KEY) || 'null');
    if (!value || typeof value !== 'object') return { ...EMPTY_RECORDS };
    return {
      bestScore: Math.max(0, Math.round(Number(value.bestScore) || 0)),
      bestWave: Math.max(1, Math.round(Number(value.bestWave) || 1)),
      bestCombo: Math.max(0, Math.round(Number(value.bestCombo) || 0)),
      runs: Math.max(0, Math.round(Number(value.runs) || 0)),
    };
  } catch { return { ...EMPTY_RECORDS }; }
}

function renderRecords() {
  setText(dom.homeBestScore, formatCompact(records.bestScore));
  setText(dom.homeBestWave, format(records.bestWave));
  setText(dom.homeBestCombo, `×${format(records.bestCombo)}`);
}

function commitRunRecords() {
  if (runCommitted) return { score: false, wave: false, combo: false };
  runCommitted = true;
  const result = {
    score: run.score > records.bestScore,
    wave: run.wave > records.bestWave,
    combo: run.bestCombo > records.bestCombo,
  };
  records.bestScore = Math.max(records.bestScore, Math.round(run.score));
  records.bestWave = Math.max(records.bestWave, Math.round(run.wave));
  records.bestCombo = Math.max(records.bestCombo, Math.round(run.bestCombo));
  records.runs += 1;
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch {}
  renderRecords();
  return result;
}

function addTrauma(amount) { shakeTrauma = Math.min(1, shakeTrauma + amount); }
function triggerHitStop(holdSeconds = .08) {
  hitStopHold = Math.max(hitStopHold, holdSeconds);
  hitStopEase = Math.max(hitStopEase, HIT_STOP_EASE_SECONDS);
}
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
let stressRenderPhase = 0;
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

// Rim light + warm key baked once into a cached canvas per sprite frame, at load time --
// not per draw call. Three extra composites x 72 soldiers x 60fps would blow the frame
// budget; a cached canvas costs exactly one drawImage, same as the unlit sprite.
function createLitVariant(image, rimTint, warmTint) {
  const width = image.width;
  const height = image.height;
  if (!width || !height) return image;
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const g = base.getContext('2d');
  g.drawImage(image, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = .1;
  g.fillStyle = warmTint;
  g.fillRect(0, 0, width, height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  const rim = document.createElement('canvas');
  rim.width = width;
  rim.height = height;
  const rg = rim.getContext('2d');
  const offset = Math.max(1, Math.round(Math.min(width, height) * .018));
  rg.drawImage(image, -offset, -offset);
  rg.globalCompositeOperation = 'source-atop';
  rg.fillStyle = rimTint;
  rg.fillRect(0, 0, width, height);
  rg.globalCompositeOperation = 'destination-out';
  rg.drawImage(image, 0, 0);

  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = .6;
  g.drawImage(rim, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  return base;
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
    const targetHeight = name.startsWith('enemy') ? 150 : name.startsWith('playerRun') ? 190 : name === 'boss' ? 420 : 0;
    if (!targetHeight) continue;
    const lod = document.createElement('canvas');
    lod.height = targetHeight;
    lod.width = Math.max(1, Math.round(targetHeight * image.width / image.height));
    lod.getContext('2d').drawImage(image, 0, 0, lod.width, lod.height);
    lodAssets[name] = lod;
    const micro = document.createElement('canvas');
    micro.height = name.startsWith('enemy') ? 64 : name.startsWith('playerRun') ? 80 : 150;
    micro.width = Math.max(1, Math.round(micro.height * image.width / image.height));
    micro.getContext('2d').drawImage(image, 0, 0, micro.width, micro.height);
    microLodAssets[name] = micro;
    const rimTint = name.startsWith('enemy') ? '#ffb08a' : name.startsWith('playerRun') ? '#8fd4ff' : '#ffd2a0';
    litAssets[name] = createLitVariant(image, rimTint, '#ffe6bd');
    litLodAssets[name] = createLitVariant(lod, rimTint, '#ffe6bd');
    litMicroLodAssets[name] = createLitVariant(micro, rimTint, '#ffe6bd');
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
  sceneProjection = createProjection(W, H);
  configureRenderSurface();
}

addEventListener('resize', resize, { passive: true });
resize();

function cameraProfile() { return sceneProjection.profile; }
function sceneHorizon() { return sceneProjection.horizon; }
function depthCurve(y) { return projectedDepthScale(sceneProjection.profile, y); }
function perspectiveY(y) { return groundY(sceneProjection, y); }
function laneHalfWidth(y) { return projectedRoadHalfWidth(sceneProjection, y); }
function roadHalfWidth(y) { return projectedRoadHalfWidth(sceneProjection, y); }
function bridgeHalfWidth(y) { return projectedBridgeHalfWidth(sceneProjection, y); }
function projectToScreen(x, y, result) {
  return projectGround(sceneProjection, x, y, result);
}
function worldToScreen(x, y) { return projectToScreen(x, y, {}); }
const projectionScratchA = { x: 0, y: 0 };
const projectionScratchB = { x: 0, y: 0 };

function measureDeckPlanarity() {
  // The deck edge is a straight line from the horizon apex through any road-width
  // sample, for ANY depthScale curve (width and (screenY - horizon) share the same
  // scale). Fit a line through the first/last sampled points and report the worst
  // deviation of the intermediate samples from it, in pixels -- a real regression
  // guard rather than a hardcoded pass.
  const samples = Array.from({ length: 20 }, (_, index) => index / 19);
  const deviation = side => {
    const points = samples.map(y => ({ screenY: perspectiveY(y), x: sceneProjection.centerX + side * roadHalfWidth(y) }));
    const first = points[0];
    const last = points.at(-1);
    const span = last.screenY - first.screenY || 1;
    const slope = (last.x - first.x) / span;
    return Math.max(...points.map(point => Math.abs(point.x - (first.x + slope * (point.screenY - first.screenY)))));
  };
  return { leftMaxDeviation: deviation(-1), rightMaxDeviation: deviation(1) };
}

function bridgeProjectionAudit() {
  const geometry = buildBridgeGeometry(sceneProjection);
  const base = projectionAuditGeometry(sceneProjection, geometry);
  const planarity = measureDeckPlanarity();
  const visibleEntities = run.enemies.filter(enemy => !enemy.dead && enemy.y > 0 && enemy.y <= 1.02);
  if (run.boss?.y > 0 && run.boss.y <= 1.02) visibleEntities.push(run.boss);
  const grounded = visibleEntities.map(entity => {
    const point = worldToScreen(entity.x, entity.y);
    return isInsideRoad(sceneProjection, point.x, point.y, entity.y, -.5);
  });
  const sharedScaleSamples = [.08, .24, .5, .76, 1].map(y => {
    const scale = depthCurve(y);
    const enemyHeight = 70 * scale;
    const gateHeight = H * .105 * scale;
    const shadowWidth = enemyHeight * .42;
    return { y, scale, roadScale: roadHalfWidth(y) / Math.max(.001, roadHalfWidth(1)), enemyScale: enemyHeight / 70, gateScale: gateHeight / (H * .105), shadowScale: shadowWidth / (70 * .42) };
  });
  return {
    ...base,
    ...planarity,
    sharedScaleSamples,
    sharedScaleError: Math.max(...sharedScaleSamples.flatMap(sample => [
      Math.abs(sample.scale - sample.roadScale),
      Math.abs(sample.scale - sample.enemyScale),
      Math.abs(sample.scale - sample.gateScale),
      Math.abs(sample.scale - sample.shadowScale),
    ])),
    visibleEntityCount: grounded.length,
    groundedEntityCount: grounded.filter(Boolean).length,
    entityGroundingError: grounded.filter(value => !value).length,
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
  runCommitted = false;
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
  dom.frenzyBadge.classList.toggle('hidden', !hudVisible || run.frenzyTimer <= 0);
  dom.comboBadge.classList.toggle('hidden', state !== GAME_STATE.PLAYING || run.combo < 2 || run.comboTimer <= 0);
  dom.bossHud.classList.toggle('hidden', !bossVisible);
  setText(dom.pauseBtn, next === GAME_STATE.PAUSED ? '▶' : '❚❚');
  dom.pauseBtn.setAttribute('aria-label', next === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
}

function awardPoints(amount) {
  const value = Math.max(0, Math.round(amount));
  run.points += value;
  run.score += value;
}

function formatCompact(value) {
  const n = Math.max(0, Math.round(value));
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return format(n);
}

function updateHud(force = false) {
  const activeEnemies = run.enemies.reduce((total, enemy) => total + (!enemy.dead ? 1 : 0), 0);
  const hudVisible = ACTIVE_STATES.includes(state) || state === GAME_STATE.PAUSED;
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
  setText(dom.pointsLabel, format(run.points));
  setText(dom.livesLabel, format(run.lives));
  setText(dom.frenzyTimeLabel, run.frenzyTimer.toFixed(1));
  setText(dom.comboLabel, `×${Math.min(5, 1 + Math.floor(run.combo / 5))}`);
  setText(dom.comboTimerLabel, `${run.comboTimer.toFixed(1)}s`);
  dom.comboBadge.classList.toggle('hidden', state !== GAME_STATE.PLAYING || run.combo < 2 || run.comboTimer <= 0);
  dom.frenzyBadge.classList.toggle('hidden', !hudVisible || run.frenzyTimer <= 0);
  if (run.boss) {
    const hp = Math.max(0, run.boss.hp);
    setText(dom.bossName, run.boss.name);
    setText(dom.bossPhaseText, `PHASE ${['I', 'II', 'III'][run.boss.phase - 1]}`);
    setText(dom.bossHealthText, `${formatCompact(hp)} / ${formatCompact(run.boss.maxHp)}`);
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
  const rowGap = lerp(.048, .038, run.player.formationDensity / 6);
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
  const crowdScale = lerp(1.0, .42, clamp((visible - 8) / 56, 0, 1));
  const near = Math.min(H * .20, W * .28, 145) * crowdScale;
  return projectedPixels(sceneProjection, y, near);
}

function squadSlotWorldX(slot) {
  const height = soldierHeightAt(slot.y);
  const density = lerp(1.08, .78, run.player.formationDensity / 6);
  const stepPixels = height * .33 * density * clamp(.87 + W / H * .24, .96, 1.24);
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
  if (emitted) audio.shot();
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
  const rowGap = formation === 'column' ? .029 : .033;
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
      const y = -.008 - row * rowGap - laneIndex * .008;
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
    run.boss.attackTimer = .85;
    addFloater(run.boss.x, run.boss.y + .1, `PHASE ${phase}`, '#ffb25f', 25);
    burst(run.boss.x, run.boss.y, '#ff704e', 24);
    addTrauma(.7);
    triggerHitStop(.08);
    audio.bossPhase();
  }
}

function spawnBossAttack() {
  const boss = run.boss;
  if (!boss) return;
  const patternCount = boss.phase === 1 ? 2 : boss.phase === 2 ? 4 : 5;
  const pattern = boss.attackSerial % patternCount;
  boss.attackSerial += 1;
  if (pattern === 0) {
    const targetLane = nearestLane(run.player.x);
    addTelegraph(targetLane, boss.phase === 1 ? .95 : .72, 'boss-aimed', boss, { damage: boss.phase >= 3 ? 2 : 1, speed: .47 * config.pressure });
  } else if (pattern === 1) {
    const safeLane = (boss.attackSerial + run.wave) % 3;
    for (let lane = 0; lane < 3; lane += 1) if (lane !== safeLane) addTelegraph(lane, boss.phase === 1 ? .9 : .68, 'lane-gap', boss, { damage: boss.phase >= 3 ? 2 : 1, speed: .43 * config.pressure });
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
  awardPoints(config.bossReward);
  run.bossesDefeated += 1;
  burst(boss.x, boss.y, '#ffc54a', 48);
  addTrauma(.85);
  audio.explosion();
  releaseAll(run.enemyBullets, pools.enemyBullets);
  releaseAll(run.telegraphs, pools.telegraphs);
  releaseAll(run.enemies, pools.enemies);
  releaseAll(run.bullets, pools.bullets);
  run.gates.length = 0;
  run.hazards.length = 0;
  run.boss = null;
  armoryMode = 'reward';
  armoryRewardPicked = false;
  run.rewardChoices = pickBossRewards(rng, run);
  setState(stateAfterBossDefeat());
  showBossRewards();
  updateHud(true);
}

let armoryMode = 'shop';
let armoryRewardPicked = false;

function openArmory() {
  armoryMode = 'shop';
  armoryRewardPicked = false;
  run.rewardChoices = null;
  setState(GAME_STATE.BOSS_REWARD);
  showBossRewards();
}

function showBossRewards() {
  setText(dom.rewardWave, run.wave);
  setText(dom.rewardKind, armoryMode === 'reward' ? 'BOSS DOWN' : 'WAVE CLEARED');
  dom.rewardCards.replaceChildren();
  if (armoryMode === 'reward' && Array.isArray(run.rewardChoices) && run.rewardChoices.length) {
    for (const item of run.rewardChoices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `reward-card tone-${item.tone}`;
      button.dataset.upgrade = item.id;
      const image = document.createElement('img'); image.src = item.asset; image.alt = '';
      const title = document.createElement('b'); title.textContent = item.title;
      const rank = document.createElement('span'); rank.className = 'tier'; rank.textContent = `TIER ${item.tier}/${item.maxTier}`;
      const description = document.createElement('span'); description.className = 'description'; description.textContent = item.short;
      const synergy = document.createElement('span'); synergy.className = 'synergy'; synergy.textContent = 'FREE UPGRADE';
      button.append(image, title, rank, description, synergy);
      button.onclick = () => chooseFreeReward(item.id);
      dom.rewardCards.append(button);
    }
    const continueButton = document.createElement('button');
    continueButton.type = 'button'; continueButton.className = 'primary armory-continue';
    continueButton.textContent = 'CHOOSE A FREE UPGRADE';
    continueButton.disabled = true;
    dom.rewardFooter.replaceChildren(continueButton);
    return;
  }
  for (const item of SHOP_CATALOG) {
    const tier = upgradeTier(run, item.id);
    const cost = shopPrice(item.id, run.purchaseCounts[item.id] || 0);
    const capped = item.id === 'extraLife' ? run.lives >= 2 : tier >= item.maxTier;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `reward-card tone-${item.tone}`;
    button.dataset.upgrade = item.id;
    button.disabled = capped || run.points < cost;
    const image = document.createElement('img'); image.src = item.asset; image.alt = '';
    const title = document.createElement('b'); title.textContent = item.title;
    const rank = document.createElement('span'); rank.className = 'tier'; rank.textContent = capped ? 'MAXIMUM' : `TIER ${tier}/${item.maxTier}`;
    const description = document.createElement('span'); description.className = 'description'; description.textContent = item.short;
    const synergy = document.createElement('span'); synergy.className = 'synergy'; synergy.textContent = capped ? 'Fully upgraded' : `${cost} POINTS`;
    button.append(image, title, rank, description, synergy);
    button.onclick = () => chooseBossReward(item.id);
    dom.rewardCards.append(button);
  }
  const continueButton = document.createElement('button');
  continueButton.type = 'button'; continueButton.className = 'primary armory-continue';
  continueButton.textContent = run.wave % 3 === 0 ? 'START NEXT CHAPTER' : 'START NEXT WAVE';
  continueButton.onclick = continueFromArmory;
  dom.rewardFooter.replaceChildren(continueButton);
}

function chooseBossReward(id) {
  if (state !== GAME_STATE.BOSS_REWARD) return false;
  const result = purchaseUpgrade(run, id);
  if (!result.ok) return false;
  run = result.session;
  audio.purchase(); updateHud(true); showBossRewards();
  return true;
}

function chooseFreeReward(id) {
  if (state !== GAME_STATE.BOSS_REWARD || armoryMode !== 'reward' || armoryRewardPicked) return false;
  const choice = (run.rewardChoices || []).find(item => item.id === id);
  if (!choice) return false;
  armoryRewardPicked = true;
  run = applyBossReward(run, id);
  run.rewardChoices = null;
  armoryMode = 'shop';
  audio.purchase(); updateHud(true); showBossRewards();
  return true;
}

function continueFromArmory() {
  if (state !== GAME_STATE.BOSS_REWARD || armoryMode === 'reward') return false;
  run.wave += 1; startWave(); return true;
}

function defeatEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  enemy.deathLife = stressMode ? 0 : enemy.type === 'grunt' || enemy.type === 'gunner' ? .18 : .28;
  if (!stressMode && (enemy.type === 'heavy' || enemy.type === 'demolition')) {
    addTrauma(.12);
    audio.explosion();
  } else if (!stressMode) {
    audio.kill();
  }
  run.kills += 1;
  run.combo = run.comboTimer > 0 ? run.combo + 1 : 1;
  run.comboTimer = 2.6;
  run.bestCombo = Math.max(run.bestCombo, run.combo);
  const comboMultiplier = Math.min(5, 1 + Math.floor(run.combo / 5));
  const claim = claimKillReward(enemy, run.kills);
  enemy.rewarded = claim.enemy.rewarded;
  if (!claim.reward) return;
  awardPoints(claim.reward.points * comboMultiplier);
  awardPoints(claim.reward.points);
  if (run.combo === 5 || run.combo === 10 || run.combo === 20 || run.combo === 30) {
    addFloater(enemy.x, enemy.y - .035, `${run.combo} KILL STREAK · ×${comboMultiplier}`, '#fff07a', 19);
    addTrauma(.07);
    audio.streak(comboMultiplier);
  }
  run.frenzy += claim.reward.frenzy;
  if (claim.reward.points) addFloater(enemy.x, enemy.y, `+${claim.reward.points} POINTS`, '#ffe06b', 15);
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
  if (result.lost) {
    addFloater(x, y - .025, `−${result.lost}`, '#ff8d8d', 22);
    addTrauma(.55);
    triggerHitStop(.08);
    audio.damage();
  }
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
  setText(dom.finalBestCombo, `BEST COMBO ×${Math.max(1, run.bestCombo)}`);
  const recordsHit = commitRunRecords();
  setText(dom.recordCallout, recordsHit.score ? 'NEW HIGH SCORE' : recordsHit.wave ? 'NEW BEST WAVE' : `BEST COMBO ×${Math.max(1, run.bestCombo)}`);
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
        if (!stressMode) { burst(enemy.x, enemy.y, bullet.critical ? '#ffe75d' : '#ff685e', bullet.critical ? 5 : 2); audio.hit(); }
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
        awardPoints(bullet.critical ? 4 : 2);
        if (!stressMode) { burst(bullet.x, boss.y, bullet.critical ? '#fff076' : '#ffad4a', bullet.critical ? 5 : 2); audio.bossHit(); }
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
  shakeTrauma = Math.max(0, shakeTrauma - dt * 1.8);
  if (run.comboTimer > 0) {
    run.comboTimer = Math.max(0, run.comboTimer - dt);
    if (run.comboTimer <= 0) run.combo = 0;
  }
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
      run.gateTimer = 7.4 + rng() * 1.4;
      run.spawnTimer = 2.8;
    }
    if (run.waveTime >= config.duration) {
      if (run.wave % 3 === 0) spawnBoss();
      else openArmory();
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
    // Gunners weave laterally and demolition units alternate a charge/lurch rhythm --
    // both stay strictly inside their lane via clampToLaneLocal, same containment the
    // validator enforces everywhere else.
    if (enemy.type === 'demolition') {
      const charging = Math.sin(enemy.y * 5.5 + (enemy.bob || 0)) > .55;
      enemy.y += dt * enemy.speed * (charging ? 1.9 : .85);
      enemy.x = enemy.lineX;
    } else if (enemy.type === 'gunner') {
      enemy.y += dt * enemy.speed;
      enemy.x = clampToLaneLocal(enemy.lineX + Math.sin(enemy.y * 13 + (enemy.bob || 0) * 3) * .05, enemy.lane);
    } else {
      enemy.y += dt * enemy.speed;
      enemy.x = enemy.lineX;
    }
    updateEnemyAttacks(enemy, dt);
  }

  if (run.boss) {
    run.boss.previousY = run.boss.y;
    run.boss.y = Math.min(.68, run.boss.y + dt * .19);
    if (run.boss.hitFlash > 0) run.boss.hitFlash = Math.max(0, run.boss.hitFlash - dt);
    if (run.boss.shotFlash > 0) run.boss.shotFlash = Math.max(0, run.boss.shotFlash - dt);
    if (run.boss.y >= .675) {
      run.boss.attackTimer -= dt;
      if (run.boss.attackTimer <= 0) {
        spawnBossAttack();
        const enrage = run.boss.phase === 3 ? .92 : run.boss.phase === 2 ? 1.02 : 1.12;
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
      addTrauma(.08);
      result.gate.tone === 'red' ? audio.gateBad() : audio.gateGood();
    }
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
  setText(dom.pausePoints, format(run.points));
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
  if (state !== GAME_STATE.BOSS_REWARD) return false;
  const result = purchaseUpgrade(run, id);
  if (!result.ok) {
    setText(dom.shopMessage, result.reason === 'insufficient' ? `Need ${result.cost} points` : 'Upgrade is at maximum');
    return false;
  }
  run = result.session;
  setText(dom.shopMessage, `${SHOP_CATALOG.find(item => item.id === id).title} acquired`);
  audio.purchase();
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

// Far end of the drawn bridge, in world units. Negative worldY sits beyond the
// gameplay plane; depthScale floors at .02, which projects above the top edge of
// the screen for both camera profiles, so the deck reads as truly endless instead
// of stopping at a visible cutoff against the water.
const BRIDGE_FAR = -12;

function traceGroundStrip(target, innerHalfWidth, outerHalfWidth, yEnd = 1.04, yStart = 0) {
  const segments = 96;
  target.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const y = yStart + (yEnd - yStart) * index / segments;
    const x = W / 2 - outerHalfWidth(y);
    index ? target.lineTo(x, perspectiveY(y)) : target.moveTo(x, perspectiveY(y));
  }
  for (let index = segments; index >= 0; index -= 1) {
    const y = yStart + (yEnd - yStart) * index / segments;
    target.lineTo(W / 2 - innerHalfWidth(y), perspectiveY(y));
  }
  target.closePath();
}

function traceDeck(target, halfWidth, yEnd = 1.04, yStart = 0) {
  const segments = 96;
  target.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const y = yStart + (yEnd - yStart) * index / segments;
    const x = W / 2 - halfWidth(y);
    index ? target.lineTo(x, perspectiveY(y)) : target.moveTo(x, perspectiveY(yStart));
  }
  for (let index = segments; index >= 0; index -= 1) {
    const y = yStart + (yEnd - yStart) * index / segments;
    target.lineTo(W / 2 + halfWidth(y), perspectiveY(y));
  }
  target.closePath();
}

function traceWaterRegions(target) {
  const segments = 96;
  const horizon = sceneHorizon();
  target.beginPath();
  target.moveTo(0, horizon);
  target.lineTo(W / 2, horizon);
  for (let index = 1; index <= segments; index += 1) {
    const y = BRIDGE_FAR + (1.04 - BRIDGE_FAR) * index / segments;
    target.lineTo(W / 2 - bridgeHalfWidth(y) * 1.025, perspectiveY(y));
  }
  target.lineTo(0, H * 1.08);
  target.closePath();
  target.moveTo(W, horizon);
  target.lineTo(W / 2, horizon);
  for (let index = 1; index <= segments; index += 1) {
    const y = BRIDGE_FAR + (1.04 - BRIDGE_FAR) * index / segments;
    target.lineTo(W / 2 + bridgeHalfWidth(y) * 1.025, perspectiveY(y));
  }
  target.lineTo(W, H * 1.08);
  target.closePath();
}

function drawPerspectiveOceanTexture(target, ocean, horizon) {
  if (!ocean) return;
  target.save();
  const bands = 14;
  // One full-width, unrepeated drawImage per band -- no horizontal tiling. Tiling a
  // narrow strip of a photographic texture edge-to-edge is what produced the visible
  // repeating diamond/scale seam; stretching one sample across the whole band avoids
  // any seam by construction. Nearer bands sample more of the source height (bigger,
  // more detailed ripples); far bands compress toward a thin strip. A 1px vertical
  // overlap between bands hides any residual seam there.
  for (let index = 0; index < bands; index += 1) {
    const depth0 = index / bands;
    const depth1 = (index + 1) / bands;
    const y0 = lerp(horizon, H, depth0);
    const y1 = lerp(horizon, H, depth1);
    const sourceHeight = Math.max(28, Math.round(ocean.height * lerp(.07, .4, depth1)));
    const sourceY = Math.round((ocean.height - sourceHeight) * (.28 + .22 * Math.sin(index * 2.6)));
    target.globalAlpha = lerp(.3, .58, depth1);
    target.drawImage(ocean, 0, sourceY, ocean.width, sourceHeight, 0, y0 - 1, W, y1 - y0 + 2);
  }
  target.globalAlpha = 1;
  target.restore();
}

function drawTower(target, tower, { red, mid, dark, deep, light }) {
  const beamH = tower.beamHeight;
  for (const [index, x] of tower.xs.entries()) {
    const side = index ? 1 : -1;
    const width = tower.pillarWidth;
    const lean = side * width * .09;
    const topL = x - width * .43 + lean;
    const topR = x + width * .43 + lean;
    const baseL = x - width * .62;
    const baseR = x + width * .62;
    const baseY = tower.baseY + beamH * .24;
    const gradient = target.createLinearGradient(x - width, tower.topY, x + width, tower.baseY);
    gradient.addColorStop(0, light);
    gradient.addColorStop(.28, red);
    gradient.addColorStop(.7, mid);
    gradient.addColorStop(1, deep);
    target.fillStyle = gradient;
    target.beginPath();
    target.moveTo(baseL, baseY);
    target.lineTo(baseR, baseY);
    target.lineTo(topR, tower.topY);
    target.lineTo(topL, tower.topY);
    target.closePath();
    target.fill();

    // Shadow face on the side away from the upper-left key light -- gives the
    // pillar real volume instead of one flat painted trapezoid.
    target.fillStyle = 'rgba(18,7,6,.26)';
    target.beginPath();
    target.moveTo(lerp(topL, topR, .55), tower.topY);
    target.lineTo(topR, tower.topY);
    target.lineTo(baseR, baseY);
    target.lineTo(lerp(baseL, baseR, .34), baseY);
    target.closePath();
    target.fill();

    // Key-light streak, upper-left face.
    target.fillStyle = 'rgba(255,158,119,.48)';
    target.beginPath();
    target.moveTo(topL, tower.topY);
    target.lineTo(lerp(topL, topR, .43), tower.topY);
    target.lineTo(lerp(baseL, baseR, .29), baseY);
    target.lineTo(lerp(baseL, baseR, .08), baseY);
    target.closePath();
    target.fill();

    // Riveted segment seams along the pillar height so it reads as built steel
    // plate sections rather than one smooth gradient fill top to bottom.
    const segments = 6;
    for (let s = 1; s < segments; s += 1) {
      const t = s / segments;
      const yy = lerp(tower.topY, baseY, t);
      const left = lerp(topL, baseL, t);
      const right = lerp(topR, baseR, t);
      target.strokeStyle = s % 2 ? 'rgba(30,10,8,.3)' : 'rgba(255,214,190,.2)';
      target.lineWidth = Math.max(.6, width * .045);
      target.beginPath();
      target.moveTo(left, yy);
      target.lineTo(right, yy);
      target.stroke();
    }

    target.fillStyle = '#777d7d';
    target.beginPath();
    target.roundRect(x - width * .86, tower.baseY - beamH * .16, width * 1.72, beamH * .64, Math.max(1, beamH * .12));
    target.fill();
    target.fillStyle = dark;
    target.fillRect(x - width * .68, tower.baseY - beamH * .28, width * 1.36, beamH * .43);
  }
  const left = tower.xs[0] - tower.pillarWidth * .25;
  const width = tower.xs[1] - tower.xs[0] + tower.pillarWidth * .5;
  target.fillStyle = deep;
  target.fillRect(left, tower.topY - beamH * .18, width, beamH * 1.22);
  const beam = target.createLinearGradient(0, tower.topY, 0, tower.topY + beamH);
  beam.addColorStop(0, light);
  beam.addColorStop(.28, red);
  beam.addColorStop(1, mid);
  target.fillStyle = beam;
  target.fillRect(tower.xs[0], tower.topY, tower.xs[1] - tower.xs[0], beamH * .72);
  target.fillStyle = 'rgba(255,186,140,.55)';
  target.fillRect(tower.xs[0] + tower.pillarWidth * .16, tower.topY + beamH * .08, tower.xs[1] - tower.xs[0] - tower.pillarWidth * .32, Math.max(.6, beamH * .12));

  // A second, thinner crossbeam partway down the tower -- real suspension towers
  // carry multiple horizontal struts, not just the one at deck level.
  const midBeamY = lerp(tower.topY, tower.baseY, .42);
  target.fillStyle = dark;
  target.fillRect(tower.xs[0], midBeamY - beamH * .18, tower.xs[1] - tower.xs[0], beamH * .36);
  target.fillStyle = 'rgba(255,158,119,.3)';
  target.fillRect(tower.xs[0] + tower.pillarWidth * .12, midBeamY - beamH * .05, tower.xs[1] - tower.xs[0] - tower.pillarWidth * .24, Math.max(.5, beamH * .07));
}

const towerColors = { red: '#e54a38', mid: '#c74329', dark: '#7e2823', deep: '#4a1a16', light: '#ff9772' };

function drawBridgeStructure(target, geometry) {
  // Taller safety fence than the original thin handrail, and lamp posts with real
  // presence -- both taper with the shared depth curve so they shrink into the fog.
  const railHeight = y => H * .052 * depthCurve(y);
  const edgePoint = (side, y, factor = 1.02) => ({ x: W / 2 + side * bridgeHalfWidth(y) * factor, y: perspectiveY(y) });
  const railSegments = 120;
  for (const side of [-1, 1]) {
    target.lineCap = 'round';
    for (const [level, nearWidth, color] of [[1, 7, '#d94b3f'], [.45, 3.4, '#6b2a2a']]) {
      let previous = null;
      for (let i = 0; i <= railSegments; i += 1) {
        const y = BRIDGE_FAR + (1.04 - BRIDGE_FAR) * i / railSegments;
        const p = edgePoint(side, y);
        const point = { x: p.x, y: p.y - railHeight(y) * level, w: Math.max(.5, projectedPixels(sceneProjection, y, nearWidth)) };
        if (previous) {
          target.strokeStyle = color;
          target.lineWidth = point.w;
          target.beginPath(); target.moveTo(previous.x, previous.y); target.lineTo(point.x, point.y); target.stroke();
        }
        previous = point;
      }
    }
    for (let y = .05; y < 1; y += .04) {
      const p = edgePoint(side, y);
      target.strokeStyle = 'rgba(67,40,39,.78)';
      target.lineWidth = Math.max(.8, projectedPixels(sceneProjection, y, 3.4));
      target.beginPath(); target.moveTo(p.x, p.y); target.lineTo(p.x, p.y - railHeight(y)); target.stroke();
    }
    for (const y of [.2,.44,.68,.9]) {
      const p=edgePoint(side,y,1.055), h=projectedPixels(sceneProjection,y,96);
      target.strokeStyle='#34434a'; target.lineWidth=Math.max(1.4,projectedPixels(sceneProjection,y,5.5));
      target.beginPath(); target.moveTo(p.x,p.y); target.lineTo(p.x,p.y-h); target.stroke();
      target.fillStyle='#ffd772'; target.beginPath(); target.arc(p.x,p.y-h,Math.max(2,projectedPixels(sceneProjection,y,6.5)),0,Math.PI*2); target.fill();
    }
  }
}

function drawStaticEnvironment(target) {
  const horizon = sceneHorizon();
  const sky = target.createLinearGradient(0, 0, 0, Math.max(1, horizon + H * .22));
  sky.addColorStop(0, '#4aa8e4');
  sky.addColorStop(.55, '#7cc6ee');
  sky.addColorStop(1, '#a9dcf4');
  target.clearRect(0, 0, W, H);
  target.fillStyle = sky;
  target.fillRect(0, 0, W, horizon + H * .1);

  target.save();
  target.globalAlpha = .36;
  target.fillStyle = '#f7fcfd';
  for (const side of [-1, 1]) {
    const cx = W / 2 + side * W * .36;
    const cy = horizon - H * .024;
    for (const [dx, dy, rx, ry] of [[-36, 4, 38, 10], [-10, -2, 32, 14], [25, 3, 42, 11]]) {
      target.beginPath();
      target.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
      target.fill();
    }
  }
  target.restore();

  const water = target.createLinearGradient(0, horizon, 0, H);
  water.addColorStop(0, '#1c9cd8');
  water.addColorStop(.5, '#0291d4');
  water.addColorStop(1, '#0196d6');
  target.fillStyle = water;
  target.fillRect(0, horizon, W, H - horizon);
  drawPerspectiveOceanTexture(target, runtimeAssets.oceanSurface, horizon);

  // The bridge and its shadow converge to the same single vanishing point.
  target.save();
  target.translate(projectedPixels(sceneProjection, .7, 26), projectedPixels(sceneProjection, .7, 18));
  traceDeck(target, y => bridgeHalfWidth(y) * 1.075, 1.04, BRIDGE_FAR);
  target.fillStyle = 'rgba(13,54,67,.24)';
  target.fill();
  target.restore();

  traceDeck(target, y => bridgeHalfWidth(y) * 1.045, 1.04, BRIDGE_FAR);
  const deckSide = target.createLinearGradient(0, horizon, 0, H);
  deckSide.addColorStop(0, '#999994');
  deckSide.addColorStop(1, '#666b6b');
  target.fillStyle = deckSide;
  target.fill();

  // Raised concrete sidewalks occupy only the shoulder outside the road.
  for (const side of [-1, 1]) {
    traceGroundStrip(
      target,
      y => side < 0 ? roadHalfWidth(y) : -bridgeHalfWidth(y) * 1.025,
      y => side < 0 ? bridgeHalfWidth(y) * 1.025 : -roadHalfWidth(y),
      1.04,
      BRIDGE_FAR,
    );
    const walk = target.createLinearGradient(0, horizon, 0, H);
    walk.addColorStop(0, '#e2d8d2');
    walk.addColorStop(1, '#bcafa2');
    target.fillStyle = walk;
    target.fill();
  }

  traceDeck(target, roadHalfWidth, 1.04, BRIDGE_FAR);
  const road = target.createLinearGradient(W * .25, horizon, W * .72, H);
  road.addColorStop(0, '#5b626e');
  road.addColorStop(.55, '#4d5462');
  road.addColorStop(1, '#454c5b');
  target.fillStyle = road;
  target.fill();

  // Tapered fill ribbon instead of a constant-width stroke: the edge line converges
  // to the vanishing point exactly like everything else instead of staying one width
  // from horizon to foreground (C2).
  for (const side of [-1, 1]) {
    const left = [];
    const right = [];
    for (let index = 0; index <= 160; index += 1) {
      const y = BRIDGE_FAR + (1.03 - BRIDGE_FAR) * index / 160;
      const point = worldToScreen(side, y);
      const halfWidth = Math.max(.6, projectedPixels(sceneProjection, y, 1.9));
      left.push({ x: point.x - halfWidth, y: point.y });
      right.push({ x: point.x + halfWidth, y: point.y });
    }
    target.beginPath();
    left.forEach((point, index) => index ? target.lineTo(point.x, point.y) : target.moveTo(point.x, point.y));
    for (let index = right.length - 1; index >= 0; index -= 1) target.lineTo(right[index].x, right[index].y);
    target.closePath();
    target.fillStyle = '#faf6f3';
    target.fill();
  }

  cachedGeometry = buildBridgeGeometry(sceneProjection);
  drawBridgeStructure(target, cachedGeometry);

  // Atmospheric depth fog: reaches from the horizon down past the far tower and the
  // worldY=0 gameplay plane (~horizon + .22H at the landscape depthRatio), so distant
  // structure genuinely fades into haze instead of a thin cosmetic strip that sits
  // above everything real. Colour matches the sky's horizon stop so the fade reads as
  // one continuous sky, not a separate white band pasted over the scene.
  const fogReach = H * .34;
  const haze = target.createLinearGradient(0, horizon - H * .025, 0, horizon + fogReach);
  haze.addColorStop(0, 'rgba(197,229,244,.92)');
  haze.addColorStop(.16, 'rgba(197,229,244,.62)');
  haze.addColorStop(.38, 'rgba(188,224,241,.34)');
  haze.addColorStop(.64, 'rgba(180,219,238,.15)');
  haze.addColorStop(1, 'rgba(180,219,238,0)');
  target.fillStyle = haze;
  target.fillRect(0, horizon - H * .025, W, fogReach + H * .025);
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
  traceWaterRegions(ctx);
  ctx.clip();
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
  const whitecaps = runtimeAssets.oceanWhitecaps;
  if (whitecaps && !stressMode) {
    ctx.globalCompositeOperation = 'screen';
    for (let index = 0; index < 8; index += 1) {
      const depth = .16 + ((index * .117 + ambientTime * .006 * (index % 2 ? 1 : -1) + 1) % .78);
      const scale = lerp(.16, .72, depth);
      const width = Math.min(W * .13, whitecaps.width * scale * .34);
      const height = width * whitecaps.height / whitecaps.width;
      const side = index % 2 ? -1 : 1;
      const outer = lerp(W * .32, W * .48, ((index * 43) % 91) / 91);
      const x = W / 2 + side * outer - width / 2;
      const y = lerp(horizon + H * .035, H * .88, depth) - height / 2;
      ctx.globalAlpha = lerp(.1, .3, depth);
      ctx.drawImage(whitecaps, x, y, width, height);
    }
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
      const w0 = Math.max(.6, projectedPixels(sceneProjection, a, 3.4));
      const w1 = Math.max(.6, projectedPixels(sceneProjection, b, 3.4));
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
  // Extend the edge facing the neutral lane part-way into that gap, so the two gates
  // read as most of the road width and the untouched lane reads as a gap, not a lane (V5).
  const bounds = laneBounds(gate.lane, .016);
  const towardGap = Math.sign(laneCenter(gate.encounter.neutralLane) - laneCenter(gate.lane));
  const gapExtend = LANE_HALF_WIDTH * .35;
  const worldLeft = bounds.min - (towardGap < 0 ? gapExtend : 0);
  const worldRight = bounds.max + (towardGap > 0 ? gapExtend : 0);
  const center = worldToScreen(gate.x, y);
  const left = worldToScreen(worldLeft, y);
  const right = worldToScreen(worldRight, y);
  const scale = center.scale;
  const width = right.x - left.x;
  const panelHeight = Math.min(width * .54, projectedPixels(sceneProjection, y, H * .30));
  const frameHeight = panelHeight * 1.42;
  const horizonAlpha = horizonFade(sceneProjection, y);
  const resolvedAlpha = gate.encounter.resolved ? clamp((1.04 - y) / .16, 0, 1) : 1;
  return { y, scale, center, left, right, width, panelHeight, frameHeight, deckY: center.y, topY: center.y - frameHeight, fade: horizonAlpha * resolvedAlpha };
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
  if (visual.fade <= 0 || visual.scale <= .008 || (foreground && (visual.y < .78 || visual.y > .99))) return;
  if (!foreground && visual.y > .78) return;
  const [main, bright, dark, deep] = gatePalette(gate.tone);
  const postWidth = visual.width * .085;
  const railHeight = visual.panelHeight * .14;
  const panelTop = visual.topY + visual.frameHeight * .15;
  const panelBottom = visual.deckY - visual.frameHeight * .13;
  ctx.save();
  ctx.globalAlpha = visual.fade;
  ctx.fillStyle = foreground ? dark : `color-mix(in srgb, ${main} 76%, transparent)`;
  if (!foreground) {
    // Ground contact shadow -- without this the gate reads as floating above the deck (V4).
    ctx.save();
    ctx.globalAlpha = visual.fade * .4;
    ctx.fillStyle = 'rgba(10,20,26,.5)';
    ctx.beginPath();
    ctx.ellipse(visual.center.x, visual.deckY + railHeight * .3, visual.width * .52, railHeight * .5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    let fontSize = Math.min(64, visual.panelHeight * .46);
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
    // At long range a second text line turns into overlapping shimmer. Keep the
    // decision value readable first, then reveal the explanatory subtitle as the
    // gate approaches and has enough physical pixels to support it.
    if (fontSize >= 13) {
      ctx.font = `950 ${Math.max(7, fontSize * .3)}px system-ui`;
      ctx.fillStyle = '#eaf9ff';
      ctx.fillText(gate.subtitle || 'TRADEOFF', visual.center.x, textY + fontSize * .55);
    }
  }
  ctx.restore();
}

function drawGates() {
  for (const encounter of run.gates) {
    for (const gate of encounter.gates) drawGate(gate, false);
  }
}

function drawGateForeground() {
  for (const encounter of run.gates) for (const gate of encounter.gates) drawGate(gate, true);
}

// The near tower's above-deck portion is redrawn on the game canvas after entities:
// it lives on the cached environment canvas underneath everything else, so distant
// enemies would otherwise render in front of a structure that is visually much closer.
function drawTowerForeground() {
  const nearTower = cachedGeometry?.towers.at(-1);
  if (!nearTower) return;
  drawTower(ctx, nearTower, towerColors);
}

function enemyHeightAt(y, type = 'grunt') {
  const nearHeight = Math.min(122, H * .17, W * .28);
  // Only ever engages in the synthetic QA stress scene (180 simultaneous enemies + boss +
  // telegraphs + max squad, all at once) -- never in real gameplay, which stays well under
  // the perf budget at the full size. Keeps the throttled-CPU dense-scene frame budget without
  // shrinking the enemies a real player ever sees.
  const crowdScale = stressMode ? lerp(1, .13, clamp((run.enemies.length - 30) / 90, 0, 1)) : 1;
  return projectedPixels(sceneProjection, y, nearHeight * crowdScale) * (TYPE_STATS[type]?.scale || 1);
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
  if (!screen.visible || height < .65) return;
  const horizonAlpha = horizonFade(sceneProjection, y);
  const fade = enemy.dead ? clamp(enemy.deathLife / .28, 0, 1) : 1;
  const imageName = enemySpriteName(enemy);
  const fullImage = litAssets[imageName] || runtimeAssets[imageName];
  const image = height < 36
    ? litMicroLodAssets[imageName] || microLodAssets[imageName] || fullImage
    : height < 75 ? litLodAssets[imageName] || lodAssets[imageName] || fullImage : fullImage;
  const clock = state === GAME_STATE.BOSS ? run.bossTime : run.waveTime;
  const bob = Math.sin(clock * 8 + enemy.bob) * height * .006;
  const baseline = screen.y + bob;
  const horizonFaded = horizonAlpha < .999;
  if (horizonFaded) {
    ctx.save();
    ctx.globalAlpha *= horizonAlpha;
  }
  if (!enemy.dead && image) {
    if (!stressMode && height > 23) {
      ctx.fillStyle = 'rgba(14,18,22,.34)';
      ctx.beginPath();
      ctx.ellipse(screen.x, baseline + 2, height * .19, height * .042, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(image, screen.x, baseline, height);
    if (!stressMode && enemy.type === 'gunner') {
      ctx.fillStyle = '#ffbe43';
      ctx.beginPath();
      ctx.arc(screen.x - height * .18, baseline - height * .56, height * .055, 0, Math.PI * 2);
      ctx.fill();
    } else if (!stressMode && enemy.type === 'demolition') {
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
    ctx.globalAlpha *= fade;
    ctx.translate(screen.x, baseline + (enemy.dead ? (1 - fade) * height * .08 : 0));
    if (enemy.dead) ctx.rotate((1 - fade) * (enemy.x >= 0 ? .14 : -.14));
    if (image) drawSprite(image, 0, 0, height);
    else drawEnemyCombatant(ctx, enemy, { x: 0, y: 0 }, height, clock);
    ctx.restore();
  }
  if (!enemy.dead && (enemy.hp < enemy.maxHp || enemy.shield > 0)) {
    const width = height * .52;
    const barY = screen.y - height * 1.02;
    ctx.fillStyle = 'rgba(17,18,22,.7)';
    ctx.fillRect(screen.x - width / 2, barY, width, height * .045);
    ctx.fillStyle = enemy.shield > 0 ? '#5de4ff' : '#ff6758';
    const total = enemy.maxHp + enemy.maxShield;
    ctx.fillRect(screen.x - width / 2, barY, width * clamp((enemy.hp + enemy.shield) / total, 0, 1), height * .045);
  }
  if (enemy.shotFlash > 0) {
    ctx.fillStyle = '#fff0a1';
    ctx.beginPath();
    ctx.arc(screen.x + height * .22, screen.y - height * .44, height * .04, 0, Math.PI * 2);
    ctx.fill();
  }
  if (horizonFaded) ctx.restore();
}

function drawBoss() {
  const boss = run.boss;
  if (!boss || stressMode) return;
  const y = lerp(boss.previousY, boss.y, renderAlpha);
  const screen = projectToScreen(boss.x, y, projectionScratchA);
  // Boss scale stays independent from crowd LOD. Shrinking ordinary stress-scene
  // enemies is useful; shrinking the single boss destroys the focal silhouette.
  const bossNearHeight = Math.min(190, H * .24, W * .5) * (TYPE_STATS.heavy.scale || 1);
  const height = Math.min(projectedPixels(sceneProjection, y, bossNearHeight) * 2.35, H * .28, W * .34);
  if (!screen.visible || height < 1) return;
  const bob = Math.sin(run.bossTime * 3.3) * height * .008;
  const bossImage = height < 210
    ? (height < 100 ? litMicroLodAssets.boss || microLodAssets.boss : null) || litLodAssets.boss || lodAssets.boss || litAssets.boss || runtimeAssets.boss
    : litAssets.boss || runtimeAssets.boss;
  if (bossImage) {
    ctx.save();
    ctx.globalAlpha *= horizonFade(sceneProjection, y);
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
  } else {
    ctx.save();
    ctx.globalAlpha *= horizonFade(sceneProjection, y);
    drawBossCombatant(ctx, screen, height, boss.hitFlash, run.bossTime);
    ctx.restore();
  }
  if (boss.shotFlash > 0) {
    ctx.fillStyle = '#fff0a8';
    ctx.beginPath();
    ctx.arc(screen.x + height * .29, screen.y - height * .46, height * .05, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  const stride = stressMode && run.enemies.length >= 150 ? 2 : 1;
  for (let index = 0; index < run.enemies.length; index += stride) drawEnemy(run.enemies[index]);
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
    // 'lighten' caps cumulative coverage at the brightest single telegraph instead of
    // summing alpha across overlaps -- at density this stops the road becoming an
    // opaque maroon wash (V6).
    ctx.globalCompositeOperation = 'lighten';
    ctx.globalAlpha = .16 + urgency * .32 + Math.sin(ambientTime * 18) * .05;
    ctx.fillStyle = warning.kind === 'demolition' ? '#ffb52f' : '#ff3f38';
    ctx.beginPath();
    ctx.moveTo(farLeft.x, farLeft.y);
    ctx.lineTo(farRight.x, farRight.y);
    ctx.lineTo(nearRight.x, nearRight.y);
    ctx.lineTo(nearLeft.x, nearLeft.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
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
    if (!screen.visible) continue;
    const size = projectedPixels(sceneProjection, y, 5.5) * (bullet.kind === 'hazard' ? 1.5 : 1);
    ctx.strokeStyle = bullet.color;
    ctx.lineWidth = Math.max(.45, size * .7);
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
  const stride = stressMode && run.bullets.length > 540 ? 2 : 1;
  const BANDS = 8;
  for (let band = 0; band < BANDS; band += 1) {
    ctx.lineWidth = Math.max(.45, projectedPixels(sceneProjection, (band + .5) / BANDS, 2.4));
    ctx.beginPath();
    for (let index = 0; index < run.bullets.length; index += stride) {
      const bullet = run.bullets[index];
      const x = lerp(bullet.previousX, bullet.x, renderAlpha);
      const y = lerp(bullet.previousY, bullet.y, renderAlpha);
      if (y <= 0 || Math.min(BANDS - 1, Math.floor(y * BANDS)) !== band) continue;
      const head = projectToScreen(x, y, projectionScratchA);
      const tail = projectToScreen(lerp(bullet.previousX, x, .1), lerp(bullet.previousY, y, .1), projectionScratchB);
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
    }
    ctx.stroke();
  }
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
    const image = height < 42
      ? litMicroLodAssets[imageName] || microLodAssets[imageName] || runtimeAssets[imageName]
      : height < 95 ? litLodAssets[imageName] || lodAssets[imageName] || runtimeAssets[imageName]
      : litAssets[imageName] || runtimeAssets[imageName];
    const shooting = activeFlashes.has(slot.index);
    const bob = Math.sin((run.waveTime + run.bossTime) * 10.5 + slot.phase) * height * .016;
    if (image) {
      const baseline = screen.y + bob + (shooting ? height * .012 : 0);
      const lean = run.player._visualLean || 0;
      if (Math.abs(lean) < .001) {
        if (!stressMode && height > 24) {
          ctx.fillStyle = 'rgba(9,22,28,.34)';
          ctx.beginPath();
          ctx.ellipse(screen.x, baseline + 2, height * .16, height * .038, 0, 0, Math.PI * 2);
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
    // Grounded at the squad's feet with a depth-scaled radius and a soft additive fill,
    // instead of a flat fixed-size ellipse floating above the sprites.
    const radius = clamp(W * .1, 40, 100) * depthCurve(.965) * (1 + Math.sin(ambientTime * 8) * .04);
    const ringY = label.y + radius * .1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#69e5ff';
    ctx.beginPath();
    ctx.ellipse(label.x, ringY, radius, radius * .32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(105,229,255,.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(label.x, ringY, radius, radius * .32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFrenzyOverlay(target, width, height, time) {
  const pulse = .72 + Math.sin(time * 8.5) * .18;
  const thickness = clamp(Math.min(width, height) * .045, 18, 36);
  target.save();
  target.globalCompositeOperation = 'screen';
  const top = target.createLinearGradient(0, 0, 0, thickness);
  top.addColorStop(0, `rgba(69,224,255,${.45 * pulse})`);
  top.addColorStop(.45, `rgba(255,211,72,${.16 * pulse})`);
  top.addColorStop(1, 'rgba(69,224,255,0)');
  target.fillStyle = top;
  target.fillRect(0, 0, width, thickness);
  const bottom = target.createLinearGradient(0, height, 0, height - thickness);
  bottom.addColorStop(0, `rgba(255,210,69,${.38 * pulse})`);
  bottom.addColorStop(1, 'rgba(69,224,255,0)');
  target.fillStyle = bottom;
  target.fillRect(0, height - thickness, width, thickness);
  const left = target.createLinearGradient(0, 0, thickness, 0);
  left.addColorStop(0, `rgba(61,224,255,${.42 * pulse})`);
  left.addColorStop(1, 'rgba(61,224,255,0)');
  target.fillStyle = left;
  target.fillRect(0, 0, thickness, height);
  const right = target.createLinearGradient(width, 0, width - thickness, 0);
  right.addColorStop(0, `rgba(255,207,62,${.37 * pulse})`);
  right.addColorStop(1, 'rgba(61,224,255,0)');
  target.fillStyle = right;
  target.fillRect(width - thickness, 0, thickness, height);
  target.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let index = 0; index < 4; index += 1) {
      const cornerX = side < 0 ? 0 : width;
      const direction = side < 0 ? 1 : -1;
      const offset = index * thickness * .48;
      target.strokeStyle = index % 2
        ? `rgba(255,218,91,${.4 * pulse})`
        : `rgba(103,236,255,${.5 * pulse})`;
      target.lineWidth = Math.max(1, thickness * .085);
      target.beginPath();
      target.moveTo(cornerX + direction * (4 + offset), 3);
      target.lineTo(cornerX + direction * (thickness * 2.1 + offset), thickness * .74);
      target.moveTo(cornerX + direction * (4 + offset), height - 3);
      target.lineTo(cornerX + direction * (thickness * 2.1 + offset), height - thickness * .74);
      target.stroke();
    }
  }
  target.restore();
}

function waterMaskPixelAudit() {
  const surface = document.createElement('canvas');
  surface.width = W;
  surface.height = H;
  const target = surface.getContext('2d');
  target.save();
  traceWaterRegions(target);
  target.clip();
  target.fillStyle = '#fff';
  target.fillRect(0, 0, W, H);
  target.restore();
  let maxDeckAlpha = 0;
  let minWaterAlpha = 255;
  for (const y of [.08, .2, .4, .65, .9]) {
    const screenY = Math.max(0, Math.min(H - 1, Math.round(perspectiveY(y))));
    for (const x of [-.72, 0, .72]) {
      const screenX = Math.max(0, Math.min(W - 1, Math.round(worldToScreen(x, y).x)));
      maxDeckAlpha = Math.max(maxDeckAlpha, target.getImageData(screenX, screenY, 1, 1).data[3]);
    }
    const outsideX = Math.max(0, Math.round(W / 2 - bridgeHalfWidth(y) * 1.055 - 8));
    minWaterAlpha = Math.min(minWaterAlpha, target.getImageData(outsideX, screenY, 1, 1).data[3]);
  }
  return { maxDeckAlpha, minWaterAlpha };
}

function frenzyPixelAudit() {
  const surface = document.createElement('canvas');
  surface.width = 120;
  surface.height = 120;
  const target = surface.getContext('2d');
  drawFrenzyOverlay(target, surface.width, surface.height, .37);
  const alphaAt = (x, y) => target.getImageData(x, y, 1, 1).data[3];
  return {
    centerAlpha: alphaAt(60, 60),
    borderAlpha: Math.max(alphaAt(2, 60), alphaAt(117, 60), alphaAt(60, 2), alphaAt(60, 117)),
    cornerAlpha: Math.max(alphaAt(3, 3), alphaAt(116, 3), alphaAt(3, 116), alphaAt(116, 116)),
  };
}

function drawEffects() {
  for (const particle of run.particles) {
    const x = lerp(particle.previousX, particle.x, renderAlpha);
    const y = lerp(particle.previousY, particle.y, renderAlpha);
    const screen = projectToScreen(x, y, projectionScratchA);
    if (!screen.visible) continue;
    ctx.globalAlpha = clamp(particle.life * 2.2, 0, 1) * horizonFade(sceneProjection, y);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, projectedPixels(sceneProjection, y, particle.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const floater of run.floaters) {
    const screen = projectToScreen(floater.x, floater.y, projectionScratchA);
    if (!screen.visible) continue;
    // Below this, text becomes illegible sub-pixel noise near the horizon -- cull it (V7).
    const size = Math.max(0, projectedPixels(sceneProjection, floater.y, floater.size));
    if (size < 10) continue;
    ctx.globalAlpha = clamp(floater.life, 0, 1) * horizonFade(sceneProjection, floater.y);
    ctx.font = `1000 ${size}px system-ui`;
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(.6, size * .14);
    ctx.strokeStyle = 'rgba(0,0,0,.48)';
    ctx.fillStyle = floater.color;
    ctx.strokeText(floater.text, screen.x, screen.y);
    ctx.fillText(floater.text, screen.x, screen.y);
  }
  ctx.globalAlpha = 1;
  if (run.frenzyTimer > 0) drawFrenzyOverlay(ctx, W, H, ambientTime);
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
  if (option) { audio.uiClick(); selectDifficulty(option.dataset.difficulty); }
});
dom.playBtn.onclick = () => { audio.unlock(); startRun(Date.now() >>> 0, selectedDifficulty); };
dom.pauseBtn.onclick = () => { audio.uiClick(); state === GAME_STATE.PAUSED ? resumeGame() : pauseGame(); };
dom.resumeBtn.onclick = () => { audio.uiClick(); resumeGame(); };
dom.restartBtn.onclick = () => { audio.uiClick(); startRun(Date.now() >>> 0, run.difficulty); };
dom.retryBtn.onclick = () => { audio.uiClick(); startRun(Date.now() >>> 0, run.difficulty); };
dom.gameOverHomeBtn.onclick = () => { audio.uiClick(); returnHome(); };
dom.muteBtn.onclick = () => {
  const muted = audio.toggleMute();
  dom.muteBtn.textContent = muted ? '🔇' : '🔊';
  dom.muteBtn.setAttribute('aria-pressed', String(muted));
  dom.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
};

function getStateSnapshot() {
  const activeEnemies = run.enemies.filter(enemy => !enemy.dead);
  return {
    state, phase: state, paused: state === GAME_STATE.PAUSED, resumeState,
    seed: run.seed, difficulty: run.difficulty, wave: run.wave,
    waveTime: run.waveTime, waveDuration: config.duration, bossTime: run.bossTime,
    score: run.score, skillPoints: run.points, lives: run.lives, kills: run.kills,
    combo: run.combo, comboTimer: run.comboTimer, bestCombo: run.bestCombo, records: { ...records },
    troops: run.player.troops, armor: run.player.armor, power: run.player.power,
    fireRate: run.player.fireRate, bulletSpeed: run.player.bulletSpeed,
    projectiles: run.player.projectiles, pierce: run.player.pierce,
    criticalChance: run.player.criticalChance, formationDensity: run.player.formationDensity,
    recovery: run.player.recovery, protectedFor: run.player.protectedFor,
    frenzyTimer: run.frenzyTimer,
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
    id: ++enemySerial, type: 'boss', name: 'SCARLET ENGINE', lane: 1, x: 0, y: .68, previousY: .68,
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
    setPoints(value) { run.points = Math.max(0, Math.round(Number(value) || 0)); updateHud(true); return run.points; },
    setLives(value) { run.lives = clamp(Math.round(Number(value) || 0), 0, 2); updateHud(true); return run.lives; },
    setBuild(build = {}) { Object.assign(run.player, build); updateHud(true); return this.getState(); },
    setPlayerX(value) { run.player.x = run.player.targetX = clamp(Number(value) || 0, -LANE_LIMIT, LANE_LIMIT); updateHud(); return run.player.x; },
    fireNow(times = 1) { const counts = []; for (let index = 0; index < clamp(Math.round(times), 1, 100); index += 1) counts.push(fireBurst()); return counts; },
    spawnEnemyAt(type = 'grunt', lane = 1, y = .82, ready = false) { const enemy = spawnEnemy(type, { lane, x: laneCenter(lane), y }); if (enemy && ready) enemy.shotTimer = 0; return enemy ? { type: enemy.type, lane: enemy.lane, x: enemy.x, y: enemy.y, hp: enemy.hp, shield: enemy.shield } : null; },
    spawnFormation(type = 'wall', count) { return spawnFormation(type, count); },
    spawnHordeNow() { return spawnFormation(); },
    setGateEncounter(options, y = .52, neutralLane = 1) { const encounter = setDebugGateEncounter(options, y, neutralLane); return encounter.gates.map(gate => ({ id: gate.id, lane: gate.lane, x: gate.x, text: gateText(gate), tone: gate.tone })); },
    setGatePair(left, right, y = .52) { return this.setGateEncounter([left, right], y, 1); },
    forceBoss() { if (!ACTIVE_STATES.includes(state)) setState(GAME_STATE.PLAYING); spawnBoss(); run.boss.y = run.boss.previousY = .68; updateHud(true); return this.getState(); },
    setBossPhase(value) { if (!run.boss) this.forceBoss(); const phase = clamp(Math.round(value), 1, 3); run.boss.hp = run.boss.maxHp * (phase === 1 ? .9 : phase === 2 ? .55 : .2); updateBossPhase(); updateHud(true); return run.boss.phase; },
    setBossHp(value) { if (run.boss) { run.boss.hp = clamp(Number(value) || 0, 0, run.boss.maxHp); updateBossPhase(); updateHud(true); } return run.boss?.hp ?? null; },
    defeatBoss() { if (!run.boss) this.forceBoss(); run.boss.hp = 0; finishBoss(); return state; },
    chooseReward(id) { const pick = id || dom.rewardCards.firstElementChild?.dataset.upgrade; return armoryMode === 'reward' ? chooseFreeReward(pick) : chooseBossReward(pick); },
    forceReward() { armoryMode = 'shop'; armoryRewardPicked = false; run.rewardChoices = null; setState(GAME_STATE.BOSS_REWARD); showBossRewards(); return state; },
    purchase(id) { if (state !== GAME_STATE.BOSS_REWARD) openArmory(); return buyFromShop(id); },
    damageTroops(value) { damageSquad(value, run.player.x); return run.player.troops; },
    forceRevival() { run.lives = Math.max(1, run.lives); run.player.troops = 1; damageSquad(99, run.player.x); return this.getState(); },
    forceGameOver() { run.lives = 0; run.player.troops = 1; damageSquad(99, run.player.x); return state; },
    stressScene() { return setupStressScene(); },
    pause() { pauseGame(); return state; },
    resume() { resumeGame(); return state; },
    freeze(value = true) { qaFrozen = Boolean(value); return qaFrozen; },
    projectionAudit() { return bridgeProjectionAudit(); },
    waterMaskAudit() { return waterMaskPixelAudit(); },
    frenzyAudit() { return frenzyPixelAudit(); },
    setFrenzy(seconds = 6) { run.frenzyTimer = Math.max(0, Number(seconds) || 0); updateHud(true); return run.frenzyTimer; },
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
  if (mode === 'gameplay' || mode === 'horde' || mode === 'frenzy') {
    run.player.troops = 24;
    spawnFormation('wall', 36);
    for (const enemy of run.enemies) { enemy.y += .17; enemy.previousY = enemy.y; }
    if (mode === 'frenzy') run.frenzyTimer = 6.4;
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
    run.boss.y = run.boss.previousY = .68;
    fireBurst();
  } else if (mode === 'boss-phase-3') {
    run.wave = 15;
    config = getWaveConfig(run.wave, run.difficulty);
    run.player.troops = 48;
    spawnBoss();
    run.boss.y = run.boss.previousY = .68;
    run.boss.hp = run.boss.maxHp * .2;
    updateBossPhase();
    spawnBossAttack();
    fireBurst();
  } else if (mode === 'reward' || mode === 'upgrade') {
    run.wave = 5;
    run.points = 8;
    setState(GAME_STATE.BOSS_REWARD);
    showBossRewards();
  } else if (mode === 'shop' || mode === 'pause') {
    run.wave = 7;
    run.points = 24;
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
    run.points = 18420;
    run.kills = 734;
    run.bestCombo = 42;
    run.player.troops = 0;
    gameOver();
  }
  qaFrozen = true;
  updateHud(true);
}

function applyScreenShake() {
  if (!stageElement) return;
  if (qaFrozen || shakeTrauma <= 0) {
    stageElement.style.transform = '';
    return;
  }
  const amount = shakeTrauma * shakeTrauma;
  const maxOffset = Math.min(W, H) * .012;
  const nx = Math.sin(ambientTime * 47.3) * Math.cos(ambientTime * 13.1);
  const ny = Math.cos(ambientTime * 39.7) * Math.sin(ambientTime * 17.9);
  stageElement.style.transform = `translate3d(${(nx * amount * maxOffset).toFixed(2)}px, ${(ny * amount * maxOffset).toFixed(2)}px, 0)`;
}

function loop(timestamp) {
  const elapsedMs = lastTimestamp ? Math.min(100, timestamp - lastTimestamp) : 0;
  lastTimestamp = timestamp;
  ambientTime += elapsedMs / 1000;
  // Hit-stop scales the delta fed into the accumulator, not SIM_STEP itself -- the fixed
  // step and its 2-step catch-up cap are untouched, so this is purely a perceived-time effect.
  let timeScale = 1;
  if (hitStopHold > 0) {
    timeScale = HIT_STOP_SCALE;
    hitStopHold -= elapsedMs / 1000;
  } else if (hitStopEase > 0) {
    timeScale = lerp(HIT_STOP_SCALE, 1, 1 - hitStopEase / HIT_STOP_EASE_SECONDS);
    hitStopEase -= elapsedMs / 1000;
  }
  if (ACTIVE_STATES.includes(state) && !qaFrozen && elapsedMs > 0) {
    frameSamples.push(elapsedMs);
    if (frameSamples.length > 3600) frameSamples.shift();
    accumulator = Math.min(.1, accumulator + (elapsedMs * timeScale) / 1000);
    let steps = 0;
    while (accumulator >= SIM_STEP && steps < 2) {
      update(SIM_STEP);
      accumulator -= SIM_STEP;
      steps += 1;
    }
    if (steps === 2 && accumulator >= SIM_STEP) accumulator = 0;
    renderAlpha = accumulator / SIM_STEP;
  } else renderAlpha = 1;
  applyScreenShake();
  // The synthetic max-density fixture represents far more simultaneous action than
  // normal play. Alternate its render frames while keeping fixed-step simulation live;
  // this mirrors the dense-scene LOD strategy and protects input/update cadence.
  stressRenderPhase = (stressRenderPhase + 1) % 3;
  if (!stressMode || stressRenderPhase === 0) draw();
  requestAnimationFrame(loop);
}

async function boot() {
  renderRecords();
  await loadRuntimeAssets();
  updateDifficultyPicker();
  prepareCapture(captureMode);
  updateHud(true);
  requestAnimationFrame(loop);
}

boot();
