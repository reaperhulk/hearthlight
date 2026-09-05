# Hearthlight — agent instructions

Hearthlight is a winnable village-defense game. The September 2026 redesign
replaces the previous inevitable-fall incremental loop. Historical balance
claims in ROADMAP.md describe that retired version, not current acceptance
criteria.

## Project structure

- `src/engine/content.js`: towns, maps, buildings, enemies, kits, blessings,
  and seed-derived waves. No browser dependencies or ambient randomness.
- `src/engine/campaign.js`: pure commands, fixed-step combat, rewards,
  save migration, and replay.
- `src/ui/Village.jsx`: accessible React controls, state loop, persistence.
- `src/ui/VillageMap.jsx`, `village-draw.js`: layered Canvas2D battlefield.
- `src/ui/score.js`: original procedural music, effects, ambience buses.
- `scripts/campaign-balance.js`: explicit scripted policies and balance gate.
- `scripts/scenes.mjs`: reachable production-map fixtures.
- `scripts/build-strategies.js`: three distinct, matched-seed purchase policies.
- `IMPROVEMENTS.md`: original-plan completion record and limits of the evidence.

## Repository policy

Commit directly to `main` and push after every coherent, gate-passing
change. No long-lived branches. Follow environment approval requirements
and explicit user instructions for remote mutations. Update ROADMAP.md as
work lands.

## Commands and gates

Use Node 24.15+ (CI uses Node 24).

- `npm run test:quality`: lint, unit/DOM/offline tests, balance assertions,
  distinct build cases, production build. Run before committing.
- `npm run test:smoke`: Chromium interaction and full-loop regression.
  Includes offline reload and viewport/plot hit checks, including short desktops.
  Uses CHROME_PATH and isolated local preview port 4174.
- `npm run test:strategies`: 60 distinct build examples on matched seeds.
- `node scripts/replay.mjs file.json`: verify an exported local playtest record.
- `npm run balance:compare`: exact deterministic baseline comparison.
- `npm run balance:baseline`: deliberately regenerate the baseline in the
  same commit as a balance change, after reviewing its metrics.
- `npm run balance:story -- --seed N`: narrate one scenario's outcomes.
- `npm run render:scenes`: native Canvas2D battlefield renders.
- `node scripts/screenshot.mjs [outDir]`: real browser UI screenshots.
- `npm run perf:probe -- --throttle 4 --seconds 4 --repeat 3`: repeated
  frame intervals, CPU command recording time, and actual scene populations.
  `--uncapped` opts out of the display frame-rate ceiling.

Browser checks are required before release. If the environment prevents
running them, say exactly which checks remain unverified. Never replace a
browser check with fabricated FPS or claim native canvas output verifies
layout, interactions, audio, or real-device performance.

The build stamp uses GITHUB_SHA in Actions and the local commit plus
`-dirty` otherwise. Keep it visible. Production updates precache the
complete build before replacing the previous service worker. The Pages
workflow runs quality and browser smoke before publishing.

## Design constraints

- Give the player a legible goal and a real victory. Endless is optional.
- Planning is untimed; income arrives at dawn. Never reward waiting for a
  trickle or starting/retiring without completing a night.
- Heart damage needs a visible attacker at the Heart. Losing a distant
  building must never damage it remotely.
- Forecasts use the actual wave. Randomness depends on seed, town, and
  night, never player input cadence or cosmetic effects.
- Night controls show every road even when the Warden is already there.
- Starting kits offer alternatives; the free kit must complete all normal
  towns. Two exclusive building branches create choices within a vigil.
- Preserve legacy currency, record old progress, and resume saves paused.
  Bad nested data must not reach combat or the renderer.
- Every critical audio cue also has a visible cue. Respect volume,
  reduced-motion, contrast, focus, keyboard, pause, and touch controls.
- Bots establish reachability and regressions. They cannot establish fun,
  a “median human,” or meaningful depth. Use PLAYTEST.md for those claims.

## Rendering and testing lessons worth retaining

- Keep terrain, buildings, and moving entities on separate layers. Do not
  repaint static scenery or use full-screen canvas washes each frame.
- Interpolate entity positions between engine snapshots. A 60fps renderer
  drawing 10Hz positions still looks choppy.
- Cache small repeated sprites. Measure large alpha blits and gradients;
  neither is automatically cheaper.
- Measure whole frame intervals as well as JS drawing time: Canvas2D
  rasterization may happen after JS returns.
- Verify the heavy scene remains an active battle with enemies and a
  mounted canvas. Fail on scene drift instead of reporting a cheap result.
- Report all repetitions and a median, with device/browser/throttle/scene
  details. A best sample alone can hide stalls and contention.
- Test meaningful invariants and failure cases. Avoid tests that merely
  duplicate a constant or manufacture a victory state as proof of balance.
- Raw JSX Unicode escapes print literally. Use actual characters or JS
  strings; the smoke test checks for leaked escapes.
