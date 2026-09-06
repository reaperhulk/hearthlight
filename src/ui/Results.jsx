import { reward } from "../engine/campaign.js";
import { TOWNS } from "../engine/content.js";
export function Results({ r, defeat, onCollect, onRetry }) {
  return (
    <section className={`panel outcome ${r.phase}`}>
      <span className="outcome-mark">{r.phase === "won" ? "☀" : "✧"}</span>
      <h2>
        {r.phase === "won"
          ? "A village saved."
          : r.phase === "retired"
            ? "Nothing earned is lost."
            : "The beacon went dark."}
      </h2>
      <p>
        {r.phase === "won"
          ? "The beacon is whole. Smoke rises from the roofs. Somewhere, someone puts the kettle on."
          : r.lastLoss || "You banked the fire before the next assault."}
      </p>
      {defeat && (
        <div className="advice">
          <ol>
            {defeat.chain.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
          <p>{defeat.advice}</p>
        </div>
      )}
      <p className="settlement-result">
        {r.slots.filter((s) => s.building).length} buildings still standing ·{" "}
        {r.stats.lost} lost
        {Number.isFinite(r.stats.repairs)
          ? ` · ${r.stats.repairs} repaired`
          : ""}
        {Number.isFinite(r.stats.interrupts)
          ? ` · ${r.stats.interrupts} heavy strikes interrupted`
          : ""}
        .
      </p>
      {r.phase === "won" && (
        <p className="mastery-badges">
          Beacon lit{r.heart === 100 ? " · Hearth unbroken" : ""}
          {r.stats.lost === 0 ? " · Every roof saved" : ""}
          {r.challenge === "no-bursts" ? " · Without flares" : ""}
        </p>
      )}
      <div className="reward">
        <span>{r.completed} completed nights × 3</span>
        <strong>{r.completed * 3} Embers</strong>
        {r.phase === "won" && (
          <>
            <span>Beacon restored</span>
            <strong>+{TOWNS[r.town].reward}</strong>
          </>
        )}
        <span>Total carried home</span>
        <strong>{reward(r)} Embers</strong>
      </div>
      <button className="primary" onClick={onCollect}>
        Carry the fire home →
      </button>
      <button onClick={onRetry}>Try this same defense again</button>
    </section>
  );
}
