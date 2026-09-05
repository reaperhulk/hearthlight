import { TOWNS, mapLanes } from "../engine/content.js";
import { command, hasFutureDawn } from "../engine/campaign.js";

export function introduction(r) {
  if (r.town !== "first") return null;
  if (r.phase === "night") {
    if (!r.warden.deployed) return {
      title: r.paused ? "The wall is holding. Now help it." : "Watch the north wall",
      text: "Send the Warden to North road. He walks to the attackers and fights automatically.",
    };
    if (r.night >= 2 && r.stats.bursts === 0) return {
      title: r.paused ? "Try a lantern burst" : "Keep a spark in reserve",
      text: "Use Burst on a road with enemies. It damages, interrupts and pushes them back. Charges return each night.",
    };
    return { title: "Hold until dawn", text: "Your Warden fights within his blue circle. Move him when another road needs help." };
  }
  if (r.phase !== "day") return null;
  if (r.night === 1) {
    if (!r.slots.some(s => s.building?.type === "farm")) return {
      title: "1 · Plant tomorrow’s budget", text: "Choose Farm, then the marked North plot 3. It pays 12 Glow at dawn.", card: "farm", plot: "0-2",
    };
    if (!r.slots.some(s => s.building?.type === "wall")) return {
      title: "2 · Hold the north road", text: "Choose Timber wall, then the marked North plot 1. Enemies must break it before moving on.", card: "wall", plot: "0-0",
    };
    return { title: "3 · Let the first night come", text: "Start Night. Watch enemies meet the wall, then send your Warden to help." };
  }
  if (r.night === 2 && !r.slots.some(s => s.building?.type === "tower")) return {
    title: "A dawn earned. A tower to build.", text: "Choose Watchtower, then the marked River plot 2. Cover this new approach; a wall in front buys it time to fire.", card: "tower", plot: "1-1",
  };
  return !hasFutureDawn(r)
    ? { title: "One last night", text: "Choose a blessing, repair and strengthen your defenses. Survive to restore the beacon." }
    : { title: "Make the next night your own", text: `${TOWNS.first.nights - r.completed} nights remain. Select a building for two different upgrades, or try a lantern beside your Warden.` };
}

export function defeatExplanation(r) {
  const impacts = (r.incidents || []).filter(e => e.night === r.night);
  const last = impacts.filter(e => e.type === "heart").at(-1);
  const lane = last?.lane ?? r.enemies.find(e => e.progress >= 0.95)?.lane;
  const chain = impacts.filter(e => e.lane === lane);
  const road = mapLanes(r.town)[lane]?.name || "the threatened road";
  const advice = chain.some(e => e.type === "fall")
    ? `On ${road}, put a wall ahead of a tower and inspect its health before starting. A Stone wall holds longer; a Thorn wall interrupts attackers.`
    : `Attackers had an open route along ${road}. Cover it with a wall and damage source before the next attempt.`;
  return {
    chain: chain.map(e => e.text),
    advice: `${advice}${r.bursts > 0 ? ` You still had ${r.bursts} burst ${r.bursts === 1 ? "charge" : "charges"}; use one as enemies get past your last defense.` : " With your bursts spent, move the Warden to the innermost attackers."}`,
  };
}

export function pauseForLesson(state) {
  const r = state.round;
  if (!r || r.town !== "first" || r.phase !== "night" || r.paused || !state.settings.guide) return state;
  const id = !r.warden.deployed && !r.lessons?.includes("wall") && r.enemies.some(e => e.progress >= 0.3)
    ? "wall" : r.night >= 2 && r.stats.bursts === 0 && !r.lessons?.includes("burst") && r.enemies.length >= 2 ? "burst" : null;
  return id ? command(state, { type: "lesson", id }) : state;
}
