import {
  advance as previousAdvance,
  command as previousCommand,
  migrateGame as previousMigrate,
  replayRound as previousReplay,
} from "./legacy-v3/campaign.js";
import {
  advance as legacyAdvance,
  command as legacyCommand,
  migrateGame as legacyMigrate,
  replayRound as legacyReplay,
} from "./legacy-v2/campaign.js";
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
  routeLength,
  buildCost,
  startingGlow,
  flareCharges,
  encounterFor,
  validLayout,
  validGroups,
  waveFromGroups,
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
    projectiles: r.projectiles.map((p) => ({ ...p })),
    ruins: [...r.ruins],
    wave: r.wave.map((e) => ({ ...e })),
    warden: { ...r.warden },
    stats: { ...r.stats },
    events: [...r.events],
    tale: [...r.tale],
    commands: [...r.commands],
    blessings: [...r.blessings],
    waveHistory: [...r.waveHistory],
    incidents: [...(r.incidents || [])],
    lessons: [...(r.lessons || [])],
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
    mastery: {},
    history: [],
    legacy: null,
    round: null,
    playtestLog: [],
    lastPlaytestRound: null,
    settings: {
      music: 0.35,
      effects: 0.65,
      ambience: 0.35,
      motion: true,
      intensity: 1,
      contrast: false,
      speed: 1,
      guide: true,
      recording: false,
    },
  };
}

export function migrateGame(saved) {
  if (saved?.round && !saved.round.rules) return legacyMigrate(saved);
  if (saved?.round?.rules === 3) return previousMigrate(saved);
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
  for (const town of Object.keys(TOWNS))
    state.mastery[town] = Array.isArray(saved.mastery?.[town])
      ? saved.mastery[town].filter((x) =>
          ["saved", "steadfast", "restorer", "no-bursts"].includes(x),
        )
      : [];
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
  for (const key of ["music", "effects", "ambience", "intensity"])
    state.settings[key] = clamp(
      finite(saved.settings?.[key], fresh.settings[key]),
      0,
      1,
    );
  for (const key of ["motion", "contrast", "guide", "recording"])
    if (typeof saved.settings?.[key] === "boolean")
      state.settings[key] = saved.settings[key];
  state.settings.speed = [0.5, 1, 2].includes(saved.settings?.speed)
    ? saved.settings.speed
    : 1;
  state.playtestLog = Array.isArray(saved.playtestLog)
    ? saved.playtestLog
        .filter(
          (e) =>
            e &&
            typeof e.type === "string" &&
            Number.isFinite(e.time) &&
            typeof e.accepted === "boolean",
        )
        .slice(-1000)
    : [];
  state.lastPlaytestRound = validRound(saved.lastPlaytestRound)
    ? copy(saved.lastPlaytestRound)
    : null;
  if (validRound(saved.round)) {
    state.round = copy(saved.round);
    state.round.undo = null;
    state.round.lessons = Array.isArray(saved.round.lessons)
      ? saved.round.lessons.filter((x) => ["wall", "burst"].includes(x))
      : [];
    state.round.incidents = Array.isArray(saved.round.incidents)
      ? saved.round.incidents
          .filter(
            (x) =>
              x &&
              ["fall", "heart"].includes(x.type) &&
              Number.isInteger(x.lane) &&
              mapLanes(state.round.town)[x.lane] &&
              Number.isFinite(x.night) &&
              typeof x.text === "string",
          )
          .slice(-24)
      : [];
    state.round.dawnReport =
      saved.round.dawnReport &&
      ["night", "income", "farms", "kills", "lost", "damage", "standing"].every(
        (key) => Number.isFinite(saved.round.dawnReport[key]),
      )
        ? { ...saved.round.dawnReport }
        : null;
    state.round.challenge =
      saved.round.challenge === "no-bursts" ? "no-bursts" : "standard";
    if (state.round.phase === "day" && state.round.offers.length)
      state.round.offers = blessingOffers(state.round);
    if (state.round.phase === "night" && !state.round.paused)
      return command(state, { type: "pause" });
    state.round.paused = true;
  }
  return state;
}

function validRound(r) {
  if (r && !r.rules)
    return Boolean(legacyMigrate({ saveVersion: VERSION, round: r }).round);
  if (r?.rules === 3)
    return Boolean(previousMigrate({ saveVersion: VERSION, round: r }).round);
  if (
    r?.rules !== 4 ||
    !Array.isArray(r.projectiles) ||
    r.projectiles.length > 96 ||
    !Array.isArray(r.ruins) ||
    r.ruins.length > 16
  )
    return false;
  if (
    r.projectiles.some(
      (p) =>
        !p ||
        typeof p.target !== "string" ||
        ![p.damage, p.ttl, p.from?.x, p.from?.y].every(Number.isFinite),
    )
  )
    return false;
  if (
    r.ruins.some(
      (x) => !x || typeof x.slot !== "string" || !known(BUILDINGS, x.type),
    )
  )
    return false;
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
  if (!validLayout(r.layout, r.town)) return false;
  if (
    !Array.isArray(r.slots) ||
    r.slots.length !== createMap(r.town, 4, r.layout).slots.length ||
    !Array.isArray(r.enemies) ||
    r.enemies.length > 200
  )
    return false;
  if (
    !validLayout(r.layout, r.town) ||
    (r.scenario && !validScenario(r.scenario))
  )
    return false;
  const expected = createMap(r.town, 4, r.layout).slots;
  if (
    ![1, 2].includes(r.assault) ||
    !["guard", "hold"].includes(r.warden.mode) ||
    (r.warden.lane !== null && !mapLanes(r.town)[r.warden.lane])
  )
    return false;
  if (r.ruins.some((x) => !expected.some((s) => s.id === x.slot))) return false;
  if (
    r.enemies.some(
      (e) =>
        e?.raid &&
        (!expected.some((s) => s.id === e.raid) ||
          !Number.isFinite(e.detour) ||
          e.detour < 0 ||
          e.detour > 1),
    )
  )
    return false;

  if (
    !r.slots.every(
      (s, i) =>
        s?.id === expected[i].id &&
        s.lane === expected[i].lane &&
        ["progress", "x", "y"].every(
          (key) =>
            Number.isFinite(s[key]) &&
            Math.abs(s[key] - expected[i][key]) < 1e-9,
        ) &&
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
    [
      "kills",
      "wardenKills",
      "bursts",
      "lost",
      "damage",
      "built",
      "raids",
      "interrupts",
      "orders",
      "repairs",
    ].every((key) => Number.isFinite(r.stats[key])) &&
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
      (r.challenge !== "no-bursts" || !["kindle", "reserves"].includes(id)) &&
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
export function startGame(
  state,
  town = "first",
  seed = 1,
  endless = false,
  challenge = "standard",
) {
  if (
    state.round ||
    !townUnlocked(state, town) ||
    ((endless || challenge !== "standard") && !state.wins[town]) ||
    !["standard", "no-bursts"].includes(challenge)
  )
    return state;
  const kit = state.kit;
  return {
    ...state,
    round: {
      rules: 4,
      layout: null,
      scenario: null,
      town,
      kit,
      seed: seed >>> 0,
      endless,
      challenge,
      lessons: [],
      incidents: [],
      dawnReport: null,
      night: 1,
      completed: 0,
      phase: "day",
      time: 0,
      waveTime: 0,
      carry: 0,
      glow: startingGlow(town, kit),
      heart: 100,
      slots: createMap(town).slots.map((slot) =>
        town === "first" && slot.id === "0-2"
          ? {
              ...slot,
              building: {
                type: "farm",
                branch: null,
                hp: BUILDINGS.farm.hp,
                cooldown: 0,
              },
            }
          : slot,
      ),
      enemies: [],
      projectiles: [],
      ruins: [],
      assault: 1,
      wave: makeWave(town, 1, seed >>> 0),
      waveHistory: [],
      bursts: challenge === "no-bursts" ? 0 : flareCharges(kit),
      blessings: [],
      offers: [],
      warden: {
        x: 0.5,
        y: 0.51,
        targetX: 0.5,
        targetY: 0.51,
        cooldown: 0,
        deployed: false,
        lane: null,
        mode: "hold",
        orderPending: false,
      },
      stats: {
        kills: 0,
        wardenKills: 0,
        bursts: 0,
        lost: 0,
        damage: 0,
        built: 0,
        raids: 0,
        interrupts: 0,
        orders: 0,
        repairs: 0,
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

export function command(state, action, wallTime = null) {
  if (state.round && !state.round.rules)
    return legacyCommand(state, action, wallTime);
  if (state.round?.rules === 3) return previousCommand(state, action, wallTime);
  const next = applyCommand(state, action);
  if (!state.settings.recording || !action || typeof action.type !== "string")
    return next;
  return {
    ...next,
    playtestLog: [
      ...(state.playtestLog || []),
      {
        type: action.type,
        time: state.round?.time || 0,
        wallTime,
        phase: state.round?.phase || "home",
        accepted: next !== state,
        ...Object.fromEntries(
          ["slot", "lane", "building", "branch", "id"]
            .filter((key) => ["string", "number"].includes(typeof action[key]))
            .map((key) => [key, action[key]]),
        ),
      },
    ].slice(-1000),
  };
}

function applyCommand(state, action) {
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
    const value = ["music", "ambience", "effects", "intensity"].includes(
      action.key,
    )
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
    if (previous.scenario) return { ...state, round: null };
    const earned = reward(previous);
    const wins = { ...state.wins };
    if (previous.phase === "won")
      wins[previous.town] = (wins[previous.town] || 0) + 1;
    return {
      ...state,
      embers: state.embers + earned,
      mastery:
        previous.phase === "won"
          ? {
              ...state.mastery,
              [previous.town]: [
                ...new Set([
                  ...(state.mastery?.[previous.town] || []),
                  "saved",
                  ...(previous.heart === 100 ? ["steadfast"] : []),
                  ...(previous.stats.lost === 0 ? ["restorer"] : []),
                  ...(previous.challenge === "no-bursts" ? ["no-bursts"] : []),
                ]),
              ],
            }
          : state.mastery,
      lastPlaytestRound: state.settings.recording
        ? previous
        : state.lastPlaytestRound,
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
          challenge: previous.challenge || "standard",
          heart: previous.heart,
          lost: previous.stats.lost,
          standing: previous.slots.filter((s) => s.building).length,
          interrupts: previous.stats.interrupts,
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
  if (
    action.type === "lesson" &&
    r.town === "first" &&
    r.phase === "night" &&
    ["wall", "burst"].includes(action.id) &&
    !r.lessons.includes(action.id)
  ) {
    r.lessons.push(action.id);
    r.paused = true;
    return record();
  }
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
        ruins: [...r.ruins],
      };
      if (action.type === "build") {
        const def = known(BUILDINGS, action.building)
          ? BUILDINGS[action.building]
          : null;
        if (
          !def ||
          slot.building ||
          r.glow < buildCost(action.building, r.kit) ||
          (action.building === "farm" && !hasFutureDawn(r))
        )
          return state;
        slot.building = {
          type: action.building,
          branch: null,
          hp: maxHp({ type: action.building }, r.kit),
          cooldown: 0,
        };
        r.glow -= buildCost(action.building, r.kit);
        r.ruins = r.ruins.filter((x) => x.slot !== slot.id);
        r.stats.built++;
        event(r, "build", { x: slot.x, y: slot.y, material: action.building });
      } else if (action.type === "repair") {
        if (
          !slot.building ||
          slot.building.hp >= maxHp(slot.building, r.kit) ||
          r.glow < repairCost(r)
        )
          return state;
        slot.building.hp = maxHp(slot.building, r.kit);
        r.glow -= repairCost(r);
        r.stats.repairs++;
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
      r.bursts =
        r.challenge === "no-bursts"
          ? 0
          : flareCharges(r.kit) + (r.blessings.includes("reserves") ? 1 : 0);
      r.assault = 1;
      r.projectiles = [];
      r.nightStart = { ...r.stats };
      r.slots.forEach((s) => {
        if (s.building) s.building.cooldown = 0;
      });
      event(r, "dusk");
      tale(
        r,
        `Night ${r.night} · ${encounterFor(r.town, r.night).name}. ${r.wave.length} enemies approach. Hold until dawn.`,
      );
      return record();
    }
  }
  if (r.phase === "night") {
    const lane = mapLanes(r.town).find((l) => l.id === action.lane);
    if (action.type === "rally" && lane) {
      const mode =
        action.mode === "hold" ||
        (Number.isFinite(action.progress) && action.mode !== "guard")
          ? "hold"
          : "guard";
      if (
        mode === "guard" &&
        r.warden.mode === mode &&
        r.warden.lane === lane.id &&
        r.warden.deployed
      )
        return state;
      r.warden.mode = mode;
      r.warden.orderPending = true;
      r.stats.orders++;
      const pos = routePoint(
        lane,
        clamp(finite(action.progress, 0.48), 0.15, 0.98),
        r.town,
        4,
        r.layout,
      );
      r.warden.targetX = pos.x;
      r.warden.targetY = pos.y;
      r.warden.deployed = true;
      r.warden.lane = lane.id;
      event(r, "rally", { ...pos, lane: lane.id, mode });
      return record();
    }
    if (action.type === "burst" && lane && r.bursts > 0) {
      const targets = r.enemies.filter((e) => e.lane === lane.id && e.hp > 0);
      if (!targets.length) return state;
      r.bursts--;
      r.stats.bursts++;
      for (const enemy of targets) {
        if (enemy.warned && enemy.stun <= 0) {
          r.stats.interrupts++;
          event(r, "interrupt", {
            ...enemyPosition(r, enemy),
            lane: enemy.lane,
          });
        }
        enemy.warned = false;
        enemy.raid = null;
        enemy.detour = 0;
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
  const pos = routePoint(
    mapLanes(r.town)[enemy.lane],
    enemy.progress,
    r.town,
    r.rules || 2,
    r.layout,
  );
  const site = enemy.raid && r.slots.find((s) => s.id === enemy.raid);
  return site
    ? {
        x: pos.x + (site.x - pos.x) * enemy.detour,
        y: pos.y + (site.y - pos.y) * enemy.detour,
      }
    : pos;
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function incident(r, type, lane, text) {
  if (
    type === "heart" &&
    r.incidents.some(
      (e) => e.type === type && e.lane === lane && e.night === r.night,
    )
  )
    return;
  r.incidents.push({ type, lane, night: r.night, time: r.time, text });
  if (r.incidents.length > 24) r.incidents.shift();
}

function simulate(r) {
  r.time = Math.round((r.time + STEP) * 1000) / 1000;
  r.waveTime = Math.round((r.waveTime + STEP) * 1000) / 1000;
  for (const spawn of r.wave)
    if (!spawn.spawned && spawn.at <= r.waveTime + 1e-8) {
      spawn.spawned = true;
      const def = ENEMIES[spawn.type];
      const extra = Math.max(0, r.night - TOWNS[r.town].nights);
      const mult = r.endless
        ? 1 + extra * 0.1 + Math.max(0, extra - 10) ** 1.5 * 0.12
        : 1;
      event(r, "approach", { lane: spawn.lane, enemyType: spawn.type });
      if (spawn.assault > r.assault) {
        r.assault = spawn.assault;
        event(r, "assault", { assault: r.assault });
      }
      r.enemies.push({
        ...spawn,
        hp: def.hp * mult,
        maxHp: def.hp * mult,
        progress: 0,
        windup: def.interval,
        stun: 0,
        burn: 0,
        burnRate: 0,
        raid: null,
        detour: 0,
        raided: false,
        enraged: false,
        warned: false,
      });
    }
  const w = r.warden;
  if (w.deployed && w.mode === "guard") {
    const threat = r.enemies
      .filter((e) => e.hp > 0 && e.lane === w.lane)
      .sort((a, b) => b.progress - a.progress)[0];
    const pos = threat
      ? enemyPosition(r, threat)
      : routePoint(mapLanes(r.town)[w.lane], 0.38, r.town, 4, r.layout);
    w.targetX = pos.x;
    w.targetY = pos.y;
  }
  const dist = distance(w, { x: w.targetX, y: w.targetY });
  const travel = 0.19 * STEP * (r.kit === "ranger" ? 1.4 : 1);
  if (dist > 0) {
    const f = Math.min(1, travel / dist);
    w.x += (w.targetX - w.x) * f;
    w.y += (w.targetY - w.y) * f;
  }
  if (w.orderPending && dist < 0.075) {
    w.orderPending = false;
    event(r, "arrive", { x: w.x, y: w.y, lane: w.lane });
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
  // Damage occurs at arrival, matching the displayed flight of the bolt.
  for (const shot of r.projectiles) {
    shot.ttl -= STEP;
    if (shot.ttl > 1e-8) continue;
    const target = r.enemies.find((e) => e.id === shot.target && e.hp > 0);
    if (target) hurt(target, shot.damage, "tower", shot.from);
  }
  r.projectiles = r.projectiles.filter((shot) => shot.ttl > 1e-8);
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
      const damage =
        (b.branch === "pierce" ? 10 : BUILDINGS.tower.damage) *
        (mist && b.branch !== "pierce" ? 0.65 : 1);
      const from = { x: slot.x, y: slot.y };
      r.projectiles.push({ target: enemy.id, damage, from, ttl: 0.15 });
      event(r, "shot", {
        source: "tower",
        from,
        to: positions.get(enemy.id),
        enemy: enemy.id,
      });
    }
    b.cooldown =
      BUILDINGS.tower.interval * (r.blessings.includes("watch") ? 0.8 : 1);
  }
  w.cooldown = Math.max(0, w.cooldown - STEP);
  const threats = r.enemies
    .filter((e) => e.hp > 0 && distance(w, positions.get(e.id)) < 0.14)
    .sort((a, b) => b.progress - a.progress);
  w.targetEnemy = w.deployed ? (threats[0]?.id ?? null) : null;
  if (w.deployed && w.cooldown < 1e-8 && threats.length) {
    const lamp = litBy(w),
      damage =
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
    if (
      enemy.type === "king" &&
      !enemy.enraged &&
      enemy.hp <= enemy.maxHp * 0.5
    ) {
      enemy.enraged = true;
      event(r, "enrage", { ...positions.get(enemy.id), lane: enemy.lane });
      tale(r, "The crown breaks. The Hollow king quickens its heavy strike.");
    }
    if (enemy.stun > 0) {
      enemy.stun = Math.max(0, enemy.stun - STEP);
      continue;
    }
    const def = ENEMIES[enemy.type],
      interval = def.interval * (enemy.enraged ? 0.72 : 1),
      damage = def.damage + (enemy.enraged ? 4 : 0);
    let target = null;
    if (enemy.raid) {
      const site = r.slots.find((s) => s.id === enemy.raid);
      const length = Math.max(
        0.01,
        distance(
          site,
          routePoint(
            mapLanes(r.town)[enemy.lane],
            enemy.progress,
            r.town,
            4,
            r.layout,
          ),
        ),
      );
      enemy.detour = Math.max(
        0,
        Math.min(
          1,
          enemy.detour +
            ((site.building?.type === "farm" ? 1 : -1) * 0.065 * STEP) / length,
        ),
      );
      if (!site.building && enemy.detour === 0) {
        enemy.raid = null;
        enemy.raided = true;
        enemy.windup = interval;
        continue;
      }
      if (enemy.detour < 1 || !site.building) continue;
      target = site;
    } else {
      const wall = r.slots
        .filter(
          (s) =>
            s.lane === enemy.lane &&
            s.building?.type === "wall" &&
            s.progress >= enemy.progress - 0.005,
        )
        .sort((a, b) => a.progress - b.progress)[0];
      const farm =
        enemy.type === "runner" && !enemy.raided
          ? r.slots
              .filter(
                (s) =>
                  s.lane === enemy.lane &&
                  s.building?.type === "farm" &&
                  s.progress >= enemy.progress - 0.005 &&
                  (!wall || s.progress < wall.progress),
              )
              .sort((a, b) => a.progress - b.progress)[0]
          : null;
      const endpoint = farm?.progress ?? wall?.progress ?? 1;
      if (enemy.progress < endpoint - 1e-8) {
        const lamp = litBy(positions.get(enemy.id));
        enemy.progress = Math.min(
          endpoint,
          enemy.progress +
            def.speed *
              STEP *
              (0.405 / routeLength(r.town, enemy.lane, r.layout)) *
              (lamp ? (lamp.building.branch === "reach" ? 0.5 : 0.7) : 1),
        );
        enemy.windup = interval;
        enemy.warned = false;
        continue;
      }
      if (farm) {
        enemy.raid = farm.id;
        enemy.detour = 0;
        r.stats.raids++;
        event(r, "raid", {
          lane: enemy.lane,
          ...positions.get(enemy.id),
          site: farm.id,
        });
        continue;
      }
      target = wall;
    }
    enemy.windup -= STEP;
    if (
      ["brute", "king"].includes(enemy.type) &&
      enemy.windup <= 1.1 &&
      !enemy.warned
    ) {
      enemy.warned = true;
      event(r, "windup", {
        ...positions.get(enemy.id),
        lane: enemy.lane,
        enemy: enemy.id,
      });
    }
    if (enemy.windup > 1e-8) continue;
    enemy.windup = interval;
    enemy.warned = false;
    if (target) {
      target.building.hp -= damage;
      event(r, "bite", {
        x: target.x,
        y: target.y,
        damage,
        material: target.building.type,
        lane: enemy.lane,
      });
      if (target.building.branch === "thorns") {
        hurt(enemy, 4, "thorns", { x: target.x, y: target.y });
        enemy.stun = 0.6;
      }
      if (target.building.hp <= 0) {
        const name = BUILDINGS[target.building.type].name;
        if (r.blessings.includes("salvage"))
          r.glow += Math.floor(BUILDINGS[target.building.type].cost / 2);
        r.ruins = r.ruins.filter((x) => x.slot !== target.id);
        r.ruins.push({ slot: target.id, type: target.building.type });
        target.building = null;
        r.stats.lost++;
        event(r, "fall", { x: target.x, y: target.y, lane: enemy.lane });
        r.lastLoss = `${name} fell on ${mapLanes(r.town)[enemy.lane].name}.`;
        tale(r, r.lastLoss);
        incident(r, "fall", enemy.lane, r.lastLoss);
      }
    } else {
      r.heart = Math.max(0, r.heart - damage);
      r.stats.damage += damage;
      r.lastLoss = `${def.name} reached the Hearth along ${mapLanes(r.town)[enemy.lane].name}.`;
      event(r, "heart", { damage, lane: enemy.lane });
      incident(r, "heart", enemy.lane, r.lastLoss);
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
    r.dawnReport = {
      night: r.night,
      income:
        !r.endless && r.completed >= TOWNS[r.town].nights ? 0 : dawnIncome(r),
      farms: r.slots
        .filter((s) => s.building?.type === "farm")
        .reduce((sum, s) => sum + farmIncome(s.building, r.kit), 0),
      kills: r.stats.kills - (r.nightStart?.kills || 0),
      lost: r.stats.lost - (r.nightStart?.lost || 0),
      damage: r.stats.damage - (r.nightStart?.damage || 0),
      standing: r.slots.filter((s) => s.building).length,
      interrupts: r.stats.interrupts - (r.nightStart?.interrupts || 0),
      raids: r.stats.raids - (r.nightStart?.raids || 0),
    };
    r.waveHistory.push({ night: r.night, heart: r.heart, seconds: r.waveTime });
    if (r.scenario || (!r.endless && r.completed >= TOWNS[r.town].nights)) {
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
  if (state.round && !state.round.rules) return legacyAdvance(state, dt);
  if (state.round?.rules === 3) return previousAdvance(state, dt);
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
  if (r.phase !== "night" || r.carry < 1e-9) r.carry = 0;
  return { ...state, round: r };
}

// A portable reproducer contains scenario seed and timestamped player commands.
// Simulation time, rather than wall time, makes pause and speed settings irrelevant.
export function replayRound(record) {
  if (record && !record.rules) return legacyReplay(record);
  if (record?.rules === 3) return previousReplay(record);
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
  state = record.scenario
    ? startScenario(record.scenario)
    : startGame(
        state,
        record.town,
        record.seed,
        record.endless,
        record.challenge || "standard",
      );
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

export function validScenario(def) {
  return Boolean(
    def &&
      known(TOWNS, def.town) &&
      known(KITS, def.kit) &&
      Number.isInteger(def.seed) &&
      def.seed >= 0 &&
      def.seed <= 4294967295 &&
      Number.isInteger(def.night) &&
      def.night >= 1 &&
      def.night <= 6 &&
      Number.isFinite(def.budget) &&
      def.budget >= 0 &&
      def.budget <= 500 &&
      validLayout(def.layout, def.town) &&
      validGroups(def.groups, def.town),
  );
}
export function startScenario(definition) {
  if (!validScenario(definition))
    throw new Error(
      "Invalid encounter: check roads, plots, spawn groups and budget.",
    );
  const def = copy(definition),
    state = freshGame();
  state.kit = def.kit;
  state.wins = Object.fromEntries(Object.keys(TOWNS).map((id) => [id, 1]));
  const s = startGame(state, def.town, def.seed);
  Object.assign(s.round, {
    layout: def.layout || null,
    scenario: def,
    slots: createMap(def.town, 4, def.layout).slots,
    glow: def.budget,
    night: def.night,
    completed: def.night - 1,
    wave: waveFromGroups(def.groups, def.seed, def.night),
  });
  return s;
}
