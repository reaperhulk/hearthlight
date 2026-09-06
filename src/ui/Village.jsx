import { useCallback, useEffect, useRef, useState } from "react";
import {
  advance,
  command,
  dawnIncome,
  farmIncome,
  freshGame,
  hasFutureDawn,
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
  encounterFor,
  buildCost,
} from "../engine/content.js";
import { introduction, defeatExplanation, pauseForLesson } from "./guidance.js";
import { VillageMap } from "./VillageMap.jsx";
import { drawBuilding } from "./village-draw.js";
import {
  scoreMood,
  disposeScore,
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
          "button:not(:disabled), input, select, textarea, summary",
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
          ["recording", "Record a local playtest · nothing is sent"],
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
        <label className="setting-row">
          Visual effects
          <select
            aria-label="Visual effects intensity"
            value={state.settings.intensity}
            onChange={(e) =>
              act({
                type: "setting",
                key: "intensity",
                value: Number(e.target.value),
              })
            }
          >
            <option value={1}>Full scenery</option>
            <option value={0.3}>Low effects</option>
            <option value={0}>Essential cues only</option>
          </select>
        </label>
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
              disabled={!state.round && !state.lastPlaytestRound}
              onClick={() => {
                setText(
                  JSON.stringify({
                    format: "hearthlight-playtest-v1",
                    build: __COMMIT__,
                    viewport: [window.innerWidth, window.innerHeight],
                    browser: navigator.userAgent,
                    round: state.round || state.lastPlaytestRound,
                    attempts: state.playtestLog,
                  }),
                );
                setNote(
                  "Playtest record ready. It includes the seed, commands, outcomes and, if recording was enabled, accepted and rejected inputs. Nothing is uploaded; copy it only if you choose to share it.",
                );
              }}
            >
              Export playtest record
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
          starts night · During battle, 1–4 send the Warden and Shift+1–4 flare
          a road. Space pauses outside buttons · Escape clears selection.
        </p>
      </section>
    </div>
  );
}

export function Village() {
  const [state, setState] = useState(load),
    [selected, setSelected] = useState(null),
    [card, setCard] = useState(null),
    [preview, setPreview] = useState(null),
    [pending, setPending] = useState(null),
    [moving, setMoving] = useState(null),
    [town, setTown] = useState("first"),
    [settings, setSettings] = useState(false),
    [elsewhere, setElsewhere] = useState(false),
    [notice, setNotice] = useState(""),
    [retiring, setRetiring] = useState(false),
    [view, setView] = useState("build");
  const current = useRef(state),
    foreign = useRef(false),
    soundCursor = useRef({ seed: null, event: 0 }),
    metrics = useRef({ frames: [], paint: [] });
  const [reduce, setReduce] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduce(query.matches);
    query.addEventListener?.("change", change);
    return () => query.removeEventListener?.("change", change);
  }, []);
  useEffect(() => () => disposeScore(), []);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    foreign.current = elsewhere;
  }, [elsewhere]);
  const act = useCallback((action) => {
    unlockScore();
    const wallTime = Date.now();
    setState((s) => {
      const resumeLesson =
        s.round?.paused &&
        s.settings.guide &&
        s.round.town === "first" &&
        ((action.type === "rally" &&
          !s.round.warden.deployed &&
          s.round.lessons?.includes("wall")) ||
          (action.type === "burst" &&
            s.round.stats.bursts === 0 &&
            s.round.lessons?.includes("burst")));
      const next = command(s, action, wallTime);
      return resumeLesson && next !== s
        ? command(next, { type: "pause" })
        : next;
    });
  }, []);
  const closeSettings = useCallback(() => setSettings(false), []);
  const begin = (id, endless = false, challenge = "standard") => {
    unlockScore();
    setSelected(null);
    setCard(null);
    setMoving(null);
    setRetiring(false);
    setView("build");
    setState((s) => startGame(s, id, seed(), endless, challenge));
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
          setState((s) =>
            pauseForLesson(advance(s, elapsed * s.settings.speed)),
          );
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
    setMood(scoreMood(r));
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
      const digit = /^Digit[1-4]$/.test(e.code) ? e.code.at(-1) : e.key;
      if (!r || settings || elsewhere) return;
      if (e.key === "Escape") {
        setCard(null);
        setSelected(null);
        setMoving(null);
        setPending(null);
        setPreview(null);
        return;
      }
      if (
        e.code === "Space" &&
        r.phase === "night" &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest("button, a, summary, [role=button]")
        )
      ) {
        e.preventDefault();
        act({ type: "pause" });
      }
      if (r.phase === "night" && ["1", "2", "3", "4"].includes(digit)) {
        const lane = Number(digit) - 1;
        if (mapLanes(r.town)[lane]) {
          const threats = r.enemies.filter((x) => x.lane === lane);
          act(
            e.shiftKey
              ? { type: "burst", lane }
              : {
                  type: "rally",
                  mode: "guard",
                  lane,
                  progress: threats.length
                    ? Math.max(0.3, ...threats.map((x) => x.progress + 0.03))
                    : 0.48,
                },
          );
        }
      }
      if (r.phase === "day" && e.key.toLowerCase() === "d") {
        act({ type: "start" });
        setCard(null);
      }
      if (r.phase === "day" && ["1", "2", "3", "4"].includes(digit)) {
        const id = Object.keys(BUILDINGS)[Number(digit) - 1];
        if (
          current.current.settings.guide &&
          r.town === "first" &&
          r.night === 1 &&
          ["farm", "tower", "lantern"].includes(id)
        )
          return;
        setView("build");
        setCard(id);
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
      setView("build");
      setSelected(`${lane}-0`);
      return;
    }
    if (r.phase === "night") {
      const threats = r.enemies.filter((e) => e.lane === lane);
      act({
        type: "rally",
        lane,
        mode: "guard",
        progress: threats.length
          ? Math.max(0.3, Math.max(...threats.map((e) => e.progress)) + 0.03)
          : 0.48,
      });
    }
  };
  const onSlot = (slot, touch = false) => {
    setView("build");
    if (r.phase === "night") {
      act({
        type: "rally",
        mode: "hold",
        lane: slot.lane,
        progress: slot.progress,
      });
      return;
    }
    if (r.phase !== "day") return;
    if (moving) {
      act({ type: "move", slot: moving, to: slot.id });
      setMoving(null);
      setSelected(slot.id);
      return;
    }
    if (
      card &&
      !slot.building &&
      r.glow >= buildCost(card, r.kit, r.rules || 2)
    ) {
      if (touch) {
        setPending({ slot: slot.id, building: card });
        setPreview(slot.id);
        return;
      }
      setPending(null);
      act({ type: "build", slot: slot.id, building: card });
      setCard(null);
      setSelected(null);
    } else {
      setSelected(slot.id);
      setCard(null);
    }
  };
  const selectedSlot = r?.slots.find((s) => s.id === selected),
    b = selectedSlot?.building;
  const lesson = r && state.settings.guide ? introduction(r) : null;
  const over = r && !["day", "night"].includes(r.phase);
  const defeat = r?.phase === "lost" ? defeatExplanation(r) : null;
  const firstPurchase =
    state.wins.first &&
    state.unlocked.length === 1 &&
    state.embers >= KITS.mason.cost;
  const complete = Object.keys(TOWNS).every((id) => state.wins[id]);
  const nextTown =
    Object.keys(TOWNS).find(
      (id) => !state.wins[id] && townUnlocked(state, id),
    ) || "meadow";
  return (
    <main
      className={`hearthlight ${r && !elsewhere ? "in-game" : ""} ${state.settings.contrast ? "high-contrast" : ""} ${!state.settings.motion || reduce ? "still" : ""}`}
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
            <button className="primary begin" onClick={() => begin(nextTown)}>
              {state.wins.first
                ? `Continue to ${TOWNS[nextTown].name}`
                : "Light the first fire"}{" "}
              <span>→</span>
            </button>
            <small>
              {state.wins.first
                ? "Six nights to restore the beacon."
                : "A guided three-night story. Plan at your own pace."}
            </small>
          </section>
          {firstPurchase && (
            <section
              className="panel progression-guide"
              aria-label="Your first starting kit"
            >
              <h2>A saved village leaves you something.</h2>
              <p>
                Spend 8 of your earned Embers on the Mason kit. Your next
                opening will have walls with 90 health instead of 65, and
                repairs will cost 6 Glow instead of 8.
              </p>
              <button
                className="primary"
                onClick={() => act({ type: "unlock", id: "mason" })}
              >
                Carry the Mason kit · 8 Embers
              </button>
              <small>
                Or choose another kit below. Kits can be reassigned freely
                between games.
              </small>
            </section>
          )}
          {complete && (
            <section
              className="panel completion"
              aria-label="Campaign complete"
            >
              <h2>Every beacon is burning.</h2>
              <p>
                You have saved all four towns. The story is complete. Return
                with a different kit, attempt a night watch without bursts, or
                see how long your village lasts in Endless watch.
              </p>
            </section>
          )}
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
                <>
                  <button onClick={() => begin(town, true)}>
                    Endless watch
                  </button>
                  <button onClick={() => begin(town, false, "no-bursts")}>
                    Challenge · No bursts
                  </button>
                </>
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
                {r.challenge === "no-bursts" ? " · No flares" : ""}
                {r.rules >= 4 && ` · ${encounterFor(r.town, r.night).name}`}
              </span>
              <h1>
                {over
                  ? r.phase === "won"
                    ? "The dawn is yours."
                    : "Carry the light home."
                  : r.phase === "day"
                    ? "A little time to prepare."
                    : "Hold the roads."}
                {!over && (
                  <small className="goal-line">
                    Protect the Hearth ·{" "}
                    {r.endless
                      ? "Hold as long as you can"
                      : `Survive ${TOWNS[r.town].nights} nights`}
                  </small>
                )}
              </h1>
            </div>
            <div className="run-stats">
              <span>
                <small>GLOW</small>
                <strong>✦ {r.glow}</strong>
              </span>
              <span>
                <small>NIGHTS HELD</small>
                <strong>
                  {r.completed} / {r.endless ? "∞" : TOWNS[r.town].nights}
                </strong>
              </span>
              <span>
                <small>HEARTH</small>
                <strong className={r.heart < 35 ? "danger-text" : ""}>
                  ♥ {r.heart}
                </strong>
              </span>
            </div>
          </section>
          <div
            className="heart-track"
            role="meter"
            aria-label="Hearth health"
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
                preview={pending?.slot || preview}
                onPreview={setPreview}
                recommended={lesson?.plot}
                onSlot={onSlot}
                onRoad={onRoad}
                motion={state.settings.motion && !reduce}
                contrast={state.settings.contrast}
                intensity={state.settings.intensity}
                metrics={metrics}
              />
              <div className="map-footer">
                <span>
                  {r.phase === "day"
                    ? hasFutureDawn(r)
                      ? `Dawn pays ${dawnIncome(r)} Glow from your standing village.`
                      : "Survive this night to restore the beacon."
                    : over
                      ? `${r.stats.kills} enemies banished · ${r.stats.lost} buildings lost`
                      : `${r.paused ? "Paused · " : ""}Night ${r.night} · ${r.enemies.length} ${r.enemies.length === 1 ? "enemy" : "enemies"} on the roads · ${r.wave.filter((e) => !e.spawned).length} still to come`}
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
              <details className="tale battlefield-tale">
                <summary>The night’s story</summary>
                {r.tale.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </details>
            </div>
            <aside
              className={`command-panel view-${view} ${b ? "inspecting" : ""} ${r.offers.length ? "choosing-blessing" : ""}`}
            >
              {!over && r.phase === "day" && (
                <nav className="panel-tabs" aria-label="Planning panels">
                  <button
                    aria-pressed={view === "build"}
                    onClick={() => setView("build")}
                  >
                    Build{r.offers.length ? " · gift" : ""}
                  </button>
                  <button
                    aria-pressed={view === "forecast"}
                    onClick={() => setView("forecast")}
                  >
                    Approach
                  </button>
                  <button
                    aria-pressed={view === "story"}
                    onClick={() => setView("story")}
                  >
                    Dawn & story
                  </button>
                </nav>
              )}
              <div className="command-scroll">
                {!over && r.phase === "day" && (
                  <section className="panel story-panel">
                    <h2>
                      {r.dawnReport
                        ? `Dawn ${r.dawnReport.night} · ${r.endless ? "another night held" : "one night closer"}`
                        : "The village chronicle"}
                    </h2>
                    {r.dawnReport && (
                      <p>
                        {r.dawnReport.kills} enemies banished.{" "}
                        {r.dawnReport.standing} buildings standing;{" "}
                        {r.dawnReport.lost} lost. {r.dawnReport.damage} Hearth
                        damage. Dawn paid {r.dawnReport.income} Glow, including{" "}
                        {r.dawnReport.farms} from farms.
                      </p>
                    )}
                    {(r.incidents || [])
                      .filter(
                        (incident) =>
                          incident.type === "heart" &&
                          incident.night === r.completed,
                      )
                      .map((incident, i) => (
                        <p className="danger-text" key={`breach-${i}`}>
                          {incident.text}
                        </p>
                      ))}
                    {r.tale.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </section>
                )}
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
                            r.challenge,
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
                          <strong>{lesson.title}</strong>
                          <p>{lesson.text}</p>
                          <button
                            className="skip-guide"
                            onClick={() =>
                              act({
                                type: "setting",
                                key: "guide",
                                value: false,
                              })
                            }
                          >
                            Skip guide
                          </button>
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
                          {r.rules >= 4 && (
                            <p className="encounter-advice">
                              {encounterFor(r.town, r.night).lesson}
                            </p>
                          )}
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
                            <p>
                              Choose one blessing for the rest of this vigil.
                            </p>
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
                        {r.dawnReport && (
                          <p className="dawn-summary" role="status">
                            Dawn paid {r.dawnReport.income} Glow ·{" "}
                            {r.dawnReport.kills} banished ·{" "}
                            {r.dawnReport.lost
                              ? `${r.dawnReport.lost} buildings lost`
                              : "every building held"}
                            {r.dawnReport.damage > 0 &&
                              ` · ${r.dawnReport.damage} Hearth damage. Dawn & story shows the breach.`}
                          </p>
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
                            r.slots.find(
                              (s) => s.id === pending.slot && !s.building,
                            ) && (
                              <div className="placement-confirm" role="status">
                                <strong>
                                  {BUILDINGS[card].name} ·{" "}
                                  {buildCost(card, r.kit, r.rules || 2)} Glow
                                </strong>
                                <span>
                                  {
                                    mapLanes(r.town)[
                                      r.slots.find((s) => s.id === pending.slot)
                                        .lane
                                    ].name
                                  }{" "}
                                  · plot{" "}
                                  {r.slots.find((s) => s.id === pending.slot)
                                    .index + 1}
                                </span>
                                <div className="button-row">
                                  <button
                                    className="primary"
                                    onClick={() =>
                                      onSlot(
                                        r.slots.find(
                                          (s) => s.id === pending.slot,
                                        ),
                                      )
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
                                    state.settings.guide &&
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
                                    r.glow <
                                      buildCost(id, r.kit, r.rules || 2) ||
                                    (id === "farm" && !hasFutureDawn(r))
                                  }
                                  onClick={() => {
                                    setPending(null);
                                    setCard(card === id ? null : id);
                                    setMoving(null);
                                    setSelected(null);
                                  }}
                                >
                                  <Icon type={id} />
                                  <strong>{def.name}</strong>
                                  <span>
                                    ✦ {buildCost(id, r.kit, r.rules || 2)}
                                  </span>
                                </button>
                              ))}
                          </div>
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
                                <span>
                                  +{farmIncome(b, r.kit)} Glow at dawn
                                </span>
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
                      </>
                    ) : (
                      <section className="panel night-controls">
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
                          const enemies = r.enemies.filter(
                            (e) => e.lane === lane.id,
                          );
                          const incoming = r.wave.filter(
                            (e) => e.lane === lane.id && !e.spawned,
                          ).length;
                          const close = enemies.some((e) => e.progress > 0.72);
                          const weakening = r.slots.some(
                            (s) =>
                              s.lane === lane.id &&
                              s.building &&
                              s.building.hp < maxHp(s.building, r.kit) * 0.3 &&
                              enemies.some(
                                (e) =>
                                  Math.abs(e.progress - s.progress) < 0.015,
                              ),
                          );
                          const danger = close || weakening;
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
                                  {close
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
                                  aria-pressed={r.warden.lane === lane.id}
                                >
                                  {r.rules >= 4
                                    ? `Guard road ${lane.id + 1}`
                                    : "Send Warden →"}
                                </button>
                                <button
                                  className="burst"
                                  disabled={!enemies.length || !r.bursts}
                                  onClick={() =>
                                    act({ type: "burst", lane: lane.id })
                                  }
                                  aria-label={`Hearth flare on ${lane.name}`}
                                >
                                  ✧ Flare
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
              </div>
              {!over && r.phase === "day" && (
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
