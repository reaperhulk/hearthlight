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
- [ ] **Structure info on tap** — tap an occupied slot by day to see its
      stats, level progress, and adjacency bonuses.
- [ ] **Level-up depth** — a second level tier (6 nights) and visible level
      pips; consider letting Wells level from adjacent leveled Farms.
- [ ] **Night variety** — named night events every ~4th night (a Hungry
      Night: +2 shades; a Still Night: none, but the next is worse), always
      announced the dawn before. Bounded, visible randomness only.
- [ ] **Sound + juice** — placement thunk, seal chime, fall toll; screen
      grain at low Heart. Keep it subtle.

## Later / ideas

- Second map ring content pass (outer-ring-only structures?).
- A third meta tier gated on best-nights milestones rather than Embers.
- Browser smoke test in CI (puppeteer) once the UI stabilizes.
- Mobile PWA manifest for install-to-homescreen.
- Lore: the shades are the Forgetting; this town becomes the ruins that
  remember (bridge to theruinsremember).

## Measured state (5-seed means)

- Round 1: passive 2.0 nights, villager (median human) 4.8n / 137s — inside
  the 1-2 minute first-play band — builder 4.0, keeper 6.0n / 155s.
- Keeper meta arc: 6.0 -> 10.2 nights (155s -> 221s real time).
- Depth: keeper 6.0n vs randomPlace 5.0 / economyGreedy 4.8 / defenseGreedy
  6.0 / bunker 5.8. Placement spread is exactly the 1.0n floor and bunker is
  only 0.2n behind keeper — both are watch items; widen with more
  adjacency/coverage play, not warden buffs.
- Fun: 81% of heart loss lands in the final third (strong crescendo); all
  deaths via structure falls (heart hits and vents never kill — a lever to
  vary); ~1.7 banishes/night; 2-3 leveled structures by arc end.
- Meta marginal value (Δ nights vs bare keeper): stoneFoundations +2.0,
  secondWarden +1.4, heartstone +0.8; morningStockpile/deeperDrafts/
  outerRing/emberChoir ≈ 0 on round 1 (arc/economy value only — recheck
  when measuring arcs per-upgrade).
- 9 structures, 8 meta upgrades; 18 unit tests; CI runs the five fixed
  seeds deterministically (`--ci`), local runs add a random lane.
