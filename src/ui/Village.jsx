import { useCallback, useEffect, useRef, useState } from "react";
import {
  advance,
  command,
  dawnIncome,
  hasFutureDawn,
  migrateGame,
  startGame,
  townUnlocked,
} from "../engine/campaign.js";
import {
  BLESSINGS,
  BUILDINGS,
  KITS,
  TOWNS,
  mapLanes,
  encounterFor,
  buildCost,
} from "../engine/content.js";
import { introduction, defeatExplanation, pauseForLesson } from "./guidance.js";
import { VillageMap } from "./VillageMap.jsx";
import { Settings } from "./Settings.jsx";
import { Planning } from "./Planning.jsx";
import { BattleControls } from "./BattleControls.jsx";
import { Workbench } from "./Workbench.jsx";
import { Results } from "./Results.jsx";
import { useVillagePersistence, load, SAVE } from "./useVillagePersistence.js";
import {
  scoreMood,
  disposeScore,
  setMix,
  setMood,
  soundEvent,
  unlockScore,
  suspendScore,
} from "./score.js";

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export function Village() {
  const { state, setState, current, foreign, elsewhere, setElsewhere, notice } =
    useVillagePersistence();
  const [selected, setSelected] = useState(null),
    [card, setCard] = useState(null),
    [preview, setPreview] = useState(null),
    [pending, setPending] = useState(null),
    [moving, setMoving] = useState(null),
    [town, setTown] = useState("first"),
    [settings, setSettings] = useState(false),
    [workshop, setWorkshop] = useState(false),
    [retiring, setRetiring] = useState(false),
    [view, setView] = useState("build");
  const soundCursor = useRef({ seed: null, event: 0 }),
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
  const act = useCallback(
    (action) => {
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
    },
    [setState],
  );
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
          const elapsed = Math.floor(pending / 0.1) * 0.1;
          pending -= elapsed;
          setState((s) =>
            pauseForLesson(advance(s, elapsed * s.settings.speed)),
          );
        }
      } else pending = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [foreign, setState]);
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
      if (!r || settings || elsewhere || workshop) return;
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
  }, [act, settings, elsewhere, current, workshop]);
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
  }, [current, setState]);
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
  if (workshop)
    return (
      <Workbench
        onClose={() => setWorkshop(false)}
        record={state.round || state.lastPlaytestRound}
        settings={state.settings}
      />
    );
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
                opening will have walls with 90 health instead of 65 and cheaper
                repairs. The tradeoff: 8 less starting Glow and 2 flares instead
                of the Keeper’s 3.
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
                with a different kit, attempt a night watch without flares, or
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
                  {state.mastery?.[id]?.length > 0 && (
                    <span className="mastery-badges">
                      {state.mastery[id]
                        .map(
                          (mark) =>
                            ({
                              saved: "Beacon lit",
                              steadfast: "Hearth unbroken",
                              restorer: "Every roof saved",
                              "no-bursts": "Without flares",
                            })[mark],
                        )
                        .join(" · ")}
                    </span>
                  )}
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
                    Challenge · No flares
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
                  <Results
                    r={r}
                    defeat={defeat}
                    onCollect={() => {
                      act({ type: "collect" });
                      setSelected(null);
                      setCard(null);
                    }}
                    onRetry={() => {
                      setState((s) =>
                        startGame(
                          command(s, { type: "collect" }),
                          r.town,
                          r.seed,
                          r.endless,
                          r.challenge,
                        ),
                      );
                      setSelected(null);
                      setCard(null);
                      setMoving(null);
                      setRetiring(false);
                    }}
                  />
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
                      <Planning
                        r={r}
                        guide={state.settings.guide}
                        lesson={lesson}
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
                    ) : (
                      <BattleControls r={r} act={act} onRoad={onRoad} />
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
          onWorkshop={() => {
            setSettings(false);
            suspendScore();
            setWorkshop(true);
          }}
        />
      )}
    </main>
  );
}
