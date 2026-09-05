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
