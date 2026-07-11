// The night: shades creep from the rim toward what you built.
// One verb — move the Warden. Everything else is what you built by day.
import { STRUCTURES } from './structures.js';
import { getAdjacentSlots, nearHeart } from './map.js';

export const NIGHT_MIN_LENGTH = 10;
export const SHADE_FEED_TIME = 5;
export const SHADE_HOLD_TIME = 3.5;
export const SHADE_HOLD_TIME_SWIFT = 2;
export const WARDEN_COOLDOWN = 6;
export const WARDEN_COOLDOWN_SWIFT = 2;
export const HEART_HIT = 20;      // a shade that reaches the Heart
export const STRUCTURE_HIT = 18;  // heart-light lost when a structure falls
// A shade that finds only ash vents its hunger at the Heart. Priced close
// to a fall on purpose: a tiny town that lets overflow shades vent must
// not out-economize a built town absorbing them with structures.
export const EMPTY_ARRIVAL_HIT = 14;
export const NIGHT_ESCALATION = 1.22;

// Uncapped and superlinear: gentle for two nights, then the dark
// compounds. It always wins eventually — that is the scoreboard.
export function getShadeCount(night) {
  return night + Math.floor((night - 1) / 2);
}

// Omens: every fourth night carries a named event, rolled and announced at
// the dawn before. Bounded, visible randomness — never an ambush.
export const OMEN_INTERVAL = 4;
export const HUNGRY_EXTRA = 2;
export const STILL_DEBT = 3;

export function rollOmen(day, rng) {
  if (day < OMEN_INTERVAL || day % OMEN_INTERVAL !== 0) return null;
  return { night: day, type: rng() < 0.5 ? 'hungry' : 'still' };
}

// Heartseekers: from this night on, every fifth shade ignores the town
// and goes for the Heart itself. Counterplay: a warden standing AT the
// Heart holds them; watchtowers near the center intercept them.
export const HEARTSEEKER_NIGHT = 7;
export const HEART_SLOT = 'heart';

// The frontier is reached first: shades close on outer-ring structures
// this much sooner (pairs with FRONTIER_YIELD in round.js).
export const FRONTIER_APPROACH = 0.9;

export function getHeartseekerCount(night, count) {
  return night >= HEARTSEEKER_NIGHT ? Math.floor(count / 5) : 0;
}

// What dusk will actually bring tonight, omens and debts included.
// The UI forecast and spawnShades both read this — one source of truth.
export function getNightForecast(round) {
  const omen = round.omen && round.omen.night === round.day ? round.omen.type : null;
  if (omen === 'still') return { count: 0, omen, heartseekers: 0 };
  const count = getShadeCount(round.day) + (omen === 'hungry' ? HUNGRY_EXTRA : 0) + (round.stillDebt ? STILL_DEBT : 0);
  return { count, omen, heartseekers: getHeartseekerCount(round.day, count) };
}

export function getHoldTime(state) {
  return state.meta.swiftWarden ? SHADE_HOLD_TIME_SWIFT : SHADE_HOLD_TIME;
}

export function getWardenCooldown(state) {
  return state.meta.swiftWarden ? WARDEN_COOLDOWN_SWIFT : WARDEN_COOLDOWN;
}

function lanternSlow(round, slotId) {
  const lit = getAdjacentSlots(round.slots, slotId).some(neighbor =>
    neighbor.structure?.type === 'lantern');
  return lit ? STRUCTURES.lantern.slowsAdjacent : 1;
}

// Dusk: spawn the night's shades with the injected rng.
export function spawnShades(state, rng) {
  const round = state.round;
  const { count, omen, heartseekers } = getNightForecast(round);
  const speed = Math.pow(NIGHT_ESCALATION, round.day - 1);
  const occupied = round.slots.filter(slot => slot.structure);
  const bellDelay = occupied.reduce((sum, slot) =>
    sum + (STRUCTURES[slot.structure.type].nightDelay || 0), 0);
  const shades = [];
  let nextId = round.nextShadeId;

  for (let index = 0; index < count; index++) {
    let targetSlotId = null;
    let ringFactor = 1;
    // The first shades of a late night seek the Heart itself. A lantern
    // kept near the center slows them — light guards the Heart.
    if (index < heartseekers) {
      const heartLit = round.slots.some(slot => slot.structure?.type === 'lantern' && nearHeart(slot));
      const approach = ((8 + 5 * rng()) / speed) * (heartLit ? STRUCTURES.lantern.slowsAdjacent : 1) + bellDelay;
      shades.push({
        id: nextId++,
        targetSlotId: null,
        spawnAngle: rng() * Math.PI * 2,
        spawnedAt: round.time,
        arrivesAt: round.time + approach,
        phase: 'approach',
        heldSince: null,
        feedsAt: null,
      });
      continue;
    }
    if (occupied.length > 0) {
      const totalWeight = occupied.reduce((sum, slot) =>
        sum + (STRUCTURES[slot.structure.type].tauntWeight || 1), 0);
      let roll = rng() * totalWeight;
      let pick = occupied[0];
      for (const slot of occupied) {
        roll -= STRUCTURES[slot.structure.type].tauntWeight || 1;
        if (roll <= 0) { pick = slot; break; }
      }
      // Bodyguard: a palisade shields its neighbors — the shade strikes
      // the wall instead. Placement, not luck, decides who is safe.
      if (pick.structure.type !== 'palisade') {
        const shield = getAdjacentSlots(round.slots, pick.id)
          .find(neighbor => neighbor.structure?.type === 'palisade');
        if (shield) pick = shield;
      }
      targetSlotId = pick.id;
      ringFactor = pick.ring > 0 ? FRONTIER_APPROACH : 1;
    }
    const approach = ((8 + 5 * rng()) / speed) * ringFactor * (targetSlotId ? lanternSlow(round, targetSlotId) : 1) + bellDelay;
    shades.push({
      id: nextId++,
      targetSlotId, // null targets the Heart itself
      spawnAngle: rng() * Math.PI * 2,
      spawnedAt: round.time,
      arrivesAt: round.time + approach,
      phase: 'approach',
      heldSince: null,
      feedsAt: null,
    });
  }

  const towerCharges = {};
  for (const slot of round.slots) {
    if (slot.structure?.type === 'watchtower') {
      // Veteran towers earn a third bolt.
      towerCharges[slot.id] = STRUCTURES.watchtower.nightCharges + (slot.structure.level >= 3 ? 1 : 0);
    }
  }

  const slowedCount = shades.filter(shade =>
    shade.targetSlotId && lanternSlow(round, shade.targetSlotId) > 1).length;
  const stats = round.stats || { heartLoss: { falls: 0, heartHits: 0, vents: 0 }, nights: [] };

  return {
    ...state,
    round: {
      ...round,
      phase: 'night',
      phaseStart: round.time,
      shades,
      nextShadeId: nextId,
      towerCharges,
      placedToday: false,
      // A Still Night banks its shades; the next night collects.
      stillDebt: omen === 'still',
      stats: {
        ...stats,
        nights: [...stats.nights, {
          night: round.day,
          spawned: shades.length,
          slowed: slowedCount,
          banished: 0,
          towerKills: 0,
          fed: 0,
          heartLost: 0,
          minHeart: round.heart,
          omen,
        }],
      },
    },
  };
}

// The one night action: send a warden to stand on a slot.
export function moveWarden(state, wardenId, slotId) {
  const round = state.round;
  if (!round || round.phase !== 'night') return null;
  const warden = round.wardens.find(candidate => candidate.id === wardenId);
  if (!warden || warden.slotId === slotId) return null;
  if (round.time - warden.movedAt < getWardenCooldown(state)) return null;
  if (slotId !== HEART_SLOT && !round.slots.some(slot => slot.id === slotId)) return null;
  if (round.wardens.some(other => other.id !== wardenId && other.slotId === slotId)) return null;

  return {
    ...state,
    round: {
      ...round,
      wardens: round.wardens.map(candidate =>
        candidate.id === wardenId ? { ...candidate, slotId, movedAt: round.time } : candidate),
    },
  };
}

function guardedSlotIds(round) {
  return new Set(round.wardens.map(warden => warden.slotId).filter(Boolean));
}

// Advance the night by one bounded slice. Returns the updated round pieces.
export function advanceNightSlice(state, round) {
  const now = round.time;
  const guarded = guardedSlotIds(round);
  const holdTime = getHoldTime(state);
  let { heart } = round;
  let slots = round.slots;
  let towerCharges = { ...round.towerCharges };
  const shades = [];
  const log = [];
  const stats = round.stats || { heartLoss: { falls: 0, heartHits: 0, vents: 0 }, nights: [] };
  const heartLoss = { ...stats.heartLoss };
  const nightEntry = { ...(stats.nights[stats.nights.length - 1] || { night: round.day, spawned: 0, slowed: 0, banished: 0, towerKills: 0, fed: 0, heartLost: 0, minHeart: heart }) };

  const slotById = id => slots.find(slot => slot.id === id);

  // A warden grapples ONE shade at a time; the rest feed. Without this,
  // funneling every shade into a single guarded slot is an immortal bunker.
  // The Heart itself is a guardable position (key HEART_SLOT).
  const keyOf = shade => shade.targetSlotId ?? HEART_SLOT;
  const holderBySlot = new Map();
  for (const shade of round.shades) {
    if (shade.phase === 'held' && guarded.has(keyOf(shade)) && !holderBySlot.has(keyOf(shade))) {
      holderBySlot.set(keyOf(shade), shade.id);
    }
  }
  const canHold = shade => guarded.has(keyOf(shade)) &&
    (holderBySlot.get(keyOf(shade)) ?? shade.id) === shade.id;

  const strikeHeart = () => {
    heart -= HEART_HIT;
    heartLoss.heartHits += HEART_HIT;
    nightEntry.heartLost += HEART_HIT;
    log.push('A shade reaches the Heart. The light gutters.');
  };

  for (const shade of round.shades) {
    let current = shade;

    if (current.phase === 'approach' && now >= current.arrivesAt) {
      const target = current.targetSlotId ? slotById(current.targetSlotId) : null;
      if (current.targetSlotId && (!target || !target.structure)) {
        // The prize is already gone — the shade vents at the Heart.
        heart -= EMPTY_ARRIVAL_HIT;
        heartLoss.vents += EMPTY_ARRIVAL_HIT;
        nightEntry.heartLost += EMPTY_ARRIVAL_HIT;
        log.push('A shade finds only ash and howls at the Heart.');
        continue;
      }
      if (!current.targetSlotId) {
        // A heartseeker at the Heart's edge: a tower near the center may
        // burn it; a warden standing at the Heart grapples it; otherwise
        // it strikes.
        const heartTower = slots.find(slot =>
          slot.structure?.type === 'watchtower' && towerCharges[slot.id] > 0 && nearHeart(slot));
        if (heartTower) {
          towerCharges = { ...towerCharges, [heartTower.id]: towerCharges[heartTower.id] - 1 };
          nightEntry.towerKills += 1;
          log.push('The watchtower burns a shade at the Heart’s threshold.');
          continue;
        }
        if (canHold(current)) {
          holderBySlot.set(HEART_SLOT, current.id);
          current = { ...current, phase: 'held', heldSince: current.arrivesAt };
          shades.push(current);
          continue;
        }
        strikeHeart();
        continue;
      }
      // Watchtower intercept: one banish per tower per night.
      const towerSlot = getAdjacentSlots(slots, current.targetSlotId)
        .find(neighbor => neighbor.structure?.type === 'watchtower' && towerCharges[neighbor.id] > 0);
      if (towerSlot) {
        towerCharges = { ...towerCharges, [towerSlot.id]: towerCharges[towerSlot.id] - 1 };
        nightEntry.towerKills += 1;
        log.push('The watchtower burns a shade out of the dark.');
        continue;
      }
      if (canHold(current)) {
        holderBySlot.set(current.targetSlotId, current.id);
        current = { ...current, phase: 'held', heldSince: current.arrivesAt };
      } else {
        current = { ...current, phase: 'feeding', feedsAt: current.arrivesAt + SHADE_FEED_TIME };
      }
    }

    if (current.phase === 'held') {
      if (!canHold(current)) {
        if (!current.targetSlotId) {
          // The warden stepped away from the Heart — the grip breaks.
          strikeHeart();
          continue;
        }
        current = { ...current, phase: 'feeding', heldSince: null, feedsAt: now + SHADE_FEED_TIME };
      } else if (now - current.heldSince >= holdTime) {
        holderBySlot.delete(keyOf(current));
        nightEntry.banished += 1;
        log.push('The Warden holds the line. A shade is banished.');
        continue;
      }
    }

    if (current.phase === 'feeding') {
      if (canHold(current)) {
        holderBySlot.set(current.targetSlotId, current.id);
        current = { ...current, phase: 'held', heldSince: now, feedsAt: null };
      } else if (now >= current.feedsAt) {
        const index = slots.findIndex(slot => slot.id === current.targetSlotId);
        const structure = slots[index]?.structure;
        if (!structure) {
          // Its prize fell to another's teeth — the shade vents at the
          // Heart. Overflow shades are never free.
          heart -= EMPTY_ARRIVAL_HIT;
          heartLoss.vents += EMPTY_ARRIVAL_HIT;
          nightEntry.heartLost += EMPTY_ARRIVAL_HIT;
          log.push('A shade finds only ash and howls at the Heart.');
          continue;
        }
        if (structure) {
          const hp = structure.hp - 1;
          slots = [...slots];
          nightEntry.fed += 1;
          if (hp <= 0) {
            slots[index] = { ...slots[index], structure: null };
            heart -= STRUCTURE_HIT;
            heartLoss.falls += STRUCTURE_HIT;
            nightEntry.heartLost += STRUCTURE_HIT;
            log.push(`The dark takes the ${STRUCTURES[structure.type].name}.`);
          } else {
            slots[index] = { ...slots[index], structure: { ...structure, hp } };
            log.push(`Teeth in the ${STRUCTURES[structure.type].name} — it holds, barely.`);
          }
        }
        continue; // the shade is sated
      }
    }

    shades.push(current);
  }

  nightEntry.minHeart = Math.min(nightEntry.minHeart, Math.max(0, heart));
  const nights = stats.nights.length > 0
    ? [...stats.nights.slice(0, -1), nightEntry]
    : [nightEntry];
  return {
    ...round, heart, slots, towerCharges, shades,
    stats: { heartLoss, nights },
    pendingLog: log,
  };
}

export function nightResolved(round) {
  return round.shades.length === 0 && round.time - round.phaseStart >= NIGHT_MIN_LENGTH;
}
