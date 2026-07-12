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

// The fall.
await page.evaluate(() => {
  window.__game.setState(state => ({
    ...state,
    round: { ...state.round, phase: 'fallen', heart: 0, shades: [] },
  }));
});
await shot('fallen');

await browser.close();
cleanup();
console.log('done');
