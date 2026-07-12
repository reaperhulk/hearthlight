# Hearthlight roadmap

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

## Later / ideas

- Lore: the shades are the Forgetting; this town becomes the ruins that
  remember (bridge to theruinsremember).

## Measured state (5-seed means)

- Round 1: passive 2.0 nights, villager (median human) 3.6n / 110s — inside
  the 1-2 minute first-play band — keeper ceiling 5.4n / 128s.
- Keeper meta arc: 5.4 -> 8.4 nights (128s -> 175s), veteran-snowball seeds
  reaching 12+.
- Depth: keeper 5.4n vs randomPlace 4.0 (spread 1.4), bunker 4.4 (turtle
  gap 1.0). Placement is a real choice; turtling loses; the wall wins.
- Fun: 93% of heart loss in the final third; deaths 59% falls / 4% heart
  strikes / 38% vents; ~4 leveled structures by arc end.
- Meta: 11 upgrades, all earning a measured axis. Round-1 ember payers:
  ruinsRemember +3.4e, emberChoir +2.6e; arc pillars: secondWarden +15.8n
  (repriced to 22), swiftWarden +9.0n, morningStockpile +6.4n. Three
  pinnacles sealed behind proven vigils (8/10/12 nights).
- 9 structures (shrine now pays by adjacency), omens, heartseekers,
  veteran tier, the frontier, draft reroll, ash ruins, keeper's ledger.
- 27 unit tests; CI runs lint + unit + balance (5 fixed seeds) + build +
  a real-Chromium smoke of the full loop; committed balance baseline
  guards against silent drift; installable PWA that plays offline.
