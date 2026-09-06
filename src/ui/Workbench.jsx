import { useEffect, useMemo, useState } from "react";
import {
  advance,
  command,
  startScenario,
  validScenario,
  maxHp,
} from "../engine/campaign.js";
import {
  BUILDINGS,
  ENEMIES,
  KITS,
  TOWNS,
  ROUTES,
  createMap,
  mapLanes,
  routePoint,
} from "../engine/content.js";
import { SCENARIOS } from "../engine/scenarios.js";
import { indexReplay, seekReplay } from "../engine/replay-view.js";
import { VillageMap } from "./VillageMap.jsx";
import { Planning } from "./Planning.jsx";
import { BattleControls } from "./BattleControls.jsx";
const DRAFT = "hearthlight-workshop-draft";
function initialDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT));
    if (validScenario(saved)) return saved;
  } catch {
    /* Local drafts are optional. */
  }
  return structuredClone(SCENARIOS.mill);
}
function layoutFor(def) {
  const map = createMap(def.town);
  return {
    routes: map.lanes.map((lane) =>
      structuredClone(
        ROUTES[def.town]?.[lane.id] ||
          [0, 1].map((progress) => {
            const p = routePoint(lane, progress, def.town);
            return [p.x, p.y];
          }),
      ),
    ),
    slots: map.slots.map(({ building: _building, ...s }) => s),
  };
}
export function Workbench({ onClose, record, settings }) {
  const [def, setDef] = useState(initialDraft),
    [game, setGame] = useState(() => startScenario(initialDraft())),
    [dirty, setDirty] = useState(false),
    [mode, setMode] = useState("encounter"),
    [text, setText] = useState(""),
    [note, setNote] = useState(""),
    [selected, setSelected] = useState(null),
    [card, setCard] = useState(null),
    [pending, setPending] = useState(null),
    [preview, setPreview] = useState(null),
    [moving, setMoving] = useState(null),
    [replay, setReplay] = useState(null),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [road, setRoad] = useState(0);
  const draft = useMemo(
    () => (validScenario(def) ? startScenario(def) : null),
    [def],
  );
  const replayState = useMemo(
    () => (replay ? seekReplay(replay, cursor) : null),
    [replay, cursor],
  );
  const state = mode === "replay" ? replayState : dirty ? draft : game;
  const r = state?.round,
    selectedSlot = r?.slots.find((s) => s.id === selected),
    b = selectedSlot?.building;
  const change = (patch) => {
    setDef((d) => ({ ...d, ...patch }));
    setDirty(true);
    setPlaying(false);
  };
  const act = (action) => setGame((s) => command(s, action));
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") {
        setPlaying(false);
        setGame((s) =>
          s.round.phase === "night" && !s.round.paused
            ? command(s, { type: "pause" })
            : s,
        );
        return;
      }
      if (mode === "encounter" && !dirty) setGame((s) => advance(s, 0.1));
      if (mode === "replay" && playing)
        setCursor((t) => Math.min(replay.record.time, t + 0.1));
    }, 100);
    return () => clearInterval(timer);
  }, [mode, dirty, playing, replay]);
  const apply = () => {
    try {
      setGame(startScenario(def));
      setDirty(false);
      setCard(null);
      setSelected(null);
      setPending(null);
      setMoving(null);
      setNote("Encounter ready. Build your defense, then start the night.");
    } catch (error) {
      setNote(error.message);
    }
  };
  const loadReplay = (input) => {
    try {
      const index = indexReplay(input);
      setReplay(index);
      setCursor(0);
      setPlaying(false);
      setMode("replay");
      setNote(
        index.matches
          ? "Replayed outcome matches the recorded result."
          : "The recorded result differs. Inspect the timeline; use the original build for a historical mismatch.",
      );
    } catch (error) {
      setNote(error.message);
    }
  };
  const onSlot = (slot, touch = false) => {
    setSelected(slot.id);
    if (mode === "replay" || dirty) return;
    if (r.phase === "night") {
      act({
        type: "rally",
        mode: "hold",
        lane: slot.lane,
        progress: slot.progress,
      });
      return;
    }
    if (moving) {
      act({ type: "move", slot: moving, to: slot.id });
      setMoving(null);
      return;
    }
    if (card && !slot.building) {
      if (touch) {
        setPending({ slot: slot.id, building: card });
        return;
      }
      act({ type: "build", slot: slot.id, building: card });
      setPending(null);
      setCard(null);
    }
  };
  const changePoint = (index, axis, value) => {
    const layout = structuredClone(def.layout || layoutFor(def));
    layout.routes[road][index][axis] = Number(value);
    change({ layout });
  };
  const changePlot = (key, value) => {
    const layout = structuredClone(def.layout || layoutFor(def));
    layout.slots.find((s) => s.id === selected)[key] = Number(value);
    change({ layout });
  };
  const points = (def.layout || layoutFor(def)).routes[road];
  return (
    <main className="hearthlight workshop">
      <header className="workshop-heading">
        <div>
          <span className="eyebrow">LOCAL DESIGN TOOLS</span>
          <h1>Encounter workshop</h1>
        </div>
        <button onClick={onClose}>Return to your village</button>
      </header>
      <p>
        Author a problem, try a defense, and inspect its replay. This sandbox
        uses its own draft and never awards campaign progress.
      </p>
      <nav className="button-row" aria-label="Workshop tools">
        <button
          aria-pressed={mode === "encounter"}
          onClick={() => {
            setMode("encounter");
            setPlaying(false);
          }}
        >
          Encounter editor
        </button>
        <button
          aria-pressed={mode === "replay"}
          onClick={() => {
            setMode("replay");
            setPlaying(false);
            if (game.round.phase === "night" && !game.round.paused)
              act({ type: "pause" });
          }}
        >
          Replay viewer
        </button>
      </nav>
      <p role="status" className="workshop-note">
        {note ||
          "Start with one of the tactical examples or change its roads and spawn groups."}
      </p>
      <div className="workshop-grid">
        <section className="workshop-stage">
          {r ? (
            <>
              <div className="workshop-stats">
                {mode === "replay"
                  ? "Replay"
                  : dirty
                    ? "Unapplied preview"
                    : "Sandbox"}{" "}
                · {r.phase} · {r.time.toFixed(1)}s · {r.glow} Glow · {r.heart}{" "}
                Hearth · {r.enemies.length} enemies
              </div>
              <VillageMap
                key={`${mode}-${r.town}-${r.seed}`}
                round={r}
                selected={selected}
                card={mode === "encounter" && !dirty ? card : null}
                preview={pending?.slot || preview}
                onPreview={setPreview}
                onSlot={onSlot}
                onRoad={(lane) => {
                  setRoad(lane);
                  if (mode === "encounter" && !dirty && r.phase === "night")
                    act({ type: "rally", mode: "guard", lane });
                }}
                motion={settings.motion}
                contrast={settings.contrast}
                intensity={settings.intensity}
              />
              {mode === "encounter" && !dirty && (
                <div className="button-row workshop-controls">
                  {r.phase === "day" ? (
                    <button
                      className="primary"
                      onClick={() => act({ type: "start" })}
                    >
                      Start sandbox night
                    </button>
                  ) : r.phase === "night" ? (
                    <>
                      <button onClick={() => act({ type: "pause" })}>
                        {r.paused ? "Resume sandbox" : "Pause sandbox"}
                      </button>
                      <button
                        onClick={() => setGame((s) => advance(s, 0.5))}
                        disabled={r.paused}
                      >
                        Advance ½ second
                      </button>
                    </>
                  ) : (
                    <strong>
                      {r.phase === "won" ? "Encounter held" : "Hearth lost"} ·{" "}
                      {r.stats.lost} buildings lost
                    </strong>
                  )}
                  <button onClick={apply}>Reset encounter</button>
                  <button onClick={() => loadReplay(game.round)}>
                    Replay this attempt
                  </button>
                </div>
              )}
              {mode === "replay" && replay && (
                <>
                  <label className="replay-timeline">
                    Time · {cursor.toFixed(1)} / {replay.record.time.toFixed(1)}
                    s
                    <input
                      aria-label="Replay time"
                      type="range"
                      min="0"
                      max={replay.record.time}
                      step=".05"
                      value={cursor}
                      onChange={(e) => {
                        setPlaying(false);
                        setCursor(Number(e.target.value));
                      }}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      onClick={() => setCursor((t) => Math.max(0, t - 1))}
                    >
                      −1 second
                    </button>
                    <button
                      onClick={() => {
                        if (cursor >= replay.record.time) setCursor(0);
                        setPlaying((v) => !v);
                      }}
                    >
                      {playing && cursor < replay.record.time
                        ? "Pause replay"
                        : "Play replay"}
                    </button>
                    <button
                      onClick={() =>
                        setCursor((t) => Math.min(replay.record.time, t + 1))
                      }
                    >
                      +1 second
                    </button>
                  </div>
                  <p>
                    {r.stats.kills} banished · {r.stats.lost} buildings lost ·{" "}
                    {r.stats.interrupts || 0} interrupts
                  </p>
                </>
              )}
              {mode === "encounter" && !dirty && (
                <div className="command-panel view-build workshop-planning">
                  {r.phase === "day" ? (
                    <Planning
                      r={r}
                      guide={false}
                      card={card}
                      setCard={setCard}
                      pending={pending}
                      setPending={setPending}
                      setPreview={setPreview}
                      moving={moving}
                      setMoving={setMoving}
                      selected={selected}
                      setSelected={setSelected}
                      b={b}
                      act={act}
                      onSlot={onSlot}
                    />
                  ) : r.phase === "night" ? (
                    <BattleControls
                      r={r}
                      act={act}
                      onRoad={(lane) =>
                        act({ type: "rally", mode: "guard", lane })
                      }
                    />
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="panel">
              <h2>
                {mode === "replay"
                  ? "Load a recorded attempt"
                  : "Check your encounter"}
              </h2>
              <p>
                {mode === "replay"
                  ? "Paste a playtest export, or open your current campaign record below."
                  : "Roads must end near the Hearth. Keep points and plots inside the map, with 1–120 enemies."}
              </p>
            </div>
          )}
        </section>
        <section className="panel workshop-editor">
          {mode === "encounter" ? (
            <>
              <h2>Shape the encounter</h2>
              <label>
                Example
                <select
                  aria-label="Encounter example"
                  defaultValue=""
                  onChange={(e) => {
                    change(structuredClone(SCENARIOS[e.target.value]));
                    setSelected(null);
                    setRoad(0);
                  }}
                >
                  <option value="" disabled>
                    Choose an example
                  </option>
                  {Object.entries(SCENARIOS).map(([id, d]) => (
                    <option key={id} value={id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input
                  value={def.name || ""}
                  maxLength="80"
                  onChange={(e) => change({ name: e.target.value })}
                />
              </label>
              <label>
                Lesson
                <input
                  value={def.lesson || ""}
                  maxLength="300"
                  onChange={(e) => change({ lesson: e.target.value })}
                />
              </label>
              <div className="workshop-fields">
                <label>
                  Town
                  <select
                    value={def.town}
                    onChange={(e) => {
                      change({
                        town: e.target.value,
                        layout: null,
                        groups: [[2, 0, "shade", 3, 1]],
                      });
                      setSelected(null);
                      setRoad(0);
                    }}
                  >
                    {Object.entries(TOWNS).map(([id, t]) => (
                      <option key={id} value={id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kit
                  <select
                    value={def.kit}
                    onChange={(e) => change({ kit: e.target.value })}
                  >
                    {Object.entries(KITS).map(([id, k]) => (
                      <option key={id} value={id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </label>
                {[
                  ["budget", "Glow budget", 0, 500],
                  ["seed", "Seed", 0, 4294967295],
                  ["night", "Night", 1, 6],
                ].map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={def[key]}
                      onChange={(e) =>
                        change({ [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <details>
                <summary>Roads and building plots</summary>
                <p>
                  Coordinates run from 0 to 1. Change an entrance or bend;
                  select a plot on the map to edit its location and position
                  along the road.
                </p>
                <label>
                  Road
                  <select
                    value={road}
                    onChange={(e) => setRoad(Number(e.target.value))}
                  >
                    {mapLanes(def.town).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                {points.map((p, i) => (
                  <div className="workshop-fields" key={i}>
                    {[0, 1].map((axis) => (
                      <label key={axis}>
                        {i === 0
                          ? "Entrance"
                          : i === points.length - 1
                            ? "Hearth end"
                            : `Bend ${i}`}{" "}
                        {axis === 0 ? "X" : "Y"}
                        <input
                          type="number"
                          min=".01"
                          max=".99"
                          step=".01"
                          value={p[axis]}
                          onChange={(e) => changePoint(i, axis, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                ))}
                {selectedSlot && (
                  <fieldset>
                    <legend>
                      {mapLanes(def.town)[selectedSlot.lane].name} · plot{" "}
                      {selectedSlot.index + 1}
                    </legend>
                    <div className="workshop-fields">
                      {["x", "y", "progress"].map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            aria-label={`Selected plot ${key}`}
                            type="number"
                            min=".03"
                            max=".97"
                            step=".01"
                            value={
                              (def.layout || layoutFor(def)).slots.find(
                                (s) => s.id === selected,
                              )[key]
                            }
                            onChange={(e) => changePlot(key, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    {b && (
                      <p>
                        {BUILDINGS[b.type].name} · {Math.ceil(b.hp)} /{" "}
                        {maxHp(b, r.kit)} health
                      </p>
                    )}
                  </fieldset>
                )}
              </details>
              <h3>Spawn groups</h3>
              {def.groups.map((group, i) => (
                <fieldset key={i}>
                  <legend>Group {i + 1}</legend>
                  <div className="workshop-fields">
                    {[
                      [0, "At seconds", 2, 300, 0.05],
                      [3, "Count", 1, 32, 1],
                      [4, "Spacing seconds", 0.2, 20, 0.1],
                    ].map(([index, label, min, max, step]) => (
                      <label key={index}>
                        {label}
                        <input
                          type="number"
                          min={min}
                          max={max}
                          step={step}
                          value={group[index]}
                          onChange={(e) =>
                            change({
                              groups: def.groups.map((g, j) =>
                                j === i
                                  ? g.map((v, k) =>
                                      k === index ? Number(e.target.value) : v,
                                    )
                                  : g,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Road
                      <select
                        value={group[1]}
                        onChange={(e) =>
                          change({
                            groups: def.groups.map((g, j) =>
                              j === i
                                ? [g[0], Number(e.target.value), ...g.slice(2)]
                                : g,
                            ),
                          })
                        }
                      >
                        {mapLanes(def.town).map((l) => (
                          <option value={l.id} key={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Enemy
                      <select
                        value={group[2]}
                        onChange={(e) =>
                          change({
                            groups: def.groups.map((g, j) =>
                              j === i
                                ? [
                                    ...g.slice(0, 2),
                                    e.target.value,
                                    ...g.slice(3),
                                  ]
                                : g,
                            ),
                          })
                        }
                      >
                        {Object.entries(ENEMIES).map(([id, d]) => (
                          <option value={id} key={id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    disabled={def.groups.length === 1}
                    onClick={() =>
                      change({ groups: def.groups.filter((_, j) => i !== j) })
                    }
                  >
                    Remove group {i + 1}
                  </button>
                </fieldset>
              ))}
              <div className="button-row">
                <button
                  disabled={def.groups.length >= 20}
                  onClick={() =>
                    change({ groups: [...def.groups, [10, 0, "shade", 3, 1]] })
                  }
                >
                  Add group
                </button>
                <button className="primary" disabled={!draft} onClick={apply}>
                  Apply encounter
                </button>
                <button
                  disabled={!draft}
                  onClick={() => {
                    try {
                      localStorage.setItem(DRAFT, JSON.stringify(def));
                      setNote("Workshop draft saved on this device.");
                    } catch {
                      setNote(
                        "Draft could not save. Export the encounter below.",
                      );
                    }
                  }}
                >
                  Save draft
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Inspect a replay</h2>
              <p>
                Seek by time or select a recorded command. Playback includes the
                original simulation rules.
              </p>
              <button disabled={!record} onClick={() => loadReplay(record)}>
                Open campaign record
              </button>
              {replay && (
                <ol className="replay-commands">
                  {replay.record.commands.map((c, i) => (
                    <li key={i}>
                      <button
                        onClick={() => {
                          setPlaying(false);
                          setCursor(c.time);
                        }}
                      >
                        {c.time.toFixed(1)}s · {c.type}
                        {c.slot ? ` · plot ${c.slot}` : ""}
                        {Number.isInteger(c.lane)
                          ? ` · road ${c.lane + 1}`
                          : ""}
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
          <details className="workshop-transfer">
            <summary>
              Import / export {mode === "encounter" ? "encounter" : "replay"}
            </summary>
            <textarea
              aria-label="Workshop transfer text"
              rows="7"
              value={text}
              maxLength="2000000"
              onChange={(e) => setText(e.target.value)}
            />
            <div className="button-row">
              <button
                onClick={() => {
                  setText(
                    JSON.stringify(
                      mode === "encounter" ? def : replay?.record || record,
                      null,
                      2,
                    ),
                  );
                  setNote("Export ready. Select and copy the text.");
                }}
              >
                Export {mode === "encounter" ? "encounter" : "replay"}
              </button>
              <button
                onClick={() => {
                  try {
                    const value = JSON.parse(text);
                    if (mode === "replay") loadReplay(value);
                    else {
                      if (!validScenario(value))
                        throw Error("Invalid encounter definition.");
                      change(value);
                      setSelected(null);
                      setRoad(0);
                      setNote("Imported preview. Apply when ready.");
                    }
                  } catch (error) {
                    setNote(error.message);
                  }
                }}
              >
                Import text
              </button>
            </div>
          </details>
        </section>
      </div>
      <footer className="footer">
        <span>Local workshop · campaign progress is paused.</span>
        <code>{__COMMIT__}</code>
      </footer>
    </main>
  );
}
