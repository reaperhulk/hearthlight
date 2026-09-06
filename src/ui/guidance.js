import { TOWNS, mapLanes } from "../engine/content.js";
import { command, hasFutureDawn } from "../engine/campaign.js";

export function introduction(r) {
  if (r.town !== "first") return null;
  if (r.phase === "night") {
    if (!r.warden.deployed)
      return {
        title:
          r.paused && r.lessons?.includes("wall")
            ? "The wall is holding. Now help it."
            : "Watch the north wall",
        text: "Send the Warden to North road. He walks to the attackers and fights automatically.",
      };
    if (r.night >= 2 && r.stats.bursts === 0)
      return {
        title:
          r.paused && r.lessons?.includes("burst")
            ? "Try a Hearth flare"
            : "Keep a spark in reserve",
        text: "Use Flare on a road with enemies. It damages, interrupts and pushes them back. Charges return each night.",
      };
    return {
      title: "Hold until dawn",
      text: "Your Warden fights within his blue circle. Move him when another road needs help.",
    };
  }
  if (r.phase !== "day") return null;
  if (r.night === 1) {
    if (!r.slots.some((s) => s.building?.type === "wall"))
      return {
        title: "1 · Protect the Hearth",
        text: "The village already has a farm. Place a Timber wall on North plot 1 to stop the first attackers before they reach the Hearth.",
        card: "wall",
        plot: "0-0",
      };
    return {
      title: "2 · Let the first night come",
      text: "Start Night. Watch enemies meet the wall, then send your Warden to help.",
    };
  }
  if (r.night === 2 && !r.slots.some((s) => s.building?.type === "tower"))
    return {
      title: "A dawn earned. A tower to build.",
      text: "Choose Watchtower, then the marked River plot 2. Cover this new approach; a wall in front buys it time to fire.",
      card: "tower",
      plot: "1-1",
    };
  return !hasFutureDawn(r)
    ? {
        title: "One last night",
        text: "Choose a blessing, repair and strengthen your defenses. Keep the Hearth alive to save the village.",
      }
    : {
        title: "Make the next night your own",
        text: `${TOWNS.first.nights - r.completed} nights remain. Repair the north wall, strengthen a tower, or plant a second farm for future income. Choose which road your Warden will support.`,
      };
}

export function defeatExplanation(r) {
  const impacts = (r.incidents || []).filter((e) => e.night === r.night);
  const last = impacts.filter((e) => e.type === "heart").at(-1);
  const lane = last?.lane ?? r.enemies.find((e) => e.progress >= 0.95)?.lane;
  const chain = impacts.filter((e) => e.lane === lane);
  const road = mapLanes(r.town)[lane]?.name || "the threatened road";
  const advice = chain.some((e) => e.type === "fall")
    ? `On ${road}, put a wall ahead of a tower and inspect its health before starting. A Stone wall holds longer; a Thorn wall interrupts attackers.`
    : `Attackers had an open route along ${road}. Cover it with a wall and damage source before the next attempt.`;
  return {
    chain: chain.map((e) => e.text),
    advice: `${advice}${r.bursts > 0 ? ` You still had ${r.bursts} flare ${r.bursts === 1 ? "charge" : "charges"}; use one as enemies get past your last defense.` : " With your flares spent, move the Warden to the innermost attackers."}`,
  };
}

export function pauseForLesson(state) {
  const r = state.round;
  if (
    !r ||
    r.town !== "first" ||
    r.phase !== "night" ||
    r.paused ||
    !state.settings.guide
  )
    return state;
  const id =
    !r.warden.deployed &&
    !r.lessons?.includes("wall") &&
    r.enemies.some((e) => e.progress >= 0.3)
      ? "wall"
      : r.night >= 2 &&
          r.stats.bursts === 0 &&
          !r.lessons?.includes("burst") &&
          r.enemies.length >= 2
        ? "burst"
        : null;
  return id ? command(state, { type: "lesson", id }) : state;
}
