// Shared rules and scenario data. UI descriptions are derived from these values.
export const BUILDINGS = {
  farm: { name: 'Farm', cost: 14, hp: 22, income: 12, color: '#a8c779', icon: '✿', description: 'Grow your next dawn’s building budget.', branches: {
    harvest: { name: 'Golden harvest', cost: 20, detail: '+14 Glow every dawn.' },
    supplies: { name: 'Village supplies', cost: 18, detail: 'Repair every building on this road by 16 each dawn.' },
  } },
  wall: { name: 'Timber wall', cost: 12, hp: 65, color: '#c6a07a', icon: '▥', description: 'Stops enemies until they break through.', branches: {
    stone: { name: 'Stone rampart', cost: 22, detail: '+70 maximum health. Rebuilt at full strength.' },
    thorns: { name: 'Thorn barricade', cost: 18, detail: 'Returns 4 damage and briefly stuns each attacker.' },
  } },
  tower: { name: 'Watchtower', cost: 20, hp: 32, range: 0.235, damage: 5, interval: 1.6, color: '#e6ba70', icon: '♜', description: 'Shoots enemies in range, including its attackers.', branches: {
    pierce: { name: 'Sunlance', cost: 24, detail: 'Shots deal 10 damage and ignore mist protection.' },
    volley: { name: 'Scattershot', cost: 24, detail: 'Hits up to 3 nearby enemies for 5 damage each.' },
  } },
  lantern: { name: 'Lantern', cost: 16, hp: 25, range: 0.245, color: '#92d8c6', icon: '◇', description: 'Slows nearby enemies by 30%. The Warden hits harder in its light.', branches: {
    reach: { name: 'Far lantern', cost: 20, detail: 'A wider field, slowing enemies by 50%.' },
    courage: { name: 'Keeper’s flame', cost: 20, detail: 'The Warden deals 6 extra damage in its light.' },
  } },
};

export const ENEMIES = {
  shade: { name: 'Shade', hp: 16, speed: 0.047, damage: 6, interval: 1.8, color: '#a79cc6', description: 'Follows the road and attacks what stands in its way.' },
  brute: { name: 'Hollow giant', hp: 64, speed: 0.029, damage: 18, interval: 3.2, color: '#c88798', description: 'Slow and tough. A long windup precedes its heavy strike.' },
  runner: { name: 'Skitter', hp: 11, speed: 0.079, damage: 4, interval: 1.25, color: '#dcc18c', description: 'Fast, fragile, and dangerous on an unguarded road.' },
  mist: { name: 'Veil bearer', hp: 30, speed: 0.038, damage: 5, interval: 2.1, color: '#8dbcbf', description: 'Nearby enemies take 35% less tower damage. Burst interrupts its veil.' },
};

export const TOWNS = {
  first: { name: 'The First Fire', subtitle: 'Learn to keep a little light alive.', nights: 3, income: 28, start: 62, reward: 8, theme: 'meadow', requires: null },
  meadow: { name: 'Briar Hollow', subtitle: 'Three roads. Six nights. One village to save.', nights: 6, income: 27, start: 62, reward: 18, theme: 'meadow', requires: 'first' },
  marsh: { name: 'The Sunken Crossing', subtitle: 'Winding roads, swift feet, and lights in the mist.', nights: 6, income: 29, start: 66, reward: 22, theme: 'marsh', requires: 'meadow' },
  ridge: { name: 'Cinder Ridge', subtitle: 'Hold four approaches against the hollow giants.', nights: 6, income: 32, start: 78, reward: 26, theme: 'ridge', requires: 'marsh' },
};

export const KITS = {
  keeper: { name: 'Hearthkeeper', cost: 0, detail: 'A balanced beginning. Two lantern bursts each night.' },
  mason: { name: 'Stone & timber', cost: 8, detail: 'Walls have 25 extra health. Repairs cost 2 less Glow.' },
  ranger: { name: 'The wandering light', cost: 12, detail: 'The Warden moves 40% faster and hits for 2 more damage.' },
  gardener: { name: 'Seeds of tomorrow', cost: 12, detail: 'Start with 10 more Glow. Farms produce 5 extra at dawn.' },
};

export const BLESSINGS = {
  kindle: { name: 'Wildfire', detail: 'Lantern bursts also burn enemies for 12 damage over 3 seconds.' },
  chain: { name: 'Kindred light', detail: 'The Warden’s strike jumps to one nearby enemy while standing in lantern light.' },
  shelter: { name: 'Sheltering hands', detail: 'Every surviving building recovers 10 health at dawn.' },
  reserves: { name: 'A spark in reserve', detail: 'One extra lantern burst each night.' },
  salvage: { name: 'What remains', detail: 'Broken buildings return half their original Glow cost.' },
  watch: { name: 'The patient watch', detail: 'Towers shoot 20% faster.' },
};

export function createMap(town = 'first') {
  const angles = town === 'ridge' ? [-Math.PI / 2, 0, Math.PI / 2, Math.PI] : [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
  const names = town === 'ridge' ? ['North gate', 'East ridge', 'South pass', 'West road'] : ['North road', 'River road', 'Orchard road'];
  const lanes = angles.map((angle, id) => ({ id, name: names[id], angle }));
  const slots = lanes.flatMap(lane => [0.30, 0.48, 0.64, 0.79].map((progress, index) => {
    const p = routePoint(lane, progress, town);
    const offset = index === 0 ? 0 : (index % 2 ? 1 : -1) * 0.062;
    return { id: `${lane.id}-${index}`, lane: lane.id, index, progress, x: p.x + Math.cos(lane.angle + Math.PI / 2) * offset, y: p.y + Math.sin(lane.angle + Math.PI / 2) * offset, building: null };
  }));
  return { lanes, slots };
}

export function routePoint(lane, progress, town) {
  const radius = 0.475 - Math.max(0, Math.min(1, progress)) * 0.405;
  const curve = town === 'marsh' ? Math.sin(progress * Math.PI) * 0.05 : 0;
  return { x: 0.5 + Math.cos(lane.angle) * radius + Math.cos(lane.angle + Math.PI / 2) * curve, y: 0.50 + Math.sin(lane.angle) * radius + Math.sin(lane.angle + Math.PI / 2) * curve };
}

// Wave RNG is a pure function of seed, scenario and night, independent of commands.
export function randomSequence(seed) {
  let n = seed >>> 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
}

export function makeWave(town, night, seed) {
  const count = town === 'first' && night <= 3 ? [3, 6, 9][night - 1] : Math.min(120, 5 + night * 3 + (town === 'ridge' ? 3 : 0));
  const lanes = createMap(town).lanes;
  const rng = randomSequence(seed + night * 7919 + Object.keys(TOWNS).indexOf(town) * 433);
  const enabled = town === 'first' ? Math.min(night, lanes.length) : lanes.length;
  return Array.from({ length: count }, (_, index) => {
    let type = 'shade';
    if (night >= 3 && index % 7 === 6) type = 'brute';
    if (town !== 'first' && night >= 2 && index % 5 === 3) type = 'runner';
    if (town !== 'first' && night >= 4 && index % 9 === 5) type = 'mist';
    if (town === 'ridge' && index % 6 === 5) type = 'brute';
    if (town === 'marsh' && index % 5 === 2) type = 'runner';
    return { id: `${night}-${index}`, type, lane: index < enabled ? index : Math.floor(rng() * enabled), at: 2 + index * (town === 'first' ? 2.5 : 1.65) + Math.round(rng() * 5) / 10 };
  });
}
