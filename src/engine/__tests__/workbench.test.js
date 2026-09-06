import { expect, it } from "vitest";
import {
  advance,
  command,
  startScenario,
  replayRound,
  validScenario,
  migrateGame,
} from "../campaign.js";
import { SCENARIOS } from "../scenarios.js";
import { ROUTES, createMap } from "../content.js";
import { indexReplay, seekReplay } from "../replay-view.js";
const run = () => {
  let s = startScenario(SCENARIOS.swarm);
  for (const action of [
    { type: "build", slot: "0-0", building: "wall" },
    { type: "upgrade", slot: "0-0", branch: "stone" },
    { type: "build", slot: "0-1", building: "tower" },
    { type: "upgrade", slot: "0-1", branch: "volley" },
    { type: "start" },
  ])
    s = command(s, action);
  return advance(s, 60);
};
it("edits real geometry and preserves sandbox saves and replays without earning rewards", () => {
  const def = structuredClone(SCENARIOS.mill);
  def.layout = {
    routes: structuredClone(ROUTES.meadow),
    slots: createMap("meadow").slots.map(({ building: _b, ...s }) => s),
  };
  def.layout.routes[0][0] = [0.6, 0.03];
  def.layout.slots[1].x += 0.02;
  const s = command(startScenario(def), { type: "start" });
  expect(migrateGame(JSON.parse(JSON.stringify(s))).round.scenario).toEqual(
    def,
  );
  expect(replayRound(s.round).round).toEqual(s.round);
  const end = run();
  expect(end.round.phase).toBe("won");
  const bank = command(end, { type: "collect" });
  expect(bank.embers).toBe(0);
  expect(bank.mastery).toEqual({});
  def.layout.routes[0][1] = def.layout.routes[0][0];
  expect(validScenario(def)).toBe(false);
});
it("seeks backwards and forwards through combat with the same state as a direct replay", () => {
  const end = run(),
    index = indexReplay(end.round);
  expect(index.matches).toBe(true);
  for (const time of [0, 5.35, 12, 2.1, end.round.time]) {
    const record = {
      ...end.round,
      time,
      commands: end.round.commands.filter((c) => c.time <= time),
    };
    expect(seekReplay(index, time).round).toEqual(replayRound(record).round);
  }
  expect(() => indexReplay({ ...end.round, time: 3601 })).toThrow(/one hour/);
});
