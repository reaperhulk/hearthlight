import { pathToFileURL } from 'node:url';
import { advance, command, dawnIncome, freshGame, startGame, maxHp, repairCost } from '../src/engine/campaign.js';
import { BUILDINGS, createMap, TOWNS } from '../src/engine/content.js';

// Transparent heuristics, not claims about optimal play or a median human.
export function planDay(state, style = 'fortress') {
  let s = state;
  const act = action => { s = command(s, action); };
  if (s.round.offers.length) act({ type: 'blessing', id: s.round.offers.find(id => style === 'warden' ? ['chain', 'reserves', 'kindle'].includes(id) : ['shelter', 'watch'].includes(id)) || s.round.offers[0] });
  if (style === 'passive') return command(s, { type: 'start' });
  const lanes = createMap(s.round.town).lanes;
  const threatened = lanes.filter(l => s.round.wave.some(e => e.lane === l.id));
  for (const lane of threatened) {
    if (!s.round.slots.find(p => p.id === `${lane.id}-1`).building) act({ type: 'build', slot: `${lane.id}-1`, building: 'tower' });
    if (!s.round.slots.find(p => p.id === `${lane.id}-0`).building) act({ type: 'build', slot: `${lane.id}-0`, building: 'wall' });
  }
  for (const slot of s.round.slots) if (slot.building && slot.building.hp < maxHp(slot.building, s.round.kit) * 0.7 && s.round.glow >= repairCost(s.round)) act({ type: 'repair', slot: slot.id });
  if (s.round.night < 4) for (const lane of lanes) {
    const id = `${lane.id}-2`;
    if (!s.round.slots.find(p => p.id === id).building && s.round.glow >= 14) { act({ type: 'build', slot: id, building: 'farm' }); break; }
  }
  for (const lane of threatened) {
    const id = `${lane.id}-3`;
    if (!s.round.slots.find(p => p.id === id).building && s.round.glow >= (style === 'warden' ? 16 : 36)) act({ type: 'build', slot: id, building: 'lantern' });
  }
  for (const slot of s.round.slots) if (slot.building && !slot.building.branch && s.round.glow >= 24) {
    const branch = slot.building.type === 'tower' ? (style === 'volley' ? 'volley' : 'pierce') : slot.building.type === 'wall' ? 'stone' : slot.building.type === 'farm' ? 'harvest' : 'courage';
    act({ type: 'upgrade', slot: slot.id, branch });
  }
  return command(s, { type: 'start' });
}

export function nightAction(state, style) {
  let s = state;
  if (style === 'passive' || style === 'builder' || !s.round.enemies.length) return s;
  const threats = [...s.round.enemies].sort((a, b) => b.progress - a.progress);
  const urgent = threats[0];
  s = command(s, { type: 'rally', lane: urgent.lane, progress: Math.max(0.3, urgent.progress + 0.04) });
  const count = s.round.enemies.filter(e => e.lane === urgent.lane && e.hp > 0).length;
  if (urgent.progress > 0.8 || count >= 3 || (urgent.type === 'brute' && urgent.progress > 0.3)) s = command(s, { type: 'burst', lane: urgent.lane });
  return s;
}

export function playCampaign(town = 'first', seed = 42, style = 'fortress', kit = 'keeper', endless = false, limit = 1200) {
  let state = freshGame(); state.wins = { first: 1, meadow: 1, marsh: 1 }; state.kit = kit;
  state = startGame(state, town, seed, endless);
  let elapsed = 0, iteration = 0;
  while (['day', 'night'].includes(state.round.phase) && elapsed < limit) {
    if (state.round.phase === 'day') state = planDay(state, style);
    if (iteration % 10 === 0) state = nightAction(state, style);
    state = advance(state, 0.1); elapsed += 0.1; iteration++;
  }
  return { town, seed, style, kit, outcome: state.round.phase, nights: state.round.completed, seconds: Math.round(elapsed), heart: state.round.heart, income: dawnIncome(state.round), kills: state.round.stats.kills, state };
}

export function campaignReport(seeds = [42, 1337, 271828, 314159, 861861]) {
  return Object.keys(TOWNS).flatMap(town => ['fortress', 'volley', 'warden', 'builder', 'passive'].flatMap(style => seeds.map(seed => {
    const { state: _, ...result } = playCampaign(town, seed, style);
    return result;
  })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = campaignReport();
  for (const town of Object.keys(TOWNS)) for (const style of ['fortress', 'volley', 'warden', 'builder', 'passive']) {
    const group = results.filter(r => r.town === town && r.style === style);
    console.log(`${town.padEnd(7)} ${style.padEnd(8)} ${group.filter(r => r.outcome === 'won').length}/${group.length} wins; ${Math.round(group.reduce((sum, r) => sum + r.seconds, 0) / group.length)}s; ${Math.round(group.reduce((sum, r) => sum + r.heart, 0) / group.length)} Heart`);
  }
  if (results.some(r => !['won', 'lost'].includes(r.outcome))) throw new Error('A campaign failed to finish');
  if (results.filter(r => r.town === 'first' && ['fortress', 'volley', 'warden'].includes(r.style)).some(r => r.outcome !== 'won')) throw new Error('The introduction must be winnable by all supported strategies');
  if (results.filter(r => r.style === 'passive').some(r => r.outcome === 'won')) throw new Error('No-action play unexpectedly won');
}
