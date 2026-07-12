#!/usr/bin/env node
// Browser smoke test: drives a real Chromium through one full loop —
// home -> begin -> place -> dusk -> night -> fall -> collect -> shop.
// Fails on any console error, page error, or progression miss.
// Usage: node scripts/browser-smoke.mjs   (builds are expected in dist/)
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

const executablePath = CHROME_CANDIDATES.find(candidate => existsSync(candidate));
if (!executablePath) {
  console.error(`✗ no Chromium found (tried ${CHROME_CANDIDATES.join(', ')}) — set CHROME_PATH`);
  process.exit(1);
}

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() - started > timeoutMs) return reject(new Error('preview server never came up'));
      setTimeout(poll, 250);
    };
    poll();
  });
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const cleanup = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
process.on('exit', cleanup);

const failures = [];
const note = message => console.log(`  ${message}`);

try {
  await waitForServer(URL);
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 900 });
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`);
  });
  page.on('pageerror', error => failures.push(`page error: ${error.message}`));

  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });

  // Home: the vigil beckons.
  await page.waitForSelector('.begin', { timeout: 5000 });
  note('home renders');
  await page.click('.begin');
  await page.waitForSelector('canvas.town-map', { timeout: 5000 });
  await page.waitForFunction(() => window.__game?.getState().round?.phase === 'day', { timeout: 5000 });
  note('round begins at day');

  // Day: pick the first affordable card and tap an empty slot on the map.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.draft button')].some(button => !button.disabled), { timeout: 8000 });
  await page.evaluate(() => {
    [...document.querySelectorAll('.draft button')].find(button => !button.disabled).click();
  });
  const target = await page.evaluate(() => {
    const round = window.__game.getState().round;
    const slot = round.slots.find(candidate => !candidate.structure);
    const rect = document.querySelector('canvas.town-map').getBoundingClientRect();
    return { x: rect.left + slot.x * rect.width, y: rect.top + slot.y * rect.height };
  });
  await page.mouse.click(target.x, target.y);
  const placed = await page.waitForFunction(
    () => window.__game.getState().round.slots.some(slot => slot.structure), { timeout: 3000 })
    .then(() => true).catch(() => false);
  if (!placed) failures.push('placing a structure via canvas tap did not land');
  else note('structure placed by canvas tap');

  // Call the dusk, then let the harness clock run the night out.
  await page.click('.end-day');
  await page.waitForFunction(() => window.__game.getState().round.phase === 'night', { timeout: 3000 });
  note('dusk falls');

  // Night: the mirror button posts the warden at the threat.
  const posted = await page.waitForSelector('.night-controls button', { timeout: 12000 })
    .then(async () => {
      await page.click('.night-controls button');
      return page.waitForFunction(
        () => window.__game.getState().round.wardens.some(warden => warden.slotId),
        { timeout: 3000 }).then(() => true).catch(() => false);
    })
    .catch(() => false);
  if (!posted) failures.push('night threat button did not post the warden');
  else note('warden posted from the night panel');

  // Fast-forward the whole round to its inevitable end.
  for (let hops = 0; hops < 20; hops++) {
    const phase = await page.evaluate(() => {
      window.__game.fastForward(60);
      return window.__game.getState().round?.phase;
    });
    if (phase === 'fallen') break;
  }
  const fell = await page.evaluate(() => window.__game.getState().round?.phase === 'fallen');
  if (!fell) failures.push('the town never fell — the wall must always win');
  else note('the wall wins, as promised');

  // The chronicle pays, and the shop opens.
  await page.waitForSelector('.fallen-panel .begin', { timeout: 4000 });
  const embersEarned = await page.evaluate(() => {
    const text = document.querySelector('.chronicle .total strong')?.textContent;
    return Number(text);
  });
  if (!(embersEarned >= 1)) failures.push(`fall paid ${embersEarned} embers`);
  else note(`fall pays ${embersEarned} embers`);
  await page.click('.fallen-panel .to-the-fire');
  await page.waitForSelector('.shop', { timeout: 4000 });
  const banked = await page.evaluate(() => window.__game === undefined
    ? null
    : document.querySelectorAll('.shop button').length);
  if (!banked) failures.push('shop did not render after collecting');
  else note('embers banked, shop open');

  // A vigil can be abandoned: double-tap walks away, the chronicle pays.
  await page.click('.begin');
  await page.waitForSelector('.abandon', { timeout: 5000 });
  await page.click('.abandon');
  await page.click('.abandon');
  const abandoned = await page.waitForSelector('.fallen-panel', { timeout: 3000 })
    .then(() => true).catch(() => false);
  if (!abandoned) failures.push('abandoning the vigil did not end the round');
  else note('vigil abandoned by double-tap, chronicle shown');

  // No raw escape sequences leaking into visible text (\uXXXX in JSX
  // text renders literally — it has happened).
  const rawEscapes = await page.evaluate(() => /\\u[0-9a-fA-F]{4}/.test(document.body.innerText));
  if (rawEscapes) failures.push('visible text contains a literal \\uXXXX escape');
  else note('no raw escapes in visible text');

  // No horizontal scroll on a phone-width viewport.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (overflow) failures.push('layout overflows the 420px viewport horizontally');
  else note('no horizontal overflow at 420px');

  await browser.close();
} catch (error) {
  failures.push(`smoke run crashed: ${error.message}`);
}

cleanup();
console.log('\n── Browser smoke ──');
if (failures.length > 0) {
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
console.log('  ✓ one full loop, no console errors, no overflow');
