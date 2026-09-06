import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { browserSession, clickText, hydrate } from "./browser-session.mjs";
import { scene, describeScene } from "./scenes.mjs";

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i < 0 ? fallback : Number(process.argv[i + 1]);
};
const throttle = arg("--throttle", 4),
  seconds = arg("--seconds", 4),
  repeats = arg("--repeat", 3);
if (
  !(
    throttle >= 1 &&
    seconds >= 1 &&
    seconds <= 8 &&
    repeats >= 1 &&
    repeats <= 10
  )
)
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
    "cold-start",
    "placement",
    "audio-start",
    "sustained-battle",
  ]) {
    const fixtureName = ["cold-start", "placement", "audio-start"].includes(
      name,
    )
      ? "opening"
      : name === "sustained-battle"
        ? "full-battle"
        : ["dusk"].includes(name)
          ? "full-day"
          : [
                "open-settings",
                "resize",
                "background-return",
                "essential-effects",
              ].includes(name)
            ? "full-battle"
            : name;
    const fixture = scene(fixtureName),
      runs = [];
    const duration = name === "sustained-battle" ? 30 : seconds;
    for (
      let repeat = 0;
      repeat < (name === "sustained-battle" ? 1 : repeats);
      repeat++
    ) {
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
      await page.setCacheEnabled(name !== "cold-start");
      await page.setBypassServiceWorker(name === "cold-start");
      const probe = await page.evaluateOnNewDocument(() => {
        window.__probe = { inputs: [], tasks: [], audioContexts: 0 };
        const NativeAudioContext = window.AudioContext;
        if (NativeAudioContext)
          window.AudioContext = class extends NativeAudioContext {
            constructor(...args) {
              super(...args);
              window.__probe.audioContexts++;
            }
          };
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            window.__probe.tasks.push(e.duration);
          window.__probe.tasks = window.__probe.tasks.slice(-200);
        }).observe({ type: "longtask", buffered: true });
        document.addEventListener(
          "click",
          () => {
            const start = performance.now();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                window.__probe.inputs.push(performance.now() - start);
                window.__probe.inputs = window.__probe.inputs.slice(-100);
              }),
            );
          },
          true,
        );
      });
      await hydrate(page, fixture);
      await page.removeScriptToEvaluateOnNewDocument(probe.identifier);
      await page.waitForFunction(
        () =>
          document.querySelector(".village-map")?.getBoundingClientRect()
            .height > 100 && document.querySelector(".living")?.width > 0,
      );
      const readyMs = await page.evaluate(() => performance.now());
      if (name !== "cold-start")
        await page.evaluate(() => {
          window.__probe.inputs = [];
          window.__probe.tasks = [];
        });
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
        const stopped = await page.evaluate(
          () => window.__game.getState().round.time,
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        assert.equal(
          await page.evaluate(() => window.__game.getState().round.time),
          stopped,
          "Background game kept advancing",
        );
        await page.bringToFront();
        await cover.close();
        await page.waitForFunction(
          () => document.visibilityState === "visible",
        );
        await clickText(page, "Resume night");
        await page.evaluate(() => window.__game.resetMetrics());
      }
      if (name === "essential-effects")
        await page.evaluate(() => {
          window.__game.command({
            type: "setting",
            key: "intensity",
            value: 0,
          });
          window.__game.command({
            type: "setting",
            key: "motion",
            value: false,
          });
        });
      const before = await page.evaluate(() => window.__game.getState());
      const domBefore = await page.evaluate(
        () => document.querySelectorAll("*").length,
      );
      if (name === "placement") {
        await clickText(page, "Timber wall");
        await page.click('[aria-label^="North road, plot 1"]');
      }
      if (name === "audio-start") await clickText(page, "Timber wall");
      if (name === "dusk") await clickText(page, "Start Night");
      if (name === "open-settings")
        await page.click('[aria-label="Open settings"]');
      if (name === "resize")
        await page.setViewport({
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
        });
      await new Promise((resolve) => setTimeout(resolve, duration * 1000));
      const { metrics, state, probeData, domAfter, heapBytes } =
        await page.evaluate(() => ({
          probeData: window.__probe,
          domAfter: document.querySelectorAll("*").length,
          heapBytes: performance.memory?.usedJSHeapSize,
          metrics: window.__game.metrics(),
          state: window.__game.getState(),
        }));
      if (name === "audio-start")
        assert.equal(
          probeData.audioContexts,
          1,
          "Audio-start scene did not initialize audio",
        );
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
        assert.equal(
          before.round.slots.filter((s) => s.building?.branch).length,
          16,
          "Incomplete upgraded-town fixture",
        );
        assert.ok(
          before.round.enemies.some((e) => e.type === "mist"),
          "Missing mist-support fixture",
        );
      }
      assert.ok(
        state.round.events.length <= 80 &&
          state.round.projectiles.length <= 96 &&
          state.round.ruins.length <= 16,
        "Unbounded combat collections",
      );
      assert.ok(
        metrics.frames.length <= 600 && metrics.paint.length <= 600,
        "Unbounded renderer samples",
      );
      if (name === "sustained-battle")
        assert.ok(
          domAfter <= domBefore + 20,
          "Sustained battle grew DOM nodes",
        );
      assert.ok(metrics.frames.length > 10, `${name}: No frame samples`);
      const mean =
        metrics.frames.reduce((a, b) => a + b, 0) / metrics.frames.length;
      runs.push({
        duration,
        audioContexts: probeData.audioContexts,
        readyMs: name === "cold-start" ? readyMs : undefined,
        worstFrame: Math.max(...metrics.frames),
        longestTask: Math.max(0, ...probeData.tasks),
        longTaskCount: probeData.tasks.length,
        inputToPaintMax: Math.max(0, ...probeData.inputs),
        inputSamples: probeData.inputs,
        domBefore,
        domAfter,
        heapBytes,
        fps: 1000 / mean,
        frameP50: percentile(metrics.frames, 0.5),
        frameP95: percentile(metrics.frames, 0.95),
        frameP99: percentile(metrics.frames, 0.99),
        paintP95: percentile(metrics.paint, 0.95),
        framesOver60HzBudget: metrics.frames.filter((ms) => ms > 1000 / 60 + 1)
          .length,
        estimatedMissed60HzFrames: metrics.frames.reduce(
          (sum, ms) => sum + Math.max(0, Math.round(ms / (1000 / 60)) - 1),
          0,
        ),
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
  const budgets = {
    frameP95: 25,
    paintP95: 10,
    worstFrame: 250,
    inputToPaintMax: 180,
    coldReadyMs: 2500,
  };
  const failures = [];
  for (const report of reports) {
    for (const key of [
      "frameP95",
      "paintP95",
      "worstFrame",
      "inputToPaintMax",
    ]) {
      const median = percentile(
        report.runs.map((r) => r[key]),
        0.5,
      );
      if (median > budgets[key])
        failures.push(
          `${report.name}: median ${key} ${median.toFixed(1)} > ${budgets[key]} ms`,
        );
    }
    if (
      report.name === "cold-start" &&
      percentile(
        report.runs.map((r) => r.readyMs),
        0.5,
      ) > budgets.coldReadyMs
    )
      failures.push("Cold battlefield readiness exceeded 2500 ms");
  }
  const output = JSON.stringify(
    {
      browser: await browser.version(),
      platform: process.platform,
      architecture: process.arch,
      frameBudgetMs: 1000 / 60,
      throttle,
      seconds,
      repeats,
      uncapped: process.argv.includes("--uncapped"),
      note: "requestAnimationFrame intervals include browser scheduling, not physical display presentation. Missed frames are estimates against a 60 Hz budget; paint measures command recording only. Input-to-paint is click-to-second-rAF latency, not physical display latency. Cold start disables HTTP cache and bypasses the service worker on a local server. CPU throttling is not a phone benchmark. Use matching real devices before claiming a speedup.",
      budgets,
      failures,
      reports,
    },
    null,
    2,
  );
  const outputFlag = process.argv.indexOf("--output");
  if (outputFlag >= 0) await writeFile(process.argv[outputFlag + 1], output);
  console.log(output);
  if (process.argv.includes("--assert"))
    assert.deepEqual(failures, [], "Browser performance budget exceeded");
} finally {
  await session.close();
}
