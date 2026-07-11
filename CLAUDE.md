# Hearthlight — agent instructions

A round-based city-defense incremental. Days: draft 3 structures, place 1.
Nights: shades creep from the rim; one verb — send the Warden. The dark
always wins; nights survived become Embers; Embers buy permanent upgrades.

## Project structure
- `src/engine/` — pure deterministic game logic. `tick(state, dt, rng)` → new
  state. ALL randomness flows through the injected rng. No browser deps.
- `src/ui/` — React + a 2D canvas town map (420 logical px, 2x backing store).
- `scripts/bot-playtest.js` — deterministic bot profiles + loop-promise
  assertions. This is the balance gate; run it before every commit.

## Commands
- `npm run dev` — Vite dev server
- `npm run test:unit` — engine unit tests
- `npm run test:balance` — bot profiles + assertions (five fixed seeds, deterministic)
- `npm run test:quality` — lint + unit + balance + build (run before commit)
- `npm run test:smoke` — build + real-Chromium smoke: one full loop through
  the UI (place, night, fall, collect, shop); fails on console errors or
  horizontal overflow. Uses CHROME_PATH or the preinstalled Chromium.
  `window.__game` (getState/setState/fastForward) is the test handle.
- `npm run balance:story` — narrate one keeper round night by night (add `-- --seed N`)
- `npm run balance:compare` — diff current numbers against scripts/balance-baseline.json;
  exits nonzero when a metric drifts past tolerance
- `npm run balance:baseline` — regenerate the committed baseline. Run this in the
  same commit as any deliberate balance change — the baseline diff documents
  exactly what the change did to the measured game.
- `node scripts/bot-playtest.js --assert` — local run: fixed seeds plus one
  random lane that prints its repro seed

## Repo policy
- Commit directly to `main` and push after every coherent, gate-passing
  change. No long-lived branches.
- ROADMAP.md is the iteration queue; update its checkboxes as work lands.

## Design doctrine (non-negotiable)
- Decisions, not busywork. One placement per day; one verb per night.
- The wall always wins; how long you delay it is the scoreboard.
- Randomness is bounded and visible (draft pity guarantees a defense option;
  gambles like deep-route double-finds have stated odds).
- Meta pre-pays costs; it never skips decisions.
- Keep determinism: never call Math.random inside the engine — thread the rng.
- Measure before and after every balance change with the bot harness; tune
  numbers only against measurements, and encode each promise as an assertion
  so it can never silently regress.
- Round 1 must be fun in under five minutes, with a meta purchase affordable
  immediately after the first fall.
