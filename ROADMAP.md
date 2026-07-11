# Hearthlight roadmap

The iteration queue. Each item is one coherent, measured, gate-passing
commit pushed to main. Update checkboxes as work lands.

## Now

- [x] **Persistence** — localStorage save/load with a versioned migrate.
      Without it a refresh erases the meta layer; most fundamental gap.
- [x] **Multi-seed harness** — run the bot across ~5 seeds, assert hard
      invariants per seed and pacing bands on the mean. Single-seed arcs are
      too noisy to tune against (measured: 13 → 17 → 15 → 25 → 19 nights).
- [x] **Round-1 pacing** — tuned to mean 9.6 nights / ~4 min (was 13/5.3);
      losses now cost 14 heart, escalation 1.18, warden holds 3.5s. Active
      gap widened: keeper 9.6n vs builder 7.0n. Meta arc 9.6 -> 17.0 nights.
      Bands asserted: keeper mean 6-11n, <=300s, active gap >=1n.
- [x] **Widen the build space** — +3 structures (Granary: dawn economy;
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

## Measured state (5-seed means)

- Round 1: passive 2.0 nights, builder 4.2, keeper 6.2 / 156s. The optimal
  bot is the ceiling — a first-time human dies around night 3-4, landing
  first-play lifetime in the target 1-2 minutes.
- Keeper meta arc: 6.2 -> 8.6 nights (156s -> 196s real time).
- 9 structures, 8 meta upgrades; 16 unit tests; CI green.
