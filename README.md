# Hearthlight

A round-based city-defense incremental, born from
[The Ruins Remember](https://github.com/reaperhulk/theruinsremember).
Something in the dark keeps eating the towns. Light the Heart. Last longer.

**Play it:** https://reaperhulk.github.io/hearthlight/ — installs to a
homescreen as a PWA; a first round lasts one to two minutes.

## The loop

1. **Day** (15s, or call the dusk early): Glow trickles in; you are offered
   a draft of structures and get **one pair of hands** — place a structure,
   or mend one bitten hit point out of a wall. That is the whole building
   system — no roads, no zoning, one decision with real adjacency depth
   (wells water farms and granaries, palisades bodyguard their neighbors,
   towers cover theirs). Once a day, 4 Glow buys a fresh draft.
2. **Night**: shades creep from the rim toward what you built — the day
   header told you exactly how many were coming. One verb: send the Warden.
   He grapples one shade at a time; once rested he can be redirected
   anywhere — even torn off a hold, though the dropped shade bites fast.
   Banishes temper him within the run (seasoned → grim → lightless), each
   tier quickening his grip. Towers loose bolts, lanterns slow, bells
   delay, walls take the teeth. From night 7, heartseekers ignore the town
   and go for the Heart itself — the Warden can stand at the Heart to meet
   them.
3. **Omens**: every fourth night is named at the dawn before — a Hungry
   Night brings more teeth; a Still Night brings none, and banks them; a
   Veiled Night (night 8+) blinds every tower with mist, but the mist
   muffles the dark too. A veteran tower's lamp pierces it for one bolt.
4. **The fall**: the dark always wins eventually. When the Heart goes out,
   the chronicle itemizes every Ember the vigil earned, and the home
   screen's bar row remembers the last thirty falls.
5. **The fire**: spend Embers on permanent upgrades — sturdier days, go
   longer, reach the frontier — and begin again, longer. Three pinnacles
   unlock only by *proving* vigils (8, 10, and 12 nights), not by hoarding.
   With everything kept, one goal remains: the Long Dawn, a fifteen-night
   vigil that closes the story.

Plays with one thumb; on desktop, 1–4 pick cards, 1–3 answer threats, D
calls the dusk, R rerolls. A save travels between devices as one
copy-pasteable ember-script.

## Running

```sh
npm install
npm run dev        # http://localhost:5173
```

## Testing — the interesting part

The engine is pure and deterministic: `tick(state, dt, rng)` → new state,
every random draw threaded through an injected rng. That makes the game's
promises *testable*, and they are:

```sh
npm run test:unit       # engine unit tests
npm run test:balance    # bot profiles + loop-promise assertions (5 fixed seeds)
npm run test:quality    # lint + unit + balance + build
npm run test:smoke      # a real Chromium plays one full loop
npm run balance:story   # narrate one round night by night
npm run balance:compare # diff current numbers against the committed baseline
```

The balance harness plays deterministic bot profiles — a do-nothing
**passive**, a **builder** who sleeps at night, the optimal **keeper**, a
median-human **villager**, and ablations (**randomPlace**, greedy builds, a
two-structure **bunker**) — across five fixed seeds plus one fresh random
seed per local run. It asserts, among ~30 promises:

- a do-nothing round still ends and pays; playing beats not playing;
- the villager's first round lands in the 1–2 minute band;
- placement is a real choice (keeper beats random placement by ≥1 night);
- turtling never beats building, and **no strategy is immortal** — a bot
  once found a two-structure bunker that literally never died; the fix and
  a permanent guard profile shipped the same day. A `juggler` that breaks
  grapples on every cooldown must always lose to committed holds, and even
  a fully-upgraded town must still fall (while its 15-night Long Dawn
  capstone stays provably reachable);
- every meta upgrade earns its slot on a measured axis (round-1 nights,
  round-1 embers, or 5-round-arc nights) — no traps, no shelf-warmers;
- identical seeds produce identical rounds, always.

`scripts/balance-baseline.json` is a committed metrics snapshot;
`balance:compare` fails when anything drifts past tolerance, so every
deliberate balance change documents itself in the diff. CI runs the whole
gate plus the browser smoke on every push.

## Design doctrine (inherited from The Ruins Remember)

- Decisions, not busywork. One placement per day; one verb per night.
- The wall always wins; how long you delay it is the scoreboard.
- Randomness is bounded and visible: the draft always offers a defense,
  omens are announced a dawn ahead, the forecast never lies.
- Meta pre-pays costs; it never skips decisions.
- Every change is measured by bots under seeds before it ships, and every
  promise the loop makes is an assertion that can never silently regress.

## Lore

The shades are the Forgetting. Every town they take becomes ruins — and the
ruins remember every wall you raised. Hearthlight is the fall of the towns
that [The Ruins Remember](https://github.com/reaperhulk/theruinsremember)
excavates.
