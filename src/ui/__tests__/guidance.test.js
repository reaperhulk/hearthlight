import { describe, it, expect } from "vitest";
import {
  advance,
  command,
  freshGame,
  startGame,
  replayRound,
} from "../../engine/campaign.js";
import {
  introduction,
  pauseForLesson,
  defeatExplanation,
} from "../guidance.js";
import { finishCampaign } from "../../../scripts/campaign-balance.js";

describe("lessons and earned challenges", () => {
  it("teaches the wall then Warden and reaches dawn without a first-night tower", () => {
    let s = startGame(freshGame(), "first", 42);
    expect(introduction(s.round).plot).toBe("0-2");
    s = command(s, { type: "build", slot: "0-2", building: "farm" });
    expect(introduction(s.round).plot).toBe("0-0");
    s = command(s, { type: "build", slot: "0-0", building: "wall" });
    s = command(s, { type: "start" });
    for (let i = 0; i < 100 && !s.round.paused; i++)
      s = pauseForLesson(advance(s, 0.1));
    expect(s.round.lessons).toEqual(["wall"]);
    expect(s.round.heart).toBe(100);
    s = command(s, { type: "rally", lane: 0, progress: 0.33 });
    s = command(s, { type: "pause" });
    for (let i = 0; i < 600 && s.round.phase === "night"; i++)
      s = advance(s, 0.1);
    expect(s.round.phase).toBe("day");
    expect(s.round.heart).toBe(100);
    expect(s.round.dawnReport.income).toBe(40);
    expect(introduction(s.round).card).toBe("tower");
    expect(replayRound(s.round).round).toEqual(s.round);
  });
  it("records the actual breach chain and unused emergency response", () => {
    let s = startGame(freshGame(), "first", 42);
    s = command(s, { type: "build", slot: "0-0", building: "wall" });
    s = command(s, { type: "start" });
    for (let i = 0; i < 1200 && s.round.phase === "night"; i++)
      s = advance(s, 0.1);
    expect(s.round.phase).toBe("lost");
    const result = defeatExplanation(s.round);
    expect(result.chain[0]).toContain("Timber wall fell on North road");
    expect(result.chain.at(-1)).toContain("reached the Heart");
    expect(result.advice).toContain("2 burst charges");
  });
  it("a no-burst challenge is locked until victory, completable and replayable", () => {
    const fresh = freshGame();
    expect(startGame(fresh, "first", 42, false, "no-bursts")).toBe(fresh);
    fresh.wins.first = 1;
    let s = startGame(fresh, "first", 42, false, "no-bursts");
    s = finishCampaign(s);
    expect(s.round.phase).toBe("won");
    expect(s.round.stats.bursts).toBe(0);
    expect(s.round.blessings).not.toContain("reserves");
    expect(replayRound(s.round).round).toEqual(s.round);
  });
});

it("keeps input diagnostics local and optional, including rejected purchases", () => {
  let s = startGame(freshGame());
  const rejected = { type: "upgrade", slot: "0-0", branch: "stone" };
  expect(command(s, rejected)).toBe(s);
  s = command(s, { type: "setting", key: "recording", value: true });
  s = command(s, rejected, 1234);
  expect(s.playtestLog.at(-1)).toMatchObject({
    type: "upgrade",
    accepted: false,
    wallTime: 1234,
  });
  s = finishCampaign(s);
  const round = s.round;
  s = command(s, { type: "collect" });
  expect(s.lastPlaytestRound).toEqual(round);
  expect(s.playtestLog.at(-1)).toMatchObject({
    type: "collect",
    accepted: true,
  });
});
