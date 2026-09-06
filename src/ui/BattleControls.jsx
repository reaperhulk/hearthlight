import { maxHp } from "../engine/campaign.js";
import { mapLanes, encounterFor } from "../engine/content.js";
export function BattleControls({ r, act, onRoad }) {
  const cue = r.events
    .filter(
      (e) =>
        ["raid", "windup", "heart", "fall", "assault"].includes(e.type) &&
        r.time - e.time < 4,
    )
    .at(-1);
  const roadName =
    cue && Number.isInteger(cue.lane)
      ? mapLanes(r.town)[cue.lane]?.name
      : "the village";
  const announcement = cue
    ? {
        raid: `Farm raid on ${roadName}. Send the Warden or use a flare.`,
        windup: `Heavy strike preparing on ${roadName}. A flare can interrupt.`,
        heart: `The Hearth is taking damage from ${roadName}.`,
        fall: `A defense fell on ${roadName}.`,
        assault: "The second assault has begun.",
      }[cue.type]
    : "";
  return (
    <section className="panel night-controls">
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      {r.rules >= 4 && (
        <p className="order-summary" role="status">
          {r.warden.deployed
            ? `${r.warden.mode === "guard" ? "Guarding" : "Holding position on"} ${mapLanes(r.town)[r.warden.lane]?.name}. ${r.warden.orderPending ? "On the way." : "Ready."}`
            : "The Warden is awaiting your first order."}
          {encounterFor(r.town, r.night).finale &&
            ` Assault ${r.assault} of ${r.town === "first" ? 1 : 2}.`}
        </p>
      )}
      <div className="section-heading">
        <h2>Keep the light moving</h2>
        <span>
          ✧ {r.bursts} {r.bursts === 1 ? "flare" : "flares"}
        </span>
      </div>

      {mapLanes(r.town).map((lane) => {
        const enemies = r.enemies.filter((e) => e.lane === lane.id);
        const incoming = r.wave.filter(
          (e) => e.lane === lane.id && !e.spawned,
        ).length;
        const close = enemies.some((e) => e.progress > 0.72);
        const weakening = r.slots.some(
          (s) =>
            s.lane === lane.id &&
            s.building &&
            s.building.hp < maxHp(s.building, r.kit) * 0.3 &&
            enemies.some((e) => Math.abs(e.progress - s.progress) < 0.015),
        );
        const raiding = enemies.some((e) => e.raid);
        const winding = enemies.some((e) => e.warned && e.stun <= 0);
        const danger = close || weakening || raiding || winding;
        return (
          <div
            className={`threat-card ${danger ? "urgent" : ""}`}
            key={lane.id}
            role="group"
            aria-label={`${lane.name}: ${enemies.length} attackers, ${incoming} coming.${raiding ? " Farm under raid." : winding ? " Heavy strike preparing." : close ? " Attackers close to the Hearth." : weakening ? " Defense weakening." : ""}`}
          >
            <div>
              <strong>{lane.name}</strong>
              <span>
                {enemies.length} here
                {incoming ? ` · ${incoming} coming` : ""}
                {raiding
                  ? " · farm under raid"
                  : winding
                    ? " · heavy strike: flare to interrupt"
                    : close
                      ? " · close to the Hearth"
                      : weakening
                        ? " · defense weakening"
                        : ""}
              </span>
            </div>
            <div className="button-row">
              <button
                onClick={() => onRoad(lane.id)}
                aria-label={`Send Warden to ${lane.name}`}
                aria-pressed={r.warden.deployed && r.warden.lane === lane.id}
              >
                {r.rules >= 4 ? `Guard road ${lane.id + 1}` : "Send Warden →"}
              </button>
              <button
                className="burst"
                disabled={!enemies.length || !r.bursts}
                onClick={() => act({ type: "burst", lane: lane.id })}
                aria-label={`Hearth flare on ${lane.name}`}
              >
                ✧ Flare <kbd>⇧{lane.id + 1}</kbd>
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
