// A round: one settlement's life, measured in nights survived.
// Days are for one draft decision and Glow; nights belong to the dark.
import { createSlots, getAdjacentSlots } from './map.js';
import { STRUCTURES, STRUCTURE_IDS } from './structures.js';
import { getDraftSize, getHeartMax, getUnlockedRings, getWardenCount } from './meta.js';
import { STRUCTURE_HIT } from './night.js';

export const DAY_LENGTH = 15;
// A keeper's very first day hurries no one: triple time before dusk
// falls on its own. Every later day keeps the real clock.
export const FIRST_DAY_GRACE = 3;

export function getDayLength(round) {
  return DAY_LENGTH * (round.gentleDay && round.day === 1 ? FIRST_DAY_GRACE : 1);
}
export const START_GLOW = 12;
export const DAWN_GLOW_PER_STRUCTURE = 3;
export const REROLL_COST = 4;
export const LEVEL_UP_NIGHTS = 3;
export const LEVEL_UP_NIGHTS_VETERAN = 7;

// Glow multiplier for a structure's level: 1 / 1.5 / 2.
export function levelGlowMult(level) {
  return level >= 3 ? 2 : level >= 2 ? 1.5 : 1;
}

// The frontier: outer-ring ground is richer — but the dark reaches it first
// (see FRONTIER_APPROACH in night.js).
export const FRONTIER_YIELD = 1.5;
export const HEART_MAX = 80;

// Draw today's draft: distinct structures, with visible pity — at least one
// defensive option is always offered. Always consumes a FIXED number of
// rolls so a bigger draft (deeperDrafts) cannot shift the rng stream and
// butterfly every later night — upgrades must never perturb the dark.
const MAX_DRAFT_ROLLS = 4;

export function drawDraft(state, rng) {
  const size = getDraftSize(state);
  const rolls = Array.from({ length: MAX_DRAFT_ROLLS }, () => rng());
  const pool = [...STRUCTURE_IDS];
  const draft = [];
  while (draft.length < size && pool.length > 0) {
    const totalWeight = pool.reduce((sum, id) => sum + STRUCTURES[id].weight, 0);
    let roll = rolls[draft.length] * totalWeight;
    let pick = pool[0];
    for (const id of pool) {
      roll -= STRUCTURES[id].weight;
      if (roll <= 0) { pick = id; break; }
    }
    draft.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  if (!draft.some(id => STRUCTURES[id].defensive)) {
    draft[draft.length - 1] = 'palisade';
  }
  // Deeper Drafts widens the pity too: four cards, at least two defenses.
  if (size >= 4 && draft.filter(id => STRUCTURES[id].defensive).length < 2) {
    const spare = ['palisade', 'lantern', 'belltower', 'watchtower'].find(id => !draft.includes(id));
    for (let index = draft.length - 1; index >= 0; index--) {
      if (!STRUCTURES[draft[index]].defensive) { draft[index] = spare; break; }
    }
  }
  return draft;
}

export function beginRound(state, rng = Math.random) {
  if (state.round && state.round.phase !== 'fallen') return state;
  const roundState = {
    day: 1,
    phase: 'day',
    time: 0,
    phaseStart: 0,
    gentleDay: state.totalRounds === 0,
    glow: START_GLOW,
    heart: getHeartMax(state),
    heartMax: getHeartMax(state),
    slots: createSlots(getUnlockedRings(state)),
    draft: [],
    placedToday: false,
    rerolledToday: false,
    mendedToday: false,
    shades: [],
    wardens: Array.from({ length: getWardenCount(state) }, (_, index) => ({
      id: index + 1,
      slotId: null,
      movedAt: -999,
    })),
    towerCharges: {},
    nextShadeId: 1,
    omen: null,
    stillDebt: false,
    beacon: Boolean(state.meta.beaconHeart),
    stats: { heartLoss: { falls: 0, heartHits: 0, vents: 0 }, nights: [] },
    log: [{ day: 1, message: 'The Heart is lit. The dark is patient.' }],
  };
  roundState.draft = drawDraft(state, rng);
  return { ...state, totalRounds: state.totalRounds + 1, round: roundState };
}

export function getStructureHp(state, structureId) {
  return STRUCTURES[structureId].hp + (state.meta.stoneFoundations ? 1 : 0);
}

// Glow production per second, split so adjacency's real contribution is
// measurable (depth telemetry: is spatial placement earning its keep?).
export function getGlowBreakdown(state) {
  const round = state.round;
  if (!round) return { total: 0, adjacency: 0 };
  let base = 1; // the Heart's own trickle
  let adjacency = 0;
  for (const slot of round.slots) {
    if (!slot.structure) continue;
    const def = STRUCTURES[slot.structure.type];
    const levelMult = levelGlowMult(slot.structure.level) * (slot.ring > 0 ? FRONTIER_YIELD : 1);
    base += (def.glowPerSecond || 0) * levelMult;
    if (def.adjacencyBonus) {
      for (const neighbor of getAdjacentSlots(round.slots, slot.id)) {
        const bonus = neighbor.structure && def.adjacencyBonus[neighbor.structure.type];
        if (bonus) adjacency += bonus * levelMult;
      }
    }
  }
  return { total: base + adjacency, adjacency };
}

export function getGlowRate(state) {
  return getGlowBreakdown(state).total;
}

// The one day decision: place a drafted structure on an empty slot.
export function placeStructure(state, structureId, slotId) {
  const round = state.round;
  if (!round || round.phase !== 'day' || round.placedToday) return null;
  if (!round.draft.includes(structureId)) return null;
  const def = STRUCTURES[structureId];
  if (round.glow < def.cost) return null;
  const slotIndex = round.slots.findIndex(slot => slot.id === slotId);
  if (slotIndex < 0 || round.slots[slotIndex].structure) return null;

  const slots = [...round.slots];
  slots[slotIndex] = {
    ...slots[slotIndex],
    ruin: false,
    structure: {
      type: structureId,
      hp: getStructureHp(state, structureId),
      level: 1,
      nightsSurvived: 0,
    },
  };
  return {
    ...state,
    round: {
      ...round,
      glow: round.glow - def.cost,
      slots,
      placedToday: true,
    },
  };
}

// Mending: one pair of hands each day — build, OR buy back one bitten
// hit point. Mend shares the day's single act with placement because
// anything looser measured as an immortality engine (uncapped: keeper
// 6.8 -> 9.4 nights; a free daily mend on top of building: 250s rounds).
// As the day's act it is real triage — and it gives a full town (every
// slot built) something worth doing at dawn.
export const REPAIR_COST = 12;

export function getRepairMax(state, structure) {
  return getStructureHp(state, structure.type) + (structure.level - 1);
}

export function repairStructure(state, slotId) {
  const round = state.round;
  // Second Hands (meta): mend stops sharing the day's act with placement
  // — the once-per-day cap still holds.
  const sharesAct = !state.meta.morningStockpile;
  if (!round || round.phase !== 'day' || round.mendedToday) return null;
  if (sharesAct && round.placedToday) return null;
  if (round.glow < REPAIR_COST) return null;
  const slotIndex = round.slots.findIndex(slot => slot.id === slotId);
  const structure = round.slots[slotIndex]?.structure;
  if (!structure || structure.hp >= getRepairMax(state, structure)) return null;
  const slots = [...round.slots];
  slots[slotIndex] = { ...slots[slotIndex], structure: { ...structure, hp: structure.hp + 1 } };
  return {
    ...state,
    round: {
      ...round,
      glow: round.glow - REPAIR_COST,
      placedToday: sharesAct ? true : round.placedToday,
      mendedToday: true,
      slots,
      log: [...round.log, { day: round.day, message: `Fresh timber in the ${STRUCTURES[structure.type].name} — it stands taller.` }].slice(-30),
    },
  };
}

// Once per day, unspent Glow can buy a fresh draft. A small lever, but
// a real decision: 4 Glow now versus a shot at the card you need.
export function rerollDraft(state, rng = Math.random) {
  const round = state.round;
  if (!round || round.phase !== 'day' || round.placedToday || round.rerolledToday) return null;
  if (round.glow < REROLL_COST) return null;
  const next = { ...round, glow: round.glow - REROLL_COST, rerolledToday: true };
  next.draft = drawDraft({ ...state, round: next }, rng);
  return { ...state, round: next };
}

// End the day early (or the timer does it): dusk falls.
export function duskReady(round) {
  return round.phase === 'day';
}

export function countStructures(round, predicate = () => true) {
  return round.slots.filter(slot => slot.structure && predicate(slot)).length;
}

// Where the Embers came from — the fall screen tells the story.
export function getEmberBreakdown(round, meta = {}) {
  const nights = round.day - 1;
  const alive = countStructures(round);
  const kilns = countStructures(round, slot => slot.structure.type === 'emberKiln');
  // A shrine remembers its neighbors: +1 Ember, +1 per neighbor still
  // standing at the fall — economy that placement earns.
  const shrineEmbers = round.slots
    .filter(slot => slot.structure?.type === 'shrine')
    .reduce((total, slot) => total + 2 +
      getAdjacentSlots(round.slots, slot.id).filter(neighbor => neighbor.structure).length, 0);
  const parts = {
    nights,
    standing: Math.floor(alive / 2),
    shrines: shrineEmbers,
    // Cap 6, not 3: with mend the only Glow sink, a kiln town banking
    // its surplus is a deliberate harvest line, not an accident.
    kiln: kilns * Math.min(6, Math.floor(round.glow / 20)),
    choir: meta.emberChoir ? Math.floor(nights / 2) : 0,
    emberheart: meta.emberheart ? Math.max(0, nights - 4) : 0,
    ruins: meta.ruinsRemember
      ? Math.round((round.stats?.heartLoss.falls || 0) / STRUCTURE_HIT)
      : 0,
  };
  const sum = Object.values(parts).reduce((total, value) => total + value, 0);
  return { ...parts, total: Math.max(1, sum) };
}

export function getEmbersEarned(round, meta = {}) {
  return getEmberBreakdown(round, meta).total;
}

// Walking away is allowed: the vigil ends now, the dark takes the town,
// and the nights already survived still pay. No exploit lives here — the
// Ember formula is dominated by nights, so quitting early always pays
// less than holding on.
export function abandonRound(state) {
  const round = state.round;
  if (!round || round.phase === 'fallen') return null;
  return {
    ...state,
    round: {
      ...round,
      phase: 'fallen',
      heart: 0,
      shades: [],
      log: [...round.log, { day: round.day, message: 'You bank the fire and walk away. The dark takes the rest.' }].slice(-30),
    },
  };
}

// Bank a fallen round: Embers home, the Ledger updated, round cleared.
export function collectEmbers(state) {
  const round = state.round;
  if (!round || round.phase !== 'fallen') return state;
  const earned = getEmbersEarned(round, state.meta);
  const nightsStats = round.stats?.nights || [];
  const sum = key => nightsStats.reduce((total, night) => total + (night[key] || 0), 0);
  const lifetime = { nights: 0, embers: 0, banished: 0, towerKills: 0, structuresLost: 0, ...state.lifetime };
  return {
    ...state,
    embers: state.embers + earned,
    bestNights: Math.max(state.bestNights, round.day - 1),
    lastRound: { nights: round.day - 1, embers: earned },
    // The vigil history: every town remembered, newest last. Thirty is
    // enough to see a shape without hoarding the save.
    history: [...(state.history || []), { nights: round.day - 1, embers: earned }].slice(-30),
    lifetime: {
      nights: lifetime.nights + (round.day - 1),
      embers: lifetime.embers + earned,
      banished: lifetime.banished + sum('banished'),
      towerKills: lifetime.towerKills + sum('towerKills'),
      structuresLost: lifetime.structuresLost + Math.round((round.stats?.heartLoss.falls || 0) / STRUCTURE_HIT),
    },
    round: null,
  };
}
