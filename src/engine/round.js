// A round: one settlement's life, measured in nights survived.
// Days are for one draft decision and Glow; nights belong to the dark.
import { createSlots, getAdjacentSlots } from './map.js';
import { STRUCTURES, STRUCTURE_IDS } from './structures.js';
import { getDraftSize, getHeartMax, getUnlockedRings, getWardenCount } from './meta.js';
import { STRUCTURE_HIT } from './night.js';

export const DAY_LENGTH = 15;
export const START_GLOW = 12;
export const DAWN_GLOW_PER_STRUCTURE = 3;
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
  return draft;
}

export function beginRound(state, rng = Math.random) {
  if (state.round && state.round.phase !== 'fallen') return state;
  const roundState = {
    day: 1,
    phase: 'day',
    time: 0,
    phaseStart: 0,
    glow: START_GLOW + (state.meta.morningStockpile ? 15 : 0),
    heart: getHeartMax(state),
    heartMax: getHeartMax(state),
    slots: createSlots(getUnlockedRings(state)),
    draft: [],
    placedToday: false,
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
  const shrines = countStructures(round, slot => slot.structure.type === 'shrine');
  const kilns = countStructures(round, slot => slot.structure.type === 'emberKiln');
  const parts = {
    nights,
    standing: Math.floor(alive / 2),
    shrines: shrines * 2,
    kiln: kilns * Math.min(3, Math.floor(round.glow / 20)),
    choir: meta.emberChoir ? Math.floor(nights / 2) : 0,
    emberheart: meta.emberheart ? Math.max(0, nights - 4) : 0,
  };
  const sum = Object.values(parts).reduce((total, value) => total + value, 0);
  return { ...parts, total: Math.max(1, sum) };
}

export function getEmbersEarned(round, meta = {}) {
  return getEmberBreakdown(round, meta).total;
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
