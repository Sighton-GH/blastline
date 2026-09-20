// Reinforcement boats: friendly landing craft that sail in through the water
// beside the bridge, hold station next to the squad's end of the deck, and
// offload bonus troops. Pure simulation + canvas art; game.js wires one
// update seam and one draw seam and stays the integration owner.
//
// Screen-space motion model: the world scrolls toward the viewer at
// `worldScroll` world-y per second (the same rate the road dashes and bridge
// furniture use). A boat under way adds its own speed on top of that drift;
// a boat tied up to offload holds station against the squad, so its screen
// position stays fixed while the world slides past - it reads as keeping
// pace with the marching squad.

import { clamp } from './core.mjs';

export const BOAT_TUNING = Object.freeze({
  firstSpawnDelay: 9,   // seconds into a run before the first boat appears
  spawnInterval: 24,    // seconds between launches
  retryDelay: 2,        // recheck delay when both water channels are busy
  spawnY: -0.55,        // enters near the horizon
  dockY: 0.62,          // ties up where the water channel is wide enough to read, beside the squad's half of the deck
  despawnY: 1.2,        // fully past the near edge
  inboundSpeed: 0.075,  // own speed toward the squad, world-y / s
  departSpeed: 0.15,    // downstream exit speed after offloading
  unloadSeconds: 2.2,
  maxActive: 2,         // one boat per water channel
  baseTroops: 3,
  wavesPerExtraTroop: 5,
  maxTroops: 8,
});

// Wave-scaled but firmly capped: boats top up attrition, they never out-earn
// the squad upgrade track (+8/tier, rising cost) or squad gates (+10/+16).
export function boatReinforcementSize(wave = 1) {
  const w = clamp(Math.floor(Number.isFinite(wave) ? wave : 1), 1, 1_000_000);
  return Math.min(
    BOAT_TUNING.maxTroops,
    BOAT_TUNING.baseTroops + Math.floor((w - 1) / BOAT_TUNING.wavesPerExtraTroop),
  );
}

export function createBoatFleet() {
  return {
    boats: [],
    spawnTimer: BOAT_TUNING.firstSpawnDelay,
    nextSide: 1,   // first launch takes the starboard (right) channel
    launched: 0,
    delivered: 0,
    deliveredTroops: 0,
  };
}

export function spawnBoat(fleet, wave = 1, options = {}) {
  const side = options.side === -1 || options.side === 1 ? options.side : fleet.nextSide;
  if (!options.side) fleet.nextSide *= -1; // alternate water channels
  const boat = {
    id: ++fleet.launched,
    side,
    y: Number.isFinite(options.y) ? options.y : BOAT_TUNING.spawnY,
    phase: 'inbound',
    unloadTimer: 0,
    troops: boatReinforcementSize(wave),
    bobSeed: (fleet.launched * 1.618) % (Math.PI * 2),
    delivered: false,
  };
  fleet.boats.push(boat);
  return boat;
}

export function updateBoatFleet(fleet, dt, context = {}) {
  const step = clamp(Number(dt) || 0, 0, 0.25); // fixed-step sim: never leap past a phase change
  if (step <= 0) return fleet;
  const wave = Math.max(1, Math.floor(Number(context.wave) || 1));
  const scroll = Math.max(0, Number(context.worldScroll) || 0);

  for (const boat of fleet.boats) {
    if (boat.phase === 'inbound') {
      boat.y += (scroll + BOAT_TUNING.inboundSpeed) * step;
      if (boat.y >= BOAT_TUNING.dockY) {
        boat.y = BOAT_TUNING.dockY;
        boat.phase = 'unloading';
        boat.unloadTimer = BOAT_TUNING.unloadSeconds;
        if (!boat.delivered) {
          boat.delivered = true;
          fleet.delivered += 1;
          fleet.deliveredTroops += boat.troops;
          context.onDeliver?.(boat);
        }
      }
    } else if (boat.phase === 'unloading') {
      // Holding station against the squad: no world drift while tied up.
      boat.unloadTimer -= step;
      if (boat.unloadTimer <= 0) boat.phase = 'departing';
    } else if (boat.phase === 'departing') {
      boat.y += (scroll + BOAT_TUNING.departSpeed) * step;
    }
  }

  for (let index = fleet.boats.length - 1; index >= 0; index -= 1) {
    if (fleet.boats[index].phase === 'departing' && fleet.boats[index].y >= BOAT_TUNING.despawnY) {
      fleet.boats.splice(index, 1);
    }
  }

  // Launches happen after movement so a new boat enters at spawnY exactly and
  // first moves on the next tick.
  fleet.spawnTimer -= step;
  if (fleet.spawnTimer <= 0) {
    if (fleet.boats.length < BOAT_TUNING.maxActive) {
      fleet.spawnTimer += BOAT_TUNING.spawnInterval;
      spawnBoat(fleet, wave);
    } else {
      fleet.spawnTimer = BOAT_TUNING.retryDelay;
    }
  }
  return fleet;
}

// ---------------------------------------------------------------------------
// Canvas art. Solid fills only (no per-frame gradients) so draw cost stays
// flat; the caller clips to the water regions before invoking this.

const HULL = '#3d5a6c';
const HULL_DARK = '#2a414f';
const HULL_DECK = '#6b8291';
const ACCENT = '#59d6e8';   // squad cyan: friendly at a glance
const FOAM = 'rgba(226,248,255,.55)';

function drawWake(target, x, y, length, width, side) {
  // Foam trailing toward the horizon (away from the viewer), fanning out.
  target.strokeStyle = FOAM;
  target.lineCap = 'round';
  for (const splay of [-1, 1]) {
    target.lineWidth = Math.max(.8, width * .09);
    target.globalAlpha = .5;
    target.beginPath();
    target.moveTo(x + splay * width * .3, y - width * .1);
    target.quadraticCurveTo(
      x + splay * width * (.5 + length * .5), y - length * .55,
      x + splay * width * (.42 + length * .72), y - length,
    );
    target.stroke();
  }
  // Churned center strip.
  target.globalAlpha = .3;
  target.lineWidth = Math.max(.8, width * .22);
  target.beginPath();
  target.moveTo(x, y - width * .12);
  target.lineTo(x + side * width * .06, y - length * .8);
  target.stroke();
  target.globalAlpha = 1;
}

function drawBoat(target, boat, view) {
  const bob = Math.sin(view.ambientTime * 1.4 + boat.bobSeed);
  const deckBob = Math.sin(view.ambientTime * 1.4 + boat.bobSeed + .9);
  const y = view.perspectiveY(boat.y) + bob * view.scale(boat.y, 3);
  // Sit mid-channel between the bridge edge and the screen edge, sized to the
  // channel: on portrait phones the near-field water is a narrow strip, so the
  // hull shrinks to fit instead of sailing off-screen or clipping the deck.
  const edge = view.bridgeHalfWidth(boat.y) * 1.03;
  const channel = Math.max(0, view.width / 2 - edge);
  const x = view.width / 2 + boat.side * (edge + channel * 0.5);
  // Scale anchor: a soldier is ~55-60 world units tall, so a 90-unit hull beam
  // reads as a small landing craft (~4-5 soldier-widths) instead of a ferry.
  // Bryan rejected the original 240-unit hull as massively out of scale.
  const hullWid = Math.min(view.scale(boat.y, 90), channel * 0.62);
  const hullLen = hullWid * 2.4;             // along-screen (bow toward viewer)
  if (hullLen < 4) return; // still effectively at the horizon

  drawWake(target, x, y - hullLen * .42, hullLen * 1.4, hullWid, boat.side);

  const bowY = y + hullLen * .5;
  const sternY = y - hullLen * .5;

  // Water shadow seats the hull into the sea instead of floating on it.
  target.fillStyle = 'rgba(13,54,67,.32)';
  target.beginPath();
  target.ellipse(x, y + hullLen * .12, hullWid * .62, hullLen * .52, 0, 0, Math.PI * 2);
  target.fill();

  // Near bow face: the camera sits low behind the squad, so the front of the
  // craft shows as a darker vertical face with a foam waterline at its foot.
  const faceH = hullWid * .3;
  target.fillStyle = HULL_DARK;
  target.beginPath();
  target.moveTo(x - hullWid * .2, bowY);
  target.lineTo(x + hullWid * .2, bowY);
  target.lineTo(x + hullWid * .15, bowY + faceH);
  target.lineTo(x - hullWid * .15, bowY + faceH);
  target.closePath();
  target.fill();
  target.fillStyle = 'rgba(226,248,255,.5)';
  target.beginPath();
  target.ellipse(x, bowY + faceH, hullWid * .26, Math.max(1, hullWid * .08), 0, 0, Math.PI * 2);
  target.fill();

  // Hull: blunt landing-craft bow (flat ramp) facing the viewer, tapering
  // toward the stern at the horizon end.
  target.fillStyle = HULL;
  target.beginPath();
  target.moveTo(x - hullWid * .2, bowY);                         // bow ramp left
  target.lineTo(x + hullWid * .2, bowY);                         // bow ramp right
  target.lineTo(x + hullWid * .5, y + hullLen * .12);            // starboard shoulder
  target.lineTo(x + hullWid * .42, sternY + hullLen * .08);      // starboard stern
  target.lineTo(x - hullWid * .42, sternY + hullLen * .08);      // port stern
  target.lineTo(x - hullWid * .5, y + hullLen * .12);            // port shoulder
  target.closePath();
  target.fill();
  // Shadow side (away from the upper-left key light).
  target.fillStyle = HULL_DARK;
  target.beginPath();
  target.moveTo(x + hullWid * .06, bowY);
  target.lineTo(x + hullWid * .2, bowY);
  target.lineTo(x + hullWid * .5, y + hullLen * .12);
  target.lineTo(x + hullWid * .42, sternY + hullLen * .08);
  target.lineTo(x + hullWid * .1, sternY + hullLen * .05);
  target.closePath();
  target.fill();
  // Friendly cyan gunwale stripes, both sides.
  target.strokeStyle = ACCENT;
  target.lineWidth = Math.max(.8, hullWid * .045);
  target.lineCap = 'round';
  for (const splay of [-1, 1]) {
    target.beginPath();
    target.moveTo(x + splay * hullWid * .42, sternY + hullLen * .1);
    target.lineTo(x + splay * hullWid * .48, y + hullLen * .1);
    target.lineTo(x + splay * hullWid * .19, bowY - hullLen * .02);
    target.stroke();
  }
  // Bow ramp plate.
  target.fillStyle = '#557485';
  target.beginPath();
  target.moveTo(x - hullWid * .18, bowY);
  target.lineTo(x + hullWid * .18, bowY);
  target.lineTo(x + hullWid * .3, bowY - hullLen * .14);
  target.lineTo(x - hullWid * .3, bowY - hullLen * .14);
  target.closePath();
  target.fill();
  // Wall-top highlights along the far edges give the hull wall height.
  target.strokeStyle = 'rgba(240,250,255,.35)';
  target.lineWidth = Math.max(.7, hullWid * .03);
  target.beginPath();
  target.moveTo(x - hullWid * .42, sternY + hullLen * .08);
  target.lineTo(x - hullWid * .5, y + hullLen * .12);
  target.moveTo(x + hullWid * .42, sternY + hullLen * .08);
  target.lineTo(x + hullWid * .5, y + hullLen * .12);
  target.stroke();

  // Deck inset.
  target.fillStyle = HULL_DECK;
  target.beginPath();
  target.moveTo(x - hullWid * .26, bowY - hullLen * .16);
  target.lineTo(x + hullWid * .26, bowY - hullLen * .16);
  target.lineTo(x + hullWid * .38, y + hullLen * .06);
  target.lineTo(x + hullWid * .33, sternY + hullLen * .14);
  target.lineTo(x - hullWid * .33, sternY + hullLen * .14);
  target.lineTo(x - hullWid * .38, y + hullLen * .06);
  target.closePath();
  target.fill();

  // Cabin at the stern with a window band and a warm mast light matching the
  // bridge lamps.
  const cabW = hullWid * .52;
  const cabH = hullLen * .26;
  const cabY = sternY + hullLen * .08;
  target.fillStyle = '#6d8593'; // front face toward the camera
  target.fillRect(x - cabW / 2, cabY, cabW, cabH);
  target.fillStyle = '#9db2bd'; // roof
  target.beginPath();
  target.moveTo(x - cabW / 2, cabY);
  target.lineTo(x + cabW / 2, cabY);
  target.lineTo(x + cabW * .38, cabY - cabH * .3);
  target.lineTo(x - cabW * .38, cabY - cabH * .3);
  target.closePath();
  target.fill();
  target.fillStyle = 'rgba(20,32,40,.55)';
  target.fillRect(x - cabW / 2 + cabW * .08, cabY + cabH * .18, cabW * .84, cabH * .3);
  target.fillStyle = '#ffe9ad';
  target.beginPath();
  target.arc(x, cabY - hullWid * .04, Math.max(1, hullWid * .05), 0, Math.PI * 2);
  target.fill();

  // Troops on deck: friendly figures in squad cyan between cabin and ramp.
  const soldierH = Math.max(1.8, hullLen * .15);
  for (let index = 0; index < 3; index += 1) {
    const sx = x + (index - 1) * hullWid * .22;
    const sy = y + hullLen * .16 - index * hullLen * .05 + deckBob * soldierH * .06;
    target.fillStyle = ACCENT;
    target.beginPath();
    target.arc(sx, sy - soldierH, soldierH * .34, 0, Math.PI * 2);      // head
    target.fill();
    target.fillRect(sx - soldierH * .3, sy - soldierH * .78, soldierH * .6, soldierH * .8); // body
  }

  // Bow foam while under way.
  if (boat.phase !== 'unloading') {
    target.fillStyle = 'rgba(226,248,255,.4)';
    target.beginPath();
    target.ellipse(x, bowY + hullWid * .06, hullWid * .3, Math.max(1, hullWid * .09), 0, 0, Math.PI * 2);
    target.fill();
  }

  // While tied up: a taut offload line to the bridge edge reads as the
  // transfer actually happening; the floater announces the troop count.
  if (boat.phase === 'unloading') {
    const edgeX = view.width / 2 + boat.side * view.bridgeHalfWidth(boat.y) * 1.02;
    const pulse = .5 + .5 * Math.sin(view.ambientTime * 6);
    target.strokeStyle = `rgba(89,214,232,${.35 + .35 * pulse})`;
    target.lineWidth = Math.max(.8, hullWid * .03);
    target.beginPath();
    target.moveTo(x - boat.side * hullWid * .5, y + hullLen * .05);
    target.lineTo(edgeX, y + hullLen * .07);
    target.stroke();
    target.fillStyle = `rgba(226,248,255,${.25 + .2 * pulse})`;
    target.beginPath();
    target.ellipse(x, bowY + hullWid * .06, hullWid * .34, Math.max(1, hullWid * .1), 0, 0, Math.PI * 2);
    target.fill();
  }
}

export function drawBoatFleet(target, fleet, view) {
  // Far boats first so the nearer one overlaps correctly.
  const ordered = [...fleet.boats].sort((a, b) => a.y - b.y);
  for (const boat of ordered) drawBoat(target, boat, view);
}
