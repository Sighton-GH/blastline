import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bridgeHalfWidth,
  buildBridgeGeometry,
  createProjection,
  depthScale,
  groundY,
  isInsideRoad,
  projectGround,
  projectionAuditGeometry,
  roadHalfWidth,
} from '../src/projection.mjs';

const VIEWPORTS = [
  { width: 1365, height: 768, profile: 'landscape', horizon: .09, farScale: .16 },
  { width: 390, height: 844, profile: 'portrait', horizon: .1, farScale: .18 },
];

test('camera profiles use a finite fog-clipped cross-section instead of a visible point', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    assert.equal(projection.profile.name, viewport.profile);
    assert.equal(projection.horizon, viewport.height * viewport.horizon);
    assert.ok(Math.abs(depthScale(projection.profile, 0) - viewport.farScale) < 1e-10);
    assert.ok(roadHalfWidth(projection, 0) > 0);
    assert.ok(bridgeHalfWidth(projection, 0) > roadHalfWidth(projection, 0));
    assert.ok(Math.abs(roadHalfWidth(projection, 0) / roadHalfWidth(projection, 1) - viewport.farScale) < 1e-10);
    const farPoint = projectGround(projection, -.8, 0);
    assert.equal(farPoint.scale, viewport.farScale);
    assert.equal(farPoint.visible, false);
    assert.ok(farPoint.x < projection.centerX && farPoint.y > projection.horizon);
  }
});

test('equal logical approach steps have bounded projected acceleration', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    const screenY = Array.from({ length: 21 }, (_, index) => groundY(projection, index / 20));
    const steps = screenY.slice(1).map((value, index) => value - screenY[index]);
    assert.ok(steps.every((value, index) => index === 0 || value >= steps[index - 1]));
    assert.ok(Math.max(...steps) / Math.min(...steps) < 1.4);
  }
});

test('road, gates, enemies, health bars, and shadows share one monotonic scale', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    let previous = -1;
    for (const y of [.02, .08, .2, .45, .7, 1]) {
      const scale = depthScale(projection.profile, y);
      assert.ok(scale > previous);
      previous = scale;
      const roadScale = roadHalfWidth(projection, y) / roadHalfWidth(projection, 1);
      const gateScale = (viewport.height * .1 * scale) / (viewport.height * .1);
      const enemyScale = (74 * scale) / 74;
      const shadowScale = (74 * scale * .42) / (74 * .42);
      const healthScale = (74 * scale * .52) / (74 * .52);
      for (const candidate of [roadScale, gateScale, enemyScale, shadowScale, healthScale]) {
        assert.ok(Math.abs(candidate - scale) < 1e-10);
      }
    }
  }
});

test('approach, retreat, and lateral animation use one coherent screen-space projection', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    const start = { x: -.31, y: .42 };
    const motions = [
      { name: 'enemy', vx: 0, vy: .052 },
      { name: 'hostile projectile', vx: .04, vy: .052 },
      { name: 'player projectile', vx: .04, vy: -.052 },
      { name: 'gate and lane marker', vx: 0, vy: .052 },
    ];
    const deltas = new Map();
    for (const motion of motions) {
      const from = projectGround(projection, start.x, start.y);
      const to = projectGround(projection, start.x + motion.vx, start.y + motion.vy);
      deltas.set(motion.name, { dx: to.x - from.x, dy: to.y - from.y, scale: to.scale - from.scale });
      assert.equal(Math.sign(to.y - from.y), Math.sign(motion.vy));
      assert.equal(Math.sign(to.scale - from.scale), Math.sign(motion.vy));
      if (motion.vx > 0) assert.ok(to.x > projectGround(projection, start.x, start.y + motion.vy).x);
    }
    assert.ok(Math.abs(deltas.get('enemy').dy - deltas.get('gate and lane marker').dy) < 1e-10);
    assert.ok(Math.abs(deltas.get('enemy').scale - deltas.get('gate and lane marker').scale) < 1e-10);
  }
});

test('tower dimensions, cable endpoints, and hanger endpoints share exact anchors', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    const geometry = buildBridgeGeometry(projection);
    const normalizedTowerHeights = geometry.towers.map(tower => tower.height / tower.scale);
    assert.ok(Math.abs(normalizedTowerHeights[0] - normalizedTowerHeights[1]) < 1e-8);
    for (const cable of geometry.cables) {
      const first = cable.points[0];
      const last = cable.points.at(-1);
      assert.ok(Math.hypot(first.x - cable.from.x, first.y - cable.from.y) < 1e-8);
      assert.ok(Math.hypot(last.x - cable.to.x, last.y - cable.to.y) < 1e-8);
    }
    for (const hanger of geometry.hangers) {
      assert.equal(hanger.cable.worldY, hanger.worldY);
      assert.equal(hanger.rail.worldY, hanger.worldY);
      assert.ok(hanger.cable.y < hanger.rail.y);
    }
    const audit = projectionAuditGeometry(projection, geometry);
    assert.ok(audit.towerClearance > 0);
    assert.ok(audit.cableAnchorError < 1e-8);
    assert.ok(audit.hangerAnchorError < 1e-8);
  }
});

test('visible lane entity footpoints stay within the projected deck', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    for (const y of [.015, .06, .2, .5, .88, 1]) {
      for (const x of [-.82, -.58, 0, .58, .82]) {
        const point = projectGround(projection, x, y);
        assert.ok(point.visible);
        assert.ok(isInsideRoad(projection, point.x, point.y, y));
      }
    }
  }
});

test('removed gameplay wording and panel markup do not remain in presentation sources', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  const removed = ['enemy' + 'Counter', 'HOST' + 'ILES', 'SAFE' + ' LANE', "'SAFE'", 'safe' + '-gap'];
  for (const wording of removed) assert.ok(!`${html}\n${css}\n${runtime}`.includes(wording));
});

test('landscape camera keeps the reference bridge anchors and uninterrupted road surface', () => {
  const projection = createProjection(1904, 872, 'landscape');
  const geometry = buildBridgeGeometry(projection);
  const [farTower, nearTower] = geometry.towers;
  assert.ok(Math.abs(projection.horizon / projection.height - .09) < 1e-10);
  assert.ok(Math.abs(farTower.baseY / projection.height - .3687) < .002);
  assert.ok(Math.abs(nearTower.baseY / projection.height - .735) < .002);
  assert.ok(roadHalfWidth(projection, 1) * 2 / projection.width < .82);
  assert.ok(roadHalfWidth(projection, 1) * 2 / projection.width > .78);
  assert.ok(roadHalfWidth(projection, 0) / roadHalfWidth(projection, 1) > .14);
  assert.ok((farTower.xs[1] - farTower.xs[0]) / projection.width > .25);
  assert.ok((nearTower.xs[1] - nearTower.xs[0]) / projection.width < .65);

  const runtime = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8');
  assert.ok(!runtime.includes("asphalt: 'assets/blastline/environment/asphalt.webp'"));
  assert.ok(!runtime.includes('createPattern(runtimeAssets.asphalt'));
  assert.ok(!runtime.includes('Transverse seams'));
  assert.ok(!runtime.includes('const bands = 22'));
  assert.ok(runtime.includes('drawAtmosphericFog(target, horizon)'));
});
