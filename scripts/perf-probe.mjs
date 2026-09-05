import assert from "node:assert/strict";
import { browserSession, hydrate } from "./browser-session.mjs";
import { scene, describeScene } from "./scenes.mjs";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const throttle = arg("--throttle", 4),
  seconds = arg("--seconds", 4),
  repeats = arg("--repeat", 3);
if (!(
  throttle >= 1 &&
  seconds >= 1 &&
  seconds <= 8 &&
  repeats >= 1 &&
  repeats <= 10
))
  throw new Error("Use throttle >= 1, seconds 1–8 and repeat 1–10.");
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * p))
  ];
const session = await browserSession({
  uncapped: process.argv.includes("--uncapped"),
});
const { page, errors } = session;
try {
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const reports = [];
  for (const name of [
    "first-day",
    "ridge-day",
    "marsh-battle",
    "ridge-battle",
  ]) {
    const fixture = scene(name),
      runs = [];
    for (let repeat = 0; repeat < repeats; repeat++) {
      await hydrate(page, fixture);
      await page.evaluate(() => {
        if (window.__game.getState().round.phase === "night")
          window.__game.command({ type: "pause" });
        window.__game.resetMetrics();
      });
      const before = await page.evaluate(() => window.__game.getState());
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      const { metrics, state } = await page.evaluate(() => ({
        metrics: window.__game.metrics(),
        state: window.__game.getState(),
      }));
      assert.equal(
        state.round.phase,
        before.round.phase,
        `${name}: SCENE DRIFTED phase`,
      );
      if (name.endsWith("battle"))
        assert.ok(
          state.round.enemies.length > 0 &&
            state.round.time > before.round.time,
          `${name}: SCENE DRIFTED / no active battle`,
        );
      assert.ok(metrics.frames.length > 10, `${name}: No frame samples`);
      const mean =
        metrics.frames.reduce((a, b) => a + b, 0) / metrics.frames.length;
      runs.push({
        fps: 1000 / mean,
        frameP50: percentile(metrics.frames, 0.5),
        frameP95: percentile(metrics.frames, 0.95),
        frameP99: percentile(metrics.frames, 0.99),
        paintP95: percentile(metrics.paint, 0.95),
        before: describeScene(before),
        after: describeScene(state),
      });
    }
    reports.push({
      name,
      medianFps: percentile(
        runs.map((r) => r.fps),
        0.5,
      ),
      runs,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        throttle,
        seconds,
        repeats,
        uncapped: process.argv.includes("--uncapped"),
        note: "Frame intervals include scheduling; paint measures command recording only. CPU throttling is not a phone benchmark. Use matching real devices before claiming a speedup.",
        reports,
      },
      null,
      2,
    ),
  );
} finally {
  await session.close();
}
