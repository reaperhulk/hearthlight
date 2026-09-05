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
