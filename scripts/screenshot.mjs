#!/usr/bin/env node
// Screenshot harness: captures the game's key states as PNGs so graphical
// work can be reviewed against real renders, not imagination.
// Usage: node scripts/screenshot.mjs <outDir>   (expects dist/ built)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const outDir = process.argv[2] || '/tmp/hearthlight-shots';
mkdirSync(outDir, { recursive: true });

const executablePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome']
  .filter(Boolean).find(candidate => existsSync(candidate));
if (!executablePath) { console.error('no chromium'); process.exit(1); }

const PORT = 4174;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const cleanup = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
process.on('exit', cleanup);
await new Promise(resolve => {
  const poll = () => fetch(`http://localhost:${PORT}/`).then(() => resolve()).catch(() => setTimeout(poll, 250));
  poll();
});

const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 860, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });

const shot = async name => {
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`  ${name}.png`);
};

// Home.
await page.waitForSelector('.begin');
await shot('home');

// A built-out day: hydrate a mid-round town directly.
await page.click('.begin');
await page.waitForFunction(() => window.__game?.getState().round?.phase === 'day');
await page.evaluate(() => {
  window.__game.setState(state => {
    const round = { ...state.round };
    const put = (index, type, hp, level = 1, nights = 0) => {
      round.slots = round.slots.map((slot, i) => i === index
        ? { ...slot, structure: { type, hp, level, nightsSurvived: nights } }
        : slot);
    };
    put(0, 'watchtower', 1, 2, 3);
    put(1, 'lantern', 1);
    put(2, 'farm', 2, 2, 4);
    put(3, 'palisade', 2);
    put(4, 'granary', 1);
    round.slots = round.slots.map((slot, i) => i === 5 ? { ...slot, ruin: true } : slot);
    round.day = 4;
    round.glow = 22;
    round.heart = 55;
    return { ...state, round };
  });
});
await shot('day');

// The inspector, open on a bitten palisade: the mend button in frame.
await page.evaluate(() => {
  const round = window.__game.getState().round;
  const slot = round.slots.find(candidate => candidate.id === 'r0s3');
  const rect = document.querySelector('canvas.town-map').getBoundingClientRect();
  const x = rect.left + slot.x * rect.width;
  const y = rect.top + slot.y * rect.height;
  const target = document.elementFromPoint(x, y);
  ['pointerdown', 'pointerup', 'click'].forEach(type =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y })));
});
await shot('inspect');

// Night under assault: shades in all phases, warden posted.
await page.evaluate(() => {
  window.__game.setState(state => {
    const round = { ...state.round };
    const time = round.time;
    round.phase = 'night';
    round.phaseStart = time;
    round.placedToday = false;
    round.towerCharges = { r0s0: 3 };
    round.stats = { ...round.stats, nights: [...round.stats.nights, { night: 4, spawned: 5, slowed: 1, banished: 0, towerKills: 0, fed: 0, heartLost: 0, minHeart: round.heart, omen: null }] };
    round.shades = [
      { id: 1, targetSlotId: 'r0s2', spawnAngle: 0.4, spawnedAt: time - 3, arrivesAt: time + 5, phase: 'approach', heldSince: null, feedsAt: null },
      { id: 2, targetSlotId: 'r0s3', spawnAngle: 2.2, spawnedAt: time - 6, arrivesAt: time - 1, phase: 'feeding', heldSince: null, feedsAt: time + 3 },
      { id: 3, targetSlotId: 'r0s4', spawnAngle: 4.1, spawnedAt: time - 6, arrivesAt: time - 2, phase: 'held', heldSince: time - 1, feedsAt: null },
      { id: 4, targetSlotId: null, spawnAngle: 5.3, spawnedAt: time - 2, arrivesAt: time + 7, phase: 'approach', heldSince: null, feedsAt: null },
      { id: 5, targetSlotId: 'r0s3', spawnAngle: 2.6, spawnedAt: time - 5, arrivesAt: time - 1, phase: 'feeding', heldSince: null, feedsAt: time + 4 },
    ];
    round.wardens = round.wardens.map(warden => warden.id === 1 ? { ...warden, slotId: 'r0s4', movedAt: time - 2 } : warden);
    return { ...state, round };
  });
});
await shot('night');

// A kitted late night: outer ring, veterans, two wardens, veiled mist.
await page.evaluate(() => {
  window.__game.setState(state => {
    const meta = { ...state.meta, outerRing: true, secondWarden: true, heartstone: true };
    let round = { ...state.round };
    // Rebuild the map with both rings.
    const ringSlots = [];
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 6 : 10;
      for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        const radius = ring === 0 ? 0.26 : 0.4;
        ringSlots.push({
          id: `r${ring}s${index}`, ring,
          x: 0.5 + Math.cos(angle) * radius,
          y: 0.5 + Math.sin(angle) * radius,
          structure: null, ruin: false,
        });
      }
    }
    round.slots = ringSlots;
    const put = (id, type, hp, level = 1, nights = 0) => {
      round.slots = round.slots.map(slot => slot.id === id
        ? { ...slot, structure: { type, hp, level, nightsSurvived: nights } }
        : slot);
    };
    put('r0s0', 'watchtower', 3, 3, 8);
    put('r0s1', 'lantern', 1, 2, 5);
    put('r0s2', 'palisade', 2, 3, 9);
    put('r0s3', 'farm', 3, 3, 8);
    put('r0s4', 'belltower', 2, 2, 4);
    put('r0s5', 'watchtower', 2, 2, 5);
    put('r1s0', 'palisade', 3, 1, 1);
    put('r1s2', 'farm', 1, 1, 2);
    put('r1s3', 'granary', 2, 2, 4);
    put('r1s5', 'well', 1, 1, 1);
    put('r1s7', 'shrine', 1, 1, 2);
    put('r1s8', 'emberKiln', 1, 1, 1);
    round.slots = round.slots.map(slot => slot.id === 'r1s9' ? { ...slot, ruin: true } : slot);
    const time = round.time;
    round.day = 12;
    round.phase = 'night';
    round.phaseStart = time - 10; // deep night: full darkness, full mist
    round.glow = 84;
    round.heart = 61;
    round.heartMax = 105;
    round.placedToday = false;
    round.towerCharges = { r0s0: 1, r0s5: 0 };
    round.stats = { ...round.stats, nights: [...round.stats.nights, { night: 12, spawned: 13, slowed: 2, banished: 1, towerKills: 1, fed: 2, heartLost: 18, minHeart: 61, omen: 'veiled' }] };
    round.shades = [
      { id: 11, targetSlotId: 'r1s3', spawnAngle: 0.7, spawnedAt: time - 2, arrivesAt: time + 4, phase: 'approach', heldSince: null, feedsAt: null },
      { id: 12, targetSlotId: 'r0s2', spawnAngle: 2.4, spawnedAt: time - 5, arrivesAt: time - 1, phase: 'feeding', heldSince: null, feedsAt: time + 2.5 },
      { id: 13, targetSlotId: 'r1s0', spawnAngle: 3.6, spawnedAt: time - 4, arrivesAt: time - 1.5, phase: 'held', heldSince: time - 1, feedsAt: null },
      { id: 14, targetSlotId: null, spawnAngle: 5.0, spawnedAt: time - 1, arrivesAt: time + 6, phase: 'approach', heldSince: null, feedsAt: null },
      { id: 15, targetSlotId: 'r1s7', spawnAngle: 4.2, spawnedAt: time - 3, arrivesAt: time + 2, phase: 'approach', heldSince: null, feedsAt: null },
      { id: 16, targetSlotId: 'r0s3', spawnAngle: 1.4, spawnedAt: time - 6, arrivesAt: time - 2, phase: 'feeding', heldSince: null, feedsAt: time + 1.2 },
    ];
    round.wardens = [
      { id: 1, slotId: 'r1s0', movedAt: time - 2 },
      { id: 2, slotId: null, movedAt: time - 9 },
    ];
    return { ...state, meta, round };
  });
});
await shot('late-night');

// The fall.
await page.evaluate(() => {
  window.__game.setState(state => ({
    ...state,
    round: { ...state.round, phase: 'fallen', heart: 0, shades: [] },
  }));
});
await shot('fallen');

// The fire: collect and open the shop.
await page.evaluate(() => {
  const button = document.querySelector('.fallen-panel .to-the-fire');
  if (button) button.click();
});
await page.waitForSelector('.shop', { timeout: 4000 }).catch(() => {});
await shot('shop');

await browser.close();
cleanup();
console.log('done');
