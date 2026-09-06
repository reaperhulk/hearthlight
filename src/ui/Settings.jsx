import { useEffect, useRef, useState } from "react";

export function Settings({ state, act, onClose, onImport }) {
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
