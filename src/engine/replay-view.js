import { advance, command, replayRound } from "./campaign.js";

const summary = (r) => ({
  phase: r.phase,
  night: r.night,
  heart: r.heart,
  glow: r.glow,
  stats: r.stats,
});
// Local analysis only. Bound imported work before running a simulation on the UI thread.
export function indexReplay(input) {
  const record = input?.round || input;
  if (
    !record ||
    !Number.isFinite(record.time) ||
    record.time < 0 ||
    record.time > 3600 ||
    !Array.isArray(record.commands) ||
    record.commands.length > 4000
  )
    throw Error(
      "Use an untruncated replay of at most one hour and 4,000 commands.",
    );
  const final = replayRound(record);
  const initial = replayRound({ ...record, time: 0, commands: [] });
  const index = {
    record,
    initial,
    checkpoints: [],
    final,
    matches:
      JSON.stringify(summary(record)) === JSON.stringify(summary(final.round)),
  };
  let state = initial,
    cursor = 0,
    nextCheckpoint = 0;
  for (let guard = 0; guard < 50000; guard++) {
    while (
      cursor < record.commands.length &&
      record.commands[cursor].time <= state.round.time + 0.000001
    )
      state = command(state, record.commands[cursor++]);
    if (state.round.time >= nextCheckpoint || state.round.time >= record.time) {
      index.checkpoints.push({ time: state.round.time, state, cursor });
      nextCheckpoint = state.round.time + 2;
    }
    if (state.round.time >= record.time - 0.000001) return index;
    const target = Math.min(
      nextCheckpoint,
      record.commands[cursor]?.time ?? Infinity,
      record.time,
    );
    const next = advance(state, Math.min(10, target - state.round.time));
    if (next.round.time <= state.round.time)
      throw Error("Replay stopped before its next command.");
    state = next;
  }
  throw Error("Replay exceeded the local work limit.");
}
export function seekReplay(index, seconds) {
  const time =
    Math.round(Math.max(0, Math.min(index.record.time, seconds)) * 20) / 20;
  const checkpoint = index.checkpoints.findLast(
    (c) => c.time <= time + 0.000001,
  ) || { state: index.initial, cursor: 0 };
  let { state, cursor } = checkpoint;
  while (
    cursor < index.record.commands.length &&
    index.record.commands[cursor].time <= time + 0.000001
  ) {
    const action = index.record.commands[cursor++];
    if (action.time > state.round.time)
      state = advance(state, action.time - state.round.time);
    state = command(state, action);
  }
  if (time > state.round.time) state = advance(state, time - state.round.time);
  return state;
}
