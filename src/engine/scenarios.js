// Local workbench starting points. They use the same rules as the campaign.
export const SCENARIOS = {
  mill: {
    name: "The mill or the king",
    lesson: "Trust the Stone wall. Move to River before the raiders arrive.",
    town: "meadow",
    night: 3,
    kit: "keeper",
    seed: 42,
    budget: 100,
    layout: null,
    groups: [
      [2, 0, "king", 1, 1],
      [12, 1, "runner", 3, 0.8],
    ],
  },
  swarm: {
    name: "The crowded gate",
    lesson: "Compare Scattershot and Sunlance against a tightly packed group.",
    town: "meadow",
    night: 4,
    kit: "keeper",
    seed: 42,
    budget: 80,
    layout: null,
    groups: [[2, 0, "shade", 9, 0.7]],
  },
  veil: {
    name: "A crown in the mist",
    lesson:
      "Compare the same tower branches against a protected heavy attacker.",
    town: "meadow",
    night: 4,
    kit: "keeper",
    seed: 42,
    budget: 80,
    layout: null,
    groups: [
      [2, 0, "king", 1, 1],
      [3, 0, "mist", 1, 1],
    ],
  },
};
