import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  advance,
  command,
  startScenario,
  replayRound,
} from "../src/engine/campaign.js";
import { SCENARIOS } from "../src/engine/scenarios.js";
import { SEEDS } from "./campaign-balance.js";
export function playTactic(id, policy, seed = 42) {
  let s = startScenario({ ...SCENARIOS[id], seed });
  for (const [slot, building] of [
    ["0-0", "wall"],
    ["0-1", "tower"],
    ...(id === "mill"
      ? [
          ["1-2", "farm"],
          ["1-3", "tower"],
        ]
      : []),
  ])
    s = command(s, { type: "build", slot, building });
  s = command(s, { type: "upgrade", slot: "0-0", branch: "stone" });
  if (id !== "mill")
    s = command(s, { type: "upgrade", slot: "0-1", branch: policy });
  s = command(s, { type: "start" });
  for (let i = 0; i < 2000 && s.round.phase === "night"; i++) {
    if (
      id === "mill" &&
      i % 10 === 0 &&
      s.round.enemies.some((e) => e.hp > 0)
    ) {
      const leading = [...s.round.enemies]
        .filter((e) => e.hp > 0)
        .sort((a, b) => b.progress - a.progress)[0];
      const lane =
        policy === "mill-first" &&
        s.round.waveTime >= 10 &&
        s.round.waveTime < 24
          ? 1
          : leading.lane;
      s = command(s, { type: "rally", mode: "guard", lane });
    }
    s = advance(s, 0.1);
  }
  return s;
}
export function tacticalReport() {
  return SEEDS.flatMap((seed) =>
    ["mill", "swarm", "veil"].flatMap((id) =>
      (id === "mill" ? ["leading", "mill-first"] : ["pierce", "volley"]).map(
        (policy) => {
          const s = playTactic(id, policy, seed),
            r = s.round;
          assert.equal(
            r.phase,
            "won",
            `${id}/${policy}/${seed} did not finish`,
          );
          assert.deepEqual(replayRound(r).round, r, "Scenario replay diverged");
          return {
            id,
            policy,
            seed,
            heart: r.heart,
            lost: r.stats.lost,
            wall: r.slots[0].building?.hp || 0,
            farm: r.slots.find((s) => s.id === "1-2").building?.hp || 0,
            seconds: r.time,
            orders: r.stats.orders,
          };
        },
      ),
    ),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const results = tacticalReport();
  for (const seed of SEEDS) {
    const find = (id, policy) =>
      results.find(
        (r) => r.seed === seed && r.id === id && r.policy === policy,
      );
    assert.equal(find("mill", "leading").farm, 0);
    assert.ok(find("mill", "mill-first").farm > 0);
    assert.ok(find("swarm", "volley").wall > find("swarm", "pierce").wall);
    assert.ok(find("veil", "pierce").wall > find("veil", "volley").wall);
  }
  console.log(JSON.stringify(results, null, 2));
}
