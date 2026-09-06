import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import {
  advance,
  command,
  dawnIncome,
  freshGame,
  startGame,
  maxHp,
  repairCost,
  reward,
} from "../src/engine/campaign.js";
import { mapLanes, TOWNS } from "../src/engine/content.js";

// Transparent heuristics, not claims about optimal play or a median human.
export function planDay(state, style = "fortress", startNight = true) {
  let s = state;
  const act = (action) => {
    s = command(s, action);
  };
  if (s.round.offers.length)
    act({
      type: "blessing",
      id:
        s.round.offers.find((id) =>
          style === "warden"
            ? ["chain", "reserves", "kindle"].includes(id)
            : ["shelter", "watch"].includes(id),
        ) || s.round.offers[0],
    });
  if (style === "passive") return command(s, { type: "start" });
  const lanes = mapLanes(s.round.town);
  const threatened = lanes.filter((l) =>
    s.round.wave.some((e) => e.lane === l.id),
  );
  for (const lane of threatened) {
    if (!s.round.slots.find((p) => p.id === `${lane.id}-1`).building)
      act({ type: "build", slot: `${lane.id}-1`, building: "tower" });
    if (!s.round.slots.find((p) => p.id === `${lane.id}-0`).building)
      act({ type: "build", slot: `${lane.id}-0`, building: "wall" });
  }
  for (const slot of s.round.slots)
    if (
      slot.building &&
      slot.building.hp < maxHp(slot.building, s.round.kit) * 0.7 &&
      s.round.glow >= repairCost(s.round)
    )
      act({ type: "repair", slot: slot.id });
  if (s.round.night < 4)
    for (const lane of lanes) {
      const id = `${lane.id}-2`;
      if (
        !s.round.slots.find((p) => p.id === id).building &&
        s.round.glow >= 14
      ) {
        act({ type: "build", slot: id, building: "farm" });
        break;
      }
    }
  for (const lane of threatened) {
    const id = `${lane.id}-3`;
    if (
      !s.round.slots.find((p) => p.id === id).building &&
      s.round.glow >= (style === "warden" ? 16 : 36)
    )
      act({ type: "build", slot: id, building: "lantern" });
  }
  for (const slot of s.round.slots)
    if (slot.building && !slot.building.branch && s.round.glow >= 24) {
      const branch =
        slot.building.type === "tower"
          ? style === "volley"
            ? "volley"
            : "pierce"
          : slot.building.type === "wall"
            ? "stone"
            : slot.building.type === "farm"
              ? "harvest"
              : "courage";
      act({ type: "upgrade", slot: slot.id, branch });
    }
  return startNight ? command(s, { type: "start" }) : s;
}

export function nightAction(state, style = "fortress") {
  let s = state;
  if (style === "passive" || style === "builder" || !s.round.enemies.length)
    return s;
  const threats = [...s.round.enemies].sort((a, b) => b.progress - a.progress);
  const urgent = threats[0];
  s = command(s, {
    type: "rally",
    lane: urgent.lane,
    progress: Math.max(0.3, urgent.progress + 0.04),
  });
  const count = s.round.enemies.filter(
    (e) => e.lane === urgent.lane && e.hp > 0,
  ).length;
  if (
    urgent.progress > 0.8 ||
    count >= 3 ||
    (urgent.type === "brute" && urgent.progress > 0.3)
  )
    s = command(s, { type: "burst", lane: urgent.lane });
  return s;
}

export function finishCampaign(initial, style = "fortress", limit = 1200) {
  let state = initial,
    elapsed = 0,
    iteration = 0;
  while (["day", "night"].includes(state.round.phase) && elapsed < limit) {
    if (state.round.phase === "day") state = planDay(state, style);
    // "delayed" is explicitly four-second input, not a simulated human.
    if (iteration % (style === "delayed" ? 40 : 10) === 0)
      state = nightAction(state, style);
    state = advance(state, 0.1);
    elapsed += 0.1;
    iteration++;
  }
  return state;
}

export function playCampaign(
  town = "first",
  seed = 42,
  style = "fortress",
  kit = "keeper",
  endless = false,
  limit = 1200,
) {
  let state = freshGame();
  state.wins = { first: 1, meadow: 1, marsh: 1, ridge: 1 };
  state.kit = kit;
  state = finishCampaign(startGame(state, town, seed, endless), style, limit);
  return {
    town,
    seed,
    style,
    kit,
    outcome: state.round.phase,
    nights: state.round.completed,
    seconds: Math.round(state.round.time),
    heart: state.round.heart,
    income: dawnIncome(state.round),
    kills: state.round.stats.kills,
    wardenKills: state.round.stats.wardenKills,
    bursts: state.round.stats.bursts,
    lostBuildings: state.round.stats.lost,
    embers: reward(state.round),
    state,
  };
}

export const SEEDS = [42, 1337, 271828, 314159, 861861];
export const STYLES = [
  "fortress",
  "volley",
  "warden",
  "delayed",
  "builder",
  "passive",
];
export function campaignReport(seeds = SEEDS) {
  return Object.keys(TOWNS).flatMap((town) =>
    STYLES.flatMap((style) =>
      seeds.map((seed) => {
        const { state: _, ...result } = playCampaign(town, seed, style);
        return result;
      }),
    ),
  );
}

export function assertCampaigns(results) {
  if (results.some((r) => !["won", "lost"].includes(r.outcome)))
    throw new Error("A campaign failed to finish");
  if (
    results
      .filter((r) => ["fortress", "volley", "warden"].includes(r.style))
      .some((r) => r.outcome !== "won")
  )
    throw new Error("A standard town must be winnable with the free kit");
  if (
    results
      .filter((r) => r.town === "first" && r.style === "delayed")
      .some((r) => r.outcome !== "won")
  )
    throw new Error("Introduction needs to tolerate four-second reactions");
  if (
    results
      .filter((r) => r.style === "passive")
      .some((r) => r.outcome === "won" || r.embers > 0)
  )
    throw new Error("No-action play must not earn a win or idle currency");
  if (
    results
      .filter((r) => r.town === "first" && r.outcome === "won")
      .some((r) => r.embers < 12 || r.seconds > 240)
  )
    throw new Error(
      "A first win must earn a starting kit in under four minutes of combat",
    );
  for (const seed of SEEDS) {
    let state = freshGame();
    for (const town of Object.keys(TOWNS)) {
      state = finishCampaign(startGame(state, town, seed));
      if (state.round?.phase !== "won")
        throw new Error(`Fresh-save progression failed at ${town} / ${seed}`);
      state = command(state, { type: "collect" });
    }
    const endless = playCampaign(
      "ridge",
      seed,
      "fortress",
      "ranger",
      true,
      3600,
    );
    if (endless.outcome !== "lost" || endless.nights < 6)
      throw new Error(
        `Endless must go beyond the campaign and eventually fall: ${seed}`,
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const results = campaignReport();
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(results, null, 2));
  else if (process.argv.includes("--story")) {
    const index = process.argv.indexOf("--seed");
    const seed = index < 0 ? 42 : Number(process.argv[index + 1]);
    const result = playCampaign("meadow", seed);
    console.log(
      JSON.stringify(
        {
          seed,
          nights: result.state.round.waveHistory,
          outcome: result.outcome,
          embers: result.embers,
        },
        null,
        2,
      ),
    );
  } else {
    for (const town of Object.keys(TOWNS))
      for (const style of STYLES) {
        const group = results.filter(
          (r) => r.town === town && r.style === style,
        );
        console.log(
          `${town.padEnd(7)} ${style.padEnd(8)} ${group.filter((r) => r.outcome === "won").length}/${group.length} wins; ${Math.round(group.reduce((sum, r) => sum + r.seconds, 0) / group.length)}s combat; ${Math.round(group.reduce((sum, r) => sum + r.heart, 0) / group.length)} Hearth`,
        );
      }
  }
  if (process.argv.includes("--assert")) {
    assertCampaigns(results);
    console.log(
      "Campaign, earned-reward, fresh-save progression and endless guards passed.",
    );
  }
  const compare = process.argv.indexOf("--compare");
  if (compare >= 0) {
    const baseline = JSON.parse(
      readFileSync(process.argv[compare + 1], "utf8"),
    );
    if (JSON.stringify(results) !== JSON.stringify(baseline))
      throw new Error(
        "Balance changed. Inspect the change before updating the baseline.",
      );
    console.log("Balance matches the committed deterministic baseline.");
  }
}
