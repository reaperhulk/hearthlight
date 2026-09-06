# Hearthlight

A small village-defense game. Build by day, defend by night, and restore a
beacon before the dark takes the Hearth.

[Play Hearthlight](https://langui.sh/hearthlight/)

## The new loop

- **Plan without a clock.** Spend a dawn budget on farms, walls, watchtowers,
  and lanterns. Inspect ranges and health, repair, move, salvage, or undo
  the last change. The forecast shows the actual approaching wave.
- **Hold physical roads.** Walls block the road; ordinary attackers pass towers
  and lanterns. Skitters leave the road to raid farms. Only visible attackers
  at the Hearth can hurt it. Assign the Warden to guard a road persistently,
  or select a plot to hold a position. Hearth flares interrupt heavy strikes,
  damage attackers, and push them back. Charges return each night.
- **Make a build.** Each building has two exclusive specializations.
  Every second dawn offers a choice of blessings. Different enemy roles
  favor different defenses; a veil bearer protects nearby enemies until
  interrupted, while Sunlance shots pierce its protection.
- **Win something.** The First Fire teaches the game over three nights.
  Save Briar Hollow, the Sunken Crossing, and Cinder Ridge over six nights
  each. Each town has its own geography and authored encounter arc, ending
  with the Antlered King and a second assault. Earn mastery for preserving
  every roof, keeping the Hearth unbroken, or winning without flares. Saving
  all four towns completes the campaign; endless watches are optional.
- **Carry earned Embers home.** Completed nights and victories pay for
  alternative starting kits. Standard campaigns are winnable with the free
  Hearthkeeper kit, which keeps three flares. Mason, Ranger and Gardener
  trade a flare and budget or tower cost for their specialties. Starting and
  immediately retiring earns nothing.

The battlefield uses layered Canvas2D illustrations with distinct enemy
silhouettes, building upgrades, attack cues, and a growing beacon. An
original procedural score changes between day, night, and danger, with
separate music, effects, and ambience controls.

Keyboard: **1–4** select a building, **Tab / Enter** choose a plot,
**D** starts night. During combat, **1–4** guard roads and **Shift+1–4** flare
those roads. **Space** pauses outside focused controls; focused buttons retain
their normal keyboard behavior. **Escape** clears selection or
closes Settings. Night also supports half speed. Settings include reduced
motion, higher contrast, independent visual-effects intensity, save transfer, and optional local playtest recording.

## Saves and offline play

Version 1 saves retain Embers and a legacy record. Previous foundation,
Warden, and choir upgrades unlock their corresponding starting kits. The
old active vigil is archived rather than converted into incompatible new
combat rules. Earlier version-2 runs retain their original simulation; new
runs use rules 4. All active saves resume paused. The previous automatic save is
kept for recovery, and simultaneous tabs use a takeover prompt.

The production PWA precaches each build's complete shell before replacing
its previous worker. Open the game online once to prepare offline play.

## Development

Use Node **24.15 or newer** in the Node 24 line, or a newer compatible
release.

```sh
npm ci
npm run dev
```

```sh
npm run test:quality    # lint, engine/DOM/offline tests, balance/build guards, build
npm run test:smoke      # Chromium: UI, full loop, offline reload, viewport/target checks
npm run test:tactics    # 30 matched counterexamples; exact replay checks
npm run test:strategies # three distinct builds on 60 matched town/seed cases
npm run balance:story   # one scenario, night by night; accepts -- --seed N
npm run balance:compare # exact comparison with the committed seed baseline
npm run balance:baseline
npm run render:scenes   # direct Canvas2D renders; not browser layout screenshots
npm run perf:probe -- --assert --output performance.json # frame, input, transition and sustained budgets
node scripts/screenshot.mjs /tmp/hearthlight-screenshots
node scripts/replay.mjs playtest-record.json
```

Browser scripts need an installed Chromium executable (`CHROME_PATH`).
They use an isolated local preview on port 4174; override with
`HEARTHLIGHT_TEST_PORT`. The browser hook exposes commands, state reads,
and time advancement, rather than unrestricted fabricated state writes.

The engine is pure: `command(state, action)` and `advance(state, dt)` return
new states. Combat advances in fixed 50ms steps, the UI updates at 10Hz,
and canvas entities interpolate between snapshots. Waves derive only from
town, night, and seed. Timestamped commands support `replayRound(round)`;
recordings exceeding 4,000 commands are explicitly marked incomplete.

## Encounter workshop and replays

Settings → **Design and replay tools** opens a local sandbox. Choose an
example, edit the budget, kit, entrance, road bends, plot locations and spawn
groups, then apply and play. Save a separate workshop draft or export its
JSON. Sandbox victories do not award Embers or mastery.

The visual replay viewer accepts the Settings playtest export, the current
campaign, or a sandbox attempt. It verifies the outcome and offers playback,
time scrubbing and command jumps. Two-second checkpoints keep seeking short;
imports are limited to one hour and 4,000 commands. Nothing is uploaded.

## What the checks establish

The balance gate covers 120 fixed-seed town/profile combinations, then
checks fresh-save progression and eventual defeat in endless mode. The
profiles are explicit scripts: fortress, scattershot, Warden support,
four-second reactions, building without night input, and doing nothing.
They are not models of human skill or evidence of enjoyment. Reported
seconds include combat only; preparation time is chosen by the player.

Performance probes report frame interval p50/p95/p99, estimated missed 60Hz frames, command recording cost, every repeated run, and before/after scene populations. They cover fully upgraded towns, mist, impacts, dusk, Settings, resize, background return, essential effects, cold loading, placement,
audio startup and a 30-second full-town battle. Both CI and publishing enforce
median budgets across repeats: frame p95 25 ms, paint p95 10 ms, worst frame
250 ms, click-to-second-frame 180 ms, local cold readiness 2.5 seconds. These
are regression limits, not a claim that a 250 ms stall is desirable. Their
fixtures use the actual production map and engine. A throttled desktop
browser is not a phone benchmark. Do not compare the old renderer's FPS
numbers with this redesign without matching device measurements.

See [IMPROVEMENTS.md](IMPROVEMENTS.md) for the implementation record, [PLAYTEST.md](PLAYTEST.md) for the comprehension and replay gate, and
[ROADMAP.md](ROADMAP.md) for implemented work and remaining validation.

## Lore

The shades are the Forgetting. Every town they take becomes ruins — and the
ruins remember every wall you raised. Hearthlight is a companion to
[The Ruins Remember](https://github.com/reaperhulk/theruinsremember).
