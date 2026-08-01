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
// greedily down the tree buys parents before children anyway: the gating
// itself costs the measured arc nothing, and what the tree adds is
// legibility and a goal, not a tax.
//
// THE TAIL. This is an incremental, and an incremental whose upgrade
// screen can be FINISHED has stopped being one. Eleven one-time booleans
// meant Embers went inert after about six vigils — every fall after that
// paid a currency with nothing to buy. So the three axes an incremental
// actually runs on carry RANKS: toughness (stoneFoundations), light
// (heartstone), and income (emberChoir). Each rank costs sharply more
// than the last, so late Embers always have somewhere to go and the
// climb never flattens.
//
// The story arc and the tail are deliberately separate: the Long Dawn
// asks only that every node be KINDLED (rank 1), so closing the story
// stays exactly where cycle 5 calibrated it. Ranks are what the vigil
// after the ending is for.

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
  // A chain: the town holds, then the hands do more, then the day offers
  // more, then the losses themselves pay.
  stoneFoundations: {
    id: 'stoneFoundations',
    name: 'Stone Foundations',
    cost: 5,
    rankCosts: [5, 18, 48],
    branch: 'stone',
    requires: [],
    at: { x: 0.13, y: 0.1 },
    description: 'Every structure endures one extra night of teeth (+1 HP).',
    rankNote: 'Each course laid adds another point of toughness to everything you build.',
  },
  morningStockpile: {
    id: 'morningStockpile',
    name: 'Second Hands',
    cost: 5,
    branch: 'stone',
    requires: ['stoneFoundations'],
    at: { x: 0.13, y: 0.35 },
    description: 'A second pair of hands: mend twice a day instead of once.',
  },
  deeperDrafts: {
    id: 'deeperDrafts',
    name: 'Deeper Drafts',
    cost: 8,
    branch: 'stone',
    requires: ['morningStockpile'],
    at: { x: 0.13, y: 0.6 },
    description: 'Each day offers four structures — at least two of them defenses.',
  },
  // ── The Watch Root ────────────────────────────────────────────────────
  // A fork: one Warden made quicker, then either another pair of hands in
  // the dark or a Heart that fights for itself.
  swiftWarden: {
    id: 'swiftWarden',
    name: 'Swift Warden',
    cost: 8,
    branch: 'watch',
    requires: [],
    at: { x: 0.445, y: 0.1 },
    description: 'The Warden repositions faster and banishes held shades sooner.',
  },
  secondWarden: {
    id: 'secondWarden',
    name: 'Second Warden',
    cost: 22,
    branch: 'watch',
    requires: ['swiftWarden'],
    at: { x: 0.53, y: 0.35 },
    description: 'Another keeper walks the night.',
  },
  // ── The Ember Root ────────────────────────────────────────────────────
  // A fork and a chain, as of cycle 22 (it used to fan three ways off the
  // root, which read as a shelf, not a path). The frontier hangs off the
  // choir as its own prong ON PURPOSE: measured as a mandatory gate to
  // the Heartstone it cost the whole meta arc — outerRing is a -1.0n drag
  // in a young town and only pays across an arc, so forcing it into the
  // main line collapsed its arc value from +14.2 to +1.2 and flattened
  // the climb to nothing. A branch you take when you are ready for it;
  // never a toll on the way to the light.
  emberChoir: {
    id: 'emberChoir',
    name: 'Ember Choir',
    cost: 10,
    rankCosts: [10, 30, 78],
    branch: 'ember',
    requires: [],
    at: { x: 0.81, y: 0.1 },
    description: 'Every second night survived sings one extra Ember home.',
    rankNote: 'Every voice added sings its own Ember home — the choir is what pays for the rest of the tree.',
  },
  outerRing: {
    id: 'outerRing',
    name: 'The Outer Ring',
    cost: 12,
    branch: 'ember',
    requires: ['emberChoir'],
    at: { x: 0.72, y: 0.35 },
    description: 'A third ring of fifteen frontier slots: richer ground (+50% Glow) — but the dark reaches them first.',
  },
  heartstone: {
    id: 'heartstone',
    name: 'Heartstone',
    cost: 20,
    rankCosts: [20, 52, 120],
    branch: 'ember',
    requires: ['emberChoir'],
    at: { x: 0.9, y: 0.35 },
    description: 'The Heart burns brighter: +25 maximum light every round.',
    rankNote: 'Each stone set in the hearth is another twenty-five light the dark has to chew through.',
  },
  // ── Pinnacles ─────────────────────────────────────────────────────────
  // Bought with Embers, but sealed until a vigil proves the ground: each
  // crowns the root it belongs to. Permanent goals the Ember count alone
  // can't buy.
  beaconHeart: {
    id: 'beaconHeart',
    name: 'Beacon Heart',
    cost: 14,
    branch: 'watch',
    requires: ['swiftWarden'],
    requiresBestNights: 8,
    at: { x: 0.36, y: 0.35 },
    description: 'The Heart itself burns one shade to ash at each dusk from night 3.',
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    cost: 20,
    branch: 'ember',
    requires: ['heartstone'],
    requiresBestNights: 10,
    at: { x: 0.9, y: 0.6 },
    description: '+1 Ember for every night survived past the fourth.',
  },
  ruinsRemember: {
    id: 'ruinsRemember',
    name: 'The Ruins Remember',
    cost: 18,
    branch: 'stone',
    requires: ['deeperDrafts'],
    requiresBestNights: 12,
    at: { x: 0.13, y: 0.85 },
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

// ── Ranks ───────────────────────────────────────────────────────────────
// A node's rank is how many times it has been kindled. Saves from before
// the tail stored booleans, and `true` is rank 1 by construction — so an
// old save reads correctly with no migration beyond coercion.
// What it costs to kindle anything at all. The first fall is guaranteed
// to cover this — see FIRST FIRE in round.js.
export function cheapestRootCost() {
  return Math.min(...Object.values(META_UPGRADES)
    .filter(upgrade => upgrade.requires.length === 0)
    .map(upgrade => upgrade.cost));
}

export function metaMaxRank(upgradeId) {
  return META_UPGRADES[upgradeId]?.rankCosts?.length ?? 1;
}

export function metaRank(state, upgradeId) {
  const held = state.meta[upgradeId];
  if (!held) return 0;
  return Math.min(metaMaxRank(upgradeId), held === true ? 1 : Math.floor(held));
}

// What the NEXT rank costs, or null when the node is finished.
export function metaNextCost(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return null;
  const rank = metaRank(state, upgradeId);
  if (rank >= metaMaxRank(upgradeId)) return null;
  return upgrade.rankCosts ? upgrade.rankCosts[rank] : upgrade.cost;
}

// "Kept" means kindled at least once — the Long Dawn asks for the story,
// not the tail.
export function allUpgradesKept(state) {
  return Object.keys(META_UPGRADES).every(id => metaRank(state, id) >= 1);
}

export function isVigilComplete(state) {
  return allUpgradesKept(state) && state.bestNights >= LONG_DAWN_NIGHTS;
}

// Every upgrade the tree grows directly out of this one.
export function metaChildren(upgradeId) {
  return Object.values(META_UPGRADES).filter(upgrade => upgrade.requires?.includes(upgradeId));
}

// A whole root kept: the flourish that says a branch is finished. Ranks
// are the tail, not the story — a root is whole once every node in it
// has been kindled.
export function branchKept(state, branchId) {
  const nodes = Object.values(META_UPGRADES).filter(upgrade => upgrade.branch === branchId);
  return nodes.length > 0 && nodes.every(upgrade => metaRank(state, upgrade.id) >= 1);
}

export function metaRooted(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return false;
  return (upgrade.requires || []).every(parent => metaRank(state, parent) >= 1);
}

export function metaUnlocked(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return false;
  return state.bestNights >= (upgrade.requiresBestNights || 0) && metaRooted(state, upgradeId);
}

// One word for what the tree should show at this node.
//   maxed   — every rank kindled; nothing left to pour in
//   ready   — the next rank is reachable and affordable right now
//   costly  — reachable, but the Embers are not there yet
//   sealed  — the vigil record is not deep enough
//   rooted  — the path to it has not been opened
export function metaStatus(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return 'rooted';
  if (metaRank(state, upgradeId) >= metaMaxRank(upgradeId)) return 'maxed';
  // A kindled node needs no path or seal check to rank up — it is already
  // standing; the seals guard arrival, not growth.
  if (metaRank(state, upgradeId) === 0) {
    if (!metaRooted(state, upgradeId)) return 'rooted';
    if (state.bestNights < (upgrade.requiresBestNights || 0)) return 'sealed';
  }
  return state.embers >= metaNextCost(state, upgradeId) ? 'ready' : 'costly';
}

// Kindle a node, or pour another rank into one already standing.
export function buyMetaUpgrade(state, upgradeId) {
  const upgrade = META_UPGRADES[upgradeId];
  if (!upgrade) return null;
  const rank = metaRank(state, upgradeId);
  const price = metaNextCost(state, upgradeId);
  if (price == null || state.embers < price) return null;
  if (rank === 0 && !metaUnlocked(state, upgradeId)) return null;
  return {
    ...state,
    embers: state.embers - price,
    meta: { ...state.meta, [upgradeId]: rank + 1 },
  };
}

export function getDraftSize(state) {
  return metaRank(state, 'deeperDrafts') >= 1 ? 4 : 3;
}

export function getWardenCount(state) {
  return 1 + (metaRank(state, 'secondWarden') >= 1 ? 1 : 0);
}

export function getUnlockedRings(state) {
  return metaRank(state, 'outerRing') >= 1 ? 3 : 2;
}

// Ranked: each Heartstone set in the hearth is another 25 light.
export const HEARTSTONE_LIGHT = 25;

export function getHeartMax(state) {
  return 80 + HEARTSTONE_LIGHT * metaRank(state, 'heartstone');
}

// Ranked: each course of Stone Foundations is another point of toughness
// on everything the town builds.
export function getFoundationBonus(state) {
  return metaRank(state, 'stoneFoundations');
}

// Ranked: each voice in the Ember Choir sings its own Ember home.
export function getChoirVoices(meta) {
  return metaRank({ meta }, 'emberChoir');
}
