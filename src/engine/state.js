// Persistent state: Embers, meta upgrades, records. The round lives inside.

export const SAVE_VERSION = 1;

export function createInitialState() {
  return {
    saveVersion: SAVE_VERSION,
    embers: 0,
    meta: {},          // { [metaUpgradeId]: true }
    bestNights: 0,
    totalRounds: 0,
    lastRound: null,   // { nights, embers } from the most recent fall
    // The Keeper's Ledger: everything ever endured, across all vigils.
    lifetime: { nights: 0, embers: 0, banished: 0, towerKills: 0, structuresLost: 0 },
    round: null,
  };
}

// Merge a saved state with fresh defaults so new fields always exist.
// Mid-round state is plain JSON and restores as-is; anything unreadable
// falls back to a fresh start rather than a crash.
export function migrateState(saved) {
  if (!saved || typeof saved !== 'object') return createInitialState();
  const fresh = createInitialState();
  const migrated = {
    ...fresh,
    ...saved,
    meta: { ...(saved.meta || {}) },
    lifetime: { ...fresh.lifetime, ...(saved.lifetime || {}) },
    saveVersion: SAVE_VERSION,
  };
  for (const key of Object.keys(fresh.lifetime)) {
    if (!Number.isFinite(migrated.lifetime[key]) || migrated.lifetime[key] < 0) migrated.lifetime[key] = 0;
  }
  if (!Number.isFinite(migrated.embers) || migrated.embers < 0) migrated.embers = 0;
  if (!Number.isFinite(migrated.bestNights) || migrated.bestNights < 0) migrated.bestNights = 0;
  if (!Number.isFinite(migrated.totalRounds) || migrated.totalRounds < 0) migrated.totalRounds = 0;
  if (migrated.round && (typeof migrated.round !== 'object' || !migrated.round.phase)) {
    migrated.round = null;
  }
  return migrated;
}

export function loadState(storage) {
  try {
    const raw = storage.getItem('hearthlight-save');
    if (!raw) return createInitialState();
    return migrateState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem('hearthlight-save', JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the game keeps running unsaved.
  }
}
