import { useEffect, useRef, useState } from "react";
import { command, freshGame, migrateGame } from "../engine/campaign.js";
import { suspendScore } from "./score.js";
export const SAVE = "hearthlight-save";
export function load() {
  try {
    return migrateGame(JSON.parse(localStorage.getItem(SAVE)));
  } catch {
    return freshGame();
  }
}

export function useVillagePersistence() {
  const [state, setState] = useState(load),
    [elsewhere, setElsewhere] = useState(false),
    [notice, setNotice] = useState("");
  const current = useRef(state),
    foreign = useRef(false);
  useEffect(() => {
    current.current = state;
  }, [state]);
  useEffect(() => {
    foreign.current = elsewhere;
  }, [elsewhere]);
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
  return {
    state,
    setState,
    current,
    foreign,
    elsewhere,
    setElsewhere,
    notice,
    setNotice,
  };
}
