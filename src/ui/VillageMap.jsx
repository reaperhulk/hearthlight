import { useEffect, useRef } from "react";
import { BUILDINGS, ENEMIES, mapLanes, routePoint } from "../engine/content.js";
import {
  SIZE,
  paintGround,
  paintBuildings,
  paintLiving,
} from "./village-draw.js";

export function VillageMap({
  round,
  selected,
  card,
  recommended,
  preview,
  onPreview,
  onSlot,
  onRoad,
  motion,
  contrast,
  intensity = 1,
  metrics,
}) {
  const touchInput = useRef(false);
  const candidate =
    card && round.slots.find((s) => s.id === preview && !s.building);
  const range = candidate && (BUILDINGS[card].range || 0);
  const groundRef = useRef(null),
    nightRef = useRef(null),
    townRef = useRef(null),
    liveRef = useRef(null);
  const data = useRef({
    round,
    previous: round,
    selected,
    motion,
    contrast,
    intensity,
    at: 0,
  });
  useEffect(() => {
    const old = data.current;
    data.current = {
      round,
      previous: old.round,
      selected,
      motion,
      contrast,
      intensity,
      at: performance.now(),
    };
  }, [round, selected, motion, contrast, intensity]);
  useEffect(() => {
    const ground = groundRef.current,
      night = nightRef.current,
      town = townRef.current,
      live = liveRef.current;
    const canvases = [ground, night, town, live];
    let townKey = "",
      painted = null,
      frame,
      running = true;
    const size = () => {
      const width = live.getBoundingClientRect().width;
      const scale = Math.min(
        2,
        Math.max(0.75, (width * (window.devicePixelRatio || 1)) / SIZE),
      );
      for (const canvas of canvases) {
        canvas.width = Math.round(SIZE * scale);
        canvas.height = Math.round(SIZE * scale);
        canvas.getContext("2d").setTransform(scale, 0, 0, scale, 0, 0);
      }
      paintGround(
        ground.getContext("2d"),
        data.current.round.town,
        false,
        data.current.round.rules || 2,
        data.current.round.layout,
      );
      paintGround(
        night.getContext("2d"),
        data.current.round.town,
        true,
        data.current.round.rules || 2,
        data.current.round.layout,
      );
      townKey = "";
      painted = null;
    };
    const observer = new ResizeObserver(size);
    observer.observe(live);
    size();
    let last = 0;
    const effectTimes = new Map();
    const draw = (now) => {
      if (!running) return;
      const current = data.current;
      if (document.visibilityState === "visible") {
        const key =
          current.round.slots
            .map((s) =>
              s.building
                ? `${s.building.type}:${s.building.branch}:${s.building.hp}`
                : "",
            )
            .join("|") +
          current.contrast +
          current.round.completed +
          current.round.heart +
          JSON.stringify(current.round.ruins);
        if (key !== townKey) {
          paintBuildings(
            town.getContext("2d"),
            current.round,
            current.contrast,
          );
          townKey = key;
        }
        const interpolation =
          current.round.paused || current.round.phase !== "night"
            ? 1
            : Math.min(1, (now - current.at) / 100);
        const start = performance.now();
        for (const e of current.round.events)
          if (!effectTimes.has(e.id))
            effectTimes.set(
              e.id,
              now / 1000 - Math.max(0, current.round.time - e.time),
            );
        for (const [id, time] of effectTimes)
          if (
            now / 1000 - time > 2 &&
            !current.round.events.some((e) => e.id === id)
          )
            effectTimes.delete(id);
        const animate =
          (current.motion && current.intensity > 0) ||
          (current.round.phase === "night" && !current.round.paused);
        const effects = [...effectTimes.values()].some(
          (t) => now / 1000 - t <= 0.75,
        );
        if (animate || effects || painted !== current)
          paintLiving(
            live.getContext("2d"),
            current.round,
            current.previous,
            interpolation,
            current.selected,
            current.motion,
            now / 1000,
            effectTimes,
            current.intensity,
            current.contrast,
          );
        painted = current;
        if (last && metrics) {
          metrics.current.frames.push(now - last);
          if (metrics.current.frames.length > 600)
            metrics.current.frames.shift();
          metrics.current.paint.push(performance.now() - start);
          if (metrics.current.paint.length > 600) metrics.current.paint.shift();
        }
      }
      last = document.visibilityState === "visible" ? now : 0;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [round.town, round.rules, round.layout, metrics]);
  return (
    <div
      className={`village-map ${contrast ? "contrast-map" : ""} ${card ? "placing" : ""}`}
      aria-label="Village battlefield"
    >
      <canvas ref={groundRef} className="map-layer" aria-hidden="true" />
      <canvas
        ref={nightRef}
        className="map-layer night-ground"
        style={{ opacity: ["night", "lost"].includes(round.phase) ? 1 : 0 }}
        aria-hidden="true"
      />
      <canvas ref={townRef} className="map-layer" aria-hidden="true" />
      <canvas ref={liveRef} className="map-layer living" aria-hidden="true" />
      <div
        className="hearth-label"
        aria-label={`Hearth, ${round.heart} health`}
      >
        ♨ Hearth <strong>{Math.ceil(round.heart)}</strong>
      </div>
      {candidate && (
        <div
          className={`placement-preview ${range ? "ranged" : ""}`}
          style={{
            left: `${candidate.x * 100}%`,
            top: `${candidate.y * 100}%`,
            width: `${range ? range * 200 : 8}%`,
            height: `${range ? range * 200 : 8}%`,
          }}
        >
          <span>
            {range
              ? `${BUILDINGS[card].name} coverage`
              : card === "wall"
                ? "Blocks this road"
                : `+${round.kit === "gardener" ? 17 : 12} Glow at dawn`}
          </span>
        </div>
      )}
      <div
        className="plot-buttons"
        role="group"
        aria-label={
          round.phase === "day"
            ? "Building positions"
            : "Warden rally positions"
        }
      >
        {round.slots.map((slot) => (
          <button
            key={slot.id}
            className={`plot ${recommended === slot.id ? "recommended" : ""} ${selected === slot.id ? "selected" : ""} ${slot.building ? "built" : ""}`}
            style={{ left: `${slot.x * 100}%`, top: `${slot.y * 100}%` }}
            onPointerDown={(e) => {
              touchInput.current = e.pointerType === "touch";
            }}
            onMouseEnter={() => onPreview?.(slot.id)}
            onMouseLeave={() => onPreview?.(null)}
            onFocus={() => onPreview?.(slot.id)}
            onBlur={() => onPreview?.(null)}
            onClick={() => onSlot(slot, touchInput.current)}
            aria-label={`${mapLanes(round.town)[slot.lane].name}, plot ${slot.index + 1}${slot.building ? `, ${BUILDINGS[slot.building.type].name}, ${Math.ceil(slot.building.hp)} health` : `, empty${card ? `, build ${BUILDINGS[card].name}` : ""}`}`}
            aria-describedby={
              recommended === slot.id ? "plot-recommendation" : undefined
            }
            title={`${mapLanes(round.town)[slot.lane].name} · ${slot.building ? BUILDINGS[slot.building.type].name : `plot ${slot.index + 1}`}`}
          >
            {!slot.building && (
              <span className="plot-number">{slot.index + 1}</span>
            )}
          </button>
        ))}
      </div>
      {mapLanes(round.town).map((lane) => {
        const entry = routePoint(
          lane,
          0,
          round.town,
          round.rules || 2,
          round.layout,
        );
        const x = Math.max(
          0.14,
          Math.min(
            0.86,
            entry.x + (entry.y < 0.15 ? -0.18 : entry.y > 0.85 ? 0.18 : 0),
          ),
        );
        const y = Math.max(
          0.075,
          Math.min(
            0.925,
            entry.y +
              (entry.x > 0.8
                ? -0.17
                : entry.x < 0.2
                  ? round.town === "ridge"
                    ? -0.17
                    : 0.12
                  : 0),
          ),
        );
        const coming = round.wave.filter(
          (e) => e.lane === lane.id && (round.phase === "day" || !e.spawned),
        );
        const summary = Object.entries(ENEMIES)
          .map(([type, def]) => {
            const n = coming.filter((e) => e.type === type).length;
            return n ? `${n} ${def.name}` : null;
          })
          .filter(Boolean)
          .join(", ");
        const symbols = {
          shade: "◆",
          runner: "➤",
          brute: "⬟",
          mist: "◌",
          king: "♛",
        };
        return (
          <button
            key={lane.id}
            className="road-label"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
            }}
            onClick={() => onRoad(lane.id)}
            aria-label={`${lane.name}. ${summary || "No more enemies approaching"}. ${round.phase === "night" ? "Guard this road" : "Inspect this approach"}`}
            title={summary || "Quiet tonight"}
          >
            {lane.name}
            {round.phase === "day" && (
              <span
                className="road-count"
                aria-label={`${round.wave.filter((e) => e.lane === lane.id).length} approaching`}
              >
                {coming.length} ·{" "}
                {[...new Set(coming.map((e) => symbols[e.type]))].join(" ")}
              </span>
            )}
          </button>
        );
      })}
      {recommended && (
        <span id="plot-recommendation" className="sr-only">
          Recommended plot for the current lesson
        </span>
      )}
      <div className="map-caption">
        {round.phase === "day"
          ? card
            ? `Choose a plot for your ${BUILDINGS[card].name.toLowerCase()}`
            : "Your village. Your next line of defense."
          : round.phase === "won"
            ? "The light will last."
            : round.phase === "night"
              ? "Tap a road or a plot to send the Warden."
              : "Every light leaves a memory."}
      </div>
    </div>
  );
}
