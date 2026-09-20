const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (start, end, amount) => start + (end - start) * amount;

export const CAMERA_PROFILES = Object.freeze({
  landscape: Object.freeze({
    name: 'landscape',
    horizon: -.16,
    nearRoadHalf: .300,
    shoulderRatio: 1.18,
    depthRatio: 5.0,
    towerDepths: Object.freeze([.26, 1.00]),
    towerWorldHeight: 1.00,
    railWorldHeight: .075,
  }),
  landscapeCompact: Object.freeze({
    name: 'landscapeCompact',
    horizon: -.04,
    nearRoadHalf: .300,
    shoulderRatio: 1.18,
    depthRatio: 3.6,
    towerDepths: Object.freeze([.26, 1.00]),
    towerWorldHeight: 1.00,
    railWorldHeight: .075,
  }),
  portrait: Object.freeze({
    name: 'portrait',
    horizon: -.02,
    nearRoadHalf: .45,
    shoulderRatio: 1.06,
    depthRatio: 2.8,
    towerDepths: Object.freeze([.26, 1.00]),
    towerWorldHeight: .95,
    railWorldHeight: .068,
  }),
});

export function profileForViewport(width, height) {
  if (width < height) return CAMERA_PROFILES.portrait;
  // Short landscape (a rotated phone): the full landscape camera compresses the
  // whole far field into the strip hidden behind the HUD, so enemies spawn and
  // die invisibly. Use the tilted compact camera - same fix as portrait.
  if (height < 560) return CAMERA_PROFILES.landscapeCompact;
  return CAMERA_PROFILES.landscape;
}

/**
 * A true pinhole-camera 1/Z curve. worldY is linear in distance from the
 * camera; depthRatio = Zfar / Znear sets how hard the curve compresses the
 * far field. depthScale(1) === 1 exactly (near reference plane), and the
 * far gameplay plane worldY = 0 sits at depthScale = 1 / depthRatio, not at
 * the horizon — the horizon is only reached as worldY -> -Infinity.
 */
export function depthScale(profile, worldY) {
  const r = profile.depthRatio;
  const y = Math.min(worldY, 1.08);
  return Math.max(.02, 1 / (r - (r - 1) * y));
}

export function createProjection(width, height, requestedProfile = null) {
  const profile = typeof requestedProfile === 'string'
    ? CAMERA_PROFILES[requestedProfile]
    : requestedProfile || profileForViewport(width, height);
  const horizon = height * profile.horizon;
  return Object.freeze({
    width,
    height,
    centerX: width / 2,
    horizon,
    deckBottom: height * 1.025,
    profile,
  });
}

export function projectGround(projection, worldX, worldY, result = {}) {
  const scale = depthScale(projection.profile, worldY);
  result.scale = scale;
  result.x = projection.centerX + worldX * projection.width * projection.profile.nearRoadHalf * scale;
  result.y = projection.horizon + (projection.deckBottom - projection.horizon) * scale;
  result.visible = worldY > -.5 && result.y >= projection.horizon && result.y <= projection.height * 1.075;
  return result;
}

export function groundY(projection, worldY) {
  return projection.horizon + (projection.deckBottom - projection.horizon) * depthScale(projection.profile, worldY);
}

export function roadHalfWidth(projection, worldY) {
  return projection.width * projection.profile.nearRoadHalf * depthScale(projection.profile, worldY);
}

export function bridgeHalfWidth(projection, worldY) {
  return roadHalfWidth(projection, worldY) * projection.profile.shoulderRatio;
}

/** Road half-width derived from a screen row directly, for tracing shapes top-down without inverting depthScale. */
export function roadHalfWidthAtRow(projection, screenY) {
  const span = projection.deckBottom - projection.horizon;
  return projection.width * projection.profile.nearRoadHalf * clamp((screenY - projection.horizon) / span, 0, 1.1);
}

export function projectedPixels(projection, worldY, nearPixelSize) {
  return nearPixelSize * depthScale(projection.profile, worldY);
}

export function horizonFade(projection, worldY, fadeWorldDepth = .16) {
  if (worldY <= 0) return 0;
  return clamp(worldY / fadeWorldDepth, 0, 1);
}

function bridgeEdgePoint(projection, side, worldY, widthScale = 1) {
  return {
    x: projection.centerX + side * bridgeHalfWidth(projection, worldY) * widthScale,
    y: groundY(projection, worldY),
    scale: depthScale(projection.profile, worldY),
    worldY,
  };
}

function railPoint(projection, side, worldY) {
  const point = bridgeEdgePoint(projection, side, worldY, 1.035);
  return {
    ...point,
    y: point.y - projection.height * projection.profile.railWorldHeight * point.scale,
  };
}

function cableEdgePoint(projection, side, worldY) {
  const point = bridgeEdgePoint(projection, side, worldY, 1.055);
  return {
    ...point,
    y: point.y - projection.height * projection.profile.railWorldHeight * point.scale,
  };
}

function pointOnSpan(projection, side, span, worldY) {
  const amount = clamp((worldY - span.from.worldY) / (span.to.worldY - span.from.worldY || 1), 0, 1);
  const edge = cableEdgePoint(projection, side, worldY);
  return {
    x: edge.x,
    y: lerp(span.from.y, span.to.y, amount) + span.sag * 4 * amount * (1 - amount),
    worldY,
  };
}

/**
 * Produces all structural anchors from shared world stations. The same tower
 * width and height are scaled at both stations; cable samples and hangers are
 * then derived from those exact anchor objects.
 */
export function buildBridgeGeometry(projection, { cableSamples = 28, hangerStep = .043 } = {}) {
  const profile = projection.profile;
  const towerWorldHeight = projection.height * profile.towerWorldHeight;
  const pillarWorldWidth = clamp(Math.min(projection.width, projection.height) * .04, 15, 32);
  const beamWorldHeight = clamp(projection.height * .035, 18, 30);
  const towers = profile.towerDepths.map(worldY => {
    const scale = depthScale(profile, worldY);
    const baseY = groundY(projection, worldY);
    const xs = [-1, 1].map(side => bridgeEdgePoint(projection, side, worldY, 1.055).x);
    return {
      worldY,
      scale,
      baseY,
      topY: baseY - towerWorldHeight * scale,
      height: towerWorldHeight * scale,
      pillarWidth: pillarWorldWidth * scale,
      beamHeight: beamWorldHeight * scale,
      xs,
    };
  });

  const cables = [];
  const hangers = [];
  for (const side of [-1, 1]) {
    const anchors = [
      { ...cableEdgePoint(projection, side, 0), worldY: 0 },
      { x: towers[0].xs[side > 0 ? 1 : 0], y: towers[0].topY, worldY: towers[0].worldY },
      { x: towers[1].xs[side > 0 ? 1 : 0], y: towers[1].topY, worldY: towers[1].worldY },
      { ...cableEdgePoint(projection, side, 1.02), worldY: 1.02 },
    ];
    const spans = anchors.slice(0, -1).map((from, index) => {
      const to = anchors[index + 1];
      const meanScale = (depthScale(profile, from.worldY) + depthScale(profile, to.worldY)) / 2;
      const sagFactors = [.065, .17, .105];
      return { side, index, from, to, sag: projection.height * sagFactors[index] * meanScale };
    });
    for (const span of spans) {
      const points = Array.from({ length: cableSamples + 1 }, (_, index) => (
        pointOnSpan(projection, side, span, lerp(span.from.worldY, span.to.worldY, index / cableSamples))
      ));
      cables.push({ ...span, points });
    }
    for (let worldY = hangerStep; worldY < 1.015; worldY += hangerStep) {
      const span = spans.find(candidate => worldY >= candidate.from.worldY && worldY <= candidate.to.worldY);
      if (!span) continue;
      const cable = pointOnSpan(projection, side, span, worldY);
      const rail = railPoint(projection, side, worldY);
      if (cable.y < rail.y - .25) hangers.push({ side, worldY, cable, rail });
    }
  }

  return {
    projection,
    towers,
    cables,
    hangers,
    towerWorldHeight,
    pillarWorldWidth,
    beamWorldHeight,
  };
}

export function projectionAuditGeometry(projection, geometry = buildBridgeGeometry(projection)) {
  const steps = Array.from({ length: 21 }, (_, index) => index / 20);
  const projectedSteps = steps.map(worldY => groundY(projection, worldY));
  const speeds = projectedSteps.slice(1).map((value, index) => value - projectedSteps[index]);
  const anchorErrors = geometry.cables.flatMap(cable => {
    const first = cable.points[0];
    const last = cable.points.at(-1);
    return [
      Math.hypot(first.x - cable.from.x, first.y - cable.from.y),
      Math.hypot(last.x - cable.to.x, last.y - cable.to.y),
    ];
  });
  const towerClearance = geometry.towers.length ? Math.min(...geometry.towers.flatMap(tower => tower.xs.map((x, index) => {
    const side = index ? 1 : -1;
    const roadEdge = projection.centerX + side * roadHalfWidth(projection, tower.worldY);
    return Math.abs(x - projection.centerX) - tower.pillarWidth * .62 - Math.abs(roadEdge - projection.centerX);
  }))) : Infinity;
  return {
    horizon: projection.horizon,
    deckBottom: groundY(projection, 1),
    vanishingX: projection.centerX,
    vanishingRoadWidth: roadHalfWidth(projection, 0) * 2,
    vanishingBridgeWidth: bridgeHalfWidth(projection, 0) * 2,
    roadWidthRatio: roadHalfWidth(projection, 1) * 2 / projection.width,
    minProjectedStep: Math.min(...speeds),
    maxProjectedStep: Math.max(...speeds),
    projectedSpeedRatio: Math.max(...speeds) / Math.max(.0001, Math.min(...speeds)),
    cableAnchorError: Math.max(0, ...anchorErrors),
    hangerAnchorError: 0,
    towerClearance,
    towerHeightScaleError: geometry.towers.length >= 2 ? Math.abs(geometry.towers[0].height / geometry.towers[0].scale - geometry.towers[1].height / geometry.towers[1].scale) : 0,
    profile: projection.profile.name,
  };
}

export function isInsideRoad(projection, screenX, screenY, worldY, inset = 0) {
  if (worldY <= 0 || screenY < projection.horizon) return false;
  return Math.abs(screenX - projection.centerX) <= roadHalfWidth(projection, worldY) - inset;
}
