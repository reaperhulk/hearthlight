import {
  BUILDINGS,
  BLESSINGS,
  ENEMIES,
  KITS,
  TOWNS,
  createMap,
  mapLanes,
  makeWave,
  routePoint,
} from "./content.js";

export const VERSION = 2;
export const STEP = 0.05;
export const REPAIR_COST = 8;
export const ACTIVE = ["day", "night"];
const known = (table, key) =>
  typeof key === "string" && Object.hasOwn(table, key);
const copy = (value) => JSON.parse(JSON.stringify(value));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);
function forkRound(r) {
  return {
    ...r,
    slots: r.slots.map((s) => ({
      ...s,
      building: s.building ? { ...s.building } : null,
    })),
    enemies: r.enemies.map((e) => ({ ...e })),
    wave: r.wave.map((e) => ({ ...e })),
    warden: { ...r.warden },
    stats: { ...r.stats },
    events: [...r.events],
    tale: [...r.tale],
    commands: [...r.commands],
    blessings: [...r.blessings],
    waveHistory: [...r.waveHistory],
  };
}

export function freshGame() {
  return {
    saveVersion: VERSION,
    embers: 0,
    unlocked: ["keeper"],
    kit: "keeper",
    wins: {},
    records: {},
    history: [],
    legacy: null,
    round: null,
    settings: {
      music: 0.35,
      effects: 0.65,
      ambience: 0.35,
      motion: true,
      contrast: false,
      speed: 1,
      guide: true,
    },
  };
}

export function migrateGame(saved) {
  const fresh = freshGame();
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return fresh;
  const embers = clamp(finite(saved.embers), 0, 1e9);
  if (saved.saveVersion !== VERSION) {
    return {
      ...fresh,
      embers,
      legacy: {
        bestNights: finite(saved.bestNights),
        totalRounds: finite(saved.totalRounds),
        meta: saved.meta && typeof saved.meta === "object" ? saved.meta : {},
        history: Array.isArray(saved.history) ? saved.history.slice(-30) : [],
        archivedVigil: Boolean(saved.round),
      },
      unlocked: [
        "keeper",
        ...(saved.meta?.stoneFoundations ? ["mason"] : []),
        ...(saved.meta?.swiftWarden ? ["ranger"] : []),
        ...(saved.meta?.emberChoir ? ["gardener"] : []),
      ],
    };
  }
  const state = { ...fresh, embers };
  state.unlocked = [
    ...new Set([
      "keeper",
      ...(Array.isArray(saved.unlocked)
        ? saved.unlocked.filter((id) => known(KITS, id))
        : []),
    ]),
  ];
  state.kit = state.unlocked.includes(saved.kit) ? saved.kit : "keeper";
  for (const key of ["wins", "records"])
    for (const id of Object.keys(TOWNS)) {
      if (finite(saved[key]?.[id]) > 0)
        state[key][id] = clamp(Math.floor(saved[key][id]), 0, 1e6);
    }
  state.history = Array.isArray(saved.history)
    ? saved.history
        .filter(
          (item) =>
            item &&
            known(TOWNS, item.town) &&
            Number.isFinite(item.nights) &&
            Number.isFinite(item.embers),
        )
        .slice(-30)
    : [];
  state.legacy =
    saved.legacy && typeof saved.legacy === "object"
      ? {
          ...saved.legacy,
          bestNights: finite(saved.legacy.bestNights),
          totalRounds: finite(saved.legacy.totalRounds),
        }
      : null;
  for (const key of ["music", "effects", "ambience"])
    state.settings[key] = clamp(
      finite(saved.settings?.[key], fresh.settings[key]),
      0,
      1,
    );
  for (const key of ["motion", "contrast", "guide"])
    if (typeof saved.settings?.[key] === "boolean")
      state.settings[key] = saved.settings[key];
  state.settings.speed = [0.5, 1, 2].includes(saved.settings?.speed)
    ? saved.settings.speed
    : 1;
  if (validRound(saved.round)) {
    state.round = copy(saved.round);
    state.round.undo = null;
    if (state.round.phase === "day" && state.round.offers.length)
      state.round.offers = blessingOffers(state.round);
    if (state.round.phase === "night" && !state.round.paused)
      return command(state, { type: "pause" });
    state.round.paused = true;
  }
  return state;
}

function validRound(r) {
  if (
    !r ||
    !known(TOWNS, r.town) ||
    !known(KITS, r.kit) ||
    !["day", "night", "won", "lost", "retired"].includes(r.phase)
  )
    return false;
  if (
    !Number.isInteger(r.night) ||
    r.night < 1 ||
    r.night > 1000 ||
    !Number.isInteger(r.seed)
  )
    return false;
  if (
    ![
      r.time,
      r.waveTime,
      r.glow,
      r.heart,
      r.completed,
      r.carry,
      r.bursts,
      r.nextEvent,
      r.warden?.x,
      r.warden?.y,
      r.warden?.targetX,
      r.warden?.targetY,
      r.warden?.cooldown,
    ].every(Number.isFinite)
  )
    return false;
  if (
    r.time < 0 ||
    r.waveTime < 0 ||
    r.bursts < 0 ||
    r.completed < 0 ||
    r.completed > r.night ||
    r.heart < 0 ||
    r.heart > 100 ||
    r.glow < 0 ||
    r.carry < 0 ||
    r.carry >= STEP + 1e-8
  )
    return false;
  if (
    !Array.isArray(r.slots) ||
    r.slots.length !== createMap(r.town).slots.length ||
    !Array.isArray(r.enemies) ||
    r.enemies.length > 200
  )
    return false;
  const expected = createMap(r.town).slots;
  if (
    !r.slots.every(
      (s, i) =>
        s?.id === expected[i].id &&
        s.lane === expected[i].lane &&
        s.progress === expected[i].progress &&
        s.x === expected[i].x &&
        s.y === expected[i].y &&
        (!s.building ||
          (known(BUILDINGS, s.building.type) &&
            Number.isFinite(s.building.hp) &&
            s.building.hp > 0 &&
            Number.isFinite(s.building.cooldown) &&
            (!s.building.branch ||
              known(BUILDINGS[s.building.type].branches, s.building.branch)))),
    )
  )
    return false;
  if (
    !r.enemies.every(
      (e) =>
        e &&
        known(ENEMIES, e.type) &&
        Number.isInteger(e.lane) &&
        e.lane >= 0 &&
        e.lane < mapLanes(r.town).length &&
        [e.progress, e.hp, e.maxHp, e.windup, e.stun, e.burn, e.burnRate].every(
          Number.isFinite,
        ),
    )
  )
    return false;
  if (
    !Array.isArray(r.blessings) ||
    !r.blessings.every((id) => known(BLESSINGS, id)) ||
    !Array.isArray(r.offers) ||
    !r.offers.every((id) => known(BLESSINGS, id))
  )
    return false;
  if (
    !Array.isArray(r.events) ||
    r.events.some(
      (e) =>
        !e ||
        !Number.isFinite(e.id) ||
        !Number.isFinite(e.time) ||
        typeof e.type !== "string" ||
        (e.type === "burst" &&
          (!Number.isInteger(e.lane) ||
            e.lane < 0 ||
            e.lane >= mapLanes(r.town).length)),
    )
  )
    return false;
  if (
    !Array.isArray(r.commands) ||
    r.commands.length > 4000 ||
    r.commands.some(
      (e) => !e || !Number.isFinite(e.time) || typeof e.type !== "string",
    )
  )
    return false;
  if (
    !Array.isArray(r.wave) ||
    r.wave.length > 120 ||
    r.wave.some(
      (e) =>
        !e ||
        !known(ENEMIES, e.type) ||
        !Number.isFinite(e.at) ||
        !Number.isInteger(e.lane) ||
        e.lane < 0 ||
        e.lane >= mapLanes(r.town).length,
    )
  )
    return false;
  return (
    r.stats &&
    ["kills", "wardenKills", "bursts", "lost", "damage", "built"].every((key) =>
      Number.isFinite(r.stats[key]),
    ) &&
    Array.isArray(r.tale) &&
    r.tale.every((t) => typeof t === "string") &&
    Array.isArray(r.waveHistory) &&
    r.waveHistory.every(
      (w) => w && [w.night, w.heart, w.seconds].every(Number.isFinite),
    )
  );
}

export function hasFutureDawn(r) {
  return r.endless || r.night < TOWNS[r.town].nights;
}

export function blessingOffers(r) {
  const finalNight = !hasFutureDawn(r);
  const hasLantern = r.slots.some((s) => s.building?.type === "lantern");
  const available = Object.keys(BLESSINGS).filter(
    (id) =>
      !r.blessings.includes(id) &&
      (!finalNight || !["shelter", "salvage"].includes(id)) &&
      (!finalNight || hasLantern || id !== "chain"),
  );
  const offset = (r.seed + r.completed) % Math.max(1, available.length);
  return [...available.slice(offset), ...available.slice(0, offset)].slice(
    0,
    3,
  );
}

export function townUnlocked(state, id) {
  return Boolean(
    known(TOWNS, id) && (!TOWNS[id].requires || state.wins[TOWNS[id].requires]),
  );
}
export function startGame(state, town = "first", seed = 1, endless = false) {
  if (
    state.round ||
    !townUnlocked(state, town) ||
    (endless && !state.wins[town])
  )
    return state;
  const kit = state.kit;
  return {
    ...state,
    round: {
      town,
      kit,
      seed: seed >>> 0,
      endless,
      night: 1,
      completed: 0,
      phase: "day",
      time: 0,
      waveTime: 0,
      carry: 0,
      glow: TOWNS[town].start + (kit === "gardener" ? 10 : 0),
      heart: 100,
      slots: createMap(town).slots,
      enemies: [],
      wave: makeWave(town, 1, seed >>> 0),
      waveHistory: [],
      bursts: 2,
      blessings: [],
      offers: [],
      warden: {
        x: 0.5,
        y: 0.51,
        targetX: 0.5,
        targetY: 0.51,
        cooldown: 0,
        deployed: false,
      },
      stats: {
        kills: 0,
        wardenKills: 0,
        bursts: 0,
        lost: 0,
        damage: 0,
        built: 0,
      },
      events: [],
      nextEvent: 1,
      tale: [
        "The village has lit its first fire. Build a defense before nightfall.",
      ],
      commands: [],
      undo: null,
      paused: false,
      lastLoss: null,
    },
  };
}

function event(r, type, data = {}) {
  r.events.push({ id: r.nextEvent++, time: r.time, type, ...data });
  if (r.events.length > 80) r.events.shift();
}
function tale(r, text) {
  r.tale.push(text);
  if (r.tale.length > 12) r.tale.shift();
}
export function maxHp(building, kit) {
  return (
    BUILDINGS[building.type].hp +
    (building.type === "wall" && kit === "mason" ? 25 : 0) +
    (building.branch === "stone" ? 70 : 0)
  );
}
export function repairCost(r) {
  return REPAIR_COST - (r.kit === "mason" ? 2 : 0);
}
export function farmIncome(building, kit) {
  return building.type === "farm"
    ? BUILDINGS.farm.income +
        (kit === "gardener" ? 5 : 0) +
        (building.branch === "harvest" ? 14 : 0)
    : 0;
}
export function dawnIncome(r) {
  return (
    TOWNS[r.town].income +
    r.slots.reduce(
      (sum, slot) =>
        sum + (slot.building ? farmIncome(slot.building, r.kit) : 0),
      0,
    )
  );
}
export function buildingRange(b) {
  return b.type === "tower"
    ? BUILDINGS.tower.range
    : b.type === "lantern"
      ? b.branch === "reach"
        ? 0.33
        : BUILDINGS.lantern.range
      : 0;
}
export function reward(r) {
  return r.completed * 3 + (r.phase === "won" ? TOWNS[r.town].reward : 0);
}
export function forecast(r) {
  return mapLanes(r.town).map((lane) => ({
    ...lane,
    enemies: r.wave.filter((e) => e.lane === lane.id),
    count: r.wave.filter((e) => e.lane === lane.id).length,
  }));
}

export function command(state, action) {
  if (!action || typeof action.type !== "string") return state;
  if (action.type === "unlock") {
    const kit = known(KITS, action.id) ? KITS[action.id] : null;
    if (
      !kit ||
      state.unlocked.includes(action.id) ||
      state.embers < kit.cost ||
      state.round
    )
      return state;
    return {
      ...state,
      embers: state.embers - kit.cost,
      unlocked: [...state.unlocked, action.id],
      kit: action.id,
    };
  }
  if (action.type === "kit")
    return !state.round && state.unlocked.includes(action.id)
      ? { ...state, kit: action.id }
      : state;
  if (action.type === "setting") {
    if (!known(state.settings, action.key)) return state;
    const value = ["music", "ambience", "effects"].includes(action.key)
      ? clamp(finite(action.value), 0, 1)
      : action.key === "speed"
        ? [0.5, 1, 2].includes(action.value)
          ? action.value
          : 1
        : Boolean(action.value);
    return { ...state, settings: { ...state.settings, [action.key]: value } };
  }
  const previous = state.round;
  if (!previous) return state;
  if (action.type === "collect") {
    if (ACTIVE.includes(previous.phase)) return state;
    const earned = reward(previous);
    const wins = { ...state.wins };
    if (previous.phase === "won")
      wins[previous.town] = (wins[previous.town] || 0) + 1;
    return {
      ...state,
      embers: state.embers + earned,
      wins,
      records: {
        ...state.records,
        [previous.town]: Math.max(
          state.records[previous.town] || 0,
          previous.completed,
        ),
      },
      history: [
        ...state.history,
        {
          town: previous.town,
          nights: previous.completed,
          embers: earned,
          outcome: previous.phase,
          seed: previous.seed,
          kit: previous.kit,
        },
      ].slice(-30),
      round: null,
    };
  }
  if (!ACTIVE.includes(previous.phase)) return state;
  const r = forkRound(previous);
  const slot = r.slots.find((s) => s.id === action.slot);
  const record = () => {
    r.commands.push({ ...action, time: r.time });
    if (r.commands.length > 4000) {
      r.commands.pop();
      r.replayTruncated = true;
    }
    return { ...state, round: r };
  };
  if (action.type === "pause") {
    r.paused = !r.paused;
    return record();
  }
  if (action.type === "retire") {
    r.phase = "retired";
    r.undo = null;
    tale(r, "The villagers carry home the light you earned.");
    return record();
  }
  if (r.phase === "day") {
    if (action.type === "undo" && r.undo) {
      Object.assign(r, r.undo);
      r.undo = null;
      event(r, "undo");
      return record();
    }
    if (["build", "repair", "upgrade", "sell", "move"].includes(action.type)) {
      if (!slot) return state;
      const snapshot = {
        slots: copy(r.slots),
        glow: r.glow,
        stats: copy(r.stats),
      };
      if (action.type === "build") {
        const def = known(BUILDINGS, action.building)
          ? BUILDINGS[action.building]
          : null;
        if (
          !def ||
          slot.building ||
          r.glow < def.cost ||
          (action.building === "farm" && !hasFutureDawn(r))
        )
          return state;
        slot.building = {
          type: action.building,
          branch: null,
          hp: maxHp({ type: action.building }, r.kit),
          cooldown: 0,
        };
        r.glow -= def.cost;
        r.stats.built++;
        event(r, "build", { x: slot.x, y: slot.y });
      } else if (action.type === "repair") {
        if (
          !slot.building ||
          slot.building.hp >= maxHp(slot.building, r.kit) ||
          r.glow < repairCost(r)
        )
          return state;
        slot.building.hp = maxHp(slot.building, r.kit);
        r.glow -= repairCost(r);
        event(r, "repair", { x: slot.x, y: slot.y });
      } else if (action.type === "upgrade") {
        const branch =
          slot.building &&
          known(BUILDINGS[slot.building.type].branches, action.branch) &&
          BUILDINGS[slot.building.type].branches[action.branch];
        if (
          !branch ||
          slot.building.branch ||
          r.glow < branch.cost ||
          (slot.building.type === "farm" && !hasFutureDawn(r))
        )
          return state;
        slot.building.branch = action.branch;
        slot.building.hp = maxHp(slot.building, r.kit);
        r.glow -= branch.cost;
        event(r, "upgrade", { x: slot.x, y: slot.y });
      } else if (action.type === "sell") {
        if (!slot.building) return state;
        r.glow += Math.floor(BUILDINGS[slot.building.type].cost / 2);
        slot.building = null;
      } else {
        const target = r.slots.find((s) => s.id === action.to);
        if (!slot.building || !target || target.building || r.glow < 3)
          return state;
        target.building = slot.building;
        slot.building = null;
        r.glow -= 3;
      }
      r.undo = snapshot;
      return record();
    }
    if (action.type === "blessing" && r.offers.includes(action.id)) {
      r.blessings.push(action.id);
      r.offers = [];
      event(r, "blessing");
      return record();
    }
    if (action.type === "start" && r.offers.length === 0) {
      r.phase = "night";
      r.paused = false;
      r.waveTime = 0;
      r.undo = null;
      r.bursts = 2 + (r.blessings.includes("reserves") ? 1 : 0);
      r.slots.forEach((s) => {
        if (s.building) s.building.cooldown = 0;
      });
      event(r, "dusk");
      tale(
        r,
        `Night ${r.night}: ${r.wave.length} enemies approach. Hold until dawn.`,
      );
      return record();
    }
  }
  if (r.phase === "night") {
    const lane = mapLanes(r.town).find((l) => l.id === action.lane);
    if (action.type === "rally" && lane) {
      const pos = routePoint(
        lane,
        clamp(finite(action.progress, 0.48), 0.15, 0.98),
        r.town,
      );
      r.warden.targetX = pos.x;
      r.warden.targetY = pos.y;
      r.warden.deployed = true;
      event(r, "rally", pos);
      return record();
    }
    if (action.type === "burst" && lane && r.bursts > 0) {
      const targets = r.enemies.filter((e) => e.lane === lane.id && e.hp > 0);
      if (!targets.length) return state;
      r.bursts--;
      r.stats.bursts++;
      for (const enemy of targets) {
        enemy.hp -= 9;
        enemy.stun = 2;
        enemy.progress = Math.max(0, enemy.progress - 0.12);
        enemy.windup = ENEMIES[enemy.type].interval;
        if (r.blessings.includes("kindle")) {
          enemy.burn = 3;
          enemy.burnRate = 4;
        }
      }
      event(r, "burst", { lane: lane.id });
      return record();
    }
  }
  return state;
}

export function enemyPosition(r, enemy) {
  return routePoint(mapLanes(r.town)[enemy.lane], enemy.progress, r.town);
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function simulate(r) {
  r.time = Math.round((r.time + STEP) * 1000) / 1000;
  r.waveTime = Math.round((r.waveTime + STEP) * 1000) / 1000;
  for (const spawn of r.wave)
    if (!spawn.spawned && spawn.at <= r.waveTime + 1e-8) {
      spawn.spawned = true;
      const def = ENEMIES[spawn.type];
      const mult = r.endless
        ? 1 + Math.max(0, r.night - TOWNS[r.town].nights) * 0.16
        : 1;
      r.enemies.push({
        ...spawn,
        hp: def.hp * mult,
        maxHp: def.hp * mult,
        progress: 0,
        windup: def.interval,
        stun: 0,
        burn: 0,
        burnRate: 0,
      });
    }
  const w = r.warden;
  const dist = distance(w, { x: w.targetX, y: w.targetY });
  const travel = 0.22 * STEP * (r.kit === "ranger" ? 1.4 : 1);
  if (dist > 0) {
    const f = Math.min(1, travel / dist);
    w.x += (w.targetX - w.x) * f;
    w.y += (w.targetY - w.y) * f;
  }
  const lanterns = r.slots.filter((s) => s.building?.type === "lantern");
  const litBy = (point) =>
    lanterns.find(
      (s) => s.building && distance(s, point) <= buildingRange(s.building),
    );
  const positions = new Map(r.enemies.map((e) => [e.id, enemyPosition(r, e)]));
  const hurt = (enemy, damage, source, from) => {
    if (enemy.hp <= 0) return;
    enemy.hp -= damage;
    event(r, "hit", {
      source,
      from,
      to: positions.get(enemy.id),
      enemy: enemy.id,
    });
    if (enemy.hp <= 0 && source === "warden") r.stats.wardenKills++;
  };
  for (const slot of r.slots) {
    const b = slot.building;
    if (b?.type !== "tower") continue;
    b.cooldown = Math.max(0, b.cooldown - STEP);
    if (b.cooldown > 1e-8) continue;
    const targets = r.enemies
      .filter(
        (e) =>
          e.hp > 0 && distance(slot, positions.get(e.id)) <= buildingRange(b),
      )
      .sort((a, b) => b.progress - a.progress);
    if (!targets.length) continue;
    for (const enemy of targets.slice(0, b.branch === "volley" ? 3 : 1)) {
      const mist = r.enemies.some(
        (e) =>
          e.type === "mist" &&
          e.hp > 0 &&
          e.stun <= 0 &&
          distance(positions.get(e.id), positions.get(enemy.id)) < 0.14,
      );
      hurt(
        enemy,
        (b.branch === "pierce" ? 10 : BUILDINGS.tower.damage) *
          (mist && b.branch !== "pierce" ? 0.65 : 1),
        "tower",
        { x: slot.x, y: slot.y },
      );
    }
    b.cooldown =
      BUILDINGS.tower.interval * (r.blessings.includes("watch") ? 0.8 : 1);
  }
  w.cooldown = Math.max(0, w.cooldown - STEP);
  const threats = r.enemies
    .filter((e) => e.hp > 0 && distance(w, positions.get(e.id)) < 0.14)
    .sort((a, b) => b.progress - a.progress);
  if (w.deployed && w.cooldown < 1e-8 && threats.length) {
    const lamp = litBy(w);
    const damage =
      6 +
      (r.kit === "ranger" ? 2 : 0) +
      (lamp ? (lamp.building.branch === "courage" ? 6 : 3) : 0);
    hurt(threats[0], damage, "warden", { x: w.x, y: w.y });
    if (lamp && r.blessings.includes("chain") && threats[1])
      hurt(threats[1], damage, "warden", { x: w.x, y: w.y });
    w.cooldown = 1.1;
  }
  for (const enemy of r.enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.burn > 0) {
      enemy.hp -= STEP * enemy.burnRate;
      enemy.burn = Math.max(0, enemy.burn - STEP);
      if (enemy.hp <= 0) continue;
    }
    if (enemy.stun > 0) {
      enemy.stun = Math.max(0, enemy.stun - STEP);
      continue;
    }
    const def = ENEMIES[enemy.type];
    const target = r.slots
      .filter(
        (s) =>
          s.lane === enemy.lane &&
          s.building &&
          s.progress >= enemy.progress - 0.005,
      )
      .sort((a, b) => a.progress - b.progress)[0];
    const endpoint = target?.progress ?? 1;
    if (enemy.progress < endpoint - 1e-8) {
      const lamp = litBy(positions.get(enemy.id));
      enemy.progress = Math.min(
        endpoint,
        enemy.progress +
          def.speed *
            STEP *
            (lamp ? (lamp.building.branch === "reach" ? 0.5 : 0.7) : 1),
      );
      enemy.windup = def.interval;
      continue;
    }
    enemy.windup -= STEP;
    if (enemy.windup > 1e-8) continue;
    enemy.windup = def.interval;
    if (target) {
      target.building.hp -= def.damage;
      event(r, "bite", { x: target.x, y: target.y, damage: def.damage });
      if (target.building.branch === "thorns") {
        enemy.hp -= 4;
        enemy.stun = 0.6;
      }
      if (target.building.hp <= 0) {
        const name = BUILDINGS[target.building.type].name;
        if (r.blessings.includes("salvage"))
          r.glow += Math.floor(BUILDINGS[target.building.type].cost / 2);
        target.building = null;
        r.stats.lost++;
        event(r, "fall", { x: target.x, y: target.y });
        r.lastLoss = `${name} fell on ${mapLanes(r.town)[enemy.lane].name}.`;
        tale(r, `${r.lastLoss} The road is open behind it.`);
      }
    } else {
      r.heart = Math.max(0, r.heart - def.damage);
      r.stats.damage += def.damage;
      r.lastLoss = `${def.name} reached the Heart along ${mapLanes(r.town)[enemy.lane].name}.`;
      event(r, "heart", { damage: def.damage, lane: enemy.lane });
      if (r.heart <= 0) {
        r.phase = "lost";
        tale(r, r.lastLoss);
        event(r, "lost");
        break;
      }
    }
  }
  for (const enemy of r.enemies)
    if (enemy.hp <= 0) {
      r.stats.kills++;
      event(r, "banish", positions.get(enemy.id));
    }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  if (r.phase !== "night") return;
  if (r.wave.every((e) => e.spawned) && r.enemies.length === 0) {
    r.completed++;
    r.waveHistory.push({ night: r.night, heart: r.heart, seconds: r.waveTime });
    if (!r.endless && r.completed >= TOWNS[r.town].nights) {
      r.phase = "won";
      event(r, "won");
      tale(r, "The beacon is whole. The village will see another spring.");
      return;
    }
    r.glow += dawnIncome(r);
    const supplyLanes = new Set(
      r.slots
        .filter((s) => s.building?.branch === "supplies")
        .map((s) => s.lane),
    );
    for (const slot of r.slots)
      if (slot.building)
        slot.building.hp = Math.min(
          maxHp(slot.building, r.kit),
          slot.building.hp +
            (supplyLanes.has(slot.lane) ? 16 : 0) +
            (r.blessings.includes("shelter") ? 10 : 0),
        );
    r.night++;
    r.phase = "day";
    r.undo = null;
    r.wave = makeWave(r.town, r.night, r.seed);
    if (r.completed % 2 === 0) {
      r.offers = blessingOffers(r);
    }
    event(r, "dawn");
    tale(
      r,
      `Dawn ${r.completed}. The beacon grows brighter. Your next budget is ready.`,
    );
  }
}

export function advance(state, dt) {
  if (
    !state.round ||
    state.round.phase !== "night" ||
    state.round.paused ||
    !Number.isFinite(dt) ||
    dt <= 0
  )
    return state;
  const r = forkRound(state.round);
  r.carry += Math.min(dt, 60);
  while (r.carry + 1e-9 >= STEP && r.phase === "night") {
    r.carry = Math.max(0, r.carry - STEP);
    simulate(r);
  }
  if (r.phase !== "night") r.carry = 0;
  return { ...state, round: r };
}

// A portable reproducer contains scenario seed and timestamped player commands.
// Simulation time, rather than wall time, makes pause and speed settings irrelevant.
export function replayRound(record) {
  if (
    !record ||
    record.replayTruncated ||
    !known(TOWNS, record.town) ||
    !known(KITS, record.kit) ||
    !Number.isFinite(record.time) ||
    record.time > 36000 ||
    !Array.isArray(record.commands) ||
    record.commands.length > 4000
  )
    throw new Error("Invalid replay");
  let state = freshGame();
  state.kit = record.kit;
  state.wins = Object.fromEntries(Object.keys(TOWNS).map((id) => [id, 1]));
  state = startGame(state, record.town, record.seed, record.endless);
  for (const action of record.commands) {
    if (
      !Number.isFinite(action.time) ||
      action.time < state.round.time ||
      action.time > record.time + STEP
    )
      throw new Error("Invalid command time");
    let count = 0;
    while (state.round.time + STEP / 2 < action.time) {
      const next = advance(state, Math.min(10, action.time - state.round.time));
      if (
        next === state ||
        next.round.time === state.round.time ||
        count++ > 4000
      )
        throw new Error("Replay cannot reach command");
      state = next;
    }
    state = command(state, action);
  }
  while (state.round.time + STEP / 2 < record.time) {
    const next = advance(state, Math.min(10, record.time - state.round.time));
    if (next === state || next.round.time === state.round.time)
      throw new Error("Replay cannot reach its end");
    state = next;
  }
  return state;
}
