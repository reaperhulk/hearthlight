// The Ember tree: permanent upgrades bought between rounds, grown along
// three roots from the Heart. Three jobs: hold the town together, answer
// the night, carry the light further.
//
// The tree is a real structure, not a decorated shop. Every upgrade past
// a root names the one it grows from, so Embers buy a PATH, not a
// shopping list — which branch you open first is the meta decision the
// flat shop never asked for. Pre-builds still pre-pay costs; they never
// skip decisions.
//
// Branch costs rise monotonically from each root, so a keeper spending
// greedily down the tree buys parents before children anyway: the
// measured arc is unchanged by the gating (see the balance harness's
// meta panels), and what the tree adds is legibility and a goal, not a
// tax.

export const META_BRANCHES = {
  stone: {
    id: 'stone',
    name: 'The Stone Root',
    lore: 'What is built stands longer, and the hands do more with a day.',
  },
  watch: {
    id: 'watch',
    name: 'The Watch Root',
    lore: 'The night is answered — faster hands, more of them, and a Heart that burns.',
  },
  ember: {
    id: 'ember',
    name: 'The Ember Root',
    lore: 'The light reaches further and pays for itself.',
  },
};

export const META_UPGRADES = {
  // ── The Stone Root ────────────────────────────────────────────────────
  stoneFoundations: {
    id: 'stoneFoundations',
    name: 'Stone Foundations',
    cost: 5,
    branch: 'stone',
    requires: [],
    at: { x: 0.15, y: 0.10 },
    description: 'Every structure endures one extra night of teeth (+1 HP).',
  },
  morningStockpile: {
    id: 'morningStockpile',
    name: 'Second Hands',
    cost: 5,
    branch: 'stone',
    requires: ['stoneFoundations'],
    at: { x: 0.15, y: 0.35 },
    description: 'Mending no longer spends the day’s act — build and mend in one dusk.',
  },
  deeperDrafts: {
    id: 'deeperDrafts',
    name: 'Deeper Drafts',
    cost: 8,
    branch: 'stone',
    requires: ['morningStockpile'],
    at: { x: 0.15, y: 0.60 },
    description: 'Each day offers four structures — at least two of them defenses.',
  },
  // ── The Watch Root ────────────────────────────────────────────────────
  swiftWarden: {
    id: 'swiftWarden',
    name: 'Swift Warden',
    cost: 8,
    branch: 'watch',
    requires: [],
    at: { x: 0.48, y: 0.10 },
    description: 'The Warden repositions faster and banishes held shades sooner.',
  },
  secondWarden: {
    id: 'secondWarden',
    name: 'Second Warden',
    cost: 22,
    branch: 'watch',
    requires: ['swiftWarden'],
    at: { x: 0.59, y: 0.35 },
    description: 'Another keeper walks the night.',
  },
  // ── The Ember Root ────────────────────────────────────────────────────
  // The Choir opens this root; everything past it is a different way to
  // spend the light, which is why they fan rather than chain.
  emberChoir: {
    id: 'emberChoir',
    name: 'Ember Choir',
    cost: 10,
    branch: 'ember',
    requires: [],
    at: { x: 0.85, y: 0.10 },
    description: 'Every second night survived sings one extra Ember home.',
  },
  outerRing: {
    id: 'outerRing',
    name: 'The Outer Ring',
    cost: 12,
    branch: 'ember',
    requires: ['emberChoir'],
    at: { x: 0.73, y: 0.35 },
    description: 'Ten frontier slots: richer ground (+50% Glow) — but the dark reaches them first.',
  },
  heartstone: {
    id: 'heartstone',
    name: 'Heartstone',
    cost: 20,
    branch: 'ember',
    requires: ['emberChoir'],
    at: { x: 0.93, y: 0.35 },
    description: 'The Heart burns brighter: +25 maximum light every round.',
  },
  // ── Pinnacles ─────────────────────────────────────────────────────────
  // Bought with Embers, but sealed until a vigil proves the ground: each
  // sits at the end of the root it belongs to. Permanent goals the Ember
  // count alone can't buy.
  beaconHeart: {
    id: 'beaconHeart',
    name: 'Beacon Heart',
    cost: 14,
    branch: 'watch',
    requires: ['swiftWarden'],
    requiresBestNights: 8,
    at: { x: 0.37, y: 0.35 },
    description: 'The Heart itself burns one shade to ash at each dusk from night 3.',
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    cost: 16,
    branch: 'ember',
    requires: ['emberChoir'],
    requiresBestNights: 10,
    at: { x: 0.85, y: 0.60 },
    description: '+1 Ember for every night survived past the fourth.',
  },
  ruinsRemember: {
    id: 'ruinsRemember',
    name: 'The Ruins Remember',
    cost: 18,
    branch: 'stone',
    requires: ['deeperDrafts'],
    requiresBestNights: 12,
    at: { x: 0.15, y: 0.85 },
    description: 'The dark can take a building, not its story: each loss pays +1 Ember at the fall.',
  },
};

// The Long Dawn: the capstone vigil. With every upgrade kept, one goal
// remains — hold the light for fifteen nights. The dark still wins (it
// always wins), but the story closes: the ruins remember this keeper.
// Calibration: a fully-kitted keeper bot measures mean ~23 nights,
// best ~30 — reachable, not free (asserted in the harness).
export const LONG_DAWN_NIGHTS = 15;

// The tree's own crown: not an upgrade, a destination. It renders as a
// node so the horizon is a place on the map rather than a paragraph.
export const LONG_DAWN_NODE = { id: 'longDawn', at: { x: 0.5, y: 0.86 } };

export function allUpgradesKept(state) {
  return Object.keys(META_UPGRADES).every(id => state.meta[id]);
}

export function isVigilComplete(state) {
  return allUpgradesKept(state) && state.bestNights >= LONG_DAWN_NIGHTS;
}

// Every upgrade the tree grows directly out of this one.
export function metaChildren(upgradeId) {
  return Object.values(META_UPGRADES).filter(upgrade => upgrade.requires?.includes(upgradeId));
}

// A whole root kept: the flourish that says a branch is finished.
export function branchKept(state, branchId) {
  const nodes = Object.values(META_UPGRADES).filter(upgrade => upgrade.branch === branchId);
  return nodes.length > 0 && nodes.every(upgrade => state.meta[upgrade.id]);
}

export function metaRooted(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return false;
  return (upgrade.requires || []).every(parent => Boolean(state.meta[parent]));
}

export function metaUnlocked(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return false;
  return state.bestNights >= (upgrade.requiresBestNights || 0) && metaRooted(state, upgradeId);
}

// One word for what the tree should show at this node.
//   kept    — already bought
//   ready   — reachable and affordable right now
//   costly  — reachable, but the Embers are not there yet
//   sealed  — the vigil record is not deep enough
//   rooted  — the path to it has not been opened
export function metaStatus(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return 'rooted';
  if (state.meta[upgradeId]) return 'kept';
  if (!metaRooted(state, upgradeId)) return 'rooted';
  if (state.bestNights < (upgrade.requiresBestNights || 0)) return 'sealed';
  return state.embers >= upgrade.cost ? 'ready' : 'costly';
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
