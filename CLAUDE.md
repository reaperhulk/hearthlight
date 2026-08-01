# Hearthlight — agent instructions

A round-based city-defense incremental. Days: a HAND — Glow arrives as a
morning wage and you play as many drafted cards as it affords, plus a
capped mend. Nights: shades creep from
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

## Build stamp
- `vite.config.js` injects `__COMMIT__` at build time: `GITHUB_SHA` in
  Actions, otherwise the local short hash with `-dirty` appended when the
  tree is not clean. The home screen prints it, so a deployed page can
  always say which commit it is and a hand-built one never passes for a
  shipped one. The smoke test asserts it renders and is visible.

## Repo policy
- Commit directly to `main` and push after every coherent, gate-passing
  change. No long-lived branches.
- ROADMAP.md is the iteration queue; update its checkboxes as work lands.

## Design doctrine (non-negotiable)
- Decisions, not busywork — but NOT so few that there is nothing to do.
  The rule was "one placement per day; one verb per night" for twenty-five
  cycles, and it measured healthy the whole time while playing inert: 4.9
  actions a minute, one every twelve seconds, seven consecutive days with
  no decision at all once the map filled, and towers killing three
  quarters of everything that died. The day is a hand now; the night is
  still one verb, and is still the thin half.
- ENGAGEMENT IS A MEASURED PROMISE, not a feeling. The harness reports
  actions/min split by phase and the share of kills the PLAYER caused, and
  asserts on both. Every other panel measures OUTCOMES — nights survived,
  embers banked, the spread between strategies — and a game can pass all
  of them while nobody is playing. That is exactly what happened.
- Glow is a MORNING WAGE, paid in full at dawn and spent immediately. It
  used to trickle in real time, which made the correct play "stand still
  until the meter catches up with the card you already chose". A budget
  you hold is a decision; a budget you are waiting for is a queue.
- The map must outlast the day. Six slots plus a hand of three filled up
  by day two and every day after was dead air; three rings (9 / 13 / 15,
  the third being the Outer Ring's frontier) keep the town somewhere you
  are still shaping when the dark finally wins.
- The dark comes for WHAT YOU BUILT: past a keep's worth of buildings,
  every few structures draws another shade. Without it a sprawling town
  was strictly safer than a small one and placement stopped being a
  choice; charging from the first stone instead made turtling beat
  building, which is worse. Only sprawl pays.
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
- `rAF` IS VSYNC-LOCKED: without `--disable-gpu-vsync --disable-frame-rate-limit`
  no browser reports past ~60fps, so every "60fps" in this repo's history
  was really "hit the display's ceiling". The probe passes those flags and
  waits on `domcontentloaded`, never `networkidle0` (an uncapped rAF loop
  never goes idle).
- CHECK WHAT THE SCENE ACTUALLY DREW. The probe prints shades/built/phase
  per scene and flags SCENE DRIFTED, because the `lateNight` scene spent a
  whole cycle silently measuring a FALLEN town — 0 shades, no canvas
  mounted — and reporting it as the game's heaviest frame. A perf number
  without a description of what was on screen is not evidence.
- Draw CALLS, not pixels, are what this renderer is bound by. Halving the
  backing store of the per-frame layer changed nothing; no-oping the same
  calls tripled the frame rate. Batch or bake anything drawn per-entity
  (the star field was 46 one-pixel fillRects a frame; a shade was eight
  paths and is now one blit).
- The probe is BEST-OF-N, and it has to be: a shared box only ever makes a
  scene slower. An unchanged build measured 58fps and 33fps an hour apart,
  which silently invalidated a whole afternoon of A/B comparisons. Before
  trusting any render delta, re-measure the CONTROL in the same session —
  if the control has moved, the comparison is worthless, and no amount of
  repeating will fix a drifting machine. Prefer changes that are provably
  less work (a blit that cannot be seen, a layer the compositor can own)
  over changes that merely measure faster once.
- READ THE FPS COLUMN, not the frame-ms column. Canvas2D commands are
  recorded and rasterized later, so `window.__game.paint()` measures
  command recording and UNDERCOUNTS the real cost — a change has twice
  measured as ~1ms of paint while costing a third of the frame rate. The
  ms figures are useful for comparing two versions of the same scene;
  only fps says whether frames land.
- Per-frame gradients scale with the number of things on screen: seventeen
  shades meant seventeen `createRadialGradient` calls a frame. Anything
  drawn once per entity wants a cached sprite (`coreSprite`), and any
  dashed stroke wants to be SHORT — dash tessellation is charged by path
  length, every frame, and a trail across the map is expensive.
- THE ENGINE FLUSHES AT 10Hz; THE CANVAS PAINTS AT THE DISPLAY'S RATE.
  Anything positioned from `round.time` therefore moves in 100ms steps
  unless it reads the INTERPOLATED clock the paint loop carries between
  flushes (`renderTime()` in App, threaded into `drawTown`). This shipped
  broken for five cycles: shades, countdown arcs and Warden readiness all
  stepped ten times a second while the frame rate climbed past 120, and no
  amount of render optimization touched it — a fast frame rate drawing
  stale positions is still stuttery. The browser smoke asserts the drawn
  clock takes a distinct value EVERY frame. Anything React drives from the
  engine clock (the dark terrain layer's opacity) wants a CSS transition
  for the same reason.
- Render by CHANGE FREQUENCY, in three tiers: terrain (two stacked
  canvases cross-faded by CSS opacity, painted when the map's shape
  changes), the town (`paintTown`, repainted when `townKey` changes — a
  few times a round), and entities (the only canvas the frame loop
  touches). The town layer sits UNDER the shades, so `drawHuntedGlyphs`
  re-stamps the glyph of anything being eaten to keep it readable.
- Headless Chromium here rasterizes canvas2d on the CPU, so `--throttle N`
  slows FILL as well as JS. A real phone gives that fill to its GPU. Treat
  throttled night scenes as a pessimistic floor, not a prediction.
- Screen-space washes (the dread vignette) belong to the compositor, not
  the canvas: on the cached terrain they force a full rebuild on every
  Heart wound, and on their own canvas layer they cost a full-canvas blit
  per frame. A positioned element with an animated `opacity` costs neither.
  The same is true of the STATIC SCENE: the terrain is two stacked
  `<canvas class="town-map terrain">` elements cross-faded by the dark
  one's CSS opacity, painted only when the map's shape changes. The frame
  loop must never blit the whole map again — if you find yourself adding a
  full-canvas `drawImage`, it belongs on a stacked layer instead.
- Sprites are not a free win. Replacing large radial gradients with
  pre-rendered `drawImage` blits measured WORSE at every sprite size
  tried: in this rasterizer a large alpha-blended blit costs more than
  the gradient it replaces. Sprites paid off only where the target is
  small and repeated (shade cores, ~15px, seventeen a frame). Measure
  before assuming.
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
  immediately after the first fall. This is load-bearing and was broken for
  a whole cycle: a median first fall banks 3-4 Embers against a 5-Ember
  root, so the FIRST FIRE tops a first vigil up to the cheapest root's
  price (see round.js). The harness asserts it on the villager's WORST
  seed, not the mean.
- A palisade is a taunt: it is meant to draw the night onto itself, so
  "everything hit my wall and I died" is the intended failure of relying
  on ONE. That stays fair only while a single wall beats no wall and
  several beat one — both asserted (`lonePalisade` / `noPalisade`).
