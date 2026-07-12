// What one occupied slot is worth right now — the tap-to-inspect readout.
import { getAdjacentSlots } from '../engine/map.js';
import { STRUCTURES } from '../engine/structures.js';
import { levelGlowMult, DAWN_GLOW_PER_STRUCTURE, FRONTIER_YIELD, LEVEL_UP_NIGHTS, LEVEL_UP_NIGHTS_VETERAN } from '../engine/round.js';

export function describeSlot(round, slot) {
  const structure = slot.structure;
  const def = STRUCTURES[structure.type];
  const levelMult = levelGlowMult(structure.level) * (slot.ring > 0 ? FRONTIER_YIELD : 1);
  const neighbors = getAdjacentSlots(round.slots, slot.id).filter(neighbor => neighbor.structure);
  const rows = [];
  rows.push(['Toughness', `${structure.hp} bite${structure.hp === 1 ? '' : 's'}`]);
  if (def.glowPerSecond) rows.push(['Glow', `${(def.glowPerSecond * levelMult).toFixed(1)}/s`]);
  if (slot.ring > 0) rows.push(['Frontier', 'richer ground — the dark arrives sooner']);
  if (def.adjacencyBonus) {
    const boosted = neighbors.filter(neighbor => def.adjacencyBonus[neighbor.structure.type]);
    rows.push(['Boosting', boosted.length > 0
      ? boosted.map(neighbor => `${STRUCTURES[neighbor.structure.type].name} +${(def.adjacencyBonus[neighbor.structure.type] * levelMult).toFixed(1)}/s`).join(', ')
      : 'nothing adjacent yet']);
  }
  const watered = neighbors.reduce((sum, neighbor) => {
    const giving = STRUCTURES[neighbor.structure.type].dawnAdjacency;
    return sum + (giving?.[structure.type] || 0);
  }, 0);
  rows.push(['At dawn', `+${DAWN_GLOW_PER_STRUCTURE + (def.dawnGlow || 0) + watered} Glow${watered > 0 ? ' (watered)' : ''}`]);
  if (def.dawnAdjacency) rows.push(['Waters', 'adjacent Granaries +3 Glow at dawn']);
  if (def.slowsAdjacent) {
    rows.push(['Slows', `shades on lit neighbors ×${def.slowsAdjacent}`]);
    rows.push(['Lamplight', 'the Warden banishes 40% faster on lit ground']);
  }
  if (def.nightCharges) {
    rows.push(['Banishes', `${def.nightCharges + (structure.level >= 3 ? 1 : 0)} shades/night on neighbors`]);
    rows.push(['Blind spot', 'cannot save itself']);
    if (structure.level >= 3) rows.push(['In the mist', 'a veteran lamp keeps one bolt on Veiled Nights']);
  }
  if (def.nightDelay) rows.push(['Toll', `every shade +${def.nightDelay}s approach; Warden repositions 1s sooner`]);
  if (def.tauntWeight) rows.push(['Taunt', 'draws shades to itself']);
  // Payout cards show their CURRENT worth, so banking Glow and keeping
  // neighbors alive are visible strategies, not fall-screen surprises.
  if (structure.type === 'emberKiln') {
    const banked = Math.min(6, Math.floor(round.glow / 20));
    rows.push(['At the fall', `+${banked} Ember${banked === 1 ? '' : 's'} from banked Glow (cap 6)`]);
  }
  if (structure.type === 'shrine') {
    rows.push(['At the fall', `+${2 + neighbors.length} Embers (2 + ${neighbors.length} standing neighbor${neighbors.length === 1 ? '' : 's'})`]);
  }
  rows.push(['Neighbors', neighbors.length > 0
    ? neighbors.map(neighbor => STRUCTURES[neighbor.structure.type].name).join(', ')
    : 'none']);
  const nightsTo = target => Math.max(0, target - structure.nightsSurvived);
  const levelLine = structure.level >= 3
    ? `Level 3 veteran — glow ×2, +2 toughness${structure.type === 'watchtower' ? ', +1 banish/night' : ''}`
    : structure.level >= 2
    ? `Level 2 — glow ×1.5; veteran in ${nightsTo(LEVEL_UP_NIGHTS_VETERAN)} night${nightsTo(LEVEL_UP_NIGHTS_VETERAN) === 1 ? '' : 's'}`
    : `Level 1 — levels up in ${nightsTo(LEVEL_UP_NIGHTS)} more night${nightsTo(LEVEL_UP_NIGHTS) === 1 ? '' : 's'}`;
  return { name: def.name, levelLine, rows };
}
