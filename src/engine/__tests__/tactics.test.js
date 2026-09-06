import { expect, it } from "vitest";
import {
  advance,
  command,
  freshGame,
  startGame,
  enemyPosition,
  migrateGame,
  replayRound,
} from "../campaign.js";
import {
  ENEMIES,
  buildCost,
  flareCharges,
  startingGlow,
  routeLength,
} from "../content.js";
const night = () =>
  command(startGame(freshGame(), "first", 42), { type: "start" });
const enemy = (type, progress) => ({
  id: "probe",
  type,
  lane: 0,
  progress,
  hp: ENEMIES[type].hp,
  maxHp: ENEMIES[type].hp,
  windup: ENEMIES[type].interval,
  stun: 0,
  burn: 0,
  burnRate: 0,
  raid: null,
  detour: 0,
  raided: false,
});
it("a guard order follows a changing road threat without repeated commands", () => {
  let s = command(night(), { type: "rally", lane: 0, mode: "guard" });
  const order = { type: "rally", lane: 0, mode: "guard" };
  expect(command(s, order)).toBe(s);
  s = advance(s, 4);
  const first = s.round.warden.targetY;
  s = advance(s, 3);
  expect(s.round.warden.targetY).not.toBe(first);
  expect(s.round.stats.orders).toBe(1);
  expect(replayRound(s.round).round).toEqual(s.round);
  s = command(s, { type: "rally", lane: 0, mode: "hold", progress: 0.5 });
  const held = s.round.warden.targetY;
  s = advance(s, 2);
  expect(s.round.warden.targetY).toBe(held);
});
it("a Skitter walks to a farm, attacks there, and returns to the road", () => {
  let s = night();
  s.round.wave = [];
  s.round.enemies = [enemy("runner", 0.64)];
  s = advance(s, 0.55);
  expect(s.round.enemies[0].raid).toBe("0-2");
  expect(enemyPosition(s.round, s.round.enemies[0]).x).not.toBe(0.5);
  expect(s.round.slots[2].building.hp).toBe(22);
  s = advance(s, 3);
  expect(s.round.slots[2].building.hp).toBeLessThan(22);
  expect(s.round.heart).toBe(100);
  s = advance(s, 8);
  expect(s.round.slots[2].building).toBeNull();
  expect(s.round.ruins).toEqual([{ slot: "0-2", type: "farm" }]);
  expect(s.round.enemies[0].raided).toBe(true);
  expect(enemyPosition(s.round, s.round.enemies[0]).x).toBe(0.5);
});
it("a flare interrupts the king's visible second-phase strike", () => {
  let s = startGame(freshGame());
  s = command(s, { type: "build", slot: "0-0", building: "wall" });
  s = command(s, { type: "start" });
  s.round.wave = [];
  s.round.enemies = [{ ...enemy("king", 0.3), hp: 70, windup: 0.7 }];
  s = advance(s, 0.05);
  expect(s.round.enemies[0].enraged).toBe(true);
  expect(s.round.enemies[0].warned).toBe(true);
  s = command(s, { type: "burst", lane: 0 });
  expect(s.round.stats.interrupts).toBe(1);
  s = advance(s, 2);
  expect(s.round.slots[0].building.hp).toBe(65);
});
it("kits trade emergency flexibility or starting budget for specialization", () => {
  expect(flareCharges("keeper")).toBeGreaterThan(flareCharges("ranger"));
  expect(buildCost("tower", "ranger")).toBeGreaterThan(
    buildCost("tower", "keeper"),
  );
  expect(startingGlow("meadow", "mason")).toBeLessThan(
    startingGlow("meadow", "keeper"),
  );
  expect(startingGlow("meadow", "gardener")).toBeLessThan(
    startingGlow("meadow", "keeper"),
  );
  expect(routeLength("marsh", 0)).toBeGreaterThan(routeLength("meadow", 0));
});
it("rejects a saved raid or guard order pointing outside its map", () => {
  let s = night();
  s.round.enemies = [
    { ...enemy("runner", 0.64), raid: "missing", detour: 0.5 },
  ];
  expect(migrateGame(s).round).toBeNull();
  s = night();
  s.round.warden.mode = "guard";
  s.round.warden.lane = 99;
  expect(migrateGame(s).round).toBeNull();
});
