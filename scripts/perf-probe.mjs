import assert from "node:assert/strict";
import { browserSession, clickText, hydrate } from "./browser-session.mjs";
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
const { page, errors, browser } = session;
try {
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const reports = [];
  for (const name of [
    "first-day",
    "ridge-day",
    "marsh-battle",
    "ridge-battle",
    "full-battle",
    "dusk",
    "open-settings",
    "resize",
    "background-return",
    "essential-effects",
  ]) {
    const fixtureName = ["dusk"].includes(name) ? "full-day" : ["open-settings", "resize", "background-return", "essential-effects"].includes(name) ? "full-battle" : name;
    const fixture = scene(fixtureName),
      runs = [];
    for (let repeat = 0; repeat < repeats; repeat++) {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await hydrate(page, fixture);
      await page.evaluate(() => {
        if (window.__game.getState().round.phase === "night")
          window.__game.command({ type: "pause" });
        window.__game.resetMetrics();
      });
      if (name === "background-return") {
        const cover = await browser.newPage();
        await cover.bringToFront();
        await page.waitForFunction(() => document.visibilityState === "hidden");
        await page.waitForFunction(() => window.__game.getState().round.paused);
        const stopped = await page.evaluate(() => window.__game.getState().round.time);
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.equal(await page.evaluate(() => window.__game.getState().round.time), stopped, "Background game kept advancing");
        await page.bringToFront();
        await cover.close();
        await page.waitForFunction(() => document.visibilityState === "visible");
        await clickText(page, "Resume night");
        await page.evaluate(() => window.__game.resetMetrics());
      }
      if (name === "essential-effects") await page.evaluate(() => {
        window.__game.command({ type: "setting", key: "intensity", value: 0 });
        window.__game.command({ type: "setting", key: "motion", value: false });
      });
      const before = await page.evaluate(() => window.__game.getState());
      if (name === "dusk") await clickText(page, "Start Night");
      if (name === "open-settings") await page.click('[aria-label="Open settings"]');
      if (name === "resize") await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      const { metrics, state } = await page.evaluate(() => ({
        metrics: window.__game.metrics(),
        state: window.__game.getState(),
      }));
      assert.equal(
        state.round.phase,
        name === "dusk" ? "night" : before.round.phase,
        `${name}: SCENE DRIFTED phase`,
      );
      if (fixtureName.endsWith("battle") && name !== "open-settings")
        assert.ok(
          state.round.enemies.length > 0 &&
            state.round.time > before.round.time,
          `${name}: SCENE DRIFTED / no active battle`,
        );
      if (name === "open-settings") {
        assert.equal(state.round.paused, true, "Settings did not pause combat");
        assert.ok(await page.$('[role="dialog"]'), "Settings scene drifted");
      }
      if (fixtureName === "full-battle") {
        assert.equal(before.round.slots.filter(s => s.building?.branch).length, 16, "Incomplete upgraded-town fixture");
        assert.ok(before.round.enemies.some(e => e.type === "mist"), "Missing mist-support fixture");
      }
      assert.ok(metrics.frames.length > 10, `${name}: No frame samples`);
      const mean =
        metrics.frames.reduce((a, b) => a + b, 0) / metrics.frames.length;
      runs.push({
        fps: 1000 / mean,
        frameP50: percentile(metrics.frames, 0.5),
        frameP95: percentile(metrics.frames, 0.95),
        frameP99: percentile(metrics.frames, 0.99),
        paintP95: percentile(metrics.paint, 0.95),
        framesOver60HzBudget: metrics.frames.filter(ms => ms > 1000 / 60 + 1).length,
        estimatedMissed60HzFrames: metrics.frames.reduce((sum, ms) => sum + Math.max(0, Math.round(ms / (1000 / 60)) - 1), 0),
        sampleCount: metrics.frames.length,
        before: describeScene(before),
        after: describeScene(state),
      });
    }
    reports.push({
      name,
      fixture: fixtureName,
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
        browser: await browser.version(),
        platform: process.platform,
        architecture: process.arch,
        frameBudgetMs: 1000 / 60,
        throttle,
        seconds,
        repeats,
        uncapped: process.argv.includes("--uncapped"),
        note: "requestAnimationFrame intervals include browser scheduling, not physical display presentation. Missed frames are estimates against a 60 Hz budget; paint measures command recording only. CPU throttling is not a phone benchmark. Use matching real devices before claiming a speedup.",
        reports,
      },
      null,
      2,
    ),
  );
} finally {
  await session.close();
}
