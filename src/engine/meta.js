// The Ember shop: permanent upgrades bought between rounds.
// Three jobs: start faster, go longer, widen the build space.
// Pre-builds pre-pay costs; they never skip decisions.

export const META_UPGRADES = {
  stoneFoundations: {
    id: 'stoneFoundations',
    name: 'Stone Foundations',
    cost: 5,
    description: 'Every structure endures one extra night of teeth (+1 HP).',
  },
  morningStockpile: {
    id: 'morningStockpile',
    name: 'Morning Stockpile',
    cost: 5,
    description: 'Each round begins with +15 Glow.',
  },
  swiftWarden: {
    id: 'swiftWarden',
    name: 'Swift Warden',
    cost: 8,
    description: 'The Warden repositions faster and banishes held shades sooner.',
  },
  deeperDrafts: {
    id: 'deeperDrafts',
    name: 'Deeper Drafts',
    cost: 8,
    description: 'Each day offers four structures instead of three.',
  },
  outerRing: {
    id: 'outerRing',
    name: 'The Outer Ring',
    cost: 12,
    description: 'Ten frontier slots: richer ground (+50% Glow) — but the dark reaches them first.',
  },
  heartstone: {
    id: 'heartstone',
    name: 'Heartstone',
    cost: 20,
    description: 'The Heart burns brighter: +25 maximum light every round.',
  },
  emberChoir: {
    id: 'emberChoir',
    name: 'Ember Choir',
    cost: 10,
    description: 'Every second night survived sings one extra Ember home.',
  },
  secondWarden: {
    id: 'secondWarden',
    name: 'Second Warden',
    cost: 22,
    description: 'Another keeper walks the night.',
  },
  // Milestone tier: bought with Embers, but unlocked by proving a vigil —
  // permanent goals the Ember count alone can't buy.
  beaconHeart: {
    id: 'beaconHeart',
    name: 'Beacon Heart',
    cost: 14,
    requiresBestNights: 8,
    description: 'The Heart itself burns one shade to ash at each dusk from night 3.',
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    cost: 16,
    requiresBestNights: 10,
    description: '+1 Ember for every night survived past the fourth.',
  },
  ruinsRemember: {
    id: 'ruinsRemember',
    name: 'The Ruins Remember',
    cost: 18,
    requiresBestNights: 12,
    description: 'The dark can take a building, not its story: each loss pays +1 Ember at the fall.',
  },
};

export function metaUnlocked(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  return Boolean(upgrade) && state.bestNights >= (upgrade.requiresBestNights || 0);
}

export function buyMetaUpgrade(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade || state.meta[upgradeId] || state.embers < upgrade.cost) return null;
  if (!metaUnlocked(state, upgradeId)) return null;
  return {
    ...state,
    embers: state.embers - upgrade.cost,
    meta: { ...state.meta, [upgradeId]: true },
  };
}

export function getDraftSize(state) {
  return state.meta.deeperDrafts ? 4 : 3;
}

export function getWardenCount(state) {
  return 1 + (state.meta.secondWarden ? 1 : 0);
}

export function getUnlockedRings(state) {
  return state.meta.outerRing ? 2 : 1;
}

export function getHeartMax(state) {
  return 80 + (state.meta.heartstone ? 25 : 0);
}
