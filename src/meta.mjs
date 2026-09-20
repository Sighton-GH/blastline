// Blastline meta-progression (v2): persistent profile, permanent upgrade tracks,
// and the offline salvage cache. Pure functions + localStorage persistence.
export const META_KEY = 'blastline.profile.v1';
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000; // 8h cache cap
export const OFFLINE_BASE_PER_HOUR = 10;

export const META_TRACKS = Object.freeze([
  Object.freeze({ id: 'startingPower', title: 'Veteran Rifles', short: '+1 power every 4 tiers', maxTier: 20, baseCost: 40, effect: tiers => Math.floor(tiers / 4) }),
  Object.freeze({ id: 'startingTroops', title: 'Standing Reserve', short: '+4 starting squad / tier', maxTier: 20, baseCost: 35, effect: tiers => tiers * 4 }),
  Object.freeze({ id: 'salvageRate', title: 'Scavengers', short: '+4% salvage / tier', maxTier: 25, baseCost: 30, effect: tiers => 1 + tiers * 0.04 }),
  Object.freeze({ id: 'offlineRate', title: 'Supply Lines', short: '+6% cache rate / tier', maxTier: 25, baseCost: 30, effect: tiers => 1 + tiers * 0.06 }),
]);

export const META_BY_ID = Object.freeze(Object.fromEntries(META_TRACKS.map(track => [track.id, track])));

export function defaultProfile() {
  return { salvage: 0, tiers: {}, earned: 0, best: { wave: 0, score: 0 }, lastSeen: 0, runs: 0 };
}

export function loadProfile(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(META_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    return { ...defaultProfile(), ...parsed, best: { ...defaultProfile().best, ...(parsed.best || {}) }, tiers: { ...(parsed.tiers || {}) } };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile, storage = globalThis.localStorage) {
  try { storage?.setItem(META_KEY, JSON.stringify(profile)); } catch { /* private mode: session-only profile */ }
  return profile;
}

export function metaTier(profile, id) {
  return Math.max(0, Math.floor(profile?.tiers?.[id] || 0));
}

export function metaCost(id, tier) {
  const track = META_BY_ID[id];
  if (!track) return Infinity;
  return Math.round(track.baseCost * Math.pow(tier + 1, 1.6));
}

export function purchaseMeta(profile, id) {
  const track = META_BY_ID[id];
  if (!track) return { profile, ok: false, reason: 'unknown' };
  const tier = metaTier(profile, id);
  if (tier >= track.maxTier) return { profile, ok: false, reason: 'capped' };
  const cost = metaCost(id, tier);
  if (profile.salvage < cost) return { profile, ok: false, reason: 'insufficient', cost };
  return { profile: { ...profile, salvage: profile.salvage - cost, tiers: { ...profile.tiers, [id]: tier + 1 } }, ok: true, cost };
}

// Salvage earned when a run ends.
export function salvageForRun({ score = 0, bossesDefeated = 0, wave = 1 } = {}, profile = defaultProfile()) {
  const rate = META_BY_ID.salvageRate.effect(metaTier(profile, 'salvageRate'));
  const base = Math.max(1, Math.floor(score / 500) + bossesDefeated * 6 + Math.floor(wave / 2));
  return Math.round(base * rate);
}

// Offline cache: accrues while away, claimed on return.
export function offlineAccrual(profile, now = Date.now()) {
  const lastSeen = profile.lastSeen || now;
  const elapsed = Math.max(0, Math.min(OFFLINE_CAP_MS, now - lastSeen));
  const rate = META_BY_ID.offlineRate.effect(metaTier(profile, 'offlineRate'));
  const salvage = Math.floor((elapsed / 3_600_000) * OFFLINE_BASE_PER_HOUR * rate);
  return { salvage, capped: now - lastSeen > OFFLINE_CAP_MS, elapsedMs: elapsed };
}

// Run-start bonuses from permanent tracks.
export function startingBonuses(profile) {
  return {
    power: META_BY_ID.startingPower.effect(metaTier(profile, 'startingPower')),
    troops: META_BY_ID.startingTroops.effect(metaTier(profile, 'startingTroops')),
  };
}

export function recordRunEnd(profile, { score = 0, wave = 1, bossesDefeated = 0 } = {}, now = Date.now()) {
  const earned = salvageForRun({ score, bossesDefeated, wave }, profile);
  const best = {
    wave: Math.max(profile.best.wave, wave),
    score: Math.max(profile.best.score, score),
  };
  return { profile: { ...profile, salvage: profile.salvage + earned, earned: (profile.earned || 0) + earned, best, lastSeen: now, runs: (profile.runs || 0) + 1 }, earned };
}
