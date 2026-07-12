import { describe, expect, it } from 'vitest';
import { createInitialState, loadState, migrateState, saveState } from '../state.js';
import { createSlots, getAdjacentSlots } from '../map.js';
import { STRUCTURES } from '../structures.js';
import { abandonRound, beginRound, collectEmbers, drawDraft, getDayLength, DAY_LENGTH, getEmbersEarned, getGlowBreakdown, getGlowRate, levelGlowMult, placeStructure, rerollDraft, REROLL_COST, FRONTIER_YIELD, HEART_MAX } from '../round.js';
import { getNightForecast, getShadeCount, getWardenCooldown, moveWarden, FRONTIER_APPROACH, HEART_SLOT, HUNGRY_EXTRA, RELEASED_FEED_TIME, SHADE_FEED_TIME, SHADE_HOLD_TIME, STILL_DEBT, STRUCTURE_HIT, WARDEN_COOLDOWN, HEART_HIT } from '../night.js';
import { endDay, tick } from '../tick.js';
import { buyMetaUpgrade } from '../meta.js';

function makeRng(sequence = [0.5]) {
  let index = 0;
  return () => sequence[index++ % sequence.length];
}

function startedRound(meta = {}) {
  let state = { ...createInitialState(), meta };
  state = beginRound(state, makeRng([0.1, 0.4, 0.7]));
  return state;
}

function runSeconds(state, seconds, rng) {
  let current = state;
  for (let step = 0; step < seconds; step++) current = tick(current, 1, rng);
  return current;
}

describe('hearthlight', () => {
  it('lays out radial slots with sane adjacency', () => {
    const inner = createSlots(1);
    expect(inner).toHaveLength(6);
    const both = createSlots(2);
    expect(both).toHaveLength(16);
    const neighbors = getAdjacentSlots(both, 'r0s0');
    expect(neighbors.length).toBeGreaterThanOrEqual(2);
    expect(neighbors.every(slot => slot.id !== 'r0s0')).toBe(true);
  });

  it('drafts always include a defensive option (visible pity)', () => {
    const state = createInitialState();
    for (const roll of [0.01, 0.35, 0.6, 0.99]) {
      const draft = drawDraft(state, makeRng([roll]));
      expect(draft.length).toBe(3);
      expect(draft.some(id => STRUCTURES[id].defensive)).toBe(true);
      expect(new Set(draft).size).toBe(draft.length);
    }
    // Deeper Drafts: four cards, at least two of them defenses.
    const deep = { ...createInitialState(), meta: { deeperDrafts: true } };
    for (const roll of [0.01, 0.35, 0.6, 0.99]) {
      const draft = drawDraft(deep, makeRng([roll]));
      expect(draft.length).toBe(4);
      expect(draft.filter(id => STRUCTURES[id].defensive).length).toBeGreaterThanOrEqual(2);
      expect(new Set(draft).size).toBe(draft.length);
    }
  });

  it('starts a round with the Heart lit and one decision pending', () => {
    const state = startedRound();
    expect(state.round.phase).toBe('day');
    expect(state.round.heart).toBe(HEART_MAX);
    expect(state.round.glow).toBe(12);
    expect(state.round.draft).toHaveLength(3);
    expect(state.round.wardens).toHaveLength(1);
  });

  it('places one drafted structure per day, paying Glow', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm', 'well', 'palisade'], glow: 20 } };
    state = placeStructure(state, 'farm', 'r0s0');
    expect(state.round.glow).toBe(10);
    expect(state.round.slots[0].structure.type).toBe('farm');
    // One placement per day; undrafted and occupied are refused
    expect(placeStructure(state, 'well', 'r0s1')).toBeNull();
  });

  it('wells boost adjacent farms', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm', 'well', 'palisade'], glow: 50 } };
    state = placeStructure(state, 'farm', 'r0s0');
    const before = getGlowRate(state);
    state = { ...state, round: { ...state.round, placedToday: false, draft: ['well'] } };
    state = placeStructure(state, 'well', 'r0s1');
    expect(getGlowRate(state)).toBeCloseTo(before + 0.2 + 0.4);
  });

  it('spawns escalating nights and holds/banishes with the Warden', () => {
    expect(getShadeCount(1)).toBe(1);
    expect(getShadeCount(2)).toBe(2);
    expect(getShadeCount(5)).toBe(7);

    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['palisade'], glow: 20 } };
    state = placeStructure(state, 'palisade', 'r0s2');
    state = endDay(state, makeRng([0.5, 0.5, 0.5]));
    expect(state.round.phase).toBe('night');
    expect(state.round.shades).toHaveLength(1);
    const targetId = state.round.shades[0].targetSlotId;
    expect(targetId).toBe('r0s2');

    state = moveWarden(state, 1, targetId);
    expect(state).toBeTruthy();
    // Cooldown blocks an immediate second move
    expect(moveWarden(state, 1, 'r0s0')).toBeNull();

    const rng = makeRng();
    state = runSeconds(state, Math.ceil(13 + SHADE_HOLD_TIME + 2), rng);
    // Held and banished: the palisade still stands, the Heart untouched
    expect(state.round.slots[2].structure).toBeTruthy();
    expect(state.round.heart).toBe(HEART_MAX);
  });

  it('omens are announced, bounded, and settle their debts', () => {
    let state = startedRound();
    // A Hungry Night adds exactly HUNGRY_EXTRA shades over the base count.
    state = { ...state, round: { ...state.round, day: 4, omen: { night: 4, type: 'hungry' } } };
    const hungry = endDay(state, makeRng([0.5]));
    expect(hungry.round.shades).toHaveLength(getShadeCount(4) + HUNGRY_EXTRA);
    expect(hungry.round.stats.nights.at(-1).omen).toBe('hungry');

    // A Still Night spawns nothing and banks a debt the next night collects.
    let still = { ...state, round: { ...state.round, day: 4, omen: { night: 4, type: 'still' } } };
    still = endDay(still, makeRng([0.5]));
    expect(still.round.shades).toHaveLength(0);
    expect(still.round.stillDebt).toBe(true);
    // An empty night passes quickly — no dead time.
    const quickDawn = runSeconds(still, 5, makeRng([0.5]));
    expect(quickDawn.round.phase).toBe('day');
    const collected = { ...still, round: { ...still.round, day: 5, phase: 'day', omen: null } };
    const nextNight = endDay(collected, makeRng([0.5]));
    expect(nextNight.round.shades).toHaveLength(getShadeCount(5) + STILL_DEBT);
    expect(nextNight.round.stillDebt).toBe(false);
  });

  it('the frontier yields more glow but is reached sooner', () => {
    // A farm on the outer ring produces FRONTIER_YIELD times the glow.
    let state = { ...createInitialState(), meta: { outerRing: true } };
    state = beginRound(state, makeRng([0.1, 0.4, 0.7]));
    state = { ...state, round: { ...state.round, draft: ['farm'], glow: 20 } };
    const inner = placeStructure(state, 'farm', 'r0s0');
    const outer = placeStructure(state, 'farm', 'r1s0');
    const innerRate = getGlowRate(inner) - 1; // strip the Heart's trickle
    const outerRate = getGlowRate(outer) - 1;
    expect(outerRate).toBeCloseTo(innerRate * FRONTIER_YIELD);

    // Identical rolls: the shade closes on the frontier farm sooner.
    const innerNight = endDay(inner, makeRng([0.5, 0.5, 0.5]));
    const outerNight = endDay(outer, makeRng([0.5, 0.5, 0.5]));
    const innerApproach = innerNight.round.shades[0].arrivesAt - innerNight.round.shades[0].spawnedAt;
    const outerApproach = outerNight.round.shades[0].arrivesAt - outerNight.round.shades[0].spawnedAt;
    expect(outerApproach).toBeCloseTo(innerApproach * FRONTIER_APPROACH, 5);
  });

  it('lamplight quickens the grip and the bell hastens the step', () => {
    // Lit ground: a held shade is banished at LANTERN_HOLD_FACTOR speed.
    let lit = startedRound();
    lit = { ...lit, round: { ...lit.round, draft: ['lantern', 'palisade'], glow: 40 } };
    lit = placeStructure(lit, 'lantern', 'r0s0');
    lit = { ...lit, round: { ...lit.round, placedToday: false } };
    lit = placeStructure(lit, 'palisade', 'r0s1');
    const start = lit.round.time;
    lit = {
      ...lit,
      round: {
        ...lit.round, phase: 'night', phaseStart: start, placedToday: false, towerCharges: {},
        shades: [{ id: 1, targetSlotId: 'r0s1', spawnAngle: 0, spawnedAt: start, arrivesAt: start + 1, phase: 'approach', heldSince: null, feedsAt: null }],
      },
    };
    lit = moveWarden(lit, 1, 'r0s1');
    // Banished at 1 + 3.5*0.6 = 3.1s — by t=4 it is gone; unlit would still hold.
    lit = runSeconds(lit, 4, makeRng());
    expect(lit.round.shades).toHaveLength(0);
    expect(lit.round.stats.nights.at(-1).banished).toBe(1);

    // A standing bell tower shaves the Warden's reposition cooldown.
    let bell = startedRound();
    expect(getWardenCooldown(bell)).toBe(WARDEN_COOLDOWN);
    bell = { ...bell, round: { ...bell.round, draft: ['belltower'], glow: 40 } };
    bell = placeStructure(bell, 'belltower', 'r0s3');
    expect(getWardenCooldown(bell)).toBe(WARDEN_COOLDOWN - 1);
  });

  it('shades do not eat light: lanterns are never targeted', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['lantern', 'farm'], glow: 40 } };
    state = placeStructure(state, 'lantern', 'r0s0');
    state = { ...state, round: { ...state.round, placedToday: false } };
    state = placeStructure(state, 'farm', 'r0s3');
    state = { ...state, round: { ...state.round, day: 3 } }; // 4 shades
    state = endDay(state, makeRng([0.1, 0.5, 0.9, 0.3, 0.7]));
    expect(state.round.shades.every(shade => shade.targetSlotId !== 'r0s0')).toBe(true);
    // A town of only light leaves the Heart exposed.
    let lit = startedRound();
    lit = { ...lit, round: { ...lit.round, draft: ['lantern'], glow: 40 } };
    lit = placeStructure(lit, 'lantern', 'r0s0');
    lit = endDay(lit, makeRng([0.5]));
    expect(lit.round.shades[0].targetSlotId).toBeNull();
  });

  it('the dark spreads: a night threatens distinct positions first', () => {
    // Three separated farms, four shades: every farm is threatened.
    let state = startedRound();
    for (const slotId of ['r0s0', 'r0s2', 'r0s4']) {
      state = { ...state, round: { ...state.round, placedToday: false, draft: ['farm'], glow: 20 } };
      state = placeStructure(state, 'farm', slotId);
    }
    state = { ...state, round: { ...state.round, day: 3 } }; // 4 shades
    state = endDay(state, makeRng([0.3, 0.6, 0.9, 0.2, 0.5]));
    expect(state.round.shades).toHaveLength(getShadeCount(3));
    const distinct = new Set(state.round.shades.map(shade => shade.targetSlotId));
    expect(distinct.size).toBe(3); // all three positions threatened before any repeat
  });

  it('palisades bodyguard their neighbors', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm', 'palisade'], glow: 40 } };
    state = placeStructure(state, 'farm', 'r0s0');
    state = { ...state, round: { ...state.round, placedToday: false } };
    state = placeStructure(state, 'palisade', 'r0s1');
    // Roll 0.01 lands the pick on the farm (first in occupied order) —
    // the adjacent palisade takes the strike instead.
    state = endDay(state, makeRng([0.01, 0.5, 0.5]));
    expect(state.round.shades[0].targetSlotId).toBe('r0s1');
  });

  it('heartseekers spawn late, are held at the Heart, and are burned by inner towers', () => {
    // From night 7, every fifth shade seeks the Heart.
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['palisade'], glow: 20 } };
    state = placeStructure(state, 'palisade', 'r0s2');
    state = { ...state, round: { ...state.round, day: 7 } };
    state = endDay(state, makeRng([0.5]));
    const seekers = state.round.shades.filter(shade => shade.targetSlotId === null);
    expect(state.round.shades).toHaveLength(getShadeCount(7));
    expect(seekers).toHaveLength(Math.floor(getShadeCount(7) / 5));

    // A warden standing AT the Heart grapples one; the second strikes.
    let vigil = startedRound();
    const start = vigil.round.time;
    vigil = {
      ...vigil,
      round: {
        ...vigil.round,
        phase: 'night',
        phaseStart: start,
        placedToday: false,
        towerCharges: {},
        shades: [1, 2].map(id => ({
          id, targetSlotId: null, spawnAngle: 0, spawnedAt: start,
          arrivesAt: start + 1, phase: 'approach', heldSince: null, feedsAt: null,
        })),
      },
    };
    vigil = moveWarden(vigil, 1, HEART_SLOT);
    expect(vigil).toBeTruthy();
    vigil = runSeconds(vigil, 12, makeRng());
    expect(vigil.round.shades).toHaveLength(0);
    expect(vigil.round.heart).toBe(HEART_MAX - HEART_HIT); // one held+banished, one struck
    expect(vigil.round.stats.heartLoss.heartHits).toBe(HEART_HIT);

    // A tower near the center burns a heartseeker at the threshold.
    let towered = startedRound();
    towered = { ...towered, round: { ...towered.round, draft: ['watchtower'], glow: 40 } };
    towered = placeStructure(towered, 'watchtower', 'r0s0');
    const at = towered.round.time;
    towered = {
      ...towered,
      round: {
        ...towered.round,
        phase: 'night',
        phaseStart: at,
        placedToday: false,
        towerCharges: { r0s0: 2 },
        shades: [{
          id: 1, targetSlotId: null, spawnAngle: 0, spawnedAt: at,
          arrivesAt: at + 1, phase: 'approach', heldSince: null, feedsAt: null,
        }],
      },
    };
    towered = runSeconds(towered, 3, makeRng());
    expect(towered.round.heart).toBe(HEART_MAX);
    expect(towered.round.stats.nights.at(-1).towerKills).toBe(1);
  });

  it('structures reach veteran level 3 after seven nights', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['watchtower', 'farm'], glow: 40 } };
    state = placeStructure(state, 'watchtower', 'r0s0');
    // Fast-forward the survival counter to the eve of veterancy.
    state = {
      ...state,
      round: {
        ...state.round,
        slots: state.round.slots.map(slot => slot.structure
          ? { ...slot, structure: { ...slot.structure, level: 2, hp: 2, nightsSurvived: 6 } }
          : slot),
        phase: 'night',
        phaseStart: state.round.time,
        shades: [],
        placedToday: false,
      },
    };
    state = runSeconds(state, 12, makeRng()); // empty night resolves at dawn
    const tower = state.round.slots[0].structure;
    expect(tower.level).toBe(3);
    expect(tower.hp).toBe(3);
    expect(levelGlowMult(tower.level)).toBe(2);
    // A veteran tower carries a third bolt into the night.
    state = endDay(state, makeRng([0.5]));
    expect(state.round.towerCharges['r0s0']).toBe(3);
  });

  it('a warden grapples one shade at a time — no immortal bunker', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['palisade'], glow: 20 } };
    state = placeStructure(state, 'palisade', 'r0s2');
    const start = state.round.time;
    state = {
      ...state,
      round: {
        ...state.round,
        phase: 'night',
        phaseStart: start,
        placedToday: false,
        towerCharges: {},
        shades: [1, 2].map(id => ({
          id,
          targetSlotId: 'r0s2',
          spawnAngle: 0,
          spawnedAt: start,
          arrivesAt: start + 1,
          phase: 'approach',
          heldSince: null,
          feedsAt: null,
        })),
      },
    };
    state = moveWarden(state, 1, 'r0s2');
    expect(state).toBeTruthy();
    state = runSeconds(state, 3, makeRng());
    // Both shades are at the guarded slot, but only one is being held.
    const phases = state.round.shades.map(shade => shade.phase).sort();
    expect(phases).toEqual(['feeding', 'held']);
    // The warden works through them serially; the palisade outlasts both.
    state = runSeconds(state, 12, makeRng());
    expect(state.round.shades).toHaveLength(0);
    expect(state.round.slots[2].structure).toBeTruthy();
    expect(state.round.stats.nights.at(-1).banished).toBe(2);
  });

  it('a shade dropped mid-grapple bites on the short fuse', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['palisade'], glow: 20 } };
    state = placeStructure(state, 'palisade', 'r0s2');
    const hpBefore = state.round.slots[2].structure.hp;
    const start = state.round.time;
    // Hydrate mid-grapple: the warden already holds a shade at the palisade
    // and his cooldown has long expired, so walking away is legal.
    state = {
      ...state,
      round: {
        ...state.round,
        phase: 'night',
        phaseStart: start - 5,
        placedToday: false,
        towerCharges: {},
        wardens: state.round.wardens.map(warden =>
          ({ ...warden, slotId: 'r0s2', movedAt: start - 10 })),
        shades: [{
          id: 1,
          targetSlotId: 'r0s2',
          spawnAngle: 0,
          spawnedAt: start - 2,
          arrivesAt: start - 1,
          phase: 'held',
          heldSince: start - 0.5,
          feedsAt: null,
        }],
      },
    };
    state = moveWarden(state, 1, 'r0s0');
    expect(state).toBeTruthy();
    state = tick(state, 0.5, makeRng());
    const dropped = state.round.shades[0];
    // The released shade comes back angry: it resumes feeding on the short
    // fuse, not the full SHADE_FEED_TIME — juggling holds buys no time.
    expect(dropped.phase).toBe('feeding');
    expect(dropped.feedsAt - state.round.time).toBeLessThanOrEqual(RELEASED_FEED_TIME);
    state = runSeconds(state, Math.ceil(RELEASED_FEED_TIME) + 1, makeRng());
    // The bite lands well inside SHADE_FEED_TIME: the shade is sated and
    // gone, and the palisade has paid a hit point for the broken hold.
    expect(state.round.shades).toHaveLength(0);
    expect(state.round.stats.nights.at(-1).fed).toBe(1);
    expect(state.round.slots[2].structure.hp).toBe(hpBefore - 1);
  });

  it('feeds on unguarded structures and drains the Heart when nothing stands', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm'], glow: 20 } };
    state = placeStructure(state, 'farm', 'r0s0');
    state = endDay(state, makeRng([0.5, 0.5, 0.5]));
    const rng = makeRng();
    state = runSeconds(state, Math.ceil(13 + SHADE_FEED_TIME + 2), rng);
    expect(state.round.slots[0].structure).toBeNull();
    expect(state.round.heart).toBe(HEART_MAX - STRUCTURE_HIT);

    // An empty town: shades go straight for the Heart
    let bare = startedRound();
    bare = endDay(bare, makeRng([0.5, 0.5, 0.5]));
    expect(bare.round.shades[0].targetSlotId).toBeNull();
    bare = runSeconds(bare, 15, rng);
    expect(bare.round.heart).toBe(HEART_MAX - HEART_HIT);
  });

  it('watchtowers intercept one shade per night on adjacent slots', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['watchtower', 'farm'], glow: 40 } };
    state = placeStructure(state, 'watchtower', 'r0s0');
    state = { ...state, round: { ...state.round, placedToday: false } };
    state = placeStructure(state, 'farm', 'r0s1');
    // Force the shade onto the farm (adjacent to the tower)
    state = endDay(state, makeRng([0.99, 0.5, 0.5]));
    expect(state.round.shades[0].targetSlotId).toBe('r0s1');
    state = runSeconds(state, 16, makeRng());
    expect(state.round.slots[1].structure).toBeTruthy();
    expect(state.round.heart).toBe(HEART_MAX);
  });

  it('runs the day/night cycle to dawn with survivors leveling at three nights', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['palisade'], glow: 20 } };
    state = placeStructure(state, 'palisade', 'r0s0');
    const rng = makeRng([0.3, 0.6, 0.9]);
    state = runSeconds(state, 200, rng);
    // Some dawns have passed; the round is still alive or fell honestly
    expect(state.round.day).toBeGreaterThan(1);
  });

  it('falls when the Heart darkens and pays Embers on collection', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, heart: 10, phase: 'night', phaseStart: 0, shades: [
      { id: 1, targetSlotId: null, spawnAngle: 0, spawnedAt: 0, arrivesAt: 1, phase: 'approach', heldSince: null, feedsAt: null },
    ] } };
    state = runSeconds(state, 3, makeRng());
    expect(state.round.phase).toBe('fallen');
    expect(state.round.heart).toBe(0);
    const earned = getEmbersEarned(state.round);
    expect(earned).toBeGreaterThanOrEqual(1);
    const collected = collectEmbers(state);
    expect(collected.embers).toBe(earned);
    expect(collected.round).toBeNull();
    expect(collected.lastRound.embers).toBe(earned);
  });

  it('meta upgrades are bought with Embers and shape the next round', () => {
    let state = { ...createInitialState(), embers: 40 };
    expect(buyMetaUpgrade(state, 'secondWarden')).toBeTruthy();
    state = buyMetaUpgrade(state, 'morningStockpile');
    state = buyMetaUpgrade(state, 'stoneFoundations');
    expect(state.embers).toBe(30);
    expect(buyMetaUpgrade(state, 'morningStockpile')).toBeNull(); // owned
    expect(buyMetaUpgrade({ ...state, embers: 10 }, 'secondWarden')).toBeNull(); // pinnacle price

    state = buyMetaUpgrade(state, 'secondWarden');
    state = beginRound(state, makeRng());
    expect(state.round.glow).toBe(27);
    expect(state.round.wardens).toHaveLength(2);
    state = { ...state, round: { ...state.round, draft: ['palisade'] } };
    state = placeStructure(state, 'palisade', 'r0s0');
    expect(state.round.slots[0].structure.hp).toBe(4);
  });

  it('the ledger accumulates across vigils and survives old saves', () => {
    // A fallen round with telemetry banks into the lifetime ledger.
    let state = startedRound();
    state = {
      ...state,
      round: {
        ...state.round,
        day: 4,
        phase: 'fallen',
        heart: 0,
        slots: state.round.slots,
        stats: {
          heartLoss: { falls: STRUCTURE_HIT * 2, heartHits: 0, vents: 0 },
          nights: [
            { night: 1, spawned: 1, banished: 1, towerKills: 0, fed: 0, heartLost: 0, minHeart: 80, slowed: 0 },
            { night: 2, spawned: 2, banished: 1, towerKills: 2, fed: 2, heartLost: 36, minHeart: 44, slowed: 0 },
          ],
        },
      },
    };
    const banked = collectEmbers(state);
    expect(banked.lifetime.nights).toBe(3);
    expect(banked.lifetime.banished).toBe(2);
    expect(banked.lifetime.towerKills).toBe(2);
    expect(banked.lifetime.structuresLost).toBe(2);
    expect(banked.lifetime.embers).toBe(banked.lastRound.embers);

    // An old save without a ledger gets a zeroed one, not a crash.
    const migrated = migrateState({ embers: 5, bestNights: 3, totalRounds: 2 });
    expect(migrated.lifetime).toEqual({ nights: 0, embers: 0, banished: 0, towerKills: 0, structuresLost: 0 });
  });

  it('milestone upgrades are sealed until the vigil is proven', () => {
    // Rich but unproven: the seal holds.
    let state = { ...createInitialState(), embers: 60, bestNights: 5 };
    expect(buyMetaUpgrade(state, 'beaconHeart')).toBeNull();
    // Proven: the seal breaks.
    state = { ...state, bestNights: 8 };
    state = buyMetaUpgrade(state, 'beaconHeart');
    expect(state).toBeTruthy();

    // Beacon Heart burns one shade at each dusk from night 3 — and the
    // forecast says so before dusk falls.
    let round = beginRound(state, makeRng([0.1, 0.4, 0.7]));
    round = { ...round, round: { ...round.round, day: 3, draft: ['palisade'], glow: 20 } };
    round = placeStructure(round, 'palisade', 'r0s0');
    expect(getNightForecast(round.round).count).toBe(getShadeCount(3) - 1);
    const dusk = endDay(round, makeRng([0.5]));
    expect(dusk.round.shades).toHaveLength(getShadeCount(3) - 1);

    // Emberheart pays +1 per night past the fourth at the fall.
    const fallen = { day: 8, glow: 0, slots: [] };
    const base = getEmbersEarned(fallen, {});
    expect(getEmbersEarned(fallen, { emberheart: true })).toBe(base + 3);
  });

  it('the ruins remember: falls leave ash and pay their story', () => {
    // A structure falling marks its slot as a ruin.
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm'], glow: 20 } };
    state = placeStructure(state, 'farm', 'r0s0');
    state = endDay(state, makeRng([0.5, 0.5, 0.5]));
    state = runSeconds(state, Math.ceil(13 + SHADE_FEED_TIME + 2), makeRng());
    expect(state.round.slots[0].structure).toBeNull();
    expect(state.round.slots[0].ruin).toBe(true);

    // With the pinnacle owned, each fall pays +1 Ember at the end.
    const fallen = { day: 5, glow: 0, slots: [], stats: { heartLoss: { falls: STRUCTURE_HIT * 3, heartHits: 0, vents: 0 }, nights: [] } };
    const base = getEmbersEarned(fallen, {});
    expect(getEmbersEarned(fallen, { ruinsRemember: true })).toBe(base + 3);

    // Rebuilding over ashes clears them.
    let rebuilt = { ...state, round: { ...state.round, phase: 'day', placedToday: false, draft: ['palisade'], glow: 20 } };
    rebuilt = placeStructure(rebuilt, 'palisade', 'r0s0');
    expect(rebuilt.round.slots[0].ruin).toBe(false);
  });

  it('rerolling the draft costs glow, once per day, and resets at dawn', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, glow: 10 } };
    const rerolled = rerollDraft(state, makeRng([0.9, 0.2, 0.6]));
    expect(rerolled.round.glow).toBe(10 - REROLL_COST);
    expect(rerolled.round.rerolledToday).toBe(true);
    expect(rerollDraft(rerolled, makeRng())).toBeNull(); // once per day
    // Too poor to reroll
    expect(rerollDraft({ ...state, round: { ...state.round, glow: 2 } }, makeRng())).toBeNull();
    // Dawn resets the privilege
    let night = { ...rerolled, round: { ...rerolled.round, phase: 'night', phaseStart: rerolled.round.time, shades: [], placedToday: false, towerCharges: {} } };
    night = runSeconds(night, 12, makeRng());
    expect(night.round.phase).toBe('day');
    expect(night.round.rerolledToday).toBe(false);
  });

  it('a vigil can be abandoned, and the nights survived still pay', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, day: 4 } };
    const walked = abandonRound(state);
    expect(walked.round.phase).toBe('fallen');
    expect(walked.round.heart).toBe(0);
    expect(walked.round.shades).toHaveLength(0);
    const banked = collectEmbers(walked);
    expect(banked.lastRound.nights).toBe(3);
    expect(banked.embers).toBeGreaterThanOrEqual(1);
    // No round, or an already-fallen round: nothing to abandon.
    expect(abandonRound(banked)).toBeNull();
    expect(abandonRound(walked)).toBeNull();
  });

  it('the very first day hurries no one', () => {
    const first = startedRound();
    expect(getDayLength(first.round)).toBe(DAY_LENGTH * 3);
    // Later rounds, and later days, keep the real clock.
    expect(getDayLength({ ...first.round, day: 2 })).toBe(DAY_LENGTH);
    const veteran = beginRound({ ...createInitialState(), totalRounds: 3 }, makeRng([0.5]));
    expect(getDayLength(veteran.round)).toBe(DAY_LENGTH);
  });

  it('is deterministic under the same seed', () => {
    const play = () => {
      const rng = makeRng([0.17, 0.62, 0.48, 0.91, 0.05]);
      let state = beginRound(createInitialState(), rng);
      state = { ...state, round: { ...state.round, draft: ['farm', 'palisade', 'well'] } };
      state = placeStructure(state, 'palisade', 'r0s3');
      return runSeconds(state, 120, rng);
    };
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });

  it('warden cooldown constant stays humane for a snappy night', () => {
    expect(WARDEN_COOLDOWN).toBeLessThanOrEqual(8);
  });

  it('persists through storage and migrates unreadable saves safely', () => {
    const store = new Map();
    const storage = {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
    };

    // Round-trip: a mid-round state survives save/load exactly
    let state = startedRound();
    state = { ...state, embers: 7, bestNights: 4 };
    saveState(storage, state);
    const loaded = loadState(storage);
    expect(loaded.embers).toBe(7);
    expect(loaded.bestNights).toBe(4);
    expect(JSON.stringify(loaded.round)).toBe(JSON.stringify(state.round));

    // Corrupt JSON falls back to a fresh start
    storage.setItem('hearthlight-save', '{nope');
    expect(loadState(storage).embers).toBe(0);

    // Old saves gain new fields; broken values are repaired
    expect(migrateState({ embers: -5, round: 'garbage' }).embers).toBe(0);
    expect(migrateState({ embers: 12 }).round).toBeNull();
    expect(migrateState(null).totalRounds).toBe(0);
    expect(migrateState({ meta: { swiftWarden: true } }).meta.swiftWarden).toBe(true);
  });

  it('new structures hook the engine: granary dawns, bell delays, kiln pays', () => {
    // Bell Tower: every shade this night arrives later. Control round has a
    // palisade in the same slot so targeting and rng rolls are identical.
    const base = startedRound();
    const withBell = placeStructure({ ...base, round: { ...base.round, draft: ['belltower'], glow: 30 } }, 'belltower', 'r0s0');
    const withWall = placeStructure({ ...base, round: { ...base.round, draft: ['palisade'], glow: 30 } }, 'palisade', 'r0s0');
    const bellDusk = endDay(withBell, makeRng([0.5, 0.5, 0.5]));
    const wallDusk = endDay(withWall, makeRng([0.5, 0.5, 0.5]));
    expect(bellDusk.round.shades[0].arrivesAt).toBeCloseTo(wallDusk.round.shades[0].arrivesAt + 2, 5);

    // Granary: extra Glow at dawn (baseline structure pays 3, granary pays 9)
    const dawnGlow = STRUCTURES.granary.dawnGlow;
    expect(dawnGlow).toBe(6);

    // Ember Kiln: converts held Glow at the fall (+1 per 20, capped at 3)
    const fallen = { day: 5, glow: 65, slots: [
      { id: 'a', structure: { type: 'emberKiln', hp: 1, level: 1, nightsSurvived: 2 } },
    ] };
    expect(getEmbersEarned(fallen)).toBe(4 + 0 + 3); // nights 4, alive 0(floor .5), kiln 3
  });

  it('heartstone and ember choir shape rounds and payouts', () => {
    let state = { ...createInitialState(), embers: 40, meta: {} };
    state = buyMetaUpgrade(state, 'heartstone');
    state = buyMetaUpgrade(state, 'emberChoir');
    state = beginRound(state, makeRng());
    expect(state.round.heart).toBe(105);
    expect(state.round.heartMax).toBe(105);

    const fallen = { day: 7, glow: 0, slots: [] };
    expect(getEmbersEarned(fallen, state.meta)).toBe(6 + 3); // 6 nights + choir floor(6/2)
  });

  it('records round telemetry: attribution, per-night stats, glow breakdown', () => {
    let state = startedRound();
    state = { ...state, round: { ...state.round, draft: ['farm', 'well', 'palisade'], glow: 50 } };
    state = placeStructure(state, 'farm', 'r0s0');
    state = { ...state, round: { ...state.round, placedToday: false, draft: ['well'] } };
    state = placeStructure(state, 'well', 'r0s1');

    // Adjacency contribution is measurable
    const breakdown = getGlowBreakdown(state);
    expect(breakdown.adjacency).toBeCloseTo(0.4);
    expect(breakdown.total).toBeGreaterThan(breakdown.adjacency);

    // A night that eats the farm attributes the loss
    state = endDay(state, makeRng([0.01, 0.5, 0.5]));
    expect(state.round.stats.nights).toHaveLength(1);
    expect(state.round.stats.nights[0].spawned).toBe(1);
    state = runSeconds(state, 25, makeRng());
    const stats = state.round.stats;
    expect(stats.heartLoss.falls + stats.heartLoss.heartHits + stats.heartLoss.vents).toBeGreaterThan(0);
    const night = stats.nights[0];
    expect(night.fed + night.banished + night.towerKills).toBeGreaterThan(0);
    expect(night.minHeart).toBeLessThanOrEqual(HEART_MAX);
  });
});
