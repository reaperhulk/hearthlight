// The round clock: day → dusk → night → dawn, in bounded deterministic
// slices. All randomness flows through the injected rng.
import { getDayLength, DAWN_GLOW_PER_STRUCTURE, LEVEL_UP_NIGHTS, LEVEL_UP_NIGHTS_VETERAN, drawDraft, getGlowRate } from './round.js';
import { STRUCTURES } from './structures.js';
import { getAdjacentSlots } from './map.js';
import { advanceNightSlice, nightResolved, rollOmen, spawnShades, HUNGRY_EXTRA } from './night.js';

function appendLog(round, day, messages) {
  if (!messages || messages.length === 0) return round.log;
  return [...round.log, ...messages.map(message => ({ day, message }))].slice(-30);
}

function dawn(state, rng) {
  const round = state.round;
  let glow = round.glow;
  // Watered ground: a well pays its dawnAdjacency into each matching
  // neighbor (the well's identity is making OTHER ground richer).
  const wateredBonus = slot => getAdjacentSlots(round.slots, slot.id).reduce((sum, neighbor) => {
    const giving = neighbor.structure && STRUCTURES[neighbor.structure.type].dawnAdjacency;
    return sum + (giving?.[slot.structure.type] || 0);
  }, 0);
  const slots = round.slots.map(slot => {
    if (!slot.structure) return slot;
    glow += DAWN_GLOW_PER_STRUCTURE + (STRUCTURES[slot.structure.type].dawnGlow || 0) + wateredBonus(slot);
    const nightsSurvived = slot.structure.nightsSurvived + 1;
    let level = slot.structure.level;
    let hp = slot.structure.hp;
    if (level === 1 && nightsSurvived >= LEVEL_UP_NIGHTS) { level = 2; hp += 1; }
    else if (level === 2 && nightsSurvived >= LEVEL_UP_NIGHTS_VETERAN) { level = 3; hp += 1; }
    return {
      ...slot,
      structure: { ...slot.structure, nightsSurvived, level, hp },
    };
  });

  const day = round.day + 1;
  // Roll tonight's omen now, at dawn — announced a full day ahead.
  const omen = rollOmen(day, rng);
  const messages = [`Dawn. Night ${round.day} survived.`];
  if (omen?.type === 'hungry') messages.push(`Omen: a Hungry Night — the dark brings ${HUNGRY_EXTRA} more teeth.`);
  if (omen?.type === 'still') messages.push('Omen: a Still Night — the dark holds its breath, and gathers.');
  if (round.stillDebt) messages.push('The held breath releases. Tonight the dark collects.');
  const withDawn = {
    ...round,
    day,
    phase: 'day',
    phaseStart: round.time,
    glow,
    slots,
    omen,
    rerolledToday: false,
    mendedToday: false,
    log: appendLog(round, day, messages),
  };
  withDawn.draft = drawDraft({ ...state, round: withDawn }, rng);
  return { ...state, round: withDawn };
}

export function endDay(state, rng = Math.random) {
  const round = state.round;
  if (!round || round.phase !== 'day') return state;
  return spawnShades(state, rng);
}

export function tick(state, dt, rng = Math.random) {
  let current = state;
  let remaining = dt;
  while (remaining > 0 && current.round && current.round.phase !== 'fallen') {
    const slice = Math.min(1, remaining);
    remaining -= slice;
    const round = current.round;
    const time = round.time + slice;

    if (round.phase === 'day') {
      const glow = round.glow + getGlowRate(current) * slice;
      current = { ...current, round: { ...round, time, glow } };
      if (time - round.phaseStart >= getDayLength(round)) {
        current = endDay(current, rng);
      }
      continue;
    }

    // Night
    let advanced = advanceNightSlice(current, { ...round, time });
    const log = appendLog(round, round.day, advanced.pendingLog);
    delete advanced.pendingLog;
    advanced = { ...advanced, log };

    if (advanced.heart <= 0) {
      current = {
        ...current,
        round: {
          ...advanced,
          heart: 0,
          phase: 'fallen',
          shades: [],
          log: appendLog(advanced, round.day, ['The Heart goes dark. The town is memory now.']),
        },
      };
      break;
    }

    current = { ...current, round: advanced };
    if (nightResolved(advanced)) {
      current = dawn(current, rng);
    }
  }
  return current;
}
