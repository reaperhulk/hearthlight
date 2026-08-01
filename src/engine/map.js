// The town map: radial slots in rings around the Heart (0.5, 0.5).
// No roads, no zoning — every slot is a placement decision.

// A town you can keep building. Six slots filled up in two days once the
// day became a hand rather than a single act, and a full map is a dead
// day — the back half of every round had nothing to decide. The inner
// keep is bigger and the frontier bigger still, so the map is somewhere
// you are still shaping when the dark finally wins.
// Three rings, two of them open from the first dusk. A day is a hand now,
// so a nine-slot town fills by day four and every day after it is dead
// air — the exact failure the old six-slot map had at day six. The town
// has to be somewhere you are STILL shaping when the dark finally wins.
export const RINGS = [
  { radius: 0.18, slots: 9 },
  { radius: 0.31, slots: 13 },
  { radius: 0.43, slots: 15 },
];

export function createSlots(unlockedRings = 1) {
  const slots = [];
  for (let ring = 0; ring < Math.min(unlockedRings, RINGS.length); ring++) {
    const { radius, slots: count } = RINGS[ring];
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2 + ring * 0.3;
      slots.push({
        id: `r${ring}s${index}`,
        ring,
        index,
        x: 0.5 + Math.cos(angle) * radius,
        y: 0.5 + Math.sin(angle) * radius,
        structure: null,
      });
    }
  }
  return slots;
}

export const ADJACENT_DISTANCE = 0.23;

// Slots close enough to the Heart (the map center) to defend it.
export function nearHeart(slot) {
  return Math.hypot(slot.x - 0.5, slot.y - 0.5) <= ADJACENT_DISTANCE;
}

export function slotsAdjacent(a, b) {
  if (a.id === b.id) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) <= ADJACENT_DISTANCE;
}

export function getAdjacentSlots(slots, slotId) {
  const slot = slots.find(candidate => candidate.id === slotId);
  if (!slot) return [];
  return slots.filter(candidate => slotsAdjacent(slot, candidate));
}
