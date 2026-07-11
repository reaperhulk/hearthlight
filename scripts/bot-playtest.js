#!/usr/bin/env node
// Hearthlight bot playtest: deterministic profiles play rounds and the
// assertions guard the loop's promises — snappy round 1, defense matters,
// meta lengthens runs. Usage:
//   node hearthlight/scripts/bot-playtest.js [--seed N] [--assert]
import { createInitialState } from '../src/engine/state.js';
import { beginRound, collectEmbers, placeStructure, getEmbersEarned } from '../src/engine/round.js';
import { STRUCTURES } from '../src/engine/structures.js';
import { getAdjacentSlots } from '../src/engine/map.js';
import { endDay, tick } from '../src/engine/tick.js';
import { moveWarden, getWardenCooldown } from '../src/engine/night.js';
import { buyMetaUpgrade, META_UPGRADES } from '../src/engine/meta.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const META_ORDER = ['stoneFoundations', 'swiftWarden', 'morningStockpile', 'emberChoir', 'heartstone', 'deeperDrafts', 'secondWarden', 'outerRing'];

// ── Profiles ────────────────────────────────────────────────────────────────
// passive: never touches anything. builder: places by day, sleeps at night.
// keeper: builds and walks the night.

function pickPlacement(state) {
  const round = state.round;
  const structures = round.slots.filter(slot => slot.structure);
  const defenses = structures.filter(slot => STRUCTURES[slot.structure.type].defensive).length;
  const wantDefense = defenses < Math.ceil((structures.length + 1) / 3);

  const affordable = round.draft.filter(id => STRUCTURES[id].cost <= round.glow);
  if (affordable.length === 0) return null;
  const byPreference = wantDefense
    ? ['watchtower', 'belltower', 'palisade', 'lantern', 'farm', 'well', 'granary', 'shrine', 'emberKiln']
    : ['farm', 'granary', 'well', 'shrine', 'emberKiln', 'watchtower', 'belltower', 'lantern', 'palisade'];
  const choice = byPreference.find(id => affordable.includes(id)) || affordable[0];

  const empty = round.slots.filter(slot => !slot.structure);
  if (empty.length === 0) return null;
  let slot = empty[0];
  if (choice === 'watchtower' || choice === 'lantern') {
    slot = empty.reduce((best, candidate) => {
      const covers = getAdjacentSlots(round.slots, candidate.id).filter(neighbor => neighbor.structure).length;
      const bestCovers = getAdjacentSlots(round.slots, best.id).filter(neighbor => neighbor.structure).length;
      return covers > bestCovers ? candidate : best;
    }, empty[0]);
  }
  if (choice === 'well') {
    slot = empty.find(candidate =>
      getAdjacentSlots(round.slots, candidate.id).some(neighbor => neighbor.structure?.type === 'farm')) || empty[0];
  }
  return { structureId: choice, slotId: slot.id };
}

function botDay(state, profile, rng) {
  if (profile === 'passive') return state;
  const round = state.round;
  if (!round.placedToday) {
    const placement = pickPlacement(state);
    if (placement) {
      const placed = placeStructure(state, placement.structureId, placement.slotId);
      if (placed) state = placed;
    }
  }
  // Harvest a little, then call the dusk
  if (state.round.placedToday && state.round.time - state.round.phaseStart >= 8) {
    state = endDay(state, rng);
  }
  return state;
}

function botNight(state, profile) {
  if (profile !== 'keeper') return state;
  const round = state.round;
  const guarded = new Set(round.wardens.map(warden => warden.slotId).filter(Boolean));
  const threats = round.shades
    .filter(shade => shade.targetSlotId && shade.phase !== 'held' && !guarded.has(shade.targetSlotId))
    .sort((a, b) => (a.arrivesAt ?? 0) - (b.arrivesAt ?? 0));
  if (threats.length === 0) return state;
  const busy = new Set(round.shades.map(shade => shade.targetSlotId));
  const free = round.wardens.find(warden =>
    round.time - warden.movedAt >= getWardenCooldown(state) &&
    (!warden.slotId || !busy.has(warden.slotId)));
  if (!free) return state;
  const moved = moveWarden(state, free.id, threats[0].targetSlotId);
  return moved || state;
}

function playRound(state, profile, rng, maxSeconds = 1200) {
  state = beginRound(state, rng);
  let seconds = 0;
  while (state.round && state.round.phase !== 'fallen' && seconds < maxSeconds) {
    if (state.round.phase === 'day') state = botDay(state, profile, rng);
    else state = botNight(state, profile);
    state = tick(state, 1, rng);
    seconds++;
  }
  const nights = state.round ? state.round.day - 1 : 0;
  const embers = state.round ? getEmbersEarned(state.round, state.meta) : 0;
  const fell = state.round?.phase === 'fallen';
  state = fell ? collectEmbers(state) : state;
  return { state, nights, embers, seconds, fell };
}

function spendEmbers(state) {
  let current = state;
  for (const id of META_ORDER) {
    const bought = buyMetaUpgrade(current, id);
    if (bought) current = bought;
  }
  return current;
}

// ── Scenarios ──────────────────────────────────────────────────────────────
// Rounds are run across several seeds: hard invariants must hold on EVERY
// seed; pacing bands are asserted on the MEAN, because single-seed arcs are
// too noisy to tune against.
const seedArg = process.argv.indexOf('--seed');
const FIXED_SEEDS = [424242, 133742, 271828, 314159, 861861];
// One fresh random seed every run: the fixed set cannot be overfit, and a
// failure here means real-play variance is too wide. The seed is printed —
// reproduce any failure exactly with --seed N.
const randomSeed = Math.floor(Math.random() * 2147483647);
const SEEDS = seedArg >= 0 ? [Number(process.argv[seedArg + 1])] : [...FIXED_SEEDS, randomSeed];
const assertMode = process.argv.includes('--assert');

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const fmtArc = arc => arc.map(round => round.nights).join('\u2192');

console.log(`Hearthlight playtest | fixed seeds ${FIXED_SEEDS.join(', ')}${seedArg >= 0 ? ` (overridden: ${SEEDS[0]})` : ` | random seed ${randomSeed}`}\n`);

const perSeed = [];
for (const seed of SEEDS) {
  const result = { seed };
  for (const profile of ['passive', 'builder', 'keeper']) {
    result[profile] = playRound(createInitialState(), profile, mulberry32(seed));
  }
  // The meta arc: a keeper plays five rounds, spending Embers between them.
  const rng = mulberry32(seed);
  let state = createInitialState();
  result.arc = [];
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    const outcome = playRound(state, 'keeper', rng);
    state = spendEmbers(outcome.state);
    result.arc.push(outcome);
  }
  result.metaOwned = Object.keys(state.meta).length;
  // Determinism: replay the keeper round on the same seed.
  const replay = playRound(createInitialState(), 'keeper', mulberry32(seed));
  result.deterministic = replay.nights === result.keeper.nights &&
    replay.embers === result.keeper.embers && replay.seconds === result.keeper.seconds;
  result.isRandom = seed === randomSeed && seedArg < 0;
  perSeed.push(result);
  console.log(
    `  seed ${String(seed).padEnd(10)}${result.isRandom ? '*' : ' '}| r1 passive ${String(result.passive.nights).padStart(2)}n` +
    ` builder ${String(result.builder.nights).padStart(2)}n keeper ${String(result.keeper.nights).padStart(2)}n/${result.keeper.seconds}s` +
    ` | arc ${fmtArc(result.arc)} | meta ${result.metaOwned}/${Object.keys(META_UPGRADES).length}` +
    `${result.deterministic ? '' : ' | DETERMINISM BROKEN'}`);
}

const fixed = perSeed.filter(result => !result.isRandom);
const agg = {
  passiveNights: mean(fixed.map(result => result.passive.nights)),
  keeperNights: mean(fixed.map(result => result.keeper.nights)),
  keeperSeconds: mean(fixed.map(result => result.keeper.seconds)),
  keeperEmbers: mean(fixed.map(result => result.keeper.embers)),
  arcFirst: mean(fixed.map(result => result.arc[0].nights)),
  arcLast: mean(fixed.map(result => result.arc[result.arc.length - 1].nights)),
  arcFirstSeconds: mean(fixed.map(result => result.arc[0].seconds)),
  arcLastSeconds: mean(fixed.map(result => result.arc[result.arc.length - 1].seconds)),
};
console.log(`\n  means: passive ${agg.passiveNights.toFixed(1)}n | keeper r1 ${agg.keeperNights.toFixed(1)}n/${Math.round(agg.keeperSeconds)}s/${agg.keeperEmbers.toFixed(1)} embers | arc ${agg.arcFirst.toFixed(1)} -> ${agg.arcLast.toFixed(1)}n (${Math.round(agg.arcFirstSeconds)}s -> ${Math.round(agg.arcLastSeconds)}s)`);

if (assertMode) {
  const issues = [];
  // Hard invariants: every seed, no exceptions.
  for (const result of perSeed) {
    const tag = `seed ${result.seed}:`;
    if (!result.deterministic) issues.push(`${tag} same seed produced different rounds`);
    if (!result.passive.fell) issues.push(`${tag} a do-nothing round never ends`);
    if (result.passive.embers < 1) issues.push(`${tag} a fall paid nothing`);
    if (!result.keeper.fell) issues.push(`${tag} the wall never won against the keeper`);
    if (result.keeper.nights < result.passive.nights) issues.push(`${tag} playing is worse than doing nothing`);
    if (result.keeper.embers < 3) issues.push(`${tag} first round pays too little to buy anything`);
    if (result.keeper.seconds > 240) issues.push(`${tag} round 1 keeper took ${result.keeper.seconds}s`);
  }
  // Variance guard: the random seed must land near the fixed-seed band.
  for (const result of perSeed.filter(candidate => candidate.isRandom)) {
    const drift = Math.abs(result.keeper.nights - agg.keeperNights);
    if (drift > 4) issues.push(`random seed ${result.seed}: keeper round 1 ${result.keeper.nights} nights drifts ${drift.toFixed(1)} from the fixed mean ${agg.keeperNights.toFixed(1)} — variance too wide (reproduce with --seed ${result.seed})`);
  }

  // Pacing bands: on the fixed-seed mean.
  if (agg.passiveNights < 1.5 || agg.passiveNights > 4) issues.push(`mean passive nights ${agg.passiveNights.toFixed(1)} outside 1.5-4`);
  if (agg.keeperNights < 4) issues.push(`mean keeper round 1 only ${agg.keeperNights.toFixed(1)} nights — too punishing`);
  if (agg.keeperNights > 8) issues.push(`mean keeper round 1 ${agg.keeperNights.toFixed(1)} nights — round 1 drags`);
  if (agg.keeperSeconds > 180) issues.push(`mean keeper round 1 ${Math.round(agg.keeperSeconds)}s — the optimal ceiling must stay under three minutes so first play lands in one to two`);
  const builderNights = mean(perSeed.map(result => result.builder.nights));
  if (agg.keeperNights - builderNights < 1) issues.push(`night play barely matters (keeper ${agg.keeperNights.toFixed(1)} vs builder ${builderNights.toFixed(1)})`);
  if (agg.arcLast <= agg.arcFirst) issues.push(`meta does not lengthen runs on the mean (${agg.arcFirst.toFixed(1)} -> ${agg.arcLast.toFixed(1)})`);
  if (agg.arcLastSeconds <= agg.arcFirstSeconds) issues.push('later rounds are not longer in real time on the mean');

  console.log('\n\u2500\u2500 Assertions \u2500\u2500');
  if (issues.length > 0) {
    for (const issue of issues) console.log(`  \u2717 ${issue}`);
    process.exit(1);
  }
  console.log('  \u2713 all loop promises hold on every seed');
}
