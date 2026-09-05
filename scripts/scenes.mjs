import {
  advance,
  command,
  freshGame,
  startGame,
} from "../src/engine/campaign.js";
import { BUILDINGS } from "../src/engine/content.js";
import { planDay, nightAction } from "./campaign-balance.js";

// Fixtures are reached through the same commands and maps as a real save.
export function scene(name) {
  let state = freshGame();
  if (name.startsWith("full-")) return fullTown(name.endsWith("battle"));
  if (name === "home") return state;
  if (name === "first-day") {
    state = startGame(state, "first", 42);
    for (const [slot, building] of [
      ["0-2", "farm"],
      ["0-0", "wall"],
      ["0-1", "tower"],
    ])
      state = command(state, { type: "build", slot, building });
    return state;
  }
  const town = name.startsWith("marsh")
    ? "marsh"
    : name.startsWith("ridge")
      ? "ridge"
      : "first";
  state.wins = { first: 1, meadow: 1, marsh: 1 };
  state = startGame(state, town, 42);
  for (let i = 0; i < 9000; i++) {
    const r = state.round;
    if (name === "victory" && r.phase === "won") return state;
    if (
      name.endsWith("battle") &&
      r.night === 6 &&
      r.phase === "night" &&
      r.enemies.length >= 5
    )
      return state;
    if (name === "ridge-day" && r.night === 6 && r.phase === "day")
      return state;
    if (!["day", "night"].includes(r.phase)) break;
    if (r.phase === "day") state = planDay(state);
    if (i % 10 === 0) state = nightAction(state);
    state = advance(state, 0.1);
  }
  throw new Error(`Scene was not reached: ${name}`);
}

export function describeScene(state) {
  const r = state.round;
  return r
    ? {
        town: r.town,
        phase: r.phase,
        night: r.night,
        enemies: r.enemies.length,
        built: r.slots.filter((s) => s.building).length,
        upgraded: r.slots.filter((s) => s.building?.branch).length,
        mist: r.enemies.filter((e) => e.type === "mist").length,
        recentImpacts: r.events.filter(
          (e) => e.type === "hit" && r.time - e.time < 0.5,
        ).length,
        time: r.time,
      }
    : { phase: "home" };
}

function fullTown(battle) {
  let s = freshGame();
  s.wins = { first: 1, meadow: 1, marsh: 1, ridge: 1 };
  s = startGame(s, "ridge", 42, true);
  for (let i = 0; i < 30000 && ["day", "night"].includes(s.round.phase); i++) {
    if (s.round.phase === "day") {
      s = planDay(s, "fortress", false);
      for (const slot of s.round.slots) {
        if (!slot.building)
          s = command(s, {
            type: "build",
            slot: slot.id,
            building: ["wall", "tower", "farm", "lantern"][slot.index],
          });
        const b = s.round.slots.find((p) => p.id === slot.id).building;
        if (b && !b.branch)
          s = command(s, {
            type: "upgrade",
            slot: slot.id,
            branch: Object.keys(BUILDINGS[b.type].branches)[0],
          });
      }
      if (!battle && s.round.slots.every((p) => p.building?.branch)) return s;
      s = command(s, { type: "start" });
    }
    if (
      battle &&
      s.round.slots.every((p) => p.building?.branch) &&
      s.round.enemies.length >= 8 &&
      s.round.events.filter(
        (e) => e.type === "hit" && s.round.time - e.time < 0.5,
      ).length >= 2
    )
      return s;
    if (i % 10 === 0) s = nightAction(s);
    s = advance(s, 0.1);
  }
  throw new Error("Could not reach a fully upgraded town");
}
