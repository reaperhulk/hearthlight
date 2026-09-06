import {
  farmIncome,
  hasFutureDawn,
  maxHp,
  repairCost,
} from "../engine/campaign.js";
import {
  BLESSINGS,
  BUILDINGS,
  ENEMIES,
  KITS,
  TOWNS,
  mapLanes,
  encounterFor,
  buildCost,
} from "../engine/content.js";
import { BuildingIcon } from "./BuildingIcon.jsx";
export function Planning({
  r,
  guide,
  lesson,
  card,
  setCard,
  pending,
  setPending,
  setPreview,
  moving,
  setMoving,
  selected,
  setSelected,
  b,
  act,
  onSlot,
}) {
  const dawns = r.scenario
    ? 0
    : r.endless
      ? null
      : Math.max(0, TOWNS[r.town].nights - r.night);
  const damaged = r.slots
    .filter((s) => s.building && s.building.hp < maxHp(s.building, r.kit))
    .sort(
      (a, b) =>
        a.building.hp / maxHp(a.building, r.kit) -
        b.building.hp / maxHp(b.building, r.kit),
    );
  const breach = (r.incidents || [])
    .filter((e) => e.type === "heart" && e.night === r.completed)
    .at(-1);
  const breachSlot =
    breach && r.slots.find((s) => s.lane === breach.lane && s.index === 0);
  const farm = b?.type === "farm" ? b : { type: "farm" };
  const income = farmIncome(farm, r.kit);
  return (
    <>
      <section className="panel forecast">
        <div className="section-heading">
          <h2>Tonight’s approach</h2>
          <span>Night {r.night}</span>
        </div>
        {mapLanes(r.town).map((lane) => {
          const enemies = r.wave.filter((e) => e.lane === lane.id);
          const types = [...new Set(enemies.map((e) => e.type))];
          return (
            <div key={lane.id} className="forecast-road">
              <strong>{lane.name}</strong>
              <span>
                {enemies.length
                  ? `${enemies.length} · ${types.map((t) => ENEMIES[t].name).join(", ")}`
                  : "Quiet tonight"}
              </span>
            </div>
          );
        })}
        {r.rules >= 4 && (
          <p className="encounter-advice">
            {r.scenario?.lesson || encounterFor(r.town, r.night).lesson}
          </p>
        )}
        <details>
          <summary>Know the enemy</summary>
          {[...new Set(r.wave.map((e) => e.type))].map((type) => (
            <p key={type}>
              <strong>{ENEMIES[type].name}:</strong> {ENEMIES[type].description}
            </p>
          ))}
        </details>
      </section>
      {r.offers.length > 0 && (
        <section className="panel blessings">
          <h2>A gift of the dawn</h2>
          <p>Choose one blessing for the rest of this vigil.</p>
          {r.offers.map((id) => (
            <button key={id} onClick={() => act({ type: "blessing", id })}>
              <strong>{BLESSINGS[id].name}</strong>
              <span>{BLESSINGS[id].detail}</span>
            </button>
          ))}
        </section>
      )}
      {r.dawnReport && (
        <p className="dawn-summary" role="status">
          Dawn paid {r.dawnReport.income} Glow · {r.dawnReport.kills} banished ·{" "}
          {r.dawnReport.lost
            ? `${r.dawnReport.lost} ${r.dawnReport.lost === 1 ? "building" : "buildings"} lost`
            : "every building held"}
          {r.dawnReport.damage > 0 &&
            ` · ${r.dawnReport.damage} Hearth damage. Dawn & story shows the breach.`}
        </p>
      )}
      {r.dawnReport &&
        (breachSlot || damaged.length > 0 || r.ruins?.length > 0) && (
          <div className="dawn-summary recovery-advice">
            {breachSlot && (
              <button
                className="breach-advice"
                onClick={() => {
                  setSelected(breachSlot.building ? breachSlot.id : null);
                  setCard(breachSlot.building ? null : "wall");
                  setPreview(breachSlot.id);
                }}
              >
                {mapLanes(r.town)[breach.lane].name} breached:{" "}
                {breachSlot.building
                  ? "inspect your front defense"
                  : "add a wall at the entrance"}
                . Back it with a tower or the Warden.
              </button>
            )}
            {!breachSlot && damaged[0] && (
              <button
                onClick={() => {
                  setSelected(damaged[0].id);
                  setCard(null);
                }}
              >
                {mapLanes(r.town)[damaged[0].lane].name}: inspect your weakest{" "}
                {BUILDINGS[damaged[0].building.type].name.toLowerCase()} ·{" "}
                {Math.ceil(damaged[0].building.hp)} health
              </button>
            )}
            {r.ruins?.length > 0 && (
              <span>
                {r.ruins.length} ruined{" "}
                {r.ruins.length === 1 ? "plot" : "plots"} can be rebuilt.
                Protect exposed gardens from Skitters.
              </span>
            )}
          </div>
        )}
      {r.night === 1 && r.kit !== "keeper" && (
        <p className="kit-summary">
          {KITS[r.kit].name}: {KITS[r.kit].detail}
        </p>
      )}
      <section className="panel build-panel">
        <div className="section-heading">
          <h2>Make your stand</h2>
          <span>No clock. Take your time.</span>
        </div>
        {pending &&
          card === pending.building &&
          r.slots.find((s) => s.id === pending.slot && !s.building) && (
            <div className="placement-confirm" role="status">
              <strong>
                {BUILDINGS[card].name} · {buildCost(card, r.kit, r.rules || 2)}{" "}
                Glow
              </strong>
              <span>
                {
                  mapLanes(r.town)[
                    r.slots.find((s) => s.id === pending.slot).lane
                  ].name
                }{" "}
                · plot {r.slots.find((s) => s.id === pending.slot).index + 1}
              </span>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={() =>
                    onSlot(r.slots.find((s) => s.id === pending.slot))
                  }
                >
                  Build here
                </button>
                <button
                  onClick={() => {
                    setPending(null);
                    setPreview(null);
                  }}
                >
                  Cancel placement
                </button>
              </div>
            </div>
          )}
        <div className="build-grid">
          {Object.entries(BUILDINGS)
            .filter(
              ([id]) =>
                !(
                  guide &&
                  r.town === "first" &&
                  r.night === 1 &&
                  ["farm", "tower", "lantern"].includes(id)
                ),
            )
            .map(([id, def]) => (
              <button
                key={id}
                className={`build-card ${card === id ? "chosen" : ""} ${lesson?.card === id ? "recommended" : ""}`}
                disabled={
                  r.glow < buildCost(id, r.kit, r.rules || 2) ||
                  (id === "farm" && !hasFutureDawn(r))
                }
                onClick={() => {
                  setPending(null);
                  setCard(card === id ? null : id);
                  setMoving(null);
                  setSelected(null);
                }}
              >
                <BuildingIcon type={id} />
                <strong>{def.name}</strong>
                <span>✦ {buildCost(id, r.kit, r.rules || 2)}</span>
              </button>
            ))}
        </div>
        {card === "farm" && (
          <p className="economic-advice">
            +{income} Glow per surviving dawn. Recovers its{" "}
            {buildCost("farm", r.kit, r.rules || 2)} Glow cost after{" "}
            {Math.ceil(buildCost("farm", r.kit, r.rules || 2) / income)} dawns.{" "}
            {dawns === null
              ? "Endless income while it stands."
              : `${dawns} paying dawns remain: up to ${dawns * income} Glow.`}{" "}
            Skitters leave the road to raid farms before the next wall.
          </p>
        )}
        <p className="card-description">
          {card
            ? `${BUILDINGS[card].description} Choose an empty plot on the map.`
            : moving
              ? "Choose an empty plot. Moving costs 3 Glow."
              : !hasFutureDawn(r)
                ? "Final night: invest in defense. New farms and farm upgrades cannot pay off before victory."
                : "Choose a building, then a plot. Select an existing building to improve it."}
        </p>
      </section>
      {b && (
        <section className="panel inspector">
          <div className="section-heading">
            <h2>{BUILDINGS[b.type].name}</h2>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close building details"
            >
              ×
            </button>
          </div>
          <p>{BUILDINGS[b.type].description}</p>
          <div className="inspection-stats">
            <span>
              {Math.ceil(b.hp)} / {maxHp(b, r.kit)} health
            </span>
            {b.type === "farm" && (
              <span>+{farmIncome(b, r.kit)} Glow at dawn</span>
            )}
          </div>
          {b.type === "farm" && (
            <p className="economic-advice">
              {dawns === null
                ? "Pays while the watch continues."
                : `${dawns} paying dawns remain: up to ${dawns * income} Glow if this farm survives.`}{" "}
              {r.slots.find((s) => s.id === selected)?.progress < 0.3
                ? "This is an exposed garden. Commit your Warden before the raid arrives."
                : "A wall farther out on this road can stop approaching raiders."}
            </p>
          )}
          {b.branch ? (
            <p className="specialization">
              ✧ {BUILDINGS[b.type].branches[b.branch].name}
              <br />
              {BUILDINGS[b.type].branches[b.branch].detail}
            </p>
          ) : (
            <div className="upgrade-list">
              {Object.entries(BUILDINGS[b.type].branches).map(
                ([id, branch]) => (
                  <button
                    key={id}
                    disabled={
                      r.glow < branch.cost ||
                      (b.type === "farm" && !hasFutureDawn(r))
                    }
                    onClick={() =>
                      act({
                        type: "upgrade",
                        slot: selected,
                        branch: id,
                      })
                    }
                  >
                    <strong>
                      {branch.name} <em>✦ {branch.cost}</em>
                    </strong>
                    <span>{branch.detail}</span>
                  </button>
                ),
              )}
            </div>
          )}
          <div className="button-row">
            <button
              disabled={b.hp >= maxHp(b, r.kit) || r.glow < repairCost(r)}
              onClick={() => act({ type: "repair", slot: selected })}
            >
              Repair · {repairCost(r)} Glow
            </button>
            <button
              disabled={r.glow < 3}
              onClick={() => {
                setMoving(selected);
                setCard(null);
              }}
            >
              Move · 3
            </button>
            <button
              onClick={() => {
                act({ type: "sell", slot: selected });
                setSelected(null);
              }}
            >
              Salvage · +{Math.floor(BUILDINGS[b.type].cost / 2)}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
