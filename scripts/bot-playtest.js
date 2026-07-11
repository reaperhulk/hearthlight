#!/usr/bin/env node
// Hearthlight bot playtest: deterministic profiles play rounds; assertions
// guard the loop's promises; depth panels measure whether choices matter.
// Usage: node scripts/bot-playtest.js [--seed N] [--assert] [--quick] [--ci]
import { createInitialState } from '../src/engine/state.js';
import { beginRound, collectEmbers, placeStructure, getEmbersEarned, getGlowRate } from '../src/engine/round.js';
import { STRUCTURES, STRUCTURE_IDS } from '../src/engine/structures.js';
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
// passive: nothing. builder: builds, sleeps at night. keeper: optimal — the
// skill ceiling. villager: a median human (slow, noisy) — defines the real
// first-play band. Ablations measure depth: if randomPlace matches keeper,
// placement is fake choice.
const PROFILES = {
  passive: {},
  builder: { day: 'smart' },
  keeper: { day: 'smart', night: 'sharp' },
  villager: { day: 'noisy', night: 'slow' },
  randomPlace: { day: 'random', night: 'sharp' },
  economyGreedy: { day: 'economy', night: 'sharp' },
  defenseGreedy: { day: 'defense', night: 'sharp' },
  // Two structures, then turtle behind the warden. Once made a town
  // immortal (parallel warden holds); must always fall, and never beat
  // actually building the town out.
  bunker: { day: 'defense', night: 'sharp', cap: 2 },
};

const ECONOMY_FIRST = ['farm', 'granary', 'well', 'shrine', 'emberKiln', 'watchtower', 'belltower', 'lantern', 'palisade'];
const DEFENSE_FIRST = ['watchtower', 'belltower', 'palisade', 'lantern', 'farm', 'well', 'granary', 'shrine', 'emberKiln'];

function chooseCard(state, style, rng) {
  const round = state.round;
  const affordable = round.draft.filter(id => STRUCTURES[id].cost <= round.glow);
  if (affordable.length === 0) return null;
  if (style === 'random') return affordable[Math.floor(rng() * affordable.length)];
  if (style === 'economy') return ECONOMY_FIRST.find(id => affordable.includes(id)) || affordable[0];
  if (style === 'defense') return DEFENSE_FIRST.find(id => affordable.includes(id)) || affordable[0];

  if (style === 'noisy') {
    // Median human instinct: alternate defense and economy, and sometimes
    // grab the second-best card.
    const structures = round.slots.filter(slot => slot.structure);
    const defenses = structures.filter(slot => STRUCTURES[slot.structure.type].defensive).length;
    const wantDefense = defenses < Math.ceil((structures.length + 1) / 2);
    const preference = (wantDefense ? DEFENSE_FIRST : ECONOMY_FIRST).filter(id => affordable.includes(id));
    if (preference.length === 0) return affordable[0];
    if (preference.length > 1 && rng() < 0.35) return preference[1];
    return preference[0];
  }

  // 'smart': defense-first — measured as the strongest line; the
  // DEFENSE_FIRST fallback order already buys economy when defenses are
  // unaffordable, which is all the economy floor the round needs.
  const preference = DEFENSE_FIRST.filter(id => affordable.includes(id));
  return preference[0] || affordable[0];
}

function chooseSlot(state, structureId, style, rng) {
  const round = state.round;
  const empty = round.slots.filter(slot => !slot.structure);
  if (empty.length === 0) return null;
  if (style === 'random') return empty[Math.floor(rng() * empty.length)];
  if (structureId === 'watchtower' || structureId === 'lantern' || structureId === 'belltower') {
    return empty.reduce((best, candidate) => {
      const covers = getAdjacentSlots(round.slots, candidate.id).filter(neighbor => neighbor.structure).length;
      const bestCovers = getAdjacentSlots(round.slots, best.id).filter(neighbor => neighbor.structure).length;
      return covers > bestCovers ? candidate : best;
    }, empty[0]);
  }
  if (structureId === 'well') {
    return empty.find(candidate =>
      getAdjacentSlots(round.slots, candidate.id).some(neighbor => neighbor.structure?.type === 'farm')) || empty[0];
  }
  return empty[0];
}

// Skilled restraint: a structure is also a target. Smart bots refuse to
// overextend into the exposed outer ring — an unguardable structure costs
// more Heart than it earns.
function smartSkips(config, slot) {
  return config.day === 'smart' && slot.ring > 0;
}

function botDay(state, profile, t, rng, collector) {
  const config = PROFILES[profile];
  if (!config.day) return state;
  const round = state.round;
  const cadence = config.day === 'noisy' ? 3 : 1;
  // A villager sometimes dithers a whole day without building
  if (config.day === 'noisy' && !round.placedToday && round.time - round.phaseStart < 1 && rng() < 0.15) {
    state = { ...state, round: { ...state.round, placedToday: true } };
    return state;
  }
  const atCap = config.cap && round.slots.filter(slot => slot.structure).length >= config.cap;
  let passing = false;
  if (!round.placedToday && !atCap && t % cadence === 0) {
    const card = chooseCard(state, config.day, rng);
    if (card) {
      const slot = chooseSlot(state, card, config.day, rng);
      if (slot && smartSkips(config, slot)) {
        passing = true;
      } else {
        const placed = slot && placeStructure(state, card, slot.id);
        if (placed) {
          collector.picks[card] = (collector.picks[card] || 0) + 1;
          state = placed;
        }
      }
    }
  }
  const wait = config.day === 'noisy' ? 10 : 7;
  if (state.round.time - state.round.phaseStart >= wait) {
    // End the day once placed — or once there is nothing worth doing
    // (town full, deliberate pass, or no affordable card in sight).
    const current = state.round;
    const done = current.placedToday || passing || atCap ||
      !current.slots.some(slot => !slot.structure && !smartSkips(config, slot)) ||
      !current.draft.some(id => STRUCTURES[id].cost <= current.glow + getGlowRate(state) * 4);
    if (done) state = endDay(state, rng);
  }
  return state;
}

function botNight(state, profile, t, rng) {
  const config = PROFILES[profile];
  if (!config.night) return state;
  const round = state.round;
  if (config.night === 'slow') {
    if (t % 7 !== 0) return state;      // slow reactions
    if (rng() < 0.55) return state;     // often misses the threat entirely
  }
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

function emptyCollector() {
  return { picks: {} };
}

function playRound(state, profile, rng, collector = emptyCollector(), maxSeconds = 1200) {
  state = beginRound(state, rng);
  let seconds = 0;
  while (state.round && state.round.phase !== 'fallen' && seconds < maxSeconds) {
    if (state.round.phase === 'day') state = botDay(state, profile, seconds, rng, collector);
    else state = botNight(state, profile, seconds, rng);
    state = tick(state, 1, rng);
    seconds++;
  }
  const round = state.round;
  const nights = round ? round.day - 1 : 0;
  const embers = round ? getEmbersEarned(round, state.meta) : 0;
  const fell = round?.phase === 'fallen';
  const stats = round?.stats || { heartLoss: { falls: 0, heartHits: 0, vents: 0 }, nights: [] };
  const leveled = round ? round.slots.filter(slot => slot.structure?.level >= 2).length : 0;
  state = fell ? collectEmbers(state) : state;
  return { state, nights, embers, seconds, fell, stats, leveled };
}

function spendEmbers(state) {
  let current = state;
  for (const id of META_ORDER) {
    const bought = buyMetaUpgrade(current, id);
    if (bought) current = bought;
  }
  return current;
}

const mean = values => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);
const fmtArc = arc => arc.map(round => round.nights).join('→');

// Tension shape: how much of the round's heart loss lands in its final third?
function finalThirdLossShare(stats) {
  const nights = stats.nights;
  if (nights.length === 0) return 0;
  const total = nights.reduce((sum, night) => sum + night.heartLost, 0);
  if (total === 0) return 0;
  const cut = Math.max(1, Math.ceil(nights.length / 3));
  const late = nights.slice(-cut).reduce((sum, night) => sum + night.heartLost, 0);
  return late / total;
}

// ── Run ─────────────────────────────────────────────────────────────────────
const seedArg = process.argv.indexOf('--seed');
const FIXED_SEEDS = [424242, 133742, 271828, 314159, 861861];
// One fresh random seed every run: the fixed set cannot be overfit, and a
// failure here means real-play variance is too wide. The seed is printed —
// reproduce any failure exactly with --seed N.
const randomSeed = Math.floor(Math.random() * 2147483647);
const assertMode = process.argv.includes('--assert');
const quick = process.argv.includes('--quick');
// --ci: the five fixed seeds only — fully deterministic for the gate. The
// random lane is for local runs, where a failure prints its repro seed.
const ciMode = process.argv.includes('--ci');
const SEEDS = seedArg >= 0 ? [Number(process.argv[seedArg + 1])]
  : ciMode ? FIXED_SEEDS
  : [...FIXED_SEEDS, randomSeed];
// Depth panels must compare against the same seeds the headline means use.
const DEPTH_SEEDS = seedArg >= 0 ? SEEDS : FIXED_SEEDS;

console.log(`Hearthlight playtest | fixed seeds ${FIXED_SEEDS.join(', ')}${seedArg >= 0 ? ` (overridden: ${SEEDS[0]})` : ciMode ? ' | ci' : ` | random seed ${randomSeed}`}\n`);

const collector = emptyCollector();
const perSeed = [];
for (const seed of SEEDS) {
  const result = { seed };
  for (const profile of ['passive', 'builder', 'keeper', 'villager']) {
    result[profile] = playRound(createInitialState(), profile, mulberry32(seed), collector);
  }
  // The meta arc: a keeper plays five rounds, spending Embers between them.
  const rng = mulberry32(seed);
  let state = createInitialState();
  result.arc = [];
  for (let roundIndex = 0; roundIndex < 5; roundIndex++) {
    const outcome = playRound(state, 'keeper', rng, collector);
    state = spendEmbers(outcome.state);
    result.arc.push(outcome);
  }
  result.metaOwned = Object.keys(state.meta).length;
  const replay = playRound(createInitialState(), 'keeper', mulberry32(seed));
  result.deterministic = replay.nights === result.keeper.nights &&
    replay.embers === result.keeper.embers && replay.seconds === result.keeper.seconds;
  result.isRandom = seed === randomSeed && seedArg < 0;
  perSeed.push(result);
  console.log(
    `  seed ${String(seed).padEnd(10)}${result.isRandom ? '*' : ' '}| r1 passive ${String(result.passive.nights).padStart(2)}n` +
    ` villager ${String(result.villager.nights).padStart(2)}n/${result.villager.seconds}s builder ${String(result.builder.nights).padStart(2)}n keeper ${String(result.keeper.nights).padStart(2)}n/${result.keeper.seconds}s` +
    ` | arc ${fmtArc(result.arc)} | meta ${result.metaOwned}/${Object.keys(META_UPGRADES).length}` +
    `${result.deterministic ? '' : ' | DETERMINISM BROKEN'}`);
}

const fixed = perSeed.filter(result => !result.isRandom);
const agg = {
  passiveNights: mean(fixed.map(result => result.passive.nights)),
  keeperNights: mean(fixed.map(result => result.keeper.nights)),
  keeperSeconds: mean(fixed.map(result => result.keeper.seconds)),
  keeperEmbers: mean(fixed.map(result => result.keeper.embers)),
  builderNights: mean(fixed.map(result => result.builder.nights)),
  villagerNights: mean(fixed.map(result => result.villager.nights)),
  villagerSeconds: mean(fixed.map(result => result.villager.seconds)),
  arcFirst: mean(fixed.map(result => result.arc[0].nights)),
  arcLast: mean(fixed.map(result => result.arc[result.arc.length - 1].nights)),
  arcFirstSeconds: mean(fixed.map(result => result.arc[0].seconds)),
  arcLastSeconds: mean(fixed.map(result => result.arc[result.arc.length - 1].seconds)),
  tension: mean(fixed.map(result => finalThirdLossShare(result.keeper.stats))),
  banishesPerNight: mean(fixed.map(result =>
    mean(result.keeper.stats.nights.map(night => night.banished)))),
  arcLeveled: mean(fixed.map(result => Math.max(...result.arc.map(round => round.leveled)))),
};
{
  const losses = fixed.map(result => result.keeper.stats.heartLoss);
  const total = losses.reduce((sum, loss) => sum + loss.falls + loss.heartHits + loss.vents, 0) || 1;
  agg.lossFalls = losses.reduce((sum, loss) => sum + loss.falls, 0) / total;
  agg.lossHeartHits = losses.reduce((sum, loss) => sum + loss.heartHits, 0) / total;
  agg.lossVents = losses.reduce((sum, loss) => sum + loss.vents, 0) / total;
}

console.log(`\n  means: passive ${agg.passiveNights.toFixed(1)}n | villager ${agg.villagerNights.toFixed(1)}n/${Math.round(agg.villagerSeconds)}s | keeper r1 ${agg.keeperNights.toFixed(1)}n/${Math.round(agg.keeperSeconds)}s/${agg.keeperEmbers.toFixed(1)} embers | arc ${agg.arcFirst.toFixed(1)} -> ${agg.arcLast.toFixed(1)}n (${Math.round(agg.arcFirstSeconds)}s -> ${Math.round(agg.arcLastSeconds)}s)`);
console.log(`  fun: final-third loss share ${(agg.tension * 100).toFixed(0)}% | warden banishes/night ${agg.banishesPerNight.toFixed(1)} | deaths from falls ${(agg.lossFalls * 100).toFixed(0)}% / heart ${(agg.lossHeartHits * 100).toFixed(0)}% / vents ${(agg.lossVents * 100).toFixed(0)}% | leveled structures per arc-best ${agg.arcLeveled.toFixed(1)}`);

// ── Depth panels (skipped with --quick) ─────────────────────────────────────
let depth = null;
if (!quick) {
  depth = { ablations: {}, ablationRuns: {}, metaValue: {} };
  for (const profile of ['randomPlace', 'economyGreedy', 'defenseGreedy', 'bunker']) {
    depth.ablationRuns[profile] = DEPTH_SEEDS.map(seed =>
      playRound(createInitialState(), profile, mulberry32(seed), collector));
    depth.ablations[profile] = mean(depth.ablationRuns[profile].map(run => run.nights));
  }
  console.log(`\n  depth: keeper ${agg.keeperNights.toFixed(1)}n vs randomPlace ${depth.ablations.randomPlace.toFixed(1)}n | economyGreedy ${depth.ablations.economyGreedy.toFixed(1)}n | defenseGreedy ${depth.ablations.defenseGreedy.toFixed(1)}n | bunker ${depth.ablations.bunker.toFixed(1)}n`);

  const baseline = mean(DEPTH_SEEDS.map(seed =>
    playRound(createInitialState(), 'keeper', mulberry32(seed)).nights));
  for (const id of Object.keys(META_UPGRADES)) {
    const withUpgrade = mean(DEPTH_SEEDS.map(seed =>
      playRound({ ...createInitialState(), meta: { [id]: true } }, 'keeper', mulberry32(seed)).nights));
    depth.metaValue[id] = withUpgrade - baseline;
  }
  console.log(`  meta value (Δn vs bare keeper): ${Object.entries(depth.metaValue).map(([id, delta]) => `${id} ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`).join(' | ')}`);
  console.log(`  picks: ${STRUCTURE_IDS.map(id => `${id} ${collector.picks[id] || 0}`).join(' | ')}`);
  depth.picks = { ...collector.picks };
}

// ── Assertions ──────────────────────────────────────────────────────────────
if (assertMode) {
  const issues = [];
  for (const result of perSeed) {
    const tag = `seed ${result.seed}:`;
    if (!result.deterministic) issues.push(`${tag} same seed produced different rounds`);
    if (!result.passive.fell) issues.push(`${tag} a do-nothing round never ends`);
    if (result.passive.embers < 1) issues.push(`${tag} a fall paid nothing`);
    if (!result.keeper.fell) issues.push(`${tag} the wall never won against the keeper`);
    if (!result.villager.fell) issues.push(`${tag} the wall never won against the villager`);
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
  if (agg.arcLast <= agg.arcFirst) issues.push(`meta does not lengthen runs on the mean (${agg.arcFirst.toFixed(1)} -> ${agg.arcLast.toFixed(1)})`);
  if (agg.arcLastSeconds <= agg.arcFirstSeconds) issues.push('later rounds are not longer in real time on the mean');
  if (agg.keeperNights - agg.builderNights < 1) issues.push(`night play barely matters (keeper ${agg.keeperNights.toFixed(1)} vs builder ${agg.builderNights.toFixed(1)})`);
  // First-play band, measured directly on the median-human model.
  if (agg.villagerSeconds < 45 || agg.villagerSeconds > 150) issues.push(`villager first play ${Math.round(agg.villagerSeconds)}s outside the 45-150s (one-to-two minute) band`);
  if (agg.villagerNights < 2) issues.push(`villager dies before night 2 (${agg.villagerNights.toFixed(1)})`);
  if (agg.keeperNights <= agg.villagerNights) issues.push('skill ceiling invisible: keeper does not beat villager');

  if (depth) {
    if (agg.keeperNights - depth.ablations.randomPlace < 1) {
      issues.push(`placement is fake choice: keeper ${agg.keeperNights.toFixed(1)}n vs random placement ${depth.ablations.randomPlace.toFixed(1)}n`);
    }
    // The immortality guard: a two-structure turtle must always fall, and
    // turtling must never beat building the town out.
    for (const run of depth.ablationRuns.bunker) {
      if (!run.fell) issues.push('IMMORTAL BUNKER: a two-structure turtle never falls');
    }
    if (depth.ablations.bunker > agg.keeperNights) {
      issues.push(`turtling beats building: bunker ${depth.ablations.bunker.toFixed(1)}n vs keeper ${agg.keeperNights.toFixed(1)}n`);
    }
    for (const [id, delta] of Object.entries(depth.metaValue)) {
      if (delta < -0.5) issues.push(`meta trap: ${id} makes runs shorter (${delta.toFixed(1)}n)`);
    }
    if (!Object.values(depth.metaValue).some(delta => delta >= 0.5)) {
      issues.push('no meta upgrade meaningfully lengthens a bare run');
    }
    for (const id of STRUCTURE_IDS) {
      if (!collector.picks[id]) issues.push(`dead card: ${id} was never picked by any profile on any seed`);
    }
  }

  console.log('\n── Assertions ──');
  if (issues.length > 0) {
    for (const issue of issues) console.log(`  ✗ ${issue}`);
    process.exit(1);
  }
  console.log('  ✓ all loop promises hold on every seed');
}
