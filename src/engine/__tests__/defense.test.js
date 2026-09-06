import { describe, expect, it } from "vitest";
import {
  advance,
  blessingOffers,
  command,
  freshGame,
  migrateGame,
  replayRound,
  startGame,
} from "../campaign.js";
import { ENEMIES } from "../content.js";
import { finishCampaign } from "../../../scripts/campaign-balance.js";

const start = () => startGame(freshGame(), "first", 42);
const enemy = (id, type = "shade", progress = 0.3) => ({
  id,
  type,
  lane: 0,
  progress,
  hp: ENEMIES[type].hp,
  maxHp: ENEMIES[type].hp,
  windup: 0.01,
  stun: 0,
  burn: 0,
  burnRate: 0,
});
function freeze(value) {
  Object.freeze(value);
  for (const item of Object.values(value))
    if (item && typeof item === "object" && !Object.isFrozen(item))
      freeze(item);
  return value;
}
function nightWith(enemies, setup = []) {
  let s = start();
  for (const action of setup) s = command(s, action);
  s = command(s, { type: "start" });
  s.round.wave = [];
  s.round.enemies = enemies;
  return s;
}
const build = (slot, building) => ({ type: "build", slot, building });

describe("combat and persistence regressions", () => {
  it("ordinary attackers pass a roadside lantern without damaging it", () => {
    let s = nightWith(
      [enemy("biter"), enemy("walker", "shade", 0.2)],
      [build("0-0", "lantern")],
    );
    s.round.slots[0].building.hp = 1;
    s = advance(s, 0.05);
    expect(s.round.slots[0].building.hp).toBe(1);
    expect(s.round.enemies[1].progress).toBeGreaterThan(0.2);
    expect(s.round.heart).toBe(100);
  });
  it("simulation and commands leave the previous state untouched", () => {
    const state = freeze(
      nightWith([enemy("one")], [build("0-0", "wall"), build("0-1", "tower")]),
    );
    expect(() => advance(state, 2)).not.toThrow();
    expect(() =>
      command(state, { type: "rally", lane: 0, progress: 0.3 }),
    ).not.toThrow();
    expect(state.round.time).toBe(0);
    expect(state.round.warden.deployed).toBe(false);
  });
  it("an idle Warden does not silently defend a player who never deploys him", () => {
    const s = nightWith([enemy("one", "shade", 1)]);
    const next = advance(s, 1.2);
    expect(next.round.enemies[0].hp).toBe(16);
    expect(next.round.heart).toBeLessThan(100);
  });
  it("burst interrupts mist protection and Sunlance pierces it", () => {
    const fixture = () =>
      nightWith(
        [enemy("veil", "mist", 0.4), enemy("shade", "shade", 0.39)],
        [build("0-1", "tower")],
      );
    const fired = advance(fixture(), 0.05);
    expect(fired.round.enemies[0].hp).toBe(30);
    const protectedHit = advance(fired, 0.15);
    expect(protectedHit.round.enemies[0].hp).toBeCloseTo(30 - 5 * 0.65);
    let pierce = fixture();
    pierce.round.slots[1].building.branch = "pierce";
    pierce = advance(pierce, 0.2);
    expect(pierce.round.enemies[0].hp).toBe(20);
    const interrupted = advance(
      command(fixture(), { type: "burst", lane: 0 }),
      0.2,
    );
    expect(interrupted.round.enemies[0].hp).toBe(16);
  });
  it("Thorn barricades punish attackers without remote Hearth damage", () => {
    let s = nightWith(
      [enemy("one")],
      [
        build("0-0", "wall"),
        { type: "upgrade", slot: "0-0", branch: "thorns" },
      ],
    );
    s = advance(s, 0.05);
    expect(s.round.enemies[0].hp).toBe(12);
    expect(s.round.enemies[0].stun).toBe(0.6);
    expect(s.round.heart).toBe(100);
  });
  it("budget recovery cannot mint Glow by cycling move, sell and undo", () => {
    let s = command(start(), build("0-0", "wall"));
    s = command(s, { type: "move", slot: "0-0", to: "1-0" });
    s = command(s, { type: "undo" });
    expect(s.round.glow).toBe(start().round.glow - 12);
    s = command(s, { type: "sell", slot: "0-0" });
    s = command(s, { type: "undo" });
    expect(s.round.glow).toBe(start().round.glow - 12);
    expect(s.round.slots[0].building.type).toBe("wall");
  });
  it("a saved, resumed run remains replayable, including its automatic pause", () => {
    let s = command(start(), build("0-0", "wall"));
    s = command(s, { type: "start" });
    s = advance(s, 3);
    s = migrateGame(s);
    s = command(s, { type: "pause" });
    s = finishCampaign(s);
    expect(replayRound(s.round).round).toEqual(s.round);
  });
  it("explicitly rejects a recording that exceeded the bounded command log", () => {
    const s = start();
    s.round.replayTruncated = true;
    expect(() => replayRound(s.round)).toThrow("Invalid replay");
  });
  it("locks later towns and endless until their prerequisite victory is earned", () => {
    const s = freshGame();
    expect(startGame(s, "meadow")).toBe(s);
    expect(startGame(s, "first", 42, true)).toBe(s);
    expect(command(s, { type: "unlock", id: "ranger" })).toBe(s);
  });
  it("rejects broken effect roads and inherited names in imported data", () => {
    const s = start();
    s.round.events = [{ id: 1, time: 0, type: "burst", lane: 99 }];
    expect(migrateGame(s).round).toBeNull();
    const wrong = start();
    wrong.round.slots[0].building = { type: "constructor", hp: 1, cooldown: 0 };
    expect(migrateGame(wrong).round).toBeNull();
    expect(
      command(start(), { type: "build", slot: "0-0", building: "constructor" })
        .round.stats.built,
    ).toBe(0);
    const legacy = migrateGame({
      ...freshGame(),
      legacy: { bestNights: { bad: true } },
    });
    expect(legacy.legacy.bestNights).toBe(0);
  });
  it("the final dawn offers immediate combat benefits, while endless keeps economy choices", () => {
    let s = command(start(), { type: "build", slot: "0-2", building: "farm" });
    s.round.night = 3;
    s.round.completed = 2;
    s.round.glow = 100;
    for (let seed = 0; seed < 30; seed++) {
      s.round.seed = seed;
      expect(blessingOffers(s.round).sort()).toEqual([
        "kindle",
        "reserves",
        "watch",
      ]);
    }
    expect(command(s, { type: "build", slot: "1-2", building: "farm" })).toBe(
      s,
    );
    expect(
      command(s, { type: "upgrade", slot: "0-2", branch: "harvest" }),
    ).toBe(s);
    s.round.endless = true;
    expect(
      command(s, { type: "build", slot: "1-2", building: "farm" }).round
        .slots[6].building.type,
    ).toBe("farm");
    s.round.endless = false;
    s.round.offers = ["shelter", "salvage", "chain"];
    expect(migrateGame(s).round.offers.sort()).toEqual([
      "kindle",
      "reserves",
      "watch",
    ]);
  });
});
