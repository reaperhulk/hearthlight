# First-play gate

This redesign is a candidate for testing. Passing the automated suite does
not mean it is fun. Run this before expanding content or commissioning a
larger art/audio production pass.

## Session

Recruit 6–8 people who have not played the redesign. Include mouse and
phone players; ask at least two people to use the keyboard and one to try
half speed. Record device, browser, viewport, build stamp, and seed. Allow
15 minutes. Do not explain the rules first.

1. Ask them to begin and think aloud. Observe what they try to protect,
   how they spend Glow, whether they identify the next threatened road,
   and whether plot numbers, ranges, and building roles make sense.
2. After their first night, ask: “What is your goal?” “Why did that
   building take damage?” “What would you change before the next night?”
3. Let them finish or lose the three-night introduction. Ask what their
   reward means and whether they want to continue. Do not suggest replay.
4. If they continue, observe one normal village and their first branch or
   blessing choice. Ask what alternative they considered and why.
5. Briefly test mute, background/resume, pause, reload, and a second tab.

## Candidate acceptance criteria

These are targets for the next test, not results already achieved.

- At least 80% explain “protect the Heart until the beacon is restored”
  and correctly explain a breach without help.
- At least 80% place a useful first defense and deploy the Warden without
  facilitator intervention. Record time and every mistaken click.
- At least 70% complete the introduction in 3–5 minutes including planning.
  If much faster and bored, change its decisions before adding duration.
- At least 60% voluntarily begin another vigil. Ask the rest why they stop.
- In a normal village, players describe at least two choices with an
  understandable tradeoff. Record whether upgrades are actually different
  strategies or merely different labels on the same dominant build.
- No unexplained Heart damage, unreadable critical text, blocked touch
  target, lost save, stuck wave, or keyboard focus trap.

Small samples are directional. Keep individual observations alongside
percentages. Do not tune only to aggregate win rate.

## Performance and audio checks

On a real lower-end phone and a desktop, run a complete six-night town.
Record frame pacing during crowded combat and transitions, responsiveness,
heat after ten minutes, orientation changes, and audio suspend/resume.
Listen for clipping, repeated harsh effects, and music fatigue. Verify mute
and reduced motion. Aim for responsive 60Hz play; use measured frame
percentiles and visible stalls rather than an FPS maximum as the verdict.

Use `npm run perf:probe` on the same machine/build configuration for
comparisons. Retain its scene populations and all repeated samples. Native
canvas renders help inspect artwork; they do not validate browser layout.

## What to do with failures

Comprehension problems come first: fix the goal, instructions, targeting,
and causal feedback. If players understand but feel passive, revise enemy
pressure and competing road priorities. If choices converge, change the
specializations and economy. More towns and prettier effects come after
these checks, not as a substitute for them.

## September 5 verification

The deployed redesign was played through the visible cloud-browser controls
on desktop, seed 1840459331. The First Fire reached 3/3 nights with 100 Heart,
18 banishes, no lost buildings, and the displayed 17-Ember reward. The run
used the guide, built all three road defenses, specialized a tower, moved
the Warden, used bursts, exported a save, and reloaded mid-night paused.
This is an agent acceptance check, not a fresh-player fun assessment.

That playthrough exposed final-night economy choices with no remaining
payoff. The engine and UI now stop new farm spending on the final night and
offer immediate combat blessings; existing final-dawn saves refresh their
unclaimed offer list. Endless mode retains economic choices.

The Chromium smoke also checks narrow and wide viewports, rewards, kit
selection, the next town, save/reload, and settings. Frame-pacing samples
are uploaded by CI as `browser-performance`, with the exact revision and
all repeats. On revision 48e910c, the four scenes held median 59.75–60.00 FPS
with 4× CPU throttling, and frame p95 at or below 16.8ms. This reaches that
browser's 60Hz cap; it is not a measured speedup over the old game or a
claim about a real phone. Device listening, touch ergonomics, heat/battery,
and independent human playtests remain outstanding.

## Completed implementation verification

Revision `954bfd3` passed the expanded CI and deployed browser checks:
43 unit/DOM/offline/audio tests, 120 original scripted town/profile cases,
60 distinct build cases, fresh-save progression, endless guards, 32
scene/viewport combinations, all plot hit targets, and an actual offline
reload. The three distinct builds complete every town with the free kit.
This establishes reachability, not which strategy humans find enjoyable.

The deployed cloud browser also verified the alternative inner-tower/
lantern opening, Warden assignment, pause and half speed, high contrast,
essential visual effects, local recording and export. Its exported Briar
Hollow record (seed 1493368650, 15 commands) replayed to the same gameplay
state. A separate 14-night heavy-scene record replayed 965 commands.

The live alternate opening then reached dawn with all four buildings,
8 banishes, 39 Glow and 94 Heart. One Shade reached the Heart from Orchard
road. That check led to displaying the recorded breach in Dawn & story,
including nonfatal Heart damage in the compact summary, and describing an
early dawn as partial progress rather than an already restored beacon.

The final expanded probe used Linux Chrome 152.0.7977.64, 4× CPU throttling,
three four-second repetitions per scene. Results from CI run 33946814592:

| Scene or transition                         | Median FPS across runs | Highest frame p95 | Estimated missed 60Hz frames, by run |
| ------------------------------------------- | ---------------------: | ----------------: | ------------------------------------ |
| First-day planning                          |                  60.00 |           16.8 ms | 0 / 0 / 0                            |
| Final-day ridge                             |                  60.00 |           16.8 ms | 0 / 0 / 0                            |
| Moving marsh battle                         |                  60.00 |           16.7 ms | 0 / 0 / 0                            |
| Moving ridge battle                         |                  60.00 |           16.8 ms | 0 / 0 / 0                            |
| All 16 upgraded buildings, mist and impacts |                  60.00 |           16.8 ms | 1 / 0 / 0                            |
| Dusk                                        |                  59.06 |           16.8 ms | 7 / 4 / 3                            |
| Opening Settings                            |                  59.06 |           16.8 ms | 4 / 4 / 3                            |
| Resize                                      |                  58.52 |           16.8 ms | 7 / 6 / 6                            |
| Background return                           |                  59.76 |           16.8 ms | 1 / 1 / 1                            |
| Essential-effects combat                    |                  59.75 |           16.8 ms | 1 / 1 / 1                            |

Resize and one Settings sample reached about 33.3 ms at p99. Transitions
still have occasional missed frames; no claim of perfectly smooth or
real-phone performance follows from these short samples. Artifacts retain
all repetitions, scene populations, browser identity and paint diagnostics.
The fully upgraded battle stayed active with 16 upgraded buildings and mist.
The background test verified that another tab pauses combat before return.

The physical-device and fresh-player gates above remain unmeasured. The
implementation checklist is complete in IMPROVEMENTS.md; larger commissioned
art/audio production was subsequently authorized by the user, who accepted
the prototype fun gate and requested the complete second improvement plan.


## Second-plan live verification (September 6)

On deployed `f9ce1da` in the cloud desktop browser, the preserved earlier-rule
save completed its final two nights at 100 Hearth, collected its reward,
and entered a new rules-4 Briar Hollow campaign. The Warden retained the
River assignment. Leaving Orchard undefended produced an actual breach;
flares cleared the attackers and the next dawn reported 66 damage, 34 Hearth,
39 income and four standing buildings. The story named Orchard as the road.
The live replay viewer reproduced the recorded result and seeking to its end
showed the same 34 Hearth, 43 Glow, eight kills and four buildings. Returning
and reloading preserved that campaign. These observations are tool-driven
play, not fresh-player enjoyment or an estimate of player difficulty.

CI run `34016592559` on `2f91f95` passed 56 unit/DOM/offline checks, 120 profile
cases, 60 build cases, 30 tactical cases, browser interactions, all eight
viewport sizes, offline reload, workshop isolation and performance budgets.
Chrome 152 on Linux, 4× CPU throttle: all reported frame p95 values were at
or below 16.8 ms; the 30-second upgraded-town battle stayed active with bounded
collections. The worst transition frame was 133.4 ms at dusk; cold local
readiness was at most 314.6 ms. These are the pre-optimization measurements.
A subsequent patch makes startup noise generation cheaper and ensures the
audio-start probe actually creates an AudioContext; use its CI artifact for
any claim about the resulting performance. Physical phone ergonomics,
listening quality, thermal behavior, Safari and 120 Hz remain unmeasured.
