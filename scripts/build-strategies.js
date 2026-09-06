import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  advance,
  command,
  freshGame,
  maxHp,
  startGame,
} from "../src/engine/campaign.js";
import { TOWNS } from "../src/engine/content.js";
import { nightAction, SEEDS } from "./campaign-balance.js";

// Three deliberately different purchase orders on identical waves. These are
// reachability examples, not optimal policies or claims about human enjoyment.
export function buildPlan(state, strategy) {
  let s = state;
  const act = (a) => {
    s = command(s, a);
  };
  const build = (slot, building) => act({ type: "build", slot, building });
  const upgrade = (slot, branch) => act({ type: "upgrade", slot, branch });
  const lanes = [...new Set(s.round.wave.map((e) => e.lane))];
  const priority =
    strategy === "lantern-warden"
      ? ["chain", "kindle", "reserves"]
      : ["watch", "shelter", "reserves"];
  if (s.round.offers.length)
    act({
      type: "blessing",
      id:
        priority.find((id) => s.round.offers.includes(id)) || s.round.offers[0],
    });
  for (const slot of s.round.slots)
    if (
      slot.building &&
      slot.building.hp < maxHp(slot.building, s.round.kit) * 0.7
    )
      act({ type: "repair", slot: slot.id });
  if (strategy === "lantern-warden") {
    build("0-3", "tower");
    build("0-1", "lantern");
    build("0-0", "wall");
    if (s.round.night < 4) build("0-2", "farm");
    if (s.round.town === "ridge" && s.round.night >= 3) build("2-3", "tower");
    for (const lane of lanes) {
      build(`${lane}-0`, "wall");
      build(`${lane}-1`, "lantern");
    }
    for (const lane of lanes) {
      upgrade(`${lane}-1`, "courage");
      upgrade(`${lane}-0`, "thorns");
    }
    upgrade("0-3", "volley");
  } else if (strategy === "harvest-battery") {
    build("0-3", "tower");
    if (s.round.night < 4) for (const lane of lanes) build(`${lane}-2`, "farm");
    for (const lane of lanes) build(`${lane}-3`, "tower");
    if (s.round.night < 4)
      for (const lane of lanes) upgrade(`${lane}-2`, "harvest");
    for (const lane of lanes) {
      upgrade(`${lane}-3`, "volley");
      build(`${lane}-0`, "wall");
    }
  } else {
    for (const lane of lanes) {
      build(`${lane}-0`, "wall");
      build(`${lane}-1`, "tower");
    }
    for (const lane of lanes) {
      upgrade(`${lane}-0`, "stone");
      upgrade(`${lane}-1`, "pierce");
    }
    for (const lane of lanes) build(`${lane}-3`, "tower");
  }
  return command(s, { type: "start" });
}
export const STRATEGIES = ["stone-choke", "harvest-battery", "lantern-warden"];
export function playBuild(town, seed, strategy) {
  let s = freshGame();
  s.wins = { first: 1, meadow: 1, marsh: 1, ridge: 1 };
  s = startGame(s, town, seed);
  for (let i = 0; i < 12000 && ["day", "night"].includes(s.round.phase); i++) {
    if (s.round.phase === "day") s = buildPlan(s, strategy);
    if (i % 10 === 0) s = nightAction(s);
    s = advance(s, 0.1);
  }
  return s;
}
export function strategyReport() {
  return Object.keys(TOWNS).flatMap((town) =>
    STRATEGIES.flatMap((strategy) =>
      SEEDS.map((seed) => {
        const r = playBuild(town, seed, strategy).round;
        return {
          town,
          seed,
          strategy,
          outcome: r.phase,
          heart: r.heart,
          completed: r.completed,
          wardenShare: Math.round((100 * r.stats.wardenKills) / r.stats.kills),
          startingFarms: r.town === "first" ? 1 : 0,
          incomeBuilt: r.commands.filter(
            (c) => c.type === "build" && c.building === "farm",
          ).length,
          towersBuilt: r.commands.filter(
            (c) => c.type === "build" && c.building === "tower",
          ).length,
          lost: r.stats.lost,
        };
      }),
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const results = strategyReport();
  assert.ok(
    results.every((r) => r.outcome === "won"),
    "A documented build no longer completes a town",
  );
  assert.ok(
    results
      .filter((r) => r.strategy === "stone-choke")
      .every((r) => r.incomeBuilt === 0),
  );
  assert.ok(
    results
      .filter((r) => r.strategy === "harvest-battery")
      .every((r) => r.incomeBuilt + r.startingFarms >= 2),
  );
  assert.ok(
    results
      .filter((r) => r.strategy === "lantern-warden")
      .every(
        (r) =>
          r.wardenShare >= 60 && r.towersBuilt <= (r.town === "ridge" ? 2 : 1),
      ),
  );
  console.log(JSON.stringify(results, null, 2));
}
