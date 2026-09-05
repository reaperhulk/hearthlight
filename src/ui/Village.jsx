import { useCallback, useEffect, useRef, useState } from "react";
import {
  advance,
  command,
  dawnIncome,
  farmIncome,
  freshGame,
  maxHp,
  migrateGame,
  repairCost,
  reward,
  startGame,
  townUnlocked,
} from "../engine/campaign.js";
import {
  BLESSINGS,
  BUILDINGS,
  ENEMIES,
  KITS,
  TOWNS,
  mapLanes,
} from "../engine/content.js";
import { VillageMap } from "./VillageMap.jsx";
import { drawBuilding } from "./village-draw.js";
import {
  setMix,
  setMood,
  soundEvent,
  suspendScore,
  unlockScore,
} from "./score.js";

const SAVE = "hearthlight-save";
function load() {
  try {
    return migrateGame(JSON.parse(localStorage.getItem(SAVE)));
  } catch {
    return freshGame();
  }
}
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
function Icon({ type }) {
  const mount = useCallback(
    (canvas) => {
      if (!canvas) return;
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      drawBuilding(ctx, type, 50, 57, 1.45);
    },
    [type],
  );
  return <canvas className="building-icon" ref={mount} aria-hidden="true" />;
}
function guide(r) {
  if (r.town !== "first") return null;
  if (r.phase === "night")
    return !r.warden.deployed
      ? [
          "Send the Warden",
          "Choose “Send Warden” on a threatened road. He walks there and fights nearby enemies.",
        ]
      : r.stats.bursts === 0 && r.night >= 2
        ? [
            "Keep a spark in reserve",
            "A lantern burst damages, interrupts and pushes enemies back. You have two each night.",
          ]
        : [
            "Hold until dawn",
            "Watch the roads. Reposition the Warden when another defense needs help.",
          ];
  if (r.phase !== "day") return null;
  if (r.night > 1)
    return [
      "A brighter dawn",
      `Your Glow has arrived. Repair damaged buildings, cover the next roads, and choose a specialization. ${TOWNS.first.nights - r.completed} nights remain.`,
    ];
  if (!r.slots.some((s) => s.building?.type === "farm"))
    return [
      "1 · A village needs a garden",
      "Choose Farm, then North road, plot 3. It adds 12 Glow to each dawn’s budget. Take your time.",
    ];
  if (!r.slots.some((s) => s.building?.type === "wall"))
    return [
      "2 · Hold the north road",
      "Build a Timber wall on North road, plot 1. Enemies must break it before moving on.",
    ];
  if (!r.slots.some((s) => s.building?.type === "tower"))
    return [
      "3 · Give the wall a watchtower",
      "Build a Watchtower on North road, plot 2. Select it to see its firing range.",
    ];
  return [
    "4 · You decide when night begins",
    "Your defenses are ready. Start Night, then send the Warden where he can help.",
  ];
}

function Settings({ state, act, onClose, onImport }) {
  const [text, setText] = useState(""),
    [note, setNote] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const panel = dialog.current;
    panel.querySelector("button")?.focus();
    const keys = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [
        ...panel.querySelectorAll(
          "button:not(:disabled), input, textarea, summary",
        ),
      ].filter(
        (el) => !el.closest("details:not([open])") || el.tagName === "SUMMARY",
      );
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", keys);
    return () => {
      panel.removeEventListener("keydown", keys);
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="settings panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="section-heading">
          <h2 id="settings-title">Tend the details</h2>
          <button onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>
        <p>The game pauses while you are here.</p>
        {["music", "effects", "ambience"].map((id) => (
          <label className="setting-row" key={id}>
            {id[0].toUpperCase() + id.slice(1)}
            <input
              aria-label={`${id} volume`}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={state.settings[id]}
              onChange={(e) =>
                act({ type: "setting", key: id, value: Number(e.target.value) })
              }
            />
          </label>
        ))}
        {[
          ["motion", "Animated scenery and effects"],
          ["contrast", "High-contrast battlefield"],
          ["guide", "Show the introductory guide"],
        ].map(([id, label]) => (
          <label className="setting-row" key={id}>
            {label}
            <input
              type="checkbox"
              checked={state.settings[id]}
              onChange={(e) =>
                act({ type: "setting", key: id, value: e.target.checked })
              }
            />
          </label>
        ))}
        <details>
          <summary>Carry your fire · save and restore</summary>
          <p>
            Copy this save to another device. Import replaces this device’s
            progress; the previous save is kept as a recovery copy.
          </p>
          <textarea
            aria-label="Save transfer text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your save will appear here"
            rows={4}
          />
          <div className="button-row">
            <button
              onClick={() => {
                setText(JSON.stringify(state));
                setNote("Save ready. Select and copy the text.");
              }}
            >
              Export save
            </button>
            <button
              disabled={!text.trim()}
              onClick={() => {
                try {
                  const data = JSON.parse(text);
                  if (
                    !data ||
                    typeof data !== "object" ||
                    !("saveVersion" in data)
                  )
                    throw Error();
                  onImport(data);
                  setNote("Your fire has been carried.");
                } catch {
                  setNote(
                    "That save could not be read. Your progress is unchanged.",
                  );
                }
              }}
            >
              Import save
            </button>
          </div>
          <p role="status">{note}</p>
        </details>
        <p className="quiet">
          Keyboard: 1–4 select a building · Tab and Enter choose a plot · D
          starts night · Space pauses · Escape clears selection.
        </p>
      </section>
    </div>
  );
}

export function Village() {
  const [state, setState] = useState(load),
    [selected, setSelected] = useState(null),
    [card, setCard] = useState(null),
    [moving, setMoving] = useState(null),
    [town, setTown] = useState("first"),
    [settings, setSettings] = useState(false),
    [elsewhere, setElsewhere] = useState(false),
    [notice, setNotice] = useState(""),
    [retiring, setRetiring] = useState(false);
  const current = useRef(state),
    foreign = useRef(false),
    soundCursor = useRef({ seed: null, event: 0 }),
    metrics = useRef({ frames: [], paint: [] });
  const [reduce] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    foreign.current = elsewhere;
  }, [elsewhere]);
  const act = useCallback((action) => {
    unlockScore();
    setState((s) => command(s, action));
  }, []);
  const closeSettings = useCallback(() => setSettings(false), []);
  const begin = (id, endless = false) => {
    unlockScore();
    setSelected(null);
    setCard(null);
    setMoving(null);
    setRetiring(false);
    setState((s) => startGame(s, id, seed(), endless));
  };
  useEffect(() => {
    let frame,
      last = performance.now(),
      pending = 0;
    const loop = (now) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!foreign.current && document.visibilityState === "visible") {
        pending += dt;
        if (pending >= 0.1) {
          const elapsed = pending;
          pending = 0;
          setState((s) => advance(s, elapsed * s.settings.speed));
        }
      } else pending = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let serialized = null,
      failed = false;
    try {
      serialized = localStorage.getItem(SAVE);
    } catch {
      /* Saving will report the failure below. */
    }
    const save = () => {
      if (foreign.current) return;
      try {
        const next = JSON.stringify(current.current);
        if (next === serialized) return;
        if (serialized) localStorage.setItem(`${SAVE}-recovery`, serialized);
        localStorage.setItem(SAVE, next);
        serialized = next;
        if (failed) {
          setNotice("Your progress is saving again.");
          failed = false;
        }
      } catch {
        if (!failed)
          setNotice(
            "This browser could not save. Export your fire in Settings to keep it.",
          );
        failed = true;
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        setState((s) =>
          s.round?.phase === "night" && !s.round.paused
            ? command(s, { type: "pause" })
            : s,
        );
        suspendScore();
        save();
      }
    };
    const other = (e) => {
      if (e.key === SAVE && e.newValue) {
        foreign.current = true;
        setElsewhere(true);
        suspendScore();
      }
    };
    const interval = setInterval(save, 1500);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", save);
    window.addEventListener("storage", other);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("storage", other);
      save();
    };
  }, []);
  useEffect(() => {
    setMix(state.settings);
    const r = state.round;
    if (!r) {
      soundCursor.current = { seed: null, event: 0 };
      setMood("day");
      return;
    }
    setMood(r.phase === "night" ? (r.heart < 35 ? "danger" : "night") : "day");
    if (
      soundCursor.current.seed !== r.seed ||
      soundCursor.current.event >= r.nextEvent
    )
      soundCursor.current = { seed: r.seed, event: r.nextEvent - 1 };
    for (const e of r.events)
      if (e.id > soundCursor.current.event) soundEvent(e);
    soundCursor.current.event = r.nextEvent - 1;
  }, [state]);
  useEffect(() => {
    const keys = (e) => {
      if (
        (e.target instanceof HTMLElement &&
          ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const r = current.current.round;
      if (!r || settings || elsewhere) return;
      if (e.key === "Escape") {
        setCard(null);
        setSelected(null);
        setMoving(null);
        return;
      }
      if (e.code === "Space" && r.phase === "night") {
        e.preventDefault();
        act({ type: "pause" });
      }
      if (r.phase === "day" && e.key.toLowerCase() === "d") {
        act({ type: "start" });
        setCard(null);
      }
      if (r.phase === "day" && ["1", "2", "3", "4"].includes(e.key)) {
        setCard(Object.keys(BUILDINGS)[Number(e.key) - 1]);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [act, settings, elsewhere]);
  useEffect(() => {
    window.__game = {
      getState: () => current.current,
      command: (action) => setState((s) => command(s, action)),
      start: (town, seed) => setState((s) => startGame(s, town, seed)),
      advance: (dt) => setState((s) => advance(s, dt)),
      metrics: () => metrics.current,
      resetMetrics: () => {
        metrics.current = { frames: [], paint: [] };
      },
    };
    return () => {
      delete window.__game;
    };
  }, []);
  const openSettings = () => {
    if (state.round?.phase === "night" && !state.round.paused)
      act({ type: "pause" });
    setSettings(true);
  };
  const onImport = (data) => {
    try {
      localStorage.setItem(`${SAVE}-recovery`, JSON.stringify(current.current));
    } catch {
      /* Active state remains available. */
    }
    setState(migrateGame(data));
    setCard(null);
    setSelected(null);
  };
  const r = state.round;
  const onRoad = (lane) => {
    if (!r) return;
    if (r.phase === "day") {
      setSelected(`${lane}-0`);
      return;
    }
    if (r.phase === "night") {
      const threats = r.enemies.filter((e) => e.lane === lane);
      act({
        type: "rally",
        lane,
        progress: threats.length
          ? Math.max(0.3, Math.max(...threats.map((e) => e.progress)) + 0.03)
          : 0.48,
      });
    }
  };
  const onSlot = (slot) => {
    if (r.phase === "night") {
      act({ type: "rally", lane: slot.lane, progress: slot.progress });
      return;
    }
    if (r.phase !== "day") return;
    if (moving) {
      act({ type: "move", slot: moving, to: slot.id });
      setMoving(null);
      setSelected(slot.id);
      return;
    }
    if (card && !slot.building && r.glow >= BUILDINGS[card].cost) {
      act({ type: "build", slot: slot.id, building: card });
      setCard(null);
      setSelected(slot.id);
    } else {
      setSelected(slot.id);
      setCard(null);
    }
  };
  const selectedSlot = r?.slots.find((s) => s.id === selected),
    b = selectedSlot?.building;
  const lesson = r && state.settings.guide ? guide(r) : null;
  const over = r && !["day", "night"].includes(r.phase);
  return (
    <main
      className={`hearthlight ${state.settings.contrast ? "high-contrast" : ""} ${!state.settings.motion || reduce ? "still" : ""}`}
    >
      <header className="masthead">
        <a href="#" onClick={(e) => e.preventDefault()} className="wordmark">
          <span className="brand-flame">♨</span>
          <span>
            Hearthlight<small>A LITTLE LIGHT WORTH KEEPING</small>
          </span>
        </a>
        <button
          className="settings-button"
          onClick={openSettings}
          aria-label="Open settings"
        >
          ⚙ <span>Settings</span>
        </button>
      </header>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {elsewhere ? (
        <section className="panel takeover">
          <h1>Another window holds the fire.</h1>
          <p>This window has paused to protect your progress.</p>
          <button
            className="primary"
            onClick={() => {
              setState(load());
              foreign.current = false;
              setElsewhere(false);
            }}
          >
            Continue here
          </button>
        </section>
      ) : !r ? (
        <>
          <section className="welcome">
            <div className="eyebrow">BUILD BY DAY · DEFEND BY NIGHT</div>
            <h1>
              Give the dark
              <br />
              <em>something to lose.</em>
            </h1>
            <p>
              A village, a keeper, and a fire that must last.
              <br />
              Raise a defense. Hold the roads. Bring back the dawn.
            </p>
            <button
              className="primary begin"
              onClick={() => begin(state.wins.first ? "meadow" : "first")}
            >
              {state.wins.first
                ? "Return to Briar Hollow"
                : "Light the first fire"}{" "}
              <span>→</span>
            </button>
            <small>
              {state.wins.first
                ? "Six nights to restore the beacon."
                : "A guided three-night story. Plan at your own pace."}
            </small>
          </section>
          <section className="town-selection">
            <div className="section-heading">
              <h2>Places worth saving</h2>
              <span className="ember-count">✧ {state.embers} Embers</span>
            </div>
            <div className="town-grid">
              {Object.entries(TOWNS).map(([id, def]) => (
                <button
                  key={id}
                  className={`town-card ${town === id ? "chosen" : ""} ${!townUnlocked(state, id) ? "locked" : ""}`}
                  disabled={!townUnlocked(state, id)}
                  onClick={() => setTown(id)}
                >
                  <span className={`town-illustration ${def.theme}`}>
                    {id === "first"
                      ? "♨"
                      : id === "marsh"
                        ? "≈"
                        : id === "ridge"
                          ? "△"
                          : "♧"}
                  </span>
                  <strong>{def.name}</strong>
                  <span>{def.subtitle}</span>
                  <small>
                    {state.wins[id]
                      ? "✓ Beacon restored"
                      : townUnlocked(state, id)
                        ? `${def.nights} nights`
                        : `Save ${TOWNS[def.requires].name} to unlock`}
                  </small>
                </button>
              ))}
            </div>
            <div className="town-actions">
              <button onClick={() => begin(town)}>
                Visit {TOWNS[town].name} →
              </button>
              {state.wins[town] > 0 && (
                <button onClick={() => begin(town, true)}>Endless watch</button>
              )}
            </div>
          </section>
          {(state.history.length > 0 || state.embers > 0 || state.legacy) && (
            <section className="panel loadouts">
              <div className="section-heading">
                <h2>What you carry forward</h2>
                <span>Choose freely between vigils</span>
              </div>
              <div className="kit-grid">
                {Object.entries(KITS).map(([id, kit]) => (
                  <button
                    key={id}
                    className={`kit ${state.kit === id ? "chosen" : ""}`}
                    disabled={
                      !state.unlocked.includes(id) && state.embers < kit.cost
                    }
                    onClick={() =>
                      act({
                        type: state.unlocked.includes(id) ? "kit" : "unlock",
                        id,
                      })
                    }
                  >
                    <strong>
                      {kit.name}
                      {state.kit === id ? " ✓" : ""}
                    </strong>
                    <span>{kit.detail}</span>
                    <small>
                      {state.unlocked.includes(id)
                        ? "Ready to carry"
                        : `${kit.cost} Embers · unlock permanently`}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          )}
          {state.legacy && (
            <p className="legacy-note">
              Your earlier vigils are remembered: best {state.legacy.bestNights}{" "}
              nights. Your Embers remain, and previous foundation, Warden and
              choir upgrades unlock their matching starting kits.
            </p>
          )}
          {state.history.length > 0 && (
            <details className="history panel">
              <summary>
                The village chronicle · {state.history.length} recent vigils
              </summary>
              {[...state.history]
                .reverse()
                .slice(0, 8)
                .map((h, i) => (
                  <div key={i}>
                    <span>
                      {TOWNS[h.town].name} ·{" "}
                      {h.outcome === "won"
                        ? "saved"
                        : `${h.nights} nights held`}
                    </span>
                    <strong>+{h.embers} Embers</strong>
                  </div>
                ))}
            </details>
          )}
        </>
      ) : (
        <>
          <section className="run-heading">
            <div>
              <span className="eyebrow">
                {TOWNS[r.town].name} · {KITS[r.kit].name}
              </span>
              <h1>
                {over
                  ? r.phase === "won"
                    ? "The dawn is yours."
                    : "Carry the light home."
                  : r.phase === "day"
                    ? "A little time to prepare."
                    : "Hold the roads."}
              </h1>
            </div>
            <div className="run-stats">
              <span>
                <small>GLOW</small>
                <strong>✦ {r.glow}</strong>
              </span>
              <span>
                <small>THE BEACON</small>
                <strong>
                  {r.completed} / {r.endless ? "∞" : TOWNS[r.town].nights}
                </strong>
              </span>
              <span>
                <small>HEART</small>
                <strong className={r.heart < 35 ? "danger-text" : ""}>
                  ♥ {r.heart}
                </strong>
              </span>
            </div>
          </section>
          <div
            className="heart-track"
            role="meter"
            aria-label="Heart health"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r.heart}
          >
            <i style={{ width: `${r.heart}%` }} />
          </div>
          <div className="play-layout">
            <div className="battlefield">
              <VillageMap
                key={r.seed}
                round={r}
                selected={selected}
                card={card}
                onSlot={onSlot}
                onRoad={onRoad}
                motion={state.settings.motion && !reduce}
                contrast={state.settings.contrast}
                metrics={metrics}
              />
              <div className="map-footer">
                <span>
                  {r.phase === "day"
                    ? `Dawn pays ${dawnIncome(r)} Glow from your standing village.`
                    : over
                      ? `${r.stats.kills} enemies banished · ${r.stats.lost} buildings lost`
                      : `Night ${r.night} · ${r.enemies.length} enemies on the roads · ${r.wave.filter((e) => !e.spawned).length} still to come`}
                </span>
                {r.phase === "night" && (
                  <div className="button-row">
                    <select
                      aria-label="Night speed"
                      value={state.settings.speed}
                      onChange={(e) =>
                        act({
                          type: "setting",
                          key: "speed",
                          value: Number(e.target.value),
                        })
                      }
                    >
                      <option value={0.5}>½ speed</option>
                      <option value={1}>Normal speed</option>
                      <option value={2}>2× speed</option>
                    </select>
                    <button onClick={() => act({ type: "pause" })}>
                      {r.paused ? "Resume night" : "Pause"}
                    </button>
                  </div>
                )}
              </div>
              {r.phase === "night" && r.paused && (
                <p className="pause-note" role="status">
                  Paused. You can choose the Warden’s next position, then
                  resume.
                </p>
              )}
              <details className="tale">
                <summary>The night’s story</summary>
                {r.tale.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </details>
            </div>
            <aside className="command-panel">
              {over ? (
                <section className={`panel outcome ${r.phase}`}>
                  <span className="outcome-mark">
                    {r.phase === "won" ? "☀" : "✧"}
                  </span>
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
                      : r.lastLoss ||
                        "You banked the fire before the next assault."}
                  </p>
                  {r.phase === "lost" && (
                    <p className="advice">
                      Next time, cover each threatened road with a tower and a
                      wall. Save a burst for attackers that get through.
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
                  <button
                    className="primary"
                    onClick={() => {
                      act({ type: "collect" });
                      setSelected(null);
                      setCard(null);
                    }}
                  >
                    Carry the fire home →
                  </button>
                  <button
                    onClick={() => {
                      const town = r.town,
                        oldSeed = r.seed;
                      setState((s) =>
                        startGame(
                          command(s, { type: "collect" }),
                          town,
                          oldSeed,
                          r.endless,
                        ),
                      );
                      setSelected(null);
                      setCard(null);
                      setMoving(null);
                      setRetiring(false);
                    }}
                  >
                    Try this same defense again
                  </button>
                </section>
              ) : (
                <>
                  {lesson && (
                    <div className="guide">
                      <span className="guide-star">✧</span>
                      <div>
                        <strong>{lesson[0]}</strong>
                        <p>{lesson[1]}</p>
                      </div>
                    </div>
                  )}
                  {r.phase === "day" ? (
                    <>
                      <section className="panel forecast">
                        <div className="section-heading">
                          <h2>Tonight’s approach</h2>
                          <span>Night {r.night}</span>
                        </div>
                        {mapLanes(r.town).map((lane) => {
                          const enemies = r.wave.filter(
                            (e) => e.lane === lane.id,
                          );
                          const types = [
                            ...new Set(enemies.map((e) => e.type)),
                          ];
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
                        <details>
                          <summary>Know the enemy</summary>
                          {[...new Set(r.wave.map((e) => e.type))].map(
                            (type) => (
                              <p key={type}>
                                <strong>{ENEMIES[type].name}:</strong>{" "}
                                {ENEMIES[type].description}
                              </p>
                            ),
                          )}
                        </details>
                      </section>
                      {r.offers.length > 0 && (
                        <section className="panel blessings">
                          <h2>A gift of the dawn</h2>
                          <p>Choose one blessing for the rest of this vigil.</p>
                          {r.offers.map((id) => (
                            <button
                              key={id}
                              onClick={() => act({ type: "blessing", id })}
                            >
                              <strong>{BLESSINGS[id].name}</strong>
                              <span>{BLESSINGS[id].detail}</span>
                            </button>
                          ))}
                        </section>
                      )}
                      <section className="panel build-panel">
                        <div className="section-heading">
                          <h2>Make your stand</h2>
                          <span>No clock. Take your time.</span>
                        </div>
                        <div className="build-grid">
                          {Object.entries(BUILDINGS).map(([id, def]) => (
                            <button
                              key={id}
                              className={`build-card ${card === id ? "chosen" : ""}`}
                              disabled={r.glow < def.cost}
                              onClick={() => {
                                setCard(card === id ? null : id);
                                setMoving(null);
                                setSelected(null);
                              }}
                            >
                              <Icon type={id} />
                              <strong>{def.name}</strong>
                              <span>✦ {def.cost}</span>
                            </button>
                          ))}
                        </div>
                        <p className="card-description">
                          {card
                            ? `${BUILDINGS[card].description} Choose an empty plot on the map.`
                            : moving
                              ? "Choose an empty plot. Moving costs 3 Glow."
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
                                    disabled={r.glow < branch.cost}
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
                              disabled={
                                b.hp >= maxHp(b, r.kit) ||
                                r.glow < repairCost(r)
                              }
                              onClick={() =>
                                act({ type: "repair", slot: selected })
                              }
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
                              Salvage · +
                              {Math.floor(BUILDINGS[b.type].cost / 2)}
                            </button>
                          </div>
                        </section>
                      )}
                      <div className="planning-actions">
                        <button
                          disabled={!r.undo}
                          onClick={() => act({ type: "undo" })}
                        >
                          ↶ Undo last change
                        </button>
                        <button
                          className="primary"
                          disabled={r.offers.length > 0}
                          onClick={() => {
                            act({ type: "start" });
                            setCard(null);
                            setMoving(null);
                          }}
                        >
                          Start Night {r.night} <span>→</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <section className="panel night-controls">
                      <div className="section-heading">
                        <h2>Keep the light moving</h2>
                        <span>✧ {r.bursts} bursts</span>
                      </div>
                      <p>
                        Your Warden fights near his rally point. A burst
                        interrupts and pushes back enemies on one road.
                      </p>
                      {mapLanes(r.town).map((lane) => {
                        const enemies = r.enemies.filter(
                          (e) => e.lane === lane.id,
                        );
                        const incoming = r.wave.filter(
                          (e) => e.lane === lane.id && !e.spawned,
                        ).length;
                        const danger = enemies.some((e) => e.progress > 0.78);
                        return (
                          <div
                            className={`threat-card ${danger ? "urgent" : ""}`}
                            key={lane.id}
                          >
                            <div>
                              <strong>{lane.name}</strong>
                              <span>
                                {enemies.length} here
                                {incoming ? ` · ${incoming} coming` : ""}
                                {danger ? " · close to the Heart" : ""}
                              </span>
                            </div>
                            <div className="button-row">
                              <button
                                onClick={() => onRoad(lane.id)}
                                aria-label={`Send Warden to ${lane.name}`}
                              >
                                Send Warden →
                              </button>
                              <button
                                className="burst"
                                disabled={!enemies.length || !r.bursts}
                                onClick={() =>
                                  act({ type: "burst", lane: lane.id })
                                }
                                aria-label={`Lantern burst on ${lane.name}`}
                              >
                                ✧ Burst
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  )}
                  {r.blessings.length > 0 && (
                    <div className="held-blessings">
                      {r.blessings.map((id) => (
                        <span key={id} title={BLESSINGS[id].detail}>
                          ✧ {BLESSINGS[id].name}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    className="retire"
                    onClick={() => {
                      if (retiring) {
                        act({ type: "retire" });
                        setRetiring(false);
                      } else {
                        setRetiring(true);
                        if (r.phase === "night" && !r.paused)
                          act({ type: "pause" });
                      }
                    }}
                  >
                    {retiring
                      ? `Confirm retirement · keep ${r.completed * 3} earned Embers`
                      : "Bank the fire and retire"}
                  </button>
                  {retiring && (
                    <button
                      className="retire"
                      onClick={() => setRetiring(false)}
                    >
                      Keep defending
                    </button>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}
      <footer className="footer">
        <span>Every light leaves a memory.</span>
        <span>
          built from <code>{__COMMIT__}</code>
        </span>
      </footer>
      {settings && (
        <Settings
          state={state}
          act={act}
          onClose={closeSettings}
          onImport={onImport}
        />
      )}
    </main>
  );
}
