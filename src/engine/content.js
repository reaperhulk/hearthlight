import {
  routePoint as legacyRoute,
  createMap as legacyMap,
} from "./legacy-v2/content.js";
import { encounterFor } from "./encounters.js";
export { encounterFor } from "./encounters.js";
// Shared rules and scenario data. UI descriptions are derived from these values.
export const BUILDINGS = {
  farm: {
    name: "Farm",
    cost: 14,
    hp: 22,
    income: 12,
    color: "#a8c779",
    icon: "✿",
    description: "Grow your next dawn’s building budget.",
    branches: {
      harvest: {
        name: "Golden harvest",
        cost: 20,
        detail: "+14 Glow every dawn.",
      },
      supplies: {
        name: "Village supplies",
        cost: 18,
        detail: "Repair every building on this road by 16 each dawn.",
      },
    },
  },
  wall: {
    name: "Timber wall",
    cost: 12,
    hp: 65,
    color: "#c6a07a",
    icon: "▥",
    description: "Stops enemies until they break through.",
    branches: {
      stone: {
        name: "Stone rampart",
        cost: 22,
        detail: "+70 maximum health. Rebuilt at full strength.",
      },
      thorns: {
        name: "Thorn barricade",
        cost: 18,
        detail: "Returns 4 damage and briefly stuns each attacker.",
      },
    },
  },
  tower: {
    name: "Watchtower",
    cost: 20,
    hp: 32,
    range: 0.235,
    damage: 5,
    interval: 1.6,
    color: "#e6ba70",
    icon: "♜",
    description: "Shoots enemies in range, including its attackers.",
    branches: {
      pierce: {
        name: "Sunlance",
        cost: 24,
        detail: "Shots deal 10 damage and ignore mist protection.",
      },
      volley: {
        name: "Scattershot",
        cost: 24,
        detail: "Hits up to 3 nearby enemies for 5 damage each.",
      },
    },
  },
  lantern: {
    name: "Lantern",
    cost: 16,
    hp: 25,
    range: 0.245,
    color: "#92d8c6",
    icon: "◇",
    description:
      "Slows nearby enemies by 30%. The Warden hits harder in its light.",
    branches: {
      reach: {
        name: "Far lantern",
        cost: 20,
        detail: "A wider field, slowing enemies by 50%.",
      },
      courage: {
        name: "Keeper’s flame",
        cost: 20,
        detail: "The Warden deals 6 extra damage in its light.",
      },
    },
  },
};

export const ENEMIES = {
  king: {
    name: "Antlered king",
    hp: 150,
    speed: 0.023,
    damage: 22,
    interval: 3.6,
    color: "#b5a3bf",
    description:
      "A crowned giant. Below half health it strikes faster. Flare the bright windup to interrupt it.",
  },
  shade: {
    name: "Shade",
    hp: 16,
    speed: 0.047,
    damage: 6,
    interval: 1.8,
    color: "#a79cc6",
    description: "Follows the road and attacks what stands in its way.",
  },
  brute: {
    name: "Hollow giant",
    hp: 64,
    speed: 0.029,
    damage: 18,
    interval: 3.2,
    color: "#c88798",
    description: "Slow and tough. A long windup precedes its heavy strike.",
  },
  runner: {
    name: "Skitter",
    hp: 11,
    speed: 0.079,
    damage: 4,
    interval: 1.25,
    color: "#dcc18c",
    description:
      "Fast raiders. Leave the road to attack one farm, then return toward the Hearth.",
  },
  mist: {
    name: "Veil bearer",
    hp: 30,
    speed: 0.038,
    damage: 5,
    interval: 2.1,
    color: "#8dbcbf",
    description:
      "Nearby enemies take 35% less tower damage. A Hearth flare interrupts its veil.",
  },
};

export const TOWNS = {
  first: {
    name: "The First Fire",
    subtitle: "Learn to keep a little light alive.",
    nights: 3,
    income: 28,
    start: 62,
    reward: 8,
    theme: "meadow",
    requires: null,
  },
  meadow: {
    name: "Briar Hollow",
    subtitle: "Three roads. Six nights. One village to save.",
    nights: 6,
    income: 27,
    start: 62,
    reward: 18,
    theme: "meadow",
    requires: "first",
  },
  marsh: {
    name: "The Sunken Crossing",
    subtitle: "Winding roads, swift feet, and lights in the mist.",
    nights: 6,
    income: 29,
    start: 66,
    reward: 22,
    theme: "marsh",
    requires: "meadow",
  },
  ridge: {
    name: "Cinder Ridge",
    subtitle: "Hold four approaches against the hollow giants.",
    nights: 6,
    income: 32,
    start: 78,
    reward: 26,
    theme: "ridge",
    requires: "marsh",
  },
};

export const KITS = {
  keeper: {
    name: "Hearthkeeper",
    cost: 0,
    detail:
      "A balanced beginning. Three Hearth flares each night. Flexible emergency support.",
  },
  mason: {
    name: "Stone & timber",
    cost: 8,
    detail:
      "Walls have 25 extra health; repairs cost 2 less. Start with 8 less Glow and two flares.",
  },
  ranger: {
    name: "The wandering light",
    cost: 12,
    detail:
      "The Warden moves 40% faster and hits for 2 more damage. Towers cost 4 extra Glow; two flares.",
  },
  gardener: {
    name: "Seeds of tomorrow",
    cost: 12,
    detail:
      "Farms produce 5 extra Glow at dawn. Start with 6 less Glow and two flares.",
  },
};

export const BLESSINGS = {
  kindle: {
    name: "Wildfire",
    detail: "Hearth flares also burn enemies for 12 damage over 3 seconds.",
  },
  chain: {
    name: "Kindred light",
    detail:
      "The Warden’s strike jumps to one nearby enemy while standing in lantern light.",
  },
  shelter: {
    name: "Sheltering hands",
    detail: "Every surviving building recovers 10 health at dawn.",
  },
  reserves: {
    name: "A spark in reserve",
    detail: "One extra Hearth flare each night.",
  },
  salvage: {
    name: "What remains",
    detail: "Broken buildings return half their original Glow cost.",
  },
  watch: {
    name: "The patient watch",
    detail: "Tower shot cooldowns are 20% shorter.",
  },
};

const laneCache = new Map();
export function mapLanes(town = "first") {
  if (laneCache.has(town)) return laneCache.get(town);
  const angles =
    town === "ridge"
      ? [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
      : [-Math.PI / 2, Math.PI / 6, (Math.PI * 5) / 6];
  const names =
    town === "ridge"
      ? ["North gate", "East ridge", "South pass", "West road"]
      : ["North road", "River road", "Orchard road"];
  const lanes = Object.freeze(
    angles.map((angle, id) => Object.freeze({ id, name: names[id], angle })),
  );
  laneCache.set(town, lanes);
  return lanes;
}

// Curated roads create chokes, overlapping inner coverage and exposed sites.
export const ROUTES = {
  meadow: [
    [
      [0.5, 0.025],
      [0.5, 0.24],
      [0.42, 0.34],
      [0.5, 0.43],
    ],
    [
      [0.97, 0.7],
      [0.79, 0.62],
      [0.65, 0.63],
      [0.57, 0.54],
    ],
    [
      [0.035, 0.74],
      [0.23, 0.67],
      [0.3, 0.5],
      [0.43, 0.52],
    ],
  ],
  marsh: [
    [
      [0.43, 0.025],
      [0.43, 0.18],
      [0.25, 0.25],
      [0.29, 0.38],
      [0.5, 0.43],
    ],
    [
      [0.97, 0.63],
      [0.81, 0.51],
      [0.7, 0.51],
      [0.57, 0.49],
    ],
    [
      [0.07, 0.88],
      [0.21, 0.71],
      [0.42, 0.74],
      [0.51, 0.61],
      [0.48, 0.57],
    ],
  ],
  ridge: [
    [
      [0.5, 0.025],
      [0.47, 0.2],
      [0.5, 0.43],
    ],
    [
      [0.975, 0.45],
      [0.81, 0.38],
      [0.66, 0.48],
      [0.57, 0.49],
    ],
    [
      [0.58, 0.975],
      [0.63, 0.76],
      [0.53, 0.65],
      [0.51, 0.57],
    ],
    [
      [0.025, 0.57],
      [0.2, 0.64],
      [0.32, 0.52],
      [0.43, 0.51],
    ],
  ],
};
const roads = new Map();
const customRoads = new WeakMap();
function routeData(town, lane, layout = null) {
  if (layout) {
    if (!customRoads.has(layout)) customRoads.set(layout, new Map());
    const cache = customRoads.get(layout);
    if (cache.has(lane)) return cache.get(lane);
    const points = layout.routes[lane];
    const segments = points
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
    const result = {
      points,
      segments,
      length: segments.reduce((a, b) => a + b, 0),
    };
    cache.set(lane, result);
    return result;
  }
  const key = `${town}:${lane}`;
  if (roads.has(key)) return roads.get(key);
  const points = ROUTES[town]?.[lane];
  if (!points) return null;
  const segments = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const data = {
    points,
    segments,
    length: segments.reduce((a, b) => a + b, 0),
  };
  roads.set(key, data);
  return data;
}
export function routeLength(town, lane, layout = null) {
  return routeData(town, lane, layout)?.length || 0.405;
}
export function routePoint(lane, progress, town, rules = 4, layout = null) {
  if (rules < 4 || (!ROUTES[town] && !layout))
    return legacyRoute(lane, progress, town);
  const { points, segments, length } = routeData(town, lane.id, layout);
  let remaining = Math.max(0, Math.min(1, progress)) * length;
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= segments[i] || i === segments.length - 1) {
      const f = Math.min(1, remaining / segments[i]);
      return {
        x: points[i][0] + (points[i + 1][0] - points[i][0]) * f,
        y: points[i][1] + (points[i + 1][1] - points[i][1]) * f,
      };
    }
    remaining -= segments[i];
  }
}
const sites = ["Gate", "Watch rise", "Mill garden", "Hearth overlook"];
export function createMap(town = "first", rules = 4, layout = null) {
  if (layout)
    return {
      lanes: mapLanes(town),
      slots: layout.slots.map((s) => ({ ...s, building: null })),
    };
  if (rules < 4 || town === "first") return legacyMap(town);
  const lanes = mapLanes(town);
  const offsets =
    town === "ridge" ? [0, 0.065, -0.07, 0.065] : [0, 0.065, -0.075, 0.065];
  const slots = lanes.flatMap((lane) =>
    [0.3, 0.47, 0.64, 0.81].map((progress, index) => {
      if (
        index === 2 &&
        (lane.id === 1 ||
          (town !== "meadow" && lane.id === (town === "ridge" ? 3 : 2)))
      )
        progress = 0.23;
      const p = routePoint(lane, progress, town),
        ahead = routePoint(lane, Math.min(0.99, progress + 0.015), town);
      const angle = Math.atan2(ahead.y - p.y, ahead.x - p.x) + Math.PI / 2;
      return {
        id: `${lane.id}-${index}`,
        lane: lane.id,
        index,
        progress,
        x: p.x + Math.cos(angle) * offsets[index],
        y: p.y + Math.sin(angle) * offsets[index],
        site: sites[index],
        building: null,
      };
    }),
  );
  return { lanes, slots };
}
export function buildCost(type, kit, rules = 4) {
  return (
    BUILDINGS[type].cost +
    (rules >= 4 && type === "tower" && kit === "ranger" ? 4 : 0)
  );
}
export function startingGlow(town, kit) {
  return (
    TOWNS[town].start -
    (kit === "mason" ? 8 : kit === "gardener" ? 6 : 0) -
    (town === "first" ? 14 : 0)
  );
}
export function flareCharges(kit) {
  return kit === "keeper" ? 3 : 2;
}

// Wave RNG is a pure function of seed, scenario and night, independent of commands.
export function randomSequence(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

export function makeWave(town, night, seed) {
  const definition = encounterFor(town, night);
  const rng = randomSequence(
    seed + night * 7919 + Object.keys(TOWNS).indexOf(town) * 433,
  );
  const cycle = Math.floor((night - 1) / (town === "first" ? 3 : 6));
  let serial = 0;
  return definition.groups
    .flatMap(([at, lane, type, count, spacing]) =>
      Array.from({ length: count + Math.min(5, cycle) }, (_, j) => ({
        id: `${night}-${serial++}`,
        type,
        lane,
        at: Math.max(
          2,
          Math.round((at + j * spacing + (rng() - 0.5) * 0.35) * 20) / 20,
        ),
        assault: definition.finale && at >= 30 ? 2 : 1,
      })),
    )
    .sort((a, b) => a.at - b.at)
    .slice(0, 120);
}

// Custom layouts are bounded data used only by the local encounter workbench.
export function validLayout(layout, town) {
  if (layout == null) return true;
  const lanes = mapLanes(town);
  if (
    !Array.isArray(layout.routes) ||
    layout.routes.length !== lanes.length ||
    !Array.isArray(layout.slots) ||
    layout.slots.length !== lanes.length * 4
  )
    return false;
  if (
    layout.routes.some(
      (points) =>
        !Array.isArray(points) ||
        points.length < 2 ||
        points.length > 8 ||
        points.some(
          (p) =>
            !Array.isArray(p) ||
            p.length !== 2 ||
            p.some((n) => !Number.isFinite(n) || n < 0.01 || n > 0.99),
        ) ||
        points.some(
          (p, i) =>
            i > 0 &&
            Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) <
              0.001,
        ) ||
        Math.hypot(points.at(-1)[0] - 0.5, points.at(-1)[1] - 0.5) > 0.16,
    )
  )
    return false;
  if (
    layout.routes.some(
      (_, i) =>
        routeLength(town, i, layout) < 0.1 || routeLength(town, i, layout) > 3,
    )
  )
    return false;
  return layout.slots.every(
    (s, i) =>
      s &&
      s.id === `${Math.floor(i / 4)}-${i % 4}` &&
      s.lane === Math.floor(i / 4) &&
      s.index === i % 4 &&
      [s.x, s.y, s.progress].every(
        (n) => Number.isFinite(n) && n >= 0.03 && n <= 0.97,
      ),
  );
}
export function validGroups(groups, town) {
  return (
    Array.isArray(groups) &&
    groups.length > 0 &&
    groups.length <= 20 &&
    groups.every(
      (g) =>
        Array.isArray(g) &&
        g.length === 5 &&
        Number.isFinite(g[0]) &&
        g[0] >= 2 &&
        g[0] <= 300 &&
        Number.isInteger(g[1]) &&
        g[1] >= 0 &&
        g[1] < mapLanes(town).length &&
        Object.hasOwn(ENEMIES, g[2]) &&
        Number.isInteger(g[3]) &&
        g[3] > 0 &&
        g[3] <= 32 &&
        Number.isFinite(g[4]) &&
        g[4] >= 0.2 &&
        g[4] <= 20,
    ) &&
    groups.reduce((n, g) => n + g[3], 0) <= 120
  );
}
export function waveFromGroups(groups, seed, night) {
  const rng = randomSequence(seed + night * 7919);
  let id = 0;
  return groups
    .flatMap(([at, lane, type, count, spacing]) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${night}-${id++}`,
        type,
        lane,
        at: Math.max(
          2,
          Math.round((at + i * spacing + (rng() - 0.5) * 0.35) * 20) / 20,
        ),
        assault: at >= 30 ? 2 : 1,
      })),
    )
    .sort((a, b) => a.at - b.at);
}
