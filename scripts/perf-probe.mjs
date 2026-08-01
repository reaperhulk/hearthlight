#!/usr/bin/env node
// Render cost probe: drives a real Chromium at phone-grade CPU and reads
// the paint loop's own timings back out of window.__game.paint(). The
// point is the same as the balance harness's — tune against measurements,
// never against a hunch about what "feels" expensive.
//
// Usage: node scripts/perf-probe.mjs [--throttle N] [--seconds N] [--json]
//        (expects dist/ built)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const arg = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
};
// 4x throttling puts a desktop core in the neighborhood of a mid-range
// phone — the device this game is actually played on.
const THROTTLE = arg('--throttle', 4);
const SECONDS = arg('--seconds', 6);
const jsonMode = process.argv.includes('--json');
const say = (...args) => { if (!jsonMode) console.log(...args); };

const executablePath = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .filter(Boolean).find(candidate => existsSync(candidate));
if (!executablePath) { console.error('no chromium — set CHROME_PATH'); process.exit(1); }

const PORT = 4175;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const cleanup = () => { try { process.kill(-server.pid); } catch { /* gone */ } };
process.on('exit', cleanup);
await new Promise((resolve, reject) => {
  const started = Date.now();
  const poll = () => fetch(`http://localhost:${PORT}/`)
    .then(() => resolve())
    .catch(() => (Date.now() - started > 20000 ? reject(new Error('preview never came up')) : setTimeout(poll, 250)));
  poll();
});

const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => window.localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });

// ── Scenes ──────────────────────────────────────────────────────────────────
// Each scene is a state the player really reaches. The heavy ones are the
// budget: if a kitted veiled night holds its frame, everything else does.
const hydrate = {
  // Early day: one ring, four buildings. The floor.
  day: () => window.__game.setState(state => {
    const round = { ...state.round };
    const put = (index, type, hp, level = 1) => {
      round.slots = round.slots.map((slot, i) => i === index
        ? { ...slot, structure: { type, hp, level, nightsSurvived: 0 } } : slot);
    };
    put(0, 'watchtower', 1); put(1, 'lantern', 1); put(2, 'farm', 2); put(3, 'palisade', 2);
    round.day = 4; round.glow = 22; round.heart = 55;
    return { ...state, round };
  }),
  // A kitted veiled night: both rings full, mist, a dozen shades, low
  // heart (so the vignette pulses too). The worst frame the game has.
  lateNight: () => window.__game.setState(state => {
    const meta = { ...state.meta, outerRing: true, secondWarden: true, heartstone: true };
    const round = { ...state.round };
    const ringSlots = [];
    for (let ring = 0; ring < 2; ring++) {
      const count = ring === 0 ? 6 : 10;
      for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        const radius = ring === 0 ? 0.26 : 0.4;
        ringSlots.push({
          id: `r${ring}s${index}`, ring,
          x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius,
          structure: null, ruin: false,
        });
      }
    }
    const types = ['watchtower', 'lantern', 'palisade', 'farm', 'belltower', 'watchtower',
      'palisade', 'lantern', 'farm', 'granary', 'well', 'shrine', 'emberKiln', 'palisade', 'watchtower'];
    round.slots = ringSlots.map((slot, index) => index < types.length
      ? { ...slot, structure: { type: types[index], hp: 2, level: index % 3 + 1, nightsSurvived: 8 } }
      : { ...slot, ruin: true });
    const time = round.time;
    round.day = 12; round.phase = 'night'; round.phaseStart = time - 10;
    round.glow = 84; round.heart = 22; round.heartMax = 105;
    round.towerCharges = { r0s0: 1, r0s5: 0, r1s4: 2 };
    round.stats = { ...round.stats, nights: [...round.stats.nights,
      { night: 12, spawned: 13, slowed: 2, banished: 1, towerKills: 1, fed: 2, heartLost: 18, minHeart: 22, omen: 'veiled' }] };
    round.shades = Array.from({ length: 12 }, (_, index) => ({
      id: 20 + index,
      targetSlotId: index % 4 === 3 ? null : ringSlots[index % ringSlots.length].id,
      spawnAngle: index * 0.53,
      spawnedAt: time - 4,
      arrivesAt: time + (index % 3) * 2 - 1,
      phase: index % 3 === 0 ? 'approach' : index % 3 === 1 ? 'feeding' : 'held',
      heldSince: index % 3 === 2 ? time - 1 : null,
      feedsAt: index % 3 === 1 ? time + 3 : null,
    }));
    round.wardens = [{ id: 1, slotId: 'r0s2', movedAt: time - 2 }, { id: 2, slotId: 'r1s0', movedAt: time - 5 }];
    return { ...state, meta, round };
  }),
};

async function measure(name, setup) {
  await page.click('.begin');
  await page.waitForFunction(() => window.__game?.getState().round?.phase === 'day');
  await page.evaluate(setup);
  // Let the scene settle, then sample a clean window.
  await new Promise(resolve => setTimeout(resolve, 800));
  await page.evaluate(() => window.__game.resetPaint());
  await new Promise(resolve => setTimeout(resolve, SECONDS * 1000));
  const paint = await page.evaluate(() => window.__game.paint());
  // Back to the fire for the next scene.
  await page.evaluate(() => window.__game.setState(state => ({ ...state, round: null })));
  await page.waitForSelector('.begin');
  return {
    scene: name,
    fps: paint.frames / SECONDS,
    mean: paint.mean,
    p95: paint.p95,
    max: paint.max,
  };
}

const client = await page.createCDPSession();
await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

const results = [];
for (const [name, setup] of Object.entries(hydrate)) {
  results.push(await measure(name, setup));
}

await browser.close();
cleanup();

if (jsonMode) {
  console.log(JSON.stringify({ throttle: THROTTLE, seconds: SECONDS, results }, null, 2));
} else {
  say(`\nHearthlight paint cost | ${THROTTLE}x CPU throttle | ${SECONDS}s per scene\n`);
  for (const result of results) {
    say(`  ${result.scene.padEnd(11)} ${result.fps.toFixed(0).padStart(3)} fps` +
      ` | frame ${result.mean.toFixed(2)}ms mean, ${result.p95.toFixed(2)}ms p95, ${result.max.toFixed(2)}ms worst` +
      ` | ${((result.mean / 16.7) * 100).toFixed(0)}% of a 60fps budget`);
  }
  say('');
}
