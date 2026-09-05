import { describe, it, expect } from 'vitest';
import { advance, command, dawnIncome, freshGame, maxHp, migrateGame, reward, startGame } from '../campaign.js';
import { createMap, makeWave } from '../content.js';

function build(state, slot, building) { return command(state, { type: 'build', slot, building }); }
function start() { return startGame(freshGame(), 'first', 42); }

describe('the village campaign', () => {
  it('planning has no timer, and every accepted placement can be undone exactly', () => {
    let state = start();
    expect(advance(state, 60)).toBe(state);
    const before = state.round;
    state = build(state, '0-0', 'wall');
    expect(state.round.glow).toBe(before.glow - 12);
    state = command(state, { type: 'undo' });
    expect(state.round.slots).toEqual(before.slots);
    expect(state.round.glow).toBe(before.glow);
    expect(state.round.stats).toEqual(before.stats);
  });
  it('repeated retirement without completing a night earns no currency', () => {
    let state = freshGame();
    for (let i = 0; i < 10; i++) {
      state = startGame(state);
      state = command(state, { type: 'retire' });
      expect(reward(state.round)).toBe(0);
      state = command(state, { type: 'collect' });
    }
    expect(state.embers).toBe(0);
    expect(state.wins).toEqual({});
  });
  it('a wall blocks movement; its destruction never remotely wounds the Heart', () => {
    let state = build(start(), '0-0', 'wall');
    state = command(state, { type: 'start' });
    state.round.wave = [];
    state.round.slots[0].building.hp = 1;
    state.round.enemies = [{ id: 'test', type: 'shade', lane: 0, progress: 0.3, hp: 16, maxHp: 16, windup: 0.01, stun: 0, burn: 0, burnRate: 0 }];
    state = advance(state, 0.05);
    expect(state.round.slots[0].building).toBeNull();
    expect(state.round.heart).toBe(100);
    expect(state.round.enemies[0].progress).toBe(0.3);
    state = advance(state, 0.1);
    expect(state.round.enemies[0].progress).toBeGreaterThan(0.3);
  });
  it('damage to the Heart requires an enemy there and stops precisely on defeat', () => {
    let state = command(start(), { type: 'start' });
    state.round.heart = 1;
    state.round.wave = [];
    state.round.warden.x = 0;
    state.round.warden.y = 0;
    state.round.warden.targetX = 0;
    state.round.warden.targetY = 0;
    state.round.enemies = [{ id: 'test', type: 'brute', lane: 0, progress: 1, hp: 64, maxHp: 64, windup: 0.01, stun: 0, burn: 0, burnRate: 0 }];
    state = advance(state, 1);
    expect(state.round.phase).toBe('lost');
    expect(state.round.heart).toBe(0);
    expect(state.round.lastLoss).toContain('North road');
  });
  it('dawn estimates and upgrades share the actual income calculation', () => {
    let state = build(start(), '0-2', 'farm');
    state = command(state, { type: 'upgrade', slot: '0-2', branch: 'harvest' });
    const expected = dawnIncome(state.round);
    expect(expected).toBe(54);
    const before = state.round.glow;
    state = command(state, { type: 'start' });
    state.round.wave = [];
    state = advance(state, 0.05);
    expect(state.round.glow - before).toBe(expected);
    expect(state.round.completed).toBe(1);
  });
  it('bursts have a finite budget and empty-road clicks spend nothing', () => {
    let state = command(start(), { type: 'start' });
    expect(command(state, { type: 'burst', lane: 0 })).toBe(state);
    state = advance(state, 3);
    state = command(state, { type: 'burst', lane: 0 });
    expect(state.round.bursts).toBe(1);
    expect(state.round.enemies[0].stun).toBe(2);
    state = command(state, { type: 'burst', lane: 0 });
    expect(state.round.bursts).toBe(0);
    expect(command(state, { type: 'burst', lane: 0 })).toBe(state);
  });
  it('pausing prevents simulation and does not prevent planning commands', () => {
    let state = command(command(start(), { type: 'start' }), { type: 'pause' });
    expect(advance(state, 5)).toBe(state);
    state = command(state, { type: 'rally', lane: 0 });
    expect(state.round.warden.targetY).toBeLessThan(0.5);
  });
  it('different tick chunk sizes produce the same combat result', () => {
    let state = build(start(), '0-0', 'wall');
    state = build(state, '0-1', 'tower');
    state = command(state, { type: 'start' });
    let fine = state, coarse = state;
    for (let i = 0; i < 200; i++) fine = advance(fine, 0.05);
    for (let i = 0; i < 10; i++) coarse = advance(coarse, 1);
    expect({ ...fine.round, carry: 0 }).toEqual({ ...coarse.round, carry: 0 });
  });
  it('wave generation is independent of building choices and uses the real map', () => {
    expect(makeWave('first', 2, 42)).toEqual(makeWave('first', 2, 42));
    for (const town of ['first', 'meadow', 'marsh', 'ridge']) {
      const lanes = createMap(town).lanes.length;
      for (let night = 1; night <= 15; night++) expect(makeWave(town, night, 42).every(e => e.lane < lanes && e.at >= 2)).toBe(true);
    }
  });
  it('wins pay once and open the next town; unfinished runs cannot be collected', () => {
    let state = start();
    expect(command(state, { type: 'collect' })).toBe(state);
    state.round.phase = 'won'; state.round.completed = 3;
    state = command(state, { type: 'collect' });
    expect(state.embers).toBe(17);
    expect(state.wins.first).toBe(1);
    expect(command(state, { type: 'collect' })).toBe(state);
    expect(startGame(state, 'meadow').round.town).toBe('meadow');
  });
  it('specializations, repair and relocation retain meaningful budgets', () => {
    let state = build(start(), '0-0', 'wall');
    state = command(state, { type: 'upgrade', slot: '0-0', branch: 'stone' });
    expect(state.round.slots[0].building.hp).toBe(maxHp(state.round.slots[0].building, 'keeper'));
    expect(state.round.slots[0].building.hp).toBe(135);
    expect(command(state, { type: 'upgrade', slot: '0-0', branch: 'thorns' })).toBe(state);
    state = command(state, { type: 'move', slot: '0-0', to: '1-0' });
    expect(state.round.slots[4].building.branch).toBe('stone');
    expect(state.round.slots[0].building).toBeNull();
  });
  it('legacy progress is preserved and incompatible active rounds are archived', () => {
    const state = migrateGame({ saveVersion: 1, embers: 31, meta: { stoneFoundations: 2, swiftWarden: true }, bestNights: 12, totalRounds: 5, round: { phase: 'night' } });
    expect(state.embers).toBe(31);
    expect(state.unlocked).toEqual(['keeper', 'mason', 'ranger']);
    expect(state.round).toBeNull();
    expect(state.legacy.bestNights).toBe(12);
  });
  it('valid saves resume paused and malformed nested data cannot reach the renderer', () => {
    const state = build(start(), '0-0', 'wall');
    expect(migrateGame(state).round.paused).toBe(true);
    const bad = JSON.parse(JSON.stringify(state));
    bad.round.enemies = [{ type: 'unknown' }];
    expect(migrateGame(bad).round).toBeNull();
    const offMap = JSON.parse(JSON.stringify(state));
    offMap.round.slots[0].x = 'bad';
    expect(migrateGame(offMap).round).toBeNull();
    expect(migrateGame({ ...state, embers: NaN }).embers).toBe(0);
  });
});
