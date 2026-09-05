import assert from "node:assert/strict";
import { browserSession, clickText, hydrate } from "./browser-session.mjs";
import { planDay, nightAction } from "./campaign-balance.js";
import { freshGame } from "../src/engine/campaign.js";
import { scene } from "./scenes.mjs";

const session = await browserSession();
const { page, errors } = session;
async function layout() {
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    escapes: /\\u[0-9a-f]{4}/i.test(document.body.innerText),
    stamp: document.querySelector(".footer code")?.textContent,
  }));
  assert.equal(result.overflow, false, "Horizontal overflow");
  assert.equal(result.escapes, false, "Leaked JSX Unicode escape");
  assert.ok(result.stamp && result.stamp !== "unknown", "Missing build stamp");
}
try {
  await hydrate(page, freshGame());
  await layout();
  await clickText(page, "Light the first fire");
  for (const [building, plot] of [
    ["Farm", 3],
    ["Timber wall", 1],
    ["Watchtower", 2],
  ]) {
    await clickText(page, building);
    await page.click(`[aria-label^="North road, plot ${plot}"]`);
  }
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).round.stats.built,
    3,
  );
  await layout();
  await clickText(page, "Start Night");
  await page.click('[aria-label="Send Warden to North road"]');
  await page.waitForFunction(
    () => window.__game.getState().round.warden.deployed,
  );
  await page.waitForFunction(
    () => window.__game.getState().round.enemies.length > 0,
  );
  await page.click('[aria-label="Lantern burst on North road"]');
  await page.waitForFunction(() => window.__game.getState().round.bursts === 1);
  await page.click('[aria-label="Open settings"]');
  assert.ok((await page.evaluate(() => window.__game.getState())).round.paused);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await clickText(page, "Resume night");

  // Use the production engine to accelerate combat; initial controls above
  // are actual pointer/keyboard interactions. There is no state fabrication.
  for (let i = 0; i < 180; i++) {
    const before = await page.evaluate(() => window.__game.getState());
    if (before.round.phase === "won") break;
    assert.notEqual(before.round.phase, "lost");
    const next =
      before.round.phase === "day" ? planDay(before) : nightAction(before);
    const commands = next.round.commands.slice(before.round.commands.length);
    await page.evaluate((actions) => {
      for (const action of actions) window.__game.command(action);
      window.__game.advance(1);
    }, commands);
    await page.waitForFunction(
      (time) => {
        const r = window.__game.getState().round;
        return r.time > time;
      },
      {},
      before.round.time,
    );
  }
  await page.waitForSelector(".outcome.won");
  await clickText(page, "Carry the fire home");
  await page.waitForSelector(".kit");
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).embers,
    17,
  );
  await clickText(page, "Stone & timber");
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).kit,
    "mason",
  );
  await clickText(page, "Return to Briar Hollow");
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).round.town,
    "meadow",
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".village-map");
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).round.kit,
    "mason",
  );
  await hydrate(page, scene("ridge-battle"));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewport({ width, height: 900 });
    await layout();
  }
  await page.click('[aria-label="Open settings"]');
  await page.click(".settings summary");
  await clickText(page, "Export save");
  const saved = await page.$eval('[aria-label="Save transfer text"]', (el) =>
    JSON.parse(el.value),
  );
  assert.equal(saved.round.town, "ridge");
  assert.deepEqual(errors, [], "Browser console/page errors");
  console.log(
    "Browser smoke passed: build, defend, win, reward, kit, save, settings and responsive layouts.",
  );
} finally {
  await session.close();
}
