import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  freshGame,
  startGame,
  command,
  advance,
} from "../../engine/campaign.js";
let score, audio;
class Param {
  value = 0;
  calls = [];
  setValueAtTime(...v) {
    this.calls.push(["set", ...v]);
  }
  linearRampToValueAtTime(...v) {
    this.calls.push(["ramp", ...v]);
  }
  exponentialRampToValueAtTime(...v) {
    this.calls.push(["exponential", ...v]);
  }
  cancelScheduledValues(...v) {
    this.calls.push(["cancel", ...v]);
  }
  setTargetAtTime(...v) {
    this.calls.push(["target", ...v]);
  }
}
class Node {
  gain = new Param();
  frequency = new Param();
  Q = new Param();
  pan = new Param();
  threshold = new Param();
  ratio = new Param();
  connect(node) {
    return node;
  }
  disconnect() {}
  setPeriodicWave() {}
  start() {
    audio.starts++;
  }
  stop() {}
}
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    AudioContext: class {
      currentTime = 10;
      state = "running";
      sampleRate = 8000;
      starts = 0;
      gains = [];
      constructor() {
        audio = this;
      }
      createDynamicsCompressor() {
        return new Node();
      }
      createGain() {
        const n = new Node();
        this.gains.push(n);
        return n;
      }
      createPeriodicWave() {
        return {};
      }
      createStereoPanner() {
        const n = new Node();
        (this.panners ||= []).push(n);
        return n;
      }
      createOscillator() {
        return new Node();
      }
      createBiquadFilter() {
        return new Node();
      }
      createBufferSource() {
        return new Node();
      }
      createBuffer(_channels, size) {
        return { getChannelData: () => new Float32Array(size) };
      }
      suspend() {
        this.state = "suspended";
        return Promise.resolve();
      }
      resume() {
        this.state = "running";
        return Promise.resolve();
      }
      close() {
        this.state = "closed";
        return Promise.resolve();
      }
    },
  });
  score = await import("../score.js");
});
afterEach(() => {
  score.disposeScore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("signals danger from a breached approach before Hearth damage", () => {
  let s = command(startGame(freshGame()), { type: "start" });
  s.round.slots.forEach((slot) => {
    slot.building = null;
  });
  s = advance(s, 19);
  expect(s.round.heart).toBe(100);
  expect(score.scoreMood(s.round)).toBe("danger");
});
it("bounds overlapping voices and coalesces repeated breach warnings", () => {
  score.unlockScore();
  const before = audio.starts;
  for (let i = 0; i < 100; i++) score.soundEvent({ type: "heart" });
  expect(audio.starts - before).toBe(2);
  for (let i = 0; i < 100; i++) score.soundEvent({ type: "burst" });
  expect(audio.starts).toBeLessThanOrEqual(37); // 36 transient voices plus the ambient bed.
  score.suspendScore();
  const stopped = audio.starts;
  score.soundEvent({ type: "won" });
  expect(audio.starts).toBe(stopped);
});
it("critical cues duck music and a changed volume preserves its recovery", () => {
  score.unlockScore();
  score.soundEvent({ type: "heart" });
  const music = audio.gains[0].gain;
  expect(music.calls).toContainEqual(["target", 0.35 * 0.3, 10, 0.025]);
  score.setMix({ music: 0.2, effects: 0.65, ambience: 0.35 });
  expect(music.calls.at(-1)).toEqual(["target", 0.2, 10.7, 0.3]);
  score.setMix({ music: 0, effects: 0, ambience: 0 });
  const before = audio.starts;
  score.soundEvent({ type: "burst" });
  expect(audio.starts).toBe(before);
});

it("positions a raid warning on its farm and gives critical cues their own space", () => {
  score.unlockScore();
  score.soundEvent({ type: "raid", lane: 1, x: 0.9 });
  expect(audio.panners).toHaveLength(2);
  for (const n of audio.panners) expect(n.pan.value).toBeCloseTo(0.6);
  expect(audio.gains[0].gain.calls).toContainEqual([
    "target",
    0.35 * 0.3,
    10,
    0.025,
  ]);
  const count = audio.starts;
  score.soundEvent({ type: "raid", lane: 1, x: 0.9 });
  expect(audio.starts).toBe(count);
  score.soundEvent({ type: "windup", lane: 3, x: 0.1 });
  expect(audio.panners.at(-1).pan.value).toBeCloseTo(-0.6);
});
