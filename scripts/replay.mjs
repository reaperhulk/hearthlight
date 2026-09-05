import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { replayRound } from "../src/engine/campaign.js";
if (!process.argv[2])
  throw new Error("Usage: node scripts/replay.mjs playtest-record.json");
const report = JSON.parse(await readFile(process.argv[2], "utf8"));
const round = report.round || report;
const replay = replayRound(round).round;
const summary = (r) => ({
  town: r.town,
  seed: r.seed,
  phase: r.phase,
  night: r.night,
  heart: r.heart,
  glow: r.glow,
  stats: r.stats,
});
assert.deepEqual(
  summary(replay),
  summary(round),
  "Replay diverged: reproduce with the record's original build, then investigate the first changed command",
);
console.log(
  JSON.stringify(
    {
      recordedBuild: report.build || "not supplied",
      result: summary(replay),
      commands: round.commands.length,
      rejectedInputs: report.attempts?.filter((a) => !a.accepted).length || 0,
    },
    null,
    2,
  ),
);
