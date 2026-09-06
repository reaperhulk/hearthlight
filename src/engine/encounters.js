// Authored pressures, independent of purchase order. Each row is a forecastable
// spawn group: [time, road, enemy, count, spacing]. Seeds vary spacing modestly.
const encounter = (name, lesson, groups, finale = false) => ({
  name,
  lesson,
  groups,
  finale,
});
export const ENCOUNTERS = {
  first: [
    encounter(
      "The first watch",
      "A wall buys time. Give the Warden his first road to guard.",
      [[2, 0, "shade", 3, 2.5]],
    ),
    encounter(
      "Two roads, one keeper",
      "Let a tower cover River road while your Warden holds North.",
      [
        [2, 0, "shade", 2, 4],
        [6, 1, "shade", 4, 2.6],
      ],
    ),
    encounter(
      "A dawn worth keeping",
      "A giant leads the final approach. Interrupt its strike with a flare.",
      [
        [2, 0, "shade", 2, 3],
        [5, 1, "shade", 3, 2.5],
        [9, 2, "brute", 1, 1],
        [12, 2, "shade", 3, 2.5],
      ],
      true,
    ),
  ],
  meadow: [
    encounter(
      "Lanterns at the bridge",
      "North is first. Watch River next, then the orchard.",
      [
        [2, 0, "shade", 3, 2.6],
        [9, 1, "shade", 3, 2.6],
        [18, 2, "shade", 2, 3],
      ],
    ),
    encounter(
      "The mill or the gate",
      "Skitters raid farms. Trust the north wall while you defend your next harvest.",
      [
        [2, 0, "shade", 4, 1.5],
        [7, 1, "runner", 3, 2],
        [20, 2, "shade", 3, 2.5],
      ],
    ),
    encounter(
      "The hollow knock",
      "A giant pins North while raiders approach the orchard. A flare buys time.",
      [
        [2, 0, "brute", 1, 1],
        [6, 0, "shade", 3, 2],
        [5, 2, "runner", 4, 2],
        [24, 1, "shade", 4, 2],
      ],
    ),
    encounter(
      "A veil over the river",
      "The veil shields a group. Sunlance pierces it; a flare interrupts it.",
      [
        [2, 1, "mist", 1, 1],
        [3, 1, "shade", 5, 1.7],
        [15, 0, "runner", 4, 2],
        [28, 2, "brute", 1, 1],
        [31, 2, "shade", 3, 2],
      ],
    ),
    encounter(
      "The long way home",
      "Two heavy approaches surround a fast raid. Prepare a fallback near the Hearth.",
      [
        [2, 0, "brute", 2, 5],
        [6, 0, "shade", 3, 2],
        [10, 1, "runner", 5, 2],
        [24, 2, "mist", 1, 1],
        [25, 2, "shade", 5, 1.5],
      ],
    ),
    encounter(
      "The antlered king",
      "Two assaults. The king quickens below half health; save a flare for its heavy strike.",
      [
        [2, 0, "king", 1, 1],
        [4, 0, "shade", 4, 2],
        [12, 1, "runner", 4, 2],
        [32, 2, "mist", 1, 1],
        [33, 2, "shade", 6, 1.6],
        [40, 1, "brute", 2, 4],
      ],
      true,
    ),
  ],
  marsh: [
    encounter(
      "A raised crossing",
      "The winding North path buys time. River has the shorter approach.",
      [
        [2, 0, "shade", 4, 2.5],
        [7, 1, "runner", 2, 3],
        [15, 2, "shade", 3, 2.5],
      ],
    ),
    encounter(
      "Reeds beside the mill",
      "Raiders approach along both banks. An inner tower can cover their return.",
      [
        [2, 1, "runner", 4, 2],
        [5, 2, "shade", 4, 2.5],
        [22, 0, "shade", 3, 3],
      ],
    ),
    encounter(
      "Weight on the causeway",
      "Hold the giant on the raised road and protect the southern harvest.",
      [
        [2, 0, "brute", 2, 6],
        [9, 2, "runner", 4, 2],
        [21, 1, "shade", 5, 2],
      ],
    ),
    encounter(
      "Lights beneath the water",
      "Veil bearers enter on separate banks. Choose which group needs a flare.",
      [
        [2, 1, "mist", 1, 1],
        [3, 1, "shade", 4, 2],
        [15, 2, "mist", 1, 1],
        [16, 2, "runner", 4, 2],
        [29, 0, "brute", 1, 1],
        [30, 0, "shade", 3, 2],
      ],
    ),
    encounter(
      "The returning tide",
      "The long detour bunches a protected group. Scattershot needs help against its veil.",
      [
        [2, 0, "mist", 2, 6],
        [3, 0, "shade", 5, 2],
        [12, 1, "runner", 5, 1.8],
        [26, 2, "brute", 2, 4],
        [31, 2, "shade", 3, 2],
      ],
    ),
    encounter(
      "The drowned crown",
      "Two assaults. The king takes the causeway while raiders strike both banks.",
      [
        [2, 0, "king", 1, 1],
        [4, 0, "mist", 1, 1],
        [6, 0, "shade", 4, 2],
        [14, 1, "runner", 4, 2],
        [32, 2, "mist", 1, 1],
        [33, 2, "runner", 5, 2],
        [41, 1, "brute", 2, 5],
      ],
      true,
    ),
  ],
  ridge: [
    encounter(
      "Four distant gates",
      "The gates are far apart. Build two lines and give the Warden a third.",
      [
        [2, 0, "shade", 3, 2.5],
        [7, 1, "shade", 3, 2.5],
        [15, 2, "shade", 2, 3],
        [23, 3, "shade", 2, 3],
      ],
    ),
    encounter(
      "Footsteps in the ash",
      "Fast raiders use East and West while the North gate holds shades.",
      [
        [2, 0, "shade", 4, 2],
        [7, 1, "runner", 3, 2.5],
        [17, 3, "runner", 3, 2.5],
        [26, 2, "shade", 3, 2.5],
      ],
    ),
    encounter(
      "The stonebreakers",
      "Opposite giants need different answers. Fortify one gate before nightfall.",
      [
        [2, 0, "brute", 2, 6],
        [8, 2, "brute", 1, 1],
        [12, 1, "shade", 4, 2],
        [25, 3, "runner", 4, 2],
      ],
    ),
    encounter(
      "Smoke on the ridge",
      "A protected western group draws attention away from the eastern mill.",
      [
        [2, 3, "mist", 1, 1],
        [3, 3, "shade", 5, 2],
        [10, 1, "runner", 4, 2],
        [23, 0, "brute", 2, 5],
        [32, 2, "shade", 4, 2],
      ],
    ),
    encounter(
      "A ring of footsteps",
      "Four approaches, two flares. Let your strongest defenses work unaided.",
      [
        [2, 0, "brute", 2, 6],
        [7, 1, "mist", 1, 1],
        [8, 1, "shade", 4, 2],
        [18, 2, "brute", 2, 6],
        [26, 3, "runner", 5, 2],
      ],
    ),
    encounter(
      "The cinder crown",
      "Two assaults. The king threatens North; the final reinforcements enter at the other gates.",
      [
        [2, 0, "king", 1, 1],
        [4, 0, "brute", 1, 1],
        [10, 1, "runner", 4, 2],
        [18, 2, "shade", 4, 2],
        [32, 3, "mist", 1, 1],
        [33, 3, "shade", 5, 1.8],
        [40, 2, "brute", 2, 5],
        [46, 1, "runner", 3, 2],
      ],
      true,
    ),
  ],
};
export function encounterFor(town, night) {
  const list = ENCOUNTERS[town] || ENCOUNTERS.first;
  return list[(night - 1) % list.length];
}
