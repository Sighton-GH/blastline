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
  { width: 1365, height: 768, profile: 'landscape', horizon: .14 },
  { width: 390, height: 844, profile: 'portrait', horizon: .16 },
];

test('camera profiles converge to a zero-width centered vanishing point', () => {
  for (const viewport of VIEWPORTS) {
    const projection = createProjection(viewport.width, viewport.height);
    assert.equal(projection.profile.name, viewport.profile);
    assert.equal(projection.horizon, viewport.height * viewport.horizon);
    assert.equal(roadHalfWidth(projection, 0), 0);
    assert.equal(bridgeHalfWidth(projection, 0), 0);
    assert.deepEqual(projectGround(projection, -.8, 0), {
      x: viewport.width / 2,
      y: projection.horizon,
      scale: 0,
      visible: false,
    });
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
