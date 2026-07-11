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

## Later / ideas

- A third meta tier gated on best-nights milestones rather than Embers.
- Browser smoke test in CI (puppeteer) once the UI stabilizes.
- Lore: the shades are the Forgetting; this town becomes the ruins that
  remember (bridge to theruinsremember).

## Measured state (5-seed means)

- Round 1: passive 2.0 nights, villager (median human) 3.6n / 112s — inside
  the 1-2 minute first-play band — builder ~4n, keeper 5.4n / 132s.
- Keeper meta arc: 5.4 -> 8.4 nights (132s -> 182s real time), with veteran
  snowball seeds reaching 12+.
- Depth: keeper 5.4n vs randomPlace 4.0 (spread 1.4) / economyGreedy 3.4 /
  defenseGreedy 5.4 / bunker 4.4 (turtle gap 1.0). Placement is a real
  choice; turtling always loses; the wall always wins.
- Fun: 93% of heart loss lands in the final third; deaths split 59% falls /
  4% heart strikes / 38% vents; ~4 leveled structures by arc end.
- Meta: every upgrade earns its slot on some axis (round-1 nights, round-1
  embers, or arc nights — asserted). Arc values: secondWarden +16.2n,
  morningStockpile +8.8, swiftWarden +7.0, emberChoir +6.4, deeperDrafts
  +6.0, outerRing +5.0, stoneFoundations +4.8, heartstone +4.6.
  secondWarden repriced 15 -> 22 embers: still the strongest single
  effect, no longer the best per-ember buy (0.74 n/e vs
  morningStockpile's 2.3).
- 9 structures, 8 meta upgrades, omens, heartseekers, veteran tier, the
  frontier; 23 unit tests; PWA installable; CI runs the five fixed seeds
  deterministically (`--ci`), local runs add a random lane.
