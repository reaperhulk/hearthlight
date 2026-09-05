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
  ]) {
    await clickText(page, building);
    await page.click(`[aria-label^="North road, plot ${plot}"]`);
  }
  assert.equal(
    (await page.evaluate(() => window.__game.getState())).round.stats.built,
    2,
  );
  await layout();
  await clickText(page, "Start Night");
  await page.waitForFunction(() => window.__game.getState().round.paused);
  assert.ok((await page.evaluate(() => window.__game.getState())).round.lessons.includes("wall"));
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

  await page.evaluate(() => window.__game.command({ type: "setting", key: "guide", value: false }));

  // Use the production engine to accelerate combat; initial controls above
  // are actual pointer/keyboard interactions. There is no state fabrication.
  for (let i = 0; i < 180; i++) {
    const before = await page.evaluate(() => window.__game.getState());
    if (before.round.phase === "won") break;
    assert.notEqual(before.round.phase, "lost");
    if (before.round.phase === "day" && before.round.night === 3) {
      assert.ok(
        await page.$eval(".build-card", (button) => button.disabled),
        "Farm spending must stop before the final night",
      );
      assert.ok(
        before.round.offers.every((id) => !["shelter", "salvage"].includes(id)),
        "Final-night rewards must still be useful",
      );
    }
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
  // Desktop height is a gate, including real control hit targets and the bottom dock.
  for (const [width, height] of [[360, 800], [390, 844], [768, 900], [1280, 650], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewport({ width, height });
    for (const name of ["first-day", "ridge-day", "ridge-battle", "victory"]) {
      await hydrate(page, scene(name));
      await page.waitForFunction(() => document.querySelector(".village-map").getBoundingClientRect().height > 100);
      await layout();
      const fit = await page.evaluate(() => {
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length).map(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { label: el.getAttribute("aria-label") || el.textContent.trim(), fits: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, hit: el.contains(hit), height: r.height };
        });
        return { overflow: document.documentElement.scrollHeight > innerHeight + 1, map: visible(".village-map"), controls: visible('.planning-actions .primary, .map-footer button, .map-footer select, .night-controls button') };
      });
      assert.equal(fit.overflow, false, `${name} ${width}×${height}: vertical page overflow`);
      assert.ok(fit.map.every(x => x.fits), `${name}: battlefield clipped`);
      assert.ok(fit.controls.every(x => x.fits && x.hit && x.height >= 43), `${name} ${width}×${height}: unreachable controls ${JSON.stringify(fit.controls)}`);
      if (width >= 1280 && name === "first-day") {
        await page.click('[aria-label^="North road, plot 2"]');
        assert.ok(await page.$eval('.planning-actions .primary', el => el.getBoundingClientRect().bottom <= innerHeight), 'Inspector pushed Start Night out of view');
        await clickText(page, "Approach");
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.forecast')).display !== 'none');
      }
    }
  }
  await hydrate(page, scene("ridge-battle"));
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
