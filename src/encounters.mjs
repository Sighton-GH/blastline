// Encounter lane: enemy diversity, mid-wave events, elite minibosses and
// breach (loss) pressure. Pure logic lives here so the whole lane is unit
// testable; game.js keeps only narrow seams (spawn hooks, one collision
// branch, event triggers, draw markers).
import { clamp } from './core.mjs';

// --- New enemy archetypes -------------------------------------------------
// warden: support aura - nearby allies take reduced bullet damage until the
//   warden is focused down. Wardens never shield other wardens.
// bulwark: armored crusher - every bullet hit is capped at BULWARK_HIT_CAP
//   damage regardless of power, so single-hit power builds stall against it
//   and fire-rate / multishot builds answer it.
// sapper: fast bomb carrier - killed by bullets it detonates, damaging every
//   enemy around it (chain reactions included); if it breaches instead, it
//   hits the line for FULL contact damage. High-value target either way.
export const WARDEN_AURA = Object.freeze({ radiusX: .3, radiusY: .12, factor: .65 });
export const BULWARK_HIT_CAP = 2;
export const SAPPER_BLAST = Object.freeze({ radiusX: .24, radiusY: .09, damageFactor: 2, minDamage: 3 });

export function cappedHitDamage(enemy, damage) {
  const cap = enemy?.hitCap ?? (enemy?.type === 'bulwark' ? BULWARK_HIT_CAP : null);
  if (!cap) return damage;
  return Math.min(damage, cap);
}

export function isWarden(enemy) {
  return Boolean(enemy) && !enemy.dead && enemy.type === 'warden';
}

// Damage multiplier applied to a bullet hit on `enemy` given the live
// wardens. Elite wardens carry a stronger, wider aura (fields on the enemy).
export function wardenAuraFactor(enemy, wardens) {
  if (!enemy || enemy.type === 'warden') return 1;
  let factor = 1;
  for (const warden of wardens || []) {
    if (!warden || warden.dead) continue;
    const rx = warden.auraRadiusX ?? WARDEN_AURA.radiusX;
    const ry = warden.auraRadiusY ?? WARDEN_AURA.radiusY;
    if (Math.abs(enemy.x - warden.x) <= rx && Math.abs(enemy.y - warden.y) <= ry) {
      factor = Math.min(factor, warden.auraFactor ?? WARDEN_AURA.factor);
    }
  }
  return factor;
}

// Loss pressure: a breach always costs the squad. Units that slip past the
// player's position deal half contact (the line scatters to cover); sappers
// and elites ram the line for full contact. Minimum 1 - a leak is never free.
export function breachDamageFor(enemy) {
  const contact = Math.max(1, Math.round(enemy?.contact ?? 1));
  if (enemy?.elite || enemy?.type === 'sapper') return contact;
  return Math.max(1, Math.floor(contact / 2));
}

export function sapperBlastDamage(enemy) {
  return Math.max(SAPPER_BLAST.minDamage, Math.round((enemy?.contact || 2) * SAPPER_BLAST.damageFactor));
}

// --- Elite minibosses ------------------------------------------------------
export const ELITE_ROSTER = Object.freeze([
  Object.freeze({ id: 'warden-prime', name: 'WARDEN PRIME', baseType: 'warden', hpFactor: 30, scale: 1.85, speedFactor: .8, auraRadiusX: .42, auraRadiusY: .16, auraFactor: .5, contact: 6, volleyCadence: 3.6, shells: false, hitCap: null, reward: 260 }),
  Object.freeze({ id: 'bulwark-prime', name: 'BULWARK PRIME', baseType: 'bulwark', hpFactor: 34, scale: 2.0, speedFactor: .7, auraRadiusX: null, auraRadiusY: null, auraFactor: null, contact: 7, volleyCadence: 4.0, shells: false, hitCap: 3, reward: 300 }),
  Object.freeze({ id: 'demolisher', name: 'THE DEMOLISHER', baseType: 'sapper', hpFactor: 26, scale: 1.75, speedFactor: .6, auraRadiusX: null, auraRadiusY: null, auraFactor: null, contact: 9, volleyCadence: 3.0, shells: true, hitCap: null, reward: 320 }),
]);

// First elite marches on wave 4; the roster then rotates every second wave.
export function eliteForWave(wave) {
  const w = Math.max(4, Math.floor(Number.isFinite(wave) ? wave : 4));
  return ELITE_ROSTER[Math.floor((w - 4) / 2) % ELITE_ROSTER.length];
}

export function eliteRewardPoints(elite, wave) {
  return Math.round((elite?.reward || 260) + Math.max(1, Math.floor(wave || 1)) * 25);
}

// --- Mid-wave events --------------------------------------------------------
export const WAVE_EVENT_KINDS = Object.freeze(['surge', 'strafe', 'elite']);

// Deterministic per-wave event schedule. Waves 1-3 stay clean so the opening
// teaches the base loop; from wave 4 every wave carries at least one event.
// Boss waves (every 3rd) never stack an elite on top of the boss - surge and
// strafe only. `rng` is the run's seeded stream, so a given seed replays the
// same schedule.
export function planWaveEvents(rng, wave, duration = 30) {
  const w = Math.floor(Number.isFinite(wave) ? wave : 1);
  if (w < 4) return [];
  const bossWave = w % 3 === 0;
  const pool = bossWave ? ['surge', 'strafe'] : ['elite', 'surge', 'strafe'];
  let count = 1;
  if (w >= 9 && !bossWave) count = 2;
  else if (w >= 7 && rng() < .5) count = 2;
  count = Math.min(count, pool.length);
  const events = [];
  const picks = [...pool];
  // Wave 4 always introduces the elite; later waves draw from the pool.
  if (w === 4) {
    events.push({ kind: 'elite', at: 0 });
  } else {
    for (let i = 0; i < count; i += 1) {
      const index = Math.floor(rng() * picks.length);
      events.push({ kind: picks.splice(index, 1)[0], at: 0 });
    }
  }
  const late = Math.max(7, duration * .62);
  for (let i = 0; i < events.length; i += 1) {
    const slot = (i + .5 + rng() * .45) / events.length;
    events[i].at = clamp(+(5 + (late - 5) * slot).toFixed(2), 5, Math.max(6, duration - 6));
  }
  events.sort((a, b) => a.at - b.at);
  return events;
}
