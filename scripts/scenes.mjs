import {
  advance,
  command,
  freshGame,
  startGame,
} from "../src/engine/campaign.js";
import { planDay, nightAction } from "./campaign-balance.js";

// Fixtures are reached through the same commands and maps as a real save.
export function scene(name) {
  let state = freshGame();
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
        time: r.time,
      }
    : { phase: "home" };
}
