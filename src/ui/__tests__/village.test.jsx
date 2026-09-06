// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Village } from "../Village.jsx";
import { planDay, nightAction } from "../../../scripts/campaign-balance.js";
import {
  advance,
  freshGame,
  replayRound,
  startGame,
} from "../../engine/campaign.js";

let root;
const click = async (button) => {
  expect(button).toBeTruthy();
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
};
const button = (text) =>
  [...document.querySelectorAll("button")].find((el) =>
    el.textContent.trim().startsWith(text),
  );
const labelled = (text) => document.querySelector(`[aria-label="${text}"]`);
async function mount(saved) {
  if (saved) localStorage.setItem("hearthlight-save", JSON.stringify(saved));
  const node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
  await act(async () => root.render(<Village />));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__COMMIT__", "test-build");
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const context = new Proxy(
    {},
    {
      get: (_, key) =>
        ["createRadialGradient", "createLinearGradient"].includes(key)
          ? () => ({ addColorStop() {} })
          : () => {},
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
});
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the playable interface", () => {
  it("offers a direct first game and supports building, inspection, undo and keyboard start", async () => {
    await mount();
    expect(document.body.textContent).toContain("test-build");
    await click(button("Light the first fire"));
    await click(button("Timber wall"));
    await click(document.querySelector('[aria-label^="North road, plot 1"]'));
    expect(window.__game.getState().round.slots[2].building.type).toBe("farm");
    await click(document.querySelector('[aria-label^="North road, plot 3"]'));
    expect(document.body.textContent).toContain("+12 Glow at dawn");
    await click(button("↶ Undo last change"));
    expect(window.__game.getState().round.glow).toBe(48);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" })),
    );
    expect(window.__game.getState().round.phase).toBe("night");
    await click(labelled("Send Warden to North road"));
    expect(window.__game.getState().round.warden.deployed).toBe(true);
    await click(button("Pause"));
    const time = window.__game.getState().round.time;
    await act(async () => window.__game.advance(10));
    expect(window.__game.getState().round.time).toBe(time);
  });
  it("keeps all occupied roads visible, including attackers near the Warden", async () => {
    await mount(startGame(freshGame()));
    await click(button("Start Night"));
    await act(async () => window.__game.advance(6));
    await click(labelled("Send Warden to North road"));
    expect(labelled("Hearth flare on North road").disabled).toBe(false);
    expect(document.querySelectorAll(".threat-card")).toHaveLength(3);
    await click(labelled("Hearth flare on North road"));
    expect(window.__game.getState().round.bursts).toBe(1);
  });
  it("shows exact victory rewards, collects once, and enables the next town", async () => {
    let state = startGame(freshGame(), "first", 42);
    for (
      let i = 0;
      i < 3000 && ["day", "night"].includes(state.round.phase);
      i++
    ) {
      if (state.round.phase === "day") state = planDay(state);
      if (i % 10 === 0) state = nightAction(state, "fortress");
      state = advance(state, 0.1);
    }
    expect(state.round.phase).toBe("won");
    await mount(state);
    expect(document.body.textContent).toContain("A village saved.");
    expect(document.body.textContent).toContain("17 Embers");
    await click(button("Carry the fire home"));
    expect(window.__game.getState().embers).toBe(17);
    expect(window.__game.getState().wins.first).toBe(1);
    await click(button("Stone & timber"));
    expect(window.__game.getState().kit).toBe("mason");
    expect(window.__game.getState().embers).toBe(9);
    await click(button("Continue to Briar Hollow"));
    expect(window.__game.getState().round.town).toBe("meadow");
    expect(window.__game.getState().round.kit).toBe("mason");
  });
  it("exports a save, pauses for settings, and protects against another tab writing", async () => {
    await mount();
    await click(button("Light the first fire"));
    await click(button("Start Night"));
    await click(labelled("Open settings"));
    expect(window.__game.getState().round.paused).toBe(true);
    document.querySelector(".settings details").open = true;
    await click(button("Export save"));
    expect(JSON.parse(labelled("Save transfer text").value).saveVersion).toBe(
      2,
    );
    await click(labelled("Close settings"));
    await act(async () =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "hearthlight-save",
          newValue: "{}",
        }),
      ),
    );
    expect(document.body.textContent).toContain(
      "Another window holds the fire.",
    );
  });
  it("keeps keyboard focus inside settings and restores the trigger on Escape", async () => {
    await mount();
    const trigger = labelled("Open settings");
    trigger.focus();
    await click(trigger);
    expect(document.activeElement).toBe(labelled("Close settings"));
    await act(async () =>
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.activeElement.tagName).toBe("SUMMARY");
    await act(async () =>
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("remains playable when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    await mount();
    await click(button("Light the first fire"));
    expect(window.__game.getState().round.phase).toBe("day");
  });
  it("restores a live run paused and preserves legacy currency without crashing", async () => {
    await mount({
      saveVersion: 1,
      embers: 47,
      meta: { swiftWarden: true },
      bestNights: 9,
    });
    expect(window.__game.getState().embers).toBe(47);
    expect(document.body.textContent).toContain("best 9 nights");
    expect(button("The wandering light").disabled).toBe(false);
  });
  it("replays a completed campaign exactly from its seed and commands", () => {
    let state = startGame(freshGame(), "first", 987);
    for (
      let i = 0;
      i < 3000 && ["day", "night"].includes(state.round.phase);
      i++
    ) {
      if (state.round.phase === "day") state = planDay(state);
      if (i % 10 === 0) state = nightAction(state, "fortress");
      state = advance(state, 0.1);
    }
    const replay = replayRound(state.round);
    expect(replay.round).toEqual(state.round);
  });
});

it("does not intercept Space on a focused combat button", async () => {
  await mount(startGame(freshGame()));
  await click(button("Start Night"));
  const guard = labelled("Send Warden to River road");
  guard.focus();
  let event;
  await act(async () => {
    event = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    guard.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(false);
  expect(window.__game.getState().round.paused).toBe(false);
  await act(async () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        cancelable: true,
      }),
    ),
  );
  expect(window.__game.getState().round.paused).toBe(true);
});
