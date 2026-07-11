# Hearthlight roadmap

The iteration queue. Each item is one coherent, measured, gate-passing
commit pushed to main. Update checkboxes as work lands.

## Now

- [x] **Persistence** — localStorage save/load with a versioned migrate.
      Without it a refresh erases the meta layer; most fundamental gap.
- [x] **Multi-seed harness** — run the bot across ~5 seeds, assert hard
      invariants per seed and pacing bands on the mean. Single-seed arcs are
      too noisy to tune against (measured: 13 → 17 → 15 → 25 → 19 nights).
- [ ] **Round-1 pacing** — keeper round 1 is 13 nights / ~5.3 min on every
      seed; target mean 6–9 nights without flattening the passive floor.
      Multi-seed also exposed: builder 12n vs keeper 13n — night play barely
      matters. Widen the active gap (warden strength vs tower crutch) while
      steepening. Encode both as assertions.
- [ ] **Widen the build space** — +3 structures (Granary: dawn economy;
      Bell Tower: slows the whole night's approach; Ember Kiln: converts
      held Glow to Embers at the fall) and +2 meta upgrades (Heartstone:
      +25 Heart; Ember Choir: +1 Ember per 2 nights at the fall). Re-measure.

## Next

- [ ] **Dusk telegraph** — show tomorrow night's shade count at dawn and the
      spawn directions at dusk, so night is triage, never ambush.
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

## Measured state (seed 424242, single-seed — pre multi-seed harness)

- Round 1: passive 3 nights/149s, builder 12/282s, keeper 13/323s.
- Keeper 5-round meta arc: 13 → 17 → 15 → 25 → 19 nights, all 6 meta
  upgrades owned, rounds lengthen in real time.
- CI green on GitHub Actions (lint, 13 unit tests, balance assertions,
  build) from a fresh install.
