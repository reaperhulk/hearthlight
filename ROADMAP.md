# Hearthlight roadmap

## Town-defense redesign (September 2026)

The approved redesign replaces inevitable defeat with winnable scenarios.
The historical queue below describes the previous game and is not the new
acceptance criteria. The engine and interface now use the new loop.

- [x] Pure scenario engine: three roads, physical breaches, Warden rally,
      lantern burst, untimed preparation, specializations and explicit victory.
- [x] Four towns, starting kits, blessings, earned rewards and legacy save migration.
- [x] Engine checks for damage causality, tick-size independence, save validation,
      exact income, undo, rewards and several strategy profiles.
- [x] New guided interface, illustrated battlefield and responsive controls.
- [x] Adaptive score, ambience and exact event-driven sound/visual feedback.
- [x] Production-map browser/performance fixtures, DOM interaction tests, focus
      handling, save recovery and offline lifecycle tests.
- [x] Chromium smoke and repeated frame probes run in CI; desktop cloud-browser
      playthrough reaches victory, collects 17 Embers, and resumes a saved night.
      Responsive smoke covers widths 360, 390, 768 and 1440.
- [x] Remove final-night economy traps discovered during browser playtesting;
      replace useless dawn-only blessings and explain the final assault.
- [x] Incremental farm/wall/Warden/tower lessons with marked plots, optional
      teaching pauses, earned-kit guidance, actual breach chains and dawn reports.
- [x] Explicit all-town completion and an earned, replayable no-burst challenge.
- [x] Viewport-sized battlefield and fixed planning dock; separate build,
      approach and chronicle panels. CI gates vertical fit and reachable controls
      at 360×800 through 1920×1080, including 1280×650 laptops, and saves screenshots.
- [x] Warden destination flag, current target, attack clock and range;
      travelling bolts, impacts, damage cracks, mist radius and victory effects.
- [x] Independent low/essential effects presets, live system motion preference,
      high-contrast paths/silhouettes and persistent visual equivalents to sound.
- [x] Phrase/orchestration variations, wind/fire/village ambience, material cues,
      distinct approach/breach/Heart sounds, threat-based danger music, alert
      coalescing, bounded voices and critical-warning music ducking.
- [x] Sixty matched-seed build cases: no-farm stone choke, harvest-funded
      inner tower battery, and lantern/Warden with one supporting tower (two on
      Cinder Ridge). Free-kit completion and genuinely distinct purchase orders
      are asserted; the old heuristic variants remain separate diagnostics.
- [x] Reachable fully upgraded 16-building town, simultaneous impacts and mist;
      repeat dusk, settings opening, resize, background return and low-effects
      frame probes with p50/p95/p99 and estimated missed 60Hz frames.
- [x] Optional local input recording, retained completed-run reproducer, portable
      playtest export and a command-line replay check. No data is transmitted.
- [x] Mobile road labels avoid plots; all plot centers are checked for occlusion,
      in addition to viewport bounds and control size.
- [x] Reconcile all work packages in IMPROVEMENTS.md; continue toward the next
      unsaved town from the main play button and show the assigned Warden road.
- [ ] Listen and play on real devices; verify mobile layout and frame pacing.
- [ ] Fresh human playtest: comprehension, meaningful choices and voluntary replay.

## Historical queue — previous game

The iteration queue. Each item is one coherent, measured, gate-passing
commit pushed to main. Update checkboxes as work lands.

## Now

- [x] **Persistence** — localStorage save/load with a versioned migrate.
      Without it a refresh erases the meta layer; most fundamental gap.
- [x] **Multi-seed harness** — five fixed seeds plus one fresh random seed
      every run. Hard invariants assert on every seed; pacing bands on the
      fixed mean; the random lane guards that real-play variance stays within
      ±4 nights of the fixed mean, and prints its seed for reproduction.
- [x] **Round-1 pacing** — tuned to mean 9.6 nights / ~4 min (was 13/5.3);
      losses now cost 14 heart, escalation 1.18, warden holds 3.5s. Active
      gap widened: keeper 9.6n vs builder 7.0n. Meta arc 9.6 -> 17.0 nights.
      Bands asserted: keeper mean 6-11n, <=300s, active gap >=1n.
- [x] **Widen the build space** — +3 structures (Granary: dawn economy;
      Bell Tower: slows the whole night's approach; Ember Kiln: converts
      held Glow to Embers at the fall) and +2 meta upgrades (Heartstone:
      +25 Heart; Ember Choir: +1 Ember per 2 nights at the fall). Re-measure.
- [x] **Harness visibility** — engine telemetry (per-night stats, heart-loss
      attribution, glow breakdown); villager profile (median human) asserts
      the 45-150s first-play band directly; ablation profiles (randomPlace /
      economyGreedy / defenseGreedy / bunker) assert placement is a real
      choice; per-upgrade marginal value panel catches meta traps; pick-rate
      collector catches dead cards; tension + banish-rate fun metrics.
- [x] **Single-hold warden rule** — the depth panels caught an immortal
      bunker: one warden could hold unlimited shades at a guarded slot, so a
      two-structure turtle never fell. A warden now grapples ONE shade at a
      time (the rest feed); watchtowers compensate with two intercepts per
      night, which also makes tower placement (coverage) the key skill lever.
      Guards: a unit test plus a permanent `bunker` harness profile that must
      always fall and never beat building.
- [x] **Snapshot / compare / story** — `--json` emits a deterministic
      metrics snapshot; `scripts/balance-baseline.json` is committed and
      `npm run balance:compare` exits nonzero when any metric drifts past
      tolerance (regenerate the baseline in the same commit as a deliberate
      balance change); `npm run balance:story` narrates one keeper round
      night by night for qualitative feel checks.

## Next

- [x] **Dusk telegraph** — the day header forecasts tonight's shade count
      and motes prowl the rim in proportion, so night is triage, never
      ambush. (True directions appear as approach lines once shades spawn.)
- [x] **Structure info on tap** — tapping an occupied slot by day opens an
      inspector: toughness, live glow (level multiplier applied), adjacency
      boosts actually in effect, dawn income, defensive stats, neighbors,
      and level progress.
- [x] **Level-up depth** — veteran tier at 7 nights: +1 more toughness,
      glow ×2, watchtowers gain a third nightly bolt. Level pips on the map,
      progress in the inspector. Round 1 untouched (nothing survives 7
      nights bare); arcs now spike to 12-14 nights when veterans snowball.
- [x] **Night variety** — omens on every 4th night, rolled and announced at
      the dawn before: a Hungry Night (+2 shades) or a Still Night (none,
      but +3 bank into the next). The forecast/telegraph includes them; the
      draft now consumes a fixed number of rng rolls so upgrades can never
      butterfly the night rolls. Side catch: overflow shades whose prize
      fell used to evaporate free — they now vent at the Heart (14), which
      finally prices turtling out (bunker 4.2n vs keeper 5.0n) and opened a
      second death channel (25% of keeper deaths are vents).
- [x] **Sound + juice** — a tiny WebAudio synth (no assets): placement
      thunk, banish chime, tower zap, dusk/dawn tones, fall and final
      tolls, heart-hit thud. The UI diffs engine telemetry between frames;
      the engine stays pure. Vignette presses in below 70% Heart and
      pulses below 30%. Persisted mute toggle.

- [x] **Heartseekers (death-channel variety)** — from night 7, every fifth
      shade ignores the town and goes for the Heart. Counterplay keeps the
      one-verb rule: tap the center to post the warden AT the Heart;
      watchtowers near the center burn seekers at the threshold. The
      forecast announces them. Keeper deaths now split 63% falls / 13%
      heart strikes / 24% vents (was 100% falls).

- [x] **Meta value on both axes** — the marginal-value panel now measures
      Δnights AND Δembers per upgrade, with a shelf-warmer assertion: every
      upgrade must earn its slot on at least one axis (outerRing exempted
      until ring-2 content lands). emberChoir vindicated (+2.2e);
      swiftWarden was exposed at +0.2n/+0.2e and buffed (hold 2s, cooldown
      2s) to +0.8n/+1.4e.

- [x] **Bodyguard palisades (placement depth)** — a palisade shields its
      neighbors: shades that would strike an adjacent structure strike the
      wall instead, so WHERE the wall goes decides who is safe. A lantern
      kept near the center slows heartseekers. Placement spread widened
      from the 1.0n floor to 1.4n (keeper 5.4 vs randomPlace 4.0); turtle
      gap 1.0n.

- [x] **The frontier (outer ring identity)** — ring-2 ground yields +50%
      Glow but the dark reaches it 10% sooner; the meta description says
      both. Meta value is now also measured in ARC context (each upgrade
      pre-owned across the 5-round arc): outerRing measured -6.0 arc
      nights as pure economy expansion (glow saturates — surplus can't buy
      nights) and +5.0 once the bots learned its real use: room for the
      expanded wall when the inner keep fills, plus covered frontier farms.
      Trap/shelf-warmer assertions now consult both round-1 and arc axes.

- [x] **Mobile PWA** — manifest, standalone display, SVG icon, theme
      color; install-to-homescreen works from the Pages deploy.

- [x] **Milestone tier** — two upgrades sealed behind best-nights records,
      not Embers: Beacon Heart (8-night vigil; the Heart burns one shade at
      each dusk from night 3, shown in the forecast) and Emberheart
      (10-night vigil; +1 Ember per night past the fourth). The shop shows
      sealed cards with their requirement; measured +0.8n/+1.0e and +1.4e
      on round 1, +3.8 and +0.6 arc nights.

- [x] **Night UX + pacing** — empty nights (Still Nights) resolve in 4s
      instead of idling the full 10s minimum; the night panel shows each
      warden's readiness; first-run home screen teaches the loop in three
      lines. Realtime hit feedback: feeding shades visibly gnaw, bites and
      falls flash where they land, Heart strikes flash at the center.

- [x] **Graphics & UX overhaul (10 passes)** — rendering moved to a layered
      draw.js: eased dusk/dawn ambient light, starfield, living flame
      Heart; vector silhouettes for every building shared with draft
      cards; wispy shades with eyes and a lantern-bearer warden who walks
      between posts; ghost placement previews with adjacency links;
      on-map countdown arcs and tower bolt pips; dusk/dawn sweeps with
      night title cards; chip HUD with day-timer and a burning-wick heart
      bar; a fall-screen chronicle (per-night sparkline + itemized Ember
      ledger via engine getEmberBreakdown); tiered Ember shop; reduced-
      motion and focus-visible support.

- [x] **Browser smoke in CI** — puppeteer-core drives a real Chromium
      through one full loop (home -> place via canvas tap -> dusk -> night
      -> fall -> chronicle -> shop) on every push, failing on console
      errors, progression misses, or horizontal overflow at phone width.
      `window.__game` exposes getState/setState/fastForward as the handle.

- [x] **The Ruins Remember (third pinnacle)** — sealed behind a 12-night
      vigil: each building the dark takes pays +1 Ember at the fall
      (measured +3.4e round 1, the strongest ember payer), and fallen
      slots leave visible ash on the map until rebuilt over. Closes the
      lore loop: losses are literally banked as memory.

- [x] **Combat legibility pass** — playtest feedback said the night's rules
      were sound but untaught. Now: grappled shades wear a gold arc that
      banishes when it closes; a guarded post under pile-on shows "+N
      feeding" so warden saturation is visible; tower bolts draw a bright
      lance from tower to victim at the kill; inspecting a tower rings the
      neighbors it covers (and its Blind spot row says it cannot save
      itself); night buttons say "Save the Farm — bites in 3s" for
      rescuable feeds; the how-to states the three night rules. Damage is
      priced on screen: floating \u221218 where a building falls, \u2212N at
      the Heart for strikes and vents, sated shades disperse as motes
      instead of vanishing, and a hatched ghost segment on the heart bar
      telegraphs the loss that feeding shades are about to land.

- [x] **Ways out** — a vigil can be abandoned mid-run (quiet button under
      the log, double-tap confirmed; the dark takes the town now and the
      nights survived still pay — no exploit, since the Ember formula is
      dominated by nights), and the home screen gains a tucked-away full
      reset ('Burn everything', double-tap confirmed) that wipes the save.
      Both covered by the browser smoke.

- [x] **The dark spreads (fun fix)** — playtest verdict: every shade
      funneled into one slot, towers watched, and the night was a
      spectator sport. Root cause: independent weighted targeting plus an
      uncapped palisade bodyguard. Now the night's targets are sampled
      WITHOUT replacement in waves (K shades threaten K distinct positions
      before any repeat) and a palisade shields at most 2 strikes a night.
      Placement spread jumped 1.4 -> 2.0 nights (keeper 5.8 vs randomPlace
      3.8); towers proc constantly; the warden's cooldown is now a real
      choice of who to save. Deeper Drafts, left worthless by the change,
      re-identified as 'four cards, two of them defenses' (+10.6 arc
      nights, was +0.2).

- [x] **Light earns its slot** — playtest question: 'what's the point of
      the slowdown building?' Measurement agreed: a keeper who never
      picked lanterns beat one who did by 0.6 nights (a trap card), and
      the bell measured zero. Reworked: shades don't eat light (lanterns
      are never targeted), lit ground slows attackers AND quickens the
      Warden's banish (×0.6 hold), a lantern-lit watchtower gains +1
      bolt, and the bell's toll hastens the Warden (reposition −1s per
      standing bell) on top of its +2s delay. Bought after the core wall,
      lanterns now measure +0.6 nights; bought early they still lose —
      build order is the depth. Keeper ceiling rose to 6.8n; placement
      spread 2.6n over random.

- [x] **Breaking the hold (and saying so)** — playtest question: 'should
      wardens be movable during a night?' They always were, on the
      cooldown — but nothing said so, and a grappling warden refused to
      move at all. Now a rested warden can be redirected anywhere, even
      mid-grapple: the first tap warns ('the grappled shade bites fast'),
      the second tears him free, and the dropped shade resumes feeding on
      a 1.5s fuse (RELEASED_FEED_TIME) instead of the full 5 — breaking a
      hold is a real sacrifice, never a stall. The verb is taught in
      place: per-warden status chips ('grappling at the Farm — tap a
      threat twice to break off' / 'moves again in 3s' / 'ready — tap any
      threat to redirect him'), a cyan readiness ring that fills around
      the warden's feet on the canvas, a one-time coach mark the first
      night he sits ready while shades feed, and night-rail suffixes
      ('must break hold' / 'resting'). Guarded by a `juggler` bot profile
      that retasks on every cooldown: it must always fall and never beat
      committed holds (measures 6.2n vs keeper 6.8n).

- [x] **The hands are spent (mend verb + card-value panel)** — review
      found the day verb dies at day 6: the inner keep fills, and every
      later day is a skip-button tax. New rule, same grammar as building:
      one pair of hands each day — place a structure OR mend one bitten
      hit point for 12 Glow (build-or-mend, never both; anything looser
      measured as an immortality engine, keeper 6.8 -> 9.4n). Mend lives
      in the tap-to-inspect panel. Keeper ceiling 7.6n/172s mean (was
      6.8/152s); villager band untouched at 3.8n/111s; per-seed round-1
      outlier cap recalibrated 240 -> 280s. Also new: a per-card
      ban-one value panel in the harness (what the keeper loses when a
      card is banned) — it found well/granary/emberKiln/shrine measure
      exactly +0.0n/+0.0e (interchangeable filler; queued for identity
      work), and 'resting' in the night rail now reads 'Warden resting'.

- [x] **The economy tail earns its keep (cycle 2)** — identity pass on
      the four cards the ban-one panel found at +0.0/+0.0: granary is
      tempo (+9 at dawn), the well waters (Farms +0.6/s, Granaries +3 at
      dawn), the kiln banks surplus (cap 6), the shrine remembers harder
      (+2 base). Keeper's economy tail is now situational (granary while
      dawns compound, payout cards once the wall stands). Chasing the
      remaining zeros exposed two deeper truths, both fixed: (1) early
      Glow tempo is worthless in this design — three reworks of Morning
      Stockpile (+15, +24, +1/dawn/structure, first-structure-free) all
      measured EXACTLY +0.0n, so the slot became Second Hands (mend no
      longer spends the day's act, +1.6 arc nights); (2) the 5-seed meta
      panel flaps under placement butterflies — condemned upgrades now
      get their verdict confirmed on a 15-seed panel before the gate
      fails (deeperDrafts was exonerated by exactly this: screened
      -0.4n, confirmed +0.7n/+5.5 arc).

- [x] **A Veiled Night (cycle 3)** — third omen: from night 8, a third
      of omen rolls bring mist that blinds every watchtower (zero bolts;
      the Warden stands alone). Announced a day ahead like all omens, so
      it drives real preparation — mend the taunt wall, bank the warden.
      Drifting mist banks on the canvas make it felt, not just labeled.
      Also: shop tier retitled (Second Hands no longer 'starts faster'),
      screenshot harness now captures the inspector and the shop.

- [x] **The App splits at its seams (cycle 4)** — App.jsx had grown to
      ~900 lines holding five concerns. Extracted verbatim into focused
      modules: Home.jsx (fire, ledger, shop, reset), FallenPanel.jsx
      (epitaph, sparkline, chronicle), describeSlot.js (inspector
      readout), StructureIcon.jsx. App.jsx is 686 lines of what it
      should be: the loop, the canvas, the day/night rails. Folded in
      one reader-facing win: the inspector now shows payout cards'
      CURRENT worth (kiln: embers banked so far; shrine: 2 + standing
      neighbors) so banking Glow is a visible strategy, not a fall-
      screen surprise.

- [x] **The Long Dawn (cycle 5)** — the game had no horizon: after the
      eleventh upgrade the shop went quiet and nothing marked an ending.
      Now, with everything kept, one goal remains — hold the light for
      15 nights. Calibrated against a new permanent 'kitted ceiling'
      panel (keeper with every upgrade: mean 20.2n, best 27n; asserted
      both reachable and still mortal). Completing it turns the emblem
      gold, closes the story on the home screen (the wanderer kneeling
      in these stones — the bridge to theruinsremember), and the vigil
      that first crosses the line gets its own golden record line.

- [x] **Past vigils (cycle 6)** — the genre gap: an incremental lives
      on visible progression between runs, and Hearthlight kept only
      the last one. The save now carries the last 30 falls; the home
      screen draws them as a bar row (height = nights, gold = the
      record), so the climb toward the Long Dawn is a shape you can
      see. Migration scrubs malformed entries; capped so the save
      never bloats.

- [x] **Desktop hands + the mend knock (cycle 7)** — the game was
      touch-only: now 1-4 pick a card by day (1-3 answer the night
      rail's threats), D calls the dusk, R rerolls, Escape drops the
      selection. Key hints render only on wide hover-capable screens —
      phones never see them. The night rail's triage order was
      factored out (topThreats) so keys and buttons can never
      disagree. Mending also got its voice: two woody taps.

- [x] **The villager learns the verbs (cycle 8)** — the median-human
      model that anchors the 45-150s first-play band ignored mend and
      reroll entirely, so every new verb quietly aged the measurement.
      The villager now rerolls a dead draft a quarter of the time and
      mends a full town about a third of the time (random target, not
      keeper triage). Band re-measured: unchanged at 3.8n/111s — new
      verbs deepen the ceiling without moving the floor, which is
      exactly where they should sit.

- [x] **The veteran lamp pierces the mist (cycle 9)** — review caught
      the veiled rotation quietly shaving the meta arc's late payoff
      (mist punishes exactly the tower towns upgrades build). Veteran
      (level 3) watchtowers now keep ONE bolt on Veiled Nights: seven
      survived nights buy something the mist cannot take. Kitted
      ceiling rose 20.2 -> 21.8 nights — the depth lands in the Long
      Dawn chase, where it belongs. Inspector says so on veteran
      towers. Also audited the effects queue for unbounded growth
      (pruned at age 3s — clean).

- [x] **The mist muffles the dark (cycle 10)** — story-mode review
      across all five seeds found 40% of optimal-play deaths landing
      exactly on the FIRST possible Veiled Night: an announced ambush
      is still an ambush when no counterplay budget is left. Veiled
      Nights now thin the wave (VEILED_HUSH = 4 fewer shades) — blind
      towers, but a hushed dark. First-veil deaths dropped to 1 in 5;
      keeper 7.4n/163s; kitted ceiling 23.2n. The dawn omen copy says
      both halves now.

- [x] **Carry the fire (cycle 11)** — saves lived only in one
      browser's localStorage: a cleared cache or a new phone burned
      everything. The home screen now writes the whole vigil as one
      unicode-safe base64 'ember-script' (copy to clipboard, with a
      by-hand fallback) and kindles from a pasted one (validated
      through migrateState — garbage will not catch). The browser
      smoke proves the full round trip: export, wipe the save,
      import, confirm.

- [x] **Late-game visual QA (cycle 12)** — first-ever inspection of
      the states players reach after hours: a kitted outer-ring town,
      two wardens, veterans, veiled mist (new permanent screenshot
      scene). Found and fixed: the mist was invisible in practice
      (now a pall + three drifting banks that READ as weather), and a
      stale 'Day N' banner could fire while the phase was night (dawn
      banner now requires the day phase). Level pips, veteran stars,
      ruins, readiness rings, tethers all verified good.

- [x] **The Warden's temper (cycle 13)** — the night verb stayed flat
      while the wall scaled with levels: by the late game the player
      was mostly watching towers work. Banishes THIS run now temper
      the Warden — seasoned (6) / grim (14) / lightless (24), each
      quickening his grip (hold x0.85/0.7/0.55). Run-only, resets at
      the fall: night play compounds within a vigil, never across the
      meta. The status chip carries the title; the log announces each
      tier. All guards hold (bunker, juggler, kitted-mortality);
      kitted ceiling 23.4n.

- [x] **The howl has a shape (cycle 14)** — vents are a fifth of all
      heart loss, but a venting shade drew the same calm three-mote
      dissolve as a sated one: the most confusing loss channel was
      visually mislabeled. A shade that finds only ash now howls — a
      jagged crimson streak from the ruin to the Heart, with its own
      falling-wail sound — so the loss reads as cause, not glitch.

- [x] **The front door tells the truth (cycle 15)** — README and
      CLAUDE.md had aged fourteen cycles: no mend, no Veiled Nights,
      no temper, no Long Dawn, no ember-script, no keyboard. Both now
      describe the game that actually ships, the README's assertion
      list includes the juggler and kitted-mortality guards, and
      CLAUDE.md gained the screenshot-harness command plus the JSX
      \uXXXX gotcha that once shipped a bug.

- [x] **The temper is felt (cycle 16)** — a Warden tier landed as one
      scrolling log line. Now the crossing gets a cyan banner ('The
      Warden grows grim — his grip quickens'), a rising whetstone
      shing, and a haptic tick; the first-run how-to mentions that
      banishes temper him. Discoverability for cycle 13's mechanic.

- [x] **Rank-ups have a dawn (cycle 17)** — structures leveled in
      silence: a tower reaching veteran (+1 bolt, mist-piercing lamp)
      got no acknowledgment anywhere. Dawn now logs each growth ('The
      Watchtower stands veteran — the nights have taught it') and the
      map glints gold with a 'lvl 2' / 'veteran' rise at the slot.
      Number effects accept a color so rank-ups read gold, not
      damage-red.

- [x] **One fire, one window (cycle 18)** — two open tabs both
      auto-saved every 2s: last-writer-wins silently trampled
      progress. Now a tab that sees another window write the save
      stands down — engine loop paused, saving stopped, a quiet
      overlay ('Another window tends this fire') with a tend-it-here
      button that reloads the save and reclaims. Verified live with
      two Chromium tabs handing the fire back and forth.

- [x] **Ten ticks a second is plenty (cycle 19)** — the game loop
      called setState(tick(...)) on every animation frame, re-rendering
      the whole React tree at 60fps on phones while the canvas already
      painted from its own loop. Engine/React updates now flush at
      ~10Hz with dt accumulating between flushes (nothing lost, 1s cap
      preserved); the canvas keeps its 60fps animations. Pure battery
      win, verified by smoke and the screenshot suite.

- [x] **Closing audit (cycle 20)** — three full assert runs with
      fresh random lanes (all green), every gate re-run, and the
      Measured state section below rewritten from live numbers (it
      had aged ~30 cycles: 27 tests and a 5.4n keeper were ancient
      history).

- [x] **The Ember tree, and the frames to draw it (cycle 21)** — two
      findings, one commit. (1) The meta layer was a flat shop: eleven
      cards in four tiers, every one of them independent, so Embers
      bought a shopping list and the only decision was "which is
      cheapest". It is now a tree with three roots — Stone (the town
      endures), Watch (the night is answered), Ember (the light reaches
      further) — where every node past a root grows out of another and
      the three pinnacles crown their own branches. The Long Dawn is a
      node now, not a paragraph: a crown fed by all three pinnacles,
      showing best-nights over 15. Kindling a node runs light up the
      vein that fed it, blooms the medallion, throws sparks, sounds a
      rising third, and (when a root completes) floods the whole branch
      and says so. The gating is provably balance-neutral: a child never
      costs less than its parent and every edge runs forward through the
      harness's META_ORDER, so a greedy keeper buys exactly what it
      bought before — `balance:compare` is clean on all five seeds, arc
      for arc. Both invariants are now unit-asserted so the tree cannot
      silently grow a shape that taxes the player.
      (2) Chasing "make it performant" with a new `perf:probe` harness
      (throttled Chromium, real paint timings off `window.__game.paint()`)
      found the game running at **15fps on a phone-grade core** — and
      the cause was not the JS everyone had been optimizing. A CPU
      profile put 96% of the frame in `(program)`: rasterization. No-oping
      `fillRect` alone restored 59fps; halving the backing store restored
      55. The game was fill-rate bound on five full-canvas gradient fills
      per frame. Now: sky, soil, rings, pads and vignette live on two
      cached layers (full day, full dark) cross-faded by the hour, so the
      2.5s dusk ease rebuilds nothing; the Heart's additive glow is
      bounded to its own reach instead of the whole canvas; the veiled
      mist renders at quarter scale and stretches; the dread throb moved
      from a 5Hz full-canvas fill to a compositor-driven CSS overlay; the
      backing store sizes to what the display can actually resolve instead
      of a flat 2x. **Day 15 → 58fps, late night 13 → 58fps**; worst frame
      21.2ms → 6.7ms. Renders verified pixel-faithful against before-shots.

- [x] **The tree grows a tail (cycle 22)** — the rebalance, from the fun
      queue. Two problems, both structural.
      (1) The Ember root fanned three ways off one node: a shelf, not a
      path. Chaining it (choir → frontier → light) was the obvious fix
      and measured *terribly* — outerRing is a -1.0n drag in a young town
      that only pays across an arc, so making it a toll on the way to the
      Heartstone collapsed its arc value from +14.2 to +1.2 and flattened
      the whole meta climb (7.4 -> 7.6n, and the "later rounds are longer"
      assertion failed outright). It is now a fork: the frontier hangs off
      the choir as its own prong, and the Heartstone chains to the
      Emberheart. A branch you take when you are ready for it, never a
      toll. Also learned the hard way: the old prices were ALREADY a
      per-branch ladder, and a round of unmeasured "ladder polish" cost
      1.4 arc nights on its own. Only one price moved in the end —
      emberheart 16 -> 20, which the chain requires.
      (2) The real incremental problem: eleven one-time booleans meant the
      upgrade screen could be FINISHED, and every fall after about the
      sixth paid a currency with nothing to buy. The three axes an
      incremental actually runs on now carry RANKS — toughness
      (stoneFoundations 5/18/48), income (emberChoir 10/30/78), light
      (heartstone 20/52/120) — so late Embers always have somewhere to go.
      Ranks are deliberately NOT part of the story: the Long Dawn still
      asks only that every node be kindled, so cycle 5's calibration
      stands untouched. Two new guards: a maxed town must still fall
      (IMMORTAL TAIL) and ranks must actually pay (maxed 25.6n vs kindled
      23.4n). The keeper bot learned to hold back the price of the
      cheapest node it can still open and pour only the surplus — spending
      savings on a cheap rank measured a full arc-night worse, which is
      the same trap a real player falls into. Net: arc 7.4 -> 9.8n,
      identical to cycle 21, with every per-upgrade value unchanged.
      Both ceilings are now in the committed snapshot; neither was before.

- [x] **The wave comes in smoothly (cycle 23)** — playtest verdict: the
      framerate is still bad when the shades come in. It was, and the
      harness could not see it: `perf:probe` only sampled STATIC hydrated
      scenes, so the dusk transition and a full wave in approach — the
      exact moment being complained about — had never been measured, and
      had no screenshot either. Both are now permanent scenes. Measured at
      4x throttle it was the worst frame in the game by a wide margin
      (44fps, 6.1ms mean, an 89ms hitch). Three causes, each found by
      ablation rather than guesswork:
      (1) seventeen shades meant seventeen `createRadialGradient` calls a
      frame for their glowing cores — half the scene's cost. Each body
      colour is now drawn once into a sprite and blitted.
      (2) each shade dragged a dashed trail all the way back to the rim,
      and dash tessellation is charged by path length every frame (freezing
      the animation offset changed nothing — it is the dashes, not the
      motion). The trail is now a short comet tail; it only ever showed
      where a shade came FROM, which the head and a stub say just as well.
      (3) the 89ms hitch was self-inflicted in cycle 21: the dread vignette
      was baked into the cached terrain layers, so every Heart wound
      rebuilt twelve full-canvas gradients. Moving it to its own canvas
      layer fixed the hitch and cost a full-canvas blit per frame instead
      (day 59 -> 41fps), which is the same deferred-raster trap as before —
      the paint-ms metric read 1.2ms throughout while a third of the frame
      rate quietly went missing. It now lives on the compositor beside the
      throb it already shared a job with, and costs nothing at all.
      Dusk 44 -> ~52fps with the hitch gone (89ms -> ~9ms worst frame);
      late night 58 -> 60fps and its mean paint nearly halved. CLAUDE.md
      now says to read the fps column, not the milliseconds.

- [x] **The first fire, the taunt, and the compositor (cycle 24)** — three
      playtest reports, three different kinds of answer.
      (1) "How do you unlock the first node? It should be possible after
      the first death." It wasn't. A median first-time player banks 3-4
      Embers and the cheapest root costs 5 — the tree simply did not open
      until the second or third vigil, and nothing measured it because the
      harness reported the KEEPER's Embers, never the villager's. It does
      now, and asserts on the worst seed rather than the mean. A first
      vigil is topped up to exactly the price of kindling something (the
      FIRST FIRE, itemized on the fall screen); every later fall pays only
      what it earned.
      (2) "All the shades went to a single palisade and then I died." The
      measured answer was that the card is fine and the TEXT was not: one
      wall beats none (6.4n vs 5.8n) and several beat one (7.4n), so a
      palisade is doing its job as a taunt and the failure of relying on a
      lone wall is the intended one. But nothing said so — "shields its
      neighbors" reads purely protective. It now says it draws the dark to
      itself and that one wall alone gets swarmed, the inspector counts
      the walls standing, and two permanent profiles assert the card can
      never quietly become a trap. A first attempt to "fix" it by limiting
      the shield to a wall that can still stand was reverted: it moved
      concentration by 1% and cost 1.6 arc nights.
      (3) "Should easily hold 60-120fps." The static scene left the frame
      loop entirely: the terrain is now two stacked canvases cross-faded
      by the dark one's CSS opacity, so no frame blits the whole map any
      more (late night 44 -> 59fps measured against a same-session
      control). Two other things were tried and REJECTED on measurement —
      sprite-ing the large radial gradients (worse at every size: a big
      alpha blit costs more than the gradient here) and skipping the
      redundant terrain blit (superseded by the stacked layers).
      The harness also grew teeth it badly needed: best-of-N sampling,
      after an unchanged build measured 58fps and then 33fps an hour
      apart and silently invalidated an afternoon of comparisons.

- [x] **The wave moves like a wave (cycle 26)** — playtest: "it looks
      stuttery for the movement of the shades. Are they on a low tick rate
      or something?" They were, and no amount of frame rate was ever going
      to fix it. Cycle 19 dropped the engine/React flush to 10Hz for
      battery and claimed "the canvas keeps its 60fps animations" — true
      for anything driven by `animTime` (stars, flame, dash offsets) and
      FALSE for everything positioned from `round.time`: shades in flight,
      countdown arcs, Warden readiness rings. Those advanced ten times a
      second while the canvas painted at 60-120, so every shade held the
      same position for five or six frames and then jumped. Every cycle of
      render optimization raised the frame rate without making the motion
      any smoother, which is exactly the shape of the complaint.
      The paint loop now carries an interpolated clock between flushes
      (`renderTime()`, clamped at 250ms so a stalled engine can never let
      the picture run away from the simulation) and the whole moving half
      of the scene reads from it — including the tap hit-test, so a tap
      lands on the wisp the player can actually see. The dusk fade got the
      same treatment via a CSS transition on the dark layer's opacity.
      Measured, not assumed: the browser smoke samples the drawn clock
      against the engine clock and now reports 55 distinct drawn positions
      over 55 frames against 10 engine flushes — it would have been 10
      before — and fails if motion ever quantizes to the flush again.
      Same-session control comparison confirms no render cost.

- [x] **The day is a hand (cycle 27)** — playtest verdict: "the game is
      just...not fun." It wasn't, and every metric said it was fine.
      Measured first: 4.9 actions per minute, one every 12.3 seconds; the
      story showed six placements and then SEVEN consecutive days with no
      decision at all once the map filled; towers killed 12 of 20 shades
      on the final night while the player banished 2. The harness could
      not see any of it because every panel measured outcomes and none
      measured whether anyone was playing.
      So engagement became a measured promise: actions/min split by phase,
      the share of kills the player caused, both asserted. Then the fixes,
      in the order the measurements demanded — and two of them were wrong
      first and had to be measured back out.
      (1) Removing the one-placement-per-day rule changed almost nothing
      (4.9 -> 5.4). GLOW was the throttle, not the rule: you could play
      three cards and still only afford one. Glow is a morning wage now,
      paid in full at dawn and spent at once — the real-time trickle WAS
      the waiting.
      (2) The map then became the throttle: a hand of three fills six
      slots in two days. Three rings (9 / 13 / 15), the outermost being
      the Outer Ring's frontier, so the town outlasts the round.
      (3) A 23-slot town was far too strong (9.4n/183s), so the dark now
      scales with what you built. Charging from the first stone made
      TURTLING BEAT BUILDING — a worse failure than the one being fixed —
      so only sprawl past a keep's worth draws extra teeth.
      (4) Towers were doing the playing: one bolt a night instead of two.
      Night min length 10s -> 6s, approach 8-13s -> 4-8s, Warden cooldown
      6s -> 4s (3s made the juggler immortal — the guard caught it).
      Net: 4.9 -> 11.0 actions/min, day actions 5 -> 21 a round, player
      caused 51% of kills (was 12-35%), keeper 7.4n/155s — the same
      pacing band as before. Every day in the story now has 1-3
      placements where the back half used to have none.
      NOT FIXED: the night is still barely one action per night, and it is
      where the remaining gap to a genuinely busy 15-20/min lives. That
      needs the night's verb set to change, which is a different cycle.

## Later / ideas

- Lore: the shades are the Forgetting; this town becomes the ruins that
  remember (bridge to theruinsremember).

### Fun queue (measured gaps, most promising first)

- **The tail is only three nodes deep.** Ranks stop at 3 and only on
  toughness/income/light. If the late game still runs dry, the next step
  is either a fourth rank tier or ranks on a fourth axis — but measure
  the maxed ceiling each time: it is 25.6n against a kindled 23.4n, and
  the IMMORTAL TAIL guard is the wall it must not cross.
- **Nothing is ever spent twice.** Every node is a permanent yes; there is
  no branch you must give up. A respec ("scatter the embers") or a
  root-exclusive capstone would make the tree a decision rather than a
  checklist — the doctrine's "decisions, not busywork" applied to the meta
  layer. Guard with the arc panels: an exclusive choice must not measure
  as one correct answer.
- **outerRing is still the mispriced one.** -1.0n on round 1, +14.2 across
  an arc — the widest early/late split in the tree, and the reason it
  cannot sit in a main line. Worth a real look at whether the frontier
  should cost Glow rather than Embers.
- **The dead cards are still dead.** The ban-one panel has well, granary,
  emberKiln and shrine at +0.0n/+0.0e after a whole identity cycle. Their
  identities read well and measure as nothing; the next honest step is to
  cut one and see whether the draft improves.
- **The night verb is still one verb.** The Warden's temper gave it depth
  within a run; a second night verb (something a keeper spends instead of
  a reposition) is the biggest untouched design space.

### Perf queue

- Night scenes sit at 62-78fps under a 4x CPU throttle where day is 138.
  The remaining cost is DIFFUSE — heart glow, clearRect, threat arcs, the
  veil and the fog each measure ~10% and nothing dominates. There is no
  single fix left; the next real gain is either fewer simultaneous
  effects or accepting that this environment charges the CPU for fill a
  phone gives its GPU.
- The veil costs ~12% on veiled nights (65 -> 73fps with it off). It is
  already quarter-scale; the remaining cost is the full-canvas upscale
  blit.
- Batching candidates left, in call-count order: threat arcs (one path per
  colour instead of one per target), the Warden figure (one path instead
  of six strokes), the Heart's coals and sparks.
- THIS BOX CANNOT BE TRUSTED for fine-grained render A/B. Re-measure the
  control in the same session, every time, and prefer provable reductions
  over measured ones.
- The React tree still re-renders wholesale at 10Hz. Measured as noise
  next to raster, but it is the next floor if the canvas gets cheaper.

## Measured state (5-seed means)

- Round 1: passive 2.0 nights, villager (median human, now mend- and
  reroll-aware) 3.8n / 111s — inside the 1-2 minute first-play band —
  keeper ceiling 7.4n / 160s.
- Keeper meta arc: 7.4 -> 9.8 nights (160s -> 204s). Kitted ceiling
  (every upgrade owned): mean 23.4 nights, best 30 — the Long Dawn
  capstone (15 nights, everything kept) is provably reachable and the
  kitted town still always falls.
- Depth: keeper 7.4n vs randomPlace 4.2 (spread 3.2), bunker 4.6
  (turtle gap 2.8), juggler 6.0 (rotation-stalling loses to committed
  holds). Placement is a real choice; no strategy is immortal.
- Fun: 84% of heart loss in the final third; deaths 61% falls / 16%
  heart strikes / 22% vents (vents now howl visibly); ~4.6 leveled
  structures by arc end; the Warden tempers within a run
  (seasoned/grim/lightless).
- Meta: 11 upgrades on a three-root tree (stone chains, watch forks,
  ember forks-then-chains), with ranks on toughness, income and light so
  the tree never finishes paying out; all earning a measured axis,
  condemnations double-checked on a 15-seed butterfly panel. Three
  pinnacles crown their roots, sealed behind proven vigils (8/10/12
  nights); the Long Dawn is the tree's crown and closes the story. The
  tree's prerequisites are balance-neutral by construction (child cost
  >= parent cost; edges run forward through META_ORDER, both unit-
  asserted). Ceilings: every node kindled 23.4n mean / 30 best; every
  rank poured 25.6n / 33 — and both still fall.
- Render: on a 4x-throttled core — day 58fps, late night 60fps, and the
  heaviest frame the game draws (dusk, seventeen shades inbound behind
  the night banner) ~52fps with no hitch. Guarded by `npm run perf:probe`,
  whose scenes now include that transition; reviewed by the screenshot
  harness, whose scenes now include it too.
- 9 structures with measured identities, one-pair-of-hands days
  (build OR mend), three omens (hungry / still / veiled — veteran
  lamps pierce the mist), heartseekers, veteran tier, the frontier,
  draft reroll, ash ruins, keeper's ledger, 30-fall run history,
  ember-script save transfer, one-fire-one-window multi-tab guard,
  keyboard play, 10Hz state loop with 60fps canvas.
- 39 unit tests; CI runs lint + unit + balance (5 fixed seeds +
  15-seed confirmations) + build + a real-Chromium smoke of the full
  loop including the save round-trip; committed balance baseline
  guards against silent drift; installable PWA that plays offline.
