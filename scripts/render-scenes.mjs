// Direct Canvas2D render checks, independent of browser infrastructure.
// These are battlefield renders, not substitutes for browser layout QA.
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { startGame, freshGame, advance } from "../src/engine/campaign.js";
import { planDay, nightAction } from "./campaign-balance.js";
import {
  SIZE,
  paintGround,
  paintBuildings,
  paintLiving,
} from "../src/ui/village-draw.js";
globalThis.document = { createElement: () => createCanvas(60, 72) };
const out = process.argv[2] || "/tmp/hearthlight-render";
mkdirSync(out, { recursive: true });
const draw = (name, state) => {
  const final = createCanvas(SIZE, SIZE),
    ctx = final.getContext("2d");
  const ground = createCanvas(SIZE, SIZE),
    town = createCanvas(SIZE, SIZE),
    live = createCanvas(SIZE, SIZE);
  paintGround(
    ground.getContext("2d"),
    state.round.town,
    state.round.phase === "night",
  );
  paintBuildings(town.getContext("2d"), state.round);
  paintLiving(
    live.getContext("2d"),
    state.round,
    state.round,
    1,
    "0-1",
    true,
    state.round.time,
  );
  for (const layer of [ground, town, live]) ctx.drawImage(layer, 0, 0);
  writeFileSync(`${out}/${name}.png`, final.toBuffer("image/png"));
};
let state = startGame(freshGame(), "first", 42);
draw("first-day", state);
state = planDay(state);
state = advance(state, 8);
draw("first-night", state);
state = freshGame();
state.wins = { first: 1, meadow: 1, marsh: 1 };
state = startGame(state, "ridge", 42);
for (let i = 0; i < 4000 && ["day", "night"].includes(state.round.phase); i++) {
  if (state.round.phase === "day") state = planDay(state);
  if (i % 10 === 0) state = nightAction(state, "fortress");
  state = advance(state, 0.1);
  if (state.round.night === 6 && state.round.enemies.length >= 5) {
    draw("ridge-assault", state);
    break;
  }
}
console.log(`Rendered current scenario battlefields to ${out}`);
