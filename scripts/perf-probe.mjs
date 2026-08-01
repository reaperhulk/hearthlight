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
// Best-of-N, not mean-of-N. A shared machine only ever makes a scene
// slower, never faster, so the best sample is the one least polluted by
// whatever else was running. Learned the hard way: an unchanged build
// measured 58fps and then 33fps an hour apart, which silently invalidated
// every A/B comparison taken in between.
const REPEATS = arg('--repeat', 3);
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

// rAF is vsync-locked, so a stock browser cannot report past ~60fps no
// matter how cheap the frame is. To ask "could this hold 120?" the clock
// has to come off — otherwise every measurement is really measuring the
// display.
const browser = await puppeteer.launch({
  executablePath,
  args: [
    '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu-vsync', '--disable-frame-rate-limit',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
// domcontentloaded, not networkidle: with the frame-rate limit off the
// renderer never goes quiet, so an idle-based wait simply times out.
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.begin', { timeout: 20000 });

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
    round.glow = 84; round.heart = 30; round.heartMax = 105;
    round.towerCharges = { r0s0: 1, r0s5: 0, r1s4: 2 };
    round.stats = { ...round.stats, nights: [...round.stats.nights,
      { night: 12, spawned: 13, slowed: 2, banished: 1, towerKills: 1, fed: 2, heartLost: 18, minHeart: 22, omen: 'veiled' }] };
    // Deadlines parked far out: a scene that resolves mid-measurement is
    // measuring an empty map. This one used to fall before the sample even
    // started, and reported the frame rate of a dead town.
    round.shades = Array.from({ length: 12 }, (_, index) => ({
      id: 20 + index,
      targetSlotId: index % 4 === 3 ? null : ringSlots[index % ringSlots.length].id,
      spawnAngle: index * 0.53,
      spawnedAt: time - 600,
      arrivesAt: time + 600,
      phase: index % 2 === 0 ? 'approach' : 'feeding',
      heldSince: null,
      feedsAt: index % 2 === 1 ? time + 600 : null,
    }));
    round.wardens = [{ id: 1, slotId: 'r0s2', movedAt: time - 2 }, { id: 2, slotId: 'r1s0', movedAt: time - 5 }];
    return { ...state, meta, round };
  }),
};

// Dusk with the wave inbound — the moment players actually complain
// about, and the one the static scenes above miss entirely. Everything
// lands at once here: the night title card (a BLURRED shadow), the dusk
// sweep ring, and a full wave of shades in APPROACH, each drawing a
// dashed trail from the rim, three ghosts of itself, and a gradient core.
// It has to run through a real day -> night state transition, because
// that is what makes App's telemetry diff fire the banner and the sweep.
async function duskScene() {
  await page.evaluate(() => window.__game.setState(state => {
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
      'palisade', 'lantern', 'farm', 'granary', 'well', 'shrine', 'emberKiln', 'palisade'];
    round.slots = ringSlots.map((slot, index) => index < types.length
      ? { ...slot, structure: { type: types[index], hp: 3, level: 2, nightsSurvived: 6 } }
      : slot);
    round.day = 13; round.phase = 'day'; round.heart = 70; round.heartMax = 105;
    return { ...state, meta: { ...state.meta, outerRing: 1, secondWarden: 1, heartstone: 1 }, round };
  }));
  await new Promise(resolve => setTimeout(resolve, 400));
  // The transition itself: a full wave spawns and streams in from the rim.
  await page.evaluate(() => window.__game.setState(state => {
    const round = { ...state.round };
    const time = round.time;
    const targets = round.slots.filter(slot => slot.structure);
    round.phase = 'night';
    round.phaseStart = time;
    round.towerCharges = { r0s0: 2, r0s5: 2 };
    round.stats = { ...round.stats, nights: [...round.stats.nights,
      { night: 13, spawned: 17, slowed: 3, banished: 0, towerKills: 0, fed: 0, heartLost: 0, minHeart: 70, omen: null }] };
    // Every shade still on the wing: the approach is the expensive phase.
    round.shades = Array.from({ length: 17 }, (unused, index) => ({
      id: 40 + index,
      targetSlotId: index % 5 === 4 ? null : targets[index % targets.length].id,
      spawnAngle: index * 0.37,
      spawnedAt: time - 300,
      arrivesAt: time + 300 + (index % 5),
      phase: 'approach',
      heldSince: null,
      feedsAt: null,
    }));
    round.wardens = [{ id: 1, slotId: null, movedAt: time }, { id: 2, slotId: null, movedAt: time }];
    return { ...state, round };
  }));
}

async function measure(name, setup, seconds = SECONDS) {
  await page.click('.begin');
  await page.waitForFunction(() => window.__game?.getState().round?.phase === 'day');
  if (typeof setup === 'function' && setup.constructor.name === 'AsyncFunction') {
    // Build the scene FIRST, then start counting. Resetting before setup
    // charged the scene's own construction — two setStates and a terrain
    // repaint — to the frame rate, which made dusk look far worse than it
    // renders.
    await setup();
    await page.evaluate(() => window.__game.resetPaint());
  } else {
    await page.evaluate(setup);
    // Let the scene settle, then sample a clean window.
    await new Promise(resolve => setTimeout(resolve, 800));
    await page.evaluate(() => window.__game.resetPaint());
  }
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  const paint = await page.evaluate(() => window.__game.paint());
  // What was actually on screen. A scene whose shades all resolved into
  // dawn mid-measurement is measuring an empty map, and will happily
  // report a number nobody can act on.
  const scene = await page.evaluate(() => {
    const round = window.__game.getState().round;
    return round
      ? { phase: round.phase, shades: round.shades.length, built: round.slots.filter(s => s.structure).length }
      : { phase: 'none', shades: 0, built: 0 };
  });
  // Back to the fire for the next scene.
  await page.evaluate(() => window.__game.setState(state => ({ ...state, round: null })));
  await page.waitForSelector('.begin');
  return {
    scene: name,
    saw: scene,
    fps: paint.frames / seconds,
    mean: paint.mean,
    p95: paint.p95,
    max: paint.max,
  };
}

const client = await page.createCDPSession();
await client.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

const onlyIndex = process.argv.indexOf('--scene');
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
// A scene that resolved while being sampled is not the scene anyone
// asked for. Say so loudly rather than publishing the number.
const EXPECTED = {
  day: { phase: 'day', shades: 0 },
  lateNight: { phase: 'night', shades: 12 },
  dusk: { phase: 'night', shades: 17 },
};
const suspect = result => {
  const want = EXPECTED[result.scene];
  if (!want) return null;
  if (result.saw.phase !== want.phase) return `phase ${result.saw.phase}, wanted ${want.phase}`;
  if (result.saw.shades !== want.shades) return `${result.saw.shades} shades, wanted ${want.shades}`;
  return null;
};

const best = (a, b) => (!a || b.fps > a.fps ? b : a);
const results = [];
for (const [name, setup] of Object.entries(hydrate)) {
  if (only && only !== name) continue;
  let winner = null;
  for (let run = 0; run < REPEATS; run++) winner = best(winner, await measure(name, setup));
  results.push(winner);
}
// Sampled over 3s: the banner holds for 2.6 and the sweep for 0.9, so a
// longer window would average the complaint away.
if (!only || only === 'dusk') {
  let winner = null;
  for (let run = 0; run < REPEATS; run++) winner = best(winner, await measure('dusk', duskScene, 3));
  results.push(winner);
}

await browser.close();
cleanup();

if (jsonMode) {
  console.log(JSON.stringify({ throttle: THROTTLE, seconds: SECONDS, results }, null, 2));
} else {
  say(`\nHearthlight paint cost | ${THROTTLE}x CPU throttle | ${SECONDS}s per scene | best of ${REPEATS}\n`);
  for (const result of results) {
    say(`  ${result.scene.padEnd(11)} ${result.fps.toFixed(0).padStart(3)} fps` +
      ` | frame ${result.mean.toFixed(2)}ms mean, ${result.p95.toFixed(2)}ms p95, ${result.max.toFixed(2)}ms worst` +
      ` | drew ${result.saw.shades} shades, ${result.saw.built} built, ${result.saw.phase}` +
      `${suspect(result) ? `  <-- SCENE DRIFTED: ${suspect(result)}` : ''}`);
  }
  say('');
}
