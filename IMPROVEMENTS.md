# Second improvement plan: implementation record

The user accepted the prototype and authorized completion of the full plan.
Human fun testing did not block the implementation below. Physical-device
and listening results are reported only when actually measured.

| Area | Delivered in this pass | Evidence |
| --- | --- | --- |
| Opening and controls | Hearth and flare naming, finite goal, existing farm, wall-first guide, keyboard fix, range previews and explicit touch confirmation | DOM tests and real Chromium opening |
| Tactical depth | Persistent road guarding, farm-raiding detours, wall-only blocking, authored geometry, delayed projectile damage and heavy-strike interrupts | 30 matched tactical comparisons, replay equality, engine tests |
| Campaign and progression | Distinct six-night arcs, Antlered King finales, sidegrade kits, restored village square, ruins, mastery awards and settlement outcomes | 120 profile cases, 60 separate build cases and native render checks |
| Interface and world | Forecast beside desktop construction, on-map enemy symbols, raid/strike priorities, repair shortcuts, farm payback, distinct king silhouette and lantern connections | Viewport/control/offline smoke; static and live inspection |
| Music and sound | Original lute/flute/cello/bell harmonics, paired phrases over roughly two minutes, day/night/danger arrangements, spatial raid/windup/arrival cues, voice caps and warning ducking | Audio graph, mute, lifecycle and directional cue tests; subjective mix requires listening |
| Authoring and debugging | Encounter workshop with road/plot/group editing, local drafts, import/export, sandbox play and visual replay with cached seeking | Replay/validation tests and browser round-trip with campaign preservation |
| Maintainability | Planning, battle, results, settings and persistence split out of the main component; overwritten CSS removed; old simulation rules frozen | Lint, migration tests and full quality gate |
| Performance | Retained cached/interpolated renderer; cold-load, placement and audio-start probes; 30-second sustained battle; frame/input/readiness budgets in CI and deployment | Browser measurements and scene-population checks; results documented after the final run |

The tactical benchmark includes an exposed mill that survives an early River
commitment but falls when the Warden always follows the leading enemy.
Scattershot preserves a wall against a crowd; Sunlance preserves it against
a protected king. Both branches can win, with different structure losses.
These are concrete counterexamples, not a human enjoyment score.

The first browser failure exposed exact-coordinate save checks across Node
and Chromium. A sub-nanounit geometry tolerance now accepts portable saves
while rejecting displaced plots. The second was a smoke test trying to click
the removed desktop Approach tab; it now verifies the combined forecast.

The original implementation record below is historical and describes the
preceding rules and evidence.

---

## Original improvement plan: implementation record

The old inevitable-fall game has been replaced with a finite village-defense
campaign. This document maps the original review's work packages to the
implementation and its evidence. It separates implemented features from
judgments that require independent players or physical devices.

| Work package                | Delivered behavior                                                                                                                                                                                                       | Evidence                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Rules and economy           | One dawn budget, exact forecasts, physical building breaches, visible attackers cause Heart damage, earned retirement rewards, no final-night farm trap                                                                  | Pure engine, economy/defense tests, live tutorial win                                                                    |
| Winnable core loop          | Three-night introduction, six-night towns, untimed planning, undo, rallying Warden, finite road burst, explicit victory                                                                                                  | 120 town/profile cases and fresh-save campaign progression; Chromium full-loop smoke                                     |
| First-minute teaching       | Marked farm and wall plots, optional pause when enemies reach the wall, Warden lesson, second-night tower and burst, skippable guide                                                                                     | Guided opening reaches dawn without a tower; actual UI clicks in CI                                                      |
| Understandable outcomes     | Per-night income, kills, losses and standing buildings; actual breach chain and advice identifying the failed road and unused bursts                                                                                     | Structured incidents and dawn reports; defeat regression test                                                            |
| Depth                       | Four buildings with two exclusive branches, four enemy roles, blessings, three distinct build examples                                                                                                                   | 60 matched-seed builds across four towns; purchase orders and Warden contribution checked                                |
| Progression                 | Earned Embers, free loadout changes, first-kit purchase guidance and visible next-run benefit; four layouts; explicit completion; endless and no-burst challenges                                                        | Reward/unlock/challenge/replay tests and visible browser kit purchase                                                    |
| Presentation                | Illustrated buildings and scenery; damage cracks, repair/upgrade effects, travelling bolts, attack windups, mist radius, Warden flag/target/range/clock, restored-beacon celebration                                     | Native render inspection, CI browser screenshots, deployed browser inspection                                            |
| Usability and accessibility | Viewport-sized game, fixed Start Night dock, selectable planning panels, keyboard plots/cards, pause and half speed, focus-managed Settings, high contrast, live system motion preference, independent effects intensity | Desktop/phone viewport matrix, plot/control hit tests, keyboard/focus tests                                              |
| Music and sound             | Original adaptive motif with phrase variation; day/night/danger arrangements; wind/fire/village ambience; material cues; distinct approach/breach/Heart sounds; three buses; warning ducking and voice/alert limits      | Audio lifecycle/mix regression tests; final subjective mix still needs device listening                                  |
| Persistence and offline     | Legacy currency/kit migration, validated saves, recoverable previous save, paused reload, cross-tab takeover, atomic offline shell caching                                                                               | Migration/replay/offline tests; actual Chromium offline reload                                                           |
| Performance                 | Cached layered canvas, interpolated entities, bounded effects, cached enemy sprites and static low-effects frames; actual-map fixtures through fully upgraded endless town                                               | Ten scene/transition probes, three repeats, frame p50/p95/p99, estimated missed frames, scene identity/population checks |
| Reproduction                | Scenario seed, timestamped commands, optional local accepted/rejected input log, retained completed test run, explicit export and replay CLI                                                                             | No data transmission; regression tests and `scripts/replay.mjs`                                                          |

## Three different defenses

These examples are deliberately simple, reproducible policies. They show that
alternative builds are possible; they do not establish what people prefer.
All use the free Hearthkeeper kit and the same five seeds in each town.

- **Stone choke:** outer walls and towers, then Stone walls and Sunlances.
  No farms. It spends the guaranteed dawn budget on holding known positions.
- **Harvest battery:** early farms and Bountiful harvest fund Scattershot
  towers in inner positions, followed by protective walls. It accepts a more
  exposed opening in exchange for larger later budgets.
- **Lantern and Warden:** light the fighting ground, specialize lanterns for
  Warden damage, and use Thorn walls to interrupt attackers. One inner tower
  supports the Warden; Cinder Ridge needs a second because it has four roads.

Run `npm run test:strategies` for all 60 outcomes, building counts, losses and
Warden contribution. The engine derives waves from town, seed and night, so
these choices cannot silently change future enemy rolls.

## Browser and performance coverage

The smoke gate checks first-day planning, final-day planning, a crowded ridge
night and victory at 360×800, 390×844, 768×900, 1280×650, 1280×720,
1366×768, 1440×900 and 1920×1080. It rejects page overflow, clipped or
occluded plots, unreachable night controls, and a Start Night dock outside
the viewport. Short phone landscapes preserve readable targets using a
scrolling layout and sticky planning dock.

The performance fixtures include first-day and final-day planning, two moving
battles, all 16 upgraded buildings with mist and simultaneous impacts, dusk,
Settings opening, resize, genuine tab background/return, and essential-effects
combat. Fixtures are reached with production commands; impossible or drifted
scenes fail. CI retains browser screenshots, strategy results and all repeated
performance samples as artifacts.

Frame measurements are requestAnimationFrame intervals. Missed frames are
estimated against a 60Hz budget, not measured physical screen presentations.
Paint time is JavaScript command recording. CPU-throttled Linux Chromium
cannot stand in for a phone, Safari, thermal behavior, touch ergonomics or
120Hz hardware.

## Local playtest records

In Settings, enable **Record a local playtest** before a session if the player
agrees. Nothing is sent. **Export playtest record** includes the build,
viewport, browser, current or retained completed round, seed, command log and
recorded input attempts. Copy that text into a JSON file, then run:

```sh
node scripts/replay.mjs playtest-record.json
```

Use the recorded revision when investigating behavior that changed between
builds. Recordings are bounded; an incomplete command log is explicitly
rejected by replay. Qualitative observations and whether someone voluntarily
continues belong in the separate session notes, not an inferred “fun score.”

## Remaining external validation

The engineering work in the plan is implemented. Its human acceptance gates
remain unmeasured: comprehension without coaching, meaningful choices,
voluntary replay, and whether the game is enjoyable. Follow PLAYTEST.md with
fresh players to measure comprehension and preference. The user has already
authorized the current content, visual and audio expansion. Device listening, real-phone performance and Safari/120Hz
checks also require the relevant hardware. None is claimed as a passing
result from bots or the cloud browser.
