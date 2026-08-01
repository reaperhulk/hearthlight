# Hearthlight — agent instructions

A round-based city-defense incremental. Days: one pair of hands — place one
drafted structure OR mend one bitten hit point. Nights: shades creep from
the rim; one verb — send the Warden (rested wardens redirect freely; tearing
one off a grapple costs, and banishes temper him within the run). The dark
always wins; nights survived become Embers; Embers buy permanent upgrades;
the Long Dawn (15 nights, everything kept) closes the story.

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
- `npm run perf:probe` — build + drive a CPU-throttled Chromium through the
  cheapest and heaviest scenes, reporting fps and per-frame paint cost.
  This is the render-side balance harness: measure before and after any
  drawing change. `--throttle N` (default 4x ≈ a mid-range phone),
  `--seconds N`, `--json`.
- `npm run balance:story` — narrate one keeper round night by night (add `-- --seed N`)
- `node scripts/screenshot.mjs [outDir]` — hydrate key states (day, inspector,
  night, kitted veiled late-night, fall, shop) and capture PNGs; review real
  renders, not imagination, after any visual change
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
- JSX gotcha that has shipped a bug before: `\uXXXX` escapes are literal in
  raw JSX text (fine inside JS strings). The smoke test scans rendered text
  for leaked escapes — keep it that way.
- Measure before and after every balance change with the bot harness; tune
  numbers only against measurements, and encode each promise as an assertion
  so it can never silently regress.
- The same rule binds rendering: measure with `perf:probe` before and after
  any drawing change. The game is fill-rate bound, not JS bound — a
  full-canvas `fillRect` with a gradient is the expensive thing, and the
  cost lands in rasterization where a JS profiler will not show it. The
  static scene lives on cached day/dark layers that are cross-faded, so
  adding a new per-frame full-canvas fill is the one change most likely to
  cost a third of the frame budget on a phone.
- Meta upgrades form a tree (`META_UPGRADES[].requires`). Two invariants
  keep the gating balance-neutral, both asserted in the unit tests: a
  child never costs less than its parent, and every edge runs forward
  through the bot harness's `META_ORDER`. Break either and a greedy keeper
  starts missing purchases it used to make.
- The tree has a TAIL: `rankCosts` makes a node re-buyable at rising
  prices (toughness / income / light). This is what keeps it an
  incremental — Embers must never run out of somewhere to go. Ranks are
  not part of the story: the Long Dawn asks only that every node be
  kindled (rank 1), so cycle 5's capstone calibration is independent of
  them. Two guards ride on this — a maxed town must still fall, and ranks
  must measure better than merely kindled.
- Do not "tidy" meta prices. They are a measured artifact, not a design
  sketch: a round of cosmetic ladder-smoothing in cycle 22 cost 1.4 arc
  nights before the harness caught it. Change one price at a time and
  read `balance:compare`.
- Round 1 must be fun in under five minutes, with a meta purchase affordable
  immediately after the first fall.
